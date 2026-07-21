from __future__ import annotations

from fastapi import APIRouter

from backend.app.dependencies import FiltersDep, RepositoryDep
from backend.app.cache import api_cache, cache_key
from backend.app.services.api_service import envelope


router = APIRouter(prefix="/meta", tags=["metadata"])


@router.get("/filters")
def filters(query: FiltersDep, repository: RepositoryDep):
    data = api_cache.get_or_set(cache_key("filters", repository.data_mode, query), 300, lambda: repository.filters(query))
    return envelope(data, query, repository)
