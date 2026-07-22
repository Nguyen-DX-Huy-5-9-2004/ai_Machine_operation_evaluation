# Local SQL Write Canary

This mode is intentionally separate from bulk controlled writes. It can write **one** policy-ready `ONLINE_CURRENT_SQL` event only to an explicitly allowlisted local target.

## Safety contract

- The CLI reads at most `500` candidates, scores them read-only, then selects the first policy-ready event by event time/id.
- It rejects `--loop`, `--stage-only`, historical-overlap candidates, and `--enable-sql-write`.
- Only the selected row is written; it must be policy-ready and belong to exactly one machine.
- Candidate selection still uses the source-aware `NOT EXISTS` check. A rerun finds the existing online row and does not create a duplicate or a second write run.
- The transaction writes online result first, then checkpoint, then one run-log row. Any error before commit rolls all three back.
- After commit, the process read-checks the online table, checkpoint, run log, error log, and `dbo.vw_ai_dashboard_events_source_aware_v2`.

## Required local configuration

Keep the mode disabled by default:

```yaml
runtime:
  dry_run: true
  enable_sql_write: false
  enable_local_canary_sql_write: false
  local_canary_sql_write_target_allowlist:
    - "l0a0p8w1/obad_ai_local"
  local_canary_max_write_rows: 1
```

Use `inference/online/config.canary.local.yaml` for the deliberately enabled local-only path. The invocation fails before SQL reads or model scoring unless `runtime.dry_run: false`, `runtime.enable_local_canary_sql_write: true`, `runtime.enable_sql_write: false`, the local allowlist, the exact confirmation and the process consent are all present. Bulk `enable_sql_write` remains disabled.

## Explicit execution gate

No canary is run by this document. A real execution additionally requires:

```powershell
$env:OBAD_ALLOW_LOCAL_CANARY_SQL_WRITE = "YES"
```

and the exact confirmation value:

```text
I_UNDERSTAND_THIS_WRITES_ONE_LOCAL_CANARY_EVENT
```

The command is:

```powershell
.\.venv\Scripts\python.exe -m inference.online.score_new_events `
  --config inference/online/config.canary.local.yaml `
  --local-sql-write-canary `
  --write-confirmation I_UNDERSTAND_THIS_WRITES_ONE_LOCAL_CANARY_EVENT `
  --audit
```

Expected post-write read checks:

- one `ONLINE_CURRENT_SQL` result row for the event;
- checkpoint equals that event id;
- exactly one run-log row for the runtime run id;
- zero error-log rows for the runtime run id;
- one source-aware view row for the event.

The log records `scanned_candidates`, `l1_ready_count`, `policy_ready_count`, `selected_event_id`, and `selected_machine_id`. A committed canary additionally emits `CANARY_TRANSACTION_COMMITTED`, `readback_online_rows`, `readback_checkpoint`, `readback_run_log_rows`, `readback_error_rows`, `source_aware_online_rows`, and `LOCAL_SQL_CANARY_WRITE_PASS`. If no policy-ready row exists in the 500-row scan, the command stops without writing SQL.
