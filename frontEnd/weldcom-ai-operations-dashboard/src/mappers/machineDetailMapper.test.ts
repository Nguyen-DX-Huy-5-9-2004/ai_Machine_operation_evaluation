import { describe, expect, it } from 'vitest';
import { adaptApiMachineDetail } from './machineDetailMapper';

const meta = { generatedAt: '2025-10-24T13:00:00', policyVersion: 'policy_v2_operational_quality_split_sensitive_audit_only', l2RunId: 'l2_multilabel_20260711_043347' };
const summary = {
  event_start_time: '2025-10-24T13:00:00', status_id: 3, policy_ready_flag: 1, l1_score_available_flag: 1, l2_ready_flag: 1,
  operational_action_level: 'HIGH', operational_judgment: 'Reduce speed', operational_overall_risk_score: 0.82,
  behavior_anomaly_score: 0.89, is_behavior_anomaly: 1, quality_action_level: 'CHECK_DATA', quality_judgment: 'Review data', data_quality_issue_flag: 1,
  risk_fault_10_events: 0.61, risk_fault_30_events: 0.67, risk_fault_30min: 0.71, risk_fault_60min: 0.55,
  risk_maintenance_30_events: 0.58, risk_repair_30_events: 0.42, energy_inconsistency_flag: 1, final_reason_v2: 'Fault risk requires operator review', readiness_reason: 'READY',
};

describe('Machine Detail API mapper', () => {
  it('maps real SQL field names into populated AI, energy, and maintenance tabs', () => {
    const result = adaptApiMachineDetail({
      meta, summary,
      timeline: [{ ...summary, event_uid: 'HISTORICAL_PRODUCTION_SCORE:1', event_id: 1, event_end_time: '2025-10-24T13:03:00', duration_sec: 180, gap_from_prev_sec: 0 }],
      l1: [{ event_uid: 'HISTORICAL_PRODUCTION_SCORE:1', event_start_time: '2025-10-24T13:00:00', behavior_anomaly_score: 0.89, is_behavior_anomaly: 1, l1_score_available_flag: 1 }],
      l2: [{ ...summary, event_uid: 'HISTORICAL_PRODUCTION_SCORE:1', l2_ready_flag: 1 }],
      energy: { eventCount: 1, kwhAvailabilityRate: 1, kwhImputedRate: 0, kwhMissingRate: 0, totalKwhDelta: -1.2, averageKwhRate: 4.5, series: [{ event_start_time: '2025-10-24T13:00:00', kwh_delta: -1.2, kwh_rate_per_hour: 4.5, kwh_available_flag: 1 }] },
      performance: { loadedDuration: 180, noLoadDuration: 0, offDuration: 0, averageEventDuration: 180, eventCount: 1, abnormalDurationCount: 0, bigGapCount: 0 },
      events: [{ ...summary, event_id: 1, event_start_time: '2025-10-24T13:00:00', duration_sec: 180, kwh_delta: -1.2 }],
      maintenance: [{ ...summary, event_start_time: '2025-10-24T13:00:00' }],
      analysis: {},
    }, { machineId: 50, displayCode: 'Machine 50', locationId: 1, machineGroupId: 2 });

    expect(result.l1Series).toHaveLength(1);
    expect(result.l1Series[0].score).toBe(89);
    expect(result.l1Series[0].anomalyThreshold).toBe(76);
    expect(result.riskSeries).toHaveLength(1);
    expect(result.riskSeries[0].faultRisk).toBe(71);
    expect(result.aiDecisionSteps).toHaveLength(4);
    expect(result.aiContributions.length).toBeGreaterThan(3);
    expect(result.maintenanceTasks).toHaveLength(2);
    expect(result.kwhDeltaSeries[0].kwhDelta).toBe(-1.2);
    expect(result.recentEvents).toHaveLength(1);
    expect(result.aiDecisionSteps[0].description).toContain('L1');
    expect(result.finalReason.text).toContain('Policy v2');
  });
});
