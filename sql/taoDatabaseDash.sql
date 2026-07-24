USE i26s02004_dat_dev;
GO

IF OBJECT_ID('dbo.ai_l2_fault_judgment_policy_v2_full', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l2_fault_judgment_policy_v2_full;
GO

CREATE TABLE dbo.ai_l2_fault_judgment_policy_v2_full
(
    event_id BIGINT NOT NULL,
    machine_id INT NULL,
    sequence_segment_id BIGINT NULL,
    event_order_in_segment BIGINT NULL,

    status_id INT NULL,
    status_type_code NVARCHAR(100) NULL,
    current_signal_code NVARCHAR(100) NULL,

    known_fault_status BIT NULL,
    known_maintenance_status BIT NULL,
    known_repair_status BIT NULL,
    off_with_fault_status BIT NULL,

    energy_inconsistency_flag BIT NULL,
    data_quality_issue_flag BIT NULL,
    data_quality_issue_count INT NULL,
    time_quality_issue_flag BIT NULL,
    kwh_quality_issue_flag BIT NULL,

    fault_evidence_count INT NULL,
    maintenance_evidence_count INT NULL,

    is_behavior_anomaly BIT NULL,
    is_sensitive_warning BIT NULL,

    behavior_anomaly_score FLOAT NULL,
    behavior_sensitive_score FLOAT NULL,
    behavior_combined_score FLOAT NULL,

    l1_behavior_anomaly_score_log FLOAT NULL,
    l1_behavior_sensitive_score_log FLOAT NULL,
    l1_behavior_combined_score_log FLOAT NULL,

    l1_score_available_flag BIT NULL,
    l1_join_missing_flag BIT NULL,

    risk_fault_10_events FLOAT NULL,
    pred_fault_10_events BIT NULL,
    threshold_fault_10_events FLOAT NULL,
    profile_fault_10_events NVARCHAR(100) NULL,

    risk_fault_30_events FLOAT NULL,
    pred_fault_30_events BIT NULL,
    threshold_fault_30_events FLOAT NULL,
    profile_fault_30_events NVARCHAR(100) NULL,

    risk_fault_30min FLOAT NULL,
    pred_fault_30min BIT NULL,
    threshold_fault_30min FLOAT NULL,
    profile_fault_30min NVARCHAR(100) NULL,

    risk_fault_60min FLOAT NULL,
    pred_fault_60min BIT NULL,
    threshold_fault_60min FLOAT NULL,
    profile_fault_60min NVARCHAR(100) NULL,

    risk_maintenance_30_events FLOAT NULL,
    pred_maintenance_30_events BIT NULL,
    threshold_maintenance_30_events FLOAT NULL,
    profile_maintenance_30_events NVARCHAR(100) NULL,

    risk_repair_30_events FLOAT NULL,
    pred_repair_30_events BIT NULL,
    threshold_repair_30_events FLOAT NULL,
    profile_repair_30_events NVARCHAR(100) NULL,

    model_fault_risk_score FLOAT NULL,
    model_maintenance_risk_score FLOAT NULL,
    model_repair_risk_score FLOAT NULL,

    fault_confidence_score FLOAT NULL,
    maintenance_confidence_score FLOAT NULL,
    repair_confidence_score FLOAT NULL,
    overall_operational_risk_score FLOAT NULL,

    fault_judgment NVARCHAR(100) NULL,
    action_level NVARCHAR(50) NULL,
    final_reason NVARCHAR(1000) NULL,

    l2_run_id NVARCHAR(100) NULL,
    l2_scored_time DATETIME2 NULL,
    split NVARCHAR(20) NULL,

    policy_threshold_fault_10_events FLOAT NULL,
    policy_pred_fault_10_events BIT NULL,

    policy_threshold_fault_30_events FLOAT NULL,
    policy_pred_fault_30_events BIT NULL,

    policy_threshold_fault_30min FLOAT NULL,
    policy_pred_fault_30min BIT NULL,

    policy_threshold_fault_60min FLOAT NULL,
    policy_pred_fault_60min BIT NULL,

    policy_threshold_maintenance_30_events FLOAT NULL,
    policy_pred_maintenance_30_events BIT NULL,

    policy_threshold_repair_30_events FLOAT NULL,
    policy_pred_repair_30_events BIT NULL,

    quality_judgment NVARCHAR(100) NULL,
    quality_action_level NVARCHAR(50) NULL,
    quality_risk_score FLOAT NULL,

    operational_action_level NVARCHAR(50) NULL,
    operational_judgment NVARCHAR(100) NULL,

    operational_fault_confidence_score FLOAT NULL,
    operational_maintenance_confidence_score FLOAT NULL,
    operational_repair_confidence_score FLOAT NULL,
    operational_overall_risk_score FLOAT NULL,

    action_level_v2 NVARCHAR(50) NULL,
    fault_judgment_v2 NVARCHAR(100) NULL,
    final_reason_v2 NVARCHAR(1000) NULL,

    policy_version NVARCHAR(200) NULL,
    policy_created_time DATETIME2 NULL
);
GO

-- Chạy TRƯỚC khi import:
ALTER INDEX ALL ON dbo.ai_l2_fault_judgment_policy_v2_full DISABLE;

-- (Chạy Script .bat ở trên)

-- Chạy SAU khi import xong:
ALTER INDEX ALL ON dbo.ai_l2_fault_judgment_policy_v2_full REBUILD;