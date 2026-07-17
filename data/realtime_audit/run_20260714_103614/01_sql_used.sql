-- candidate_events_historical_overlap
-- historical-overlap candidate mode

-- project_root_resolved: G:\My Drive\OBAD

-- historical_l1_csv_resolved: G:\My Drive\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv

-- historical_event_id_range: 48043..4145960

-- sql_candidate_query_limit_before_csv_filter: 5000

-- sql_candidates_before_csv_filter: 5000

-- candidates_after_csv_filter: 13

SELECT TOP (5000)

    CAST(i.[id] AS BIGINT) AS event_id,
    CAST(i.[machine_id] AS INT) AS machine_id,
    CAST(i.[status_id] AS INT) AS status_id,
    CAST(i.[status_time_start] AS DATETIME2) AS event_start_time,
    CAST(i.[status_time_end] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[status_kwh_start] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[status_kwh_end] AS FLOAT) AS raw_status_kwh_end,
    CAST(i.[error_code] AS NVARCHAR(200)) AS raw_error_code

FROM [dbo].[data_iot_convert] AS i
WHERE CAST(i.[id] AS BIGINT) BETWEEN ? AND ?
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
WHERE CAST(m.[id] AS INT) IN (11,36,37,45,46,47,49)


-- historical_l1_compare
SELECT *
FROM [dbo].[ai_l1_operation_event_sequence]
WHERE event_id IN (48043,48046,48048,48051,48052,48053,48056,48057,48058,48059,48060,48063,48064)
