from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from inference.online.feature_builder_l1 import build_l1_event_features
from inference.online.l1_shadow import (
    L1_MODEL_FEATURES,
    artifact_contract,
    build_window_manifest,
    combine_shadow_scores,
    load_l1_base_config,
    load_shadow_profile,
    rows_for_ready_windows,
    score_windows,
)


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _twenty_event_features() -> pd.DataFrame:
    rows = []
    start = pd.Timestamp("2026-01-01 00:00:00")
    for idx in range(20):
        s = start + pd.Timedelta(minutes=idx * 2)
        e = s + pd.Timedelta(minutes=1)
        rows.append([idx + 1, 1, 3, s, e, float(idx), float(idx + 1), None])
    raw = pd.DataFrame(
        rows,
        columns=[
            "event_id",
            "machine_id",
            "status_id",
            "event_start_time",
            "raw_event_end_time",
            "raw_status_kwh_start",
            "raw_status_kwh_end",
            "raw_error_code",
        ],
    )
    return build_l1_event_features(raw, config={"runtime": {"big_gap_seconds": 3600}})


def test_l1_shadow_feature_order_matches_artifact_contract():
    base_cfg = load_l1_base_config(PROJECT_ROOT)
    lenient = load_shadow_profile(PROJECT_ROOT, "lenient", base_cfg)
    strict = load_shadow_profile(PROJECT_ROOT, "strict", base_cfg, device=lenient.device)
    report = artifact_contract(PROJECT_ROOT, [lenient, strict], base_cfg)

    assert report["result"] == "PASS"
    assert report["expected_feature_order"] == L1_MODEL_FEATURES
    assert report["profiles"]["lenient"]["feature_order_match"]
    assert report["profiles"]["strict"]["feature_order_match"]


def test_l1_shadow_window_requires_20_events_in_same_segment():
    features = _twenty_event_features()
    manifest = build_window_manifest(features, {19, 20}, window_size=20)
    by_id = manifest.set_index("event_id")

    assert by_id.loc[19, "window_ready_flag"] == 0
    assert by_id.loc[19, "not_scored_reason"] == "INSUFFICIENT_HISTORY_IN_SEGMENT"
    assert by_id.loc[20, "window_ready_flag"] == 1
    assert by_id.loc[20, "not_scored_reason"] == "READY"
    assert by_id.loc[20, "window_row_count"] == 20


def test_l1_shadow_window_does_not_cross_segment_boundary():
    features = _twenty_event_features()
    features.loc[features["event_id"] >= 11, "sequence_segment_id"] = 2
    features.loc[features["event_id"] >= 11, "event_order_in_segment"] = range(1, 11)
    manifest = build_window_manifest(features, {20}, window_size=20)

    assert manifest.loc[0, "window_ready_flag"] == 0
    assert manifest.loc[0, "not_scored_reason"] == "INSUFFICIENT_HISTORY_IN_SEGMENT"


def test_l1_shadow_batch_and_single_scoring_are_deterministic():
    base_cfg = load_l1_base_config(PROJECT_ROOT)
    lenient = load_shadow_profile(PROJECT_ROOT, "lenient", base_cfg)
    features = _twenty_event_features()
    manifest = build_window_manifest(features, {20}, window_size=20)
    ready_rows = rows_for_ready_windows(features, manifest)

    single, single_report = score_windows(lenient, base_cfg, ready_rows, batch_size=1)
    batch, batch_report = score_windows(lenient, base_cfg, ready_rows, batch_size=16)

    assert single_report["non_finite_input_count"] == 0
    assert single_report["non_finite_output_count"] == 0
    assert batch_report["non_finite_output_count"] == 0
    assert np.isfinite(single["score_lenient"]).all()
    assert np.isfinite(batch["score_lenient"]).all()
    assert single["score_lenient"].iloc[0] == pytest.approx(batch["score_lenient"].iloc[0], rel=1e-6)


def test_l1_shadow_anomaly_rules_are_lenient_production_and_strict_only_warning():
    manifest = pd.DataFrame(
        {
            "event_id": [1, 2, 3],
            "machine_id": [1, 1, 1],
            "window_ready_flag": [1, 1, 0],
            "not_scored_reason": ["READY", "READY", "OPEN_EVENT"],
        }
    )
    lenient = pd.DataFrame(
        {
            "event_id": [1, 2],
            "score_lenient": [2.0, 0.5],
            "threshold_lenient": [1.0, 1.0],
            "score_lenient_normalized": [2.0, 0.5],
            "is_anomaly_lenient": [1, 0],
        }
    )
    strict = pd.DataFrame(
        {
            "event_id": [1, 2],
            "score_strict": [2.0, 2.0],
            "threshold_strict": [1.0, 1.0],
            "score_strict_normalized": [2.0, 2.0],
            "is_anomaly_strict": [1, 1],
        }
    )

    combined = combine_shadow_scores(manifest, lenient, strict).set_index("event_id")

    assert combined.loc[1, "is_behavior_anomaly"] == 1
    assert combined.loc[1, "is_sensitive_warning"] == 0
    assert combined.loc[2, "is_behavior_anomaly"] == 0
    assert combined.loc[2, "is_sensitive_warning"] == 1
    assert combined.loc[3, "is_behavior_anomaly"] == 0
    assert combined.loc[3, "is_sensitive_warning"] == 0
