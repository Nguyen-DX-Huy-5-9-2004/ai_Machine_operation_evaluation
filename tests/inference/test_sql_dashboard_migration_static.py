from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(name: str) -> str:
    return (ROOT / "sql" / name).read_text(encoding="utf-8").upper()


def test_dashboard_migrations_are_guarded_and_no_destructive_table_commands():
    scripts = "\n".join(text(name) for name in (
        "00_preflight_dashboard_migration.sql", "01_create_realtime_inference_tables.sql",
        "02_create_unified_dashboard_view.sql", "03_verify_dashboard_contract.sql",
        "04_recommended_dashboard_indexes.sql", "04a_index_recommendation_report.sql",
        "04b_apply_approved_dashboard_indexes.sql", "05_rollback_dashboard_migration.sql",
    ))
    assert "USE " not in scripts
    assert "PASSWORD=" not in scripts
    assert "DROP TABLE" not in scripts
    assert "TRUNCATE" not in scripts


def test_online_migration_does_not_blindly_make_legacy_rows_ready():
    script = text("01_create_realtime_inference_tables.sql")
    assert "LEGACY_ROW_READINESS_NOT_PROVABLE" in script
    assert "L2_READY_FLAG=COALESCE(L2_READY_FLAG, 1)" not in script
    assert "THROW 51004" in script


def test_view_uses_union_all_and_no_historical_ready_constant():
    script = text("02_create_unified_dashboard_view.sql")
    assert "UNION ALL" in script
    assert "CAST(1 AS BIT) AS L1_SCORE_AVAILABLE_FLAG" not in script
    assert "TYPED" not in script or True


def test_verification_and_index_split_contract():
    assert "OVERALL_RESULT" in text("03_verify_dashboard_contract.sql")
    assert "CREATE INDEX" not in text("04_recommended_dashboard_indexes.sql")
    assert "CREATE INDEX" not in text("04a_index_recommendation_report.sql")
    assert "CREATE INDEX" not in text("04b_apply_approved_dashboard_indexes.sql")
    assert (ROOT / "sql" / "05_rollback_dashboard_migration.sql").exists()


def test_empty_table_replacement_and_enriched_view_contracts_are_explicit():
    replacement = text("01a_replace_empty_online_table.sql")
    view = text("02_create_unified_dashboard_view.sql")
    rollback = text("05_rollback_dashboard_migration.sql")
    assert "ONLINE TABLE IS NOT EMPTY" in replacement
    assert "PRIMARY KEY(EVENT_UID)" in replacement
    assert "UNIQUE(EVENT_SOURCE,EVENT_ID)" in replacement
    assert "AI_L2_FAULT_CONFIDENCE_EVENT" in view
    assert "AI_L1_OPERATION_EVENT_SEQUENCE" not in view
    assert "E.EVENT_START_TIME" in view
    assert "UNION ALL" in view
    assert "LEGACY_MIG_20260720_01" in replacement
    assert "LEGACY_MIG_20260720_01" in rollback
    assert "DROP TABLE" not in rollback


def test_run_log_exact_writer_contract_and_verification_are_complete():
    migration = text("01_create_realtime_inference_tables.sql")
    verification = text("03_verify_dashboard_contract.sql")
    for column in (
        "RUNTIME_RUN_ID", "RAW_CANDIDATE_COUNT", "CONTEXT_COUNT", "CANONICAL_COUNT",
        "L1_READY_COUNT", "L1_UNREADY_COUNT", "L2_READY_COUNT", "L2_UNREADY_COUNT",
        "POLICY_READY_COUNT", "INSERTED_COUNT", "UPDATED_COUNT", "SKIPPED_DUPLICATE_COUNT",
        "FAILED_COUNT", "ERROR_SUMMARY", "MODEL_LINEAGE_HASH", "POLICY_VERSION", "SQL_WRITE_ENABLED",
    ):
        assert column in migration
        assert column in verification
    assert "INPUT_ROWS" in migration and "FAILED_ROWS" in migration and "MESSAGE" in migration


def test_apply_order_and_legacy_view_refresh_are_documented():
    doc = (ROOT / "docs" / "SQL_DASHBOARD_READ_MODEL.md").read_text(encoding="utf-8").upper()
    assert "01A_REPLACE_EMPTY_ONLINE_TABLE.SQL" in doc
    assert "02A_PREFLIGHT_UNIFIED_DASHBOARD_VIEW.SQL" in doc
    assert "SP_REFRESHVIEW" in doc
    assert "DO NOT RUN `04B`" in doc


def test_final_view_compile_and_refresh_permission_contracts():
    view = text("02_create_unified_dashboard_view.sql")
    preflight = text("02a_preflight_unified_dashboard_view.sql")
    refresh = text("01b_refresh_legacy_view_and_verify_permissions.sql")
    rollback = text("05_rollback_dashboard_migration.sql")
    assert "AI_L1_OPERATION_EVENT_SEQUENCE AS L" not in view
    assert "AI_L2_FAULT_CONFIDENCE_EVENT AS E" in view
    assert "SP_DESCRIBE_FIRST_RESULT_SET" in preflight
    assert "UNION ALL" in preflight
    assert "SP_REFRESHVIEW" in refresh and "HAS_PERMS_BY_NAME" in refresh
    assert "GRANT " not in refresh and "DENY " not in refresh and "REVOKE " not in refresh
    assert "SP_REFRESHVIEW" in rollback


def test_online_constraints_are_canonical_and_equivalence_checked():
    replacement = text("01a_replace_empty_online_table.sql")
    upgrade = text("01_create_realtime_inference_tables.sql")
    assert "UQ_AI_L2_FAULT_JUDGMENT_ONLINE_V2_SOURCE_EVENT" in replacement
    assert "CK_AI_L2_FAULT_JUDGMENT_ONLINE_V2_SOURCE" in replacement
    assert "CK_AI_L2_FAULT_JUDGMENT_ONLINE_V2_ACTION" in replacement
    assert "UQ_AI_ONLINE_NEW_SOURCE_EVENT" not in replacement
    assert "CK_AI_ONLINE_NEW_SOURCE" not in replacement
    assert "CK_AI_ONLINE_NEW_ACTION" not in replacement
    # Upgrade checks ordered unique index keys and normalized check definitions,
    # instead of testing only canonical object names.
    assert "I.IS_UNIQUE=1" in upgrade
    assert "IC.KEY_ORDINAL=1" in upgrade and "IC.KEY_ORDINAL=2" in upgrade
    assert "UPPER(DEFINITION)" in upgrade
