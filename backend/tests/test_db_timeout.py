from __future__ import annotations

import pytest

from backend.app.db import fetch_all, fetch_one


class SlotCursor:
    """No __dict__: assigning cursor.timeout fails like the pyodbc cursor."""

    __slots__ = ("connection", "description", "closed", "executed")

    def __init__(self, connection: "SlotConnection") -> None:
        self.connection = connection
        self.description = [("id",), ("name",)]
        self.closed = False
        self.executed: tuple[str, list[object]] | None = None

    def execute(self, sql: str, params: list[object]) -> None:
        assert self.connection.timeout == self.connection.expected_timeout
        self.executed = (sql, params)
        if self.connection.raise_error:
            raise RuntimeError("database failed")

    def fetchall(self) -> list[tuple[object, object]]:
        return [(1, "one"), (2, "two")]

    def close(self) -> None:
        self.closed = True


class SlotConnection:
    __slots__ = ("timeout", "expected_timeout", "cursor_instance", "raise_error")

    def __init__(self, expected_timeout: int | None, *, raise_error: bool = False) -> None:
        self.timeout: int | None = None
        self.expected_timeout = expected_timeout
        self.cursor_instance: SlotCursor | None = None
        self.raise_error = raise_error

    def cursor(self) -> SlotCursor:
        assert self.timeout == self.expected_timeout
        self.cursor_instance = SlotCursor(self)
        return self.cursor_instance


def test_fetch_all_sets_connection_timeout_before_cursor_and_preserves_parameters() -> None:
    conn = SlotConnection(17)
    result = fetch_all(conn, "SELECT * FROM t WHERE id=?", [42], timeout_seconds=17)
    assert result == [{"id": 1, "name": "one"}, {"id": 2, "name": "two"}]
    assert conn.cursor_instance is not None
    assert conn.cursor_instance.executed == ("SELECT * FROM t WHERE id=?", [42])
    assert conn.cursor_instance.closed


@pytest.mark.parametrize("timeout", [None, 0])
def test_fetch_all_keeps_driver_default_for_none_or_zero(timeout: int | None) -> None:
    conn = SlotConnection(None)
    assert fetch_one(conn, "SELECT 1", timeout_seconds=timeout) == {"id": 1, "name": "one"}
    assert conn.cursor_instance is not None and conn.cursor_instance.closed


def test_fetch_all_propagates_database_error_and_closes_cursor() -> None:
    conn = SlotConnection(5, raise_error=True)
    with pytest.raises(RuntimeError, match="database failed"):
        fetch_all(conn, "SELECT broken", timeout_seconds=5)
    assert conn.cursor_instance is not None and conn.cursor_instance.closed
