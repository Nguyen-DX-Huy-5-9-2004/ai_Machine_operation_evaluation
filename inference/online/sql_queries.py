from __future__ import annotations

import re
from collections.abc import Mapping


_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def quote_name(name: str) -> str:
    if not _IDENT_RE.match(name):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")
    return f"[{name}]"


def table_name(name: str) -> str:
    parts = str(name).split(".")
    if not 1 <= len(parts) <= 3:
        raise ValueError(f"Unsafe SQL table name: {name!r}")
    return ".".join(quote_name(part) for part in parts)


def col(cols: Mapping[str, str], key: str) -> str:
    return quote_name(cols[key])


def get_checkpoint_sql(checkpoint_table: str) -> str:
    return f"""
SELECT pipeline_name, last_event_id, last_event_time, updated_time
FROM {table_name(checkpoint_table)}
WHERE pipeline_name = ?
"""


def update_checkpoint_sql(checkpoint_table: str) -> str:
    return f"""
MERGE {table_name(checkpoint_table)} AS tgt
USING (
    SELECT
        CAST(? AS NVARCHAR(100)) AS pipeline_name,
        CAST(? AS BIGINT) AS last_event_id,
        CAST(? AS DATETIME2) AS last_event_time
) AS src
ON tgt.pipeline_name = src.pipeline_name
WHEN MATCHED THEN
    UPDATE SET
        last_event_id = src.last_event_id,
        last_event_time = src.last_event_time,
        updated_time = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (pipeline_name, last_event_id, last_event_time, updated_time)
    VALUES (src.pipeline_name, src.last_event_id, src.last_event_time, SYSUTCDATETIME());
"""


def _raw_event_select(alias: str, cols: Mapping[str, str]) -> str:
    raw_error = cols.get("raw_error_code")
    raw_error_expr = f"CAST({alias}.{quote_name(raw_error)} AS NVARCHAR(200))" if raw_error else "CAST(NULL AS NVARCHAR(200))"
    return f"""
    CAST({alias}.{col(cols, "event_id")} AS BIGINT) AS event_id,
    CAST({alias}.{col(cols, "machine_id")} AS INT) AS machine_id,
    CAST({alias}.{col(cols, "status_id")} AS INT) AS status_id,
    CAST({alias}.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time,
    CAST({alias}.{col(cols, "raw_event_end_time")} AS DATETIME2) AS raw_event_end_time,
    TRY_CAST({alias}.{col(cols, "raw_kwh_start")} AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST({alias}.{col(cols, "raw_kwh_end")} AS FLOAT) AS raw_status_kwh_end,
    {raw_error_expr} AS raw_error_code
"""


def _not_deleted_condition(alias: str, deleted_column: str | None) -> str:
    if not deleted_column:
        return ""
    return f"\n  AND ISNULL({alias}.{quote_name(deleted_column)}, 0) = 0"


def load_unprocessed_closed_candidate_events_sql(
    raw_table: str,
    online_result_table: str,
    cols: Mapping[str, str],
    max_rows: int,
    raw_is_deleted_column: str | None = None,
) -> str:
    deleted_filter = _not_deleted_condition("i", raw_is_deleted_column)
    next_deleted_filter = _not_deleted_condition("n", raw_is_deleted_column)
    return f"""
SELECT TOP ({int(max_rows)})
{_raw_event_select("i", cols)}
FROM {table_name(raw_table)} AS i
WHERE CAST(i.{col(cols, "event_id")} AS BIGINT) > ?
{deleted_filter}
  AND NOT EXISTS (
      SELECT 1
      FROM {table_name(online_result_table)} AS r
      WHERE r.event_id = CAST(i.{col(cols, "event_id")} AS BIGINT)
  )
  AND (
      CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
      OR EXISTS (
          SELECT 1
          FROM {table_name(raw_table)} AS n
          WHERE CAST(n.{col(cols, "machine_id")} AS INT) = CAST(i.{col(cols, "machine_id")} AS INT)
            AND CAST(n.{col(cols, "event_start_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
{next_deleted_filter}
      )
  )
ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2), CAST(i.{col(cols, "event_id")} AS BIGINT)
"""


def load_closed_candidate_events_by_ids_sql(
    raw_table: str,
    cols: Mapping[str, str],
    event_ids_sql: str,
    max_rows: int,
    raw_is_deleted_column: str | None = None,
) -> str:
    deleted_filter = _not_deleted_condition("i", raw_is_deleted_column)
    next_deleted_filter = _not_deleted_condition("n", raw_is_deleted_column)
    return f"""
SELECT TOP ({int(max_rows)})
{_raw_event_select("i", cols)}
FROM {table_name(raw_table)} AS i
WHERE CAST(i.{col(cols, "event_id")} AS BIGINT) IN ({event_ids_sql})
{deleted_filter}
  AND (
      CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
      OR EXISTS (
          SELECT 1
          FROM {table_name(raw_table)} AS n
          WHERE CAST(n.{col(cols, "machine_id")} AS INT) = CAST(i.{col(cols, "machine_id")} AS INT)
            AND CAST(n.{col(cols, "event_start_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
{next_deleted_filter}
      )
  )
ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2), CAST(i.{col(cols, "event_id")} AS BIGINT)
"""


def load_closed_candidate_events_in_event_id_range_sql(
    raw_table: str,
    cols: Mapping[str, str],
    max_rows: int,
    raw_is_deleted_column: str | None = None,
) -> str:
    deleted_filter = _not_deleted_condition("i", raw_is_deleted_column)
    next_deleted_filter = _not_deleted_condition("n", raw_is_deleted_column)
    return f"""
SELECT TOP ({int(max_rows)})
{_raw_event_select("i", cols)}
FROM {table_name(raw_table)} AS i
WHERE CAST(i.{col(cols, "event_id")} AS BIGINT) BETWEEN ? AND ?
{deleted_filter}
  AND (
      CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
      OR EXISTS (
          SELECT 1
          FROM {table_name(raw_table)} AS n
          WHERE CAST(n.{col(cols, "machine_id")} AS INT) = CAST(i.{col(cols, "machine_id")} AS INT)
            AND CAST(n.{col(cols, "event_start_time")} AS DATETIME2) > CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
{next_deleted_filter}
      )
  )
ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2), CAST(i.{col(cols, "event_id")} AS BIGINT)
"""


def load_context_around_machine_sql(
    raw_table: str,
    cols: Mapping[str, str],
    lookback_before: int,
    lookahead_after: int,
    raw_is_deleted_column: str | None = None,
) -> str:
    deleted_filter = _not_deleted_condition("i", raw_is_deleted_column)
    return f"""
WITH before_events AS (
    SELECT TOP ({int(lookback_before)})
{_raw_event_select("i", cols)},
        CAST('before' AS NVARCHAR(20)) AS context_role
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{col(cols, "machine_id")} AS INT) = ?
      AND CAST(i.{col(cols, "event_start_time")} AS DATETIME2) < CAST(? AS DATETIME2)
{deleted_filter}
    ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2) DESC,
             CAST(i.{col(cols, "event_id")} AS BIGINT) DESC
),
candidate_range AS (
    SELECT
{_raw_event_select("i", cols)},
        CAST('candidate' AS NVARCHAR(20)) AS context_role
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{col(cols, "machine_id")} AS INT) = ?
      AND CAST(i.{col(cols, "event_start_time")} AS DATETIME2) >= CAST(? AS DATETIME2)
      AND CAST(i.{col(cols, "event_start_time")} AS DATETIME2) <= CAST(? AS DATETIME2)
{deleted_filter}
),
after_events AS (
    SELECT TOP ({int(lookahead_after)})
{_raw_event_select("i", cols)},
        CAST('after' AS NVARCHAR(20)) AS context_role
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{col(cols, "machine_id")} AS INT) = ?
      AND CAST(i.{col(cols, "event_start_time")} AS DATETIME2) > CAST(? AS DATETIME2)
{deleted_filter}
    ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2) ASC,
             CAST(i.{col(cols, "event_id")} AS BIGINT) ASC
)
SELECT * FROM before_events
UNION ALL
SELECT * FROM candidate_range
UNION ALL
SELECT * FROM after_events
ORDER BY machine_id, event_start_time, event_id
"""


def load_context_by_row_order_sql(
    raw_table: str,
    cols: Mapping[str, str],
    candidate_event_ids_sql: str,
    lookback_before: int,
    lookahead_after: int,
    raw_is_deleted_column: str | None = None,
) -> str:
    """Return row-based context, including a next event that may be days later."""
    deleted_filter = _not_deleted_condition("i", raw_is_deleted_column)
    return f"""
WITH ordered_events AS (
    SELECT
{_raw_event_select("i", cols)},
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.{col(cols, "machine_id")} AS INT)
            ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2),
                     CAST(i.{col(cols, "event_id")} AS BIGINT)
        ) AS row_order
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{col(cols, "machine_id")} AS INT) = ?
{deleted_filter}
), candidate_rows AS (
    SELECT row_order
    FROM ordered_events
    WHERE event_id IN ({candidate_event_ids_sql})
), bounds AS (
    SELECT MIN(row_order) AS min_row_order, MAX(row_order) AS max_row_order
    FROM candidate_rows
)
SELECT
    o.*,
    CASE
        WHEN o.event_id IN ({candidate_event_ids_sql}) THEN CAST('candidate' AS NVARCHAR(20))
        WHEN o.row_order < b.min_row_order THEN CAST('before' AS NVARCHAR(20))
        ELSE CAST('after' AS NVARCHAR(20))
    END AS context_role
FROM ordered_events AS o
CROSS JOIN bounds AS b
WHERE o.row_order BETWEEN b.min_row_order - {int(lookback_before)}
                      AND b.max_row_order + {int(lookahead_after)}
ORDER BY o.machine_id, o.event_start_time, o.event_id
"""


def load_event_time_location_sql(
    machine_location_table: str,
    location_table: str,
    location_cols: Mapping[str, str],
) -> str:
    return f"""
SELECT TOP (1)
    CAST(mlh.{col(location_cols, "machine_id")} AS INT) AS machine_id,
    CAST(mlh.{col(location_cols, "location_id")} AS INT) AS location_id,
    CAST(mlh.{col(location_cols, "start_time")} AS DATETIME2) AS location_history_start_time,
    CAST(mlh.{col(location_cols, "end_time")} AS DATETIME2) AS location_history_end_time,
    CAST('event_time' AS NVARCHAR(50)) AS location_mapping_source
FROM {table_name(machine_location_table)} AS mlh
LEFT JOIN {table_name(location_table)} AS loc
    ON loc.id = mlh.{col(location_cols, "location_id")}
WHERE mlh.{col(location_cols, "machine_id")} = ?
  AND mlh.{col(location_cols, "start_time")} <= CAST(? AS DATETIME2)
  AND (mlh.{col(location_cols, "end_time")} IS NULL OR CAST(? AS DATETIME2) < mlh.{col(location_cols, "end_time")})
ORDER BY mlh.{col(location_cols, "start_time")} DESC
"""


def load_machine_group_sql(machine_table: str, machine_cols: Mapping[str, str], machine_ids_sql: str) -> str:
    return f"""
SELECT
    CAST(m.{col(machine_cols, "machine_id")} AS INT) AS machine_id,
    CAST(m.{col(machine_cols, "machine_group_id")} AS INT) AS machine_group_id
FROM {table_name(machine_table)} AS m
WHERE CAST(m.{col(machine_cols, "machine_id")} AS INT) IN ({machine_ids_sql})
"""


def insert_run_log_sql(run_log_table: str) -> str:
    return f"""
INSERT INTO {table_name(run_log_table)}
    (pipeline_name, input_rows, scored_rows, skipped_rows, failed_rows, status, message, ended_time)
VALUES (?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())
"""


def load_historical_l1_by_event_ids_sql(historical_l1_table: str, event_ids_sql: str) -> str:
    return f"""
SELECT *
FROM {table_name(historical_l1_table)}
WHERE event_id IN ({event_ids_sql})
"""
