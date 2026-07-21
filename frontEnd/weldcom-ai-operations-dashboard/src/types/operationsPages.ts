export interface DataQualityCenterOverview {
  distributions: Array<{ label: 'CHECK_DATA' | 'CHECK_ENERGY' | 'CHECK_DATA_AND_ENERGY' | 'QUALITY_OK'; value: number }>;
  issueTrend: Array<{ label: string; time_quality_issue_flag: number; kwh_quality_issue_flag: number; energy_inconsistency_flag: number }>;
  topMachines: Array<{
    machine_id: string;
    quality_action_level: string;
    quality_judgment: string;
    quality_risk_score: number;
    data_quality_issue_flag: boolean;
    time_quality_issue_flag: boolean;
    kwh_quality_issue_flag: boolean;
    energy_inconsistency_flag: boolean;
    gap_from_prev_sec: number;
    overlap_sec: number;
    end_time_source: string;
    kwh_start_source: string;
    kwh_end_source: string;
  }>;
}

export interface RiskFaultAnalyticsOverview {
  riskWindows: Array<{
    machine_id: string;
    risk_fault_10_events: number;
    risk_fault_30_events: number;
    risk_fault_30min: number;
    risk_fault_60min: number;
    risk_maintenance_30_events: number;
    risk_repair_30_events: number;
  }>;
  modelSignals: Array<{
    target: string;
    policy_pred: number;
    policy_threshold: number;
    operational_confidence_score: number;
  }>;
}

export interface EnergyConsistencyOverview {
  note: string;
  issues: Array<{
    machine_id: string;
    location_name: string;
    is_loaded: boolean;
    kwh_delta_model_value: number;
    kwh_rate_per_hour: number;
    loaded_zero_kwh_flag: boolean;
    loaded_without_kwh_flag: boolean;
    kwh_negative_delta_flag: boolean;
    energy_inconsistency_flag: boolean;
  }>;
}

export interface AiModelMonitorOverview {
  l2_run_id: string;
  policy_version: string;
  split: string;
  l1AnomalyDistribution: Array<{ label: string; value: number }>;
  modelMetricsByTarget: Array<{ target: string; precision: number; recall: number; f1: number; auc?: number }>;
  featureImportanceSources: string[];
  runLog: Array<{ timestamp: string; message: string; severity: 'info' | 'warning' | 'error' }>;
}
