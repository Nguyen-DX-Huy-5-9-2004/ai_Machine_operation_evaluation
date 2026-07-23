from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .types import ReplayConfig


PRESETS = {
    "realtime_1x": {"real_tick_seconds": 300.0, "speed_multiplier": 1.0},
    "demo_fast": {"real_tick_seconds": 1.0, "speed_multiplier": 1.0},
    # Demo contract: each five real seconds releases exactly five source
    # minutes. The source timestamps remain unchanged.
    "demo_tomorrow": {"real_tick_seconds": 5.0, "speed_multiplier": 1.0},
    "demo_very_fast": {"real_tick_seconds": 0.2, "speed_multiplier": 12.0},
    "manual_step": {"real_tick_seconds": 0.0, "speed_multiplier": 1.0},
}


@dataclass
class ReplayClock:
    config: ReplayConfig
    virtual_time: datetime
    paused: bool = False

    def advance(self) -> datetime:
        if not self.paused:
            self.virtual_time = self.virtual_time + self.config.virtual_step
            if self.config.replay_end_time and self.virtual_time > self.config.replay_end_time:
                self.virtual_time = self.config.replay_end_time
        return self.virtual_time

    def step(self) -> datetime:
        previous = self.paused
        self.paused = False
        try:
            return self.advance()
        finally:
            self.paused = previous

    def pause(self) -> None:
        self.paused = True

    def resume(self) -> None:
        self.paused = False

    def seek(self, target: datetime) -> datetime:
        if self.config.replay_start_time and target < self.config.replay_start_time:
            raise ValueError("cannot seek before replay_start_time")
        if self.config.replay_end_time and target > self.config.replay_end_time:
            raise ValueError("cannot seek after replay_end_time")
        self.virtual_time = target
        return self.virtual_time
