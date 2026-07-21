import { mockAIModelMonitor } from '../data/mockAIModelMonitor';
import type { AIModelMonitorPayload, MonitorFilterState } from '../types/aiModelMonitor';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');
const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'mock';

export async function getAIModelMonitorOverview(
  filters?: Partial<MonitorFilterState>,
  signal?: AbortSignal,
): Promise<AIModelMonitorPayload> {
  if (DATA_MODE !== 'api') {
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    return mockAIModelMonitor;
  }

  const params = new URLSearchParams();
  if (filters?.dateRange) params.set('date_range', filters.dateRange);
  if (filters?.modelVersion) params.set('model_version', filters.modelVersion);
  if (filters?.runScope) params.set('run_scope', filters.runScope);

  const response = await fetch(`${API_BASE_URL}/ai-model-monitor/overview?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI Model Monitor API failed with HTTP ${response.status}`);
  }

  return (await response.json()) as AIModelMonitorPayload;
}
