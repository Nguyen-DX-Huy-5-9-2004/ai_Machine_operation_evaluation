from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from inference.online.artifacts import load_config  # noqa: E402
from inference.online.db import connect, read_sql  # noqa: E402
from inference.online.score_new_events import detect_csv_separator, resolve_project_path, resolve_project_root  # noqa: E402
from inference.online.sql_queries import col, table_name  # noqa: E402


RAW_EVENT_CSVS = [
    "data/backData/data_iot_convert.csv",
    "data/backData/new070726/data_iot_convert.csv",
    "data/backData/dataVanHanh/data_iot_convert.csv",
]

AI_DATASET_CSVS = [
    "data/dataCore/ai_l1_operation_event_sequence.csv",
    "data/dataCore/ai_l2_fault_confidence_event.csv",
    "data/dataDerived/vw_ai_l1_train_normal_lenient.csv",
    "data/dataDerived/vw_ai_l1_train_normal_strict.csv",
    "data/dataDerived/vw_ai_l2_train_final.csv",
]

CONTEXT_TABLES = [
    ("data_machine_status", "machine_status", "dbo.data_machine_status"),
    ("data_machine", "machine", "dbo.data_machine"),
    ("machine_location_his", "machine_location_history", "dbo.machine_location_his"),
    ("data_location", "location", "dbo.data_location"),
]

RAW_PROFILE_COLUMNS = [
    "source",
    "file_path",
    "exists",
    "count_rows",
    "min_id",
    "max_id",
    "min_status_time_start",
    "max_status_time_start",
    "distinct_machine_count",
    "distinct_status_count",
    "top_status_distribution_sample",
    "top_machine_distribution_sample",
    "error",
]

AI_PROFILE_COLUMNS = [
    "file_path",
    "exists",
    "count_rows",
    "min_event_id",
    "max_event_id",
    "min_event_start_time",
    "max_event_start_time",
    "distinct_machine_count",
    "distinct_status_count",
    "top_status_distribution_sample",
    "top_machine_distribution_sample",
    "error",
]

KEY_TYPES = [
    "strict_start_key",
    "strict_start_end_key",
    "rounded_ms_key",
    "rounded_second_key",
    "machine_time_second_key",
]


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    project_root = resolve_project_root(cfg)
    run_dir = project_root / "data" / "realtime_audit" / f"source_lineage_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=False)

    with connect(cfg["database"]) as conn:
        sql_profile = profile_sql_sources(conn, cfg)
        sql_events = load_sql_events(conn, cfg)

    raw_csv_profiles = pd.concat(
        [profile_raw_event_csv(resolve_project_path(cfg, p, project_root), p) for p in RAW_EVENT_CSVS],
        ignore_index=True,
    )
    ai_profiles = pd.concat(
        [profile_ai_dataset_csv(resolve_project_path(cfg, p, project_root), p) for p in AI_DATASET_CSVS],
        ignore_index=True,
    )

    historical_l1_path = resolve_project_path(cfg, "data/dataCore/ai_l1_operation_event_sequence.csv", project_root)
    event_id_identity, event_id_identity_stats = build_event_id_identity_check(sql_events, historical_l1_path, args.sample_size)
    natural_summary, natural_match_sample, natural_mapping_sample = build_natural_key_alignment(
        sql_events,
        historical_l1_path,
        ai_profiles,
        args.sample_size,
    )
    same_id_diff = event_id_identity[
        (event_id_identity["sample_type"] == "in_both")
        & (event_id_identity["identity_match"] == False)  # noqa: E712
    ].copy()
    if not same_id_diff.empty:
        same_id_diff["reason"] = build_identity_mismatch_reason(same_id_diff)

    raw_csv_similarity = rank_raw_csv_similarity(sql_profile, raw_csv_profiles)
    recommended = build_recommended_decision(
        event_id_identity_stats=event_id_identity_stats,
        natural_summary=natural_summary,
        raw_csv_similarity=raw_csv_similarity,
    )

    write_json(run_dir / "00_config_sanitized.json", sanitized_config(cfg, project_root))
    write_csv(run_dir / "01_sql_raw_profile.csv", sql_profile, None)
    write_csv(run_dir / "02_raw_csv_profiles.csv", raw_csv_profiles, RAW_PROFILE_COLUMNS)
    write_csv(run_dir / "03_ai_dataset_profiles.csv", ai_profiles, AI_PROFILE_COLUMNS)
    write_csv(run_dir / "04_event_id_identity_check.csv", event_id_identity, None)
    write_json(run_dir / "05_natural_key_alignment_summary.json", natural_summary)
    write_csv(run_dir / "06_natural_key_match_sample.csv", natural_match_sample, None)
    write_csv(run_dir / "07_event_id_same_but_identity_different_sample.csv", same_id_diff, None)
    write_csv(run_dir / "08_sql_to_historical_natural_mapping_sample.csv", natural_mapping_sample, None)
    write_json(run_dir / "09_recommended_decision.json", recommended)
    (run_dir / "10_README_SOURCE_LINEAGE.md").write_text(
        build_readme(sql_profile, raw_csv_profiles, ai_profiles, event_id_identity_stats, natural_summary, recommended),
        encoding="utf-8",
    )

    print("source_lineage_audit_dir:", run_dir)
    print("decision:", recommended["decision"])
    print("event_id_identity_match_rate:", event_id_identity_stats["identity_match_rate"])
    print("best_natural_key_match_rate_vs_sql:", recommended["best_natural_key_match_rate_vs_sql"])
    print("closest_raw_csv:", recommended["closest_raw_csv"])
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit source lineage and natural identity compatibility.")
    parser.add_argument("--config", default="inference/online/config.local.yaml")
    parser.add_argument("--sample-size", type=int, default=100)
    return parser.parse_args()


def profile_sql_sources(conn: Any, cfg: Mapping[str, Any]) -> pd.DataFrame:
    rows = [profile_sql_raw_iot(conn, cfg)]
    for label, config_key, default_table in CONTEXT_TABLES:
        table = cfg.get("tables", {}).get(config_key) or default_table
        rows.append(profile_sql_context_table(conn, label, table))
    return pd.DataFrame(rows)


def profile_sql_raw_iot(conn: Any, cfg: Mapping[str, Any]) -> dict[str, Any]:
    cols = cfg["source_columns"]
    sql = f"""
SELECT
    CAST(COUNT_BIG(*) AS BIGINT) AS count_rows,
    MIN(CAST(i.{col(cols, "event_id")} AS BIGINT)) AS min_id,
    MAX(CAST(i.{col(cols, "event_id")} AS BIGINT)) AS max_id,
    MIN(CAST(i.{col(cols, "event_start_time")} AS DATETIME2)) AS min_status_time_start,
    MAX(CAST(i.{col(cols, "event_start_time")} AS DATETIME2)) AS max_status_time_start,
    COUNT(DISTINCT CAST(i.{col(cols, "machine_id")} AS INT)) AS distinct_machine_count,
    COUNT(DISTINCT CAST(i.{col(cols, "status_id")} AS INT)) AS distinct_status_count,
    SUM(CASE WHEN i.{col(cols, "raw_event_end_time")} IS NULL THEN 1 ELSE 0 END) AS null_status_time_end_count,
    SUM(CASE WHEN i.{col(cols, "raw_event_end_time")} IS NOT NULL
              AND CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) <= CAST(i.{col(cols, "event_start_time")} AS DATETIME2)
             THEN 1 ELSE 0 END) AS invalid_status_time_end_count,
    SUM(CASE WHEN i.{col(cols, "raw_kwh_start")} IS NULL THEN 1 ELSE 0 END) AS null_kwh_start_count,
    SUM(CASE WHEN i.{col(cols, "raw_kwh_end")} IS NULL THEN 1 ELSE 0 END) AS null_kwh_end_count
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
"""
    try:
        row = read_sql(conn, sql).iloc[0].to_dict()
        row.update({
            "source": "sql",
            "table_name": cfg["tables"]["raw_iot"],
            "top_status_distribution": json.dumps(load_sql_top_counts(conn, cfg, "status_id"), ensure_ascii=False),
            "top_machine_distribution": json.dumps(load_sql_top_counts(conn, cfg, "machine_id"), ensure_ascii=False),
            "error": None,
        })
        return row
    except Exception as exc:
        return {"source": "sql", "table_name": cfg["tables"].get("raw_iot"), "error": str(exc)}


def profile_sql_context_table(conn: Any, table_key: str, table: str) -> dict[str, Any]:
    try:
        df = read_sql(conn, f"SELECT CAST(COUNT_BIG(*) AS BIGINT) AS count_rows FROM {table_name(table)}")
        return {"source": "sql_context", "table_key": table_key, "table_name": table, "count_rows": int(df.iloc[0]["count_rows"]), "error": None}
    except Exception as exc:
        return {"source": "sql_context", "table_key": table_key, "table_name": table, "count_rows": None, "error": str(exc)}


def load_sql_top_counts(conn: Any, cfg: Mapping[str, Any], source_column_key: str) -> list[dict[str, Any]]:
    cols = cfg["source_columns"]
    sql = f"""
SELECT TOP (20)
    CAST(i.{col(cols, source_column_key)} AS BIGINT) AS value,
    CAST(COUNT_BIG(*) AS BIGINT) AS count_rows
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
GROUP BY CAST(i.{col(cols, source_column_key)} AS BIGINT)
ORDER BY COUNT_BIG(*) DESC
"""
    return read_sql(conn, sql).to_dict(orient="records")


def load_sql_events(conn: Any, cfg: Mapping[str, Any]) -> pd.DataFrame:
    cols = cfg["source_columns"]
    sql = f"""
SELECT
    CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id,
    CAST(i.{col(cols, "machine_id")} AS INT) AS machine_id,
    CAST(i.{col(cols, "status_id")} AS INT) AS status_id,
    CAST(i.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time,
    CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.{col(cols, "raw_kwh_start")} AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.{col(cols, "raw_kwh_end")} AS FLOAT) AS raw_status_kwh_end
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
WHERE i.{col(cols, "event_id")} IS NOT NULL
  AND i.{col(cols, "machine_id")} IS NOT NULL
  AND i.{col(cols, "status_id")} IS NOT NULL
  AND i.{col(cols, "event_start_time")} IS NOT NULL
"""
    chunks = []
    for chunk in pd.read_sql(sql, conn, chunksize=200000):
        chunks.append(chunk)
    out = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    if not out.empty:
        out["event_id"] = pd.to_numeric(out["event_id"], errors="coerce").astype("Int64")
        out["machine_id"] = pd.to_numeric(out["machine_id"], errors="coerce").astype("Int64")
        out["status_id"] = pd.to_numeric(out["status_id"], errors="coerce").astype("Int64")
        out["event_start_time"] = pd.to_datetime(out["event_start_time"], errors="coerce")
        out["raw_event_end_time"] = pd.to_datetime(out["raw_event_end_time"], errors="coerce")
    return out


def profile_raw_event_csv(path: Path, display_path: str) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame([empty_raw_profile(display_path, False, "file not found")])
    try:
        sep, encoding = detect_csv_format(path)
        counters = init_profile_counters()
        usecols = {"id", "machine_id", "status_id", "status_time_start"}
        for chunk in pd.read_csv(path, sep=sep, encoding=encoding, usecols=lambda c: c in usecols, chunksize=500000, low_memory=False):
            update_raw_profile_counters(counters, chunk, id_col="id", time_col="status_time_start")
        row = finalize_raw_profile(counters)
        row.update({"source": "raw_csv", "file_path": display_path, "exists": True, "error": None})
        return pd.DataFrame([row])
    except Exception as exc:
        return pd.DataFrame([empty_raw_profile(display_path, True, str(exc))])


def profile_ai_dataset_csv(path: Path, display_path: str) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame([empty_ai_profile(display_path, False, "file not found")])
    try:
        sep, encoding = detect_csv_format(path)
        counters = init_profile_counters()
        usecols = {"event_id", "machine_id", "status_id", "event_start_time"}
        for chunk in pd.read_csv(path, sep=sep, encoding=encoding, usecols=lambda c: c in usecols, chunksize=500000, low_memory=False):
            update_raw_profile_counters(counters, chunk, id_col="event_id", time_col="event_start_time")
        row = finalize_ai_profile(counters)
        row.update({"file_path": display_path, "exists": True, "error": None})
        return pd.DataFrame([row])
    except Exception as exc:
        return pd.DataFrame([empty_ai_profile(display_path, True, str(exc))])


def detect_csv_format(path: Path) -> tuple[str, str]:
    with path.open("rb") as f:
        raw = f.read(4096)
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    else:
        encoding = "utf-8-sig"
    text = raw.decode(encoding, errors="replace")
    sep = ";" if text.count(";") > text.count(",") else ","
    return sep, encoding


def init_profile_counters() -> dict[str, Any]:
    return {
        "count_rows": 0,
        "min_id": None,
        "max_id": None,
        "min_time": None,
        "max_time": None,
        "machines": set(),
        "statuses": set(),
        "status_counter": Counter(),
        "machine_counter": Counter(),
    }


def update_raw_profile_counters(counters: dict[str, Any], chunk: pd.DataFrame, *, id_col: str, time_col: str) -> None:
    counters["count_rows"] += len(chunk)
    if id_col in chunk.columns:
        ids = pd.to_numeric(chunk[id_col], errors="coerce").dropna().astype("int64")
        if not ids.empty:
            counters["min_id"] = int(ids.min()) if counters["min_id"] is None else min(counters["min_id"], int(ids.min()))
            counters["max_id"] = int(ids.max()) if counters["max_id"] is None else max(counters["max_id"], int(ids.max()))
    if time_col in chunk.columns:
        times = pd.to_datetime(chunk[time_col], errors="coerce").dropna()
        if not times.empty:
            counters["min_time"] = times.min() if counters["min_time"] is None else min(counters["min_time"], times.min())
            counters["max_time"] = times.max() if counters["max_time"] is None else max(counters["max_time"], times.max())
    if "machine_id" in chunk.columns:
        machines = pd.to_numeric(chunk["machine_id"], errors="coerce").dropna().astype("int64")
        counters["machines"].update(int(v) for v in machines.unique().tolist())
        counters["machine_counter"].update(int(v) for v in machines.tolist())
    if "status_id" in chunk.columns:
        statuses = pd.to_numeric(chunk["status_id"], errors="coerce").dropna().astype("int64")
        counters["statuses"].update(int(v) for v in statuses.unique().tolist())
        counters["status_counter"].update(int(v) for v in statuses.tolist())


def finalize_raw_profile(counters: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "count_rows": counters["count_rows"],
        "min_id": counters["min_id"],
        "max_id": counters["max_id"],
        "min_status_time_start": counters["min_time"],
        "max_status_time_start": counters["max_time"],
        "distinct_machine_count": len(counters["machines"]),
        "distinct_status_count": len(counters["statuses"]),
        "top_status_distribution_sample": json.dumps(dict(counters["status_counter"].most_common(20)), ensure_ascii=False),
        "top_machine_distribution_sample": json.dumps(dict(counters["machine_counter"].most_common(20)), ensure_ascii=False),
    }


def finalize_ai_profile(counters: Mapping[str, Any]) -> dict[str, Any]:
    raw = finalize_raw_profile(counters)
    return {
        "count_rows": raw["count_rows"],
        "min_event_id": raw["min_id"],
        "max_event_id": raw["max_id"],
        "min_event_start_time": raw["min_status_time_start"],
        "max_event_start_time": raw["max_status_time_start"],
        "distinct_machine_count": raw["distinct_machine_count"],
        "distinct_status_count": raw["distinct_status_count"],
        "top_status_distribution_sample": raw["top_status_distribution_sample"],
        "top_machine_distribution_sample": raw["top_machine_distribution_sample"],
    }


def empty_raw_profile(path: str, exists: bool, error: str) -> dict[str, Any]:
    return {"source": "raw_csv", "file_path": path, "exists": exists, "error": error}


def empty_ai_profile(path: str, exists: bool, error: str) -> dict[str, Any]:
    return {"file_path": path, "exists": exists, "error": error}


def build_event_id_identity_check(sql_events: pd.DataFrame, historical_l1_path: Path, sample_size: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    sql_ids = set(sql_events["event_id"].dropna().astype(int).tolist())
    hist_ids = load_historical_event_ids(historical_l1_path)
    in_both = sorted(list(sql_ids & hist_ids))[:sample_size]
    only_sql = sorted(list(sql_ids - hist_ids))[:sample_size]
    only_hist = sorted(list(hist_ids - sql_ids))[:sample_size]
    hist = load_historical_l1_rows(historical_l1_path, in_both)
    sql = sql_events[sql_events["event_id"].astype(int).isin(in_both)].copy()
    merged = sql.merge(hist, on="event_id", how="inner", suffixes=("_sql", "_hist"))
    rows = []
    for _, row in merged.iterrows():
        machine_match = int(row.get("machine_id_sql")) == int(row.get("machine_id_hist"))
        status_match = int(row.get("status_id_sql")) == int(row.get("status_id_hist"))
        sql_start = pd.to_datetime(row.get("event_start_time_sql"), errors="coerce")
        hist_start = pd.to_datetime(row.get("event_start_time_hist"), errors="coerce")
        start_match = bool(pd.notna(sql_start) and pd.notna(hist_start) and abs((sql_start - hist_start).total_seconds()) <= 0.001)
        rows.append({
            "sample_type": "in_both",
            "event_id": int(row["event_id"]),
            "sql_machine_id": row.get("machine_id_sql"),
            "hist_machine_id": row.get("machine_id_hist"),
            "sql_status_id": row.get("status_id_sql"),
            "hist_status_id": row.get("status_id_hist"),
            "sql_event_start_time": row.get("event_start_time_sql"),
            "hist_event_start_time": row.get("event_start_time_hist"),
            "sql_raw_event_end_time": row.get("raw_event_end_time"),
            "hist_event_end_time": row.get("event_end_time"),
            "machine_match": machine_match,
            "status_match": status_match,
            "start_time_match": start_match,
            "identity_match": machine_match and status_match and start_match,
        })
    rows.extend({"sample_type": "only_in_sql", "event_id": int(v)} for v in only_sql)
    rows.extend({"sample_type": "only_in_historical", "event_id": int(v)} for v in only_hist)
    out = pd.DataFrame(rows)
    in_both_rows = out[out.get("sample_type", pd.Series(dtype=str)) == "in_both"]
    identity_match_count = int(in_both_rows.get("identity_match", pd.Series(dtype=bool)).fillna(False).sum()) if not in_both_rows.empty else 0
    stats = {
        "sql_event_id_count": len(sql_ids),
        "historical_event_id_count": len(hist_ids),
        "event_id_intersection_count": len(sql_ids & hist_ids),
        "sample_in_both_count": int(len(in_both_rows)),
        "identity_match_count": identity_match_count,
        "identity_match_rate": safe_rate(identity_match_count, int(len(in_both_rows))),
    }
    return out, stats


def load_historical_event_ids(path: Path) -> set[int]:
    ids: set[int] = set()
    if not path.exists():
        return ids
    sep = detect_csv_separator(str(path))
    for chunk in pd.read_csv(path, sep=sep, usecols=["event_id"], chunksize=200000, low_memory=False):
        values = pd.to_numeric(chunk["event_id"], errors="coerce").dropna().astype("int64")
        ids.update(int(v) for v in values.tolist())
    return ids


def load_historical_l1_rows(path: Path, event_ids: Iterable[int]) -> pd.DataFrame:
    event_id_set = set(int(v) for v in event_ids)
    if not event_id_set or not path.exists():
        return pd.DataFrame()
    sep = detect_csv_separator(str(path))
    usecols = ["event_id", "machine_id", "status_id", "event_start_time", "event_end_time", "raw_status_kwh_start", "raw_status_kwh_end"]
    chunks = []
    for chunk in pd.read_csv(path, sep=sep, usecols=lambda c: c in usecols, chunksize=200000, low_memory=False):
        matched = chunk[pd.to_numeric(chunk["event_id"], errors="coerce").astype("Int64").isin(event_id_set)].copy()
        if not matched.empty:
            chunks.append(matched)
    out = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    if not out.empty:
        out["event_id"] = pd.to_numeric(out["event_id"], errors="coerce").astype("Int64")
        out["machine_id"] = pd.to_numeric(out["machine_id"], errors="coerce").astype("Int64")
        out["status_id"] = pd.to_numeric(out["status_id"], errors="coerce").astype("Int64")
        out["event_start_time"] = pd.to_datetime(out["event_start_time"], errors="coerce")
        out["event_end_time"] = pd.to_datetime(out["event_end_time"], errors="coerce")
    return out


def load_historical_l1_for_natural(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    sep = detect_csv_separator(str(path))
    usecols = ["event_id", "machine_id", "status_id", "event_start_time", "event_end_time", "raw_status_kwh_start", "raw_status_kwh_end"]
    chunks = []
    for chunk in pd.read_csv(path, sep=sep, usecols=lambda c: c in usecols, chunksize=500000, low_memory=False):
        chunks.append(normalize_hist_chunk(chunk))
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def temporal_disjoint_natural_summary(sql_events: pd.DataFrame, ai_profiles: pd.DataFrame) -> dict[str, Any] | None:
    l1_profile = ai_profiles[ai_profiles["file_path"] == "data/dataCore/ai_l1_operation_event_sequence.csv"]
    if sql_events.empty or l1_profile.empty:
        return {
            "key_results": [empty_key_result(key_type, "insufficient_sql_or_historical_rows") for key_type in KEY_TYPES],
            "best_key_by_rate_vs_sql": empty_key_result(KEY_TYPES[0], "insufficient_sql_or_historical_rows"),
            "timestamp_precision_note": "Insufficient rows to check natural key alignment.",
            "temporal_overlap": None,
        }
    sql_min = pd.to_datetime(sql_events["event_start_time"], errors="coerce").min()
    sql_max = pd.to_datetime(sql_events["event_start_time"], errors="coerce").max()
    hist_min = pd.to_datetime(l1_profile.iloc[0].get("min_event_start_time"), errors="coerce")
    hist_max = pd.to_datetime(l1_profile.iloc[0].get("max_event_start_time"), errors="coerce")
    if pd.isna(sql_min) or pd.isna(sql_max) or pd.isna(hist_min) or pd.isna(hist_max):
        return None
    temporal_overlap = not (sql_max < hist_min or hist_max < sql_min)
    if temporal_overlap:
        return None
    reason = f"temporal_ranges_do_not_overlap: sql={sql_min}..{sql_max}; historical_l1={hist_min}..{hist_max}"
    rows = [empty_key_result(key_type, reason) for key_type in KEY_TYPES]
    return {
        "key_results": rows,
        "best_key_by_rate_vs_sql": rows[0],
        "timestamp_precision_note": reason,
        "temporal_overlap": False,
    }


def empty_key_result(key_type: str, reason: str) -> dict[str, Any]:
    return {
        "match_key_type": key_type,
        "sql_key_count": None,
        "historical_key_count": None,
        "intersection_count": 0,
        "intersection_rate_vs_sql": 0.0,
        "intersection_rate_vs_historical": 0.0,
        "duplicate_key_count_sql": None,
        "duplicate_key_count_historical": None,
        "matched_sample_count": 0,
        "skipped_reason": reason,
    }


def build_natural_key_alignment(
    sql_events: pd.DataFrame,
    historical_l1_path: Path,
    ai_profiles: pd.DataFrame,
    sample_size: int,
) -> tuple[dict[str, Any], pd.DataFrame, pd.DataFrame]:
    disjoint_summary = temporal_disjoint_natural_summary(sql_events, ai_profiles)
    if disjoint_summary is not None:
        return disjoint_summary, pd.DataFrame(), pd.DataFrame()

    sql_keyed = add_key_columns(sql_events.copy(), is_sql=True)
    hist_keyed = add_key_columns(load_historical_l1_for_natural(historical_l1_path), is_sql=False)
    samples: list[dict[str, Any]] = []
    mappings: list[dict[str, Any]] = []
    mapping_sample_limit = sample_size * len(KEY_TYPES)

    summary_rows = []
    for key_type in KEY_TYPES:
        key_col = f"__{key_type}"
        sql_keys = sql_keyed[[key_col]].dropna().drop_duplicates()
        hist_keys = hist_keyed[[key_col]].dropna().drop_duplicates()
        intersection = sql_keys.merge(hist_keys, on=key_col, how="inner")
        sql_key_values = sql_keyed.loc[sql_keyed[key_col].notna(), key_col]
        hist_key_values = hist_keyed.loc[hist_keyed[key_col].notna(), key_col]
        duplicate_key_count_sql = int(sql_key_values[sql_key_values.duplicated(keep=False)].nunique())
        duplicate_key_count_historical = int(hist_key_values[hist_key_values.duplicated(keep=False)].nunique())
        stat = {
            "match_key_type": key_type,
            "sql_key_count": int(len(sql_keys)),
            "historical_key_count": int(len(hist_keys)),
            "intersection_count": int(len(intersection)),
            "duplicate_key_count_sql": duplicate_key_count_sql,
            "duplicate_key_count_historical": duplicate_key_count_historical,
        }
        stat["intersection_rate_vs_sql"] = safe_rate(stat["intersection_count"], stat["sql_key_count"])
        stat["intersection_rate_vs_historical"] = safe_rate(stat["intersection_count"], stat["historical_key_count"])
        stat["matched_sample_count"] = 0
        if not intersection.empty:
            sql_cols = [
                key_col,
                "event_id",
                "machine_id",
                "status_id",
                "event_start_time",
                "raw_event_end_time",
                "raw_status_kwh_start",
                "raw_status_kwh_end",
            ]
            hist_cols = [
                key_col,
                "event_id",
                "machine_id",
                "status_id",
                "event_start_time",
                "event_end_time",
                "raw_status_kwh_start",
                "raw_status_kwh_end",
            ]
            sql_first = sql_keyed.reindex(columns=sql_cols).dropna(subset=[key_col]).drop_duplicates(key_col, keep="first")
            hist_first = hist_keyed.reindex(columns=hist_cols).dropna(subset=[key_col]).drop_duplicates(key_col, keep="first")
            joined = hist_first.merge(sql_first, on=key_col, how="inner", suffixes=("_hist", "_sql"))
            stat["matched_sample_count"] = int(min(len(joined), sample_size))
            for _, row in joined.head(sample_size).iterrows():
                sql_match = sql_row_from_joined(row)
                hist_row = hist_row_from_joined(row)
                samples.append(build_natural_match_row(key_type, sql_match, hist_row))
                if int(sql_match["event_id"]) != int(hist_row["event_id"]) and len(mappings) < mapping_sample_limit:
                    mappings.append(build_mapping_row(key_type, sql_match, hist_row))
        summary_rows.append(stat)
    summary = {
        "key_results": summary_rows,
        "best_key_by_rate_vs_sql": max(summary_rows, key=lambda r: r.get("intersection_rate_vs_sql") or 0),
        "timestamp_precision_note": precision_note(summary_rows),
    }
    return summary, pd.DataFrame(samples), pd.DataFrame(mappings)


def normalize_hist_chunk(chunk: pd.DataFrame) -> pd.DataFrame:
    out = chunk.copy()
    for col_name in ["event_id", "machine_id", "status_id"]:
        if col_name in out.columns:
            out[col_name] = pd.to_numeric(out[col_name], errors="coerce").astype("Int64")
    for col_name in ["event_start_time", "event_end_time"]:
        if col_name in out.columns:
            out[col_name] = pd.to_datetime(out[col_name], errors="coerce")
    return out.dropna(subset=["event_id", "machine_id", "status_id", "event_start_time"])


def build_sql_key_maps(sql_events: pd.DataFrame) -> dict[str, dict[str, Any]]:
    maps: dict[str, dict[str, Any]] = {}
    sql_cols = [
        "event_id",
        "machine_id",
        "status_id",
        "event_start_time",
        "raw_event_end_time",
        "raw_status_kwh_start",
        "raw_status_kwh_end",
    ]
    for key_type in KEY_TYPES:
        key_col = f"__{key_type}"
        keys = sql_events[key_col].dropna()
        duplicate_count = int(keys[keys.duplicated(keep=False)].nunique())
        first_df = (
            sql_events.dropna(subset=[key_col])
            .drop_duplicates(key_col, keep="first")
            .reindex(columns=[key_col] + sql_cols)
            .copy()
        )
        maps[key_type] = {
            "set": set(keys.unique().tolist()),
            "first_df": first_df,
            "duplicate_count": duplicate_count,
        }
    return maps


def add_key_columns(df: pd.DataFrame, *, is_sql: bool) -> pd.DataFrame:
    if df.empty:
        for key_type in KEY_TYPES:
            df[f"__{key_type}"] = pd.Series(dtype=object)
        return df
    out = df.copy()
    out["machine_id"] = pd.to_numeric(out["machine_id"], errors="coerce").astype("Int64")
    out["status_id"] = pd.to_numeric(out["status_id"], errors="coerce").astype("Int64")
    out["event_start_time"] = pd.to_datetime(out["event_start_time"], errors="coerce")
    end_col = "raw_event_end_time" if is_sql else "event_end_time"
    if end_col in out.columns:
        out[end_col] = pd.to_datetime(out[end_col], errors="coerce")
    machine = out["machine_id"].astype("string")
    status = out["status_id"].astype("string")
    start_exact = format_timestamp_series(out["event_start_time"])
    end_exact = format_timestamp_series(out[end_col]) if end_col in out.columns else pd.Series(pd.NA, index=out.index, dtype="string")
    start_ms = format_timestamp_series(out["event_start_time"].dt.round("ms"))
    start_second = format_timestamp_series(out["event_start_time"].dt.round("s"))
    valid_base = out["machine_id"].notna() & out["status_id"].notna() & out["event_start_time"].notna()
    out["__strict_start_key"] = compose_key([machine, status, start_exact], valid_base)
    out["__strict_start_end_key"] = compose_key([machine, status, start_exact, end_exact], valid_base & out[end_col].notna())
    out["__rounded_ms_key"] = compose_key([machine, status, start_ms], valid_base)
    out["__rounded_second_key"] = compose_key([machine, status, start_second], valid_base)
    out["__machine_time_second_key"] = compose_key([machine, start_second], out["machine_id"].notna() & out["event_start_time"].notna())
    return out


def compose_key(parts: list[pd.Series], valid_mask: pd.Series) -> pd.Series:
    key = parts[0].astype("string")
    for part in parts[1:]:
        key = key + "\x1f" + part.astype("string")
    key = key.astype(object)
    key.loc[~valid_mask] = None
    return key


def format_timestamp_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce").dt.strftime("%Y-%m-%dT%H:%M:%S.%f").astype("string")


def sql_row_from_joined(row: pd.Series) -> dict[str, Any]:
    return {
        "event_id": row.get("event_id_sql"),
        "machine_id": row.get("machine_id_sql"),
        "status_id": row.get("status_id_sql"),
        "event_start_time": row.get("event_start_time_sql"),
        "raw_event_end_time": row.get("raw_event_end_time"),
        "raw_status_kwh_start": row.get("raw_status_kwh_start_sql"),
        "raw_status_kwh_end": row.get("raw_status_kwh_end_sql"),
    }


def hist_row_from_joined(row: pd.Series) -> dict[str, Any]:
    return {
        "event_id": row.get("event_id_hist"),
        "machine_id": row.get("machine_id_hist"),
        "status_id": row.get("status_id_hist"),
        "event_start_time": row.get("event_start_time_hist"),
        "event_end_time": row.get("event_end_time"),
        "raw_status_kwh_start": row.get("raw_status_kwh_start_hist"),
        "raw_status_kwh_end": row.get("raw_status_kwh_end_hist"),
    }


def make_keys_for_row(row: Mapping[str, Any], *, is_sql: bool) -> dict[str, tuple[Any, ...] | None]:
    event_start = pd.to_datetime(row.get("event_start_time"), errors="coerce")
    event_end_col = "raw_event_end_time" if is_sql else "event_end_time"
    event_end = pd.to_datetime(row.get(event_end_col), errors="coerce")
    machine_id = as_int(row.get("machine_id"))
    status_id = as_int(row.get("status_id"))
    if machine_id is None or status_id is None or pd.isna(event_start):
        return {key_type: None for key_type in KEY_TYPES}
    exact_start = timestamp_key(event_start)
    exact_end = timestamp_key(event_end) if pd.notna(event_end) else None
    return {
        "strict_start_key": (machine_id, status_id, exact_start),
        "strict_start_end_key": (machine_id, status_id, exact_start, exact_end) if exact_end else None,
        "rounded_ms_key": (machine_id, status_id, timestamp_key(event_start.round("ms"))),
        "rounded_second_key": (machine_id, status_id, timestamp_key(event_start.round("s"))),
        "machine_time_second_key": (machine_id, timestamp_key(event_start.round("s"))),
    }


def build_natural_match_row(key_type: str, sql_row: Mapping[str, Any], hist_row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "match_key_type": key_type,
        "sql_event_id": sql_row.get("event_id"),
        "hist_event_id": hist_row.get("event_id"),
        "sql_machine_id": sql_row.get("machine_id"),
        "hist_machine_id": hist_row.get("machine_id"),
        "sql_status_id": sql_row.get("status_id"),
        "hist_status_id": hist_row.get("status_id"),
        "sql_event_start_time": sql_row.get("event_start_time"),
        "hist_event_start_time": hist_row.get("event_start_time"),
        "sql_raw_event_end_time": sql_row.get("raw_event_end_time"),
        "hist_event_end_time": hist_row.get("event_end_time"),
        "sql_kwh_start": sql_row.get("raw_status_kwh_start"),
        "hist_kwh_start": hist_row.get("raw_status_kwh_start"),
        "sql_kwh_end": sql_row.get("raw_status_kwh_end"),
        "hist_kwh_end": hist_row.get("raw_status_kwh_end"),
        "event_id_same": as_int(sql_row.get("event_id")) == as_int(hist_row.get("event_id")),
        "natural_identity_match": True,
    }


def build_mapping_row(key_type: str, sql_row: Mapping[str, Any], hist_row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "sql_event_id": sql_row.get("event_id"),
        "historical_event_id": hist_row.get("event_id"),
        "machine_id": sql_row.get("machine_id"),
        "status_id": sql_row.get("status_id"),
        "event_start_time": sql_row.get("event_start_time"),
        "sql_raw_event_end_time": sql_row.get("raw_event_end_time"),
        "hist_event_end_time": hist_row.get("event_end_time"),
        "mapping_key_type": key_type,
    }


def build_identity_mismatch_reason(df: pd.DataFrame) -> pd.Series:
    reasons = []
    for _, row in df.iterrows():
        parts = []
        if not bool(row.get("machine_match")):
            parts.append("machine_id_diff")
        if not bool(row.get("status_match")):
            parts.append("status_id_diff")
        if not bool(row.get("start_time_match")):
            parts.append("event_start_time_diff")
        reasons.append("|".join(parts) or "unknown")
    return pd.Series(reasons, index=df.index)


def rank_raw_csv_similarity(sql_profile: pd.DataFrame, raw_csv_profiles: pd.DataFrame) -> list[dict[str, Any]]:
    sql_row = sql_profile[sql_profile.get("source") == "sql"].iloc[0].to_dict()
    out = []
    for _, row in raw_csv_profiles.iterrows():
        if not bool(row.get("exists")) or row.get("error"):
            out.append({"file_path": row.get("file_path"), "similarity_score": 0.0, "reason": row.get("error")})
            continue
        score = 0.0
        checks = 0
        for sql_col, csv_col in [
            ("count_rows", "count_rows"),
            ("min_id", "min_id"),
            ("max_id", "max_id"),
            ("min_status_time_start", "min_status_time_start"),
            ("max_status_time_start", "max_status_time_start"),
        ]:
            checks += 1
            if comparable_equal(sql_row.get(sql_col), row.get(csv_col)):
                score += 1
        out.append({"file_path": row.get("file_path"), "similarity_score": score / checks if checks else 0.0, "reason": "profile_field_similarity"})
    return sorted(out, key=lambda r: r["similarity_score"], reverse=True)


def build_recommended_decision(
    *,
    event_id_identity_stats: Mapping[str, Any],
    natural_summary: Mapping[str, Any],
    raw_csv_similarity: list[dict[str, Any]],
) -> dict[str, Any]:
    event_id_rate = event_id_identity_stats.get("identity_match_rate")
    best_key = natural_summary.get("best_key_by_rate_vs_sql", {})
    best_natural_rate = best_key.get("intersection_rate_vs_sql") or 0.0
    closest_raw = raw_csv_similarity[0] if raw_csv_similarity else {"file_path": None, "similarity_score": None}
    if event_id_rate is None:
        decision = "INSUFFICIENT_EVIDENCE"
        next_step = "Fix SQL/CSV/historical access, then rerun source lineage audit."
    elif event_id_rate >= 0.95:
        decision = "EVENT_ID_ALIGNED"
        next_step = "Use event_id for feature validation."
    elif best_natural_rate >= 0.50:
        decision = "EVENT_ID_REKEYED_BUT_NATURAL_EVENTS_OVERLAP"
        next_step = "Use natural key mapping for feature validation. Do not use event_id for validation."
    elif best_natural_rate < 0.01:
        decision = "SOURCE_MISMATCH_BY_NATURAL_EVENT_IDENTITY"
        next_step = "Do not enable L1/L2 realtime. Use original training DB/snapshot or rebuild AI datasets from current SQL."
    else:
        decision = "INSUFFICIENT_EVIDENCE"
        next_step = "Review samples and thresholds; natural overlap is present but weak."
    return {
        "decision": decision,
        "event_id_identity_match_rate": event_id_rate,
        "best_natural_key_type": best_key.get("match_key_type"),
        "best_natural_key_match_rate_vs_sql": best_natural_rate,
        "best_natural_key_match_rate_vs_historical": best_key.get("intersection_rate_vs_historical"),
        "closest_raw_csv": closest_raw.get("file_path"),
        "closest_raw_csv_similarity_score": closest_raw.get("similarity_score"),
        "raw_csv_similarity": raw_csv_similarity,
        "recommended_next_step": next_step,
        "compatibility_warnings": [
            "documentProject/creatDataset.sql uses is_big_gap threshold 60*60 seconds; realtime config currently uses 1800 seconds.",
            "Do not compare realtime features by event_id unless event identity is confirmed.",
        ],
    }


def build_readme(
    sql_profile: pd.DataFrame,
    raw_csv_profiles: pd.DataFrame,
    ai_profiles: pd.DataFrame,
    event_id_stats: Mapping[str, Any],
    natural_summary: Mapping[str, Any],
    decision: Mapping[str, Any],
) -> str:
    sql = sql_profile[sql_profile.get("source") == "sql"].iloc[0].to_dict()
    l1 = ai_profiles[ai_profiles["file_path"] == "data/dataCore/ai_l1_operation_event_sequence.csv"].iloc[0].to_dict()
    return f"""# Source Lineage Audit

## 1. SQL hien tai

- Rows: {sql.get("count_rows")}
- ID: {sql.get("min_id")} -> {sql.get("max_id")}
- Time: {sql.get("min_status_time_start")} -> {sql.get("max_status_time_start")}

## 2. Raw CSV gan SQL nhat

- File: `{decision.get("closest_raw_csv")}`
- Similarity score: {decision.get("closest_raw_csv_similarity_score")}

## 3. Historical L1

- Rows: {l1.get("count_rows")}
- Event ID: {l1.get("min_event_id")} -> {l1.get("max_event_id")}
- Time: {l1.get("min_event_start_time")} -> {l1.get("max_event_start_time")}

## 4. Event ID identity

- Event ID intersection count: {event_id_stats.get("event_id_intersection_count")}
- Identity sample match rate: {event_id_stats.get("identity_match_rate")}
- Neu event_id trung so nhung machine/status/time khac, khong duoc dung event_id de validate feature.

## 5. Natural key

- Best key: `{decision.get("best_natural_key_type")}`
- Best match rate vs SQL: {decision.get("best_natural_key_match_rate_vs_sql")}
- Best match rate vs historical: {decision.get("best_natural_key_match_rate_vs_historical")}
- Timestamp note: {natural_summary.get("timestamp_precision_note")}

## 6. Co the dung SQL hien tai voi model da train khong?

Decision: `{decision.get("decision")}`

{decision.get("recommended_next_step")}

## 7. File can xem

1. `04_event_id_identity_check.csv`
2. `05_natural_key_alignment_summary.json`
3. `07_event_id_same_but_identity_different_sample.csv`
4. `08_sql_to_historical_natural_mapping_sample.csv`
5. `09_recommended_decision.json`
"""


def precision_note(rows: list[dict[str, Any]]) -> str:
    rates = {r["match_key_type"]: r.get("intersection_rate_vs_sql") or 0.0 for r in rows}
    if rates.get("strict_start_key", 0) < 0.01 and max(rates.get("rounded_ms_key", 0), rates.get("rounded_second_key", 0)) >= 0.50:
        return "Exact timestamp match is low but rounded timestamp match is high; likely timestamp precision drift."
    if max(rates.values() or [0]) < 0.01:
        return "All natural keys are near zero; likely different source events."
    return "No strong timestamp precision-only pattern detected."


def sanitized_config(cfg: Mapping[str, Any], project_root: Path) -> dict[str, Any]:
    database = dict(cfg.get("database", {}))
    if "password" in database:
        database["password"] = "***REDACTED***"
    return {
        "project": dict(cfg.get("project", {})),
        "database": database,
        "tables": dict(cfg.get("tables", {})),
        "source_columns": dict(cfg.get("source_columns", {})),
        "historical": dict(cfg.get("historical", {})),
        "audit": {
            "historical_l1_table": cfg.get("audit", {}).get("historical_l1_table"),
            "historical_l1_csv": cfg.get("audit", {}).get("historical_l1_csv"),
        },
        "project_root_resolved": str(project_root),
    }


def comparable_equal(left: Any, right: Any) -> bool:
    if pd.isna(left) or pd.isna(right):
        return False
    left_ts = pd.to_datetime(left, errors="coerce")
    right_ts = pd.to_datetime(right, errors="coerce")
    if pd.notna(left_ts) and pd.notna(right_ts):
        return left_ts == right_ts
    return str(left) == str(right)


def as_int(value: Any) -> int | None:
    if pd.isna(value):
        return None
    return int(value)


def timestamp_key(value: Any) -> str:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return ""
    return ts.isoformat()


def safe_rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return float(numerator) / float(denominator)


def write_csv(path: Path, df: pd.DataFrame, columns: list[str] | None) -> None:
    if columns is not None:
        df = df.reindex(columns=columns)
    df.to_csv(path, index=False, encoding="utf-8-sig")


def write_json(path: Path, obj: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=json_default), encoding="utf-8")


def json_default(value: Any) -> Any:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


if __name__ == "__main__":
    raise SystemExit(main())
