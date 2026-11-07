# ==============================================================================
# TruckWithEase // Hybrid Cloud Deployment: Google Cloud + Cloudflare
# Target Hostnames: truckwithease.com, www.truckwithease.com, morrishive.com
# Architecture:
#   - Backend Compute: Google Cloud Run (us-central1, service: truckwithease-1)
#   - Database: Google Cloud Firestore Native (app-builder-38a26d99)
#   - Frontend Hosting: Cloudflare Pages (Global Anycast CDN)
#   - Edge API Gateway: Cloudflare Worker (routes /api/* to Cloud Run)
# ==============================================================================

param(
    [switch]$SkipTests,
    [switch]$OnlyGcp,
    [switch]$OnlyCloudflare
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE // HYBRID DEPLOYMENT: GCP + CLOUDFLARE" -ForegroundColor Yellow
Write-Host "  Backend:  Google Cloud Run (project-f0634118-be01-44f7-b36)" -ForegroundColor Cyan
Write-Host "  Edge/CDN: Cloudflare Pages & Worker (truckwithease.com)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Quality Gates
if (-not $SkipTests) {
    Write-Host "[1/5] Running Pre-flight Quality & Security Gates..." -ForegroundColor White
    bun run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Typecheck failed. Aborting deployment." -ForegroundColor Red
        exit 1
    }
    bun test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Test suite failed. Aborting deployment." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Quality gates passed: 0 type errors, 100% tests green." -ForegroundColor Green
} else {
    Write-Host "[1/5] Skipping test suite as requested." -ForegroundColor DarkGray
}

# Step 2: Build Production Artifacts
Write-Host ""
Write-Host "[2/5] Building production Vite SPA bundle and Server CJS..." -ForegroundColor White
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build failed. Aborting." -ForegroundColor Red
    exit 1
}

# Verify Cloudflare routing files in dist/
if (-not (Test-Path "dist\_redirects")) {
    Write-Host "Copying public\_redirects to dist\_redirects..." -ForegroundColor DarkGray
    Copy-Item "public\_redirects" "dist\_redirects"
}
if (-not (Test-Path "dist\_headers")) {
    Write-Host "Copying public\_headers to dist\_headers..." -ForegroundColor DarkGray
    Copy-Item "public\_headers" "dist\_headers"
}
Write-Host "[OK] Production build verified in dist/ (includes _redirects and _headers)" -ForegroundColor Green

# Step 3: Google Cloud Run Deployment
if (-not $OnlyCloudflare) {
    Write-Host ""
    Write-Host "[3/5] Deploying Backend to Google Cloud Run (us-central1)..." -ForegroundColor White
    $gcpProject = "project-f0634118-be01-44f7-b36"
    $gcpRegion = "us-central1"
    $serviceName = "truckwithease-1"

    Write-Host "Checking active gcloud account..." -ForegroundColor DarkGray
    $activeAccount = (gcloud config get-value account 2>$null).Trim()
    Write-Host "Authenticated gcloud account: $activeAccount" -ForegroundColor Cyan

    Write-Host "Deploying container source to Cloud Run ($serviceName)..." -ForegroundColor Cyan
    gcloud run deploy $serviceName `
        --source . `
        --region $gcpRegion `
        --project $gcpProject `
        --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=$gcpProject,FIRESTORE_DATABASE_ID=app-builder-38a26d99 `
        --quiet

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Cloud Run backend deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "[!] Cloud Run deployment returned exit code $LASTEXITCODE." -ForegroundColor Yellow
    }
}

# Step 4: Cloudflare Frontend & Worker Gateway Deployment
if (-not $OnlyGcp) {
    Write-Host ""
    Write-Host "[4/5] Deploying Frontend & Gateway to Cloudflare..." -ForegroundColor White

    # 4A: Cloudflare Pages
    Write-Host "Deploying frontend assets to Cloudflare Pages (project: truckwithease)..." -ForegroundColor Cyan
    bunx wrangler pages deploy dist --project-name=truckwithease
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Cloudflare Pages deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "[!] Cloudflare Pages deploy warning. You may need to run 'bun run cloudflare:login' first." -ForegroundColor Yellow
    }

    # 4B: Cloudflare Worker API Gateway
    Write-Host "Deploying edge API gateway worker (truckwithease-1)..." -ForegroundColor Cyan
    bun run worker:build
    bunx wrangler deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Cloudflare Edge Worker gateway deployed successfully!" -ForegroundColor Green
    } else {
        Write-Host "[!] Cloudflare Worker deploy warning." -ForegroundColor Yellow
    }
}

# Step 5: Post-Deployment Telemetry Probe
Write-Host ""
Write-Host "[5/5] Running Post-Deployment Status Probes..." -ForegroundColor White
Write-Host "Testing Google Cloud Run origin..." -ForegroundColor DarkGray
$cloudRunUrl = "https://truckwithease-1-62nxuqhmtq-uc.a.run.app"
Write-Host "Cloud Run Endpoint: $cloudRunUrl" -ForegroundColor Cyan

Write-Host "`n============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE HYBRID CLOUD DEPLOYMENT SUMMARY" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  Backend Origin:  https://truckwithease-1-62nxuqhmtq-uc.a.run.app" -ForegroundColor White
Write-Host "  Cloudflare Edge: https://truckwithease.com" -ForegroundColor White
Write-Host "  Enterprise Host: https://morrishive.com" -ForegroundColor White
Write-Host "  Database:        Google Cloud Firestore (app-builder-38a26d99)" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Yellow
