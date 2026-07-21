from __future__ import annotations

from fastapi import APIRouter

from backend.app.dependencies import RepositoryDep
from backend.app.services.api_service import runtime_static_status


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict[str, object]:
    return {"status": "LIVE", "checks": {"process": "PASS"}}


@router.get("/ready")
def ready(repository: RepositoryDep) -> dict[str, object]:
    static = runtime_static_status()
    try:
        database = repository.health()
    except Exception as exc:
        return {"status": "NOT_READY", "checks": {"database": "FAIL", "reason": type(exc).__name__, "runtime": static}}
    ready_value = bool(database.get("ready")) and bool(static.get("staticGatePass"))
    return {"status": "READY" if ready_value else "NOT_READY", "checks": {"database": database, "runtime": static}}
