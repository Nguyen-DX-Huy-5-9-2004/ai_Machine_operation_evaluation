import type { MachineDetailResponse, MachineStatusType } from '../types/machineDetail';

const hours = ['22:00','23:00','00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

function buildL1Series() {
  const scores = [0.24, 0.31, 0.22, 0.52, 0.25, 0.18, 0.21, 0.28, 0.96, 0.47, 0.34, 0.27, 0.20, 0.29, 0.82, 0.43, 0.39, 0.88, 0.55, 0.33];
  return scores.map((score, index) => ({
    time: hours[index] ?? `${index}:00`,
    score,
    anomalyThreshold: 0.76,
    warningThreshold: 0.4,
    eventId: `EVT-${index + 1000}`,
    status: index === 8 || index === 14 || index === 17 ? 'Fault-like spike' : 'Normal context',
  }));
}

function buildRiskSeries() {
  return ['May 12', 'May 13', 'May 14', 'May 15', 'May 16', 'May 17', 'May 18'].map((time, i) => ({
    time,
    faultRisk: [42, 64, 72, 81, 68, 89, 92][i],
    maintenanceRisk: [24, 31, 41, 46, 44, 58, 63][i],
    repairRisk: [12, 17, 22, 25, 21, 31, 28][i],
  }));
}

function buildKwhDeltaSeries() {
  const values = [-8, 4, -16, 12, -5, 8, 14, -11, 22, 58, 10, -7, 4, 13, -19, -2, 6, 11, -3, 8];
  return values.map((kwhDelta, index) => ({
    time: hours[index] ?? `${index}:00`,
    kwhDelta,
    qualityScore: index === 9 ? 64 : 82 + (index % 8),
  }));
}

function buildLoadedKwhSeries() {
  const actual = [28, 44, 58, 46, 55, 83, 122, 148, 139, 151, 143, 131, 110, 82, 46, 22, 18, 12];
  const expected = [25, 42, 53, 49, 60, 86, 118, 134, 137, 142, 136, 121, 94, 69, 39, 24, 16, 11];
  const loaded = [0, 1, 1, 0, 0, 1, 1, 1, 0.45, 0.55, 0.5, 1, 0.25, 0.35, 0, 0, 0, 0];
  return actual.map((actualKwh, index) => ({
    time: hours[index] ?? `${index}:00`,
    kwhDelta: actualKwh - expected[index],
    actualKwh,
    expectedKwh: expected[index],
    loaded: loaded[index],
  }));
}

function buildPerformanceSeries() {
  return ['May 12', 'May 13', 'May 14', 'May 15', 'May 16', 'May 17', 'May 18'].map((time, i) => ({
    time,
    loadedPct: [61, 64, 68, 55, 58, 63, 59][i],
    noLoadPct: [18, 16, 14, 22, 20, 17, 19][i],
    offPct: [21, 20, 18, 23, 22, 20, 22][i],
    avgDurationMin: [7.8, 8.1, 9.4, 11.7, 8.5, 10.2, 12.4][i],
    gapCount: [2, 1, 3, 5, 2, 4, 6][i],
    throughputIndex: [82, 86, 91, 76, 79, 84, 72][i],
    kwhRate: [9.2, 10.5, 11.4, 14.6, 9.8, 12.1, 12.4][i],
  }));
}

const statusMap: MachineStatusType[] = [
  'ON_LOADED', 'ON_LOADED', 'ON_NO_LOAD', 'ON_LOADED', 'OFF', 'ON_LOADED', 'DATA_ISSUE', 'ON_LOADED', 'FAULT', 'ON_LOADED',
  'ON_LOADED', 'MAINTENANCE', 'MAINTENANCE', 'ON_LOADED', 'DATA_ISSUE', 'FAULT', 'ON_NO_LOAD', 'ON_LOADED', 'ON_LOADED', 'OFF',
  'ON_LOADED', 'ON_LOADED', 'DATA_ISSUE', 'ON_LOADED', 'ON_NO_LOAD', 'ON_LOADED', 'ON_LOADED', 'OFF'
];

function buildTimeline() {
  return statusMap.map((status, index) => ({
    id: `SEG-${index + 1}`,
    start: `${String(index).padStart(2, '0')}:00`,
    end: `${String(index + 1).padStart(2, '0')}:00`,
    status,
    label: status.replace(/_/g, ' '),
    durationMin: 42 + (index % 5) * 7,
    riskScore: status === 'FAULT' ? 92 : status === 'DATA_ISSUE' ? 72 : status === 'MAINTENANCE' ? 55 : 22,
    flags: status === 'DATA_ISSUE' ? ['missing_kwh'] : status === 'FAULT' ? ['fault_like_pattern'] : [],
  }));
}

const recentEvents = [
  { eventId: 'E-92410', eventTime: 'May 18, 10:24:10 AM', status: 'FAULT' as MachineStatusType, duration: '00:06:02', kwhDelta: 48.2, kwhSource: 'RAW' as const, gapFromPrev: '00:01:35', actionLevel: 'CRITICAL' as const, l1Result: 'Anomaly (0.92)', quality: 78, finalReason: 'High risk fault pattern detected' },
  { eventId: 'E-92409', eventTime: 'May 18, 10:10:03 AM', status: 'ON_LOADED' as MachineStatusType, duration: '00:16:07', kwhDelta: 126.7, kwhSource: 'RAW' as const, gapFromPrev: '00:00:21', actionLevel: 'HIGH' as const, l1Result: 'Anomaly (0.74)', quality: 82, finalReason: 'Energy spike with gap before' },
  { eventId: 'E-92408', eventTime: 'May 18, 09:59:35 AM', status: 'ON_NO_LOAD' as MachineStatusType, duration: '00:09:12', kwhDelta: 18.6, kwhSource: 'IMPUTED' as const, gapFromPrev: '00:00:15', actionLevel: 'LOW' as const, l1Result: 'Normal (0.23)', quality: 95, finalReason: 'No load signature' },
  { eventId: 'E-92407', eventTime: 'May 18, 09:45:18 AM', status: 'OFF' as MachineStatusType, duration: '00:17:47', kwhDelta: -2.1, kwhSource: 'MISSING' as const, gapFromPrev: '00:00:32', actionLevel: 'LOW' as const, l1Result: 'Normal (0.12)', quality: 97, finalReason: 'Machine idle' },
  { eventId: 'E-92406', eventTime: 'May 18, 09:13:10 AM', status: 'MAINTENANCE' as MachineStatusType, duration: '00:27:21', kwhDelta: -1.3, kwhSource: 'RAW' as const, gapFromPrev: '00:02:36', actionLevel: 'MEDIUM' as const, l1Result: 'Maintenance', quality: 94, finalReason: 'Scheduled maintenance' },
  { eventId: 'E-92405', eventTime: 'May 18, 08:44:21 AM', status: 'DATA_ISSUE' as MachineStatusType, duration: '00:02:21', kwhDelta: null, kwhSource: 'MISSING' as const, gapFromPrev: '00:05:46', actionLevel: 'MEDIUM' as const, l1Result: 'No Data', quality: 42, finalReason: 'Missing KWh and short duration' },
  { eventId: 'E-92404', eventTime: 'May 18, 08:15:09 AM', status: 'ON_LOADED' as MachineStatusType, duration: '00:21:41', kwhDelta: 112.4, kwhSource: 'MIXED_RAW_FILL' as const, gapFromPrev: '00:00:29', actionLevel: 'HIGH' as const, l1Result: 'Anomaly (0.68)', quality: 86, finalReason: 'Loaded energy pattern above baseline' },
];

export const mockMachineDetail: MachineDetailResponse = {
  machine: {
    machineId: 'WC-047',
    machineName: 'Robotic Welding Cell 047',
    locationName: 'Plant 1 - Line A',
    machineGroup: 'Robotic Welding',
    currentStatus: 'Welding Robot',
    isActive: true,
    isRunning: true,
    lastUpdated: '2026-07-17 10:24:37',
  },
  kpis: [
    { key: 'machineId', label: 'Machine ID', value: 'WC-047', subLabel: 'Active', level: 'INFO', sourceField: 'machine_id' },
    { key: 'location', label: 'Location', value: 'Plant 1 - Line A', subLabel: 'Current placement', level: 'INFO', sourceField: 'location_name' },
    { key: 'group', label: 'Machine Group', value: 'Robotic Welding', subLabel: 'Production asset', level: 'INFO', sourceField: 'machine_group_id' },
    { key: 'status', label: 'Current Status', value: 'Welding Robot', subLabel: 'Running', level: 'NORMAL', sourceField: 'status_name' },
    { key: 'risk30', label: 'Risk Fault 30min', value: 92, suffix: '%', subLabel: 'Critical', level: 'CRITICAL', trend: [62, 58, 71, 73, 85, 82, 92], sourceField: 'risk_fault_30min' },
    { key: 'l1', label: 'L1 Anomaly Score', value: 0.89, subLabel: 'Anomaly', level: 'CRITICAL', trend: [0.31, 0.37, 0.45, 0.42, 0.62, 0.71, 0.89], sourceField: 'behavior_anomaly_score' },
    { key: 'l2', label: 'L2 Confidence', value: 0.92, subLabel: 'Very high', level: 'HIGH', trend: [0.64, 0.67, 0.72, 0.76, 0.84, 0.88, 0.92], sourceField: 'operational_fault_confidence_score' },
    { key: 'quality', label: 'Data Quality', value: 78, suffix: '%', subLabel: 'Moderate', level: 'MODERATE', trend: [76, 73, 75, 79, 77, 78, 78], sourceField: 'quality_risk_score' },
    { key: 'energy', label: 'Energy Consistency', value: 63, suffix: '%', subLabel: 'Warning', level: 'WARNING', trend: [81, 77, 69, 64, 58, 61, 63], sourceField: 'energy_inconsistency_flag' },
  ],
  timeline: buildTimeline(),
  markers: [
    { id: 'M1', time: '01:42', type: 'energy', label: 'Loaded zero KWh detected', severity: 'HIGH' },
    { id: 'M2', time: '05:18', type: 'fault', label: 'Fault-like status transition', severity: 'CRITICAL' },
    { id: 'M3', time: '12:31', type: 'quality', label: 'Missing telemetry segment', severity: 'MEDIUM' },
    { id: 'M4', time: '14:08', type: 'energy', label: 'KWh delta spike', severity: 'CRITICAL' },
  ],
  l1Series: buildL1Series(),
  riskSeries: buildRiskSeries(),
  kwhDeltaSeries: buildKwhDeltaSeries(),
  loadedKwhSeries: buildLoadedKwhSeries(),
  performanceSeries: buildPerformanceSeries(),
  performanceSummary: {
    loadedPct: 59,
    noLoadPct: 19,
    offPct: 22,
    avgEventDurationMin: 12.4,
    transitionCount: 138,
    abnormalDurationEvents: 7,
    bigGapEvents: 6,
    throughputIndex: 72,
  },
  energySummary: {
    kwhAvailability: { rawPct: 50, imputedPct: 13, missingPct: 37 },
    kwhDelta24h: 48.2,
    kwhDeltaMax: 112.4,
    kwhDeltaMin: -35.2,
    kwhRateAvg: 12.4,
    kwhRatePeak: 48.6,
    kwhRateLow: -3.1,
    energyConsistencyScore: 63,
    dataQualityScore: 78,
    kwhSource: 'MIXED_RAW_FILL',
    loadedZeroKwhEvents: 2,
    negativeKwhEvents: 1,
    missingKwhPct: 37,
  },
  recentEvents,
  operationalEvidence: [
    { id: 'OE1', label: 'Fault risk high in last 30 min', description: 'L2 target risk_fault_30min crossed policy threshold.', value: '92%', level: 'CRITICAL', sourceField: 'risk_fault_30min' },
    { id: 'OE2', label: 'High anomaly score detected', description: 'L1 reconstruction deviation is above anomaly threshold.', value: '0.89', level: 'CRITICAL', sourceField: 'behavior_anomaly_score' },
    { id: 'OE3', label: 'Gap / overlap detected', description: 'Time gap from previous event may affect inference context.', value: '00:01:35', level: 'HIGH', sourceField: 'gap_from_prev_sec' },
    { id: 'OE4', label: 'Maintenance token found', description: 'Recent status suggests maintenance context.', value: '1', level: 'MEDIUM', sourceField: 'has_maintenance_token' },
    { id: 'OE5', label: 'Status pattern', description: 'Loaded → Off → Fault transition appears in context window.', value: 'Loaded → Fault', level: 'HIGH', sourceField: 'status_id' },
  ],
  energyDataEvidence: [
    { id: 'EE1', label: 'KWh delta spike', description: 'Event-level KWh delta is abnormal for this machine state.', value: '+48.2 kWh', level: 'CRITICAL', sourceField: 'kwh_delta_model_value' },
    { id: 'EE2', label: 'Energy inconsistency', description: 'Loaded status does not fully match KWh evidence.', value: 'Detected', level: 'HIGH', sourceField: 'energy_inconsistency_flag' },
    { id: 'EE3', label: 'Missing KWh', description: 'Share of recent events with missing KWh evidence.', value: '37%', level: 'MEDIUM', sourceField: 'kwh_missing_flag' },
    { id: 'EE4', label: 'Imputed KWh', description: 'Share of recent events using controlled imputation/fill.', value: '13%', level: 'MEDIUM', sourceField: 'kwh_imputed_flag' },
    { id: 'EE5', label: 'Time quality issue', description: 'Time context is acceptable for the selected event.', value: 'Low', level: 'LOW', sourceField: 'time_quality_issue_flag' },
  ],
  aiDecisionSteps: [
    { id: 'D1', title: 'L1 deviation gate', value: '0.89 > 0.76', level: 'CRITICAL', description: 'Production anomaly score crossed anomaly threshold.', sourceFields: ['behavior_anomaly_score', 'threshold_lenient_raw'] },
    { id: 'D2', title: 'L2 fault confidence', value: '92%', level: 'CRITICAL', description: 'Fault risk in the next 30 minutes is high.', sourceFields: ['risk_fault_30min', 'operational_fault_confidence_score'] },
    { id: 'D3', title: 'Quality policy', value: 'Review', level: 'MODERATE', description: 'Data is usable but energy evidence contains inconsistency.', sourceFields: ['quality_judgment', 'quality_action_level'] },
    { id: 'D4', title: 'Final policy gate', value: 'CRITICAL', level: 'CRITICAL', description: 'Operational policy escalates this event to critical action.', sourceFields: ['operational_action_level', 'final_reason_v2'] },
  ],
  aiContributions: [
    { label: 'L1 anomaly spike', value: 34, direction: 'risk_up', sourceField: 'behavior_anomaly_score' },
    { label: 'Fault risk 30min', value: 29, direction: 'risk_up', sourceField: 'risk_fault_30min' },
    { label: 'KWh inconsistency', value: 18, direction: 'risk_up', sourceField: 'energy_inconsistency_flag' },
    { label: 'Time gap context', value: 11, direction: 'risk_up', sourceField: 'gap_from_prev_sec' },
    { label: 'Maintenance context', value: 8, direction: 'neutral', sourceField: 'has_maintenance_token' },
  ],
  maintenanceTasks: [
    { id: 'MT-01', priority: 'CRITICAL', title: 'Inspect robot axis current and welding power trace', reason: 'Fault confidence and KWh spike are both high.', due: 'Today', owner: 'Maintenance Lead', status: 'OPEN', confidencePct: 92, sourceFields: ['risk_fault_30min', 'kwh_delta_model_value'] },
    { id: 'MT-02', priority: 'HIGH', title: 'Validate KWh meter source and imputation window', reason: '37% recent events have missing KWh evidence.', due: 'Today', owner: 'Data Engineer', status: 'IN_PROGRESS', confidencePct: 78, sourceFields: ['kwh_missing_flag', 'kwh_source'] },
    { id: 'MT-03', priority: 'MEDIUM', title: 'Review maintenance token transition around 09:13', reason: 'Maintenance event appears before anomaly escalation.', due: 'Next shift', owner: 'Operations Supervisor', status: 'WATCHING', confidencePct: 63, sourceFields: ['has_maintenance_token', 'status_id'] },
  ],
  maintenanceSignals: [
    { label: 'Maintenance risk', value: '63%', level: 'HIGH', description: 'L2 risk_maintenance_30_events is elevated.' },
    { label: 'Repair risk', value: '28%', level: 'MEDIUM', description: 'Repair risk is present but below critical gate.' },
    { label: 'Recent maintenance event', value: '09:13 AM', level: 'INFO', description: 'A maintenance status appears in the current context window.' },
    { label: 'Suggested action', value: 'Inspect', level: 'CRITICAL', description: 'Priority is manual inspection before production continuation.' },
  ],
  finalReason: {
    text: 'High energy spike with abnormal sensor readings',
    actionLevel: 'CRITICAL',
    confidencePct: 92,
    l1Score: 0.89,
    l2Confidence: 0.92,
  },
  apiMeta: {
    mode: 'mock',
    generatedAt: '2026-07-17 10:24:37',
    policyVersion: 'policy_v2',
    runId: 'l2_multilabel_20260711_043347',
  },
};

export { hours };
