# Batch 07 - L2 Production Scoring & Fault Judgment

Batch 07 dùng các model đã chọn ở Batch 06 để tạo bảng kết quả cuối của L2.

Mục tiêu:

```text
prepared L2 features
+ selected L2 models
+ selected thresholds from valid
→ ai_l2_fault_judgment_result.csv.gz
```

## 1. File được thêm

```text
OBAD/modeling/l2_fault_classifier/configs/score_l2.yaml
OBAD/modeling/l2_fault_classifier/src/score_l2_production.py
README_BATCH_07.md
```

## 2. Điều kiện trước khi chạy

Cần chạy xong Batch 05.1:

```text
data/dataModel/l2/prepared/train_l2_ready.csv
data/dataModel/l2/prepared/valid_l2_ready.csv
data/dataModel/l2/prepared/test_l2_ready.csv
data/dataModel/l2/prepared_report/l2_feature_policy.json
```

Cần chạy xong Batch 06:

```text
modeling/l2_fault_classifier/artifacts/<run_id>/
data/dataModel/l2/model_report/<run_id>/production_profile_selection.json
```

Nếu `score_l2.yaml` để:

```yaml
run_id: "latest"
```

script sẽ tự lấy run mới nhất trong:

```text
data/dataModel/l2/model_report/
```

## 3. Chạy trên Colab

```python
from google.colab import drive
drive.mount('/content/drive')

%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!pip install -q lightgbm xgboost scikit-learn joblib pyyaml

!python score_l2_production.py --config ../configs/score_l2.yaml
```

Nếu muốn chỉ score valid/test để kiểm tra nhanh:

```python
!python score_l2_production.py --config ../configs/score_l2.yaml --splits valid,test
```

Nếu muốn dùng run cụ thể:

```python
!python score_l2_production.py \
  --config ../configs/score_l2.yaml \
  --run-id l2_multilabel_20260711_043347
```

## 4. Output chính

```text
data/dataModel/l2/scored/<run_id>/
  train_l2_fault_judgment.csv.gz
  valid_l2_fault_judgment.csv.gz
  test_l2_fault_judgment.csv.gz
  ai_l2_fault_judgment_result.csv.gz
```

File quan trọng nhất:

```text
data/dataModel/l2/scored/<run_id>/ai_l2_fault_judgment_result.csv.gz
```

## 5. Output report

```text
data/dataModel/l2/production_report/<run_id>/
  l2_scoring_split_summary.csv
  l2_selected_model_metrics.csv
  l2_selected_model_topk_metrics.csv
  l2_selected_model_calibration.csv
  selected_feature_importance.csv
  l2_production_scoring_manifest.json
```

## 6. Các cột chính trong output

### ID/context

```text
event_id
machine_id
sequence_segment_id
event_order_in_segment
status_id
known_fault_status
known_maintenance_status
known_repair_status
data_quality_issue_flag
energy_inconsistency_flag
...
```

### Risk theo từng target

```text
risk_fault_10_events
risk_fault_30_events
risk_fault_30min
risk_fault_60min
risk_maintenance_30_events
risk_repair_30_events
```

### Pred theo threshold valid

```text
pred_fault_10_events
pred_fault_30_events
pred_fault_30min
pred_fault_60min
pred_maintenance_30_events
pred_repair_30_events
```

### Final judgment

```text
model_fault_risk_score
model_maintenance_risk_score
model_repair_risk_score
fault_confidence_score
maintenance_confidence_score
repair_confidence_score
overall_operational_risk_score
fault_judgment
action_level
final_reason
```

## 7. Logic action level ban đầu

```text
CRITICAL:
  known fault/off-with-fault hoặc pred_fault_10_events

HIGH:
  pred_fault_30min hoặc pred_repair hoặc fault_confidence_score rất cao

MEDIUM:
  pred_fault_30_events hoặc pred_fault_60min hoặc pred_maintenance hoặc L1 behavior anomaly

MONITOR:
  L1 sensitive warning hoặc data/energy issue

LOW:
  còn lại
```

Đây là rule production ban đầu, dùng để vận hành và audit. Sau khi xem kết quả thực tế, có thể tinh chỉnh threshold/action rule.

## 8. Kiểm tra nhanh sau khi chạy

```python
import pandas as pd, glob

root = "/content/drive/MyDrive/OBAD/data/dataModel/l2/scored"
latest = sorted(glob.glob(root + "/*"))[-1]
print(latest)

df = pd.read_csv(f"{latest}/valid_l2_fault_judgment.csv.gz")
print(df.shape)
print(df["action_level"].value_counts(normalize=True))
print(df["fault_judgment"].value_counts(normalize=True).head(20))

report_root = latest.replace("/scored/", "/production_report/")
metrics = pd.read_csv(f"{report_root}/l2_selected_model_metrics.csv")
print(metrics[["split", "target", "profile", "average_precision", "roc_auc", "f1", "precision", "recall"]])
```

## 9. Sau Batch 07

Sau khi chạy xong, gửi lại:

```text
l2_selected_model_metrics.csv
action_level distribution
fault_judgment distribution
```

Sau đó ta sẽ quyết định:

```text
- action level hiện có quá nhạy hay quá lỏng
- target nào nên dùng thật trong dashboard
- có cần Batch 08 để tune threshold/action-level không
- có cần export SQL table hoặc API inference không
```
