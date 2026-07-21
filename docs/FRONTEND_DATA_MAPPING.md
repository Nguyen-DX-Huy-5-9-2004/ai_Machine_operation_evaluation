# Frontend Data Mapping

The maintained application is `frontEnd/weldcom-ai-operations-dashboard`. `VITE_DATA_MODE=api` is the default. API errors render an error panel and never fall back to mock data. `VITE_DATA_MODE=mock` is an explicit UI-development fixture and shows `MOCK DATA`.

| Screen | API |
|---|---|
| Overview KPI/charts | `/dashboard/overview`, risk distribution/trend, top machines, L1/L2 and quality endpoints |
| Alerts | `/dashboard/alerts` |
| Machines | `/machines` |
| Machine timeline | `/machines/{id}/timeline`, `l1-series`, `l2-series`, `kwh-series` |
| AI analysis | `/machines/{id}/ai-analysis`, `/events/{eventUid}/explanation` |
| Performance/Energy/Events | machine performance, energy and events endpoints |
| Model monitor | `/model-monitor/*`, `/system/runtime-status` |

Global dataset/date filters are shared by the shell. Historical and current modes are separate; no frontend deduplication is performed. Risk/action values are displayed exactly as returned. React does not calculate features, thresholds, anomaly semantics or policy.

Unavailable metrics render `Unavailable`/`Not calculated`, not zero. Machine display falls back to `Machine <machine_id>`. Cabinet/global energy is never presented as machine-level evidence without a validated bridge.

