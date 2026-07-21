from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field


T = TypeVar("T")


class ApiMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data_mode: str = Field(alias="dataMode")
    dataset_mode: str | None = Field(default=None, alias="datasetMode")
    source: str
    generated_at: datetime = Field(alias="generatedAt")
    timezone: str
    is_mock: bool = Field(alias="isMock")
    policy_version: str | None = Field(default=None, alias="policyVersion")
    l2_run_id: str | None = Field(default=None, alias="l2RunId")
    lineage_hash: str | None = Field(default=None, alias="lineageHash")
    latest_runtime_run_id: str | None = Field(default=None, alias="latestRuntimeRunId")
    data_freshness_seconds: int | None = Field(default=None, alias="dataFreshnessSeconds")
    request_id: str | None = Field(default=None, alias="requestId")


class ApiEnvelope(BaseModel, Generic[T]):
    data: T
    meta: ApiMeta


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = Field(default=None, alias="requestId")


class ErrorEnvelope(BaseModel):
    error: ErrorBody


class PageData(BaseModel):
    items: list[dict[str, Any]]
    page: int
    page_size: int = Field(alias="pageSize")
    total: int


class HealthData(BaseModel):
    status: str
    checks: dict[str, Any] = Field(default_factory=dict)
