# Batch 04 Fix - Rebuild L1 Final Decision

Sau khi score full L1, nếu kết quả ban đầu có `SENSITIVE_MODEL_DEVIATION` rất lớn và `is_behavior_anomaly` khoảng 55.6%, nguyên nhân là rule gộp cũ dùng:

```text
is_behavior_anomaly = is_anomaly_lenient OR is_anomaly_strict
```

Trong khi chiến lược đã chốt là:

```text
lenient = production model chính
strict  = sensitive warning model
```

Vì vậy cần rebuild decision:

```text
is_behavior_anomaly = is_anomaly_lenient
is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient
behavior_anomaly_score = score_lenient_norm
behavior_sensitive_score = score_strict_norm
behavior_combined_score = max(score_lenient_norm, score_strict_norm)
```

## Cách chạy trên Colab

```python
%cd /content/drive/MyDrive/OBAD/modeling/l1_tcn/src

!python rebuild_l1_final_decision.py
```

Output:

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production_summary.json
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production_by_machine.csv
```

Nếu kiểm tra thấy ổn và muốn overwrite file gốc:

```python
!python rebuild_l1_final_decision.py --overwrite-original
```

File nên dùng cho L2 là:

```text
ai_l1_operation_anomaly_result_production.csv
```

hoặc overwrite về tên gốc trước khi chạy L2.
