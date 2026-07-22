-- candidate_events
SELECT TOP (500)

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
    WHERE event_id IN (48052,60669,60670,60671,60672,60673,60674,60675,60676,60677,60678,60679,60680,60681,60682,60683,60684,60685,60686,60687,60688,60689,60690,60691,60692,60693,60694,60695,60696,60697,60698,60699,60700,60701,60702,60703,60704,60705,60706,60707,60708,60709,60710,60711,60712,60713,60714,60715,60716,60717,60718,60719,60720,60721,60722,60723,60724,60725,60726,60727,60728,60729,60730,60731,60732,60733)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48052,60669,60670,60671,60672,60673,60674,60675,60676,60677,60678,60679,60680,60681,60682,60683,60684,60685,60686,60687,60688,60689,60690,60691,60692,60693,60694,60695,60696,60697,60698,60699,60700,60701,60702,60703,60704,60705,60706,60707,60708,60709,60710,60711,60712,60713,60714,60715,60716,60717,60718,60719,60720,60721,60722,60723,60724,60725,60726,60727,60728,60729,60730,60731,60732,60733) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (48057,63224,63225,63226,63227,63228,63229,63230,63231,63232,63233,63234,63235)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48057,63224,63225,63226,63227,63228,63229,63230,63231,63232,63233,63234,63235) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (48058,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243,61244,61245,61246,61247,61248,61249,61250,61251,61252,61253,61254,61255,61256,61257,61258,61259,61260,61261,61262,61263,61264,61265,61266,61267,61268,61269,61270,61271,61272,61273,61274,61275,61276,61277,61278,61279,61280,61281,61282,61283,61284,61285,61286,61287,61288,61289,61290,61291,61292,61293,61294,61295,61296,61297,61298,61299,61300,61301,61302,61303,61304,61305,61306,61307,61308,61309,61310,61311,61312,61313,61314,61315,61316,61317,61318,61319,61320,61321,61322,61323,61324,61325,61326,61327,61328,61329,61330,61331,61332,61333,61334,61335,61336,61337,61338,61339,61340,61341,61342,61343,61344,61345,61346,61347,61348,61349,61350,61351,61352,61353,61354,61355,61356,61357,61358,61359,61360,61361,61362,61363,61364,61365,61366,61367,61368,61369,61370,61371,61372,61373,61374,61375,61376,61377,61378,61379,61380,61381,61382,61383,61384,61385,61386,61387,61388,61389,61390,61391,61392,61393,61394,61395,61396,61397,61398,61399,61400,61401,61402,61403,61404,61405,61406,61407,61408,61409,61410,61411,61412,61413,61414,61415,61416,61417,61418)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48058,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243,61244,61245,61246,61247,61248,61249,61250,61251,61252,61253,61254,61255,61256,61257,61258,61259,61260,61261,61262,61263,61264,61265,61266,61267,61268,61269,61270,61271,61272,61273,61274,61275,61276,61277,61278,61279,61280,61281,61282,61283,61284,61285,61286,61287,61288,61289,61290,61291,61292,61293,61294,61295,61296,61297,61298,61299,61300,61301,61302,61303,61304,61305,61306,61307,61308,61309,61310,61311,61312,61313,61314,61315,61316,61317,61318,61319,61320,61321,61322,61323,61324,61325,61326,61327,61328,61329,61330,61331,61332,61333,61334,61335,61336,61337,61338,61339,61340,61341,61342,61343,61344,61345,61346,61347,61348,61349,61350,61351,61352,61353,61354,61355,61356,61357,61358,61359,61360,61361,61362,61363,61364,61365,61366,61367,61368,61369,61370,61371,61372,61373,61374,61375,61376,61377,61378,61379,61380,61381,61382,61383,61384,61385,61386,61387,61388,61389,61390,61391,61392,61393,61394,61395,61396,61397,61398,61399,61400,61401,61402,61403,61404,61405,61406,61407,61408,61409,61410,61411,61412,61413,61414,61415,61416,61417,61418) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (48060,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284,63285,63286,63287,63288,63289,63290,63291,63292,63293,63294,63295,63296,63297,63298,63299,63300,63301,63302,63303,63304,63305,63306,63307,63308,63309,63310,63311,63312,63313,63314,63315,63316,63317,63318,63319,63320,63321,63322,63323,63324,63325,63326,63327)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48060,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284,63285,63286,63287,63288,63289,63290,63291,63292,63293,63294,63295,63296,63297,63298,63299,63300,63301,63302,63303,63304,63305,63306,63307,63308,63309,63310,63311,63312,63313,63314,63315,63316,63317,63318,63319,63320,63321,63322,63323,63324,63325,63326,63327) THEN CAST('candidate' AS NVARCHAR(20))
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
    WHERE event_id IN (48063,64081,64082,64083,64084,64085,64086,64087,64088,64089,64090,64091,64092,64093,64094,64095,64096,64097,64098,64099,64100,64101,64102,64103,64104,64105,64106,64107,64108,64109,64110,64111,64112,64113,64114,64115,64116,64117,64118,64119,64120,64121,64122,64123,64124,64125,64126,64127,64128,64129,64130,64131,64132,64133,64134,64135,64136,64137,64138,64139,64140,64141,64142,64143,64144,64145,64146,64147,64148,64149,64150,64151,64152,64153,64154,64155,64156,64157,64158,64159,64160,64161,64162,64163,64164,64165,64166,64167,64168,64169,64170,64171,64172,64173,64174,64175,64176,64177,64178,64179,64180,64181,64182,64183,64184,64185,64186,64187,64188,64189,64190)
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN (48063,64081,64082,64083,64084,64085,64086,64087,64088,64089,64090,64091,64092,64093,64094,64095,64096,64097,64098,64099,64100,64101,64102,64103,64104,64105,64106,64107,64108,64109,64110,64111,64112,64113,64114,64115,64116,64117,64118,64119,64120,64121,64122,64123,64124,64125,64126,64127,64128,64129,64130,64131,64132,64133,64134,64135,64136,64137,64138,64139,64140,64141,64142,64143,64144,64145,64146,64147,64148,64149,64150,64151,64152,64153,64154,64155,64156,64157,64158,64159,64160,64161,64162,64163,64164,64165,64166,64167,64168,64169,64170,64171,64172,64173,64174,64175,64176,64177,64178,64179,64180,64181,64182,64183,64184,64185,64186,64187,64188,64189,64190) THEN CAST('candidate' AS NVARCHAR(20))
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
WHERE event_id IN (48043,48046,48048,48051,48052,48053,48056,48057,48058,48059,48060,48063,48064,60669,60670,60671,60672,60673,60674,60675,60676,60677,60678,60679,60680,60681,60682,60683,60684,60685,60686,60687,60688,60689,60690,60691,60692,60693,60694,60695,60696,60697,60698,60699,60700,60701,60702,60703,60704,60705,60706,60707,60708,60709,60710,60711,60712,60713,60714,60715,60716,60717,60718,60719,60720,60721,60722,60723,60724,60725,60726,60727,60728,60729,60730,60731,60732,60733,61069,61070,61095,61096,61137,61138,61166,61186,61187,61188,61189,61190,61191,61192,61193,61194,61195,61196,61197,61198,61199,61200,61201,61202,61203,61204,61205,61206,61207,61208,61209,61210,61211,61212,61213,61214,61215,61216,61217,61218,61219,61220,61221,61222,61223,61224,61225,61226,61227,61228,61229,61230,61231,61232,61233,61234,61235,61236,61237,61238,61239,61240,61241,61242,61243,61244,61245,61246,61247,61248,61249,61250,61251,61252,61253,61254,61255,61256,61257,61258,61259,61260,61261,61262,61263,61264,61265,61266,61267,61268,61269,61270,61271,61272,61273,61274,61275,61276,61277,61278,61279,61280,61281,61282,61283,61284,61285,61286,61287,61288,61289,61290,61291,61292,61293,61294,61295,61296,61297,61298,61299,61300,61301,61302,61303,61304,61305,61306,61307,61308,61309,61310,61311,61312,61313,61314,61315,61316,61317,61318,61319,61320,61321,61322,61323,61324,61325,61326,61327,61328,61329,61330,61331,61332,61333,61334,61335,61336,61337,61338,61339,61340,61341,61342,61343,61344,61345,61346,61347,61348,61349,61350,61351,61352,61353,61354,61355,61356,61357,61358,61359,61360,61361,61362,61363,61364,61365,61366,61367,61368,61369,61370,61371,61372,61373,61374,61375,61376,61377,61378,61379,61380,61381,61382,61383,61384,61385,61386,61387,61388,61389,61390,61391,61392,61393,61394,61395,61396,61397,61398,61399,61400,61401,61402,61403,61404,61405,61406,61407,61408,61409,61410,61411,61412,61413,61414,61415,61416,61417,61418,63224,63225,63226,63227,63228,63229,63230,63231,63232,63233,63234,63235,63269,63270,63271,63272,63273,63274,63275,63276,63277,63278,63279,63280,63281,63282,63283,63284,63285,63286,63287,63288,63289,63290,63291,63292,63293,63294,63295,63296,63297,63298,63299,63300,63301,63302,63303,63304,63305,63306,63307,63308,63309,63310,63311,63312,63313,63314,63315,63316,63317,63318,63319,63320,63321,63322,63323,63324,63325,63326,63327,64081,64082,64083,64084,64085,64086,64087,64088,64089,64090,64091,64092,64093,64094,64095,64096,64097,64098,64099,64100,64101,64102,64103,64104,64105,64106,64107,64108,64109,64110,64111,64112,64113,64114,64115,64116,64117,64118,64119,64120,64121,64122,64123,64124,64125,64126,64127,64128,64129,64130,64131,64132,64133,64134,64135,64136,64137,64138,64139,64140,64141,64142,64143,64144,64145,64146,64147,64148,64149,64150,64151,64152,64153,64154,64155,64156,64157,64158,64159,64160,64161,64162,64163,64164,64165,64166,64167,64168,64169,64170,64171,64172,64173,64174,64175,64176,64177,64178,64179,64180,64181,64182,64183,64184,64185,64186,64187,64188,64189,64190,64808)
