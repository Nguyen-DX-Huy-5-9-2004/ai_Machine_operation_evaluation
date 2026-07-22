from __future__ import annotations

from fastapi import APIRouter, Query

from backend.app.config import get_settings
from backend.app.dependencies import FiltersDep, RepositoryDep
from backend.app.services.api_service import envelope, latest_audit_summary, latest_bounded_inference_audit, read_json, runtime_static_status


router = APIRouter(prefix="/model-monitor", tags=["model-monitor"])


@router.get("/overview")
def overview(query: FiltersDep, repository: RepositoryDep):
    status = runtime_static_status()
    try:
        db = repository.health()
    except Exception as exc:
        db = {"ready": False, "reason": type(exc).__name__}
    smoke = latest_audit_summary(get_settings().realtime_audit_root, "l1_l2_policy_multi_machine_smoke_")
    status.update({"runtimeStatus": "HEALTHY" if status["staticGatePass"] and db.get("ready") else "NOT_READY", "latestSmoke": smoke, "nextScheduledRetrain": None})
    return envelope(status, query, repository)


@router.get("/performance-reference")
def performance_reference(query: FiltersDep, repository: RepositoryDep):
    path = get_settings().model_performance_reference_path
    payload = read_json(path)
    if not payload:
        payload = {
            "availability": False,
            "message": "Model performance reference has not been generated from validated artifacts.",
            "sourceType": "MODEL_ARTIFACT_REFERENCE",
            "isDatabaseBacked": False,
            "isMock": False,
        }
    else:
        payload = {**payload, "availability": True}
    return envelope(payload, query, repository)


@router.get("/model-metadata")
def model_metadata(query: FiltersDep, repository: RepositoryDep):
    """Read the canonical UI metadata file; this endpoint never executes inference."""
    payload = read_json(get_settings().model_monitor_metadata_path)
    if not payload:
        payload = {
            "availability": False,
            "message": "Model monitor metadata JSON is unavailable.",
            "isMock": False,
        }
    return envelope(payload, query, repository)


@router.get("/latest-inference-audit")
def latest_inference_audit(query: FiltersDep, repository: RepositoryDep):
    """Expose only a sanitized summary of the newest bounded dry-run audit."""
    summary = latest_bounded_inference_audit(get_settings().realtime_audit_root)
    if not summary:
        return envelope({"availability": False, "message": "No completed bounded inference audit is available."}, query, repository)
    return envelope({"availability": True, **summary}, query, repository)


@router.get("/l1-candidates")
def l1_candidates(query: FiltersDep, repository: RepositoryDep):
    root = get_settings().candidate_evaluation_dir
    decision = read_json(root / "candidate_c_decision_gate.json")
    comparison = read_json(root / "candidate_abc_comparison.json")
    return envelope({"decision": decision, "comparison": comparison, "selected": "A", "candidateBPromoted": False, "candidateCPromoted": False}, query, repository)


@router.get("/l2-targets")
def l2_targets(query: FiltersDep, repository: RepositoryDep):
    selection = read_json(get_settings().l2_production_selection_path)
    return envelope(selection.get("targets", []), query, repository)


@router.get("/positive-rate-trend")
def positive_rate_trend(query: FiltersDep, repository: RepositoryDep, grain: str = Query(default="day", pattern="^(hour|day|week)$")):
    return envelope(repository.risk_trend(query, grain), query, repository)


@router.get("/scoring-funnel")
def scoring_funnel(query: FiltersDep, repository: RepositoryDep):
    quality = repository.data_quality_overview(query)
    eligible = int(quality.get("eligibleEvents") or 0)
    l1_ready = int(round(eligible * float(quality.get("l1WindowReadyRate") or 0)))
    l2_ready = int(round(eligible * float(quality.get("l2ReadyRate") or 0)))
    stages = [
        ("canonicalEligible", eligible),
        ("l1WindowReady", l1_ready),
        ("l1Scored", l1_ready),
        ("l2Ready", l2_ready),
        ("l2Scored", l2_ready),
        ("policyReady", l2_ready),
    ]
    return envelope([{"stage": name, "count": count, "conversionRate": None if eligible == 0 else count / eligible} for name, count in stages], query, repository)


@router.get("/data-contract-health")
def data_contract_health(query: FiltersDep, repository: RepositoryDep):
    return envelope({"runtime": runtime_static_status(), "quality": repository.data_quality_overview(query)}, query, repository)


@router.get("/runs")
def runs(query: FiltersDep, repository: RepositoryDep, page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200, alias="pageSize")):
    return envelope(repository.runtime_runs(page, page_size), query, repository)


@router.get("/decision-trace/{event_uid}")
def decision_trace(event_uid: str, query: FiltersDep, repository: RepositoryDep):
    return envelope(repository.event_by_uid(event_uid), query, repository)
