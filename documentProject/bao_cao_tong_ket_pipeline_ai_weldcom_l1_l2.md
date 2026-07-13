# Báo cáo tổng kết pipeline AI Weldcom L1/L2

Run L2 chính: `l2_multilabel_20260711_043347`  
Ngày lập: 2026-07-13 04:28:06

## 1. Trả lời nhanh

### Các file CSV là gì?

Các file CSV trong `policy_v2` là **kết quả đầu ra sau inference/scoring**, không phải trọng số mô hình.

- `train_l2_fault_judgment_policy_v2.csv`: kết quả L2 + policy v2 trên split train.
- `valid_l2_fault_judgment_policy_v2.csv`: kết quả L2 + policy v2 trên split valid.
- `test_l2_fault_judgment_policy_v2.csv`: kết quả L2 + policy v2 trên split test.
- `ai_l2_fault_judgment_policy_v2_all.csv`: file final gộp 3 split, 4,062,118 dòng, 91 cột.

### Trọng số/cấu hình mô hình nằm ở đâu?

- L1 TCN: `modeling/l1_tcn/artifacts/lenient/model_best.pt`, `modeling/l1_tcn/artifacts/strict/model_best.pt`.
- L2 LightGBM: `modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347/<profile>/<target>/model.joblib`.
- Feature/policy: `l2_feature_policy.json`, `production_profile_selection.json`, `policy_l2.yaml`.

### Mô hình đã sẵn sàng chưa?

Có, ở mức **production candidate/offline scoring**. Đã có model artifacts, scoring toàn bộ lịch sử và final event-level table. Để realtime cần đóng gói inference pipeline online.

### Manifest JSON là gì?

`final_l2_policy_v2_manifest.json` là metadata của bản export cuối: run_id, file final, số dòng/cột, policy version, phân bố action. Nó không phải model, dùng để audit/truy vết.

### Vì sao import SQL?

SQL dùng để phục vụ dashboard/API/truy vấn/join với bảng máy-vị trí-trạng thái. Không import để train lại model.

## 2. Mục tiêu bài toán

- L1: Normal Behavior Deviation Detection.
- L2: Deviation Validation / Fault Confidence.
- Đơn vị đánh giá: event theo machine_id x status interval.

## 3. Dataset và xử lý

- `ai_l1_operation_event_sequence`: dataset L1 đã sửa thời gian/KWh và gắn feature.
- `ai_l2_fault_confidence_event`: evidence table cho L2.
- `ai_l2_future_fault_label`: nhãn tương lai cho fault/maintenance/repair.
- `vw_ai_l1_train_normal_strict`, `vw_ai_l1_train_normal_lenient`: baseline normal cho L1.
- `vw_ai_l2_train_final`: train view cuối cho L2.

## 4. Model

### L1 Dual TCN Autoencoder

- Lenient: production main.
- Strict: sensitive/audit.
- Rule cuối: `is_behavior_anomaly = is_anomaly_lenient`.

### L2 LightGBM multi-label

6 targets:

- `future_fault_within_10_events`
- `future_fault_within_30_events`
- `future_fault_within_30min`
- `future_fault_within_60min`
- `future_maintenance_within_30_events`
- `future_repair_within_30_events`

## 5. Batch 01-08

| Batch | Nội dung | Kết quả |
|---|---|---|
| 01 | Khung L1 | config/features/dataset |
| 02 | Model L1 | TCN Autoencoder |
| 03 | Train L1 | artifacts strict/lenient |
| 04 | Score full L1 | production anomaly result |
| 05 | Join L1 vào L2 | train/valid/test_with_l1_score |
| 05.1 | Prepare L2 features | safe/strict_continuous profiles |
| 06 | Train L2 | LightGBM multi-label |
| 07 | Score L2 | risk/pred cho train/valid/test |
| 08 | Policy v2 | tách operational/quality |

## 6. Kết quả cuối

Final file:

`data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_fault_judgment_policy_v2_all.csv`

- Rows: 4,062,118
- Columns: 91

Operational distribution:

| Action | Rows | Percent |
|---|---:|---:|
| LOW | 3,904,149 | 96.111% |
| HIGH | 89,883 | 2.213% |
| MEDIUM | 54,902 | 1.352% |
| CRITICAL | 13,184 | 0.325% |

Quality distribution:

| Action | Rows | Percent |
|---|---:|---:|
| CHECK_DATA | 2,508,556 | 61.755% |
| QUALITY_OK | 947,762 | 23.332% |
| CHECK_ENERGY | 601,243 | 14.801% |
| CHECK_DATA_AND_ENERGY | 4,557 | 0.112% |

## 7. File quan trọng cần giữ

- L1 artifacts: `modeling/l1_tcn/artifacts/{lenient,strict}`.
- L2 artifacts: `modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347`.
- Model reports: `data/dataModel/l2/model_report/l2_multilabel_20260711_043347`.
- Final policy output: `data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347`.
- Policy reports: `data/dataModel/l2/policy_v2_report/l2_multilabel_20260711_043347`.

## 8. Kiểm tra nhanh

```python
import pandas as pd
from pathlib import Path

final_path = Path('/content/drive/MyDrive/OBAD/data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_fault_judgment_policy_v2_all.csv')
count = 0
for chunk in pd.read_csv(final_path, usecols=['event_id'], chunksize=500000):
    count += len(chunk)
print(count)
```

Kỳ vọng: `4062118`.

## 9. Trạng thái sẵn sàng

- Offline training: đạt.
- Offline scoring toàn bộ lịch sử: đạt.
- Policy v2: đạt production candidate.
- SQL/dashboard/API: bước tiếp theo.
- Realtime inference: cần đóng gói pipeline online.
