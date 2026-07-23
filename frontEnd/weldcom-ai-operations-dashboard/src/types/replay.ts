export interface ReplayEvent {
  event_id: number;
  machine_id: number;
  machine_call_name?: string;
  event_uid: string;
  replay_sequence: number;
  source_event_start_time?: string;
  operational_overall_risk_score?: number;
  operational_action_level?: string;
  quality_action_level?: string;
  behavior_anomaly_score?: number;
  policy_ready_flag?: number;
  [key: string]: unknown;
}

export interface ReplayStatus {
  replayRunId: string;
  mode: 'file_only';
  batchSequence: number;
  processedCount: number;
  policyReadyCount: number;
  l1ReadyCount: number;
  l1UnreadyCount: number;
  l2ReadyCount: number;
  l2UnreadyCount: number;
  replayState: 'LIVE' | 'PAUSED';
  virtualTime: string | null;
  sqlWrites: 0;
}

export interface ReplayDelta {
  data: ReplayEvent[];
  cursor: { afterSequence: number };
  sqlWrites: 0;
}

export type SpacingMode = 'event' | 'time';
