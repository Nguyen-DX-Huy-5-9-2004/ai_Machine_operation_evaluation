param(
  [Parameter(Mandatory = $true)] [string]$RunId,
  [string]$ApiBaseUrl = 'http://127.0.0.1:8000'
)

$body = @{ replayRunId = $RunId } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/replay/pause" -ContentType 'application/json' -Body $body
