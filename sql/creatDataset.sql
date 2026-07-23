/*IF OBJECT_ID('dbo.ai_l1_operation_event_sequence', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l1_operation_event_sequence;
GO

WITH base_event AS (
    SELECT
        iot.id AS event_id,
        iot.machine_id,
        iot.status_id,
        iot.status_time_start,
        iot.status_time_end,
        iot.status_kwh_start,
        iot.status_kwh_end,
        iot.note AS event_note,
        iot.error_code,

        ms.status_name,
        ms.iottag_part_signal,
        ms.[type] AS status_type,
        ms.is_show AS status_is_show,
        ms.note AS status_note,
        ms.group_id AS status_group_id,

        m.machine_name,
        m.machine_group_id,
        m.machine_model,
        m.machine_branch_id,
        m.machine_call_name,
        m.machine_serial_no,
        m.year_of_production,
        m.machine_supplier,
        m.iottag_part_machine,

        mlh.location_id,
        loc.location_code,
        loc.location_name,
        loc.location_parent_id,
        loc.location_level_id

    FROM dbo.data_iot_convert iot
    LEFT JOIN dbo.data_machine_status ms
        ON iot.status_id = ms.id
       AND ISNULL(ms.is_deleted, 0) = 0
    LEFT JOIN dbo.data_machine m
        ON iot.machine_id = m.id
    OUTER APPLY (
        SELECT TOP 1
            h.location_id,
            h.start_time,
            h.end_time
        FROM dbo.machine_location_his h
        WHERE h.machine_id = iot.machine_id
          AND ISNULL(h.is_deleted, 0) = 0
          AND iot.status_time_start >= h.start_time
          AND (
                h.end_time IS NULL
                OR iot.status_time_start < h.end_time
              )
        ORDER BY h.start_time DESC
    ) mlh
    LEFT JOIN dbo.data_location loc
        ON mlh.location_id = loc.id
       AND ISNULL(loc.is_deleted, 0) = 0
    WHERE ISNULL(iot.is_deleted, 0) = 0
      AND iot.machine_id IS NOT NULL
      AND iot.status_id IS NOT NULL
      AND iot.status_time_start IS NOT NULL
),
ordered_event AS (
    SELECT
        b.*,

        LAG(b.status_id) OVER (
            PARTITION BY b.machine_id
            ORDER BY b.status_time_start, b.event_id
        ) AS prev_status_id,

        LEAD(b.status_id) OVER (
            PARTITION BY b.machine_id
            ORDER BY b.status_time_start, b.event_id
        ) AS next_status_id,

        LAG(b.status_time_end) OVER (
            PARTITION BY b.machine_id
            ORDER BY b.status_time_start, b.event_id
        ) AS prev_status_time_end,

        LEAD(b.status_time_start) OVER (
            PARTITION BY b.machine_id
            ORDER BY b.status_time_start, b.event_id
        ) AS next_status_time_start
    FROM base_event b
),
clean_event AS (
    SELECT
        o.*,

        CASE
            WHEN o.status_time_end IS NOT NULL THEN o.status_time_end
            WHEN o.next_status_time_start IS NOT NULL THEN o.next_status_time_start
            ELSE NULL
        END AS effective_status_time_end,

        CASE
            WHEN o.status_time_end IS NULL THEN 1 ELSE 0
        END AS is_open_event,

        CASE
            WHEN o.status_time_end IS NULL
             AND o.next_status_time_start IS NOT NULL THEN 1
            ELSE 0
        END AS end_time_imputed_flag,

        DATEDIFF(
            SECOND,
            o.status_time_start,
            CASE
                WHEN o.status_time_end IS NOT NULL THEN o.status_time_end
                WHEN o.next_status_time_start IS NOT NULL THEN o.next_status_time_start
                ELSE o.status_time_start
            END
        ) AS duration_sec,

        CASE
            WHEN o.prev_status_time_end IS NULL THEN NULL
            ELSE DATEDIFF(SECOND, o.prev_status_time_end, o.status_time_start)
        END AS gap_from_prev_sec,

        CASE
            WHEN o.prev_status_time_end IS NOT NULL
             AND o.status_time_start < o.prev_status_time_end
            THEN DATEDIFF(SECOND, o.status_time_start, o.prev_status_time_end)
            ELSE 0
        END AS overlap_sec,

        CASE
            WHEN o.status_kwh_start IS NOT NULL
             AND o.status_kwh_end IS NOT NULL
            THEN o.status_kwh_end - o.status_kwh_start
            ELSE NULL
        END AS kwh_delta,

        CASE
            WHEN o.status_kwh_start IS NULL
              OR o.status_kwh_end IS NULL
            THEN 1 ELSE 0
        END AS kwh_missing_flag,

        CASE WHEN o.status_type = 'ON' THEN 1 ELSE 0 END AS is_on,
        CASE WHEN o.status_type = 'OFF' THEN 1 ELSE 0 END AS is_off,
        CASE WHEN o.status_type = 'INFO' THEN 1 ELSE 0 END AS is_info,

        CASE
            WHEN ISNULL(o.status_note, o.event_note) LIKE N'%Dòng>0%' THEN 1 ELSE 0
        END AS is_loaded,

        CASE
            WHEN ISNULL(o.status_note, o.event_note) LIKE N'%Dòng=0%' THEN 1 ELSE 0
        END AS is_no_load,

        CASE
            WHEN ISNULL(o.status_note, o.event_note) LIKE N'%Có lỗi%' THEN 1 ELSE 0
        END AS has_error_token,

        CASE
            WHEN ISNULL(o.status_note, o.event_note) LIKE N'%Có bảo trì%' THEN 1 ELSE 0
        END AS has_maintenance_token,

        DATEPART(HOUR, o.status_time_start) AS hour_of_day,
        DATEPART(WEEKDAY, o.status_time_start) AS day_of_week,
        CAST(o.status_time_start AS date) AS operation_date
    FROM ordered_event o
),
flagged_event AS (
    SELECT
        c.*,

        CASE
            WHEN c.duration_sec <= 0 THEN 1
            WHEN c.duration_sec > 24 * 3600 THEN 1
            ELSE 0
        END AS is_bad_duration,

        CASE
            WHEN c.gap_from_prev_sec IS NULL THEN 0
            WHEN c.gap_from_prev_sec > 60 * 60 THEN 1
            ELSE 0
        END AS is_big_gap,

        CASE
            WHEN c.gap_from_prev_sec IS NULL THEN 0
            WHEN c.gap_from_prev_sec > 5 * 60 THEN 1
            ELSE 0
        END AS is_gap,

        CASE
            WHEN c.overlap_sec > 0 THEN 1 ELSE 0
        END AS is_overlap,

        CASE
            WHEN c.is_loaded = 1
             AND c.status_kwh_start IS NOT NULL
             AND c.status_kwh_end IS NOT NULL
             AND c.status_kwh_end - c.status_kwh_start = 0
            THEN 1 ELSE 0
        END AS loaded_zero_kwh_flag,

        CASE
            WHEN c.is_loaded = 1
             AND (c.status_kwh_start IS NULL OR c.status_kwh_end IS NULL)
            THEN 1 ELSE 0
        END AS loaded_without_kwh_flag
    FROM clean_event c
),
segmented_event AS (
    SELECT
        f.*,

        SUM(
            CASE
                WHEN f.prev_status_id IS NULL THEN 1
                WHEN f.is_big_gap = 1 THEN 1
                WHEN f.is_bad_duration = 1 THEN 1
                ELSE 0
            END
        ) OVER (
            PARTITION BY f.machine_id
            ORDER BY f.status_time_start, f.event_id
            ROWS UNBOUNDED PRECEDING
        ) AS sequence_segment_id
    FROM flagged_event f
)
SELECT
    ROW_NUMBER() OVER (
        PARTITION BY machine_id, sequence_segment_id
        ORDER BY status_time_start, event_id
    ) AS event_order_in_segment,

    event_id,
    machine_id,
    status_id,
    prev_status_id,
    next_status_id,

    status_time_start,
    status_time_end,
    effective_status_time_end,
    duration_sec,
    prev_status_time_end,
    gap_from_prev_sec,
    overlap_sec,

    status_kwh_start,
    status_kwh_end,
    kwh_delta,
    kwh_missing_flag,
    loaded_zero_kwh_flag,
    loaded_without_kwh_flag,

    event_note,
    error_code,
    status_name,
    iottag_part_signal,
    status_type,
    status_is_show,
    status_note,
    status_group_id,

    is_on,
    is_off,
    is_info,
    is_loaded,
    is_no_load,
    has_error_token,
    has_maintenance_token,

    is_open_event,
    end_time_imputed_flag,
    is_bad_duration,
    is_gap,
    is_big_gap,
    is_overlap,
    sequence_segment_id,

    machine_name,
    machine_group_id,
    machine_model,
    machine_branch_id,
    machine_call_name,
    machine_serial_no,
    CASE WHEN year_of_production = 0 THEN NULL ELSE year_of_production END AS year_of_production,
    machine_supplier,
    iottag_part_machine,

    location_id,
    location_code,
    location_name,
    location_parent_id,
    location_level_id,

    hour_of_day,
    day_of_week,
    operation_date,

    CAST(NULL AS float) AS behavior_anomaly_score,
    CAST(NULL AS bit) AS is_behavior_anomaly,
    CAST(NULL AS nvarchar(500)) AS behavior_reason
INTO dbo.ai_l1_operation_event_sequence
FROM segmented_event;
GO

CREATE INDEX IX_ai_l1_machine_time
ON dbo.ai_l1_operation_event_sequence(machine_id, status_time_start, event_id);

CREATE INDEX IX_ai_l1_segment
ON dbo.ai_l1_operation_event_sequence(machine_id, sequence_segment_id, event_order_in_segment);
GO
*/



IF OBJECT_ID('dbo.ai_l2_fault_confidence_event', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l2_fault_confidence_event;
GO

WITH l1 AS (
    SELECT
        *,
        TRY_CONVERT(int, status_id) AS status_id_int,

        CASE
            WHEN event_order_in_segment = 1 THEN 1 ELSE 0
        END AS is_first_event_in_segment,

        CASE
            WHEN duration_sec IS NULL THEN 0 ELSE duration_sec
        END AS duration_sec_model_value,

        CASE
            WHEN gap_from_prev_sec IS NULL THEN 0 ELSE gap_from_prev_sec
        END AS gap_from_prev_sec_model_value,

        CASE
            WHEN kwh_rate_per_hour IS NULL THEN 0 ELSE kwh_rate_per_hour
        END AS kwh_rate_per_hour_model_value
    FROM dbo.ai_l1_operation_event_sequence
),

evidence AS (
    SELECT
        l1.*,

        -- =====================================================
        -- 1. Bằng chứng trạng thái lỗi / bảo trì từ status_id
        -- =====================================================
        CASE
            WHEN l1.status_id_int IN (6, 7, 9, 10)
              OR l1.has_error_token = 1
            THEN 1 ELSE 0
        END AS known_fault_status,

        CASE
            WHEN l1.status_id_int IN (4, 5, 6, 7, 10)
              OR l1.has_maintenance_token = 1
            THEN 1 ELSE 0
        END AS known_maintenance_status,

        CASE
            WHEN l1.status_id_int IN (6, 7)
            THEN 1 ELSE 0
        END AS known_repair_status,

        CASE
            WHEN l1.status_id_int IN (9, 10)
            THEN 1 ELSE 0
        END AS off_with_fault_status,

        CASE
            WHEN l1.status_id_int IN (11, 12, 13, 14)
              OR l1.status_type_code = 2
            THEN 1 ELSE 0
        END AS info_status,

        CASE
            WHEN l1.status_id_int = 3 THEN 1 ELSE 0
        END AS normal_loaded_production_status,

        CASE
            WHEN l1.status_id_int = 2 THEN 1 ELSE 0
        END AS normal_no_load_production_status,

        CASE
            WHEN l1.status_id_int = 1 THEN 1 ELSE 0
        END AS power_on_near_zero_status,

        CASE
            WHEN l1.status_id_int = 8 THEN 1 ELSE 0
        END AS normal_power_off_status,

        -- =====================================================
        -- 2. Bằng chứng bất thường năng lượng
        -- =====================================================
        CASE
            WHEN l1.loaded_zero_kwh_flag = 1
              OR l1.kwh_negative_delta_flag = 1
            THEN 1 ELSE 0
        END AS energy_inconsistency_flag,

        CASE
            WHEN l1.is_loaded = 1
             AND l1.kwh_available_flag = 0
            THEN 1 ELSE 0
        END AS loaded_energy_unavailable_flag,

        CASE
            WHEN l1.is_loaded = 1
             AND l1.kwh_available_flag = 1
             AND l1.kwh_delta > 0
            THEN 1 ELSE 0
        END AS loaded_energy_positive_evidence,

        CASE
            WHEN l1.kwh_available_flag = 1
             AND l1.kwh_delta < 0
            THEN 1 ELSE 0
        END AS energy_counter_suspect_flag,

        -- =====================================================
        -- 3. Chất lượng dữ liệu thời gian
        -- =====================================================
        CASE
            WHEN l1.is_open_event = 1
              OR l1.is_invalid_raw_end = 1
              OR l1.is_non_positive_duration = 1
              OR l1.is_big_gap = 1
              OR l1.is_overlap = 1
            THEN 1 ELSE 0
        END AS time_quality_issue_flag,

        CASE
            WHEN l1.end_time_imputed_flag = 1
              OR l1.is_raw_end_missing = 1
              OR l1.is_invalid_raw_end = 1
            THEN 1 ELSE 0
        END AS time_imputed_or_repaired_flag,

        -- =====================================================
        -- 4. Chất lượng dữ liệu KWh
        -- =====================================================
        CASE
            WHEN l1.kwh_missing_flag = 1
              OR l1.kwh_imputed_or_missing_flag = 1
              OR l1.kwh_rate_missing_flag = 1
              OR l1.kwh_negative_delta_flag = 1
            THEN 1 ELSE 0
        END AS kwh_quality_issue_flag,

        CASE
            WHEN l1.kwh_start_imputed_flag = 1
              OR l1.kwh_end_imputed_flag = 1
            THEN 1 ELSE 0
        END AS kwh_imputed_flag
    FROM l1
),

final_dataset AS (
    SELECT
        e.*,

        CASE
            WHEN e.time_quality_issue_flag = 1
              OR e.kwh_quality_issue_flag = 1
            THEN 1 ELSE 0
        END AS data_quality_issue_flag,

        (
            ISNULL(e.is_open_event, 0)
          + ISNULL(e.is_invalid_raw_end, 0)
          + ISNULL(e.is_non_positive_duration, 0)
          + ISNULL(e.is_big_gap, 0)
          + ISNULL(e.is_overlap, 0)
          + ISNULL(e.kwh_missing_flag, 0)
          + ISNULL(e.kwh_imputed_flag, 0)
          + ISNULL(e.kwh_negative_delta_flag, 0)
        ) AS data_quality_issue_count,

        (
            ISNULL(e.known_fault_status, 0)
          + ISNULL(e.known_repair_status, 0)
          + ISNULL(e.off_with_fault_status, 0)
          + ISNULL(e.energy_inconsistency_flag, 0)
        ) AS fault_evidence_count,

        (
            ISNULL(e.known_maintenance_status, 0)
          + ISNULL(e.known_repair_status, 0)
        ) AS maintenance_evidence_count,

        CASE
            WHEN e.is_open_event = 1 THEN N'OPEN_EVENT'
            WHEN e.is_non_positive_duration = 1 THEN N'NON_POSITIVE_DURATION'
            WHEN e.is_overlap = 1 THEN N'OVERLAP_EVENT'
            WHEN e.is_big_gap = 1 THEN N'BIG_GAP'
            WHEN e.kwh_negative_delta_flag = 1 THEN N'NEGATIVE_KWH_DELTA'
            WHEN e.kwh_missing_flag = 1 THEN N'KWH_MISSING'
            WHEN e.kwh_imputed_flag = 1 THEN N'KWH_IMPUTED'
            ELSE N'OK'
        END AS data_quality_reason,

        CASE
            WHEN e.known_repair_status = 1 THEN N'REPAIR_STATUS'
            WHEN e.off_with_fault_status = 1 THEN N'OFF_WITH_FAULT'
            WHEN e.known_fault_status = 1 THEN N'FAULT_STATUS'
            WHEN e.known_maintenance_status = 1 THEN N'MAINTENANCE_STATUS'
            WHEN e.energy_inconsistency_flag = 1 THEN N'ENERGY_INCONSISTENCY'
            WHEN e.normal_loaded_production_status = 1 THEN N'NORMAL_LOADED_PRODUCTION'
            WHEN e.normal_no_load_production_status = 1 THEN N'NORMAL_NO_LOAD_PRODUCTION'
            WHEN e.normal_power_off_status = 1 THEN N'NORMAL_POWER_OFF'
            WHEN e.power_on_near_zero_status = 1 THEN N'POWER_ON_NEAR_ZERO'
            ELSE N'UNLABELED_OPERATION'
        END AS status_evidence_class
    FROM evidence e
)

SELECT
    -- =========================================================
    -- 1. Khóa liên kết 1-1 với L1
    -- =========================================================
    event_id,
    machine_id,
    sequence_segment_id,
    event_order_in_segment,
    is_first_event_in_segment,

    -- =========================================================
    -- 2. Thời gian, chuỗi và duration
    -- =========================================================
    event_start_time,
    event_end_time,
    end_time_source,
    duration_sec,
    duration_sec_model_value,
    gap_from_prev_sec,
    gap_from_prev_sec_model_value,
    overlap_sec,

    -- =========================================================
    -- 3. Trạng thái vận hành
    -- =========================================================
    status_id,
    status_type_code,
    is_on,
    current_signal_code,
    is_loaded,
    is_no_load,
    is_current_near_zero,
    has_error_token,
    has_maintenance_token,

    -- =========================================================
    -- 4. Bằng chứng status cho lớp 2
    -- =========================================================
    known_fault_status,
    known_maintenance_status,
    known_repair_status,
    off_with_fault_status,
    info_status,
    normal_loaded_production_status,
    normal_no_load_production_status,
    power_on_near_zero_status,
    normal_power_off_status,
    status_evidence_class,

    -- =========================================================
    -- 5. KWh đã xử lý từ L1
    -- =========================================================
    kwh_available_flag,
    kwh_missing_flag,
    kwh_imputed_flag,
    kwh_imputed_or_missing_flag,
    kwh_start_imputed_flag,
    kwh_end_imputed_flag,
    kwh_delta,
    kwh_delta_model_value,
    kwh_zero_delta_flag,
    kwh_positive_delta_flag,
    kwh_negative_delta_flag,
    kwh_rate_per_hour,
    kwh_rate_per_hour_model_value,
    kwh_rate_missing_flag,
    loaded_positive_kwh_flag,
    loaded_zero_kwh_flag,
    loaded_without_kwh_flag,
    energy_inconsistency_flag,
    loaded_energy_unavailable_flag,
    loaded_energy_positive_evidence,
    energy_counter_suspect_flag,

    -- =========================================================
    -- 6. Chất lượng dữ liệu
    -- =========================================================
    is_raw_end_missing,
    is_invalid_raw_end,
    is_open_event,
    end_time_imputed_flag,
    is_non_positive_duration,
    is_long_duration,
    is_gap,
    is_big_gap,
    is_overlap,
    time_quality_issue_flag,
    time_imputed_or_repaired_flag,
    kwh_quality_issue_flag,
    data_quality_issue_flag,
    data_quality_issue_count,
    data_quality_reason,

    -- =========================================================
    -- 7. Context nhẹ
    -- =========================================================
    machine_group_id,
    location_id,
    hour_of_day,
    day_of_week,

    -- =========================================================
    -- 8. Điểm bằng chứng sơ bộ, không phải output cuối
    -- =========================================================
    fault_evidence_count,
    maintenance_evidence_count

INTO dbo.ai_l2_fault_confidence_event
FROM final_dataset;
GO

CREATE UNIQUE INDEX IX_ai_l2_fault_event_id
ON dbo.ai_l2_fault_confidence_event(event_id);
GO

CREATE INDEX IX_ai_l2_fault_machine_sequence
ON dbo.ai_l2_fault_confidence_event(
    machine_id,
    sequence_segment_id,
    event_order_in_segment
);
GO

CREATE INDEX IX_ai_l2_fault_machine_time
ON dbo.ai_l2_fault_confidence_event(
    machine_id,
    event_start_time
);
GO

CREATE INDEX IX_ai_l2_fault_status_evidence
ON dbo.ai_l2_fault_confidence_event(
    known_fault_status,
    known_maintenance_status,
    known_repair_status,
    data_quality_issue_flag
);
GO



IF OBJECT_ID('dbo.ai_l1_operation_event_sequence', 'U') IS NOT NULL
    DROP TABLE dbo.ai_l1_operation_event_sequence;
GO

DECLARE @KwhFillMaxGapSec INT = 5 * 60;   -- chỉ fill KWh nếu gap <= 5 phút
DECLARE @BigGapSec INT = 60 * 60;         -- gap lớn để cắt segment
DECLARE @SmallGapSec INT = 5 * 60;        -- gap nhỏ để đánh dấu is_gap

WITH base_event AS (
    SELECT
        iot.id AS event_id,
        iot.machine_id,
        iot.status_id,
        iot.status_time_start AS event_start_time,
        iot.status_time_end AS raw_event_end_time,
        iot.status_kwh_start AS raw_status_kwh_start,
        iot.status_kwh_end AS raw_status_kwh_end,

        ms.[type] AS status_type,
        ms.note AS status_note,

        m.machine_group_id,

        mlh.location_id
    FROM dbo.data_iot_convert iot
    LEFT JOIN dbo.data_machine_status ms
        ON iot.status_id = ms.id
       AND ISNULL(ms.is_deleted, 0) = 0
    LEFT JOIN dbo.data_machine m
        ON iot.machine_id = m.id
    OUTER APPLY (
        SELECT TOP 1
            h.location_id
        FROM dbo.machine_location_his h
        WHERE h.machine_id = iot.machine_id
          AND ISNULL(h.is_deleted, 0) = 0
          AND iot.status_time_start >= h.start_time
          AND (
                h.end_time IS NULL
                OR iot.status_time_start < h.end_time
              )
        ORDER BY h.start_time DESC
    ) mlh
    WHERE ISNULL(iot.is_deleted, 0) = 0
      AND iot.machine_id IS NOT NULL
      AND iot.status_id IS NOT NULL
      AND iot.status_time_start IS NOT NULL
),

distinct_event_start AS (
    SELECT DISTINCT
        machine_id,
        event_start_time
    FROM base_event
),

next_start_map AS (
    SELECT
        machine_id,
        event_start_time,
        LEAD(event_start_time) OVER (
            PARTITION BY machine_id
            ORDER BY event_start_time
        ) AS next_greater_event_start_time
    FROM distinct_event_start
),

time_resolved AS (
    SELECT
        b.*,
        n.next_greater_event_start_time,

        CASE
            WHEN b.raw_event_end_time IS NOT NULL
             AND b.raw_event_end_time > b.event_start_time
            THEN b.raw_event_end_time

            WHEN n.next_greater_event_start_time IS NOT NULL
             AND n.next_greater_event_start_time > b.event_start_time
            THEN n.next_greater_event_start_time

            ELSE NULL
        END AS event_end_time,

        CASE
            WHEN b.raw_event_end_time IS NOT NULL
             AND b.raw_event_end_time > b.event_start_time
            THEN 'RAW'

            WHEN b.raw_event_end_time IS NULL
             AND n.next_greater_event_start_time IS NOT NULL
             AND n.next_greater_event_start_time > b.event_start_time
            THEN 'NEXT_EVENT_START_FROM_NULL'

            WHEN b.raw_event_end_time IS NOT NULL
             AND b.raw_event_end_time <= b.event_start_time
             AND n.next_greater_event_start_time IS NOT NULL
             AND n.next_greater_event_start_time > b.event_start_time
            THEN 'NEXT_EVENT_START_FROM_INVALID_RAW'

            WHEN b.raw_event_end_time IS NULL
             AND n.next_greater_event_start_time IS NULL
            THEN 'OPEN_EVENT'

            ELSE 'UNRESOLVED_INVALID_TIME'
        END AS end_time_source
    FROM base_event b
    LEFT JOIN next_start_map n
        ON b.machine_id = n.machine_id
       AND b.event_start_time = n.event_start_time
),

time_clean AS (
    SELECT
        t.*,

        CASE
            WHEN t.raw_event_end_time IS NULL THEN 1 ELSE 0
        END AS is_raw_end_missing,

        CASE
            WHEN t.raw_event_end_time IS NOT NULL
             AND t.raw_event_end_time <= t.event_start_time
            THEN 1 ELSE 0
        END AS is_invalid_raw_end,

        CASE
            WHEN t.end_time_source IN (
                'NEXT_EVENT_START_FROM_NULL',
                'NEXT_EVENT_START_FROM_INVALID_RAW'
            )
            THEN 1 ELSE 0
        END AS end_time_imputed_flag,

        CASE
            WHEN t.event_end_time IS NULL THEN 1 ELSE 0
        END AS is_open_event,

        CASE
            WHEN t.event_end_time IS NOT NULL
            THEN DATEDIFF(SECOND, t.event_start_time, t.event_end_time)
            ELSE NULL
        END AS duration_sec,

        CASE
            WHEN t.status_type = 'ON' THEN 1
            WHEN t.status_type = 'OFF' THEN 0
            WHEN t.status_type = 'INFO' THEN 2
            ELSE NULL
        END AS status_type_code,

        CASE WHEN t.status_type = 'ON' THEN 1 ELSE 0 END AS is_on,

        CASE WHEN t.status_note LIKE N'%Dòng>0%' THEN 1 ELSE 0 END AS is_loaded,
        CASE WHEN t.status_note LIKE N'%Dòng=0%' THEN 1 ELSE 0 END AS is_no_load,
        CASE WHEN t.status_note LIKE N'%Dòng ~ 0%' THEN 1 ELSE 0 END AS is_current_near_zero,

        CASE
            WHEN t.status_note LIKE N'%Dòng>0%' THEN 2
            WHEN t.status_note LIKE N'%Dòng=0%' THEN 1
            WHEN t.status_note LIKE N'%Dòng ~ 0%' THEN 0
            ELSE NULL
        END AS current_signal_code,

        CASE WHEN t.status_note LIKE N'%Có lỗi%' THEN 1 ELSE 0 END AS has_error_token,
        CASE WHEN t.status_note LIKE N'%Có bảo trì%' THEN 1 ELSE 0 END AS has_maintenance_token,

        DATEPART(HOUR, t.event_start_time) AS hour_of_day,
        DATEPART(WEEKDAY, t.event_start_time) AS day_of_week
    FROM time_resolved t
),

ordered_event AS (
    SELECT
        c.*,

        LAG(c.status_id) OVER (
            PARTITION BY c.machine_id
            ORDER BY c.event_start_time, c.event_id
        ) AS prev_status_id,

        LAG(c.event_end_time) OVER (
            PARTITION BY c.machine_id
            ORDER BY c.event_start_time, c.event_id
        ) AS prev_event_end_time,

        LAG(c.raw_status_kwh_end) OVER (
            PARTITION BY c.machine_id
            ORDER BY c.event_start_time, c.event_id
        ) AS prev_raw_status_kwh_end,

        LEAD(c.event_start_time) OVER (
            PARTITION BY c.machine_id
            ORDER BY c.event_start_time, c.event_id
        ) AS next_event_start_time_for_kwh,

        LEAD(c.raw_status_kwh_start) OVER (
            PARTITION BY c.machine_id
            ORDER BY c.event_start_time, c.event_id
        ) AS next_raw_status_kwh_start
    FROM time_clean c
),

sequence_features AS (
    SELECT
        o.*,

        CASE
            WHEN o.prev_event_end_time IS NULL THEN NULL
            ELSE DATEDIFF(SECOND, o.prev_event_end_time, o.event_start_time)
        END AS gap_from_prev_sec,

        CASE
            WHEN o.prev_event_end_time IS NOT NULL
             AND o.event_start_time < o.prev_event_end_time
            THEN DATEDIFF(SECOND, o.event_start_time, o.prev_event_end_time)
            ELSE 0
        END AS overlap_sec,

        CASE
            WHEN o.event_end_time IS NULL
              OR o.next_event_start_time_for_kwh IS NULL
            THEN NULL
            ELSE DATEDIFF(SECOND, o.event_end_time, o.next_event_start_time_for_kwh)
        END AS gap_to_next_sec
    FROM ordered_event o
),

kwh_resolved AS (
    SELECT
        s.*,

        CASE
            WHEN s.raw_status_kwh_start IS NOT NULL
            THEN s.raw_status_kwh_start

            WHEN s.raw_status_kwh_start IS NULL
             AND s.prev_raw_status_kwh_end IS NOT NULL
             AND s.gap_from_prev_sec IS NOT NULL
             AND s.gap_from_prev_sec BETWEEN 0 AND @KwhFillMaxGapSec
            THEN s.prev_raw_status_kwh_end

            ELSE NULL
        END AS kwh_start_value,

        CASE
            WHEN s.raw_status_kwh_start IS NOT NULL
            THEN 'RAW'

            WHEN s.raw_status_kwh_start IS NULL
             AND s.prev_raw_status_kwh_end IS NOT NULL
             AND s.gap_from_prev_sec IS NOT NULL
             AND s.gap_from_prev_sec BETWEEN 0 AND @KwhFillMaxGapSec
            THEN 'PREV_EVENT_END'

            ELSE 'MISSING'
        END AS kwh_start_source,

        CASE
            WHEN s.raw_status_kwh_end IS NOT NULL
            THEN s.raw_status_kwh_end

            WHEN s.raw_status_kwh_end IS NULL
             AND s.next_raw_status_kwh_start IS NOT NULL
             AND s.gap_to_next_sec IS NOT NULL
             AND s.gap_to_next_sec BETWEEN 0 AND @KwhFillMaxGapSec
            THEN s.next_raw_status_kwh_start

            ELSE NULL
        END AS kwh_end_value,

        CASE
            WHEN s.raw_status_kwh_end IS NOT NULL
            THEN 'RAW'

            WHEN s.raw_status_kwh_end IS NULL
             AND s.next_raw_status_kwh_start IS NOT NULL
             AND s.gap_to_next_sec IS NOT NULL
             AND s.gap_to_next_sec BETWEEN 0 AND @KwhFillMaxGapSec
            THEN 'NEXT_EVENT_START'

            ELSE 'MISSING'
        END AS kwh_end_source
    FROM sequence_features s
),

kwh_features AS (
    SELECT
        k.*,

        CASE
            WHEN k.raw_status_kwh_start IS NOT NULL
             AND k.raw_status_kwh_end IS NOT NULL
            THEN 1 ELSE 0
        END AS kwh_raw_available_flag,

        CASE
            WHEN k.kwh_start_value IS NOT NULL
             AND k.kwh_end_value IS NOT NULL
            THEN 1 ELSE 0
        END AS kwh_available_flag,

        CASE
            WHEN k.kwh_start_value IS NULL
              OR k.kwh_end_value IS NULL
            THEN 1 ELSE 0
        END AS kwh_missing_flag,

        CASE
            WHEN k.kwh_start_source <> 'RAW'
              OR k.kwh_end_source <> 'RAW'
            THEN 1 ELSE 0
        END AS kwh_imputed_or_missing_flag,

        CASE
            WHEN k.kwh_start_source = 'PREV_EVENT_END'
            THEN 1 ELSE 0
        END AS kwh_start_imputed_flag,

        CASE
            WHEN k.kwh_end_source = 'NEXT_EVENT_START'
            THEN 1 ELSE 0
        END AS kwh_end_imputed_flag,

        CASE
            WHEN k.kwh_start_value IS NOT NULL
             AND k.kwh_end_value IS NOT NULL
            THEN k.kwh_end_value - k.kwh_start_value
            ELSE NULL
        END AS kwh_delta,

        CASE
            WHEN k.kwh_start_value IS NOT NULL
             AND k.kwh_end_value IS NOT NULL
            THEN k.kwh_end_value - k.kwh_start_value
            ELSE 0
        END AS kwh_delta_model_value
    FROM kwh_resolved k
),

flagged_event AS (
    SELECT
        f.*,

        CASE
            WHEN f.duration_sec IS NOT NULL
             AND f.duration_sec <= 0
            THEN 1 ELSE 0
        END AS is_non_positive_duration,

        CASE
            WHEN f.duration_sec IS NOT NULL
             AND f.duration_sec > 24 * 3600
            THEN 1 ELSE 0
        END AS is_long_duration,

        CASE
            WHEN f.gap_from_prev_sec IS NULL THEN 0
            WHEN f.gap_from_prev_sec > @BigGapSec THEN 1
            ELSE 0
        END AS is_big_gap,

        CASE
            WHEN f.gap_from_prev_sec IS NULL THEN 0
            WHEN f.gap_from_prev_sec > @SmallGapSec THEN 1
            ELSE 0
        END AS is_gap,

        CASE
            WHEN f.overlap_sec > 0 THEN 1 ELSE 0
        END AS is_overlap,

        CASE
            WHEN f.kwh_available_flag = 1
             AND f.kwh_delta = 0
            THEN 1 ELSE 0
        END AS kwh_zero_delta_flag,

        CASE
            WHEN f.kwh_available_flag = 1
             AND f.kwh_delta > 0
            THEN 1 ELSE 0
        END AS kwh_positive_delta_flag,

        CASE
            WHEN f.kwh_available_flag = 1
             AND f.kwh_delta < 0
            THEN 1 ELSE 0
        END AS kwh_negative_delta_flag,

        CASE
            WHEN f.kwh_available_flag = 1
             AND f.duration_sec IS NOT NULL
             AND f.duration_sec > 0
            THEN f.kwh_delta * 3600.0 / f.duration_sec
            ELSE NULL
        END AS kwh_rate_per_hour,

        CASE
            WHEN f.kwh_available_flag = 0
              OR f.duration_sec IS NULL
              OR f.duration_sec <= 0
            THEN 1 ELSE 0
        END AS kwh_rate_missing_flag,

        CASE
            WHEN f.is_loaded = 1
             AND f.kwh_available_flag = 1
             AND f.kwh_delta > 0
            THEN 1 ELSE 0
        END AS loaded_positive_kwh_flag,

        CASE
            WHEN f.is_loaded = 1
             AND f.kwh_available_flag = 1
             AND f.kwh_delta = 0
            THEN 1 ELSE 0
        END AS loaded_zero_kwh_flag,

        CASE
            WHEN f.is_loaded = 1
             AND f.kwh_available_flag = 0
            THEN 1 ELSE 0
        END AS loaded_without_kwh_flag
    FROM kwh_features f
),

segmented_event AS (
    SELECT
        f.*,

        SUM(
            CASE
                WHEN f.prev_status_id IS NULL THEN 1
                WHEN f.is_big_gap = 1 THEN 1
                WHEN f.is_non_positive_duration = 1 THEN 1
                WHEN f.event_end_time IS NULL THEN 1
                ELSE 0
            END
        ) OVER (
            PARTITION BY f.machine_id
            ORDER BY f.event_start_time, f.event_id
            ROWS UNBOUNDED PRECEDING
        ) AS sequence_segment_id
    FROM flagged_event f
)

SELECT
    event_id,
    machine_id,

    sequence_segment_id,

    ROW_NUMBER() OVER (
        PARTITION BY machine_id, sequence_segment_id
        ORDER BY event_start_time, event_id
    ) AS event_order_in_segment,

    event_start_time,
    event_end_time,
    end_time_source,
    duration_sec,
    gap_from_prev_sec,
    overlap_sec,

    status_id,
    status_type_code,
    is_on,

    current_signal_code,
    is_loaded,
    is_no_load,
    is_current_near_zero,
    has_error_token,
    has_maintenance_token,

    raw_status_kwh_start,
    raw_status_kwh_end,
    kwh_start_value,
    kwh_end_value,
    kwh_start_source,
    kwh_end_source,
    kwh_raw_available_flag,
    kwh_available_flag,
    kwh_missing_flag,
    kwh_imputed_or_missing_flag,
    kwh_start_imputed_flag,
    kwh_end_imputed_flag,
    kwh_delta,
    kwh_delta_model_value,
    kwh_zero_delta_flag,
    kwh_positive_delta_flag,
    kwh_negative_delta_flag,
    kwh_rate_per_hour,
    kwh_rate_missing_flag,
    loaded_positive_kwh_flag,
    loaded_zero_kwh_flag,
    loaded_without_kwh_flag,

    is_raw_end_missing,
    is_invalid_raw_end,
    is_open_event,
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
INTO dbo.ai_l1_operation_event_sequence
FROM segmented_event;
GO

CREATE UNIQUE INDEX IX_ai_l1_event_id
ON dbo.ai_l1_operation_event_sequence(event_id);

CREATE INDEX IX_ai_l1_machine_time
ON dbo.ai_l1_operation_event_sequence(machine_id, event_start_time, event_id);

CREATE INDEX IX_ai_l1_segment
ON dbo.ai_l1_operation_event_sequence(machine_id, sequence_segment_id, event_order_in_segment);
GO