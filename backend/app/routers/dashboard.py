from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/health")
def dashboard_health() -> dict[str, str]:
    return {"status": "ready"}
