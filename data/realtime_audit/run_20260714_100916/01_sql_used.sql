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
      )
  )
ORDER BY CAST(i.[status_time_start] AS DATETIME2), CAST(i.[id] AS BIGINT)


-- context_around_machine_template
WITH before_events AS (
    SELECT TOP (40)

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        CAST('before' AS NVARCHAR(20)) AS context_role
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?
      AND CAST(i.[status_time_start] AS DATETIME2) < CAST(? AS DATETIME2)
    ORDER BY CAST(i.[status_time_start] AS DATETIME2) DESC,
             CAST(i.[id] AS BIGINT) DESC
),
candidate_range AS (
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
        CAST('candidate' AS NVARCHAR(20)) AS context_role
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?
      AND CAST(i.[status_time_start] AS DATETIME2) >= CAST(? AS DATETIME2)
      AND CAST(i.[status_time_start] AS DATETIME2) <= CAST(? AS DATETIME2)
),
after_events AS (
    SELECT TOP (2)

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code
,
        CAST('after' AS NVARCHAR(20)) AS context_role
    FROM [dbo].[data_iot_convert] AS i
    WHERE CAST(i.[machine_id] AS INT) = ?
      AND CAST(i.[status_time_start] AS DATETIME2) > CAST(? AS DATETIME2)
    ORDER BY CAST(i.[status_time_start] AS DATETIME2) ASC,
             CAST(i.[id] AS BIGINT) ASC
)
SELECT * FROM before_events
UNION ALL
SELECT * FROM candidate_range
UNION ALL
SELECT * FROM after_events
ORDER BY machine_id, event_start_time, event_id


-- location_mapping
SELECT TOP (1)
    CAST(mlh.[machine_id] AS INT) AS machine_id,
    CAST(mlh.[location_id] AS INT) AS location_id
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


-- historical_l1_compare
SELECT *
FROM [dbo].[ai_l1_operation_event_sequence]
WHERE event_id IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,236,237,238,239,258,292,293,294,295)


-- attempted historical L1 csv: G:\My Drive\OBAD\inference\online\data\dataCore\ai_l1_operation_event_sequence.csv
