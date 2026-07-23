from __future__ import annotations

import time
from typing import Any, Mapping

import pandas as pd

from inference.online.db import connect, read_sql
from inference.online.score_new_events import (
    load_location_map,
    load_machine_group_map,
    load_status_map,
    merge_context_maps,
)
from inference.online.sql_queries import quote_name, table_name

from .types import ReplayBatch, ReplayConfig, ReplayWatermark


class SqlReplaySource:
    """Read-only historical source. Every SQL statement in this class is SELECT."""

    def __init__(self, cfg: Mapping[str, Any], replay: ReplayConfig) -> None:
        self.cfg = dict(cfg)
        self.replay = replay

    def fetch(self, watermark: ReplayWatermark | None, virtual_time) -> ReplayBatch:
        started = time.perf_counter()
        source = self.cfg["source_columns"]
        raw_table = table_name(self.cfg["tables"]["raw_iot"])
        event_time = quote_name(source["event_start_time"])
        event_id = quote_name(source["event_id"])
        machine_id = quote_name(source["machine_id"])
        status_id = quote_name(source["status_id"])
        raw_end = quote_name(source["raw_event_end_time"])
        raw_kwh_start = quote_name(source["raw_kwh_start"])
        raw_kwh_end = quote_name(source["raw_kwh_end"])
        raw_error = quote_name(source["raw_error_code"])
        # The replay range is an immutable lower bound.  Without it, the first
        # tick would replay every historical row before the virtual clock.
        predicates: list[str] = []
        params: list[Any] = [self.replay.max_events_per_tick]
        if self.replay.replay_start_time is not None:
            predicates.append(f"{event_time} >= ?")
            params.append(self.replay.replay_start_time)
        if watermark is not None:
            predicates.append(f"({event_time} > ? OR ({event_time} = ? AND {event_id} > ?))")
            params.extend([watermark.event_start_time, watermark.event_start_time, watermark.event_id])
        predicates.append(f"{event_time} <= ?")
        params.append(virtual_time)
        predicate = " AND ".join(predicates) or "1=1"
        candidate_sql = f"""
SELECT TOP (?)
  {event_id} AS event_id, {machine_id} AS machine_id, {status_id} AS status_id,
  {event_time} AS event_start_time, {raw_end} AS raw_event_end_time,
  {raw_kwh_start} AS raw_status_kwh_start, {raw_kwh_end} AS raw_status_kwh_end,
  {raw_error} AS raw_error_code
FROM {raw_table}
WHERE {predicate}
ORDER BY {event_time}, {event_id};
"""
        with connect(self.cfg["database"]) as conn:
            candidates = read_sql(conn, candidate_sql, params)
            if candidates.empty:
                return ReplayBatch(candidates, candidates.copy(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), watermark, {"sql_read_latency_ms": round((time.perf_counter() - started) * 1000, 2)})
            context = self._context_for_candidates(conn, candidates, virtual_time)
            location_map, _ = load_location_map(conn, self.cfg, context)
            machine_group_map, _ = load_machine_group_map(conn, self.cfg, context)
            status_map, _ = load_status_map(conn, self.cfg)
        location_map = merge_context_maps(location_map, machine_group_map)
        last = candidates.sort_values(["event_start_time", "event_id"]).iloc[-1]
        next_watermark = ReplayWatermark(pd.Timestamp(last["event_start_time"]).to_pydatetime(), int(last["event_id"]))
        return ReplayBatch(candidates, context, location_map, machine_group_map, status_map, next_watermark, {"sql_read_latency_ms": round((time.perf_counter() - started) * 1000, 2)})

    def _context_for_candidates(self, conn: Any, candidates: pd.DataFrame, virtual_time) -> pd.DataFrame:
        source = self.cfg["source_columns"]
        raw_table = table_name(self.cfg["tables"]["raw_iot"])
        event_time = quote_name(source["event_start_time"])
        event_id = quote_name(source["event_id"])
        machine_id = quote_name(source["machine_id"])
        status_id = quote_name(source["status_id"])
        raw_end = quote_name(source["raw_event_end_time"])
        raw_kwh_start = quote_name(source["raw_kwh_start"])
        raw_kwh_end = quote_name(source["raw_kwh_end"])
        raw_error = quote_name(source["raw_error_code"])
        frames: list[pd.DataFrame] = []
        per_machine = candidates.groupby("machine_id").size().to_dict()
        for machine, count in per_machine.items():
            limit = int(count) + self.replay.context_events_per_machine
            sql = f"""
SELECT TOP (?)
  {event_id} AS event_id, {machine_id} AS machine_id, {status_id} AS status_id,
  {event_time} AS event_start_time, {raw_end} AS raw_event_end_time,
  {raw_kwh_start} AS raw_status_kwh_start, {raw_kwh_end} AS raw_status_kwh_end,
  {raw_error} AS raw_error_code
FROM {raw_table}
WHERE {machine_id} = ? AND {event_time} <= ?
ORDER BY {event_time} DESC, {event_id} DESC;
"""
            frames.append(read_sql(conn, sql, [limit, int(machine), virtual_time]))
        context = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        return context.sort_values(["machine_id", "event_start_time", "event_id"]).drop_duplicates("event_id").reset_index(drop=True)

    def load_historical_policy_rows(self, event_ids: list[int]) -> pd.DataFrame:
        """Read the persisted historical Policy v2 rows for parity only."""
        if not event_ids:
            return pd.DataFrame()
        historical_table = self.cfg.get("tables", {}).get("historical_policy_result", "dbo.ai_l2_fault_judgment_policy_v2_full")
        placeholders = ", ".join("?" for _ in event_ids)
        sql = f"SELECT * FROM {table_name(historical_table)} WHERE event_id IN ({placeholders});"
        with connect(self.cfg["database"]) as conn:
            return read_sql(conn, sql, [int(event_id) for event_id in event_ids])
