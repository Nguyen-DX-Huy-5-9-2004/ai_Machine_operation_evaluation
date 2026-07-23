from __future__ import annotations

from datetime import datetime

import pandas as pd

from backend.app.replay_runtime import ReplayRuntimeIndex
from inference.replay.store import ReplayEventStore
from inference.replay.types import ProcessedReplayBatch, ReplayConfig, ReplayWatermark


def test_replay_runtime_index_reads_only_committed_file_batches(tmp_path) -> None:
    config = ReplayConfig(replay_start_time=datetime(2025, 1, 1), output_root=str(tmp_path))
    store = ReplayEventStore(tmp_path, "runtime-index")
    store.create_or_open(config)
    frame = pd.DataFrame({
        "event_id": [7], "machine_id": [50], "event_uid": ["HISTORICAL_REPLAY:runtime-index:7"],
        "source_event_start_time": pd.to_datetime(["2025-01-01T00:05:00"]),
        "l1_score_available_flag": [1], "policy_ready_flag": [1],
    })
    store.commit_batch(
        batch_sequence=1,
        virtual_time=datetime(2025, 1, 1, 0, 5),
        watermark=ReplayWatermark(datetime(2025, 1, 1, 0, 5), 7),
        source_watermark=ReplayWatermark(datetime(2025, 1, 1, 0, 5), 7),
        processed=ProcessedReplayBatch(frame, frame, frame, {"batch_size": 1}, raw=frame),
    )
    index = ReplayRuntimeIndex(tmp_path)
    events, cursor = index.events("runtime-index", machine_id=50)
    assert events[0]["event_uid"] == "HISTORICAL_REPLAY:runtime-index:7"
    assert cursor == 1
    assert index.status("runtime-index")["sqlWrites"] == 0


def test_replay_runtime_initial_snapshot_uses_latest_committed_batch_and_serializes_nan(tmp_path) -> None:
    config = ReplayConfig(replay_start_time=datetime(2025, 1, 1), output_root=str(tmp_path))
    store = ReplayEventStore(tmp_path, "runtime-snapshot")
    store.create_or_open(config)
    for sequence, event_id in ((1, 7), (2, 8)):
        frame = pd.DataFrame({
            "event_id": [event_id], "machine_id": [50], "event_uid": [f"HISTORICAL_REPLAY:runtime-snapshot:{event_id}"],
            "source_event_start_time": pd.to_datetime([f"2025-01-01T00:0{sequence}:00"]),
            "operational_overall_risk_score": [float("nan")],
            "l1_score_available_flag": [1], "policy_ready_flag": [1],
        })
        store.commit_batch(
            batch_sequence=sequence,
            virtual_time=datetime(2025, 1, 1, 0, sequence),
            watermark=ReplayWatermark(datetime(2025, 1, 1, 0, sequence), event_id),
            source_watermark=ReplayWatermark(datetime(2025, 1, 1, 0, sequence), event_id),
            processed=ProcessedReplayBatch(frame, frame, frame, {"batch_size": 1}, raw=frame),
        )
    events, cursor = ReplayRuntimeIndex(tmp_path).events("runtime-snapshot", limit=1, initial_snapshot=True)
    assert cursor == 2
    assert events[0]["event_id"] == 8
    assert events[0]["operational_overall_risk_score"] is None
