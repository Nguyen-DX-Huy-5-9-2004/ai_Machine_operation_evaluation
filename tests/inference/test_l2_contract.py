import json
from pathlib import Path

import pandas as pd

from inference.online.data_contract import load_l2_metadata_by_target, validate_l2_model_contract
from inference.online.feature_builder_l1 import build_l1_event_features
from inference.online.feature_builder_l2 import build_l2_runtime_features


def test_l2_contract_builds_selected_target_features_without_future_leakage():
    raw = pd.DataFrame([[1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None]], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    l1 = build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}})
    l1["future_fault_within_10_events"] = 1
    l2 = build_l2_runtime_features(l1)
    assert "future_fault_within_10_events" not in l2.columns
    metadata = load_l2_metadata_by_target(
        "modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347",
        "data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json",
    )
    report = validate_l2_model_contract(l2, metadata)
    assert report["result"] == "PASS"


def test_l2_contract_fails_missing_metadata_feature():
    metadata = {
        "target": {
            "feature_columns": ["duration_sec_model_value", "missing_runtime_feature"],
            "categorical_features": [],
        }
    }
    report = validate_l2_model_contract(pd.DataFrame({"duration_sec_model_value": [1.0]}), metadata)
    assert report["result"] == "FAIL"
    assert "missing_runtime_feature" in report["targets"]["target"]["missing_features"]
