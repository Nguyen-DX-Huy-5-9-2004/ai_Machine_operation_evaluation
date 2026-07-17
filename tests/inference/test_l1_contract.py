import json
from pathlib import Path

import pandas as pd

from inference.online.data_contract import validate_l1_model_contract
from inference.online.feature_builder_l1 import build_l1_event_features


def test_l1_contract_accepts_required_model_features():
    raw = pd.DataFrame([[1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None]], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    df = build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}})
    pre = json.loads(Path("modeling/l1_tcn/artifacts/lenient/preprocessor.json").read_text(encoding="utf-8"))
    report = validate_l1_model_contract(df, pre)
    assert report["result"] == "PASS"
    assert not report["missing_features"]


def test_l1_contract_fails_missing_required_feature():
    df = pd.DataFrame({"status_id": [3]})
    pre = json.loads(Path("modeling/l1_tcn/artifacts/lenient/preprocessor.json").read_text(encoding="utf-8"))
    report = validate_l1_model_contract(df, pre)
    assert report["result"] == "FAIL"
    assert "duration_sec" in report["missing_features"]
