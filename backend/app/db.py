from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any

from inference.online.artifacts import load_config
from inference.online.db import connect

from .config import Settings, get_settings


@contextmanager
def get_connection(settings: Settings | None = None) -> Iterator[Any]:
    settings = settings or get_settings()
    if settings.backend_data_mode != "sql":
        raise RuntimeError(f"SQL connection requested while BACKEND_DATA_MODE={settings.backend_data_mode}")
    cfg = load_config(settings.api_sql_config_path)
    database = dict(cfg["database"])
    database["read_only"] = True
    with connect(database) as conn:
        yield conn


def fetch_all(conn: Any, sql: str, params: Sequence[Any] = (), *, timeout_seconds: int | None = 30) -> list[dict[str, Any]]:
    """Execute a parameterized read with a pyodbc connection query timeout.

    ``pyodbc.connect(..., timeout=...)`` configures connection/login setup;
    ``conn.timeout`` must be set before ``conn.cursor()`` to configure query
    timeout for subsequently-created cursors. pyodbc cursors do not expose a
    writable ``timeout`` attribute.
    """
    timeout = max(0, int(timeout_seconds or 0))
    if timeout > 0:
        conn.timeout = timeout
    cursor = conn.cursor()
    try:
        cursor.execute(sql, list(params))
        columns = [description[0] for description in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
    finally:
        cursor.close()


def fetch_one(conn: Any, sql: str, params: Sequence[Any] = (), *, timeout_seconds: int = 30) -> dict[str, Any] | None:
    rows = fetch_all(conn, sql, params, timeout_seconds=timeout_seconds)
    return rows[0] if rows else None
