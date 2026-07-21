from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any


class TTLCache:
    """Small process-local cache for read-only dashboard aggregates."""

    def __init__(self, max_entries: int = 512) -> None:
        self.max_entries = max_entries
        self._items: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get_or_set(self, key: str, ttl_seconds: int, loader: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            cached = self._items.get(key)
            if cached is not None and cached[0] > now:
                return cached[1]
        value = loader()  # Errors are never cached.
        with self._lock:
            if len(self._items) >= self.max_entries:
                oldest = min(self._items, key=lambda item: self._items[item][0])
                self._items.pop(oldest, None)
            self._items[key] = (now + max(1, ttl_seconds), value)
        return value

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


api_cache = TTLCache()


def cache_key(namespace: str, repository_mode: str, *parts: object) -> str:
    return "|".join([namespace, repository_mode, *(repr(part) for part in parts)])

