# Batch 02 - TCN Autoencoder Model + Reconstruction Loss

Gói này bổ sung phần lõi mô hình cho `OBAD/modeling/l1_tcn/src`:

```text
model.py
losses.py
```

## `model.py`

Chứa `WeldcomTCNAutoencoder`:

- Embedding cho categorical feature: `status_id`, `status_type_code`, `current_signal_code`, `hour_of_day`, `day_of_week`, `machine_group_id`, `location_id`.
- Input continuous/flag được nối với embedding.
- TCN encoder dùng residual dilated Conv1d.
- Bottleneck latent.
- TCN decoder.
- Reconstruction heads:
  - continuous reconstruction
  - binary logits
  - categorical logits

## `losses.py`

Chứa:

- `WeldcomReconstructionLoss`
- `reconstruction_error_per_window`
- `batch_to_device`

Loss tách 3 phần:

```text
total_loss =
  continuous_weight * continuous_loss
+ binary_weight     * binary_bce_loss
+ categorical_weight* categorical_ce_loss
```

## Lý do thiết kế

- Dữ liệu có nhiều token trạng thái, flag vận hành và số đo KWh/duration.
- Không nên ép tất cả feature về MSE.
- Categorical dùng CrossEntropy để model học tái tạo trạng thái.
- Binary flag dùng BCEWithLogits.
- Continuous dùng SmoothL1 để bền hơn với outlier lớn như duration/KWh rate.

## Bước tiếp theo

Batch 03 sẽ tạo:

```text
train.py
threshold.py
```

để train `strict` và `lenient` trên Colab T4.
