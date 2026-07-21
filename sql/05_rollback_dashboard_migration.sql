/* DBA-only rollback for sql/01a empty-table replacement. Never delete rows. */
SET XACT_ABORT ON;
SET NOCOUNT ON;
DECLARE @current SYSNAME=N'ai_l2_fault_judgment_online_v2',@backup SYSNAME=N'ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',@failed SYSNAME=N'ai_l2_fault_judgment_online_v2_failed_mig_20260720_01';
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',N'U') IS NULL THROW 51200,'Versioned legacy backup is missing; rollback refused.',1;
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2_failed_mig_20260720_01',N'U') IS NOT NULL THROW 51201,'Failed-table rollback name exists; rollback refused.',1;
IF EXISTS(SELECT 1 FROM dbo.ai_l2_fault_judgment_online_v2) THROW 51202,'New online table contains rows; export/backup and explicit DBA approval are required before rollback.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 IF OBJECT_ID(N'dbo.vw_ai_dashboard_events_source_aware_v2',N'V') IS NOT NULL DROP VIEW dbo.vw_ai_dashboard_events_source_aware_v2;
 EXEC sys.sp_rename N'dbo.ai_l2_fault_judgment_online_v2',@failed,N'OBJECT';
 EXEC sys.sp_rename N'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',@current,N'OBJECT';
 IF OBJECT_ID(N'dbo.vw_ai_dashboard_events_unified_v2',N'V') IS NOT NULL EXEC sys.sp_refreshview N'dbo.vw_ai_dashboard_events_unified_v2';
 COMMIT;
END TRY
BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
SELECT N'ROLLBACK_COMPLETE' result;
