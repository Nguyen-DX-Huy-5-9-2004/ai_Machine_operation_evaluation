import pandas as pd

from inference.online.feature_builder_l1 import build_l1_event_features


def _cfg():
    return {"runtime": {"kwh_impute_gap_limit_seconds": 300, "small_gap_seconds": 300, "big_gap_seconds": 3600, "long_duration_seconds": 86400}}


def _raw(rows):
    return pd.DataFrame(rows, columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])


def test_kwh_raw_delta_and_rate():
    df = build_l1_event_features(_raw([[1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 01:00:00", 10, 12, None]]), config=_cfg())
    assert df.loc[0, "kwh_delta"] == 2
    assert df.loc[0, "kwh_rate_per_hour"] == 2


def test_kwh_start_impute_within_300_seconds():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 10, 11, None],
        [2, 1, 3, "2026-01-01 00:05:00", "2026-01-01 00:06:00", None, 12, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[2, "kwh_start_value"] == 11
    assert df.loc[2, "kwh_start_source"] == "PREV_EVENT_END"


def test_kwh_start_not_imputed_beyond_300_seconds():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 10, 11, None],
        [2, 1, 3, "2026-01-01 00:07:00", "2026-01-01 00:08:00", None, 12, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[2, "kwh_start_source"] == "MISSING"


def test_kwh_end_impute_within_300_seconds():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 10, None, None],
        [2, 1, 3, "2026-01-01 00:05:00", "2026-01-01 00:06:00", 11, 12, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[1, "kwh_end_value"] == 11
    assert df.loc[1, "kwh_end_source"] == "NEXT_EVENT_START"


def test_kwh_end_not_imputed_beyond_300_seconds():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 10, None, None],
        [2, 1, 3, "2026-01-01 00:07:00", "2026-01-01 00:08:00", 11, 12, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[1, "kwh_end_source"] == "MISSING"


def test_kwh_start_is_not_imputed_across_overlap():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:10:00", 10, 11, None],
        [2, 1, 3, "2026-01-01 00:05:00", "2026-01-01 00:06:00", None, 12, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[2, "kwh_start_source"] == "MISSING"


def test_kwh_end_uses_adjacent_event_not_next_distinct_timestamp():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:00:10", 10, None, None],
        [2, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:00:05", 7, 7, None],
        [3, 1, 3, "2026-01-01 00:00:20", "2026-01-01 00:00:30", 8, 8, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[1, "kwh_end_source"] == "MISSING"


def test_negative_zero_and_missing_energy_flags():
    raw = _raw([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 10, 9, None],
        [2, 1, 3, "2026-01-01 00:02:00", "2026-01-01 00:03:00", 10, 10, None],
        [3, 1, 3, "2026-01-01 00:04:00", "2026-01-01 00:05:00", None, None, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[1, "kwh_negative_delta_flag"] == 1
    assert df.loc[2, "loaded_zero_kwh_flag"] == 1
    assert df.loc[3, "loaded_without_kwh_flag"] == 1
