# Weldcom AI Model Monitor — screen patch v1

This package implements the AI Model Monitor page only. It intentionally does **not** create or replace the left sidebar because the current Weldcom frontend already owns menu expansion/collapse.

## Implemented layout

The screen follows the latest agreed structure and removes only these three crowded blocks:

1. L1 Anomaly / Warning Rate Over Time chart
2. Operational Action Distribution donut
3. Model / Data Contract Alerts panel

Everything else is retained and rearranged with more space:

- header and functional filters
- seven runtime/scoring KPI cards
- L1 Dual TCN performance with VALID/TEST candidate comparison
- L2 LightGBM multi-label performance with VALID/TEST target comparison
- Normal FPR, known-fault recall, precision, F1, accuracy, AUROC and support
- L2 positive prediction trend by target
- AI 2-layer decision flow
- scoring funnel
- data contract & feature health
- example event decision trace
- runtime status strip

## Files to copy

Copy these folders into the existing project root:

```text
src/pages/AIModelMonitor.tsx
src/components/aiModelMonitor/
src/data/mockAIModelMonitor.ts
src/services/aiModelMonitorService.ts
src/styles/ai-model-monitor.css
src/types/aiModelMonitor.ts
docs/AI_MODEL_MONITOR_API_CONTRACT.md
```

## Route integration

React Router example:

```tsx
import AIModelMonitor from './pages/AIModelMonitor';

<Route path="/ai-model-monitor" element={<AIModelMonitor />} />
```

State-based page switch example:

```tsx
{activePage === 'ai-model-monitor' && <AIModelMonitor />}
```

Do not wrap the page in another sidebar. Render it inside the current main-content area.

## Data mode

Mock mode:

```env
VITE_DATA_MODE=mock
```

API mode:

```env
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:8000/api
```

Expected endpoint:

```text
GET /api/ai-model-monitor/overview
```

## Important metric note

`accuracy` can look high on imbalanced anomaly/fault data even when precision is weak. The UI therefore keeps Normal FPR, known-fault recall, precision and F1 visible beside accuracy. When real backend data is connected, use balanced accuracy if that is the metric produced by the evaluation pipeline and label it explicitly.
