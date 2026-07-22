param(
    [int]$MaxEvents = 500,
    [string]$ConfigPath = "inference/online/config.local.yaml"
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $workspace ".venv\Scripts\python.exe"
$auditRoot = Join-Path $workspace "data\realtime_audit"

if ($MaxEvents -lt 1 -or $MaxEvents -gt 500) {
    throw "MaxEvents must be between 1 and 500."
}
if (-not (Test-Path -LiteralPath $python)) {
    throw "Expected project interpreter was not found: $python"
}

$before = @(Get-ChildItem -LiteralPath $auditRoot -Directory -Filter "run_*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
Push-Location $workspace
try {
    # Read-only bounded inference: no loop, no checkpoint, no run log and no SQL writer flag.
    & $python -m inference.online.score_new_events --config $ConfigPath --dry-run --audit --max-events $MaxEvents
    if ($LASTEXITCODE -ne 0) {
        throw "Bounded dry-run exited with code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$after = @(Get-ChildItem -LiteralPath $auditRoot -Directory -Filter "run_*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$created = @($after | Where-Object { $_ -notin $before } | Sort-Object -Descending | Select-Object -First 1)
if ($created.Count -ne 1) {
    throw "The bounded dry-run did not produce exactly one audit directory."
}

$target = Join-Path $auditRoot ("online_bounded_inference_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
Move-Item -LiteralPath $created[0] -Destination $target
Write-Output "Bounded dry-run audit: $target"
