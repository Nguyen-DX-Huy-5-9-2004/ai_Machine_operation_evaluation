# Đặc tả xử lý data realtime từ SQL gốc vào AI

## Input

| Field gốc | Field chuẩn |
|---|---|
| id | event_id |
| machine_id | machine_id |
| status_id | status_id |
| status_time_start | event_start_time |
| status_time_end | raw_event_end_time |
| status_kwh_start | raw_status_kwh_start |
| status_kwh_end | raw_status_kwh_end |

## Time repair

- RAW nếu raw end > start.
- NEXT_EVENT_START_FROM_NULL nếu raw end null và có next event.
- NEXT_EVENT_START_FROM_INVALID_RAW nếu raw end invalid và có next event.
- OPEN_EVENT nếu chưa có next event.

## KWh

- Không lan truyền qua chuỗi thiếu dài.
- Chỉ fill từ event liền trước/liền sau nếu gap <= 300s.
- KWh là feature phụ có mask.

## Status

Status 1-10 đã map trong `online_inference/status_mapping.py`.

## Output

- time/duration/gap/overlap
- status semantics
- KWh delta/rate/missing/imputed
- evidence fault/maintenance/repair
- data quality
- machine/location context
- L2/policy output sau khi scorer bật
