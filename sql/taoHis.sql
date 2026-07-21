IF OBJECT_ID('dbo.ai_l2_dashboard_event_core_v2', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l2_dashboard_event_core_v2;
GO

CREATE TABLE dbo.ai_l2_dashboard_event_core_v2
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

    risk_fault_10_events FLOAT NULL,
    risk_fault_30_events FLOAT NULL,
    risk_fault_30min FLOAT NULL,
    risk_fault_60min FLOAT NULL,
    risk_maintenance_30_events FLOAT NULL,
    risk_repair_30_events FLOAT NULL,

    policy_pred_fault_10_events BIT NULL,
    policy_pred_fault_30_events BIT NULL,
    policy_pred_fault_30min BIT NULL,
    policy_pred_fault_60min BIT NULL,
    policy_pred_maintenance_30_events BIT NULL,
    policy_pred_repair_30_events BIT NULL,

    operational_action_level NVARCHAR(50) NULL,
    operational_judgment NVARCHAR(100) NULL,
    operational_fault_confidence_score FLOAT NULL,
    operational_maintenance_confidence_score FLOAT NULL,
    operational_repair_confidence_score FLOAT NULL,
    operational_overall_risk_score FLOAT NULL,

    quality_action_level NVARCHAR(50) NULL,
    quality_judgment NVARCHAR(100) NULL,
    quality_risk_score FLOAT NULL,
    data_quality_issue_flag BIT NULL,
    energy_inconsistency_flag BIT NULL,
    kwh_quality_issue_flag BIT NULL,
    time_quality_issue_flag BIT NULL,

    is_behavior_anomaly BIT NULL,
    is_sensitive_warning BIT NULL,
    behavior_anomaly_score FLOAT NULL,
    behavior_sensitive_score FLOAT NULL,
    behavior_combined_score FLOAT NULL,

    policy_version NVARCHAR(200) NULL,
    l2_run_id NVARCHAR(100) NULL,
    split NVARCHAR(20) NULL
);
GO