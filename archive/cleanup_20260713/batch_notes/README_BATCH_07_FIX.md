# Batch 07 Fix - LightGBM categorical_feature mismatch khi predict

## Lỗi gặp phải

Khi chạy Batch 07:

```text
ValueError: train and valid dataset categorical_feature do not match.
```

Lỗi này xuất hiện ở bước `model.predict_proba(X)` của LightGBM.

## Nguyên nhân

Không phải lỗi dữ liệu, không phải lỗi model, không cần train lại Batch 06.

Nguyên nhân là LightGBM sklearn model đã train với pandas categorical columns.

Khi predict theo chunk, pandas tự tạo categorical metadata khác nhau giữa các chunk, làm LightGBM báo:

```text
train and valid dataset categorical_feature do not match
```

## Cách fix

Patch `score_l2_production.py` để khi inference, feature matrix được đưa vào LightGBM dưới dạng:

```text
numpy float32 matrix
```

theo đúng thứ tự feature profile.

Các categorical-like feature của dự án như `status_id`, `hour_of_day`, `location_id`, `machine_group_id` vốn đã là mã số integer, nên cách này an toàn cho inference.

## Cách chạy trên Colab

Giải nén Batch 07 Fix vào gốc `OBAD`, sau đó chạy:

```python
%cd /content/drive/MyDrive/OBAD/modeling/l2_fault_classifier/src

!python patch_batch07_lightgbm_predict.py
```

Sau đó chạy lại Batch 07:

```python
!python score_l2_production.py \
  --config ../configs/score_l2.yaml \
  --run-id l2_multilabel_20260711_043347
```

Nếu muốn test nhanh trước:

```python
!python score_l2_production.py \
  --config ../configs/score_l2.yaml \
  --run-id l2_multilabel_20260711_043347 \
  --splits valid,test
```

## Có cần train lại không?

Không.

Chỉ patch inference script.
