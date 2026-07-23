param([Parameter(Mandatory = $true)] [string]$RunId, [switch]$Confirm)

& "$PSScriptRoot/reset_replay_demo.ps1" -RunId $RunId -Confirm:$Confirm
