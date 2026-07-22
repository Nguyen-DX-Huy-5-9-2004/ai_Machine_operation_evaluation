import type { MachineDetailResponse, ActionLevel, MachineStatusType, KwhSource } from '../types/machineDetail';
import type { MachineSummary } from '../types/runtimeApi';

type Row = Record<string, unknown>;
type RawDetail = { meta: Row; summary: Row; timeline: Row[]; l1: Row[]; l2: Row[]; energy: Row; analysis: Row; performance: Row; events: Row[] };
const num = (value: unknown): number | null => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const pct = (value: unknown): number | null => { const v = num(value); return v == null ? null : v * 100; };
const text = (value: unknown, fallback = 'Not available') => value == null || value === '' ? fallback : String(value);
const action = (value: unknown): ActionLevel => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(String(value)) ? String(value) as ActionLevel : 'NORMAL';
const duration = (seconds: unknown) => { const value = num(seconds); if (value == null) return 'Not available'; const s = Math.max(0, Math.round(value)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const status = (row: Row): MachineStatusType => row.data_quality_issue_flag ? 'DATA_ISSUE' : action(row.operational_action_level) === 'CRITICAL' ? 'FAULT' : 'ON_LOADED';
const time = (value: unknown) => { const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? text(value) : date.toLocaleString(); };
const finite = (value: number | null, fallback = 'Not available') => value == null ? fallback : value;

export function adaptApiMachineDetail(rawValue: Record<string, unknown>, machine: MachineSummary): MachineDetailResponse {
  const raw = rawValue as unknown as RawDetail;
  const s = raw.summary;
  const risk = pct(s.operational_overall_risk_score);
  const l2Values = ['risk_fault_10_events','risk_fault_30_events','risk_fault_30min','risk_fault_60min','risk_maintenance_30_events','risk_repair_30_events']
    .map((key) => pct(s[key]))
    .filter((value): value is number => value != null);
  const l2Risk = l2Values.length ? Math.max(...l2Values) : null;
  const energySeries = Array.isArray(raw.energy.series) ? raw.energy.series as Row[] : [];
  const eventCount = num(raw.energy.eventCount) ?? 0;
  const loaded = num(raw.performance.loadedDuration); const noLoad = num(raw.performance.noLoadDuration); const off = num(raw.performance.offDuration);
  const durationTotal = (loaded ?? 0) + (noLoad ?? 0) + (off ?? 0);
  const ratio = (value: number | null) => durationTotal > 0 && value != null ? Number((value / durationTotal * 100).toFixed(2)) : null;
  return {
    machine: { machineId: String(machine.machineId), machineName: machine.displayCode, locationName: machine.locationId == null ? 'Not available' : `Location ${machine.locationId}`, machineGroup: machine.machineGroupId == null ? 'Not available' : `Group ${machine.machineGroupId}`, currentStatus: `Status ${text(s.status_id)}`, isActive: true, isRunning: s.policy_ready_flag === true, lastUpdated: time(s.event_start_time) },
    kpis: [
      { key: 'action', label: 'Operational action', value: text(s.operational_action_level), level: action(s.operational_action_level), sourceField: 'operational_action_level' },
      { key: 'risk', label: 'Overall risk', value: finite(risk), suffix: risk == null ? undefined : '%', sourceField: 'operational_overall_risk_score' },
      { key: 'readiness', label: 'L1 readiness', value: s.l1_score_available_flag ? 'Ready' : 'Historical L1 window unavailable', subLabel: text(s.readiness_reason), sourceField: 'readiness_reason' },
      { key: 'l1', label: 'L1 combined score', value: finite(pct(s.behavior_combined_score)), suffix: s.behavior_combined_score == null ? undefined : '%', sourceField: 'behavior_combined_score' },
      { key: 'l2', label: 'Max L2 probability', value: finite(l2Risk), suffix: l2Risk == null ? undefined : '%', sourceField: 'six L2 probabilities' },
      { key: 'quality', label: 'Quality action', value: text(s.quality_action_level), sourceField: 'quality_action_level' },
    ],
    timeline: raw.timeline.map((row) => ({ id: text(row.event_uid), start: time(row.event_start_time), end: time(row.event_end_time ?? row.event_start_time), status: status(row), label: `Status ${text(row.status_id)}`, durationMin: (num(row.duration_sec) ?? 0) / 60, riskScore: pct(row.operational_overall_risk_score) ?? undefined, flags: [text(row.readiness_reason)] })),
    markers: raw.timeline.filter((row) => action(row.operational_action_level) !== 'LOW').map((row) => ({ id: text(row.event_uid), time: time(row.event_start_time), type: 'fault' as const, label: text(row.operational_action_level), severity: action(row.operational_action_level) })),
    l1Series: [],
    riskSeries: raw.l2.filter((row) => row.l2_ready_flag === true).map((row) => ({ time: time(row.event_start_time), faultRisk: Math.max(pct(row.risk_fault_10_events) ?? 0, pct(row.risk_fault_30_events) ?? 0, pct(row.risk_fault_30min) ?? 0, pct(row.risk_fault_60min) ?? 0), maintenanceRisk: pct(row.risk_maintenance_30_events) ?? 0, repairRisk: pct(row.risk_repair_30_events) ?? 0 })),
    kwhDeltaSeries: energySeries.filter((row) => num(row.kwh_delta) != null).map((row) => ({ time: time(row.event_start_time), kwhDelta: num(row.kwh_delta)!, actualKwh: num(row.kwh_delta) ?? undefined, qualityScore: row.kwh_available_flag ? 100 : 0 })),
    loadedKwhSeries: energySeries.filter((row) => row.loaded_zero_kwh_flag || row.loaded_without_kwh_flag).map((row) => ({ time: time(row.event_start_time), kwhDelta: num(row.kwh_delta) ?? 0, actualKwh: num(row.kwh_delta) ?? undefined, loaded: 1, qualityScore: row.kwh_available_flag ? 100 : 0 })),
    energySummary: { kwhAvailability: { rawPct: pct(raw.energy.kwhAvailabilityRate) ?? 0, imputedPct: pct(raw.energy.kwhImputedRate) ?? 0, missingPct: pct(raw.energy.kwhMissingRate) ?? 0 }, kwhDelta24h: num(raw.energy.totalKwhDelta) ?? 0, kwhDeltaMax: energySeries.reduce((m, r) => Math.max(m, num(r.kwh_delta) ?? -Infinity), 0), kwhDeltaMin: energySeries.reduce((m, r) => Math.min(m, num(r.kwh_delta) ?? Infinity), 0), kwhRateAvg: num(raw.energy.averageKwhRate) ?? 0, kwhRatePeak: energySeries.reduce((m, r) => Math.max(m, num(r.kwh_rate_per_hour) ?? -Infinity), 0), kwhRateLow: energySeries.reduce((m, r) => Math.min(m, num(r.kwh_rate_per_hour) ?? Infinity), 0), energyConsistencyScore: eventCount ? Number((100 - (num(raw.energy.energyInconsistencyCount) ?? 0) / eventCount * 100).toFixed(2)) : 0, dataQualityScore: eventCount ? Number(((num(raw.energy.kwhAvailabilityRate) ?? 0) * 100).toFixed(2)) : 0, kwhSource: ((num(raw.energy.kwhImputedRate) ?? 0) > 0 ? 'MIXED_RAW_FILL' : 'RAW') as KwhSource, loadedZeroKwhEvents: num(raw.energy.loadedZeroKwhCount) ?? 0, negativeKwhEvents: num(raw.energy.negativeCount) ?? 0, missingKwhPct: pct(raw.energy.kwhMissingRate) ?? 0 },
    recentEvents: raw.events.map((row) => ({ eventId: text(row.event_id), eventTime: time(row.event_start_time), status: status(row), duration: duration(row.duration_sec), kwhDelta: num(row.kwh_delta), kwhSource: row.kwh_delta == null ? 'MISSING' : 'RAW', gapFromPrev: duration(row.gap_from_prev_sec), actionLevel: action(row.operational_action_level), l1Result: row.is_behavior_anomaly ? 'Anomaly' : text(row.readiness_reason), quality: pct(row.quality_risk_score) ?? 0, finalReason: text(row.final_reason_v2) })),
    operationalEvidence: [{ id: 'action', label: 'Operational judgment', description: text(s.operational_judgment), value: text(s.operational_action_level), level: action(s.operational_action_level), sourceField: 'operational_judgment' }],
    energyDataEvidence: [{ id: 'quality', label: 'Data and energy quality', description: text(s.quality_judgment), value: text(s.quality_action_level), level: s.data_quality_issue_flag ? 'WARNING' : 'INFO', sourceField: 'quality_judgment' }],
    aiDecisionSteps: [{ id: 'policy', title: 'Policy v2 result', value: text(s.operational_action_level), level: action(s.operational_action_level), description: text(s.final_reason_v2), sourceFields: ['operational_action_level','final_reason_v2'] }],
    aiContributions: [], performanceSeries: [],
    performanceSummary: { loadedPct: ratio(loaded), noLoadPct: ratio(noLoad), offPct: ratio(off), avgEventDurationMin: num(raw.performance.averageEventDuration) == null ? null : num(raw.performance.averageEventDuration)! / 60, transitionCount: num(raw.performance.eventCount), abnormalDurationEvents: num(raw.performance.abnormalDurationCount), bigGapEvents: num(raw.performance.bigGapCount), throughputIndex: null },
    maintenanceTasks: [], maintenanceSignals: [{ label: 'Maintenance risk', value: `${pct(s.risk_maintenance_30_events)?.toFixed(2) ?? 'Not available'}%`, level: action(s.operational_action_level), description: 'Model risk only; no confirmed maintenance-history event join.' }, { label: 'Repair risk', value: `${pct(s.risk_repair_30_events)?.toFixed(2) ?? 'Not available'}%`, level: action(s.operational_action_level), description: 'Model risk only; no confirmed repair-history event join.' }],
    finalReason: { text: text(s.final_reason_v2), actionLevel: action(s.operational_action_level), confidencePct: risk, l1Score: pct(s.behavior_combined_score), l2Confidence: l2Risk },
    apiMeta: { mode: 'api', generatedAt: text(raw.meta.generatedAt), policyVersion: text(raw.meta.policyVersion), runId: text(raw.meta.l2RunId) },
  };
}
