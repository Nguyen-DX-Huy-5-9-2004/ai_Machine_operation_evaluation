# Batch 03 - Train + Threshold cho L1 TCN Autoencoder

Gói này bổ sung:

```text
modeling/l1_tcn/src/train.py
modeling/l1_tcn/src/threshold.py
```

## Chạy train trên Colab hoặc local

Từ thư mục:

```bat
cd OBAD/modeling/l1_tcn/src
```

Train lenient trước:

```bat
python train.py --config ../configs/base.yaml --profile lenient
```

Train strict sau:

```bat
python train.py --config ../configs/base.yaml --profile strict
```

Smoke-test nhanh trước khi train full:

```bat
python train.py --config ../configs/base.yaml --profile lenient --limit-train-windows 200000
```

## Artifact sinh ra sau mỗi profile

Ví dụ với `lenient`:

```text
modeling/l1_tcn/artifacts/lenient/
  model_best.pt
  model_last.pt
  preprocessor.json
  preprocessor_summary.json
  training_history.csv
  thresholds.json
  valid_window_scores.csv.gz
  valid_window_scores_with_threshold.csv.gz
  test_window_scores_with_threshold.csv.gz
  valid_anomaly_summary.json
  test_anomaly_summary.json
  run_summary.json
```

Tương tự với `strict`.

## Vai trò các file

- `model_best.pt`: checkpoint tốt nhất theo valid loss.
- `preprocessor.json`: mapping categorical + scaler. Bắt buộc dùng lại khi score full L1.
- `thresholds.json`: ngưỡng anomaly global/per-machine từ valid normal.
- `valid/test_window_scores_with_threshold.csv.gz`: kiểm tra score window và anomaly rate.
- `run_summary.json`: tóm tắt quá trình train.

## Bước tiếp theo

Batch 04 sẽ tạo:

```text
score_full_l1.py
```

để dùng cả `strict` và `lenient` model score toàn bộ:

```text
data/dataCore/ai_l1_operation_event_sequence.csv
```

và xuất:

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv
```
