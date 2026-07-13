from __future__ import annotations

from fastapi import APIRouter, Query

from backend.app.services.inference_service import run_stage_only


router = APIRouter(prefix="/inference", tags=["inference"])


@router.get("/stage")
def stage_realtime_features(max_events: int = Query(default=100, ge=1, le=5000)) -> dict[str, object]:
    return run_stage_only(max_events=max_events)
