from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.app.dependencies import FiltersDep, RepositoryDep
from backend.app.services.api_service import envelope


router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("")
def machines(query: FiltersDep, repository: RepositoryDep, page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200, alias="pageSize"), sort: str = Query(default="risk")):
    return envelope(repository.machines(query, page, page_size, sort), query, repository)


@router.get("/{machine_id}/summary")
def summary(machine_id: int, query: FiltersDep, repository: RepositoryDep):
    value = repository.machine_summary(machine_id, query)
    if value is None:
        raise HTTPException(status_code=404, detail="Machine has no event in the selected dataset/range")
    return envelope(value, query, repository)


def _series(machine_id: int, query: FiltersDep, repository: RepositoryDep, name: str, limit: int):
    return envelope(repository.machine_series(machine_id, query, name, limit), query, repository)


@router.get("/{machine_id}/timeline")
def timeline(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=500, ge=1, le=5000)):
    return _series(machine_id, query, repository, "timeline", limit)


@router.get("/{machine_id}/l1-series")
def l1_series(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=1000, ge=1, le=5000)):
    return _series(machine_id, query, repository, "l1", limit)


@router.get("/{machine_id}/l2-series")
def l2_series(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=1000, ge=1, le=5000)):
    return _series(machine_id, query, repository, "l2", limit)


@router.get("/{machine_id}/kwh-series")
def kwh_series(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=1000, ge=1, le=5000)):
    return _series(machine_id, query, repository, "kwh", limit)


@router.get("/{machine_id}/ai-analysis")
def ai_analysis(machine_id: int, query: FiltersDep, repository: RepositoryDep):
    return envelope({"latestDecision": repository.machine_summary(machine_id, query), "l1Series": repository.machine_series(machine_id, query, "l1", 200), "l2Series": repository.machine_series(machine_id, query, "l2", 200)}, query, repository)


@router.get("/{machine_id}/performance")
def performance(machine_id: int, query: FiltersDep, repository: RepositoryDep):
    data = repository.machine_performance(machine_id, query)
    data.update({"throughputIndex": None, "throughputAvailability": False})
    return envelope(data, query, repository)


@router.get("/{machine_id}/energy")
def energy(machine_id: int, query: FiltersDep, repository: RepositoryDep):
    data = repository.machine_energy(machine_id, query)
    data["scopeNote"] = "Machine-level event KWh evidence. Cabinet/global KWh is not assigned to a machine without a validated bridge."
    data["series"] = repository.machine_series(machine_id, query, "kwh", 1000)
    return envelope(data, query, repository)


@router.get("/{machine_id}/events")
def events(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=100, ge=1, le=200)):
    return _series(machine_id, query, repository, "events", limit)


@router.get("/{machine_id}/maintenance-risk")
def maintenance(machine_id: int, query: FiltersDep, repository: RepositoryDep, limit: int = Query(default=200, ge=1, le=1000)):
    return _series(machine_id, query, repository, "maintenance", limit)
