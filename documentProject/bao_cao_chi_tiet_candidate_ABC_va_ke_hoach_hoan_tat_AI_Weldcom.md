# Báo cáo quyết định Candidate A/B/C và kế hoạch hoàn tất AI Weldcom

**Dự án:** Weldcom AI Operational Assessment  
**Kết luận hiện tại:** `KEEP_CURRENT_MODEL_AND_THRESHOLDS`  
**Model L1 được giữ:** Candidate A  
**Candidate B:** Loại  
**Candidate C:** Giữ để nghiên cứu, không promotion

## 1. Candidate A là model nào?

Candidate A là bộ L1 hiện tại đã được train ban đầu và đang là production candidate:

```text
modeling/l1_tcn/artifacts/lenient/
  model_best.pt
  preprocessor.json
  thresholds.json

modeling/l1_tcn/artifacts/strict/
  model_best.pt
  preprocessor.json
  thresholds.json
```

Lenient là scorer production chính. Strict là scorer nhạy hơn để tạo tín hiệu audit.

```text
is_behavior_anomaly = is_anomaly_lenient
is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient
```

Candidate A chính là model đã score toàn bộ dữ liệu lịch sử để tạo:

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv
```

File này được `join_l1_score_to_l2.py` join vào dữ liệu L2 để tạo:

```text
train_with_l1_score.csv
valid_with_l1_score.csv
test_with_l1_score.csv
```

Sau đó dữ liệu được chuẩn hóa thành `train_l2_ready.csv`, `valid_l2_ready.csv`, `test_l2_ready.csv` để train L2.

Vì vậy, về lineage vận hành, L2 hiện tại đã được train trên tín hiệu L1 của Candidate A.

## 2. Vì sao phải thử A, B và C?

Khi xây inference online từ SQL hiện tại, pipeline canonical được siết lại về end time, KWh, gap/overlap, segmentation, location theo event-time và window 20 event.

Shadow audit cho thấy model vẫn deterministic, nhưng input hiện tại khác dữ liệu lịch sử chủ yếu do KWh backfill và một số khác biệt căn chỉnh window.

Do đó cần thử ba mức can thiệp:

### Candidate A

```text
model hiện tại
+ preprocessor hiện tại
+ threshold hiện tại
```

Mục đích: baseline chính thức, giữ recall và tương thích với L2 đã train.

### Candidate B

```text
model của A
+ preprocessor của A
+ threshold recalibrate
```

Mục đích: xem có thể giảm false positive mà không retrain hay không.

### Candidate C

```text
model mới
+ preprocessor mới
+ threshold mới
```

Train trên snapshot hiện tại:

```text
1.367.105 raw rows
1.367.091 canonical rows
14 machines
```

Mục đích: thích nghi model với phân phối current canonical data.

## 3. Khác nhau cốt lõi

| Hạng mục | A | B | C |
|---|---|---|---|
| Model weights | Model ban đầu | Giống A | Model mới |
| Preprocessor | Ban đầu | Giống A | Mới |
| Threshold | Ban đầu | Recalibrate | Mới |
| Retrain | Không | Không | Có |
| Reconstruction score | Baseline | Giống A | Khác |
| Tương thích trực tiếp L2 cũ | Cao nhất | Score liên tục giống A | Cần kiểm tra |
| Quyết định | Giữ | Loại | Không promotion |

Candidate B không phải model độc lập. A và B dùng cùng score, chỉ khác threshold.

## 4. Kết quả VALID

| Candidate | Normal FPR | Known-fault recall | Precision | F1 |
|---|---:|---:|---:|---:|
| A | 4,12% | 94,08% | 5,84% | 11,00% |
| B | 0,013% | 7,55% | 14,45% | 9,92% |
| C | 1,48% | 75,71% | 11,29% | 19,65% |

Ước lượng trên 490 known-fault windows:

```text
A: khoảng 461
B: khoảng 37
C: khoảng 371
```

## 5. Kết quả TEST

| Candidate | Normal FPR | Known-fault recall | Precision | F1 |
|---|---:|---:|---:|---:|
| A | 3,79% | 99,47% | 7,01% | 13,09% |
| B | 0,024% | 8,08% | 5,52% | 6,56% |
| C | 2,29% | 79,09% | 8,35% | 15,11% |

Ước lượng trên 569 known-fault windows:

```text
A: khoảng 566
B: khoảng 46
C: khoảng 450
```

## 6. Đánh giá Candidate A

Điểm mạnh:

- Recall cao nhất: VALID 94,08%, TEST 99,47%.
- Lineage rõ nhất với L2 hiện tại.
- An toàn hơn cho vai trò L1 là tầng phát hiện nhạy.

Điểm yếu:

- FPR cao hơn C.
- Precision và F1 thấp hơn C.

Quyết định:

```text
KEEP_CURRENT_MODEL_AND_THRESHOLDS
```

## 7. Đánh giá Candidate B

B gần như loại bỏ false positive, nhưng recall chỉ còn:

```text
VALID: 7,55%
TEST: 8,08%
```

Nó bỏ sót hơn 90% lỗi đã biết.

Quyết định:

```text
REJECT
```

Không dùng threshold B cho production.

## 8. Đánh giá Candidate C

Điểm mạnh:

- VALID FPR giảm từ 4,12% xuống 1,48%.
- TEST FPR giảm từ 3,79% xuống 2,29%.
- Precision và F1 tăng.

Điểm yếu:

```text
VALID recall: 94,08% → 75,71%
TEST recall: 99,47% → 79,09%
```

C bỏ sót thêm khoảng 90 lỗi trên VALID và 116 lỗi trên TEST so với A.

Một số máy giảm recall nghiêm trọng:

```text
Machine 46 TEST: A=100%, C=0%
Machine 48 TEST: A=100%, C≈29,41%
Machine 56 TEST: A=100%, C≈5,26%
```

Machine 49 lại có anomaly/FPR cao, cho thấy chưa ổn định theo máy.

Quyết định:

```text
KEEP_FOR_RESEARCH_ONLY
NO_PROMOTION
```

## 9. Vì sao F1 của C cao hơn nhưng vẫn không chọn?

L1 không phải tầng quyết định cuối.

L1 tạo tín hiệu nhạy; L2 mới kiểm chứng lỗi, tiền lỗi, bảo trì, sửa chữa, data issue và energy issue.

C tăng F1 bằng cách giảm false positive, nhưng đồng thời bỏ sót quá nhiều lỗi.

Trong kiến trúc này, giảm recall 18–20 điểm phần trăm là không chấp nhận được chỉ để có F1 cao hơn.

## 10. Quan hệ với L2

L2 hiện tại đã được train từ score của Candidate A.

Do giữ A, không cần tạo lại dataset L2 hoặc retrain L2.

Nhưng vẫn cần một lần compatibility dry-run:

```text
L1 A hiện tại
→ L2 feature transformation
→ 6 model L2 hiện tại
→ policy v2
```

Đây là inference read-only, không phải training.

## 11. Post-evaluation audit cần hoàn tất

Các output nhỏ cần giữ và gửi:

```text
00_summary.json
candidate_ac_disagreement_global.json
candidate_ac_disagreement_by_machine.json
future_label_contract_audit.json
future_label_prevalence_by_machine.json
future_label_lead_time_distribution.json
candidate_c_historical_regression_recovered.json
candidate_final_decision_rationale.json
```

Không cần gửi file score Parquet hoặc model checkpoint trừ khi audit báo lỗi.

## 12. Việc tiếp theo để hoàn tất AI

1. Chạy post-evaluation audit một lần.
2. Khóa production lineage manifest với SHA256.
3. Chạy L1 A → L2 → policy v2 dry-run read-only.
4. Tạo runtime bundle.
5. Chuyển project khỏi Google Drive và chạy lại test/smoke test trên SSD.

## 13. Runtime files bắt buộc khi di chuyển

```text
modeling/l1_tcn/artifacts/lenient/
modeling/l1_tcn/artifacts/strict/

modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347/

data/dataModel/l2/prepared_report/l2_feature_policy.json
data/dataModel/l2/prepared_report/l1_score_clip_stats_train_only.json

data/dataModel/l2/model_report/l2_multilabel_20260711_043347/
  production_profile_selection.json

modeling/l2_fault_classifier/configs/policy_l2.yaml

inference/online/
```

Candidate C nên archive riêng, không đưa vào runtime chính.

## 14. Định nghĩa phần AI đã hoàn tất

```text
[PASS] Candidate A được khóa
[PASS] Candidate B bị loại
[PASS] Candidate C không promotion
[PASS] Post-evaluation audit hoàn thành
[PASS] L2 lineage xác nhận dùng A
[PASS] A → L2 → policy dry-run thành công
[PASS] Production manifest có SHA256
[PASS] Runtime bundle được tạo
[PASS] Không SQL write trong validation
```

Sau đó phần còn lại chủ yếu là di chuyển project, SQL integration, backend/API, dashboard và monitoring.
