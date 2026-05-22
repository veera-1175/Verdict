#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Verdict setup ===" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing npm packages..."
  npm install
}

$apiEnv = Join-Path $Root "apps\api\.env"
$webEnv = Join-Path $Root "apps\web\.env"
$verifAiEnv = Join-Path $Root "..\verifAI\backend\.env"

Copy-Item (Join-Path $Root "apps\api\.env.template") $apiEnv -Force
Copy-Item (Join-Path $Root "apps\web\.env.template") $webEnv -Force

if (Test-Path $verifAiEnv) {
  Write-Host "Copying LLM keys from verifAI..."
  $lines = Get-Content $verifAiEnv
  $groq = ($lines | Where-Object { $_ -match "^GROQ_API_KEY=" }) -replace "^GROQ_API_KEY=", ""
  $gemini = ($lines | Where-Object { $_ -match "^GEMINI_API_KEY=" }) -replace "^GEMINI_API_KEY=", ""
  if ($groq) {
    (Get-Content $apiEnv) -replace "^GROQ_API_KEY=.*", "GROQ_API_KEY=$groq" | Set-Content $apiEnv
  }
  if ($gemini) {
    (Get-Content $apiEnv) -replace "^GEMINI_API_KEY=.*", "GEMINI_API_KEY=$gemini" | Set-Content $apiEnv
  }
}

Write-Host "Building..."
npm run build

Write-Host "Starting API on port 3001..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:api" -WorkingDirectory $Root -WindowStyle Hidden

Start-Sleep -Seconds 5

$healthy = $false
$health = $null
for ($i = 0; $i -lt 20; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 3
    if ($health.ok) { $healthy = $true; break }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $healthy) {
  Write-Host "API did not start. Run manually: npm run dev:api" -ForegroundColor Yellow
  exit 1
}

Write-Host ("API healthy. localDb={0} groq={1}" -f $health.localDb, $health.llm.groq)

Write-Host "Running demo PR review (6 agents + master, ~30-60s)..."
try {
  $demo = Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/dev/demo-review" -TimeoutSec 300
  Write-Host "Demo complete!" -ForegroundColor Green
  Write-Host $demo.dashboardUrl
} catch {
  Write-Host ("Demo review failed: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
}

Write-Host "Starting web on port 5173..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:web" -WorkingDirectory $Root -WindowStyle Hidden

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "=== Verdict is running ===" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:5173"
Write-Host "API:       http://localhost:3001/health"
