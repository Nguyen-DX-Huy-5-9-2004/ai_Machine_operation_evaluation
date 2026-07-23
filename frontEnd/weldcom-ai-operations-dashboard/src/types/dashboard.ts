export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type RiskDistributionLevel = RiskLevel | 'No Data';
export type QualityJudgment = 'Fail' | 'Review' | 'Pass';
export type L1AnomalyState = 'Anomaly' | 'Normal' | 'No Data';
export type TopMachinesMode = 'currentRisk' | 'criticalCount' | 'maintenanceRisk' | 'dataQualityIssue';
export type DatasetMode = 'historical' | 'current';

export interface ApiMeta {
  dataMode: 'sql' | 'csv' | 'mock';
  datasetMode: DatasetMode | null;
  source: string;
  generatedAt: string;
  timezone: string;
  isMock: boolean;
  policyVersion: string | null;
  l2RunId: string | null;
  lineageHash: string | null;
  latestRuntimeRunId: string | null;
  dataFreshnessSeconds: number | null;
  requestId?: string | null;
}

export interface ApiEnvelope<T> { data: T; meta: ApiMeta; }
export interface PageData<T> { items: T[]; page: number; pageSize: number; total: number; }

export interface DashboardKpi {
  id: string;
  title: string;
  value: string | number;
  suffix?: string;
  subtitle: string;
  trend: number;
  trendLabel: string;
  tone: 'purple' | 'blue' | 'red' | 'orange' | 'green' | 'cyan' | 'yellow';
  icon: string;
  series: number[];
  sourceField: string;
  note?: string;
}

export interface RiskDistributionItem {
  level: RiskDistributionLevel;
  value: number;
  percent: number;
  color: string;
  sourceField: 'operational_action_level' | 'l1_window_available' | 'policy_ready_flag';
}

export interface RiskTrendPoint {
  label: string;
  date: string;
  avgRiskScore: number;
  criticalCount: number;
  highCount: number;
  topMachine: string;
}

export interface TopRiskMachine {
  machineId: string;
  machineName: string;
  locationName: string;
  riskScore: number;
  criticalCount: number;
  maintenanceRisk: number;
  dataQualityIssueScore: number;
  operationalActionLevel: RiskLevel;
}

export interface L1AnomalySummary {
  normal: number;
  anomaly: number;
  noData: number;
  total: number;
  spark: number[];
  sourceFields: Array<'behavior_anomaly_score' | 'is_behavior_anomaly' | 'is_sensitive_deviation' | 'l1_window_available'>;
}

export interface L2FaultConfidenceSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
  spark: number[];
  sourceFields: Array<'operational_fault_confidence_score' | 'risk_fault_30min' | 'risk_fault_60min' | 'policy_pred_*'>;
}

export interface QualityIssueTrendPoint {
  label: string;
  checkData: number;
  checkEnergy: number;
  checkDataAndEnergy: number;
  qualityOk: number;
}

export interface DataQualityMetric {
  id: 'completeness' | 'timeliness' | 'consistency' | 'accuracy';
  label: string;
  value: number;
  spark: number[];
  sourceField: string;
}

export interface OperationalAlertRow {
  id: string;
  machineId: string;
  machineName: string;
  locationName: string;
  operationalActionLevel: RiskLevel;
  qualityActionLevel: RiskLevel;
  operationalJudgment: string;
  riskFault30Min: number;
  riskFault60Min: number;
  riskMaintenance30Events: number;
  riskRepair30Events: number;
  qualityJudgment: QualityJudgment;
  l1Anomaly: L1AnomalyState;
  finalReasonV2: string;
  eventStartTime: string;
  faultRiskSeries: number[];
  maintenanceRiskSeries: number[];
  repairRiskSeries: number[];
  operationalOverallRiskScore: number;
  dataQualityIssueFlag: boolean;
  qualityRiskScore: number;
  behaviorAnomalyScore: number;
  isBehaviorAnomaly: boolean;
  isSensitiveDeviation: boolean;
  l1WindowAvailable: boolean;
  operationalFaultConfidenceScore: number;
}

export interface DashboardPayload {
  meta?: ApiMeta;
  kpis: DashboardKpi[];
  riskDistribution: RiskDistributionItem[];
  riskTrend: RiskTrendPoint[];
  topMachines: TopRiskMachine[];
  l1Anomaly: L1AnomalySummary;
  l2FaultConfidence: L2FaultConfidenceSummary;
  qualityIssueTrend: QualityIssueTrendPoint[];
  dataQuality: DataQualityMetric[];
  operationalAlerts: OperationalAlertRow[];
  lastUpdated: string;
  plantStatus: {
    plantName: string;
    status: 'Operational' | 'Degraded' | 'Offline';
    activeMachines: number;
    totalMachines: number;
    dataPipeline: 'Healthy' | 'Delayed' | 'Offline';
  };
}
