from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from inference.online.artifacts import load_config
from inference.online.db import connect

from .config import get_settings


@contextmanager
def get_connection() -> Iterator[object]:
    cfg = load_config(get_settings().realtime_config_path)
    with connect(cfg["database"]) as conn:
        yield conn
