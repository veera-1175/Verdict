# After connecting the GitHub repo as a Blueprint on Render, fill env vars from local files.
# Usage (with Render API key):
#   $env:RENDER_API_KEY = "rnd_..."
#   .\scripts\set-render-env.ps1 -ApiServiceId "srv-..." -WebServiceId "srv-..." -ApiUrl "https://verdict-api-xxxx.onrender.com" -WebUrl "https://verdict-web-xxxx.onrender.com"
#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$ApiServiceId,
  [string]$WebServiceId,
  [Parameter(Mandatory = $true)][string]$ApiUrl,
  [Parameter(Mandatory = $true)][string]$WebUrl
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $env:RENDER_API_KEY) { throw "Set RENDER_API_KEY first (Render Dashboard → Account Settings → API Keys)" }

function Read-DotEnv($path) {
  $map = @{}
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_.Split('=', 2)
    $map[$k.Trim()] = $v.Trim()
  }
  return $map
}

function Set-RenderEnv($serviceId, $envMap) {
  $body = @{ envVars = @($envMap.GetEnumerator() | ForEach-Object { @{ key = $_.Key; value = $_.Value } }) } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/env-vars" `
    -Headers @{ Authorization = "Bearer $($env:RENDER_API_KEY)"; Accept = "application/json"; "Content-Type" = "application/json" } `
    -Body $body | Out-Null
  Write-Host "Updated env for $serviceId"
}

$apiEnv = Read-DotEnv "$Root\apps\api\.env"
$pemPath = Join-Path $Root "github-app.pem"
$privateKey = if (Test-Path $pemPath) { (Get-Content $pemPath -Raw) -replace "`r`n", "`n" } else { $apiEnv["GITHUB_APP_PRIVATE_KEY"] }

$apiVars = @{
  VERDICT_LOCAL_DB = "true"
  WEB_ORIGIN = $WebUrl.TrimEnd("/")
  PUBLIC_DASHBOARD_URL = $WebUrl.TrimEnd("/")
  GROQ_API_KEY = $apiEnv["GROQ_API_KEY"]
  GITHUB_APP_ID = $apiEnv["GITHUB_APP_ID"]
  GITHUB_APP_PRIVATE_KEY = $privateKey
  GITHUB_WEBHOOK_SECRET = $apiEnv["GITHUB_WEBHOOK_SECRET"]
  AUTO_FAIL_SCORE_THRESHOLD = "60"
}
Set-RenderEnv $ApiServiceId $apiVars

if ($WebServiceId) {
  $slug = if (Test-Path "$Root\apps\web\.env") {
    (Read-DotEnv "$Root\apps\web\.env")["VITE_GITHUB_APP_SLUG"]
  } else { "" }
  Set-RenderEnv $WebServiceId @{
    VITE_API_URL = $ApiUrl.TrimEnd("/")
    VITE_GITHUB_APP_SLUG = $slug
  }
}

Write-Host ""
Write-Host "Done. Trigger a manual deploy in Render, then set GitHub App webhook to:"
Write-Host "  $($ApiUrl.TrimEnd('/'))/webhooks/github"
