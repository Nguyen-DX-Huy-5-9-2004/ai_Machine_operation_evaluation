from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import pandas as pd


DEFAULT_FLOAT_TOLERANCE = 1e-6


def build_parity_report(replay: pd.DataFrame, historical: pd.DataFrame, *, tolerance: float = DEFAULT_FLOAT_TOLERANCE) -> tuple[dict[str, Any], pd.DataFrame]:
    keys = ["event_id"]
    left = replay.copy(); right = historical.copy()
    comparison = left.merge(right, on=keys, how="outer", suffixes=("_replay", "_historical"), indicator=True)
    fields = [
        "machine_id", "machine_group_id", "location_id", "source_event_start_time", "source_event_end_time",
        "duration_sec", "gap_from_prev_sec", "overlap_sec", "kwh_delta", "l1_score_available_flag",
        "score_lenient", "score_strict", "risk_fault_30min", "operational_judgment", "operational_action_level",
    ]
    results: list[dict[str, Any]] = []
    for _, row in comparison.iterrows():
        if row["_merge"] != "both":
            results.append({"event_id": row["event_id"], "classification": "UNEXPECTED_MISMATCH", "field": "event_presence", "replay": row["_merge"] == "left_only", "historical": row["_merge"] == "right_only"})
            continue
        for field in fields:
            left_name, right_name = f"{field}_replay", f"{field}_historical"
            if left_name not in row or right_name not in row:
                continue
            a, b = row[left_name], row[right_name]
            if pd.isna(a) and pd.isna(b):
                classification = "EXACT_MATCH"
            elif isinstance(a, (float, int)) and isinstance(b, (float, int)):
                classification = "FLOAT_TOLERANCE_MATCH" if abs(float(a) - float(b)) <= tolerance else "UNEXPECTED_MISMATCH"
            else:
                classification = "EXACT_MATCH" if str(a) == str(b) else "UNEXPECTED_MISMATCH"
            if classification != "EXACT_MATCH":
                results.append({"event_id": row["event_id"], "classification": classification, "field": field, "replay": a, "historical": b})
    mismatches = pd.DataFrame(results)
    summary = {
        "replay_rows": int(len(replay)), "historical_rows": int(len(historical)),
        "exact_match_count": int(len(comparison) - len(mismatches)),
        "float_tolerance_match_count": int((mismatches.get("classification") == "FLOAT_TOLERANCE_MATCH").sum()) if not mismatches.empty else 0,
        "unexpected_mismatch_count": int((mismatches.get("classification") == "UNEXPECTED_MISMATCH").sum()) if not mismatches.empty else 0,
        "tolerance": tolerance,
    }
    return summary, mismatches


def write_parity_report(root: str | Path, summary: dict[str, Any], mismatches: pd.DataFrame) -> None:
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    (root / "parity_report.json").write_text(pd.Series(summary).to_json(indent=2), encoding="utf-8")
    mismatch_columns = ["event_id", "classification", "field", "replay", "historical"]
    (mismatches if not mismatches.empty else pd.DataFrame(columns=mismatch_columns)).to_parquet(root / "parity_mismatches.parquet", index=False)
    (root / "parity_summary.md").write_text(
        "# Historical Replay Parity\n\n" + "\n".join(f"- {key}: {value}" for key, value in summary.items()) + "\n",
        encoding="utf-8",
    )
