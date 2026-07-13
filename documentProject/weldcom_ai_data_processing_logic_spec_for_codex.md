# Weldcom AI Operational Assessment  
# Tài liệu đặc tả logic xử lý dữ liệu để đưa vào AI

Phiên bản: `DATA_PROCESSING_SPEC_V1`

Mục đích: dùng làm tài liệu nền cho Codex/VS Code khi xây dựng lại phần xử lý dữ liệu từ SQL Server gốc thành dữ liệu đưa vào mô hình AI.

Tài liệu này không mô tả giao diện dashboard.

Tài liệu này tập trung vào:

- Dữ liệu gốc lấy từ bảng nào.
- Chọn những trường nào.
- Xử lý thời gian, KWh, status, quality như thế nào.
- Tạo L1 dataset như thế nào.
- Tạo L2 evidence/label/features như thế nào.
- Khi chạy realtime/event mới thì phải xử lý ra sao để giống lúc train.
- Những gì đã thống nhất trong dự án.

---

## 1. Trạng thái dự án hiện tại

Dự án hiện đã có:

```text
L1 model:
  TCN Autoencoder
  Bài toán: Normal Behavior Deviation Detection

L2 model:
  LightGBM multi-label classifiers
  Bài toán: Fault / Maintenance / Repair Risk Confidence

Final historical output:
  ai_l2_fault_judgment_policy_v2_all.csv
  4,062,118 event
  91 cột

SQL historical table:
  dbo.ai_l2_fault_judgment_policy_v2_full

Dashboard SQL views:
  vw_ai_dashboard_kpi_v2
  vw_ai_dashboard_action_distribution_v2
  vw_ai_dashboard_quality_distribution_v2
  vw_ai_dashboard_top_machines_v2
  vw_ai_dashboard_alert_events_v2
  vw_ai_dashboard_machine_action_matrix_v2
  vw_ai_dashboard_machine_quality_matrix_v2
  vw_ai_dashboard_event_with_time_v2
  vw_ai_dashboard_daily_trend_v2
```

Hiện tại AI đã hoàn thiện ở mức:

```text
offline production candidate
```

Tức là:

- Đã train model.
- Đã có artifact.
- Đã score toàn bộ lịch sử.
- Đã import kết quả lịch sử vào SQL.
- Đã có view phục vụ dashboard.

Dự án còn thiếu:

```text
online / near real-time inference pipeline
```

Nghĩa là chương trình tự lấy event mới từ SQL gốc, xử lý feature giống lúc train, chạy AI và ghi kết quả mới vào SQL.

---

## 2. Những bảng dữ liệu gốc đã thống nhất sử dụng

### 2.1. Bảng chính: `data_iot_convert`

Đây là bảng event vận hành chính.

Vai trò:

```text
Mỗi dòng là một event trạng thái vận hành của một machine_id.
```

Các trường cần dùng:

| Cột gốc | Tên chuẩn trong pipeline | Vai trò |
|---|---|---|
| `id` | `event_id` | Khóa event |
| `machine_id` | `machine_id` | Máy |
| `status_id` | `status_id` | Trạng thái vận hành |
| `status_time_start` | `event_start_time` | Thời điểm bắt đầu event |
| `status_time_end` | `raw_event_end_time` | Thời điểm kết thúc gốc |
| `status_kwh_start` | `raw_status_kwh_start` | KWh đầu event |
| `status_kwh_end` | `raw_status_kwh_end` | KWh cuối event |
| `error_code` | `raw_error_code` | Hiện gần như không dùng vì missing 100% |

Ghi chú:

- `event_id` là khóa xuyên suốt pipeline.
- `machine_id + event_start_time + event_id` dùng để sắp chuỗi event theo từng máy.
- `status_time_end` có thể thiếu hoặc sai, nên không được tin tuyệt đối.
- `status_kwh_start/end` thiếu nhiều, nên chỉ là feature phụ có mask.

---

### 2.2. Bảng `data_machine_status`

Dùng để hiểu ý nghĩa `status_id`.

Status đã thống nhất:

| status_id | Ý nghĩa | Nhóm |
|---:|---|---|
| 1 | PowerOn / Bật nguồn | Normal |
| 2 | RunPdNoLoad / Chạy sản xuất không tải | Normal |
| 3 | RunPdOnLoad / Chạy sản xuất có tải | Normal |
| 4 | RunMeNoLoad / Chạy bảo trì không tải | Maintenance |
| 5 | RunMeOnLoad / Chạy bảo trì có tải | Maintenance |
| 6 | RunReNoLoad / Sửa chữa không tải | Repair/Fault |
| 7 | RunReOnLoad / Sửa chữa có tải | Repair/Fault |
| 8 | PowerOff / Tắt máy bình thường | Normal |
| 9 | PowerOffErr / Tắt máy có sự cố | Fault |
| 10 | PowerOffMe / Tắt máy bảo trì/lỗi | Fault/Maintenance |

Các status 11-14 là info signal, không xuất hiện trong phân phối chính hiện tại.

---

### 2.3. Bảng `data_machine`

Dùng để bổ sung thông tin máy.

Các trường có thể dùng:

```text
machine_id / id
machine name/code nếu có
machine_group_id nếu có
machine_type nếu có
```

Hiện trong model, `machine_id` không đưa trực tiếp vào L1 để tránh học thuộc máy.

Nhưng `machine_id` dùng để:

- group chuỗi event,
- chia threshold theo máy nếu cần,
- join dashboard,
- phân tích top máy rủi ro.

---

### 2.4. Bảng `machine_location_his`

Dùng để map máy với location theo lịch sử.

Logic:

```text
machine_location_his.machine_id -> data_machine.id
machine_location_his.location_id -> data_location.id
```

Với dữ liệu hiện tại, các máy trong IOT đều map được location active.

Active location đã biết:

```text
machines 11,36,37,45,46,67 -> location 3: CNC Thanh
machines 47,48,49,50,51,56,58,59 -> location 4: CNC Mã
```

Trong online inference, khi cần location của event:

- Ưu tiên lấy location active tại thời điểm event nếu có `time_start/time_end`.
- Nếu phức tạp, bản đầu có thể lấy active/latest location của machine.

---

### 2.5. Bảng `data_location`

Dùng để bổ sung tên vị trí/xưởng.

Các trường có thể dùng cho dashboard:

```text
location_id
location_name
location_parent_id nếu có
```

---

### 2.6. Bảng KWh cabinet

Có bảng:

```text
data_cabinetglobal_kwh
```

hoặc dữ liệu daily liên quan.

Nhưng đã thống nhất:

```text
Không có bridge trực tiếp machine-cabinet đáng tin cậy.
```

Vì vậy KWh cabinet chỉ dùng phân tích coarse theo location nếu cần.

Không dùng làm feature chính cho model event-level ở giai đoạn này.

---

## 3. Bài toán AI đã thống nhất

### 3.1. L1 - Normal Behavior Deviation Detection

Câu hỏi L1 trả lời:

```text
Máy hiện tại có đang lệch khỏi nền vận hành bình thường của chính nó không?
```

Mô hình:

```text
TCN Autoencoder
```

Train trên normal baseline:

```text
normal_lenient
normal_strict
```

Trong production:

```text
lenient = model chính
strict = cảnh báo nhạy / audit
```

L1 không phải model fault classifier.

L1 chỉ phát hiện deviation so với nền normal.

---

### 3.2. L2 - Fault Confidence / Deviation Validation

Câu hỏi L2 trả lời:

```text
Sai lệch hoặc trạng thái hiện tại có giống lỗi/bảo trì/sửa chữa hoặc xu hướng dẫn tới lỗi không?
```

Mô hình:

```text
LightGBM multi-label independent classifiers
```

Targets:

```text
future_fault_within_10_events
future_fault_within_30_events
future_fault_within_30min
future_fault_within_60min
future_maintenance_within_30_events
future_repair_within_30_events
```

Output runtime:

```text
risk_fault_10_events
risk_fault_30_events
risk_fault_30min
risk_fault_60min
risk_maintenance_30_events
risk_repair_30_events
```

---

## 4. Logic xử lý thời gian event

### 4.1. Vấn đề

Trong `data_iot_convert`:

- `status_time_end` thiếu khoảng 1%.
- Nhiều dòng có duration <= 0.
- Có overlap/gap.
- Có event mở.

Do đó không dùng raw end trực tiếp.

---

### 4.2. Quy tắc sửa `event_end_time`

Với mỗi `machine_id`, sort theo:

```text
event_start_time, event_id
```

Xét từng event:

```text
raw_event_end_time = status_time_end
next_event_start_time = event_start_time của event kế tiếp cùng machine_id
```

Quy tắc:

```text
Nếu raw_event_end_time > event_start_time:
    event_end_time = raw_event_end_time
    end_time_source = RAW

Nếu raw_event_end_time NULL và next_event_start_time > event_start_time:
    event_end_time = next_event_start_time
    end_time_source = NEXT_EVENT_START_FROM_NULL

Nếu raw_event_end_time <= event_start_time và next_event_start_time > event_start_time:
    event_end_time = next_event_start_time
    end_time_source = NEXT_EVENT_START_FROM_INVALID_RAW

Nếu không có next_event_start_time:
    event_end_time = NULL hoặc giữ open
    end_time_source = OPEN_EVENT
```

---

### 4.3. Các feature thời gian cần tạo

```text
duration_sec = event_end_time - event_start_time

gap_from_prev_sec = event_start_time - prev_event_end_time

overlap_sec = max(0, -gap_from_prev_sec)

is_raw_end_missing

is_invalid_raw_end

is_open_event

end_time_imputed_flag

is_non_positive_duration

is_long_duration

is_gap

is_big_gap

is_overlap

time_quality_issue_flag
```

Ngưỡng đã dùng:

```text
big_gap_seconds: 1800 giây
long_duration_seconds: 86400 giây
```

---

## 5. Logic xử lý KWh

### 5.1. Vấn đề

`status_kwh_start/end` thiếu nhiều.

Trong bản offline:

```text
raw usable khoảng 44.23%
controlled fill lên khoảng 50.65%
vẫn còn khoảng 49.35% missing
```

Vì vậy KWh là feature phụ, không phải feature bắt buộc.

---

### 5.2. Quy tắc fill KWh có kiểm soát

Không lan truyền KWh qua chuỗi thiếu dài.

Chỉ fill từ event liền kề nếu khoảng cách nhỏ hơn hoặc bằng 5 phút.

```text
kwh_gap_limit_seconds = 300
```

Với mỗi event:

```text
Nếu raw_status_kwh_start có:
    kwh_start_value = raw_status_kwh_start
    kwh_start_source = RAW

Nếu raw_status_kwh_start missing
và prev_raw_status_kwh_end có
và abs(event_start_time - prev_event_end_time) <= 300:
    kwh_start_value = prev_raw_status_kwh_end
    kwh_start_source = PREV_EVENT_END

Ngược lại:
    kwh_start_source = MISSING
```

Tương tự end:

```text
Nếu raw_status_kwh_end có:
    kwh_end_value = raw_status_kwh_end
    kwh_end_source = RAW

Nếu raw_status_kwh_end missing
và next_raw_status_kwh_start có
và abs(next_event_start_time - event_end_time) <= 300:
    kwh_end_value = next_raw_status_kwh_start
    kwh_end_source = NEXT_EVENT_START

Ngược lại:
    kwh_end_source = MISSING
```

---

### 5.3. Feature KWh cần tạo

```text
raw_status_kwh_start
raw_status_kwh_end

kwh_start_value
kwh_end_value

kwh_start_source
kwh_end_source

kwh_raw_available_flag
kwh_available_flag
kwh_missing_flag

kwh_start_imputed_flag
kwh_end_imputed_flag
kwh_imputed_flag
kwh_imputed_or_missing_flag

kwh_delta = kwh_end_value - kwh_start_value
kwh_delta_model_value = fillna(kwh_delta, 0)

kwh_zero_delta_flag
kwh_positive_delta_flag
kwh_negative_delta_flag

kwh_rate_per_hour = kwh_delta / duration_hours
kwh_rate_per_hour_model_value = fillna(kwh_rate_per_hour, 0)
kwh_rate_missing_flag
```

---

### 5.4. Energy consistency flags

```text
loaded_positive_kwh_flag
loaded_zero_kwh_flag
loaded_without_kwh_flag

energy_counter_suspect_flag = kwh_negative_delta_flag

loaded_energy_unavailable_flag = loaded_without_kwh_flag

loaded_energy_positive_evidence = loaded_positive_kwh_flag
```

`energy_inconsistency_flag`:

```text
1 nếu:
  is_loaded = 1 và loaded_zero_kwh_flag = 1
  hoặc is_loaded = 1 và loaded_without_kwh_flag = 1
  hoặc kwh_negative_delta_flag = 1
```

---

## 6. Logic map status

Với `status_id`, tạo các trường:

```text
status_type_code

current_signal_code

is_on

is_loaded

is_no_load

is_current_near_zero

has_error_token

has_maintenance_token

known_fault_status

known_maintenance_status

known_repair_status

off_with_fault_status

info_status

normal_loaded_production_status

normal_no_load_production_status

power_on_near_zero_status

normal_power_off_status

status_evidence_class
```

Mapping chính:

| status_id | status_type_code | is_on | is_loaded | known_fault | maintenance | repair | evidence |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | POWER_ON | 1 | 0 | 0 | 0 | 0 | POWER_ON_NEAR_ZERO |
| 2 | RUN_PRODUCTION_NO_LOAD | 1 | 0 | 0 | 0 | 0 | NORMAL_NO_LOAD_PRODUCTION |
| 3 | RUN_PRODUCTION_LOADED | 1 | 1 | 0 | 0 | 0 | NORMAL_LOADED_PRODUCTION |
| 4 | RUN_MAINTENANCE_NO_LOAD | 1 | 0 | 0 | 1 | 0 | MAINTENANCE_STATUS |
| 5 | RUN_MAINTENANCE_LOADED | 1 | 1 | 0 | 1 | 0 | MAINTENANCE_STATUS |
| 6 | RUN_REPAIR_NO_LOAD | 1 | 0 | 1 | 1 | 1 | REPAIR_STATUS |
| 7 | RUN_REPAIR_LOADED | 1 | 1 | 1 | 1 | 1 | REPAIR_STATUS |
| 8 | POWER_OFF | 0 | 0 | 0 | 0 | 0 | NORMAL_POWER_OFF |
| 9 | POWER_OFF_FAULT | 0 | 0 | 1 | 0 | 0 | OFF_WITH_FAULT |
| 10 | POWER_OFF_MAINTENANCE | 0 | 0 | 1 | 1 | 0 | OFF_WITH_FAULT |

---

## 7. Logic data quality

### 7.1. Time quality

```text
time_quality_issue_flag = 1 nếu:
    is_open_event = 1
    hoặc is_non_positive_duration = 1
    hoặc is_big_gap = 1
    hoặc is_overlap = 1
```

### 7.2. KWh quality

```text
kwh_quality_issue_flag = 1 nếu:
    kwh_missing_flag = 1
    hoặc kwh_imputed_flag = 1
    hoặc kwh_negative_delta_flag = 1
```

### 7.3. Data quality

```text
data_quality_issue_flag = 1 nếu:
    time_quality_issue_flag = 1
    hoặc kwh_quality_issue_flag = 1
```

### 7.4. Quality reason

```text
data_quality_reason =
    OK
    TIME_QUALITY
    KWH_QUALITY
    ENERGY_INCONSISTENCY
    hoặc các lý do nối bằng dấu |
```

---

## 8. L1 dataset offline đã tạo

Bảng/view chính:

```text
dbo.ai_l1_operation_event_sequence
```

Một dòng tương ứng một event.

Các nhóm cột chính:

```text
event identity:
  event_id
  machine_id
  sequence_segment_id
  event_order_in_segment

time:
  event_start_time
  event_end_time
  duration_sec
  gap_from_prev_sec
  overlap_sec
  end_time_source

status:
  status_id
  status_type_code
  current_signal_code
  is_on
  is_loaded
  is_no_load
  is_current_near_zero

KWh:
  kwh_delta_model_value
  kwh_rate_per_hour_model_value
  kwh flags

quality:
  time flags
  KWh flags
  data quality flags

context:
  machine_group_id
  location_id
  hour_of_day
  day_of_week
```

Train views:

```text
vw_ai_l1_train_normal_strict
vw_ai_l1_train_normal_lenient
```

Strict:

```text
status_id in (1,2,3,8)
positive duration
not open
no big gap
no overlap
```

Lenient:

```text
status_id in (1,2,3,8)
positive duration
not open
no big gap
cho phép overlap
```

---

## 9. L1 model đã thống nhất

Input L1:

```text
window = 20 event liên tiếp
group theo machine_id và sequence_segment_id
```

Mô hình:

```text
TCN Autoencoder
```

Feature nhóm:

```text
categorical:
  status_id
  status_type_code
  current_signal_code
  hour_of_day
  day_of_week
  machine_group_id
  location_id

continuous:
  duration_sec
  gap_from_prev_sec
  overlap_sec
  kwh_delta_model_value
  kwh_rate_per_hour_model_value

binary:
  is_on
  is_loaded
  is_no_load
  is_current_near_zero
  KWh flags
  time flags
  quality flags
```

Production decision:

```text
is_behavior_anomaly = is_anomaly_lenient

is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient

behavior_anomaly_score = score_lenient_norm

behavior_sensitive_score = score_strict_norm

behavior_combined_score = max(score_lenient_norm, score_strict_norm)
```

Quan trọng:

```text
is_sensitive_warning chỉ dùng audit
không tự động tạo operational_action_level = MONITOR
```

---

## 10. L2 evidence dataset đã tạo

Bảng chính:

```text
dbo.ai_l2_fault_confidence_event
```

Nó join từ L1 và thêm evidence:

```text
known_fault_status

known_maintenance_status

known_repair_status

off_with_fault_status

energy_inconsistency_flag

data_quality_issue_flag

fault_evidence_count

maintenance_evidence_count

status_evidence_class
```

L2 label table:

```text
dbo.ai_l2_future_fault_label
```

Các label:

```text
future_fault_within_10_events
future_fault_within_30_events
future_fault_within_30min
future_fault_within_60min
future_maintenance_within_30_events
future_repair_within_30_events
```

Training final view:

```text
vw_ai_l2_train_final
```

---

## 11. L2 feature preparation

L2 ready data:

```text
data/dataModel/l2/prepared/train_l2_ready.csv
data/dataModel/l2/prepared/valid_l2_ready.csv
data/dataModel/l2/prepared/test_l2_ready.csv
```

Feature profile:

```text
safe
strict_continuous
full_experimental
```

Production selected targets:

```text
future_fault_within_10_events -> safe
future_fault_within_30_events -> strict_continuous
future_fault_within_30min -> safe
future_fault_within_60min -> safe
future_maintenance_within_30_events -> strict_continuous
future_repair_within_30_events -> strict_continuous
```

Runtime L2 cần tạo các risk:

```text
risk_fault_10_events

risk_fault_30_events

risk_fault_30min

risk_fault_60min

risk_maintenance_30_events

risk_repair_30_events
```

---

## 12. Policy v2 đã chốt

### 12.1. Operational action

```text
CRITICAL:
  known_fault_status
  off_with_fault_status
  policy_pred_fault_10_events

HIGH:
  policy_pred_fault_30min
  policy_pred_fault_30_events
  policy_pred_repair_30_events

MEDIUM:
  policy_pred_fault_60min
  policy_pred_maintenance_30_events
  known_maintenance_status
  is_behavior_anomaly

LOW:
  không thuộc các nhóm trên
```

Không còn `MONITOR`.

Không để `is_sensitive_warning` tạo operational warning.

---

### 12.2. Operational judgment

```text
KNOWN_FAULT_CONFIRMED

PRE_FAULT_CRITICAL_NEAR_TERM

PRE_FAULT_HIGH_CONFIDENCE

REPAIR_RELATED

PRE_FAULT_MEDIUM_CONFIDENCE

MAINTENANCE_RELATED

UNKNOWN_BEHAVIOR_ANOMALY

NORMAL_LIKE
```

Bản final đúng có phân bố:

```text
NORMAL_LIKE                    3,904,149
PRE_FAULT_HIGH_CONFIDENCE         88,079
UNKNOWN_BEHAVIOR_ANOMALY          36,184
PRE_FAULT_MEDIUM_CONFIDENCE       15,511
KNOWN_FAULT_CONFIRMED             13,184
MAINTENANCE_RELATED                3,207
REPAIR_RELATED                     1,804
```

---

### 12.3. Quality action

```text
CHECK_DATA_AND_ENERGY:
  data_quality_issue_flag = 1
  và energy_inconsistency_flag = 1

CHECK_DATA:
  data_quality_issue_flag = 1

CHECK_ENERGY:
  energy_inconsistency_flag = 1

QUALITY_OK:
  không có vấn đề quality
```

Final historical distribution:

```text
CHECK_DATA               2,508,556
QUALITY_OK                 947,762
CHECK_ENERGY               601,243
CHECK_DATA_AND_ENERGY        4,557
```

---

## 13. Final historical output

File đúng:

```text
ai_l2_fault_judgment_policy_v2_all.csv
```

Bảng SQL:

```text
dbo.ai_l2_fault_judgment_policy_v2_full
```

Số dòng:

```text
4,062,118
```

Final action distribution đúng:

```text
LOW       3,904,149
HIGH         89,883
MEDIUM       54,902
CRITICAL     13,184
```

Nếu thấy:

```text
MONITOR = 2,114,489
SENSITIVE_BEHAVIOR_MONITOR = 2,114,489
```

thì đó là bản cũ, không dùng.

---

## 14. Realtime / online inference đã thống nhất

### 14.1. Không score event đang mở

Vì event cần end_time và context.

Chiến lược:

```text
event-close inference
```

Cụ thể:

```text
Khi event mới B của machine M xuất hiện
→ dùng B để đóng event A trước đó của machine M
→ score A
```

Ưu điểm:

- gần realtime,
- feature ổn định,
- duration/gap/KWh ít sai,
- phù hợp event 1-5 phút/lần.

---

### 14.2. Online pipeline cần làm

```text
1. Đọc checkpoint

2. Lấy event mới từ data_iot_convert

3. Lấy lookback 40 event gần nhất mỗi machine_id

4. Build feature L1-like:
   time
   KWh
   status semantics
   quality flags
   context

5. Lọc event đã đóng

6. Tạo window 20 event cho L1

7. Chạy L1 lenient/strict

8. Tạo L2 feature row

9. Chạy 6 LightGBM model

10. Áp policy_v2

11. Ghi vào SQL online result

12. Update checkpoint
```

---

## 15. Online SQL tables nên có

Không nên làm rối.

Tối thiểu cần 3 bảng:

### 15.1. Checkpoint

```text
dbo.ai_inference_checkpoint
```

Vai trò:

```text
Lưu event_id/time đã xử lý đến đâu.
```

### 15.2. Online result

```text
dbo.ai_l2_fault_judgment_online_v2
```

Vai trò:

```text
Lưu kết quả AI cho event mới.
```

### 15.3. Error/run log

Có thể tách hoặc gộp.

Khuyến nghị giai đoạn đầu:

```text
dbo.ai_inference_run_log
dbo.ai_inference_error_log
```

Nếu muốn đơn giản hơn, có thể chỉ tạo:

```text
dbo.ai_inference_checkpoint
dbo.ai_l2_fault_judgment_online_v2
dbo.ai_inference_log
```

---

## 16. Vì sao trước đó có 2 mã SQL?

Hai SQL đó có mục đích khác nhau:

```text
01_create_realtime_inference_tables.sql
```

Dùng để tạo bảng lưu checkpoint, online result, log.

```text
02_create_unified_dashboard_view.sql
```

Dùng để tạo view gộp dữ liệu historical + online cho dashboard.

Nếu muốn đơn giản, có thể bỏ view unified ở giai đoạn đầu.

Chỉ cần:

```text
1 bảng checkpoint
1 bảng online result
1 bảng log nếu cần
```

Sau khi dashboard cần đọc cả historical + online thì mới tạo view unified.

---

## 17. Đề xuất đơn giản hóa cho Codex

Hãy yêu cầu Codex xây theo thứ tự:

```text
Phase 1:
  chỉ build data feature realtime
  chưa chạy model

Phase 2:
  tích hợp L1 scorer

Phase 3:
  tích hợp L2 scorer

Phase 4:
  áp policy và ghi SQL

Phase 5:
  dashboard đọc SQL
```

Không yêu cầu Codex làm tất cả một lần.

---

## 18. Yêu cầu Codex nên tuân thủ

Khi Codex build code, yêu cầu:

```text
Không hard-code password SQL.

Không hard-code tên cột ngoài config.

Không score event OPEN_EVENT ở bản đầu.

Không để is_sensitive_warning tạo MONITOR.

Không dùng file CSV final làm model.

Không thay đổi logic KWh fill quá 300s.

Không đưa machine_id trực tiếp vào L1 input nếu tái tạo L1.

Luôn validate output distribution khi chạy batch historical.

Luôn log số event đọc, số event đóng, số event score, số event skip.
```

---

## 19. Output mong muốn của module xử lý data realtime

Khi chạy:

```bash
python score_new_events_batch.py --stage-only --max-events 100
```

phải in:

```text
checkpoint last_event_id

raw_new count

context count

features_new count

features_closed count

sample 5 dòng:
  event_id
  machine_id
  status_id
  event_start_time
  event_end_time
  end_time_source
  duration_sec
  kwh_delta_model_value
  time_quality_issue_flag
  kwh_quality_issue_flag
  energy_inconsistency_flag
```

Khi chạy inference thật:

```bash
python score_new_events_batch.py --max-events 100
```

phải ghi vào SQL:

```text
event_id
machine_id
risk_fault_*
operational_action_level
operational_judgment
quality_action_level
quality_judgment
is_behavior_anomaly
is_sensitive_warning
policy_version
l2_run_id
scored_time
```

---

## 20. Kết luận

Logic xử lý dữ liệu của dự án đã chốt như sau:

```text
data_iot_convert là event source chính

status_id là token vận hành và evidence yếu

time phải sửa bằng raw end hoặc next event start

KWh chỉ fill có kiểm soát trong 5 phút

status 1-10 map thành normal/maintenance/repair/fault evidence

L1 phát hiện deviation bằng window 20 event

L2 dự đoán risk fault/maintenance/repair

policy_v2 tách operational risk và quality risk

is_sensitive_warning chỉ là audit

realtime dùng event-close inference, không score event đang mở
```

Tài liệu này là nguồn chuẩn để xây lại phần xử lý data bằng Codex trong VS Code.
