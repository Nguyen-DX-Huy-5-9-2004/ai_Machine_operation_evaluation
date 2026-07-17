import pandas as pd

from inference.online.feature_builder_l1 import build_l1_event_features


def test_location_and_machine_group_from_event_context_map():
    raw = pd.DataFrame([[1, 10, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None]], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    loc = pd.DataFrame([[1, 10, 7, 99]], columns=["event_id", "machine_id", "location_id", "machine_group_id"])
    df = build_l1_event_features(raw, location_context=loc, config={"runtime": {"big_gap_seconds": 3600}})
    assert df.loc[0, "location_id"] == 7
    assert df.loc[0, "machine_group_id"] == 99


def test_machine_without_location_gets_missing_marker():
    raw = pd.DataFrame([[1, 10, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None]], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    df = build_l1_event_features(raw, location_context=pd.DataFrame(), config={"runtime": {"big_gap_seconds": 3600}})
    assert df.loc[0, "location_id"] == -1
