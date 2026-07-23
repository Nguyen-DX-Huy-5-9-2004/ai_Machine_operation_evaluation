from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.config import get_settings
from backend.app.request_context import request_id_context
from backend.app.routers import alerts, dashboard, demo, events, health, inference, machines, meta, model_monitor, replay


logger = logging.getLogger("obad.api")
settings = get_settings()
app = FastAPI(title=settings.app_name, version="2.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.request_id = request_id
    token = request_id_context.set(request_id)
    started = time.perf_counter()
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "request_id=%s route=%s duration_ms=%s status=%s data_mode=%s",
            request_id,
            request.url.path,
            duration_ms,
            response.status_code,
            settings.backend_data_mode,
        )
        return response
    finally:
        request_id_context.reset(token)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return _error(request, 422, "INVALID_REQUEST", "Request parameters are invalid.", {"errors": exc.errors()})


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
    return _error(request, exc.status_code, code, str(exc.detail), {})


@app.exception_handler(ValueError)
async def value_error(request: Request, exc: ValueError):
    return _error(request, 400, "INVALID_REQUEST", str(exc), {})


@app.exception_handler(Exception)
async def internal_error(request: Request, exc: Exception):
    logger.exception("Unhandled API error request_id=%s", getattr(request.state, "request_id", None))
    return _error(request, 503, "SERVICE_UNAVAILABLE", "The requested data source is unavailable.", {"errorType": type(exc).__name__})


def _error(request: Request, status: int, code: str, message: str, details: dict[str, object]) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
                "requestId": getattr(request.state, "request_id", None),
            }
        },
    )


for router in (health.router, meta.router, dashboard.router, machines.router, alerts.router, events.router, model_monitor.router, inference.router, replay.router, demo.router):
    app.include_router(router, prefix=settings.api_prefix)


@app.get("/health", include_in_schema=False)
def legacy_health() -> dict[str, str]:
    return {"status": "LIVE"}
