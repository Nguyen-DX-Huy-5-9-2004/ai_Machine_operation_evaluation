import pandas as pd

from inference.online.feature_builder_l1 import build_l1_event_features


def test_status_1_to_10_numeric_mapping_matches_historical_convention():
    raw = pd.DataFrame(
        [[sid, 1, sid, f"2026-01-01 00:{sid:02d}:00", f"2026-01-01 00:{sid+1:02d}:00", 1, 2, None] for sid in range(1, 11)],
        columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"],
    )
    df = build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}}).set_index("status_id")
    assert df.loc[1, "current_signal_code"] == 0
    assert df.loc[2, "current_signal_code"] == 1
    assert df.loc[3, "current_signal_code"] == 2
    assert pd.isna(df.loc[8, "current_signal_code"])
    assert df.loc[1, "is_current_near_zero"] == 1
    assert df.loc[2, "is_current_near_zero"] == 0
    assert df.loc[8, "is_no_load"] == 0


def test_info_or_unknown_status_is_audited_not_normalized_to_on_off():
    raw = pd.DataFrame([[1, 1, 11, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None]], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    df = build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}})
    assert df.loc[0, "info_status"] == 1
    assert df.loc[0, "status_evidence_class"] == "UNKNOWN_STATUS"
