# Machine Detail API Contract v2

Endpoint:

```http
GET /api/machines/{machineId}/detail?range=last_24h
```

The frontend expects one `MachineDetailResponse` object.

## Key sections

```text
machine
kpis
timeline
markers
l1Series
riskSeries
kwhDeltaSeries
loadedKwhSeries
energySummary
recentEvents
operationalEvidence
energyDataEvidence
aiDecisionSteps
aiContributions
performanceSeries
performanceSummary
maintenanceTasks
maintenanceSignals
finalReason
apiMeta
```

## Suggested backend sources

### Machine context

```text
data_machine
data_location
machine_location_his
data_machine_status
```

### L1 outputs

```text
data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv
```

Fields should map to:

```text
behavior_anomaly_score
is_behavior_anomaly
is_sensitive_deviation
threshold_lenient_raw
threshold_strict_raw
behavior_reason
```

### L2 / policy outputs

```text
data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_dashboard_event_core_v2.csv
data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_fault_judgment_policy_v2_all.csv
```

Fields should map to:

```text
risk_fault_30min
risk_fault_60min
risk_maintenance_30_events
risk_repair_30_events
operational_action_level
operational_judgment
quality_action_level
quality_judgment
final_reason_v2
```

### Energy / data quality evidence

```text
ai_l1_operation_event_sequence.csv
ai_l2_fault_confidence_event.csv
```

Fields should map to:

```text
kwh_delta_model_value
kwh_rate_per_hour
kwh_start_source
kwh_end_source
kwh_missing_flag
loaded_zero_kwh_flag
loaded_without_kwh_flag
energy_inconsistency_flag
gap_from_prev_sec
overlap_sec
end_time_source
```

## Contract principle

The frontend must not run AI inference or rebuild L1/L2 features. It only displays normalized backend data and mock data during development.
