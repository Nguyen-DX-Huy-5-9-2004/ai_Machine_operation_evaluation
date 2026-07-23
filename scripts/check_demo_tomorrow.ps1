param([Parameter(Mandatory = $true)] [string]$RunId, [string]$BackendUrl = 'http://127.0.0.1:8000')

Invoke-RestMethod "$BackendUrl/api/demo/readiness" | ConvertTo-Json -Depth 8
Invoke-RestMethod "$BackendUrl/api/replay/status?replay_run_id=$RunId" | ConvertTo-Json -Depth 8
