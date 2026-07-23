import { describe, expect, it } from 'vitest';
import { mergeReplayDashboard, mergeReplayMachineDetail } from './replayPresentationMapper';
import type { DashboardPayload } from '../types/dashboard';
import type { MachineDetailResponse } from '../types/machineDetail';
import type { ReplayEvent } from '../types/replay';

const events: ReplayEvent[] = [
  { event_id: 1, event_uid: 'HISTORICAL_REPLAY:test:1', replay_sequence: 1, machine_id: 11, source_event_start_time: '2025-10-24T09:05:00Z', is_loaded: 1, behavior_anomaly_score: 0.12, l1_ready_flag: 1, l2_ready_flag: 1, policy_ready_flag: 1, risk_fault_30min: 0.08, risk_maintenance_30_events: 0.04, risk_repair_30_events: 0.03, operational_overall_risk_score: 0.09, operational_action_level: 'LOW', quality_action_level: 'QUALITY_OK', kwh_delta: 0.2, kwh_delta_model_value: 0.2 },
  { event_id: 2, event_uid: 'HISTORICAL_REPLAY:test:2', replay_sequence: 2, machine_id: 12, source_event_start_time: '2025-10-24T09:10:00Z', is_no_load: 1, behavior_anomaly_score: 0.82, is_behavior_anomaly: 1, l1_ready_flag: 1, l2_ready_flag: 1, policy_ready_flag: 1, risk_fault_30min: 0.7, risk_maintenance_30_events: 0.2, risk_repair_30_events: 0.1, operational_overall_risk_score: 0.72, operational_action_level: 'HIGH', data_quality_issue_flag: 1, quality_action_level: 'CHECK_DATA', kwh_delta: -0.1, kwh_delta_model_value: -0.1 },
];

const dashboard = { kpis: [{ id: 'operationalRiskScore', title: '', value: 0, subtitle: '', trend: 0, trendLabel: '', tone: 'purple', icon: '', series: [], sourceField: '' }, { id: 'totalActiveMachines', title: '', value: 0, subtitle: '', trend: 0, trendLabel: '', tone: 'blue', icon: '', series: [], sourceField: '' }, { id: 'criticalHighAlertMachines', title: '', value: 0, subtitle: '', trend: 0, trendLabel: '', tone: 'red', icon: '', series: [], sourceField: '' }, { id: 'dataQualityIssueEvents', title: '', value: 0, subtitle: '', trend: 0, trendLabel: '', tone: 'orange', icon: '', series: [], sourceField: '' }, { id: 'maintenanceRiskMachines', title: '', value: 0, subtitle: '', trend: 0, trendLabel: '', tone: 'green', icon: '', series: [], sourceField: '' }], riskDistribution: [], riskTrend: [], topMachines: [], l1Anomaly: { normal: 0, anomaly: 0, noData: 0, total: 0, spark: [], sourceFields: [] }, l2FaultConfidence: { high: 0, medium: 0, low: 0, total: 0, spark: [], sourceFields: [] }, qualityIssueTrend: [], dataQuality: [], operationalAlerts: [], lastUpdated: '', plantStatus: { plantName: '', status: 'Operational', activeMachines: 0, totalMachines: 0, dataPipeline: 'Healthy' } } as DashboardPayload;

const detail = { machine: { machineId: '11', machineName: 'M11', locationName: '', machineGroup: '', currentStatus: '', isActive: true, isRunning: true, lastUpdated: '' }, kpis: [], timeline: [], markers: [], l1Series: [], riskSeries: [], kwhDeltaSeries: [], loadedKwhSeries: [], energySummary: { kwhAvailability: { rawPct: 0, imputedPct: 0, missingPct: 0 }, kwhDelta24h: 0, kwhDeltaMax: 0, kwhDeltaMin: 0, kwhRateAvg: 0, kwhRatePeak: 0, kwhRateLow: 0, energyConsistencyScore: 0, dataQualityScore: 0, kwhSource: 'RAW', loadedZeroKwhEvents: 0, negativeKwhEvents: 0, missingKwhPct: 0 }, recentEvents: [], operationalEvidence: [], energyDataEvidence: [], aiDecisionSteps: [], aiContributions: [], performanceSeries: [], performanceSummary: { loadedPct: 0, noLoadPct: 0, offPct: 0, avgEventDurationMin: 0, transitionCount: 0, abnormalDurationEvents: 0, bigGapEvents: 0, throughputIndex: 0 }, maintenanceTasks: [], maintenanceSignals: [], finalReason: { text: '', actionLevel: 'NORMAL', confidencePct: 0, l1Score: 0, l2Confidence: 0 }, apiMeta: { mode: 'api', generatedAt: '' } } as MachineDetailResponse;

describe('replay presentation merge', () => {
  it('overlays multi-machine replay evidence on the dashboard', () => {
    const merged = mergeReplayDashboard(dashboard, events);
    expect(merged.riskTrend).toHaveLength(2);
    expect(merged.topMachines.map((item) => item.machineId)).toEqual(['12', '11']);
    expect(merged.operationalAlerts[0]?.id).toBe('HISTORICAL_REPLAY:test:2');
  });

  it('keeps the selected machine total and exposes unscored machines as No Data', () => {
    const scoped = { ...dashboard, riskDistribution: [{ level: 'Low' as const, value: 14, percent: 100, color: '', sourceField: 'operational_action_level' as const }] };
    // Current file-first batches use l1_score_available_flag rather than the
    // older l1_ready_flag name.
    const ready = { ...events[0], l1_ready_flag: undefined, l1_score_available_flag: 1 };
    const unready = { ...events[1], l1_ready_flag: undefined, l1_score_available_flag: 0, policy_ready_flag: 0 };
    const merged = mergeReplayDashboard(scoped, [ready, unready]);
    expect(merged.riskDistribution.reduce((sum, item) => sum + item.value, 0)).toBe(14);
    expect(merged.riskDistribution.find((item) => item.level === 'No Data')?.value).toBe(13);
    expect(merged.riskDistribution.find((item) => item.level === 'Low')?.value).toBe(1);
  });

  it('uses only the selected machine stream in detail and retains signed model KWh delta', () => {
    const merged = mergeReplayMachineDetail(detail, [events[0]]);
    expect(merged.timeline[0]?.status).toBe('ON_LOADED');
    expect(merged.l1Series[0]?.score).toBe(12);
    expect(merged.kwhDeltaSeries[0]?.kwhDelta).toBe(0.2);
  });

  it('uses replay chronology instead of mixing an unrelated SQL detail range and bounds L1 display scores', () => {
    const sqlRange = {
      ...detail,
      timeline: [{ id: 'SQL:future', start: '2026-06-19T12:00:00Z', end: '2026-06-19T12:05:00Z', status: 'OFF' as const, label: 'SQL range', durationMin: 5 }],
      l1Series: [{ time: '12:00', timestamp: '2026-06-19T12:00:00Z', score: 99, anomalyThreshold: 76, warningThreshold: 40 }],
    };
    const anomaly = { ...events[0], behavior_anomaly_score: 4.9, is_behavior_anomaly: 1 };
    const merged = mergeReplayMachineDetail(sqlRange, [anomaly]);
    expect(merged.timeline.map((item) => item.id)).toEqual([anomaly.event_uid]);
    expect(merged.l1Series[0]?.score).toBe(100);
    expect(merged.l1Series[0]?.rawScore).toBe(4.9);
  });
});
