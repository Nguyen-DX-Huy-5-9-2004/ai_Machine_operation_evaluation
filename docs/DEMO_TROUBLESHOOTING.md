# Demo Troubleshooting

- `SQL_CREDENTIALS_MISSING`: set the two environment variables in the same PowerShell session, then restart the script.
- `REPLAY_SQL_WRITE_NOT_APPROVED`: do not bypass it. Verify the four replay runtime flags remain file-only/false.
- Backend not ready: inspect `data/replay_runtime/demo_logs/backend.err.log` and `/api/demo/readiness`.
- A stale OBAD replay backend on port `8000` is restarted automatically by `start_demo_tomorrow.ps1`; a non-OBAD process on that port is left untouched and must be resolved deliberately.
- No replay events: inspect the generated profile, replay `errors.jsonl`, and `checkpoint.json`; do not substitute mock data for the SQL demo.
- Frontend shows no replay panel: check that the launched frontend inherited `VITE_REPLAY_RUN_ID` and that `/api/replay/status` returns the run.
- Resume always uses the same run id; the composite watermark prevents duplicate event UIDs.
