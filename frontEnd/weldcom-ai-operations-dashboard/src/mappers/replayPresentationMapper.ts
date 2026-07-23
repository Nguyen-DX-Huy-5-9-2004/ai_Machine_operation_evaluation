import type { DashboardPayload, OperationalAlertRow, RiskDistributionLevel, RiskLevel } from '../types/dashboard';
import type { ActionLevel, KwhPoint, MachineDetailResponse, MachineStatusType, RiskPoint, TimelineMarker, TimelineSegment } from '../types/machineDetail';
import type { ReplayEvent } from '../types/replay';
import { explainL1Vietnamese, explainL2Vietnamese, explainPolicyVietnamese, explainRawPolicyReasonVietnamese } from '../utils/machineAiExplanation';

const action = (value: unknown): ActionLevel => {
  const normalized = String(value ?? '').toUpperCase();
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(normalized) ? normalized as ActionLevel : 'NORMAL';
};
const riskLevel = (value: unknown): RiskLevel => {
  const normalized = action(value);
  return normalized === 'CRITICAL' ? 'Critical' : normalized === 'HIGH' ? 'High' : normalized === 'MEDIUM' ? 'Medium' : 'Low';
};
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const percent = (value: unknown) => {
  const raw = number(value);
  return Math.round((Math.abs(raw) <= 1 ? raw * 100 : raw) * 10) / 10;
};
// The L1 artifact may expose a threshold-relative score greater than one.
// Keep the raw score in the event payload; render an operator index in 0..100.
const l1DisplayScore = (value: unknown) => Math.round(Math.min(1, Math.max(0, number(value))) * 1000) / 10;
const flag = (value: unknown) => value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
// File-first replay publishes `l1_score_available_flag`; older audit payloads
// used `l1_ready_flag`. Support both without treating a scored event as absent.
const l1Ready = (event: ReplayEvent) => flag(event.l1_score_available_flag ?? event.l1_ready_flag);
const operationalRiskReady = (event: ReplayEvent) => l1Ready(event) && flag(event.l2_ready_flag) && flag(event.policy_ready_flag);
const timestamp = (event: ReplayEvent) => String(event.source_event_start_time ?? '');
const localized = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};
const chartTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const duration = (seconds: unknown) => {
  const total = Math.max(0, Math.round(number(seconds)));
  return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const maxRisk = (event: ReplayEvent) => Math.max(
  percent(event.risk_fault_10_events), percent(event.risk_fault_30_events), percent(event.risk_fault_30min),
  percent(event.risk_fault_60min), percent(event.risk_maintenance_30_events), percent(event.risk_repair_30_events),
);

function replayStatus(event: ReplayEvent): MachineStatusType {
  if (flag(event.has_error_token) || String(event.status_type_label ?? '').toUpperCase().includes('FAULT')) return 'FAULT';
  if (flag(event.has_maintenance_token) || String(event.status_type_label ?? '').toUpperCase().includes('MAINTENANCE')) return 'MAINTENANCE';
  if (flag(event.is_loaded)) return 'ON_LOADED';
  if (flag(event.is_no_load)) return 'ON_NO_LOAD';
  const status = number(event.status_id, -1);
  if ([8, 9, 10].includes(status)) return 'OFF';
  if ([2, 4, 6].includes(status)) return 'ON_NO_LOAD';
  return 'ON_LOADED';
}

function trendBuckets(events: ReplayEvent[]) {
  const buckets = new Map<number, ReplayEvent[]>();
  for (const event of events) {
    const key = number(event.replay_sequence, 0);
    const current = buckets.get(key) ?? [];
    current.push(event); buckets.set(key, current);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).slice(-60).map(([sequence, group]) => {
    const risks = group.map((event) => percent(event.operational_overall_risk_score));
    const leading = [...group].sort((left, right) => percent(right.operational_overall_risk_score) - percent(left.operational_overall_risk_score))[0];
    return {
      label: `Batch ${sequence}`,
      date: timestamp(group[group.length - 1]),
      avgRiskScore: Number((risks.reduce((sum, value) => sum + value, 0) / Math.max(1, risks.length)).toFixed(1)),
      criticalCount: group.filter((event) => action(event.operational_action_level) === 'CRITICAL').length,
      highCount: group.filter((event) => action(event.operational_action_level) === 'HIGH').length,
      topMachine: leading ? `Machine ${leading.machine_id}` : 'N/A',
    };
  });
}

function replayAlert(event: ReplayEvent): OperationalAlertRow {
  const fault = percent(event.risk_fault_30min);
  const maintenance = percent(event.risk_maintenance_30_events);
  const repair = percent(event.risk_repair_30_events);
  const qualityIssue = flag(event.data_quality_issue_flag);
  return {
    id: event.event_uid,
    machineId: String(event.machine_id), machineName: String(event.machine_call_name ?? `Machine ${event.machine_id}`), locationName: event.location_id == null ? 'Replay source' : `Location ${event.location_id}`,
    operationalActionLevel: riskLevel(event.operational_action_level), qualityActionLevel: qualityIssue ? 'Medium' : 'Low',
    operationalJudgment: String(event.operational_judgment ?? event.operational_action_level ?? 'Review'),
    riskFault30Min: fault, riskFault60Min: percent(event.risk_fault_60min), riskMaintenance30Events: maintenance, riskRepair30Events: repair,
    qualityJudgment: qualityIssue ? 'Review' : 'Pass', l1Anomaly: flag(event.is_behavior_anomaly) ? 'Anomaly' : event.behavior_anomaly_score == null ? 'No Data' : 'Normal',
    finalReasonV2: explainRawPolicyReasonVietnamese(String(event.final_reason_v2 ?? event.final_reason ?? '')), eventStartTime: timestamp(event),
    faultRiskSeries: [fault], maintenanceRiskSeries: [maintenance], repairRiskSeries: [repair], operationalOverallRiskScore: percent(event.operational_overall_risk_score),
    dataQualityIssueFlag: qualityIssue, qualityRiskScore: qualityIssue ? 100 : 0, behaviorAnomalyScore: percent(event.behavior_anomaly_score),
    isBehaviorAnomaly: flag(event.is_behavior_anomaly), isSensitiveDeviation: flag(event.is_sensitive_warning), l1WindowAvailable: l1Ready(event), operationalFaultConfidenceScore: fault,
  };
}

/** Overlay bounded file-only replay output on a SQL dashboard without changing the SQL provider. */
export function mergeReplayDashboard(base: DashboardPayload, events: ReplayEvent[]): DashboardPayload {
  if (!events.length) return base;
  const latestByMachine = new Map<number, ReplayEvent>();
  events.forEach((event) => latestByMachine.set(event.machine_id, event));
  const latest = [...latestByMachine.values()];
  const levels: Record<RiskLevel, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  // A risk slice represents an operational Policy v2 result. L1-only rows or
  // L2-unready rows remain visible as No Data instead of being mislabeled Low.
  const eligibleLatest = latest.filter(operationalRiskReady);
  eligibleLatest.forEach((event) => { levels[riskLevel(event.operational_action_level)] += 1; });
  const scopedTotal = base.riskDistribution.reduce((sum, item) => sum + item.value, 0) || base.plantStatus.totalMachines || latest.length;
  const noData = Math.max(0, scopedTotal - eligibleLatest.length);
  const total = Math.max(1, scopedTotal);
  const allRisk = events.map((event) => percent(event.operational_overall_risk_score));
  const latestEvent = events[events.length - 1];
  const active = latest.filter((event) => replayStatus(event) === 'ON_LOADED').length;
  const highEvents = events.filter((event) => ['CRITICAL', 'HIGH'].includes(action(event.operational_action_level))).length;
  const qualityEvents = events.filter((event) => flag(event.data_quality_issue_flag)).length;
  const maintenanceMachines = latest.filter((event) => Math.max(percent(event.risk_maintenance_30_events), percent(event.risk_repair_30_events)) >= 50).length;
  const kpiValue = (current: DashboardPayload['kpis'], id: string, value: string | number, subtitle: string, series: number[]) => current.map((kpi) => kpi.id === id ? { ...kpi, value, subtitle, series } : kpi);
  let kpis = kpiValue(base.kpis, 'operationalRiskScore', Number((allRisk.reduce((sum, value) => sum + value, 0) / Math.max(1, allRisk.length)).toFixed(1)), 'Live replay average', allRisk.slice(-24));
  kpis = kpiValue(kpis, 'totalActiveMachines', active, `${active}/${scopedTotal} monitored machines`, latest.map((event) => replayStatus(event) === 'ON_LOADED' ? 1 : 0));
  kpis = kpiValue(kpis, 'criticalHighAlertMachines', highEvents, 'Live high / critical replay events', events.slice(-24).map((event) => ['CRITICAL', 'HIGH'].includes(action(event.operational_action_level)) ? 1 : 0));
  kpis = kpiValue(kpis, 'dataQualityIssueEvents', qualityEvents, 'Live replay data-quality flags', events.slice(-24).map((event) => flag(event.data_quality_issue_flag) ? 1 : 0));
  kpis = kpiValue(kpis, 'maintenanceRiskMachines', maintenanceMachines, 'Latest replay maintenance / repair risk', latest.map((event) => Math.max(percent(event.risk_maintenance_30_events), percent(event.risk_repair_30_events))));
  const replayAlerts = [...events].reverse().slice(0, 80).map(replayAlert);
  const seen = new Set(replayAlerts.map((row) => row.id));
  const qualityTrend = trendBuckets(events).map((point) => {
    const bucket = events.filter((event) => number(event.replay_sequence) === Number(point.label.replace('Batch ', '')));
    return {
      label: point.date,
      checkData: bucket.filter((event) => flag(event.data_quality_issue_flag) && !flag(event.energy_inconsistency_flag)).length,
      checkEnergy: bucket.filter((event) => !flag(event.data_quality_issue_flag) && flag(event.energy_inconsistency_flag)).length,
      checkDataAndEnergy: bucket.filter((event) => flag(event.data_quality_issue_flag) && flag(event.energy_inconsistency_flag)).length,
      qualityOk: bucket.filter((event) => !flag(event.data_quality_issue_flag) && !flag(event.energy_inconsistency_flag)).length,
    };
  });
  return {
    ...base, kpis,
    riskDistribution: ([
      ...(Object.keys(levels) as RiskLevel[]).map((level) => ({ level, value: levels[level], percent: Number((levels[level] / total * 100).toFixed(1)), color: '', sourceField: 'operational_action_level' as const })),
      { level: 'No Data' as RiskDistributionLevel, value: noData, percent: Number((noData / total * 100).toFixed(1)), color: '', sourceField: 'policy_ready_flag' as const },
    ]),
    riskTrend: trendBuckets(events),
    topMachines: latest.sort((left, right) => maxRisk(right) - maxRisk(left)).slice(0, 10).map((event) => ({ machineId: String(event.machine_id), machineName: String(event.machine_call_name ?? `Machine ${event.machine_id}`), locationName: event.location_id == null ? 'Replay source' : `Location ${event.location_id}`, riskScore: percent(event.operational_overall_risk_score), criticalCount: action(event.operational_action_level) === 'CRITICAL' ? 1 : 0, maintenanceRisk: percent(event.risk_maintenance_30_events), dataQualityIssueScore: flag(event.data_quality_issue_flag) ? 100 : 0, operationalActionLevel: riskLevel(event.operational_action_level) })),
    l1Anomaly: { ...base.l1Anomaly, normal: events.filter((event) => l1Ready(event) && event.behavior_anomaly_score != null && !flag(event.is_behavior_anomaly)).length, anomaly: events.filter((event) => l1Ready(event) && flag(event.is_behavior_anomaly)).length, noData: events.filter((event) => !l1Ready(event)).length, total: events.length, spark: events.slice(-30).map((event) => percent(event.behavior_anomaly_score)) },
    l2FaultConfidence: { ...base.l2FaultConfidence, high: events.filter((event) => maxRisk(event) >= 80).length, medium: events.filter((event) => maxRisk(event) >= 50 && maxRisk(event) < 80).length, low: events.filter((event) => maxRisk(event) < 50).length, total: events.length, spark: events.slice(-30).map(maxRisk) },
    qualityIssueTrend: qualityTrend,
    operationalAlerts: [...replayAlerts, ...base.operationalAlerts.filter((row) => !seen.has(row.id))].slice(0, 80),
    lastUpdated: timestamp(latestEvent) || base.lastUpdated,
    plantStatus: { ...base.plantStatus, activeMachines: active, totalMachines: scopedTotal, dataPipeline: 'Healthy' },
  };
}

/**
 * Replay timestamps belong to a separate historical window from the bounded
 * SQL detail response. While replay is active its stream is the canonical
 * timeline; combining both made a chronological chart look static and dense.
 */
export function mergeReplayMachineDetail(base: MachineDetailResponse, events: ReplayEvent[]): MachineDetailResponse {
  if (!events.length) return base;
  const incoming = [...events].sort((left, right) => number(left.replay_sequence) - number(right.replay_sequence));
  if (!incoming.length) return base;
  const timeline: TimelineSegment[] = incoming.map((event) => ({ id: event.event_uid, start: localized(timestamp(event)), end: localized(String(event.event_end_time ?? timestamp(event))), status: replayStatus(event), label: String(event.status_type_label ?? `Status ${event.status_id ?? ''}`), durationMin: Math.max(0.05, number(event.duration_sec, 1) / 60), riskScore: maxRisk(event), flags: [String(event.readiness_reason ?? 'READY')] })).slice(-240);
  const markers: TimelineMarker[] = incoming.flatMap((event) => {
    const result: TimelineMarker[] = [];
    const shared = { time: localized(timestamp(event)), severity: action(event.operational_action_level) };
    if (replayStatus(event) === 'FAULT') result.push({ ...shared, id: `${event.event_uid}:fault`, type: 'fault', label: 'Fault state' });
    if (replayStatus(event) === 'MAINTENANCE') result.push({ ...shared, id: `${event.event_uid}:maintenance`, type: 'maintenance', label: 'Maintenance state' });
    if (flag(event.data_quality_issue_flag)) result.push({ ...shared, id: `${event.event_uid}:quality`, type: 'quality', label: 'Data quality issue' });
    if (flag(event.energy_inconsistency_flag)) result.push({ ...shared, id: `${event.event_uid}:energy`, type: 'energy', label: 'Energy inconsistency' });
    return result;
  }).slice(-80);
  const l1 = incoming.filter((event) => event.behavior_anomaly_score != null).map((event) => ({ time: chartTime(timestamp(event)), timestamp: localized(timestamp(event)), score: l1DisplayScore(event.behavior_anomaly_score), rawScore: number(event.behavior_anomaly_score), anomalyThreshold: 76, warningThreshold: 40, eventId: event.event_uid, status: flag(event.is_behavior_anomaly) ? 'Anomaly' : flag(event.is_sensitive_warning) ? 'Sensitive warning' : 'Normal' })).slice(-180);
  const risks: RiskPoint[] = incoming.filter((event) => flag(event.l2_ready_flag)).map((event) => ({ time: chartTime(timestamp(event)), timestamp: localized(timestamp(event)), faultRisk: Math.max(percent(event.risk_fault_10_events), percent(event.risk_fault_30_events), percent(event.risk_fault_30min), percent(event.risk_fault_60min)), maintenanceRisk: percent(event.risk_maintenance_30_events), repairRisk: percent(event.risk_repair_30_events) })).slice(-180);
  const kwh = (event: ReplayEvent): KwhPoint => {
    const modelDelta = number(event.kwh_delta_model_value, number(event.kwh_delta));
    return { time: chartTime(timestamp(event)), timestamp: localized(timestamp(event)), kwhDelta: modelDelta, actualKwh: number(event.kwh_delta), expectedKwh: modelDelta, loaded: replayStatus(event) === 'ON_LOADED' ? 1 : 0, qualityScore: flag(event.kwh_available_flag) ? 100 : 0 };
  };
  const kwhRows = incoming.filter((event) => event.kwh_delta != null || event.kwh_delta_model_value != null).map(kwh);
  const latest = incoming[incoming.length - 1];
  const l1Score = l1DisplayScore(latest.behavior_anomaly_score);
  const l2Score = maxRisk(latest);
  const policyText = explainPolicyVietnamese({ l1Score, l2Risk: l2Score, actionLevel: String(latest.operational_action_level ?? ''), operationalJudgment: String(latest.operational_judgment ?? ''), qualityJudgment: String(latest.quality_judgment ?? ''), qualityIssue: flag(latest.data_quality_issue_flag), energyIssue: flag(latest.energy_inconsistency_flag), readyReason: String(latest.readiness_reason ?? ''), rawReason: String(latest.final_reason_v2 ?? latest.final_reason ?? '') });
  const recent = [...incoming].reverse().map((event) => ({ eventId: String(event.event_id), eventTime: localized(timestamp(event)), status: flag(event.data_quality_issue_flag) ? 'DATA_ISSUE' as const : replayStatus(event), duration: duration(event.duration_sec), kwhDelta: number(event.kwh_delta_model_value, number(event.kwh_delta)), kwhSource: flag(event.kwh_missing_flag) ? 'MISSING' as const : flag(event.kwh_imputed_flag) ? 'IMPUTED' as const : 'RAW' as const, gapFromPrev: duration(event.gap_from_prev_sec), actionLevel: action(event.operational_action_level), l1Result: flag(event.is_behavior_anomaly) ? 'Anomaly' : String(event.readiness_reason ?? 'READY'), quality: flag(event.data_quality_issue_flag) ? 100 : 0, finalReason: explainRawPolicyReasonVietnamese(String(event.final_reason_v2 ?? event.final_reason ?? '')) }));
  const updateKpi = (key: string, value: string | number, subLabel?: string) => base.kpis.map((kpi) => kpi.key === key ? { ...kpi, value, subLabel: subLabel ?? kpi.subLabel, trend: key === 'l1' ? l1.slice(-24).map((point) => point.score) : key === 'risk30' ? risks.slice(-24).map((point) => point.faultRisk) : kpi.trend } : kpi);
  let kpis = updateKpi('status', flag(latest.data_quality_issue_flag) ? 'DATA ISSUE' : replayStatus(latest).replace(/_/g, ' '), flag(latest.policy_ready_flag) ? 'Policy ready' : String(latest.readiness_reason ?? 'Not ready'));
  kpis = updateKpi('risk30', percent(latest.risk_fault_30min), 'Live replay risk');
  kpis = updateKpi('l1', l1Score, flag(latest.is_behavior_anomaly) ? 'Anomaly' : 'Within production threshold');
  kpis = updateKpi('l2', l2Score, 'Across six production targets');
  kpis = updateKpi('quality', String(latest.quality_action_level ?? 'QUALITY_OK'), String(latest.quality_judgment ?? 'Pass'));
  return {
    ...base,
    machine: { ...base.machine, currentStatus: replayStatus(latest).replace(/_/g, ' '), lastUpdated: localized(timestamp(latest)) },
    kpis, timeline, markers, l1Series: l1, riskSeries: risks,
    kwhDeltaSeries: kwhRows.slice(-180), loadedKwhSeries: kwhRows.slice(-180),
    recentEvents: recent.slice(0, 50),
    operationalEvidence: base.operationalEvidence.map((item) => item.id === 'action' ? { ...item, value: String(latest.operational_action_level ?? 'NORMAL'), description: policyText, level: action(latest.operational_action_level) } : item.id === 'l1' ? { ...item, value: `${l1Score}%`, description: explainL1Vietnamese(l1Score, flag(latest.is_behavior_anomaly), flag(latest.is_sensitive_warning), String(latest.readiness_reason ?? 'READY')) } : item.id === 'fault' ? { ...item, value: `${l2Score}%`, description: explainL2Vietnamese(l2Score) } : item),
    finalReason: { text: policyText, actionLevel: action(latest.operational_action_level), confidencePct: percent(latest.operational_overall_risk_score), l1Score, l2Confidence: l2Score },
    apiMeta: { ...base.apiMeta, generatedAt: localized(timestamp(latest)) },
  };
}
