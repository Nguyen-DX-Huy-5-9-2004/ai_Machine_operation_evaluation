from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from inference.online.artifacts import load_config  # noqa: E402
from inference.online.db import connect, read_sql  # noqa: E402
from inference.online.score_new_events import (  # noqa: E402
    detect_csv_separator,
    get_historical_l1_csv,
    get_historical_l1_table,
    load_historical_l1_csv,
    resolve_project_path,
    resolve_project_root,
)
from inference.online.sql_queries import col, table_name  # noqa: E402


PROFILE_COLUMNS = [
    "source",
    "table_or_file",
    "row_count",
    "min_event_id",
    "max_event_id",
    "min_time",
    "max_time",
    "error",
]


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    project_root = resolve_project_root(cfg)
    run_dir = project_root / "data" / "realtime_audit" / f"alignment_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=False)

    historical_csv = get_historical_l1_csv(cfg)
    historical_csv_path = resolve_project_path(cfg, historical_csv, project_root) if historical_csv else None
    historical_table = get_historical_l1_table(cfg)

    sql_profile = pd.DataFrame()
    sql_first_last = pd.DataFrame()
    sql_ids: set[int] = set()
    sql_id_error: str | None = None
    historical_table_profile: dict[str, Any] | None = None
    with connect(cfg["database"]) as conn:
        sql_profile = load_sql_raw_profile(conn, cfg)
        sql_first_last = load_sql_first_last_events(conn, cfg, args.sample_size)
        try:
            sql_ids = load_sql_event_ids(conn, cfg)
        except Exception as exc:
            sql_id_error = str(exc)
        if historical_table:
            historical_table_profile = load_historical_table_profile(conn, historical_table)

    csv_profile, historical_first_last, historical_ids, csv_error = load_historical_csv_profile(
        historical_csv_path,
        args.sample_size,
    )

    summary = build_intersection_summary(
        cfg=cfg,
        project_root=project_root,
        historical_csv_path=historical_csv_path,
        sql_profile=sql_profile,
        csv_profile=csv_profile,
        sql_ids=sql_ids,
        historical_ids=historical_ids,
        sql_id_error=sql_id_error,
        csv_error=csv_error,
        historical_table=historical_table,
        historical_table_profile=historical_table_profile,
        sample_size=args.sample_size,
    )
    sample = build_intersection_sample(sql_ids, historical_ids, args.sample_size)
    sample = add_identity_details_to_sample(sample, cfg, historical_csv_path)
    identity_summary = summarize_identity_sample(sample)
    summary.update(identity_summary)
    if summary["intersection_count"] > 0 and summary.get("identity_sample_event_match_rate") == 0:
        summary["event_identity_alignment_result"] = "EVENT_ID_NUMERIC_OVERLAP_BUT_EVENT_IDENTITY_MISMATCH"
        summary["recommendation"] = "Use the DB that produced historical L1, or rebuild historical L1 from the current SQL source before enabling model readiness."
    elif summary["intersection_count"] > 0:
        summary["event_identity_alignment_result"] = "EVENT_ID_IDENTITY_SAMPLE_HAS_MATCHES"
    else:
        summary["event_identity_alignment_result"] = "SOURCE_MISMATCH_OR_DIFFERENT_EVENT_ID_SPACE"

    write_json(run_dir / "00_config_sanitized.json", sanitized_config(cfg, project_root, historical_csv_path))
    write_csv(run_dir / "01_sql_event_id_profile.csv", sql_profile, PROFILE_COLUMNS)
    write_csv(run_dir / "02_historical_l1_csv_event_id_profile.csv", csv_profile, PROFILE_COLUMNS)
    write_json(run_dir / "03_intersection_summary.json", summary)
    write_csv(run_dir / "04_sql_first_last_events.csv", sql_first_last, None)
    write_csv(run_dir / "05_historical_first_last_events.csv", historical_first_last, None)
    write_csv(run_dir / "06_intersection_sample.csv", sample, None)
    (run_dir / "07_README_ALIGNMENT.md").write_text(build_readme(summary), encoding="utf-8")

    print("alignment_audit_dir:", run_dir)
    print("alignment_result:", summary["alignment_result"])
    print("intersection_count:", summary["intersection_count"])
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check event_id alignment between realtime SQL and historical L1.")
    parser.add_argument("--config", default="inference/online/config.local.yaml")
    parser.add_argument("--sample-size", type=int, default=100)
    return parser.parse_args()


def load_sql_raw_profile(conn: Any, cfg: Mapping[str, Any]) -> pd.DataFrame:
    cols = cfg["source_columns"]
    sql = f"""
SELECT
    CAST(COUNT_BIG(*) AS BIGINT) AS row_count,
    MIN(CAST(i.{col(cols, "event_id")} AS BIGINT)) AS min_event_id,
    MAX(CAST(i.{col(cols, "event_id")} AS BIGINT)) AS max_event_id,
    MIN(CAST(i.{col(cols, "event_start_time")} AS DATETIME2)) AS min_time,
    MAX(CAST(i.{col(cols, "event_start_time")} AS DATETIME2)) AS max_time
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
"""
    try:
        df = read_sql(conn, sql)
        row = df.iloc[0].to_dict() if not df.empty else {}
        return pd.DataFrame([{
            "source": "sql_raw",
            "table_or_file": cfg["tables"]["raw_iot"],
            "row_count": row.get("row_count"),
            "min_event_id": row.get("min_event_id"),
            "max_event_id": row.get("max_event_id"),
            "min_time": row.get("min_time"),
            "max_time": row.get("max_time"),
            "error": None,
        }])
    except Exception as exc:
        return pd.DataFrame([{
            "source": "sql_raw",
            "table_or_file": cfg["tables"]["raw_iot"],
            "row_count": None,
            "min_event_id": None,
            "max_event_id": None,
            "min_time": None,
            "max_time": None,
            "error": str(exc),
        }])


def load_sql_first_last_events(conn: Any, cfg: Mapping[str, Any], sample_size: int) -> pd.DataFrame:
    cols = cfg["source_columns"]
    select_cols = f"""
    CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id,
    CAST(i.{col(cols, "machine_id")} AS INT) AS machine_id,
    CAST(i.{col(cols, "status_id")} AS INT) AS status_id,
    CAST(i.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time,
    CAST(i.{col(cols, "raw_event_end_time")} AS DATETIME2) AS raw_event_end_time
"""
    outputs = []
    for sample_role, order in [("first_by_event_id", "ASC"), ("last_by_event_id", "DESC")]:
        sql = f"""
SELECT TOP ({int(sample_size)})
{select_cols}
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
ORDER BY CAST(i.{col(cols, "event_id")} AS BIGINT) {order}
"""
        df = read_sql(conn, sql)
        df.insert(0, "sample_role", sample_role)
        outputs.append(df)
    return pd.concat(outputs, ignore_index=True) if outputs else pd.DataFrame()


def load_sql_event_ids(conn: Any, cfg: Mapping[str, Any]) -> set[int]:
    cols = cfg["source_columns"]
    sql = f"""
SELECT CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
ORDER BY CAST(i.{col(cols, "event_id")} AS BIGINT)
"""
    ids: set[int] = set()
    for chunk in pd.read_sql(sql, conn, chunksize=200000):
        values = pd.to_numeric(chunk["event_id"], errors="coerce").dropna().astype("int64")
        ids.update(int(v) for v in values.tolist())
    return ids


def load_historical_table_profile(conn: Any, historical_table: str) -> dict[str, Any]:
    sql = f"""
SELECT
    CAST(COUNT_BIG(*) AS BIGINT) AS row_count,
    MIN(CAST(event_id AS BIGINT)) AS min_event_id,
    MAX(CAST(event_id AS BIGINT)) AS max_event_id,
    MIN(CAST(event_start_time AS DATETIME2)) AS min_time,
    MAX(CAST(event_start_time AS DATETIME2)) AS max_time
FROM {table_name(historical_table)}
"""
    try:
        df = read_sql(conn, sql)
        return df.iloc[0].to_dict() if not df.empty else {"error": "empty_profile"}
    except Exception as exc:
        return {"error": str(exc)}


def load_historical_csv_profile(csv_path: Path | None, sample_size: int) -> tuple[pd.DataFrame, pd.DataFrame, set[int], str | None]:
    if csv_path is None:
        profile = empty_profile("historical_l1_csv", None, "historical.l1_csv/audit.historical_l1_csv is not configured")
        return profile, pd.DataFrame(), set(), "not_configured"
    if not csv_path.exists():
        profile = empty_profile("historical_l1_csv", str(csv_path), f"file not found: {csv_path}")
        return profile, pd.DataFrame(), set(), f"file not found: {csv_path}"

    sep = detect_csv_separator(str(csv_path))
    header = pd.read_csv(csv_path, sep=sep, nrows=0)
    if "event_id" not in header.columns:
        profile = empty_profile("historical_l1_csv", str(csv_path), "event_id column not found")
        return profile, pd.DataFrame(), set(), "event_id column not found"

    time_col = "event_start_time" if "event_start_time" in header.columns else None
    usecols = ["event_id"] + ([time_col] if time_col else [])
    event_ids: set[int] = set()
    row_count = 0
    min_event_id: int | None = None
    max_event_id: int | None = None
    min_time: Any = None
    max_time: Any = None
    first_rows: list[pd.DataFrame] = []
    last_rows: list[pd.DataFrame] = []

    for chunk in pd.read_csv(csv_path, sep=sep, usecols=usecols, chunksize=200000, low_memory=False):
        ids = pd.to_numeric(chunk["event_id"], errors="coerce")
        valid = chunk[ids.notna()].copy()
        if valid.empty:
            continue
        valid["event_id"] = ids[ids.notna()].astype("int64").values
        row_count += len(valid)
        values = valid["event_id"]
        min_event_id = int(values.min()) if min_event_id is None else min(min_event_id, int(values.min()))
        max_event_id = int(values.max()) if max_event_id is None else max(max_event_id, int(values.max()))
        event_ids.update(int(v) for v in values.tolist())
        if time_col:
            times = pd.to_datetime(valid[time_col], errors="coerce").dropna()
            if not times.empty:
                chunk_min_time = times.min()
                chunk_max_time = times.max()
                min_time = chunk_min_time if min_time is None else min(min_time, chunk_min_time)
                max_time = chunk_max_time if max_time is None else max(max_time, chunk_max_time)
        first_rows.append(valid.nsmallest(sample_size, "event_id"))
        last_rows.append(valid.nlargest(sample_size, "event_id"))

    first = pd.concat(first_rows, ignore_index=True).nsmallest(sample_size, "event_id") if first_rows else pd.DataFrame()
    last = pd.concat(last_rows, ignore_index=True).nlargest(sample_size, "event_id") if last_rows else pd.DataFrame()
    if not first.empty:
        first.insert(0, "sample_role", "first_by_event_id")
    if not last.empty:
        last.insert(0, "sample_role", "last_by_event_id")
    first_last = pd.concat([first, last], ignore_index=True) if not first.empty or not last.empty else pd.DataFrame()
    profile = pd.DataFrame([{
        "source": "historical_l1_csv",
        "table_or_file": str(csv_path),
        "row_count": row_count,
        "min_event_id": min_event_id,
        "max_event_id": max_event_id,
        "min_time": min_time,
        "max_time": max_time,
        "error": None,
    }])
    return profile, first_last, event_ids, None


def build_intersection_summary(
    *,
    cfg: Mapping[str, Any],
    project_root: Path,
    historical_csv_path: Path | None,
    sql_profile: pd.DataFrame,
    csv_profile: pd.DataFrame,
    sql_ids: set[int],
    historical_ids: set[int],
    sql_id_error: str | None,
    csv_error: str | None,
    historical_table: str,
    historical_table_profile: Mapping[str, Any] | None,
    sample_size: int,
) -> dict[str, Any]:
    intersection = sql_ids & historical_ids if sql_ids and historical_ids else set()
    sql_count = profile_int(sql_profile, "row_count")
    historical_count = profile_int(csv_profile, "row_count")
    intersection_count = len(intersection)
    alignment_result = "SOURCE_MISMATCH_OR_DIFFERENT_EVENT_ID_SPACE" if intersection_count == 0 else "EVENT_ID_OVERLAP_FOUND"
    return {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "project_root_resolved": str(project_root),
        "sql_source_table": cfg.get("tables", {}).get("raw_iot"),
        "historical_l1_table": historical_table,
        "historical_l1_csv_resolved": str(historical_csv_path) if historical_csv_path else None,
        "sql_raw_count": sql_count,
        "sql_min_event_id": profile_value(sql_profile, "min_event_id"),
        "sql_max_event_id": profile_value(sql_profile, "max_event_id"),
        "sql_min_time": json_default(profile_value(sql_profile, "min_time")),
        "sql_max_time": json_default(profile_value(sql_profile, "max_time")),
        "historical_l1_csv_count": historical_count,
        "historical_l1_csv_min_event_id": profile_value(csv_profile, "min_event_id"),
        "historical_l1_csv_max_event_id": profile_value(csv_profile, "max_event_id"),
        "historical_l1_csv_min_time": json_default(profile_value(csv_profile, "min_time")),
        "historical_l1_csv_max_time": json_default(profile_value(csv_profile, "max_time")),
        "historical_l1_table_profile": dict(historical_table_profile or {}),
        "intersection_count": intersection_count,
        "intersection_rate_vs_sql": safe_rate(intersection_count, sql_count),
        "intersection_rate_vs_historical": safe_rate(intersection_count, historical_count),
        "sample_event_id_in_both": sorted(list(intersection))[:sample_size],
        "sample_event_id_only_in_sql": sorted(list(sql_ids - historical_ids))[:sample_size] if sql_ids else [],
        "sample_event_id_only_in_historical": sorted(list(historical_ids - sql_ids))[:sample_size] if historical_ids else [],
        "sql_event_id_read_error": sql_id_error,
        "historical_l1_csv_read_error": csv_error,
        "alignment_result": alignment_result,
        "recommendation": (
            "Rebuild historical L1 from the current SQL source or use the same database that was used for training."
            if intersection_count == 0
            else "Use --candidate-mode historical-overlap for stage-only feature comparison, then inspect match_rate."
        ),
    }


def build_intersection_sample(sql_ids: set[int], historical_ids: set[int], sample_size: int) -> pd.DataFrame:
    rows = []
    for sample_type, values in [
        ("in_both", sorted(list(sql_ids & historical_ids))[:sample_size]),
        ("only_in_sql", sorted(list(sql_ids - historical_ids))[:sample_size]),
        ("only_in_historical", sorted(list(historical_ids - sql_ids))[:sample_size]),
    ]:
        rows.extend({"sample_type": sample_type, "event_id": int(event_id)} for event_id in values)
    return pd.DataFrame(rows, columns=["sample_type", "event_id"])


def add_identity_details_to_sample(sample: pd.DataFrame, cfg: Mapping[str, Any], historical_csv_path: Path | None) -> pd.DataFrame:
    if sample.empty or historical_csv_path is None or not historical_csv_path.exists():
        return sample
    in_both_ids = sample.loc[sample["sample_type"] == "in_both", "event_id"].dropna().astype(int).tolist()
    if not in_both_ids:
        return sample
    sql_details = load_sql_events_by_ids(cfg, in_both_ids)
    historical_details = load_historical_l1_csv(str(historical_csv_path), in_both_ids)
    historical_cols = [c for c in ["event_id", "machine_id", "status_id", "event_start_time"] if c in historical_details.columns]
    if historical_details.empty or not historical_cols:
        return sample
    historical_details = historical_details.reindex(columns=historical_cols).rename(
        columns={
            "machine_id": "historical_machine_id",
            "status_id": "historical_status_id",
            "event_start_time": "historical_event_start_time",
        }
    )
    sql_details = sql_details.rename(
        columns={
            "machine_id": "sql_machine_id",
            "status_id": "sql_status_id",
            "event_start_time": "sql_event_start_time",
        }
    )
    out = sample.merge(sql_details, on="event_id", how="left").merge(historical_details, on="event_id", how="left")
    out["identity_machine_match"] = out["sql_machine_id"].astype("Int64").eq(out["historical_machine_id"].astype("Int64")).astype(object)
    out["identity_status_match"] = out["sql_status_id"].astype("Int64").eq(out["historical_status_id"].astype("Int64")).astype(object)
    sql_time = pd.to_datetime(out["sql_event_start_time"], errors="coerce")
    historical_time = pd.to_datetime(out["historical_event_start_time"], errors="coerce")
    out["identity_start_time_match"] = sql_time.eq(historical_time).astype(object)
    out.loc[out["sample_type"] != "in_both", ["identity_machine_match", "identity_status_match", "identity_start_time_match"]] = None
    out["identity_all_match"] = (
        out["identity_machine_match"].fillna(False)
        & out["identity_status_match"].fillna(False)
        & out["identity_start_time_match"].fillna(False)
    ).astype(object)
    out.loc[out["sample_type"] != "in_both", "identity_all_match"] = None
    return out


def load_sql_events_by_ids(cfg: Mapping[str, Any], event_ids: list[int]) -> pd.DataFrame:
    cols = cfg["source_columns"]
    ids_sql = ",".join(str(int(v)) for v in sorted(set(event_ids)))
    sql = f"""
SELECT
    CAST(i.{col(cols, "event_id")} AS BIGINT) AS event_id,
    CAST(i.{col(cols, "machine_id")} AS INT) AS machine_id,
    CAST(i.{col(cols, "status_id")} AS INT) AS status_id,
    CAST(i.{col(cols, "event_start_time")} AS DATETIME2) AS event_start_time
FROM {table_name(cfg["tables"]["raw_iot"])} AS i
WHERE CAST(i.{col(cols, "event_id")} AS BIGINT) IN ({ids_sql})
"""
    with connect(cfg["database"]) as conn:
        return read_sql(conn, sql)


def summarize_identity_sample(sample: pd.DataFrame) -> dict[str, Any]:
    in_both = sample[sample.get("sample_type", pd.Series(dtype=str)) == "in_both"].copy()
    if in_both.empty or "identity_all_match" not in in_both.columns:
        return {
            "identity_sample_rows": 0,
            "identity_sample_event_match_count": 0,
            "identity_sample_event_match_rate": None,
        }
    values = in_both["identity_all_match"].fillna(False).astype(bool)
    match_count = int(values.sum())
    return {
        "identity_sample_rows": int(len(in_both)),
        "identity_sample_event_match_count": match_count,
        "identity_sample_event_match_rate": safe_rate(match_count, int(len(in_both))),
    }


def sanitized_config(cfg: Mapping[str, Any], project_root: Path, historical_csv_path: Path | None) -> dict[str, Any]:
    database = dict(cfg.get("database", {}))
    if "password" in database:
        database["password"] = "***REDACTED***"
    return {
        "project": dict(cfg.get("project", {})),
        "database": database,
        "tables": dict(cfg.get("tables", {})),
        "source_columns": dict(cfg.get("source_columns", {})),
        "historical": dict(cfg.get("historical", {})),
        "audit_historical_l1_table_legacy": cfg.get("audit", {}).get("historical_l1_table"),
        "audit_historical_l1_csv_legacy": cfg.get("audit", {}).get("historical_l1_csv"),
        "project_root_resolved": str(project_root),
        "historical_l1_csv_resolved": str(historical_csv_path) if historical_csv_path else None,
    }


def build_readme(summary: Mapping[str, Any]) -> str:
    return f"""# Event ID alignment audit

## Ket qua

- SQL source table: `{summary.get("sql_source_table")}`
- Historical L1 table: `{summary.get("historical_l1_table")}`
- Historical L1 CSV: `{summary.get("historical_l1_csv_resolved")}`
- SQL raw count: {summary.get("sql_raw_count")}
- Historical CSV count: {summary.get("historical_l1_csv_count")}
- SQL event_id range: {summary.get("sql_min_event_id")} -> {summary.get("sql_max_event_id")}
- Historical event_id range: {summary.get("historical_l1_csv_min_event_id")} -> {summary.get("historical_l1_csv_max_event_id")}
- Intersection count: {summary.get("intersection_count")}
- Intersection rate vs SQL: {summary.get("intersection_rate_vs_sql")}
- Intersection rate vs historical: {summary.get("intersection_rate_vs_historical")}
- Identity sample event match rate: {summary.get("identity_sample_event_match_rate")}
- Alignment result: `{summary.get("alignment_result")}`

## Ket luan

{summary.get("recommendation")}

## File can xem

1. `01_sql_event_id_profile.csv`
2. `02_historical_l1_csv_event_id_profile.csv`
3. `03_intersection_summary.json`
4. `06_intersection_sample.csv`
"""


def empty_profile(source: str, table_or_file: str | None, error: str) -> pd.DataFrame:
    return pd.DataFrame([{
        "source": source,
        "table_or_file": table_or_file,
        "row_count": None,
        "min_event_id": None,
        "max_event_id": None,
        "min_time": None,
        "max_time": None,
        "error": error,
    }])


def profile_value(df: pd.DataFrame, column: str) -> Any:
    if df.empty or column not in df.columns:
        return None
    return df.iloc[0][column]


def profile_int(df: pd.DataFrame, column: str) -> int:
    value = profile_value(df, column)
    if pd.isna(value):
        return 0
    return int(value)


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
