from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping, Protocol

from .clock import PRESETS, ReplayClock
from .store import ReplayEventStore
from .types import ProcessedReplayBatch, ReplayConfig, ReplayWatermark


class ReplaySource(Protocol):
    def fetch(self, watermark: ReplayWatermark | None, virtual_time): ...


class ReplayProcessor(Protocol):
    def process(self, batch, *, replay_run_id: str, batch_sequence: int, virtual_time) -> ProcessedReplayBatch: ...


class HistoricalReplayEngine:
    def __init__(self, *, config: ReplayConfig, source: ReplaySource, processor: ReplayProcessor, run_id: str | None = None) -> None:
        config.validate_file_only()
        self.config = config
        self.source = source
        self.processor = processor
        self.run_id = run_id or f"replay_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        self.store = ReplayEventStore(config.output_root, self.run_id)
        start = config.replay_start_time or datetime.now(UTC)
        self.clock = ReplayClock(config, start)
        self._watermark: ReplayWatermark | None = None
        self._sequence = 0

    def open(self, *, artifact_fingerprint: str = "unknown") -> dict[str, Any]:
        manifest = self.store.create_or_open(self.config, artifact_fingerprint=artifact_fingerprint)
        checkpoint = self.store.checkpoint()
        self._watermark = ReplayWatermark.from_value(checkpoint)
        self._sequence = int(checkpoint.get("batch_sequence", 0))
        if checkpoint.get("virtual_time"):
            self.clock.virtual_time = datetime.fromisoformat(checkpoint["virtual_time"])
        return manifest

    def tick(self, *, advance_clock: bool = True) -> dict[str, Any]:
        if advance_clock:
            self.clock.advance()
        started = time.perf_counter()
        source_batch = self.source.fetch(self._watermark, self.clock.virtual_time)
        if source_batch.candidates.empty:
            return self.status(last_tick_ms=round((time.perf_counter() - started) * 1000, 2), empty_tick=True)
        self._sequence += 1
        processed = self.processor.process(
            source_batch,
            replay_run_id=self.run_id,
            batch_sequence=self._sequence,
            virtual_time=self.clock.virtual_time,
        )
        if processed.output.empty:
            raise ValueError("Replay processor returned an empty output for non-empty source candidates")
        if "event_uid" not in processed.output:
            raise ValueError("Replay processor output is missing event_uid")
        if processed.output["event_uid"].duplicated().any():
            raise ValueError("Replay batch contains duplicate event_uid values")
        checkpoint = self.store.commit_batch(
            batch_sequence=self._sequence,
            virtual_time=self.clock.virtual_time,
            watermark=source_batch.watermark_after,
            source_watermark=source_batch.watermark_after,
            processed=processed,
        )
        self._watermark = source_batch.watermark_after
        return {**self.status(last_tick_ms=round((time.perf_counter() - started) * 1000, 2)), "checkpoint": checkpoint, "batch_metrics": processed.metrics}

    def run_ticks(self, count: int) -> dict[str, Any]:
        result: dict[str, Any] = self.status()
        for _ in range(count):
            result = self.tick()
            if result.get("empty_tick") and self.config.replay_end_time and self.clock.virtual_time >= self.config.replay_end_time:
                break
        return result

    def pause(self) -> dict[str, Any]:
        self.clock.pause()
        return self.status()

    def resume(self) -> dict[str, Any]:
        self.clock.resume()
        return self.status()

    def seek(self, target: datetime) -> dict[str, Any]:
        self.clock.seek(target)
        return self.status()

    def status(self, **extra: Any) -> dict[str, Any]:
        checkpoint = self.store.checkpoint()
        return {
            "replay_run_id": self.run_id,
            "mode": self.config.replay_mode,
            "pipeline_name": self.config.pipeline_name,
            "paused": self.clock.paused,
            "virtual_time": self.clock.virtual_time.isoformat(),
            "batch_sequence": self._sequence,
            "watermark": self._watermark.as_dict() if self._watermark else None,
            "processed_count": checkpoint.get("processed_count", 0),
            "l1_ready_count": checkpoint.get("l1_ready_count", 0),
            "l1_unready_count": checkpoint.get("l1_unready_count", 0),
            "l2_ready_count": checkpoint.get("l2_ready_count", 0),
            "l2_unready_count": checkpoint.get("l2_unready_count", 0),
            "policy_ready_count": checkpoint.get("policy_ready_count", 0),
            "sql_writes": 0,
            **extra,
        }


def apply_preset(config: ReplayConfig, name: str) -> ReplayConfig:
    if name not in PRESETS:
        raise ValueError(f"Unknown replay preset: {name}")
    values = {**config.as_dict(), **PRESETS[name]}
    return ReplayConfig(**values)


def artifact_fingerprint(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(str(path).encode("utf-8"))
        if path.is_file():
            stat = path.stat()
            digest.update(f"{stat.st_size}:{stat.st_mtime_ns}".encode("utf-8"))
        elif path.is_dir():
            for child in sorted(item for item in path.rglob("*") if item.is_file()):
                stat = child.stat()
                digest.update(f"{child.relative_to(path)}:{stat.st_size}:{stat.st_mtime_ns}".encode("utf-8"))
    return digest.hexdigest()
