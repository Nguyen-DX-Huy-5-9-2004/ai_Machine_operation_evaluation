USE [OBAD_AI_LOCAL];
GO
SET NOCOUNT ON;
GO

SELECT
    required_table,
    CASE
        WHEN OBJECT_ID(required_table, N'U') IS NULL THEN N'MISSING'
        ELSE N'PRESENT'
    END AS table_status
FROM
(
    VALUES
        (N'dbo.ai_l1_operation_event_sequence'),
        (N'dbo.ai_l1_operation_anomaly_result_production'),
        (N'dbo.ai_l2_fault_confidence_event'),
        (N'dbo.ai_l2_fault_judgment_policy_v2_full'),
        (N'dbo.ai_l2_dashboard_event_core_v2')
) AS required(required_table);
GO
