# Batch 05 - Join L1 Production Score vào L2 Dataset

Batch này tạo dataset L2 đã có thêm score từ L1 để chuẩn bị train LightGBM/XGBoost/RandomForest multi-label.

## File được thêm

```text
OBAD/modeling/l2_fault_classifier/configs/base.yaml
OBAD/modeling/l2_fault_classifier/src/join_l1_score_to_l2.py
README_BATCH_05.md
```

## Điều kiện trước khi chạy

Cần có file L1 production sau Batch 04 Fix:

```text
OBAD/data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv
```

Cần có L2 split:

```text
OBAD/data/dataModel/l2/train.csv
OBAD/data/dataModel/l2/valid.csv
OBAD/data/dataModel/l2/test.csv
```

## Chạy trên Colab

```python
from google.colab import drive
drive.mount('/content/drive')

%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!pip install -q pandas numpy pyyaml

!python join_l1_score_to_l2.py --config ../configs/base.yaml
```

## Output chính

```text
OBAD/data/dataModel/l2/train_with_l1_score.csv
OBAD/data/dataModel/l2/valid_with_l1_score.csv
OBAD/data/dataModel/l2/test_with_l1_score.csv
```

## Output report

```text
OBAD/data/dataModel/l2/with_l1_report/
  join_l1_to_l2_summary.csv
  l2_target_distribution_with_l1.csv
  l1_signal_by_l2_target.csv
  l1_score_distribution.csv
  feature_manifest.json
  join_l1_to_l2_run_summary.json
```

## Cột L1 được đưa sang L2

```text
score_lenient
score_strict
score_lenient_norm
score_strict_norm
threshold_lenient
threshold_strict
is_anomaly_lenient
is_anomaly_strict
is_behavior_anomaly
is_sensitive_warning
behavior_anomaly_score
behavior_sensitive_score
behavior_combined_score
behavior_reason
action_level_l1
behavior_reason_code
action_level_l1_code
l1_score_available_flag
l1_join_missing_flag
```

## Ý nghĩa quan trọng

L2 không chỉ dùng `is_behavior_anomaly`.

L2 sẽ học từ cả:

```text
behavior_anomaly_score      = score production từ lenient
behavior_sensitive_score    = score nhạy từ strict
behavior_combined_score     = max(lenient, strict)
is_sensitive_warning        = strict-only warning
behavior_reason_code        = mã hóa reason L1
action_level_l1_code        = mã hóa action level L1
```

## Kiểm tra nhanh sau khi chạy

```python
import pandas as pd

base = "/content/drive/MyDrive/OBAD/data/dataModel/l2"

for split in ["train", "valid", "test"]:
    path = f"{base}/{split}_with_l1_score.csv"
    df = pd.read_csv(path)
    print(split, df.shape)
    print(df[[
        "l1_join_missing_flag",
        "l1_score_available_flag",
        "is_behavior_anomaly",
        "is_sensitive_warning",
        "behavior_anomaly_score",
        "behavior_sensitive_score",
    ]].mean(numeric_only=True))
```

Kỳ vọng:

```text
l1_join_missing_flag gần 0
l1_score_available_flag gần 1, trừ các event đầu segment không đủ window
is_behavior_anomaly khoảng vài phần trăm
is_sensitive_warning cao hơn, vì strict là tín hiệu nhạy
```

## Sau Batch 05

Chuyển sang Batch 06:

```text
Train L2 LightGBM/XGBoost/RandomForest multi-label
```

Target chính:

```text
future_fault_within_30min
future_fault_within_60min
```

Target phụ:

```text
future_fault_within_30_events
future_maintenance_within_30_events
future_repair_within_30_events
```
