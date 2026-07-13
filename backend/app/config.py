from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "Weldcom OBAD API"
    api_prefix: str = "/api"
    realtime_config_path: Path = Path("inference/online/config.local.yaml")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("OBAD_API_NAME", "Weldcom OBAD API"),
        api_prefix=os.getenv("OBAD_API_PREFIX", "/api"),
        realtime_config_path=Path(os.getenv("OBAD_REALTIME_CONFIG", "inference/online/config.local.yaml")),
    )
