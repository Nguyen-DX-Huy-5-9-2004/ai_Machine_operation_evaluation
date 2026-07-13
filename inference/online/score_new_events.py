from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from .artifacts import load_config, resolve_obad_root
    from .db import bulk_insert_dataframe, connect, execute, read_sql
    from .feature_builder_l1 import build_realtime_features
    from .feature_builder_l2 import add_l2_runtime_features
    from .l1_scorer import L1Scorer
    from .l2_scorer import L2Scorer
    from .policy_engine import apply_policy_v2
    from .sql_queries import (
        get_checkpoint_sql,
        insert_run_log_sql,
        load_context_for_machines_sql,
        load_latest_location_sql,
        load_new_events_sql,
        update_checkpoint_sql,
    )
except ImportError:  # pragma: no cover - allows direct script execution
    from artifacts import load_config, resolve_obad_root
    from db import bulk_insert_dataframe, connect, execute, read_sql
    from feature_builder_l1 import build_realtime_features
    from feature_builder_l2 import add_l2_runtime_features
    from l1_scorer import L1Scorer
    from l2_scorer import L2Scorer
    from policy_engine import apply_policy_v2
    from sql_queries import (
        get_checkpoint_sql,
        insert_run_log_sql,
        load_context_for_machines_sql,
        load_latest_location_sql,
        load_new_events_sql,
        update_checkpoint_sql,
    )


STAGE_SAMPLE_COLUMNS = [
    "event_id",
    "machine_id",
    "status_id",
    "event_start_time",
    "event_end_time",
    "end_time_source",
    "duration_sec",
    "kwh_delta_model_value",
    "time_quality_issue_flag",
    "kwh_quality_issue_flag",
    "energy_inconsistency_flag",
]

ONLINE_OUTPUT_COLUMNS = [
    "event_id",
    "machine_id",
    "source_event_start_time",
    "source_event_end_time",
    "status_id",
    "status_type_code",
    "current_signal_code",
    "risk_fault_10_events",
    "risk_fault_30_events",
    "risk_fault_30min",
    "risk_fault_60min",
    "risk_maintenance_30_events",
    "risk_repair_30_events",
    "operational_action_level",
    "operational_judgment",
    "operational_fault_confidence_score",
    "operational_maintenance_confidence_score",
    "operational_repair_confidence_score",
    "operational_overall_risk_score",
    "quality_action_level",
    "quality_judgment",
    "quality_risk_score",
    "data_quality_issue_flag",
    "energy_inconsistency_flag",
    "kwh_quality_issue_flag",
    "time_quality_issue_flag",
    "is_behavior_anomaly",
    "is_sensitive_warning",
    "behavior_anomaly_score",
    "behavior_sensitive_score",
    "behavior_combined_score",
    "l1_score_available_flag",
    "l1_join_missing_flag",
    "final_reason_v2",
    "l2_run_id",
    "policy_version",
    "inference_version",
]


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    obad_root = resolve_obad_root(cfg)
    cfg.setdefault("artifacts", {})["obad_root"] = str(obad_root)

    runtime = cfg["runtime"]
    max_events = int(args.max_events or runtime.get("max_events_per_run", 100))
    dry_run = bool(args.dry_run or runtime.get("dry_run", True))

    with connect(cfg["database"]) as conn:
        checkpoint = load_checkpoint(conn, cfg)
        last_event_id = checkpoint.get("last_event_id")
        print("checkpoint last_event_id:", last_event_id)

        raw_new = load_new_events(conn, cfg, last_event_id, max_events)
        print("raw_new count:", len(raw_new))
        if raw_new.empty:
            write_run_log(conn, cfg, 0, 0, 0, 0, "OK", "No new events.")
            return 0

        machine_ids = sorted(raw_new["machine_id"].dropna().astype(int).unique().tolist())
        context = load_context(conn, cfg, machine_ids)
        location_map = load_location_map(conn, cfg, machine_ids)

    raw_all = (
        pd.concat([context, raw_new], ignore_index=True)
        .drop_duplicates("event_id")
        .sort_values(["machine_id", "event_start_time", "event_id"])
        .reset_index(drop=True)
    )
    features = build_realtime_features(
        raw_all,
        location_map=location_map,
        kwh_gap_limit_seconds=int(runtime.get("kwh_impute_gap_limit_seconds", 300)),
        big_gap_seconds=int(runtime.get("big_gap_seconds", 1800)),
        long_duration_seconds=int(runtime.get("long_duration_seconds", 86400)),
    )

    new_ids = set(raw_new["event_id"].astype(int))
    features_new = features[features["event_id"].astype(int).isin(new_ids)].copy()
    features_closed = closed_contiguous_prefix(features_new)

    print("context count:", len(context))
    print("features_new count:", len(features_new))
    print("features_closed count:", len(features_closed))

    print("sample 5 rows:")
    print(features_closed.reindex(columns=STAGE_SAMPLE_COLUMNS).head(5).to_string(index=False))

    if args.stage_only:
        return 0
    if features_closed.empty:
        return 0

    l1_scored = L1Scorer(cfg["artifacts"]).score(features_closed)
    l2_ready = add_l2_runtime_features(l1_scored)
    l2_scorer = L2Scorer(cfg["artifacts"])
    l2_scored = l2_scorer.predict(l2_ready)
    final = apply_policy_v2(
        l2_scored,
        l2_scorer.thresholds,
        policy_version=str(cfg["project"]["policy_version"]),
    )
    final["l2_run_id"] = cfg["project"]["l2_run_id"]
    final["inference_version"] = cfg["project"]["inference_version"]
    output = format_online_output(final)

    if dry_run:
        print("DRY RUN - rows ready to write:", len(output))
        print(output.head(5).to_string(index=False))
        return 0

    with connect(cfg["database"]) as conn:
        written = bulk_insert_dataframe(conn, cfg["tables"]["online_l2_result"], output)
        max_scored_id = int(features_closed["event_id"].max())
        max_scored_time = pd.to_datetime(features_closed["event_start_time"]).max().to_pydatetime()
        execute(
            conn,
            update_checkpoint_sql(cfg["tables"]["checkpoint"]),
            [cfg["project"]["pipeline_name"], max_scored_id, max_scored_time],
        )
        write_run_log(
            conn,
            cfg,
            len(raw_new),
            written,
            len(features_new) - len(features_closed),
            0,
            "OK",
            f"Scored through event_id={max_scored_id}",
        )
    print("written:", written)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score newly closed Weldcom IOT events.")
    parser.add_argument("--config", default="inference/online/config.example.yaml")
    parser.add_argument("--stage-only", action="store_true", help="Only load SQL data and build realtime features.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write SQL output even if config dry_run=false.")
    parser.add_argument("--max-events", type=int, default=None)
    return parser.parse_args()


def load_checkpoint(conn: Any, cfg: dict[str, Any]) -> dict[str, Any]:
    df = read_sql(conn, get_checkpoint_sql(cfg["tables"]["checkpoint"]), [cfg["project"]["pipeline_name"]])
    if df.empty:
        return {"last_event_id": None, "last_event_time": None}
    row = df.iloc[0].to_dict()
    if pd.isna(row.get("last_event_id")):
        row["last_event_id"] = None
    else:
        row["last_event_id"] = int(row["last_event_id"])
    return row


def load_new_events(conn: Any, cfg: dict[str, Any], last_event_id: int | None, max_events: int) -> pd.DataFrame:
    return read_sql(
        conn,
        load_new_events_sql(cfg["tables"]["raw_iot"], cfg["source_columns"], max_events),
        [last_event_id, last_event_id],
    )


def load_context(conn: Any, cfg: dict[str, Any], machine_ids: list[int]) -> pd.DataFrame:
    if not machine_ids:
        return pd.DataFrame()
    machine_ids_sql = ",".join(str(int(v)) for v in machine_ids)
    return read_sql(
        conn,
        load_context_for_machines_sql(
            cfg["tables"]["raw_iot"],
            cfg["source_columns"],
            machine_ids_sql,
            int(cfg["runtime"].get("lookback_events_per_machine", 40)),
        ),
    )


def load_location_map(conn: Any, cfg: dict[str, Any], machine_ids: list[int]) -> pd.DataFrame:
    if not machine_ids:
        return pd.DataFrame()
    machine_ids_sql = ",".join(str(int(v)) for v in machine_ids)
    try:
        return read_sql(
            conn,
            load_latest_location_sql(
                cfg["tables"]["machine_location_history"],
                cfg["tables"]["location"],
                machine_ids_sql,
            ),
        )
    except Exception as exc:
        print("WARN location lookup failed:", exc)
        return pd.DataFrame()


def format_online_output(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.rename(
        columns={
            "event_start_time": "source_event_start_time",
            "event_end_time": "source_event_end_time",
        }
    )
    return out.reindex(columns=ONLINE_OUTPUT_COLUMNS)


def closed_contiguous_prefix(features_new: pd.DataFrame) -> pd.DataFrame:
    """Return only the earliest new events that are closed without skipping an open event.

    The checkpoint is global. If event 101 is still open and event 102 from another
    machine is closed, advancing the checkpoint to 102 would make event 101
    invisible to the next run. This conservative prefix rule avoids that loss.
    """
    if features_new.empty:
        return features_new.copy()
    ordered = features_new.sort_values("event_id").copy()
    open_mask = ordered["is_open_event"] == 1
    if open_mask.any():
        first_open_event_id = int(ordered.loc[open_mask, "event_id"].iloc[0])
        ordered = ordered[ordered["event_id"].astype(int) < first_open_event_id]
    return ordered[ordered["is_open_event"] == 0].copy()


def write_run_log(
    conn: Any,
    cfg: dict[str, Any],
    input_rows: int,
    scored_rows: int,
    skipped_rows: int,
    failed_rows: int,
    status: str,
    message: str,
) -> None:
    table = cfg["tables"].get("run_log")
    if not table:
        return
    try:
        execute(
            conn,
            insert_run_log_sql(table),
            [cfg["project"]["pipeline_name"], input_rows, scored_rows, skipped_rows, failed_rows, status, message],
        )
    except Exception as exc:
        print("WARN run log failed:", exc)


if __name__ == "__main__":
    raise SystemExit(main())
