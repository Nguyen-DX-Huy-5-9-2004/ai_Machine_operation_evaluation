/*
Read-only validation after importing historical AI CSV files.
*/
USE [OBAD_AI_LOCAL];
GO
SET NOCOUNT ON;
GO

SELECT N'dbo.ai_l1_operation_event_sequence' AS table_name, COUNT_BIG(*) AS row_count
FROM dbo.ai_l1_operation_event_sequence
UNION ALL
SELECT N'dbo.ai_l1_operation_anomaly_result_production', COUNT_BIG(*)
FROM dbo.ai_l1_operation_anomaly_result_production
UNION ALL
SELECT N'dbo.ai_l2_fault_confidence_event', COUNT_BIG(*)
FROM dbo.ai_l2_fault_confidence_event
UNION ALL
SELECT N'dbo.ai_l2_fault_judgment_policy_v2_full', COUNT_BIG(*)
FROM dbo.ai_l2_fault_judgment_policy_v2_full
UNION ALL
SELECT N'dbo.ai_l2_dashboard_event_core_v2', COUNT_BIG(*)
FROM dbo.ai_l2_dashboard_event_core_v2;
GO

SELECT TOP (50) event_id, COUNT_BIG(*) AS duplicate_count
FROM dbo.ai_l1_operation_event_sequence
GROUP BY event_id HAVING COUNT_BIG(*)>1
ORDER BY duplicate_count DESC,event_id;
GO

SELECT TOP (50) event_id, COUNT_BIG(*) AS duplicate_count
FROM dbo.ai_l2_fault_confidence_event
GROUP BY event_id HAVING COUNT_BIG(*)>1
ORDER BY duplicate_count DESC,event_id;
GO

SELECT TOP (50) event_id, COUNT_BIG(*) AS duplicate_count
FROM dbo.ai_l2_fault_judgment_policy_v2_full
GROUP BY event_id HAVING COUNT_BIG(*)>1
ORDER BY duplicate_count DESC,event_id;
GO

SELECT
    COUNT_BIG(*) AS policy_rows,
    SUM(CASE WHEN e.event_id IS NULL THEN 1 ELSE 0 END) AS missing_l2_context_rows
FROM dbo.ai_l2_fault_judgment_policy_v2_full h
LEFT JOIN dbo.ai_l2_fault_confidence_event e ON e.event_id=h.event_id;
GO

SELECT
    COUNT_BIG(*) AS l1_core_rows,
    SUM(CASE WHEN s.event_id IS NULL THEN 1 ELSE 0 END) AS missing_l1_score_rows
FROM dbo.ai_l1_operation_event_sequence c
LEFT JOIN dbo.ai_l1_operation_anomaly_result_production s ON s.event_id=c.event_id;
GO

SELECT
    MIN(event_start_time) AS min_event_start,
    MAX(event_start_time) AS max_event_start,
    COUNT(DISTINCT machine_id) AS machine_count
FROM dbo.ai_l2_fault_confidence_event;
GO

SELECT
    operational_action_level,
    COUNT_BIG(*) AS event_count
FROM dbo.ai_l2_fault_judgment_policy_v2_full
GROUP BY operational_action_level
ORDER BY event_count DESC;
GO

SELECT
    quality_action_level,
    COUNT_BIG(*) AS event_count
FROM dbo.ai_l2_fault_judgment_policy_v2_full
GROUP BY quality_action_level
ORDER BY event_count DESC;
GO

IF OBJECT_ID(N'dbo.vw_ai_dashboard_events_source_aware_v2',N'V') IS NOT NULL
BEGIN
    SELECT event_source,dataset_mode,COUNT_BIG(*) AS row_count
    FROM dbo.vw_ai_dashboard_events_source_aware_v2
    GROUP BY event_source,dataset_mode
    ORDER BY event_source,dataset_mode;
END;
GO
