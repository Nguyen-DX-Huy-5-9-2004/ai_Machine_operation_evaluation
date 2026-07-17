"""Stage A: immutable, per-machine raw SQL snapshot for Candidate C.

This module intentionally contains no canonical feature transformation and no
model execution.  Its output is the only SQL-derived input accepted by the
Colab Candidate C preparation stage.
"""
from __future__ import annotations

import gc
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .db import connect, read_sql
from .sql_queries import quote_name, table_name


FACT_COLUMNS = ["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"]
DIMENSION_TABLES = {"data_machine": "machine", "data_machine_status": "machine_status", "data_location": "location", "machine_location_his": "machine_location_history"}


def _json_default(value: Any) -> Any:
    if isinstance(value, Path): return str(value)
    if isinstance(value, pd.Timestamp): return value.isoformat()
    if hasattr(value, "item"): return value.item()
    raise TypeError(type(value).__name__)


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=_json_default), encoding="utf-8")


def parquet_backend() -> tuple[str, str]:
    try:
        import pyarrow
        pd.DataFrame({"x": [1]}).to_parquet(Path.cwd() / ".candidate_c_pyarrow_probe.parquet", index=False)
        (Path.cwd() / ".candidate_c_pyarrow_probe.parquet").unlink(missing_ok=True)
        return "pyarrow", pyarrow.__version__
    except Exception:
        import duckdb
        return "duckdb", duckdb.__version__


def logical_hash(df: pd.DataFrame) -> str:
    h = hashlib.sha256()
    for row in df.astype(object).where(pd.notna(df), "<NULL>").itertuples(index=False, name=None):
        h.update("\x1f".join(str(v) for v in row).encode("utf-8")); h.update(b"\n")
    return h.hexdigest()


def write_parquet_atomic(df: pd.DataFrame, path: Path, backend: str) -> dict[str, Any]:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.unlink(missing_ok=True); path.parent.mkdir(parents=True, exist_ok=True)
    if backend == "pyarrow":
        df.to_parquet(tmp, index=False, compression="zstd")
    else:
        import duckdb
        con = duckdb.connect(); con.register("frame", df)
        try: con.execute(f"COPY frame TO '{str(tmp).replace("'", "''")}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        finally: con.close()
    read = read_parquet(tmp, backend)
    if list(read.columns) != list(df.columns) or len(read) != len(df) or logical_hash(read) != logical_hash(df):
        tmp.unlink(missing_ok=True); raise RuntimeError(f"Parquet roundtrip validation failed: {path}")
    os.replace(tmp, path)
    return {"rows": int(len(df)), "columns": list(df.columns), "logical_content_hash": logical_hash(df), "parquet_backend": backend, "compression": "zstd"}


def read_parquet(path: Path, backend: str) -> pd.DataFrame:
    if backend == "pyarrow": return pd.read_parquet(path)
    import duckdb
    return duckdb.sql(f"SELECT * FROM read_parquet('{str(path).replace("'", "''")}')").df()


def _source_filter(alias: str, cfg: dict[str, Any]) -> str:
    src = cfg["source_columns"]
    return f"{alias}.{quote_name(src['event_id'])} IS NOT NULL AND {alias}.{quote_name(src['machine_id'])} IS NOT NULL AND {alias}.{quote_name(src['status_id'])} IS NOT NULL AND {alias}.{quote_name(src['event_start_time'])} IS NOT NULL AND ISNULL({alias}.[is_deleted],0)=0"


def _watermark(conn: Any, cfg: dict[str, Any]) -> dict[str, Any]:
    src = cfg["source_columns"]; table = table_name(cfg["tables"]["raw_iot"])
    sql = f"SELECT MAX(CAST({quote_name(src['event_id'])} AS BIGINT)) max_id, MAX(CAST({quote_name(src['event_start_time'])} AS DATETIME2)) max_time, COUNT_BIG(*) row_count FROM {table} WHERE {_source_filter('', cfg).replace('.[', '[')}"
    data = read_sql(conn, sql).iloc[0].to_dict()
    machines = read_sql(conn, f"SELECT DISTINCT CAST({quote_name(src['machine_id'])} AS INT) machine_id FROM {table} WHERE {_source_filter('', cfg).replace('.[', '[')} ORDER BY machine_id")
    return {"source_max_event_id": int(data["max_id"]), "source_max_event_start_time": pd.to_datetime(data["max_time"]), "source_row_count": int(data["row_count"]), "source_machine_ids": machines.machine_id.astype(int).tolist(), "run_start_time": datetime.now().isoformat(timespec="seconds")}


def _fact_sql(cfg: dict[str, Any]) -> str:
    src = cfg["source_columns"]; table = table_name(cfg["tables"]["raw_iot"])
    c = lambda k: quote_name(src[k])
    return f"""SELECT CAST(i.{c('event_id')} AS BIGINT) event_id, CAST(i.{c('machine_id')} AS INT) machine_id, CAST(i.{c('status_id')} AS INT) status_id, CAST(i.{c('event_start_time')} AS DATETIME2) event_start_time, CAST(i.{c('raw_event_end_time')} AS DATETIME2) raw_event_end_time, TRY_CAST(i.{c('raw_kwh_start')} AS FLOAT) raw_status_kwh_start, TRY_CAST(i.{c('raw_kwh_end')} AS FLOAT) raw_status_kwh_end, CAST(i.{c('raw_error_code')} AS NVARCHAR(200)) raw_error_code FROM {table} i WHERE {_source_filter('i', cfg)} AND CAST(i.{c('event_id')} AS BIGINT) <= ? AND CAST(i.{c('machine_id')} AS INT) = ? ORDER BY machine_id, event_start_time, event_id"""


def export_source_snapshot(cfg: dict[str, Any], snapshot_dir: Path, run_id: str, resume: bool) -> int:
    backend, version = parquet_backend(); snapshot_dir.mkdir(parents=True, exist_ok=True)
    state_path = snapshot_dir / "snapshot_run_state.json"
    with connect(cfg["database"]) as conn:
        watermark = _watermark(conn, cfg)
        if (snapshot_dir / "source_watermark.json").exists():
            existing = json.loads((snapshot_dir / "source_watermark.json").read_text(encoding="utf-8"))
            if existing["source_max_event_id"] != watermark["source_max_event_id"] and resume:
                raise RuntimeError("STALE_PARTITION_REBUILD_REQUIRED: source watermark changed")
        write_json(snapshot_dir / "source_watermark.json", watermark)
        dims = []
        for name, key in DIMENSION_TABLES.items():
            path = snapshot_dir / "dimensions" / f"{name}.parquet"
            if not path.exists():
                frame = read_sql(conn, f"SELECT * FROM {table_name(cfg['tables'][key])} WHERE ISNULL([is_deleted],0)=0")
                dims.append({"name": name, "file": str(path.relative_to(snapshot_dir)), **write_parquet_atomic(frame, path, backend)})
            else: dims.append({"name": name, "file": str(path.relative_to(snapshot_dir)), "reused": True})
        write_json(snapshot_dir / "dimension_snapshot_manifest.json", {"backend": backend, "backend_version": version, "dimensions": dims})
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"run_id": run_id, "machines": {}}
        for machine_id in watermark["source_machine_ids"]:
            part = snapshot_dir / "fact" / f"machine_id={machine_id}"; data = part / "events.parquet"; manifest = part / "partition_manifest.json"; success = part / "_SUCCESS"
            if resume and success.exists() and manifest.exists():
                saved = json.loads(manifest.read_text(encoding="utf-8"))
                if saved.get("source_max_event_id") == watermark["source_max_event_id"]: state["machines"][str(machine_id)] = "COMPLETE"; continue
            state["machines"][str(machine_id)] = "EXTRACTING"; write_json(state_path, state)
            frame = read_sql(conn, _fact_sql(cfg), [watermark["source_max_event_id"], machine_id])
            for col in ["event_start_time", "raw_event_end_time"]: frame[col] = pd.to_datetime(frame[col], errors="coerce")
            if not frame.equals(frame.sort_values(["machine_id", "event_start_time", "event_id"], kind="mergesort").reset_index(drop=True)): raise RuntimeError(f"non-deterministic chronology machine={machine_id}")
            state["machines"][str(machine_id)] = "WRITING"; write_json(state_path, state)
            payload = write_parquet_atomic(frame, data, backend)
            payload.update({"machine_id": machine_id, "source_max_event_id": watermark["source_max_event_id"], "result": "PASS"})
            write_json(manifest, payload); success.write_text("", encoding="utf-8")
            state["machines"][str(machine_id)] = "COMPLETE"; write_json(state_path, state)
            del frame; gc.collect()
    manifests = [json.loads(p.read_text(encoding="utf-8")) for p in snapshot_dir.glob("fact/machine_id=*/partition_manifest.json")]
    summary = {"run_id": run_id, "result": "L1_CANDIDATE_SOURCE_SNAPSHOT_READY", "source_watermark": watermark, "partition_count": len(manifests), "partition_rows": int(sum(m.get("rows", 0) for m in manifests)), "backend": backend}
    write_json(snapshot_dir / "snapshot_manifest.json", summary); write_json(snapshot_dir / "snapshot_summary.json", summary)
    pd.DataFrame(manifests).to_csv(snapshot_dir / "snapshot_file_hashes.csv", index=False, encoding="utf-8")
    return 0


def validate_source_snapshot(snapshot_dir: Path) -> dict[str, Any]:
    errors: list[str] = []
    watermark_path = snapshot_dir / "source_watermark.json"; manifest_path = snapshot_dir / "snapshot_manifest.json"
    if not watermark_path.exists(): errors.append("missing_source_watermark")
    if not manifest_path.exists(): errors.append("missing_snapshot_manifest")
    if errors: return {"result": "L1_CANDIDATE_SOURCE_SNAPSHOT_NOT_READY", "errors": errors}
    watermark = json.loads(watermark_path.read_text(encoding="utf-8")); backend = json.loads(manifest_path.read_text(encoding="utf-8")).get("backend", "duckdb")
    ids: set[int] = set(); total = 0
    for machine in watermark["source_machine_ids"]:
        part = snapshot_dir / "fact" / f"machine_id={machine}"; data = part / "events.parquet"; meta = part / "partition_manifest.json"
        if not (data.exists() and meta.exists() and (part / "_SUCCESS").exists()): errors.append(f"incomplete_machine_{machine}"); continue
        df = read_parquet(data, backend); saved = json.loads(meta.read_text(encoding="utf-8"))
        if list(df.columns) != FACT_COLUMNS or logical_hash(df) != saved.get("logical_content_hash"): errors.append(f"hash_or_schema_{machine}")
        if df.event_id.duplicated().any() or (df.event_id > watermark["source_max_event_id"]).any(): errors.append(f"invalid_events_{machine}")
        overlap = ids & set(df.event_id.astype(int));
        if overlap: errors.append(f"duplicate_event_{machine}")
        ids.update(df.event_id.astype(int)); total += len(df)
    for name in DIMENSION_TABLES:
        if not (snapshot_dir / "dimensions" / f"{name}.parquet").exists(): errors.append(f"missing_dimension_{name}")
    if total != watermark["source_row_count"]: errors.append(f"row_count_mismatch:{total}!={watermark['source_row_count']}")
    return {"result": "L1_CANDIDATE_SOURCE_SNAPSHOT_READY" if not errors else "L1_CANDIDATE_SOURCE_SNAPSHOT_NOT_READY", "errors": errors, "rows": total, "machines": len(watermark["source_machine_ids"])}
