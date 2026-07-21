# Controlled SQL Write Rollout

SQL writing is implemented but remains disabled by default. Never skip a stage.

## Gates Required Together

`--enable-sql-write`, `runtime.enable_sql_write=true`, exact confirmation value, `OBAD_ALLOW_PRODUCTION_SQL_WRITE=YES`, lineage PASS, runtime environment PASS, artifact hashes PASS, explicit `server/database` allowlist, and dry-run disabled.

## Stages

1. Stage 0: run `--stage-only --audit`; verify source/query/context/features and zero writes.
2. Stage 1: run Candidate A -> L2 -> policy in default dry-run; verify readiness and artifact hash.
3. Stage 2: configure a DBA-created staging result table, run a small event count, verify UID uniqueness and rollback by deleting only the approved staging run ID.
4. Stage 3: allow one machine/current source in controlled online table. Verify expected count, no duplicate `(event_source,event_id)`, run log and checkpoint in the same committed transaction.
5. Stage 4: expand to 14 machines while monitoring duplicate/error/latency and artifact integrity.
6. Stage 5: schedule the locked 60-second worker.

Controlled command template, intentionally not executed:

```powershell
$env:OBAD_ALLOW_PRODUCTION_SQL_WRITE="YES"
python -m inference.online.score_new_events `
  --config inference/online/config.local.yaml `
  --max-events 100 `
  --enable-sql-write `
  --write-confirmation I_UNDERSTAND_THIS_WRITES_PRODUCTION_AI_RESULTS
```

At every stage run `sql/03_verify_dashboard_contract.sql`, compare expected/inserted/updated counts, verify no duplicate `event_uid`, inspect checkpoint and run log, and re-hash Candidate A/L2 artifacts. A failure rolls back result, checkpoint and run log together. Production table rollback must be DBA-approved and scoped by `runtime_run_id`; never truncate.

