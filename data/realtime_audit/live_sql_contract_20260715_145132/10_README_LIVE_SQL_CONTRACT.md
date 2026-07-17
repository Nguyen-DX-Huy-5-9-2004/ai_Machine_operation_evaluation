# Live SQL Contract L1

Thư mục audit: `G:\My Drive\OBAD\data\realtime_audit\live_sql_contract_20260715_145132`

- Candidate từ `dbo.data_iot_convert`: `5000`
- Context theo row-order: `5022`
- Candidate OPEN_EVENT: `0`
- Live SQL contract: `PASS`
- Source drift: `SOURCE_DATA_BACKFILLED`

Mở trước `02_candidate_and_context_coverage.json`, `03_join_coverage.json`,
`05_live_l1_features.csv`, `06_source_drift_report.json`, và `09_summary.json`.

Context lấy bằng `ROW_NUMBER()` theo `machine_id, event_start_time, event_id`; lookahead là hàng kế tiếp, không bị giới hạn bởi thời gian. L1/L2 không được bật và SQL production không được ghi.
