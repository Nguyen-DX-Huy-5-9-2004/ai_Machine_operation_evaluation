import type { DashboardPayload } from '../types/dashboard';
import type { AIModelMonitorPayload, ModelMonitorDto } from '../types/aiModelMonitor';
import type { MachineDetailResponse } from '../types/machineDetail';
import type { ApiEnvelope, Explanation, MachineSummary, ModelMonitor, PageData } from '../types/runtimeApi';
import type { RuntimeFilters } from '../types/runtimeFilters';
import type { DataQualityCenterOverview, EnergyConsistencyOverview, RiskFaultAnalyticsOverview } from '../types/operationsPages';

export interface DataProvider {
  readonly kind: 'api' | 'mock';
  dashboard(filters: RuntimeFilters, signal?: AbortSignal): Promise<DashboardPayload>;
  machines(filters: RuntimeFilters, page?: number, signal?: AbortSignal): Promise<ApiEnvelope<PageData<MachineSummary>>>;
  alerts(filters: RuntimeFilters, page?: number, pageSize?: number, signal?: AbortSignal): Promise<ApiEnvelope<PageData<Record<string, unknown>>>>;
  machineDetail(machineId: number, filters: RuntimeFilters, signal?: AbortSignal): Promise<Record<string, unknown>>;
  machineDetailDto(machine: MachineSummary, filters: RuntimeFilters, signal?: AbortSignal): Promise<MachineDetailResponse>;
  explanation(eventUid: string, signal?: AbortSignal): Promise<ApiEnvelope<Explanation>>;
  legacyMachineDetail(machineId?: string): Promise<MachineDetailResponse>;
  modelMonitor(filters: RuntimeFilters, signal?: AbortSignal): Promise<ApiEnvelope<ModelMonitor>>;
  modelMonitorDto(filters: RuntimeFilters, signal?: AbortSignal): Promise<ModelMonitorDto>;
  riskAnalytics(filters: RuntimeFilters, signal?: AbortSignal): Promise<RiskFaultAnalyticsOverview>;
  dataQuality(filters: RuntimeFilters, signal?: AbortSignal): Promise<DataQualityCenterOverview>;
  energyConsistency(filters: RuntimeFilters, signal?: AbortSignal): Promise<EnergyConsistencyOverview>;
  legacyModelMonitor(): Promise<AIModelMonitorPayload>;
}
