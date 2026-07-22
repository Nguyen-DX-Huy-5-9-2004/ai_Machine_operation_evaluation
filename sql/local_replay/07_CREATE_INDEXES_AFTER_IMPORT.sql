/*
Create indexes only after every heavy CSV is imported and row counts reconcile.
This script is non-destructive but can take a long time and substantial disk space.
*/
USE [OBAD_AI_LOCAL];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.ai_l1_operation_event_sequence',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l1_operation_event_sequence') AND name=N'UX_ai_l1_event_sequence_event_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_ai_l1_event_sequence_event_id
    ON dbo.ai_l1_operation_event_sequence(event_id);
END;
GO

IF OBJECT_ID(N'dbo.ai_l1_operation_event_sequence',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l1_operation_event_sequence') AND name=N'IX_ai_l1_event_sequence_machine_time')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ai_l1_event_sequence_machine_time
    ON dbo.ai_l1_operation_event_sequence(machine_id,event_start_time,event_id)
    INCLUDE(sequence_segment_id,event_order_in_segment,status_id,location_id);
END;
GO

IF OBJECT_ID(N'dbo.ai_l1_operation_anomaly_result_production',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l1_operation_anomaly_result_production') AND name=N'UX_ai_l1_anomaly_production_event_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_ai_l1_anomaly_production_event_id
    ON dbo.ai_l1_operation_anomaly_result_production(event_id);
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_confidence_event',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l2_fault_confidence_event') AND name=N'UX_ai_l2_confidence_event_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_ai_l2_confidence_event_id
    ON dbo.ai_l2_fault_confidence_event(event_id);
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_confidence_event',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l2_fault_confidence_event') AND name=N'IX_ai_l2_confidence_machine_time')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ai_l2_confidence_machine_time
    ON dbo.ai_l2_fault_confidence_event(machine_id,event_start_time,event_id)
    INCLUDE(status_id,machine_group_id,location_id,data_quality_issue_flag,energy_inconsistency_flag);
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full') AND name=N'UX_ai_l2_policy_full_event_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_ai_l2_policy_full_event_id
    ON dbo.ai_l2_fault_judgment_policy_v2_full(event_id);
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full') AND name=N'IX_ai_l2_policy_action_scored')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ai_l2_policy_action_scored
    ON dbo.ai_l2_fault_judgment_policy_v2_full(operational_action_level,l2_scored_time,event_id)
    INCLUDE(operational_overall_risk_score,quality_action_level,l1_score_available_flag);
END;
GO

IF OBJECT_ID(N'dbo.ai_l2_dashboard_event_core_v2',N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ai_l2_dashboard_event_core_v2') AND name=N'UX_ai_l2_dashboard_core_event_id')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_ai_l2_dashboard_core_event_id
    ON dbo.ai_l2_dashboard_event_core_v2(event_id);
END;
GO

PRINT N'POST-IMPORT INDEX CREATION COMPLETE';
GO
