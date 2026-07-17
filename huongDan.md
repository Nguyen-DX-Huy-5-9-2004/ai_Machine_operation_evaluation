# HƯỚNG DẪN CHUNG DỰ ÁN OBAD — Weldcom AI Operational Assessment

Tài liệu này hướng dẫn chạy pipeline L1 TCN Autoencoder trên Google Colab GPU T4 và kiểm tra kết quả sau train.
---

## 1. Mục tiêu bài toán

Dự án xây hệ thống AI đánh giá vận hành máy theo 2 lớp.

### Lớp 1 — Normal Behavior Deviation Detection

Mục tiêu:

```text
Học nền vận hành bình thường của từng máy.
Khi có event/chuỗi mới, đánh giá event/chuỗi đó lệch khỏi nền bình thường bao nhiêu.
```

L1 không phải mô hình phân loại lỗi trực tiếp.

L1 là mô hình anomaly/deviation detection, train trên dữ liệu normal:

```text
data/dataModel/l1/normal_lenient/train.csv
data/dataModel/l1/normal_strict/train.csv
```

Ta triển khai 2 model trong cùng L1:

```text
L1_lenient_TCN_AE  → model production chính, thực tế hơn, ít false alarm hơn
L1_strict_TCN_AE   → model nhạy hơn, dùng làm cảnh báo phụ
```

Output cuối của L1:

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv
```

### Lớp 2 — Deviation Validation / Fault Confidence

Mục tiêu:

```text
Kiểm chứng sai lệch từ L1.
Phân biệt sai lệch đó là lỗi đã biết, xu hướng trước lỗi, bảo trì/sửa chữa,
lỗi dữ liệu, bất thường năng lượng, hay bất thường chưa biết.
```

L2 sẽ dùng:

```text
data/dataModel/l2/train.csv
data/dataModel/l2/valid.csv
data/dataModel/l2/test.csv
```

và sau này join thêm output L1:

```text
ai_l1_operation_anomaly_result.csv
```

Model L2 đã chốt định hướng:

```text
LightGBM / XGBoost / RandomForest multi-label
```

---

## 2. Cấu trúc thư mục quan trọng

```text
OBAD/
  data/
    dataCore/
      ai_l1_operation_event_sequence.csv
      ai_l2_fault_confidence_event.csv

    dataModel/
      l1/
        normal_lenient/
          train.csv
          valid.csv
          test.csv
        normal_strict/
          train.csv
          valid.csv
          test.csv
        scored/

      l2/
        train.csv
        valid.csv
        test.csv
        scored/

    dataReport/
      datamodel_eval_report/

  modeling/
    l1_tcn/
      configs/
        base.yaml
      src/
        config.py
        utils.py
        features.py
        dataset.py
        model.py
        losses.py
        train.py
        threshold.py
        score_full_l1.py
      artifacts/
        lenient/
        strict/
```

---

## 3. Chuẩn bị trên Google Colab

### 3.1. Mount Google Drive

Trong Colab:

```python
from google.colab import drive
drive.mount('/content/drive')
```

### 3.2. Di chuyển vào project

Nếu thư mục `OBAD` nằm trực tiếp trong MyDrive:

```python
%cd /content/drive/MyDrive/OBAD/modeling/l1_tcn/src
```

Nếu thư mục nằm trong một folder khác, sửa lại path tương ứng.

### 3.3. Kiểm tra GPU

```python
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU")
```

Kỳ vọng:

```text
True
Tesla T4
```

### 3.4. Cài thư viện cần thiết

Colab thường đã có PyTorch. Cài thêm các thư viện nhẹ:

```python
!pip install -q pandas numpy pyyaml
```

---

## 4. Kiểm tra đường dẫn config

File config chính:

```text
OBAD/modeling/l1_tcn/configs/base.yaml
```

Từ thư mục `OBAD/modeling/l1_tcn/src`, chạy thử:

```python
!python -c "from config import load_yaml, build_paths; cfg=load_yaml('../configs/base.yaml'); p=build_paths(cfg, '../configs/base.yaml'); print(p.l1_full); print(p.lenient_train); print(p.strict_train)"
```

Các path in ra phải trỏ về:

```text
OBAD/data/dataCore/ai_l1_operation_event_sequence.csv
OBAD/data/dataModel/l1/normal_lenient/train.csv
OBAD/data/dataModel/l1/normal_strict/train.csv
```

---

## 5. Smoke-test trước khi train full

Không nên train full ngay.

Chạy smoke-test với 200,000 window để kiểm tra code, GPU, RAM, path, loss có chạy không.

### 5.1. Smoke-test lenient

```python
!python train.py --config ../configs/base.yaml --profile lenient --limit-train-windows 200000
```

Sau khi chạy xong, kiểm tra:

```text
OBAD/modeling/l1_tcn/artifacts/lenient/
  model_best.pt
  preprocessor.json
  thresholds.json
  training_history.csv
  run_summary.json
```

### 5.2. Smoke-test strict

```python
!python train.py --config ../configs/base.yaml --profile strict --limit-train-windows 200000
```

Nếu cả hai chạy ổn, có thể train full.

---

## 6. Train full L1 trên Colab T4

### 6.1. Train model lenient

```python
!python train.py --config ../configs/base.yaml --profile lenient
```

Lenient là model production chính.

### 6.2. Train model strict

```python
!python train.py --config ../configs/base.yaml --profile strict
```

Strict là model cảnh báo nhạy hơn.

---

## 7. Các file sinh ra sau train L1

Sau khi train `lenient`:

```text
OBAD/modeling/l1_tcn/artifacts/lenient/
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

Sau khi train `strict`:

```text
OBAD/modeling/l1_tcn/artifacts/strict/
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

Ý nghĩa:

| File | Ý nghĩa |
|---|---|
| `model_best.pt` | Model tốt nhất theo valid loss |
| `preprocessor.json` | Scaler + category mapping, bắt buộc dùng khi score full |
| `thresholds.json` | Ngưỡng anomaly global/per-machine |
| `training_history.csv` | Theo dõi loss từng epoch |
| `valid/test_window_scores_with_threshold.csv.gz` | Kiểm tra score window |
| `valid/test_anomaly_summary.json` | Kiểm tra anomaly rate theo máy |
| `run_summary.json` | Tóm tắt lần train |

---

## 8. Score toàn bộ L1 sau khi đã train strict + lenient

Sau khi đã có đủ artifact của cả 2 profile, chạy:

```python
!python score_full_l1.py --config ../configs/base.yaml
```

Output chính:

```text
OBAD/data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv
```

Output phụ:

```text
OBAD/data/dataModel/l1/scored/ai_l1_operation_anomaly_result_summary.json
OBAD/data/dataModel/l1/scored/ai_l1_operation_anomaly_result_by_machine.csv
```

File `ai_l1_operation_anomaly_result.csv` là đầu ra bắt buộc để bước sau join sang L2.

---

## 9. Kiểm tra nhanh output L1

```python
import pandas as pd

path = "/content/drive/MyDrive/OBAD/data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv"
df = pd.read_csv(path)

print(df.shape)
print(df.head())
print(df["behavior_reason"].value_counts(dropna=False))
print(df.groupby("machine_id")["is_behavior_anomaly"].mean().sort_values(ascending=False))
```

Kỳ vọng:

```text
Có khoảng 4,062,118 dòng nếu score full toàn bộ.
Có các cột score_lenient, score_strict, behavior_anomaly_score.
Có anomaly rate hợp lý, không phải 0% và không phải quá cao bất thường.
```

---

## 10. Chất lượng train L1 ảnh hưởng gì?

L1 là nền đầu vào quan trọng của L2.

Nếu L1 tốt:

```text
normal thật → score thấp
lệch thật → score cao
```

thì L2 có tín hiệu mạnh để học fault confidence.

Nếu L1 kém:

```text
normal cũng score cao → false alarm nhiều
lệch thật score thấp → bỏ sót dấu hiệu trước lỗi
```

thì L2 sẽ bị nhiễu, đặc biệt các target:

```text
future_fault_within_30min
future_fault_within_60min
```

Vì vậy cần kiểm tra kỹ:

```text
training_history.csv
valid_anomaly_summary.json
test_anomaly_summary.json
ai_l1_operation_anomaly_result_by_machine.csv
```

---

## 11. Sau L1 sẽ làm gì?

Sau khi có:

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv
```

ta sẽ xây pipeline L2:

```text
1. Join L1 score vào dataModel/l2/train.csv, valid.csv, test.csv
2. Train LightGBM / XGBoost / RandomForest multi-label
3. Predict:
   - future_fault_within_30min
   - future_fault_within_60min
   - future_fault_within_30_events
   - future_maintenance_within_30_events
   - future_repair_within_30_events
4. Xuất:
   data/dataModel/l2/scored/ai_l2_fault_judgment_result.csv
```

---

## 12. Thứ tự chạy chuẩn

```text
Bước 1: Copy đủ Batch 01, 02, 03, 04 vào OBAD
Bước 2: Mount Google Drive trên Colab
Bước 3: cd /content/drive/MyDrive/OBAD/modeling/l1_tcn/src
Bước 4: Smoke-test lenient
Bước 5: Smoke-test strict
Bước 6: Train full lenient
Bước 7: Train full strict
Bước 8: Score full L1
Bước 9: Kiểm tra ai_l1_operation_anomaly_result.csv
Bước 10: Chuyển sang L2
```

---

## 13. Lệnh chạy nhanh

```python
from google.colab import drive
drive.mount('/content/drive')

%cd /content/drive/MyDrive/OBAD/modeling/l1_tcn/src

!pip install -q pandas numpy pyyaml

# Smoke-test
!python train.py --config ../configs/base.yaml --profile lenient --limit-train-windows 200000
!python train.py --config ../configs/base.yaml --profile strict --limit-train-windows 200000

# Full train
!python train.py --config ../configs/base.yaml --profile lenient
!python train.py --config ../configs/base.yaml --profile strict

# Score full L1
!python score_full_l1.py --config ../configs/base.yaml
```
