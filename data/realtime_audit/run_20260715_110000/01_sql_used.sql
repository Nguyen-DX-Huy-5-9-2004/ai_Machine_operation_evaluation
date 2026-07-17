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
    WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (295)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (295) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (292,293,294)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (292,293,294) THEN CAST('candidate' AS NVARCHAR(20))
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
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?

  AND ISNULL(i.[is_deleted], 0) = 0
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN (258)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (258) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (236,237,238,239)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (236,237,238,239) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - 40
                      AND b.max_row_order + 2
ORDER BY o.machine_id, o.event_start_time, o.event_id


-- location_mapping
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


-- machine_group_mapping
SELECT
    CAST(m.[id] AS INT) AS machine_id,
    CAST(m.[machine_group_id] AS INT) AS machine_group_id
FROM [dbo].[data_machine] AS m
WHERE CAST(m.[id] AS INT) IN (11,36,37,45,46,48,49,50,56)


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
WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,236,237,238,239,258,292,293,294,295)


-- attempted historical L1 csv: G:\My Drive\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv
