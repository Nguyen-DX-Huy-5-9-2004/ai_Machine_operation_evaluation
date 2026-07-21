from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from backend.app.dependencies import RepositoryDep
from backend.app.services.api_service import envelope
from inference.online.explainability import build_explanation
from inference.online.runtime_contract import DatasetMode, EventSource
from backend.app.repositories.dashboard import QueryFilters


router = APIRouter(prefix="/events", tags=["events"])


@router.get("/{event_uid}/explanation")
def explanation(event_uid: str, repository: RepositoryDep):
    row = repository.event_by_uid(event_uid)
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    stored = row.get("explanation_json") or row.get("explanationJson")
    if stored:
        try:
            data = json.loads(stored)
        except (TypeError, json.JSONDecodeError):
            data = {"availability": False, "reason": "INVALID_STORED_EXPLANATION"}
    else:
        historical = event_uid.startswith(EventSource.HISTORICAL.value + ":")
        data = build_explanation(row, {}, historical=historical)
        if historical:
            data["availability"] = False
            data["reason"] = "NOT_AVAILABLE_IN_HISTORICAL_EXPORT"
    mode = DatasetMode.HISTORICAL if event_uid.startswith(EventSource.HISTORICAL.value + ":") else DatasetMode.CURRENT
    return envelope(data, QueryFilters(dataset_mode=mode), repository)
