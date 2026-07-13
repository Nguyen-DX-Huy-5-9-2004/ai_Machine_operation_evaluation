# Batch 05.1 - Prepare L2 Features / Stabilize Strict-Sensitive Signal

Batch này chạy sau Batch 05 và trước Batch 06.

Mục tiêu: xử lý vấn đề `strict/sensitive` bị lệch phân bố rất mạnh giữa train và valid/test.

Batch 05.1 không train lại L1, không join lại dữ liệu. Nó chỉ chuẩn hóa feature L1 để L2 train ổn định hơn.

## Vì sao cần Batch 05.1?

Sau Batch 05, kết quả cho thấy:

```text
is_sensitive_warning train ≈ 74.41%
is_sensitive_warning valid ≈ 1.96%
is_sensitive_warning test  ≈ 1.16%
```

Đây là distribution shift lớn. Nếu đưa raw `is_sensitive_warning` vào L2 production model, model rất dễ học nhầm.

Vì vậy Batch 05.1 tạo các feature strict dạng ổn định hơn:

```text
clip theo ngưỡng fit trên train בלבד
log1p sau clip
strict-lenient gap
strict/lenient ratio
balance index
```

## File được thêm

```text
OBAD/modeling/l2_fault_classifier/configs/feature_policy.yaml
OBAD/modeling/l2_fault_classifier/src/prepare_l2_features.py
README_BATCH_05_1.md
```

## Input

```text
OBAD/data/dataModel/l2/train_with_l1_score.csv
OBAD/data/dataModel/l2/valid_with_l1_score.csv
OBAD/data/dataModel/l2/test_with_l1_score.csv
```

## Output

```text
OBAD/data/dataModel/l2/prepared/train_l2_ready.csv
OBAD/data/dataModel/l2/prepared/valid_l2_ready.csv
OBAD/data/dataModel/l2/prepared/test_l2_ready.csv
```

Report:

```text
OBAD/data/dataModel/l2/prepared_report/
  l1_score_clip_stats_train_only.json
  l2_feature_policy.json
  prepare_l2_features_summary.csv
  prepared_target_distribution.csv
  prepared_l1_signal_by_target.csv
  prepare_l2_features_run_summary.json
```

## Cách chạy trên Colab

```python
from google.colab import drive
drive.mount('/content/drive')

%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!pip install -q pandas numpy pyyaml

!python prepare_l2_features.py --config ../configs/feature_policy.yaml
```

## Các feature mới quan trọng

Lenient/production stable features:

```text
l1_lenient_norm_clip
l1_lenient_norm_log
l1_behavior_anomaly_score_clip
l1_behavior_anomaly_score_log
l1_score_lenient_clip
l1_score_lenient_log
l1_behavior_anomaly_flag
```

Strict/sensitive stabilized features:

```text
l1_strict_norm_clip
l1_strict_norm_log
l1_behavior_sensitive_score_clip
l1_behavior_sensitive_score_log
l1_behavior_combined_score_clip
l1_behavior_combined_score_log
l1_score_strict_clip
l1_score_strict_log
l1_strict_lenient_gap_log
l1_strict_lenient_ratio_log
l1_score_balance_index
```

## Feature profiles cho Batch 06

File quan trọng:

```text
OBAD/data/dataModel/l2/prepared_report/l2_feature_policy.json
```

Nó chứa 3 profile:

```text
safe:
  L2 native numeric evidence + lenient L1 production features
  Không dùng strict raw boolean

strict_continuous:
  safe + strict score đã clip/log/gap/ratio
  Đây là profile nên thử chính sau safe

full_experimental:
  strict_continuous + raw strict boolean/coded features
  Chỉ dùng để ablation, không dùng mặc định production
```

## Kiểm tra nhanh sau khi chạy

```python
import pandas as pd, json

base = '/content/drive/MyDrive/OBAD/data/dataModel/l2/prepared'
report = '/content/drive/MyDrive/OBAD/data/dataModel/l2/prepared_report'

for split in ['train', 'valid', 'test']:
    df = pd.read_csv(f'{base}/{split}_l2_ready.csv', nrows=5)
    print(split, df.shape)
    print([c for c in df.columns if c.startswith('l1_')][:20])

policy = json.load(open(f'{report}/l2_feature_policy.json', 'r', encoding='utf-8'))
print(policy['profile_sizes'])
```

## Sau Batch 05.1

Chuyển sang Batch 06:

```text
Train L2 multi-label model.
Ưu tiên train 2 profile trước:
1. safe
2. strict_continuous

Sau đó so sánh valid/test PR-AUC, ROC-AUC, F1, recall@top-k, calibration.
```
