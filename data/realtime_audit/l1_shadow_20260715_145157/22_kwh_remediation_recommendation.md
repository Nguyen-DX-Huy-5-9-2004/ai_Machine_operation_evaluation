# KWh Drift Model Impact

- Recommendation: `EVALUATE_MODEL_RETRAINING`
- Paired rows: `9977`
- Lenient median score diff: `0.0004498489433899522`
- Strict median score diff: `2.1774438209831715e-05`
- Lenient Pearson/Spearman: `0.994073881676209` / `0.7393957525159075`
- Strict Pearson/Spearman: `0.9966736599067223` / `0.6528351385518015`
- Event anomaly label change rate: `0.025859476796632253`
- Strict-only sensitive warning change rate: `0.009922822491730982`
- Machine largest anomaly-rate shift: `{'machine_id': 59, 'paired_rows': 5, 'current_behavior_anomaly_rate': 0.0, 'historical_behavior_anomaly_rate': 1.0, 'behavior_anomaly_rate_diff': -1.0, 'current_sensitive_warning_rate': 0.0, 'historical_sensitive_warning_rate': 0.0, 'sensitive_warning_rate_diff': 0.0, 'lenient_label_change_rate': 1.0, 'strict_label_change_rate': 1.0}`
- Old threshold assessment: `NOT_CONFIRMED_FOR_REUSE; paired strict rank correlation or threshold crossing behavior requires threshold/retrain evaluation before production use`

Realtime data policy: giu raw KWh hien tai, khong mask/drop de ep giong historical. Khong tu dong retrain, recalibrate, hay ghi SQL trong buoc nay.

Tra loi diem 10: `Realtime keeps true raw KWh when present. Missing KWh is only imputed from immediate adjacent raw event within 300 seconds; no synthetic events, no resampling, no continuous-chain fill, and no masking of current backfilled KWh to mimic historical training data.`
