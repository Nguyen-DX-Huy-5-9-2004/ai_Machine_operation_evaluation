from __future__ import annotations

def q_get_checkpoint(t):
    return f"SELECT pipeline_name,last_event_id,last_event_time,updated_time FROM {t} WHERE pipeline_name=?"

def q_update_checkpoint(t):
    return f"""
    MERGE {t} AS tgt
    USING (SELECT CAST(? AS NVARCHAR(100)) pipeline_name, CAST(? AS BIGINT) last_event_id, CAST(? AS DATETIME2) last_event_time) src
    ON tgt.pipeline_name=src.pipeline_name
    WHEN MATCHED THEN UPDATE SET last_event_id=src.last_event_id,last_event_time=src.last_event_time,updated_time=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT(pipeline_name,last_event_id,last_event_time,updated_time) VALUES(src.pipeline_name,src.last_event_id,src.last_event_time,SYSUTCDATETIME());
    """

def q_load_candidate_events(raw_table, cols, max_rows):
    return f"""
    SELECT TOP ({max_rows})
      CAST(i.[{cols['event_id']}] AS BIGINT) event_id,
      CAST(i.[{cols['machine_id']}] AS INT) machine_id,
      CAST(i.[{cols['status_id']}] AS INT) status_id,
      CAST(i.[{cols['event_start_time']}] AS DATETIME2) event_start_time,
      CAST(i.[{cols['raw_event_end_time']}] AS DATETIME2) raw_event_end_time,
      TRY_CAST(i.[{cols['raw_kwh_start']}] AS FLOAT) raw_status_kwh_start,
      TRY_CAST(i.[{cols['raw_kwh_end']}] AS FLOAT) raw_status_kwh_end
    FROM {raw_table} i
    WHERE (? IS NULL OR CAST(i.[{cols['event_id']}] AS BIGINT) > ?)
    ORDER BY CAST(i.[{cols['event_id']}] AS BIGINT)
    """

def q_load_context_events_for_machines(raw_table, cols, machine_ids_sql, lookback):
    return f"""
    WITH ranked AS (
      SELECT
        CAST(i.[{cols['event_id']}] AS BIGINT) event_id,
        CAST(i.[{cols['machine_id']}] AS INT) machine_id,
        CAST(i.[{cols['status_id']}] AS INT) status_id,
        CAST(i.[{cols['event_start_time']}] AS DATETIME2) event_start_time,
        CAST(i.[{cols['raw_event_end_time']}] AS DATETIME2) raw_event_end_time,
        TRY_CAST(i.[{cols['raw_kwh_start']}] AS FLOAT) raw_status_kwh_start,
        TRY_CAST(i.[{cols['raw_kwh_end']}] AS FLOAT) raw_status_kwh_end,
        ROW_NUMBER() OVER(PARTITION BY CAST(i.[{cols['machine_id']}] AS INT) ORDER BY CAST(i.[{cols['event_start_time']}] AS DATETIME2) DESC, CAST(i.[{cols['event_id']}] AS BIGINT) DESC) rn
      FROM {raw_table} i
      WHERE CAST(i.[{cols['machine_id']}] AS INT) IN ({machine_ids_sql})
    )
    SELECT * FROM ranked WHERE rn <= {lookback}
    ORDER BY machine_id,event_start_time,event_id
    """

def q_load_active_location(machine_location_table, location_table, machine_ids_sql):
    return f"""
    WITH ranked AS (
      SELECT mlh.machine_id, mlh.location_id,
             ROW_NUMBER() OVER(PARTITION BY mlh.machine_id ORDER BY CASE WHEN mlh.time_end IS NULL THEN 0 ELSE 1 END, mlh.time_start DESC) rn
      FROM {machine_location_table} mlh
      WHERE mlh.machine_id IN ({machine_ids_sql})
    ) SELECT machine_id, location_id FROM ranked WHERE rn=1
    """
