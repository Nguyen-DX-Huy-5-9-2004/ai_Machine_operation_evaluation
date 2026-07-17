from __future__ import annotations

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd


RAW_COLUMNS = [
    "event_id",
    "machine_id",
    "status_id",
    "event_start_time",
    "raw_event_end_time",
    "raw_status_kwh_start",
    "raw_status_kwh_end",
    "raw_error_code",
]

PROCESSED_COLUMNS = [
    "event_id",
    "machine_id",
    "status_id",
    "event_start_time",
    "event_end_time",
    "end_time_source",
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "is_open_event",
    "is_raw_end_missing",
    "is_invalid_raw_end",
    "is_non_positive_duration",
    "is_big_gap",
    "is_overlap",
    "raw_status_kwh_start",
    "raw_status_kwh_end",
    "kwh_start_value",
    "kwh_end_value",
    "kwh_start_source",
    "kwh_end_source",
    "kwh_delta",
    "kwh_delta_model_value",
    "kwh_rate_per_hour",
    "kwh_missing_flag",
    "kwh_imputed_flag",
    "kwh_quality_issue_flag",
    "energy_inconsistency_flag",
    "status_type_code",
    "current_signal_code",
    "status_type_label",
    "current_signal_label",
    "is_on",
    "is_loaded",
    "is_no_load",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "off_with_fault_status",
    "time_quality_issue_flag",
    "data_quality_issue_flag",
    "data_quality_reason",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
]

COMPARE_COLUMNS = [
    "machine_id",
    "status_id",
    "event_start_time",
    "event_end_time",
    "end_time_source",
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "kwh_delta_model_value",
    "kwh_rate_per_hour",
    "is_open_event",
    "is_overlap",
    "is_big_gap",
    "time_quality_issue_flag",
    "kwh_quality_issue_flag",
    "energy_inconsistency_flag",
    "data_quality_issue_flag",
    "status_type_code",
    "current_signal_code",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "location_id",
    "hour_of_day",
    "day_of_week",
]


def create_audit_dir(output_root: str | Path) -> Path:
    root = Path(output_root)
    run_dir = root / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def sanitized_config(
    cfg: Mapping[str, Any],
    *,
    mode: str,
    max_events: int,
    l1_mode: str,
    l2_mode: str,
) -> dict[str, Any]:
    database = dict(cfg.get("database", {}))
    if "password" in database:
        database["password"] = "***REDACTED***"
    runtime = dict(cfg.get("runtime", {}))
    audit = dict(cfg.get("audit", {}))
    historical = dict(cfg.get("historical", {}))
    tables = dict(cfg.get("tables", {}))
    return {
        "pipeline_name": cfg.get("project", {}).get("pipeline_name"),
        "project_root": cfg.get("project", {}).get("root"),
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": mode,
        "max_events": max_events,
        "min_event_id_to_process": runtime.get("min_event_id_to_process"),
        "lookback_before": runtime.get("lookback_before"),
        "lookahead_after": runtime.get("lookahead_after"),
        "kwh_gap_limit_seconds": runtime.get("kwh_impute_gap_limit_seconds"),
        "big_gap_seconds": runtime.get("big_gap_seconds"),
        "long_duration_seconds": runtime.get("long_duration_seconds"),
        "source_table": tables.get("raw_iot"),
        "online_result_table": tables.get("online_l2_result"),
        "historical_l1_table": historical.get("l1_table") or audit.get("historical_l1_table"),
        "historical_l1_csv": historical.get("l1_csv") or audit.get("historical_l1_csv"),
        "l1_mode": l1_mode,
        "l2_mode": l2_mode,
        "database": database,
    }


def write_audit_files(
    run_dir: Path,
    *,
    cfg: Mapping[str, Any],
    mode: str,
    max_events: int,
    sql_used: Mapping[str, str],
    raw_candidates: pd.DataFrame,
    raw_context: pd.DataFrame,
    processed_features: pd.DataFrame,
    features_closed: pd.DataFrame,
    joined_canonical_events: pd.DataFrame | None = None,
    l2_runtime_features: pd.DataFrame | None = None,
    l1_contract_report: Mapping[str, Any] | None = None,
    l2_contract_report: Mapping[str, Any] | None = None,
    invariant_report: Mapping[str, Any] | None = None,
    historical_compare: pd.DataFrame,
    historical_compare_meta: Mapping[str, Any] | None = None,
    l1_mode: str,
    l2_mode: str,
    write_sql_enabled: bool,
    command: str,
    location_mapping_mode: str,
    l2_missing_features: Mapping[str, list[str]] | None = None,
) -> dict[str, Any]:
    _write_json(run_dir / "00_run_config_sanitized.json", sanitized_config(cfg, mode=mode, max_events=max_events, l1_mode=l1_mode, l2_mode=l2_mode))
    (run_dir / "01_sql_used.sql").write_text(_format_sql_used(sql_used), encoding="utf-8")
    _write_csv(run_dir / "02_raw_candidates.csv", raw_candidates, RAW_COLUMNS)
    _write_csv(run_dir / "03_raw_context.csv", raw_context, RAW_COLUMNS + ["context_role", "is_raw_candidate_event"])
    _write_csv(run_dir / "04_joined_canonical_events.csv", joined_canonical_events if joined_canonical_events is not None else raw_context, None)
    _write_csv(run_dir / "05_l1_event_features.csv", processed_features, None)
    _write_csv(run_dir / "06_l2_runtime_features_without_scores.csv", l2_runtime_features if l2_runtime_features is not None else pd.DataFrame(), None)
    _write_csv(run_dir / "07_raw_to_l1_side_by_side.csv", build_side_by_side(raw_candidates, processed_features), None)
    _write_json(run_dir / "08_l1_contract_report.json", l1_contract_report or {"result": "NOT_RUN"})
    _write_json(run_dir / "09_l2_contract_report.json", l2_contract_report or {"result": "NOT_RUN"})
    _write_json(run_dir / "10_invariant_report.json", invariant_report or {"result": "NOT_RUN"})
    summary = build_summary(
        cfg=cfg,
        mode=mode,
        audit_root=run_dir.parent,
        raw_candidates=raw_candidates,
        raw_context=raw_context,
        processed_features=processed_features,
        features_closed=features_closed,
        historical_compare=historical_compare,
        historical_compare_meta=historical_compare_meta or {},
        l1_mode=l1_mode,
        l2_mode=l2_mode,
        write_sql_enabled=write_sql_enabled,
        location_mapping_mode=location_mapping_mode,
        l2_missing_features=l2_missing_features or {},
        l1_contract_report=l1_contract_report or {},
        l2_contract_report=l2_contract_report or {},
        invariant_report=invariant_report or {},
    )
    registry = build_audit_registry(cfg, run_dir.parent)
    summary["audit_registry"] = registry
    _write_json(run_dir / "11_summary.json", summary)
    _write_json(run_dir / "13_audit_registry.json", registry)
    _write_json(run_dir.parent / "audit_registry.json", registry)
    (run_dir / "12_README_CHECK_THIS_RUN.md").write_text(
        build_readme(command, cfg, summary),
        encoding="utf-8",
    )
    return summary


def build_side_by_side(raw_candidates: pd.DataFrame, processed_features: pd.DataFrame) -> pd.DataFrame:
    raw = raw_candidates.reindex(columns=RAW_COLUMNS).rename(
        columns={
            "status_id": "raw_status_id",
            "event_start_time": "raw_status_time_start",
            "raw_event_end_time": "raw_status_time_end",
        }
    )
    processed = processed_features.rename(
        columns={
            "status_id": "processed_status_id",
            "event_start_time": "processed_event_start_time",
            "event_end_time": "processed_event_end_time",
            "end_time_source": "processed_end_time_source",
            "duration_sec": "processed_duration_sec",
            "kwh_start_value": "processed_kwh_start_value",
            "kwh_end_value": "processed_kwh_end_value",
            "kwh_start_source": "processed_kwh_start_source",
            "kwh_end_source": "processed_kwh_end_source",
            "kwh_delta": "processed_kwh_delta",
            "time_quality_issue_flag": "processed_time_quality_issue_flag",
            "kwh_quality_issue_flag": "processed_kwh_quality_issue_flag",
            "energy_inconsistency_flag": "processed_energy_inconsistency_flag",
            "data_quality_issue_flag": "processed_data_quality_issue_flag",
            "status_type_code": "processed_status_type_code",
            "current_signal_code": "processed_current_signal_code",
            "status_evidence_class": "processed_status_evidence_class",
        }
    )
    cols = [
        "event_id",
        "processed_status_id",
        "processed_event_start_time",
        "processed_event_end_time",
        "processed_end_time_source",
        "processed_duration_sec",
        "processed_kwh_start_value",
        "processed_kwh_end_value",
        "processed_kwh_start_source",
        "processed_kwh_end_source",
        "processed_kwh_delta",
        "processed_time_quality_issue_flag",
        "processed_kwh_quality_issue_flag",
        "processed_energy_inconsistency_flag",
        "processed_data_quality_issue_flag",
        "processed_status_type_code",
        "processed_current_signal_code",
        "processed_status_evidence_class",
    ]
    joined = raw.merge(processed.reindex(columns=cols), on="event_id", how="left")
    return joined[
        [
            "event_id",
            "machine_id",
            "raw_status_id",
            "processed_status_id",
            "raw_status_time_start",
            "processed_event_start_time",
            "raw_status_time_end",
            "processed_event_end_time",
            "processed_end_time_source",
            "processed_duration_sec",
            "raw_status_kwh_start",
            "raw_status_kwh_end",
            "processed_kwh_start_value",
            "processed_kwh_end_value",
            "processed_kwh_start_source",
            "processed_kwh_end_source",
            "processed_kwh_delta",
            "processed_time_quality_issue_flag",
            "processed_kwh_quality_issue_flag",
            "processed_energy_inconsistency_flag",
            "processed_data_quality_issue_flag",
            "processed_status_type_code",
            "processed_current_signal_code",
            "processed_status_evidence_class",
        ]
    ]


def compare_with_historical(runtime_features: pd.DataFrame, historical: pd.DataFrame | None) -> pd.DataFrame:
    if historical is None or historical.empty or runtime_features.empty:
        return pd.DataFrame(columns=["event_id", "col_name", "runtime_value", "historical_value", "is_match", "abs_diff", "reason"])
    cols = ["event_id"] + [c for c in COMPARE_COLUMNS if c in runtime_features.columns and c in historical.columns]
    if len(cols) == 1:
        return pd.DataFrame(columns=["event_id", "col_name", "runtime_value", "historical_value", "is_match", "abs_diff", "reason"])
    merged = runtime_features.reindex(columns=cols).merge(
        historical.reindex(columns=cols),
        on="event_id",
        how="inner",
        suffixes=("_runtime", "_historical"),
    )
    rows: list[dict[str, Any]] = []
    for _, row in merged.iterrows():
        event_id = row["event_id"]
        for col in cols[1:]:
            runtime_value = row[f"{col}_runtime"]
            historical_value = row[f"{col}_historical"]
            is_match, abs_diff, reason = _compare_values(runtime_value, historical_value)
            rows.append({
                "event_id": event_id,
                "col_name": col,
                "runtime_value": runtime_value,
                "historical_value": historical_value,
                "is_match": is_match,
                "abs_diff": abs_diff,
                "reason": reason,
            })
    return pd.DataFrame(rows)


def build_summary(
    *,
    cfg: Mapping[str, Any],
    mode: str,
    audit_root: Path,
    raw_candidates: pd.DataFrame,
    raw_context: pd.DataFrame,
    processed_features: pd.DataFrame,
    features_closed: pd.DataFrame,
    historical_compare: pd.DataFrame,
    historical_compare_meta: Mapping[str, Any],
    l1_mode: str,
    l2_mode: str,
    write_sql_enabled: bool,
    location_mapping_mode: str,
    l2_missing_features: Mapping[str, list[str]],
    l1_contract_report: Mapping[str, Any],
    l2_contract_report: Mapping[str, Any],
    invariant_report: Mapping[str, Any],
) -> dict[str, Any]:
    raw_candidate_rows = len(raw_candidates)
    processed_rows = len(processed_features)
    open_rows = int((processed_features.get("is_open_event", pd.Series(dtype=int)) == 1).sum()) if processed_rows else 0
    historical_available = not historical_compare.empty
    match_rate = None
    mismatch_top: dict[str, int] = {}
    if historical_available and "is_match" in historical_compare.columns:
        match_rate = float(pd.to_numeric(historical_compare["is_match"], errors="coerce").fillna(0).mean())
        mismatch_top = (
            historical_compare[historical_compare["is_match"] == False]["col_name"]  # noqa: E712
            .value_counts()
            .head(20)
            .astype(int)
            .to_dict()
        )

    technical_violations = []
    if raw_candidate_rows <= 0:
        technical_violations.append("raw_candidate_rows <= 0")
    if processed_rows <= 0:
        technical_violations.append("processed_rows <= 0")
    if int((features_closed.get("is_open_event", pd.Series(dtype=int)) == 1).sum()) > 0:
        technical_violations.append("OPEN_EVENT present in rows prepared to score")

    model_violations = []
    if _status_codes_are_strings(processed_features):
        model_violations.append("status_type_code/current_signal_code contains string values")
    if l2_missing_features:
        model_violations.append("missing_features_for_l2")
    if l1_contract_report.get("result") == "FAIL":
        model_violations.append("l1_data_contract_failed")
    if l2_contract_report.get("result") == "FAIL":
        model_violations.append("l2_data_contract_failed")
    if invariant_report.get("result") == "FAIL":
        technical_violations.append("runtime_invariant_failed")
    technical_result = "PASS" if not technical_violations else "FAIL"
    historical_match_threshold = 0.95
    registry = build_audit_registry(cfg, audit_root)
    offline_ready = registry.get("offline_replay_result") in {"L1_TRANSFORMATION_LOGIC_READY", "PASS"}
    if mode == "stage-only":
        model_readiness_result = "NOT_RUN_STAGE_ONLY"
    elif historical_available and match_rate is not None and match_rate < historical_match_threshold:
        model_readiness_result = "FAIL_HISTORICAL_COMPARE_MISMATCH"
        model_violations.append(f"historical_compare_match_rate < {historical_match_threshold}")
    elif model_violations:
        model_readiness_result = "FAIL_MODEL_READINESS_CHECKS"
    else:
        model_readiness_result = "PASS"

    data_contract_ok = (
        l1_contract_report.get("result", "NOT_RUN") in {"PASS", "NOT_RUN"}
        and l2_contract_report.get("result", "NOT_RUN") in {"PASS", "NOT_RUN"}
        and invariant_report.get("result", "NOT_RUN") in {"PASS", "NOT_RUN"}
    )
    data_pipeline_readiness_result = "PASS" if technical_result == "PASS" and data_contract_ok else "FAIL"
    offline_transformation_readiness_result = "PASS_FROM_AUDIT_REGISTRY" if offline_ready else "STALE_OR_MISSING_REVALIDATION_REQUIRED"
    l1_inference_readiness_result = "NOT_RUN_STAGE_ONLY" if mode == "stage-only" else ("DISABLED" if l1_mode.startswith("disabled") else "PENDING")
    l2_inference_readiness_result = "NOT_RUN_STAGE_ONLY" if mode == "stage-only" else ("NOT_RUN" if l2_mode == "not_run" else "PENDING")
    production_write_readiness_result = "DISABLED_STAGE_ONLY" if mode == "stage-only" else ("ENABLED" if write_sql_enabled else "DISABLED")
    live_sql_contract_result = technical_result
    if mode == "stage-only" and data_pipeline_readiness_result == "PASS" and live_sql_contract_result == "PASS":
        overall_mode_result = "STAGE_ONLY_DATA_PIPELINE_PASS"
    elif data_pipeline_readiness_result == "PASS":
        overall_mode_result = "DATA_PIPELINE_PASS_MODEL_NOT_RUN"
    else:
        overall_mode_result = "DATA_PIPELINE_FAIL"
    result = overall_mode_result

    return {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "raw_candidate_rows": raw_candidate_rows,
        "raw_context_rows": len(raw_context),
        "processed_rows": processed_rows,
        "closed_rows": len(features_closed),
        "open_rows": open_rows,
        "scored_rows_if_any": 0,
        "skipped_open_rows": max(0, raw_candidate_rows - len(features_closed)),
        "min_event_id": _safe_min(raw_candidates, "event_id"),
        "max_event_id": _safe_max(raw_candidates, "event_id"),
        "min_event_start_time": _safe_min(raw_candidates, "event_start_time"),
        "max_event_start_time": _safe_max(raw_candidates, "event_start_time"),
        "machines": sorted([int(v) for v in raw_candidates.get("machine_id", pd.Series(dtype=int)).dropna().unique().tolist()]),
        "end_time_source_distribution": _value_counts(processed_features, "end_time_source"),
        "status_distribution": _value_counts(processed_features, "status_id"),
        "data_quality_distribution": _value_counts(processed_features, "data_quality_issue_flag"),
        "kwh_quality_distribution": _value_counts(processed_features, "kwh_quality_issue_flag"),
        "energy_inconsistency_count": _numeric_sum(processed_features, "energy_inconsistency_flag") if processed_rows else 0,
        "historical_compare_available": historical_available,
        "historical_compare_source": historical_compare_meta.get("source"),
        "project_root_resolved": historical_compare_meta.get("project_root_resolved"),
        "historical_l1_csv_resolved": historical_compare_meta.get("historical_l1_csv_resolved"),
        "historical_compare_source_attempted": list(historical_compare_meta.get("source_attempted", [])),
        "historical_compare_error": historical_compare_meta.get("error"),
        "historical_compare_match_rate": match_rate,
        "historical_compare_mismatch_columns_top": mismatch_top,
        "historical_compare_match_threshold": historical_match_threshold,
        "l1_mode": l1_mode,
        "l2_mode": l2_mode,
        "location_mapping_mode": location_mapping_mode,
        "write_sql_enabled": write_sql_enabled,
        "missing_features_for_l2": dict(l2_missing_features),
        "technical_violations": technical_violations,
        "model_readiness_violations": model_violations,
        "violations": technical_violations + model_violations,
        "data_pipeline_readiness_result": data_pipeline_readiness_result,
        "offline_transformation_readiness_result": offline_transformation_readiness_result,
        "l1_inference_readiness_result": l1_inference_readiness_result,
        "l2_inference_readiness_result": l2_inference_readiness_result,
        "production_write_readiness_result": production_write_readiness_result,
        "overall_mode_result": overall_mode_result,
        "sql_extraction_result": "PASS" if raw_candidate_rows > 0 else "FAIL",
        "join_result": "PASS" if processed_rows > 0 else "FAIL",
        "time_processing_result": "PASS" if processed_rows > 0 and "OPEN_EVENT present in rows prepared to score" not in technical_violations else "FAIL",
        "kwh_processing_result": "PASS" if processed_rows > 0 else "FAIL",
        "status_mapping_result": "PASS" if processed_rows > 0 and not _status_codes_are_strings(processed_features) else "FAIL",
        "location_mapping_result": "PASS" if processed_rows > 0 and "location_id" in processed_features.columns else "FAIL",
        "segmentation_result": "PASS" if processed_rows > 0 and {"sequence_segment_id", "event_order_in_segment"}.issubset(processed_features.columns) else "FAIL",
        "l1_data_contract_result": l1_contract_report.get("result", "NOT_RUN"),
        "l2_data_contract_result": l2_contract_report.get("result", "NOT_RUN"),
        "offline_parity_result": "NOT_RUN_SOURCE_REKEYED_USE_OFFLINE_REPLAY_LATER",
        "live_sql_contract_result": live_sql_contract_result,
        "technical_result": technical_result,
        "model_readiness_result": model_readiness_result,
        "result": result,
    }


def build_audit_registry(cfg: Mapping[str, Any], audit_root: Path) -> dict[str, Any]:
    code_hash = data_pipeline_code_hash()
    thresholds = {
        "kwh_impute_gap_limit_seconds": cfg.get("runtime", {}).get("kwh_impute_gap_limit_seconds"),
        "small_gap_seconds": cfg.get("runtime", {}).get("small_gap_seconds"),
        "big_gap_seconds": cfg.get("runtime", {}).get("big_gap_seconds"),
        "long_duration_seconds": cfg.get("runtime", {}).get("long_duration_seconds"),
        "l1_window_size": cfg.get("runtime", {}).get("l1_window_size", 20) or 20,
        "l2_past_event_window": cfg.get("runtime", {}).get("l2_past_event_window"),
    }
    offline_dir, offline_summary = latest_summary(audit_root, "l1_offline_replay_*", "14_summary.json")
    live_dir, live_summary = latest_summary(audit_root, "live_sql_contract_*", "09_summary.json")
    unit_test = read_json_if_exists(audit_root / "unit_test_registry.json")
    return {
        "registry_time": datetime.now().isoformat(timespec="seconds"),
        "code_fingerprint": code_hash,
        "config_thresholds": thresholds,
        "feature_contract_version": "l1_30_features_from_preprocessor",
        "offline_replay_audit_dir": str(offline_dir) if offline_dir else None,
        "offline_replay_run_time": _run_time_from_dir(offline_dir),
        "offline_replay_result": offline_summary.get("final_result") or offline_summary.get("offline_transformation_result"),
        "offline_replay_code_fingerprint": offline_summary.get("code_fingerprint"),
        "offline_replay_staleness": staleness_status(offline_summary, code_hash, thresholds),
        "live_sql_contract_audit_dir": str(live_dir) if live_dir else None,
        "live_sql_contract_run_time": _run_time_from_dir(live_dir),
        "live_sql_contract_result": live_summary.get("live_sql_contract_result"),
        "live_sql_contract_code_fingerprint": live_summary.get("code_fingerprint"),
        "live_sql_contract_staleness": staleness_status(live_summary, code_hash, thresholds),
        "unit_test_result": unit_test.get("unit_test_result", "NOT_RECORDED_IN_REGISTRY"),
        "unit_test_time": unit_test.get("unit_test_time"),
    }


def data_pipeline_code_hash() -> str:
    root = Path(__file__).resolve().parent
    hasher = hashlib.sha256()
    for filename in ["feature_builder_l1.py", "data_contract.py", "sql_queries.py"]:
        path = root / filename
        if path.exists():
            hasher.update(filename.encode("utf-8"))
            hasher.update(path.read_bytes())
    return hasher.hexdigest()


def latest_summary(audit_root: Path, pattern: str, summary_name: str) -> tuple[Path | None, dict[str, Any]]:
    for directory in sorted(audit_root.glob(pattern), reverse=True):
        summary_path = directory / summary_name
        if summary_path.exists():
            return directory, read_json_if_exists(summary_path)
    return None, {}


def read_json_if_exists(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}


def staleness_status(summary: Mapping[str, Any], code_hash: str, thresholds: Mapping[str, Any]) -> str:
    if not summary:
        return "MISSING_AUDIT"
    summary_hash = summary.get("code_fingerprint")
    summary_thresholds = summary.get("config_thresholds")
    if summary_hash is None:
        return "UNKNOWN_LEGACY_AUDIT_NO_FINGERPRINT"
    if summary_hash != code_hash:
        return "STALE_REVALIDATION_REQUIRED_CODE_CHANGED"
    if summary_thresholds is not None and dict(summary_thresholds) != dict(thresholds):
        return "STALE_REVALIDATION_REQUIRED_THRESHOLDS_CHANGED"
    return "CURRENT"


def _run_time_from_dir(directory: Path | None) -> str | None:
    if directory is None:
        return None
    parts = directory.name.rsplit("_", 2)
    if len(parts) < 3:
        return None
    return f"{parts[-2]}_{parts[-1]}"


def build_readme(command: str, cfg: Mapping[str, Any], summary: Mapping[str, Any]) -> str:
    result = summary.get("result")
    technical_result = summary.get("technical_result")
    model_readiness_result = summary.get("model_readiness_result")
    return f"""# Realtime audit run

## Lệnh đã chạy

```bash
{command}
```

## Nguồn dữ liệu

- Bảng event: `{cfg.get("tables", {}).get("raw_iot")}`
- Bảng online result chống duplicate: `{cfg.get("tables", {}).get("online_l2_result")}`

## Kết quả nhanh

- Raw candidate rows: {summary.get("raw_candidate_rows")}
- Raw context rows: {summary.get("raw_context_rows")}
- Processed rows: {summary.get("processed_rows")}
- Closed rows chuẩn bị score: {summary.get("closed_rows")}
- Open/skipped rows: {summary.get("skipped_open_rows")}
- Historical compare available: {summary.get("historical_compare_available")}
- Historical compare source: {summary.get("historical_compare_source")}
- Historical compare error: {summary.get("historical_compare_error")}
- L1 mode: {summary.get("l1_mode")}
- L2 mode: {summary.get("l2_mode")}
- Write SQL enabled: {summary.get("write_sql_enabled")}
- Technical result: {technical_result}
- Model readiness result: {model_readiness_result}
- Result: {result}

## File cần mở kiểm tra

1. `02_raw_candidates.csv`
2. `03_raw_context.csv`
3. `04_joined_canonical_events.csv`
4. `05_l1_event_features.csv`
5. `06_l2_runtime_features_without_scores.csv`
6. `07_raw_to_l1_side_by_side.csv`
7. `08_l1_contract_report.json`
8. `09_l2_contract_report.json`
9. `10_invariant_report.json`
10. `11_summary.json`

## Cột cần kiểm tra trước

- `event_end_time`, `end_time_source`, `duration_sec`
- `kwh_start_source`, `kwh_end_source`, `kwh_delta`
- `time_quality_issue_flag`, `kwh_quality_issue_flag`, `energy_inconsistency_flag`
- `status_type_code`, `current_signal_code`, `status_evidence_class`
- `location_id`

## Kết luận

{"PASS sơ bộ cho stage-only audit." if result == "PASS" else "FAIL hoặc cần kiểm tra lại violations trong 07_summary.json."}
""" 


def build_readme(command: str, cfg: Mapping[str, Any], summary: Mapping[str, Any]) -> str:
    result = summary.get("result")
    technical_result = summary.get("technical_result")
    model_readiness_result = summary.get("model_readiness_result")
    return f"""# Realtime Audit Run

## Lệnh đã chạy

```bash
{command}
```

## Nguồn dữ liệu

- Bảng event: `{cfg.get("tables", {}).get("raw_iot")}`
- Bảng online result chống duplicate: `{cfg.get("tables", {}).get("online_l2_result")}`

## Kết quả nhanh

- Raw candidate rows: {summary.get("raw_candidate_rows")}
- Raw context rows: {summary.get("raw_context_rows")}
- Processed rows: {summary.get("processed_rows")}
- Closed rows chuẩn bị score: {summary.get("closed_rows")}
- Open/skipped rows: {summary.get("skipped_open_rows")}
- Live SQL contract result: {summary.get("live_sql_contract_result")}
- L1 data contract result: {summary.get("l1_data_contract_result")}
- L2 data contract result: {summary.get("l2_data_contract_result")}
- L1 mode: {summary.get("l1_mode")}
- L2 mode: {summary.get("l2_mode")}
- Write SQL enabled: {summary.get("write_sql_enabled")}
- Technical result: {technical_result}
- Model readiness result: {model_readiness_result}
- Result: {result}

## File cần mở kiểm tra

1. `02_raw_candidates.csv`
2. `03_raw_context.csv`
3. `04_joined_canonical_events.csv`
4. `05_l1_event_features.csv`
5. `06_l2_runtime_features_without_scores.csv`
6. `07_raw_to_l1_side_by_side.csv`
7. `08_l1_contract_report.json`
8. `09_l2_contract_report.json`
9. `10_invariant_report.json`
10. `11_summary.json`

## Cột cần kiểm tra trước

- `event_end_time`, `end_time_source`, `duration_sec`
- `kwh_start_source`, `kwh_end_source`, `kwh_delta`
- `time_quality_issue_flag`, `kwh_quality_issue_flag`, `energy_inconsistency_flag`
- `status_type_code`, `current_signal_code`, `status_evidence_class`
- `sequence_segment_id`, `event_order_in_segment`
- `location_id`

## Kết luận

{"PASS sơ bộ cho stage-only audit." if result == "PASS" else "Chưa được bật model production. Kiểm tra `violations` trong `11_summary.json` trước khi đi tiếp."}
"""


def _write_csv(path: Path, df: pd.DataFrame, columns: list[str] | None) -> None:
    if columns is not None:
        df = df.reindex(columns=columns)
    df.to_csv(path, index=False, encoding="utf-8-sig")


def _write_json(path: Path, obj: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")


def _format_sql_used(sql_used: Mapping[str, str]) -> str:
    parts = []
    for name, sql in sql_used.items():
        parts.append(f"-- {name}\n{sql.strip()}\n")
    return "\n\n".join(parts)


def _compare_values(runtime_value: Any, historical_value: Any) -> tuple[bool, float | None, str]:
    if pd.isna(runtime_value) and pd.isna(historical_value):
        return True, None, "both_missing"
    try:
        rv = float(runtime_value)
        hv = float(historical_value)
        if np.isnan(rv) and np.isnan(hv):
            return True, None, "both_nan"
        diff = abs(rv - hv)
        return diff <= 1e-6, diff, "numeric"
    except Exception:
        match = str(runtime_value) == str(historical_value)
        return match, None, "string"


def _status_codes_are_strings(df: pd.DataFrame) -> bool:
    for column in ["status_type_code", "current_signal_code"]:
        if column in df.columns and df[column].dropna().map(lambda v: isinstance(v, str)).any():
            return True
    return False


def _value_counts(df: pd.DataFrame, column: str) -> dict[str, int]:
    if column not in df.columns or df.empty:
        return {}
    return df[column].value_counts(dropna=False).astype(int).rename_axis(column).to_dict()


def _numeric_sum(df: pd.DataFrame, column: str) -> int:
    if column not in df.columns or df.empty:
        return 0
    return int(pd.to_numeric(df[column], errors="coerce").fillna(0).sum())


def _safe_min(df: pd.DataFrame, column: str) -> Any:
    if column not in df.columns or df.empty:
        return None
    value = df[column].min()
    return _json_default(value)


def _safe_max(df: pd.DataFrame, column: str) -> Any:
    if column not in df.columns or df.empty:
        return None
    value = df[column].max()
    return _json_default(value)


def _json_default(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value):
            return None
        return float(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value
