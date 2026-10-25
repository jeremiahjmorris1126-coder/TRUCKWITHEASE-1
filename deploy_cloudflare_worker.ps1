# ==============================================================================
# TruckWithEase // Cloudflare Edge Worker Deployment Script
# Worker: truckwithease-1
# Bindings: DB (truckwithease-db), CACHE (truckwithease-cache)
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE // CLOUDFLARE WORKER DEPLOYMENT" -ForegroundColor Yellow
Write-Host "  Target Worker: truckwithease-1" -ForegroundColor Cyan
Write-Host "  D1 Database:   truckwithease-db (865e313e-dbcf-465e-9168-3d8d81936d4a)" -ForegroundColor Cyan
Write-Host "  KV Namespace:  truckwithease-cache (ee6f61b44acd473dbf5f42ca931e289f)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Check if API token is already set in environment
if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Host "Cloudflare authentication required." -ForegroundColor Yellow
    Write-Host "Options:" -ForegroundColor White
    Write-Host "  [1] Paste Cloudflare API Token (Instant non-interactive deploy)" -ForegroundColor Cyan
    Write-Host "  [2] Open Browser to authenticate with Cloudflare (wrangler login)" -ForegroundColor Cyan
    Write-Host ""
    $authChoice = Read-Host "Select option (1 or 2) [Default: 2]"
    if ([string]::IsNullOrWhiteSpace($authChoice)) { $authChoice = "2" }

    if ($authChoice -eq "1") {
        $token = Read-Host "Paste your Cloudflare API Token"
        if (-not [string]::IsNullOrWhiteSpace($token)) {
            $env:CLOUDFLARE_API_TOKEN = $token.Trim()
            Write-Host "[OK] CLOUDFLARE_API_TOKEN set for current session." -ForegroundColor Green
        } else {
            Write-Host "[!] No token entered. Falling back to browser login..." -ForegroundColor Yellow
            bunx wrangler login
        }
    } else {
        Write-Host "Opening browser for 1-click Cloudflare authorization..." -ForegroundColor Cyan
        bunx wrangler login
    }
}

# Step 2: Deploy Worker
Write-Host ""
Write-Host "Deploying truckwithease-1 to Cloudflare Global Edge..." -ForegroundColor White
bunx wrangler deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] WORKER DEPLOYED WITH D1 & KV ACTIVE!" -ForegroundColor Green
    Write-Host "  - DB binding:    truckwithease-db" -ForegroundColor White
    Write-Host "  - CACHE binding: truckwithease-cache" -ForegroundColor White
    Write-Host "  - Routes:        truckwithease.com/api/* & morrishive.com/api/*" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[!] Deployment encountered an issue. See logs above." -ForegroundColor Red
}
