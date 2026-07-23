param(
  [Parameter(Mandatory = $true)] [string]$Start,
  [string]$End,
  [ValidateSet('realtime_1x', 'demo_fast', 'demo_tomorrow', 'demo_very_fast', 'manual_step')] [string]$Preset = 'demo_fast',
  [int]$Ticks = 1,
  [string]$RunId
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$arguments = @('-m', 'inference.replay.run', '--config', 'inference/online/config.replay.local.yaml', '--mode', 'file-only', '--preset', $Preset, '--start', $Start, '--ticks', $Ticks, '--audit')
if ($End) { $arguments += @('--end', $End) }
if ($RunId) { $arguments += @('--run-id', $RunId) }
& .\.venv\Scripts\python.exe @arguments
