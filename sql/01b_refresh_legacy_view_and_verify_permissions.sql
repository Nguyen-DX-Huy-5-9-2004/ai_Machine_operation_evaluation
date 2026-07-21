/*
DBA post-swap step. Run once under the API/read identity and once under the
writer identity (or an approved impersonation). It grants nothing and writes
no business rows. sp_refreshview updates legacy module metadata after rename.
*/
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.vw_ai_dashboard_events_unified_v2',N'V') IS NULL
    THROW 51120,'Legacy dashboard view is missing; refresh cannot continue.',1;
EXEC sys.sp_refreshview N'dbo.vw_ai_dashboard_events_unified_v2';
SELECT TOP (0) * FROM dbo.vw_ai_dashboard_events_unified_v2;
SELECT SUSER_SNAME() AS current_login,USER_NAME() AS current_database_user,
 HAS_PERMS_BY_NAME(N'dbo.vw_ai_dashboard_events_source_aware_v2',N'OBJECT',N'SELECT') AS can_select_source_aware_view,
 HAS_PERMS_BY_NAME(N'dbo.ai_l2_fault_judgment_online_v2',N'OBJECT',N'SELECT') AS can_select_online,
 HAS_PERMS_BY_NAME(N'dbo.ai_l2_fault_judgment_online_v2',N'OBJECT',N'INSERT') AS can_insert_online,
 HAS_PERMS_BY_NAME(N'dbo.ai_l2_fault_judgment_online_v2',N'OBJECT',N'UPDATE') AS can_update_online,
 HAS_PERMS_BY_NAME(N'dbo.ai_inference_run_log',N'OBJECT',N'INSERT') AS can_insert_run_log,
 HAS_PERMS_BY_NAME(N'dbo.ai_inference_checkpoint',N'OBJECT',N'INSERT') AS can_insert_checkpoint,
 HAS_PERMS_BY_NAME(N'dbo.ai_inference_checkpoint',N'OBJECT',N'UPDATE') AS can_update_checkpoint,
 HAS_PERMS_BY_NAME(N'dbo.ai_inference_error_log',N'OBJECT',N'INSERT') AS can_insert_error_log;
SELECT OBJECT_SCHEMA_NAME(referencing_id)+N'.'+OBJECT_NAME(referencing_id) AS referencing_object,referenced_entity_name,is_schema_bound_reference
FROM sys.sql_expression_dependencies WHERE referenced_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2');
