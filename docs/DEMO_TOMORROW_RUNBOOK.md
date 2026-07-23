# Demo Tomorrow

1. Open PowerShell in `E:\OBAD`.
2. Set `OBAD_SQL_USER` and `OBAD_SQL_PASSWORD` for that PowerShell session. Never place them in YAML or paste them into chat/logs.
3. Run:

```powershell
.\scripts\start_demo_tomorrow.ps1
```

4. Open the printed frontend URL. The Dashboard has a Historical Replay panel; open a machine to see the same incremental replay context.
5. Use the Replay controls through the API or dashboard panel: pause, resume, step, then jump to latest. The demo is SQL read-only and all output is local under `data/replay_runtime`.
6. Recovery: run `check_demo_tomorrow.ps1 -RunId <run-id>`. If a recorded service must stop, use `stop_demo_tomorrow.ps1 -RunId <run-id>`. To delete only that replay output, use `reset_demo_tomorrow.ps1 -RunId <run-id> -Confirm`.
