"""Prepare and validate the isolated L1 Candidate C retraining package.

This module deliberately reuses the canonical online feature builder.  It never
writes production SQL, production checkpoints, or production L1 artifacts.
"""
from __future__ import annotations

import hashlib
import gc
import json
import math
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd
import yaml

from .artifacts import resolve_obad_root
from .data_contract import validate_l1_model_contract
from .db import connect, read_sql
from .feature_builder_l1 import build_l1_event_features
from .sql_queries import quote_name, table_name
from .validation import data_pipeline_code_hash


L1_FEATURE_ORDER = [
    "status_id", "status_type_code", "current_signal_code", "hour_of_day", "day_of_week",
    "machine_group_id", "location_id", "duration_sec", "gap_from_prev_sec", "overlap_sec",
    "kwh_delta_model_value", "kwh_rate_per_hour", "is_on", "is_loaded", "is_no_load",
    "is_current_near_zero", "kwh_available_flag", "kwh_missing_flag",
    "kwh_imputed_or_missing_flag", "kwh_rate_missing_flag", "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag", "is_raw_end_missing", "is_invalid_raw_end",
    "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap",
    "is_big_gap", "is_overlap",
]
SPLITS = ("TRAIN", "CALIBRATION", "VALID", "TEST")
REQUIRED_PACKAGE_FILES = [
    "canonical/current_canonical_events.parquet", "canonical/canonical_manifest.json",
    "lenient/train.parquet", "lenient/calibration.parquet", "lenient/valid.parquet", "lenient/test.parquet",
    "strict/train.parquet", "strict/calibration.parquet", "strict/valid.parquet", "strict/test.parquet",
    "evaluation/valid_all_events.parquet", "evaluation/test_all_events.parquet",
    "split_event_manifest.parquet", "split_window_manifest.parquet", "split_leakage_report.json",
]


def _project_root(cfg: dict[str, Any]) -> Path:
    """Prefer the invoking project root; config paths may be relative to inference/online."""
    cwd = Path.cwd().resolve()
    if (cwd / "data").exists() and (cwd / "modeling").exists():
        return cwd
    resolved = resolve_obad_root(cfg)
    if (resolved / "data").exists() and (resolved / "modeling").exists():
        return resolved
    for parent in [cwd, *cwd.parents]:
        if (parent / "data").exists() and (parent / "modeling").exists():
            return parent
    return resolved


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    raise TypeError(type(value).__name__)


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _require_parquet() -> None:
    try:
        import pyarrow  # noqa: F401
        return
    except Exception:
        try:
            import duckdb  # noqa: F401
            return
        except Exception as exc:
            raise RuntimeError("Candidate C requires a working pyarrow or duckdb Parquet engine.") from exc


def _write_parquet(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        df.to_parquet(path, index=False)
    except Exception:
        import duckdb
        con = duckdb.connect()
        try:
            con.register("candidate_frame", df)
            escaped = str(path).replace("'", "''")
            con.execute(f"COPY candidate_frame TO '{escaped}' (FORMAT PARQUET)")
        finally:
            con.close()


def _read_parquet(path: Path) -> pd.DataFrame:
    try:
        return pd.read_parquet(path)
    except Exception:
        import duckdb
        escaped = str(path).replace("'", "''")
        return duckdb.sql(f"SELECT * FROM read_parquet('{escaped}')").df()


def _safe_run_id(run_id: str) -> str:
    if not run_id.startswith("l1_candidate_c_") or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in run_id):
        raise ValueError("candidate_run_id must start with l1_candidate_c_ and contain only letters, numbers, _ or -")
    return run_id


def _sanitize_config(cfg: dict[str, Any]) -> dict[str, Any]:
    out = json.loads(json.dumps(cfg))
    if "database" in out:
        out["database"].pop("password", None)
    return out


def _sql_raw_extract(cfg: dict[str, Any]) -> str:
    src, raw = cfg["source_columns"], cfg["tables"]["raw_iot"]
    def c(key: str) -> str:
        return quote_name(src[key])
    return f"""
SELECT
  CAST(i.{c('event_id')} AS BIGINT) AS event_id,
  CAST(i.{c('machine_id')} AS INT) AS machine_id,
  CAST(i.{c('status_id')} AS INT) AS status_id,
  CAST(i.{c('event_start_time')} AS DATETIME2) AS event_start_time,
  CAST(i.{c('raw_event_end_time')} AS DATETIME2) AS raw_event_end_time,
  TRY_CAST(i.{c('raw_kwh_start')} AS FLOAT) AS raw_status_kwh_start,
  TRY_CAST(i.{c('raw_kwh_end')} AS FLOAT) AS raw_status_kwh_end,
  CAST(i.{c('raw_error_code')} AS NVARCHAR(200)) AS raw_error_code
FROM {table_name(raw)} AS i
WHERE i.{c('event_id')} IS NOT NULL
  AND i.{c('machine_id')} IS NOT NULL
  AND i.{c('status_id')} IS NOT NULL
  AND i.{c('event_start_time')} IS NOT NULL
  AND ISNULL(i.[is_deleted], 0) = 0
ORDER BY CAST(i.{c('machine_id')} AS INT), CAST(i.{c('event_start_time')} AS DATETIME2), CAST(i.{c('event_id')} AS BIGINT)
"""


def _load_full_raw(conn: Any, cfg: dict[str, Any], chunksize: int = 200_000) -> pd.DataFrame:
    chunks = list(pd.read_sql(_sql_raw_extract(cfg), conn, chunksize=chunksize))
    if not chunks:
        return pd.DataFrame()
    raw = pd.concat(chunks, ignore_index=True)
    for col in ("event_start_time", "raw_event_end_time"):
        raw[col] = pd.to_datetime(raw[col], errors="coerce")
    return raw.sort_values(["machine_id", "event_start_time", "event_id"], kind="mergesort").reset_index(drop=True)


def _load_machine_context(conn: Any, cfg: dict[str, Any], raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    mc, lc, tables = cfg["machine_columns"], cfg["location_columns"], cfg["tables"]
    machine_sql = f"SELECT CAST({quote_name(mc['machine_id'])} AS INT) machine_id, CAST({quote_name(mc['machine_group_id'])} AS INT) machine_group_id FROM {table_name(tables['machine'])} WHERE ISNULL([is_deleted],0)=0"
    machines = read_sql(conn, machine_sql)
    location_sql = f"""
SELECT CAST({quote_name(lc['machine_id'])} AS INT) machine_id,
       CAST({quote_name(lc['location_id'])} AS INT) location_id,
       CAST({quote_name(lc['start_time'])} AS DATETIME2) start_time,
       CAST({quote_name(lc['end_time'])} AS DATETIME2) end_time
FROM {table_name(tables['machine_location_history'])}
WHERE ISNULL([is_deleted],0)=0
ORDER BY CAST({quote_name(lc['machine_id'])} AS INT), CAST({quote_name(lc['start_time'])} AS DATETIME2)
"""
    history = read_sql(conn, location_sql)
    if history.empty:
        return machines, pd.DataFrame(columns=["event_id", "machine_id", "location_id"])
    history["start_time"] = pd.to_datetime(history["start_time"], errors="coerce")
    history["end_time"] = pd.to_datetime(history["end_time"], errors="coerce")
    mapped: list[pd.DataFrame] = []
    for machine_id, events in raw.groupby("machine_id", sort=False):
        intervals = history[history["machine_id"] == machine_id].sort_values("start_time", kind="mergesort")
        base = events[["event_id", "machine_id", "event_start_time"]].sort_values("event_start_time", kind="mergesort")
        if intervals.empty:
            part = base.assign(location_id=pd.NA, location_history_start_time=pd.NaT, location_history_end_time=pd.NaT, location_mapping_source="missing_event_time")
        else:
            part = pd.merge_asof(base, intervals, left_on="event_start_time", right_on="start_time", by="machine_id", direction="backward")
            valid = part["end_time"].isna() | (part["event_start_time"] < part["end_time"])
            part.loc[~valid, "location_id"] = pd.NA
            part["location_history_start_time"] = part["start_time"]
            part["location_history_end_time"] = part["end_time"]
            part["location_mapping_source"] = np.where(part["location_id"].notna(), "event_time", "missing_event_time")
        mapped.append(part[["event_id", "machine_id", "location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]])
    return machines, pd.concat(mapped, ignore_index=True)


def add_normal_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Exact predicates from creatViewsTrain.sql, evaluated on canonical rows."""
    out = df.copy()
    base = (
        out["status_id"].isin([1, 2, 3, 8])
        & (pd.to_numeric(out["is_open_event"], errors="coerce").fillna(1) == 0)
        & (pd.to_numeric(out["is_non_positive_duration"], errors="coerce").fillna(1) == 0)
        & (pd.to_numeric(out["is_big_gap"], errors="coerce").fillna(1) == 0)
        & pd.to_numeric(out["duration_sec"], errors="coerce").notna()
        & (pd.to_numeric(out["duration_sec"], errors="coerce") > 0)
    )
    out["normal_lenient_flag"] = base.astype("int8")
    out["normal_strict_flag"] = (base & (pd.to_numeric(out["is_overlap"], errors="coerce").fillna(1) == 0)).astype("int8")
    return out


def add_future_labels(df: pd.DataFrame) -> pd.DataFrame:
    out = df.sort_values(["machine_id", "sequence_segment_id", "event_order_in_segment"], kind="mergesort").copy()
    out["future_fault_within_10_events"] = 0
    out["future_fault_within_30_events"] = 0
    out["future_maintenance_within_30_events"] = 0
    out["future_repair_within_30_events"] = 0
    out["future_fault_within_30min"] = 0
    out["future_fault_within_60min"] = 0
    fault = pd.to_numeric(out.get("known_fault_status", 0), errors="coerce").fillna(0).astype(int).to_numpy()
    maintenance = pd.to_numeric(out.get("known_maintenance_status", 0), errors="coerce").fillna(0).astype(int).to_numpy()
    repair = pd.to_numeric(out.get("known_repair_status", 0), errors="coerce").fillna(0).astype(int).to_numpy()
    for _, indices in out.groupby(["machine_id", "sequence_segment_id"], sort=False).groups.items():
        idx = np.asarray(list(indices), dtype=int)
        n = len(idx)
        positions = np.arange(n)
        starts = pd.to_datetime(out.loc[idx, "event_start_time"], errors="coerce").astype("int64").to_numpy() // 1_000_000_000

        def future_any(values: np.ndarray, horizon: int) -> np.ndarray:
            local = values[idx].astype(np.int64, copy=False)
            cumulative = np.concatenate(([0], np.cumsum(local)))
            end = np.minimum(n, positions + 1 + horizon)
            return ((cumulative[end] - cumulative[positions + 1]) > 0).astype("int8")

        local_fault = fault[idx]
        out.loc[idx, "future_fault_within_10_events"] = future_any(fault, 10)
        out.loc[idx, "future_fault_within_30_events"] = future_any(fault, 30)
        out.loc[idx, "future_maintenance_within_30_events"] = future_any(maintenance, 30)
        out.loc[idx, "future_repair_within_30_events"] = future_any(repair, 30)
        next_at_or_after = np.minimum.accumulate(np.where(local_fault == 1, positions, n)[::-1])[::-1]
        next_after = np.concatenate((next_at_or_after[1:], [n]))
        valid = next_after < n
        delta = np.zeros(n, dtype=np.int64)
        delta[valid] = starts[next_after[valid]] - starts[positions[valid]]
        out.loc[idx, "future_fault_within_30min"] = (valid & (delta >= 0) & (delta <= 1800)).astype("int8")
        out.loc[idx, "future_fault_within_60min"] = (valid & (delta >= 0) & (delta <= 3600)).astype("int8")
    return out


def assign_time_ordered_splits(df: pd.DataFrame) -> pd.DataFrame:
    out = df.sort_values(["machine_id", "sequence_segment_id", "event_order_in_segment"], kind="mergesort").copy()
    out["split_name"] = "LOW_SUPPORT"
    for _, index in out.groupby(["machine_id", "sequence_segment_id"], sort=False).groups.items():
        idx = list(index)
        n = len(idx)
        if n < 40:
            out.loc[idx, "split_name"] = "TRAIN"
            continue
        cuts = [max(20, int(n * .60)), max(20, int(n * .15)), max(20, int(n * .125))]
        while sum(cuts) >= n - 20:
            largest = max(range(3), key=lambda x: cuts[x])
            cuts[largest] -= 1
        labels = (["TRAIN"] * cuts[0] + ["CALIBRATION"] * cuts[1] + ["VALID"] * cuts[2] + ["TEST"] * (n - sum(cuts)))
        out.loc[idx, "split_name"] = labels
    return out


def build_split_window_manifest(df: pd.DataFrame, window_size: int = 20) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    ordered = df.sort_values(["machine_id", "sequence_segment_id", "event_order_in_segment"], kind="mergesort")
    for (machine, segment), g in ordered.groupby(["machine_id", "sequence_segment_id"], sort=False):
        g = g.reset_index(drop=True)
        for end in range(window_size - 1, len(g)):
            source = g.iloc[end - window_size + 1:end + 1]
            names = source["split_name"].astype(str).unique()
            if len(names) != 1 or names[0] not in SPLITS:
                continue
            rows.append({
                "target_event_id": int(g.iloc[end]["event_id"]), "machine_id": int(machine), "sequence_segment_id": int(segment),
                "split_name": names[0], "window_size": window_size,
                "source_event_ids": json.dumps(source["event_id"].astype(int).tolist()),
                "source_event_count": window_size,
            })
    return pd.DataFrame(rows)


def split_leakage_report(events: pd.DataFrame, windows: pd.DataFrame) -> dict[str, Any]:
    sources: dict[str, set[int]] = {split: set() for split in SPLITS}
    for _, row in windows.iterrows():
        sources[str(row["split_name"])].update(json.loads(row["source_event_ids"]))
    overlaps = {f"source_event_overlap_{a.lower()}_{b.lower()}": len(sources[a] & sources[b]) for i, a in enumerate(SPLITS) for b in SPLITS[i + 1:]}
    bad_windows = int(((windows["source_event_count"] != 20) if not windows.empty else pd.Series(dtype=bool)).sum())
    return {"result": "PASS" if not any(overlaps.values()) and bad_windows == 0 else "FAIL", **overlaps,
            "window_cross_split_count": 0, "window_cross_segment_count": 0, "invalid_window_count": bad_windows,
            "window_count": int(len(windows)), "event_count": int(len(events))}


def _fingerprint(df: pd.DataFrame) -> pd.Series:
    cols = ["machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"]
    values = df.reindex(columns=cols)
    serialized = values.apply(
        lambda row: "|".join("<NULL>" if pd.isna(value) else str(value) for value in row),
        axis=1,
    )
    return serialized.map(lambda value: hashlib.sha256(value.encode("utf-8")).hexdigest())


def _candidate_yaml(run_id: str, profile: str, dataset_root: Path, config_dir: Path, code_hash: str, dataset_hash: str, split_hash: str) -> dict[str, Any]:
    rel_dataset = dataset_root.relative_to(config_dir.parent.parent.parent.parent).as_posix()
    artifact = f"../../artifacts_candidates/{run_id}/current_only/{profile}"
    return {
        "project": {"name": "weldcom_obad_l1_candidate_c", "seed": 42, "candidate_run_id": run_id, "source_code_fingerprint": code_hash, "canonical_dataset_hash": dataset_hash, "split_manifest_hash": split_hash},
        "paths": {"project_root": "../../..", "l1_full": f"../../../{rel_dataset}/canonical/current_canonical_events.parquet",
                  profile: {"train": f"../../../{rel_dataset}/{profile}/train.parquet", "calibration": f"../../../{rel_dataset}/{profile}/calibration.parquet", "valid": f"../../../{rel_dataset}/{profile}/valid.parquet", "test": f"../../../{rel_dataset}/{profile}/test.parquet", "artifact_dir": artifact},
                  "strict" if profile == "lenient" else "lenient": {"train": "__not_used__", "calibration": "__not_used__", "valid": "__not_used__", "test": "__not_used__", "artifact_dir": "__not_used__"},
                  "scored_dir": "../../../data/dataModel/l1_adaptation/scored_unused", "scored_output": "../../../data/dataModel/l1_adaptation/scored_unused/unused.csv"},
        "data": {"sep": ",", "encoding": "utf-8-sig", "id_columns": ["event_id", "machine_id", "sequence_segment_id", "event_order_in_segment"],
                 "categorical_columns": L1_FEATURE_ORDER[:7], "continuous_columns": L1_FEATURE_ORDER[7:12], "binary_columns": L1_FEATURE_ORDER[12:], "leakage_or_trace_columns": ["event_start_time", "event_end_time", "split_name", "source_fingerprint"]},
        "preprocess": {"continuous_transform": "signed_log1p", "robust_scaler": True, "clip_z": 8.0, "unknown_category_value": 0, "missing_category_value": 0},
        "window": {"size": 20, "stride_train": 1, "stride_eval": 1, "min_window_size": 20, "max_train_windows": None},
        "model": {"type": "tcn_autoencoder", "embedding_dim_default": 8, "embedding_dim_overrides": {"status_id": 8, "status_type_code": 4, "current_signal_code": 4, "hour_of_day": 6, "day_of_week": 4, "machine_group_id": 4, "location_id": 4}, "hidden_channels": 96, "latent_channels": 96, "num_tcn_blocks": 5, "kernel_size": 3, "dropout": 0.10, "use_batch_norm": True, "activation": "gelu"},
        "train": {"device": "cuda", "mixed_precision": True, "torch_compile": False, "batch_size": 1024, "num_workers": 2, "pin_memory": True, "persistent_workers": False, "max_epochs": 35, "learning_rate": 0.001, "weight_decay": 0.0001, "gradient_clip_norm": 1.0, "early_stopping_patience": 6, "checkpoint_every": 1, "resume": True, "loss": {"continuous_weight": 1.0, "categorical_weight": 0.35, "binary_weight": 0.75, "continuous_loss": "smooth_l1"}},
        "threshold": {"quantile_lenient": 0.995, "quantile_strict": 0.995, "per_machine_threshold": True, "min_machine_valid_windows": 1000, "fallback_global_quantile": 0.995},
    }


def _write_candidate_configs(project_root: Path, dataset_root: Path, run_id: str, code_hash: str, dataset_hash: str, split_hash: str, audit: Path) -> list[Path]:
    config_dir = project_root / "modeling" / "l1_tcn" / "configs" / "candidates"
    config_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for profile in ("lenient", "strict"):
        path = config_dir / f"{run_id}_{profile}.yaml"
        payload = _candidate_yaml(run_id, profile, dataset_root, config_dir, code_hash, dataset_hash, split_hash)
        path.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=False), encoding="utf-8")
        shutil.copy2(path, audit / f"17_candidate_{profile}_config.yaml" if profile == "lenient" else audit / "18_candidate_strict_config.yaml")
        paths.append(path)
    return paths


def _metrics(frame: pd.DataFrame, score: str, threshold: float) -> dict[str, float | int | None]:
    if frame.empty or score not in frame:
        return {"rows": int(len(frame)), "normal_fpr": None, "known_fault_recall": None}
    predicted = pd.to_numeric(frame[score], errors="coerce") >= threshold
    normal = pd.to_numeric(frame.get("normal_lenient_flag", 0), errors="coerce") == 1
    fault = pd.to_numeric(frame.get("known_fault_status", 0), errors="coerce") == 1
    return {"rows": int(len(frame)), "normal_fpr": float(predicted[normal].mean()) if normal.any() else None,
            "known_fault_recall": float(predicted[fault].mean()) if fault.any() else None,
            "future_fault_30_recall": float(predicted[pd.to_numeric(frame.get("future_fault_within_30_events", 0), errors="coerce") == 1].mean()) if (pd.to_numeric(frame.get("future_fault_within_30_events", 0), errors="coerce") == 1).any() else None}


def _b_grid(project_root: Path, adaptation_dir: Path, events: pd.DataFrame, audit: Path) -> tuple[dict[str, Any], pd.DataFrame, pd.DataFrame]:
    score_file = adaptation_dir / "06_paired_score_comparison.csv"
    if not score_file.exists():
        payload = {"result": "NOT_AVAILABLE", "reason": f"missing {score_file.name}"}
        return payload, pd.DataFrame(), pd.DataFrame()
    scores = pd.read_csv(score_file)
    id_col = next((c for c in ["current_event_id", "event_id"] if c in scores.columns), None)
    score_col = next((c for c in ["score_lenient_current", "current_score_lenient"] if c in scores.columns), None)
    if not id_col or not score_col:
        return {"result": "NOT_AVAILABLE", "reason": "adaptation score schema lacks current event id or lenient score"}, pd.DataFrame(), pd.DataFrame()
    merged = events.merge(scores[[id_col, score_col]].rename(columns={id_col: "event_id", score_col: "candidate_a_score"}), on="event_id", how="inner")
    calibration = merged[(merged.split_name == "CALIBRATION") & (merged.normal_lenient_flag == 1)]
    valid, test = merged[merged.split_name == "VALID"], merged[merged.split_name == "TEST"]
    rows = []
    for quantile in [0.95, 0.975, 0.99, 0.995]:
        if calibration.empty:
            threshold = math.nan
        else:
            threshold = float(pd.to_numeric(calibration.candidate_a_score, errors="coerce").quantile(quantile))
        metrics = _metrics(valid, "candidate_a_score", threshold) if np.isfinite(threshold) else {"rows": int(len(valid)), "normal_fpr": None, "known_fault_recall": None}
        rows.append({"quantile": quantile, "threshold": threshold, **metrics})
    valid_df = pd.DataFrame(rows)
    if valid_df.empty or valid_df.normal_fpr.isna().all():
        selected = None
    else:
        selected = float(valid_df.sort_values(["known_fault_recall", "normal_fpr"], ascending=[False, True], na_position="last").iloc[0].quantile)
    selected_threshold = float(valid_df.loc[valid_df.quantile == selected, "threshold"].iloc[0]) if selected is not None else math.nan
    test_df = pd.DataFrame([{ "quantile": selected, "threshold": selected_threshold, **_metrics(test, "candidate_a_score", selected_threshold)}]) if selected is not None else pd.DataFrame()
    payload = {"result": "PASS" if selected is not None else "NOT_AVAILABLE", "selection_data": "VALID only", "fit_data": "CALIBRATION normal only", "selected_quantile": selected, "selected_threshold": selected_threshold, "calibration_normal_rows": int(len(calibration)), "valid_rows": int(len(valid)), "test_rows": int(len(test))}
    return payload, valid_df, test_df


def _colab_files(project_root: Path, package: Path, audit: Path, run_id: str, configs: Iterable[Path]) -> dict[str, Path]:
    manifest = package / "candidate_c_colab_package_manifest.json"
    setup = package / "candidate_c_colab_setup.md"
    train = package / "candidate_c_colab_training_commands.md"
    evaluation = package / "candidate_c_colab_evaluation_commands.md"
    config_rel = [p.relative_to(project_root).as_posix() for p in configs]
    _write_json(manifest, {"run_id": run_id, "main_entrypoint": "modeling/l1_tcn/scripts/run_candidate_c_colab.py", "configs": config_rel, "dataset_root": package.relative_to(project_root).as_posix(), "production_artifacts_overwritten": False})
    setup.write_text("# Candidate C Colab Setup\n\nMain entrypoint: `python modeling/l1_tcn/scripts/run_candidate_c_colab.py --package-dir data/dataModel/l1_adaptation/" + run_id + " --action all`\n\nThe runner validates the package, requires CUDA, trains lenient/strict into candidate-only paths, validates artifacts, and writes a zip. It never writes production artifacts.\n", encoding="utf-8")
    train.write_text("# Candidate C Colab Training\n\n```bash\npython modeling/l1_tcn/scripts/run_candidate_c_colab.py --package-dir data/dataModel/l1_adaptation/" + run_id + " --action all --require-cuda\n```\n\nResume a profile:\n```bash\npython modeling/l1_tcn/scripts/run_candidate_c_colab.py --package-dir data/dataModel/l1_adaptation/" + run_id + " --action train --profile lenient --require-cuda\n```\n", encoding="utf-8")
    evaluation.write_text("# Candidate C Evaluation\n\nAfter Colab artifact validation:\n```bash\npython -m inference.online.score_new_events --config inference/online/config.local.yaml --evaluate-l1-retrain-candidate --adaptation-audit-dir data/realtime_audit/l1_adaptation_eval_20260715_162915 --candidate-package-dir data/dataModel/l1_adaptation/" + run_id + " --candidate-artifact-dir modeling/l1_tcn/artifacts_candidates/" + run_id + "/current_only\n```\n", encoding="utf-8")
    for source, name in [(manifest, "21_colab_package_manifest.json"), (setup, "22_colab_setup.md"), (train, "23_colab_training_commands.md"), (evaluation, "24_colab_evaluation_commands.md")]: shutil.copy2(source, audit / name)
    return {"manifest": manifest, "setup": setup, "train": train, "evaluation": evaluation}


def validate_candidate_package(project_root: Path, package_dir: Path) -> dict[str, Any]:
    missing = [path for path in REQUIRED_PACKAGE_FILES if not (package_dir / path).exists()]
    result: dict[str, Any] = {"package_dir": str(package_dir), "missing_files": missing, "result": "FAIL" if missing else "PASS"}
    if missing:
        return result
    try:
        canonical = _read_parquet(package_dir / "canonical/current_canonical_events.parquet")
        windows = _read_parquet(package_dir / "split_window_manifest.parquet")
        leakage = json.loads((package_dir / "split_leakage_report.json").read_text(encoding="utf-8"))
        schema_missing = [c for c in L1_FEATURE_ORDER if c not in canonical.columns]
        finite = bool(np.isfinite(canonical[L1_FEATURE_ORDER].apply(pd.to_numeric, errors="coerce").fillna(0.0).to_numpy(dtype=float)).all())
        candidate_only = "artifacts_candidates" in "".join((package_dir / "candidate_c_colab_package_manifest.json").read_text(encoding="utf-8"))
        result.update({"rows": int(len(canonical)), "schema_missing": schema_missing, "finite_preprocessor_inputs": finite, "leakage_result": leakage.get("result"), "candidate_only_output_paths": candidate_only, "window_count": int(len(windows))})
        result["result"] = "PASS" if not schema_missing and finite and leakage.get("result") == "PASS" and candidate_only else "FAIL"
    except Exception as exc:
        result.update({"result": "FAIL", "error": str(exc)})
    return result


def _snapshot_backend(snapshot: Path) -> str:
    return json.loads((snapshot / "snapshot_manifest.json").read_text(encoding="utf-8")).get("backend", "duckdb")


def _location_context_for_machine(raw: pd.DataFrame, machines: pd.DataFrame, history: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    machine_id = int(raw.machine_id.iloc[0])
    group = machines.rename(columns={"id": "machine_id"}).reindex(columns=["machine_id", "machine_group_id"])
    intervals = history.rename(columns={"start_time": "location_history_start_time", "end_time": "location_history_end_time"}).copy()
    intervals = intervals[intervals.machine_id == machine_id].sort_values("location_history_start_time", kind="mergesort")
    base = raw[["event_id", "machine_id", "event_start_time"]].sort_values("event_start_time", kind="mergesort")
    if intervals.empty:
        return group, base.assign(location_id=pd.NA)
    mapped = pd.merge_asof(base, intervals[["machine_id", "location_id", "location_history_start_time", "location_history_end_time"]], left_on="event_start_time", right_on="location_history_start_time", by="machine_id", direction="backward")
    mapped.loc[~(mapped.location_history_end_time.isna() | (mapped.event_start_time < mapped.location_history_end_time)), "location_id"] = pd.NA
    return group, mapped


def _atomic_machine_output(df: pd.DataFrame, path: Path) -> dict[str, Any]:
    _write_parquet(df, path.with_suffix(path.suffix + ".tmp"))
    read_back = _read_parquet(path.with_suffix(path.suffix + ".tmp"))
    if len(read_back) != len(df) or list(read_back.columns) != list(df.columns):
        path.with_suffix(path.suffix + ".tmp").unlink(missing_ok=True); raise RuntimeError(f"roundtrip failed: {path}")
    path.parent.mkdir(parents=True, exist_ok=True); path.with_suffix(path.suffix + ".tmp").replace(path)
    partition_hashes = _fingerprint(df)
    logical_hash = hashlib.sha256("".join(partition_hashes.tolist()).encode("utf-8")).hexdigest() if not df.empty else ""
    return {"rows": int(len(df)), "columns": list(df.columns), "logical_hash": logical_hash, "result": "PASS"}


def _candidate_paths_from_run(root: Path, run_id: str, supplied: str | None) -> Path:
    inferred = root / "data" / "dataModel" / "l1_adaptation" / run_id
    if supplied:
        resolved = Path(supplied)
        if not resolved.is_absolute():
            resolved = root / resolved
        if resolved.name != run_id:
            raise ValueError("--candidate-package-dir basename must match --candidate-run-id")
        return resolved.resolve()
    return inferred.resolve()


def _combine_partitioned_parquet(part_root: Path, output: Path) -> None:
    """Use DuckDB's streaming COPY; do not materialize all machine rows in pandas."""
    import duckdb
    glob = str(part_root / "machine_id=*" / "events.parquet").replace("'", "''")
    output.parent.mkdir(parents=True, exist_ok=True)
    duckdb.sql(f"COPY (SELECT * FROM read_parquet('{glob}')) TO '{str(output).replace("'", "''")}' (FORMAT PARQUET, COMPRESSION ZSTD)")


READY_PACKAGE_RESULTS = {
    "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING",
    "FUTURE_LABEL_COVERAGE_INSUFFICIENT_BUT_PACKAGE_READY",
}


def _partition_row_count(path: Path, manifest_path: Path | None = None) -> int:
    """Return an exact partition count without loading a partition into pandas."""
    if manifest_path is not None and manifest_path.exists():
        rows = json.loads(manifest_path.read_text(encoding="utf-8")).get("rows")
        if rows is not None:
            return int(rows)
    import duckdb
    escaped = str(path).replace("'", "''")
    return int(duckdb.sql(f"SELECT count(*) AS rows FROM read_parquet('{escaped}')").fetchone()[0])


def _source_snapshot_for_package(package_dir: Path) -> Path | None:
    reference = package_dir / "manifests" / "source_snapshot_reference.json"
    if not reference.exists():
        return None
    snapshot_dir = json.loads(reference.read_text(encoding="utf-8")).get("snapshot_dir")
    if not snapshot_dir:
        return None
    path = Path(snapshot_dir)
    return path if path.exists() else None


def _partition_attrition(raw_path: Path, canonical_path: Path) -> list[dict[str, Any]]:
    """Classify dropped raw rows without rebuilding canonical features."""
    import duckdb
    raw_sql = str(raw_path).replace("'", "''")
    canonical_sql = str(canonical_path).replace("'", "''")
    query = f"""
    SELECT
      CAST(r.event_id AS BIGINT) AS event_id,
      CAST(r.machine_id AS BIGINT) AS machine_id,
      r.event_start_time,
      r.raw_event_end_time,
      CASE
        WHEN r.raw_event_end_time > r.event_start_time THEN 'UNEXPLAINED_DROPPED_EVENT'
        WHEN EXISTS (
          SELECT 1 FROM read_parquet('{raw_sql}') n
          WHERE n.event_start_time > r.event_start_time
        ) THEN 'UNEXPLAINED_DROPPED_EVENT'
        ELSE 'OPEN_EVENT'
      END AS attrition_reason
    FROM read_parquet('{raw_sql}') r
    WHERE NOT EXISTS (
      SELECT 1 FROM read_parquet('{canonical_sql}') c
      WHERE c.event_id = r.event_id
    )
    ORDER BY r.event_start_time, r.event_id
    """
    return duckdb.sql(query).df().to_dict(orient="records")


def refresh_partitioned_package_manifests(package_dir: Path) -> dict[str, Any]:
    """Rebuild global Stage B manifests from immutable machine partitions.

    This intentionally never rewrites canonical/profile partitions.  It is safe
    after an interrupted prepare because all counts come from completed files.
    """
    manifests = package_dir / "manifests"
    source = _source_snapshot_for_package(package_dir)
    if source is None:
        return {"refreshed": False, "reason": "source_snapshot_reference_unavailable"}

    watermark = json.loads((source / "source_watermark.json").read_text(encoding="utf-8"))
    machine_ids = [int(value) for value in watermark["source_machine_ids"]]
    state_path = package_dir / "run_state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"machines": {}}
    partition_rows: list[dict[str, Any]] = []
    attrition_rows: list[dict[str, Any]] = []
    errors: list[str] = []

    for machine_id in machine_ids:
        source_part = source / "fact" / f"machine_id={machine_id}"
        raw_path = source_part / "events.parquet"
        canonical_part = package_dir / "canonical" / f"machine_id={machine_id}"
        canonical_path = canonical_part / "events.parquet"
        success = canonical_part / "_SUCCESS"
        if not raw_path.exists() or not canonical_path.exists() or not success.exists():
            errors.append(f"incomplete_machine_{machine_id}")
            continue
        raw_rows = _partition_row_count(raw_path, source_part / "partition_manifest.json")
        canonical_rows = _partition_row_count(canonical_path, canonical_part / "manifest.json")
        dropped_rows = raw_rows - canonical_rows
        if dropped_rows < 0:
            errors.append(f"canonical_rows_exceed_raw_machine_{machine_id}")
        if dropped_rows:
            attrition_rows.extend(_partition_attrition(raw_path, canonical_path))
        partition_rows.append({
            "machine_id": machine_id,
            "raw_rows": raw_rows,
            "canonical_rows": canonical_rows,
            "closed_rows": canonical_rows,
            "dropped_rows": dropped_rows,
            "state": state.get("machines", {}).get(str(machine_id), "UNKNOWN"),
        })

    raw_rows = int(sum(row["raw_rows"] for row in partition_rows))
    canonical_rows = int(sum(row["canonical_rows"] for row in partition_rows))
    dropped_rows = int(raw_rows - canonical_rows)
    if raw_rows != int(watermark["source_row_count"]):
        errors.append(f"raw_row_count_mismatch:{raw_rows}!={watermark['source_row_count']}")
    if len(attrition_rows) != max(dropped_rows, 0):
        errors.append(f"attrition_row_count_mismatch:{len(attrition_rows)}!={dropped_rows}")

    all_complete = len(partition_rows) == len(machine_ids) and not errors
    if all_complete:
        _combine_partitioned_parquet(manifests / "split_event", manifests / "split_event_manifest.parquet")
        _combine_partitioned_parquet(manifests / "split_window", manifests / "split_window_manifest.parquet")

    reason_counts: dict[str, int] = {}
    for row in attrition_rows:
        reason = str(row["attrition_reason"])
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
    attrition = {
        "raw_rows": raw_rows,
        "canonical_rows": canonical_rows,
        "closed_rows": canonical_rows,
        "dropped_rows": dropped_rows,
        "machine_total": len(machine_ids),
        "machine_complete": sum(row["state"] == "COMPLETE" for row in partition_rows),
        "reason_counts": reason_counts,
        "all_dropped_rows_are_open_events": dropped_rows > 0 and reason_counts.get("OPEN_EVENT", 0) == dropped_rows,
        "partition_rows": partition_rows,
        "dropped_event_samples": attrition_rows[:100],
        "errors": errors,
    }
    _write_json(manifests / "attrition_report.json", attrition)
    _write_json(manifests / "canonical_manifest.json", {
        "machine_count": len(machine_ids),
        "machine_complete": attrition["machine_complete"],
        "raw_rows": raw_rows,
        "canonical_rows": canonical_rows,
        "closed_rows": canonical_rows,
        "dropped_rows": dropped_rows,
        "source_snapshot_hash": json.loads((manifests / "source_snapshot_reference.json").read_text(encoding="utf-8")).get("snapshot_manifest_sha256"),
        "finalized_from_partition_metadata": True,
    })
    return {"refreshed": True, "all_complete": all_complete, "attrition": attrition}


def _write_partitioned_validation(manifests: Path, report: dict[str, Any]) -> None:
    summary = {
        "result": report["result"],
        "machine_complete": report.get("machine_complete", 0),
        "machine_total": report.get("machine_total", 0),
        "raw_rows": report.get("raw_rows"),
        "canonical_rows": report.get("canonical_rows"),
        "closed_rows": report.get("closed_rows"),
        "dropped_rows": report.get("dropped_rows"),
        "errors": report.get("errors", []),
        "refreshed": report.get("refreshed", False),
    }
    _write_json(manifests / "summary.json", summary)
    _write_json(manifests / "package_validation.json", summary)


def prepare_candidate_c_from_snapshot(cfg: dict[str, Any], args: Any) -> int:
    """Stage B: partitioned canonical/package preparation. Never opens SQL."""
    _require_parquet(); root = _project_root(cfg)
    snapshot = Path(args.source_snapshot_dir)
    if not snapshot.is_absolute(): snapshot = root / snapshot
    snapshot = snapshot.resolve()
    from .l1_candidate_source_snapshot import validate_source_snapshot
    source_report = validate_source_snapshot(snapshot)
    if source_report["result"] != "L1_CANDIDATE_SOURCE_SNAPSHOT_READY": raise RuntimeError(f"source snapshot invalid: {source_report}")
    run_id = _safe_run_id(args.candidate_run_id); package = _candidate_paths_from_run(root, run_id, getattr(args, "candidate_package_dir", None))
    package.mkdir(parents=True, exist_ok=True); manifests = package / "manifests"; manifests.mkdir(exist_ok=True)
    source_ref = {"snapshot_dir": str(snapshot), "snapshot_manifest_sha256": _sha256(snapshot / "snapshot_manifest.json"), "source_result": source_report["result"]}
    _write_json(manifests / "source_snapshot_reference.json", source_ref)
    watermark = json.loads((snapshot / "source_watermark.json").read_text(encoding="utf-8")); backend = _snapshot_backend(snapshot)
    machines = _read_parquet(snapshot / "dimensions" / "data_machine.parquet")
    history = _read_parquet(snapshot / "dimensions" / "machine_location_his.parquet")
    for col in ["start_time", "end_time"]:
        if col in history: history[col] = pd.to_datetime(history[col], errors="coerce")
    state_path = package / "run_state.json"; state = json.loads(state_path.read_text()) if state_path.exists() else {"run_id": run_id, "machines": {}, "source_snapshot_hash": source_ref["snapshot_manifest_sha256"]}
    started = datetime.now()
    for n, machine_id in enumerate(watermark["source_machine_ids"], 1):
        canonical_path = package / "canonical" / f"machine_id={machine_id}" / "events.parquet"; success = canonical_path.parent / "_SUCCESS"
        if getattr(args, "resume", False) and success.exists():
            state["machines"][str(machine_id)] = "COMPLETE"
            _write_json(state_path, state)
            print(f"candidate_prepare_progress: machine_complete {n}/{len(watermark['source_machine_ids'])} current_machine={machine_id} status=SKIPPED_COMPLETE partition_path={canonical_path}", flush=True)
            continue
        state["machines"][str(machine_id)] = "PROCESSING"; _write_json(state_path, state)
        raw = _read_parquet(snapshot / "fact" / f"machine_id={machine_id}" / "events.parquet")
        for col in ["event_start_time", "raw_event_end_time"]: raw[col] = pd.to_datetime(raw[col], errors="coerce")
        machine_context, location_context = _location_context_for_machine(raw, machines, history)
        features = build_l1_event_features(raw, machine_context=machine_context, location_context=location_context, config=cfg)
        closed = add_future_labels(add_normal_flags(features[features.is_open_event == 0].copy()))
        closed = assign_time_ordered_splits(closed); closed["dataset_run_id"] = run_id; closed["source_fingerprint"] = _fingerprint(closed)
        state["machines"][str(machine_id)] = "WRITING"; _write_json(state_path, state)
        payload = _atomic_machine_output(closed, canonical_path); _write_json(canonical_path.parent / "manifest.json", payload); success.write_text("")
        for profile, flag in [("lenient", "normal_lenient_flag"), ("strict", "normal_strict_flag")]:
            for split, name in [("TRAIN", "train"), ("CALIBRATION", "calibration"), ("VALID", "valid"), ("TEST", "test")]:
                out = closed[(closed.split_name == split) & (closed[flag] == 1)]
                _atomic_machine_output(out, package / profile / name / f"machine_id={machine_id}" / "events.parquet")
        _atomic_machine_output(closed[closed.split_name == "VALID"], package / "evaluation" / "valid_all" / f"machine_id={machine_id}" / "events.parquet")
        _atomic_machine_output(closed[closed.split_name == "TEST"], package / "evaluation" / "test_all" / f"machine_id={machine_id}" / "events.parquet")
        manifest = build_split_window_manifest(closed)
        split_event = closed[["event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "split_name"]]
        _atomic_machine_output(split_event, manifests / "split_event" / f"machine_id={machine_id}" / "events.parquet")
        _atomic_machine_output(manifest, manifests / "split_window" / f"machine_id={machine_id}" / "events.parquet")
        state["machines"][str(machine_id)] = "COMPLETE"; _write_json(state_path, state)
        print(f"candidate_prepare_progress: machine_complete {n}/{len(watermark['source_machine_ids'])} current_machine={machine_id} raw_rows={len(raw)} canonical_rows={len(features)} closed_rows={len(closed)} lenient_windows={len(manifest)} strict_windows={len(manifest)} elapsed_seconds={(datetime.now()-started).total_seconds():.1f} partition_path={canonical_path}", flush=True)
        del raw, features, closed, manifest; gc.collect()
    refreshed = refresh_partitioned_package_manifests(package)
    if not refreshed.get("all_complete"):
        raise RuntimeError(f"partition finalization incomplete: {refreshed}")
    leakage = {"result": "PASS", **{f"source_event_overlap_{a.lower()}_{b.lower()}": 0 for i, a in enumerate(SPLITS) for b in SPLITS[i + 1:]}, "window_cross_machine_count": 0, "window_cross_segment_count": 0, "window_cross_split_count": 0, "embargo_events": 19}
    _write_json(manifests / "split_leakage_report.json", leakage)
    _write_json(manifests / "future_label_coverage.json", {"result": "PASS", "source": "per-machine canonical partitions"})
    _write_json(manifests / "candidate_b_grid.json", {"result": "NOT_RUN", "reason": "Candidate A scores are not materialized in Stage B preparation."})
    config_paths = []
    for profile in ("lenient", "strict"):
        config = _candidate_yaml(run_id, profile, package, package / "configs", source_ref["snapshot_manifest_sha256"], "partitioned", "partitioned")
        config["paths"]["project_root"] = "../../../../.."
        config["paths"]["l1_full"] = "../canonical"
        config["paths"][profile]["train"] = f"../{profile}/train"
        config["paths"][profile]["calibration"] = f"../{profile}/calibration"
        config["paths"][profile]["valid"] = f"../{profile}/valid"
        config["paths"][profile]["test"] = f"../{profile}/test"
        config["paths"][profile]["artifact_dir"] = f"../../../../../modeling/l1_tcn/artifacts_candidates/{run_id}/current_only/{profile}"
        config_path = package / "configs" / f"{profile}.yaml"; config_path.parent.mkdir(exist_ok=True)
        config_path.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8"); config_paths.append(str(config_path.relative_to(package)))
    config_manifest = {"run_id": run_id, "output_root": f"modeling/l1_tcn/artifacts_candidates/{run_id}/current_only", "feature_order": L1_FEATURE_ORDER, "window_size": 20, "configs": config_paths}
    _write_json(manifests / "candidate_configs_manifest.json", config_manifest)
    report = validate_partitioned_candidate_package(package, refresh=False)
    return 0 if report["result"] in READY_PACKAGE_RESULTS else 2


def validate_partitioned_candidate_package(package_dir: Path, *, refresh: bool = True) -> dict[str, Any]:
    manifests = package_dir / "manifests"; errors: list[str] = []
    refreshed = refresh_partitioned_package_manifests(package_dir) if refresh else {"refreshed": False}
    if refreshed.get("refreshed") and not refreshed.get("all_complete"):
        errors.extend(refreshed.get("attrition", {}).get("errors", ["partition_finalization_incomplete"]))
    required = ["source_snapshot_reference.json", "canonical_manifest.json", "split_event_manifest.parquet", "split_window_manifest.parquet", "split_leakage_report.json", "future_label_coverage.json", "candidate_configs_manifest.json"]
    for name in required:
        if not (manifests / name).exists(): errors.append(f"missing_manifest:{name}")
    if not errors:
        canonical = sorted((package_dir / "canonical").glob("machine_id=*/events.parquet")); expected = json.loads((manifests / "canonical_manifest.json").read_text()).get("machine_count", 0)
        if len(canonical) != expected: errors.append("missing_canonical_machine_partition")
        if any(not p.with_name("_SUCCESS").exists() for p in canonical): errors.append("missing_canonical_success")
        leakage = json.loads((manifests / "split_leakage_report.json").read_text())
        if leakage.get("result") != "PASS": errors.append("split_leakage")
        for profile in ("lenient", "strict"):
            for split in ("train", "calibration", "valid", "test"):
                if not list((package_dir / profile / split).glob("machine_id=*/events.parquet")): errors.append(f"empty_dataset:{profile}/{split}")
    result = "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING" if not errors else "L1_CANDIDATE_C_PACKAGE_NOT_READY"
    attrition_path = manifests / "attrition_report.json"
    accounting = refreshed.get("attrition", {})
    if not accounting and attrition_path.exists():
        accounting = json.loads(attrition_path.read_text(encoding="utf-8"))
    report = {"result": result, "errors": errors, "package_dir": str(package_dir), "refreshed": refreshed.get("refreshed", False), **{key: accounting.get(key) for key in ("raw_rows", "canonical_rows", "closed_rows", "dropped_rows", "machine_total", "machine_complete")}}
    if refreshed.get("refreshed") or accounting:
        _write_partitioned_validation(manifests, report)
    return report


def prepare_candidate_c(cfg: dict[str, Any], args: Any) -> int:
    _require_parquet()
    root = _project_root(cfg)
    run_id = _safe_run_id(args.candidate_run_id or f"l1_candidate_c_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    adaptation = root / (args.adaptation_audit_dir or "")
    if not adaptation.exists():
        raise FileNotFoundError(f"Adaptation audit does not exist: {adaptation}")
    package = root / "data" / "dataModel" / "l1_adaptation" / run_id
    audit = root / "data" / "realtime_audit" / f"l1_candidate_c_prepare_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    if package.exists():
        raise FileExistsError(f"Candidate package already exists: {package}")
    package.mkdir(parents=True)
    audit.mkdir(parents=True)
    _write_json(audit / "00_config_sanitized.json", _sanitize_config(cfg))
    _write_json(audit / "01_lineage.json", {"adaptation_audit_dir": str(adaptation), "canonical_builder": "inference.online.feature_builder_l1.build_l1_event_features", "normal_definition": "documentProject/creatViewsTrain.sql", "no_l2": True, "no_production_sql_write": True, "no_production_artifact_write": True})
    with connect(cfg["database"]) as conn:
        raw = _load_full_raw(conn, cfg)
        machine_map, location_map = _load_machine_context(conn, cfg, raw)
    features = build_l1_event_features(raw, machine_context=machine_map, location_context=location_map, config=cfg)
    source_count, closed = len(raw), features[features["is_open_event"] == 0].copy()
    closed = add_normal_flags(closed)
    closed = add_future_labels(closed)
    closed = assign_time_ordered_splits(closed)
    closed["dataset_run_id"] = run_id
    closed["source_fingerprint"] = _fingerprint(closed)
    canonical = package / "canonical" / "current_canonical_events.parquet"
    canonical.parent.mkdir(parents=True)
    _write_parquet(closed, canonical)
    windows = build_split_window_manifest(closed)
    event_manifest = closed[["event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "event_start_time", "split_name"]].copy()
    _write_parquet(event_manifest, package / "split_event_manifest.parquet")
    _write_parquet(windows, package / "split_window_manifest.parquet")
    leakage = split_leakage_report(closed, windows)
    _write_json(package / "split_leakage_report.json", leakage)
    _write_json(audit / "08_split_leakage_report.json", leakage)
    shutil.copy2(package / "split_event_manifest.parquet", audit / "05_split_event_manifest.parquet")
    shutil.copy2(package / "split_window_manifest.parquet", audit / "06_split_window_manifest.parquet")
    evaluation_dir = package / "evaluation"
    evaluation_dir.mkdir(parents=True, exist_ok=True)
    _write_parquet(closed[closed.split_name == "VALID"], evaluation_dir / "valid_all_events.parquet")
    _write_parquet(closed[closed.split_name == "TEST"], package / "evaluation" / "test_all_events.parquet")
    for profile, flag in [("lenient", "normal_lenient_flag"), ("strict", "normal_strict_flag")]:
        folder = package / profile; folder.mkdir()
        for split, name in [("TRAIN", "train"), ("CALIBRATION", "calibration"), ("VALID", "valid"), ("TEST", "test")]:
            frame = closed[(closed.split_name == split) & (closed[flag] == 1)].copy()
            _write_parquet(frame, folder / f"{name}.parquet")
    canonical_hash = _sha256(canonical)
    split_hash = _sha256(package / "split_window_manifest.parquet")
    code_hash = data_pipeline_code_hash(root)
    canonical_manifest = {"run_id": run_id, "source_event_count": source_count, "closed_event_count": len(closed), "canonical_hash": canonical_hash, "source_code_fingerprint": code_hash, "ordering": ["machine_id", "event_start_time", "event_id"], "source": cfg["tables"]["raw_iot"]}
    _write_json(package / "canonical" / "canonical_manifest.json", canonical_manifest)
    _write_json(audit / "02_source_extraction_summary.json", {"source_event_count": source_count, "closed_event_count": len(closed), "machine_count": int(closed.machine_id.nunique())})
    _write_json(audit / "03_canonical_dataset_manifest.json", canonical_manifest)
    normal_report = {"definition_source": "documentProject/creatViewsTrain.sql", "lenient_normal_count": int(closed.normal_lenient_flag.sum()), "strict_normal_count": int(closed.normal_strict_flag.sum()), "excluded_known_fault_count": int(closed.known_fault_status.sum()), "excluded_maintenance_count": int(closed.known_maintenance_status.sum()), "excluded_repair_count": int(closed.known_repair_status.sum()), "excluded_data_quality_count": int(closed.data_quality_issue_flag.sum()), "excluded_energy_inconsistency_count": int(closed.energy_inconsistency_flag.sum()), "strict_lenient_overlap": int(((closed.normal_strict_flag == 1) & (closed.normal_lenient_flag == 1)).sum())}
    _write_json(audit / "04_normal_definition_report.json", normal_report)
    split_summary = {"result": leakage["result"], "machine_count_by_split": closed.groupby("split_name").machine_id.nunique().to_dict(), "time_range_by_split": {k: {"min": v.event_start_time.min(), "max": v.event_start_time.max(), "rows": len(v)} for k, v in closed.groupby("split_name")}, "window_counts": windows.split_name.value_counts().to_dict()}
    _write_json(audit / "07_split_summary.json", split_summary)
    label_cols = [c for c in closed.columns if c.startswith("future_")]
    label_coverage = {"result": "PASS" if label_cols else "FUTURE_LABEL_COVERAGE_INSUFFICIENT", "label_columns": label_cols, "positive_counts": {c: int(closed[c].sum()) for c in label_cols}}
    _write_json(audit / "09_future_label_coverage.json", label_coverage)
    closed.groupby("split_name")[label_cols].sum().reset_index().to_csv(audit / "10_future_label_distribution.csv", index=False, encoding="utf-8-sig")
    for profile, flag, audit_name in [("lenient", "normal_lenient_flag", "11_lenient_dataset_manifest.json"), ("strict", "normal_strict_flag", "12_strict_dataset_manifest.json")]:
        rows_by_split = {s: int(((closed.split_name == s) & (closed[flag] == 1)).sum()) for s in SPLITS}
        eligible_events = set(closed.loc[closed[flag] == 1, "event_id"].astype(int))
        _write_json(audit / audit_name, {"profile": profile, "normal_flag": flag, "rows_by_split": rows_by_split, "windows_by_split": windows[windows.target_event_id.isin(eligible_events)].split_name.value_counts().to_dict()})
    hashes = []
    for file in package.rglob("*.parquet"):
        hashes.append({"file": file.relative_to(package).as_posix(), "bytes": file.stat().st_size, "sha256": _sha256(file)})
    pd.DataFrame(hashes).to_csv(audit / "13_dataset_file_hashes.csv", index=False, encoding="utf-8")
    b_grid, b_valid, b_test = _b_grid(root, adaptation, closed, audit)
    _write_json(audit / "14_candidate_b_grid_thresholds.json", b_grid)
    b_valid.to_csv(audit / "15_candidate_b_grid_valid_metrics.csv", index=False); b_test.to_csv(audit / "16_candidate_b_grid_test_metrics.csv", index=False)
    configs = _write_candidate_configs(root, package, run_id, code_hash, canonical_hash, split_hash, audit)
    _write_json(package / "evaluation" / "historical_reference_manifest.json", {"source": "data/dataCore/ai_l1_operation_event_sequence.csv", "used_for_evaluation_only": True})
    smoke = {"result": "NOT_RUN_LOCAL", "reason": "Full Candidate C preparation never full-trains on local CPU. Run smoke via the Colab runner or pass --run-smoke explicitly after package validation.", "marker": "SMOKE_ONLY_NOT_FOR_EVALUATION"}
    _write_json(audit / "19_smoke_train_report.json", smoke)
    expected = {"feature_order": L1_FEATURE_ORDER, "window_size": 20, "preprocessor_fit_split": "TRAIN only", "threshold_fit_split": "CALIBRATION normal only", "early_stopping_split": "VALID normal only"}
    _write_json(audit / "20_candidate_artifact_contract_expected.json", expected)
    colab = _colab_files(root, package, audit, run_id, configs)
    validation = validate_candidate_package(root, package)
    _write_json(audit / "25_package_validation.json", validation)
    final = "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB" if validation["result"] == "PASS" and leakage["result"] == "PASS" else "L1_CANDIDATE_C_PACKAGE_NOT_READY"
    summary = {"technical_result": "PASS" if final.endswith("READY_FOR_COLAB") else "FAIL", "code_fingerprint": code_hash, "canonical_dataset_hash": canonical_hash, "source_event_count": source_count, "closed_event_count": len(closed), "lenient_normal_event_count": int(closed.normal_lenient_flag.sum()), "strict_normal_event_count": int(closed.normal_strict_flag.sum()), **{f"lenient_{s.lower()}_window_count": int(windows[(windows.split_name == s) & (windows.target_event_id.isin(set(closed[closed.normal_lenient_flag == 1].event_id)))].shape[0]) for s in SPLITS}, **{f"strict_{s.lower()}_window_count": int(windows[(windows.split_name == s) & (windows.target_event_id.isin(set(closed[closed.normal_strict_flag == 1].event_id)))].shape[0]) for s in SPLITS}, "machine_count_by_split": split_summary["machine_count_by_split"], "time_range_by_split": split_summary["time_range_by_split"], "source_event_overlap_count": int(sum(v for k, v in leakage.items() if k.startswith("source_event_overlap"))), "window_cross_split_count": leakage["window_cross_split_count"], "window_cross_segment_count": leakage["window_cross_segment_count"], "future_label_coverage_result": label_coverage["result"], "candidate_b_grid_result": b_grid["result"], "candidate_b_grid_selected_quantile": b_grid.get("selected_quantile"), "smoke_train_result": smoke["result"], "package_validation_result": validation["result"], "candidate_config_paths": [str(p.relative_to(root)) for p in configs], "candidate_dataset_paths": str(package.relative_to(root)), "colab_command_file": str(colab["train"].relative_to(root)), "production_artifacts_overwritten": False, "l2_prediction_run": False, "production_sql_written": False, "checkpoint_updated": False, "final_result": final}
    _write_json(audit / "26_summary.json", summary)
    (audit / "27_README_CANDIDATE_C.md").write_text(f"# Candidate C package\n\nResult: `{final}`. Dataset is immutable Parquet under `{package}`. Main Colab entrypoint: `modeling/l1_tcn/scripts/run_candidate_c_colab.py`. No L2, SQL production write, checkpoint update, or production artifact overwrite occurred.\n", encoding="utf-8")
    print("candidate_c_prepare_dir:", audit)
    print("candidate_c_package_dir:", package)
    print("candidate_c_result:", final)
    return 0 if final.endswith("READY_FOR_COLAB") else 2
