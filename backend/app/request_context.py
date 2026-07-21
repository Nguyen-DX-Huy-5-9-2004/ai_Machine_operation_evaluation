from __future__ import annotations

from contextvars import ContextVar


request_id_context: ContextVar[str | None] = ContextVar("obad_request_id", default=None)

