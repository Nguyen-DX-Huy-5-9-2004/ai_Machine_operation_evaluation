import type { ApiEnvelope, Explanation, MachineSummary, ModelMonitor, PageData } from '../types/runtimeApi';
import type { RuntimeFilters } from '../types/runtimeFilters';
import { runtimeConfig } from '../config/runtimeConfig';

const API_BASE = runtimeConfig.apiBaseUrl;
export const DATA_MODE = runtimeConfig.dataMode;

export type { RuntimeFilters } from '../types/runtimeFilters';

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
  if (!runtimeConfig.isApiMode) throw new Error('API client cannot execute in mock mode.');
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

export { riskForDisplay } from '../types/runtimeFilters';

export function loadMachines(filters: RuntimeFilters, page = 1, signal?: AbortSignal) {
  return apiGet<PageData<MachineSummary>>(`/machines?${queryString(filters, { page, pageSize: 50 })}`, signal);
}

export function loadAlerts(filters: RuntimeFilters, page = 1, pageSize = 50, signal?: AbortSignal) {
  return apiGet<PageData<Record<string, unknown>>>(`/dashboard/alerts?${queryString(filters, { page, pageSize })}`, signal);
}

type AvailableRange = { from?: string; to?: string };
const availableRangeCache = new Map<string, Promise<AvailableRange>>();

function loadAvailableRange(datasetMode: RuntimeFilters['datasetMode']): Promise<AvailableRange> {
  const cached = availableRangeCache.get(datasetMode);
  if (cached) return cached;
  const request = apiGet<{ availableDateRange?: AvailableRange }>(`/meta/filters?${queryString({ datasetMode })}`)
    .then((response) => response.data.availableDateRange ?? {})
    .catch((reason) => { availableRangeCache.delete(datasetMode); throw reason; });
  availableRangeCache.set(datasetMode, request);
  return request;
}

function machineDetailRange(available: AvailableRange, filters: RuntimeFilters): RuntimeFilters {
  if (filters.from || filters.to || filters.rangePreset === 'Full Historical Range' || !available.to) return filters;
  const hours: Record<Exclude<NonNullable<RuntimeFilters['rangePreset']>, 'Full Historical Range'>, number> = {
    'Last 24 Hours': 24,
    'Last 7 Days': 24 * 7,
    'Last 30 Days': 24 * 30,
    'Last 90 Days': 24 * 90,
  };
  const preset = filters.rangePreset ?? 'Last 24 Hours';
  const end = new Date(available.to);
  const start = new Date(end.getTime() - hours[preset] * 60 * 60 * 1000);
  return { ...filters, from: start.toISOString(), to: end.toISOString() };
}

export async function loadMachineDetail(machineId: number, filters: RuntimeFilters, signal?: AbortSignal) {
  // Machine Detail is always bounded unless an explicit date range is supplied.
  // The source-aware historical view spans millions of rows; an unbounded detail
  // request is both slow and not useful to an operator investigating one machine.
  // The available historical range changes rarely. Cache it independently of a
  // detail request so switching machines/ranges does not start with an extra
  // network round-trip or discard an in-flight SQL query.
  const available = await loadAvailableRange(filters.datasetMode);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const detailFilters = machineDetailRange(available, filters);
  const query = queryString(detailFilters);
  const timeline = await apiGet<Array<Record<string, unknown>>>(`/machines/${machineId}/timeline?${query}&limit=500`, signal);
  // The event timeline establishes that the selected machine/range exists.
  // Other panels are independently degradable: an unavailable optional panel
  // shows its existing Not available state instead of blanking the workspace.
  const optional = async <T>(path: string, fallback: T) => {
    try { return await apiGet<T>(path, signal); }
    catch (reason) {
      if (signal?.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) throw reason;
      return { data: fallback, meta: timeline.meta };
    }
  };
  const [l1, l2, energy, performance, events, maintenance] = await Promise.all([
    optional<Array<Record<string, unknown>>>(`/machines/${machineId}/l1-series?${query}&limit=500`, []),
    optional<Array<Record<string, unknown>>>(`/machines/${machineId}/l2-series?${query}&limit=500`, []),
    optional<Record<string, unknown>>(`/machines/${machineId}/energy?${query}`, { series: [] }),
    optional<Record<string, unknown>>(`/machines/${machineId}/performance?${query}`, {}),
    optional<Array<Record<string, unknown>>>(`/machines/${machineId}/events?${query}`, []),
    optional<Array<Record<string, unknown>>>(`/machines/${machineId}/maintenance-risk?${query}`, []),
  ]);
  // Summary is a presentation concern.  Compose it from the same latest
  // event-scoped sources that power the tab content, instead of making the
  // page depend on a separate wide SQL query.  Each response is ordered newest
  // first by the backend, and no fixture data is introduced here.
  const summary = {
    ...(timeline.data[0] ?? {}),
    ...(events.data[0] ?? {}),
    ...(l1.data[0] ?? {}),
    ...(l2.data[0] ?? {}),
  };
  return { meta: timeline.meta, summary, timeline: timeline.data, l1: l1.data, l2: l2.data, energy: energy.data, analysis: {}, performance: performance.data, events: events.data, maintenance: maintenance.data, filters: detailFilters };
}
export type RuntimeMachineDetail = Awaited<ReturnType<typeof loadMachineDetail>>;

export function loadExplanation(eventUid: string, signal?: AbortSignal) {
  return apiGet<Explanation>(`/events/${encodeURIComponent(eventUid)}/explanation`, signal);
}

export async function loadModelMonitor(filters: RuntimeFilters, signal?: AbortSignal): Promise<ApiEnvelope<ModelMonitor>> {
  const query = queryString(filters);
  const [overview, candidates, targets, funnel, contract, performance, modelMetadata, latestInferenceAudit, predictionRate] = await Promise.all([
    apiGet<ModelMonitor>(`/model-monitor/overview?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/l1-candidates?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/model-monitor/l2-targets?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/model-monitor/scoring-funnel?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/data-contract-health?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/performance-reference?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/model-metadata?${query}`, signal),
    apiGet<Record<string, unknown>>(`/model-monitor/latest-inference-audit?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/model-monitor/positive-rate-trend?${query}&grain=day`, signal),
  ]);
  return { ...overview, data: { ...overview.data, l1Candidates: candidates.data, l2Targets: targets.data, scoringFunnel: funnel.data, dataContract: contract.data, performanceReference: performance.data, modelMetadata: modelMetadata.data, latestInferenceAudit: latestInferenceAudit.data, predictionRate: predictionRate.data } };
}

export async function loadRiskAnalytics(filters: RuntimeFilters, signal?: AbortSignal) {
  const query = queryString(filters);
  const [distribution, trend, machines] = await Promise.all([
    apiGet<Array<{ level: string; count: number }>>(`/dashboard/risk-distribution?${query}`, signal),
    apiGet<Array<{ timestamp: string; avgRisk: number | null; maxRisk: number | null }>>(`/dashboard/risk-trend?${query}&grain=day`, signal),
    apiGet<Array<Record<string, unknown>>>(`/dashboard/top-machines?${query}&sortBy=currentRisk&limit=20`, signal),
  ]);
  return { actionDistribution: distribution.data, riskTrend: trend.data, riskWindows: machines.data.map((row) => ({ machine_id: String(row.displayCode ?? row.machineId), risk_fault_10_events: null, risk_fault_30_events: null, risk_fault_30min: row.latestRisk == null ? null : Number(row.latestRisk), risk_fault_60min: null, risk_maintenance_30_events: row.maintenanceRisk == null ? null : Number(row.maintenanceRisk), risk_repair_30_events: row.repairRisk == null ? null : Number(row.repairRisk) })), modelSignals: [] };
}

export async function loadDataQuality(filters: RuntimeFilters, signal?: AbortSignal) {
  const query = queryString(filters);
  const [overview, trend] = await Promise.all([
    apiGet<Record<string, number | string | boolean | null>>(`/dashboard/data-quality-overview?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/dashboard/quality-trend?${query}&grain=day`, signal),
  ]);
  return { overview: overview.data, distributions: [], issueTrend: trend.data.map((row) => ({ label: String(row.timestamp ?? ''), time_quality_issue_flag: Number(row.timeIssueCount ?? 0), kwh_quality_issue_flag: Number(row.kwhIssueCount ?? 0), energy_inconsistency_flag: Number(row.energyInconsistencyCount ?? 0) })), topMachines: [] };
}

export async function loadEnergyConsistency(filters: RuntimeFilters, signal?: AbortSignal) {
  const machinePage = await loadMachines(filters, 1, signal);
  const selected = machinePage.data.items.slice(0, 5);
  const energies = await Promise.all(selected.map((machine) => apiGet<Record<string, unknown>>(`/machines/${machine.machineId}/energy?${queryString(filters)}`, signal)));
  return { note: 'Machine event KWh only. Cabinet/location KWh is not assigned without a validated bridge.', issues: energies.map((response, index) => ({ machine_id: selected[index].displayCode, location_name: selected[index].locationId == null ? 'Not available' : `Location ${selected[index].locationId}`, is_loaded: false, kwh_delta_model_value: response.data.totalKwhDelta == null ? null : Number(response.data.totalKwhDelta), kwh_rate_per_hour: response.data.averageKwhRate == null ? null : Number(response.data.averageKwhRate), loaded_zero_kwh_flag: Number(response.data.loadedZeroKwhCount ?? 0) > 0, loaded_without_kwh_flag: Number(response.data.loadedWithoutKwhCount ?? 0) > 0, kwh_negative_delta_flag: Number(response.data.negativeCount ?? 0) > 0, energy_inconsistency_flag: Number(response.data.energyInconsistencyCount ?? 0) > 0 })) };
}
