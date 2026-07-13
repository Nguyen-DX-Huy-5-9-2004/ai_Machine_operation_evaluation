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
    int_defaults = ["is_behavior_anomaly", "is_sensitive_warning", "l1_score_available_flag", "l1_join_missing_flag"]
    for column in float_defaults:
        if column not in df.columns:
            df[column] = 0.0
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0.0)
    for column in int_defaults:
        if column not in df.columns:
            df[column] = 0
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0).astype("int8")


def _clip_non_negative(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0.0).clip(lower=0.0)
