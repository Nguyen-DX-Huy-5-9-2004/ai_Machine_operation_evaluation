import type { ActionLevel, KwhSource, MachineDetailResponse, MachineStatusType, MaintenanceTask } from '../types/machineDetail';
import type { MachineSummary } from '../types/runtimeApi';
import { explainL1Vietnamese, explainL2Vietnamese, explainPolicyVietnamese, explainRawPolicyReasonVietnamese } from '../utils/machineAiExplanation';

type Row = Record<string, unknown>;
type RawDetail = {
  meta: Row;
  summary: Row;
  timeline: Row[];
  l1: Row[];
  l2: Row[];
  energy: Row;
  analysis: Row;
  performance: Row;
  events: Row[];
  maintenance?: Row[];
};

// L1 scores are normalized to percentage for the presentation layer.
const l1AnomalyThreshold = 76;
const l1WarningThreshold = 40;
const l2Fields = [
  'risk_fault_10_events',
  'risk_fault_30_events',
  'risk_fault_30min',
  'risk_fault_60min',
  'risk_maintenance_30_events',
  'risk_repair_30_events',
] as const;

const num = (value: unknown): number | null => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const bool = (value: unknown) => value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
const pct = (value: unknown): number | null => {
  const parsed = num(value);
  return parsed == null ? null : Math.round((Math.abs(parsed) <= 1 ? parsed * 100 : parsed) * 10) / 10;
};
// L1 can emit a threshold-relative value above 1. The timeline chart uses a
// bounded operator index (0..100) while rawScore remains available in audit
// payloads; otherwise values above 1 and values in 0..1 occupy incompatible
// visual scales.
const l1DisplayScore = (value: unknown): number | null => {
  const parsed = num(value);
  return parsed == null ? null : Math.round(Math.min(1, Math.max(0, parsed)) * 1000) / 10;
};
const text = (value: unknown, fallback = 'Not available') => value == null || value === '' ? fallback : String(value);
const action = (value: unknown): ActionLevel => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(String(value).toUpperCase()) ? String(value).toUpperCase() as ActionLevel : 'NORMAL';
const duration = (seconds: unknown) => {
  const value = num(seconds);
  if (value == null) return 'Not available';
  const total = Math.max(0, Math.round(value));
  return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const eventDate = (value: unknown) => new Date(String(value));
const time = (value: unknown) => {
  const date = eventDate(value);
  return Number.isNaN(date.valueOf()) ? text(value) : date.toLocaleString();
};
const chartTime = (value: unknown) => {
  const date = eventDate(value);
  return Number.isNaN(date.valueOf()) ? text(value) : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const finite = (value: number | null, fallback = 'Not available') => value == null ? fallback : value;
const chronological = (rows: Row[]) => [...rows].sort((left, right) => eventDate(left.event_start_time).valueOf() - eventDate(right.event_start_time).valueOf() || (num(left.event_id) ?? 0) - (num(right.event_id) ?? 0));

// Operational state and data quality are deliberately independent. A quality
// flag is evidence for the policy, not a machine state for the timeline.
function operationalStatus(row: Row): MachineStatusType {
  if (bool(row.has_error_token) || String(row.status_type_label ?? '').toUpperCase().includes('FAULT')) return 'FAULT';
  if (bool(row.has_maintenance_token) || String(row.status_type_label ?? '').toUpperCase().includes('MAINTENANCE')) return 'MAINTENANCE';
  if (bool(row.is_loaded)) return 'ON_LOADED';
  if (bool(row.is_no_load)) return 'ON_NO_LOAD';
  const statusId = num(row.status_id);
  if ([8, 9, 10].includes(statusId ?? -1)) return 'OFF';
  if ([2, 4, 6].includes(statusId ?? -1)) return 'ON_NO_LOAD';
  return 'ON_LOADED';
}

function displayStatus(row: Row): MachineStatusType {
  return bool(row.data_quality_issue_flag) ? 'DATA_ISSUE' : operationalStatus(row);
}

function maximumRisk(row: Row) {
  const values = l2Fields.map((field) => pct(row[field])).filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : null;
}

function sourceKwh(row: Row): KwhSource {
  if (bool(row.kwh_missing_flag)) return 'MISSING';
  if (bool(row.kwh_imputed_flag)) return 'IMPUTED';
  return 'RAW';
}

function groupPerformance(rows: Row[], energyRows: Row[]) {
  const energyByTime = new Map(energyRows.map((row) => [String(row.event_start_time), row]));
  const chunkSize = Math.max(1, Math.ceil(rows.length / 24));
  return rows.reduce<Row[][]>((groups, row, index) => {
    const group = Math.floor(index / chunkSize);
    (groups[group] ??= []).push(row);
    return groups;
  }, []).map((group) => {
    const durations = group.map((row) => num(row.duration_sec) ?? 0);
    const totalDuration = durations.reduce((sum, value) => sum + value, 0) || 1;
    const amount = (predicate: (row: Row) => boolean) => group.reduce((sum, row, index) => sum + (predicate(row) ? durations[index] : 0), 0) / totalDuration * 100;
    const energy = group.map((row) => energyByTime.get(String(row.event_start_time))).filter((row): row is Row => Boolean(row));
    return {
      time: chartTime(group[0].event_start_time),
      loadedPct: Number(amount((row) => operationalStatus(row) === 'ON_LOADED').toFixed(1)),
      noLoadPct: Number(amount((row) => operationalStatus(row) === 'ON_NO_LOAD').toFixed(1)),
      offPct: Number(amount((row) => operationalStatus(row) === 'OFF').toFixed(1)),
      avgDurationMin: Number((durations.reduce((sum, value) => sum + value, 0) / group.length / 60).toFixed(1)),
      gapCount: group.filter((row) => (num(row.gap_from_prev_sec) ?? 0) > 3600).length,
      throughputIndex: Number((group.filter((row) => bool(row.l1_score_available_flag)).length / group.length * 100).toFixed(1)),
      kwhRate: Number((energy.reduce((sum, row) => sum + (num(row.kwh_rate_per_hour) ?? 0), 0) / Math.max(energy.length, 1)).toFixed(2)),
    };
  });
}

export function adaptApiMachineDetail(rawValue: Record<string, unknown>, machine: MachineSummary): MachineDetailResponse {
  const raw = rawValue as unknown as RawDetail;
  const s = raw.summary;
  const timeline = chronological(raw.timeline);
  const l1Rows = chronological(raw.l1);
  const l2Rows = chronological(raw.l2);
  const energyRows = chronological(Array.isArray(raw.energy.series) ? raw.energy.series as Row[] : []);
  const eventRows = chronological(raw.events);
  const maintenanceRows = chronological(raw.maintenance ?? []);
  const statusByEventTime = new Map(timeline.map((row) => [String(row.event_start_time), operationalStatus(row)]));
  const risk = pct(s.operational_overall_risk_score);
  const l1Score = l1DisplayScore(s.behavior_anomaly_score ?? s.behavior_combined_score);
  const l2Risk = maximumRisk(s);
  const eventCount = num(raw.energy.eventCount) ?? 0;
  const loaded = num(raw.performance.loadedDuration);
  const noLoad = num(raw.performance.noLoadDuration);
  const off = num(raw.performance.offDuration);
  const durationTotal = (loaded ?? 0) + (noLoad ?? 0) + (off ?? 0);
  const ratio = (value: number | null) => durationTotal > 0 && value != null ? Number((value / durationTotal * 100).toFixed(1)) : null;
  const latestMaintenance = maintenanceRows[maintenanceRows.length - 1] ?? s;
  const maintenanceRisk = pct(latestMaintenance.risk_maintenance_30_events) ?? 0;
  const repairRisk = pct(latestMaintenance.risk_repair_30_events) ?? 0;
  const l1Explanation = explainL1Vietnamese(l1Score, bool(s.is_behavior_anomaly), bool(s.is_sensitive_warning), text(s.readiness_reason));
  const l2Explanation = explainL2Vietnamese(l2Risk);
  const policyExplanation = explainPolicyVietnamese({
    l1Score,
    l2Risk,
    actionLevel: text(s.operational_action_level),
    operationalJudgment: text(s.operational_judgment),
    qualityJudgment: text(s.quality_judgment),
    qualityIssue: bool(s.data_quality_issue_flag),
    energyIssue: bool(s.energy_inconsistency_flag),
    readyReason: text(s.readiness_reason),
    rawReason: text(s.final_reason_v2),
  });

  const maintenanceTasks: MaintenanceTask[] = [
    { id: 'inspect-maintenance', priority: maintenanceRisk >= 80 ? 'HIGH' : maintenanceRisk >= 50 ? 'MEDIUM' : 'LOW', title: 'Review maintenance risk evidence', reason: `Current model maintenance risk is ${maintenanceRisk.toFixed(1)}%.`, due: maintenanceRisk >= 80 ? 'Prioritize next shift' : 'Monitor next planned inspection', owner: 'Maintenance planner', status: maintenanceRisk >= 80 ? 'OPEN' : 'WATCHING', confidencePct: maintenanceRisk, sourceFields: ['risk_maintenance_30_events', 'final_reason_v2'] },
    { id: 'inspect-repair', priority: repairRisk >= 80 ? 'HIGH' : repairRisk >= 50 ? 'MEDIUM' : 'LOW', title: 'Review repair risk evidence', reason: `Current model repair risk is ${repairRisk.toFixed(1)}%.`, due: repairRisk >= 80 ? 'Prioritize next shift' : 'Monitor next planned inspection', owner: 'Reliability engineer', status: repairRisk >= 80 ? 'OPEN' : 'WATCHING', confidencePct: repairRisk, sourceFields: ['risk_repair_30_events', 'final_reason_v2'] },
  ];

  return {
    machine: {
      machineId: String(machine.machineId), machineName: machine.displayCode, locationName: machine.locationId == null ? 'Not available' : `Location ${machine.locationId}`,
      machineGroup: machine.machineGroupId == null ? 'Not available' : `Group ${machine.machineGroupId}`,
      currentStatus: `Status ${text(s.status_id)}`, isActive: true, isRunning: bool(s.policy_ready_flag) || action(s.operational_action_level) !== 'NORMAL', lastUpdated: time(s.event_start_time),
    },
    kpis: [
      { key: 'machineId', label: 'Machine ID', value: String(machine.machineId), subLabel: machine.displayCode, level: 'INFO', sourceField: 'machine_id' },
      { key: 'location', label: 'Location', value: machine.locationId == null ? 'Not available' : `Location ${machine.locationId}`, subLabel: 'Current assignment', level: 'INFO', sourceField: 'location_id' },
      { key: 'group', label: 'Machine group', value: machine.machineGroupId == null ? 'Not available' : `Group ${machine.machineGroupId}`, subLabel: 'Production asset', level: 'INFO', sourceField: 'machine_group_id' },
      { key: 'status', label: 'Current status', value: displayStatus(s).replace(/_/g, ' '), subLabel: bool(s.policy_ready_flag) ? 'Policy ready' : text(s.readiness_reason), level: action(s.operational_action_level), sourceField: 'status_id' },
      { key: 'risk30', label: 'Risk fault 30min', value: finite(pct(s.risk_fault_30min)), suffix: s.risk_fault_30min == null ? undefined : '%', level: action(s.operational_action_level), trend: l2Rows.map((row) => pct(row.risk_fault_30min) ?? 0), sourceField: 'risk_fault_30min' },
      { key: 'l1', label: 'L1 anomaly score', value: finite(l1Score), suffix: l1Score == null ? undefined : '%', subLabel: bool(s.is_behavior_anomaly) ? 'Anomaly' : 'Within production threshold', level: bool(s.is_behavior_anomaly) ? 'HIGH' : 'INFO', trend: l1Rows.map((row) => l1DisplayScore(row.behavior_anomaly_score) ?? 0), sourceField: 'behavior_anomaly_score' },
      { key: 'l2', label: 'Max L2 confidence', value: finite(l2Risk), suffix: l2Risk == null ? undefined : '%', subLabel: 'Across six production targets', level: action(s.operational_action_level), trend: l2Rows.map((row) => maximumRisk(row) ?? 0), sourceField: 'six L2 probabilities' },
      { key: 'quality', label: 'Data quality', value: text(s.quality_action_level), subLabel: text(s.quality_judgment), level: bool(s.data_quality_issue_flag) ? 'WARNING' : 'NORMAL', sourceField: 'quality_action_level' },
      { key: 'energy', label: 'Energy consistency', value: bool(s.energy_inconsistency_flag) ? 'Review' : 'Pass', subLabel: bool(s.energy_inconsistency_flag) ? 'Event evidence inconsistent' : 'No current inconsistency flag', level: bool(s.energy_inconsistency_flag) ? 'WARNING' : 'NORMAL', trend: energyRows.map((row) => num(row.kwh_delta) ?? 0), sourceField: 'energy_inconsistency_flag' },
    ],
    timeline: timeline.map((row) => ({ id: text(row.event_uid), start: time(row.event_start_time), end: time(row.event_end_time ?? row.event_start_time), status: operationalStatus(row), label: `Status ${text(row.status_id)}`, durationMin: Math.max((num(row.duration_sec) ?? 1) / 60, 0.05), riskScore: maximumRisk(row) ?? undefined, flags: [text(row.readiness_reason)] })),
    markers: timeline.flatMap((row) => {
      const severity = action(row.operational_action_level);
      const base = { id: text(row.event_uid), time: time(row.event_start_time), label: text(row.operational_action_level), severity };
      const points = [] as MachineDetailResponse['markers'];
      if (severity !== 'LOW' && severity !== 'NORMAL') points.push({ ...base, id: `${base.id}:fault`, type: 'fault' });
      if (bool(row.data_quality_issue_flag)) points.push({ ...base, id: `${base.id}:quality`, label: 'Data quality issue', type: 'quality' });
      if (bool(row.energy_inconsistency_flag)) points.push({ ...base, id: `${base.id}:energy`, label: 'Energy inconsistency', type: 'energy' });
      if ((pct(row.risk_maintenance_30_events) ?? 0) >= 50 || (pct(row.risk_repair_30_events) ?? 0) >= 50) points.push({ ...base, id: `${base.id}:maintenance`, label: 'Maintenance / repair risk', type: 'maintenance' });
      if ((num(row.gap_from_prev_sec) ?? 0) > 3600 || (num(row.overlap_sec) ?? 0) > 0) points.push({ ...base, id: `${base.id}:gap`, label: 'Gap or overlap context', type: 'gap' });
      return points;
    }),
    l1Series: l1Rows.filter((row) => l1DisplayScore(row.behavior_anomaly_score) != null).map((row) => ({ time: chartTime(row.event_start_time), timestamp: time(row.event_start_time), score: l1DisplayScore(row.behavior_anomaly_score) ?? 0, rawScore: num(row.behavior_anomaly_score) ?? undefined, anomalyThreshold: l1AnomalyThreshold, warningThreshold: l1WarningThreshold, eventId: text(row.event_uid), status: bool(row.is_behavior_anomaly) ? 'Anomaly' : bool(row.is_sensitive_warning) ? 'Sensitive warning' : 'Normal' })),
    riskSeries: l2Rows.filter((row) => bool(row.l2_ready_flag)).map((row) => ({ time: chartTime(row.event_start_time), timestamp: time(row.event_start_time), faultRisk: Math.max(pct(row.risk_fault_10_events) ?? 0, pct(row.risk_fault_30_events) ?? 0, pct(row.risk_fault_30min) ?? 0, pct(row.risk_fault_60min) ?? 0), maintenanceRisk: pct(row.risk_maintenance_30_events) ?? 0, repairRisk: pct(row.risk_repair_30_events) ?? 0 })),
    kwhDeltaSeries: energyRows.filter((row) => num(row.kwh_delta_model_value ?? row.kwh_delta) != null).map((row) => ({ time: chartTime(row.event_start_time), timestamp: time(row.event_start_time), kwhDelta: num(row.kwh_delta_model_value ?? row.kwh_delta) ?? 0, actualKwh: num(row.kwh_delta) ?? undefined, expectedKwh: num(row.kwh_delta_model_value ?? row.kwh_delta) ?? undefined, qualityScore: bool(row.kwh_available_flag) ? 100 : 0 })),
    loadedKwhSeries: energyRows.map((row) => {
      const eventStatus = statusByEventTime.get(String(row.event_start_time));
      return {
        time: chartTime(row.event_start_time),
        timestamp: time(row.event_start_time),
        kwhDelta: num(row.kwh_delta_model_value ?? row.kwh_delta) ?? 0,
        actualKwh: num(row.kwh_delta) ?? undefined,
        // The energy endpoint is intentionally event-level. Join its status
        // from the same machine timeline instead of misusing a quality flag as
        // a loaded-state indicator.
        loaded: eventStatus === 'ON_LOADED' ? 1 : 0,
        qualityScore: bool(row.kwh_available_flag) ? 100 : 0,
      };
    }),
    energySummary: {
      kwhAvailability: { rawPct: pct(raw.energy.kwhAvailabilityRate) ?? 0, imputedPct: pct(raw.energy.kwhImputedRate) ?? 0, missingPct: pct(raw.energy.kwhMissingRate) ?? 0 },
      kwhDelta24h: num(raw.energy.totalKwhDelta) ?? 0, kwhDeltaMax: energyRows.reduce((max, row) => Math.max(max, num(row.kwh_delta) ?? -Infinity), 0), kwhDeltaMin: energyRows.reduce((min, row) => Math.min(min, num(row.kwh_delta) ?? Infinity), 0),
      kwhRateAvg: num(raw.energy.averageKwhRate) ?? 0, kwhRatePeak: energyRows.reduce((max, row) => Math.max(max, num(row.kwh_rate_per_hour) ?? -Infinity), 0), kwhRateLow: energyRows.reduce((min, row) => Math.min(min, num(row.kwh_rate_per_hour) ?? Infinity), 0),
      energyConsistencyScore: eventCount ? Number((100 - (num(raw.energy.energyInconsistencyCount) ?? 0) / eventCount * 100).toFixed(1)) : 0, dataQualityScore: eventCount ? Number(((num(raw.energy.kwhAvailabilityRate) ?? 0) * 100).toFixed(1)) : 0,
      kwhSource: (num(raw.energy.kwhImputedRate) ?? 0) > 0 ? 'MIXED_RAW_FILL' as KwhSource : 'RAW', loadedZeroKwhEvents: num(raw.energy.loadedZeroKwhCount) ?? 0, negativeKwhEvents: num(raw.energy.negativeCount) ?? 0, missingKwhPct: pct(raw.energy.kwhMissingRate) ?? 0,
    },
    recentEvents: [...eventRows].reverse().slice(0, 50).map((row) => ({ eventId: text(row.event_id), eventTime: time(row.event_start_time), status: displayStatus(row), duration: duration(row.duration_sec), kwhDelta: num(row.kwh_delta), kwhSource: sourceKwh(row), gapFromPrev: duration(row.gap_from_prev_sec), actionLevel: action(row.operational_action_level), l1Result: bool(row.is_behavior_anomaly) ? 'Anomaly' : text(row.readiness_reason), quality: bool(row.data_quality_issue_flag) ? 100 : 0, finalReason: explainRawPolicyReasonVietnamese(text(row.final_reason_v2)) })),
    operationalEvidence: [
      { id: 'action', label: 'Operational judgment', description: policyExplanation, value: text(s.operational_action_level), level: action(s.operational_action_level), sourceField: 'operational_judgment' },
      { id: 'l1', label: 'L1 behavior evidence', description: l1Explanation, value: l1Score == null ? 'Not available' : `${l1Score}%`, level: bool(s.is_behavior_anomaly) ? 'HIGH' : 'INFO', sourceField: 'behavior_anomaly_score' },
      { id: 'fault', label: 'Near-term fault risk', description: l2Explanation, value: l2Risk == null ? 'Not available' : `${l2Risk}%`, level: action(s.operational_action_level), sourceField: 'risk_fault_*' },
    ],
    energyDataEvidence: [
      { id: 'quality', label: 'Data quality policy', description: text(s.quality_judgment), value: text(s.quality_action_level), level: bool(s.data_quality_issue_flag) ? 'WARNING' : 'INFO', sourceField: 'quality_judgment' },
      { id: 'energy', label: 'Energy consistency', description: bool(s.energy_inconsistency_flag) ? 'KWh evidence requires review before it is treated as a machine fault.' : 'No current energy inconsistency flag.', value: bool(s.energy_inconsistency_flag) ? 'Review' : 'Pass', level: bool(s.energy_inconsistency_flag) ? 'WARNING' : 'INFO', sourceField: 'energy_inconsistency_flag' },
    ],
    aiDecisionSteps: [
      { id: 'l1', title: 'L1 deviation gate', value: l1Score == null ? 'Not ready' : `${l1Score}%`, level: bool(s.is_behavior_anomaly) ? 'HIGH' : 'INFO', description: l1Explanation, sourceFields: ['behavior_anomaly_score', 'l1_score_available_flag'] },
      { id: 'l2', title: 'L2 multi-label risks', value: l2Risk == null ? 'Not ready' : `${l2Risk}%`, level: action(s.operational_action_level), description: l2Explanation, sourceFields: ['risk_fault_*', 'risk_maintenance_30_events', 'risk_repair_30_events'] },
      { id: 'quality', title: 'Quality policy', value: text(s.quality_action_level), level: bool(s.data_quality_issue_flag) ? 'WARNING' : 'INFO', description: bool(s.data_quality_issue_flag) ? 'Phát hiện vấn đề chất lượng dữ liệu; cần xác minh trước khi quy kết luận lỗi máy.' : 'Chất lượng dữ liệu hiện đủ điều kiện để đánh giá.', sourceFields: ['quality_action_level', 'data_quality_issue_flag'] },
      { id: 'policy', title: 'Policy v2 result', value: text(s.operational_action_level), level: action(s.operational_action_level), description: policyExplanation, sourceFields: ['operational_action_level', 'final_reason_v2'] },
    ],
    aiContributions: [
      { label: 'L1 anomaly score', value: l1Score ?? 0, direction: (l1Score ?? 0) >= 76 ? 'risk_up' : 'neutral', sourceField: 'behavior_anomaly_score' },
      { label: 'Fault risk 30 min', value: pct(s.risk_fault_30min) ?? 0, direction: 'risk_up', sourceField: 'risk_fault_30min' },
      { label: 'Maintenance risk', value: maintenanceRisk, direction: maintenanceRisk >= 50 ? 'risk_up' : 'neutral', sourceField: 'risk_maintenance_30_events' },
      { label: 'Repair risk', value: repairRisk, direction: repairRisk >= 50 ? 'risk_up' : 'neutral', sourceField: 'risk_repair_30_events' },
      { label: 'Energy evidence', value: bool(s.energy_inconsistency_flag) ? 65 : 0, direction: bool(s.energy_inconsistency_flag) ? 'risk_up' : 'risk_down', sourceField: 'energy_inconsistency_flag' },
    ],
    performanceSeries: groupPerformance(timeline, energyRows),
    performanceSummary: { loadedPct: ratio(loaded), noLoadPct: ratio(noLoad), offPct: ratio(off), avgEventDurationMin: num(raw.performance.averageEventDuration) == null ? null : Number((num(raw.performance.averageEventDuration)! / 60).toFixed(1)), transitionCount: num(raw.performance.eventCount), abnormalDurationEvents: num(raw.performance.abnormalDurationCount), bigGapEvents: num(raw.performance.bigGapCount), throughputIndex: timeline.length ? Number((timeline.filter((row) => text(row.readiness_reason) === 'READY').length / timeline.length * 100).toFixed(1)) : null },
    maintenanceTasks,
    maintenanceSignals: [
      { label: 'Maintenance risk', value: `${maintenanceRisk.toFixed(1)}%`, level: maintenanceRisk >= 80 ? 'HIGH' : maintenanceRisk >= 50 ? 'WARNING' : 'INFO', description: 'L2 risk only. It does not create a work order.' },
      { label: 'Repair risk', value: `${repairRisk.toFixed(1)}%`, level: repairRisk >= 80 ? 'HIGH' : repairRisk >= 50 ? 'WARNING' : 'INFO', description: 'L2 risk only. Review with maintenance history.' },
    ],
    finalReason: { text: policyExplanation, actionLevel: action(s.operational_action_level), confidencePct: risk, l1Score, l2Confidence: l2Risk },
    apiMeta: { mode: 'api', generatedAt: text(raw.meta.generatedAt), policyVersion: text(raw.meta.policyVersion), runId: text(raw.meta.l2RunId) },
  };
}
