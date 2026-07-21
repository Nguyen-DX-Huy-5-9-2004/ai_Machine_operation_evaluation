# SQL Dashboard Read Model

This is a DBA-reviewed migration set. Applications do not execute it automatically.

## Actual preflight state

`sql/00_preflight_dashboard_migration.sql` and `scripts/preflight_dashboard_migration_read_only.py` inspect metadata and data with `ApplicationIntent=ReadOnly`. The preflight run records schema, permissions, constraints, indexes, duplicates and readiness. It does not issue DDL or DML.

The historical table is `dbo.ai_l2_fault_judgment_policy_v2_full`. It has L1 readiness, six L2 probability fields and action data, so historical readiness is derivable. It does not export raw event start/end, machine group/location, KWh or duration telemetry. The unified view returns typed `NULL` for those unexported historical fields; it never fabricates values.

## UID and readiness contract

Online rows use `event_source = ONLINE_CURRENT_SQL` and `event_uid = event_source:event_id`. UID uniqueness is source-aware. Historical rows use `HISTORICAL_PRODUCTION_SCORE:event_id`; cross-source rows are retained with `UNION ALL`.

`l1_score_available_flag`, `l2_ready_flag`, `policy_ready_flag` and `readiness_reason` are explicit. A legacy online row whose readiness cannot be proven remains unready with `LEGACY_ROW_READINESS_NOT_PROVABLE`; migration must never backfill it to ready.

## DBA order

1. Back up schema metadata and confirm the controlled writer is disabled.
2. Run `00_preflight_dashboard_migration.sql` / Python runner read-only and review audit output.
3. Apply `01a_replace_empty_online_table.sql` only when its empty-table and dependency gates pass.
4. Run `01b_refresh_legacy_view_and_verify_permissions.sql` under the API/read identity and writer identity. It refreshes the reviewed legacy view and reports permissions; it never grants them.
5. Apply `01_create_realtime_inference_tables.sql` to verify the online schema idempotently and add the checkpoint/run-log/error-log contract. Legacy run-log fields remain intact; new runtime count fields are nullable only for legacy runs.
6. Run `02a_preflight_unified_dashboard_view.sql` read-only; it compiles the entire `UNION ALL` projection with `sys.sp_describe_first_result_set`.
7. Apply `02_create_unified_dashboard_view.sql`.
8. Run `03_verify_dashboard_contract.sql`; require `OVERALL_RESULT = PASS`.
9. Run `04a_index_recommendation_report.sql`. Do not run `04b`.

After the controlled swap, DBA should compile-check the reviewed legacy view with `EXEC sys.sp_refreshview N'dbo.vw_ai_dashboard_events_unified_v2';`. This is a proposed post-swap command, never executed automatically by the project.

## Locks, rollback and permissions

Schema additions, backfill and constraints can lock the online table. Estimate row count first and phase a large backfill outside peak usage. Required permissions are SELECT for preflight plus DBA-reviewed ALTER/CREATE TABLE/CREATE VIEW for apply.

`05_rollback_dashboard_migration.sql` is a guarded template. It does not delete tables or rows and refuses execution until a DBA has an inventory proving which objects were created by this migration and that no new-column data would be lost.

No script contains `USE`, credentials, `TRUNCATE`, or automatic execution.
