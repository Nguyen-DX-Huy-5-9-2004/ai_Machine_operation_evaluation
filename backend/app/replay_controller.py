from __future__ import annotations

"""In-process controls for the explicitly file-only historical replay.

The controller deliberately has no SQL writer dependency.  A request can cause
read-only source queries and local parquet/JSONL writes, never database writes.
"""

from dataclasses import dataclass, replace
from datetime import datetime
from pathlib import Path
import threading
import logging
from typing import Any

from inference.online.artifacts import load_config, resolve_obad_root
from inference.replay.engine import HistoricalReplayEngine, apply_preset, artifact_fingerprint
from inference.replay.processor import TwoLayerReplayProcessor
from inference.replay.source import SqlReplaySource
from inference.replay.types import ReplayConfig


logger = logging.getLogger(__name__)


@dataclass
class ReplayHandle:
    engine: HistoricalReplayEngine
    config_path: Path
    lock: threading.Lock
    stop_event: threading.Event
    worker: threading.Thread | None = None


class ReplayController:
    def __init__(self) -> None:
        self._handles: dict[str, ReplayHandle] = {}

    def start(
        self,
        *,
        config_path: str | Path,
        preset: str,
        replay_start_time: datetime,
        replay_end_time: datetime | None = None,
        run_id: str | None = None,
        auto_run: bool = True,
        warm_start: bool = True,
    ) -> dict[str, Any]:
        cfg = load_config(config_path)
        replay = ReplayConfig.from_mapping(cfg)
        replay = ReplayConfig(**{**replay.as_dict(), "replay_start_time": replay_start_time, "replay_end_time": replay_end_time})
        replay = apply_preset(replay, preset)
        # Fail closed before constructing the SQL reader/model processor.
        replay.validate_file_only()
        runtime = cfg.get("runtime", {})
        if any(bool(runtime.get(key, False)) for key in ("enable_sql_write", "enable_local_canary_sql_write", "enable_replay_sql_batch_flush")):
            raise PermissionError("REPLAY_SQL_WRITE_NOT_APPROVED: replay controls require every SQL write flag to be false")
        engine = HistoricalReplayEngine(
            config=replay,
            source=SqlReplaySource(cfg, replay),
            processor=TwoLayerReplayProcessor(cfg, resolve_obad_root(cfg)),
            run_id=run_id,
        )
        artifact_paths = [Path(config_path)]
        for key in ("l1_artifact_dir", "l2_artifact_dir", "l2_production_selection", "l2_feature_policy"):
            value = cfg.get("artifacts", {}).get(key)
            if value:
                candidate = Path(value)
                artifact_paths.append(candidate if candidate.is_absolute() else resolve_obad_root(cfg) / candidate)
        engine.open(artifact_fingerprint=artifact_fingerprint(artifact_paths))
        handle = ReplayHandle(engine=engine, config_path=Path(config_path), lock=threading.Lock(), stop_event=threading.Event())
        self._handles[engine.run_id] = handle
        # Commit the first bounded batch before returning control to the UI.
        # This makes the initial snapshot available at page load; subsequent
        # batches remain asynchronous and file-only.
        warm_start_result: dict[str, Any] | None = None
        if warm_start and not engine.store.checkpoint().get("batch_sequence"):
            try:
                warm_start_result = engine.tick()
                _log_batch_progress(engine.run_id, warm_start_result, phase="WARM_START")
                _record_batch_activity(engine, warm_start_result, phase="WARM_START")
            except Exception as exc:
                engine.store.append_error({"kind": "REPLAY_WARM_START_FAILURE", "error_type": type(exc).__name__, "message": str(exc)})
                self._handles.pop(engine.run_id, None)
                raise
        if auto_run:
            handle.worker = threading.Thread(target=self._run_loop, args=(handle,), name=f"replay-{engine.run_id}", daemon=True)
            handle.worker.start()
        return engine.status(started=True, warm_start=warm_start_result, sql_writes=0)

    def pause(self, run_id: str) -> dict[str, Any]:
        handle = self._handle(run_id)
        with handle.lock:
            return handle.engine.pause()

    def resume(self, run_id: str) -> dict[str, Any]:
        handle = self._handle(run_id)
        with handle.lock:
            return handle.engine.resume()

    def step(self, run_id: str, *, ticks: int = 1) -> dict[str, Any]:
        if ticks < 1 or ticks > 20:
            raise ValueError("ticks must be between 1 and 20")
        handle = self._handle(run_id)
        with handle.lock:
            return handle.engine.run_ticks(ticks)

    def seek(self, run_id: str, target: datetime) -> dict[str, Any]:
        handle = self._handle(run_id)
        with handle.lock:
            return handle.engine.seek(target)

    def set_speed(self, run_id: str, *, speed_multiplier: float, real_tick_seconds: float | None = None) -> dict[str, Any]:
        if speed_multiplier <= 0 or speed_multiplier > 120:
            raise ValueError("speed_multiplier must be in (0, 120]")
        handle = self._handle(run_id)
        with handle.lock:
            next_config = replace(
                handle.engine.config,
                speed_multiplier=speed_multiplier,
                real_tick_seconds=real_tick_seconds if real_tick_seconds is not None else handle.engine.config.real_tick_seconds,
            )
            handle.engine.config = next_config
            handle.engine.clock.config = next_config
            return handle.engine.status(speed_multiplier=next_config.speed_multiplier, real_tick_seconds=next_config.real_tick_seconds)

    def status(self, run_id: str) -> dict[str, Any] | None:
        handle = self._handles.get(run_id)
        if handle is None:
            return None
        with handle.lock:
            return {**handle.engine.status(), "worker_alive": bool(handle.worker and handle.worker.is_alive())}

    @staticmethod
    def _run_loop(handle: ReplayHandle) -> None:
        """File-only background loop. Errors are persisted locally and stop safely."""
        while not handle.stop_event.is_set():
            with handle.lock:
                if handle.engine.clock.paused:
                    interval = 0.2
                else:
                    try:
                        result = handle.engine.tick()
                        if not result.get("empty_tick"):
                            _log_batch_progress(handle.engine.run_id, result, phase="LIVE")
                            _record_batch_activity(handle.engine, result, phase="LIVE")
                        interval = max(0.05, handle.engine.config.real_tick_seconds)
                        if result.get("empty_tick") and handle.engine.config.replay_end_time and handle.engine.clock.virtual_time >= handle.engine.config.replay_end_time:
                            handle.engine.pause()
                    except Exception as exc:
                        handle.engine.store.append_error({"kind": "REPLAY_WORKER_FAILURE", "error_type": type(exc).__name__, "message": str(exc)})
                        handle.engine.pause()
                        interval = 1.0
            handle.stop_event.wait(interval)

    def _handle(self, run_id: str) -> ReplayHandle:
        try:
            return self._handles[run_id]
        except KeyError as exc:
            raise KeyError("Replay run is not controlled by this API process. Start it first.") from exc


replay_controller = ReplayController()


def _log_batch_progress(run_id: str, result: dict[str, Any], *, phase: str) -> None:
    metrics = result.get("batch_metrics", {})
    logger.info(
        "REPLAY_%s run=%s batch=%s candidates=%s processed=%s l1_ready=%s l1_unready=%s l2_ready=%s policy_ready=%s canonical_ms=%s l1_ms=%s l2_policy_ms=%s total_ms=%s sql_writes=0",
        phase,
        run_id,
        result.get("batch_sequence"),
        metrics.get("batch_size", 0),
        result.get("processed_count", 0),
        result.get("l1_ready_count", 0),
        result.get("l1_unready_count", 0),
        result.get("l2_ready_count", 0),
        result.get("policy_ready_count", 0),
        metrics.get("canonical_feature_latency_ms", "n/a"),
        metrics.get("l1_latency_ms", "n/a"),
        metrics.get("l2_policy_latency_ms", "n/a"),
        metrics.get("total_processing_latency_ms", "n/a"),
    )
    sample = metrics.get("progress_sample")
    if sample:
        logger.info("REPLAY_%s_SAMPLE run=%s data=%s", phase, run_id, sample)


def _record_batch_activity(engine: HistoricalReplayEngine, result: dict[str, Any], *, phase: str) -> None:
    metrics = result.get("batch_metrics", {})
    engine.store.append_activity({
        "phase": phase,
        "replay_run_id": engine.run_id,
        "batch_sequence": result.get("batch_sequence"),
        "virtual_time": result.get("virtual_time"),
        "batch_size": metrics.get("batch_size", 0),
        "l1_ready_count": result.get("l1_ready_count", 0),
        "l1_unready_count": result.get("l1_unready_count", 0),
        "l2_ready_count": result.get("l2_ready_count", 0),
        "policy_ready_count": result.get("policy_ready_count", 0),
        "latency_ms": {
            "canonical": metrics.get("canonical_feature_latency_ms"),
            "l1": metrics.get("l1_latency_ms"),
            "l2_policy": metrics.get("l2_policy_latency_ms"),
            "total": metrics.get("total_processing_latency_ms"),
        },
        "sample": metrics.get("progress_sample"),
        "sql_writes": 0,
    })
