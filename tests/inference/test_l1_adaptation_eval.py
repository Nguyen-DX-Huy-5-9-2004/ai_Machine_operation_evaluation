import pandas as pd

from inference.online.l1_shadow import L1_MODEL_FEATURES, build_window_manifest
from inference.online.score_new_events import (
    build_adaptation_splits,
    build_exact_paired_window_manifest,
    build_window_feature_diffs,
    fit_candidate_b_thresholds,
    reclassify_adaptation_change_reasons,
)


def _feature_rows(offset=0, machine_id=1, duplicate_start=False):
    rows = []
    base = pd.Timestamp("2026-01-01 00:00:00")
    for i in range(20):
        row = {
            "event_id": offset + i + 1,
            "machine_id": machine_id,
            "status_id": 3,
            "event_start_time": base if duplicate_start and i in {0, 1} else base + pd.Timedelta(minutes=i),
            "sequence_segment_id": 1,
            "event_order_in_segment": i + 1,
            "known_fault_status": 0,
            "known_repair_status": 0,
            "known_maintenance_status": 0,
            "off_with_fault_status": 0,
            "data_quality_issue_flag": 0,
        }
        for feature in L1_MODEL_FEATURES:
            row.setdefault(feature, 0)
        row["status_id"] = 3
        row["status_type_code"] = 1
        row["current_signal_code"] = 2
        row["machine_group_id"] = 9
        row["location_id"] = 4
        row["duration_sec"] = 60
        rows.append(row)
    return pd.DataFrame(rows)


def test_exact_paired_window_alignment_20_of_20():
    cur = _feature_rows(0)
    hist = _feature_rows(100)
    mapping = pd.DataFrame({"current_event_id": [20], "historical_event_id": [120], "machine_id": [1], "status_id": [3]})
    cm = build_window_manifest(cur, {20})
    hm = build_window_manifest(hist, {120})

    _, manifest, failures = build_exact_paired_window_manifest(mapping, cm, hm, cur, hist)

    assert manifest.loc[0, "alignment_status"] == "EXACT_PAIRED_WINDOW"
    assert failures.empty


def test_duplicate_natural_key_is_ambiguous():
    cur = _feature_rows(0, duplicate_start=True)
    hist = _feature_rows(100, duplicate_start=True)
    mapping = pd.DataFrame({"current_event_id": [20], "historical_event_id": [120], "machine_id": [1], "status_id": [3]})

    _, manifest, _ = build_exact_paired_window_manifest(mapping, build_window_manifest(cur, {20}), build_window_manifest(hist, {120}), cur, hist)

    assert manifest.loc[0, "alignment_status"] == "AMBIGUOUS_MAPPING"


def test_status_sequence_mismatch_detected():
    cur = _feature_rows(0)
    hist = _feature_rows(100)
    hist.loc[5, "status_id"] = 2
    mapping = pd.DataFrame({"current_event_id": [20], "historical_event_id": [120], "machine_id": [1], "status_id": [3]})

    _, manifest, _ = build_exact_paired_window_manifest(mapping, build_window_manifest(cur, {20}), build_window_manifest(hist, {120}), cur, hist)

    assert manifest.loc[0, "alignment_status"] == "STATUS_SEQUENCE_MISMATCH"


def test_kwh_change_at_position_1_and_20_classifies_as_kwh_only():
    cur = _feature_rows(0)
    hist = _feature_rows(100)
    cur.loc[0, "kwh_delta_model_value"] = 1.0
    cur.loc[19, "kwh_rate_per_hour"] = 2.0
    mapping = pd.DataFrame({"current_event_id": [20], "historical_event_id": [120], "machine_id": [1], "status_id": [3]})
    _, manifest, _ = build_exact_paired_window_manifest(mapping, build_window_manifest(cur, {20}), build_window_manifest(hist, {120}), cur, hist)
    feature_summary, _ = build_window_feature_diffs(manifest, cur, hist)
    reasons = reclassify_adaptation_change_reasons(manifest, feature_summary, pd.DataFrame(), pd.DataFrame({"current_event_id": [20]}))

    assert feature_summary.loc[0, "window_kwh_changed_event_count"] == 2
    assert reasons.loc[0, "adaptation_change_reason"] == "KWH_ONLY_WINDOW_CHANGE"


def test_time_and_kwh_change_classifies_multi_source_or_kwh_time():
    cur = _feature_rows(0)
    hist = _feature_rows(100)
    cur.loc[0, "kwh_delta_model_value"] = 1.0
    cur.loc[1, "duration_sec"] = 120.0
    mapping = pd.DataFrame({"current_event_id": [20], "historical_event_id": [120], "machine_id": [1], "status_id": [3]})
    _, manifest, _ = build_exact_paired_window_manifest(mapping, build_window_manifest(cur, {20}), build_window_manifest(hist, {120}), cur, hist)
    feature_summary, _ = build_window_feature_diffs(manifest, cur, hist)
    reasons = reclassify_adaptation_change_reasons(manifest, feature_summary, pd.DataFrame(), pd.DataFrame({"current_event_id": [20]}))

    assert reasons.loc[0, "adaptation_change_reason"] == "KWH_AND_TIME_WINDOW_CHANGE"


def test_time_ordered_split_and_threshold_uses_calibration_normal_only():
    df = pd.concat([_feature_rows(0), _feature_rows(100)], ignore_index=True)
    df["score_lenient"] = range(len(df))
    df["score_strict"] = range(len(df))
    df["threshold_lenient"] = 999
    df["threshold_strict"] = 999
    df["is_anomaly_lenient"] = 0
    df["is_anomaly_strict"] = 0
    df["is_behavior_anomaly"] = 0
    df["is_sensitive_warning"] = 0
    df["window_ready_flag"] = 1

    split, summary = build_adaptation_splits(df, df[["event_id", "score_lenient", "score_strict", "threshold_lenient", "threshold_strict", "is_anomaly_lenient", "is_anomaly_strict", "is_behavior_anomaly", "is_sensitive_warning", "window_ready_flag"]], set(df["event_id"]))
    thresholds = fit_candidate_b_thresholds(split, {"threshold": {"quantile": 0.995, "per_machine_threshold": True, "min_machine_valid_windows": 1000, "fallback_global_quantile": 0.995}})

    assert summary["no_random_split"] is True
    assert thresholds["lenient"]["calibration_window_count"] == int(((split["adapt_split"] == "ADAPT_CALIBRATION") & (split["normal_lenient_flag"] == 1)).sum())
