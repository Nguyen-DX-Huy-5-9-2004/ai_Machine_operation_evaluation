from __future__ import annotations

import argparse
import json
import math
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)


# ============================================================
# 1. Utilities
# ============================================================

def load_yaml(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML: {path}")
    return data


def load_json(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(obj: Dict[str, Any], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def resolve_path(raw: str | Path, config_path: str | Path) -> Path:
    raw = Path(raw)
    if raw.is_absolute():
        return raw
    return (Path(config_path).resolve().parent / raw).resolve()


def get_cfg(cfg: Dict[str, Any], dotted: str, default: Any = None) -> Any:
    cur: Any = cfg
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def resolve_run_id(cfg: Dict[str, Any], config_path: str | Path) -> str:
    run_id = str(get_cfg(cfg, "paths.batch06.run_id", "latest"))
    if run_id != "latest":
        return run_id
    report_root = resolve_path(get_cfg(cfg, "paths.batch06.report_root"), config_path)
    runs = sorted([p for p in report_root.iterdir() if p.is_dir() and p.name.startswith("l2_multilabel_")])
    if not runs:
        raise FileNotFoundError(f"No Batch 06 run found in {report_root}")
    return runs[-1].name


def safe_numeric(x: Any, index: Optional[pd.Index] = None, fill: float = 0.0) -> pd.Series:
    if isinstance(x, pd.Series):
        return pd.to_numeric(x, errors="coerce").fillna(fill)
    if index is None:
        raise ValueError("index is required when x is not a Series")
    return pd.Series(fill, index=index)


def ensure_columns(df: pd.DataFrame, columns: List[str], fill: float = 0.0) -> pd.DataFrame:
    for c in columns:
        if c not in df.columns:
            df[c] = fill
    return df


def maybe_remove(path: Path) -> None:
    if path.exists():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


def append_csv(df: pd.DataFrame, path: Path, first_write: bool, compression: Optional[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compression == "gzip" or str(path).endswith(".gz"):
        df.to_csv(path, index=False, encoding="utf-8-sig", mode="wt" if first_write else "at", header=first_write, compression="gzip")
    else:
        df.to_csv(path, index=False, encoding="utf-8-sig", mode="w" if first_write else "a", header=first_write)


# ============================================================
# 2. Model registry
# ============================================================

def target_output_name(target: str, cfg: Dict[str, Any]) -> str:
    return dict(get_cfg(cfg, "score.target_to_output_name", {})).get(target, target)


def load_production_selection(report_dir: Path) -> Dict[str, Any]:
    path = report_dir / "production_profile_selection.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing production selection: {path}")
    return load_json(path)


def build_model_registry(cfg: Dict[str, Any], config_path: str | Path, run_id: str, feature_policy: Dict[str, Any], selection: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    artifact_root = resolve_path(get_cfg(cfg, "paths.batch06.artifact_root"), config_path) / run_id
    if not artifact_root.exists():
        raise FileNotFoundError(f"Artifact root not found: {artifact_root}")
    profiles = feature_policy.get("feature_profiles", {})
    registry: Dict[str, Dict[str, Any]] = {}
    for row in selection.get("targets", []):
        target = row["target"]
        profile = row["selected_profile"]
        if profile not in profiles:
            raise ValueError(f"Profile {profile} not found in feature policy")
        model_path = artifact_root / profile / target / "model.joblib"
        metadata_path = artifact_root / profile / target / "metadata.json"
        if not model_path.exists():
            raise FileNotFoundError(model_path)
        registry[target] = {
            "target": target,
            "output_name": target_output_name(target, cfg),
            "profile": profile,
            "backend": row.get("selected_backend", "unknown"),
            "threshold": float(row.get("valid_threshold", 0.5)),
            "model_path": str(model_path),
            "metadata_path": str(metadata_path) if metadata_path.exists() else None,
            "model": joblib.load(model_path),
            "metadata": load_json(metadata_path) if metadata_path.exists() else {},
            "features": list(profiles[profile]),
            "valid_average_precision": row.get("valid_metric_value"),
            "test_average_precision": row.get("test_average_precision"),
            "test_roc_auc": row.get("test_roc_auc"),
            "test_threshold_f1": row.get("test_threshold_f1"),
        }
    return registry


def prepare_X(chunk: pd.DataFrame, features: List[str], categorical_columns: List[str], backend: str) -> np.ndarray:
    # Prepare feature matrix for production inference.
    #
    # Fix:
    # LightGBM sklearn model can fail during chunked prediction when pandas
    # category metadata differs from the training metadata:
    #     ValueError: train and valid dataset categorical_feature do not match.
    #
    # In this project, categorical-like features are already integer-coded
    # (status_id, hour_of_day, location_id, machine_group_id, ...), so for
    # inference we pass a plain numpy float32 matrix in the exact trained
    # feature order.
    X = chunk.copy()
    ensure_columns(X, features, fill=0.0)
    X = X[features].copy()

    for c in features:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)

    return X.to_numpy(dtype=np.float32, copy=False)


def predict_binary(model: Any, X: Any) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        proba = np.asarray(proba)
        out = proba[:, 1] if proba.ndim == 2 and proba.shape[1] >= 2 else proba.reshape(-1)
    else:
        out = np.asarray(model.predict(X)).reshape(-1)
    return np.clip(out.astype(float), 0.0, 1.0)


# ============================================================
# 3. Prediction and judgment
# ============================================================

def add_predictions(chunk: pd.DataFrame, registry: Dict[str, Dict[str, Any]], cfg: Dict[str, Any]) -> pd.DataFrame:
    out = chunk.copy()
    categorical_columns = list(get_cfg(cfg, "categorical_columns", []))
    for target, info in registry.items():
        X = prepare_X(chunk, info["features"], categorical_columns, str(info.get("backend", "")))
        p = predict_binary(info["model"], X)
        name = info["output_name"]
        thr = float(info["threshold"])
        out[f"risk_{name}"] = p
        out[f"pred_{name}"] = (p >= thr).astype("int8")
        out[f"threshold_{name}"] = thr
        out[f"profile_{name}"] = info["profile"]
    return out


def add_final_judgment(df: pd.DataFrame, cfg: Dict[str, Any], registry: Dict[str, Dict[str, Any]]) -> pd.DataFrame:
    out = df.copy()
    idx = out.index
    for info in registry.values():
        name = info["output_name"]
        ensure_columns(out, [f"risk_{name}", f"pred_{name}"], fill=0.0)

    r10 = safe_numeric(out.get("risk_fault_10_events"), idx)
    r30e = safe_numeric(out.get("risk_fault_30_events"), idx)
    r30m = safe_numeric(out.get("risk_fault_30min"), idx)
    r60m = safe_numeric(out.get("risk_fault_60min"), idx)
    rm = safe_numeric(out.get("risk_maintenance_30_events"), idx)
    rr = safe_numeric(out.get("risk_repair_30_events"), idx)
    p10 = safe_numeric(out.get("pred_fault_10_events"), idx).astype(bool)
    p30e = safe_numeric(out.get("pred_fault_30_events"), idx).astype(bool)
    p30m = safe_numeric(out.get("pred_fault_30min"), idx).astype(bool)
    p60m = safe_numeric(out.get("pred_fault_60min"), idx).astype(bool)
    pm = safe_numeric(out.get("pred_maintenance_30_events"), idx).astype(bool)
    pr = safe_numeric(out.get("pred_repair_30_events"), idx).astype(bool)
    known_fault = safe_numeric(out.get("known_fault_status"), idx).astype(bool)
    known_repair = safe_numeric(out.get("known_repair_status"), idx).astype(bool)
    known_maintenance = safe_numeric(out.get("known_maintenance_status"), idx).astype(bool)
    off_with_fault = safe_numeric(out.get("off_with_fault_status"), idx).astype(bool)
    data_quality = safe_numeric(out.get("data_quality_issue_flag"), idx).astype(bool)
    energy_issue = safe_numeric(out.get("energy_inconsistency_flag"), idx).astype(bool)
    l1_anom = safe_numeric(out.get("is_behavior_anomaly"), idx).astype(bool)
    l1_sensitive = safe_numeric(out.get("is_sensitive_warning"), idx).astype(bool)

    model_fault = np.maximum.reduce([r10.to_numpy(), r30e.to_numpy(), r30m.to_numpy(), r60m.to_numpy()])
    out["model_fault_risk_score"] = model_fault
    out["model_maintenance_risk_score"] = rm.to_numpy()
    out["model_repair_risk_score"] = rr.to_numpy()

    fault_conf = model_fault.copy()
    fault_conf = np.maximum(fault_conf, known_fault.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.known_fault_confidence", 1.0)))
    fault_conf = np.maximum(fault_conf, off_with_fault.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.known_fault_confidence", 1.0)))
    fault_conf = np.maximum(fault_conf, known_repair.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.known_repair_confidence", 0.85)))
    fault_conf = np.maximum(fault_conf, l1_anom.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.l1_behavior_anomaly_floor", 0.20)))
    fault_conf = np.maximum(fault_conf, l1_sensitive.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.l1_sensitive_monitor_floor", 0.10)))
    out["fault_confidence_score"] = np.clip(fault_conf, 0, 1)
    out["maintenance_confidence_score"] = np.maximum(rm.to_numpy(), known_maintenance.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.known_maintenance_confidence", 0.70)))
    out["repair_confidence_score"] = np.maximum(rr.to_numpy(), known_repair.to_numpy().astype(float) * float(get_cfg(cfg, "judgment.known_repair_confidence", 0.85)))
    out["overall_operational_risk_score"] = np.maximum.reduce([out["fault_confidence_score"].to_numpy(), out["maintenance_confidence_score"].to_numpy(), out["repair_confidence_score"].to_numpy()])

    near_fault = p10 | p30m
    medium_fault = p30e | p60m
    no_strong = ~(known_fault | off_with_fault | near_fault | medium_fault | pr | pm)

    conditions = [
        known_fault | off_with_fault,
        near_fault,
        medium_fault,
        pr | known_repair,
        pm | known_maintenance,
        data_quality & no_strong,
        energy_issue & no_strong,
        l1_anom,
        l1_sensitive,
    ]
    choices = [
        "KNOWN_FAULT_CONFIRMED",
        "PRE_FAULT_HIGH_CONFIDENCE",
        "PRE_FAULT_MEDIUM_CONFIDENCE",
        "REPAIR_RELATED",
        "MAINTENANCE_RELATED",
        "DATA_QUALITY_DOMINANT",
        "ENERGY_INCONSISTENCY_MONITOR",
        "L1_BEHAVIOR_ANOMALY_MONITOR",
        "L1_SENSITIVE_MONITOR",
    ]
    out["fault_judgment"] = np.select(conditions, choices, default="NORMAL_LIKE")

    soft_high = float(get_cfg(cfg, "judgment.soft_high_fault_probability", 0.50))
    soft_med = float(get_cfg(cfg, "judgment.soft_medium_fault_probability", 0.25))
    action_conditions = [
        known_fault | off_with_fault | p10,
        p30m | pr | (out["fault_confidence_score"] >= soft_high),
        p30e | p60m | pm | (out["fault_confidence_score"] >= soft_med) | l1_anom,
        l1_sensitive | data_quality | energy_issue,
    ]
    out["action_level"] = np.select(action_conditions, ["CRITICAL", "HIGH", "MEDIUM", "MONITOR"], default="LOW")
    out["final_reason"] = out["fault_judgment"].astype(str) + "|action=" + out["action_level"].astype(str)
    return out


# ============================================================
# 4. Evaluation
# ============================================================

def binary_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> Dict[str, Any]:
    y_true = np.asarray(y_true).astype(int)
    y_prob = np.asarray(y_prob).astype(float)
    y_pred = (y_prob >= threshold).astype(int)
    out: Dict[str, Any] = {
        "rows": int(len(y_true)),
        "positive_count": int(y_true.sum()),
        "positive_rate": float(y_true.mean()) if len(y_true) else 0.0,
        "threshold": float(threshold),
        "pred_positive_count": int(y_pred.sum()),
        "pred_positive_rate": float(y_pred.mean()) if len(y_pred) else 0.0,
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }
    try:
        out["average_precision"] = float(average_precision_score(y_true, y_prob))
    except Exception:
        out["average_precision"] = np.nan
    try:
        out["roc_auc"] = float(roc_auc_score(y_true, y_prob))
    except Exception:
        out["roc_auc"] = np.nan
    try:
        out["brier"] = float(brier_score_loss(y_true, y_prob))
    except Exception:
        out["brier"] = np.nan
    try:
        eps = 1e-7
        out["log_loss"] = float(log_loss(y_true, np.clip(y_prob, eps, 1 - eps), labels=[0, 1]))
    except Exception:
        out["log_loss"] = np.nan
    try:
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
        out.update({"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)})
    except Exception:
        out.update({"tn": None, "fp": None, "fn": None, "tp": None})
    return out


def topk_metrics(y_true: np.ndarray, y_prob: np.ndarray, fractions: List[float]) -> List[Dict[str, Any]]:
    y_true = np.asarray(y_true).astype(int)
    y_prob = np.asarray(y_prob).astype(float)
    n = len(y_true)
    total_pos = int(y_true.sum())
    order = np.argsort(-y_prob)
    rows = []
    for frac in fractions:
        k = max(1, int(math.ceil(n * float(frac))))
        idx = order[:k]
        hit = int(y_true[idx].sum())
        rows.append({"top_fraction": float(frac), "top_k": int(k), "positive_in_top_k": hit, "precision_at_k": float(hit / k), "recall_at_k": float(hit / total_pos) if total_pos else 0.0})
    return rows


def calibration_table(y_true: np.ndarray, y_prob: np.ndarray, bins: int) -> pd.DataFrame:
    df = pd.DataFrame({"y": y_true.astype(int), "p": y_prob.astype(float)})
    if df.empty:
        return pd.DataFrame()
    try:
        df["bin"] = pd.qcut(df["p"], q=bins, duplicates="drop")
    except Exception:
        df["bin"] = pd.cut(df["p"], bins=bins)
    rows = []
    for b, g in df.groupby("bin", observed=True):
        rows.append({"bin": str(b), "rows": int(len(g)), "prob_min": float(g["p"].min()), "prob_max": float(g["p"].max()), "prob_mean": float(g["p"].mean()), "actual_rate": float(g["y"].mean()), "positive_count": int(g["y"].sum())})
    return pd.DataFrame(rows)


class EvalCollector:
    def __init__(self, targets: List[str], cfg: Dict[str, Any]):
        self.targets = targets
        self.cfg = cfg
        self.y_true = {t: [] for t in targets}
        self.y_prob = {t: [] for t in targets}

    def add_chunk(self, raw: pd.DataFrame, scored: pd.DataFrame, registry: Dict[str, Dict[str, Any]]) -> None:
        for target in self.targets:
            if target not in raw.columns:
                continue
            risk_col = f"risk_{registry[target]['output_name']}"
            if risk_col not in scored.columns:
                continue
            self.y_true[target].append(pd.to_numeric(raw[target], errors="coerce").fillna(0).astype(int).to_numpy())
            self.y_prob[target].append(pd.to_numeric(scored[risk_col], errors="coerce").fillna(0).to_numpy())

    def build(self, split: str, registry: Dict[str, Dict[str, Any]]) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        metrics, topks, cals = [], [], []
        fractions = list(get_cfg(self.cfg, "evaluation.topk_fractions", [0.01, 0.02, 0.05]))
        bins = int(get_cfg(self.cfg, "evaluation.calibration_bins", 10))
        for target in self.targets:
            if not self.y_true[target]:
                continue
            y = np.concatenate(self.y_true[target])
            p = np.concatenate(self.y_prob[target])
            info = registry[target]
            m = binary_metrics(y, p, float(info["threshold"]))
            m.update({"split": split, "target": target, "output_name": info["output_name"], "profile": info["profile"], "backend": info["backend"]})
            metrics.append(m)
            for row in topk_metrics(y, p, fractions):
                row.update({"split": split, "target": target, "output_name": info["output_name"], "profile": info["profile"]})
                topks.append(row)
            cal = calibration_table(y, p, bins)
            if not cal.empty:
                cal.insert(0, "split", split)
                cal.insert(1, "target", target)
                cal.insert(2, "output_name", info["output_name"])
                cal.insert(3, "profile", info["profile"])
                cals.append(cal)
        return pd.DataFrame(metrics), pd.DataFrame(topks), pd.concat(cals, ignore_index=True) if cals else pd.DataFrame()


# ============================================================
# 5. Pipeline
# ============================================================

def output_columns(scored: pd.DataFrame, cfg: Dict[str, Any], registry: Dict[str, Dict[str, Any]]) -> List[str]:
    cols: List[str] = []
    for c in list(get_cfg(cfg, "score.id_columns", [])):
        if c in scored.columns:
            cols.append(c)
    if bool(get_cfg(cfg, "score.include_context_evidence", True)):
        for c in list(get_cfg(cfg, "score.context_columns", [])):
            if c in scored.columns and c not in cols:
                cols.append(c)
    for info in registry.values():
        name = info["output_name"]
        for c in [f"risk_{name}", f"pred_{name}", f"threshold_{name}", f"profile_{name}"]:
            if c in scored.columns and c not in cols:
                cols.append(c)
    for c in ["model_fault_risk_score", "model_maintenance_risk_score", "model_repair_risk_score", "fault_confidence_score", "maintenance_confidence_score", "repair_confidence_score", "overall_operational_risk_score", "fault_judgment", "action_level", "final_reason", "l2_run_id", "l2_scored_time", "split"]:
        if c in scored.columns and c not in cols:
            cols.append(c)
    if bool(get_cfg(cfg, "score.include_target_labels_in_output", False)):
        for t in registry.keys():
            if t in scored.columns and t not in cols:
                cols.append(t)
    return cols


def score_one_split(split: str, input_path: Path, output_path: Path, combined_path: Optional[Path], first_combined: bool, cfg: Dict[str, Any], registry: Dict[str, Dict[str, Any]], run_id: str) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, pd.DataFrame, bool]:
    sep = str(get_cfg(cfg, "data.sep", ","))
    enc = str(get_cfg(cfg, "data.encoding", "utf-8-sig"))
    chunksize = int(get_cfg(cfg, "data.chunksize", 300000))
    compression = get_cfg(cfg, "data.output_compression", "gzip")
    maybe_remove(output_path)
    evaluator = EvalCollector(list(registry.keys()), cfg) if split in set(get_cfg(cfg, "score.evaluate_splits", ["valid", "test"])) else None
    summary = {"split": split, "input_path": str(input_path), "output_path": str(output_path), "rows": 0, "chunks": 0}
    print(f"\n[{split}] score {input_path}")
    first = True
    scored_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for i, chunk in enumerate(pd.read_csv(input_path, sep=sep, encoding=enc, chunksize=chunksize, low_memory=False), start=1):
        raw = chunk.copy()
        scored = add_predictions(chunk, registry, cfg)
        scored = add_final_judgment(scored, cfg, registry)
        scored["l2_run_id"] = run_id
        scored["l2_scored_time"] = scored_time
        scored["split"] = split
        if evaluator is not None:
            evaluator.add_chunk(raw, scored, registry)
        out = scored[output_columns(scored, cfg, registry)].copy()
        append_csv(out, output_path, first, compression)
        if combined_path is not None:
            append_csv(out, combined_path, first_combined, compression)
            first_combined = False
        first = False
        summary["rows"] += len(chunk)
        summary["chunks"] += 1
        print(f"[{split}] chunk={i} rows_total={summary['rows']:,}")
    if evaluator is not None:
        metrics, topk, cal = evaluator.build(split, registry)
    else:
        metrics, topk, cal = pd.DataFrame(), pd.DataFrame(), pd.DataFrame()
    return summary, metrics, topk, cal, first_combined


def collect_feature_importance(cfg: Dict[str, Any], config_path: str, run_id: str, registry: Dict[str, Dict[str, Any]], out_dir: Path) -> None:
    root = resolve_path(get_cfg(cfg, "paths.batch06.artifact_root"), config_path) / run_id
    parts = []
    for target, info in registry.items():
        f = root / info["profile"] / target / "feature_importance.csv"
        if f.exists():
            try:
                df = pd.read_csv(f)
                df.insert(0, "target", target)
                df.insert(1, "profile", info["profile"])
                parts.append(df)
            except Exception as e:
                print(f"[WARN] cannot read feature importance {f}: {e}")
    if parts:
        pd.concat(parts, ignore_index=True).to_csv(out_dir / "selected_feature_importance.csv", index=False, encoding="utf-8-sig")


def run_score(config_path: str, run_id_arg: Optional[str], splits_arg: Optional[str]) -> int:
    cfg = load_yaml(config_path)
    run_id = run_id_arg or resolve_run_id(cfg, config_path)
    print("Batch 07 L2 production scoring")
    print("Run id:", run_id)

    report_root = resolve_path(get_cfg(cfg, "paths.batch06.report_root"), config_path)
    selection = load_production_selection(report_root / run_id)
    policy = load_json(resolve_path(get_cfg(cfg, "paths.feature_policy"), config_path))
    registry = build_model_registry(cfg, config_path, run_id, policy, selection)
    print("Selected models:")
    for t, info in registry.items():
        print(f"  {t}: profile={info['profile']} backend={info['backend']} threshold={info['threshold']:.6f}")

    output_root = resolve_path(get_cfg(cfg, "paths.output.root_dir"), config_path) / run_id
    report_out = resolve_path(get_cfg(cfg, "paths.output.report_root"), config_path) / run_id
    output_root.mkdir(parents=True, exist_ok=True)
    report_out.mkdir(parents=True, exist_ok=True)

    splits = [s.strip() for s in (splits_arg.split(",") if splits_arg else get_cfg(cfg, "score.splits", ["train", "valid", "test"])) if s.strip()]
    prepared = {
        "train": resolve_path(get_cfg(cfg, "paths.prepared.train"), config_path),
        "valid": resolve_path(get_cfg(cfg, "paths.prepared.valid"), config_path),
        "test": resolve_path(get_cfg(cfg, "paths.prepared.test"), config_path),
    }
    compression = get_cfg(cfg, "data.output_compression", "gzip")
    suffix = ".csv.gz" if compression == "gzip" else ".csv"
    combined_path = output_root / f"ai_l2_fault_judgment_result{suffix}" if bool(get_cfg(cfg, "score.write_combined_output", True)) else None
    if combined_path is not None:
        maybe_remove(combined_path)
    first_combined = True

    summaries, metrics_parts, topk_parts, cal_parts = [], [], [], []
    for split in splits:
        out_path = output_root / f"{split}_l2_fault_judgment{suffix}"
        summary, metrics, topk, cal, first_combined = score_one_split(split, prepared[split], out_path, combined_path, first_combined, cfg, registry, run_id)
        summaries.append(summary)
        if not metrics.empty:
            metrics_parts.append(metrics)
        if not topk.empty:
            topk_parts.append(topk)
        if not cal.empty:
            cal_parts.append(cal)

    pd.DataFrame(summaries).to_csv(report_out / "l2_scoring_split_summary.csv", index=False, encoding="utf-8-sig")
    metrics_all = pd.concat(metrics_parts, ignore_index=True) if metrics_parts else pd.DataFrame()
    if not metrics_all.empty:
        metrics_all.to_csv(report_out / "l2_selected_model_metrics.csv", index=False, encoding="utf-8-sig")
    if topk_parts:
        pd.concat(topk_parts, ignore_index=True).to_csv(report_out / "l2_selected_model_topk_metrics.csv", index=False, encoding="utf-8-sig")
    if cal_parts:
        pd.concat(cal_parts, ignore_index=True).to_csv(report_out / "l2_selected_model_calibration.csv", index=False, encoding="utf-8-sig")
    collect_feature_importance(cfg, config_path, run_id, registry, report_out)

    manifest = {
        "batch": "07_l2_production_scoring",
        "run_id": run_id,
        "created_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "production_version": f"{get_cfg(cfg, 'project.production_version_prefix', 'l2_fault_judgment')}_{run_id}",
        "selected_models": {t: {k: v for k, v in info.items() if k not in {"model"}} for t, info in registry.items()},
        "split_summaries": summaries,
        "combined_output_path": str(combined_path) if combined_path else None,
    }
    save_json(manifest, report_out / "l2_production_scoring_manifest.json")

    print("\n=== Batch 07 completed ===")
    print("Output root:", output_root)
    print("Report root:", report_out)
    print("Combined:", combined_path)
    if not metrics_all.empty:
        cols = [c for c in ["split", "target", "profile", "average_precision", "roc_auc", "f1", "precision", "recall", "pred_positive_rate"] if c in metrics_all.columns]
        print("\nSelected model metrics:")
        print(metrics_all[cols].sort_values(["split", "target"]).to_string(index=False))
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Batch 07 - Score L2 selected production models and create final fault judgment table.")
    p.add_argument("--config", required=True, help="Path to score_l2.yaml")
    p.add_argument("--run-id", default=None, help="Batch 06 run id. Default uses config/latest.")
    p.add_argument("--splits", default=None, help="Comma-separated split list, e.g. valid,test")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(run_score(args.config, args.run_id, args.splits))
