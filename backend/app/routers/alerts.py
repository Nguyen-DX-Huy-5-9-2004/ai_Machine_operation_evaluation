from __future__ import annotations

from fastapi import APIRouter


# Kept for import compatibility. The canonical endpoint is /api/dashboard/alerts.
router = APIRouter(tags=["alerts"])
