from __future__ import annotations

import pandas as pd
import pytest
from types import SimpleNamespace

import inference.online.l1_candidate_evaluation as candidate_eval
from inference.online.l1_candidate_evaluation import (
    apply_candidate_labels,
    candidate_metric_payload,
    decision_gate,
    merge_evaluation_labels,
    strict_lenient_overlap,
)


def _scored_rows() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "event_id": [1, 2, 3, 4],
            "machine_id": [49, 49, 51, 58],
            "window_ready_flag": [1, 1, 1, 0],
            "normal_lenient_flag": [1, 0, 1, 1],
            "known_fault_status": [0, 1, 0, 0],
            "future_fault_within_10_events": [0, 1, 0, 0],
            "future_fault_within_30_events": [0, 1, 0, 0],
            "future_fault_within_30min": [0, 1, 0, 0],
            "future_fault_within_60min": [0, 1, 0, 0],
            "future_maintenance_within_30_events": [0, 0, 1, 0],
            "future_repair_within_30_events": [0, 0, 0, 1],
            "candidate_c_is_behavior_anomaly": [0, 1, 1, 1],
            "candidate_c_is_sensitive_warning": [0, 0, 1, 0],
            "candidate_c_is_anomaly_lenient": [0, 1, 0, 1],
            "candidate_c_is_anomaly_strict": [0, 1, 1, 1],
        }
    )


def test_candidate_metrics_use_ready_windows_but_report_all_support():
    metrics = candidate_metric_payload(_scored_rows(), "candidate_c")

    assert metrics["total_support"] == 4
    assert metrics["scored_window_support"] == 3
    assert metrics["not_scored_window_support"] == 1
    assert metrics["known_fault_support"] == 1
    assert metrics["known_fault_recall"] == 1.0
    assert metrics["normal_lenient_support"] == 2
    assert metrics["normal_false_positive_rate"] == 0.5
    assert metrics["future_fault_within_10_events_recall"] == 1.0


def test_strict_lenient_overlap_and_production_rule_are_explicit():
    scores = pd.DataFrame(
        {
            "machine_id": [1, 1],
            "score_lenient": [0.5, 2.0],
            "score_strict": [2.0, 2.0],
        }
    )
    thresholds = {
        "lenient": {"global_threshold": 1.0},
        "strict": {"global_threshold": 1.0},
    }
    labeled = apply_candidate_labels(scores, thresholds, "candidate_c")
    rows = _scored_rows().iloc[:2].copy()
    for column in labeled.columns:
        if column.startswith("candidate_c_"):
            rows[column] = labeled[column].to_numpy()

    overlap = strict_lenient_overlap(rows, "candidate_c")
    assert rows["candidate_c_is_behavior_anomaly"].tolist() == [0, 1]
    assert rows["candidate_c_is_sensitive_warning"].tolist() == [1, 0]
    assert overlap["lenient_0_strict_1"]["count"] == 1
    assert overlap["lenient_1_strict_1"]["count"] == 1


def test_decision_gate_uses_valid_only_not_test_metrics():
    valid = {
        "candidate_a": {"known_fault_support": 10, "known_fault_recall": 0.7, "normal_false_positive_rate": 0.1},
        "candidate_b": {"known_fault_support": 10, "known_fault_recall": 0.6, "normal_false_positive_rate": 0.1},
        "candidate_c": {"known_fault_support": 10, "known_fault_recall": 0.8, "normal_false_positive_rate": 0.08},
    }
    test = {
        "candidate_a": {"known_fault_support": 100, "known_fault_recall": 1.0, "normal_false_positive_rate": 0.0},
        "candidate_b": {"known_fault_support": 100, "known_fault_recall": 1.0, "normal_false_positive_rate": 0.0},
        "candidate_c": {"known_fault_support": 100, "known_fault_recall": 0.0, "normal_false_positive_rate": 1.0},
    }
    result = decision_gate(
        {"VALID": valid, "TEST": test},
        {},
        {"exact_window_identity": "PASS"},
        {"result": "NOT_AVAILABLE"},
    )

    assert result["decision"] == "ADOPT_CANDIDATE_C_CURRENT_ONLY"
    assert result["selection_split"] == "VALID"
    assert result["test_used_for_selection"] is False


def test_abc_scoring_keeps_one_exact_ready_window_set(monkeypatch):
    canonical = pd.DataFrame(
        {
            "event_id": range(1, 21),
            "machine_id": 49,
            "sequence_segment_id": 1,
            "event_order_in_segment": range(1, 21),
            "event_start_time": pd.date_range("2026-01-01", periods=20, freq="min"),
            "is_open_event": 0,
            "normal_lenient_flag": 1,
            "normal_strict_flag": 1,
            "known_fault_status": 0,
        }
    )
    for feature in candidate_eval.L1_MODEL_FEATURES:
        if feature not in canonical:
            canonical[feature] = 0

    def fake_scores(profile, _config, rows):
        assert rows["shadow_window_id"].nunique() == 1
        score = 0.5 if profile.profile == "lenient" else 1.5
        return pd.DataFrame(
            {
                "event_id": [20],
                "machine_id": [49],
                "event_start_time": [pd.Timestamp("2026-01-01 00:19:00")],
                "sequence_segment_id": [1],
                "event_order_in_segment": [20],
                f"score_{profile.profile}": [score],
                f"threshold_{profile.profile}": [1.0],
                f"score_{profile.profile}_normalized": [score],
                f"is_anomaly_{profile.profile}": [int(score >= 1.0)],
            }
        ), {}

    monkeypatch.setattr(candidate_eval, "score_windows", fake_scores)
    production = {
        profile: SimpleNamespace(profile=profile, thresholds={"global_threshold": 1.0})
        for profile in ("lenient", "strict")
    }
    candidate = {
        profile: SimpleNamespace(profile=profile, thresholds={"global_threshold": 1.0})
        for profile in ("lenient", "strict")
    }
    result = candidate_eval._score_machine_split(
        canonical,
        {20},
        production,
        candidate,
        {"base": {"window": {"size": 20}}, "lenient": {"window": {"size": 20}}, "strict": {"window": {"size": 20}}},
        {"lenient": {"global_threshold": 1.0}, "strict": {"global_threshold": 1.0}},
    )

    assert result["event_id"].tolist() == [20]
    assert result["window_ready_flag"].tolist() == [1]
    assert result["candidate_a_score_lenient"].tolist() == result["candidate_b_score_lenient"].tolist()
    assert result["candidate_c_is_behavior_anomaly"].tolist() == [0]
    assert result["candidate_c_is_sensitive_warning"].tolist() == [1]
    assert not any(column.endswith(("_x", "_y")) for column in result.columns)


def test_historical_exact_window_builder_requires_all_twenty_source_rows():
    historical = pd.DataFrame(
        {
            "event_id": range(101, 121),
            "machine_id": 49,
            "sequence_segment_id": 1,
            "event_order_in_segment": range(1, 21),
        }
    )
    exact = pd.DataFrame(
        {
            "current_event_id": [20, 21],
            "historical_event_id": [120, 121],
            "mapping_machine_id": [49, 49],
            "historical_window_event_ids": ["|".join(str(event_id) for event_id in range(101, 121)), "|".join(str(event_id) for event_id in range(102, 122))],
        }
    )

    rows, mapping = candidate_eval._historical_window_rows(exact, historical)

    assert rows["shadow_window_id"].nunique() == 1
    assert len(rows) == 20
    assert mapping["current_event_id"].tolist() == [20]


def test_evaluation_label_merge_whitelists_targets_without_suffix_columns():
    scored = pd.DataFrame(
        {
            "machine_id": [49],
            "event_id": [20],
            "event_start_time": [pd.Timestamp("2026-01-01")],
            "sequence_segment_id": [3],
            "event_order_in_segment": [20],
            "window_ready_flag": [1],
        }
    )
    labels = pd.DataFrame(
        {
            "machine_id": [49],
            "event_id": [20],
            "event_start_time": [pd.Timestamp("2026-01-01")],
            "sequence_segment_id": [3],
            "event_order_in_segment": [20],
            "split_name": ["VALID"],
            "normal_lenient_flag": [1],
            "known_fault_status": [1],
            "future_fault_within_10_events": [1],
        }
    )

    merged = merge_evaluation_labels(scored, labels)

    assert merged["known_fault_status"].tolist() == [1]
    assert merged["future_fault_within_10_events"].tolist() == [1]
    assert merged["event_start_time"].tolist() == scored["event_start_time"].tolist()
    assert not any(column.endswith(("_x", "_y")) for column in merged.columns)


def test_evaluation_label_merge_rejects_duplicate_machine_event_key():
    scored = pd.DataFrame({"machine_id": [49], "event_id": [20]})
    labels = pd.DataFrame(
        {
            "machine_id": [49, 49],
            "event_id": [20, 20],
            "normal_lenient_flag": [1, 1],
        }
    )

    with pytest.raises(ValueError, match="not unique"):
        merge_evaluation_labels(scored, labels)
