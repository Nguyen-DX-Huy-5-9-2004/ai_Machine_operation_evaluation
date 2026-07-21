# Weldcom OBAD API Contract

## Boundary

FastAPI is a read-only dashboard API. It queries stored SQL results and static audit/manifests; it does not load PyTorch/LightGBM, calculate features, apply thresholds, run policy, or start the inference worker.

Base URL: `http://localhost:8000/api`. Every successful data response uses `{ "data": ..., "meta": ... }`. Error responses use `{ "error": { "code", "message", "details", "requestId" } }`.

`meta` includes `dataMode`, `datasetMode`, `source`, `generatedAt`, `timezone`, `isMock`, lineage/model identifiers and `requestId`.

## Source Contract

| datasetMode | event_source | event_uid |
|---|---|---|
| `historical` | `HISTORICAL_PRODUCTION_SCORE` | `HISTORICAL_PRODUCTION_SCORE:<event_id>` |
| `current` | `ONLINE_CURRENT_SQL` | `ONLINE_CURRENT_SQL:<event_id>` |

There is no default combined mode. The same numeric `event_id` in two sources is never treated as the same event.

## Filters

Shared query parameters: `datasetMode`, `from`, `to`, repeated `machineIds`, `locationIds`, `machineGroupIds`, `operationalActionLevels`, `qualityActionLevels`, and `statusIds`. Dates are ISO-8601. Maximum range defaults to 366 days. Page size is capped at 200.

## Endpoints

- `GET /health/live`, `GET /health/ready`
- `GET /meta/filters`
- `GET /dashboard/overview`
- `GET /dashboard/risk-distribution`
- `GET /dashboard/risk-trend?grain=hour|day|week`
- `GET /dashboard/top-machines?sortBy=...&limit=...`
- `GET /dashboard/l1-status`, `/l2-confidence`, `/quality-trend`, `/data-quality-overview`
- `GET /dashboard/alerts?page=1&pageSize=50&sort=eventTime:desc`
- `GET /machines` and `/machines/{machine_id}/{summary|timeline|l1-series|l2-series|kwh-series|ai-analysis|performance|energy|events|maintenance-risk}`
- `GET /events/{event_uid}/explanation`
- `GET /model-monitor/{overview|l1-candidates|l2-targets|positive-rate-trend|scoring-funnel|data-contract-health|runs}`
- `GET /model-monitor/decision-trace/{event_uid}`
- `GET /system/runtime-status`

The generated machine-readable schema is [openapi.json](openapi.json).

## KPI Definitions

- Active machines: distinct machines with an event in the selected source/range.
- Current operational risk: average `operational_overall_risk_score` of the latest policy-ready event per active machine, scale 0-1 in API storage.
- Operational alert: `HIGH` or `CRITICAL`; quality issues are separate.
- L1/L2 coverage denominators include eligible rows, while positive rates only use ready rows.
- Data quality aggregate percentages are unavailable unless a documented formula exists; the API returns explicit component rates instead.

Timestamps are returned as ISO-8601. SQL `DATETIME2` is treated as operational local time and the API declares `Asia/Ho_Chi_Minh`; no per-endpoint timezone guessing is permitted.

