# Demo Tomorrow Validation

## Current code validation

- Replay file-only configuration gate: PASS.
- Replay static write scan: PASS; replay modules contain no SQL DML or `commit` call.
- Python replay/backend test suite: 47 targeted tests pass; the broader prior suite remains 163 pass.
- Frontend typecheck, lint, Vitest and API/mock builds: PASS.
- Synthetic file-only 5,000-event replay: PASS.

## Required live validation before declaring ready

The current process did not receive `OBAD_SQL_USER` or `OBAD_SQL_PASSWORD`. Therefore the following have **not** been run and must not be inferred from synthetic tests:

- SQL read-only baseline and before/after assertion.
- Data-driven selection of the real demo time range.
- 100/500/full-range SQL replay and restart/resume validation.
- Real API SSE delta verification.
- Dashboard and Machine Detail screenshots at 1366x768, 1440x900 and 1920x1080.

The exact command that performs the guarded live checks is `scripts/start_demo_tomorrow.ps1`. It fails before any service or replay starts if either secret is absent.
