# Batch 04 - Score Full L1 + Hướng dẫn Colab

Batch này bổ sung:

```text
modeling/l1_tcn/src/score_full_l1.py
modeling/l1_tcn/configs/base.yaml
huongDan.md
```

## Lưu ý quan trọng về `base.yaml`

Batch 04 có kèm `base.yaml` đã chuẩn hóa lại path theo cấu trúc thật:

```text
OBAD/modeling/l1_tcn/configs/base.yaml
```

Từ thư mục `configs`, muốn trỏ về `OBAD/data` cần dùng:

```text
../../../data/...
```

Vì vậy nên dùng bản `base.yaml` trong Batch 04 để thay cho bản cũ.

## Điều kiện trước khi chạy `score_full_l1.py`

Cần train xong cả 2 profile:

```text
modeling/l1_tcn/artifacts/lenient/model_best.pt
modeling/l1_tcn/artifacts/lenient/preprocessor.json
modeling/l1_tcn/artifacts/lenient/thresholds.json

modeling/l1_tcn/artifacts/strict/model_best.pt
modeling/l1_tcn/artifacts/strict/preprocessor.json
modeling/l1_tcn/artifacts/strict/thresholds.json
```

## Chạy score full L1

```bat
cd OBAD\modeling\l1_tcn\src
python score_full_l1.py --config ../configs/base.yaml
```

Trên Colab:

```python
%cd /content/drive/MyDrive/OBAD/modeling/l1_tcn/src
!python score_full_l1.py --config ../configs/base.yaml
```

## Output

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_summary.json
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_by_machine.csv
```

`ai_l1_operation_anomaly_result.csv` là file bắt buộc để bước tiếp theo join sang L2.
