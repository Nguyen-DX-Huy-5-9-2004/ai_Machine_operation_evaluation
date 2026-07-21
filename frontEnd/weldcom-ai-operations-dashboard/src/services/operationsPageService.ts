const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const DATA_MODE = import.meta.env.VITE_DATA_MODE ?? 'api';

async function loadApi<T>(path: string): Promise<T> {
  if (DATA_MODE !== 'api') throw new Error('Operations pages require VITE_DATA_MODE=api; fixture data is not available in the runtime bundle.');
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

export function getDataQualityCenter() {
  return loadApi('/data-quality/overview');
}

export function getRiskFaultAnalytics() {
  return loadApi('/risk-analytics/overview');
}

export function getEnergyConsistency() {
  return loadApi('/energy-consistency/overview');
}

export function getAiModelMonitor() {
  return loadApi('/ai-model-monitor/overview');
}
