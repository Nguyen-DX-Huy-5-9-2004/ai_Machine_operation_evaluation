# Windows Runtime Operations

## Setup

```powershell
cd "G:\My Drive\OBAD"
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements2.txt
python -c "import sklearn; assert sklearn.__version__ == '1.6.1'; print(sklearn.__version__)"
```

Keep `inference/online/config.local.yaml` outside version control. Use separate SQL credentials: read-only for API/worker audit, writer identity only during controlled rollout.

## Read-only Gates

```powershell
python -m inference.online.score_new_events --config inference/online/config.local.yaml --verify-runtime-relocation
python -m inference.online.score_new_events --config inference/online/config.local.yaml --production-compatibility-dry-run --dry-run-sample-path <canonical-parquet> --sample-size 500
python -m inference.online.score_new_events --config inference/online/config.local.yaml --production-multi-machine-smoke --smoke-canonical-root data/dataModel/l1_adaptation/l1_candidate_c_current/canonical --smoke-events-per-machine 50
```

## Services

API, frontend and AI worker are separate processes:

```powershell
$env:BACKEND_DATA_MODE="sql"
$env:APP_TIMEZONE="Asia/Ho_Chi_Minh"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

cd frontEnd/weldcom-ai-operations-dashboard
npm run dev

cd ../..
python -m inference.online.score_new_events --config inference/online/config.local.yaml --loop --interval-seconds 60 --dry-run
```

Stop the worker with `Ctrl+C`; it exits after the active child run. `data/runtime/online_worker.lock` prevents two local workers. Do not run this loop inside FastAPI or use Uvicorn reload as an inference scheduler.

Worker/audit output is under `data/realtime_audit`; SQL-enabled runs also write `dbo.ai_inference_run_log`. On SQL loss, leave write disabled, fix connectivity, rerun stage-only, and confirm checkpoint/result consistency before resuming.

For Task Scheduler, run one non-overlapping task under a dedicated identity with project root as working directory. A future multi-host deployment needs a SQL lease/advisory lock in addition to the local process lock.

