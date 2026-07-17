# KWh Drift Model Impact

- Recommendation: `EVALUATE_MODEL_RETRAINING`
- Paired rows: `9977`
- Lenient median score diff: `0.00043094269999999994`
- Strict median score diff: `3.357719999999998e-05`
- Lenient Pearson/Spearman: `0.9931094102980109` / `0.7517153586491627`
- Strict Pearson/Spearman: `0.9969248042425235` / `0.6674661346127144`
- Event anomaly label change rate: `0.029568006414753933`
- Strict-only sensitive warning change rate: `0.009421669840633458`
- Machine largest anomaly-rate shift: `{'machine_id': 59, 'paired_rows': 5, 'current_behavior_anomaly_rate': 0.0, 'historical_behavior_anomaly_rate': 1.0, 'behavior_anomaly_rate_diff': -1.0, 'current_sensitive_warning_rate': 0.0, 'historical_sensitive_warning_rate': 0.0, 'sensitive_warning_rate_diff': 0.0, 'lenient_label_change_rate': 1.0, 'strict_label_change_rate': 1.0}`
- Old threshold assessment: `NOT_CONFIRMED_FOR_REUSE; paired strict rank correlation or threshold crossing behavior requires threshold/retrain evaluation before production use`

Realtime data policy: giu raw KWh hien tai, khong mask/drop de ep giong historical. Khong tu dong retrain, recalibrate, hay ghi SQL trong buoc nay.

Tra loi diem 10: `Realtime keeps true raw KWh when present. Missing KWh is only imputed from immediate adjacent raw event within 300 seconds; no synthetic events, no resampling, no continuous-chain fill, and no masking of current backfilled KWh to mimic historical training data.`
