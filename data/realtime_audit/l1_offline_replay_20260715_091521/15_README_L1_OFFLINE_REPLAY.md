# Offline Replay L1

Thư mục audit: `G:\My Drive\OBAD\data\realtime_audit\l1_offline_replay_20260715_091521`

- Snapshot raw: `EXACT_TRAINING_RAW_SNAPSHOT_FOUND`
- Transformation parity trên raw input trùng khớp: `PASS`
- Kết luận: `L1_TRANSFORMATION_LOGIC_READY`

Mở trước: `01_training_snapshot_resolution.json`, `02_raw_input_comparison.csv`,
`07_transformation_feature_comparison.csv`, `11_segmentation_replay_report.json`,
`13_true_logic_mismatches.csv`, và `14_summary.json`.

Replay chỉ đọc CSV snapshot và historical L1. L1/L2 không được bật và SQL production không được ghi.
