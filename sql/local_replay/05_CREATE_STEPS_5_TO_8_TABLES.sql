/*
WELDCOM AI LOCAL REPLAY — CREATE TABLES FOR STEPS 5 TO 8

Change the database name below only when your local database has another name.
This script is intentionally non-destructive:
- it never drops a table;
- it never truncates data;
- indexes are created by a separate post-import script.

Run sql/01_create_realtime_inference_tables.sql before this file so the four
runtime tables exist.
*/

USE [OBAD_AI_LOCAL];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.ai_l1_operation_event_sequence', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ai_l1_operation_event_sequence]
    (
        [event_id] BIGINT NOT NULL,
        [machine_id] INT NULL,
        [sequence_segment_id] BIGINT NULL,
        [event_order_in_segment] BIGINT NULL,
        [event_start_time] DATETIME2(7) NULL,
        [event_end_time] DATETIME2(7) NULL,
        [end_time_source] NVARCHAR(200) NULL,
        [duration_sec] FLOAT NULL,
        [gap_from_prev_sec] FLOAT NULL,
        [overlap_sec] FLOAT NULL,
        [status_id] INT NULL,
        [status_type_code] INT NULL,
        [is_on] BIT NULL,
        [current_signal_code] INT NULL,
        [is_loaded] BIT NULL,
        [is_no_load] BIT NULL,
        [is_current_near_zero] BIT NULL,
        [has_error_token] BIT NULL,
        [has_maintenance_token] BIT NULL,
        [raw_status_kwh_start] FLOAT NULL,
        [raw_status_kwh_end] FLOAT NULL,
        [kwh_start_value] FLOAT NULL,
        [kwh_end_value] FLOAT NULL,
        [kwh_start_source] NVARCHAR(200) NULL,
        [kwh_end_source] NVARCHAR(200) NULL,
        [kwh_raw_available_flag] BIT NULL,
        [kwh_available_flag] BIT NULL,
        [kwh_missing_flag] BIT NULL,
        [kwh_imputed_or_missing_flag] BIT NULL,
        [kwh_start_imputed_flag] BIT NULL,
        [kwh_end_imputed_flag] BIT NULL,
        [kwh_delta] FLOAT NULL,
        [kwh_delta_model_value] FLOAT NULL,
        [kwh_zero_delta_flag] BIT NULL,
        [kwh_positive_delta_flag] BIT NULL,
        [kwh_negative_delta_flag] BIT NULL,
        [kwh_rate_per_hour] FLOAT NULL,
        [kwh_rate_missing_flag] BIT NULL,
        [loaded_positive_kwh_flag] BIT NULL,
        [loaded_zero_kwh_flag] BIT NULL,
        [loaded_without_kwh_flag] BIT NULL,
        [is_raw_end_missing] BIT NULL,
        [is_invalid_raw_end] BIT NULL,
        [is_open_event] BIT NULL,
        [end_time_imputed_flag] BIT NULL,
        [is_non_positive_duration] BIT NULL,
        [is_long_duration] BIT NULL,
        [is_gap] BIT NULL,
        [is_big_gap] BIT NULL,
        [is_overlap] BIT NULL,
        [machine_group_id] INT NULL,
        [location_id] INT NULL,
        [hour_of_day] INT NULL,
        [day_of_week] INT NULL
    );
    PRINT N'CREATED dbo.ai_l1_operation_event_sequence';
END
ELSE
BEGIN
    PRINT N'EXISTS dbo.ai_l1_operation_event_sequence - table was not dropped or truncated';
END;
GO

IF OBJECT_ID(N'dbo.ai_l1_operation_anomaly_result_production', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ai_l1_operation_anomaly_result_production]
    (
        [event_id] BIGINT NOT NULL,
        [machine_id] INT NULL,
        [sequence_segment_id] BIGINT NULL,
        [event_order_in_segment] BIGINT NULL,
        [model_version] NVARCHAR(200) NULL,
        [decision_policy] NVARCHAR(400) NULL,
        [score_lenient] FLOAT NULL,
        [score_strict] FLOAT NULL,
        [score_lenient_norm] FLOAT NULL,
        [score_strict_norm] FLOAT NULL,
        [threshold_lenient] FLOAT NULL,
        [threshold_strict] FLOAT NULL,
        [is_anomaly_lenient] BIT NULL,
        [is_anomaly_strict] BIT NULL,
        [is_behavior_anomaly] BIT NULL,
        [is_sensitive_warning] BIT NULL,
        [behavior_anomaly_score] FLOAT NULL,
        [behavior_sensitive_score] FLOAT NULL,
        [behavior_combined_score] FLOAT NULL,
        [behavior_reason] NVARCHAR(500) NULL,
        [action_level_l1] NVARCHAR(100) NULL,
        [continuous_error_lenient] FLOAT NULL,
        [binary_error_lenient] FLOAT NULL,
        [categorical_error_lenient] FLOAT NULL,
        [continuous_error_strict] FLOAT NULL,
        [binary_error_strict] FLOAT NULL,
        [categorical_error_strict] FLOAT NULL,
        [created_time] DATETIME2(7) NULL,
        [decision_rebuilt_time] DATETIME2(7) NULL,
        [l1_window_available] NVARCHAR(1000) NULL,
        [score_lenient_raw] FLOAT NULL,
        [threshold_lenient_raw] FLOAT NULL,
        [score_strict_raw] FLOAT NULL,
        [threshold_strict_raw] FLOAT NULL,
        [is_sensitive_deviation] BIT NULL,
        [l1_agreement_code] NVARCHAR(100) NULL,
        [anomaly_level] NVARCHAR(100) NULL,
        [dominant_error_group_lenient] NVARCHAR(100) NULL,
        [dominant_error_group_strict] NVARCHAR(100) NULL
    );
    PRINT N'CREATED dbo.ai_l1_operation_anomaly_result_production';
END
ELSE
BEGIN
    PRINT N'EXISTS dbo.ai_l1_operation_anomaly_result_production - table was not dropped or truncated';
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_confidence_event', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ai_l2_fault_confidence_event]
    (
        [event_id] BIGINT NOT NULL,
        [machine_id] INT NULL,
        [sequence_segment_id] BIGINT NULL,
        [event_order_in_segment] BIGINT NULL,
        [is_first_event_in_segment] BIT NULL,
        [event_start_time] DATETIME2(7) NULL,
        [event_end_time] DATETIME2(7) NULL,
        [end_time_source] NVARCHAR(200) NULL,
        [duration_sec] FLOAT NULL,
        [duration_sec_model_value] FLOAT NULL,
        [gap_from_prev_sec] FLOAT NULL,
        [gap_from_prev_sec_model_value] FLOAT NULL,
        [overlap_sec] FLOAT NULL,
        [status_id] INT NULL,
        [status_type_code] INT NULL,
        [is_on] BIT NULL,
        [current_signal_code] INT NULL,
        [is_loaded] BIT NULL,
        [is_no_load] BIT NULL,
        [is_current_near_zero] BIT NULL,
        [has_error_token] BIT NULL,
        [has_maintenance_token] BIT NULL,
        [known_fault_status] BIT NULL,
        [known_maintenance_status] BIT NULL,
        [known_repair_status] BIT NULL,
        [off_with_fault_status] BIT NULL,
        [info_status] BIT NULL,
        [normal_loaded_production_status] BIT NULL,
        [normal_no_load_production_status] BIT NULL,
        [power_on_near_zero_status] BIT NULL,
        [normal_power_off_status] BIT NULL,
        [status_evidence_class] NVARCHAR(200) NULL,
        [kwh_available_flag] BIT NULL,
        [kwh_missing_flag] BIT NULL,
        [kwh_imputed_flag] BIT NULL,
        [kwh_imputed_or_missing_flag] BIT NULL,
        [kwh_start_imputed_flag] BIT NULL,
        [kwh_end_imputed_flag] BIT NULL,
        [kwh_delta] FLOAT NULL,
        [kwh_delta_model_value] FLOAT NULL,
        [kwh_zero_delta_flag] BIT NULL,
        [kwh_positive_delta_flag] BIT NULL,
        [kwh_negative_delta_flag] BIT NULL,
        [kwh_rate_per_hour] FLOAT NULL,
        [kwh_rate_per_hour_model_value] FLOAT NULL,
        [kwh_rate_missing_flag] BIT NULL,
        [loaded_positive_kwh_flag] BIT NULL,
        [loaded_zero_kwh_flag] BIT NULL,
        [loaded_without_kwh_flag] BIT NULL,
        [energy_inconsistency_flag] BIT NULL,
        [loaded_energy_unavailable_flag] BIT NULL,
        [loaded_energy_positive_evidence] BIT NULL,
        [energy_counter_suspect_flag] BIT NULL,
        [is_raw_end_missing] BIT NULL,
        [is_invalid_raw_end] BIT NULL,
        [is_open_event] BIT NULL,
        [end_time_imputed_flag] BIT NULL,
        [is_non_positive_duration] BIT NULL,
        [is_long_duration] BIT NULL,
        [is_gap] BIT NULL,
        [is_big_gap] BIT NULL,
        [is_overlap] BIT NULL,
        [time_quality_issue_flag] BIT NULL,
        [time_imputed_or_repaired_flag] BIT NULL,
        [kwh_quality_issue_flag] BIT NULL,
        [data_quality_issue_flag] BIT NULL,
        [data_quality_issue_count] INT NULL,
        [data_quality_reason] NVARCHAR(2000) NULL,
        [machine_group_id] INT NULL,
        [location_id] INT NULL,
        [hour_of_day] INT NULL,
        [day_of_week] INT NULL,
        [fault_evidence_count] INT NULL,
        [maintenance_evidence_count] INT NULL
    );
    PRINT N'CREATED dbo.ai_l2_fault_confidence_event';
END
ELSE
BEGIN
    PRINT N'EXISTS dbo.ai_l2_fault_confidence_event - table was not dropped or truncated';
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ai_l2_fault_judgment_policy_v2_full]
    (
        [event_id] BIGINT NOT NULL,
        [machine_id] INT NULL,
        [sequence_segment_id] BIGINT NULL,
        [event_order_in_segment] BIGINT NULL,
        [status_id] INT NULL,
        [status_type_code] INT NULL,
        [current_signal_code] INT NULL,
        [known_fault_status] BIT NULL,
        [known_maintenance_status] BIT NULL,
        [known_repair_status] BIT NULL,
        [off_with_fault_status] BIT NULL,
        [energy_inconsistency_flag] BIT NULL,
        [data_quality_issue_flag] BIT NULL,
        [data_quality_issue_count] INT NULL,
        [time_quality_issue_flag] BIT NULL,
        [kwh_quality_issue_flag] BIT NULL,
        [fault_evidence_count] INT NULL,
        [maintenance_evidence_count] INT NULL,
        [is_behavior_anomaly] BIT NULL,
        [is_sensitive_warning] BIT NULL,
        [behavior_anomaly_score] FLOAT NULL,
        [behavior_sensitive_score] FLOAT NULL,
        [behavior_combined_score] FLOAT NULL,
        [l1_behavior_anomaly_score_log] FLOAT NULL,
        [l1_behavior_sensitive_score_log] FLOAT NULL,
        [l1_behavior_combined_score_log] FLOAT NULL,
        [l1_score_available_flag] BIT NULL,
        [l1_join_missing_flag] BIT NULL,
        [risk_fault_10_events] FLOAT NULL,
        [pred_fault_10_events] BIT NULL,
        [threshold_fault_10_events] FLOAT NULL,
        [profile_fault_10_events] NVARCHAR(100) NULL,
        [risk_fault_30_events] FLOAT NULL,
        [pred_fault_30_events] BIT NULL,
        [threshold_fault_30_events] FLOAT NULL,
        [profile_fault_30_events] NVARCHAR(100) NULL,
        [risk_fault_30min] FLOAT NULL,
        [pred_fault_30min] BIT NULL,
        [threshold_fault_30min] FLOAT NULL,
        [profile_fault_30min] NVARCHAR(100) NULL,
        [risk_fault_60min] FLOAT NULL,
        [pred_fault_60min] BIT NULL,
        [threshold_fault_60min] FLOAT NULL,
        [profile_fault_60min] NVARCHAR(100) NULL,
        [risk_maintenance_30_events] FLOAT NULL,
        [pred_maintenance_30_events] BIT NULL,
        [threshold_maintenance_30_events] FLOAT NULL,
        [profile_maintenance_30_events] NVARCHAR(100) NULL,
        [risk_repair_30_events] FLOAT NULL,
        [pred_repair_30_events] BIT NULL,
        [threshold_repair_30_events] FLOAT NULL,
        [profile_repair_30_events] NVARCHAR(100) NULL,
        [model_fault_risk_score] FLOAT NULL,
        [model_maintenance_risk_score] FLOAT NULL,
        [model_repair_risk_score] FLOAT NULL,
        [fault_confidence_score] FLOAT NULL,
        [maintenance_confidence_score] FLOAT NULL,
        [repair_confidence_score] FLOAT NULL,
        [overall_operational_risk_score] FLOAT NULL,
        [fault_judgment] NVARCHAR(500) NULL,
        [action_level] NVARCHAR(100) NULL,
        [final_reason] NVARCHAR(2000) NULL,
        [l2_run_id] NVARCHAR(200) NULL,
        [l2_scored_time] DATETIME2(7) NULL,
        [split] NVARCHAR(100) NULL,
        [policy_threshold_fault_10_events] FLOAT NULL,
        [policy_pred_fault_10_events] BIT NULL,
        [policy_threshold_fault_30_events] FLOAT NULL,
        [policy_pred_fault_30_events] BIT NULL,
        [policy_threshold_fault_30min] FLOAT NULL,
        [policy_pred_fault_30min] BIT NULL,
        [policy_threshold_fault_60min] FLOAT NULL,
        [policy_pred_fault_60min] BIT NULL,
        [policy_threshold_maintenance_30_events] FLOAT NULL,
        [policy_pred_maintenance_30_events] BIT NULL,
        [policy_threshold_repair_30_events] FLOAT NULL,
        [policy_pred_repair_30_events] BIT NULL,
        [quality_judgment] NVARCHAR(500) NULL,
        [quality_action_level] NVARCHAR(100) NULL,
        [quality_risk_score] FLOAT NULL,
        [operational_action_level] NVARCHAR(100) NULL,
        [operational_judgment] NVARCHAR(500) NULL,
        [operational_fault_confidence_score] FLOAT NULL,
        [operational_maintenance_confidence_score] FLOAT NULL,
        [operational_repair_confidence_score] FLOAT NULL,
        [operational_overall_risk_score] FLOAT NULL,
        [action_level_v2] NVARCHAR(100) NULL,
        [fault_judgment_v2] NVARCHAR(500) NULL,
        [final_reason_v2] NVARCHAR(2000) NULL,
        [policy_version] NVARCHAR(400) NULL,
        [policy_created_time] DATETIME2(7) NULL
    );
    PRINT N'CREATED dbo.ai_l2_fault_judgment_policy_v2_full';
END
ELSE
BEGIN
    PRINT N'EXISTS dbo.ai_l2_fault_judgment_policy_v2_full - table was not dropped or truncated';
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_dashboard_event_core_v2', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ai_l2_dashboard_event_core_v2]
    (
        [event_id] BIGINT NOT NULL,
        [machine_id] INT NULL,
        [sequence_segment_id] BIGINT NULL,
        [event_order_in_segment] BIGINT NULL,
        [status_id] INT NULL,
        [status_type_code] INT NULL,
        [current_signal_code] INT NULL,
        [known_fault_status] BIT NULL,
        [known_maintenance_status] BIT NULL,
        [known_repair_status] BIT NULL,
        [off_with_fault_status] BIT NULL,
        [risk_fault_10_events] FLOAT NULL,
        [risk_fault_30_events] FLOAT NULL,
        [risk_fault_30min] FLOAT NULL,
        [risk_fault_60min] FLOAT NULL,
        [risk_maintenance_30_events] FLOAT NULL,
        [risk_repair_30_events] FLOAT NULL,
        [policy_pred_fault_10_events] BIT NULL,
        [policy_pred_fault_30_events] BIT NULL,
        [policy_pred_fault_30min] BIT NULL,
        [policy_pred_fault_60min] BIT NULL,
        [policy_pred_maintenance_30_events] BIT NULL,
        [policy_pred_repair_30_events] BIT NULL,
        [operational_action_level] NVARCHAR(100) NULL,
        [operational_judgment] NVARCHAR(500) NULL,
        [operational_fault_confidence_score] FLOAT NULL,
        [operational_maintenance_confidence_score] FLOAT NULL,
        [operational_repair_confidence_score] FLOAT NULL,
        [operational_overall_risk_score] FLOAT NULL,
        [quality_action_level] NVARCHAR(100) NULL,
        [quality_judgment] NVARCHAR(500) NULL,
        [quality_risk_score] FLOAT NULL,
        [data_quality_issue_flag] BIT NULL,
        [energy_inconsistency_flag] BIT NULL,
        [kwh_quality_issue_flag] BIT NULL,
        [time_quality_issue_flag] BIT NULL,
        [is_behavior_anomaly] BIT NULL,
        [is_sensitive_warning] BIT NULL,
        [behavior_anomaly_score] FLOAT NULL,
        [behavior_sensitive_score] FLOAT NULL,
        [behavior_combined_score] FLOAT NULL,
        [policy_version] NVARCHAR(400) NULL,
        [l2_run_id] NVARCHAR(200) NULL,
        [split] NVARCHAR(100) NULL
    );
    PRINT N'CREATED dbo.ai_l2_dashboard_event_core_v2';
END
ELSE
BEGIN
    PRINT N'EXISTS dbo.ai_l2_dashboard_event_core_v2 - table was not dropped or truncated';
END;
GO


PRINT N'CREATE TABLE STEP COMPLETE';
GO
