# Weldcom AI: Luồng SQL Server -> Feature -> AI Runtime

**Ngày rà soát:** 21/07/2026  
**Phạm vi:** mô tả tĩnh từ source code hiện có. Báo cáo này không kết nối SQL Server, không chạy inference, không training, không ghi dữ liệu và không thay đổi model/policy.

Mục tiêu của tài liệu là giúp dựng một SQL Server database tạm đúng mức tối thiểu để kiểm tra luồng AI read-only. Nguồn code chính đã rà soát:

- `inference/online/config.example.yaml`
- `inference/online/sql_queries.py`
- `inference/online/score_new_events.py`
- `inference/online/feature_builder_l1.py`
- `inference/online/l1_scorer.py`
- `inference/online/feature_builder_l2.py`
- `inference/online/l2_scorer.py`
- `inference/online/policy_engine.py`
- `inference/online/data_contract.py`
- `inference/online/controlled_writer.py`

Không đưa credential, host, database name hay password từ file local vào tài liệu này.

## 1. Kết luận ngắn

Luồng AI runtime **không lấy dữ liệu từ Dashboard frontend**. Nguồn chính là event-level SQL Server, sau đó được chuẩn hoá thành feature DataFrame trong Python:

```text
dbo.data_iot_convert
  + dbo.data_machine
  + dbo.machine_location_his
  + dbo.data_machine_status (audit/enrichment)
        |
        v
canonical event features: time + KWh + status + data quality + context
        |
        v
L1 Candidate A: 20 event thật / machine / sequence segment
        |
        v
L2 selected LightGBM: 6 target probability
        |
        v
Policy v2: operational action + quality action + final_reason_v2
        |
        +--> dry-run/audit files (mặc định an toàn)
        +--> SQL result table (chỉ khi toàn bộ write gate được bật rõ ràng)
```

Để test AI bằng database tạm, nên đi theo hai bước:

1. `--stage-only --audit`: kiểm tra SQL extraction, context và canonical feature. Chưa load/chấm model.
2. `--dry-run --audit`: load Candidate A + 6 model L2 + policy, nhưng không ghi SQL.

Không dùng `--loop`, không dùng `--enable-sql-write`, không đặt `runtime.enable_sql_write: true` trong database tạm ở giai đoạn này.

## 2. Bảng SQL và vai trò

| Bảng cấu hình mặc định | Bắt buộc khi test | Vai trò trong pipeline | Ghi chú |
|---|---:|---|---|
| `dbo.data_iot_convert` | Có | Raw event source | Bảng input AI thực tế. Đây là bảng quan trọng nhất. |
| `dbo.data_machine` | Nên có | Map `machine_group_id` | Thiếu bảng/row sẽ fallback group `-1`; có thể làm L2 không ready nếu artifact yêu cầu context hợp lệ. |
| `dbo.machine_location_his` | Nên có | Map location tại đúng thời điểm event | Thiếu mapping fallback `location_id=-1`; không dùng location hiện tại để thay cho history. |
| `dbo.data_location` | Không bắt buộc cho feature hiện tại | Join/audit location | `location_id` lấy từ history; bảng này không cung cấp feature trực tiếp trong builder hiện tại. |
| `dbo.data_machine_status` | Khuyến nghị | Tên/type/note phục vụ audit | Model quyết định semantic từ `status_id` canonical 1..10, không dùng text trong bảng này làm model feature. |
| `dbo.ai_inference_checkpoint` | Có | Đọc checkpoint log trước khi chọn candidate | Hiện checkpoint không phải cơ chế chống trùng chính, nhưng query vẫn cần bảng tồn tại. |
| `dbo.ai_l2_fault_judgment_online_v2` | Có | Chống chấm trùng bằng `NOT EXISTS` | Khi dry-run, không có write nhưng query candidate vẫn tham chiếu bảng này. Khởi tạo rỗng là phù hợp. |
| `dbo.ai_l1_operation_event_sequence` | Không bắt buộc | So sánh historical L1 khi `--audit` | Có thể tắt `audit.compare_with_historical_l1` hoặc để pipeline fallback CSV. |
| `dbo.ai_inference_run_log` | Không cần cho dry-run | Chỉ write mode | Không được ghi trong quy trình thử nghiệm đề xuất. |
| `dbo.ai_inference_error_log` | Không dùng trên happy path hiện tại | Chuẩn bị logging | Không bắt buộc cho stage-only/dry-run. |

`dbo.data_cabinetglobal_kwh` và `dbo.data_cabinetglobal_kwh_daily` không nằm trong feature extractor event-level. Không dùng KWh cabinet/location-level để thay `status_kwh_start/end` theo machine nếu chưa có bridge machine-cabinet được xác nhận.

## 3. Contract của raw event table

Tên bảng/cột hoàn toàn cấu hình trong `config.local.yaml`. Mapping mặc định:

| `dbo.data_iot_convert` | Canonical field | Kiểu SQL khuyến nghị | Bắt buộc | Cách dùng |
|---|---|---|---:|---|
| `id` | `event_id` | `BIGINT` | Có | Định danh duy nhất, sort tie-breaker, chống trùng output. |
| `machine_id` | `machine_id` | `INT` | Có | Partition mọi phép tính sequence/context. |
| `status_id` | `status_id` | `INT` | Có | Map sang status semantic canonical 1..10. |
| `status_time_start` | `event_start_time` | `DATETIME2` | Có | Thời điểm bắt đầu event. |
| `status_time_end` | `raw_event_end_time` | `DATETIME2 NULL` | Có | Có thể null/invalid; builder sẽ repair hoặc đánh dấu open. |
| `status_kwh_start` | `raw_status_kwh_start` | `FLOAT/DECIMAL NULL` | Có | KWh đầu event; nullable. |
| `status_kwh_end` | `raw_status_kwh_end` | `FLOAT/DECIMAL NULL` | Có | KWh cuối event; nullable. |
| `error_code` | `raw_error_code` | `NVARCHAR(200) NULL` | Không | Đi vào fingerprint/audit; không là feature policy chính. |
| `is_deleted` | filter tùy chọn | `BIT NULL` | Không | Nếu cột tồn tại, pipeline tự lọc `ISNULL(is_deleted,0)=0`. |

Ràng buộc dữ liệu nên có:

- `id` unique và không null.
- `machine_id`, `status_id`, `status_time_start` không null.
- Mỗi machine có event được sắp đúng theo `(status_time_start, id)`.
- Không tạo hai event cùng id.
- Dùng cùng timezone/ý nghĩa thời gian cho toàn bộ rows; builder không tự convert timezone.
- Có ít nhất một event xảy ra sau event đang test để event trước có thể được xem là "closed" nếu `status_time_end` null.

### Master/context tối thiểu

`dbo.data_machine`:

| Cột | Kiểu khuyến nghị | Dùng cho |
|---|---|---|
| `id` | `INT` | Match `machine_id`. |
| `machine_group_id` | `INT NULL` | L1/L2 context categorical feature. |

`dbo.machine_location_his`:

| Cột | Kiểu khuyến nghị | Rule |
|---|---|---|
| `machine_id` | `INT` | Match raw machine. |
| `location_id` | `INT` | Context categorical feature. |
| `start_time` | `DATETIME2` | Inclusive: `start_time <= event_start_time`. |
| `end_time` | `DATETIME2 NULL` | Exclusive: `event_start_time < end_time`; null nghĩa là còn hiệu lực. |

`dbo.data_machine_status` tối thiểu có `id`; các cột `status_name`, `type`, `note`, `is_deleted` chỉ làm enrichment audit nếu tồn tại. Dù bảng status có text gì, model hiện map `status_id` theo `STATUS_MAP` trong code.

## 4. Cách worker chọn candidate và lấy context

`score_new_events.py` đọc checkpoint để log, sau đó `load_unprocessed_closed_candidate_events_sql()` chọn tối đa `runtime.max_events_per_run` event theo `event_start_time, event_id` khi đồng thời:

1. `event_id > runtime.min_event_id_to_process`.
2. Chưa tồn tại row cùng `event_id` và `event_source='ONLINE_CURRENT_SQL'` trong `ai_l2_fault_judgment_online_v2`.
3. `status_time_end > status_time_start`, **hoặc** có event khác của cùng machine với `status_time_start` lớn hơn.
4. Nếu raw table có `is_deleted`, row candidate và next-event đều không bị deleted.

Sau đó worker lấy context theo **row order**, không theo một time range cố định:

```text
PARTITION BY machine_id
ORDER BY status_time_start, id
```

Mặc định lấy `40` row trước và `2` row sau candidate. Vì vậy 22 raw rows là ngưỡng tuyệt đối lý thuyết để tạo một L1 window đủ 20 cho một target; để kiểm thử thực tế nên tạo **ít nhất 45 event liên tiếp mỗi machine**, để có đủ history, lookahead và nhiều target ready.

Không resample theo thời gian, không tự tạo event giả, không pad chuỗi bằng zero. Một big gap, end invalid hoặc open event có thể cắt sequence segment và làm event tiếp theo thiếu 20 history trong segment.

## 5. Raw event được xử lý thành feature như thế nào

### 5.1 Time, duration, gap, overlap

Sau khi sort theo `machine_id, event_start_time, event_id`, builder tạo `event_end_time`:

| Điều kiện | `event_end_time` | `end_time_source` |
|---|---|---|
| Raw end > start | Raw end | `RAW` |
| Raw end null, có next distinct start lớn hơn | Next start | `NEXT_EVENT_START_FROM_NULL` |
| Raw end <= start, có next distinct start lớn hơn | Next start | `NEXT_EVENT_START_FROM_INVALID_RAW` |
| Không có end hợp lệ và không có next start | null | `OPEN_EVENT` |

Sau đó builder tính:

- `duration_sec`, `duration_sec_model_value`;
- `gap_from_prev_sec`, `gap_from_prev_sec_model_value`;
- `overlap_sec = max(-gap_from_prev_sec, 0)`;
- cờ missing/invalid/open/imputed end;
- `is_non_positive_duration`, `is_long_duration`, `is_gap`, `is_big_gap`, `is_overlap`.

Threshold canonical lấy từ config và phải khớp contract:

```text
KWh imputation gap: 300 s
Small gap:            300 s
Big gap:             3,600 s
Long duration:      86,400 s
L1 window:               20 events
L2 past-event window:    10 events
```

Sequence segment bắt đầu lại tại event đầu machine, big gap, duration không dương, hoặc end unresolved. L1 không được phép lấy window qua segment boundary.

### 5.2 KWh event-level

Pipeline giữ raw KWh và chỉ impute rất hẹp từ event kề trong cùng machine:

- `kwh_start`: lấy raw start; nếu null, chỉ lấy raw end event trước khi gap có hướng trong `[0, 300]` giây.
- `kwh_end`: lấy raw end; nếu null, chỉ lấy raw start event sau khi gap có hướng trong `[0, 300]` giây.
- Không fill qua overlap, không chain-fill từ một giá trị đã impute.

Output quan trọng:

```text
kwh_start_value, kwh_end_value, kwh_start_source, kwh_end_source
kwh_available_flag, kwh_missing_flag, kwh_imputed_flag
kwh_delta, kwh_delta_model_value, kwh_rate_per_hour
kwh_negative_delta_flag, loaded_zero_kwh_flag, loaded_without_kwh_flag
```

`kwh_delta` có thể âm. Trong ngữ cảnh pipeline, đó là chênh lệch KWh event-level/raw-processed và được giữ làm evidence/quality signal; không tự quy kết là "điện năng tiêu thụ âm".

### 5.3 Status semantic và quality

Status canonical hiện được hard-map từ `status_id` 1..10:

| IDs | Nhóm semantic chính |
|---|---|
| 1 | Power on, current near zero |
| 2-3 | Production no-load / loaded |
| 4-5 | Maintenance no-load / loaded |
| 6-7 | Repair no-load / loaded; đồng thời known fault/maintenance/repair evidence |
| 8 | Normal power off |
| 9 | Power off with fault |
| 10 | Power off maintenance (code hiện cũng mang off-with-fault evidence) |
| Khác | `UNKNOWN_STATUS`, không ép thành normal |

Quality được giữ tách khỏi machine fault:

```text
time_quality_issue_flag = open OR non-positive duration OR big gap OR overlap
kwh_quality_issue_flag  = KWh missing OR imputed OR negative delta
data_quality_issue_flag = time quality OR KWh quality
energy_inconsistency_flag = loaded + zero/missing KWh OR negative KWh delta
```

Nghĩa là `CHECK_DATA`/`CHECK_ENERGY` có thể yêu cầu xác minh dữ liệu, không đồng nghĩa máy hỏng.

## 6. Feature đưa vào L1 và L2

### 6.1 L1 Candidate A

Artifact runtime là Candidate A, gồm hai profile `lenient` và `strict`. Candidate C không phải runtime candidate và bị contract chặn trong `L1Scorer`.

Mỗi profile L1 dùng window 20 event thật trong cùng `machine_id + sequence_segment_id`. Danh sách feature canonical gồm:

```text
status_id, status_type_code, current_signal_code,
hour_of_day, day_of_week, machine_group_id, location_id,
duration_sec, gap_from_prev_sec, overlap_sec,
kwh_delta_model_value, kwh_rate_per_hour,
is_on, is_loaded, is_no_load, is_current_near_zero,
kwh_available_flag, kwh_missing_flag, kwh_imputed_or_missing_flag,
kwh_rate_missing_flag, loaded_zero_kwh_flag, loaded_without_kwh_flag,
is_raw_end_missing, is_invalid_raw_end, end_time_imputed_flag,
is_non_positive_duration, is_long_duration, is_gap, is_big_gap, is_overlap
```

Nếu window không ready, output mang `l1_score_available_flag=0`, `l1_join_missing_flag=1` và `readiness_reason`; score L1 là null, không bị thay bằng zero.

Rule nghiệp vụ hiện tại:

```text
is_behavior_anomaly = lenient anomaly
is_sensitive_warning = strict anomaly AND NOT lenient anomaly
```

Strict-only là signal audit, không tự động nâng action level.

### 6.2 L2 LightGBM

Chỉ L1-ready row đi vào `build_l2_runtime_features()` và L2 readiness. L2 thêm các transform từ L1, ví dụ normalized score clip/log, strict-lenient gap/ratio và behavior anomaly flag. Future labels bị xóa trước prediction để tránh data leakage:

```text
future_fault_within_10_events
future_fault_within_30_events
future_fault_within_30min
future_fault_within_60min
future_maintenance_within_30_events
future_repair_within_30_events
next_fault_status_id, events_to_next_fault, seconds_to_next_fault
```

Mỗi LightGBM target đọc exact feature order từ `metadata.json` của artifact/profile được chọn. Row có missing/non-finite input sẽ không predict và nhận `L2_MISSING_REQUIRED_FEATURE:<column>` hoặc `L2_NON_FINITE_REQUIRED_FEATURE:<column>`.

Sáu target đang chọn từ `production_profile_selection.json`:

| Target | Profile | Threshold thực tế |
|---|---|---:|
| Fault within 10 events | `safe` | 0.130113 |
| Fault within 30 events | `strict_continuous` | 0.072355 |
| Fault within 30 minutes | `safe` | 0.070673 |
| Fault within 60 minutes | `safe` | 0.082103 |
| Maintenance within 30 events | `strict_continuous` | 0.108843 |
| Repair within 30 events | `strict_continuous` | 0.072070 |

## 7. Policy và output sau model

`policy_engine.apply_policy_v2()` so risk xác suất với threshold từng target, sau đó tạo hai nhánh độc lập:

| Operational action | Điều kiện ưu tiên |
|---|---|
| `CRITICAL` | known/off fault hoặc dự đoán fault within 10 events |
| `HIGH` | fault within 30 min, fault within 30 events hoặc repair within 30 events |
| `MEDIUM` | fault 60 min, maintenance 30 events, known maintenance hoặc L1 behavior anomaly |
| `LOW` | còn lại |

Quality action độc lập: `QUALITY_OK`, `CHECK_DATA_DETAIL`, `CHECK_DATA`, `CHECK_ENERGY`, `CHECK_DATA_AND_ENERGY`.

Các field output chính cho dashboard/API và audit:

```text
risk_fault_10_events, risk_fault_30_events, risk_fault_30min, risk_fault_60min
risk_maintenance_30_events, risk_repair_30_events
operational_action_level, operational_judgment, operational_overall_risk_score
quality_action_level, quality_judgment, quality_risk_score
behavior_anomaly_score, behavior_sensitive_score
final_reason_v2, explanation_json, readiness_reason
```

`explanation_json` là policy evidence có tính quyết định (threshold/margin/status/KWh/quality), không phải SHAP và không tự tạo nguyên nhân từ dữ liệu thiếu.

## 8. Cấu hình database tạm an toàn

1. Copy `inference/online/config.example.yaml` thành một file local không commit, ví dụ `config.temp-sql.yaml`.
2. Chỉ thay `database`, `tables`, `source_columns`, `machine_columns`, `location_columns` để trỏ database tạm. Không đổi model/policy/artifact selection.
3. Giữ các giá trị sau:

```yaml
runtime:
  dry_run: true
  enable_sql_write: false
  max_events_per_run: 100
  lookback_before: 40
  lookahead_after: 2
  window_size_l1: 20
```

4. Không truyền `--enable-sql-write`; không đặt biến môi trường cho phép write; không thêm DB tạm vào `sql_write_target_allowlist`.
5. Để `ai_l2_fault_judgment_online_v2` rỗng cho lần test đầu. Nếu table chứa các row `ONLINE_CURRENT_SQL` với event id đang test, candidate query sẽ chủ động bỏ qua chúng.
6. Có thể tắt historical compare trong config tạm nếu không dựng `ai_l1_operation_event_sequence` và không muốn dùng CSV local:

```yaml
audit:
  compare_with_historical_l1: false
```

### Hai lệnh kiểm tra phù hợp

Chạy từ `E:\OBAD`, sau khi tự tạo config database tạm:

```powershell
# 1. Chỉ SQL -> canonical feature, không load model.
python -m inference.online.score_new_events `
  --config inference/online/config.temp-sql.yaml `
  --stage-only `
  --audit `
  --max-events 100

# 2. Full Candidate A -> L2 -> policy, vẫn không SQL write.
python -m inference.online.score_new_events `
  --config inference/online/config.temp-sql.yaml `
  --dry-run `
  --audit `
  --max-events 100
```

Lệnh thứ hai có thể load PyTorch/joblib artifacts nhưng không ghi `online_l2_result`, checkpoint hay run log vì `dry_run` vẫn true.

## 9. Checklist dữ liệu trước khi chạy

### Dataset "happy path" để xác nhận AI có output

- Một machine có tối thiểu 45 event liên tiếp, `id` tăng và time tăng.
- Event duration hợp lệ, ví dụ end > start; tránh big gap > 3,600 giây trong phần 20 event trước target.
- KWh start/end có mặt và tăng hợp lý trên phần lớn rows; ít nhất một vài status loaded (`status_id=3`) với KWh delta dương.
- Có `data_machine.id` cùng `machine_group_id`; có history location bao phủ time range.
- Target cần test không phải event cuối chưa đóng.
- Không có output duplicate trong `ai_l2_fault_judgment_online_v2`.

### Dataset "quality scenario" để kiểm tra data/energy branch

- Loaded `status_id=3` + KWh delta `0` -> `loaded_zero_kwh_flag` và energy inconsistency.
- Loaded + KWh null -> `loaded_without_kwh_flag`.
- KWh end < start -> negative delta / KWh quality issue.
- End null ở event cuối -> `OPEN_EVENT`, không được score.
- Gap > 3,600 giây hoặc overlap -> time quality issue và sequence split.

### Dataset "fault/maintenance evidence" để kiểm tra policy

- `status_id=6/7`: repair evidence; code đồng thời đánh known fault/maintenance/repair.
- `status_id=9`: off-with-fault evidence.
- `status_id=4/5`: maintenance evidence.

Không kỳ vọng một input test nhỏ phải tạo tất cả risk action. Probability L2 phụ thuộc artifact và full feature vector; mục tiêu ban đầu là xác minh readiness, feature contract và output không null cho rows đủ điều kiện.

## 10. File audit cần đọc sau mỗi lần test

`--audit` tạo thư mục `data/realtime_audit/run_YYYYMMDD_HHMMSS/`. Ưu tiên kiểm tra theo thứ tự:

| File | Cần kiểm tra |
|---|---|
| `00_run_config_sanitized.json` | Config runtime; password đã được redacted. |
| `01_sql_used.sql` | Query/mapping thực tế đã dùng. |
| `02_raw_candidates.csv` | Candidate SQL có thực sự được chọn. |
| `03_raw_context.csv` | Có đủ 40-before/2-after theo machine hay không. |
| `04_joined_canonical_events.csv` | Status/location/machine context join. |
| `05_l1_event_features.csv` | Time/KWh/quality/segment feature. |
| `06_l2_runtime_features_without_scores.csv` | Feature L2 trước predict. |
| `08_l1_contract_report.json` | L1 feature order/type/window PASS/FAIL. |
| `09_l2_contract_report.json` | Per-target L2 missing feature/leakage/type. |
| Worker dry-run reports | L1 ready/unready, L2 ready/unready, policy-ready output và timing. |

Nếu `raw_candidate count = 0`, kiểm tra lần lượt: `min_event_id_to_process`, `is_deleted`, raw end/next event, và output duplicate table. Nếu L1 unready, kiểm tra segment/big gap/open event/thiếu 20 history. Nếu L2 unready, đọc exact `readiness_reason`; không tự fill một feature required bằng zero.

## 11. Ghi chú kỹ thuật và giới hạn hiện tại

- `config.local.yaml` là file local đã được `.gitignore`; không nên copy credentials sang báo cáo, frontend hay repository. Nên dùng config temp riêng cho SQL Server tạm.
- Backend dashboard sử dụng kết nối read-only riêng (`backend/app/db.py`) để đọc view/result phục vụ giao diện. Backend không phải thành phần chuyển raw SQL thành L1/L2 feature.
- Candidate query có tham chiếu checkpoint table dù checkpoint chỉ là log/progress hiện tại; database tạm vẫn cần table đó tồn tại.
- `artifacts.l1_enabled` hiện không được đọc như một runtime gate trong luồng full scoring của `score_new_events.py`; `--stage-only` mới là cách rõ ràng để chỉ kiểm tra feature, còn `--dry-run` chạy full model nhưng cấm write.
- Policy/version/model selection không được đổi trong quá trình dựng database tạm. Candidate A và 6 L2 target ở trên là source of truth runtime hiện tại.
- Báo cáo này không xác nhận SQL schema/database thật vì database hiện không truy cập được. Việc xác nhận cuối cùng phải dựa trên audit file của database tạm.

## 12. Ranh giới an toàn của thử nghiệm đề xuất

Quy trình trong tài liệu chỉ đọc SQL và ghi CSV/JSON audit cục bộ. SQL writer chỉ có thể chạy khi đồng thời có CLI flag, config enable, confirmation exact, env allow, lineage/environment/artifact integrity PASS, dry-run false và target DB allowlisted. Không thực hiện bất kỳ điều kiện nào trong báo cáo này.

