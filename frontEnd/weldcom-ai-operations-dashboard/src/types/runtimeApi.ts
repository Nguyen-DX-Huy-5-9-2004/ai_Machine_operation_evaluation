import type { ApiMeta } from './dashboard';

export type ActionLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ApiEnvelope<T> { data: T; meta: ApiMeta; }
export interface PageData<T> { items: T[]; page: number; pageSize: number; total: number; }

export interface MachineSummary {
  machineId: number;
  displayCode: string;
  locationId?: number | null;
  machineGroupId?: number | null;
  latestEventTime?: string;
  currentRisk?: number | null;
  currentAction?: ActionLevel | null;
  faultRisk30min?: number | null;
  maintenanceRisk?: number | null;
  repairRisk?: number | null;
  dataQuality?: string | null;
  readiness?: string;
  source?: string;
}

export interface Explanation {
  availability: boolean;
  methodology?: string;
  decisionContributions?: Array<{ evidence: string; percent: number; rawWeight: number }>;
  reason?: string;
}

export interface ModelMonitor {
  runtimeStatus: string;
  runtimeEnvironmentStatus?: string;
  artifactIntegrity?: string;
  nextScheduledRetrain?: string | null;
  l1Candidates?: Record<string, unknown>;
  l2Targets?: Array<Record<string, unknown>>;
  modelMetadata?: Record<string, unknown>;
  latestInferenceAudit?: Record<string, unknown>;
  predictionRate?: Array<Record<string, unknown>>;
  scoringFunnel?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
