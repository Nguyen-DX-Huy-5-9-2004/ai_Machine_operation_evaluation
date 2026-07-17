from __future__ import annotations

import numpy as np
import pandas as pd


def add_l2_runtime_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add L2 feature-prep columns that are derived from L1 scores at runtime."""
    out = df.copy()
    _ensure_l1_base_columns(out)

    out["l1_lenient_norm_clip"] = _clip_non_negative(out["score_lenient_norm"])
    out["l1_strict_norm_clip"] = _clip_non_negative(out["score_strict_norm"])
    out["l1_behavior_anomaly_score_clip"] = _clip_non_negative(out["behavior_anomaly_score"])
    out["l1_behavior_sensitive_score_clip"] = _clip_non_negative(out["behavior_sensitive_score"])
    out["l1_behavior_combined_score_clip"] = _clip_non_negative(out["behavior_combined_score"])
    out["l1_score_lenient_clip"] = _clip_non_negative(out["score_lenient"])
    out["l1_score_strict_clip"] = _clip_non_negative(out["score_strict"])

    for src, dst in [
        ("l1_lenient_norm_clip", "l1_lenient_norm_log"),
        ("l1_strict_norm_clip", "l1_strict_norm_log"),
        ("l1_behavior_anomaly_score_clip", "l1_behavior_anomaly_score_log"),
        ("l1_behavior_sensitive_score_clip", "l1_behavior_sensitive_score_log"),
        ("l1_behavior_combined_score_clip", "l1_behavior_combined_score_log"),
        ("l1_score_lenient_clip", "l1_score_lenient_log"),
        ("l1_score_strict_clip", "l1_score_strict_log"),
    ]:
        out[dst] = np.log1p(pd.to_numeric(out[src], errors="coerce").fillna(0.0))

    strict = pd.to_numeric(out["score_strict_norm"], errors="coerce").fillna(0.0)
    lenient = pd.to_numeric(out["score_lenient_norm"], errors="coerce").fillna(0.0)
    gap = (strict - lenient).clip(lower=0.0)
    ratio = strict / (lenient + 1e-6)
    out["l1_strict_lenient_gap_log"] = np.log1p(gap)
    out["l1_strict_lenient_ratio_log"] = np.log1p(ratio.clip(lower=0.0))
    out["l1_score_balance_index"] = (strict - lenient) / (strict + lenient + 1e-6)
    out["l1_behavior_anomaly_flag"] = pd.to_numeric(out["is_behavior_anomaly"], errors="coerce").fillna(0).astype("int8")

    if "split_bucket" not in out.columns:
        out["split_bucket"] = 0
    return out


def build_l2_runtime_features(
    l1_events_with_context: pd.DataFrame,
    l1_scores: pd.DataFrame | None = None,
    config: dict | None = None,
    model_metadata: dict | None = None,
) -> pd.DataFrame:
    """Build runtime L2 feature rows without future labels or prediction.

    The optional ``l1_scores`` frame is joined by event_id. When it is absent,
    L1-derived columns stay in disabled/no-op mode and contract reports should
    keep model readiness below PASS.
    """
    out = l1_events_with_context.copy()
    if l1_scores is not None and not l1_scores.empty and "event_id" in l1_scores.columns:
        score_cols = [c for c in l1_scores.columns if c != "event_id"]
        out = out.merge(l1_scores[["event_id", *score_cols]], on="event_id", how="left", suffixes=("", "_l1_score"))
        out["l1_score_available_flag"] = out.get("l1_score_available_flag", 1)
        out["l1_join_missing_flag"] = out[score_cols].isna().all(axis=1).astype("int8") if score_cols else 1
    out = add_l2_runtime_features(out)
    future_or_label_cols = [c for c in out.columns if c.startswith("future_") or c in {"next_fault_status_id", "events_to_next_fault", "seconds_to_next_fault"}]
    if future_or_label_cols:
        out = out.drop(columns=future_or_label_cols)
    return out


def _ensure_l1_base_columns(df: pd.DataFrame) -> None:
    float_defaults = [
        "score_lenient",
        "score_strict",
        "score_lenient_norm",
        "score_strict_norm",
        "behavior_anomaly_score",
        "behavior_sensitive_score",
        "behavior_combined_score",
    ]
    int_defaults = ["is_behavior_anomaly", "is_sensitive_warning", "l1_score_available_flag"]
    for column in float_defaults:
        if column not in df.columns:
            df[column] = 0.0
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0.0)
    for column in int_defaults:
        if column not in df.columns:
            df[column] = 0
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0).astype("int8")
    if "l1_join_missing_flag" not in df.columns:
        df["l1_join_missing_flag"] = 1
    df["l1_join_missing_flag"] = pd.to_numeric(df["l1_join_missing_flag"], errors="coerce").fillna(1).astype("int8")


def _clip_non_negative(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0.0).clip(lower=0.0)
