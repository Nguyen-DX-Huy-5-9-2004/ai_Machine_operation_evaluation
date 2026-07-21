from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import Depends, Query

from backend.app.repositories.dashboard import DashboardRepository, QueryFilters, get_dashboard_repository
from backend.app.config import get_settings
from inference.online.runtime_contract import DatasetMode


RepositoryDep = Annotated[DashboardRepository, Depends(get_dashboard_repository)]


def common_filters(
    dataset_mode: DatasetMode = Query(default=DatasetMode.HISTORICAL, alias="datasetMode"),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    machine_ids: list[int] | None = Query(default=None, alias="machineIds"),
    location_ids: list[int] | None = Query(default=None, alias="locationIds"),
    machine_group_ids: list[int] | None = Query(default=None, alias="machineGroupIds"),
    operational_action_levels: list[str] | None = Query(default=None, alias="operationalActionLevels"),
    quality_action_levels: list[str] | None = Query(default=None, alias="qualityActionLevels"),
    status_ids: list[int] | None = Query(default=None, alias="statusIds"),
) -> QueryFilters:
    filters = QueryFilters(
        dataset_mode=dataset_mode,
        date_from=date_from,
        date_to=date_to,
        machine_ids=tuple(machine_ids or ()),
        location_ids=tuple(location_ids or ()),
        machine_group_ids=tuple(machine_group_ids or ()),
        operational_action_levels=tuple(value.upper() for value in (operational_action_levels or ())),
        quality_action_levels=tuple(value.upper() for value in (quality_action_levels or ())),
        status_ids=tuple(status_ids or ()),
    )
    filters.validate(get_settings())
    return filters


FiltersDep = Annotated[QueryFilters, Depends(common_filters)]
