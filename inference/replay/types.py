from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any, Mapping

import pandas as pd


REPLAY_PIPELINE_NAME = "weldcom_l2_historical_replay_v1"
REPLAY_EVENT_SOURCE = "HISTORICAL_REPLAY"


@dataclass(frozen=True, order=True)
class ReplayWatermark:
    event_start_time: datetime
    event_id: int

    @classmethod
    def from_value(cls, value: Mapping[str, Any] | None) -> "ReplayWatermark | None":
        if not value or not value.get("last_event_start_time"):
            return None
        return cls(pd.Timestamp(value["last_event_start_time"]).to_pydatetime(), int(value["last_event_id"]))

    def as_dict(self) -> dict[str, Any]:
        return {"last_event_start_time": self.event_start_time.isoformat(), "last_event_id": self.event_id}


@dataclass(frozen=True)
class ReplayConfig:
    replay_mode: str = "file_only"
    pipeline_name: str = REPLAY_PIPELINE_NAME
    source_poll_interval_minutes: int = 5
    real_tick_seconds: float = 1.0
    speed_multiplier: float = 1.0
    replay_start_time: datetime | None = None
    replay_end_time: datetime | None = None
    max_events_per_tick: int = 500
    context_events_per_machine: int = 48
    output_root: str = "data/replay_runtime"

    @classmethod
    def from_mapping(cls, cfg: Mapping[str, Any]) -> "ReplayConfig":
        runtime = cfg.get("runtime", {})
        start = runtime.get("replay_start_time")
        end = runtime.get("replay_end_time")
        return cls(
            replay_mode=str(runtime.get("replay_mode", "file_only")),
            pipeline_name=str(runtime.get("replay_pipeline_name", REPLAY_PIPELINE_NAME)),
            source_poll_interval_minutes=int(runtime.get("source_poll_interval_minutes", 5)),
            real_tick_seconds=float(runtime.get("real_tick_seconds", 1.0)),
            speed_multiplier=float(runtime.get("speed_multiplier", 1.0)),
            replay_start_time=pd.Timestamp(start).to_pydatetime() if start else None,
            replay_end_time=pd.Timestamp(end).to_pydatetime() if end else None,
            max_events_per_tick=int(runtime.get("max_events_per_tick", 500)),
            context_events_per_machine=int(runtime.get("context_events_per_machine", 48)),
            output_root=str(cfg.get("replay", {}).get("output_root", "data/replay_runtime")),
        )

    def validate_file_only(self) -> None:
        if self.replay_mode != "file_only":
            raise PermissionError("REPLAY_SQL_WRITE_NOT_APPROVED: only replay_mode=file_only is enabled")
        if self.source_poll_interval_minutes != 5:
            raise ValueError("Replay source_poll_interval_minutes must remain 5")
        if self.max_events_per_tick < 1:
            raise ValueError("max_events_per_tick must be positive")

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def virtual_step(self) -> timedelta:
        return timedelta(minutes=self.source_poll_interval_minutes * self.speed_multiplier)


@dataclass(frozen=True)
class ReplayBatch:
    candidates: pd.DataFrame
    context: pd.DataFrame
    location_map: pd.DataFrame
    machine_group_map: pd.DataFrame
    status_map: pd.DataFrame
    watermark_after: ReplayWatermark | None
    source_metrics: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProcessedReplayBatch:
    canonical: pd.DataFrame
    l1: pd.DataFrame
    output: pd.DataFrame
    metrics: dict[str, Any]
    raw: pd.DataFrame | None = None
