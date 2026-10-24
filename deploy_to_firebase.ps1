# ==============================================================================
# TruckWithEase // Google Cloud & Firebase Hosting Deployment Script
# Target Hostnames: Morrishive.com & truckwithease.com
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE // GOOGLE CLOUD & FIREBASE DEPLOYMENT" -ForegroundColor Yellow
Write-Host "  Target Domains: Morrishive.com & truckwithease.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build fresh production bundle
Write-Host "[1/3] Building production SPA bundle with Vite..." -ForegroundColor White
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed with bun. Trying npm run build..." -ForegroundColor Yellow
    npm run build
}

if (-not (Test-Path "dist\index.html")) {
    Write-Host "Error: dist/index.html was not generated. Cannot deploy." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Production bundle verified in dist/" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy to Firebase Hosting
Write-Host "[2/3] Deploying to Firebase Hosting (Google Cloud)..." -ForegroundColor White
bun run firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Authentication required. Launching Google login..." -ForegroundColor Yellow
    bun run firebase login
    Write-Host "Retrying deployment..." -ForegroundColor White
    bun run firebase deploy --only hosting
}

Write-Host ""
Write-Host "[3/3] Deployment process complete." -ForegroundColor Green
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  DOMAINS POWERED BY GOOGLE CLOUD / FIREBASE:" -ForegroundColor White
Write-Host "  - https://truckwithease.com" -ForegroundColor Cyan
Write-Host "  - https://morrishive.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "Manage custom domains: https://console.firebase.google.com/" -ForegroundColor Gray
