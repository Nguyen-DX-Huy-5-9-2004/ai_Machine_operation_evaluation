export type SplitKey = 'valid' | 'test';
export type HealthTone = 'healthy' | 'info' | 'warning' | 'danger' | 'neutral';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface MonitorFilterState {
  dateRange: string;
  modelVersion: string;
  runScope: string;
}

export interface MonitorKpi {
  id: string;
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  delta?: string;
  deltaDirection?: TrendDirection;
  tone: HealthTone;
  icon: 'runtime' | 'coverage' | 'l1' | 'l2' | 'calibration' | 'drift' | 'runs';
  sparkline: number[];
  tooltip: string;
}

export interface PerformanceMetricSet {
  normalFpr: number;
  knownFaultRecall: number;
  precision: number;
  f1: number;
  accuracy: number;
  auc?: number;
  support?: number;
  positiveRate?: number;
}

export interface L1CandidatePerformance {
  id: string;
  candidate: string;
  note?: string;
  production?: boolean;
  valid: PerformanceMetricSet;
  test: PerformanceMetricSet;
}

export interface L2TargetPerformance {
  id: string;
  target: string;
  tone: HealthTone;
  valid: PerformanceMetricSet;
  test: PerformanceMetricSet;
}

export interface L2TrendPoint {
  timestamp: string;
  fault30m: number;
  fault60m: number;
  maintenance30e: number;
  repair30e: number;
}

export interface DecisionFlowStage {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  value: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  tone: HealthTone;
  tooltip: string;
}

export interface ScoringFunnelStage {
  id: string;
  label: string;
  events: number;
  conversion: number;
  tone: HealthTone;
}

export interface ContractCheck {
  id: string;
  check: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  value: string;
  trend: number[];
  tooltip: string;
}

export interface DecisionTrace {
  eventId: string;
  machineId: string;
  eventTime: string;
  inputEvidence: Array<{ label: string; value: string; tone?: HealthTone }>;
  l1: Array<{ label: string; value: string; tone?: HealthTone }>;
  l2: Array<{ label: string; value: string; tone?: HealthTone }>;
  policy: Array<{ label: string; value: string; tone?: HealthTone }>;
  finalReason: string;
}

export interface RuntimeStripItem {
  id: string;
  label: string;
  value: string;
  tone: HealthTone;
  icon: 'serving' | 'pipeline' | 'database' | 'parity' | 'freshness' | 'run' | 'retrain';
  tooltip: string;
}

export interface AIModelMonitorPayload {
  generatedAt: string;
  mode: 'mock' | 'api';
  filters: {
    dateRanges: string[];
    modelVersions: string[];
    runScopes: string[];
  };
  kpis: MonitorKpi[];
  l1Candidates: L1CandidatePerformance[];
  l2Targets: L2TargetPerformance[];
  l2Trend: L2TrendPoint[];
  decisionFlow: DecisionFlowStage[];
  scoringFunnel: ScoringFunnelStage[];
  notScoredEvents: number;
  contractChecks: ContractCheck[];
  exampleTrace: DecisionTrace;
  runtimeStrip: RuntimeStripItem[];
}
