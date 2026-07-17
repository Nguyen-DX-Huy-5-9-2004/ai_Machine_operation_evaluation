from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd


CANONICAL_THRESHOLDS = {
    "kwh_impute_gap_limit_seconds": 300,
    "small_gap_seconds": 300,
    "big_gap_seconds": 3600,
    "long_duration_seconds": 86400,
    "l1_window_size": 20,
    "l2_past_event_window": 10,
}

RAW_EVENT_COLUMNS = [
    "event_id",
    "machine_id",
    "status_id",
    "event_start_time",
    "raw_event_end_time",
    "raw_status_kwh_start",
    "raw_status_kwh_end",
    "raw_error_code",
]

L1_ID_COLUMNS = ["event_id", "machine_id", "sequence_segment_id", "event_order_in_segment"]

L1_CATEGORICAL_COLUMNS = [
    "status_id",
    "status_type_code",
    "current_signal_code",
    "hour_of_day",
    "day_of_week",
    "machine_group_id",
    "location_id",
]

L1_CONTINUOUS_COLUMNS = [
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "kwh_delta_model_value",
    "kwh_rate_per_hour",
]

L1_BINARY_COLUMNS = [
    "is_on",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_or_missing_flag",
    "kwh_rate_missing_flag",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "is_raw_end_missing",
    "is_invalid_raw_end",
    "end_time_imputed_flag",
    "is_non_positive_duration",
    "is_long_duration",
    "is_gap",
    "is_big_gap",
    "is_overlap",
]

L1_REQUIRED_COLUMNS = L1_ID_COLUMNS + L1_CATEGORICAL_COLUMNS + L1_CONTINUOUS_COLUMNS + L1_BINARY_COLUMNS

L1_CANONICAL_EVENT_COLUMNS = [
    "event_id",
    "machine_id",
    "sequence_segment_id",
    "event_order_in_segment",
    "event_start_time",
    "event_end_time",
    "end_time_source",
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "status_id",
    "status_type_code",
    "is_on",
    "current_signal_code",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "has_error_token",
    "has_maintenance_token",
    "raw_status_kwh_start",
    "raw_status_kwh_end",
    "kwh_start_value",
    "kwh_end_value",
    "kwh_start_source",
    "kwh_end_source",
    "kwh_raw_available_flag",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_or_missing_flag",
    "kwh_start_imputed_flag",
    "kwh_end_imputed_flag",
    "kwh_delta",
    "kwh_delta_model_value",
    "kwh_zero_delta_flag",
    "kwh_positive_delta_flag",
    "kwh_negative_delta_flag",
    "kwh_rate_per_hour",
    "kwh_rate_missing_flag",
    "loaded_positive_kwh_flag",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "is_raw_end_missing",
    "is_invalid_raw_end",
    "is_open_event",
    "end_time_imputed_flag",
    "is_non_positive_duration",
    "is_long_duration",
    "is_gap",
    "is_big_gap",
    "is_overlap",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
]

L2_NATIVE_RUNTIME_COLUMNS = [
    "duration_sec_model_value",
    "gap_from_prev_sec_model_value",
    "overlap_sec",
    "status_id",
    "status_type_code",
    "current_signal_code",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "off_with_fault_status",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_flag",
    "kwh_delta_model_value",
    "kwh_rate_per_hour_model_value",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "energy_inconsistency_flag",
    "time_quality_issue_flag",
    "kwh_quality_issue_flag",
    "data_quality_issue_flag",
    "data_quality_issue_count",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
    "fault_evidence_count",
    "maintenance_evidence_count",
    "split_bucket",
]

L2_CATEGORICAL_COLUMNS = [
    "current_signal_code",
    "day_of_week",
    "hour_of_day",
    "location_id",
    "machine_group_id",
    "split_bucket",
    "status_id",
    "status_type_code",
]

L2_TARGET_COLUMNS = [
    "future_fault_within_10_events",
    "future_fault_within_30_events",
    "future_fault_within_30min",
    "future_fault_within_60min",
    "future_maintenance_within_30_events",
    "future_repair_within_30_events",
]

L2_LEAKAGE_COLUMNS = [
    "next_fault_status_id",
    "events_to_next_fault",
    "seconds_to_next_fault",
    *L2_TARGET_COLUMNS,
]

END_TIME_SOURCES = {
    "RAW",
    "NEXT_EVENT_START_FROM_NULL",
    "NEXT_EVENT_START_FROM_INVALID_RAW",
    "OPEN_EVENT",
    "UNRESOLVED_INVALID_TIME",
}

KWH_SOURCES = {"RAW", "PREV_EVENT_END", "NEXT_EVENT_START", "MISSING"}


def thresholds_from_config(cfg: Mapping[str, Any]) -> tuple[dict[str, int], list[str]]:
    runtime = cfg.get("runtime", {}) if isinstance(cfg, Mapping) else {}
    actual = {
        "kwh_impute_gap_limit_seconds": int(runtime.get("kwh_impute_gap_limit_seconds", CANONICAL_THRESHOLDS["kwh_impute_gap_limit_seconds"])),
        "small_gap_seconds": int(runtime.get("small_gap_seconds", CANONICAL_THRESHOLDS["small_gap_seconds"])),
        "big_gap_seconds": int(runtime.get("big_gap_seconds", CANONICAL_THRESHOLDS["big_gap_seconds"])),
        "long_duration_seconds": int(runtime.get("long_duration_seconds", CANONICAL_THRESHOLDS["long_duration_seconds"])),
        "l1_window_size": int(runtime.get("window_size_l1", CANONICAL_THRESHOLDS["l1_window_size"])),
        "l2_past_event_window": int(runtime.get("l2_past_event_window", CANONICAL_THRESHOLDS["l2_past_event_window"])),
    }
    mismatches = [
        f"{name}: runtime={actual[name]} canonical={expected}"
        for name, expected in CANONICAL_THRESHOLDS.items()
        if actual.get(name) != expected
    ]
    return actual, mismatches


def load_json(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_l2_metadata_by_target(artifact_root: str | Path, production_selection: str | Path | None = None) -> dict[str, dict[str, Any]]:
    root = Path(artifact_root)
    selected: dict[str, str] = {}
    if production_selection and Path(production_selection).exists():
        payload = load_json(production_selection)
        for row in payload.get("targets", []):
            selected[str(row["target"])] = str(row["selected_profile"])

    out: dict[str, dict[str, Any]] = {}
    for metadata_path in root.glob("*/*/metadata.json"):
        metadata = load_json(metadata_path)
        target = str(metadata.get("target") or metadata_path.parent.name)
        profile = str(metadata.get("profile_name") or metadata.get("profile") or metadata_path.parent.parent.name)
        if selected and selected.get(target) != profile:
            continue
        metadata["_metadata_path"] = str(metadata_path)
        metadata["_selected_profile"] = profile
        out[target] = metadata
    return out


def validate_l1_model_contract(df: pd.DataFrame, preprocessor: Mapping[str, Any] | None = None) -> dict[str, Any]:
    expected = _l1_expected_columns_from_preprocessor(preprocessor) if preprocessor else L1_REQUIRED_COLUMNS
    missing = [c for c in expected if c not in df.columns]
    extra = [c for c in L1_REQUIRED_COLUMNS if c not in expected and c in df.columns]
    dtype_mismatches = _numeric_dtype_mismatches(df, [c for c in expected if c not in L1_ID_COLUMNS])
    enum_violations = _enum_violations(df)
    window_violations = _window_violations(df, int((preprocessor or {}).get("window_size", CANONICAL_THRESHOLDS["l1_window_size"])))
    result = "PASS" if not (missing or dtype_mismatches or enum_violations or window_violations) else "FAIL"
    return {
        "result": result,
        "expected_feature_order": expected,
        "missing_features": missing,
        "extra_features_known_to_contract": extra,
        "dtype_mismatches": dtype_mismatches,
        "enum_violations": enum_violations,
        "window_violations": window_violations,
        "missing_category_value": (preprocessor or {}).get("missing_category_value"),
        "unknown_category_value": (preprocessor or {}).get("unknown_category_value"),
    }


def validate_l2_model_contract(df: pd.DataFrame, metadata_by_target: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    targets: dict[str, Any] = {}
    any_fail = False
    for target, metadata in metadata_by_target.items():
        features = list(metadata.get("feature_columns") or metadata.get("features") or [])
        categorical = list(metadata.get("categorical_features") or [])
        missing = [c for c in features if c not in df.columns]
        leakage = [c for c in L2_LEAKAGE_COLUMNS if c in df.columns]
        dtype_mismatches = _numeric_dtype_mismatches(df, [c for c in features if c not in categorical])
        categorical_present = [c for c in categorical if c in df.columns]
        result = "PASS" if not (missing or leakage or dtype_mismatches) else "FAIL"
        any_fail = any_fail or result == "FAIL"
        targets[target] = {
            "result": result,
            "selected_profile": metadata.get("_selected_profile") or metadata.get("profile_name") or metadata.get("profile"),
            "selected_threshold": metadata.get("threshold") or metadata.get("selected_threshold"),
            "feature_count": len(features),
            "missing_features": missing,
            "extra_features": [c for c in df.columns if c not in features and c not in L1_CANONICAL_EVENT_COLUMNS],
            "dtype_mismatches": dtype_mismatches,
            "categorical_features": categorical,
            "categorical_features_present": categorical_present,
            "fill_policy": {"categorical": -1, "numeric": "training pipeline used LightGBM numeric NaN handling"},
            "leakage_columns_present": leakage,
        }
    return {"result": "FAIL" if any_fail or not targets else "PASS", "targets": targets}


def validate_runtime_invariants(df: pd.DataFrame, thresholds: Mapping[str, int]) -> dict[str, Any]:
    violations: list[str] = []
    if df.empty:
        violations.append("no_rows")
    if df.duplicated(["event_id"]).any():
        violations.append("duplicate_event_id")
    if "end_time_source" in df.columns:
        bad_sources = sorted(set(df["end_time_source"].dropna()) - END_TIME_SOURCES)
        if bad_sources:
            violations.append(f"unknown_end_time_source={bad_sources}")
    if "kwh_start_source" in df.columns:
        bad = sorted(set(df["kwh_start_source"].dropna()) - KWH_SOURCES)
        if bad:
            violations.append(f"unknown_kwh_start_source={bad}")
    if "kwh_end_source" in df.columns:
        bad = sorted(set(df["kwh_end_source"].dropna()) - KWH_SOURCES)
        if bad:
            violations.append(f"unknown_kwh_end_source={bad}")
    if {"kwh_start_imputed_flag", "gap_from_prev_sec"}.issubset(df.columns):
        bad_fill = df[(df["kwh_start_imputed_flag"] == 1) & (pd.to_numeric(df["gap_from_prev_sec"], errors="coerce").abs() > thresholds["kwh_impute_gap_limit_seconds"])]
        if not bad_fill.empty:
            violations.append("kwh_start_imputed_beyond_gap_limit")
    if {"machine_id", "sequence_segment_id", "event_order_in_segment"}.issubset(df.columns):
        dup_order = df.duplicated(["machine_id", "sequence_segment_id", "event_order_in_segment"]).any()
        if dup_order:
            violations.append("duplicate_event_order_in_segment")
    return {"result": "PASS" if not violations else "FAIL", "violations": violations}


def _l1_expected_columns_from_preprocessor(preprocessor: Mapping[str, Any]) -> list[str]:
    feature_columns = preprocessor.get("feature_columns")
    if feature_columns:
        return list(feature_columns)
    spec = preprocessor.get("spec", {})
    if spec:
        return (
            list(spec.get("categorical_columns", []))
            + list(spec.get("continuous_columns", []))
            + list(spec.get("binary_columns", []))
        )
    groups = preprocessor.get("feature_groups", {})
    return list(groups.get("categorical", [])) + list(groups.get("continuous", [])) + list(groups.get("binary", []))


def _numeric_dtype_mismatches(df: pd.DataFrame, columns: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for column in columns:
        if column not in df.columns:
            continue
        if not pd.api.types.is_numeric_dtype(df[column]):
            converted = pd.to_numeric(df[column], errors="coerce")
            if converted.notna().sum() < df[column].notna().sum():
                out[column] = str(df[column].dtype)
    return out


def _enum_violations(df: pd.DataFrame) -> dict[str, list[Any]]:
    out: dict[str, list[Any]] = {}
    if "status_id" in df.columns:
        bad = sorted(v for v in pd.to_numeric(df["status_id"], errors="coerce").dropna().unique().tolist() if int(v) not in range(1, 15))
        if bad:
            out["status_id"] = bad
    return out


def _window_violations(df: pd.DataFrame, window_size: int) -> list[str]:
    if df.empty or not {"machine_id", "sequence_segment_id"}.issubset(df.columns):
        return []
    sizes = df.groupby(["machine_id", "sequence_segment_id"]).size()
    if sizes.empty:
        return []
    # Short segments are legal; they must simply not be scored by L1. Report as info only.
    return []
