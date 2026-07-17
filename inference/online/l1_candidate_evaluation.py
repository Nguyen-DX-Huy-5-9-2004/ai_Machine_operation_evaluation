"""Fair, read-only A/B/C evaluation for the prepared Candidate C package."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

from .l1_shadow import (
    L1_MODEL_FEATURES,
    build_window_manifest,
    combine_shadow_scores,
    choose_torch_device,
    load_l1_base_config,
    load_shadow_profile,
    rows_for_ready_windows,
    score_windows,
)


READY_WINDOW_COLUMNS = ["event_id", "machine_id", "window_ready_flag", "not_scored_reason"]
EVALUATION_JOIN_KEYS = ["machine_id", "event_id"]
FUTURE_LABELS = [
    "future_fault_within_10_events",
    "future_fault_within_30_events",
    "future_fault_within_30min",
    "future_fault_within_60min",
    "future_maintenance_within_30_events",
    "future_repair_within_30_events",
]
EVALUATION_LABEL_COLUMNS = [
    "normal_lenient_flag",
    "normal_strict_flag",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "off_with_fault_status",
    *FUTURE_LABELS,
]


def _read_parquet(path: Path) -> pd.DataFrame:
    try:
        return pd.read_parquet(path)
    except Exception:
        import duckdb

        return duckdb.sql(f"SELECT * FROM read_parquet('{str(path).replace("'", "''")}')").df()


def _write_json(path: Path, payload: Any) -> None:
    def default(value: Any) -> Any:
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            return None if not np.isfinite(value) else float(value)
        if isinstance(value, (pd.Timestamp, datetime)):
            return value.isoformat()
        if isinstance(value, Path):
            return str(value)
        raise TypeError(type(value).__name__)

    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=default), encoding="utf-8")


def _as_flag(frame: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(frame.get(column, 0), errors="coerce").fillna(0).astype(int) == 1


def _safe_rate(values: pd.Series) -> float | None:
    return float(values.mean()) if len(values) else None


def _binary_metrics(predicted: pd.Series, truth: pd.Series) -> tuple[float | None, float | None, float | None]:
    if not len(predicted):
        return None, None, None
    tp = int((predicted & truth).sum())
    fp = int((predicted & ~truth).sum())
    fn = int((~predicted & truth).sum())
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
    return precision, recall, f1


def candidate_metric_payload(frame: pd.DataFrame, prefix: str) -> dict[str, Any]:
    ready = _as_flag(frame, "window_ready_flag")
    scored = frame.loc[ready].copy()
    predicted = _as_flag(scored, f"{prefix}_is_behavior_anomaly")
    warning = _as_flag(scored, f"{prefix}_is_sensitive_warning")
    normal = _as_flag(scored, "normal_lenient_flag")
    known_fault = _as_flag(scored, "known_fault_status")
    precision, recall, f1 = _binary_metrics(predicted, known_fault)
    payload: dict[str, Any] = {
        "total_support": int(len(frame)),
        "scored_window_support": int(len(scored)),
        "not_scored_window_support": int(len(frame) - len(scored)),
        "normal_lenient_support": int(normal.sum()),
        "normal_false_positive_rate": _safe_rate(predicted[normal]),
        "known_fault_support": int(known_fault.sum()),
        "known_fault_recall": _safe_rate(predicted[known_fault]),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "anomaly_rate": _safe_rate(predicted),
        "strict_only_warning_rate": _safe_rate(warning),
    }
    for label in FUTURE_LABELS:
        positive = _as_flag(scored, label)
        payload[f"{label}_support"] = int(positive.sum())
        payload[f"{label}_recall"] = _safe_rate(predicted[positive])
    return payload


def strict_lenient_overlap(frame: pd.DataFrame, prefix: str) -> dict[str, Any]:
    scored = frame.loc[_as_flag(frame, "window_ready_flag")].copy()
    lenient = _as_flag(scored, f"{prefix}_is_anomaly_lenient")
    strict = _as_flag(scored, f"{prefix}_is_anomaly_strict")
    total = len(scored)
    result: dict[str, Any] = {"support": int(total), "not_scored_window_support": int(len(frame) - total)}
    for name, mask in {
        "lenient_0_strict_0": ~lenient & ~strict,
        "lenient_1_strict_0": lenient & ~strict,
        "lenient_0_strict_1": ~lenient & strict,
        "lenient_1_strict_1": lenient & strict,
    }.items():
        count = int(mask.sum())
        result[name] = {"count": count, "rate": count / total if total else None}
    return result


def apply_threshold_payload(scores: pd.DataFrame, payload: dict[str, Any], profile: str, prefix: str) -> pd.DataFrame:
    out = scores.copy()
    score_col = f"score_{profile}"
    global_threshold = float(payload["global_threshold"])
    per_machine = payload.get("per_machine_thresholds", {})
    threshold = [float(per_machine.get(str(int(machine)), global_threshold)) for machine in out["machine_id"]]
    out[f"{prefix}_threshold_{profile}"] = threshold
    out[f"{prefix}_score_{profile}"] = pd.to_numeric(out[score_col], errors="coerce")
    out[f"{prefix}_score_{profile}_normalized"] = out[f"{prefix}_score_{profile}"] / out[f"{prefix}_threshold_{profile}"].replace(0, np.nan)
    out[f"{prefix}_is_anomaly_{profile}"] = (out[f"{prefix}_score_{profile}_normalized"] >= 1.0).astype("int8")
    return out


def apply_candidate_labels(scores: pd.DataFrame, threshold_payloads: dict[str, dict[str, Any]], prefix: str) -> pd.DataFrame:
    out = scores.copy()
    for profile in ("lenient", "strict"):
        out = apply_threshold_payload(out, threshold_payloads[profile], profile, prefix)
    out[f"{prefix}_is_behavior_anomaly"] = out[f"{prefix}_is_anomaly_lenient"].astype("int8")
    out[f"{prefix}_is_sensitive_warning"] = (
        (out[f"{prefix}_is_anomaly_strict"] == 1) & (out[f"{prefix}_is_anomaly_lenient"] == 0)
    ).astype("int8")
    return out


def _candidate_artifact_contract(root: Path, package: Path, artifact_root: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    base = load_l1_base_config(root)
    device = choose_torch_device()
    production = {
        profile: load_shadow_profile(root, profile, base, device=device)
        for profile in ("lenient", "strict")
    }
    candidate: dict[str, Any] = {}
    candidate_cfg: dict[str, Any] = {}
    for profile in ("lenient", "strict"):
        config_path = package / "configs" / f"{profile}.yaml"
        candidate_cfg[profile] = yaml.safe_load(config_path.read_text(encoding="utf-8")) if config_path.exists() else base
        candidate[profile] = load_shadow_profile(
            root,
            profile,
            candidate_cfg[profile],
            device=device,
            artifact_dir=artifact_root / profile,
        )
    return production, candidate, {"base": base, **candidate_cfg}


def _resolve_b_thresholds(package: Path, adaptation: Path) -> dict[str, dict[str, Any]]:
    candidates = [
        package / "manifests" / "candidate_b_grid.json",
        adaptation / "14_candidate_b_grid_thresholds.json",
        adaptation / "16_candidate_b_thresholds.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        nested = payload.get("thresholds", payload)
        if all(profile in nested and "global_threshold" in nested[profile] for profile in ("lenient", "strict")):
            return {"lenient": nested["lenient"], "strict": nested["strict"]}
    raise FileNotFoundError("Candidate B threshold payload with lenient and strict profiles was not found.")


def _load_machine_split(package: Path, split: str, machine_id: int) -> tuple[pd.DataFrame, set[int]]:
    canonical = _read_parquet(package / "canonical" / f"machine_id={machine_id}" / "events.parquet")
    target_path = package / "evaluation" / ("valid_all" if split == "VALID" else "test_all") / f"machine_id={machine_id}" / "events.parquet"
    targets = _read_parquet(target_path)
    return canonical, set(pd.to_numeric(targets["event_id"], errors="coerce").dropna().astype(int))


def merge_evaluation_labels(scored: pd.DataFrame, labels: pd.DataFrame) -> pd.DataFrame:
    """Attach only evaluation targets to a window result with an explicit key contract."""
    for frame_name, frame in (("scored", scored), ("labels", labels)):
        missing = [column for column in EVALUATION_JOIN_KEYS if column not in frame.columns]
        if missing:
            raise ValueError(f"{frame_name} is missing evaluation join keys: {missing}")
    label_columns = [column for column in EVALUATION_LABEL_COLUMNS if column in labels.columns]
    labels_for_merge = labels.reindex(columns=[*EVALUATION_JOIN_KEYS, *label_columns]).copy()
    if labels_for_merge.duplicated(EVALUATION_JOIN_KEYS).any():
        duplicates = labels_for_merge.loc[labels_for_merge.duplicated(EVALUATION_JOIN_KEYS, keep=False), EVALUATION_JOIN_KEYS]
        raise ValueError(f"evaluation labels are not unique by machine_id + event_id: {duplicates.head(5).to_dict('records')}")
    if scored.duplicated(EVALUATION_JOIN_KEYS).any():
        duplicates = scored.loc[scored.duplicated(EVALUATION_JOIN_KEYS, keep=False), EVALUATION_JOIN_KEYS]
        raise ValueError(f"scored windows are not unique by machine_id + event_id: {duplicates.head(5).to_dict('records')}")
    overlap = (set(scored.columns) & set(labels_for_merge.columns)) - set(EVALUATION_JOIN_KEYS)
    if overlap:
        raise AssertionError(f"evaluation label merge has unexpected overlapping columns: {sorted(overlap)}")
    return scored.merge(labels_for_merge, on=EVALUATION_JOIN_KEYS, how="left", validate="one_to_one")


def _score_machine_split(
    canonical: pd.DataFrame,
    target_ids: set[int],
    production: dict[str, Any],
    candidate: dict[str, Any],
    configs: dict[str, Any],
    b_thresholds: dict[str, dict[str, Any]],
) -> pd.DataFrame:
    manifest = build_window_manifest(canonical, target_ids, window_size=20)
    ready_rows = rows_for_ready_windows(canonical, manifest)
    a_lenient, _ = score_windows(production["lenient"], configs["base"], ready_rows)
    a_strict, _ = score_windows(production["strict"], configs["base"], ready_rows)
    c_lenient, _ = score_windows(candidate["lenient"], configs["lenient"], ready_rows)
    c_strict, _ = score_windows(candidate["strict"], configs["strict"], ready_rows)
    a = combine_shadow_scores(manifest, a_lenient, a_strict)
    c = combine_shadow_scores(manifest, c_lenient, c_strict)
    labels = canonical[canonical["event_id"].isin(target_ids)].copy()
    a = merge_evaluation_labels(a, labels)
    c = merge_evaluation_labels(c, labels)
    a = apply_candidate_labels(a, {profile: production[profile].thresholds for profile in ("lenient", "strict")}, "candidate_a")
    a = apply_candidate_labels(a, b_thresholds, "candidate_b")
    c = apply_candidate_labels(c, {profile: candidate[profile].thresholds for profile in ("lenient", "strict")}, "candidate_c")
    a_columns = [column for column in a.columns if column.startswith("candidate_a_") or column.startswith("candidate_b_")]
    c_columns = [column for column in c.columns if column.startswith("candidate_c_")]
    structural_columns = [
        column for column in a.columns
        if not column.startswith("candidate_a_") and not column.startswith("candidate_b_")
    ]
    c_for_merge = c.reindex(columns=[*EVALUATION_JOIN_KEYS, *c_columns])
    overlap = (set(a.reindex(columns=structural_columns + a_columns).columns) & set(c_for_merge.columns)) - set(EVALUATION_JOIN_KEYS)
    if overlap:
        raise AssertionError(f"Candidate A/B/C score merge has unexpected overlapping columns: {sorted(overlap)}")
    return a.reindex(columns=structural_columns + a_columns).merge(
        c_for_merge,
        on=EVALUATION_JOIN_KEYS,
        how="inner",
        validate="one_to_one",
    )


def _metric_reports(scored: pd.DataFrame) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    global_report: dict[str, Any] = {}
    machine_report: dict[str, Any] = {}
    overlap_report: dict[str, Any] = {}
    valid_rates = {
        int(machine_id): candidate_metric_payload(machine_frame, "candidate_c")["anomaly_rate"]
        for machine_id, machine_frame in scored[scored["split_name"] == "VALID"].groupby("machine_id", sort=True)
    }
    for split, split_frame in scored.groupby("split_name", sort=True):
        global_report[str(split)] = {candidate: candidate_metric_payload(split_frame, candidate) for candidate in ("candidate_a", "candidate_b", "candidate_c")}
        overlap_report[str(split)] = {"global": {candidate: strict_lenient_overlap(split_frame, candidate) for candidate in ("candidate_a", "candidate_b", "candidate_c")}, "by_machine": {}}
        machine_report[str(split)] = {}
        for machine_id, machine_frame in split_frame.groupby("machine_id", sort=True):
            machine_payload = {candidate: candidate_metric_payload(machine_frame, candidate) for candidate in ("candidate_a", "candidate_b", "candidate_c")}
            machine_payload["flags"] = {
                "low_support": len(machine_frame) < 30,
                "anomaly_rate_over_5_percent": any((machine_payload[candidate]["anomaly_rate"] or 0) > 0.05 for candidate in machine_payload if candidate.startswith("candidate_")),
                "priority_machine": int(machine_id) in {49, 51, 58},
            }
            machine_report[str(split)][str(int(machine_id))] = machine_payload
            overlap_report[str(split)]["by_machine"][str(int(machine_id))] = {candidate: strict_lenient_overlap(machine_frame, candidate) for candidate in ("candidate_a", "candidate_b", "candidate_c")}
        if str(split) == "TEST":
            for machine_id, payload in machine_report[str(split)].items():
                valid_rate = valid_rates.get(int(machine_id))
                test_rate = payload["candidate_c"]["anomaly_rate"]
                payload["flags"]["valid_test_anomaly_rate_ratio_over_2"] = bool(
                    valid_rate is not None
                    and test_rate is not None
                    and ((valid_rate == 0 and test_rate > 0) or (valid_rate > 0 and test_rate / valid_rate > 2))
                )
                a_recall = payload["candidate_a"]["known_fault_recall"]
                c_recall = payload["candidate_c"]["known_fault_recall"]
                payload["flags"]["fault_recall_drop_strong"] = bool(a_recall is not None and c_recall is not None and a_recall - c_recall > 0.20)
    machine_report["priority_machines"] = {
        machine_id: {
            split: machine_report.get(split, {}).get(machine_id, {"status": "NOT_PRESENT_IN_HELD_OUT_SPLIT"})
            for split in ("VALID", "TEST")
        }
        for machine_id in ("49", "51", "58")
    }
    return global_report, machine_report, overlap_report


def _comparison(scored: pd.DataFrame) -> dict[str, Any]:
    report: dict[str, Any] = {"exact_window_identity": "PASS", "by_split": {}}
    for split, frame in scored.groupby("split_name", sort=True):
        report["by_split"][str(split)] = {
            "exact_window_count": int(len(frame)),
            "unique_event_count": int(frame["event_id"].nunique()),
            "candidates": {candidate: candidate_metric_payload(frame, candidate) for candidate in ("candidate_a", "candidate_b", "candidate_c")},
            "candidate_a_b_score_identity": bool(np.allclose(pd.to_numeric(frame["candidate_a_score_lenient"], errors="coerce"), pd.to_numeric(frame["candidate_b_score_lenient"], errors="coerce"), equal_nan=True)),
        }
    report["historical_reference_only"] = "Previous adaptation metrics were not used because they did not use these held-out windows."
    return report


def _historical_regression_unavailable(package: Path, reason: str) -> dict[str, Any]:
    manifest = package / "evaluation" / "historical_reference_manifest.json"
    if not manifest.exists():
        return {"result": "NOT_AVAILABLE", "reason": "historical_reference_manifest_missing"}
    source = json.loads(manifest.read_text(encoding="utf-8")).get("source")
    return {
        "result": "NOT_AVAILABLE_NO_PERSISTED_HISTORICAL_EXACT_WINDOWS",
        "historical_source": source,
        "reason": reason,
        "score_correlation": None,
        "label_change_rate": None,
        "unexplained_mismatch": None,
        "per_machine_drift": {},
    }


def _historical_csv_path(project_root: Path, package: Path) -> Path | None:
    manifest_path = package / "evaluation" / "historical_reference_manifest.json"
    if not manifest_path.exists():
        return None
    source = json.loads(manifest_path.read_text(encoding="utf-8")).get("source")
    if not source:
        return None
    path = Path(source)
    return path if path.is_absolute() else project_root / path


def _read_historical_window_rows(csv_path: Path, event_ids: set[int]) -> pd.DataFrame:
    if not event_ids:
        return pd.DataFrame()
    with csv_path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        header = handle.readline()
    separator = ";" if header.count(";") > header.count(",") else ","
    columns = pd.read_csv(csv_path, sep=separator, nrows=0).columns.tolist()
    required = [
        "event_id", "machine_id", "event_start_time", "sequence_segment_id", "event_order_in_segment", *L1_MODEL_FEATURES,
    ]
    usecols = [column for column in required if column in columns]
    if set(required) - set(usecols):
        return pd.DataFrame()
    selected: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, sep=separator, usecols=usecols, chunksize=200_000, low_memory=False):
        chunk_ids = pd.to_numeric(chunk["event_id"], errors="coerce").astype("Int64")
        part = chunk.loc[chunk_ids.isin(event_ids)].copy()
        if not part.empty:
            selected.append(part)
    return pd.concat(selected, ignore_index=True) if selected else pd.DataFrame(columns=usecols)


def _historical_window_rows(exact: pd.DataFrame, historical: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    by_event = historical.set_index("event_id", drop=False)
    rows: list[pd.DataFrame] = []
    kept: list[dict[str, Any]] = []
    for window_id, item in exact.reset_index(drop=True).iterrows():
        ids = [int(value) for value in str(item["historical_window_event_ids"]).split("|") if value]
        if len(ids) != 20 or any(event_id not in by_event.index for event_id in ids):
            continue
        window = by_event.loc[ids].copy()
        if isinstance(window, pd.Series):
            window = window.to_frame().T
        if len(window) != 20:
            continue
        window["shadow_window_id"] = window_id
        rows.append(window)
        kept.append({
            "shadow_window_id": window_id,
            "current_event_id": int(item["current_event_id"]),
            "historical_event_id": int(item["historical_event_id"]),
            "mapping_machine_id": int(item["mapping_machine_id"]),
        })
    return (pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(), pd.DataFrame(kept))


def _historical_regression(
    project_root: Path,
    package: Path,
    adaptation: Path,
    scored_current: pd.DataFrame,
    candidate: dict[str, Any],
    configs: dict[str, Any],
) -> dict[str, Any]:
    exact_path = adaptation / "04_exact_paired_window_manifest.csv"
    csv_path = _historical_csv_path(project_root, package)
    if not exact_path.exists() or csv_path is None or not csv_path.exists():
        return _historical_regression_unavailable(package, "exact historical window manifest or historical L1 CSV is unavailable")
    exact = pd.read_csv(exact_path, usecols=["current_event_id", "historical_event_id", "alignment_status", "historical_window_event_ids"])
    exact = exact[exact["alignment_status"] == "EXACT_PAIRED_WINDOW"].copy()
    current_ids = set(pd.to_numeric(scored_current["event_id"], errors="coerce").dropna().astype(int))
    exact = exact[pd.to_numeric(exact["current_event_id"], errors="coerce").astype("Int64").isin(current_ids)].copy()
    if exact.empty:
        return _historical_regression_unavailable(package, "no Candidate C held-out targets overlap the persisted exact historical window manifest")
    exact["mapping_machine_id"] = exact["current_event_id"].map(scored_current.set_index("event_id")["machine_id"])
    historical_ids = {
        int(value)
        for values in exact["historical_window_event_ids"].dropna()
        for value in str(values).split("|")
        if value
    }
    historical = _read_historical_window_rows(csv_path, historical_ids)
    window_rows, mapping = _historical_window_rows(exact, historical)
    if window_rows.empty or mapping.empty:
        return _historical_regression_unavailable(package, "historical L1 CSV did not contain every event required by the persisted exact windows")
    lenient, _ = score_windows(candidate["lenient"], configs["lenient"], window_rows)
    strict, _ = score_windows(candidate["strict"], configs["strict"], window_rows)
    strict_score_columns = [column for column in strict.columns if column == "event_id" or column.startswith(("score_", "threshold_", "is_anomaly_", "continuous_error_", "binary_error_", "categorical_error_"))]
    historical_scores = lenient.merge(strict.reindex(columns=strict_score_columns), on="event_id", how="inner")
    historical_scores = apply_candidate_labels(
        historical_scores,
        {profile: candidate[profile].thresholds for profile in ("lenient", "strict")},
        "candidate_c_historical",
    )
    paired = mapping.merge(historical_scores, left_on="historical_event_id", right_on="event_id", how="inner")
    current_columns = [
        "event_id", "machine_id", "candidate_c_score_lenient", "candidate_c_score_strict",
        "candidate_c_is_behavior_anomaly", "candidate_c_is_sensitive_warning",
    ]
    paired = paired.merge(scored_current.reindex(columns=current_columns), left_on="current_event_id", right_on="event_id", how="inner", suffixes=("_historical", "_current"))
    if paired.empty:
        return _historical_regression_unavailable(package, "exact mapping remained, but no Candidate C historical score paired to a held-out current score")
    reason_path = adaptation / "09_change_reason_reclassified.csv"
    unexplained = 0
    if reason_path.exists():
        reasons = pd.read_csv(reason_path, usecols=["current_event_id", "adaptation_change_reason"])
        paired = paired.merge(reasons, on="current_event_id", how="left")
        unexplained = int((paired["adaptation_change_reason"] == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum())
    per_machine = {}
    for machine_id, part in paired.groupby("machine_id_current", sort=True):
        per_machine[str(int(machine_id))] = {
            "support": int(len(part)),
            "lenient_score_pearson": _correlation(part["candidate_c_score_lenient"], part["candidate_c_historical_score_lenient"], "pearson"),
            "lenient_score_spearman": _correlation(part["candidate_c_score_lenient"], part["candidate_c_historical_score_lenient"], "spearman"),
            "label_change_rate": _safe_rate(_as_flag(part, "candidate_c_is_behavior_anomaly") != _as_flag(part, "candidate_c_historical_is_behavior_anomaly")),
        }
    return {
        "result": "PASS",
        "historical_source": str(csv_path),
        "exact_paired_window_support": int(len(paired)),
        "score_correlation": {
            "lenient_pearson": _correlation(paired["candidate_c_score_lenient"], paired["candidate_c_historical_score_lenient"], "pearson"),
            "lenient_spearman": _correlation(paired["candidate_c_score_lenient"], paired["candidate_c_historical_score_lenient"], "spearman"),
            "strict_pearson": _correlation(paired["candidate_c_score_strict"], paired["candidate_c_historical_score_strict"], "pearson"),
            "strict_spearman": _correlation(paired["candidate_c_score_strict"], paired["candidate_c_historical_score_strict"], "spearman"),
        },
        "label_change_rate": _safe_rate(_as_flag(paired, "candidate_c_is_behavior_anomaly") != _as_flag(paired, "candidate_c_historical_is_behavior_anomaly")),
        "strict_only_warning_change_rate": _safe_rate(_as_flag(paired, "candidate_c_is_sensitive_warning") != _as_flag(paired, "candidate_c_historical_is_sensitive_warning")),
        "unexplained_mismatch": unexplained,
        "per_machine_drift": per_machine,
    }


def _correlation(left: pd.Series, right: pd.Series, method: str) -> float | None:
    pair = pd.DataFrame({"left": pd.to_numeric(left, errors="coerce"), "right": pd.to_numeric(right, errors="coerce")}).dropna()
    return float(pair["left"].corr(pair["right"], method=method)) if len(pair) >= 2 else None


def decision_gate(global_metrics: dict[str, Any], by_machine: dict[str, Any], comparison: dict[str, Any], historical: dict[str, Any]) -> dict[str, Any]:
    valid = global_metrics.get("VALID", {})
    a = valid.get("candidate_a", {})
    b = valid.get("candidate_b", {})
    c = valid.get("candidate_c", {})
    if not valid or comparison.get("exact_window_identity") != "PASS":
        decision = "CANDIDATE_EVALUATION_INCONCLUSIVE"
    elif a.get("known_fault_support", 0) < 5 or c.get("known_fault_support", 0) < 5:
        decision = "MORE_DATA_OR_LABEL_COVERAGE_REQUIRED"
    elif _candidate_dominates(c, a):
        decision = "ADOPT_CANDIDATE_C_CURRENT_ONLY"
    elif _candidate_dominates(b, a):
        decision = "ADOPT_B_GRID_THRESHOLDS_CANDIDATE"
    else:
        decision = "KEEP_CURRENT_MODEL_AND_THRESHOLDS"
    return {"decision": decision, "selection_split": "VALID", "test_used_for_selection": False, "historical_regression_result": historical.get("result"), "automatic_promotion": False}


def _candidate_dominates(candidate: dict[str, Any], baseline: dict[str, Any]) -> bool:
    recall = candidate.get("known_fault_recall")
    baseline_recall = baseline.get("known_fault_recall")
    fpr = candidate.get("normal_false_positive_rate")
    baseline_fpr = baseline.get("normal_false_positive_rate")
    return bool(
        recall is not None
        and baseline_recall is not None
        and fpr is not None
        and baseline_fpr is not None
        and recall >= baseline_recall
        and fpr <= baseline_fpr
    )


def run_candidate_abc_evaluation(cfg: dict[str, Any], args: Any, project_root: Path) -> int:
    if not args.candidate_package_dir or not args.candidate_artifact_dir or not args.adaptation_audit_dir:
        raise ValueError("--candidate-package-dir, --candidate-artifact-dir, and --adaptation-audit-dir are required for Candidate A/B/C evaluation")
    package = Path(args.candidate_package_dir)
    artifact_root = Path(args.candidate_artifact_dir)
    adaptation = Path(args.adaptation_audit_dir)
    if not package.is_absolute(): package = project_root / package
    if not artifact_root.is_absolute(): artifact_root = project_root / artifact_root
    if not adaptation.is_absolute(): adaptation = project_root / adaptation
    if not package.exists() or not artifact_root.exists() or not adaptation.exists():
        raise FileNotFoundError("Candidate package, Candidate C artifacts, or adaptation audit directory does not exist.")
    out_dir = project_root / "data" / "realtime_audit" / f"l1_candidate_c_eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    production, candidate, configs = _candidate_artifact_contract(project_root, package, artifact_root)
    b_thresholds = _resolve_b_thresholds(package, adaptation)
    canonical_parts = sorted((package / "canonical").glob("machine_id=*/events.parquet"))
    if not canonical_parts:
        raise FileNotFoundError("No canonical machine partitions found in Candidate C package.")

    scored_parts: list[pd.DataFrame] = []
    for canonical_path in canonical_parts:
        machine_id = int(canonical_path.parent.name.split("=", 1)[1])
        for split in ("VALID", "TEST"):
            canonical, target_ids = _load_machine_split(package, split, machine_id)
            if not target_ids:
                continue
            part = _score_machine_split(canonical, target_ids, production, candidate, configs, b_thresholds)
            part["split_name"] = split
            scored_parts.append(part)
            print(f"candidate_abc_progress: machine={machine_id} split={split} targets={len(target_ids)} scored={len(part)}", flush=True)
    scored = pd.concat(scored_parts, ignore_index=True) if scored_parts else pd.DataFrame()
    if scored.empty:
        raise RuntimeError("No held-out Candidate C windows were scored.")

    global_metrics, by_machine, overlap = _metric_reports(scored)
    comparison = _comparison(scored)
    historical = _historical_regression(
        project_root,
        package,
        adaptation,
        scored.loc[_as_flag(scored, "window_ready_flag")].copy(),
        candidate,
        configs,
    )
    gate = decision_gate(global_metrics, by_machine, comparison, historical)
    _write_json(out_dir / "candidate_c_metrics_global.json", global_metrics)
    _write_json(out_dir / "candidate_c_metrics_by_machine.json", by_machine)
    _write_json(out_dir / "candidate_c_strict_lenient_overlap.json", overlap)
    _write_json(out_dir / "candidate_abc_comparison.json", comparison)
    _write_json(out_dir / "candidate_c_historical_regression.json", historical)
    _write_json(out_dir / "candidate_c_decision_gate.json", gate)
    _write_json(out_dir / "summary.json", {
        "result": "PASS",
        "decision": gate["decision"],
        "output_dir": str(out_dir),
        "write_sql_enabled": False,
        "l2_prediction_run": False,
        "production_artifacts_overwritten": False,
        "production_checkpoint_updated": False,
    })
    scored.to_parquet(out_dir / "candidate_abc_scores.parquet", index=False)
    print("candidate_c_eval_dir:", out_dir)
    return 0
