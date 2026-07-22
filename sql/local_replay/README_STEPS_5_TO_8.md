# Import Steps 5–8: Weldcom AI Local SQL

## What this package imports

Required:

1. `data/dataCore/ai_l1_operation_event_sequence.csv`
2. `data/dataModel/l1/scored/ai_l1_operation_anomaly_result_production.csv`
3. `data/dataCore/ai_l2_fault_confidence_event.csv`
4. `data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_fault_judgment_policy_v2_all.csv`

Optional:

5. `data/dataModel/l2/policy_v2/l2_multilabel_20260711_043347/ai_l2_dashboard_event_core_v2.csv`

The source-aware dashboard view requires the full policy table, L2 confidence/event
table, and online result table. The compact dashboard-core CSV is not a replacement.

## Copy this package

Copy all files into:

```text
E:\OBAD\sql\local_replay\
```

## Exact order

1. Create `OBAD_AI_LOCAL`.
2. Import the five raw/master tables from the selected coherent snapshot.
3. Run existing:

```text
E:\OBAD\sql\01_create_realtime_inference_tables.sql
```

4. Run:

```text
05_CREATE_STEPS_5_TO_8_TABLES.sql
```

5. Run:

```text
06_IMPORT_STEPS_5_TO_8.bat
```

6. Reconcile row counts and read the import audit.
7. Run:

```text
07_CREATE_INDEXES_AFTER_IMPORT.sql
```

8. Run existing view scripts:

```text
sql/02a_preflight_unified_dashboard_view.sql
sql/02_create_unified_dashboard_view.sql
sql/03_verify_dashboard_contract.sql
```

9. Run:

```text
08_VALIDATE_AFTER_IMPORT.sql
```

## Environment defaults

```bat
set OBAD_SQL_SERVER=localhost
set OBAD_SQL_DATABASE=OBAD_AI_LOCAL
set OBAD_SQL_DRIVER=ODBC Driver 18 for SQL Server
set OBAD_SQL_TRUSTED=yes
```

For SQL authentication, set `OBAD_SQL_TRUSTED=no`, `OBAD_SQL_USER`, and
`OBAD_SQL_PASSWORD` in the terminal session. Do not put passwords in the files.

## Safety

The importer never truncates or appends to a non-empty table.

A table with the exact expected row count is skipped during a rerun.

Missing CSV columns can only be added automatically when:

- database name contains `_LOCAL`;
- the exact local confirmation string is provided.

## Files intentionally not imported

- `ai_l1_operation_anomaly_result.csv`: superseded by the production file.
- `train/valid/test_l2_fault_judgment_policy_v2.csv`: already combined in `_all.csv`.
- future labels and train/valid/test datasets: training-only, not runtime SQL input.
- report JSON/CSV files: keep on disk as metadata; do not turn them into event tables.

## Still outside this batch

The five raw/master source tables must already be imported.

Optional energy/maintenance business tables are not runtime inputs for the current
L1/L2 pipeline. Add them later only when their CSV snapshots and business joins
are confirmed.
