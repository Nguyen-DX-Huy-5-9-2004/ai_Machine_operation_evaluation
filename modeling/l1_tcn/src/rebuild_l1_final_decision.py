from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

import numpy as np
import pandas as pd
import json


def save_json(obj: Dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def rebuild_decision(df: pd.DataFrame) -> pd.DataFrame:
    """
    Rebuild quyết định L1 theo nguyên tắc:
    - lenient = production model chính.
    - strict = sensitive warning model.
    - Không dùng OR(strict, lenient) làm is_behavior_anomaly.
    """
    out = df.copy()

    for c in ["is_anomaly_lenient", "is_anomaly_strict"]:
        if c not in out.columns:
            out[c] = 0
        out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0).astype("int8")

    for c in ["score_lenient_norm", "score_strict_norm"]:
        if c not in out.columns:
            out[c] = np.nan
        out[c] = pd.to_numeric(out[c], errors="coerce")

    lenient_available = out["score_lenient_norm"].notna()
    strict_available = out["score_strict_norm"].notna()
    both_unavailable = (~lenient_available) & (~strict_available)

    lenient_anom = out["is_anomaly_lenient"] > 0
    strict_anom = out["is_anomaly_strict"] > 0

    both_anom = lenient_anom & strict_anom
    lenient_only = lenient_anom & (~strict_anom)
    strict_only = (~lenient_anom) & strict_anom

    out["is_behavior_anomaly"] = lenient_anom.astype("int8")
    out["is_sensitive_warning"] = strict_only.astype("int8")

    out["behavior_anomaly_score"] = out["score_lenient_norm"].fillna(0.0)
    out["behavior_sensitive_score"] = out["score_strict_norm"].fillna(0.0)
    out["behavior_combined_score"] = out[["score_lenient_norm", "score_strict_norm"]].max(axis=1, skipna=True).fillna(0.0)

    reason = np.full(len(out), "NORMAL_LIKE", dtype=object)
    reason[both_unavailable.to_numpy()] = "INSUFFICIENT_WINDOW"
    reason[strict_only.to_numpy()] = "SENSITIVE_WARNING_ONLY"
    reason[lenient_only.to_numpy()] = "PRODUCTION_MODEL_DEVIATION"
    reason[both_anom.to_numpy()] = "STRONG_DEVIATION_BOTH_MODELS"
    out["behavior_reason"] = reason

    action = np.full(len(out), "NONE", dtype=object)
    action[strict_only.to_numpy()] = "MONITOR"
    action[lenient_only.to_numpy()] = "CHECK_MACHINE"
    action[both_anom.to_numpy()] = "WARNING"
    action[both_unavailable.to_numpy()] = "NO_WINDOW_SCORE"
    out["action_level_l1"] = action

    out["decision_rebuilt_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    out["decision_policy"] = "lenient_production_strict_sensitive"

    first_cols = [
        "event_id", "machine_id", "sequence_segment_id", "event_order_in_segment",
        "model_version", "decision_policy",
        "score_lenient", "score_strict",
        "score_lenient_norm", "score_strict_norm",
        "threshold_lenient", "threshold_strict",
        "is_anomaly_lenient", "is_anomaly_strict",
        "is_behavior_anomaly", "is_sensitive_warning",
        "behavior_anomaly_score", "behavior_sensitive_score", "behavior_combined_score",
        "behavior_reason", "action_level_l1",
    ]
    first_cols = [c for c in first_cols if c in out.columns]
    rest_cols = [c for c in out.columns if c not in first_cols]
    return out[first_cols + rest_cols]


def summarize(df: pd.DataFrame) -> Dict[str, Any]:
    n = int(len(df))
    behavior = int(pd.to_numeric(df["is_behavior_anomaly"], errors="coerce").fillna(0).sum())
    sensitive = int(pd.to_numeric(df["is_sensitive_warning"], errors="coerce").fillna(0).sum())

    summary: Dict[str, Any] = {
        "total_events": n,
        "behavior_anomaly_events": behavior,
        "behavior_anomaly_rate": float(behavior / n) if n else 0.0,
        "sensitive_warning_events": sensitive,
        "sensitive_warning_rate": float(sensitive / n) if n else 0.0,
        "reason_distribution": df["behavior_reason"].value_counts(dropna=False).to_dict(),
        "action_level_distribution": df["action_level_l1"].value_counts(dropna=False).to_dict(),
    }

    by_machine = []
    for machine_id, g in df.groupby("machine_id", sort=True):
        total = int(len(g))
        behavior_count = int(pd.to_numeric(g["is_behavior_anomaly"], errors="coerce").fillna(0).sum())
        sensitive_count = int(pd.to_numeric(g["is_sensitive_warning"], errors="coerce").fillna(0).sum())
        by_machine.append({
            "machine_id": int(machine_id) if pd.notna(machine_id) else machine_id,
            "total_events": total,
            "behavior_anomaly_events": behavior_count,
            "behavior_anomaly_rate": float(behavior_count / total) if total else 0.0,
            "sensitive_warning_events": sensitive_count,
            "sensitive_warning_rate": float(sensitive_count / total) if total else 0.0,
            "behavior_score_mean": float(pd.to_numeric(g["behavior_anomaly_score"], errors="coerce").mean()),
            "behavior_score_p99": float(pd.to_numeric(g["behavior_anomaly_score"], errors="coerce").quantile(0.99)),
            "sensitive_score_mean": float(pd.to_numeric(g["behavior_sensitive_score"], errors="coerce").mean()),
            "sensitive_score_p99": float(pd.to_numeric(g["behavior_sensitive_score"], errors="coerce").quantile(0.99)),
        })

    summary["by_machine"] = by_machine
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild L1 final decision from existing strict/lenient score file.")
    parser.add_argument(
        "--input",
        default="../../../data/dataModel/l1/scored/ai_l1_operation_anomaly_result.csv",
        help="Current L1 score CSV from score_full_l1.py.",
    )
    parser.add_argument(
        "--output",
        default="../../../data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv",
        help="Output CSV with corrected production decision.",
    )
    parser.add_argument("--sep", default=",", help="CSV separator.")
    parser.add_argument(
        "--overwrite-original",
        action="store_true",
        help="Also overwrite original ai_l1_operation_anomaly_result.csv after writing backup.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        raise FileNotFoundError(input_path)

    print(f"Read: {input_path}")
    df = pd.read_csv(input_path, sep=args.sep, encoding="utf-8-sig", low_memory=False)
    print("Input shape:", df.shape)
    print("Old behavior_reason distribution:")
    print(df["behavior_reason"].value_counts(dropna=False))

    out = rebuild_decision(df)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Write: {output_path}")
    out.to_csv(output_path, index=False, encoding="utf-8-sig")

    summary = summarize(out)
    summary_path = output_path.with_name(output_path.stem + "_summary.json")
    machine_path = output_path.with_name(output_path.stem + "_by_machine.csv")

    save_json(summary, summary_path)
    pd.DataFrame(summary["by_machine"]).to_csv(machine_path, index=False, encoding="utf-8-sig")

    print("\nNew behavior_reason distribution:")
    print(out["behavior_reason"].value_counts(dropna=False))
    print("\nNew action_level_l1 distribution:")
    print(out["action_level_l1"].value_counts(dropna=False))
    print("\nBehavior anomaly rate:", summary["behavior_anomaly_rate"])
    print("Sensitive warning rate:", summary["sensitive_warning_rate"])
    print("\nBy machine:")
    print(pd.DataFrame(summary["by_machine"])[[
        "machine_id", "behavior_anomaly_rate", "sensitive_warning_rate"
    ]].sort_values("behavior_anomaly_rate", ascending=False))

    if args.overwrite_original:
        backup_path = input_path.with_name(input_path.stem + "_or_policy_backup.csv")
        print(f"\nBackup original: {backup_path}")
        df.to_csv(backup_path, index=False, encoding="utf-8-sig")
        print(f"Overwrite original: {input_path}")
        out.to_csv(input_path, index=False, encoding="utf-8-sig")

    print("\nDone.")
    print(f"Output : {output_path}")
    print(f"Summary: {summary_path}")
    print(f"Machine: {machine_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
