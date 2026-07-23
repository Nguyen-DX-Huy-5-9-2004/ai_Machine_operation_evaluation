param([Parameter(Mandatory = $true)] [string]$RunId, [string]$BackendUrl = 'http://127.0.0.1:8000')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$statusPath = Join-Path $root "data/replay_runtime/demo_logs/$RunId.json"
Invoke-RestMethod -Method Post -Uri "$BackendUrl/api/replay/pause" -ContentType 'application/json' -Body (@{ replayRunId = $RunId } | ConvertTo-Json) | Out-Null
if (Test-Path -LiteralPath $statusPath) {
  $status = Get-Content $statusPath -Raw | ConvertFrom-Json
  foreach ($pid in @($status.backend_pid, $status.frontend_pid)) { if ($pid) { Stop-Process -Id $pid -ErrorAction SilentlyContinue } }
}
Write-Host "Paused file-only replay $RunId. Only processes recorded by start_demo_tomorrow.ps1 were stopped."
