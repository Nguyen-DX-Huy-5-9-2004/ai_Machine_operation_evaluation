import type { AiModelMonitorOverview, DataQualityCenterOverview, EnergyConsistencyOverview, RiskFaultAnalyticsOverview } from '../types/operationsPages';

export const mockDataQualityCenter: DataQualityCenterOverview = {
  distributions: [
    { label: 'CHECK_DATA', value: 37 },
    { label: 'CHECK_ENERGY', value: 42 },
    { label: 'CHECK_DATA_AND_ENERGY', value: 19 },
    { label: 'QUALITY_OK', value: 214 }
  ],
  issueTrend: [
    { label: 'May 12', time_quality_issue_flag: 9, kwh_quality_issue_flag: 18, energy_inconsistency_flag: 7 },
    { label: 'May 13', time_quality_issue_flag: 12, kwh_quality_issue_flag: 20, energy_inconsistency_flag: 10 }
  ],
  topMachines: [
    {
      machine_id: 'WLD-088',
      quality_action_level: 'High',
      quality_judgment: 'Review',
      quality_risk_score: 82,
      data_quality_issue_flag: true,
      time_quality_issue_flag: true,
      kwh_quality_issue_flag: true,
      energy_inconsistency_flag: false,
      gap_from_prev_sec: 420,
      overlap_sec: 0,
      end_time_source: 'imputed',
      kwh_start_source: 'model',
      kwh_end_source: 'missing'
    }
  ]
};

export const mockRiskFaultAnalytics: RiskFaultAnalyticsOverview = {
  riskWindows: [
    { machine_id: 'WLD-077', risk_fault_10_events: 86, risk_fault_30_events: 90, risk_fault_30min: 92, risk_fault_60min: 89, risk_maintenance_30_events: 76, risk_repair_30_events: 63 }
  ],
  modelSignals: [
    { target: 'fault', policy_pred: 0.92, policy_threshold: 0.78, operational_confidence_score: 92 },
    { target: 'maintenance', policy_pred: 0.76, policy_threshold: 0.72, operational_confidence_score: 76 },
    { target: 'repair', policy_pred: 0.63, policy_threshold: 0.70, operational_confidence_score: 63 }
  ]
};

export const mockEnergyConsistency: EnergyConsistencyOverview = {
  note: 'Cabinet daily KWh is location/cabinet-level context, not a direct machine-level bridge.',
  issues: [
    { machine_id: 'WLD-088', location_name: 'Line E / Cabinet 2', is_loaded: true, kwh_delta_model_value: 0, kwh_rate_per_hour: 0, loaded_zero_kwh_flag: true, loaded_without_kwh_flag: false, kwh_negative_delta_flag: false, energy_inconsistency_flag: true }
  ]
};

export const mockAiModelMonitor: AiModelMonitorOverview = {
  l2_run_id: 'l2-prod-20250518-1024',
  policy_version: 'policy-v2.8',
  split: 'production',
  l1AnomalyDistribution: [
    { label: 'Normal', value: 119 },
    { label: 'Anomaly', value: 4 },
    { label: 'Insufficient History', value: 5 }
  ],
  modelMetricsByTarget: [
    { target: 'fault', precision: 0.91, recall: 0.87, f1: 0.89, auc: 0.94 },
    { target: 'maintenance', precision: 0.84, recall: 0.79, f1: 0.81, auc: 0.9 },
    { target: 'repair', precision: 0.78, recall: 0.73, f1: 0.75, auc: 0.86 }
  ],
  featureImportanceSources: ['batch08_policy_metrics.csv', 'l2_feature_importance_all.csv', 'production_profile_selection.json'],
  runLog: [
    { timestamp: '2025-05-18T10:24:10+05:30', message: 'Inference run completed with strict warning rate 3.8%.', severity: 'info' }
  ]
};
