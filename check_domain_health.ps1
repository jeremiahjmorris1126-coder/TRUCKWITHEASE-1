# ==============================================================================
# Domain Health & Live Telemetry Inspector
# Tests: morrishive.com, www.morrishive.com, truckwithease.com
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  DOMAIN HEALTH & LIVE ROUTING TELEMETRY" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

$domains = @("morrishive.com", "www.morrishive.com", "truckwithease.com", "www.truckwithease.com")

foreach ($domain in $domains) {
    Write-Host "[$domain]" -ForegroundColor Cyan
    
    # 1. Check DNS resolution
    $dns = Resolve-DnsName -Name $domain -ErrorAction SilentlyContinue
    if (-not $dns) {
        Write-Host "  [DNS FAIL] Domain has NO DNS record! Browser will show NXDOMAIN / Server Not Found." -ForegroundColor Red
        Write-Host ""
        continue
    }

    $ips = ($dns | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress) -join ", "
    if (-not $ips) {
        $ips = ($dns | Where-Object { $_.IP4Address } | Select-Object -ExpandProperty IP4Address) -join ", "
    }
    Write-Host "  [DNS OK] Resolved IPs: $ips" -ForegroundColor Green

    # 2. Check HTTP / HTTPS response
    try {
        $curlOutput = curl.exe -Iv -k --max-redirs 0 "https://$domain" 2>&1
        $statusLine = $curlOutput | Where-Object { $_ -match "^<\s*HTTP/" } | Select-Object -First 1
        $locLine = $curlOutput | Where-Object { $_ -match "^<\s*Location:" } | Select-Object -First 1

        if ($statusLine -match "301|302") {
            Write-Host "  [REDIRECT DETECTED] $statusLine" -ForegroundColor Yellow
            Write-Host "  $locLine" -ForegroundColor Yellow
            if ($locLine -notmatch "https://") {
                Write-Host "  [CRITICAL ERROR] Location header lacks https:// protocol -> Causes ERR_TOO_MANY_REDIRECTS loop!" -ForegroundColor Red
            }
        } elseif ($statusLine -match "200") {
            Write-Host "  [HTTP OK] $statusLine (Site is online and responding cleanly)" -ForegroundColor Green
        } else {
            Write-Host "  [HTTP STATUS] $statusLine" -ForegroundColor White
        }
    } catch {
        Write-Host "  [HTTP ERROR] Could not connect: $_" -ForegroundColor Red
    }
    Write-Host ""
}
