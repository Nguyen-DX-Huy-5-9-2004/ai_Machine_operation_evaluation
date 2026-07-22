export type SplitKey = 'train' | 'valid' | 'test';
export type HealthTone = 'healthy' | 'info' | 'warning' | 'danger' | 'neutral';
export type ContractStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NOT_CHECKED';
export type TrendDirection = 'up' | 'down' | 'flat';
export type MonitorSourceType = 'SQL_RUNTIME' | 'BOUNDED_AUDIT' | 'VALIDATED_ARTIFACT' | 'DEMO_REFERENCE' | 'SIMULATED_VISUALIZATION' | 'MIXED' | 'NOT_AVAILABLE';

export interface MonitorProvenance {
  sourceType: MonitorSourceType;
  isDemo: boolean;
  isValidated: boolean;
  sourceLabel: string;
  sourceArtifact: string | null;
  tooltip: string;
}

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
  provenance?: MonitorProvenance;
  valueSource?: MonitorProvenance;
  trendSource?: MonitorProvenance;
  scopeLabel?: string;
}

export interface PerformanceMetricSet {
  normalFpr: number | null;
  knownFaultRecall: number | null;
  precision: number | null;
  f1: number | null;
  accuracy: number | null;
  auc?: number | null;
  support?: number | null;
  positiveRate?: number | null;
  averagePrecision?: number | null;
  recall?: number | null;
}

export interface L1CandidatePerformance {
  id: string;
  candidate: string;
  note?: string;
  production?: boolean;
  provenance?: MonitorProvenance;
  metricSources?: Partial<Record<keyof PerformanceMetricSet, MonitorProvenance>>;
  train?: PerformanceMetricSet;
  valid: PerformanceMetricSet;
  test: PerformanceMetricSet;
}

export interface L2TargetPerformance {
  id: string;
  target: string;
  tone: HealthTone;
  profile?: string;
  threshold?: number | null;
  sourceArtifact?: string;
  sourceHash?: string;
  provenance?: MonitorProvenance;
  metricSources?: Partial<Record<keyof PerformanceMetricSet, MonitorProvenance>>;
  train?: PerformanceMetricSet;
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
  status: 'PASS' | 'WARNING' | 'FAIL' | 'DEMO' | 'REFERENCE';
  tone: HealthTone;
  tooltip: string;
  provenance?: MonitorProvenance;
  scope?: string;
}

export interface ScoringFunnelStage {
  id: string;
  label: string;
  events: number | null;
  conversion: number | null;
  tone: HealthTone;
  provenance?: MonitorProvenance;
}

export interface ContractCheck {
  id: string;
  check: string;
  status: ContractStatus;
  value: string;
  trend: number[];
  tooltip: string;
  provenance?: MonitorProvenance;
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
  provenance?: MonitorProvenance;
}

export interface MonitorChartSeriesConfig {
  key: string;
  label: string;
  unit: string;
  axis: 'left' | 'right';
  sourceType: string;
}

export interface MonitorChart {
  title: string;
  series: Array<Record<string, string | number>>;
  provenance: MonitorProvenance;
  seriesConfig?: MonitorChartSeriesConfig[];
  scope?: string;
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
  notScoredEvents: number | null;
  contractChecks: ContractCheck[];
  exampleTrace: DecisionTrace;
  runtimeStrip: RuntimeStripItem[];
  latestInferenceAudit?: {
    availability: boolean;
    result?: string;
    inputRows?: number | null;
    scoredRows?: number | null;
    skippedRows?: number | null;
    failedRows?: number | null;
    generatedAt?: string | null;
    sqlWrites?: number | null;
    candidateAUsed?: boolean | null;
    candidateCUsed?: boolean | null;
  };
  systemStatus?: {
    mode: 'mock' | 'api';
    runtimeStatus?: string;
    runtimeEnvironmentStatus?: string;
    artifactIntegrity?: string;
    requiredDataLoaded: boolean;
  };
  panelSources?: Record<string, MonitorProvenance>;
  charts?: Record<string, MonitorChart>;
}

export type ModelMonitorDto = AIModelMonitorPayload;
