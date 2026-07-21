import type { DashboardPayload, DatasetMode, OperationalAlertRow, RiskLevel } from '../types/dashboard';
import { apiGet, DATA_MODE, queryString, riskForDisplay } from './runtimeApi';

const DEFAULT_DATASET_MODE = (import.meta.env.VITE_DEFAULT_DATASET_MODE ?? 'current') as DatasetMode;

export interface DashboardFilters {
  datasetMode?: DatasetMode;
  dateFrom?: string;
  dateTo?: string;
  machine?: string;
  location?: string;
  actionLevel?: string;
  granularity?: string;
}

function pct(value: unknown): number { return Math.round(riskForDisplay(value) * 10) / 10; }
function riskLevel(value: unknown): RiskLevel {
  const normalized = String(value ?? 'LOW').toUpperCase();
  return normalized === 'CRITICAL' ? 'Critical' : normalized === 'HIGH' ? 'High' : normalized === 'MEDIUM' ? 'Medium' : 'Low';
}
function alert(row: Record<string, unknown>): OperationalAlertRow {
  const fault = pct(row.faultRisk30min);
  const maintenance = pct(row.maintenanceRisk);
  const repair = pct(row.repairRisk);
  const action = riskLevel(row.operationalActionLevel);
  return {
    id: String(row.eventUid),
    machineId: String(row.machineId),
    machineName: String(row.displayCode ?? `Machine ${row.machineId}`),
    locationName: row.locationId == null ? 'Unassigned' : `Location ${row.locationId}`,
    operationalActionLevel: action,
    qualityActionLevel: riskLevel(row.qualityActionLevel === 'QUALITY_OK' ? 'LOW' : 'MEDIUM'),
    operationalJudgment: String(row.operationalJudgment ?? action),
    riskFault30Min: fault,
    riskFault60Min: 0,
    riskMaintenance30Events: maintenance,
    riskRepair30Events: repair,
    qualityJudgment: row.qualityJudgment === 'PASS' ? 'Pass' : row.qualityActionLevel === 'QUALITY_OK' ? 'Pass' : 'Review',
    l1Anomaly: row.l1Score == null ? 'No Data' : row.isBehaviorAnomaly === true ? 'Anomaly' : 'Normal',
    finalReasonV2: String(row.finalReason ?? 'No policy reason available'),
    eventStartTime: String(row.eventTime ?? ''),
    faultRiskSeries: [fault], maintenanceRiskSeries: [maintenance], repairRiskSeries: [repair],
    operationalOverallRiskScore: pct(row.operationalRisk), dataQualityIssueFlag: row.qualityActionLevel !== 'QUALITY_OK',
    qualityRiskScore: row.qualityActionLevel === 'QUALITY_OK' ? 0 : 100,
    behaviorAnomalyScore: pct(row.l1Score), isBehaviorAnomaly: row.isBehaviorAnomaly === true,
    isSensitiveDeviation: row.isSensitiveWarning === true, l1WindowAvailable: row.l1Score != null,
    operationalFaultConfidenceScore: fault,
  };
}

export async function getDashboardOverview(filters: DashboardFilters = {}, signal?: AbortSignal): Promise<DashboardPayload> {
  if (DATA_MODE !== 'api') throw new Error('Mock mode is fixture-only and is not part of the production dashboard bundle.');
  const runtimeFilters = {
    datasetMode: filters.datasetMode ?? DEFAULT_DATASET_MODE,
    from: filters.dateFrom,
    to: filters.dateTo,
    machineIds: filters.machine ? [Number(filters.machine)] : undefined,
    locationIds: filters.location ? [Number(filters.location)] : undefined,
    operationalActionLevels: filters.actionLevel ? [filters.actionLevel.toUpperCase()] : undefined,
  };
  const query = queryString(runtimeFilters);
  const [overview, distribution, trend, top, l1, l2, qualityTrend, quality, alerts] = await Promise.all([
    apiGet<{ kpis: Record<string, { value: number | null; definition: string }>; deltasAvailable: boolean }>(`/dashboard/overview?${query}`, signal),
    apiGet<Array<{ level: string; count: number }>>(`/dashboard/risk-distribution?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/dashboard/risk-trend?${query}&grain=${filters.granularity ?? 'day'}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/dashboard/top-machines?${query}&sortBy=currentRisk&limit=10`, signal),
    apiGet<Record<string, number>>(`/dashboard/l1-status?${query}`, signal),
    apiGet<Record<string, number | string>>(`/dashboard/l2-confidence?${query}`, signal),
    apiGet<Array<Record<string, unknown>>>(`/dashboard/quality-trend?${query}&grain=${filters.granularity ?? 'day'}`, signal),
    apiGet<Record<string, number | null>>(`/dashboard/data-quality-overview?${query}`, signal),
    apiGet<{ items: Array<Record<string, unknown>>; total: number }>(`/dashboard/alerts?${query}&page=1&pageSize=20`, signal),
  ]);
  const k = overview.data.kpis;
  const metric = (id: string, title: string, value: number | null | undefined, tone: DashboardPayload['kpis'][number]['tone'], subtitle: string) => ({
    id, title, value: value ?? 'Unavailable', subtitle, trend: 0, trendLabel: 'Comparison unavailable', tone, icon: id, series: [], sourceField: id,
  });
  const distributionTotal = distribution.data.reduce((sum, item) => sum + Number(item.count), 0);
  const eligible = Number(l1.data.eligibleCount ?? 0);
  const readyL1 = Math.max(0, eligible - Number(l1.data.unreadyCount ?? 0));
  const l2Ready = Number(l2.data.readyCount ?? 0);
  const qualityValue = (id: 'completeness' | 'timeliness' | 'consistency' | 'accuracy', label: string, value: unknown, sourceField: string) => ({ id, label, value: pct(value), spark: [], sourceField });
  return {
    meta: overview.meta,
    kpis: [
      metric('operationalRiskScore', 'Operational Risk Score', pct(k.operationalRiskScore?.value), 'purple', k.operationalRiskScore?.definition ?? ''),
      metric('totalActiveMachines', 'Active Machines', k.totalActiveMachines?.value, 'blue', k.totalActiveMachines?.definition ?? ''),
      metric('criticalHighAlertMachines', 'High / Critical Machines', k.criticalHighAlertMachines?.value, 'red', k.criticalHighAlertMachines?.definition ?? ''),
      metric('dataQualityIssueEvents', 'Data Quality Issues', k.dataQualityIssueEvents?.value, 'orange', k.dataQualityIssueEvents?.definition ?? ''),
      metric('maintenanceRiskMachines', 'Maintenance Risk Machines', k.maintenanceRiskMachines?.value, 'green', k.maintenanceRiskMachines?.definition ?? ''),
    ],
    riskDistribution: distribution.data.filter((item) => item.level !== 'UNREADY').map((item) => ({ level: riskLevel(item.level), value: Number(item.count), percent: distributionTotal ? Number(item.count) * 100 / distributionTotal : 0, color: '', sourceField: 'operational_action_level' })),
    riskTrend: trend.data.map((item) => ({ label: String(item.timestamp), date: String(item.timestamp), avgRiskScore: pct(item.avgRisk), criticalCount: Number(item.criticalEventCount ?? 0), highCount: Number(item.highEventCount ?? 0), topMachine: 'N/A' })),
    topMachines: top.data.map((item) => ({ machineId: String(item.machineId), machineName: String(item.displayCode ?? `Machine ${item.machineId}`), locationName: 'Current assignment', riskScore: pct(item.latestRisk), criticalCount: Number(item.criticalCount ?? 0), maintenanceRisk: pct(item.maintenanceRisk), dataQualityIssueScore: Number(item.qualityIssueCount ?? 0), operationalActionLevel: riskLevel(item.latestAction) })),
    l1Anomaly: { normal: Number(l1.data.normalCount ?? 0), anomaly: Number(l1.data.anomalyCount ?? 0), noData: Number(l1.data.unreadyCount ?? 0), total: eligible, spark: [], sourceFields: ['behavior_anomaly_score', 'is_behavior_anomaly', 'is_sensitive_deviation', 'l1_window_available'] },
    l2FaultConfidence: { high: 0, medium: 0, low: l2Ready, total: l2Ready, spark: [], sourceFields: ['operational_fault_confidence_score', 'risk_fault_30min', 'risk_fault_60min', 'policy_pred_*'] },
    qualityIssueTrend: qualityTrend.data.map((item) => ({ label: String(item.timestamp), checkData: Number(item.checkData ?? 0), checkEnergy: Number(item.checkEnergy ?? 0), checkDataAndEnergy: Number(item.checkDataAndEnergy ?? 0), qualityOk: Number(item.qualityOk ?? 0) })),
    dataQuality: [
      qualityValue('completeness', 'L1 window ready', quality.data.l1WindowReadyRate, 'l1WindowReadyRate'),
      qualityValue('timeliness', 'L2 ready', quality.data.l2ReadyRate, 'l2ReadyRate'),
      qualityValue('consistency', 'KWh available', 1 - Number(quality.data.missingKwhRate ?? 1), 'missingKwhRate'),
      qualityValue('accuracy', 'Time quality pass', 1 - Number(quality.data.timeQualityIssueRate ?? 1), 'timeQualityIssueRate'),
    ],
    operationalAlerts: alerts.data.items.map(alert),
    lastUpdated: overview.meta.generatedAt,
    plantStatus: { plantName: 'Weldcom Operations', status: 'Operational', activeMachines: Number(k.totalActiveMachines?.value ?? 0), totalMachines: Number(k.totalMachines?.value ?? 0), dataPipeline: readyL1 > 0 ? 'Healthy' : 'Delayed' },
  };
}
