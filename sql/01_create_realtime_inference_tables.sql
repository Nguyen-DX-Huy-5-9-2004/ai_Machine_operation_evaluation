USE i26s02004_dat_dev;
GO
IF OBJECT_ID('dbo.ai_inference_checkpoint','U') IS NULL
CREATE TABLE dbo.ai_inference_checkpoint(pipeline_name NVARCHAR(100) NOT NULL PRIMARY KEY,last_event_id BIGINT NULL,last_event_time DATETIME2 NULL,updated_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
IF NOT EXISTS(SELECT 1 FROM dbo.ai_inference_checkpoint WHERE pipeline_name='weldcom_l2_realtime_v1')
INSERT INTO dbo.ai_inference_checkpoint(pipeline_name,last_event_id,last_event_time) VALUES('weldcom_l2_realtime_v1',NULL,NULL);
GO
IF OBJECT_ID('dbo.ai_l2_fault_judgment_online_v2','U') IS NULL
CREATE TABLE dbo.ai_l2_fault_judgment_online_v2(
 event_id BIGINT NOT NULL PRIMARY KEY, machine_id INT NULL, source_event_start_time DATETIME2 NULL, source_event_end_time DATETIME2 NULL, scored_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 status_id INT NULL,status_type_code NVARCHAR(100) NULL,current_signal_code NVARCHAR(100) NULL,
 risk_fault_10_events FLOAT NULL,risk_fault_30_events FLOAT NULL,risk_fault_30min FLOAT NULL,risk_fault_60min FLOAT NULL,risk_maintenance_30_events FLOAT NULL,risk_repair_30_events FLOAT NULL,
 operational_action_level NVARCHAR(50) NULL, operational_judgment NVARCHAR(100) NULL, operational_fault_confidence_score FLOAT NULL, operational_maintenance_confidence_score FLOAT NULL, operational_repair_confidence_score FLOAT NULL, operational_overall_risk_score FLOAT NULL,
 quality_action_level NVARCHAR(50) NULL, quality_judgment NVARCHAR(100) NULL, quality_risk_score FLOAT NULL,
 data_quality_issue_flag BIT NULL, energy_inconsistency_flag BIT NULL, kwh_quality_issue_flag BIT NULL, time_quality_issue_flag BIT NULL,
 is_behavior_anomaly BIT NULL, is_sensitive_warning BIT NULL, behavior_anomaly_score FLOAT NULL, behavior_sensitive_score FLOAT NULL, behavior_combined_score FLOAT NULL,
 l1_score_available_flag BIT NULL, l1_join_missing_flag BIT NULL, final_reason_v2 NVARCHAR(1000) NULL,
 l2_run_id NVARCHAR(100) NULL, policy_version NVARCHAR(200) NULL, inference_version NVARCHAR(100) NULL);
GO
IF OBJECT_ID('dbo.ai_inference_run_log','U') IS NULL
CREATE TABLE dbo.ai_inference_run_log(run_log_id BIGINT IDENTITY(1,1) PRIMARY KEY,pipeline_name NVARCHAR(100) NOT NULL,started_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),ended_time DATETIME2 NULL,input_rows INT NULL,scored_rows INT NULL,skipped_rows INT NULL,failed_rows INT NULL,status NVARCHAR(50) NULL,message NVARCHAR(MAX) NULL);
GO
IF OBJECT_ID('dbo.ai_inference_error_log','U') IS NULL
CREATE TABLE dbo.ai_inference_error_log(error_id BIGINT IDENTITY(1,1) PRIMARY KEY,event_id BIGINT NULL,machine_id INT NULL,error_stage NVARCHAR(100) NULL,error_message NVARCHAR(MAX) NULL,created_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
