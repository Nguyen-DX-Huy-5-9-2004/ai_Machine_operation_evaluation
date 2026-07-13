from __future__ import annotations

import argparse
import json
import math
import os
import pickle
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

try:
    import joblib
except Exception:  # pragma: no cover
    joblib = None


# ============================================================
# 1. IO and configuration
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


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def setup_seed(seed: int) -> None:
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)


def dump_pickle(obj: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if joblib is not None:
        joblib.dump(obj, path)
    else:
        with path.open("wb") as f:
            pickle.dump(obj, f)


# ============================================================
# 2. Data preparation
# ============================================================


def read_dataset(path: Path, sep: str, encoding: str, required_cols: Sequence[str]) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(path)
    header = pd.read_csv(path, sep=sep, encoding=encoding, nrows=0).columns.tolist()
    missing = [c for c in required_cols if c not in header]
    if missing:
        raise ValueError(f"Missing columns in {path}: {missing}")
    print(f"Read dataset: {path}")
    df = pd.read_csv(path, sep=sep, encoding=encoding, low_memory=False)
    print(f"  shape={df.shape}")
    return df


def optional_sample_train(df: pd.DataFrame, cfg: Dict[str, Any], cli_sample_frac: Optional[float], cli_max_rows: Optional[int]) -> pd.DataFrame:
    seed = int(get_cfg(cfg, "project.seed", 42))
    sample_frac = cli_sample_frac if cli_sample_frac is not None else get_cfg(cfg, "training_plan.sample_frac", None)
    max_rows = cli_max_rows if cli_max_rows is not None else get_cfg(cfg, "training_plan.max_train_rows", None)

    if sample_frac is not None:
        sample_frac = float(sample_frac)
        if not (0 < sample_frac <= 1):
            raise ValueError("sample_frac must be in (0, 1].")
        if sample_frac < 1:
            print(f"[DEV] Sample train by frac={sample_frac}")
            df = df.sample(frac=sample_frac, random_state=seed).reset_index(drop=True)

    if max_rows is not None:
        max_rows = int(max_rows)
        if max_rows > 0 and len(df) > max_rows:
            print(f"[DEV] Sample train by max_rows={max_rows}")
            df = df.sample(n=max_rows, random_state=seed).reset_index(drop=True)

    return df


def sanitize_feature_list(features: Sequence[str], df: pd.DataFrame, cfg: Dict[str, Any]) -> List[str]:
    hard_forbidden = set(get_cfg(cfg, "features.hard_forbidden", []))
    present = []
    missing = []
    forbidden = []
    for c in features:
        if c in hard_forbidden:
            forbidden.append(c)
            continue
        if c not in df.columns:
            missing.append(c)
            continue
        present.append(c)
    if forbidden:
        raise ValueError(f"Feature policy contains hard-forbidden columns: {forbidden}")
    if missing:
        print(f"[WARN] Missing features ignored: {missing}")
    return sorted(dict.fromkeys(present))


def get_feature_profiles(policy: Dict[str, Any], cfg: Dict[str, Any], profiles_arg: Optional[str]) -> Dict[str, List[str]]:
    all_profiles = dict(policy.get("feature_profiles", {}))
    if not all_profiles:
        raise ValueError("feature_policy.json does not contain feature_profiles.")

    if profiles_arg:
        selected = [p.strip() for p in profiles_arg.split(",") if p.strip()]
    else:
        selected = list(get_cfg(cfg, "training_plan.profiles", []))

    out: Dict[str, List[str]] = {}
    for p in selected:
        if p not in all_profiles:
            raise ValueError(f"Unknown profile '{p}'. Available: {list(all_profiles.keys())}")
        out[p] = list(all_profiles[p])
    return out


def get_targets(policy: Dict[str, Any], cfg: Dict[str, Any], targets_arg: Optional[str]) -> List[str]:
    if targets_arg and targets_arg.lower() != "all":
        targets = [t.strip() for t in targets_arg.split(",") if t.strip()]
    else:
        targets = list(get_cfg(cfg, "training_plan.targets", [])) or list(policy.get("target_columns", []))
    if not targets:
        raise ValueError("No targets configured.")
    return targets


def infer_categorical_features(features: Sequence[str], cfg: Dict[str, Any]) -> List[str]:
    configured = set(get_cfg(cfg, "features.categorical_columns", []))
    return [c for c in features if c in configured]


def make_X_y(
    df: pd.DataFrame,
    features: Sequence[str],
    target: str,
    categorical_cols: Sequence[str],
) -> Tuple[pd.DataFrame, np.ndarray]:
    if target not in df.columns:
        raise ValueError(f"Missing target: {target}")

    X = df.loc[:, list(features)].copy()

    for c in features:
        if c in categorical_cols:
            X[c] = pd.to_numeric(X[c], errors="coerce").fillna(-1).astype("int32")
        else:
            X[c] = pd.to_numeric(X[c], errors="coerce").replace([np.inf, -np.inf], np.nan).astype("float32")

    y = pd.to_numeric(df[target], errors="coerce").fillna(0).astype("int8").to_numpy()
    y = (y > 0).astype("int8")
    return X, y


def get_ids(df: pd.DataFrame, id_cols: Sequence[str]) -> pd.DataFrame:
    cols = [c for c in id_cols if c in df.columns]
    return df.loc[:, cols].copy()


# ============================================================
# 3. Metrics
# ============================================================


def safe_average_precision(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    if np.sum(y_true) == 0:
        return float("nan")
    return float(average_precision_score(y_true, y_prob))


def safe_roc_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_prob))


def safe_log_loss(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    y_prob = np.clip(y_prob, 1e-7, 1 - 1e-7)
    return float(log_loss(y_true, y_prob, labels=[0, 1]))


def choose_threshold_by_f1(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, float]:
    if np.sum(y_true) == 0:
        return {"threshold": 0.5, "f1": 0.0, "precision": 0.0, "recall": 0.0}

    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    # precision/recall length = thresholds + 1. Ignore last no-threshold point.
    p = precision[:-1]
    r = recall[:-1]
    denom = p + r
    f1 = np.divide(2 * p * r, denom, out=np.zeros_like(denom), where=denom > 0)
    if len(thresholds) == 0:
        return {"threshold": 0.5, "f1": 0.0, "precision": 0.0, "recall": 0.0}
    i = int(np.nanargmax(f1))
    return {
        "threshold": float(thresholds[i]),
        "f1": float(f1[i]),
        "precision": float(p[i]),
        "recall": float(r[i]),
    }


def metrics_at_threshold(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> Dict[str, Any]:
    y_pred = (y_prob >= threshold).astype("int8")
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "threshold": float(threshold),
        "pred_positive_rate": float(np.mean(y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
    }


def topk_metrics(y_true: np.ndarray, y_prob: np.ndarray, fracs: Sequence[float]) -> pd.DataFrame:
    n = len(y_true)
    pos_total = int(np.sum(y_true))
    rows = []
    if n == 0:
        return pd.DataFrame(rows)

    order = np.argsort(-y_prob)
    for frac in fracs:
        k = max(1, int(math.ceil(n * float(frac))))
        idx = order[:k]
        pos = int(np.sum(y_true[idx]))
        rows.append({
            "top_frac": float(frac),
            "top_k": int(k),
            "positive_in_top_k": pos,
            "precision_at_k": float(pos / k) if k else 0.0,
            "recall_at_k": float(pos / pos_total) if pos_total else 0.0,
            "positive_total": pos_total,
        })
    return pd.DataFrame(rows)


def calibration_table(y_true: np.ndarray, y_prob: np.ndarray, bins: int) -> pd.DataFrame:
    df = pd.DataFrame({"y_true": y_true, "y_prob": y_prob})
    try:
        df["bin"] = pd.qcut(df["y_prob"], q=bins, duplicates="drop")
    except ValueError:
        df["bin"] = pd.cut(df["y_prob"], bins=bins, duplicates="drop")
    out = (
        df.groupby("bin", observed=True)
        .agg(count=("y_true", "size"), mean_pred=("y_prob", "mean"), actual_rate=("y_true", "mean"))
        .reset_index()
    )
    out["bin"] = out["bin"].astype(str)
    return out


def evaluate_split(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float,
    split: str,
    profile: str,
    target: str,
    topk_fracs: Sequence[float],
    calibration_bins: int,
) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame]:
    base = {
        "profile": profile,
        "target": target,
        "split": split,
        "rows": int(len(y_true)),
        "positive_count": int(np.sum(y_true)),
        "positive_rate": float(np.mean(y_true)) if len(y_true) else 0.0,
        "average_precision": safe_average_precision(y_true, y_prob),
        "roc_auc": safe_roc_auc(y_true, y_prob),
        "log_loss": safe_log_loss(y_true, y_prob),
        "brier_score": float(brier_score_loss(y_true, np.clip(y_prob, 0, 1))) if len(np.unique(y_true)) > 1 else float("nan"),
        "prob_mean": float(np.mean(y_prob)),
        "prob_p50": float(np.quantile(y_prob, 0.50)),
        "prob_p90": float(np.quantile(y_prob, 0.90)),
        "prob_p95": float(np.quantile(y_prob, 0.95)),
        "prob_p99": float(np.quantile(y_prob, 0.99)),
    }
    base.update({f"threshold_{k}": v for k, v in metrics_at_threshold(y_true, y_prob, threshold).items()})

    topk = topk_metrics(y_true, y_prob, topk_fracs)
    if len(topk):
        topk.insert(0, "split", split)
        topk.insert(0, "target", target)
        topk.insert(0, "profile", profile)

    cal = calibration_table(y_true, y_prob, calibration_bins)
    if len(cal):
        cal.insert(0, "split", split)
        cal.insert(0, "target", target)
        cal.insert(0, "profile", profile)

    return base, topk, cal


# ============================================================
# 4. Model training backends
# ============================================================


def pos_weight(y: np.ndarray, max_value: float) -> float:
    pos = int(np.sum(y))
    neg = int(len(y) - pos)
    if pos <= 0:
        return 1.0
    return float(min(max_value, max(1.0, neg / pos)))


def train_lightgbm_model(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_valid: pd.DataFrame,
    y_valid: np.ndarray,
    categorical_cols: Sequence[str],
    cfg: Dict[str, Any],
) -> Tuple[Any, str, Dict[str, Any]]:
    try:
        import lightgbm as lgb
    except Exception as e:
        raise ImportError("LightGBM is not installed. Run: pip install lightgbm") from e

    params = dict(get_cfg(cfg, "lightgbm.params", {}))
    params["random_state"] = int(get_cfg(cfg, "project.seed", params.get("random_state", 42)))
    max_spw = float(get_cfg(cfg, "lightgbm.max_scale_pos_weight", 100.0))
    params["scale_pos_weight"] = pos_weight(y_train, max_spw)

    try_gpu = bool(get_cfg(cfg, "lightgbm.try_gpu", True))
    fallback = bool(get_cfg(cfg, "lightgbm.fallback_to_cpu", True))
    early_stopping_rounds = int(get_cfg(cfg, "lightgbm.early_stopping_rounds", 200))
    log_period = int(get_cfg(cfg, "lightgbm.log_evaluation_period", 100))

    callbacks = [
        lgb.early_stopping(early_stopping_rounds, verbose=True),
        lgb.log_evaluation(log_period),
    ]

    categorical_present = [c for c in categorical_cols if c in X_train.columns]

    def fit_once(device_type: str) -> Any:
        local_params = dict(params)
        if device_type == "gpu":
            local_params["device_type"] = "gpu"
        else:
            local_params.pop("device_type", None)
            local_params["device_type"] = "cpu"
        model = lgb.LGBMClassifier(**local_params)
        model.fit(
            X_train,
            y_train,
            eval_set=[(X_valid, y_valid)],
            eval_metric=["auc", "binary_logloss"],
            categorical_feature=categorical_present if categorical_present else "auto",
            callbacks=callbacks,
        )
        return model

    metadata = {"scale_pos_weight": params["scale_pos_weight"], "categorical_features": categorical_present}

    if try_gpu:
        try:
            print("  Try LightGBM GPU...")
            model = fit_once("gpu")
            metadata["device_type"] = "gpu"
            return model, "lightgbm", metadata
        except Exception as e:
            if not fallback:
                raise
            print(f"  [WARN] LightGBM GPU failed, fallback to CPU. Reason: {repr(e)[:300]}")

    print("  Train LightGBM CPU...")
    model = fit_once("cpu")
    metadata["device_type"] = "cpu"
    return model, "lightgbm", metadata


def train_xgboost_model(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_valid: pd.DataFrame,
    y_valid: np.ndarray,
    categorical_cols: Sequence[str],
    cfg: Dict[str, Any],
) -> Tuple[Any, str, Dict[str, Any]]:
    try:
        import xgboost as xgb
    except Exception as e:
        raise ImportError("XGBoost is not installed. Run: pip install xgboost") from e

    params = dict(get_cfg(cfg, "xgboost.params", {}))
    params["random_state"] = int(get_cfg(cfg, "project.seed", params.get("random_state", 42)))
    max_spw = float(get_cfg(cfg, "xgboost.max_scale_pos_weight", 100.0))
    params["scale_pos_weight"] = pos_weight(y_train, max_spw)
    early_stopping_rounds = int(get_cfg(cfg, "xgboost.early_stopping_rounds", 150))

    # XGBoost categorical support is optional. To stay robust, keep numeric-coded categories.
    model = xgb.XGBClassifier(**params)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_valid, y_valid)],
        verbose=100,
        early_stopping_rounds=early_stopping_rounds,
    )
    metadata = {"scale_pos_weight": params["scale_pos_weight"], "categorical_features_numeric_coded": list(categorical_cols)}
    return model, "xgboost", metadata


def predict_proba_binary(model: Any, X: pd.DataFrame) -> np.ndarray:
    p = model.predict_proba(X)
    if isinstance(p, list):
        p = p[0]
    if p.ndim == 2:
        return p[:, 1].astype("float32")
    return p.astype("float32")


def feature_importance(model: Any, backend: str, features: Sequence[str]) -> pd.DataFrame:
    if backend == "lightgbm" and hasattr(model, "booster_"):
        booster = model.booster_
        gain = booster.feature_importance(importance_type="gain")
        split = booster.feature_importance(importance_type="split")
        return pd.DataFrame({"feature": list(features), "importance_gain": gain, "importance_split": split}).sort_values(
            "importance_gain", ascending=False
        )
    if backend == "xgboost" and hasattr(model, "feature_importances_"):
        return pd.DataFrame({"feature": list(features), "importance_gain": model.feature_importances_}).sort_values(
            "importance_gain", ascending=False
        )
    return pd.DataFrame({"feature": list(features)})


# ============================================================
# 5. Training orchestration
# ============================================================


@dataclass
class RunContext:
    run_id: str
    artifact_dir: Path
    report_dir: Path
    prediction_dir: Path


def train_one_profile_target(
    profile: str,
    target: str,
    features: List[str],
    categorical_cols: List[str],
    train_df: pd.DataFrame,
    valid_df: pd.DataFrame,
    test_df: pd.DataFrame,
    cfg: Dict[str, Any],
    backend: str,
    ctx: RunContext,
) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    print("\n" + "=" * 100)
    print(f"Train profile={profile} target={target} backend={backend} features={len(features)}")

    X_train, y_train = make_X_y(train_df, features, target, categorical_cols)
    X_valid, y_valid = make_X_y(valid_df, features, target, categorical_cols)
    X_test, y_test = make_X_y(test_df, features, target, categorical_cols)

    pos = int(np.sum(y_train))
    if pos == 0:
        raise ValueError(f"Target {target} has no positive rows in train split.")

    if backend == "lightgbm":
        model, backend_name, model_meta = train_lightgbm_model(X_train, y_train, X_valid, y_valid, categorical_cols, cfg)
    elif backend == "xgboost":
        model, backend_name, model_meta = train_xgboost_model(X_train, y_train, X_valid, y_valid, categorical_cols, cfg)
    else:
        raise ValueError(f"Unsupported backend: {backend}")

    valid_prob = predict_proba_binary(model, X_valid)
    test_prob = predict_proba_binary(model, X_test)

    threshold_info = choose_threshold_by_f1(y_valid, valid_prob)
    threshold = float(threshold_info["threshold"])
    print(f"  Valid threshold by F1: {threshold_info}")

    topk_fracs = list(get_cfg(cfg, "evaluation.topk_fracs", [0.005, 0.01, 0.02]))
    calibration_bins = int(get_cfg(cfg, "evaluation.calibration_bins", 10))

    valid_metrics, valid_topk, valid_cal = evaluate_split(
        y_valid, valid_prob, threshold, "valid", profile, target, topk_fracs, calibration_bins
    )
    test_metrics, test_topk, test_cal = evaluate_split(
        y_test, test_prob, threshold, "test", profile, target, topk_fracs, calibration_bins
    )

    train_summary = {
        "profile": profile,
        "target": target,
        "backend": backend_name,
        "features": len(features),
        "train_rows": int(len(y_train)),
        "train_positive_count": int(np.sum(y_train)),
        "train_positive_rate": float(np.mean(y_train)),
        "valid_threshold": threshold,
        "valid_threshold_f1": float(threshold_info["f1"]),
        "valid_threshold_precision": float(threshold_info["precision"]),
        "valid_threshold_recall": float(threshold_info["recall"]),
        **{f"valid_{k}": v for k, v in valid_metrics.items() if k not in {"profile", "target", "split"}},
        **{f"test_{k}": v for k, v in test_metrics.items() if k not in {"profile", "target", "split"}},
    }

    model_dir = ctx.artifact_dir / profile / target
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "model.joblib"
    dump_pickle(model, model_path)

    metadata = {
        "profile": profile,
        "target": target,
        "backend": backend_name,
        "model_path": str(model_path),
        "features": features,
        "categorical_features": categorical_cols,
        "threshold": threshold,
        "threshold_info": threshold_info,
        "model_metadata": model_meta,
        "train_summary": train_summary,
    }
    save_json(metadata, model_dir / "metadata.json")

    fi = feature_importance(model, backend_name, features)
    if len(fi):
        fi.insert(0, "target", target)
        fi.insert(0, "profile", profile)
        fi.to_csv(model_dir / "feature_importance.csv", index=False, encoding="utf-8-sig")

    valid_pred_df = get_ids(valid_df, get_cfg(cfg, "data.id_columns", []))
    valid_pred_df[f"y_true__{target}"] = y_valid
    valid_pred_df[f"prob__{target}"] = valid_prob
    valid_pred_df[f"pred__{target}"] = (valid_prob >= threshold).astype("int8")

    test_pred_df = get_ids(test_df, get_cfg(cfg, "data.id_columns", []))
    test_pred_df[f"y_true__{target}"] = y_test
    test_pred_df[f"prob__{target}"] = test_prob
    test_pred_df[f"pred__{target}"] = (test_prob >= threshold).astype("int8")

    if bool(get_cfg(cfg, "evaluation.save_predictions", True)):
        pred_dir = ctx.prediction_dir / profile / target
        pred_dir.mkdir(parents=True, exist_ok=True)
        valid_pred_df.to_csv(pred_dir / "valid_predictions.csv.gz", index=False, encoding="utf-8-sig", compression="gzip")
        test_pred_df.to_csv(pred_dir / "test_predictions.csv.gz", index=False, encoding="utf-8-sig", compression="gzip")

    topk = pd.concat([valid_topk, test_topk], ignore_index=True)
    cal = pd.concat([valid_cal, test_cal], ignore_index=True)
    metrics_rows = pd.DataFrame([valid_metrics, test_metrics])

    # Free large matrices early.
    del X_train, X_valid, X_test, y_train, y_valid, y_test

    return train_summary, metrics_rows, topk, cal, fi


def merge_prediction_parts(parts: List[pd.DataFrame], id_cols: Sequence[str]) -> pd.DataFrame:
    if not parts:
        return pd.DataFrame()
    out = parts[0]
    for p in parts[1:]:
        merge_cols = [c for c in id_cols if c in out.columns and c in p.columns]
        value_cols = [c for c in p.columns if c not in merge_cols]
        out = out.merge(p[merge_cols + value_cols], on=merge_cols, how="left", validate="one_to_one")
    return out


def select_production_profiles(summary_df: pd.DataFrame, metric: str) -> Dict[str, Any]:
    metric_col = f"valid_{metric}"
    if metric_col not in summary_df.columns:
        raise ValueError(f"Selection metric not found in summary: {metric_col}")
    selections = []
    for target, g in summary_df.groupby("target"):
        gg = g.sort_values(metric_col, ascending=False, na_position="last")
        best = gg.iloc[0].to_dict()
        selections.append({
            "target": target,
            "selected_profile": best["profile"],
            "selected_backend": best["backend"],
            "valid_metric": metric,
            "valid_metric_value": float(best[metric_col]) if pd.notna(best[metric_col]) else None,
            "valid_threshold": float(best["valid_threshold"]),
            "test_average_precision": float(best.get("test_average_precision", np.nan)),
            "test_roc_auc": float(best.get("test_roc_auc", np.nan)),
            "test_threshold_f1": float(best.get("test_threshold_f1", np.nan)),
        })
    return {"selection_metric": metric, "targets": selections}


def run_train(config_path: str, profiles_arg: Optional[str], targets_arg: Optional[str], backend_arg: Optional[str], sample_frac: Optional[float], max_train_rows: Optional[int]) -> int:
    cfg = load_yaml(config_path)
    seed = int(get_cfg(cfg, "project.seed", 42))
    setup_seed(seed)

    run_id = f"{get_cfg(cfg, 'project.run_name_prefix', 'l2_multilabel')}_{timestamp()}"
    artifact_root = resolve_path(get_cfg(cfg, "paths.artifact_root"), config_path)
    report_root = resolve_path(get_cfg(cfg, "paths.report_root"), config_path)
    prediction_root = resolve_path(get_cfg(cfg, "paths.prediction_root"), config_path)

    ctx = RunContext(
        run_id=run_id,
        artifact_dir=artifact_root / run_id,
        report_dir=report_root / run_id,
        prediction_dir=prediction_root / run_id,
    )
    ctx.artifact_dir.mkdir(parents=True, exist_ok=True)
    ctx.report_dir.mkdir(parents=True, exist_ok=True)
    ctx.prediction_dir.mkdir(parents=True, exist_ok=True)

    sep = str(get_cfg(cfg, "data.sep", ","))
    encoding = str(get_cfg(cfg, "data.encoding", "utf-8-sig"))
    id_cols = list(get_cfg(cfg, "data.id_columns", []))

    policy_path = resolve_path(get_cfg(cfg, "paths.feature_policy"), config_path)
    policy = load_json(policy_path)

    profiles = get_feature_profiles(policy, cfg, profiles_arg)
    targets = get_targets(policy, cfg, targets_arg)
    backend = backend_arg or str(get_cfg(cfg, "training_plan.backend", "lightgbm"))

    all_required = sorted(set(id_cols + targets + [c for fs in profiles.values() for c in fs]))

    train_path = resolve_path(get_cfg(cfg, "paths.prepared.train"), config_path)
    valid_path = resolve_path(get_cfg(cfg, "paths.prepared.valid"), config_path)
    test_path = resolve_path(get_cfg(cfg, "paths.prepared.test"), config_path)

    train_df = read_dataset(train_path, sep, encoding, all_required)
    valid_df = read_dataset(valid_path, sep, encoding, all_required)
    test_df = read_dataset(test_path, sep, encoding, all_required)

    train_df = optional_sample_train(train_df, cfg, sample_frac, max_train_rows)

    print("\nTraining plan")
    print(f"  run_id   : {run_id}")
    print(f"  backend  : {backend}")
    print(f"  profiles : {list(profiles.keys())}")
    print(f"  targets  : {targets}")
    print(f"  train    : {train_df.shape}")
    print(f"  valid    : {valid_df.shape}")
    print(f"  test     : {test_df.shape}")

    all_summaries: List[Dict[str, Any]] = []
    all_metrics: List[pd.DataFrame] = []
    all_topk: List[pd.DataFrame] = []
    all_cal: List[pd.DataFrame] = []
    all_fi: List[pd.DataFrame] = []

    # Store prediction parts per profile/split, then merge by target.
    prediction_parts: Dict[Tuple[str, str], List[pd.DataFrame]] = {}

    for profile, raw_features in profiles.items():
        features = sanitize_feature_list(raw_features, train_df, cfg)
        categorical_cols = infer_categorical_features(features, cfg)
        print(f"\nProfile {profile}: features={len(features)}, categorical={categorical_cols}")

        for target in targets:
            summary, metrics_rows, topk, cal, fi = train_one_profile_target(
                profile=profile,
                target=target,
                features=features,
                categorical_cols=categorical_cols,
                train_df=train_df,
                valid_df=valid_df,
                test_df=test_df,
                cfg=cfg,
                backend=backend,
                ctx=ctx,
            )
            all_summaries.append(summary)
            all_metrics.append(metrics_rows)
            all_topk.append(topk)
            all_cal.append(cal)
            all_fi.append(fi)

    summary_df = pd.DataFrame(all_summaries)
    metrics_df = pd.concat(all_metrics, ignore_index=True) if all_metrics else pd.DataFrame()
    topk_df = pd.concat(all_topk, ignore_index=True) if all_topk else pd.DataFrame()
    cal_df = pd.concat(all_cal, ignore_index=True) if all_cal else pd.DataFrame()
    fi_df = pd.concat(all_fi, ignore_index=True) if all_fi else pd.DataFrame()

    summary_path = ctx.report_dir / "l2_training_summary.csv"
    metrics_path = ctx.report_dir / "l2_metrics_by_split.csv"
    topk_path = ctx.report_dir / "l2_topk_metrics.csv"
    cal_path = ctx.report_dir / "l2_calibration.csv"
    fi_path = ctx.report_dir / "l2_feature_importance_all.csv"

    summary_df.to_csv(summary_path, index=False, encoding="utf-8-sig")
    metrics_df.to_csv(metrics_path, index=False, encoding="utf-8-sig")
    topk_df.to_csv(topk_path, index=False, encoding="utf-8-sig")
    cal_df.to_csv(cal_path, index=False, encoding="utf-8-sig")
    if len(fi_df):
        fi_df.to_csv(fi_path, index=False, encoding="utf-8-sig")

    selection_metric = str(get_cfg(cfg, "selection.metric", "average_precision"))
    selection = select_production_profiles(summary_df, selection_metric)
    save_json(selection, ctx.report_dir / "production_profile_selection.json")

    run_summary = {
        "run_id": run_id,
        "backend": backend,
        "profiles": list(profiles.keys()),
        "targets": targets,
        "train_rows": int(len(train_df)),
        "valid_rows": int(len(valid_df)),
        "test_rows": int(len(test_df)),
        "artifact_dir": str(ctx.artifact_dir),
        "report_dir": str(ctx.report_dir),
        "prediction_dir": str(ctx.prediction_dir),
        "feature_policy": str(policy_path),
        "reports": {
            "summary": str(summary_path),
            "metrics": str(metrics_path),
            "topk": str(topk_path),
            "calibration": str(cal_path),
            "feature_importance": str(fi_path),
            "selection": str(ctx.report_dir / "production_profile_selection.json"),
        },
        "notes": [
            "Use valid split for threshold and profile selection.",
            "Use test split only for final assessment, not model selection.",
            "Default production candidates are safe and strict_continuous profiles.",
        ],
    }
    save_json(run_summary, ctx.report_dir / "l2_train_run_summary.json")

    print("\n" + "=" * 100)
    print("L2 training completed")
    print(f"Run id      : {run_id}")
    print(f"Artifacts   : {ctx.artifact_dir}")
    print(f"Reports     : {ctx.report_dir}")
    print("\nTop summary:")
    cols = ["profile", "target", "valid_average_precision", "valid_roc_auc", "valid_threshold_f1", "test_average_precision", "test_roc_auc", "test_threshold_f1"]
    print(summary_df[[c for c in cols if c in summary_df.columns]].to_string(index=False))
    print("\nProduction selection:")
    print(json.dumps(selection, ensure_ascii=False, indent=2))

    return 0


# ============================================================
# 6. CLI
# ============================================================


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train L2 multi-label fault classifiers.")
    parser.add_argument("--config", required=True, help="Path to train_l2.yaml")
    parser.add_argument("--profiles", default=None, help="Comma-separated profiles, e.g. safe,strict_continuous")
    parser.add_argument("--targets", default=None, help="Comma-separated targets or all")
    parser.add_argument("--backend", default=None, choices=["lightgbm", "xgboost"], help="Override backend")
    parser.add_argument("--sample-frac", type=float, default=None, help="Debug only: sample train fraction")
    parser.add_argument("--max-train-rows", type=int, default=None, help="Debug only: max sampled train rows")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return run_train(
        config_path=args.config,
        profiles_arg=args.profiles,
        targets_arg=args.targets,
        backend_arg=args.backend,
        sample_frac=args.sample_frac,
        max_train_rows=args.max_train_rows,
    )


if __name__ == "__main__":
    raise SystemExit(main())
