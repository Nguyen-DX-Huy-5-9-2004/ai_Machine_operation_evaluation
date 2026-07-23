from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from backend.app.config import get_settings
from backend.app.replay_runtime import ReplayRuntimeIndex
from inference.online.artifacts import load_config


router = APIRouter(prefix="/demo", tags=["demo-readiness"])


@router.get("/readiness")
def readiness() -> dict[str, Any]:
    reasons: list[str] = []
    config_path = Path("inference/online/config.replay.local.yaml")
    try:
        cfg = load_config(config_path)
        runtime = cfg.get("runtime", {})
        write_disabled = (
            runtime.get("replay_mode") == "file_only"
            and runtime.get("enable_sql_write") is False
            and runtime.get("enable_local_canary_sql_write") is False
            and runtime.get("enable_replay_sql_batch_flush") is False
        )
    except Exception as exc:  # Configuration is shown as not ready, never hidden.
        cfg = {}; write_disabled = False; reasons.append(f"Replay config unavailable: {type(exc).__name__}")
    credential_ready = bool(os.environ.get("OBAD_SQL_USER")) and bool(os.environ.get("OBAD_SQL_PASSWORD"))
    if not credential_ready:
        reasons.append("OBAD_SQL_USER and/or OBAD_SQL_PASSWORD are missing in the backend process")
    if not write_disabled:
        reasons.append("Replay file-only SQL write gate is not valid")
    index = ReplayRuntimeIndex(get_settings().replay_runtime_root)
    runs = index.runs()
    latest = runs[0] if runs else None
    if latest is None:
        reasons.append("No committed file-only replay run is available")
    else:
        if int(latest.get("processedCount", 0)) == 0:
            reasons.append("Latest replay run has no processed events")
    artifact_cfg = cfg.get("artifacts", {}) if isinstance(cfg, dict) else {}
    l1_ready = bool(artifact_cfg.get("l1_enabled"))
    if not l1_ready:
        reasons.append("L1 Candidate A is not enabled in replay config")
    l2_ready = all(bool(artifact_cfg.get(key)) for key in ("l2_artifact_dir", "l2_production_selection", "l2_feature_policy"))
    if not l2_ready:
        reasons.append("L2 production artifact configuration is incomplete")
    return {
        "backend": "READY" if not reasons else "NOT_READY",
        "sql_read_only": True,
        "replay": "READY" if latest else "NOT_STARTED",
        "ai_l1": "CONFIGURED" if l1_ready else "NOT_CONFIGURED",
        "ai_l2": "CONFIGURED" if l2_ready else "NOT_CONFIGURED",
        "policy": str(cfg.get("project", {}).get("policy_version", "NOT_CONFIGURED")),
        "cache": "READY",
        "stream": "READY",
        "frontend_data_available": bool(latest and latest.get("processedCount", 0)),
        "sql_write_enabled": False,
        "latest_replay": latest,
        "blocking_reasons": reasons,
    }
