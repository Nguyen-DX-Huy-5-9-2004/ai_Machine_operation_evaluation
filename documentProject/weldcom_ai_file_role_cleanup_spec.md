# Weldcom AI - Vai trò file và kế hoạch tinh gọn mã nguồn

Phiên bản: `AI_FILE_ROLE_AND_CLEANUP_SPEC_V1`

Mục tiêu: dùng làm tài liệu cho Codex/VS Code để rà soát, tinh gọn các file AI trong dự án, tránh lẫn lộn giữa file train, file score, file fix tạm, artifact và output dashboard.

---

## 1. Nguyên tắc phân loại file

Trong dự án hiện có 5 nhóm file khác nhau:

```text
1. Source code / config
   Dùng để train, prepare, score, rebuild policy.

2. Model artifacts
   Trọng số và metadata của model đã train.

3. Reports / metrics
   Báo cáo đánh giá, metrics, top-k, calibration, feature importance.

4. Final outputs
   CSV kết quả đã chấm điểm toàn bộ lịch sử, phục vụ SQL/dashboard.

5. Temporary / patch / local runtime files
   File sinh ra trong quá trình sửa lỗi, chạy Colab, test output.
```

Không được trộn 5 nhóm này với nhau.

---

## 2. L1 TCN - Config

### `modeling/l1_tcn/configs/base.yaml`

Vai trò:

```text
Config chính cho L1 TCN Autoencoder.
Quy định data paths, window size, batch size, feature groups, output artifact paths.
```

Trạng thái:

```text
KEEP
```

Lưu ý Codex:

```text
Không tạo thêm nhiều config L1 mới nếu không cần.
Nếu cần chạy trên Colab/local, nên dùng CLI override hoặc tạo file local tạm không commit.
```

---

## 3. L1 TCN - Source code

### `modeling/l1_tcn/src/train.py`

Vai trò:

```text
Train L1 TCN Autoencoder cho normal_lenient và normal_strict.
Sinh ra model_best.pt, model_last.pt, preprocessor.json, thresholds/report.
```

Trạng thái:

```text
KEEP
```

---

### `modeling/l1_tcn/src/score_full_l1.py`

Vai trò:

```text
Load L1 lenient + strict artifacts.
Score toàn bộ ai_l1_operation_event_sequence / dataModel L1.
Sinh ra ai_l1_operation_anomaly_result.csv.
```

Trạng thái:

```text
KEEP, nhưng nên chỉnh để tích hợp luôn final production decision.
```

Việc cần Codex làm:

```text
Tích hợp logic từ rebuild_l1_final_decision.py vào score_full_l1.py.

Kết quả output cuối phải là:
ai_l1_operation_anomaly_result_production.csv
```

---

### `modeling/l1_tcn/src/rebuild_l1_final_decision.py`

Vai trò hiện tại:

```text
File fix sau Batch04.
Sửa lỗi logic OR khiến anomaly quá nhiều.
Tạo final decision:
  is_behavior_anomaly = is_anomaly_lenient
  is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient
```

Trạng thái:

```text
KEEP tạm thời.
Sau khi tích hợp vào score_full_l1.py thì chuyển sang archive.
```

Quy tắc không được bỏ:

```text
Lenient là production main.
Strict chỉ là sensitive/audit.
Không OR lenient và strict thành operational anomaly.
```

---

### `modeling/l1_tcn/src/threshold.py`

Vai trò:

```text
Tính/analyze threshold L1, anomaly summary valid/test.
```

Trạng thái:

```text
KEEP
```

---

## 4. L2 - Config

### `modeling/l2_fault_classifier/configs/feature_policy.yaml`

Vai trò:

```text
Khai báo feature profiles:
  safe
  strict_continuous
  full_experimental
```

Trạng thái:

```text
KEEP
```

Production hiện dùng:

```text
safe
strict_continuous
```

---

### `modeling/l2_fault_classifier/configs/train_l2.yaml`

Vai trò:

```text
Config train L2 LightGBM multi-label.
Quy định train/valid/test prepared paths, targets, model params, output artifacts/reports.
```

Trạng thái:

```text
KEEP
```

---

### `modeling/l2_fault_classifier/configs/score_l2.yaml`

Vai trò:

```text
Config score L2 production.
Dùng bởi score_l2_production.py.
Đọc prepared ready CSV, load selected models, sinh risk/prediction.
```

Trạng thái:

```text
KEEP
```

Cần chỉnh:

```text
Không để mặc định gzip nếu ghi Google Drive chậm.
Nên cho phép CLI override:
  --output-root
  --report-root
  --compression none
  --chunksize
```

---

### `modeling/l2_fault_classifier/configs/score_l2_local.yaml`

Vai trò hiện tại:

```text
Config tạm tạo khi chạy Colab để ghi ra /content, output_compression=None.
```

Trạng thái:

```text
OPTIONAL / RUNTIME ONLY
Không nên coi là source-of-truth.
```

Khuyến nghị:

```text
Không commit hoặc đổi thành score_l2_local.example.yaml.
Tốt hơn: để notebook/Codex tự sinh config tạm khi chạy.
```

---

### `modeling/l2_fault_classifier/configs/policy_l2.yaml`

Vai trò:

```text
Config policy cuối.
Biến risk/pred/evidence thành:
  operational_action_level
  operational_judgment
  quality_action_level
  quality_judgment
```

Trạng thái:

```text
KEEP
```

Bắt buộc phải chứa/tương đương logic:

```text
threshold_epsilon = 1e-6

quality issue không tự tạo operational MONITOR

is_sensitive_warning không tự tạo operational MONITOR

Không còn operational_action_level = MONITOR trong final policy v2
```

---

### `modeling/l2_fault_classifier/configs/base.yaml`

Vai trò khả nghi:

```text
Có thể là config nền cũ của L2 hoặc file tạo ban đầu.
```

Trạng thái:

```text
CHECK REFERENCE
```

Yêu cầu Codex:

```text
grep toàn bộ repo xem file này có được import/read không.

Nếu không được dùng:
  chuyển sang archive/configs_legacy/

Nếu đang được dùng:
  ghi rõ file nào dùng và giữ lại.
```

---

## 5. L2 - Source code

### `modeling/l2_fault_classifier/src/join_l1_score_to_l2.py`

Vai trò:

```text
Join L1 production score vào L2 train/valid/test.
Input:
  prepared/raw L2 split
  ai_l1_operation_anomaly_result_production.csv
Output:
  train_with_l1_score.csv
  valid_with_l1_score.csv
  test_with_l1_score.csv
```

Trạng thái:

```text
KEEP
```

---

### `modeling/l2_fault_classifier/src/prepare_l2_features.py`

Vai trò:

```text
Áp feature_policy.yaml.
Chuẩn hóa profile safe/strict/full.
Clip/log L1 score bằng train-only stats.
Sinh train_l2_ready.csv, valid_l2_ready.csv, test_l2_ready.csv.
```

Trạng thái:

```text
KEEP
```

Bắt buộc giữ:

```text
Không fit clip/scaler trên valid/test.
Chỉ dùng train stats.
```

---

### `modeling/l2_fault_classifier/src/train_l2_multilabel.py`

Vai trò:

```text
Train LightGBM multi-label independent classifiers.
Train 6 targets trên các feature profiles.
Sinh model.joblib, metadata.json, feature_importance.csv.
Sinh reports và production_profile_selection.json.
```

Trạng thái:

```text
KEEP
```

---

### `modeling/l2_fault_classifier/src/score_l2_production.py`

Vai trò:

```text
Load selected model từ production_profile_selection.json.
Score train/valid/test hoặc data mới đã prepared.
Sinh risk/pred/threshold/profile cho từng target.
```

Trạng thái:

```text
KEEP, cần chỉnh sạch.
```

Các fix phải tích hợp trực tiếp:

```text
1. LightGBM predict dùng numpy float32 matrix, không dùng pandas category chunk.
   Tránh lỗi:
   train and valid dataset categorical_feature do not match

2. Không còn warning/lỗi:
   cannot insert target, already exists
   ở phần collect feature importance.

3. Cho phép output local /content bằng CLI hoặc config generated.
```

Không nên cần patch rời nữa.

---

### `modeling/l2_fault_classifier/src/rebuild_l2_operational_policy.py`

Vai trò:

```text
Đọc output Batch07.
Áp policy v2.
Tách:
  operational_action_level / operational_judgment
  quality_action_level / quality_judgment
Sinh train/valid/test_l2_fault_judgment_policy_v2.csv.
```

Trạng thái:

```text
KEEP, cần tích hợp toàn bộ fix cuối.
```

Các fix phải có sẵn trong file này:

```text
1. threshold_epsilon = 1e-6 để xử lý risk nằm sát threshold.

2. data_quality_issue không đẩy operational_action_level lên MONITOR.

3. energy issue không đẩy operational_action_level lên MONITOR.

4. is_sensitive_warning không đẩy operational_action_level lên MONITOR.

5. Nếu event không có critical/high/medium thì:
   operational_action_level = LOW
   operational_judgment = NORMAL_LIKE

6. Không còn output SENSITIVE_BEHAVIOR_MONITOR trong operational_judgment final.
```

Sau khi tích hợp đúng, không cần cell fix thủ công trong Colab.

---

## 6. Evaluate / Data preparation

### `data/dataCore/evaluate_ai_datasets.py`

Vai trò:

```text
Đánh giá/audit các bảng AI core:
  ai_l1_operation_event_sequence
  ai_l2_fault_confidence_event
Kiểm tra row count, status distribution, quality flags, consistency.
```

Trạng thái:

```text
KEEP
```

---

### `data/dataDerived/prepare_datamodel_splits.py`

Vai trò:

```text
Chia train/valid/test theo machine_id và thứ tự thời gian.
Tạo:
  data/dataModel/l1/normal_lenient/train.csv valid.csv test.csv
  data/dataModel/l1/normal_strict/train.csv valid.csv test.csv
  data/dataModel/l2/train.csv valid.csv test.csv
```

Trạng thái:

```text
KEEP
```

---

### `data/dataDerived/evaluate_datamodel_splits.py`

Vai trò:

```text
Đánh giá split train/valid/test:
  row count
  window count
  positive rate L2 target
  distribution stability
```

Trạng thái:

```text
KEEP
```

---

## 7. L1 artifacts

Thư mục:

```text
modeling/l1_tcn/artifacts/lenient/
modeling/l1_tcn/artifacts/strict/
```

Các file quan trọng:

```text
model_best.pt
preprocessor.json
thresholds.json
training_history.csv
summary/valid/test reports
```

Vai trò:

```text
model_best.pt:
  trọng số model production candidate.

preprocessor.json:
  mapping/scaler/feature processing. Cực kỳ quan trọng cho inference.

thresholds.json:
  threshold anomaly. Cực kỳ quan trọng cho inference.

training_history.csv:
  audit train.

summary valid/test:
  audit/evaluation.
```

Trạng thái:

```text
KEEP
```

Có thể archive:

```text
model_last.pt nếu model_best.pt đã đủ và không cần resume train.
old intermediate scored files nếu đã có final production output.
```

Không xóa:

```text
model_best.pt
preprocessor.json
thresholds.json
```

---

## 8. L2 artifacts

Thư mục:

```text
modeling/l2_fault_classifier/artifacts/l2_multilabel_*/
```

Mỗi target/profile có:

```text
model.joblib
metadata.json
feature_importance.csv
```

Vai trò:

```text
model.joblib:
  model LightGBM thật.

metadata.json:
  thông tin feature/model/target/profile.

feature_importance.csv:
  audit/explainability, không bắt buộc cho runtime.
```

Trạng thái:

```text
KEEP
```

Production thật chỉ dùng 6 model được chọn trong:

```text
production_profile_selection.json
```

Nhưng nên giữ đủ 12 model đã train để audit/so sánh.

---

## 9. L2 reports

Thư mục:

```text
data/dataModel/l2/model_report/l2_multilabel_*/
```

Các file:

```text
l2_training_summary.csv
l2_metrics_by_split.csv
l2_topk_metrics.csv
l2_calibration.csv
l2_feature_importance_all.csv
production_profile_selection.json
```

Vai trò:

```text
production_profile_selection.json:
  RUNTIME REQUIRED.
  Cho biết target nào dùng profile nào, threshold nào.

metrics/topk/calibration:
  audit/evaluation/report.
```

Trạng thái:

```text
KEEP
```

Không xóa:

```text
production_profile_selection.json
```

---

## 10. Final policy/dashboard outputs

Thư mục:

```text
data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/
```

Các file:

```text
ai_l2_fault_judgment_policy_v2_all.csv
ai_l2_dashboard_event_core_v2.csv
train_l2_fault_judgment_policy_v2.csv
valid_l2_fault_judgment_policy_v2.csv
test_l2_fault_judgment_policy_v2.csv
final_l2_policy_v2_manifest.json
```

Vai trò:

```text
ai_l2_fault_judgment_policy_v2_all.csv:
  output historical full, 4,062,118 rows.
  dùng import SQL/dashboard/audit.

ai_l2_dashboard_event_core_v2.csv:
  bản rút gọn cho dashboard/import nhanh.
  không phải model.

train/valid/test_l2_fault_judgment_policy_v2.csv:
  output từng split.
  có thể tái merge thành all.

final_l2_policy_v2_manifest.json:
  metadata final.
  dùng để biết file final đúng version nào.
```

Trạng thái:

```text
KEEP
```

Có thể giảm dung lượng:

```text
Nếu SQL đã import đúng và đã backup Drive:
  có thể nén train/valid/test riêng.
  vẫn nên giữ ai_l2_fault_judgment_policy_v2_all.csv hoặc một bản nén.
```

Không dùng bản cũ có phân phối:

```text
MONITOR = 2,114,489
SENSITIVE_BEHAVIOR_MONITOR = 2,114,489
```

Bản đúng phải là:

```text
operational_action_level:
LOW       3,904,149
HIGH         89,883
MEDIUM       54,902
CRITICAL     13,184
```

---

## 11. Policy audit report

Thư mục:

```text
data/dataModel/l2/policy_v2_report/l2_multilabel_20260711_043347/
```

Các file:

```text
batch08_action_distribution.csv
batch08_policy_manifest.json
batch08_policy_metrics.csv
batch08_policy_topk.csv
batch08_split_summary.csv
batch08_target_rate_by_operational_action.csv
```

Vai trò:

```text
audit policy v2
chứng minh CRITICAL/HIGH có target rate cao
báo cáo mô hình/dashboard
```

Trạng thái:

```text
KEEP
```

---

## 12. File có thể xóa/archive sau khi Codex tích hợp fix

### Có thể archive nếu đã tích hợp vào file chính

```text
rebuild_l1_final_decision.py
```

sau khi logic final decision đã nằm trong `score_full_l1.py`.

### Có thể archive hoặc đổi .example

```text
score_l2_local.yaml
```

vì đây chỉ là config runtime Colab.

### Nên xóa khỏi working tree

```text
*.bak
*.tmp
*.before_judgment_fix.csv
*_fix.py
patch_*.py
old zip batch fix
local /content output copy
duplicate downloaded CSV có (1), (2)
```

### Không xóa

```text
model_best.pt
preprocessor.json
thresholds.json
model.joblib
metadata.json
production_profile_selection.json
feature_policy.yaml
policy_l2.yaml
final_l2_policy_v2_manifest.json
```

---

## 13. Pipeline chuẩn sau khi tinh gọn

Codex nên hướng tới một pipeline có thể chạy theo thứ tự:

```text
1. evaluate_ai_datasets.py

2. prepare_datamodel_splits.py

3. evaluate_datamodel_splits.py

4. train.py --profile lenient

5. train.py --profile strict

6. score_full_l1.py
   Output final L1 production decision luôn.

7. join_l1_score_to_l2.py

8. prepare_l2_features.py

9. train_l2_multilabel.py

10. score_l2_production.py
    Không cần patch LightGBM nữa.

11. rebuild_l2_operational_policy.py
    Không cần fix monitor/sensitive thủ công nữa.

12. merge/export final
    Có validate chống nhầm bản cũ.
```

Có thể gom bước 10-12 vào một runner:

```text
run_final_l2_policy_pipeline.py
```

Nhưng không nên tạo nhiều script fix rời.

---

## 14. Validation bắt buộc sau pipeline

Sau khi tạo final output, bắt buộc kiểm tra:

```text
total rows = 4,062,118
```

```text
operational_action_level:
LOW       3,904,149
HIGH         89,883
MEDIUM       54,902
CRITICAL     13,184
```

```text
operational_judgment:
NORMAL_LIKE                    3,904,149
PRE_FAULT_HIGH_CONFIDENCE         88,079
UNKNOWN_BEHAVIOR_ANOMALY          36,184
PRE_FAULT_MEDIUM_CONFIDENCE       15,511
KNOWN_FAULT_CONFIRMED             13,184
MAINTENANCE_RELATED                3,207
REPAIR_RELATED                     1,804
```

Nếu có:

```text
MONITOR
SENSITIVE_BEHAVIOR_MONITOR
```

thì phải fail pipeline.

---

## 15. Gợi ý cấu trúc sạch

```text
modeling/
  l1_tcn/
    configs/
      base.yaml
    src/
      train.py
      score_full_l1.py
      threshold.py
      model.py
      dataset.py
      features.py
      losses.py
      utils.py
    artifacts/
      lenient/
      strict/

  l2_fault_classifier/
    configs/
      feature_policy.yaml
      train_l2.yaml
      score_l2.yaml
      policy_l2.yaml
    src/
      join_l1_score_to_l2.py
      prepare_l2_features.py
      train_l2_multilabel.py
      score_l2_production.py
      rebuild_l2_operational_policy.py
      run_final_l2_policy_pipeline.py
    artifacts/
      l2_multilabel_20260711_043347/

data/
  dataCore/
    evaluate_ai_datasets.py
  dataDerived/
    prepare_datamodel_splits.py
    evaluate_datamodel_splits.py
  dataModel/
    l1/
    l2/
      prepared/
      model_report/
      policy_v2/
      policy_v2_report/
```

---

## 16. Nhiệm vụ cụ thể cho Codex

Yêu cầu Codex thực hiện theo thứ tự:

```text
1. Search references của modeling/l2_fault_classifier/configs/base.yaml.
   Nếu không dùng thì chuyển sang archive/configs_legacy.

2. Tích hợp rebuild_l1_final_decision.py vào score_full_l1.py.

3. Tích hợp LightGBM numpy predict patch vào score_l2_production.py.

4. Sửa collect feature importance để không lỗi cannot insert target, already exists.

5. Tích hợp final policy fix vào rebuild_l2_operational_policy.py:
   - no MONITOR
   - no SENSITIVE_BEHAVIOR_MONITOR
   - threshold epsilon
   - quality action tách riêng

6. Tạo runner run_final_l2_policy_pipeline.py nếu muốn,
   nhưng runner chỉ gọi các file chính, không chứa patch tạm.

7. Thêm validation final distribution.

8. Đưa score_l2_local.yaml ra khỏi source-of-truth.
```

---

## 17. Kết luận

Tập file hiện tại không sai, nhưng bị lẫn giữa:

```text
source chính
runtime config
patch tạm
artifact
report
final output
```

Sau khi tinh gọn, source-of-truth nên là:

```text
L1:
  base.yaml
  train.py
  score_full_l1.py
  threshold.py
  artifacts lenient/strict

L2:
  feature_policy.yaml
  train_l2.yaml
  score_l2.yaml
  policy_l2.yaml
  join_l1_score_to_l2.py
  prepare_l2_features.py
  train_l2_multilabel.py
  score_l2_production.py
  rebuild_l2_operational_policy.py
  artifacts/model_report/policy_v2
```

Các file fix/patch/local chỉ nên nằm trong archive hoặc bị loại bỏ sau khi logic đã được tích hợp vào file chính.
