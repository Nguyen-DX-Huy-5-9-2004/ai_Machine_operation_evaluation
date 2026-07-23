param(
  [string]$BackendUrl = 'http://127.0.0.1:8000',
  [string]$FrontendUrl = 'http://127.0.0.1:4173',
  [string]$RunId = ("demo_tomorrow_" + (Get-Date -Format 'yyyyMMdd_HHmmss')),
  # Restarting only the exact project uvicorn command makes source changes
  # effective while preserving the caller's credential-only environment.
  [bool]$RestartBackend = $true,
  [bool]$Follow = $true
)

$ErrorActionPreference = 'Stop'
# Keep the live L1/L2/Policy explanation readable in a Vietnamese Windows
# terminal. Credentials are never echoed by this script.
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if ([string]::IsNullOrWhiteSpace($env:OBAD_SQL_USER) -or [string]::IsNullOrWhiteSpace($env:OBAD_SQL_PASSWORD)) {
  throw 'OBAD_SQL_USER and OBAD_SQL_PASSWORD must be SET in this PowerShell process. No service was started.'
}

$logRoot = Join-Path $root 'data/replay_runtime/demo_logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
& .\.venv\Scripts\python.exe -m inference.replay.preflight --config inference/online/config.replay.local.yaml --select-profile
if ($LASTEXITCODE -ne 0) { throw 'Read-only preflight/profile selection failed.' }

function Start-ObadReplayBackend {
  $backend = Start-Process -FilePath .\.venv\Scripts\python.exe -ArgumentList '-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'backend.out.log') -RedirectStandardError (Join-Path $logRoot 'backend.err.log') -PassThru
  Start-Sleep -Seconds 2
  return $backend
}

if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) {
  $backend = Start-ObadReplayBackend
} else {
  $backend = $null
  $listener = Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -First 1
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($process.CommandLine -notmatch 'uvicorn\s+backend\.app\.main:app') {
    throw 'Port 8000 is owned by a process other than the OBAD backend. It was left untouched.'
  }
  if ($RestartBackend) {
    Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 20 -and (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); $attempt++) {
      Start-Sleep -Milliseconds 250
    }
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
      throw 'The OBAD backend did not release port 8000 in time.'
    }
    $backend = Start-ObadReplayBackend
  } else {
  try {
    $replayInfo = Invoke-RestMethod -Uri "$BackendUrl/api/replay/info" -TimeoutSec 3
    if ($replayInfo.data.replayApiVersion -ne '4' -or -not $replayInfo.data.rangeBounded -or -not $replayInfo.data.warmStart) {
      # The old process can only contain stale Python modules. It is the exact
      # backend command started by this project, so restart it under the
      # caller's current environment (including credentials, never printed).
      Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
      for ($attempt = 0; $attempt -lt 20 -and (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); $attempt++) {
        Start-Sleep -Milliseconds 250
      }
      if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
        throw 'The stale OBAD backend did not release port 8000 in time.'
      }
      $backend = Start-ObadReplayBackend
    }
  } catch {
    if ($_.Exception.Message -match 'Port 8000 is owned') { throw }
    throw 'An existing backend on port 8000 is incompatible and could not be safely restarted. Stop only the OBAD uvicorn backend, then rerun this command.'
  }
  }
}
if ((Invoke-WebRequest -UseBasicParsing "$BackendUrl/health").StatusCode -ne 200) { throw 'Backend health check failed.' }

$profile = Get-Content (Join-Path $root 'data/replay_runtime/demo_profile_tomorrow.json') -Raw | ConvertFrom-Json
$body = @{ replayStartTime = $profile.replay_start_time; replayEndTime = $profile.replay_end_time; preset = 'demo_tomorrow'; runId = $RunId; autoRun = $true; warmStart = $true } | ConvertTo-Json
$start = Invoke-RestMethod -Method Post -Uri "$BackendUrl/api/replay/start" -ContentType 'application/json' -Body $body
$warm = $start.data.warm_start

if (-not (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)) {
  $oldRun = $env:VITE_REPLAY_RUN_ID; $env:VITE_REPLAY_RUN_ID = $RunId
  $frontend = Start-Process -FilePath npm.cmd -ArgumentList 'exec','vite','--','--mode','api','--host','127.0.0.1','--port','4173' -WorkingDirectory (Join-Path $root 'frontEnd/weldcom-ai-operations-dashboard') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'frontend.out.log') -RedirectStandardError (Join-Path $logRoot 'frontend.err.log') -PassThru
  $env:VITE_REPLAY_RUN_ID = $oldRun
  Start-Sleep -Seconds 2
} else { $frontend = $null }
if ((Invoke-WebRequest -UseBasicParsing $FrontendUrl).StatusCode -ne 200) { throw 'Frontend health check failed.' }

$status = @{ replay_run_id = $RunId; backend_pid = if ($backend) { $backend.Id } else { $null }; frontend_pid = if ($frontend) { $frontend.Id } else { $null }; backend_url = $BackendUrl; frontend_url = $FrontendUrl; profile = $profile; started = $start.data; logs = $logRoot }
$status | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $logRoot "$RunId.json")
Write-Host "Backend: $BackendUrl"
Write-Host "Frontend: $FrontendUrl"
Write-Host "Replay run: $RunId"
Write-Host "Virtual time: $($start.data.virtual_time)"
Write-Host "Cadence: 5 real seconds = 5 source minutes"
if ($warm) {
  $metrics = $warm.batch_metrics
  Write-Host "AI warm batch: $($metrics.batch_size) events | L1 ready $($warm.l1_ready_count) / unready $($warm.l1_unready_count) | L2 ready $($warm.l2_ready_count) | Policy ready $($warm.policy_ready_count)"
  Write-Host "AI latency: canonical $($metrics.canonical_feature_latency_ms) ms | L1 $($metrics.l1_latency_ms) ms | L2 + policy $($metrics.l2_policy_latency_ms) ms | total $($metrics.total_processing_latency_ms) ms"
}
Write-Host "Profile: data/replay_runtime/demo_profile_tomorrow.json"
Write-Host "Live batch metrics: data/replay_runtime/$RunId/metrics.jsonl"
Write-Host "Logs: $logRoot"
Write-Host "Replay runs file-only in the background. Ctrl+C stops this log view only; it does not stop the replay."
if ($Follow) {
  $activityPath = Join-Path $root "data/replay_runtime/$RunId/activity.jsonl"
  Write-Host "Streaming AI activity from $activityPath"
  Get-Content -LiteralPath $activityPath -Tail 1 -Wait | ForEach-Object {
    try {
      $activity = $_ | ConvertFrom-Json
      Write-Host ("[{0}] batch {1} | virtual {2} | input {3} | L1 ready {4}/{5} | L2 {6} | Policy {7} | {8} ms" -f $activity.phase, $activity.batch_sequence, $activity.virtual_time, $activity.batch_size, $activity.l1_ready_count, ($activity.l1_ready_count + $activity.l1_unready_count), $activity.l2_ready_count, $activity.policy_ready_count, $activity.latency_ms.total)
      if ($activity.sample) {
        $input = $activity.sample.input
        $l1 = $activity.sample.l1
        $l2 = $activity.sample.l2
        $policy = $activity.sample.policy
        Write-Host ("  Input  event={0} machine={1} status={2} duration={3}s gap={4}s kwh_delta={5}" -f $activity.sample.event_id, $activity.sample.machine_id, $input.status_id, $input.duration_sec, $input.gap_from_prev_sec, $input.kwh_delta)
        Write-Host ("  L1     lenient={0}/{1} strict={2}/{3} anomaly={4} sensitive={5}" -f $l1.lenient_normalized, $l1.lenient_threshold, $l1.strict_normalized, $l1.strict_threshold, $l1.anomaly, $l1.sensitive_warning)
        Write-Host ("  L2     fault_30m={0} fault_60m={1} maintenance={2} repair={3}" -f $l2.fault_30min, $l2.fault_60min, $l2.maintenance_30_events, $l2.repair_30_events)
        Write-Host ("  Policy ready={0} action={1} judgment={2} quality={3} reason={4}" -f $policy.ready, $policy.action_level, $policy.judgment, $policy.quality_judgment, $policy.reason)
        <# Legacy UTF-8 output below is retained only for local history. #>
        <#
        # This PowerShell file is intentionally ASCII so Windows PowerShell 5
        # can parse it without depending on the console code page. The UTF-8
        # literals are reconstructed only for terminal output.
        function From-Utf8Base64([string]$value) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value)) }
        $l1Narrative = if ($l1Score -ge $l1Threshold) { From-Utf8Base64 'TDEgcGjDoXQgaGnhu4duIMSRaeG7g20gbOG7h2NoIHbGsOG7o3QgbmfGsOG7oW5nIHbhuq1uIGjDoG5oOyBj4bqnbiDEkeG7kWkga2nhu4NtIHRy4bqhbmcgdGjDoWkgdsOgIGNodeG7l2kgc-G7sSBraeG7h24gZ-G6p24gbsOibiBuaOG6pXQu' } else { From-Utf8Base64 'TDEgxJHDoSBkxINuZyBnacOhIGPhu61hIHPhu7Egc-G7sSBz4buxIGtp4buHbiB2w6AgY2jGsMahIHbGsOG7o3QgbmfGsOG7oW5nIGLhuqV0IHRoxrDhu51uZyB24bqtbiBoYW5oLg==' }
        $l2Narrative = (From-Utf8Base64 'TDIgxJHDoW5oIGdpw6EgxJHhu5NuZyB0aOG7nWkgc8OhdSBy4bunIHJvOyBmYXVsdCAzMCBwaMO6dD17MH0sIGLhuqNvIHRyw6w9ezF9LCBz4butYSBjaOG7r2E9ezJ9Lg==') -f $l2.fault_30min, $l2.maintenance_30_events, $l2.repair_30_events
        $policyNarrative = if ($policy.ready) { (From-Utf8Base64 'UG9saWN5IHYyIMSRw6Mgc-G6tW4gc8OgbmcgdsOgIMSRxrphIHJhIG3hu6ljIGjDoG5oIMSR4buZbmcgezB9Lg==') -f $policy.action_level } else { From-Utf8Base64 'UG9saWN5IHYyIGNowrBhIHM6bmkgc8OgbmcsIHbDrCB24bq15SBraMO0bmcgdOG6oW8ga-G6v3QgbHXhuq1uIHbhuq1uIGjDoG5oLg==' }
        Write-Host ((From-Utf8Base64 'ICBHaeG6o2kgdGjDrWNoIEwxOiB7MH0=') -f $l1Narrative)
        Write-Host ((From-Utf8Base64 'ICBHaeG6o2kgdGjDrWNoIEwyOiB7MH0=') -f $l2Narrative)
        Write-Host ((From-Utf8Base64 'ICBL4bq_dCBsdeG6rW4gY2jDrW5oIHPDoWNoOiB7MH0gQ2jhuqV0IGzGsOG7o25nIGThu78gbGnhu4d1PXsxfS4=') -f $policyNarrative, $policy.quality_judgment)
        #>
        $l1Score = [double]$l1.lenient_normalized
        $l1Threshold = [double]$l1.lenient_threshold
        $l1Narrative = if ($l1Score -ge $l1Threshold) { 'L1 detected a deviation above the operational threshold; review state and recent events.' } else { 'L1 evaluated the event window and remains below the operational anomaly threshold.' }
        $l2Narrative = "L2 evaluated six risks; fault 30 min=$($l2.fault_30min), maintenance=$($l2.maintenance_30_events), repair=$($l2.repair_30_events)."
        $policyNarrative = if ($policy.ready) { "Policy v2 is ready and selected action $($policy.action_level)." } else { 'Policy v2 is not ready, so no operational conclusion is issued.' }
        Write-Host "  L1 explanation: $l1Narrative"
        Write-Host "  L2 explanation: $l2Narrative"
        Write-Host "  Policy explanation: $policyNarrative Data quality=$($policy.quality_judgment)."
        <#
        $l1Score = [double]$l1.lenient_normalized
        $l1Threshold = [double]$l1.lenient_threshold
        $l1Narrative = if ($l1Score -ge $l1Threshold) { 'L1 phát hiện điểm lệch vượt ngưỡng vận hành; cần đối chiếu trạng thái và chuỗi sự kiện gần nhất.' } else { 'L1 đã đánh giá cửa sổ sự kiện và chưa vượt ngưỡng bất thường vận hành.' }
        $l2Narrative = "L2 đánh giá đồng thời sáu rủi ro; fault 30 phút=$($l2.fault_30min), bảo trì=$($l2.maintenance_30_events), sửa chữa=$($l2.repair_30_events)."
        $policyNarrative = if ($policy.ready) { "Policy v2 đã sẵn sàng và đưa ra mức hành động $($policy.action_level)." } else { 'Policy v2 chưa sẵn sàng, vì vậy không tạo kết luận vận hành.' }
        Write-Host "  Giải thích L1: $l1Narrative"
        Write-Host "  Giải thích L2: $l2Narrative"
        Write-Host "  Kết luận chính sách: $policyNarrative Chất lượng dữ liệu=$($policy.quality_judgment)."
        #>
      }
    } catch { Write-Host $_ }
  }
}
