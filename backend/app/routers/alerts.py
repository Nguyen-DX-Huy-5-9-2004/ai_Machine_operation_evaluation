from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/health")
def alerts_health() -> dict[str, str]:
    return {"status": "ready"}
