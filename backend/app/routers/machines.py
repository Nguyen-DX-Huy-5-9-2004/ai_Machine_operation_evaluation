from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("/health")
def machines_health() -> dict[str, str]:
    return {"status": "ready"}
