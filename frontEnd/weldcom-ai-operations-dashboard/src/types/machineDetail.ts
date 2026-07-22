export type ActionLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
export type QualityLevel = 'PASS' | 'REVIEW' | 'FAIL' | 'NO_DATA' | 'MODERATE';
export type MachineStatusType = 'ON_LOADED' | 'ON_NO_LOAD' | 'OFF' | 'FAULT' | 'MAINTENANCE' | 'DATA_ISSUE';
export type KwhSource = 'RAW' | 'IMPUTED' | 'MISSING' | 'MIXED_RAW_FILL';

export interface MachineIdentity {
  machineId: string;
  machineName: string;
  locationName: string;
  machineGroup: string;
  currentStatus: string;
  isActive: boolean;
  isRunning: boolean;
  lastUpdated: string;
}

export interface MachineKpi {
  key: string;
  label: string;
  value: string | number;
  suffix?: string;
  subLabel?: string;
  level?: ActionLevel | QualityLevel | 'INFO' | 'WARNING';
  trend?: number[];
  sourceField?: string;
}

export interface TimelineSegment {
  id: string;
  start: string;
  end: string;
  status: MachineStatusType;
  label: string;
  durationMin: number;
  riskScore?: number;
  flags?: string[];
}

export interface TimelineMarker {
  id: string;
  time: string;
  type: 'fault' | 'energy' | 'quality' | 'maintenance' | 'gap';
  label: string;
  severity: ActionLevel;
}

export interface L1Point {
  time: string;
  score: number;
  anomalyThreshold: number;
  warningThreshold: number;
  eventId?: string;
  status?: string;
}

export interface RiskPoint {
  time: string;
  faultRisk: number;
  maintenanceRisk: number;
  repairRisk: number;
}

export interface KwhPoint {
  time: string;
  kwhDelta: number;
  expectedKwh?: number;
  actualKwh?: number;
  loaded?: number;
  qualityScore?: number;
}

export interface EnergySummary {
  kwhAvailability: {
    rawPct: number;
    imputedPct: number;
    missingPct: number;
  };
  kwhDelta24h: number;
  kwhDeltaMax: number;
  kwhDeltaMin: number;
  kwhRateAvg: number;
  kwhRatePeak: number;
  kwhRateLow: number;
  energyConsistencyScore: number;
  dataQualityScore: number;
  kwhSource: KwhSource;
  loadedZeroKwhEvents: number;
  negativeKwhEvents: number;
  missingKwhPct: number;
}

export interface MachineEventRow {
  eventId: string;
  eventTime: string;
  status: MachineStatusType;
  duration: string;
  kwhDelta: number | null;
  kwhSource: KwhSource;
  gapFromPrev: string;
  actionLevel: ActionLevel;
  l1Result: string;
  quality: number;
  finalReason: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  description: string;
  value: string;
  level: ActionLevel | QualityLevel | 'INFO' | 'WARNING';
  sourceField?: string;
}

export interface AiDecisionStep {
  id: string;
  title: string;
  value: string;
  level: ActionLevel | QualityLevel | 'INFO' | 'WARNING';
  description: string;
  sourceFields: string[];
}

export interface ContributionItem {
  label: string;
  value: number;
  direction: 'risk_up' | 'risk_down' | 'neutral';
  sourceField: string;
}

export interface PerformancePoint {
  time: string;
  loadedPct: number;
  noLoadPct: number;
  offPct: number;
  avgDurationMin: number;
  gapCount: number;
  throughputIndex: number;
  kwhRate: number;
}

export interface PerformanceSummary {
  loadedPct: number | null;
  noLoadPct: number | null;
  offPct: number | null;
  avgEventDurationMin: number | null;
  transitionCount: number | null;
  abnormalDurationEvents: number | null;
  bigGapEvents: number | null;
  throughputIndex: number | null;
}

export interface MaintenanceTask {
  id: string;
  priority: ActionLevel;
  title: string;
  reason: string;
  due: string;
  owner: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WATCHING' | 'DONE';
  confidencePct: number;
  sourceFields: string[];
}

export interface MaintenanceSignal {
  label: string;
  value: string;
  level: ActionLevel | QualityLevel | 'INFO' | 'WARNING';
  description: string;
}

export interface MachineDetailResponse {
  machine: MachineIdentity;
  kpis: MachineKpi[];
  timeline: TimelineSegment[];
  markers: TimelineMarker[];
  l1Series: L1Point[];
  riskSeries: RiskPoint[];
  kwhDeltaSeries: KwhPoint[];
  loadedKwhSeries: KwhPoint[];
  energySummary: EnergySummary;
  recentEvents: MachineEventRow[];
  operationalEvidence: EvidenceItem[];
  energyDataEvidence: EvidenceItem[];
  aiDecisionSteps: AiDecisionStep[];
  aiContributions: ContributionItem[];
  performanceSeries: PerformancePoint[];
  performanceSummary: PerformanceSummary;
  maintenanceTasks: MaintenanceTask[];
  maintenanceSignals: MaintenanceSignal[];
  finalReason: {
    text: string;
    actionLevel: ActionLevel;
    confidencePct: number | null;
    l1Score: number | null;
    l2Confidence: number | null;
  };
  apiMeta: {
    mode: 'mock' | 'api';
    generatedAt: string;
    policyVersion?: string;
    runId?: string;
  };
}
