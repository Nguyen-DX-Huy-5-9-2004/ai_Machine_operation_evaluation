import type { ApiEnvelope, Explanation, MachineSummary, ModelMonitor, PageData } from '../types/runtimeApi';
import type { DatasetMode } from '../types/dashboard';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
export const DATA_MODE = (import.meta.env.VITE_DATA_MODE ?? 'api') as 'api' | 'mock';

export interface RuntimeFilters {
  datasetMode: DatasetMode;
  from?: string;
  to?: string;
  machineIds?: number[];
  locationIds?: number[];
  machineGroupIds?: number[];
  operationalActionLevels?: string[];
  qualityActionLevels?: string[];
}

export function queryString(filters: RuntimeFilters, extra: Record<string, string | number | undefined> = {}): string {
  const query = new URLSearchParams({ datasetMode: filters.datasetMode });
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  const lists: Array<[string, Array<string | number> | undefined]> = [
    ['machineIds', filters.machineIds], ['locationIds', filters.locationIds], ['machineGroupIds', filters.machineGroupIds],
    ['operationalActionLevels', filters.operationalActionLevels], ['qualityActionLevels', filters.qualityActionLevels],
  ];
  lists.forEach(([key, values]) => values?.forEach((value) => query.append(key, String(value))));
  Object.entries(extra).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)); });
  return query.toString();
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string; requestId?: string } } | null;
    const request = body?.error?.requestId ? ` (request ${body.error.requestId})` : '';
    throw new Error(`${body?.error?.message ?? `API request failed with HTTP ${response.status}`}${request}`);
  }
  const payload = await response.json() as ApiEnvelope<T>;
  if (!payload.meta || payload.meta.isMock || payload.meta.dataMode !== 'sql') {
    throw new Error(`API source contract rejected dataMode=${payload.meta?.dataMode ?? 'missing'} isMock=${String(payload.meta?.isMock)}`);
  }
  return payload;
}

export function riskForDisplay(value: unknown): number {
  const parsed = Number(value ?? 0);
  return parsed <= 1 ? parsed * 100 : parsed;
}

export function loadMachines(filters: RuntimeFilters, page = 1, signal?: AbortSignal) {
  return apiGet<PageData<MachineSummary>>(`/machines?${queryString(filters, { page, pageSize: 50 })}`, signal);
}

export function loadAlerts(filters: RuntimeFilters, page = 1, pageSize = 50, signal?: AbortSignal) {
  return apiGet<PageData<Record<string, unknown>>>(`/dashboard/alerts?${queryString(filters, { page, pageSize })}`, signal);
}

export async function loadMachineDetail(machineId: number, filters: RuntimeFilters, signal?: AbortSignal) {
  const query = queryString(filters);
  const [summary, timeline, l1, l2, energy, analysis, performance, events] = await Promise.all([
    apiGet<Record<string, unknown>>(`/machines/${machineId}/summary?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/machines/${machineId}/timeline?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/machines/${machineId}/l1-series?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/machines/${machineId}/l2-series?${query}`, signal),
    apiGet<Record<string, unknown>>(`/machines/${machineId}/energy?${query}`, signal),
    apiGet<Record<string, unknown>>(`/machines/${machineId}/ai-analysis?${query}`, signal),
    apiGet<Record<string, unknown>>(`/machines/${machineId}/performance?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/machines/${machineId}/events?${query}`, signal),
  ]);
  return { meta: summary.meta, summary: summary.data, timeline: timeline.data, l1: l1.data, l2: l2.data, energy: energy.data, analysis: analysis.data, performance: performance.data, events: events.data };
}

export function loadExplanation(eventUid: string, signal?: AbortSignal) {
  return apiGet<Explanation>(`/events/${encodeURIComponent(eventUid)}/explanation`, signal);
}

export async function loadModelMonitor(filters: RuntimeFilters, signal?: AbortSignal): Promise<ApiEnvelope<ModelMonitor>> {
  const query = queryString(filters);
  const [overview, candidates, targets, funnel, contract] = await Promise.all([
    apiGet<ModelMonitor>(`/model-monitor/overview?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/l1-candidates?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/model-monitor/l2-targets?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/model-monitor/scoring-funnel?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/data-contract-health?${query}`, signal),
  ]);
  return { ...overview, data: { ...overview.data, l1Candidates: candidates.data, l2Targets: targets.data, scoringFunnel: funnel.data, dataContract: contract.data } };
}
