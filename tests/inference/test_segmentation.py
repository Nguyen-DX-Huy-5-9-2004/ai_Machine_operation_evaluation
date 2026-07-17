import pandas as pd

from inference.online.feature_builder_l1 import build_l1_event_features


def test_segment_starts_on_big_gap_and_order_is_stable():
    raw = pd.DataFrame([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None],
        [2, 1, 3, "2026-01-01 00:02:00", "2026-01-01 00:03:00", 2, 3, None],
        [3, 1, 3, "2026-01-01 02:10:00", "2026-01-01 02:11:00", 3, 4, None],
    ], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    df = build_l1_event_features(raw, config={"runtime": {"small_gap_seconds": 300, "big_gap_seconds": 3600}})
    assert df["sequence_segment_id"].tolist() == [1, 1, 2]
    assert df["event_order_in_segment"].tolist() == [1, 2, 1]


def test_segments_do_not_mix_machines():
    raw = pd.DataFrame([
        [1, 1, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None],
        [2, 2, 3, "2026-01-01 00:00:00", "2026-01-01 00:01:00", 1, 2, None],
    ], columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code"])
    df = build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}})
    assert df.groupby("machine_id")["sequence_segment_id"].first().tolist() == [1, 1]
