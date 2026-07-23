from __future__ import annotations

from datetime import datetime

import pandas as pd
import pytest

from inference.replay.clock import ReplayClock
from inference.replay.clock import PRESETS
from inference.replay.engine import HistoricalReplayEngine
from inference.replay.store import ReplayEventStore
from inference.replay.parity import build_parity_report, write_parity_report
from inference.replay.preflight import assert_file_only
from inference.replay.types import ProcessedReplayBatch, ReplayBatch, ReplayConfig, ReplayWatermark
from inference.replay.preflight import _sum_action_level, _sum_flag
from inference.replay.processor import _progress_sample


class _Source:
    def __init__(self, events: pd.DataFrame, batch_size: int = 2) -> None:
        self.events = events.sort_values(["event_start_time", "event_id"]).reset_index(drop=True)
        self.batch_size = batch_size

    def fetch(self, watermark, virtual_time):
        frame = self.events[self.events["event_start_time"].le(pd.Timestamp(virtual_time))]
        if watermark:
            frame = frame[(frame["event_start_time"] > pd.Timestamp(watermark.event_start_time)) | ((frame["event_start_time"] == pd.Timestamp(watermark.event_start_time)) & (frame["event_id"] > watermark.event_id))]
        frame = frame.head(self.batch_size).copy()
        if frame.empty:
            return ReplayBatch(frame, frame, pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), watermark)
        last = frame.iloc[-1]
        return ReplayBatch(frame, frame, pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), ReplayWatermark(last.event_start_time.to_pydatetime(), int(last.event_id)))


class _Processor:
    def process(self, batch, *, replay_run_id, batch_sequence, virtual_time):
        out = batch.candidates.copy().rename(columns={"event_start_time": "source_event_start_time"})
        out["event_uid"] = [f"HISTORICAL_REPLAY:{replay_run_id}:{event_id}" for event_id in out.event_id]
        out["l1_score_available_flag"] = 1
        out["policy_ready_flag"] = 1
        return ProcessedReplayBatch(out, out, out, {"batch_size": len(out), "policy_ready_count": len(out)})


def _config(tmp_path) -> ReplayConfig:
    return ReplayConfig(replay_start_time=datetime(2025, 1, 1), output_root=str(tmp_path), max_events_per_tick=2)


def _events() -> pd.DataFrame:
    return pd.DataFrame({
        "event_id": [2, 1, 3, 4],
        "machine_id": [11, 11, 12, 12],
        "event_start_time": pd.to_datetime(["2025-01-01 00:05", "2025-01-01 00:05", "2025-01-01 00:10", "2025-01-01 00:15"]),
    })


def test_watermark_orders_same_timestamp_by_event_id(tmp_path) -> None:
    engine = HistoricalReplayEngine(config=_config(tmp_path), source=_Source(_events()), processor=_Processor(), run_id="ordering")
    engine.open(); engine.tick(); engine.tick(); engine.tick()
    events = engine.store.events(limit=10)
    assert events.event_id.tolist() == [1, 2, 3, 4]
    assert events.event_uid.nunique() == 4


def test_resume_uses_checkpoint_without_duplicate_events(tmp_path) -> None:
    config = _config(tmp_path)
    first = HistoricalReplayEngine(config=config, source=_Source(_events()), processor=_Processor(), run_id="resume")
    first.open(); first.tick(); first.tick()
    resumed = HistoricalReplayEngine(config=config, source=_Source(_events()), processor=_Processor(), run_id="resume")
    resumed.open(); resumed.tick(); resumed.tick()
    events = resumed.store.events(limit=10)
    assert events.event_id.tolist() == [1, 2, 3, 4]
    assert resumed.store.checkpoint()["last_event_id"] == 4


def test_file_only_rejects_all_sql_modes() -> None:
    with pytest.raises(PermissionError, match="REPLAY_SQL_WRITE_NOT_APPROVED"):
        ReplayConfig(replay_mode="hybrid_batch_flush").validate_file_only()


def test_preflight_rejects_any_replay_sql_write_flag() -> None:
    with pytest.raises(PermissionError, match="REPLAY_SQL_WRITE_NOT_APPROVED"):
        assert_file_only({"runtime": {"replay_mode": "file_only", "enable_sql_write": True, "enable_local_canary_sql_write": False, "enable_replay_sql_batch_flush": False}})


def test_pause_resume_step_and_seek() -> None:
    config = ReplayConfig(replay_start_time=datetime(2025, 1, 1))
    clock = ReplayClock(config, datetime(2025, 1, 1))
    clock.pause(); assert clock.advance() == datetime(2025, 1, 1)
    assert clock.step().minute == 5
    clock.resume(); assert clock.advance().minute == 10
    assert clock.seek(datetime(2025, 1, 1, 0, 5)).minute == 5


def test_demo_tomorrow_uses_five_seconds_per_five_source_minutes() -> None:
    assert PRESETS["demo_tomorrow"] == {"real_tick_seconds": 5.0, "speed_multiplier": 1.0}


def test_replay_store_records_file_only_activity(tmp_path) -> None:
    store = ReplayEventStore(tmp_path, "activity")
    store.create_or_open(_config(tmp_path))
    store.append_activity({"phase": "LIVE", "sql_writes": 0, "sample": {"event_id": 7}})
    activity = (store.root / "activity.jsonl").read_text(encoding="utf-8")
    assert '"phase": "LIVE"' in activity
    assert '"sql_writes": 0' in activity


def test_progress_sample_handles_unready_rows_without_non_json_na_values() -> None:
    sample = _progress_sample(pd.DataFrame([{
        "event_id": 7, "machine_id": 50, "l1_score_available_flag": 0,
        "policy_ready_flag": 0, "score_lenient_normalized": pd.NA,
    }]))
    assert sample is not None
    assert sample["l1"]["lenient_normalized"] is None


def test_atomic_store_recovers_committed_frontend_batch(tmp_path) -> None:
    store = ReplayEventStore(tmp_path, "recovery")
    config = _config(tmp_path); store.create_or_open(config)
    frame = pd.DataFrame({"event_uid": ["HISTORICAL_REPLAY:recovery:1"], "event_id": [1], "source_event_start_time": pd.to_datetime(["2025-01-01"])})
    from inference.replay.store import atomic_parquet
    atomic_parquet(store.root / "frontend_batches" / "batch_000001.parquet", frame)
    reopened = ReplayEventStore(tmp_path, "recovery"); manifest = reopened.create_or_open(config)
    assert manifest["batches"][0]["recovered"] is True
    assert reopened.checkpoint()["last_event_id"] == 1
    assert reopened.checkpoint()["batch_sequence"] == 1


def test_store_recovers_when_manifest_precedes_checkpoint(tmp_path) -> None:
    config = _config(tmp_path)
    initial = HistoricalReplayEngine(config=config, source=_Source(_events()), processor=_Processor(), run_id="manifest-first")
    initial.open(); initial.tick()
    initial.store.checkpoint_path.unlink()
    resumed = HistoricalReplayEngine(config=config, source=_Source(_events()), processor=_Processor(), run_id="manifest-first")
    resumed.open()
    assert resumed.store.checkpoint()["last_event_id"] == 2
    resumed.tick(); resumed.tick()
    assert resumed.store.events(limit=10).event_id.tolist() == [1, 2, 3, 4]


def test_parity_reports_float_tolerance_without_hiding_unexpected_mismatch() -> None:
    replay = pd.DataFrame({"event_id": [1, 2], "machine_id": [11, 12], "risk_fault_30min": [0.4, 0.2]})
    historical = pd.DataFrame({"event_id": [1, 2], "machine_id": [11, 99], "risk_fault_30min": [0.4000001, 0.5]})
    summary, mismatches = build_parity_report(replay, historical, tolerance=1e-4)
    assert summary["float_tolerance_match_count"] >= 1
    assert summary["unexpected_mismatch_count"] >= 1
    assert "machine_id" in mismatches["field"].tolist()


def test_parity_writer_emits_empty_report_files(tmp_path) -> None:
    summary, mismatches = build_parity_report(pd.DataFrame({"event_id": [1]}), pd.DataFrame({"event_id": [1]}))
    write_parity_report(tmp_path, summary, mismatches)
    assert (tmp_path / "parity_report.json").exists()
    assert (tmp_path / "parity_mismatches.parquet").exists()


def test_file_only_replay_processes_5000_events_in_bounded_batches(tmp_path) -> None:
    events = pd.DataFrame({
        "event_id": range(1, 5001),
        "machine_id": [11] * 5000,
        "event_start_time": pd.to_datetime(["2025-01-01 00:05"] * 5000),
    })
    config = ReplayConfig(replay_start_time=datetime(2025, 1, 1), output_root=str(tmp_path), max_events_per_tick=500)
    engine = HistoricalReplayEngine(config=config, source=_Source(events, batch_size=500), processor=_Processor(), run_id="five-thousand")
    engine.open(); engine.run_ticks(10)
    persisted = engine.store.events(limit=6000)
    assert len(persisted) == 5000
    assert persisted.event_uid.nunique() == 5000
    assert engine.store.checkpoint()["processed_count"] == 5000


def test_sql_source_applies_replay_start_bound_before_first_watermark(monkeypatch) -> None:
    """The first tick must never scan history before the selected demo range."""
    from inference.replay import source as replay_source

    class _Connection:
        def __enter__(self): return self
        def __exit__(self, *_): return False

    calls: list[tuple[str, list[object]]] = []
    candidate = pd.DataFrame({
        "event_id": [1], "machine_id": [50], "status_id": [1],
        "event_start_time": pd.to_datetime(["2025-10-24T09:01:00"]),
        "raw_event_end_time": pd.to_datetime(["2025-10-24T09:02:00"]),
        "raw_status_kwh_start": [1.0], "raw_status_kwh_end": [2.0], "raw_error_code": [None],
    })

    def fake_read_sql(_conn, sql, params):
        calls.append((sql, list(params)))
        return candidate.copy()

    cfg = {
        "database": {},
        "tables": {"raw_iot": "dbo.vw_ai_runtime_raw_iot_typed_local"},
        "source_columns": {
            "event_id": "id", "machine_id": "machine_id", "status_id": "status_id",
            "event_start_time": "status_time_start", "raw_event_end_time": "status_time_end",
            "raw_kwh_start": "status_kwh_start", "raw_kwh_end": "status_kwh_end", "raw_error_code": "error_code",
        },
    }
    replay = ReplayConfig(replay_start_time=datetime(2025, 10, 24, 9), replay_end_time=datetime(2025, 10, 24, 13))
    monkeypatch.setattr(replay_source, "connect", lambda _cfg: _Connection())
    monkeypatch.setattr(replay_source, "read_sql", fake_read_sql)
    monkeypatch.setattr(replay_source, "load_location_map", lambda *_: (pd.DataFrame(), None))
    monkeypatch.setattr(replay_source, "load_machine_group_map", lambda *_: (pd.DataFrame(), None))
    monkeypatch.setattr(replay_source, "load_status_map", lambda *_: (pd.DataFrame(), None))
    replay_source.SqlReplaySource(cfg, replay).fetch(None, datetime(2025, 10, 24, 9, 5))
    candidate_sql, candidate_params = calls[0]
    assert "[status_time_start] >= ?" in candidate_sql
    # Keep the parameter list aligned with the bounded first-tick query.  A
    # duplicate upper-bound predicate here previously made warm-start fail
    # before any AI processing could begin.
    assert candidate_sql.count("?") == len(candidate_params)
    assert candidate_params[1] == datetime(2025, 10, 24, 9)
    assert candidate_params[-1] == datetime(2025, 10, 24, 9, 5)


def test_demo_profile_counts_flags_and_action_levels_not_positive_scores() -> None:
    columns = {"behavior_anomaly_score", "risk_fault_30min", "operational_action_level"}
    assert _sum_flag(columns, "is_behavior_anomaly") == "CAST(0 AS BIGINT)"
    assert "operational_action_level" in _sum_action_level(columns)
