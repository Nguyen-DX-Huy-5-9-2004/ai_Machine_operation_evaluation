SELECT TOP (50) [event_id]
      ,[machine_id]
      ,[sequence_segment_id]
      ,[event_order_in_segment]
      ,[status_id]
      ,[status_type_code]
      ,[is_on]
      ,[current_signal_code]
      ,[is_loaded]
      ,[is_no_load]
      ,[is_current_near_zero]
      ,[duration_sec]
      ,[gap_from_prev_sec]
      ,[overlap_sec]
      ,[kwh_available_flag]
      ,[kwh_missing_flag]
      ,[kwh_imputed_or_missing_flag]
      ,[kwh_delta_model_value]
      ,[kwh_rate_per_hour]
      ,[kwh_rate_missing_flag]
      ,[loaded_zero_kwh_flag]
      ,[loaded_without_kwh_flag]
      ,[is_raw_end_missing]
      ,[is_invalid_raw_end]
      ,[end_time_imputed_flag]
      ,[is_non_positive_duration]
      ,[is_long_duration]
      ,[is_gap]
      ,[is_big_gap]
      ,[is_overlap]
      ,[machine_group_id]
      ,[location_id]
      ,[hour_of_day]
      ,[day_of_week]
  FROM [i26s02004_dat_dev].[dbo].[vw_ai_l1_train_normal_strict]

CREATE OR ALTER VIEW dbo.vw_ai_l1_train_normal_lenient AS
SELECT
    event_id,
    machine_id,
    sequence_segment_id,
    event_order_in_segment,

    status_id,
    status_type_code,
    is_on,
    current_signal_code,
    is_loaded,
    is_no_load,
    is_current_near_zero,

    duration_sec,
    gap_from_prev_sec,
    overlap_sec,

    kwh_available_flag,
    kwh_missing_flag,
    kwh_imputed_or_missing_flag,
    kwh_delta_model_value,
    kwh_rate_per_hour,
    kwh_rate_missing_flag,
    loaded_zero_kwh_flag,
    loaded_without_kwh_flag,

    is_raw_end_missing,
    is_invalid_raw_end,
    end_time_imputed_flag,
    is_non_positive_duration,
    is_long_duration,
    is_gap,
    is_big_gap,
    is_overlap,

    machine_group_id,
    location_id,
    hour_of_day,
    day_of_week
FROM dbo.ai_l1_operation_event_sequence
WHERE status_id IN (1, 2, 3, 8)
  AND is_open_event = 0
  AND is_non_positive_duration = 0
  AND is_big_gap = 0
  AND duration_sec IS NOT NULL
  AND duration_sec > 0;
GO


IF OBJECT_ID('dbo.ai_l2_future_fault_label', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l2_future_fault_label;
GO

WITH base AS (
    SELECT
        event_id,
        machine_id,
        sequence_segment_id,
        event_order_in_segment,
        event_start_time,
        status_id,

        CASE WHEN status_id IN (6, 7, 9, 10) THEN 1 ELSE 0 END AS is_fault_status,
        CASE WHEN status_id IN (4, 5, 6, 7, 10) THEN 1 ELSE 0 END AS is_maintenance_status,
        CASE WHEN status_id IN (6, 7) THEN 1 ELSE 0 END AS is_repair_status
    FROM dbo.ai_l1_operation_event_sequence
),
future_calc AS (
    SELECT
        b.*,

        MAX(is_fault_status) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND 10 FOLLOWING
        ) AS future_fault_within_10_events,

        MAX(is_fault_status) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND 30 FOLLOWING
        ) AS future_fault_within_30_events,

        MAX(is_maintenance_status) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND 30 FOLLOWING
        ) AS future_maintenance_within_30_events,

        MAX(is_repair_status) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND 30 FOLLOWING
        ) AS future_repair_within_30_events,

        MIN(CASE WHEN is_fault_status = 1 THEN event_order_in_segment END) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
        ) AS next_fault_event_order,

        MIN(CASE WHEN is_fault_status = 1 THEN event_start_time END) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
        ) AS next_fault_event_time,

        MIN(CASE WHEN is_fault_status = 1 THEN status_id END) OVER (
            PARTITION BY machine_id, sequence_segment_id
            ORDER BY event_order_in_segment
            ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
        ) AS next_fault_status_id
    FROM base b
)
SELECT
    event_id,
    machine_id,
    sequence_segment_id,
    event_order_in_segment,

    ISNULL(future_fault_within_10_events, 0) AS future_fault_within_10_events,
    ISNULL(future_fault_within_30_events, 0) AS future_fault_within_30_events,
    ISNULL(future_maintenance_within_30_events, 0) AS future_maintenance_within_30_events,
    ISNULL(future_repair_within_30_events, 0) AS future_repair_within_30_events,

    next_fault_event_order,
    next_fault_event_time,
    next_fault_status_id,

    CASE
        WHEN next_fault_event_order IS NOT NULL
        THEN next_fault_event_order - event_order_in_segment
        ELSE NULL
    END AS events_to_next_fault,

    CASE
        WHEN next_fault_event_time IS NOT NULL
        THEN DATEDIFF(SECOND, event_start_time, next_fault_event_time)
        ELSE NULL
    END AS seconds_to_next_fault,

    CASE
        WHEN next_fault_event_time IS NOT NULL
         AND DATEDIFF(SECOND, event_start_time, next_fault_event_time) BETWEEN 0 AND 30 * 60
        THEN 1 ELSE 0
    END AS future_fault_within_30min,

    CASE
        WHEN next_fault_event_time IS NOT NULL
         AND DATEDIFF(SECOND, event_start_time, next_fault_event_time) BETWEEN 0 AND 60 * 60
        THEN 1 ELSE 0
    END AS future_fault_within_60min

INTO dbo.ai_l2_future_fault_label
FROM future_calc;
GO

CREATE UNIQUE INDEX IX_ai_l2_future_fault_event_id
ON dbo.ai_l2_future_fault_label(event_id);

CREATE INDEX IX_ai_l2_future_fault_machine_sequence
ON dbo.ai_l2_future_fault_label(
    machine_id,
    sequence_segment_id,
    event_order_in_segment
);
GO


CREATE OR ALTER VIEW dbo.vw_ai_l2_train_final AS
SELECT
    l2.event_id,
    l2.machine_id,
    l2.sequence_segment_id,
    l2.event_order_in_segment,

    l2.duration_sec_model_value,
    l2.gap_from_prev_sec_model_value,
    l2.overlap_sec,

    l2.status_id,
    l2.status_type_code,
    l2.current_signal_code,
    l2.is_loaded,
    l2.is_no_load,
    l2.is_current_near_zero,

    l2.known_fault_status,
    l2.known_maintenance_status,
    l2.known_repair_status,
    l2.off_with_fault_status,

    l2.kwh_available_flag,
    l2.kwh_missing_flag,
    l2.kwh_imputed_flag,
    l2.kwh_delta_model_value,
    l2.kwh_rate_per_hour_model_value,
    l2.loaded_zero_kwh_flag,
    l2.loaded_without_kwh_flag,
    l2.energy_inconsistency_flag,

    l2.time_quality_issue_flag,
    l2.kwh_quality_issue_flag,
    l2.data_quality_issue_flag,
    l2.data_quality_issue_count,

    l2.machine_group_id,
    l2.location_id,
    l2.hour_of_day,
    l2.day_of_week,

    l2.fault_evidence_count,
    l2.maintenance_evidence_count,

    fl.future_fault_within_10_events,
    fl.future_fault_within_30_events,
    fl.future_fault_within_30min,
    fl.future_fault_within_60min,
    fl.future_maintenance_within_30_events,
    fl.future_repair_within_30_events,
    fl.next_fault_status_id,
    fl.events_to_next_fault,
    fl.seconds_to_next_fault
FROM dbo.ai_l2_fault_confidence_event l2
LEFT JOIN dbo.ai_l2_future_fault_label fl
    ON l2.event_id = fl.event_id;
GO


CREATE OR ALTER VIEW dbo.vw_ai_l1_train_normal_strict AS
SELECT
    event_id,
    machine_id,
    sequence_segment_id,
    event_order_in_segment,

    status_id,
    status_type_code,
    is_on,
    current_signal_code,
    is_loaded,
    is_no_load,
    is_current_near_zero,

    duration_sec,
    gap_from_prev_sec,
    overlap_sec,

    kwh_available_flag,
    kwh_missing_flag,
    kwh_imputed_or_missing_flag,
    kwh_delta_model_value,
    kwh_rate_per_hour,
    kwh_rate_missing_flag,
    loaded_zero_kwh_flag,
    loaded_without_kwh_flag,

    is_raw_end_missing,
    is_invalid_raw_end,
    end_time_imputed_flag,
    is_non_positive_duration,
    is_long_duration,
    is_gap,
    is_big_gap,
    is_overlap,

    machine_group_id,
    location_id,
    hour_of_day,
    day_of_week
FROM dbo.ai_l1_operation_event_sequence
WHERE status_id IN (1, 2, 3, 8)
  AND is_open_event = 0
  AND is_non_positive_duration = 0
  AND is_big_gap = 0
  AND is_overlap = 0
  AND duration_sec IS NOT NULL
  AND duration_sec > 0;
GO