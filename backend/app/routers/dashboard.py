from __future__ import annotations

from fastapi import APIRouter, Query

from backend.app.dependencies import FiltersDep, RepositoryDep
from backend.app.cache import api_cache, cache_key
from backend.app.services.api_service import envelope
from backend.app.services.dashboard_service import overview_with_definitions


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(query: FiltersDep, repository: RepositoryDep):
    data = api_cache.get_or_set(cache_key("overview", repository.data_mode, query), 15, lambda: overview_with_definitions(repository, query))
    return envelope(data, query, repository)


@router.get("/risk-distribution")
def risk_distribution(query: FiltersDep, repository: RepositoryDep):
    return envelope(repository.risk_distribution(query), query, repository)


@router.get("/risk-trend")
def risk_trend(query: FiltersDep, repository: RepositoryDep, grain: str = Query(default="day", pattern="^(hour|day|week)$")):
    return envelope(repository.risk_trend(query, grain), query, repository)


@router.get("/top-machines")
def top_machines(query: FiltersDep, repository: RepositoryDep, sort_by: str = Query(default="currentRisk", alias="sortBy"), limit: int = Query(default=10, ge=1, le=100)):
    return envelope(repository.top_machines(query, sort_by, limit), query, repository)


@router.get("/l1-status")
def l1_status(query: FiltersDep, repository: RepositoryDep):
    return envelope(repository.l1_status(query), query, repository)


@router.get("/l2-confidence")
def l2_confidence(query: FiltersDep, repository: RepositoryDep):
    data = repository.l2_confidence(query)
    data["definition"] = "Dominant risk is the maximum of the six selected L2 target probabilities on L2-ready events."
    return envelope(data, query, repository)


@router.get("/quality-trend")
def quality_trend(query: FiltersDep, repository: RepositoryDep, grain: str = Query(default="day", pattern="^(hour|day|week)$")):
    return envelope(repository.quality_trend(query, grain), query, repository)


@router.get("/data-quality-overview")
def data_quality_overview(query: FiltersDep, repository: RepositoryDep):
    data = repository.data_quality_overview(query)
    data.update({"completeness": None, "timeliness": None, "consistency": None, "accuracy": None, "aggregateScoresAvailable": False})
    return envelope(data, query, repository, freshness_seconds=data.get("sourceFreshnessSeconds"))


@router.get("/alerts")
def alerts(
    query: FiltersDep,
    repository: RepositoryDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200, alias="pageSize"),
    sort: str = Query(default="eventTime:desc"),
    search: str | None = Query(default=None, max_length=100),
):
    return envelope(repository.alerts(query, page, page_size, sort, search), query, repository)
