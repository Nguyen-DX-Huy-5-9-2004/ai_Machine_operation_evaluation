# Event ID alignment audit

## Ket qua

- SQL source table: `dbo.data_iot_convert`
- Historical L1 table: `dbo.ai_l1_operation_event_sequence`
- Historical L1 CSV: `G:\My Drive\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv`
- SQL raw count: 1367105
- Historical CSV count: 4062118
- SQL event_id range: 1 -> 1367105
- Historical event_id range: 48043 -> 4145960
- Intersection count: 1304088
- Intersection rate vs SQL: 0.9539047841972635
- Intersection rate vs historical: 0.3210364642287595
- Alignment result: `EVENT_ID_OVERLAP_FOUND`

## Ket luan

Use --candidate-mode historical-overlap for stage-only feature comparison, then inspect match_rate.

## File can xem

1. `01_sql_event_id_profile.csv`
2. `02_historical_l1_csv_event_id_profile.csv`
3. `03_intersection_summary.json`
4. `06_intersection_sample.csv`
