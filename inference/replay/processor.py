from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd

from inference.online.data_contract import thresholds_from_config
from inference.online.explainability import EXPLANATION_VERSION, explanation_json
from inference.online.feature_builder_l1 import build_l1_event_features
from inference.online.feature_builder_l2 import build_l2_runtime_features
from inference.online.l1_scorer import L1Scorer
from inference.online.l2_scorer import L2Scorer
from inference.online.policy_engine import apply_policy_v2
from inference.online.production_lineage_dry_run import add_train_fitted_l2_stabilization, l2_input_readiness
from inference.online.score_new_events import format_online_output, raw_source_fingerprint

from .types import ProcessedReplayBatch, ReplayBatch, REPLAY_EVENT_SOURCE


class TwoLayerReplayProcessor:
    """Candidate A + selected L2 + policy-v2 processor with no SQL writes."""

    def __init__(self, cfg: Mapping[str, Any], project_root: Path) -> None:
        self.cfg = dict(cfg)
        self.project_root = project_root
        if not bool(self.cfg.get("artifacts", {}).get("l1_enabled", False)):
            raise ValueError("Historical replay requires artifacts.l1_enabled=true for Candidate A lenient/strict scoring")
        self._l1: L1Scorer | None = None
        self._l2: L2Scorer | None = None

    def process(self, batch: ReplayBatch, *, replay_run_id: str, batch_sequence: int, virtual_time) -> ProcessedReplayBatch:
        started = time.perf_counter()
        if batch.candidates.empty:
            return ProcessedReplayBatch(pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), {"batch_size": 0})
        raw_all = pd.concat([batch.context, batch.candidates], ignore_index=True).drop_duplicates("event_id")
        raw_all = raw_all.sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)
        canonical_started = time.perf_counter()
        canonical = build_l1_event_features(
            raw_all,
            machine_context=batch.machine_group_map,
            location_context=batch.location_map,
            config=self.cfg,
        )
        candidate_ids = set(pd.to_numeric(batch.candidates["event_id"], errors="raise").astype(int))
        canonical_new = canonical[canonical["event_id"].astype(int).isin(candidate_ids)].copy()
        closed = canonical_new[canonical_new["is_open_event"].eq(0)].copy()
        canonical_latency_ms = round((time.perf_counter() - canonical_started) * 1000, 2)
        l1_started = time.perf_counter()
        l1 = self._get_l1().score(canonical, candidate_ids=set(closed["event_id"].astype(int)), batch_size=int(self.cfg["runtime"].get("l1_batch_size", 512))) if not closed.empty else closed
        l1_latency_ms = round((time.perf_counter() - l1_started) * 1000, 2)
        output = self._base_output(canonical_new, replay_run_id, batch_sequence, virtual_time)
        if not l1.empty:
            output = _merge_prefer_right(output, l1.drop(columns=[column for column in ("event_start_time", "event_end_time") if column in l1], errors="ignore"))
        output["readiness_reason"] = output.get("readiness_reason", pd.Series(index=output.index, dtype="object")).fillna("OPEN_EVENT_OR_INSUFFICIENT_HISTORY")
        output["l1_score_available_flag"] = _int_flag(output, "l1_score_available_flag")
        output["l2_ready_flag"] = _int_flag(output, "l2_ready_flag")
        output["policy_ready_flag"] = _int_flag(output, "policy_ready_flag")

        l1_ready = l1[pd.to_numeric(l1.get("l1_score_available_flag"), errors="coerce").fillna(0).eq(1)].copy() if not l1.empty else pd.DataFrame()
        l2_unready = pd.DataFrame()
        policy_ready = pd.DataFrame()
        l2_policy_started = time.perf_counter()
        if not l1_ready.empty:
            l2_features = build_l2_runtime_features(l1_ready, l1_scores=None, config=self.cfg, model_metadata=None)
            l2_features = add_train_fitted_l2_stabilization(self.project_root, l2_features)
            ready_mask, reasons = l2_input_readiness(l2_features, self.project_root)
            l2_unready = l2_features.loc[~ready_mask].copy()
            l2_unready["readiness_reason"] = reasons.loc[~ready_mask]
            l2_ready = l2_features.loc[ready_mask].copy()
            if not l2_ready.empty:
                scorer = self._get_l2()
                scored = scorer.predict(l2_ready)
                policy_ready = apply_policy_v2(scored, scorer.thresholds, policy_version=str(self.cfg["project"]["policy_version"]))
                policy_ready["l2_ready_flag"] = 1
                policy_ready["policy_ready_flag"] = 1
                policy_ready["readiness_reason"] = "READY"
                policy_ready["l2_run_id"] = self.cfg["project"]["l2_run_id"]
                policy_ready["inference_version"] = self.cfg["project"]["inference_version"]
                policy_ready["runtime_run_id"] = replay_run_id
                policy_ready["processing_action"] = "FILE_ONLY_REPLAY"
                policy_ready["explanation_json"] = [
                    explanation_json(row, scorer.thresholds, policy_version=str(self.cfg["project"]["policy_version"]))
                    for row in policy_ready.to_dict(orient="records")
                ]
                policy_ready["explanation_version"] = EXPLANATION_VERSION
        for frame in (l2_unready, policy_ready):
            if not frame.empty:
                output = _merge_prefer_right(output, frame.drop(columns=[column for column in ("event_start_time", "event_end_time") if column in frame], errors="ignore"))
        output = self._finalize(output, raw_all, replay_run_id, batch_sequence, virtual_time)
        l2_policy_latency_ms = round((time.perf_counter() - l2_policy_started) * 1000, 2)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return ProcessedReplayBatch(
            canonical=canonical_new,
            l1=l1,
            output=output,
            metrics={
                "batch_size": int(len(output)),
                "l1_ready_count": int(output["l1_score_available_flag"].sum()),
                "l1_unready_count": int(len(output) - output["l1_score_available_flag"].sum()),
                "policy_ready_count": int(output["policy_ready_flag"].sum()),
                "total_processing_latency_ms": elapsed_ms,
                "canonical_feature_latency_ms": canonical_latency_ms,
                "l1_latency_ms": l1_latency_ms,
                "l2_policy_latency_ms": l2_policy_latency_ms,
                "progress_sample": _progress_sample(output),
                **batch.source_metrics,
            },
            raw=batch.candidates.copy(),
        )

    def _get_l1(self) -> L1Scorer:
        if self._l1 is None:
            self._l1 = L1Scorer(self.cfg["artifacts"])
        return self._l1

    def _get_l2(self) -> L2Scorer:
        if self._l2 is None:
            self._l2 = L2Scorer(self.cfg["artifacts"])
            expected_targets = {
                "future_fault_within_10_events", "future_fault_within_30_events", "future_fault_within_30min",
                "future_fault_within_60min", "future_maintenance_within_30_events", "future_repair_within_30_events",
            }
            if set(self._l2.models) != expected_targets:
                raise ValueError("Historical replay must use exactly the six selected production L2 targets")
        return self._l2

    @staticmethod
    def _base_output(canonical: pd.DataFrame, replay_run_id: str, batch_sequence: int, virtual_time) -> pd.DataFrame:
        output = canonical.copy()
        output["event_source"] = REPLAY_EVENT_SOURCE
        output["event_uid"] = [f"{REPLAY_EVENT_SOURCE}:{replay_run_id}:{int(event_id)}" for event_id in output["event_id"]]
        output["replay_run_id"] = replay_run_id
        output["replay_batch_id"] = f"batch_{batch_sequence:06d}"
        output["replay_sequence"] = batch_sequence
        output["virtual_arrival_time"] = pd.Timestamp(virtual_time)
        return output

    @staticmethod
    def _finalize(output: pd.DataFrame, raw_all: pd.DataFrame, replay_run_id: str, batch_sequence: int, virtual_time) -> pd.DataFrame:
        # Scoring and policy merge many feature columns.  Defragment once before
        # appending replay metadata to keep bounded demo ticks fast and quiet.
        output = output.copy()
        raw_lookup = raw_all.set_index("event_id").to_dict(orient="index")
        output["raw_source_fingerprint"] = [raw_source_fingerprint(raw_lookup.get(int(event_id), {})) for event_id in output["event_id"]]
        output["explanation_json"] = output.get("explanation_json", pd.Series(index=output.index, dtype="object")).fillna(
            json.dumps({"availability": False, "reason": "REPLAY_ROW_NOT_POLICY_READY"})
        )
        output["explanation_version"] = output.get("explanation_version", pd.Series(index=output.index, dtype="object")).fillna(EXPLANATION_VERSION)
        output = output.rename(columns={"event_start_time": "source_event_start_time", "event_end_time": "source_event_end_time"})
        output["persisted_time"] = pd.Timestamp.utcnow()
        output["source_watermark"] = output["source_event_start_time"].astype(str) + "|" + output["event_id"].astype(str)
        output["processing_latency_ms"] = 0.0
        # Keep the dashboard-compatible projection first, then replay-specific columns.
        compatible = format_online_output(output)
        extras = [column for column in output.columns if column not in compatible.columns]
        return pd.concat([compatible, output[extras]], axis=1)


def _merge_prefer_right(left: pd.DataFrame, right: pd.DataFrame) -> pd.DataFrame:
    if right.empty:
        return left
    overlap = [column for column in right.columns if column in left.columns and column != "event_id"]
    merged = left.merge(right, on="event_id", how="left", suffixes=("", "__new"))
    for column in overlap:
        replacement = f"{column}__new"
        if replacement in merged:
            merged[column] = merged[replacement].combine_first(merged[column])
            merged.drop(columns=[replacement], inplace=True)
    return merged


def _int_flag(frame: pd.DataFrame, column: str) -> pd.Series:
    if column not in frame:
        return pd.Series(0, index=frame.index, dtype="int8")
    return pd.to_numeric(frame[column], errors="coerce").fillna(0).astype("int8")


def _progress_sample(output: pd.DataFrame) -> dict[str, Any] | None:
    """Small, non-secret batch sample for the live demo console and JSONL."""
    if output.empty:
        return None
    ready = output[pd.to_numeric(output.get("policy_ready_flag"), errors="coerce").fillna(0).eq(1)]
    row = (ready.iloc[0] if not ready.empty else output.iloc[0]).to_dict()
    return {
        "event_id": _sample_value(row.get("event_id")),
        "machine_id": _sample_value(row.get("machine_id")),
        "event_start_time": _sample_value(row.get("source_event_start_time")),
        "input": {
            "status_id": _sample_value(row.get("status_id")),
            "duration_sec": _sample_value(row.get("duration_sec")),
            "gap_from_prev_sec": _sample_value(row.get("gap_from_prev_sec")),
            "kwh_delta": _sample_value(row.get("kwh_delta")),
        },
        "l1": {
            "ready": _sample_value(row.get("l1_score_available_flag")),
            "lenient_normalized": _sample_value(row.get("score_lenient_normalized")),
            "strict_normalized": _sample_value(row.get("score_strict_normalized")),
            "lenient_threshold": _sample_value(row.get("threshold_lenient")),
            "strict_threshold": _sample_value(row.get("threshold_strict")),
            "anomaly": _sample_value(row.get("is_behavior_anomaly")),
            "sensitive_warning": _sample_value(row.get("is_sensitive_warning")),
        },
        "l2": {
            "fault_10_events": _sample_value(row.get("risk_fault_10_events")),
            "fault_30_events": _sample_value(row.get("risk_fault_30_events")),
            "fault_30min": _sample_value(row.get("risk_fault_30min")),
            "fault_60min": _sample_value(row.get("risk_fault_60min")),
            "maintenance_30_events": _sample_value(row.get("risk_maintenance_30_events")),
            "repair_30_events": _sample_value(row.get("risk_repair_30_events")),
        },
        "policy": {
            "ready": _sample_value(row.get("policy_ready_flag")),
            "action_level": _sample_value(row.get("operational_action_level")),
            "judgment": _sample_value(row.get("operational_judgment")),
            "quality_judgment": _sample_value(row.get("quality_judgment")),
            "reason": _sample_value(row.get("final_reason_v2")),
        },
    }


def _sample_value(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, np.generic):
        value = value.item()
    return round(value, 4) if isinstance(value, float) else value
