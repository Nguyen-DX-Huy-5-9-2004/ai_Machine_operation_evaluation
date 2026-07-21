/*
Source-aware dashboard read model. Apply only after 02a and 01 pass. The
current branch is restricted by the stored ONLINE_CURRENT_SQL source contract.
Historical production output did not export raw KWh/time telemetry; typed NULL
preserves the contract without inventing values. This script never deduplicates
across sources.
*/
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_policy_v2_full', N'U') IS NULL
    THROW 51020, 'Historical source table is missing.', 1;
IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2', N'U') IS NULL
    THROW 51021, 'Online source table is missing.', 1;
IF COL_LENGTH(N'dbo.ai_l2_fault_judgment_online_v2', N'event_source') IS NULL
   OR COL_LENGTH(N'dbo.ai_l2_fault_judgment_online_v2', N'event_uid') IS NULL
    THROW 51022, 'Run and verify script 01 before creating the dashboard view.', 1;
GO

CREATE OR ALTER VIEW dbo.vw_ai_dashboard_events_source_aware_v2
AS
SELECT
    CAST(N'HISTORICAL_PRODUCTION_SCORE' AS NVARCHAR(50)) AS event_source,
    CONCAT(N'HISTORICAL_PRODUCTION_SCORE:', CONVERT(NVARCHAR(30), h.event_id)) AS event_uid,
    CAST(N'historical' AS NVARCHAR(20)) AS dataset_mode,
    h.event_id, e.machine_id,
    CAST(e.machine_group_id AS INT) AS machine_group_id, CAST(e.location_id AS INT) AS location_id,
    CAST(e.event_start_time AS DATETIME2) AS event_start_time, CAST(e.event_end_time AS DATETIME2) AS event_end_time,
    CAST(h.l2_scored_time AS DATETIME2) AS scored_at,
    e.status_id,
    TRY_CONVERT(INT, e.status_type_code) AS status_type_code,
    TRY_CONVERT(INT, e.current_signal_code) AS current_signal_code,
    CAST(h.risk_fault_10_events AS FLOAT) AS risk_fault_10_events,
    CAST(h.risk_fault_30_events AS FLOAT) AS risk_fault_30_events,
    CAST(h.risk_fault_30min AS FLOAT) AS risk_fault_30min,
    CAST(h.risk_fault_60min AS FLOAT) AS risk_fault_60min,
    CAST(h.risk_maintenance_30_events AS FLOAT) AS risk_maintenance_30_events,
    CAST(h.risk_repair_30_events AS FLOAT) AS risk_repair_30_events,
    CAST(h.operational_action_level AS NVARCHAR(50)) AS operational_action_level,
    CAST(h.operational_judgment AS NVARCHAR(200)) AS operational_judgment,
    CAST(h.operational_overall_risk_score AS FLOAT) AS operational_overall_risk_score,
    CAST(h.quality_action_level AS NVARCHAR(50)) AS quality_action_level,
    CAST(h.quality_judgment AS NVARCHAR(200)) AS quality_judgment,
    CAST(h.quality_risk_score AS FLOAT) AS quality_risk_score,
    CAST(h.is_behavior_anomaly AS BIT) AS is_behavior_anomaly,
    CAST(h.is_sensitive_warning AS BIT) AS is_sensitive_warning,
    CAST(h.behavior_anomaly_score AS FLOAT) AS behavior_anomaly_score,
    CAST(h.behavior_sensitive_score AS FLOAT) AS behavior_sensitive_score,
    CAST(h.behavior_combined_score AS FLOAT) AS behavior_combined_score,
    CAST(h.data_quality_issue_flag AS BIT) AS data_quality_issue_flag,
    CAST(h.energy_inconsistency_flag AS BIT) AS energy_inconsistency_flag,
    CAST(h.kwh_quality_issue_flag AS BIT) AS kwh_quality_issue_flag,
    CAST(h.time_quality_issue_flag AS BIT) AS time_quality_issue_flag,
    CAST(e.kwh_delta AS FLOAT) AS kwh_delta, CAST(e.kwh_rate_per_hour AS FLOAT) AS kwh_rate_per_hour,
    CAST(e.kwh_available_flag AS BIT) AS kwh_available_flag, CAST(e.kwh_missing_flag AS BIT) AS kwh_missing_flag,
    CAST(e.kwh_imputed_flag AS BIT) AS kwh_imputed_flag, CAST(e.loaded_zero_kwh_flag AS BIT) AS loaded_zero_kwh_flag,
    CAST(e.loaded_without_kwh_flag AS BIT) AS loaded_without_kwh_flag, CAST(e.duration_sec AS FLOAT) AS duration_sec,
    CAST(e.gap_from_prev_sec AS FLOAT) AS gap_from_prev_sec, CAST(e.overlap_sec AS FLOAT) AS overlap_sec,
    CAST(h.final_reason_v2 AS NVARCHAR(2000)) AS final_reason_v2,
    CAST(h.l2_run_id AS NVARCHAR(200)) AS l2_run_id, CAST(h.policy_version AS NVARCHAR(400)) AS policy_version,
    CAST(h.l1_score_available_flag AS BIT) AS l1_score_available_flag,
    CAST(CASE WHEN h.risk_fault_10_events IS NOT NULL AND h.risk_fault_30_events IS NOT NULL
                   AND h.risk_fault_30min IS NOT NULL AND h.risk_fault_60min IS NOT NULL
                   AND h.risk_maintenance_30_events IS NOT NULL AND h.risk_repair_30_events IS NOT NULL
              THEN 1 ELSE 0 END AS BIT) AS l2_ready_flag,
    CAST(CASE WHEN h.operational_action_level IN (N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL')
              THEN 1 ELSE 0 END AS BIT) AS policy_ready_flag,
    CAST(CASE WHEN h.l1_score_available_flag = 0 THEN N'HISTORICAL_L1_WINDOW_UNAVAILABLE_L2_RESULT_EXPORTED'
              WHEN h.risk_fault_10_events IS NULL OR h.risk_fault_30_events IS NULL OR h.risk_fault_30min IS NULL OR h.risk_fault_60min IS NULL OR h.risk_maintenance_30_events IS NULL OR h.risk_repair_30_events IS NULL THEN N'HISTORICAL_L2_RESULT_UNAVAILABLE'
              WHEN h.operational_action_level NOT IN (N'LOW',N'MEDIUM',N'HIGH',N'CRITICAL') THEN N'HISTORICAL_POLICY_RESULT_UNAVAILABLE'
              ELSE N'READY' END AS NVARCHAR(300)) AS readiness_reason,
    CAST(NULL AS NVARCHAR(MAX)) AS explanation_json, CAST(NULL AS NVARCHAR(100)) AS explanation_version,
    CAST(NULL AS NVARCHAR(100)) AS runtime_run_id, CAST(NULL AS CHAR(64)) AS raw_source_fingerprint
FROM dbo.ai_l2_fault_judgment_policy_v2_full AS h
LEFT JOIN dbo.ai_l2_fault_confidence_event AS e ON h.event_id=e.event_id
UNION ALL
SELECT
    CAST(o.event_source AS NVARCHAR(50)), CAST(o.event_uid AS NVARCHAR(100)), CAST(N'current' AS NVARCHAR(20)),
    o.event_id, o.machine_id, o.machine_group_id, o.location_id,
    CAST(o.source_event_start_time AS DATETIME2), CAST(o.source_event_end_time AS DATETIME2), CAST(o.scored_time AS DATETIME2),
    o.status_id, TRY_CONVERT(INT,o.status_type_code), TRY_CONVERT(INT,o.current_signal_code),
    CAST(o.risk_fault_10_events AS FLOAT), CAST(o.risk_fault_30_events AS FLOAT), CAST(o.risk_fault_30min AS FLOAT),
    CAST(o.risk_fault_60min AS FLOAT), CAST(o.risk_maintenance_30_events AS FLOAT), CAST(o.risk_repair_30_events AS FLOAT),
    CAST(o.operational_action_level AS NVARCHAR(50)), CAST(o.operational_judgment AS NVARCHAR(200)), CAST(o.operational_overall_risk_score AS FLOAT),
    CAST(o.quality_action_level AS NVARCHAR(50)), CAST(o.quality_judgment AS NVARCHAR(200)), CAST(o.quality_risk_score AS FLOAT),
    CAST(o.is_behavior_anomaly AS BIT), CAST(o.is_sensitive_warning AS BIT), CAST(o.behavior_anomaly_score AS FLOAT),
    CAST(o.behavior_sensitive_score AS FLOAT), CAST(o.behavior_combined_score AS FLOAT), CAST(o.data_quality_issue_flag AS BIT),
    CAST(o.energy_inconsistency_flag AS BIT), CAST(o.kwh_quality_issue_flag AS BIT), CAST(o.time_quality_issue_flag AS BIT),
    CAST(o.kwh_delta AS FLOAT), CAST(o.kwh_rate_per_hour AS FLOAT), CAST(o.kwh_available_flag AS BIT),
    CAST(o.kwh_missing_flag AS BIT), CAST(o.kwh_imputed_flag AS BIT), CAST(o.loaded_zero_kwh_flag AS BIT),
    CAST(o.loaded_without_kwh_flag AS BIT), CAST(o.duration_sec AS FLOAT), CAST(o.gap_from_prev_sec AS FLOAT), CAST(o.overlap_sec AS FLOAT),
    CAST(o.final_reason_v2 AS NVARCHAR(2000)), CAST(o.l2_run_id AS NVARCHAR(200)), CAST(o.policy_version AS NVARCHAR(400)),
    CAST(o.l1_score_available_flag AS BIT), CAST(o.l2_ready_flag AS BIT), CAST(o.policy_ready_flag AS BIT),
    CAST(o.readiness_reason AS NVARCHAR(300)), CAST(o.explanation_json AS NVARCHAR(MAX)), CAST(o.explanation_version AS NVARCHAR(100)),
    CAST(o.runtime_run_id AS NVARCHAR(100)), CAST(o.raw_source_fingerprint AS CHAR(64))
FROM dbo.ai_l2_fault_judgment_online_v2 AS o;
GO
