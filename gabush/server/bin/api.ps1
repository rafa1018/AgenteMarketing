# Local API smoke tester (development only). Signs in with the LOCAL admin of admin-credentials.local.txt
# (never printed) and calls the v2 API.
#   powershell -File server/bin/api.ps1 GET /setup
#   powershell -File server/bin/api.ps1 POST /years '{"year":2027,"copyFrom":2026}'
param([string]$Method = 'GET', [string]$Path = '/setup', [string]$Body = '', [string]$Base = 'http://127.0.0.1:8021', [int]$Depth = 4, [switch]$Raw)
$lines = Get-Content (Join-Path $PSScriptRoot '../../admin-credentials.local.txt')
$user = ($lines | Where-Object { $_ -match '^Usuario:\s*(\S+)' } | Select-Object -First 1) -replace '^Usuario:\s*', ''
$pass = ($lines | Where-Object { $_ -match '^Contrasena:\s*(\S+)' } | Select-Object -First 1) -replace '^Contrasena:\s*', ''
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod -Method Post -Uri "$Base/api/auth.php" -WebSession $s -ContentType 'application/json' -Body (@{ action = 'login'; user = $user; password = $pass } | ConvertTo-Json)
if (-not $login.ok) { 'LOGIN FAILED'; exit 1 }
$h = @{ 'X-CSRF-Token' = $login.csrf }
try {
  $args2 = @{ Method = $Method; Uri = "$Base/api/v2$Path"; WebSession = $s; Headers = $h; UseBasicParsing = $true }
  if ($Body) { $args2.ContentType = 'application/json; charset=utf-8'; $args2.Body = [Text.Encoding]::UTF8.GetBytes($Body) }
  $r = Invoke-WebRequest @args2
  $text = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
} catch {
  $resp = $_.Exception.Response
  $text = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)).ReadToEnd() } else { $_.Exception.Message }
  "HTTP ERROR"
}
if ($Raw) { $text } else { $text | ConvertFrom-Json | ConvertTo-Json -Depth $Depth }
