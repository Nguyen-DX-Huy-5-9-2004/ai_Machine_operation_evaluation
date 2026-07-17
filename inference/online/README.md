# Weldcom AI realtime SQL audit

Tài liệu này mô tả phần realtime pipeline trong `inference/online/` và cách chạy test để xem dữ liệu lấy từ SQL Server được xử lý thành feature đưa vào AI.

## 1. Phần đã chỉnh

Các file chính:

```text
inference/online/config.example.yaml
inference/online/sql_queries.py
inference/online/score_new_events.py
inference/online/feature_builder_l1.py
inference/online/feature_builder_l2.py
inference/online/l1_scorer.py
inference/online/l2_scorer.py
inference/online/policy_engine.py
inference/online/validation.py
```

Logic realtime hiện tại:

- Lấy event nguồn từ `dbo.data_iot_convert`.
- Không dùng global checkpoint làm cơ chế chống trùng duy nhất.
- Chống trùng bằng `NOT EXISTS` với `dbo.ai_l2_fault_judgment_online_v2`.
- Chỉ lấy event đã đóng:
  - `status_time_end > status_time_start`, hoặc
  - có event kế tiếp cùng `machine_id`.
- Lấy context quanh candidate:
  - `lookback_before` event trước candidate đầu.
  - toàn bộ event trong khoảng candidate.
  - `lookahead_after` event sau candidate cuối.
- Map `location_id` theo thời điểm event bằng `machine_location_his.start_time/end_time`.
- Map `machine_group_id` từ `dbo.data_machine`.
- Với event trùng timestamp, `next_event_start_time` dùng next greater distinct timestamp, không dùng dòng kế tiếp cùng timestamp.
- Xử lý time/KWh/status/quality giống logic offline.
- Không score `OPEN_EVENT`.
- Không bật L1 PyTorch thật ở bước này.
- Không ghi SQL thật trong `--stage-only` hoặc `--dry-run`.

## 3. Lệnh kiểm tra nhanh

Chạy từ root project:

```powershell
cd "G:\My Drive\OBAD"
```

Cài dependency realtime trong `.venv`:

```powershell
python -m pip install -r requirements2.txt
```

Kiểm tra command import/help:

```powershell
python -m inference.online.score_new_events --help
```

## 4. Lệnh test lấy dữ liệu SQL và xử lý feature

Nếu bạn đang dùng `config.example.yaml`:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --stage-only `
  --audit `
  --max-events 100
```

Nếu bạn chuyển thông tin thật sang `config.local.yaml`:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.local.yaml `
  --stage-only `
  --audit `
  --max-events 100
```

Lệnh này chỉ:

- Kết nối SQL Server.
- Lấy candidate event.
- Lấy context/lookback/lookahead.
- Build feature realtime.
- Ghi file audit.

Lệnh này không ghi kết quả AI vào SQL.

## 5. Xem kết quả ở đâu

Sau khi chạy, mở thư mục mới nhất:

```text
data/realtime_audit/run_YYYYMMDD_HHMMSS/
```

Trong đó có:

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

Các file nên xem trước:

1. `08_README_CHECK_THIS_RUN.md`
2. `07_summary.json`
3. `05_raw_to_processed_side_by_side.csv`
4. `04_processed_features.csv`
5. `02_raw_candidates.csv`
6. `03_raw_context.csv`

## 6. Ý nghĩa từng file audit

### `02_raw_candidates.csv`

Event gốc lấy trực tiếp từ SQL, sau điều kiện:

- `event_id > min_event_id_to_process`
- chưa có trong bảng online result
- đã đóng bằng raw end hoặc có next event.

### `03_raw_context.csv`

Các event context quanh candidate để tính:

- previous event
- next event
- gap/overlap
- KWh fill từ event liền trước/liền sau
- window L1 sau này

### `04_processed_features.csv`

Feature sau xử lý realtime:

- `event_end_time`
- `end_time_source`
- `duration_sec`
- `gap_from_prev_sec`
- `overlap_sec`
- KWh value/source/delta/rate
- status mapping
- quality flags
- location/machine context

### `05_raw_to_processed_side_by_side.csv`

File quan trọng nhất để kiểm tra logic. Mỗi dòng đặt raw và processed cạnh nhau:

- raw start/end vs processed start/end
- raw KWh vs processed KWh
- status raw vs status feature
- quality flags

### `06_feature_compare_with_historical_l1.csv`

Nếu đọc được historical L1 từ `dbo.ai_l1_operation_event_sequence`, file này so sánh feature realtime với feature historical theo `event_id`.

Nếu `audit.historical_l1_csv` trỏ tới:

```text
data/dataCore/ai_l1_operation_event_sequence.csv
```

pipeline sẽ fallback đọc CSV theo chunk và chỉ lấy các cột cần so sánh.

Nếu không đọc được historical L1, file sẽ rỗng và `07_summary.json` sẽ ghi:

```json
"historical_compare_available": false
```

## 7. Kiểm PASS/FAIL

Mở:

```text
07_summary.json
```

Xem các trường:

```text
result
violations
raw_candidate_rows
processed_rows
closed_rows
open_rows
historical_compare_available
historical_compare_match_rate
```

Stage-only audit chỉ nên coi là ổn khi:

- `raw_candidate_rows > 0`
- `processed_rows > 0`
- `violations` rỗng
- không có `OPEN_EVENT` trong rows chuẩn bị score
- `status_type_code/current_signal_code` là numeric, không phải string
- nếu có historical compare thì mismatch được giải thích rõ

## 8. Dry-run L2, vẫn không ghi SQL

Sau khi stage-only audit ổn, có thể chạy dry-run:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --dry-run `
  --audit `
  --max-events 100
```

Dry-run sẽ thử chạy L1 no-op, build L2 features, load L2 model nếu đủ dependency, áp policy, nhưng vẫn không ghi SQL.

## 9. Chưa được bật ghi SQL thật

Chỉ bật ghi SQL thật sau khi:

- Stage-only audit PASS.
- Side-by-side CSV nhìn hợp lý.
- Nếu có historical L1 thì feature match đạt yêu cầu.
- Dry-run L2 không thiếu feature.
- Output không có `MONITOR` hoặc `SENSITIVE_BEHAVIOR_MONITOR`.

Hiện L1 PyTorch realtime chưa bật, nên chưa được gọi đây là full realtime AI production.
