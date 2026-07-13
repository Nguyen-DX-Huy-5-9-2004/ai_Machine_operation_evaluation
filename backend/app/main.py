from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.routers import alerts, dashboard, inference, machines


settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(machines.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(inference.router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
