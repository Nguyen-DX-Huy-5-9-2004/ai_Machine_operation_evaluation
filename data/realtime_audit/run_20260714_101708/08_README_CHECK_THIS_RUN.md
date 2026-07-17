# Realtime audit run

## Lệnh đã chạy

```bash
G:\My Drive\OBAD\inference\online\score_new_events.py --config inference/online/config.local.yaml --stage-only --audit --max-events 100
```

## Nguồn dữ liệu

- Bảng event: `dbo.data_iot_convert`
- Bảng online result chống duplicate: `dbo.ai_l2_fault_judgment_online_v2`

## Kết quả nhanh

- Raw candidate rows: 100
- Raw context rows: 112
- Processed rows: 100
- Closed rows chuẩn bị score: 100
- Open/skipped rows: 0
- Historical compare available: False
- Historical compare source: None
- Historical compare error: historical_l1_csv returned 0 matching rows: G:\My Drive\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv
- L1 mode: disabled_noop
- L2 mode: not_run
- Write SQL enabled: False
- Technical result: PASS
- Model readiness result: FAIL_HISTORICAL_COMPARE_NOT_AVAILABLE
- Result: FAIL

## File cần mở kiểm tra

1. `02_raw_candidates.csv`
2. `03_raw_context.csv`
3. `04_processed_features.csv`
4. `05_raw_to_processed_side_by_side.csv`
5. `06_feature_compare_with_historical_l1.csv`
6. `07_summary.json`

## Cột cần kiểm tra trước

- `event_end_time`, `end_time_source`, `duration_sec`
- `kwh_start_source`, `kwh_end_source`, `kwh_delta`
- `time_quality_issue_flag`, `kwh_quality_issue_flag`, `energy_inconsistency_flag`
- `status_type_code`, `current_signal_code`, `status_evidence_class`
- `location_id`

## Kết luận

FAIL hoặc cần kiểm tra lại violations trong 07_summary.json.
