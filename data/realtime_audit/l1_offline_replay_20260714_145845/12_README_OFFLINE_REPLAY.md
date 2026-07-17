# Offline Replay L1 - Kiểm tra raw drift và transformation parity

Thư mục audit: `G:\My Drive\OBAD\data\realtime_audit\l1_offline_replay_20260714_145845`

- Kết quả xác định raw snapshot: `EXACT_TRAINING_RAW_SNAPSHOT_FOUND`
- Kết quả parity transformation trên các event có raw input trùng: `FAIL`
- Kết quả drift SQL hiện tại: `SOURCE_DATA_BACKFILLED`
- Kết luận: `L1_TRANSFORMATION_LOGIC_NOT_READY`
- Phân phối model: `NOT_APPLICABLE`

Mở trước: `02_raw_input_comparison.csv`, `03_raw_input_drift_summary.json`,
`06_transformation_feature_comparison.csv`, `08_segmentation_replay_report.json`,
`09_live_sql_source_drift.json`, và `11_summary.json`.

Không bật L1, không chạy L2, và không ghi SQL production trong audit này.
