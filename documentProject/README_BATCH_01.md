# Batch 01 - Nền tảng L1 TCN Autoencoder

Gói này chứa các file nền tảng đầu tiên cho `modeling/l1_tcn`:

```text
modeling/l1_tcn/
  configs/base.yaml
  src/config.py
  src/utils.py
  src/features.py
  src/dataset.py
```

## Vai trò

- `base.yaml`: cấu hình đường dẫn, feature, window size, hyperparameter.
- `config.py`: đọc config và resolve path.
- `utils.py`: seed, logger, JSON, device.
- `features.py`: feature specification + preprocessing mạnh cho TCN.
- `dataset.py`: đọc CSV, sort chuỗi, tạo sliding window không materialize toàn bộ window.

## Bước tiếp theo

Tạo tiếp:

```text
src/model.py
src/train.py
src/threshold.py
src/score_full_l1.py
```
