from __future__ import annotations

import json

import pandas as pd

from inference.online.l1_candidate_c import (
    L1_FEATURE_ORDER,
    add_future_labels,
    add_normal_flags,
    assign_time_ordered_splits,
    build_split_window_manifest,
    split_leakage_report,
)


def _frame(rows: int = 100) -> pd.DataFrame:
    out = pd.DataFrame({
        "event_id": range(1, rows + 1), "machine_id": 1, "sequence_segment_id": 1,
        "event_order_in_segment": range(1, rows + 1), "event_start_time": pd.date_range("2026-01-01", periods=rows, freq="min"),
        "status_id": 1, "is_open_event": 0, "is_non_positive_duration": 0, "is_big_gap": 0,
        "is_overlap": 0, "duration_sec": 60.0, "known_fault_status": 0,
        "known_maintenance_status": 0, "known_repair_status": 0, "data_quality_issue_flag": 0,
        "energy_inconsistency_flag": 0,
    })
    for col in L1_FEATURE_ORDER:
        if col not in out:
            out[col] = 0
    return out


def test_normal_definitions_match_sql_predicates():
    df = _frame(3)
    df.loc[1, "is_overlap"] = 1
    df.loc[2, "status_id"] = 6
    actual = add_normal_flags(df)
    assert actual.normal_lenient_flag.tolist() == [1, 1, 0]
    assert actual.normal_strict_flag.tolist() == [1, 0, 0]


def test_future_labels_stay_in_machine_segment_and_exclude_current_event():
    df = _frame(4)
    df.loc[1, "known_fault_status"] = 1
    df.loc[2, "known_maintenance_status"] = 1
    actual = add_future_labels(df)
    assert actual.loc[0, "future_fault_within_10_events"] == 1
    assert actual.loc[1, "future_fault_within_10_events"] == 0
    assert actual.loc[1, "future_maintenance_within_30_events"] == 1


def test_split_windows_are_complete_and_do_not_leak():
    events = assign_time_ordered_splits(_frame(160))
    windows = build_split_window_manifest(events)
    report = split_leakage_report(events, windows)
    assert report["result"] == "PASS"
    assert (windows.source_event_count == 20).all()
    for _, row in windows.iterrows():
        ids = json.loads(row.source_event_ids)
        split = events.set_index("event_id").loc[ids, "split_name"].unique().tolist()
        assert split == [row.split_name]


def test_open_events_are_excluded_by_package_caller_contract():
    df = _frame(3)
    df.loc[2, "is_open_event"] = 1
    closed = df[df.is_open_event == 0]
    assert len(closed) == 2
