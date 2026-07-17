export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Normal';
export type QualityJudgment = 'Fail' | 'Review' | 'Pass';

export interface MetricCardData {
  id: string;
  title: string;
  value: string | number;
  suffix?: string;
  subtitle: string;
  trend: number;
  trendLabel: string;
  tone: 'purple' | 'blue' | 'red' | 'orange' | 'green' | 'cyan';
  series: number[];
  icon: string;
}

export interface RiskDistributionItem {
  name: string;
  value: number;
  percent: number;
  tone: string;
}

export interface TrendPoint {
  label: string;
  risk: number;
  critical?: number;
  high?: number;
  major?: number;
  minor?: number;
  checkData?: number;
  checkEnergy?: number;
  checkBoth?: number;
  qualityOk?: number;
}

export interface TopMachine {
  machineId: string;
  riskScore: number;
  highRiskEvents: number;
}

export interface L1StatusSummary {
  normal: number;
  anomaly: number;
  noData: number;
  total: number;
  spark: number[];
}

export interface L2ConfidenceSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
  spark: number[];
}

export interface DataQualityOverview {
  completeness: number;
  timeliness: number;
  consistency: number;
  accuracy: number;
}

export interface AlertRow {
  machineId: string;
  actionLevel: RiskLevel;
  operationalJudgment: string;
  faultRisk30Min: number;
  faultRiskSeries: number[];
  qualityJudgment: QualityJudgment;
  l1Anomaly: 'Anomaly' | 'Normal' | 'No Data';
  l2FaultConfidence: number;
  alertTime: string;
}

export interface DashboardPayload {
  metrics: MetricCardData[];
  riskDistribution: RiskDistributionItem[];
  operationalRiskTrend: TrendPoint[];
  qualityIssueTrend: TrendPoint[];
  topMachines: TopMachine[];
  l1Status: L1StatusSummary;
  l2Confidence: L2ConfidenceSummary;
  dataQuality: DataQualityOverview;
  liveAlerts: AlertRow[];
}
