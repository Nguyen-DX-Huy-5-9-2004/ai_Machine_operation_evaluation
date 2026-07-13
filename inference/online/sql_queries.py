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


def load_new_events_sql(raw_table: str, cols: Mapping[str, str], max_rows: int) -> str:
    raw_error = cols.get("raw_error_code")
    raw_error_expr = f"CAST(i.{quote_name(raw_error)} AS NVARCHAR(200))" if raw_error else "CAST(NULL AS NVARCHAR(200))"
    return f"""
SELECT TOP ({int(max_rows)})
    CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id,
    CAST(i.{col(cols, "machine_id")} AS INT) AS machine_id,
    CAST(i.{col(cols, "status_id")} AS INT) AS status_id,
    CAST(i.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time,
    CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.{col(cols, "raw_kwh_start")} AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.{col(cols, "raw_kwh_end")} AS FLOAT) AS raw_status_kwh_end,
    {raw_error_expr} AS raw_error_code
FROM {table_name(raw_table)} AS i
WHERE (? IS NULL OR CAST(i.{col(cols, "event_id")} AS BIGINT) > ?)
ORDER BY CAST(i.{col(cols, "event_id")} AS BIGINT)
"""


def load_context_for_machines_sql(
    raw_table: str,
    cols: Mapping[str, str],
    machine_ids_sql: str,
    lookback: int,
) -> str:
    raw_error = cols.get("raw_error_code")
    raw_error_expr = f"CAST(i.{quote_name(raw_error)} AS NVARCHAR(200))" if raw_error else "CAST(NULL AS NVARCHAR(200))"
    return f"""
WITH ranked AS (
    SELECT
        CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id,
        CAST(i.{col(cols, "machine_id")} AS INT) AS machine_id,
        CAST(i.{col(cols, "status_id")} AS INT) AS status_id,
        CAST(i.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time,
        CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) AS raw_event_end_time,
        TRY_CAST(i.{col(cols, "raw_kwh_start")} AS FLOAT) AS raw_status_kwh_start,
        TRY_CAST(i.{col(cols, "raw_kwh_end")} AS FLOAT) AS raw_status_kwh_end,
        {raw_error_expr} AS raw_error_code,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(i.{col(cols, "machine_id")} AS INT)
            ORDER BY CAST(i.{col(cols, "event_start_time")} AS DATETIME2) DESC,
                     CAST(i.{col(cols, "event_id")} AS BIGINT) DESC
        ) AS rn
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{col(cols, "machine_id")} AS INT) IN ({machine_ids_sql})
)
SELECT
    event_id,
    machine_id,
    status_id,
    event_start_time,
    raw_event_end_time,
    raw_status_kwh_start,
    raw_status_kwh_end,
    raw_error_code
FROM ranked
WHERE rn <= {int(lookback)}
ORDER BY machine_id, event_start_time, event_id
"""


def load_latest_location_sql(machine_location_table: str, location_table: str, machine_ids_sql: str) -> str:
    return f"""
WITH ranked AS (
    SELECT
        mlh.machine_id,
        mlh.location_id,
        ROW_NUMBER() OVER (
            PARTITION BY mlh.machine_id
            ORDER BY
                CASE WHEN mlh.time_end IS NULL THEN 0 ELSE 1 END,
                mlh.time_start DESC
        ) AS rn
    FROM {table_name(machine_location_table)} AS mlh
    LEFT JOIN {table_name(location_table)} AS loc
        ON loc.id = mlh.location_id
    WHERE mlh.machine_id IN ({machine_ids_sql})
)
SELECT machine_id, location_id
FROM ranked
WHERE rn = 1
"""


def insert_run_log_sql(run_log_table: str) -> str:
    return f"""
INSERT INTO {table_name(run_log_table)}
    (pipeline_name, input_rows, scored_rows, skipped_rows, failed_rows, status, message, ended_time)
VALUES (?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())
"""
