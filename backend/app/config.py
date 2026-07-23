from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


ALLOWED_DATA_MODES = {"sql", "csv", "mock"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    backend_data_mode: str
    api_sql_config_path: Path
    app_timezone: str
    cors_origins: tuple[str, ...]
    query_timeout_seconds: int
    max_page_size: int
    max_date_range_days: int
    historical_table: str
    current_table: str
    dashboard_view: str
    runtime_manifest_dir: Path
    realtime_audit_root: Path
    l2_production_selection_path: Path
    candidate_evaluation_dir: Path
    model_performance_reference_path: Path
    model_monitor_metadata_path: Path
    replay_runtime_root: Path
    csv_path: Path | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    mode = os.getenv("BACKEND_DATA_MODE", "sql").strip().lower()
    if mode not in ALLOWED_DATA_MODES:
        raise ValueError(f"BACKEND_DATA_MODE must be one of {sorted(ALLOWED_DATA_MODES)}")
    origins = tuple(
        value.strip()
        for value in os.getenv("OBAD_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:4174,http://127.0.0.1:4174").split(",")
        if value.strip()
    )
    if "*" in origins:
        raise ValueError("Wildcard CORS origin is not permitted")
    csv_value = os.getenv("OBAD_BACKEND_CSV_PATH", "").strip()
    return Settings(
        app_name=os.getenv("OBAD_API_NAME", "Weldcom OBAD API"),
        api_prefix=os.getenv("OBAD_API_PREFIX", "/api"),
        backend_data_mode=mode,
        api_sql_config_path=Path(os.getenv("OBAD_API_SQL_CONFIG", "inference/online/config.local.yaml")),
        app_timezone=os.getenv("APP_TIMEZONE", "Asia/Ho_Chi_Minh"),
        cors_origins=origins,
        query_timeout_seconds=max(1, int(os.getenv("OBAD_QUERY_TIMEOUT_SECONDS", "30"))),
        max_page_size=max(1, int(os.getenv("OBAD_MAX_PAGE_SIZE", "200"))),
        max_date_range_days=max(1, int(os.getenv("OBAD_MAX_DATE_RANGE_DAYS", "366"))),
        historical_table=os.getenv("OBAD_HISTORICAL_RESULT_TABLE", "dbo.ai_l2_fault_judgment_policy_v2_full"),
        current_table=os.getenv("OBAD_CURRENT_RESULT_TABLE", "dbo.ai_l2_fault_judgment_online_v2"),
        dashboard_view=os.getenv("OBAD_DASHBOARD_VIEW", "dbo.vw_ai_dashboard_events_source_aware_v2"),
        runtime_manifest_dir=Path(os.getenv("OBAD_RUNTIME_MANIFEST_DIR", "data/runtime_manifest")),
        realtime_audit_root=Path(os.getenv("OBAD_REALTIME_AUDIT_ROOT", "data/realtime_audit")),
        l2_production_selection_path=Path(os.getenv("OBAD_L2_PRODUCTION_SELECTION", "data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json")),
        candidate_evaluation_dir=Path(os.getenv("OBAD_L1_CANDIDATE_EVALUATION_DIR", "data/realtime_audit/l1_candidate_c_eval_20260716_084204")),
        model_performance_reference_path=Path(os.getenv("OBAD_MODEL_PERFORMANCE_REFERENCE", "backend/data/reference/model_performance_reference.json")),
        model_monitor_metadata_path=Path(os.getenv("OBAD_MODEL_MONITOR_METADATA", "frontEnd/weldcom-ai-operations-dashboard/src/data/modelMonitorMetadata.json")),
        replay_runtime_root=Path(os.getenv("OBAD_REPLAY_RUNTIME_ROOT", "data/replay_runtime")),
        csv_path=Path(csv_value) if csv_value else None,
    )


def reset_settings_cache() -> None:
    get_settings.cache_clear()
