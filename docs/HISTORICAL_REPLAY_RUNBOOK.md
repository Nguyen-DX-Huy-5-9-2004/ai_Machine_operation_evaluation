# Historical Replay Runbook

## Prerequisites

Set `OBAD_SQL_USER` and `OBAD_SQL_PASSWORD` only in the process environment. Do not put credentials in replay YAML. Confirm the config points to `L0A0P8W1`, `OBAD_AI_LOCAL`, `ODBC Driver 18 for SQL Server` and `dbo.vw_ai_runtime_raw_iot_typed_local`.

## Run a bounded replay

```powershell
.\scripts\start_replay_demo.ps1 -Start '2026-07-01T08:00:00' -Preset demo_fast -Ticks 10 -RunId demo_20260701
```

The command performs read-only SQL queries, writes only under `data/replay_runtime`, and leaves the production/canary checkpoint untouched. Inspect `checkpoint.json` with `check_replay_status.ps1`.

## Resume

Run the same command with the same `-RunId`. The persisted composite watermark prevents duplicate event UIDs. Do not reset a run while its API controller is active.

## Reset

`reset_replay_demo.ps1 -RunId demo_20260701 -Confirm` removes only that local replay directory. It never touches SQL.

## Failure handling

Inspect `errors.jsonl`, `metrics.jsonl`, and `state_changes.jsonl`. A batch file found without a checkpoint is recovered from its final ordered event. `INSUFFICIENT_HISTORY_IN_SEGMENT` is a readiness outcome, not a feature-processing error.
