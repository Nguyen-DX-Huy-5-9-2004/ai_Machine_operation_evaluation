"""Production lineage and read-only Candidate A -> L2 -> policy v2 dry-run."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

import numpy as np
import pandas as pd

from .data_contract import L2_CATEGORICAL_COLUMNS, L2_LEAKAGE_COLUMNS
from .feature_builder_l2 import build_l2_runtime_features
from .l1_shadow import (
    artifact_contract as l1_artifact_contract,
    build_window_manifest,
    combine_shadow_scores,
    load_l1_base_config,
    load_shadow_profile,
    rows_for_ready_windows,
    score_windows,
)
from .l2_scorer import L2Scorer, TARGET_SHORT
from .policy_engine import apply_policy_v2


L1_PROFILES = ("lenient", "strict")
L2_TARGETS = tuple(TARGET_SHORT)
POLICY_CONFIG = Path("modeling/l2_fault_classifier/configs/policy_l2.yaml")
L2_ARTIFACT_ROOT = Path("modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347")
L2_SELECTION = Path("data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json")
L2_FEATURE_POLICY = Path("data/dataModel/l2/prepared_report/l2_feature_policy.json")
L2_CLIP_STATS = Path("data/dataModel/l2/prepared_report/l1_score_clip_stats_train_only.json")
L1_SCORE_AUDIT_COLUMNS = (
    "score_lenient",
    "score_strict",
    "score_lenient_normalized",
    "score_strict_normalized",
)
L2_PROBABILITY_COLUMNS = tuple(f"risk_{short}" for short in TARGET_SHORT.values())


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_content_sha256(payload: Mapping[str, Any]) -> str:
    """Stable manifest identity that intentionally ignores its generation time."""
    stable = {key: value for key, value in payload.items() if key not in {"generated_at", "content_sha256"}}
    return hashlib.sha256(json.dumps(stable, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _relative(root: Path, path: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve())).replace("\\", "/")
    except ValueError:
        return str(path.resolve())


def _json(path: Path, payload: Mapping[str, Any]) -> None:
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


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve(root: Path, value: str | Path) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (root / path).resolve()


def _file_record(root: Path, path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(path)
    return {"path": _relative(root, path), "sha256": _sha256(path), "bytes": int(path.stat().st_size)}


def assert_candidate_a_artifact_dir(root: Path, artifact_dir: Path, profile: str) -> Path:
    expected = (root / "modeling/l1_tcn/artifacts" / profile).resolve()
    actual = artifact_dir.resolve()
    if actual != expected or "artifacts_candidates" in actual.parts:
        raise ValueError(f"Candidate A {profile} must use {expected}; candidate artifacts are forbidden")
    return actual


def _selected_l2(root: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    selection_path = root / L2_SELECTION
    policy_path = root / L2_FEATURE_POLICY
    selection = _read_json(selection_path)
    policy = _read_json(policy_path)
    targets = selection.get("targets")
    if not isinstance(targets, list):
        raise ValueError("production_profile_selection.json must contain a targets list")
    if {str(row.get("target")) for row in targets} != set(L2_TARGETS):
        raise ValueError("production selection does not contain exactly the six production L2 targets")
    selected: dict[str, Any] = {}
    for row in targets:
        target = str(row["target"])
        profile = str(row["selected_profile"])
        model = root / L2_ARTIFACT_ROOT / profile / target / "model.joblib"
        metadata = root / L2_ARTIFACT_ROOT / profile / target / "metadata.json"
        selected[target] = {"selection": dict(row), "profile": profile, "model_path": model, "metadata_path": metadata}
    return selection, policy, selected


def production_artifact_contract(root: Path) -> dict[str, Any]:
    """Validate only the locked Candidate A / selected L2 production assets."""
    l1_root = root / "modeling/l1_tcn/artifacts"
    profiles: dict[str, Any] = {}
    failures: list[str] = []
    for profile in L1_PROFILES:
        artifact_dir = assert_candidate_a_artifact_dir(root, l1_root / profile, profile)
        files = {name: artifact_dir / name for name in ("model_best.pt", "preprocessor.json", "thresholds.json")}
        missing = [name for name, path in files.items() if not path.exists()]
        profiles[profile] = {
            "artifact_dir": _relative(root, artifact_dir),
            "candidate_a_path": True,
            "candidate_c_path_rejected": True,
            "files": {name: _file_record(root, path) for name, path in files.items() if path.exists()},
            "missing": missing,
        }
        if missing:
            failures.append(f"l1_{profile}_missing={missing}")

    selection, policy, selected = _selected_l2(root)
    l2_targets: dict[str, Any] = {}
    for target, item in selected.items():
        missing = [str(path) for path in (item["model_path"], item["metadata_path"]) if not path.exists()]
        metadata = _read_json(item["metadata_path"]) if not missing else {}
        model_features = list(metadata.get("feature_columns") or metadata.get("features") or [])
        policy_features = list(policy.get("feature_profiles", {}).get(item["profile"], []))
        row = {
            "selected_profile": item["profile"],
            "selection": item["selection"],
            "model": _file_record(root, item["model_path"]) if item["model_path"].exists() else None,
            "metadata": _file_record(root, item["metadata_path"]) if item["metadata_path"].exists() else None,
            "feature_order_matches_policy": model_features == policy_features,
            "feature_count": len(model_features),
            "missing": missing,
        }
        if missing or not row["feature_order_matches_policy"]:
            failures.append(f"l2_{target}_artifact_or_feature_order")
        l2_targets[target] = row

    report = {
        "result": "PASS" if not failures else "FAIL",
        "candidate_a_only": True,
        "candidate_b_promoted": False,
        "candidate_c_promoted": False,
        "l1_profiles": profiles,
        "l2_targets": l2_targets,
        "production_selection": _file_record(root, root / L2_SELECTION),
        "l2_feature_policy": _file_record(root, root / L2_FEATURE_POLICY),
        "l1_score_clip_stats_train_only": _file_record(root, root / L2_CLIP_STATS),
        "policy_l2": _file_record(root, root / POLICY_CONFIG),
        "failures": failures,
    }
    return report


def build_production_lineage_manifest(root: Path) -> dict[str, Any]:
    contract = production_artifact_contract(root)
    code_paths = [
        "inference/online/score_new_events.py",
        "inference/online/feature_builder_l1.py",
        "inference/online/feature_builder_l2.py",
        "inference/online/l1_shadow.py",
        "inference/online/l1_scorer.py",
        "inference/online/l2_scorer.py",
        "inference/online/policy_engine.py",
        "inference/online/data_contract.py",
        "inference/online/db.py",
        "inference/online/sql_queries.py",
        "inference/online/runtime_contract.py",
        "inference/online/explainability.py",
        "inference/online/controlled_writer.py",
        "inference/online/worker_lock.py",
        "inference/online/production_lineage_dry_run.py",
        "modeling/l1_tcn/configs/base.yaml",
        "modeling/l2_fault_classifier/src/prepare_l2_features.py",
    ]
    code = {relative: _file_record(root, root / relative) for relative in code_paths}
    fingerprint = hashlib.sha256(json.dumps({key: value["sha256"] for key, value in code.items()}, sort_keys=True).encode("utf-8")).hexdigest()
    selection, policy, selected = _selected_l2(root)
    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "decision": "KEEP_CURRENT_MODEL_AND_THRESHOLDS",
        "candidate_a": contract["l1_profiles"],
        "l1_window_size": 20,
        "l1_feature_order": list(_read_json(root / "modeling/l1_tcn/artifacts/lenient/preprocessor.json")["spec"]["categorical_columns"])
        + list(_read_json(root / "modeling/l1_tcn/artifacts/lenient/preprocessor.json")["spec"]["continuous_columns"])
        + list(_read_json(root / "modeling/l1_tcn/artifacts/lenient/preprocessor.json")["spec"]["binary_columns"]),
        "l2_run_id": "l2_multilabel_20260711_043347",
        "l2_selected_models": {
            target: {
                "selected_profile": item["profile"],
                "model": _file_record(root, item["model_path"]),
                "metadata": _file_record(root, item["metadata_path"]),
            }
            for target, item in selected.items()
        },
        "production_profile_selection": contract["production_selection"],
        "l2_feature_policy": contract["l2_feature_policy"],
        "l1_score_clip_stats_train_only": contract["l1_score_clip_stats_train_only"],
        "policy_l2": contract["policy_l2"],
        "code_files": code,
        "code_fingerprint": fingerprint,
        "candidate_b_promoted": False,
        "candidate_c_promoted": False,
        "automatic_promotion": False,
        "sql_write_enabled": False,
        "future_fault_30min_60min_status": "CONTRACT_VALID_BUT_NOT_RECOMMENDED_FOR_FUTURE_RETRAINING",
        "notes": [
            "Candidate A remains the L1 production candidate after the locked A/B/C decision.",
            "Candidate B is rejected and Candidate C is archived for research only; neither is promoted.",
            "This manifest deliberately excludes large datasets and the Candidate C package from hashing.",
        ],
        "artifact_contract_result": contract["result"],
    }
    manifest["content_sha256"] = manifest_content_sha256(manifest)
    output = root / "data/runtime_manifest/ai_production_lineage_manifest.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    _json(output, manifest)
    return manifest


def _package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def build_runtime_environment_manifest(root: Path) -> dict[str, Any]:
    """Record the runtime versions needed to safely deserialize production artifacts."""
    required_sklearn = "1.6.1"
    runtime_sklearn = _package_version("scikit-learn")
    warning_status = (
        "WARNING_RUNTIME_SKLEARN_VERSION_DIFFERS_FROM_TRAINING"
        if runtime_sklearn != required_sklearn
        else "PASS_RUNTIME_SKLEARN_VERSION_MATCHES_TRAINING"
    )
    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "python_version": sys.version,
        "numpy_version": _package_version("numpy"),
        "pandas_version": _package_version("pandas"),
        "scikit_learn_required_version": required_sklearn,
        "scikit_learn_runtime_version": runtime_sklearn,
        "lightgbm_version": _package_version("lightgbm"),
        "torch_version": _package_version("torch"),
        "artifact_serialization_warning_status": warning_status,
        "production_runtime_recommendation": "PIN_SCIKIT_LEARN_TO_1_6_1_BEFORE_PRODUCTION",
        "artifact_reserialization_performed": False,
    }
    manifest["content_sha256"] = manifest_content_sha256(manifest)
    output = root / "data/runtime_manifest/ai_runtime_environment.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    _json(output, manifest)
    return manifest


def build_runtime_bundle_manifest(root: Path, lineage: Mapping[str, Any]) -> dict[str, Any]:
    environment_manifest = root / "data/runtime_manifest/ai_runtime_environment.json"
    if not environment_manifest.exists():
        build_runtime_environment_manifest(root)
    files: list[str] = []
    for profile in lineage["candidate_a"].values():
        files.extend(record["path"] for record in profile["files"].values())
    for target in lineage["l2_selected_models"].values():
        files.extend([target["model"]["path"], target["metadata"]["path"]])
    files.extend([
        lineage["production_profile_selection"]["path"],
        lineage["l2_feature_policy"]["path"],
        lineage["l1_score_clip_stats_train_only"]["path"],
        lineage["policy_l2"]["path"],
        "modeling/l1_tcn/configs/base.yaml",
        *lineage["code_files"].keys(),
        "requirements2.txt",
        "data/runtime_manifest/ai_production_lineage_manifest.json",
        "data/runtime_manifest/ai_runtime_environment.json",
    ])
    unique = sorted(dict.fromkeys(files))
    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "purpose": "read_only_runtime_bundle_inventory",
        "files": [{"path": path, "sha256": _sha256(root / path)} for path in unique],
        "excludes_large_datasets": True,
        "excludes_candidate_c_artifacts": True,
    }
    manifest["content_sha256"] = manifest_content_sha256(manifest)
    _json(root / "data/runtime_manifest/ai_runtime_bundle_manifest.json", manifest)
    return manifest


def verify_runtime_bundle_integrity(root: Path) -> dict[str, Any]:
    """Read-only integrity and environment gate for a relocated runtime bundle."""
    manifest_path = root / "data/runtime_manifest/ai_runtime_bundle_manifest.json"
    if not manifest_path.exists():
        return {
            "result": "FAIL",
            "failure_reason": "RUNTIME_BUNDLE_MANIFEST_MISSING",
            "file_records": [],
            "candidate_c_excluded": False,
        }
    manifest = _read_json(manifest_path)
    records: list[dict[str, Any]] = []
    candidate_c_paths: list[str] = []
    for item in manifest.get("files", []):
        relative = str(item.get("path", ""))
        if "artifacts_candidates" in relative or "l1_candidate_c" in relative:
            candidate_c_paths.append(relative)
        resolved = (root / relative).resolve()
        inside_root = resolved == root.resolve() or root.resolve() in resolved.parents
        exists = inside_root and resolved.is_file()
        actual = _sha256(resolved) if exists else None
        expected = item.get("sha256")
        records.append({
            "path": relative,
            "exists": exists,
            "inside_project_root": inside_root,
            "expected_sha256": expected,
            "actual_sha256": actual,
            "hash_match": bool(exists and actual == expected),
        })
    requirements = root / "requirements2.txt"
    requirements_text = requirements.read_text(encoding="utf-8") if requirements.exists() else ""
    requirements_pin_ok = any(
        line.strip().lower() == "scikit-learn==1.6.1"
        for line in requirements_text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    )
    environment_path = root / "data/runtime_manifest/ai_runtime_environment.json"
    environment_manifest = _read_json(environment_path) if environment_path.exists() else {}
    required_sklearn = str(environment_manifest.get("scikit_learn_required_version", "1.6.1"))
    runtime_sklearn = _package_version("scikit-learn")
    environment_result = "PASS" if runtime_sklearn == required_sklearn else "WARNING_RUNTIME_SKLEARN_VERSION_MISMATCH"
    integrity_pass = bool(records) and all(record["hash_match"] for record in records)
    candidate_c_excluded = not candidate_c_paths
    result = "PASS" if integrity_pass and candidate_c_excluded and requirements_pin_ok and environment_result == "PASS" else "FAIL"
    return {
        "result": result,
        "manifest_path": _relative(root, manifest_path),
        "file_records": records,
        "missing_files": [record["path"] for record in records if not record["exists"]],
        "hash_mismatches": [record["path"] for record in records if record["exists"] and not record["hash_match"]],
        "candidate_c_excluded": candidate_c_excluded,
        "candidate_c_paths_found": candidate_c_paths,
        "requirements2_sklearn_pin_ok": requirements_pin_ok,
        "environment_check": {
            "result": environment_result,
            "python_version": sys.version,
            "numpy_version": _package_version("numpy"),
            "pandas_version": _package_version("pandas"),
            "scikit_learn_required_version": required_sklearn,
            "scikit_learn_runtime_version": runtime_sklearn,
            "lightgbm_version": _package_version("lightgbm"),
            "torch_version": _package_version("torch"),
            "artifact_serialization_warning_status": environment_manifest.get("artifact_serialization_warning_status"),
        },
    }


def run_runtime_relocation_verification(root: Path, output_root: Path) -> Path:
    """Write a read-only bundle verification audit after the project is relocated."""
    report = verify_runtime_bundle_integrity(root)
    out_dir = output_root / f"runtime_relocation_check_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    environment = report.pop("environment_check")
    file_integrity_result = "PASS" if not report["missing_files"] and not report["hash_mismatches"] else "FAIL"
    _json(out_dir / "file_integrity.json", {
        **report,
        "result": file_integrity_result,
        "overall_relocation_result": report["result"],
    })
    _json(out_dir / "environment_check.json", environment)
    _json(out_dir / "00_summary.json", {
        "result": report["result"],
        "mode": "READ_ONLY_RUNTIME_RELOCATION_VERIFICATION",
        "sql_writes": 0,
        "training_run": False,
        "candidate_c_runtime_artifact_used": False,
        "production_artifacts_changed": False,
        "file_integrity_result": file_integrity_result,
        "environment_result": environment["result"],
        "requirements2_sklearn_pin_ok": report["requirements2_sklearn_pin_ok"],
        "candidate_c_excluded": report["candidate_c_excluded"],
    })
    return out_dir


def _parquet_inputs(sample_path: Path) -> list[Path]:
    if sample_path.is_file():
        return [sample_path]
    paths = sorted(path for path in sample_path.rglob("*.parquet") if path.name == "events.parquet" or "canonical" in path.parts)
    if not paths:
        raise FileNotFoundError(f"No canonical event parquet found below {sample_path}")
    return paths


def _choose_candidate_ids(frame: pd.DataFrame, limit: int) -> set[int]:
    closed = frame[pd.to_numeric(frame.get("is_open_event", 1), errors="coerce").fillna(1).eq(0)].copy()
    if closed.empty or limit <= 0:
        return set()
    closed = closed.sort_values(["machine_id", "sequence_segment_id", "event_order_in_segment", "event_id"], kind="mergesort")
    positions = np.linspace(0, len(closed) - 1, min(limit, len(closed)), dtype=int)
    return set(closed.iloc[positions]["event_id"].astype(int))


def _choose_l1_ready_candidate_ids(frame: pd.DataFrame, limit: int) -> set[int]:
    """Choose only closed targets that can form a real 20-event L1 window."""
    closed = frame[pd.to_numeric(frame.get("is_open_event", 1), errors="coerce").fillna(1).eq(0)].copy()
    required = {"machine_id", "sequence_segment_id", "event_order_in_segment", "event_id"}
    if closed.empty or limit <= 0 or not required.issubset(closed.columns):
        return set()
    ready = closed[pd.to_numeric(closed["event_order_in_segment"], errors="coerce").fillna(0).ge(20)].copy()
    if ready.empty:
        return set()
    ready = ready.sort_values(["machine_id", "sequence_segment_id", "event_order_in_segment", "event_id"], kind="mergesort")
    positions = np.linspace(0, len(ready) - 1, min(limit, len(ready)), dtype=int)
    return set(ready.iloc[positions]["event_id"].astype(int))


def _l1_runtime_columns(scores: pd.DataFrame) -> pd.DataFrame:
    out = scores[["event_id", "window_ready_flag", "not_scored_reason", "score_lenient", "score_strict", "threshold_lenient", "threshold_strict", "score_lenient_normalized", "score_strict_normalized", "is_anomaly_lenient", "is_anomaly_strict", "is_behavior_anomaly", "is_sensitive_warning"]].copy()
    out = out.rename(columns={"score_lenient_normalized": "score_lenient_norm", "score_strict_normalized": "score_strict_norm"})
    # Keep audit aliases alongside the established L2 runtime `_norm` names.
    # They carry the same model output and are never model input features.
    out["score_lenient_normalized"] = out["score_lenient_norm"]
    out["score_strict_normalized"] = out["score_strict_norm"]
    out["behavior_anomaly_score"] = pd.to_numeric(out["score_lenient_norm"], errors="coerce").fillna(0.0)
    out["behavior_sensitive_score"] = pd.to_numeric(out["score_strict_norm"], errors="coerce").fillna(0.0)
    out["behavior_combined_score"] = out[["behavior_anomaly_score", "behavior_sensitive_score"]].max(axis=1)
    out["l1_score_available_flag"] = pd.to_numeric(out["window_ready_flag"], errors="coerce").fillna(0).astype("int8")
    out["l1_join_missing_flag"] = (out["l1_score_available_flag"] == 0).astype("int8")
    out["readiness_reason"] = np.where(
        out["l1_score_available_flag"].eq(1),
        "READY",
        out["not_scored_reason"].fillna("").astype(str).str.strip(),
    )
    return out.drop(columns=["window_ready_flag"])


def _add_train_fitted_l2_stabilization(root: Path, frame: pd.DataFrame) -> pd.DataFrame:
    source = root / "modeling/l2_fault_classifier/src"
    if str(source) not in sys.path:
        sys.path.insert(0, str(source))
    from prepare_l2_features import add_l1_stabilized_features  # type: ignore

    return add_l1_stabilized_features(frame, _read_json(root / L2_CLIP_STATS))


def add_train_fitted_l2_stabilization(root: Path, frame: pd.DataFrame) -> pd.DataFrame:
    """Public runtime adapter for the train-only L1 score clip statistics."""
    return _add_train_fitted_l2_stabilization(root, frame)


def validate_selected_l2_feature_contract(frame: pd.DataFrame, root: Path, *, loaded_models: Mapping[str, Any] | None = None) -> dict[str, Any]:
    _, policy, selected = _selected_l2(root)
    targets: dict[str, Any] = {}
    failed = False
    for target, item in selected.items():
        metadata = _read_json(item["metadata_path"])
        expected = list(metadata.get("feature_columns") or metadata.get("features") or [])
        policy_order = list(policy.get("feature_profiles", {}).get(item["profile"], []))
        categorical = list(metadata.get("categorical_features") or [])
        missing = [column for column in expected if column not in frame.columns]
        extra = [column for column in expected if column not in policy_order]
        order_match = expected == policy_order
        non_finite: dict[str, int] = {}
        dtype_mismatches: dict[str, str] = {}
        if not missing:
            for column in expected:
                values = pd.to_numeric(frame[column], errors="coerce")
                if values.notna().sum() < frame[column].notna().sum():
                    dtype_mismatches[column] = str(frame[column].dtype)
                count = int((~np.isfinite(values.to_numpy(dtype=float, na_value=np.nan))).sum())
                if count:
                    non_finite[column] = count
        model_order_match = True
        if loaded_models and target in loaded_models:
            model = loaded_models[target]
            actual = list(getattr(model, "feature_name_", []) or [])
            if not actual and hasattr(model, "booster_"):
                actual = list(model.booster_.feature_name())
            model_order_match = not actual or actual == expected
        result = "PASS" if not (missing or extra or not order_match or non_finite or dtype_mismatches or not model_order_match) else "FAIL"
        failed = failed or result == "FAIL"
        targets[target] = {
            "result": result,
            "selected_profile": item["profile"],
            "feature_order": expected,
            "policy_feature_order": policy_order,
            "feature_order_match": order_match,
            "loaded_model_feature_order_match": model_order_match,
            "missing_features": missing,
            "extra_features_not_permitted": extra,
            "dtype_mismatches": dtype_mismatches,
            "non_finite_by_feature": non_finite,
            "categorical_features": categorical,
            "categorical_contract_match": set(categorical).issubset(set(L2_CATEGORICAL_COLUMNS)),
        }
        if not targets[target]["categorical_contract_match"]:
            failed = True
            targets[target]["result"] = "FAIL"
    leakage = [column for column in L2_LEAKAGE_COLUMNS if column in frame.columns]
    return {"result": "FAIL" if failed or leakage else "PASS", "targets": targets, "leakage_columns_present": leakage}


def _l2_input_readiness(frame: pd.DataFrame, root: Path) -> tuple[pd.Series, pd.Series]:
    """Keep rows with an unresolved L2 input out of L2 prediction and policy."""
    _, _, selected = _selected_l2(root)
    required = list(dict.fromkeys(
        column
        for item in selected.values()
        for column in list(_read_json(item["metadata_path"]).get("feature_columns") or _read_json(item["metadata_path"]).get("features") or [])
    ))
    ready = pd.Series(True, index=frame.index, dtype=bool)
    reasons = pd.Series("READY", index=frame.index, dtype="object")
    for column in required:
        if column not in frame.columns:
            bad = pd.Series(True, index=frame.index)
            reason = f"L2_MISSING_REQUIRED_FEATURE:{column}"
        else:
            values = pd.to_numeric(frame[column], errors="coerce").to_numpy(dtype=float, na_value=np.nan)
            bad = pd.Series(~np.isfinite(values), index=frame.index)
            reason = f"L2_NON_FINITE_REQUIRED_FEATURE:{column}"
        first_failure = ready & bad
        reasons.loc[first_failure] = reason
        ready &= ~bad
    return ready, reasons


def l2_input_readiness(frame: pd.DataFrame, root: Path) -> tuple[pd.Series, pd.Series]:
    """Public per-row L2 readiness contract used by online and audit paths."""
    return _l2_input_readiness(frame, root)


def _distribution(series: pd.Series) -> dict[str, Any]:
    numeric = pd.to_numeric(series, errors="coerce")
    return {
        "count": int(numeric.notna().sum()), "nan_or_inf": int((~np.isfinite(numeric.to_numpy(dtype=float, na_value=np.nan))).sum()),
        "min": float(numeric.min()) if numeric.notna().any() else None,
        "mean": float(numeric.mean()) if numeric.notna().any() else None,
        "p50": float(numeric.quantile(.5)) if numeric.notna().any() else None,
        "p95": float(numeric.quantile(.95)) if numeric.notna().any() else None,
        "p99": float(numeric.quantile(.99)) if numeric.notna().any() else None,
        "max": float(numeric.max()) if numeric.notna().any() else None,
    }


def _value_finiteness(frame: pd.DataFrame, columns: Iterable[str]) -> dict[str, int]:
    """Count finite/non-finite model values without treating unready rows as scored."""
    values = 0
    finite = 0
    for column in columns:
        series = frame[column] if column in frame.columns else pd.Series(np.nan, index=frame.index)
        numeric = pd.to_numeric(series, errors="coerce").to_numpy(dtype=float, na_value=np.nan)
        values += len(numeric)
        finite += int(np.isfinite(numeric).sum())
    return {"value_count": int(values), "finite_value_count": int(finite), "nan_or_inf_count": int(values - finite)}


def _l1_runtime_readiness_summary(scored: pd.DataFrame, l1_contract: Mapping[str, Any]) -> dict[str, Any]:
    ready_mask = pd.to_numeric(scored.get("window_ready_flag", 0), errors="coerce").fillna(0).eq(1)
    ready = scored.loc[ready_mask].copy()
    unready = scored.loc[~ready_mask].copy()
    ready_counts = _value_finiteness(ready, L1_SCORE_AUDIT_COLUMNS)
    unready_counts = _value_finiteness(unready, L1_SCORE_AUDIT_COLUMNS)
    readiness_reason = unready.get("readiness_reason", unready.get("not_scored_reason", pd.Series("", index=unready.index)))
    readiness_reason = readiness_reason.fillna("").astype(str).str.strip()
    missing_reason_count = int(readiness_reason.eq("").sum())
    unexpected_unready_score_count = int(unready_counts["finite_value_count"])
    result = "PASS" if (
        l1_contract.get("result") == "PASS"
        and ready_counts["nan_or_inf_count"] == 0
        and missing_reason_count == 0
        and unexpected_unready_score_count == 0
    ) else "FAIL"
    return {
        "result": result,
        "total_sampled_rows": int(len(scored)),
        "ready_rows": int(len(ready)),
        "unready_rows": int(len(unready)),
        "ready_l1_score_finite_count": int(ready_counts["finite_value_count"]),
        "ready_l1_score_finite_row_count": int(len(ready)) if ready_counts["nan_or_inf_count"] == 0 else int(
            pd.DataFrame({column: pd.to_numeric(ready.get(column), errors="coerce") for column in L1_SCORE_AUDIT_COLUMNS})
            .apply(lambda row: np.isfinite(row.to_numpy(dtype=float)).all(), axis=1).sum()
        ),
        "ready_l1_score_nan_or_inf_count": int(ready_counts["nan_or_inf_count"]),
        "unready_l1_expected_missing_value_count": int(unready_counts["nan_or_inf_count"]),
        "unready_l1_unexpected_finite_score_count": unexpected_unready_score_count,
        "unready_missing_readiness_reason_count": missing_reason_count,
        "readiness_reason_distribution": readiness_reason.value_counts().astype(int).to_dict(),
        "strict_only_count": int(pd.to_numeric(ready.get("is_sensitive_warning", 0), errors="coerce").fillna(0).sum()),
        "is_behavior_anomaly_count": int(pd.to_numeric(ready.get("is_behavior_anomaly", 0), errors="coerce").fillna(0).sum()),
        "l1_contract_result": l1_contract.get("result"),
    }


def _l2_runtime_readiness_summary(ready: pd.DataFrame, unready: pd.DataFrame) -> dict[str, Any]:
    ready_counts = _value_finiteness(ready, L2_PROBABILITY_COLUMNS)
    unready_counts = _value_finiteness(unready, L2_PROBABILITY_COLUMNS)
    ready_missing_policy = int(
        ready.reindex(columns=["operational_action_level", "operational_judgment"]).isna().any(axis=1).sum()
    )
    unready_flags_invalid = int(
        pd.to_numeric(unready.get("l2_ready_flag", 0), errors="coerce").fillna(0).ne(0).sum()
    )
    unready_missing_reason = int(
        unready.get("readiness_reason", pd.Series("", index=unready.index)).fillna("").astype(str).str.strip().eq("").sum()
    )
    unready_reasons = unready.get("readiness_reason", pd.Series("", index=unready.index)).fillna("").astype(str).str.strip()
    unready_action_count = int(
        unready.reindex(columns=["operational_action_level", "operational_judgment"]).notna().any(axis=1).sum()
    )
    result = "PASS" if (
        ready_counts["nan_or_inf_count"] == 0
        and ready_missing_policy == 0
        and unready_counts["finite_value_count"] == 0
        and unready_flags_invalid == 0
        and unready_missing_reason == 0
        and unready_action_count == 0
    ) else "FAIL"
    return {
        "result": result,
        "ready_rows": int(len(ready)),
        "unready_rows": int(len(unready)),
        "ready_l2_probability_finite_count": int(ready_counts["finite_value_count"]),
        "ready_l2_probability_nan_or_inf_count": int(ready_counts["nan_or_inf_count"]),
        "unready_l2_expected_missing_value_count": int(unready_counts["nan_or_inf_count"]),
        "unready_l2_unexpected_finite_probability_count": int(unready_counts["finite_value_count"]),
        "ready_missing_policy_result_count": ready_missing_policy,
        "unready_l2_ready_flag_violation_count": unready_flags_invalid,
        "unready_missing_readiness_reason_count": unready_missing_reason,
        "unready_readiness_reason_distribution": unready_reasons.value_counts().astype(int).to_dict(),
        "unready_action_or_judgment_count": unready_action_count,
    }


def _dry_run_result(*reports: Mapping[str, Any]) -> str:
    return "PASS" if all(report.get("result") == "PASS" for report in reports) else "FAIL"


def _window_boundary_violations(context: pd.DataFrame, manifest: pd.DataFrame) -> dict[str, int]:
    """Verify each ready manifest window stays inside its machine and segment."""
    if context.empty or manifest.empty:
        return {"cross_machine": 0, "cross_segment": 0, "missing_source_events": 0}
    lookup = context.set_index("event_id")[["machine_id", "sequence_segment_id"]]
    cross_machine = cross_segment = missing_source_events = 0
    for row in manifest.itertuples(index=False):
        if int(getattr(row, "window_ready_flag", 0) or 0) != 1:
            continue
        source_ids = [int(value) for value in str(getattr(row, "window_event_ids", "")).split("|") if value]
        source = lookup.reindex(source_ids)
        if source["machine_id"].isna().any() or source["sequence_segment_id"].isna().any():
            missing_source_events += 1
            continue
        if not source["machine_id"].eq(getattr(row, "machine_id")).all():
            cross_machine += 1
        if not source["sequence_segment_id"].eq(getattr(row, "sequence_segment_id")).all():
            cross_segment += 1
    return {"cross_machine": cross_machine, "cross_segment": cross_segment, "missing_source_events": missing_source_events}


def _policy_contract(final: pd.DataFrame, thresholds: Mapping[str, float]) -> dict[str, Any]:
    allowed_actions = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    no_monitor = not final["operational_action_level"].isin({"MONITOR", "SENSITIVE_BEHAVIOR_MONITOR"}).any()
    strict_only = (pd.to_numeric(final["is_sensitive_warning"], errors="coerce").fillna(0) == 1) & (pd.to_numeric(final["is_behavior_anomaly"], errors="coerce").fillna(0) == 0)
    baseline = final.copy()
    baseline["is_sensitive_warning"] = 0
    baseline_action = apply_policy_v2(baseline, thresholds)["operational_action_level"]
    strict_only_uplift = int((final.loc[strict_only, "operational_action_level"] != baseline_action.loc[strict_only]).sum())
    return {
        "result": "PASS" if no_monitor and set(final["operational_action_level"]).issubset(allowed_actions) and strict_only_uplift == 0 else "FAIL",
        "action_distribution": final["operational_action_level"].value_counts().to_dict(),
        "risk_distribution": _distribution(final["operational_overall_risk_score"]),
        "strict_only_count": int(strict_only.sum()),
        "is_behavior_anomaly_count": int(pd.to_numeric(final["is_behavior_anomaly"], errors="coerce").fillna(0).sum()),
        "no_monitor_assertion": no_monitor,
        "strict_only_action_uplift_count": strict_only_uplift,
    }


def run_production_compatibility_dry_run(
    root: Path,
    sample_path: Path,
    output_root: Path,
    *,
    sample_size: int = 1000,
    batch_size: int = 512,
    per_machine_sample_size: int | None = None,
) -> Path:
    """Score a canonical Parquet sample using Candidate A and selected L2 models only."""
    lineage = build_production_lineage_manifest(root)
    if lineage["artifact_contract_result"] != "PASS":
        raise RuntimeError("production artifact contract failed")
    build_runtime_environment_manifest(root)
    bundle = build_runtime_bundle_manifest(root, lineage)
    before = {item["path"]: item["sha256"] for item in bundle["files"]}
    audit_prefix = "l1_l2_policy_multi_machine_smoke" if per_machine_sample_size is not None else "l1_l2_policy_dry_run"
    out_dir = output_root / f"{audit_prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)

    base_cfg = load_l1_base_config(root)
    profiles = [load_shadow_profile(root, profile, base_cfg, artifact_dir=root / "modeling/l1_tcn/artifacts" / profile) for profile in L1_PROFILES]
    l1_contract = l1_artifact_contract(root, profiles, base_cfg)
    partitions = _parquet_inputs(sample_path)
    per_partition = max(1, int(np.ceil(sample_size / len(partitions))))
    all_results: list[pd.DataFrame] = []
    scored_parts: list[pd.DataFrame] = []
    l1_ready = l1_unready = l2_ready = l2_unready = raw_rows = sampled_rows = 0
    machine_input_rows: dict[int, int] = {}
    machine_sampled_rows: dict[int, int] = {}
    machine_window_violations: dict[int, dict[str, int]] = {}
    l2_contract_reports: list[dict[str, Any]] = []
    l2_prediction_parts: list[pd.DataFrame] = []
    scorer: L2Scorer | None = None

    for parquet_path in partitions:
        context = pd.read_parquet(parquet_path)
        raw_rows += len(context)
        machine_ids = pd.to_numeric(context.get("machine_id"), errors="coerce").dropna().astype(int).unique().tolist()
        if len(machine_ids) != 1:
            raise ValueError(f"Canonical partition must contain exactly one machine: {parquet_path}")
        machine_id = machine_ids[0]
        machine_input_rows[machine_id] = int(len(context))
        candidate_limit = int(per_machine_sample_size) if per_machine_sample_size is not None else per_partition
        candidate_ids = (
            _choose_l1_ready_candidate_ids(context, candidate_limit)
            if per_machine_sample_size is not None
            else _choose_candidate_ids(context, candidate_limit)
        )
        machine_sampled_rows[machine_id] = int(len(candidate_ids))
        if not candidate_ids:
            continue
        sampled_rows += len(candidate_ids)
        manifest = build_window_manifest(context, candidate_ids, window_size=20)
        machine_window_violations[machine_id] = _window_boundary_violations(context, manifest)
        ready_rows = rows_for_ready_windows(context, manifest)
        profile_scores = {profile.profile: score_windows(profile, base_cfg, ready_rows, batch_size=batch_size)[0] for profile in profiles}
        scored = combine_shadow_scores(manifest, profile_scores["lenient"], profile_scores["strict"])
        scored_parts.append(scored)
        l1_ready += int((scored["window_ready_flag"] == 1).sum())
        l1_unready += int((scored["window_ready_flag"] != 1).sum())
        targets = context[context["event_id"].astype(int).isin(candidate_ids)].copy()
        l1_runtime = _l1_runtime_columns(scored)
        runtime = build_l2_runtime_features(targets, l1_scores=l1_runtime, config=None, model_metadata=None)
        runtime = _add_train_fitted_l2_stabilization(root, runtime)
        # L2 preparation deliberately fills its score-derived columns so its
        # feature contract can be evaluated. Restore the original L1 model
        # outputs for audit rows; unready windows must remain visibly missing.
        l1_by_event = l1_runtime.set_index("event_id")
        for column in L1_SCORE_AUDIT_COLUMNS:
            runtime[column] = runtime["event_id"].map(l1_by_event[column])
        runtime["readiness_reason"] = runtime["event_id"].map(l1_by_event["readiness_reason"])
        l1_ready_mask = pd.to_numeric(runtime["l1_score_available_flag"], errors="coerce").fillna(0).eq(1)
        l2_feature_ready_mask, l2_reasons = _l2_input_readiness(runtime, root)
        ready_mask = l1_ready_mask & l2_feature_ready_mask
        runtime.loc[l1_ready_mask & ~l2_feature_ready_mask, "readiness_reason"] = l2_reasons.loc[l1_ready_mask & ~l2_feature_ready_mask]
        l2_ready += int(ready_mask.sum())
        l2_unready += int((~ready_mask).sum())
        if not ready_mask.any():
            all_results.append(runtime)
            continue
        ready = runtime.loc[ready_mask].copy()
        if scorer is None:
            scorer = L2Scorer({"obad_root": str(root), "l2_artifact_dir": str(L2_ARTIFACT_ROOT), "l2_production_selection": str(L2_SELECTION), "l2_feature_policy": str(L2_FEATURE_POLICY)})
        report = validate_selected_l2_feature_contract(ready, root, loaded_models=scorer.models)
        l2_contract_reports.append(report)
        if report["result"] != "PASS":
            failed_targets = {
                target: {
                    "missing_features": value["missing_features"],
                    "dtype_mismatches": value["dtype_mismatches"],
                    "non_finite_by_feature": value["non_finite_by_feature"],
                }
                for target, value in report["targets"].items()
                if value["result"] != "PASS"
            }
            raise RuntimeError(f"L2 runtime feature contract failed for machine_id={machine_id}: {failed_targets}")
        predicted = scorer.predict(ready)
        final = apply_policy_v2(predicted, scorer.thresholds, threshold_epsilon=1e-6)
        l2_prediction_parts.append(final)
        all_results.append(runtime.loc[~ready_mask])

    if scorer is None or not l2_prediction_parts:
        raise RuntimeError("No L2-ready rows in provided canonical sample")
    final = pd.concat(l2_prediction_parts, ignore_index=True)
    final["l2_ready_flag"] = 1
    unready = pd.concat(all_results, ignore_index=True) if all_results else pd.DataFrame()
    if not unready.empty:
        unready["l2_ready_flag"] = 0
        for column in [*L2_PROBABILITY_COLUMNS, "operational_action_level", "operational_judgment", "operational_overall_risk_score"]:
            unready[column] = pd.NA
    output_rows = pd.concat([final, unready], ignore_index=True, sort=False)
    policy = _policy_contract(final, scorer.thresholds)
    after = {item["path"]: _sha256(root / item["path"]) for item in bundle["files"]}
    immutability = {"result": "PASS" if before == after else "FAIL", "artifact_hashes_before": before, "artifact_hashes_after": after, "sql_writes": 0, "production_artifacts_changed": before != after}
    all_scored = pd.concat(scored_parts, ignore_index=True) if scored_parts else pd.DataFrame()
    l1_summary = _l1_runtime_readiness_summary(all_scored, l1_contract)
    l2_readiness = _l2_runtime_readiness_summary(final, unready)
    l2_summary = {
        **l2_readiness,
        "targets": {short: _distribution(final[f"risk_{short}"]) for short in TARGET_SHORT.values()},
        "selected_model_paths": {target: _relative(root, root / L2_ARTIFACT_ROOT / item["profile"] / target / "model.joblib") for target, item in _selected_l2(root)[2].items()},
    }
    contract = {"result": "PASS" if l2_contract_reports and all(report["result"] == "PASS" for report in l2_contract_reports) else "FAIL", "partition_reports": l2_contract_reports}
    summary = {"result": _dry_run_result(l1_summary, contract, l2_summary, policy, immutability), "mode": "READ_ONLY_PRODUCTION_COMPATIBILITY_DRY_RUN", "raw_event_count": raw_rows, "sampled_rows": sampled_rows, "l1_ready_count": l1_ready, "l1_unready_count": l1_unready, "l2_ready_count": l2_ready, "l2_unready_count": l2_unready, "sql_writes": 0, "training_run": False, "l2_dataset_rebuilt": False, "candidate_c_promoted": False, "production_artifacts_changed": before != after}

    smoke_global: dict[str, Any] | None = None
    smoke_by_machine: dict[str, Any] | None = None
    if per_machine_sample_size is not None:
        smoke_global, smoke_by_machine = _multi_machine_smoke_reports(
            output_rows,
            all_scored,
            machine_input_rows,
            machine_sampled_rows,
            machine_window_violations,
            scorer.thresholds,
            requested_per_machine=int(per_machine_sample_size),
        )
        summary["mode"] = "READ_ONLY_PRODUCTION_MULTI_MACHINE_SMOKE"
        summary["multi_machine_smoke_result"] = smoke_global["result"]
        summary["machine_count"] = smoke_global["machine_count"]
        summary["result"] = _dry_run_result(summary, smoke_global)

    _json(out_dir / "artifact_contract.json", {"result": "PASS" if lineage["artifact_contract_result"] == "PASS" and l1_contract.get("result") == "PASS" else "FAIL", "production_lineage_contract": production_artifact_contract(root), "l1_loaded_model_contract": l1_contract})
    _json(out_dir / "l1_runtime_summary.json", l1_summary)
    _json(out_dir / "l2_feature_contract.json", contract)
    _json(out_dir / "l2_prediction_summary.json", l2_summary)
    _json(out_dir / "policy_distribution.json", policy)
    _json(out_dir / "production_immutability.json", immutability)
    output_columns = [column for column in ["event_id", "machine_id", "event_start_time", "status_id", "l1_score_available_flag", "l2_ready_flag", "readiness_reason", *L1_SCORE_AUDIT_COLUMNS, "is_behavior_anomaly", "is_sensitive_warning", *L2_PROBABILITY_COLUMNS, "operational_action_level", "operational_judgment"] if column in output_rows.columns]
    output_rows.reindex(columns=output_columns).to_csv(out_dir / "dry_run_sample_results.csv.gz", index=False, compression="gzip", encoding="utf-8")
    _json(out_dir / "00_summary.json", summary)
    if smoke_global is not None and smoke_by_machine is not None:
        _json(out_dir / "multi_machine_smoke_global.json", smoke_global)
        _json(out_dir / "multi_machine_smoke_by_machine.json", smoke_by_machine)
        all_scored.to_csv(out_dir / "smoke_window_manifest.csv.gz", index=False, compression="gzip", encoding="utf-8")
    return out_dir


def _multi_machine_smoke_reports(
    output_rows: pd.DataFrame,
    window_manifest: pd.DataFrame,
    machine_input_rows: Mapping[int, int],
    machine_sampled_rows: Mapping[int, int],
    machine_window_violations: Mapping[int, Mapping[str, int]],
    thresholds: Mapping[str, float],
    *,
    requested_per_machine: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    by_machine: dict[str, Any] = {}
    for machine_id in sorted(machine_input_rows):
        rows = output_rows[pd.to_numeric(output_rows["machine_id"], errors="coerce").eq(machine_id)].copy()
        l1_ready = rows[pd.to_numeric(rows["l1_score_available_flag"], errors="coerce").fillna(0).eq(1)].copy()
        ready = rows[pd.to_numeric(rows["l2_ready_flag"], errors="coerce").fillna(0).eq(1)].copy()
        l1_unready = rows[pd.to_numeric(rows["l1_score_available_flag"], errors="coerce").fillna(0).eq(0)].copy()
        unready = rows[pd.to_numeric(rows["l2_ready_flag"], errors="coerce").fillna(0).eq(0)].copy()
        window_rows = window_manifest[pd.to_numeric(window_manifest["machine_id"], errors="coerce").eq(machine_id)].copy()
        boundary = machine_window_violations.get(machine_id, {})
        policy = _policy_contract(ready, thresholds) if not ready.empty else {
            "result": "FAIL", "no_monitor_assertion": False, "strict_only_action_uplift_count": 0, "action_distribution": {},
        }
        l1_values = _value_finiteness(l1_ready, L1_SCORE_AUDIT_COLUMNS)
        l2_values = _value_finiteness(ready, L2_PROBABILITY_COLUMNS)
        by_machine[str(machine_id)] = {
            "raw_context_rows": int(machine_input_rows[machine_id]),
            "sampled_rows": int(machine_sampled_rows.get(machine_id, 0)),
            "l1_ready_rows": int(len(l1_ready)),
            "l1_unready_rows": int(len(l1_unready)),
            "l2_ready_rows": int(len(ready)),
            "l2_unready_rows": int(len(unready)),
            "l2_unready_readiness_reason_distribution": unready.get("readiness_reason", pd.Series("", index=unready.index)).fillna("").astype(str).str.strip().value_counts().astype(int).to_dict(),
            "ready_l1_score_nan_or_inf_count": int(l1_values["nan_or_inf_count"]),
            "ready_l2_probability_nan_or_inf_count": int(l2_values["nan_or_inf_count"]),
            "is_behavior_anomaly_count": int(pd.to_numeric(ready.get("is_behavior_anomaly", 0), errors="coerce").fillna(0).sum()),
            "strict_only_count": int(pd.to_numeric(ready.get("is_sensitive_warning", 0), errors="coerce").fillna(0).sum()),
            "action_distribution": {level: int(policy["action_distribution"].get(level, 0)) for level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")},
            "no_monitor_assertion": policy["no_monitor_assertion"],
            "strict_only_action_uplift_count": policy["strict_only_action_uplift_count"],
            "window_cross_machine_count": int(boundary.get("cross_machine", 0)),
            "window_cross_segment_count": int(boundary.get("cross_segment", 0)),
            "window_missing_source_event_count": int(boundary.get("missing_source_events", 0)),
            "window_ready_requirement_met": (
                int(machine_sampled_rows.get(machine_id, 0)) == int(requested_per_machine)
                and int(len(l1_ready)) == int(machine_sampled_rows.get(machine_id, 0))
            ),
            "requested_ready_targets": int(requested_per_machine),
            "window_manifest_rows": int(len(window_rows)),
            "sql_writes": 0,
            "production_artifacts_changed": False,
        }
    all_actions = output_rows.loc[pd.to_numeric(output_rows["l2_ready_flag"], errors="coerce").fillna(0).eq(1), "operational_action_level"]
    global_report = {
        "result": "PASS" if by_machine and all(
            report["window_ready_requirement_met"]
            and report["ready_l1_score_nan_or_inf_count"] == 0
            and report["ready_l2_probability_nan_or_inf_count"] == 0
            and report["no_monitor_assertion"]
            and report["strict_only_action_uplift_count"] == 0
            and report["window_cross_machine_count"] == 0
            and report["window_cross_segment_count"] == 0
            and report["window_missing_source_event_count"] == 0
            for report in by_machine.values()
        ) else "FAIL",
        "machine_count": int(len(by_machine)),
        "machines": sorted(int(machine_id) for machine_id in by_machine),
        "raw_context_rows": int(sum(machine_input_rows.values())),
        "sampled_rows": int(sum(machine_sampled_rows.values())),
        "l1_ready_rows": int(pd.to_numeric(output_rows["l1_score_available_flag"], errors="coerce").fillna(0).eq(1).sum()),
        "l1_unready_rows": int(pd.to_numeric(output_rows["l1_score_available_flag"], errors="coerce").fillna(0).eq(0).sum()),
        "ready_rows": int(pd.to_numeric(output_rows["l2_ready_flag"], errors="coerce").fillna(0).eq(1).sum()),
        "unready_rows": int(pd.to_numeric(output_rows["l2_ready_flag"], errors="coerce").fillna(0).eq(0).sum()),
        "ready_l1_score_nan_or_inf_count": int(sum(report["ready_l1_score_nan_or_inf_count"] for report in by_machine.values())),
        "ready_l2_probability_nan_or_inf_count": int(sum(report["ready_l2_probability_nan_or_inf_count"] for report in by_machine.values())),
        "is_behavior_anomaly_count": int(sum(report["is_behavior_anomaly_count"] for report in by_machine.values())),
        "strict_only_count": int(sum(report["strict_only_count"] for report in by_machine.values())),
        "action_distribution": {level: int(all_actions.eq(level).sum()) for level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")},
        "no_monitor_assertion": not all_actions.isin({"MONITOR", "SENSITIVE_BEHAVIOR_MONITOR"}).any(),
        "strict_only_action_uplift_count": int(sum(report["strict_only_action_uplift_count"] for report in by_machine.values())),
        "sql_writes": 0,
        "production_artifacts_changed": False,
        "candidate_c_runtime_artifact_used": False,
    }
    return global_report, by_machine


def run_production_multi_machine_smoke(
    root: Path,
    canonical_root: Path,
    output_root: Path,
    *,
    events_per_machine: int = 50,
    batch_size: int = 512,
) -> Path:
    if not 50 <= events_per_machine <= 100:
        raise ValueError("--smoke-events-per-machine must be between 50 and 100")
    return run_production_compatibility_dry_run(
        root,
        canonical_root,
        output_root,
        batch_size=batch_size,
        per_machine_sample_size=events_per_machine,
    )
