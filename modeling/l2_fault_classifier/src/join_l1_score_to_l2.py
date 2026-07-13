from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yaml


def load_yaml(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML: {path}")
    return data


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


def read_header(path: Path, sep: str, encoding: str) -> List[str]:
    return list(pd.read_csv(path, sep=sep, encoding=encoding, nrows=0).columns)


def ensure_columns_exist(path: Path, required: List[str], sep: str, encoding: str) -> None:
    header = set(read_header(path, sep, encoding))
    missing = [c for c in required if c not in header]
    if missing:
        raise ValueError(f"Missing columns in {path}:\n{missing}")


def normalize_event_id(df: pd.DataFrame, key: str = "event_id") -> pd.DataFrame:
    if key not in df.columns:
        raise ValueError(f"Missing key column: {key}")
    out = df.copy()
    out[key] = pd.to_numeric(out[key], errors="coerce")
    if out[key].isna().any():
        n = int(out[key].isna().sum())
        raise ValueError(f"{key} contains {n} null/non-numeric values.")
    out[key] = out[key].astype("int64")
    return out


def load_l1_score(cfg: Dict[str, Any], config_path: str | Path) -> pd.DataFrame:
    sep = str(get_cfg(cfg, "data.sep", ","))
    encoding = str(get_cfg(cfg, "data.encoding", "utf-8-sig"))
    path = resolve_path(get_cfg(cfg, "paths.l1_score.production"), config_path)

    if not path.exists():
        raise FileNotFoundError(
            f"L1 production score file not found:\n{path}\n"
            "Hãy chạy Batch 04 Fix trước để tạo ai_l1_operation_anomaly_result_production.csv."
        )

    l1_cols = list(get_cfg(cfg, "join.l1_columns", []))
    if "event_id" not in l1_cols:
        l1_cols = ["event_id"] + l1_cols

    ensure_columns_exist(path, l1_cols, sep, encoding)

    print(f"Load L1 production score: {path}")
    l1 = pd.read_csv(path, sep=sep, encoding=encoding, usecols=l1_cols, low_memory=False)
    l1 = normalize_event_id(l1, "event_id")

    if bool(get_cfg(cfg, "join.validate_l1_unique_event_id", True)):
        dup = int(l1["event_id"].duplicated().sum())
        if dup > 0:
            raise ValueError(f"L1 score has duplicated event_id: {dup}")

    rename_map = dict(get_cfg(cfg, "join.rename_l1_columns", {}))
    l1 = l1.rename(columns=rename_map)
    return l1


def add_l1_join_flags_and_fill(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    out = df.copy()

    if "_merge" in out.columns:
        out["l1_join_missing_flag"] = (out["_merge"] != "both").astype("int8")
        out = out.drop(columns=["_merge"])
    else:
        out["l1_join_missing_flag"] = 0

    available = np.zeros(len(out), dtype=bool)
    for c in ["score_lenient_norm", "score_strict_norm"]:
        if c in out.columns:
            available |= pd.to_numeric(out[c], errors="coerce").notna().to_numpy()
    out["l1_score_available_flag"] = available.astype("int8")

    if "behavior_reason" not in out.columns:
        out["behavior_reason"] = "L1_JOIN_MISSING"
    out["behavior_reason"] = out["behavior_reason"].fillna("L1_JOIN_MISSING").astype(str)

    if "action_level_l1" not in out.columns:
        out["action_level_l1"] = "L1_JOIN_MISSING"
    out["action_level_l1"] = out["action_level_l1"].fillna("L1_JOIN_MISSING").astype(str)

    reason_map = dict(get_cfg(cfg, "join.behavior_reason_mapping", {}))
    action_map = dict(get_cfg(cfg, "join.action_level_mapping", {}))

    out["behavior_reason_code"] = out["behavior_reason"].map(reason_map).fillna(
        reason_map.get("L1_JOIN_MISSING", 9)
    ).astype("int16")
    out["action_level_l1_code"] = out["action_level_l1"].map(action_map).fillna(
        action_map.get("L1_JOIN_MISSING", 9)
    ).astype("int16")

    if bool(get_cfg(cfg, "join.fill_numeric_l1_with_zero", True)):
        l1_num_cols = (
            list(get_cfg(cfg, "l2.recommended_l1_numeric_features", []))
            + list(get_cfg(cfg, "l2.recommended_l1_flag_features", []))
            + list(get_cfg(cfg, "l2.recommended_l1_encoded_features", []))
        )
        for c in l1_num_cols:
            if c in out.columns:
                out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0)
        for c in list(get_cfg(cfg, "l2.recommended_l1_flag_features", [])):
            if c in out.columns:
                out[c] = out[c].astype("int8")

    return out


def classify_columns_for_feature_manifest(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
    id_cols = list(get_cfg(cfg, "l2.id_columns", []))
    target_cols = [c for c in list(get_cfg(cfg, "l2.target_columns", [])) if c in df.columns]
    leakage_cols = [c for c in list(get_cfg(cfg, "l2.leakage_columns", [])) if c in df.columns]
    text_cols = [c for c in list(get_cfg(cfg, "l2.text_or_reason_columns", [])) if c in df.columns]

    forbidden = set(id_cols + target_cols + leakage_cols + text_cols)
    numeric_cols = []
    categorical_like_cols = []

    for c in df.columns:
        if c in forbidden:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            numeric_cols.append(c)
        else:
            categorical_like_cols.append(c)

    recommended_l1 = (
        list(get_cfg(cfg, "l2.recommended_l1_numeric_features", []))
        + list(get_cfg(cfg, "l2.recommended_l1_flag_features", []))
        + list(get_cfg(cfg, "l2.recommended_l1_encoded_features", []))
    )
    recommended_l1 = [c for c in recommended_l1 if c in df.columns]
    recommended_features = [c for c in numeric_cols if c not in target_cols and c not in leakage_cols]

    return {
        "id_columns": id_cols,
        "target_columns": target_cols,
        "leakage_columns": leakage_cols,
        "text_or_reason_columns": text_cols,
        "numeric_feature_candidates": numeric_cols,
        "categorical_like_unencoded_candidates": categorical_like_cols,
        "recommended_l1_features": recommended_l1,
        "recommended_feature_columns_for_l2_batch06": recommended_features,
        "forbidden_as_feature": sorted(forbidden),
    }


def target_distribution(df: pd.DataFrame, split: str, cfg: Dict[str, Any]) -> pd.DataFrame:
    rows = []
    n = len(df)
    for t in list(get_cfg(cfg, "l2.target_columns", [])):
        if t not in df.columns:
            continue
        y = pd.to_numeric(df[t], errors="coerce").fillna(0)
        pos = int((y > 0).sum())
        rows.append({
            "split": split,
            "target": t,
            "rows": int(n),
            "positive_count": pos,
            "positive_pct": float(pos / n) if n else 0.0,
            "negative_or_null_count": int(n - pos),
        })
    return pd.DataFrame(rows)


def l1_signal_by_target(df: pd.DataFrame, split: str, cfg: Dict[str, Any]) -> pd.DataFrame:
    rows = []
    score_cols = [
        "behavior_anomaly_score",
        "behavior_sensitive_score",
        "behavior_combined_score",
        "score_lenient_norm",
        "score_strict_norm",
        "is_behavior_anomaly",
        "is_sensitive_warning",
    ]
    score_cols = [c for c in score_cols if c in df.columns]

    for t in list(get_cfg(cfg, "l2.target_columns", [])):
        if t not in df.columns:
            continue
        y = pd.to_numeric(df[t], errors="coerce").fillna(0) > 0
        for group_name, mask in [("target_negative", ~y), ("target_positive", y)]:
            g = df.loc[mask]
            row: Dict[str, Any] = {"split": split, "target": t, "group": group_name, "rows": int(len(g))}
            for c in score_cols:
                s = pd.to_numeric(g[c], errors="coerce")
                row[f"{c}_mean"] = float(s.mean()) if len(s) else np.nan
                row[f"{c}_p95"] = float(s.quantile(0.95)) if len(s) else np.nan
                row[f"{c}_p99"] = float(s.quantile(0.99)) if len(s) else np.nan
            rows.append(row)
    return pd.DataFrame(rows)


def split_summary(df: pd.DataFrame, split: str, cfg: Dict[str, Any], output_path: Path) -> Dict[str, Any]:
    key = str(get_cfg(cfg, "join.key", "event_id"))
    join_missing = pd.to_numeric(df.get("l1_join_missing_flag", 0), errors="coerce").fillna(0)
    score_avail = pd.to_numeric(df.get("l1_score_available_flag", 0), errors="coerce").fillna(0)
    behavior = pd.to_numeric(df.get("is_behavior_anomaly", 0), errors="coerce").fillna(0)
    sensitive = pd.to_numeric(df.get("is_sensitive_warning", 0), errors="coerce").fillna(0)

    row: Dict[str, Any] = {
        "split": split,
        "output_path": str(output_path),
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "duplicate_event_id": int(df[key].duplicated().sum()) if key in df.columns else None,
        "l1_join_missing_count": int(join_missing.sum()),
        "l1_join_missing_pct": float(join_missing.mean()),
        "l1_score_available_count": int(score_avail.sum()),
        "l1_score_available_pct": float(score_avail.mean()),
        "is_behavior_anomaly_count": int(behavior.sum()),
        "is_behavior_anomaly_pct": float(behavior.mean()),
        "is_sensitive_warning_count": int(sensitive.sum()),
        "is_sensitive_warning_pct": float(sensitive.mean()),
    }
    if "machine_id" in df.columns:
        row["machine_count"] = int(df["machine_id"].nunique(dropna=True))
    return row


def join_one_split(
    split: str,
    l2_path: Path,
    output_path: Path,
    l1_score: pd.DataFrame,
    cfg: Dict[str, Any],
) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    sep = str(get_cfg(cfg, "data.sep", ","))
    encoding = str(get_cfg(cfg, "data.encoding", "utf-8-sig"))
    output_sep = str(get_cfg(cfg, "data.output_sep", ","))
    output_encoding = str(get_cfg(cfg, "data.output_encoding", "utf-8-sig"))
    compression = get_cfg(cfg, "data.output_compression", None)
    key = str(get_cfg(cfg, "join.key", "event_id"))

    if not l2_path.exists():
        raise FileNotFoundError(l2_path)
    ensure_columns_exist(l2_path, [key], sep, encoding)

    print(f"\n[{split}] Load L2 split: {l2_path}")
    l2 = pd.read_csv(l2_path, sep=sep, encoding=encoding, low_memory=False)
    l2 = normalize_event_id(l2, key)

    if bool(get_cfg(cfg, "join.validate_l2_unique_event_id", True)):
        dup = int(l2[key].duplicated().sum())
        if dup > 0:
            raise ValueError(f"L2 {split} has duplicated event_id: {dup}")

    print(f"[{split}] Merge L2 + L1 score...")
    merged = l2.merge(l1_score, on=key, how="left", indicator=True, validate="one_to_one")
    merged = add_l1_join_flags_and_fill(merged, cfg)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[{split}] Write: {output_path}")
    merged.to_csv(output_path, sep=output_sep, encoding=output_encoding, index=False, compression=compression)

    summary = split_summary(merged, split, cfg, output_path)
    target_df = target_distribution(merged, split, cfg)
    signal_df = l1_signal_by_target(merged, split, cfg)
    manifest = classify_columns_for_feature_manifest(merged.head(1000), cfg)
    return summary, target_df, signal_df, manifest


def build_l1_distribution_report(l1: pd.DataFrame, report_dir: Path) -> None:
    rows = []
    total = int(len(l1))
    for c in [
        "behavior_reason",
        "action_level_l1",
        "is_behavior_anomaly",
        "is_sensitive_warning",
        "is_anomaly_lenient",
        "is_anomaly_strict",
    ]:
        if c not in l1.columns:
            continue
        for value, count in l1[c].value_counts(dropna=False).items():
            rows.append({"column": c, "value": str(value), "count": int(count), "pct": float(count / total) if total else 0.0})
    if rows:
        pd.DataFrame(rows).to_csv(report_dir / "l1_score_distribution.csv", index=False, encoding="utf-8-sig")


def run_join(config_path: str) -> int:
    cfg = load_yaml(config_path)
    np.random.seed(int(get_cfg(cfg, "project.seed", 42)))

    report_dir = resolve_path(get_cfg(cfg, "paths.l2.report_dir"), config_path)
    report_dir.mkdir(parents=True, exist_ok=True)

    l1 = load_l1_score(cfg, config_path)
    build_l1_distribution_report(l1, report_dir)

    paths = {
        "train": (resolve_path(get_cfg(cfg, "paths.l2.train"), config_path), resolve_path(get_cfg(cfg, "paths.l2.output_train"), config_path)),
        "valid": (resolve_path(get_cfg(cfg, "paths.l2.valid"), config_path), resolve_path(get_cfg(cfg, "paths.l2.output_valid"), config_path)),
        "test": (resolve_path(get_cfg(cfg, "paths.l2.test"), config_path), resolve_path(get_cfg(cfg, "paths.l2.output_test"), config_path)),
    }

    split_summaries = []
    target_parts = []
    signal_parts = []
    final_manifest: Optional[Dict[str, Any]] = None

    for split, (in_path, out_path) in paths.items():
        summary, target_df, signal_df, manifest = join_one_split(split, in_path, out_path, l1, cfg)
        split_summaries.append(summary)
        target_parts.append(target_df)
        signal_parts.append(signal_df)
        if final_manifest is None:
            final_manifest = manifest

    summary_df = pd.DataFrame(split_summaries)
    summary_df.to_csv(report_dir / "join_l1_to_l2_summary.csv", index=False, encoding="utf-8-sig")

    target_all = pd.concat(target_parts, ignore_index=True) if target_parts else pd.DataFrame()
    target_all.to_csv(report_dir / "l2_target_distribution_with_l1.csv", index=False, encoding="utf-8-sig")

    signal_all = pd.concat(signal_parts, ignore_index=True) if signal_parts else pd.DataFrame()
    signal_all.to_csv(report_dir / "l1_signal_by_l2_target.csv", index=False, encoding="utf-8-sig")

    if final_manifest is None:
        final_manifest = {}
    final_manifest["dataset_version"] = get_cfg(cfg, "project.l2_dataset_version", "l2_with_l1_score_v1")
    final_manifest["report_dir"] = str(report_dir)
    save_json(final_manifest, report_dir / "feature_manifest.json")

    run_summary = {
        "dataset_version": get_cfg(cfg, "project.l2_dataset_version", "l2_with_l1_score_v1"),
        "l1_rows": int(len(l1)),
        "splits": split_summaries,
        "report_files": {
            "summary": str(report_dir / "join_l1_to_l2_summary.csv"),
            "target_distribution": str(report_dir / "l2_target_distribution_with_l1.csv"),
            "l1_signal_by_target": str(report_dir / "l1_signal_by_l2_target.csv"),
            "feature_manifest": str(report_dir / "feature_manifest.json"),
            "l1_distribution": str(report_dir / "l1_score_distribution.csv"),
        },
    }
    save_json(run_summary, report_dir / "join_l1_to_l2_run_summary.json")

    print("\n=== Join completed ===")
    print(summary_df)
    print(f"\nReport dir: {report_dir}")
    print("Next step: train L2 multi-label model using *_with_l1_score.csv")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Join L1 production score into L2 train/valid/test datasets.")
    parser.add_argument("--config", required=True, help="Path to L2 config YAML.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return run_join(args.config)


if __name__ == "__main__":
    raise SystemExit(main())
