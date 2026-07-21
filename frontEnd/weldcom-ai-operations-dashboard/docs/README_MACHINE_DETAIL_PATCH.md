# Weldcom Machine Detail UI Patch v2

Patch v2 extends the Machine Detail screen with all tab contents:

- Timeline
- AI Analysis
- Performance
- Energy
- Events
- Maintenance

It keeps the previous futuristic Weldcom dark/neon design and does not rebuild the global sidebar/menu. The page is still mock-first but API-ready through `machineDetailService.ts`.

## Copy into project

Copy these folders/files into:

```text
OBAD/frontEnd/weldcom-ai-operations-dashboard/
```

Important files:

```text
src/pages/MachineDetail.tsx
src/types/machineDetail.ts
src/data/mockMachineDetail.ts
src/services/machineDetailService.ts
src/styles/machine-detail.css
src/components/machineDetail/*.tsx
```

## New tab behavior

`MachineDetail.tsx` now renders content based on the active tab:

- `TimelineTab`: timeline + L1/L2/KWh charts + energy summary + events/evidence.
- `AiAnalysisTab`: AI decision stack, risk contribution, L1/L2 charts, explainability panel.
- `PerformanceTab`: operating mix, duration/gap health, throughput vs KWh rate.
- `EnergyTab`: event KWh delta, loaded status vs KWh evidence, energy rule checks.
- `EventsTab`: event explorer filters, status distribution, full recent events table.
- `MaintenanceTab`: maintenance/repair risk trend, maintenance signals, inspection plan.

## L1 anomaly chart

The L1 chart keeps:

- L1 score line/area.
- Red dashed anomaly threshold.
- Yellow dashed warning threshold.
- Mini brush under the chart.

## Data readiness

Mock data includes fields that should later map to backend/API/SQL outputs:

```text
behavior_anomaly_score
risk_fault_30min
risk_maintenance_30_events
risk_repair_30_events
kwh_delta_model_value
energy_inconsistency_flag
kwh_missing_flag
quality_judgment
operational_action_level
final_reason_v2
```

API mode is controlled by `.env`:

```env
VITE_DATA_MODE=mock
VITE_API_BASE_URL=http://localhost:8000/api
```

Expected future endpoint:

```http
GET /api/machines/{machineId}/detail?range=last_24h
```

## Run

```powershell
npm install
npm run dev
```
