from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.app.config import Settings, get_settings
from backend.app.repositories.dashboard import DashboardRepository, QueryFilters
from backend.app.schemas.api import ApiEnvelope, ApiMeta
from backend.app.request_context import request_id_context
from inference.online.runtime_contract import event_source_for_mode


POLICY_VERSION = "policy_v2_operational_quality_split_sensitive_audit_only"
L2_RUN_ID = "l2_multilabel_20260711_043347"


def envelope(
    data: Any,
    filters: QueryFilters | None,
    repository: DashboardRepository,
    *,
    freshness_seconds: int | None = None,
    latest_runtime_run_id: str | None = None,
) -> ApiEnvelope[Any]:
    settings = get_settings()
    dataset_mode = filters.dataset_mode.value if filters else None
    source = event_source_for_mode(dataset_mode).value if dataset_mode else "SYSTEM"
    lineage = read_json(settings.runtime_manifest_dir / "ai_production_lineage_manifest.json")
    meta = ApiMeta(
        dataMode=repository.data_mode,
        datasetMode=dataset_mode,
        source=source,
        generatedAt=datetime.now(),
        timezone=settings.app_timezone,
        isMock=repository.data_mode == "mock",
        policyVersion=lineage.get("policy_l2", {}).get("path") and POLICY_VERSION,
        l2RunId=lineage.get("l2_run_id", L2_RUN_ID),
        lineageHash=lineage.get("content_sha256"),
        latestRuntimeRunId=latest_runtime_run_id,
        dataFreshnessSeconds=freshness_seconds,
        requestId=request_id_context.get(),
    )
    return ApiEnvelope(data=data, meta=meta)


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def runtime_static_status(settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    lineage = read_json(settings.runtime_manifest_dir / "ai_production_lineage_manifest.json")
    environment = read_json(settings.runtime_manifest_dir / "ai_runtime_environment.json")
    relocation = latest_audit_summary(settings.realtime_audit_root, "runtime_relocation_check_")
    artifact_ok = lineage.get("artifact_contract_result") == "PASS"
    # The official environment manifest uses a detailed PASS status, e.g.
    # PASS_RUNTIME_SKLEARN_VERSION_MATCHES_TRAINING. Treat only PASS-prefixed
    # verified states as healthy; WARNING/FAIL remain blocking.
    environment_status = str(environment.get("artifact_serialization_warning_status", ""))
    environment_ok = environment_status.startswith("PASS")
    relocation_ok = relocation.get("result") == "PASS"
    return {
        "runtimeEnvironmentStatus": "PASS" if environment_ok else "WARNING",
        "artifactIntegrity": "PASS" if artifact_ok else "FAIL",
        "relocationStatus": relocation.get("result", "NOT_RUN"),
        "policyVersion": POLICY_VERSION,
        "l2RunId": lineage.get("l2_run_id", L2_RUN_ID),
        "lineageHash": lineage.get("content_sha256"),
        "sqlWriteEnabled": False,
        "candidateBPromoted": False,
        "candidateCPromoted": False,
        "staticGatePass": artifact_ok and environment_ok and relocation_ok,
    }


def latest_audit_summary(root: Path, prefix: str) -> dict[str, Any]:
    if not root.exists():
        return {}
    candidates = sorted((path for path in root.iterdir() if path.is_dir() and path.name.startswith(prefix)), key=lambda path: path.stat().st_mtime, reverse=True)
    for directory in candidates:
        summary = read_json(directory / "00_summary.json")
        if summary:
            return {**summary, "auditDirectory": directory.name}
    return {}


def logical_file_record(path: Path, project_root: Path | None = None) -> dict[str, Any]:
    project_root = project_root or Path.cwd()
    if not path.exists():
        return {"available": False, "path": str(path).replace("\\", "/")}
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        logical = str(path.resolve().relative_to(project_root.resolve())).replace("\\", "/")
    except ValueError:
        logical = path.name
    return {"available": True, "path": logical, "sha256": digest}
