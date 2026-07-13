# Batch10 - Realtime / Event-close Data Pipeline cho Weldcom AI

Gói này khóa lại phần xử lý dữ liệu realtime từ SQL Server gốc thành feature L1/L2 để đưa vào AI.

## Chiến lược

Vì event phát sinh khoảng 1-5 phút/lần, dùng event-close inference:

```text
Khi event mới B xuất hiện
→ dùng B để đóng event trước đó A cùng machine_id
→ score A
```

Cách này gần realtime nhưng ổn định hơn score event đang mở.

## Nguồn dữ liệu gốc

`data_iot_convert`: id, machine_id, status_id, status_time_start, status_time_end, status_kwh_start, status_kwh_end.

Các bảng context: `data_machine_status`, `data_machine`, `machine_location_his`, `data_location`.

## Logic đã mã hóa

- Sửa end_time null/invalid bằng next event_start_time cùng machine_id.
- Tính duration, gap, overlap.
- Impute KWh có kiểm soát từ event liền trước/liền sau nếu gap <= 300s.
- Map status_id 1-10 sang ON/OFF, loaded/no-load, fault/maintenance/repair.
- Tạo data_quality_issue_flag, time_quality_issue_flag, kwh_quality_issue_flag, energy_inconsistency_flag.
- Tạo feature đầu vào cho L2 và policy v2.

## Trạng thái L1

Batch10 scaffold ưu tiên khóa phần data realtime trước. `l1_scorer_adapter.py` hiện trả L1 unavailable để tránh chạy sai PyTorch khi chưa so khớp feature online với historical L1.

Bước tiếp theo là tích hợp L1 PyTorch thật bằng `model_best.pt`, `preprocessor.json`, `thresholds.json`.

## Chạy thử

Cài package:

```bash
pip install -r requirements.txt
```

Copy file config mẫu rồi điền thông tin SQL Server:

```bash
cp inference/online/config.example.yaml inference/online/config.local.yaml
```

Kiểm tra feature, chưa ghi SQL:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --stage-only --max-events 100
```

Dry-run inference:

```bash
python -m inference.online.score_new_events --config inference/online/config.local.yaml --dry-run --max-events 100
```

## Lưu ý

Không commit connection string/mật khẩu lên Git.
