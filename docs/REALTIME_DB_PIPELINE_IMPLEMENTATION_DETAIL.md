# Weldcom AI - Mô tả triển khai realtime DB pipeline

Ngày lập: 2026-07-13  
Phạm vi: mô tả phần code mới trong `inference/online/` và phần backend tối thiểu liên quan.

Tài liệu này được viết sau khi đọc:

- `documentProject/weldcom_ai_data_processing_logic_spec_for_codex.md`
- `documentProject/weldcom_ai_file_role_cleanup_spec.md`

Mục tiêu là giúp kiểm tra logic kết nối SQL Server và xử lý dữ liệu gốc trước khi đưa vào AI realtime.

---

## 1. Nguyên tắc triển khai

Theo cleanup spec, project cần tách rõ:

1. Source code/config runtime.
2. Model artifacts.
3. Report/metrics.
4. Final output dashboard/SQL.
5. File tạm/patch/local runtime.

Vì vậy phần realtime mới được đặt trong:

```text
inference/online/
```

Các file này là source/runtime code cho online inference, không phải artifact, không phải output dashboard.

File config thật chứa password không commit:

```text
inference/online/config.local.yaml
```

File này đã được thêm vào `.gitignore`.

File mẫu để copy:

```text
inference/online/config.example.yaml
```

---

## 2. Các file chính đã tạo/cập nhật

### `inference/online/config.example.yaml`

Vai trò:

- Chứa cấu hình mẫu cho SQL Server.
- Chứa tên bảng nguồn/đích.
- Chứa mapping cột gốc sang cột chuẩn.
- Chứa runtime parameters như lookback, KWh gap, max events.
- Chứa đường dẫn artifact L1/L2.

Các nhóm chính:

```yaml
database:
  driver:
  server:
  database:
  username:
  password:
  trusted_connection:
  trust_server_certificate:
  encrypt:

tables:
  raw_iot:
  machine_location_history:
  location:
  checkpoint:
  online_l2_result:
  run_log:
  error_log:

source_columns:
  event_id:
  machine_id:
  status_id:
  event_start_time:
  raw_event_end_time:
  raw_kwh_start:
  raw_kwh_end:
  raw_error_code:
```

Điểm quan trọng:

- Không hard-code password trong code.
- Bạn chỉ cần copy sang `config.local.yaml` và tự điền thông tin kết nối.
- `config.local.yaml` không được commit.

---

### `inference/online/db.py`

Vai trò:

- Build ODBC connection string từ YAML config.
- Mở/đóng connection SQL Server.
- Đọc SQL về DataFrame.
- Execute SQL.
- Bulk insert DataFrame vào bảng online result.

Logic connection:

```text
Nếu trusted_connection = true:
  dùng Trusted_Connection=yes

Nếu trusted_connection = false:
  dùng UID=username
  dùng PWD=password
```

Các option bảo mật/kết nối:

```text
TrustServerCertificate
Encrypt
Connection Timeout
```

`pyodbc` được import lazy trong hàm `connect`, nên các lệnh như `--help` hoặc import module không cần cài `pyodbc` ngay.

---

### `inference/online/sql_queries.py`

Vai trò:

- Sinh SQL query từ tên bảng/cột trong config.
- Không hard-code tên cột gốc ngoài config.
- Quote tên bảng/cột để giảm rủi ro SQL identifier sai.

Các query chính:

1. `get_checkpoint_sql`
   - Đọc checkpoint theo `pipeline_name`.

2. `update_checkpoint_sql`
   - Upsert checkpoint sau khi ghi kết quả.

3. `load_unprocessed_closed_candidate_events_sql`
   - Lấy `TOP max_events` event có `event_id > min_event_id_to_process`.
   - Chống duplicate bằng `NOT EXISTS` vào bảng online result.
   - Chỉ lấy event đã đóng: raw end hợp lệ hoặc có next event cùng machine.

4. `load_context_around_machine_sql`
   - Với từng machine có candidate, lấy event trước min candidate, trong khoảng candidate, và sau max candidate.
   - Mặc định `lookback_before = 40`, `lookahead_after = 2`.

5. `load_event_time_location_sql`
   - Lấy location theo `event_start_time` của từng event nếu bảng location history hỗ trợ.

6. `insert_run_log_sql`
   - Ghi log số dòng input/scored/skipped.

---

## 3. Chiến lược realtime: event-close inference

Logic theo spec:

```text
Khi event mới B của machine M xuất hiện
→ dùng B để đóng event A trước đó của machine M
→ score A
```

Không score event đang mở.

Trong code:

```text
score_new_events.py
  đọc checkpoint
  lấy raw_new
  lấy context 40 event/machine
  build feature trên raw_all = context + raw_new
  lọc lại các event mới
  chỉ giữ các event đã đóng
```

Checkpoint hiện chỉ dùng để log. Cơ chế chống duplicate chính là:

```text
NOT EXISTS (
  SELECT 1
  FROM dbo.ai_l2_fault_judgment_online_v2 r
  WHERE r.event_id = i.id
)
```

Mốc `min_event_id_to_process` nằm trong config và không tự động nhảy qua event chưa xử lý.

---

## 4. Mapping dữ liệu gốc từ SQL

Nguồn chính:

```text
dbo.data_iot_convert
```

Mapping trong config:

| Cột gốc | Cột chuẩn runtime |
|---|---|
| `id` | `event_id` |
| `machine_id` | `machine_id` |
| `status_id` | `status_id` |
| `status_time_start` | `event_start_time` |
| `status_time_end` | `raw_event_end_time` |
| `status_kwh_start` | `raw_status_kwh_start` |
| `status_kwh_end` | `raw_status_kwh_end` |
| `error_code` | `raw_error_code` |

Các bảng context:

```text
dbo.machine_location_his
dbo.data_location
```

Bản đầu lấy latest/active location theo machine. Nếu cần chính xác theo thời điểm event, có thể nâng cấp query location theo `event_start_time`.

---

## 5. Xử lý thời gian event

File:

```text
inference/online/feature_builder_l1.py
```

Với mỗi `machine_id`, sort theo:

```text
machine_id, event_start_time, event_id
```

Tạo:

```text
next_event_start_time
prev_event_end_time
```

Quy tắc tạo `event_end_time`:

| Điều kiện | `event_end_time` | `end_time_source` |
|---|---|---|
| `raw_event_end_time > event_start_time` | raw end | `RAW` |
| raw end null và có next start hợp lệ | next start | `NEXT_EVENT_START_FROM_NULL` |
| raw end invalid và có next start hợp lệ | next start | `NEXT_EVENT_START_FROM_INVALID_RAW` |
| không có next start | null | `OPEN_EVENT` |

Các cờ/feature tạo ra:

```text
duration_sec
duration_sec_model_value
gap_from_prev_sec
gap_from_prev_sec_model_value
overlap_sec
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

Ngưỡng:

```text
big_gap_seconds = 1800
long_duration_seconds = 86400
```

Các ngưỡng lấy từ config runtime.

---

## 6. Xử lý KWh

KWh được xử lý là feature phụ, có mask đầy đủ.

Quy tắc fill:

```text
kwh_gap_limit_seconds = 300
```

Start:

```text
Nếu raw_status_kwh_start có:
  kwh_start_value = raw_status_kwh_start
  kwh_start_source = RAW

Nếu missing và prev_raw_status_kwh_end có
và abs(event_start_time - prev_event_end_time) <= 300:
  kwh_start_value = prev_raw_status_kwh_end
  kwh_start_source = PREV_EVENT_END

Ngược lại:
  kwh_start_source = MISSING
```

End:

```text
Nếu raw_status_kwh_end có:
  kwh_end_value = raw_status_kwh_end
  kwh_end_source = RAW

Nếu missing và next_raw_status_kwh_start có
và abs(next_event_start_time - event_end_time) <= 300:
  kwh_end_value = next_raw_status_kwh_start
  kwh_end_source = NEXT_EVENT_START

Ngược lại:
  kwh_end_source = MISSING
```

Feature/cờ tạo ra:

```text
kwh_raw_available_flag
kwh_available_flag
kwh_missing_flag
kwh_start_imputed_flag
kwh_end_imputed_flag
kwh_imputed_flag
kwh_imputed_or_missing_flag
kwh_delta
kwh_delta_model_value
kwh_zero_delta_flag
kwh_positive_delta_flag
kwh_negative_delta_flag
kwh_rate_per_hour
kwh_rate_per_hour_model_value
kwh_rate_missing_flag
```

Energy consistency:

```text
loaded_positive_kwh_flag
loaded_zero_kwh_flag
loaded_without_kwh_flag
energy_counter_suspect_flag
loaded_energy_unavailable_flag
loaded_energy_positive_evidence
energy_inconsistency_flag
```

`energy_inconsistency_flag = 1` nếu:

```text
is_loaded = 1 và loaded_zero_kwh_flag = 1
hoặc is_loaded = 1 và loaded_without_kwh_flag = 1
hoặc kwh_negative_delta_flag = 1
```

---

## 7. Mapping status

File:

```text
inference/online/feature_builder_l1.py
```

Status 1-10 được map theo spec.

Một điểm quan trọng khi đối chiếu với data train:

```text
status_type_code và current_signal_code trong train_l2_ready.csv là numeric,
không phải text label.
```

Đã kiểm tra từ dữ liệu prepared:

```text
status_id 1 -> status_type_code 1, current_signal_code 0
status_id 2 -> status_type_code 1, current_signal_code 1
status_id 3 -> status_type_code 1, current_signal_code 2
status_id 8/9/10 -> status_type_code 0, current_signal_code NaN
```

Vì vậy runtime tạo:

```text
status_type_code      numeric, dùng cho model
current_signal_code   numeric, dùng cho model
status_type_label     text audit
current_signal_label  text audit
```

Điều này tránh lỗi đưa string vào LightGBM model đã train bằng numeric-coded category.

---

## 8. Data quality

Các flag chính:

```text
time_quality_issue_flag
kwh_quality_issue_flag
data_quality_issue_flag
energy_inconsistency_flag
data_quality_issue_count
data_quality_reason
```

Logic:

```text
time_quality_issue_flag = 1 nếu:
  is_open_event
  hoặc is_non_positive_duration
  hoặc is_big_gap
  hoặc is_overlap

kwh_quality_issue_flag = 1 nếu:
  kwh_missing_flag
  hoặc kwh_imputed_flag
  hoặc kwh_negative_delta_flag

data_quality_issue_flag = 1 nếu:
  time_quality_issue_flag
  hoặc kwh_quality_issue_flag
```

`data_quality_reason` nối các lý do:

```text
TIME_QUALITY
KWH_QUALITY
ENERGY_INCONSISTENCY
```

---

## 9. Tạo feature L2 runtime

File:

```text
inference/online/feature_builder_l2.py
```

Sau khi có L1 score, module này tạo các cột L2-ready:

```text
l1_lenient_norm_clip
l1_lenient_norm_log
l1_strict_norm_clip
l1_strict_norm_log
l1_behavior_anomaly_score_clip/log
l1_behavior_sensitive_score_clip/log
l1_behavior_combined_score_clip/log
l1_score_lenient_clip/log
l1_score_strict_clip/log
l1_strict_lenient_gap_log
l1_strict_lenient_ratio_log
l1_score_balance_index
l1_behavior_anomaly_flag
split_bucket
```

Hiện tại L1 scorer đang disabled/no-op, nên các score này bằng 0 và:

```text
l1_score_available_flag = 0
l1_join_missing_flag = 1
```

Đây là chủ ý để khóa data realtime trước. L1 PyTorch thật nên bật ở bước sau khi đã so khớp window online với historical L1.

---

## 10. L1 scorer hiện tại

File:

```text
inference/online/l1_scorer.py
```

Trạng thái:

```text
Chưa bật L1 PyTorch thật.
```

Lý do:

- L1 dùng TCN Autoencoder window 20 event.
- Cần tái tạo đúng preprocessor/window/scaler từ:

```text
modeling/l1_tcn/artifacts/lenient/preprocessor.json
modeling/l1_tcn/artifacts/strict/preprocessor.json
modeling/l1_tcn/artifacts/*/model_best.pt
modeling/l1_tcn/artifacts/*/thresholds.json
```

Nếu bật vội mà không so khớp historical L1, sẽ dễ sinh score lệch.

Hiện no-op L1 giúp test:

```text
SQL connection
event-close logic
time/KWh/status/quality feature
L2 native/evidence feature
policy path
```

---

## 11. L2 scorer

File:

```text
inference/online/l2_scorer.py
```

Input:

```text
data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json
data/dataModel/l2/prepared_report/l2_feature_policy.json
modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347/*/*/model.joblib
modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347/*/*/metadata.json
```

Logic:

- Đọc production selection.
- Với mỗi target, xác định selected profile.
- Load `model.joblib`.
- Đọc feature list từ `metadata.json`.
- Đọc categorical features từ `metadata.json`.
- Numeric columns fill `0.0`.
- Categorical columns fill `-1`, giống `train_l2_multilabel.py`.

Targets/risk output:

```text
risk_fault_10_events
risk_fault_30_events
risk_fault_30min
risk_fault_60min
risk_maintenance_30_events
risk_repair_30_events
```

Lưu ý:

`joblib` được import lazy, nên `--stage-only` không cần cài joblib/LightGBM ngay.

---

## 12. Policy v2

File:

```text
inference/online/policy_engine.py
```

Policy đã mã hóa theo final spec:

Operational action:

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
  còn lại
```

Không có:

```text
MONITOR
SENSITIVE_BEHAVIOR_MONITOR
```

`is_sensitive_warning` không tạo operational warning. Nó chỉ là audit signal.

Quality action:

```text
CHECK_DATA_AND_ENERGY
CHECK_DATA
CHECK_ENERGY
CHECK_DATA_DETAIL
QUALITY_OK
```

---

## 13. Entry point chạy batch

File:

```text
inference/online/score_new_events.py
```

Chạy kiểm feature:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --stage-only --max-events 100
```

Output phải in:

```text
checkpoint last_event_id
raw_new count
context count
features_new count
features_closed count
sample 5 rows
```

Chạy audit stage-only:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --stage-only --audit --max-events 100
```

Audit tạo thư mục:

```text
data/realtime_audit/run_YYYYMMDD_HHMMSS/
```

Các file audit:

```text
00_run_config_sanitized.json
01_sql_used.sql
02_raw_candidates.csv
03_raw_context.csv
04_processed_features.csv
05_raw_to_processed_side_by_side.csv
06_feature_compare_with_historical_l1.csv
07_summary.json
08_README_CHECK_THIS_RUN.md
```

Không ghi password/connection string vào các file audit.

Sample columns:

```text
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

Chạy dry-run inference:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --dry-run --max-events 100
```

Chạy ghi SQL:

```yaml
runtime:
  dry_run: false
```

Sau đó:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --max-events 100
```

---

## 14. Bảng SQL đích

Theo spec, tối thiểu cần:

```text
dbo.ai_inference_checkpoint
dbo.ai_l2_fault_judgment_online_v2
dbo.ai_inference_run_log
dbo.ai_inference_error_log
```

Repo hiện có script:

```text
sql/01_create_realtime_inference_tables.sql
```

Script này tạo các bảng tương ứng. Cần kiểm tra `USE database` trong file SQL trước khi chạy, vì hiện đang ghi database cụ thể trong script.

Output online result gồm:

```text
event_id
machine_id
source_event_start_time
source_event_end_time
status_id
status_type_code
current_signal_code
risk_fault_*
operational_action_level
operational_judgment
quality_action_level
quality_judgment
is_behavior_anomaly
is_sensitive_warning
policy_version
l2_run_id
inference_version
```

---

## 15. Backend tối thiểu

Các file backend đã có khung:

```text
backend/app/main.py
backend/app/config.py
backend/app/db.py
backend/app/routers/inference.py
backend/app/services/inference_service.py
```

Endpoint hiện có:

```text
GET /api/inference/stage?max_events=100
```

Endpoint này gọi:

```bash
python -m inference.online.score_new_events --stage-only
```

Mục tiêu hiện tại chỉ là hỗ trợ test pipeline. Chưa xây dashboard API thật.

---

## 16. Kiểm tra đã chạy

Đã chạy compile Python cho:

```text
inference/online/*.py
backend/app/**/*.py
```

Đã chạy smoke test feature builder bằng dữ liệu giả:

```text
event 1:
  raw end missing
  có event 2 kế tiếp
  -> end_time_source = NEXT_EVENT_START_FROM_NULL
  -> duration_sec = 300
  -> kwh_end_source = NEXT_EVENT_START

event 2:
  không có event kế tiếp
  -> end_time_source = OPEN_EVENT
```

Đã kiểm tra prefix checkpoint:

```text
[101 open, 102 closed, 103 closed] -> không score event nào
[101 closed, 102 closed, 103 open] -> score 101, 102
```

Đã chạy:

```bash
python -m inference.online.score_new_events --help
```

Kết quả OK.

Chưa chạy kết nối SQL thật vì chưa có `config.local.yaml` chứa thông tin server/database/user/password.

---

## 17. Những điểm cần bạn kiểm tra trước khi chạy SQL thật

1. Điền đúng file:

```text
inference/online/config.local.yaml
```

2. Kiểm tra driver ODBC:

```yaml
driver: "ODBC Driver 18 for SQL Server"
```

Nếu máy chỉ có Driver 17 thì đổi thành:

```yaml
driver: "ODBC Driver 17 for SQL Server"
```

3. Kiểm tra tên bảng nguồn:

```yaml
raw_iot: dbo.data_iot_convert
```

4. Kiểm tra tên cột nguồn có đúng database thật không:

```yaml
event_id: id
event_start_time: status_time_start
raw_event_end_time: status_time_end
raw_kwh_start: status_kwh_start
raw_kwh_end: status_kwh_end
```

5. Chạy stage-only audit trước:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --stage-only --audit --max-events 100
```

6. Đối chiếu sample:

```text
Không score OPEN_EVENT
duration hợp lý
KWh không fill quá 300 giây
status_id map đúng
quality flags hợp lý
```

---

## 18. Điểm đúng theo spec

Đã bám đúng các điểm chính:

- `data_iot_convert` là source event chính.
- Không dùng KWh cabinet làm feature event-level.
- Sửa thời gian bằng raw end hoặc next event start.
- Không score event mở.
- KWh chỉ fill trong 300 giây.
- Status 1-10 map thành fault/maintenance/repair/normal evidence.
- Tạo time/KWh/data/energy quality flags.
- L2 dùng production selection và metadata artifact.
- Policy không có `MONITOR`.
- `is_sensitive_warning` không tạo operational warning.
- Config SQL không hard-code trong code.

---

## 19. Giới hạn hiện tại

1. L1 PyTorch chưa bật.

Hiện L1 scorer trả:

```text
is_behavior_anomaly = 0
is_sensitive_warning = 0
l1_score_available_flag = 0
l1_join_missing_flag = 1
```

Do đó L2 vẫn có thể chạy bằng native evidence/status/KWh/time features, nhưng chưa có tín hiệu behavior anomaly thật.

2. Location hiện lấy latest/active location, chưa map location theo đúng `event_start_time`.

3. Checkpoint hiện là global. Code đã dùng conservative contiguous-prefix để tránh bỏ sót, nhưng production tốt hơn nên có checkpoint theo machine hoặc query chống duplicate bằng `NOT EXISTS`.

4. `online_inference/` là bản phác thảo cũ và đã được chuyển vào `archive/cleanup_20260713/online_inference_legacy/` để tránh có hai pipeline realtime song song.

5. `sql/01_create_realtime_inference_tables.sql` có `USE i26s02004_dat_dev;`. Trước khi chạy ở môi trường khác cần sửa hoặc bỏ `USE`.

---

## 20. Khuyến nghị bước tiếp theo

Theo cleanup spec, nên làm theo thứ tự:

1. Chạy `--stage-only` với SQL thật và lưu sample output.
2. So sánh output realtime feature với historical L1/L2 event dataset cho cùng vài `event_id`.
3. Khi data khớp, tích hợp L1 PyTorch thật.
4. Sau khi L1 khớp, bật L2 scorer và dry-run.
5. Sau khi dry-run ổn, tạo bảng SQL bằng script trong `sql/`.
6. Bật `runtime.dry_run=false` để ghi online result.
7. Khi xác nhận pipeline mới chạy ổn với SQL thật, tiếp tục rà các file local/runtime còn lại trước khi commit.
