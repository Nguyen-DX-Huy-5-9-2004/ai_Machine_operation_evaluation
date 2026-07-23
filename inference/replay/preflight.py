from __future__ import annotations

"""Read-only SQL preflight and data-driven demo profile selection."""

import argparse
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from inference.online.artifacts import load_config
from inference.online.db import connect, read_sql
from inference.online.sql_queries import table_name

from .store import atomic_json


CANARY_PIPELINE = "weldcom_l2_realtime_v1"


def credential_state() -> dict[str, str]:
    return {
        "OBAD_SQL_USER": "SET" if os.environ.get("OBAD_SQL_USER") else "MISSING",
        "OBAD_SQL_PASSWORD": "SET" if os.environ.get("OBAD_SQL_PASSWORD") else "MISSING",
    }


def assert_file_only(cfg: dict[str, Any]) -> None:
    runtime = cfg.get("runtime", {})
    expected = {
        "replay_mode": "file_only",
        "enable_sql_write": False,
        "enable_local_canary_sql_write": False,
        "enable_replay_sql_batch_flush": False,
    }
    mismatches = {key: runtime.get(key) for key, value in expected.items() if runtime.get(key) != value}
    if mismatches:
        raise PermissionError(f"REPLAY_SQL_WRITE_NOT_APPROVED: invalid file-only gate {mismatches}")


def run_preflight(cfg: dict[str, Any]) -> dict[str, Any]:
    assert_file_only(cfg)
    state = credential_state()
    if "MISSING" in state.values():
        raise RuntimeError("SQL_CREDENTIALS_MISSING: set OBAD_SQL_USER and OBAD_SQL_PASSWORD in this process before read-only preflight")
    tables = cfg["tables"]
    raw = table_name(tables["raw_iot"])
    online = table_name(tables["online_l2_result"])
    checkpoint = table_name(tables["checkpoint"])
    run_log = table_name(tables["run_log"])
    error_log = table_name(tables["error_log"])
    source_aware = table_name("dbo.vw_ai_dashboard_events_source_aware_v2")
    with connect(cfg["database"]) as conn:
        objects = read_sql(conn, """
SELECT o.name, o.type_desc
FROM sys.objects o
WHERE o.object_id IN (OBJECT_ID(?), OBJECT_ID(?));
""", [tables["raw_iot"], "dbo.vw_ai_dashboard_events_source_aware_v2"])
        raw_count = _scalar(read_sql(conn, f"SELECT COUNT_BIG(*) AS value FROM {raw};", []))
        source_aware_count = _scalar(read_sql(conn, f"SELECT COUNT_BIG(*) AS value FROM {source_aware};", []))
        online_count = _scalar(read_sql(conn, f"SELECT COUNT_BIG(*) AS value FROM {online};", []))
        run_log_count = _scalar(read_sql(conn, f"SELECT COUNT_BIG(*) AS value FROM {run_log};", []))
        error_log_count = _scalar(read_sql(conn, f"SELECT COUNT_BIG(*) AS value FROM {error_log};", []))
        checkpoint_row = read_sql(conn, f"SELECT pipeline_name, last_event_id, last_event_time, updated_time FROM {checkpoint} WHERE pipeline_name=?;", [CANARY_PIPELINE])
    return {
        "created_time": datetime.now(UTC).isoformat(),
        "sql_read_only": True,
        "credential_state": state,
        "connection": {"driver": cfg["database"]["driver"], "server": cfg["database"]["server"], "database": cfg["database"]["database"]},
        "objects": objects.to_dict(orient="records"),
        "raw_typed_row_count": raw_count,
        "source_aware_row_count": source_aware_count,
        "online_row_count": online_count,
        "production_checkpoint": checkpoint_row.to_dict(orient="records"),
        "run_log_count": run_log_count,
        "error_log_count": error_log_count,
        "sql_writes": 0,
    }


def choose_demo_profile(cfg: dict[str, Any], *, minimum_minutes: int = 30, maximum_minutes: int = 240) -> dict[str, Any]:
    """Choose an interval from real evidence; no fixed dates or fake outcomes."""
    assert_file_only(cfg)
    state = credential_state()
    if "MISSING" in state.values():
        raise RuntimeError("SQL_CREDENTIALS_MISSING: cannot select a data-driven demo profile")
    source_aware_name = "dbo.vw_ai_dashboard_events_source_aware_v2"
    with connect(cfg["database"]) as conn:
        columns_frame = read_sql(conn, """
SELECT c.name FROM sys.columns c
WHERE c.object_id = OBJECT_ID(?)
ORDER BY c.column_id;
""", [source_aware_name])
        columns = {str(value) for value in columns_frame["name"].tolist()}
        event_time = _first(columns, "event_start_time", "source_event_start_time", "event_time")
        machine_id = _first(columns, "machine_id")
        if not event_time or not machine_id:
            raise RuntimeError("SOURCE_AWARE_SCHEMA_UNSUPPORTED: event time or machine id is missing")
        expressions = {
            # Scores are deliberately not used as booleans here: a normal
            # event can legitimately have a positive score. Demo selection
            # must report real alert/evidence flags, not turn every score into
            # an anomaly just to make a presentation range look busy.
            "anomaly_count": _sum_flag(columns, "is_behavior_anomaly", "is_anomaly_lenient"),
            "warning_count": _sum_flag(columns, "is_sensitive_warning", "is_anomaly_strict"),
            "quality_issue_count": _sum_flag(columns, "data_quality_issue_flag", "time_quality_issue_flag", "kwh_quality_issue_flag"),
            "energy_issue_count": _sum_flag(columns, "energy_inconsistency_flag", "loaded_zero_kwh_flag", "kwh_negative_delta_flag"),
            "risk_signal_count": _sum_action_level(columns),
        }
        bucket_sql = f"""
WITH hourly AS (
  SELECT DATEADD(hour, DATEDIFF(hour, 0, [{event_time}]), 0) AS bucket_start,
         COUNT_BIG(*) AS event_count,
         COUNT(DISTINCT [{machine_id}]) AS machine_count,
         {expressions['anomaly_count']} AS anomaly_count,
         {expressions['warning_count']} AS warning_count,
         {expressions['quality_issue_count']} AS quality_issue_count,
         {expressions['energy_issue_count']} AS energy_issue_count,
         {expressions['risk_signal_count']} AS risk_signal_count
  FROM {table_name(source_aware_name)}
  WHERE [{event_time}] IS NOT NULL
  GROUP BY DATEADD(hour, DATEDIFF(hour, 0, [{event_time}]), 0)
)
SELECT TOP (1) *,
  (machine_count * 2 + anomaly_count * 8 + warning_count * 3 + quality_issue_count * 3 + energy_issue_count * 3 + risk_signal_count * 5) AS demo_score
FROM hourly
WHERE event_count > 0
ORDER BY demo_score DESC, event_count ASC, bucket_start DESC;
"""
        chosen = read_sql(conn, bucket_sql, [])
        if chosen.empty:
            raise RuntimeError("NO_DEMO_SOURCE_EVENTS: source-aware view has no eligible events")
        row = chosen.iloc[0]
        start = pd.Timestamp(row["bucket_start"]).to_pydatetime()
        end = min(start + pd.Timedelta(minutes=maximum_minutes).to_pytimedelta(), start + pd.Timedelta(hours=4).to_pytimedelta())
        machine_sql = f"""
SELECT TOP (8) [{machine_id}] AS machine_id, COUNT_BIG(*) AS event_count
FROM {table_name(source_aware_name)}
WHERE [{event_time}] >= ? AND [{event_time}] < ?
GROUP BY [{machine_id}]
ORDER BY event_count DESC, machine_id;
"""
        machines = read_sql(conn, machine_sql, [start, end])
    return {
        "created_time": datetime.now(UTC).isoformat(),
        "selection_method": "highest evidence-weighted source-aware hourly bucket; SQL read-only",
        "replay_start_time": start.isoformat(),
        "replay_end_time": end.isoformat(),
        "minimum_minutes": minimum_minutes,
        "maximum_minutes": maximum_minutes,
        "recommended_machine_ids": [int(value) for value in machines.get("machine_id", pd.Series(dtype="int64")).tolist()],
        "event_count": int(row["event_count"]),
        "machine_count": int(row["machine_count"]),
        "anomaly_count": int(row["anomaly_count"]),
        "warning_count": int(row["warning_count"]),
        "quality_issue_count": int(row["quality_issue_count"]),
        "energy_issue_count": int(row["energy_issue_count"]),
        "fault_maintenance_related_count": int(row["risk_signal_count"]),
        "reason": "Selected from real operational/AI/quality/energy evidence rather than a hard-coded interval.",
        "sql_writes": 0,
    }


def _first(columns: set[str], *candidates: str) -> str | None:
    return next((candidate for candidate in candidates if candidate in columns), None)


def _sum_flag(columns: set[str], *candidates: str) -> str:
    existing = [candidate for candidate in candidates if candidate in columns]
    if not existing:
        return "CAST(0 AS BIGINT)"
    parts = [f"CASE WHEN TRY_CONVERT(float, [{column}]) > 0 THEN 1 ELSE 0 END" for column in existing]
    return "SUM(CASE WHEN " + " OR ".join(f"({part}) = 1" for part in parts) + " THEN 1 ELSE 0 END)"


def _sum_action_level(columns: set[str]) -> str:
    """Count actual operational action levels, never arbitrary positive risks."""
    if "operational_action_level" not in columns:
        return "CAST(0 AS BIGINT)"
    return "SUM(CASE WHEN UPPER(LTRIM(RTRIM(CONVERT(varchar(32), [operational_action_level])))) IN ('CRITICAL', 'HIGH', 'MEDIUM') THEN 1 ELSE 0 END)"


def _scalar(frame: pd.DataFrame) -> int:
    return int(frame.iloc[0]["value"]) if not frame.empty else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only replay preflight and demo profile selection.")
    parser.add_argument("--config", default="inference/online/config.replay.local.yaml")
    parser.add_argument("--preflight-output", default="data/replay_runtime/demo_preflight_sql_state.json")
    parser.add_argument("--profile-output", default="data/replay_runtime/demo_profile_tomorrow.json")
    parser.add_argument("--select-profile", action="store_true")
    args = parser.parse_args()
    cfg = load_config(args.config)
    baseline = run_preflight(cfg)
    atomic_json(Path(args.preflight_output), baseline)
    if args.select_profile:
        profile = choose_demo_profile(cfg)
        atomic_json(Path(args.profile_output), profile)
        print({"preflight": "PASS", "profile": profile})
    else:
        print({"preflight": "PASS"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
