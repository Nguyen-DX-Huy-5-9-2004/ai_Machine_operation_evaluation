from __future__ import annotations

import pandas as pd
import pytest
import inspect

import inference.online.l1_candidate_post_evaluation as post_eval
from inference.online.l1_candidate_post_evaluation import (
    classify_ac_disagreement,
    future_label_contract_audit,
)


def _scores() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "machine_id": [1, 1], "event_id": [1, 2], "split_name": ["VALID", "VALID"],
            "candidate_a_is_behavior_anomaly": [1, 0], "candidate_c_is_behavior_anomaly": [0, 1],
            "known_fault_status": [1, 0], "normal_lenient_flag": [0, 1],
            "future_fault_within_10_events": [1, 0], "future_fault_within_30_events": [1, 0],
            "future_fault_within_30min": [1, 0], "future_fault_within_60min": [1, 0],
            "future_maintenance_within_30_events": [0, 0], "future_repair_within_30_events": [0, 0],
        }
    )


def _canonical() -> dict[int, pd.DataFrame]:
    return {1: pd.DataFrame({
        "machine_id": [1, 1, 1], "event_id": [1, 2, 3], "sequence_segment_id": [1, 1, 1],
        "event_order_in_segment": [1, 2, 3],
        "event_start_time": pd.to_datetime(["2026-01-01 00:00:00", "2026-01-01 00:01:00", "2026-01-01 00:02:00"]),
        "known_fault_status": [0, 1, 0], "known_maintenance_status": [0, 0, 0], "known_repair_status": [0, 0, 0],
    })}


def test_disagreement_classifies_fault_and_normal_pairs():
    out = classify_ac_disagreement(_scores())
    assert out["ac_disagreement_category"].tolist() == ["known_fault: A=1,C=0", "normal: A=0,C=1"]


def test_future_contract_requires_strictly_later_same_machine_event_and_prevalence():
    contract, prevalence, lead = future_label_contract_audit(_scores(), _canonical())
    assert contract["result"] == "PASS"
    assert contract["labels"]["future_fault_within_10_events"]["stored_positive"] == 1
    assert prevalence["global"]["future_fault_within_30min"]["VALID"]["prevalence"] == 0.5
    assert lead["labels"]["future_fault_within_10_events"]["positive_with_witness"] == 1


def test_future_contract_fails_when_current_event_is_used_as_future():
    scores = _scores()
    scores.loc[0, "future_fault_within_30min"] = 1
    canonical = _canonical()
    canonical[1].loc[1, "event_start_time"] = canonical[1].loc[0, "event_start_time"]
    contract, _, _ = future_label_contract_audit(scores, canonical)
    assert contract["result"] == "FAIL"


def test_future_contract_rejects_duplicate_target_key():
    duplicated = pd.concat([_scores(), _scores().iloc[[0]]], ignore_index=True)
    with pytest.raises(ValueError, match="duplicate evaluation target key"):
        future_label_contract_audit(duplicated, _canonical())


def test_post_evaluation_module_has_no_sql_l2_or_training_execution_path():
    source = inspect.getsource(post_eval)
    assert "pyodbc" not in source
    assert "L2Scorer" not in source
    assert "train.py" not in source
    assert "production_write\": True" not in source
