# Review of files that could be missed

## Required event-level SQL imports

- `ai_l1_operation_event_sequence.csv`
- `ai_l1_operation_anomaly_result_production.csv`
- `ai_l2_fault_confidence_event.csv`
- `ai_l2_fault_judgment_policy_v2_all.csv`

## Optional SQL import

- `ai_l2_dashboard_event_core_v2.csv`

It is useful as a compact/reference table but the current source-aware view does not
use it instead of the full historical policy and L2 confidence tables.

## Keep on disk, not SQL event tables

- `ai_l1_operation_anomaly_result_production_summary.json`
- `ai_l1_operation_anomaly_result_production_by_machine.csv`
- `final_l2_policy_v2_manifest.json`
- `batch08_action_distribution.csv`
- `batch08_policy_metrics.csv`
- `batch08_policy_topk.csv`
- `batch08_split_summary.csv`
- `batch08_target_rate_by_operational_action.csv`

These are metadata/report inputs for Model Monitor or audits.

## Do not import into runtime database

- `ai_l1_operation_anomaly_result.csv` — older pre-production decision.
- `train_l2_fault_judgment_policy_v2.csv`
- `valid_l2_fault_judgment_policy_v2.csv`
- `test_l2_fault_judgment_policy_v2.csv`
- `ai_l2_future_fault_label.csv`
- L1/L2 train/valid/test datasets and views.

The combined `_all.csv` already contains the historical final-policy rows.
Future labels must never become runtime model features.

## Model/runtime files that are required but are not SQL imports

- L1 lenient and strict `model_best.pt`
- L1 `preprocessor.json`
- L1 `thresholds.json`
- Six selected L2 `model.joblib` and `metadata.json`
- `production_profile_selection.json`
- `ai_production_lineage_manifest.json`
- `policy_l2.yaml`

These must remain in their locked project paths for inference.

## Optional future business datasets

The current event-level L1/L2 pipeline does not directly consume:

- `data_cabinetglobal_kwh`
- `data_cabinetglobal_kwh_daily`
- `data_electric_cabinet`
- `data_electric_cabinetglobal`
- `data_machine_repair`
- `data_machine_maintenance_his`
- `data_maintenance`

They may later support Energy Consistency and Maintenance pages. Do not substitute
cabinet/location KWh for machine-event `status_kwh_start/end` without a validated bridge.
