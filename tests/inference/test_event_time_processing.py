import pandas as pd

from inference.online.feature_builder_l1 import build_l1_event_features
from inference.online.score_new_events import build_context_from_loaded_sql
from inference.online.sql_queries import load_context_by_row_order_sql


def _raw(rows):
    return pd.DataFrame(rows, columns=[
        "event_id",
        "machine_id",
        "status_id",
        "event_start_time",
        "raw_event_end_time",
        "raw_status_kwh_start",
        "raw_status_kwh_end",
        "raw_error_code",
    ])


def _cfg():
    return {"runtime": {"kwh_impute_gap_limit_seconds": 300, "small_gap_seconds": 300, "big_gap_seconds": 3600, "long_duration_seconds": 86400}}


def test_raw_end_valid_is_used():
    df = build_l1_event_features(_raw([[1, 10, 3, "2026-01-01 00:00:00", "2026-01-01 00:05:00", 1, 2, None]]), config=_cfg())
    assert df.loc[0, "end_time_source"] == "RAW"
    assert df.loc[0, "duration_sec"] == 300


def test_raw_end_null_uses_next_greater_start():
    raw = _raw([
        [1, 10, 3, "2026-01-01 00:00:00", None, 1, 2, None],
        [2, 10, 8, "2026-01-01 00:10:00", "2026-01-01 00:20:00", 2, 2, None],
    ])
    df = build_l1_event_features(raw, config=_cfg())
    assert df.loc[df["event_id"] == 1, "end_time_source"].iloc[0] == "NEXT_EVENT_START_FROM_NULL"
    assert df.loc[df["event_id"] == 1, "duration_sec"].iloc[0] == 600


def test_row_order_context_includes_next_event_after_24_hours():
    raw = _raw([
        [526515, 10, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None],
        [526516, 10, 3, "2026-01-01 00:01:00", None, 2, 3, None],
        [526517, 10, 8, "2026-01-02 00:01:00", "2026-01-02 00:02:00", 3, 4, None],
    ])
    context = build_context_from_loaded_sql(raw, {526516}, lookback=40, lookahead=2)
    features = build_l1_event_features(context, config=_cfg()).set_index("event_id")
    assert set(context["event_id"].astype(int)) == {526515, 526516, 526517}
    assert features.loc[526516, "end_time_source"] == "NEXT_EVENT_START_FROM_NULL"
    assert features.loc[526516, "duration_sec"] == 86400


def test_sql_context_query_uses_row_order_for_distant_lookahead():
    sql = load_context_by_row_order_sql(
        "dbo.data_iot_convert",
        {
            "event_id": "id", "machine_id": "machine_id", "status_id": "status_id",
            "event_start_time": "status_time_start", "raw_event_end_time": "status_time_end",
            "raw_kwh_start": "status_kwh_start", "raw_kwh_end": "status_kwh_end", "raw_error_code": "error_code",
        },
        "526516", 40, 2, "is_deleted",
    )
    assert "ROW_NUMBER() OVER" in sql
    assert "row_order BETWEEN" in sql


def test_invalid_raw_end_uses_next_greater_start():
    raw = _raw([
        [1, 10, 3, "2026-01-01 00:00:00", "2025-12-31 23:59:00", 1, 2, None],
        [2, 10, 8, "2026-01-01 00:10:00", "2026-01-01 00:20:00", 2, 2, None],
    ])
    df = build_l1_event_features(raw, config=_cfg())
    row = df[df["event_id"] == 1].iloc[0]
    assert row["end_time_source"] == "NEXT_EVENT_START_FROM_INVALID_RAW"
    assert row["is_invalid_raw_end"] == 1


def test_same_timestamp_uses_next_greater_distinct_start_not_next_row():
    raw = _raw([
        [1, 10, 3, "2026-01-01 00:00:00", None, 1, 2, None],
        [2, 10, 2, "2026-01-01 00:00:00", None, 2, 3, None],
        [3, 10, 8, "2026-01-01 00:10:00", "2026-01-01 00:20:00", 3, 3, None],
    ])
    df = build_l1_event_features(raw, config=_cfg())
    assert set(df.loc[df["event_id"].isin([1, 2]), "duration_sec"]) == {600.0}


def test_last_unresolved_event_is_open():
    df = build_l1_event_features(_raw([[1, 10, 3, "2026-01-01 00:00:00", None, None, None, None]]), config=_cfg())
    assert df.loc[0, "end_time_source"] == "OPEN_EVENT"
    assert df.loc[0, "is_open_event"] == 1


def test_gap_big_gap_and_overlap_flags():
    raw = _raw([
        [1, 10, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None],
        [2, 10, 3, "2026-01-01 00:07:00", "2026-01-01 00:08:00", 2, 3, None],
        [3, 10, 3, "2026-01-01 02:00:00", "2026-01-01 02:10:00", 3, 4, None],
        [4, 10, 3, "2026-01-01 02:05:00", "2026-01-01 02:06:00", 4, 5, None],
    ])
    df = build_l1_event_features(raw, config=_cfg()).set_index("event_id")
    assert df.loc[2, "is_gap"] == 1
    assert df.loc[3, "is_big_gap"] == 1
    assert df.loc[4, "is_overlap"] == 1
