# API Field Mapping

API mode maps read-only SQL and validated artifact reports into the same frontend DTO contracts used by the presentation layer. It never recalculates inference or policy decisions.

| DTO field | SQL source | Column/expression | Aggregation | Fallback | Availability |
|---|---|---|---|---|---|
| `meta.source` | runtime contract | dataset mode namespace | none | none | SQL_EVENT_FACT |
| `machine.displayCode` | `dbo.data_machine` | `machine_call_name`, `machine_name`, `asset_code`, then `Machine <id>` | first non-empty | ID label | SQL_MASTER_DATA |
| `machine.locationId` | source-aware view | `location_id` resolved at event time | none | null | SQL_EVENT_FACT |
| `event.eventUid` | source-aware view | `event_source + ':' + event_id` | none | none | SQL_EVENT_FACT |
| `event.eventTime` | source-aware view | `event_start_time` | none | none | SQL_EVENT_FACT |
| `event.action` | source-aware view | `operational_action_level` | none | null when unready | SQL_EVENT_FACT |
| `event.overallRisk` | source-aware view | `operational_overall_risk_score` | none | null | SQL_EVENT_FACT |
| `l1.lenientScore` | source-aware view | `behavior_anomaly_score` | none | null | SQL_EVENT_FACT |
| `l1.strictScore` | source-aware view | `behavior_sensitive_score` | none | null | SQL_EVENT_FACT |
| `l1.readiness` | source-aware view | `l1_score_available_flag`, `readiness_reason` | none | explicit unavailable | SQL_EVENT_FACT |
| `l2.*` | source-aware view | six stored risk probability columns | none | null | SQL_EVENT_FACT |
| `energy.kwhDelta` | source-aware view | `kwh_delta` | none | null | SQL_EVENT_FACT |
| `energy.kwhRate` | source-aware view | `kwh_rate_per_hour` | none | null | SQL_EVENT_FACT |
| `quality.*` | source-aware view | stored KWh/time/data-quality flags | SQL aggregation for dashboard | null | SQL_EVENT_FACT |
| `dashboard.*` | source-aware view | latest-per-machine or bounded aggregate queries | SQL aggregate | empty result | SQL_EVENT_FACT |
| `modelReference.l1` | Candidate A reports | validated anomaly summary | none | null metrics | MODEL_ARTIFACT_REFERENCE |
| `modelReference.l2` | production profile selection | six selected targets and metrics | none | null metrics | MODEL_ARTIFACT_REFERENCE |
| `nextScheduledRetrain` | none | none | none | `Not scheduled` | NOT_AVAILABLE |
| `driftScore` | none | none | none | `Not calculated` | NOT_AVAILABLE |

Cabinet/global KWh tables are not mapped to machine-level energy without a validated machine-to-cabinet temporal bridge. Maintenance and repair history is not presented as a confirmed linked event unless a reliable machine/time join is available.

## Shared presentation DTOs

| DTO | DTO field | Endpoint | Source SQL / artifact | Aggregation | Availability | Fallback / notes |
|---|---|---|---|---|---|---|
| `MachineDetailDto` | `machine`, `kpis` | `/machines/{id}/summary` | source-aware dashboard view and machine registry | latest event for selected machine | SQL event and master data | Missing risk/score is `Not available`; no synthetic score. |
| `MachineDetailDto` | `timeline`, `markers` | `/machines/{id}/timeline` | source-aware dashboard view | bounded event-time ordered series | SQL event fact | Uses `event_start_time`, never scoring time. |
| `MachineDetailDto` | `riskSeries` | `/machines/{id}/l2-series` | six stored L2 probability columns | bounded event-time ordered series | SQL event fact | Unready rows are excluded by the API contract. |
| `MachineDetailDto` | `energySummary`, `kwhDeltaSeries` | `/machines/{id}/energy` | event-level KWh evidence in the source-aware view | selected-range machine aggregate | SQL event fact | Cabinet/location KWh is not assigned to a machine. |
| `MachineDetailDto` | `performanceSummary` | `/machines/{id}/performance` | event duration/status evidence | selected-range machine aggregate | SQL event fact | Throughput index is `Not available` because no backend field proves it. |
| `MachineDetailDto` | `recentEvents` | `/machines/{id}/events` | source-aware dashboard view | bounded, paged event list | SQL event fact | Missing values remain unavailable; no historical/mock substitution. |
| `ModelMonitorDto` | runtime cards and gates | `/model-monitor/overview` | runtime manifests and read-only runtime state | none | runtime contract | SQL write state and Candidate promotion state are displayed as reported. |
| `ModelMonitorDto` | scoring funnel | `/model-monitor/scoring-funnel` | source-aware readiness fields | SQL count by stage | SQL aggregate | No client-side inference. |
| `ModelMonitorDto` | L1/L2 metrics | `/model-monitor/performance-reference` | validated Candidate A and selected six-target L2 reports | none | model artifact reference | Null is `Not available`; labeled as artifact reference, not live SQL. |
| `RiskAnalyticsDto` | `actionDistribution` | `/dashboard/risk-distribution` | `operational_action_level` | SQL count by action | SQL aggregate | Only LOW/MEDIUM/HIGH/CRITICAL from stored policy output. |
| `RiskAnalyticsDto` | `riskTrend` | `/dashboard/risk-trend` | stored operational risk and event time | daily SQL aggregate | SQL aggregate | Uses event time. |
| `RiskAnalyticsDto` | `riskWindows` | `/dashboard/top-machines` | latest stored risk per machine | latest-per-machine, limit 20 | SQL aggregate | Risk horizons absent from this endpoint remain `Not available`. |
| `DataQualityDto` | `overview` | `/dashboard/data-quality-overview` | stored data/time/KWh quality flags | selected-range SQL aggregate | SQL aggregate | Quality issues are not machine faults or operational alerts. |
| `DataQualityDto` | `issueTrend` | `/dashboard/quality-trend` | stored time, KWh, and energy consistency flags | daily SQL aggregate | SQL aggregate | Missing series stays empty; it is not zero-filled from fixtures. |
| `EnergyConsistencyDto` | `issues` | `/machines` plus `/machines/{id}/energy` | event-level machine KWh evidence | bounded first-page machines, at most five detail requests | SQL aggregate | Machine event KWh only; no cabinet bridge is inferred. |

Both `ApiDataProvider` and `MockDataProvider` return these DTO contracts. Presentation components do not read raw SQL fields and do not select a fallback provider after an API failure.
