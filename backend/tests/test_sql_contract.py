from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _sql(name: str) -> str:
    return (ROOT / "sql" / name).read_text(encoding="utf-8").upper()


def test_sql_scripts_do_not_select_database_or_delete_results() -> None:
    for name in (
        "01_create_realtime_inference_tables.sql",
        "02_create_unified_dashboard_view.sql",
        "03_verify_dashboard_contract.sql",
        "04_recommended_dashboard_indexes.sql",
    ):
        text = _sql(name)
        assert "USE [" not in text
        assert "TRUNCATE TABLE" not in text
        assert "DROP TABLE" not in text


def test_source_aware_view_has_two_namespaces_without_event_id_dedup() -> None:
    text = _sql("02_create_unified_dashboard_view.sql")
    assert "HISTORICAL_PRODUCTION_SCORE:" in text
    assert "ONLINE_CURRENT_SQL" in text
    assert "UNION ALL" in text
    assert "EVENT_UID" in text
    assert "ROW_NUMBER" not in text


def test_online_table_and_verifier_forbid_monitor_and_duplicate_uid() -> None:
    migration = _sql("01_create_realtime_inference_tables.sql")
    verifier = _sql("03_verify_dashboard_contract.sql")
    assert "UNIQUE (EVENT_SOURCE, EVENT_ID)" in migration or "UX_AI_ONLINE_SOURCE_EVENT" in migration
    assert "LOW" in migration and "MEDIUM" in migration and "HIGH" in migration and "CRITICAL" in migration
    assert "MONITOR" not in migration
    assert "GROUP BY EVENT_UID" in verifier
    assert "HAVING COUNT_BIG(*) > 1" in verifier


def test_index_recommendations_cover_dashboard_access_patterns() -> None:
    text = _sql("04_recommended_dashboard_indexes.sql")
    for required in ("MACHINE_ID", "EVENT_START_TIME", "OPERATIONAL_ACTION_LEVEL", "LOCATION_ID", "RUNTIME_RUN_ID"):
        assert required in text
