from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


L1_MODEL_FEATURES = [
    "status_id",
    "status_type_code",
    "current_signal_code",
    "hour_of_day",
    "day_of_week",
    "machine_group_id",
    "location_id",
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "kwh_delta_model_value",
    "kwh_rate_per_hour",
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


@dataclass
class ShadowProfile:
    profile: str
    project_root: Path
    artifact_dir: Path
    model_path: Path
    preprocessor_path: Path
    thresholds_path: Path
    model: Any
    preprocessor: Any
    thresholds: dict[str, Any]
    device: Any
    missing_keys: list[str]
    unexpected_keys: list[str]


def ensure_l1_src_on_path(project_root: Path) -> Path:
    src = project_root / "modeling" / "l1_tcn" / "src"
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))
    return src


def load_l1_base_config(project_root: Path) -> dict[str, Any]:
    import yaml

    path = project_root / "modeling" / "l1_tcn" / "configs" / "base.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def choose_torch_device(prefer_cuda: bool = True) -> Any:
    import torch

    if prefer_cuda and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_shadow_profile(
    project_root: Path,
    profile: str,
    base_cfg: dict[str, Any],
    device: Any | None = None,
    artifact_dir: Path | None = None,
) -> ShadowProfile:
    ensure_l1_src_on_path(project_root)
    import torch
    from features import L1FeaturePreprocessor
    from model import WeldcomTCNAutoencoder
    from score_full_l1 import strip_orig_mod_prefix, torch_load_checkpoint

    artifact_dir = artifact_dir or (project_root / "modeling" / "l1_tcn" / "artifacts" / profile)
    artifact_dir = artifact_dir.resolve()
    model_path = artifact_dir / "model_best.pt"
    preprocessor_path = artifact_dir / "preprocessor.json"
    thresholds_path = artifact_dir / "thresholds.json"
    missing = [str(p) for p in [model_path, preprocessor_path, thresholds_path] if not p.exists()]
    if missing:
        raise FileNotFoundError(f"Missing L1 {profile} artifacts: {missing}")
    device = device or choose_torch_device()
    preprocessor = L1FeaturePreprocessor.load(preprocessor_path)
    model = WeldcomTCNAutoencoder.from_preprocessor_and_config(preprocessor, base_cfg)
    ckpt = torch_load_checkpoint(model_path, device)
    state = strip_orig_mod_prefix(ckpt["model_state_dict"])
    loaded = model.load_state_dict(state, strict=False)
    model.to(device)
    model.eval()
    thresholds = json.loads(thresholds_path.read_text(encoding="utf-8"))
    return ShadowProfile(
        profile=profile,
        project_root=project_root,
        artifact_dir=artifact_dir,
        model_path=model_path,
        preprocessor_path=preprocessor_path,
        thresholds_path=thresholds_path,
        model=model,
        preprocessor=preprocessor,
        thresholds=thresholds,
        device=device,
        missing_keys=list(loaded.missing_keys),
        unexpected_keys=list(loaded.unexpected_keys),
    )


def artifact_contract(project_root: Path, profiles: list[ShadowProfile], base_cfg: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "result": "PASS",
        "device": str(profiles[0].device) if profiles else None,
        "window_size": int(base_cfg.get("window", {}).get("size", 20)),
        "expected_feature_order": L1_MODEL_FEATURES,
        "profiles": {},
    }
    for profile in profiles:
        spec = profile.preprocessor.spec
        model_columns = list(spec.categorical_columns) + list(spec.continuous_columns) + list(spec.binary_columns)
        profile_payload = {
            "artifact_dir": str(profile.artifact_dir),
            "model_path": str(profile.model_path),
            "preprocessor_path": str(profile.preprocessor_path),
            "thresholds_path": str(profile.thresholds_path),
            "artifacts_exist": all(p.exists() for p in [profile.model_path, profile.preprocessor_path, profile.thresholds_path]),
            "model_eval": not bool(profile.model.training),
            "missing_keys": profile.missing_keys,
            "unexpected_keys": profile.unexpected_keys,
            "feature_order_match": model_columns == L1_MODEL_FEATURES,
            "window_size_match": int(base_cfg.get("window", {}).get("size", 20)) == 20,
            "global_threshold": profile.thresholds.get("global_threshold"),
            "per_machine_threshold": bool(profile.thresholds.get("per_machine_threshold", True)),
            "threshold_comparison": "score_norm >= 1.0",
            "score_orientation": "higher_reconstruction_error_means_more_anomalous",
        }
        if profile_payload["missing_keys"] or profile_payload["unexpected_keys"] or not profile_payload["feature_order_match"]:
            payload["result"] = "FAIL"
        payload["profiles"][profile.profile] = profile_payload
    return payload


def sort_l1_features(df: pd.DataFrame) -> pd.DataFrame:
    return df.sort_values(
        ["machine_id", "sequence_segment_id", "event_order_in_segment", "event_start_time", "event_id"],
        kind="mergesort",
    ).reset_index(drop=True)


def build_window_manifest(features: pd.DataFrame, candidate_ids: set[int], window_size: int = 20) -> pd.DataFrame:
    df = sort_l1_features(features).copy()
    df["_row_index"] = np.arange(len(df), dtype=np.int64)
    candidate_ids = set(int(v) for v in candidate_ids)
    rows: list[dict[str, Any]] = []
    by_event = {int(row.event_id): row for row in df.itertuples(index=False) if pd.notna(row.event_id)}
    missing_model_features = [c for c in L1_MODEL_FEATURES if c not in df.columns]
    grouped_windows: dict[tuple[int, int], pd.DataFrame] = {}
    if not df.empty and {"machine_id", "sequence_segment_id"}.issubset(df.columns):
        for key, part in df.groupby(["machine_id", "sequence_segment_id"], sort=False):
            machine_id, segment_id = key
            grouped_windows[(int(machine_id), int(segment_id))] = part.sort_values("event_order_in_segment", kind="mergesort")
    for event_id in sorted(candidate_ids):
        row = by_event.get(int(event_id))
        if row is None:
            rows.append({"event_id": event_id, "window_ready_flag": 0, "not_scored_reason": "MISSING_CANDIDATE_FEATURE"})
            continue
        reason = "READY"
        ready = 1
        if int(getattr(row, "is_open_event", 0) or 0) == 1:
            reason = "OPEN_EVENT"
            ready = 0
        elif int(getattr(row, "event_order_in_segment", 0) or 0) < window_size:
            reason = "INSUFFICIENT_HISTORY_IN_SEGMENT"
            ready = 0
        start_order = int(getattr(row, "event_order_in_segment", 0) or 0) - window_size + 1
        group = grouped_windows.get((int(row.machine_id), int(row.sequence_segment_id)), pd.DataFrame())
        if group.empty:
            window = group
        else:
            order_series = pd.to_numeric(group["event_order_in_segment"], errors="coerce")
            window = group[(order_series >= start_order) & (order_series <= int(row.event_order_in_segment))]
        if ready and len(window) != window_size:
            reason = "CROSSES_SEGMENT_BOUNDARY"
            ready = 0
        if ready and missing_model_features:
            reason = "MISSING_REQUIRED_FEATURE"
            ready = 0
        rows.append({
            "event_id": event_id,
            "machine_id": int(row.machine_id),
            "event_start_time": getattr(row, "event_start_time"),
            "sequence_segment_id": int(row.sequence_segment_id),
            "event_order_in_segment": int(row.event_order_in_segment),
            "window_ready_flag": ready,
            "not_scored_reason": reason,
            "window_start_event_id": int(window["event_id"].iloc[0]) if len(window) else None,
            "window_end_event_id": event_id,
            "window_row_count": int(len(window)),
            "window_event_ids": "|".join(str(int(v)) for v in window["event_id"].tolist()) if len(window) else "",
        })
    return pd.DataFrame(rows)


def rows_for_ready_windows(features: pd.DataFrame, manifest: pd.DataFrame) -> pd.DataFrame:
    ready = manifest[manifest["window_ready_flag"] == 1].copy()
    if ready.empty:
        return pd.DataFrame(columns=features.columns.tolist() + ["shadow_window_id"])
    df = sort_l1_features(features).copy()
    by_event = df.set_index("event_id", drop=False)
    rows = []
    for idx, row in ready.reset_index(drop=True).iterrows():
        event_ids = [int(v) for v in str(row["window_event_ids"]).split("|") if v]
        available_ids = [event_id for event_id in event_ids if event_id in by_event.index]
        part = by_event.loc[available_ids].copy()
        if isinstance(part, pd.Series):
            part = part.to_frame().T
        part["shadow_window_id"] = idx
        rows.append(part)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def preprocess_windows(profile: ShadowProfile, window_rows: pd.DataFrame, window_size: int = 20) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    if window_rows.empty:
        return np.empty((0, window_size, 0), dtype=np.int64), np.empty((0, window_size, 0), dtype=np.float32), pd.DataFrame()
    sorted_rows = window_rows.sort_values(["shadow_window_id", "event_order_in_segment"], kind="mergesort").reset_index(drop=True)
    cat_flat, cont_flat = profile.preprocessor.transform(sorted_rows)
    window_count = int(sorted_rows["shadow_window_id"].nunique())
    cat = cat_flat.reshape(window_count, window_size, -1).astype(np.int64, copy=False)
    cont = cont_flat.reshape(window_count, window_size, -1).astype(np.float32, copy=False)
    meta = sorted_rows.groupby("shadow_window_id", sort=True).tail(1)[[
        "shadow_window_id", "event_id", "machine_id", "event_start_time", "sequence_segment_id", "event_order_in_segment",
    ]].reset_index(drop=True)
    return cat, cont, meta


def score_windows(profile: ShadowProfile, base_cfg: dict[str, Any], window_rows: pd.DataFrame, batch_size: int = 1024) -> tuple[pd.DataFrame, dict[str, Any]]:
    ensure_l1_src_on_path(profile.project_root)
    import torch
    from losses import reconstruction_error_per_window
    from threshold import apply_thresholds

    window_size = int(base_cfg.get("window", {}).get("size", 20))
    cat, cont, meta = preprocess_windows(profile, window_rows, window_size)
    report = {
        "profile": profile.profile,
        "window_count": int(len(meta)),
        "non_finite_input_count": int((~np.isfinite(cont)).sum()),
        "non_finite_output_count": 0,
        "batch_size": int(batch_size),
    }
    if len(meta) == 0:
        return pd.DataFrame(columns=["event_id", "machine_id", "total_error"]), report
    rows = []
    profile.model.eval()
    data_cfg = base_cfg.get("data", {})
    categorical_columns = list(data_cfg.get("categorical_columns", []))
    continuous_columns = list(data_cfg.get("continuous_columns", []))
    binary_columns = list(data_cfg.get("binary_columns", []))
    loss_cfg = base_cfg.get("train", {}).get("loss", {})
    weights = {
        "continuous_weight": float(loss_cfg.get("continuous_weight", 1.0)),
        "binary_weight": float(loss_cfg.get("binary_weight", 0.75)),
        "categorical_weight": float(loss_cfg.get("categorical_weight", 0.35)),
    }
    with torch.inference_mode():
        for start in range(0, len(meta), batch_size):
            end = min(start + batch_size, len(meta))
            cat_t = torch.as_tensor(cat[start:end], dtype=torch.long, device=profile.device)
            cont_t = torch.as_tensor(cont[start:end], dtype=torch.float32, device=profile.device)
            outputs = profile.model(cat_t, cont_t)
            err = reconstruction_error_per_window(
                outputs=outputs,
                cat_target=cat_t,
                cont_target=cont_t,
                categorical_columns=categorical_columns,
                real_continuous_dim=len(continuous_columns),
                binary_dim=len(binary_columns),
                **weights,
            )
            part = meta.iloc[start:end].copy()
            for key in ["total_error", "continuous_error", "binary_error", "categorical_error"]:
                values = err[key].detach().float().cpu().numpy()
                report["non_finite_output_count"] += int((~np.isfinite(values)).sum())
                part[key] = values
            rows.append(part)
    scored = pd.concat(rows, ignore_index=True)
    scored = apply_thresholds(scored, profile.thresholds, score_col="total_error")
    rename = {
        "total_error": f"score_{profile.profile}",
        "continuous_error": f"continuous_error_{profile.profile}",
        "binary_error": f"binary_error_{profile.profile}",
        "categorical_error": f"categorical_error_{profile.profile}",
        "anomaly_threshold": f"threshold_{profile.profile}",
        "anomaly_score_norm": f"score_{profile.profile}_normalized",
        "is_anomaly": f"is_anomaly_{profile.profile}",
    }
    return scored.rename(columns=rename), report


def combine_shadow_scores(manifest: pd.DataFrame, lenient: pd.DataFrame, strict: pd.DataFrame) -> pd.DataFrame:
    out = manifest.copy()
    for df in [lenient, strict]:
        if not df.empty:
            # The manifest owns structural window metadata. Score output also
            # carries that metadata for standalone audits, so merge only its
            # score contract to prevent pandas suffix columns such as `_x/_y`.
            score_columns = [
                column
                for column in df.columns
                if column == "event_id"
                or column.startswith((
                    "score_", "threshold_", "is_anomaly_",
                    "continuous_error_", "binary_error_", "categorical_error_",
                ))
            ]
            out = out.merge(df.reindex(columns=score_columns), on="event_id", how="left", validate="one_to_one")
    for col in ["score_lenient", "score_strict", "threshold_lenient", "threshold_strict", "score_lenient_normalized", "score_strict_normalized"]:
        if col not in out.columns:
            out[col] = np.nan
    for col in ["is_anomaly_lenient", "is_anomaly_strict"]:
        if col not in out.columns:
            out[col] = 0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0).astype("int8")
    out["is_behavior_anomaly"] = (out["is_anomaly_lenient"] > 0).astype("int8")
    out["is_sensitive_warning"] = ((out["is_anomaly_strict"] > 0) & ~(out["is_anomaly_lenient"] > 0)).astype("int8")
    out.loc[out["window_ready_flag"] != 1, ["is_behavior_anomaly", "is_sensitive_warning", "is_anomaly_lenient", "is_anomaly_strict"]] = 0
    return out


def score_summary_global(scores: pd.DataFrame) -> dict[str, Any]:
    scored = scores[scores["window_ready_flag"] == 1].copy()
    out: dict[str, Any] = {
        "total_rows": int(len(scores)),
        "count_scored": int(len(scored)),
        "count_not_scored": int((scores["window_ready_flag"] != 1).sum()),
        "window_ready_rate": float((scores["window_ready_flag"] == 1).mean()) if len(scores) else 0.0,
        "behavior_anomaly_count": int(scored.get("is_behavior_anomaly", pd.Series(dtype=int)).sum()),
        "behavior_anomaly_rate": float(scored.get("is_behavior_anomaly", pd.Series(dtype=float)).mean()) if len(scored) else 0.0,
        "sensitive_warning_count": int(scored.get("is_sensitive_warning", pd.Series(dtype=int)).sum()),
        "sensitive_warning_rate": float(scored.get("is_sensitive_warning", pd.Series(dtype=float)).mean()) if len(scored) else 0.0,
    }
    for profile in ["lenient", "strict"]:
        s = pd.to_numeric(scored.get(f"score_{profile}", pd.Series(dtype=float)), errors="coerce")
        out[profile] = {
            "count": int(s.notna().sum()),
            "min": _float(s.min()),
            "mean": _float(s.mean()),
            "median": _float(s.quantile(0.50)),
            "p90": _float(s.quantile(0.90)),
            "p95": _float(s.quantile(0.95)),
            "p99": _float(s.quantile(0.99)),
            "max": _float(s.max()),
            "anomaly_count": int(scored.get(f"is_anomaly_{profile}", pd.Series(dtype=int)).sum()),
            "anomaly_rate": float(scored.get(f"is_anomaly_{profile}", pd.Series(dtype=float)).mean()) if len(scored) else 0.0,
        }
    return out


def score_summary_by_machine(scores: pd.DataFrame, features: pd.DataFrame) -> pd.DataFrame:
    feature_cols = ["event_id", "kwh_available_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag"]
    merged = scores.merge(features.reindex(columns=feature_cols), on="event_id", how="left")
    rows = []
    for machine_id, g in merged.groupby("machine_id", dropna=False):
        scored = g[g["window_ready_flag"] == 1]
        row = {
            "machine_id": machine_id,
            "count": int(len(g)),
            "count_scored": int(len(scored)),
            "window_ready_rate": float((g["window_ready_flag"] == 1).mean()) if len(g) else 0.0,
            "anomaly_rate": float(scored.get("is_behavior_anomaly", pd.Series(dtype=float)).mean()) if len(scored) else 0.0,
            "strict_only_warning_rate": float(scored.get("is_sensitive_warning", pd.Series(dtype=float)).mean()) if len(scored) else 0.0,
            "kwh_availability_rate": float(pd.to_numeric(g.get("kwh_available_flag"), errors="coerce").mean()) if len(g) else None,
            "loaded_zero_kwh_rate": float(pd.to_numeric(g.get("loaded_zero_kwh_flag"), errors="coerce").mean()) if len(g) else None,
        }
        for profile in ["lenient", "strict"]:
            s = pd.to_numeric(scored.get(f"score_{profile}", pd.Series(dtype=float)), errors="coerce")
            row[f"score_{profile}_median"] = _float(s.quantile(0.50))
            row[f"score_{profile}_p95"] = _float(s.quantile(0.95))
            row[f"score_{profile}_p99"] = _float(s.quantile(0.99))
            row[f"anomaly_rate_{profile}"] = float(scored.get(f"is_anomaly_{profile}", pd.Series(dtype=float)).mean()) if len(scored) else 0.0
        rows.append(row)
    return pd.DataFrame(rows)


def not_scored_summary(manifest: pd.DataFrame) -> dict[str, Any]:
    return {
        "total": int(len(manifest)),
        "ready": int((manifest["window_ready_flag"] == 1).sum()) if not manifest.empty else 0,
        "not_ready": int((manifest["window_ready_flag"] != 1).sum()) if not manifest.empty else 0,
        "reason_distribution": manifest.get("not_scored_reason", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
    }


def _float(value: Any) -> float | None:
    try:
        if pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None
