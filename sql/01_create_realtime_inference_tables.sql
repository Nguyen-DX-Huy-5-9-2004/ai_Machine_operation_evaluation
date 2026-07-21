/*
DBA-reviewed migration only. It is deliberately fail-closed: legacy primary
keys are never dropped implicitly. Execute 00, 01a, then this script, then
02a/02/03; do not batch with view or index scripts.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

BEGIN TRY
BEGIN TRANSACTION;

/* PREFLIGHT: fail before any data backfill, NOT NULL, or index operation. */
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2',N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2 WHERE event_id IS NULL)
        THROW 51001, 'Online table contains NULL event_id; migration stopped.', 1;
    IF EXISTS (SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2 GROUP BY event_id HAVING COUNT_BIG(*)>1)
        THROW 51002, 'Online table contains duplicate event_id; migration stopped.', 1;
    IF COL_LENGTH(N'dbo.ai_l2_fault_judgment_online_v2',N'operational_action_level') IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2 WHERE operational_action_level IS NOT NULL AND operational_action_level NOT IN (N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL'))
        THROW 51003, 'Online table contains invalid operational action; migration stopped.', 1;
END;

/* SCHEMA ADDITIONS. The fresh table and upgrade list represent the same columns. */
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.ai_l2_fault_judgment_online_v2 (
  event_source NVARCHAR(50) NOT NULL, event_uid NVARCHAR(100) NOT NULL, event_id BIGINT NOT NULL,
  machine_id INT NULL, machine_group_id INT NULL, location_id INT NULL,
  source_event_start_time DATETIME2 NULL, source_event_end_time DATETIME2 NULL, scored_time DATETIME2 NOT NULL CONSTRAINT DF_ai_online_scored DEFAULT SYSUTCDATETIME(),
  status_id INT NULL, status_type_code NVARCHAR(200) NULL, current_signal_code NVARCHAR(200) NULL,
  duration_sec FLOAT NULL, gap_from_prev_sec FLOAT NULL, overlap_sec FLOAT NULL, kwh_delta FLOAT NULL, kwh_rate_per_hour FLOAT NULL,
  kwh_available_flag BIT NULL,kwh_missing_flag BIT NULL,kwh_imputed_flag BIT NULL,kwh_start_source NVARCHAR(50) NULL,kwh_end_source NVARCHAR(50) NULL,loaded_zero_kwh_flag BIT NULL,loaded_without_kwh_flag BIT NULL,
  risk_fault_10_events FLOAT NULL,risk_fault_30_events FLOAT NULL,risk_fault_30min FLOAT NULL,risk_fault_60min FLOAT NULL,risk_maintenance_30_events FLOAT NULL,risk_repair_30_events FLOAT NULL,
  operational_action_level NVARCHAR(100) NULL,operational_judgment NVARCHAR(200) NULL,operational_fault_confidence_score FLOAT NULL,operational_maintenance_confidence_score FLOAT NULL,operational_repair_confidence_score FLOAT NULL,operational_overall_risk_score FLOAT NULL,
  quality_action_level NVARCHAR(100) NULL,quality_judgment NVARCHAR(200) NULL,quality_risk_score FLOAT NULL,
  data_quality_issue_flag BIT NULL,energy_inconsistency_flag BIT NULL,kwh_quality_issue_flag BIT NULL,time_quality_issue_flag BIT NULL,
  is_behavior_anomaly BIT NULL,is_sensitive_warning BIT NULL,behavior_anomaly_score FLOAT NULL,behavior_sensitive_score FLOAT NULL,behavior_combined_score FLOAT NULL,
  score_lenient FLOAT NULL,score_strict FLOAT NULL,score_lenient_normalized FLOAT NULL,score_strict_normalized FLOAT NULL,threshold_lenient FLOAT NULL,threshold_strict FLOAT NULL,
  l1_score_available_flag BIT NOT NULL CONSTRAINT DF_ai_online_l1_ready DEFAULT 0,l1_join_missing_flag BIT NOT NULL CONSTRAINT DF_ai_online_l1_missing DEFAULT 1,
  l2_ready_flag BIT NOT NULL CONSTRAINT DF_ai_online_l2_ready DEFAULT 0,policy_ready_flag BIT NOT NULL CONSTRAINT DF_ai_online_policy_ready DEFAULT 0,readiness_reason NVARCHAR(300) NULL,
  final_reason_v2 NVARCHAR(2000) NULL,explanation_json NVARCHAR(MAX) NULL,explanation_version NVARCHAR(100) NULL,raw_source_fingerprint CHAR(64) NULL,processing_action NVARCHAR(50) NULL,runtime_run_id NVARCHAR(100) NULL,l2_run_id NVARCHAR(200) NULL,policy_version NVARCHAR(400) NULL,inference_version NVARCHAR(200) NULL,
  CONSTRAINT PK_ai_l2_fault_judgment_online_v2 PRIMARY KEY (event_uid),
  CONSTRAINT UQ_ai_l2_fault_judgment_online_v2_source_event UNIQUE (event_source, event_id),
  CONSTRAINT CK_ai_l2_fault_judgment_online_v2_source CHECK(event_source=N'ONLINE_CURRENT_SQL'),
  CONSTRAINT CK_ai_l2_fault_judgment_online_v2_action CHECK(operational_action_level IS NULL OR operational_action_level IN(N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL'))
 );
END
ELSE
BEGIN
 /* Legacy event_id primary key needs an explicit DBA-approved rebuild; never DROP it here. */
 IF EXISTS (SELECT 1 FROM sys.key_constraints kc JOIN sys.index_columns ic ON kc.unique_index_id=ic.index_id AND kc.parent_object_id=ic.object_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE kc.parent_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND kc.type='PK' GROUP BY kc.name HAVING MIN(c.name)<>N'event_uid' OR MAX(c.name)<>N'event_uid' OR COUNT(*)<>1)
   THROW 51004, 'Legacy primary key is not event_uid. DBA-approved primary-key rebuild is required before upgrade.', 1;
 DECLARE @adds TABLE(name SYSNAME NOT NULL, definition NVARCHAR(300) NOT NULL);
 INSERT @adds VALUES
 (N'event_source',N'NVARCHAR(50) NULL'),(N'event_uid',N'NVARCHAR(100) NULL'),(N'machine_group_id',N'INT NULL'),(N'location_id',N'INT NULL'),(N'duration_sec',N'FLOAT NULL'),(N'gap_from_prev_sec',N'FLOAT NULL'),(N'overlap_sec',N'FLOAT NULL'),(N'kwh_delta',N'FLOAT NULL'),(N'kwh_rate_per_hour',N'FLOAT NULL'),(N'kwh_available_flag',N'BIT NULL'),(N'kwh_missing_flag',N'BIT NULL'),(N'kwh_imputed_flag',N'BIT NULL'),(N'kwh_start_source',N'NVARCHAR(50) NULL'),(N'kwh_end_source',N'NVARCHAR(50) NULL'),(N'loaded_zero_kwh_flag',N'BIT NULL'),(N'loaded_without_kwh_flag',N'BIT NULL'),(N'score_lenient',N'FLOAT NULL'),(N'score_strict',N'FLOAT NULL'),(N'score_lenient_normalized',N'FLOAT NULL'),(N'score_strict_normalized',N'FLOAT NULL'),(N'threshold_lenient',N'FLOAT NULL'),(N'threshold_strict',N'FLOAT NULL'),(N'l2_ready_flag',N'BIT NULL'),(N'policy_ready_flag',N'BIT NULL'),(N'readiness_reason',N'NVARCHAR(300) NULL'),(N'explanation_json',N'NVARCHAR(MAX) NULL'),(N'explanation_version',N'NVARCHAR(100) NULL'),(N'raw_source_fingerprint',N'CHAR(64) NULL'),(N'processing_action',N'NVARCHAR(50) NULL'),(N'runtime_run_id',N'NVARCHAR(100) NULL');
 DECLARE @name SYSNAME,@definition NVARCHAR(300),@sql NVARCHAR(MAX);
 DECLARE add_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,definition FROM @adds WHERE COL_LENGTH(N'dbo.ai_l2_fault_judgment_online_v2',name) IS NULL;
 OPEN add_cursor; FETCH NEXT FROM add_cursor INTO @name,@definition;
 WHILE @@FETCH_STATUS=0 BEGIN SET @sql=N'ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ADD '+QUOTENAME(@name)+N' '+@definition+N';'; EXEC sys.sp_executesql @sql; FETCH NEXT FROM add_cursor INTO @name,@definition; END
 CLOSE add_cursor; DEALLOCATE add_cursor;
 /* BACKFILL: deterministic lineage; unknown legacy readiness remains explicitly unready. */
 UPDATE dbo.ai_l2_fault_judgment_online_v2
 SET event_source=COALESCE(event_source,N'ONLINE_CURRENT_SQL'),event_uid=COALESCE(event_uid,CONCAT(N'ONLINE_CURRENT_SQL:',CONVERT(NVARCHAR(30),event_id))),
     l2_ready_flag=CASE WHEN l2_ready_flag IS NULL THEN 0 ELSE l2_ready_flag END,
     policy_ready_flag=CASE WHEN policy_ready_flag IS NULL THEN 0 ELSE policy_ready_flag END,
     readiness_reason=COALESCE(readiness_reason,N'LEGACY_ROW_READINESS_NOT_PROVABLE')
 WHERE event_source IS NULL OR event_uid IS NULL OR l2_ready_flag IS NULL OR policy_ready_flag IS NULL OR readiness_reason IS NULL;
 IF EXISTS (SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2 WHERE event_source IS NULL OR event_uid IS NULL)
   THROW 51005, 'Lineage backfill did not complete.', 1;
 ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ALTER COLUMN event_source NVARCHAR(50) NOT NULL;
 ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ALTER COLUMN event_uid NVARCHAR(100) NOT NULL;
 /* Equivalence is structural, not name-only: a legacy unique index with the
    same ordered source/event key already enforces the contract. */
 IF NOT EXISTS(
   SELECT 1 FROM sys.indexes i
   WHERE i.object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND i.is_unique=1
     AND EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=1 AND c.name=N'event_source')
     AND EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=2 AND c.name=N'event_id')
     AND NOT EXISTS(SELECT 1 FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>2)
 )
   ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ADD CONSTRAINT UQ_ai_l2_fault_judgment_online_v2_source_event UNIQUE(event_source,event_id);
 /* Definition normalization accepts formatting/bracket differences but not a
    weaker condition. Avoid creating a second equivalent check constraint. */
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND REPLACE(REPLACE(REPLACE(UPPER(definition),N' ',N''),N'[',N''),N']',N'') LIKE N'%EVENT_SOURCE=N''ONLINE_CURRENT_SQL''%')
   ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ADD CONSTRAINT CK_ai_l2_fault_judgment_online_v2_source CHECK(event_source=N'ONLINE_CURRENT_SQL');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND REPLACE(REPLACE(REPLACE(UPPER(definition),N' ',N''),N'[',N''),N']',N'') LIKE N'%OPERATIONAL_ACTION_LEVELISNULLOROPERATIONAL_ACTION_LEVELIN(N''LOW'',N''MEDIUM'',N''HIGH'',N''CRITICAL'')%')
   ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 ADD CONSTRAINT CK_ai_l2_fault_judgment_online_v2_action CHECK(operational_action_level IS NULL OR operational_action_level IN(N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL'));
END;

/* Upgrade auxiliary runtime tables without changing existing data. */
IF OBJECT_ID(N'dbo.ai_inference_checkpoint',N'U') IS NULL CREATE TABLE dbo.ai_inference_checkpoint(pipeline_name NVARCHAR(200) NOT NULL PRIMARY KEY,last_event_id BIGINT NULL,last_event_time DATETIME2 NULL,updated_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF COL_LENGTH(N'dbo.ai_inference_checkpoint',N'last_event_uid') IS NULL ALTER TABLE dbo.ai_inference_checkpoint ADD last_event_uid NVARCHAR(100) NULL;
/* Keep legacy input/scored/skipped/failed/message columns; new writer uses the
   explicit runtime count fields below. Legacy rows are allowed to leave them NULL. */
IF OBJECT_ID(N'dbo.ai_inference_run_log',N'U') IS NULL
 CREATE TABLE dbo.ai_inference_run_log(
  run_log_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,pipeline_name NVARCHAR(200) NOT NULL,started_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),ended_time DATETIME2 NULL,
  input_rows BIGINT NULL,scored_rows BIGINT NULL,skipped_rows BIGINT NULL,failed_rows BIGINT NULL,status NVARCHAR(100) NULL,message NVARCHAR(MAX) NULL,
  runtime_run_id NVARCHAR(100) NULL,raw_candidate_count BIGINT NULL,context_count BIGINT NULL,canonical_count BIGINT NULL,l1_ready_count BIGINT NULL,l1_unready_count BIGINT NULL,l2_ready_count BIGINT NULL,l2_unready_count BIGINT NULL,policy_ready_count BIGINT NULL,inserted_count BIGINT NULL,updated_count BIGINT NULL,skipped_duplicate_count BIGINT NULL,failed_count BIGINT NULL,error_summary NVARCHAR(MAX) NULL,model_lineage_hash CHAR(64) NULL,policy_version NVARCHAR(400) NULL,sql_write_enabled BIT NOT NULL DEFAULT 0
 );
DECLARE @run_adds TABLE(name SYSNAME NOT NULL,definition NVARCHAR(300) NOT NULL);
INSERT @run_adds VALUES
 (N'runtime_run_id',N'NVARCHAR(100) NULL'),(N'raw_candidate_count',N'BIGINT NULL'),(N'context_count',N'BIGINT NULL'),(N'canonical_count',N'BIGINT NULL'),(N'l1_ready_count',N'BIGINT NULL'),(N'l1_unready_count',N'BIGINT NULL'),(N'l2_ready_count',N'BIGINT NULL'),(N'l2_unready_count',N'BIGINT NULL'),(N'policy_ready_count',N'BIGINT NULL'),(N'inserted_count',N'BIGINT NULL'),(N'updated_count',N'BIGINT NULL'),(N'skipped_duplicate_count',N'BIGINT NULL'),(N'failed_count',N'BIGINT NULL'),(N'error_summary',N'NVARCHAR(MAX) NULL'),(N'model_lineage_hash',N'CHAR(64) NULL'),(N'policy_version',N'NVARCHAR(400) NULL'),(N'sql_write_enabled',N'BIT NOT NULL CONSTRAINT DF_ai_run_write DEFAULT 0');
DECLARE @run_name SYSNAME,@run_definition NVARCHAR(300),@run_sql NVARCHAR(MAX);
DECLARE run_add_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,definition FROM @run_adds WHERE COL_LENGTH(N'dbo.ai_inference_run_log',name) IS NULL;
OPEN run_add_cursor; FETCH NEXT FROM run_add_cursor INTO @run_name,@run_definition;
WHILE @@FETCH_STATUS=0 BEGIN SET @run_sql=N'ALTER TABLE dbo.ai_inference_run_log ADD '+QUOTENAME(@run_name)+N' '+@run_definition+N';'; EXEC sys.sp_executesql @run_sql; FETCH NEXT FROM run_add_cursor INTO @run_name,@run_definition; END
CLOSE run_add_cursor; DEALLOCATE run_add_cursor;
IF OBJECT_ID(N'dbo.ai_inference_error_log',N'U') IS NULL CREATE TABLE dbo.ai_inference_error_log(error_id BIGINT IDENTITY PRIMARY KEY,event_id BIGINT NULL,machine_id INT NULL,error_stage NVARCHAR(200) NULL,error_message NVARCHAR(MAX) NULL,created_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
IF COL_LENGTH(N'dbo.ai_inference_error_log',N'event_source') IS NULL ALTER TABLE dbo.ai_inference_error_log ADD event_source NVARCHAR(50) NULL,runtime_run_id NVARCHAR(100) NULL;

COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
GO
