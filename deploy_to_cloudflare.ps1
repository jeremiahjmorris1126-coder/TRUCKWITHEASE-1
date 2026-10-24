# ==============================================================================
# TruckWithEase // Cloudflare Pages Deployment & Export Script
# Target Hostnames: Morrishive.com & truckwithease.com
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  TRUCKWITHEASE // CLOUDFLARE PAGES EXPORT & DEPLOYMENT" -ForegroundColor Yellow
Write-Host "  Target Domains: Morrishive.com & truckwithease.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# Step 1: Ensure dependencies and build fresh production bundle
Write-Host "[1/4] Building production SPA bundle..." -ForegroundColor White
bun run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Trying npm run build..." -ForegroundColor Yellow
    npm run build
}

if (-not (Test-Path "dist\index.html")) {
    Write-Host "Error: dist/index.html was not generated." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Production bundle verified in dist/" -ForegroundColor Green
Write-Host "     - public/_redirects included: $(Test-Path 'dist\_redirects')" -ForegroundColor Gray
Write-Host "     - public/_headers included:   $(Test-Path 'dist\_headers')" -ForegroundColor Gray
Write-Host ""

# Step 2: Bundle standalone production tar.gz archive
Write-Host "[2/4] Packaging self-contained production archive..." -ForegroundColor White
tar -czf truckwithease-cloudflare-production-package.tar.gz --exclude=node_modules --exclude=.git --exclude=.gemini --exclude=AppStore_Assets_* --exclude=iPhone_* .
Write-Host "[OK] Archive created: truckwithease-cloudflare-production-package.tar.gz" -ForegroundColor Green
Write-Host ""

# Step 3: Choose deployment route
Write-Host "[3/4] Choose how you want to send/export to Cloudflare:" -ForegroundColor Yellow
Write-Host "  1. Direct CLI Deploy with Cloudflare Wrangler (npx wrangler pages deploy)" -ForegroundColor Cyan
Write-Host "  2. Push code to GitHub (origin/main) to trigger Cloudflare Git integration" -ForegroundColor Cyan
Write-Host "  3. Generate export archive only (already saved as .tar.gz)" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Select option (1, 2, or 3) [Default: 1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Deploying directly to Cloudflare Pages (project: truckwithease)..." -ForegroundColor White
    bunx wrangler pages deploy dist --project-name=truckwithease
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Falling back to npx wrangler..." -ForegroundColor Yellow
        npx wrangler pages deploy dist --project-name=truckwithease
    }
}
elseif ($choice -eq "2") {
    Write-Host ""
    $token = Read-Host "Enter your GitHub Personal Access Token (PAT) [Leave blank to use git credential helper]"
    $branch = $(git rev-parse --abbrev-ref HEAD).Trim()
    if (-not [string]::IsNullOrWhiteSpace($token)) {
        $remote = "https://${token}@github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1.git"
        Write-Host "Pushing to GitHub via authenticated PAT..." -ForegroundColor Cyan
        git push "$remote" "$branch"
    } else {
        Write-Host "Pushing to origin/$branch..." -ForegroundColor Cyan
        git push origin "$branch"
    }
    Write-Host "GitHub push finished. Cloudflare Pages CI/CD will now trigger automatically!" -ForegroundColor Green
}
else {
    Write-Host "Export package ready: $(Resolve-Path truckwithease-cloudflare-production-package.tar.gz)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  DOMAINS ACTIVE IN CLOUDFLARE:" -ForegroundColor White
Write-Host "  - https://truckwithease.com" -ForegroundColor Cyan
Write-Host "  - https://morrishive.com" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Yellow
