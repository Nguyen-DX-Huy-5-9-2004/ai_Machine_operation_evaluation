# AI Model Monitor Hybrid Demo V3.1 Report

## 1. Hybrid V3 Scope

AI Model Monitor is the only API-mode page allowed to use the V3 demo/reference JSON. `ApiDataProvider.modelMonitorDto` still calls `loadModelMonitor()` first, then applies `mapHybridModelMonitor()`. Dashboard, Machines, Machine Detail, Alerts, Risk Analytics, Data Quality, Energy Consistency, and Maintenance retain their API/SQL provider paths unchanged.

The V3 reference lives at `src/data/ai-model-monitor-hybrid-demo-v3.json`. It is bundled only through the AI Model Monitor hybrid mapper; it is never sent to SQL, inference, policy, Dashboard, or Machine Detail.

## 2. Source Priority

1. Runtime SQL/API and bounded audit data.
2. Validated model artifact reference from V3.
3. Clearly labelled demo/simulated visualization data for missing monitor-only sections.

Demo cannot overwrite a runtime value. In particular runtime status, readiness, artifact integrity, SQL counts, latest audit evidence, and SQL write state never use demo fallback.

## 3. Presentation

Mock and API both use `AIModelMonitorPresentation`, including seven KPI slots, Train/Valid/Test performance tabs, seven-node flow, funnel, trace, runtime strip, and nine V3 chart panels. Each KPI/panel presents a compact provenance badge: `LIVE SQL`, `RUNTIME AUDIT`, `VALIDATED ARTIFACT`, `DEMO REFERENCE`, or `SIMULATED TREND`.

System Evaluation Status is now inside the Sidebar bottom status card only. Mock is red `DEMO DATA`; loading/not-ready API is yellow `STARTING`; green is API-only and requires real runtime health, environment PASS, artifact PASS, and required monitor responses. Green additionally says that some monitor charts use demo reference data.

## 4. Root Cause

API mode previously built a reduced, API-only monitor model: four KPI cards, two decision-flow nodes, raw funnel names, no prediction-rate empty state, and a shortened contract table. Mock mode rendered the full presentation. The two modes therefore had materially different presentation data, even though they occupied the same product screen.

## 5. Shared Presentation

Both modes now render `AIModelMonitorPresentation`. It owns the JSX structure, CSS classes, panel order, grids, chart dimensions, spacing, typography, and responsive behavior. Providers only return the shared `ModelMonitorDto`.

## 6. Canonical DTO

`ModelMonitorDto` is the alias of the shared `AIModelMonitorPayload` contract. It contains:

- `systemStatus`, `kpis`, `l1Candidates`, `l2Targets`
- `l2Trend`, `scoringFunnel`, `decisionFlow`
- `contractChecks`, `exampleTrace`, `runtimeStrip`
- `latestInferenceAudit`

`mockDataProvider` returns the fixture DTO without fetch. `apiDataProvider` loads read-only monitor resources and normalizes them through `adaptApiModelMonitor`.

## 7. Section Mapping

| Section | API source | Behavior when absent |
| --- | --- | --- |
| L1/L2 performance | `modelMonitorMetadata.json` through `/model-monitor/model-metadata` | `Not available` metric cells |
| Prediction-rate chart | Existing `/model-monitor/positive-rate-trend` response, only when it has per-target series | Fixed-height panel with `No prediction-rate series available for this range.` |
| Scoring funnel | Existing `/model-monitor/scoring-funnel` | Semantic stages stay visible; missing count is `Not calculated` |
| Decision flow | Overview runtime, validated metadata, scoring funnel, latest bounded audit | All seven nodes remain visible; absent evidence is `Not calculated` or `No recent run` |
| Contract and feature health | Overview and latest bounded audit | Evidence-free rows are `NOT CHECKED` |
| Example decision trace | Existing `/model-monitor/latest-inference-audit` sanitized sample | `No bounded inference sample available.` |
| Runtime strip | Overview, metadata, latest bounded audit | `Not calculated` where no evidence exists |

## 8. KPI Mapping

| KPI slot | API basis |
| --- | --- |
| AI Runtime Status | `/model-monitor/overview` runtime status |
| L1 Scoring Coverage | Latest bounded audit `l1ReadyCount / inputRows` |
| L1 Anomaly / Warning Rate | Latest bounded audit anomaly and strict-warning counts |
| L2 Positive Prediction Rate | Existing prediction-rate endpoint only when it returns real per-target rates |
| Calibration & Threshold Health | Count of validated L2 thresholds in metadata JSON |
| Data / Feature Drift | `Not calculated` until an explicit validated drift metric is published |
| Scoring Run Success Rate | Result of the latest bounded inference audit |

No mock values are used by API mode. Missing data is never coerced to zero.

## 9. Validated Model Reference

V3 retains Candidate A lenient production-primary and strict sensitive-audit-only semantics, a 20-event L1 window, the selected LightGBM run `l2_multilabel_20260711_043347`, exactly six L2 targets, and policy/lineage identity. Candidate C is excluded from production mapping.

## 10. Demo Visualizations and Known Limitations

- L1 reconstruction loss, threshold stability, score distribution, L2 AP/AUROC/F1/threshold charts, run-health trend, and feature-health trend use V3 visualization data until a validated runtime/artifact series is published.
- Prediction rate uses the existing endpoint when it returns a real per-target series; otherwise it uses a `SIMULATED TREND` V3 fallback.
- Demo metrics are presentation-only and do not contribute to system status, inference, policy, SQL, or other pages.

HTTP 200 alone cannot produce green.

## 11. V3.1 Corrections

- The V3 JSON contract is now `schemaVersion: 3.1.0`. It remains backward compatible with the V3 mapper shape.
- V3.1 now records source metadata directly on KPI value/trend definitions, funnel stages, decision-flow nodes, contract rows, chart series, and runtime-footer references. This metadata is presentation-only and never writes to SQL or enters inference.
- KPI values now retain separate `valueSource`, `trendSource`, and `scopeLabel`. Source badges were deliberately removed from the seven compact KPI cards to prevent title/subtitle collisions; provenance remains in the DTO and code path for later real AI/runtime series.
- `ratio_0_1` metrics are centrally formatted as percentages. For example `0.67` renders as `67.0%`, while `probability_0_1` remains a three-decimal probability. The six production thresholds render as `0.130`, `0.072`, `0.071`, `0.082`, `0.109`, and `0.072`.
- Train, Valid, and Test tabs no longer silently fall back to another split. An unavailable split renders `Not available`.
- Every V3 reference chart now carries `seriesConfig` (`key`, label, unit, axis, source). The renderer uses it for legends and tooltips rather than raw camel-case keys. Threshold stability uses a local Y-domain, run health uses separate bar/seconds axes, and feature health uses availability/alignment versus missing-rate axes.
- The duplicate prediction-rate chart was removed from hybrid chart output. `L2PredictionTrendPanel` is the only canonical prediction-rate panel.
- Funnel stages are merged one by one: live SQL wins, and only an unavailable stage receives the clearly demo-scoped historical reference value.
- Decision flow, feature-health rows, trace, runtime strip, and latest bounded inference use per-item provenance. The bounded audit is now one compact card instead of treating the source badge as an empty grid cell. The full immutable Policy v2 identifier is retained in the node tooltip while the compact flow node displays `Policy v2`.
- System Evaluation Status lives permanently in the sidebar plant/status card. App loads the read-only monitor DTO for this status on every route, so mock is red and API readiness can become green/yellow without first opening AI Model Monitor. It only becomes green after actual readiness, environment, artifact, and required responses pass.

## 12. Verification

Executed from `frontEnd/weldcom-ai-operations-dashboard`:

- `npm run typecheck` - pass
- `npm run lint` - pass
- `npm test -- --run` - pass, 19 tests
- `npm run build:api` - pass
- `npm run build:mock` - pass

The build emits the existing chunk-size advisory only; it is not a parity failure.

## 13. Files Changed

- `src/types/aiModelMonitor.ts`
- `src/types/runtimeApi.ts`
- `src/providers/types.ts`
- `src/providers/apiDataProvider.ts`
- `src/providers/mockDataProvider.ts`
- `src/services/runtimeApi.ts`
- `src/data/mockAIModelMonitor.ts`
- `src/data/modelMonitorMetadata.json`
- `src/data/ai-model-monitor-hybrid-demo-v3.json`
- `src/mappers/hybridModelMonitorMapper.ts`
- `src/components/aiModelMonitor/ModelReferenceCharts.tsx`
- `src/components/aiModelMonitor/SourceBadge.tsx`
- `src/mappers/modelMonitorMapper.ts`
- `src/mappers/modelMonitorMapper.test.ts`
- `src/components/aiModelMonitor/AIModelMonitorPresentation.tsx`
- `src/components/aiModelMonitor/SystemEvaluationStatus.tsx`
- `src/components/aiModelMonitor/systemEvaluationState.ts`
- `src/components/aiModelMonitor/L2PredictionTrendPanel.tsx`
- `src/components/aiModelMonitor/ScoringFunnelPanel.tsx`
- `src/components/aiModelMonitor/DataContractPanel.tsx`
- `src/components/aiModelMonitor/DecisionTracePanel.tsx`
- `src/components/aiModelMonitor/LatestInferenceAuditPanel.tsx`
- `src/components/aiModelMonitor/RuntimeStatusStrip.tsx`
- `src/styles/ai-model-monitor.css`
- `src/App.tsx`
- `backend/app/services/api_service.py`

## 14. Visual Acceptance and Limitations

No automated browser screenshot was available in this execution, so the required 1366x768, 1600x900, and 1920x1080 visual captures still need a final browser pass. Build and component-level regression checks pass. Demo reference remains intentionally limited to AI Model Monitor; no Dashboard, Machine Detail, Risk, Quality, Energy, or Maintenance API provider imports the V3 JSON.

## Final Decision

`AI_MODEL_MONITOR_HYBRID_V3_1_READY` is pending the required browser visual captures at 1366x768, 1600x900, and 1920x1080. Typecheck, lint, unit tests, and both API/mock builds pass.
