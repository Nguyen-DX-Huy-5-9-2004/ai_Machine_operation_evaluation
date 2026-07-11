from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

import numpy as np
import pandas as pd


@dataclass
class ThresholdConfig:
    quantile: float = 0.995
    per_machine_threshold: bool = True
    min_machine_valid_windows: int = 1000
    fallback_global_quantile: float = 0.995


def _safe_quantile(values: np.ndarray, q: float) -> float:
    values = np.asarray(values, dtype="float64")
    values = values[np.isfinite(values)]
    if values.size == 0:
        return float("nan")
    q = min(max(float(q), 0.0), 1.0)
    return float(np.quantile(values, q))


def summarize_scores(scores: pd.DataFrame, score_col: str = "total_error") -> pd.DataFrame:
    """
    Tóm tắt phân bố reconstruction error theo machine_id.
    Dùng để hiểu máy nào có nền vận hành khó học hơn.
    """
    if score_col not in scores.columns:
        raise ValueError(f"Missing score column: {score_col}")
    if "machine_id" not in scores.columns:
        raise ValueError("Missing machine_id column.")

    rows = []
    for machine_id, g in scores.groupby("machine_id", sort=True):
        x = pd.to_numeric(g[score_col], errors="coerce").dropna().to_numpy(dtype="float64")
        if x.size == 0:
            continue
        rows.append({
            "machine_id": machine_id,
            "count": int(x.size),
            "mean": float(np.mean(x)),
            "std": float(np.std(x)),
            "min": float(np.min(x)),
            "p50": float(np.quantile(x, 0.50)),
            "p90": float(np.quantile(x, 0.90)),
            "p95": float(np.quantile(x, 0.95)),
            "p99": float(np.quantile(x, 0.99)),
            "p995": float(np.quantile(x, 0.995)),
            "p999": float(np.quantile(x, 0.999)),
            "max": float(np.max(x)),
        })

    return pd.DataFrame(rows)


def build_thresholds(
    valid_scores: pd.DataFrame,
    cfg: ThresholdConfig,
    score_col: str = "total_error",
) -> Dict[str, Any]:
    """
    Tạo threshold từ reconstruction error trên valid normal.

    Ý nghĩa:
    - global_threshold: ngưỡng chung.
    - per_machine_thresholds: ngưỡng riêng từng máy nếu đủ valid windows.
    - fallback: nếu máy quá ít window thì dùng global threshold.

    Với anomaly detection train trên normal, threshold không học từ nhãn lỗi mà học từ đuôi phân bố lỗi tái tạo của normal valid.
    """
    if score_col not in valid_scores.columns:
        raise ValueError(f"Missing score column: {score_col}")
    if "machine_id" not in valid_scores.columns:
        raise ValueError("Missing machine_id column.")

    x = pd.to_numeric(valid_scores[score_col], errors="coerce").dropna().to_numpy(dtype="float64")
    global_threshold = _safe_quantile(x, cfg.fallback_global_quantile)

    per_machine: Dict[str, float] = {}
    machine_counts: Dict[str, int] = {}
    machine_threshold_source: Dict[str, str] = {}

    if cfg.per_machine_threshold:
        for machine_id, g in valid_scores.groupby("machine_id", sort=True):
            vals = pd.to_numeric(g[score_col], errors="coerce").dropna().to_numpy(dtype="float64")
            machine_key = str(int(machine_id)) if pd.notna(machine_id) else str(machine_id)
            machine_counts[machine_key] = int(vals.size)

            if vals.size >= int(cfg.min_machine_valid_windows):
                per_machine[machine_key] = _safe_quantile(vals, cfg.quantile)
                machine_threshold_source[machine_key] = "per_machine"
            else:
                per_machine[machine_key] = global_threshold
                machine_threshold_source[machine_key] = "global_fallback"
    else:
        for machine_id in sorted(valid_scores["machine_id"].dropna().unique().tolist()):
            machine_key = str(int(machine_id)) if pd.notna(machine_id) else str(machine_id)
            per_machine[machine_key] = global_threshold
            machine_threshold_source[machine_key] = "global"

    summary_df = summarize_scores(valid_scores, score_col=score_col)

    return {
        "score_col": score_col,
        "quantile": float(cfg.quantile),
        "fallback_global_quantile": float(cfg.fallback_global_quantile),
        "per_machine_threshold": bool(cfg.per_machine_threshold),
        "min_machine_valid_windows": int(cfg.min_machine_valid_windows),
        "global_threshold": float(global_threshold),
        "per_machine_thresholds": per_machine,
        "machine_counts": machine_counts,
        "machine_threshold_source": machine_threshold_source,
        "valid_score_summary": summary_df.to_dict(orient="records"),
    }


def apply_thresholds(
    scores: pd.DataFrame,
    threshold_payload: Dict[str, Any],
    score_col: str = "total_error",
) -> pd.DataFrame:
    """
    Thêm threshold, normalized score và is_anomaly vào scores DataFrame.

    normalized score:
        anomaly_score_norm = score / threshold

    Nếu > 1 nghĩa là vượt ngưỡng anomaly.
    """
    if score_col not in scores.columns:
        raise ValueError(f"Missing score column: {score_col}")
    if "machine_id" not in scores.columns:
        raise ValueError("Missing machine_id column.")

    global_threshold = float(threshold_payload["global_threshold"])
    per_machine = threshold_payload.get("per_machine_thresholds", {})

    df = scores.copy()
    thresholds = []

    for m in df["machine_id"].tolist():
        try:
            key = str(int(m))
        except Exception:
            key = str(m)
        thresholds.append(float(per_machine.get(key, global_threshold)))

    df["anomaly_threshold"] = thresholds
    df["anomaly_score_norm"] = pd.to_numeric(df[score_col], errors="coerce") / df["anomaly_threshold"].replace(0, np.nan)
    df["is_anomaly"] = (df["anomaly_score_norm"] >= 1.0).astype("int8")
    return df


def summarize_anomaly_result(
    scored: pd.DataFrame,
    score_col: str = "total_error",
) -> Dict[str, Any]:
    """
    Tổng hợp nhanh anomaly rate toàn cục và theo máy.
    """
    if "is_anomaly" not in scored.columns:
        raise ValueError("Missing is_anomaly column. Run apply_thresholds first.")

    total = int(len(scored))
    pos = int(scored["is_anomaly"].sum())
    out: Dict[str, Any] = {
        "total_windows": total,
        "anomaly_windows": pos,
        "anomaly_rate": float(pos / total) if total else 0.0,
    }

    by_machine = []
    for machine_id, g in scored.groupby("machine_id", sort=True):
        n = int(len(g))
        p = int(g["is_anomaly"].sum())
        by_machine.append({
            "machine_id": int(machine_id) if pd.notna(machine_id) else machine_id,
            "total_windows": n,
            "anomaly_windows": p,
            "anomaly_rate": float(p / n) if n else 0.0,
            "score_mean": float(pd.to_numeric(g[score_col], errors="coerce").mean()),
            "score_p99": float(pd.to_numeric(g[score_col], errors="coerce").quantile(0.99)),
        })
    out["by_machine"] = by_machine
    return out


def threshold_config_from_yaml(cfg_dict: Dict[str, Any], profile: str) -> ThresholdConfig:
    t = cfg_dict.get("threshold", {})
    q_key = "quantile_lenient" if profile == "lenient" else "quantile_strict"
    return ThresholdConfig(
        quantile=float(t.get(q_key, t.get("quantile", 0.995))),
        per_machine_threshold=bool(t.get("per_machine_threshold", True)),
        min_machine_valid_windows=int(t.get("min_machine_valid_windows", 1000)),
        fallback_global_quantile=float(t.get("fallback_global_quantile", 0.995)),
    )
