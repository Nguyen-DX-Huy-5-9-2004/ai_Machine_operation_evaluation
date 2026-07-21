# AI Model Monitor API contract

## Endpoint

`GET /api/ai-model-monitor/overview`

Query parameters:

- `date_range`
- `model_version`
- `run_scope`

The response must match `AIModelMonitorPayload` from `src/types/aiModelMonitor.ts`.

## Recommended backend sources

### L1 accuracy / candidate comparison

- `modeling/l1_tcn/artifacts/lenient/valid_anomaly_summary.json`
- `modeling/l1_tcn/artifacts/lenient/test_anomaly_summary.json`
- candidate-C evaluation reports
- candidate/threshold comparison reports containing:
  - `normal_fpr`
  - `known_fault_recall`
  - `precision`
  - `f1`
  - `accuracy` or `balanced_accuracy`
  - `auc`
  - `support`

Do not derive accuracy from FPR/recall alone unless class support or a confusion matrix is available.

### L2 accuracy by target

- `data/dataModel/l2/model_report/<run_id>/l2_metrics_by_split.csv`
- `l2_topk_metrics.csv`
- `l2_calibration.csv`
- `production_profile_selection.json`
- `data/dataModel/l2/policy_v2_report/<run_id>/batch08_policy_metrics.csv`

### L2 prediction trend

Aggregate scored/policy outputs by time bucket and target:

- `future_fault_within_30min`
- `future_fault_within_60min`
- `future_maintenance_within_30_events`
- `future_repair_within_30_events`

Return positive prediction rate, not raw probability average, unless the API explicitly labels the metric.

### Scoring funnel

Recommended stages:

1. Raw events
2. Valid feature events
3. L1 window available
4. L1 scored events
5. L2 scored events
6. Policy decisions
7. Operational alerts

### Data contract & feature health

- realtime audit registry and latest run summary
- L1 parity reports
- SQL source/feature contract reports
- event-id alignment / join coverage
- source watermark and feature freshness
- KWh data-quality audit

### Example decision trace

Join by `event_id`:

- source/event context
- L1 production result
- L2 risk output
- policy v2 action/judgment/final reason

## Important semantics

- `operational_action_level` and `quality_action_level` are separate.
- Lenient L1 is the production anomaly detector.
- Strict L1 is the sensitive warning detector.
- Accuracy is secondary on imbalanced anomaly/fault targets; always show Normal FPR, known-fault recall, precision and F1 beside it.
- KWh is evidence with availability/quality masks; do not present missing/imputed values as unquestioned ground truth.
