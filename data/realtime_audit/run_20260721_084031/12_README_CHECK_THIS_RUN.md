# Realtime Audit Run

## Lệnh đã chạy

```bash
E:\OBAD\inference\online\score_new_events.py --config inference/online/config.local.yaml --dry-run --max-events 500 --audit
```

## Nguồn dữ liệu

- Bảng event: `dbo.data_iot_convert`
- Bảng online result chống duplicate: `dbo.ai_l2_fault_judgment_online_v2`

## Kết quả nhanh

- Raw candidate rows: 500
- Raw context rows: 518
- Processed rows: 500
- Closed rows chuẩn bị score: 500
- Open/skipped rows: 0
- Live SQL contract result: PASS
- L1 data contract result: NOT_RUN
- L2 data contract result: NOT_RUN
- L1 mode: candidate_a_read_only
- L2 mode: selected_lightgbm_read_only
- Write SQL enabled: False
- Technical result: PASS
- Model readiness result: PASS
- Result: DATA_PIPELINE_PASS_MODEL_NOT_RUN

## File cần mở kiểm tra

1. `02_raw_candidates.csv`
2. `03_raw_context.csv`
3. `04_joined_canonical_events.csv`
4. `05_l1_event_features.csv`
5. `06_l2_runtime_features_without_scores.csv`
6. `07_raw_to_l1_side_by_side.csv`
7. `08_l1_contract_report.json`
8. `09_l2_contract_report.json`
9. `10_invariant_report.json`
10. `11_summary.json`

## Cột cần kiểm tra trước

- `event_end_time`, `end_time_source`, `duration_sec`
- `kwh_start_source`, `kwh_end_source`, `kwh_delta`
- `time_quality_issue_flag`, `kwh_quality_issue_flag`, `energy_inconsistency_flag`
- `status_type_code`, `current_signal_code`, `status_evidence_class`
- `sequence_segment_id`, `event_order_in_segment`
- `location_id`

## Kết luận

Chưa được bật model production. Kiểm tra `violations` trong `11_summary.json` trước khi đi tiếp.
