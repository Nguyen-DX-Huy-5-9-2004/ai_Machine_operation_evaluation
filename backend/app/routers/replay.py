from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from backend.app.db import fetch_all, get_connection
from backend.app.replay_controller import replay_controller
from backend.app.replay_runtime import ReplayRuntimeIndex


router = APIRouter(prefix="/replay", tags=["historical-replay"])
_index: ReplayRuntimeIndex | None = None
_machine_name_cache: dict[int, str] | None = None


class ReplayStartRequest(BaseModel):
    replayStartTime: datetime
    replayEndTime: datetime | None = None
    preset: Literal["realtime_1x", "demo_fast", "demo_tomorrow", "demo_very_fast", "manual_step"] = "demo_fast"
    runId: str | None = Field(default=None, max_length=100)
    configPath: str = "inference/online/config.replay.local.yaml"
    autoRun: bool = True
    warmStart: bool = True


class ReplayRunRequest(BaseModel):
    replayRunId: str


class ReplayStepRequest(ReplayRunRequest):
    ticks: int = Field(default=1, ge=1, le=20)


class ReplaySeekRequest(ReplayRunRequest):
    virtualTime: datetime


class ReplaySpeedRequest(ReplayRunRequest):
    speedMultiplier: float = Field(ge=0.01, le=120)
    realTickSeconds: float | None = Field(default=None, ge=0.05, le=300)


def replay_index() -> ReplayRuntimeIndex:
    global _index
    root = get_settings().replay_runtime_root
    if _index is None or _index.root != root:
        _index = ReplayRuntimeIndex(root)
    return _index


def _machine_call_names() -> dict[int, str]:
    """Read the small machine dimension once; replay files remain file-first."""
    global _machine_name_cache
    if _machine_name_cache is not None:
        return _machine_name_cache
    try:
        with get_connection(get_settings()) as conn:
            rows = fetch_all(
                conn,
                "SELECT id AS [machineId], machine_call_name AS [machineCallName] "
                "FROM dbo.data_machine WHERE ISNULL(is_deleted, 0) = 0 AND NULLIF(machine_call_name, N'') IS NOT NULL",
                timeout_seconds=get_settings().query_timeout_seconds,
            )
        _machine_name_cache = {int(row["machineId"]): str(row["machineCallName"]) for row in rows}
    except Exception:
        # A replay remains available from its local files if the optional
        # display-name lookup cannot reach SQL. No write path exists here.
        _machine_name_cache = {}
    return _machine_name_cache


def _with_machine_call_names(rows: list[dict]) -> list[dict]:
    names = _machine_call_names()
    return [{**row, "machine_call_name": names.get(int(row.get("machine_id") or 0), f"Machine {row.get('machine_id')}")} for row in rows]


@router.get("/runs")
def runs():
    return {"data": replay_index().runs(), "sqlWrites": 0}


@router.get("/info")
def info():
    """Compatibility marker used by the demo launcher before it reuses a server."""
    # Bump this marker whenever the launcher needs a fresh backend process for
    # a replay-contract change. It is intentionally not tied to any SQL state.
    return {"data": {"replayApiVersion": "4", "rangeBounded": True, "warmStart": True, "sqlWrites": 0}}


@router.get("/status")
def status(replay_run_id: str = Query(...)):
    try:
        controlled = replay_controller.status(replay_run_id)
        # The file index owns the public camelCase API contract.  Controller
        # details only refine volatile in-process state while a worker is live.
        data = replay_index().status(replay_run_id)
        if controlled:
            data.update({
                "replayState": "PAUSED" if controlled.get("paused") else "LIVE",
                "virtualTime": controlled.get("virtual_time", data["virtualTime"]),
                "batchSequence": controlled.get("batch_sequence", data["batchSequence"]),
                "sourceWatermark": controlled.get("watermark", data["sourceWatermark"]),
                "workerAlive": controlled.get("worker_alive", False),
            })
        return {"data": data}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Replay run not found")


@router.get("/events")
def events(
    replay_run_id: str = Query(...), after_sequence: int = 0, machine_id: int | None = None,
    limit: int = Query(200, ge=1, le=1000), initial_snapshot: bool = False,
):
    try:
        data, latest = replay_index().events(
            replay_run_id,
            after_sequence=after_sequence,
            machine_id=machine_id,
            limit=limit,
            initial_snapshot=initial_snapshot,
        )
        return {"data": _with_machine_call_names(data), "cursor": {"afterSequence": latest}, "sqlWrites": 0}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Replay run not found")


@router.get("/machines/{machine_id}/events")
def machine_events(machine_id: int, replay_run_id: str = Query(...), after_sequence: int = 0, limit: int = Query(200, ge=1, le=1000)):
    return events(replay_run_id, after_sequence, machine_id, limit)


@router.get("/stream")
async def stream(replay_run_id: str = Query(...), after_sequence: int = 0, machine_id: int | None = None):
    async def generator():
        cursor = after_sequence
        for _ in range(30):
            payload = events(replay_run_id, cursor, machine_id, 200)
            cursor = payload["cursor"]["afterSequence"]
            yield f"event: replay-delta\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
            await asyncio.sleep(1)
    return StreamingResponse(generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/start")
def start(request: ReplayStartRequest):
    try:
        return {"data": replay_controller.start(
            config_path=request.configPath,
            preset=request.preset,
            replay_start_time=request.replayStartTime,
            replay_end_time=request.replayEndTime,
            run_id=request.runId,
            auto_run=request.autoRun,
            warm_start=request.warmStart,
        ), "sqlWrites": 0}
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/pause")
def pause(request: ReplayRunRequest):
    return _control(lambda: replay_controller.pause(request.replayRunId))


@router.post("/resume")
def resume(request: ReplayRunRequest):
    return _control(lambda: replay_controller.resume(request.replayRunId))


@router.post("/step")
def step(request: ReplayStepRequest):
    return _control(lambda: replay_controller.step(request.replayRunId, ticks=request.ticks))


@router.post("/seek")
def seek(request: ReplaySeekRequest):
    return _control(lambda: replay_controller.seek(request.replayRunId, request.virtualTime))


@router.post("/speed")
def speed(request: ReplaySpeedRequest):
    return _control(lambda: replay_controller.set_speed(request.replayRunId, speed_multiplier=request.speedMultiplier, real_tick_seconds=request.realTickSeconds))


def _control(action):
    try:
        return {"data": action(), "sqlWrites": 0}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
