from __future__ import annotations

import hashlib
import json
from enum import StrEnum
from typing import Any, Mapping

import pandas as pd


class DatasetMode(StrEnum):
    HISTORICAL = "historical"
    CURRENT = "current"


class EventSource(StrEnum):
    HISTORICAL = "HISTORICAL_PRODUCTION_SCORE"
    CURRENT = "ONLINE_CURRENT_SQL"


class ReadinessState(StrEnum):
    L1_READY = "L1_READY"
    L1_UNREADY = "L1_UNREADY"
    L2_READY = "L2_READY"
    L2_UNREADY = "L2_UNREADY"
    POLICY_READY = "POLICY_READY"
    POLICY_UNREADY = "POLICY_UNREADY"


RAW_FINGERPRINT_COLUMNS = (
    "machine_id",
    "status_id",
    "event_start_time",
    "raw_event_end_time",
    "raw_status_kwh_start",
    "raw_status_kwh_end",
    "raw_error_code",
)


def event_source_for_mode(mode: str | DatasetMode) -> EventSource:
    parsed = DatasetMode(str(mode).lower())
    return EventSource.HISTORICAL if parsed is DatasetMode.HISTORICAL else EventSource.CURRENT


def make_event_uid(event_source: str | EventSource, event_id: Any) -> str:
    source = EventSource(str(event_source))
    if event_id is None or pd.isna(event_id):
        raise ValueError("event_id is required for source-aware identity")
    return f"{source.value}:{int(event_id)}"


def add_source_identity(frame: pd.DataFrame, event_source: str | EventSource) -> pd.DataFrame:
    out = frame.copy()
    source = EventSource(str(event_source)).value
    out["event_source"] = source
    out["event_uid"] = [make_event_uid(source, event_id) for event_id in out["event_id"]]
    if out["event_uid"].duplicated().any():
        duplicates = out.loc[out["event_uid"].duplicated(keep=False), "event_uid"].head(10).tolist()
        raise ValueError(f"duplicate source-aware event_uid values: {duplicates}")
    return out


def raw_source_fingerprint(row: Mapping[str, Any]) -> str:
    payload = {column: _stable_value(row.get(column)) for column in RAW_FINGERPRINT_COLUMNS}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _stable_value(value: Any) -> Any:
    if value is None or (not isinstance(value, (list, dict, tuple)) and pd.isna(value)):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float):
        return format(value, ".15g")
    return value.item() if hasattr(value, "item") else value
