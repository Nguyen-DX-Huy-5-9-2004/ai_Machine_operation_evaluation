/*
DBA-only controlled replacement for the confirmed EMPTY legacy online table.
It never copies rows and never drops the legacy table. Run 00/phase-4 review
first. The known non-schema-bound legacy dashboard view is allowed; any other
dependency, trigger, FK, nonzero row count, or occupied backup name blocks.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
DECLARE @legacy SYSNAME=N'ai_l2_fault_judgment_online_v2',@new SYSNAME=N'ai_l2_fault_judgment_online_v2_new',@backup SYSNAME=N'ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01';
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2',N'U') IS NULL THROW 51100,'Online legacy table missing.',1;
IF EXISTS(SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2) THROW 51101,'Online table is not empty; replacement is forbidden.',1;
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2_new',N'U') IS NOT NULL OR OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',N'U') IS NOT NULL THROW 51102,'Swap/backup name already exists; do not overwrite it.',1;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') OR referenced_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2')) THROW 51103,'Foreign key dependency blocks replacement.',1;
IF EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2')) THROW 51104,'Trigger dependency blocks replacement.',1;
IF EXISTS(SELECT 1 FROM sys.sql_expression_dependencies d WHERE d.referenced_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND (d.is_schema_bound_reference=1 OR OBJECT_SCHEMA_NAME(d.referencing_id)+N'.'+OBJECT_NAME(d.referencing_id)<>N'dbo.vw_ai_dashboard_events_unified_v2')) THROW 51105,'Unreviewed dependency blocks replacement.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 CREATE TABLE dbo.ai_l2_fault_judgment_online_v2_new(
  event_source NVARCHAR(50) NOT NULL,event_uid NVARCHAR(100) NOT NULL,event_id BIGINT NOT NULL,machine_id INT NULL,machine_group_id INT NULL,location_id INT NULL,source_event_start_time DATETIME2 NULL,source_event_end_time DATETIME2 NULL,scored_time DATETIME2 NOT NULL CONSTRAINT DF_ai_online_new_scored DEFAULT SYSUTCDATETIME(),status_id INT NULL,status_type_code NVARCHAR(200) NULL,current_signal_code NVARCHAR(200) NULL,
  duration_sec FLOAT NULL,gap_from_prev_sec FLOAT NULL,overlap_sec FLOAT NULL,kwh_delta FLOAT NULL,kwh_rate_per_hour FLOAT NULL,kwh_available_flag BIT NULL,kwh_missing_flag BIT NULL,kwh_imputed_flag BIT NULL,kwh_start_source NVARCHAR(50) NULL,kwh_end_source NVARCHAR(50) NULL,loaded_zero_kwh_flag BIT NULL,loaded_without_kwh_flag BIT NULL,
  risk_fault_10_events FLOAT NULL,risk_fault_30_events FLOAT NULL,risk_fault_30min FLOAT NULL,risk_fault_60min FLOAT NULL,risk_maintenance_30_events FLOAT NULL,risk_repair_30_events FLOAT NULL,
  operational_action_level NVARCHAR(100) NULL,operational_judgment NVARCHAR(200) NULL,operational_fault_confidence_score FLOAT NULL,operational_maintenance_confidence_score FLOAT NULL,operational_repair_confidence_score FLOAT NULL,operational_overall_risk_score FLOAT NULL,quality_action_level NVARCHAR(100) NULL,quality_judgment NVARCHAR(200) NULL,quality_risk_score FLOAT NULL,
  data_quality_issue_flag BIT NULL,energy_inconsistency_flag BIT NULL,kwh_quality_issue_flag BIT NULL,time_quality_issue_flag BIT NULL,is_behavior_anomaly BIT NULL,is_sensitive_warning BIT NULL,behavior_anomaly_score FLOAT NULL,behavior_sensitive_score FLOAT NULL,behavior_combined_score FLOAT NULL,
  score_lenient FLOAT NULL,score_strict FLOAT NULL,score_lenient_normalized FLOAT NULL,score_strict_normalized FLOAT NULL,threshold_lenient FLOAT NULL,threshold_strict FLOAT NULL,
  l1_score_available_flag BIT NOT NULL CONSTRAINT DF_ai_online_new_l1 DEFAULT 0,l1_join_missing_flag BIT NOT NULL CONSTRAINT DF_ai_online_new_l1_missing DEFAULT 1,l2_ready_flag BIT NOT NULL CONSTRAINT DF_ai_online_new_l2 DEFAULT 0,policy_ready_flag BIT NOT NULL CONSTRAINT DF_ai_online_new_policy DEFAULT 0,readiness_reason NVARCHAR(300) NULL,
  final_reason_v2 NVARCHAR(2000) NULL,explanation_json NVARCHAR(MAX) NULL,explanation_version NVARCHAR(100) NULL,raw_source_fingerprint CHAR(64) NULL,processing_action NVARCHAR(50) NULL,runtime_run_id NVARCHAR(100) NULL,l2_run_id NVARCHAR(200) NULL,policy_version NVARCHAR(400) NULL,inference_version NVARCHAR(200) NULL,
  CONSTRAINT PK_ai_online_new PRIMARY KEY(event_uid),CONSTRAINT UQ_ai_l2_fault_judgment_online_v2_source_event UNIQUE(event_source,event_id),CONSTRAINT CK_ai_l2_fault_judgment_online_v2_source CHECK(event_source=N'ONLINE_CURRENT_SQL'),CONSTRAINT CK_ai_l2_fault_judgment_online_v2_action CHECK(operational_action_level IS NULL OR operational_action_level IN(N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL'))
 );
 EXEC sys.sp_rename N'dbo.ai_l2_fault_judgment_online_v2',@backup,N'OBJECT';
 EXEC sys.sp_rename N'dbo.ai_l2_fault_judgment_online_v2_new',@legacy,N'OBJECT';
 IF EXISTS(SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2) THROW 51106,'Unexpected rows after swap.',1;
 COMMIT;
END TRY
BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
SELECT N'POST_SWAP_VERIFY' check_name,COUNT_BIG(*) online_rows FROM dbo.ai_l2_fault_judgment_online_v2;
SELECT name,type_desc FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2');


--kiểm tra lại 
SELECT
    DB_NAME() AS database_name,
    OBJECT_ID(
        N'dbo.ai_l2_fault_judgment_online_v2',
        N'U'
    ) AS current_table_id,
    OBJECT_ID(
        N'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',
        N'U'
    ) AS backup_table_id,
    OBJECT_ID(
        N'dbo.ai_l2_fault_judgment_online_v2_new',
        N'U'
    ) AS temporary_new_table_id;
SELECT COUNT_BIG(*) AS current_rows
FROM dbo.ai_l2_fault_judgment_online_v2;

SELECT COUNT_BIG(*) AS backup_rows
FROM dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01;

SELECT
    i.name AS index_name,
    i.is_primary_key,
    i.is_unique,
    ic.key_ordinal,
    c.name AS column_name
FROM sys.indexes AS i
JOIN sys.index_columns AS ic
    ON i.object_id = ic.object_id
   AND i.index_id = ic.index_id
JOIN sys.columns AS c
    ON ic.object_id = c.object_id
   AND ic.column_id = c.column_id
WHERE i.object_id =
      OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2')
  AND ic.is_included_column = 0
ORDER BY
    i.name,
    ic.key_ordinal;

SELECT
    name,
    definition,
    is_disabled,
    is_not_trusted
FROM sys.check_constraints
WHERE parent_object_id =
      OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2');
