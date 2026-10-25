# ==============================================================================
# TruckWithEase // Firebase Hosting Deployment Script
# Target Domains: morrishive.com & truckwithease.com
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE // FIREBASE HOSTING DEPLOYMENT" -ForegroundColor Yellow
Write-Host "  Target Domains: morrishive.com & truckwithease.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build production bundle
Write-Host "[1/3] Building production assets with Vite..." -ForegroundColor White
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build failed. Exiting." -ForegroundColor Red
    exit 1
}

# Step 2: Ensure Firebase login
Write-Host ""
Write-Host "[2/3] Checking Firebase authentication..." -ForegroundColor White
bunx firebase projects:list
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Firebase login required. Opening browser for 1-click Google authorization..." -ForegroundColor Yellow
    bunx firebase login
}

# Step 3: Deploy to Firebase Hosting
Write-Host ""
Write-Host "[3/3] Deploying to Firebase Hosting..." -ForegroundColor White
bunx firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] FIREBASE HOSTING DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "  Live on Google Cloud / Firebase Hosting edge." -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[!] Firebase deploy encountered an issue." -ForegroundColor Red
}
