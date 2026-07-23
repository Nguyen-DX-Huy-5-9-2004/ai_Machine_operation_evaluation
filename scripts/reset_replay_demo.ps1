param([Parameter(Mandatory = $true)] [string]$RunId, [switch]$Confirm)

if (-not $Confirm) { throw 'Pass -Confirm to remove only this local replay run directory. SQL is never touched.' }
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "data/replay_runtime/$RunId"
if (-not (Test-Path -LiteralPath $target)) { throw "Replay run not found: $RunId" }
Remove-Item -LiteralPath $target -Recurse -Force
Write-Host "Removed local replay run $RunId. No SQL data was changed."
