# Batch 06 - Train L2 Multi-label Fault Classifier

Batch này train L2 theo hướng **Deviation Validation / Fault Confidence**.

Input là dataset đã chuẩn bị từ Batch 05.1:

```text
OBAD/data/dataModel/l2/prepared/train_l2_ready.csv
OBAD/data/dataModel/l2/prepared/valid_l2_ready.csv
OBAD/data/dataModel/l2/prepared/test_l2_ready.csv
OBAD/data/dataModel/l2/prepared_report/l2_feature_policy.json
```

Output là model, metrics, feature importance, threshold và selection report.

---

## 1. File trong Batch 06

```text
OBAD/modeling/l2_fault_classifier/
  configs/
    train_l2.yaml

  src/
    train_l2_multilabel.py

README_BATCH_06.md
```

---

## 2. Cài thư viện trên Colab

```python
from google.colab import drive
drive.mount('/content/drive')

%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!pip install -q lightgbm scikit-learn joblib pyyaml
```

Nếu muốn thử backend GPU XGBoost:

```python
!pip install -q xgboost
```

---

## 3. Smoke-test trước

Chạy nhanh một target, một profile, sample 200k dòng train:

```python
!python train_l2_multilabel.py \
  --config ../configs/train_l2.yaml \
  --profiles safe \
  --targets future_fault_within_30min \
  --max-train-rows 200000
```

Nếu chạy xong và tạo report thì mới chạy full.

---

## 4. Train full mặc định

Mặc định train 2 profile:

```text
safe
strict_continuous
```

và 6 target:

```text
future_fault_within_10_events
future_fault_within_30_events
future_fault_within_30min
future_fault_within_60min
future_maintenance_within_30_events
future_repair_within_30_events
```

Chạy:

```python
!python train_l2_multilabel.py --config ../configs/train_l2.yaml
```

---

## 5. Optional: train full_experimental

`full_experimental` có raw strict boolean/coded features như `is_sensitive_warning`, `is_anomaly_strict`, `behavior_reason_code`, `action_level_l1_code`.

Chỉ dùng để ablation:

```python
!python train_l2_multilabel.py \
  --config ../configs/train_l2.yaml \
  --profiles full_experimental
```

Không dùng mặc định production nếu chưa chứng minh tốt hơn rõ ràng trên valid/test.

---

## 6. Optional: dùng XGBoost GPU T4

LightGBM là mặc định. Nếu muốn thử backend XGBoost GPU:

```python
!python train_l2_multilabel.py \
  --config ../configs/train_l2.yaml \
  --backend xgboost \
  --profiles safe,strict_continuous
```

Nếu môi trường Colab hỗ trợ XGBoost CUDA, lệnh này sẽ dùng GPU T4.

---

## 7. Output

Mỗi lần train tạo một `run_id`.

Artifacts:

```text
OBAD/modeling/l2_fault_classifier/artifacts/<run_id>/
  safe/<target>/model.joblib
  safe/<target>/metadata.json
  safe/<target>/feature_importance.csv
  strict_continuous/<target>/model.joblib
  strict_continuous/<target>/metadata.json
  strict_continuous/<target>/feature_importance.csv
```

Reports:

```text
OBAD/data/dataModel/l2/model_report/<run_id>/
  l2_training_summary.csv
  l2_metrics_by_split.csv
  l2_topk_metrics.csv
  l2_calibration.csv
  l2_feature_importance_all.csv
  production_profile_selection.json
  l2_train_run_summary.json
```

---

## 8. Cách đọc kết quả nhanh

```python
import pandas as pd, json, os, glob

report_root = "/content/drive/MyDrive/OBAD/data/dataModel/l2/model_report"
latest = sorted(glob.glob(report_root + "/*"))[-1]
print(latest)

summary = pd.read_csv(f"{latest}/l2_training_summary.csv")
print(summary[[
    "profile", "target",
    "valid_average_precision", "valid_roc_auc", "valid_threshold_f1",
    "test_average_precision", "test_roc_auc", "test_threshold_f1"
]].sort_values(["target", "valid_average_precision"], ascending=[True, False]))

selection = json.load(open(f"{latest}/production_profile_selection.json", "r", encoding="utf-8"))
print(json.dumps(selection, ensure_ascii=False, indent=2))
```

---

## 9. Metric chính

Không dùng accuracy vì target mất cân bằng.

Ưu tiên xem:

```text
Average Precision / PR-AUC
ROC-AUC
F1 tại threshold tối ưu trên valid
Precision@TopK
Recall@TopK
Calibration table
Feature importance
```

Target production chính:

```text
future_fault_within_30min
future_fault_within_60min
```

Target phụ:

```text
future_fault_within_10_events
future_fault_within_30_events
future_maintenance_within_30_events
future_repair_within_30_events
```

---

## 10. Lưu ý quan trọng

Script chọn threshold bằng valid split.

Script chọn profile production theo valid Average Precision.

Test split chỉ dùng để đánh giá cuối, không dùng để chọn model.

Nếu LightGBM GPU không chạy trong Colab, script sẽ tự fallback CPU. Điều này không làm sai kết quả, chỉ có thể chậm hơn.
