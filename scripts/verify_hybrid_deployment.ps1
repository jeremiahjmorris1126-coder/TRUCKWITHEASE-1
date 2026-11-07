$ErrorActionPreference = "Stop"

$CLOUD_RUN_URL = "https://truckwithease-1-62nxuqhmtq-uc.a.run.app"
$PAGES_URL = "https://truckwithease.pages.dev"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "TRUCKWITHEASE HYBRID GCP + CLOUDFLARE VERIFICATION SUITE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

function Assert-Endpoint {
    param (
        [string]$Name,
        [string]$Url,
        [string]$ExpectedStatus,
        [string]$ExpectedJsonProp,
        [string]$ExpectedJsonVal
    )

    Write-Host "`n[$Name] Testing: $Url" -ForegroundColor Yellow
    try {
        $response = curl.exe -s -w "`nSTATUS:%{http_code}" $Url
        $lines = $response -split "`n"
        $statusLine = ($lines | Where-Object { $_ -like "STATUS:*" })
        $status = $statusLine.Replace("STATUS:", "").Trim()
        $body = ($lines | Where-Object { $_ -notlike "STATUS:*" }) -join ""

        Write-Host "HTTP Status: $status (Expected: $ExpectedStatus)"
        if ($status -ne $ExpectedStatus) {
            Write-Host "[FAIL] Status mismatch on $Url. Got $status, expected $ExpectedStatus" -ForegroundColor Red
            return $false
        }

        if ($ExpectedJsonProp) {
            $json = $body | ConvertFrom-Json
            $actualVal = "$($json.$ExpectedJsonProp)"
            if ($actualVal -ne $ExpectedJsonVal) {
                Write-Host "[FAIL] Property '$ExpectedJsonProp' had '$actualVal', expected '$ExpectedJsonVal'" -ForegroundColor Red
                return $false
            }
            Write-Host "[PASS] Property '$ExpectedJsonProp' = '$actualVal'" -ForegroundColor Green
        }

        Write-Host "[PASS] $Name verified successfully." -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[FAIL] Error probing ${Url}: $_" -ForegroundColor Red
        return $false
    }
}

$allPassed = $true

# 1. Cloud Run Direct Ingress
$allPassed = (Assert-Endpoint -Name "Cloud Run Root Health" -Url "$CLOUD_RUN_URL/health" -ExpectedStatus "200" -ExpectedJsonProp "ok" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloud Run Root Ready" -Url "$CLOUD_RUN_URL/ready" -ExpectedStatus "200" -ExpectedJsonProp "ready" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloud Run API Ready" -Url "$CLOUD_RUN_URL/api/ready" -ExpectedStatus "200" -ExpectedJsonProp "ready" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloud Run API Pricing" -Url "$CLOUD_RUN_URL/api/pricing" -ExpectedStatus "200" -ExpectedJsonProp "status" -ExpectedJsonVal "OK") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloud Run Unknown API (Fail-Closed 404)" -Url "$CLOUD_RUN_URL/api/unknown-probe-endpoint" -ExpectedStatus "404") -and $allPassed

# 2. Cloudflare Pages Edge Gateway
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Root SPA" -Url "$PAGES_URL/" -ExpectedStatus "200") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Edge Health" -Url "$PAGES_URL/health" -ExpectedStatus "200" -ExpectedJsonProp "ok" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Edge Ready" -Url "$PAGES_URL/ready" -ExpectedStatus "200" -ExpectedJsonProp "ready" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Edge API Ready" -Url "$PAGES_URL/api/ready" -ExpectedStatus "200" -ExpectedJsonProp "ready" -ExpectedJsonVal "True") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Edge API Pricing" -Url "$PAGES_URL/api/pricing" -ExpectedStatus "200" -ExpectedJsonProp "status" -ExpectedJsonVal "OK") -and $allPassed
$allPassed = (Assert-Endpoint -Name "Cloudflare Pages Edge Unknown API 404" -Url "$PAGES_URL/api/unknown-probe-endpoint" -ExpectedStatus "404") -and $allPassed

Write-Host "`n============================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "ALL HYBRID DEPLOYMENT INVARIANTS VERIFIED SUCCESSFULLY (PASS)" -ForegroundColor Green
    Write-Host "Google Cloud Run (Compute/Backend) + Cloudflare (Edge/Hosting) are live and connected." -ForegroundColor Green
} else {
    Write-Host "ONE OR MORE VERIFICATION CHECKS FAILED." -ForegroundColor Red
    exit 1
}
Write-Host "============================================================" -ForegroundColor Cyan
