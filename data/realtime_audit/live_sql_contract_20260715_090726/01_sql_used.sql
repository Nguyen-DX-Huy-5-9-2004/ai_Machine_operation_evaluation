-- candidate_events
SELECT TOP (10)

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code

FROM [dbo].[data_iot_convert] AS i
WHERE CAST(i.[id] AS BIGINT) > ?

  AND ISNULL(i.[is_deleted], 0) = 0
  AND NOT EXISTS (
      SELECT 1
      FROM [dbo].[ai_l2_fault_judgment_online_v2] AS r
      WHERE r.event_id = CAST(i.[id] AS BIGINT)
  )
  AND (
      CAST(i.[status_time_end] AS DATETIME2) > CAST(i.[status_time_start] AS DATETIME2)
      OR EXISTS (
          SELECT 1
          FROM [dbo].[data_iot_convert] AS n
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (99)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (99) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (1,2,3)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (1,2,3) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (100)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (100) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (101,102)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (101,102) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (98)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (98) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (236,237)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (236,237) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id

-- status_map
SELECT
    CAST(id AS INT) AS status_id,
    CAST([status_name] AS NVARCHAR(500)) AS status_name,
    CAST([type] AS NVARCHAR(500)) AS status_type_raw,
    CAST([note] AS NVARCHAR(1000)) AS status_note
FROM [dbo].[data_machine_status]
WHERE 1 = 1
  AND ISNULL([is_deleted], 0) = 0

-- event_time_location
SELECT TOP (1)
    CAST(mlh.[machine_id] AS INT) AS machine_id,
    CAST(mlh.[location_id] AS INT) AS location_id,
    CAST(mlh.[start_time] AS DATETIME2) AS location_history_start_time,
    CAST(mlh.[end_time] AS DATETIME2) AS location_history_end_time,
    CAST('event_time' AS NVARCHAR(50)) AS location_mapping_source
FROM [dbo].[machine_location_his] AS mlh
LEFT JOIN [dbo].[data_location] AS loc
    ON loc.id = mlh.[location_id]
WHERE mlh.[machine_id] = ?
  AND mlh.[start_time] <= CAST(? AS DATETIME2)
  AND (mlh.[end_time] IS NULL OR CAST(? AS DATETIME2) < mlh.[end_time])
ORDER BY mlh.[start_time] DESC

-- machine_group
SELECT
    CAST(m.[id] AS INT) AS machine_id,
    CAST(m.[machine_group_id] AS INT) AS machine_group_id
FROM [dbo].[data_machine] AS m
WHERE CAST(m.[id] AS INT) IN (11,36,37,45,46,56)