from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterable, Iterator, Mapping, Sequence

import pandas as pd


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def build_connection_string(cfg: Mapping[str, Any]) -> str:
    """Build a SQL Server ODBC connection string from config values."""
    driver = cfg.get("driver", "ODBC Driver 18 for SQL Server")
    server = cfg.get("server")
    database = cfg.get("database")
    if not server or not database:
        raise ValueError("database.server and database.database must be configured")

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
        f"TrustServerCertificate={'yes' if _bool(cfg.get('trust_server_certificate', True)) else 'no'}",
        f"Encrypt={'yes' if _bool(cfg.get('encrypt', True)) else 'no'}",
    ]

    if _bool(cfg.get("read_only", False)):
        parts.append("ApplicationIntent=ReadOnly")

    if _bool(cfg.get("trusted_connection", False)):
        parts.append("Trusted_Connection=yes")
    else:
        username = cfg.get("username")
        password = cfg.get("password")
        if not username or password is None:
            raise ValueError("database.username and database.password must be configured")
        parts.extend([f"UID={username}", f"PWD={password}"])

    timeout = cfg.get("timeout_seconds")
    if timeout:
        parts.append(f"Connection Timeout={int(timeout)}")

    return ";".join(parts) + ";"


@contextmanager
def connect(database_cfg: Mapping[str, Any]) -> Iterator[Any]:
    import pyodbc

    conn = pyodbc.connect(build_connection_string(database_cfg))
    try:
        yield conn
    finally:
        conn.close()


def read_sql(conn: Any, sql: str, params: Sequence[Any] | None = None) -> pd.DataFrame:
    return pd.read_sql(sql, conn, params=list(params or []))


def execute(
    conn: Any,
    sql: str,
    params: Sequence[Any] | None = None,
    *,
    commit: bool = True,
) -> None:
    cur = conn.cursor()
    cur.execute(sql, list(params or []))
    if commit:
        conn.commit()


def bulk_insert_dataframe(
    conn: Any,
    table: str,
    df: pd.DataFrame,
    *,
    chunksize: int = 1000,
) -> int:
    if df.empty:
        return 0

    cols = list(df.columns)
    placeholders = ",".join("?" for _ in cols)
    col_sql = ",".join(f"[{c}]" for c in cols)
    sql = f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders})"

    rows = [_clean_row(row) for row in df.itertuples(index=False, name=None)]
    cur = conn.cursor()
    cur.fast_executemany = True

    total = 0
    for start in range(0, len(rows), chunksize):
        batch = rows[start : start + chunksize]
        cur.executemany(sql, batch)
        conn.commit()
        total += len(batch)
    return total


def _clean_row(row: Iterable[Any]) -> tuple[Any, ...]:
    clean: list[Any] = []
    for value in row:
        if pd.isna(value):
            clean.append(None)
        elif hasattr(value, "to_pydatetime"):
            clean.append(value.to_pydatetime())
        else:
            clean.append(value)
    return tuple(clean)
