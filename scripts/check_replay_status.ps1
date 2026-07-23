param([Parameter(Mandatory = $true)] [string]$RunId)

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "data/replay_runtime/$RunId/checkpoint.json"
if (-not (Test-Path -LiteralPath $path)) { throw "Replay checkpoint not found: $RunId" }
Get-Content -LiteralPath $path -Raw | ConvertFrom-Json | Format-List
