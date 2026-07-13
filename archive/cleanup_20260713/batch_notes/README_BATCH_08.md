# Batch 08 - Rebuild L2 Operational Judgment / Action Policy

Batch 08 không train lại model.

Batch này đọc output Batch 07, sau đó rebuild lại policy để tách:

```text
operational_action_level
quality_action_level
operational_judgment
quality_judgment
```

## Vì sao cần Batch 08?

Kết quả valid Batch 07 cho thấy:

```text
MONITOR = 68.03%
DATA_QUALITY_DOMINANT = 52.45%
ENERGY_INCONSISTENCY_MONITOR = 15.30%
```

Trong khi target rate của MONITOR thấp hơn nền dữ liệu.

Kết luận:

```text
Data quality / energy quality đang làm action_level bị quá rộng.
```

Do đó Batch 08 tách cảnh báo vận hành khỏi cảnh báo chất lượng dữ liệu.

## File thêm

```text
OBAD/modeling/l2_fault_classifier/configs/policy_l2.yaml
OBAD/modeling/l2_fault_classifier/src/rebuild_l2_operational_policy.py
README_BATCH_08.md
```

## Chạy trên Colab

Yêu cầu đã có output Batch 07 local:

```text
/content/obad_l2_scored/l2_multilabel_20260711_043347/valid_l2_fault_judgment.csv
```

Chạy:

```python
%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!python rebuild_l2_operational_policy.py \
  --config ../configs/policy_l2.yaml \
  --run-id l2_multilabel_20260711_043347 \
  --splits valid
```

Nếu valid ổn:

```python
!python rebuild_l2_operational_policy.py \
  --config ../configs/policy_l2.yaml \
  --run-id l2_multilabel_20260711_043347 \
  --splits valid,test
```

## Output

```text
/content/obad_l2_policy_v2/<run_id>/
  valid_l2_fault_judgment_policy_v2.csv
  test_l2_fault_judgment_policy_v2.csv
```

Report:

```text
/content/obad_l2_policy_v2_report/<run_id>/
  batch08_split_summary.csv
  batch08_policy_metrics.csv
  batch08_policy_topk.csv
  batch08_action_distribution.csv
  batch08_target_rate_by_operational_action.csv
  batch08_policy_manifest.json
```

## Cột mới quan trọng

```text
policy_pred_fault_10_events
policy_pred_fault_30_events
policy_pred_fault_30min
policy_pred_fault_60min
policy_pred_maintenance_30_events
policy_pred_repair_30_events

operational_action_level
quality_action_level

operational_judgment
quality_judgment

operational_fault_confidence_score
operational_maintenance_confidence_score
operational_repair_confidence_score
operational_overall_risk_score
quality_risk_score

action_level_v2
fault_judgment_v2
final_reason_v2
```

## Sửa threshold boundary

Batch 08 dùng:

```text
risk >= threshold - 1e-6
```

để xử lý lỗi boundary/tie như target `future_fault_within_30min`.

Trong valid trước đó, target 30min có 9,208 điểm nằm sát threshold.

Nếu dùng đúng `threshold`, recall chỉ khoảng 3.39%.

Nếu dùng `threshold - 1e-6`, recall lên khoảng 16.64%, F1 lên khoảng 19.15%.

## Kiểm tra sau khi chạy

```python
import pandas as pd

run_id = "l2_multilabel_20260711_043347"

root = f"/content/obad_l2_policy_v2/{run_id}"
report = f"/content/obad_l2_policy_v2_report/{run_id}"

df = pd.read_csv(f"{root}/valid_l2_fault_judgment_policy_v2.csv")
print(df.shape)

print("\nOperational action:")
print(df["operational_action_level"].value_counts())
print((df["operational_action_level"].value_counts(normalize=True) * 100).round(3))

print("\nQuality action:")
print(df["quality_action_level"].value_counts())
print((df["quality_action_level"].value_counts(normalize=True) * 100).round(3))

print("\nOperational judgment:")
print((df["operational_judgment"].value_counts(normalize=True) * 100).round(3).head(20))

metrics = pd.read_csv(f"{report}/batch08_policy_metrics.csv")
print(metrics[[
    "split", "target", "policy_threshold",
    "average_precision", "roc_auc", "f1", "precision", "recall", "pred_positive_rate"
]])

rate = pd.read_csv(f"{report}/batch08_target_rate_by_operational_action.csv")
print(rate)
```

Gửi lại:

```text
operational_action_level distribution
quality_action_level distribution
batch08_policy_metrics.csv
batch08_target_rate_by_operational_action.csv
```

Sau đó mới quyết định có cần chỉnh policy lần 2 hay đã đủ để chạy valid,test/full.
