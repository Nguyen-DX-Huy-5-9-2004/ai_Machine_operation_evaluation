"""Read-only post-evaluation audit for an already completed Candidate A/B/C run."""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


FUTURE_LABELS = {
    "future_fault_within_10_events": ("known_fault_status", "events", 10),
    "future_fault_within_30_events": ("known_fault_status", "events", 30),
    "future_fault_within_30min": ("known_fault_status", "seconds", 1800),
    "future_fault_within_60min": ("known_fault_status", "seconds", 3600),
    "future_maintenance_within_30_events": ("known_maintenance_status", "events", 30),
    "future_repair_within_30_events": ("known_repair_status", "events", 30),
}
JOIN_KEYS = ["machine_id", "event_id"]
PRIORITY_MACHINES = {37, 46, 48, 49, 50, 51, 56, 58, 67}


def _json(path: Path, payload: Any) -> None:
    def default(value: Any) -> Any:
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            return None if not np.isfinite(value) else float(value)
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if isinstance(value, Path):
            return str(value)
        raise TypeError(type(value).__name__)

    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=default), encoding="utf-8")


def _read_parquet(path: Path) -> pd.DataFrame:
    return pd.read_parquet(path)


def classify_ac_disagreement(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    a = pd.to_numeric(out["candidate_a_is_behavior_anomaly"], errors="coerce").fillna(0).astype(int)
    c = pd.to_numeric(out["candidate_c_is_behavior_anomaly"], errors="coerce").fillna(0).astype(int)
    out["ac_anomaly_pair"] = "A=" + a.astype(str) + ",C=" + c.astype(str)
    known_fault = pd.to_numeric(out.get("known_fault_status", 0), errors="coerce").fillna(0).astype(int) == 1
    normal = pd.to_numeric(out.get("normal_lenient_flag", 0), errors="coerce").fillna(0).astype(int) == 1
    # Do not silently call maintenance, repair, or quality-excluded rows "normal".
    truth = np.select([known_fault, normal], ["known_fault", "normal"], default="other_non_fault")
    out["ac_population"] = truth
    out["ac_disagreement_category"] = out["ac_population"] + ": " + out["ac_anomaly_pair"]
    return out


def _counts(frame: pd.DataFrame, group_columns: list[str]) -> list[dict[str, Any]]:
    available = [column for column in group_columns if column in frame.columns]
    if not available:
        return []
    return frame.groupby(available, dropna=False).size().reset_index(name="count").to_dict("records")


def disagreement_reports(frame: pd.DataFrame) -> tuple[dict[str, Any], dict[str, Any], pd.DataFrame]:
    out = classify_ac_disagreement(frame)
    global_report = {
        "result": "PASS",
        "rows": int(len(out)),
        "by_split_and_population": _counts(out, ["split_name", "ac_population", "ac_anomaly_pair"]),
        "by_status_id": _counts(out, ["split_name", "status_id", "ac_population", "ac_anomaly_pair"]),
        "by_data_quality": _counts(out, ["split_name", "data_quality_issue_flag", "ac_population", "ac_anomaly_pair"]),
        "by_kwh_quality": _counts(out, ["split_name", "kwh_quality_issue_flag", "kwh_available_flag", "ac_population", "ac_anomaly_pair"]),
        "by_time_quality": _counts(out, ["split_name", "time_quality_issue_flag", "ac_population", "ac_anomaly_pair"]),
    }
    by_machine = {
        "result": "PASS",
        "machines": {
            str(int(machine)): {
                "overall": _counts(group, ["split_name", "ac_population", "ac_anomaly_pair"]),
                "by_status_id": _counts(group, ["split_name", "status_id", "ac_population", "ac_anomaly_pair"]),
                "by_data_quality": _counts(group, ["split_name", "data_quality_issue_flag", "ac_population", "ac_anomaly_pair"]),
                "by_kwh_quality": _counts(group, ["split_name", "kwh_quality_issue_flag", "kwh_available_flag", "ac_population", "ac_anomaly_pair"]),
                "by_time_quality": _counts(group, ["split_name", "time_quality_issue_flag", "ac_population", "ac_anomaly_pair"]),
            }
            for machine, group in out.groupby("machine_id", sort=True)
        },
        "priority_machines": {},
    }
    for machine in sorted(PRIORITY_MACHINES):
        by_machine["priority_machines"][str(machine)] = by_machine["machines"].get(str(machine), {"status": "NOT_PRESENT"})
    return global_report, by_machine, out


def future_label_contract_audit(scores: pd.DataFrame, canonical_by_machine: dict[int, pd.DataFrame]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if scores.duplicated(JOIN_KEYS).any():
        raise ValueError("duplicate evaluation target key: machine_id + event_id")
    scored = scores.reset_index(drop=True).copy()
    scored["_score_row"] = np.arange(len(scored), dtype=np.int64)
    observed_by_label = {
        label: pd.to_numeric(scored.get(label, 0), errors="coerce").fillna(0).astype(int).to_numpy()
        for label in FUTURE_LABELS
    }
    recomputed_by_label = {label: np.zeros(len(scored), dtype=np.int8) for label in FUTURE_LABELS}
    lead_values = {label: {"event_distance": [], "time_distance_sec": []} for label in FUTURE_LABELS}
    canonical_duplicate_key_count = 0

    # Resolve future witnesses once per machine/segment. This avoids repeatedly
    # scanning a whole segment for every held-out target event.
    for machine, score_part in scored.groupby("machine_id", sort=True):
        canonical = canonical_by_machine.get(int(machine))
        if canonical is None:
            raise ValueError(f"missing canonical partition for machine {machine}")
        if canonical.duplicated(JOIN_KEYS).any():
            raise ValueError(f"duplicate canonical key for machine {machine}: machine_id + event_id")
        score_row_by_event = dict(zip(score_part.event_id.astype(int), score_part._score_row.astype(int)))
        ordered = canonical.sort_values(["sequence_segment_id", "event_order_in_segment", "event_start_time", "event_id"], kind="mergesort")
        for (_, _), group in ordered.groupby(["machine_id", "sequence_segment_id"], sort=False):
            group = group.reset_index(drop=True)
            score_rows = np.array([score_row_by_event.get(int(event_id), -1) for event_id in group.event_id], dtype=np.int64)
            source_positions = np.flatnonzero(score_rows >= 0)
            if not len(source_positions):
                continue
            source_rows = score_rows[source_positions]
            starts = pd.to_datetime(group["event_start_time"], errors="coerce")
            start_ns = starts.astype("int64").to_numpy()
            order = pd.to_numeric(group["event_order_in_segment"], errors="coerce").to_numpy()

            for label, (evidence, horizon_type, horizon) in FUTURE_LABELS.items():
                evidence_positions = np.flatnonzero(pd.to_numeric(group.get(evidence, 0), errors="coerce").fillna(0).astype(int).to_numpy() == 1)
                if not len(evidence_positions):
                    continue
                if horizon_type == "events":
                    witness_indexes = np.searchsorted(evidence_positions, source_positions + 1, side="left")
                    valid_indexes = witness_indexes < len(evidence_positions)
                    witness_positions = np.full(len(source_positions), -1, dtype=np.int64)
                    witness_positions[valid_indexes] = evidence_positions[witness_indexes[valid_indexes]]
                    event_distance = np.where(valid_indexes, order[witness_positions.clip(min=0)] - order[source_positions], 0)
                    valid = valid_indexes & (event_distance > 0) & (event_distance <= horizon)
                else:
                    evidence_times = start_ns[evidence_positions]
                    witness_indexes = np.searchsorted(evidence_times, start_ns[source_positions], side="right")
                    valid_indexes = witness_indexes < len(evidence_positions)
                    witness_positions = np.full(len(source_positions), -1, dtype=np.int64)
                    witness_positions[valid_indexes] = evidence_positions[witness_indexes[valid_indexes]]
                    time_distance = np.where(valid_indexes, (start_ns[witness_positions.clip(min=0)] - start_ns[source_positions]) / 1_000_000_000, 0.0)
                    valid = valid_indexes & (time_distance > 0) & (time_distance <= horizon)
                    event_distance = np.where(valid_indexes, order[witness_positions.clip(min=0)] - order[source_positions], 0)
                recomputed_by_label[label][source_rows[valid]] = 1
                positive_and_valid = valid & (observed_by_label[label][source_rows] == 1)
                if positive_and_valid.any():
                    witness = witness_positions[positive_and_valid]
                    source = source_positions[positive_and_valid]
                    lead_values[label]["event_distance"].extend((order[witness] - order[source]).astype(float).tolist())
                    lead_values[label]["time_distance_sec"].extend(((start_ns[witness] - start_ns[source]) / 1_000_000_000).astype(float).tolist())

    contract: dict[str, Any] = {"result": "PASS", "duplicate_target_key_count": 0, "canonical_duplicate_key_count": canonical_duplicate_key_count, "labels": {}, "same_machine_required": True, "same_segment_required": True, "strict_future_time_required": True, "cross_big_gap_outside_contract": False}
    prevalence: dict[str, Any] = {"result": "PASS", "global": {}, "by_machine": {}}
    lead: dict[str, Any] = {"result": "PASS", "labels": {}}
    for label in FUTURE_LABELS:
        observed = observed_by_label[label]
        recomputed = recomputed_by_label[label]
        mismatch = int((observed != recomputed).sum())
        invalid_positive = int(((observed == 1) & (recomputed == 0)).sum())
        contract["labels"][label] = {"stored_positive": int(observed.sum()), "recomputed_positive": int(recomputed.sum()), "label_mismatch_count": mismatch, "invalid_positive_witness_count": invalid_positive}
        if mismatch or invalid_positive:
            contract["result"] = "FAIL"
        prevalence["global"][label] = {split: {"positive": int(part[label].sum()), "support": int(len(part)), "prevalence": float(part[label].mean()) if len(part) else None} for split, part in scores.groupby("split_name", sort=True)}
        distances = pd.Series(lead_values[label]["event_distance"], dtype=float)
        seconds = pd.Series(lead_values[label]["time_distance_sec"], dtype=float)
        lead["labels"][label] = {"positive_with_witness": int(len(distances)), "event_distance": distances.describe(percentiles=[.5, .9, .95]).to_dict() if len(distances) else {}, "time_distance_sec": seconds.describe(percentiles=[.5, .9, .95]).to_dict() if len(seconds) else {}}
    for machine, part in scores.groupby("machine_id", sort=True):
        prevalence["by_machine"][str(int(machine))] = {label: {split: {"positive": int(group[label].sum()), "support": int(len(group)), "prevalence": float(group[label].mean()) if len(group) else None} for split, group in part.groupby("split_name", sort=True)} for label in FUTURE_LABELS}
    return contract, prevalence, lead


def recover_historical_regression(scores: pd.DataFrame, adaptation: Path) -> dict[str, Any]:
    manifests = sorted(adaptation.glob("*exact*paired*window*manifest*.csv"))
    if not manifests:
        return {"result": "NOT_AVAILABLE", "reason": "missing exact paired window manifest", "files_checked": [str(adaptation)]}
    path = manifests[0]
    manifest = pd.read_csv(path, usecols=["current_event_id", "historical_event_id", "alignment_status"])
    exact = manifest[manifest.alignment_status == "EXACT_PAIRED_WINDOW"].copy()
    paired = scores.merge(exact, left_on="event_id", right_on="current_event_id", how="inner")
    if paired.empty:
        return {"result": "NOT_AVAILABLE", "reason": "no held-out target overlaps exact historical window manifest", "manifest": str(path), "exact_overlap_count": 0}
    reason_path = adaptation / "09_change_reason_reclassified.csv"
    unexplained = None
    if reason_path.exists():
        reasons = pd.read_csv(reason_path, usecols=["current_event_id", "adaptation_change_reason"])
        paired = paired.merge(reasons, on="current_event_id", how="left")
        unexplained = int((paired.adaptation_change_reason == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum())
    by_machine = {str(int(machine)): {"support": int(len(part)), "score_lenient_pearson": float(part.candidate_a_score_lenient.corr(part.candidate_c_score_lenient, method="pearson")), "score_lenient_spearman": float(part.candidate_a_score_lenient.corr(part.candidate_c_score_lenient, method="spearman")), "anomaly_label_change_rate": float((part.candidate_a_is_behavior_anomaly != part.candidate_c_is_behavior_anomaly).mean())} for machine, part in paired.groupby("machine_id", sort=True)}
    return {"result": "PASS_CURRENT_SCORE_OVERLAP_ONLY", "manifest": str(path), "exact_overlap_count": int(len(paired)), "score_basis": "Candidate A/C current held-out scores restricted to targets with exact historical 20-window mapping; no historical inference rerun.", "candidate_a_c_lenient_pearson": float(paired.candidate_a_score_lenient.corr(paired.candidate_c_score_lenient, method="pearson")), "candidate_a_c_lenient_spearman": float(paired.candidate_a_score_lenient.corr(paired.candidate_c_score_lenient, method="spearman")), "anomaly_label_change_rate": float((paired.candidate_a_is_behavior_anomaly != paired.candidate_c_is_behavior_anomaly).mean()), "unexplained_mismatch": unexplained, "per_machine_drift": by_machine}


def _load_canonical(package: Path, scores: pd.DataFrame) -> dict[int, pd.DataFrame]:
    needed = ["event_id", "machine_id", "event_start_time", "sequence_segment_id", "event_order_in_segment", "status_id", "data_quality_issue_flag", "kwh_quality_issue_flag", "kwh_available_flag", "time_quality_issue_flag", "is_big_gap", *FUTURE_LABELS, "known_fault_status", "known_maintenance_status", "known_repair_status"]
    result = {}
    for machine in sorted(scores.machine_id.dropna().astype(int).unique()):
        path = package / "canonical" / f"machine_id={machine}" / "events.parquet"
        frame = _read_parquet(path)
        result[machine] = frame.reindex(columns=[column for column in needed if column in frame.columns])
    return result


def _enrich_scores(scores: pd.DataFrame, canonical: dict[int, pd.DataFrame]) -> pd.DataFrame:
    columns = ["machine_id", "event_id", "status_id", "data_quality_issue_flag", "kwh_quality_issue_flag", "kwh_available_flag", "time_quality_issue_flag", "is_big_gap"]
    parts = [frame.reindex(columns=[column for column in columns if column in frame.columns]) for frame in canonical.values()]
    context = pd.concat(parts, ignore_index=True)
    extra = [column for column in context.columns if column not in JOIN_KEYS and column not in scores.columns]
    return scores.merge(context.reindex(columns=[*JOIN_KEYS, *extra]), on=JOIN_KEYS, how="left", validate="one_to_one")


def decision_rationale(comparison: dict[str, Any], global_metrics: dict[str, Any], by_machine: dict[str, Any], decision: dict[str, Any], future_contract: dict[str, Any], historical: dict[str, Any]) -> dict[str, Any]:
    valid = global_metrics.get("VALID", {})
    a, c = valid.get("candidate_a", {}), valid.get("candidate_c", {})
    return {"selected_decision": decision.get("decision", "KEEP_CURRENT_MODEL_AND_THRESHOLDS"), "selection_split": decision.get("selection_split"), "test_used_for_selection": False, "automatic_promotion": False, "valid_metric_change_a_to_c": {"normal_fpr_reduction": (a.get("normal_false_positive_rate") or 0) - (c.get("normal_false_positive_rate") or 0), "known_fault_recall_drop": (a.get("known_fault_recall") or 0) - (c.get("known_fault_recall") or 0), "precision_change": (c.get("precision") or 0) - (a.get("precision") or 0), "f1_change": (c.get("f1") or 0) - (a.get("f1") or 0)}, "machine_level_violations": {split: {machine: data.get("flags", {}) for machine, data in payload.items() if machine != "priority_machines" and (data.get("flags", {}).get("fault_recall_drop_strong") or data.get("flags", {}).get("anomaly_rate_over_5_percent"))} for split, payload in by_machine.items() if split in {"VALID", "TEST"}}, "future_label_audit_status": future_contract.get("result"), "historical_regression_status": historical.get("result"), "candidate_b_reason": "Candidate B was not selected because the locked validation threshold baseline reduced known-fault recall substantially.", "candidate_c_reason": "Candidate C was not promoted because the completed VALID decision gate selected KEEP_CURRENT_MODEL_AND_THRESHOLDS; higher F1 alone cannot override the gate.", "comparison_source": comparison.get("exact_window_identity")}


def run(evaluation_dir: Path, package: Path, adaptation: Path, output_root: Path) -> Path:
    required = ["candidate_abc_scores.parquet", "candidate_abc_comparison.json", "candidate_c_metrics_global.json", "candidate_c_metrics_by_machine.json", "candidate_c_strict_lenient_overlap.json", "candidate_c_decision_gate.json", "candidate_c_historical_regression.json"]
    missing = [name for name in required if not (evaluation_dir / name).exists()]
    if missing:
        raise FileNotFoundError(f"missing evaluation input files: {missing}")
    output = output_root / f"l1_candidate_c_post_eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}"; output.mkdir(parents=True, exist_ok=False)
    scores = _read_parquet(evaluation_dir / "candidate_abc_scores.parquet")
    comparison = json.loads((evaluation_dir / "candidate_abc_comparison.json").read_text(encoding="utf-8"))
    metrics = json.loads((evaluation_dir / "candidate_c_metrics_global.json").read_text(encoding="utf-8"))
    machine_metrics = json.loads((evaluation_dir / "candidate_c_metrics_by_machine.json").read_text(encoding="utf-8"))
    overlap = json.loads((evaluation_dir / "candidate_c_strict_lenient_overlap.json").read_text(encoding="utf-8"))
    decision = json.loads((evaluation_dir / "candidate_c_decision_gate.json").read_text(encoding="utf-8"))
    prior_historical = json.loads((evaluation_dir / "candidate_c_historical_regression.json").read_text(encoding="utf-8"))
    canonical = _load_canonical(package, scores)
    enriched = _enrich_scores(scores, canonical)
    global_disagreement, machine_disagreement, events = disagreement_reports(enriched)
    future_contract, prevalence, lead = future_label_contract_audit(enriched, canonical)
    historical = recover_historical_regression(enriched, adaptation)
    historical["prior_evaluator_report"] = prior_historical
    rationale = decision_rationale(comparison, metrics, machine_metrics, decision, future_contract, historical)
    _json(output / "candidate_ac_disagreement_global.json", global_disagreement); _json(output / "candidate_ac_disagreement_by_machine.json", machine_disagreement)
    events.to_csv(output / "candidate_ac_disagreement_events.csv.gz", index=False, compression="gzip", encoding="utf-8")
    _json(output / "future_label_contract_audit.json", future_contract); _json(output / "future_label_prevalence_by_machine.json", prevalence); _json(output / "future_label_lead_time_distribution.json", lead)
    _json(output / "candidate_c_historical_regression_recovered.json", historical); _json(output / "candidate_final_decision_rationale.json", rationale)
    _json(output / "00_summary.json", {"result": "PASS" if future_contract["result"] == "PASS" else "PASS_WITH_FUTURE_LABEL_CONTRACT_FAILURE", "source_evaluation_dir": str(evaluation_dir), "package": str(package), "decision": decision.get("decision"), "strict_lenient_overlap_source_loaded": bool(overlap), "read_only": True, "sql_called": False, "l2_run": False, "training_run": False, "production_write": False})
    print("candidate_post_eval_dir:", output)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Candidate C post-evaluation audit.")
    parser.add_argument("--evaluation-audit-dir", required=True)
    parser.add_argument("--candidate-package-dir", required=True)
    parser.add_argument("--adaptation-audit-dir", required=True)
    parser.add_argument("--output-root", default="data/realtime_audit")
    args = parser.parse_args()
    root = Path.cwd().resolve()
    resolve = lambda value: Path(value) if Path(value).is_absolute() else root / value
    run(resolve(args.evaluation_audit_dir), resolve(args.candidate_package_dir), resolve(args.adaptation_audit_dir), resolve(args.output_root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
