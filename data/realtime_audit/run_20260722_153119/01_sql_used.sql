-- candidate_events
SELECT TOP (100)

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code

FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
WHERE CAST(i.[id] AS BIGINT) > ?

  AND ISNULL(i.[is_deleted], 0) = 0
  AND NOT EXISTS (
      SELECT 1
      FROM [dbo].[ai_l2_fault_judgment_online_v2] AS r
      WHERE r.event_source = N'ONLINE_CURRENT_SQL'
        AND r.event_id = CAST(i.[id] AS BIGINT)
  )
  AND (
      CAST(i.[status_time_end] AS DATETIME2) > CAST(i.[status_time_start] AS DATETIME2)
      OR EXISTS (
          SELECT 1
          FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS n
          WHERE CAST(n.[machine_id] AS INT) = CAST(i.[machine_id] AS INT)
            AND CAST(n.[status_time_start] AS DATETIME2) > CAST(i.[status_time_start] AS DATETIME2)

  AND ISNULL(n.[is_deleted], 0) = 0
      )
  )
ORDER BY CAST(i.[status_time_start] AS DATETIME2), CAST(i.[id] AS BIGINT)


-- context_by_row_order_machine_11
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48043,61069,61070)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48043,61069,61070) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_36
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48046,61137,61138)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48046,61137,61138) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_37
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48048,61095,61096)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48048,61095,61096) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_45
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48051,61166)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48051,61166) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_46
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48052)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48052) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_47
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48053)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48053) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_48
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48056,64808)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48056,64808) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_49
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48057,63224,63225,63226,63227)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48057,63224,63225,63226,63227) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_50
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48058,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48058,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_51
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48059)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48059) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_56
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48060,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48060,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_58
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48063,64081)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48063,64081) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- context_by_row_order_machine_59
WITH ordered_events AS (
    SELECT

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.[machine_id] AS INT)
            ORDER BY CAST(i.[status_time_start] AS DATETIME2),
                     CAST(i.[id] AS BIGINT)
        ) AS row_order
    FROM [dbo].[vw_ai_runtime_raw_iot_typed_local] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (48064)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48064) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- location_mapping
SELECT
    CAST(mlh.[machine_id] AS INT) AS machine_id,
    CAST(mlh.[location_id] AS INT) AS location_id,
    CAST(mlh.[start_time] AS DATETIME2) AS location_history_start_time,
    CAST(mlh.[end_time] AS DATETIME2) AS location_history_end_time,
    CAST('event_time' AS NVARCHAR(50)) AS location_mapping_source
FROM [dbo].[machine_location_his] AS mlh
WHERE CAST(mlh.[machine_id] AS INT) IN (11,36,37,45,46,47,48,49,50,51,56,58,59)
ORDER BY machine_id, location_history_start_time


-- machine_group_mapping
SELECT
    CAST(m.[id] AS INT) AS machine_id,
    CAST(m.[machine_group_id] AS INT) AS machine_group_id
FROM [dbo].[data_machine] AS m
WHERE CAST(m.[id] AS INT) IN (11,36,37,45,46,47,48,49,50,51,56,58,59)


-- status_mapping
SELECT
    CAST(id AS INT) AS status_id,
    CAST([status_name] AS NVARCHAR(500)) AS status_name,
    CAST([type] AS NVARCHAR(500)) AS status_type_raw,
    CAST([note] AS NVARCHAR(1000)) AS status_note
FROM [dbo].[data_machine_status]
WHERE 1 = 1
  AND ISNULL([is_deleted], 0) = 0


-- historical_l1_compare
SELECT *
FROM [dbo].[ai_l1_operation_event_sequence]
WHERE event_id IN (48043,48046,48048,48051,48052,48053,48056,48057,48058,48059,48060,48063,48064,61069,61070,61095,61096,61137,61138,61166,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243,63224,63225,63226,63227,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284,64081,64808)
