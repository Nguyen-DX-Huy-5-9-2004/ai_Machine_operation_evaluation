# Offline Replay L1 - Kiểm tra raw drift và transformation parity

Thư mục audit: `G:\My Drive\OBAD\data\realtime_audit\l1_offline_replay_20260714_142340`

- Kết quả xác định raw snapshot: `TRAINING_RAW_SNAPSHOT_NOT_FOUND`
- Kết quả parity transformation trên các event có raw input trùng: `NOT_RUN`
- Kết quả drift SQL hiện tại: `NOT_RUN`
- Kết luận: `L1_TRANSFORMATION_LOGIC_NOT_READY`
- Phân phối model: `None`

Mở trước: `02_raw_input_comparison.csv`, `03_raw_input_drift_summary.json`,
`06_transformation_feature_comparison.csv`, `08_segmentation_replay_report.json`,
`09_live_sql_source_drift.json`, và `11_summary.json`.

Không bật L1, không chạy L2, và không ghi SQL production trong audit này.
