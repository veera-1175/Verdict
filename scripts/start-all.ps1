#Requires -Version 5.1
# One command: start API + dashboard + ngrok tunnel
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Verdict: starting everything ===" -ForegroundColor Cyan
Write-Host ""

function Stop-PortListener($Port) {
  $line = netstat -ano | Select-String ":$Port\s.*LISTENING" | Select-Object -First 1
  if ($line -match "\s(\d+)\s*$") {
    $procId = [int]$Matches[1]
    if ($procId -gt 0) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
    }
  }
}

# Ensure .env exists
if (-not (Test-Path "apps\api\.env")) {
  Write-Host "No .env found - running setup first..." -ForegroundColor Yellow
  & "$Root\scripts\setup.ps1"
}

Stop-PortListener 3001

Write-Host "[1/3] Starting API on :3001..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:api" -WorkingDirectory $Root -WindowStyle Minimized

Write-Host "[2/3] Starting dashboard on :5173..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:web" -WorkingDirectory $Root -WindowStyle Minimized

Write-Host "[3/3] Starting ngrok tunnel (static domain)..."
# Free ngrok dev domain - keeps GitHub webhook URL stable across restarts
$NgrokDomain = if ($env:NGROK_DOMAIN) { $env:NGROK_DOMAIN } else { "annoying-dealmaker-gerbil.ngrok-free.dev" }
Start-Process -FilePath "ngrok" -ArgumentList "http","--url=$NgrokDomain","3001","--log=stdout" -WindowStyle Minimized

Start-Sleep -Seconds 6

$health = $null
for ($i = 0; $i -lt 15; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 2
    if ($health.ok) { break }
  } catch { Start-Sleep -Seconds 1 }
}

$ngrokUrl = $null
for ($i = 0; $i -lt 10; $i++) {
  try {
    $ngrokUrl = (Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2).tunnels[0].public_url
    if ($ngrokUrl) { break }
  } catch { Start-Sleep -Seconds 1 }
}

Write-Host ""
Write-Host "=== Verdict is running ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://localhost:5173"
Write-Host "  API health: http://localhost:3001/health"
if ($ngrokUrl) {
  Write-Host "  Webhook:    $ngrokUrl/webhooks/github" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Paste the Webhook URL in GitHub App settings (one-time)." -ForegroundColor DarkGray
} else {
  Write-Host "  ngrok:      not detected - install from https://ngrok.com" -ForegroundColor Yellow
}
Write-Host ""
if ($health.githubApp) {
  Write-Host "  GitHub App: configured" -ForegroundColor Green
  Write-Host "  Install:    http://localhost:5173/settings"
} else {
  Write-Host "  GitHub App: not configured yet - see SETUP.txt" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Developers: just open a PR. Verdict runs automatically." -ForegroundColor Cyan
Write-Host "  Leave this PC on while reviewing PRs (local mode)." -ForegroundColor DarkGray
Write-Host ""
