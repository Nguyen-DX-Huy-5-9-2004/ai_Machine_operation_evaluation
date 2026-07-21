/*
Read-only full projection preflight for sql/02. No view is created here.
sp_describe_first_result_set compiles the exact source-aware UNION projection
and returns aliases, type/nullability metadata before any DDL is permitted.
*/
SET NOCOUNT ON;
DECLARE @required TABLE(object_name SYSNAME NOT NULL,column_name SYSNAME NOT NULL);
INSERT @required VALUES
 (N'dbo.ai_l2_fault_judgment_policy_v2_full',N'event_id'),(N'dbo.ai_l2_fault_judgment_policy_v2_full',N'l1_score_available_flag'),(N'dbo.ai_l2_fault_judgment_policy_v2_full',N'operational_action_level'),(N'dbo.ai_l2_fault_judgment_policy_v2_full',N'final_reason_v2'),
 (N'dbo.ai_l2_fault_confidence_event',N'event_id'),(N'dbo.ai_l2_fault_confidence_event',N'machine_id'),(N'dbo.ai_l2_fault_confidence_event',N'status_id'),(N'dbo.ai_l2_fault_confidence_event',N'event_start_time'),(N'dbo.ai_l2_fault_confidence_event',N'event_end_time'),(N'dbo.ai_l2_fault_confidence_event',N'machine_group_id'),(N'dbo.ai_l2_fault_confidence_event',N'location_id'),(N'dbo.ai_l2_fault_confidence_event',N'duration_sec'),(N'dbo.ai_l2_fault_confidence_event',N'gap_from_prev_sec'),(N'dbo.ai_l2_fault_confidence_event',N'overlap_sec'),(N'dbo.ai_l2_fault_confidence_event',N'kwh_delta'),(N'dbo.ai_l2_fault_confidence_event',N'kwh_rate_per_hour'),(N'dbo.ai_l2_fault_confidence_event',N'kwh_available_flag'),(N'dbo.ai_l2_fault_confidence_event',N'kwh_missing_flag'),(N'dbo.ai_l2_fault_confidence_event',N'kwh_imputed_flag'),(N'dbo.ai_l2_fault_confidence_event',N'loaded_zero_kwh_flag'),(N'dbo.ai_l2_fault_confidence_event',N'loaded_without_kwh_flag'),(N'dbo.ai_l2_fault_confidence_event',N'status_type_code'),(N'dbo.ai_l2_fault_confidence_event',N'current_signal_code'),
 (N'dbo.ai_l2_fault_judgment_online_v2',N'event_source'),(N'dbo.ai_l2_fault_judgment_online_v2',N'event_uid'),(N'dbo.ai_l2_fault_judgment_online_v2',N'source_event_start_time'),(N'dbo.ai_l2_fault_judgment_online_v2',N'l2_ready_flag'),(N'dbo.ai_l2_fault_judgment_online_v2',N'policy_ready_flag'),(N'dbo.ai_l2_fault_judgment_online_v2',N'readiness_reason');
SELECT object_name,column_name,CASE WHEN COL_LENGTH(object_name,column_name) IS NULL THEN N'MISSING' ELSE N'PASS' END status FROM @required;
IF EXISTS(SELECT 1 FROM @required WHERE COL_LENGTH(object_name,column_name) IS NULL) THROW 51023,'Dashboard view source-column preflight failed.',1;

/* The aliases below are the full public dashboard projection. Explicit casts
   prohibit unsafe implicit UNION conversions; event_start_time comes from e. */
DECLARE @projection NVARCHAR(MAX)=N'
SELECT CAST(N''HISTORICAL_PRODUCTION_SCORE'' AS NVARCHAR(50)) event_source,CONCAT(N''HISTORICAL_PRODUCTION_SCORE:'',CONVERT(NVARCHAR(30),h.event_id)) event_uid,CAST(N''historical'' AS NVARCHAR(20)) dataset_mode,h.event_id,e.machine_id,CAST(e.machine_group_id AS INT) machine_group_id,CAST(e.location_id AS INT) location_id,CAST(e.event_start_time AS DATETIME2) event_start_time,CAST(e.event_end_time AS DATETIME2) event_end_time,CAST(h.l2_scored_time AS DATETIME2) scored_at,e.status_id,TRY_CONVERT(INT,e.status_type_code) status_type_code,TRY_CONVERT(INT,e.current_signal_code) current_signal_code,
CAST(h.risk_fault_10_events AS FLOAT) risk_fault_10_events,CAST(h.risk_fault_30_events AS FLOAT) risk_fault_30_events,CAST(h.risk_fault_30min AS FLOAT) risk_fault_30min,CAST(h.risk_fault_60min AS FLOAT) risk_fault_60min,CAST(h.risk_maintenance_30_events AS FLOAT) risk_maintenance_30_events,CAST(h.risk_repair_30_events AS FLOAT) risk_repair_30_events,CAST(h.operational_action_level AS NVARCHAR(50)) operational_action_level,CAST(h.operational_judgment AS NVARCHAR(200)) operational_judgment,CAST(h.operational_overall_risk_score AS FLOAT) operational_overall_risk_score,CAST(h.quality_action_level AS NVARCHAR(50)) quality_action_level,CAST(h.quality_judgment AS NVARCHAR(200)) quality_judgment,CAST(h.quality_risk_score AS FLOAT) quality_risk_score,CAST(h.is_behavior_anomaly AS BIT) is_behavior_anomaly,CAST(h.is_sensitive_warning AS BIT) is_sensitive_warning,CAST(h.behavior_anomaly_score AS FLOAT) behavior_anomaly_score,CAST(h.behavior_sensitive_score AS FLOAT) behavior_sensitive_score,CAST(h.behavior_combined_score AS FLOAT) behavior_combined_score,CAST(e.data_quality_issue_flag AS BIT) data_quality_issue_flag,CAST(e.energy_inconsistency_flag AS BIT) energy_inconsistency_flag,CAST(e.kwh_quality_issue_flag AS BIT) kwh_quality_issue_flag,CAST(e.time_quality_issue_flag AS BIT) time_quality_issue_flag,CAST(e.kwh_delta AS FLOAT) kwh_delta,CAST(e.kwh_rate_per_hour AS FLOAT) kwh_rate_per_hour,CAST(e.kwh_available_flag AS BIT) kwh_available_flag,CAST(e.kwh_missing_flag AS BIT) kwh_missing_flag,CAST(e.kwh_imputed_flag AS BIT) kwh_imputed_flag,CAST(e.loaded_zero_kwh_flag AS BIT) loaded_zero_kwh_flag,CAST(e.loaded_without_kwh_flag AS BIT) loaded_without_kwh_flag,CAST(e.duration_sec AS FLOAT) duration_sec,CAST(e.gap_from_prev_sec AS FLOAT) gap_from_prev_sec,CAST(e.overlap_sec AS FLOAT) overlap_sec,CAST(h.final_reason_v2 AS NVARCHAR(2000)) final_reason_v2,CAST(h.l2_run_id AS NVARCHAR(200)) l2_run_id,CAST(h.policy_version AS NVARCHAR(400)) policy_version,CAST(h.l1_score_available_flag AS BIT) l1_score_available_flag,CAST(CASE WHEN h.risk_fault_10_events IS NOT NULL AND h.risk_fault_30_events IS NOT NULL AND h.risk_fault_30min IS NOT NULL AND h.risk_fault_60min IS NOT NULL AND h.risk_maintenance_30_events IS NOT NULL AND h.risk_repair_30_events IS NOT NULL THEN 1 ELSE 0 END AS BIT) l2_ready_flag,CAST(CASE WHEN h.operational_action_level IN(N''LOW'',N''MEDIUM'',N''HIGH'',N''CRITICAL'') THEN 1 ELSE 0 END AS BIT) policy_ready_flag,CAST(CASE WHEN h.l1_score_available_flag=0 THEN N''HISTORICAL_L1_WINDOW_UNAVAILABLE_L2_RESULT_EXPORTED'' WHEN h.risk_fault_10_events IS NULL OR h.risk_fault_30_events IS NULL OR h.risk_fault_30min IS NULL OR h.risk_fault_60min IS NULL OR h.risk_maintenance_30_events IS NULL OR h.risk_repair_30_events IS NULL THEN N''HISTORICAL_L2_RESULT_UNAVAILABLE'' WHEN h.operational_action_level NOT IN(N''LOW'',N''MEDIUM'',N''HIGH'',N''CRITICAL'') THEN N''HISTORICAL_POLICY_RESULT_UNAVAILABLE'' ELSE N''READY'' END AS NVARCHAR(300)) readiness_reason,CAST(NULL AS NVARCHAR(MAX)) explanation_json,CAST(NULL AS NVARCHAR(100)) explanation_version,CAST(NULL AS NVARCHAR(100)) runtime_run_id,CAST(NULL AS CHAR(64)) raw_source_fingerprint
FROM dbo.ai_l2_fault_judgment_policy_v2_full h LEFT JOIN dbo.ai_l2_fault_confidence_event e ON h.event_id=e.event_id
UNION ALL
SELECT CAST(o.event_source AS NVARCHAR(50)),CAST(o.event_uid AS NVARCHAR(100)),CAST(N''current'' AS NVARCHAR(20)),o.event_id,o.machine_id,o.machine_group_id,o.location_id,CAST(o.source_event_start_time AS DATETIME2),CAST(o.source_event_end_time AS DATETIME2),CAST(o.scored_time AS DATETIME2),o.status_id,TRY_CONVERT(INT,o.status_type_code),TRY_CONVERT(INT,o.current_signal_code),CAST(o.risk_fault_10_events AS FLOAT),CAST(o.risk_fault_30_events AS FLOAT),CAST(o.risk_fault_30min AS FLOAT),CAST(o.risk_fault_60min AS FLOAT),CAST(o.risk_maintenance_30_events AS FLOAT),CAST(o.risk_repair_30_events AS FLOAT),CAST(o.operational_action_level AS NVARCHAR(50)),CAST(o.operational_judgment AS NVARCHAR(200)),CAST(o.operational_overall_risk_score AS FLOAT),CAST(o.quality_action_level AS NVARCHAR(50)),CAST(o.quality_judgment AS NVARCHAR(200)),CAST(o.quality_risk_score AS FLOAT),CAST(o.is_behavior_anomaly AS BIT),CAST(o.is_sensitive_warning AS BIT),CAST(o.behavior_anomaly_score AS FLOAT),CAST(o.behavior_sensitive_score AS FLOAT),CAST(o.behavior_combined_score AS FLOAT),CAST(o.data_quality_issue_flag AS BIT),CAST(o.energy_inconsistency_flag AS BIT),CAST(o.kwh_quality_issue_flag AS BIT),CAST(o.time_quality_issue_flag AS BIT),CAST(o.kwh_delta AS FLOAT),CAST(o.kwh_rate_per_hour AS FLOAT),CAST(o.kwh_available_flag AS BIT),CAST(o.kwh_missing_flag AS BIT),CAST(o.kwh_imputed_flag AS BIT),CAST(o.loaded_zero_kwh_flag AS BIT),CAST(o.loaded_without_kwh_flag AS BIT),CAST(o.duration_sec AS FLOAT),CAST(o.gap_from_prev_sec AS FLOAT),CAST(o.overlap_sec AS FLOAT),CAST(o.final_reason_v2 AS NVARCHAR(2000)),CAST(o.l2_run_id AS NVARCHAR(200)),CAST(o.policy_version AS NVARCHAR(400)),CAST(o.l1_score_available_flag AS BIT),CAST(o.l2_ready_flag AS BIT),CAST(o.policy_ready_flag AS BIT),CAST(o.readiness_reason AS NVARCHAR(300)),CAST(o.explanation_json AS NVARCHAR(MAX)),CAST(o.explanation_version AS NVARCHAR(100)),CAST(o.runtime_run_id AS NVARCHAR(100)),CAST(o.raw_source_fingerprint AS CHAR(64)) FROM dbo.ai_l2_fault_judgment_online_v2 o;';
/* Use the metadata DMF directly instead of INSERT ... EXEC into a hand-written
   table definition. Several metadata fields (including user_type_database)
   are legitimately NULL; SYSNAME alias columns can otherwise reject them. */
IF OBJECT_ID(N'tempdb..#metadata') IS NOT NULL
    DROP TABLE #metadata;

SELECT *
INTO #metadata
FROM sys.dm_exec_describe_first_result_set
(
    @projection,
    NULL,
    0
);

IF EXISTS
(
    SELECT 1
    FROM #metadata
    WHERE error_number IS NOT NULL
)
BEGIN
    SELECT
        error_number,
        error_severity,
        error_state,
        error_message,
        error_type,
        error_type_desc
    FROM #metadata
    WHERE error_number IS NOT NULL;

    THROW 51027, 'Dashboard UNION projection compile check failed.', 1;
END;

SELECT
    column_ordinal,
    name,
    system_type_name,
    is_nullable
FROM #metadata
WHERE ISNULL(is_hidden, 0) = 0
ORDER BY column_ordinal;

IF
(
    SELECT COUNT(*)
    FROM #metadata
    WHERE ISNULL(is_hidden, 0) = 0
) <> 55
    THROW 51024, 'Dashboard UNION projection column count is not the expected 55.', 1;

IF EXISTS
(
    SELECT 1
    FROM #metadata
    WHERE ISNULL(is_hidden, 0) = 0
      AND name IN (N'event_source', N'event_uid', N'dataset_mode')
      AND system_type_name NOT LIKE N'nvarchar%'
)
    THROW 51025, 'Dashboard identity aliases have incompatible types.', 1;

IF EXISTS
(
    SELECT 1
    FROM #metadata
    WHERE ISNULL(is_hidden, 0) = 0
      AND name = N'event_start_time'
      AND system_type_name NOT LIKE N'datetime2%'
)
    THROW 51026, 'event_start_time projection is incompatible.', 1;

SELECT
    N'FULL_PROJECTION_COMPILE_CHECK' AS check_name,
    N'PASS' AS status,
    COUNT(*) AS projected_column_count
FROM #metadata
WHERE ISNULL(is_hidden, 0) = 0;