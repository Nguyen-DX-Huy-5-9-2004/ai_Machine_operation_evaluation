from __future__ import annotations

from fastapi import APIRouter

from backend.app.dependencies import RepositoryDep
from backend.app.services.api_service import runtime_static_status


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/runtime-status")
def runtime_status(repository: RepositoryDep) -> dict[str, object]:
    status = runtime_static_status()
    try:
        database = repository.health()
    except Exception as exc:
        database = {"ready": False, "reason": type(exc).__name__}
    status["database"] = database
    status["runtimeStatus"] = "HEALTHY" if status["staticGatePass"] and database.get("ready") else "NOT_READY"
    return status
