$ErrorActionPreference = "Stop"
$SERVICE_URL = "https://truckwithease-1-405307027459.us-central1.run.app"
$PROJECT_ID = "project-f0634118-be01-44f7-b36"
$REGION = "us-central1"

Write-Host "============================================================"
Write-Host "POST-DEPLOY INVARIANT VERIFICATION"
Write-Host "============================================================"

# TEST 1: Request with NO token must be blocked by Google (403 Forbidden)
Write-Host "`n--- TEST 1: PUBLIC REQUEST BLOCKED BY GOOGLE EDGE ---"
$unauthStatus = & curl.exe -s -o nul -w "%{http_code}" "$SERVICE_URL/health"
Write-Host "GET $SERVICE_URL/health (No Auth) -> HTTP $unauthStatus"
if ($unauthStatus -eq "403") {
  Write-Host "[PASS] Google Edge blocked uncredentialed caller with HTTP 403 Forbidden." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Service leaked response without IAM token! Got: $unauthStatus" -ForegroundColor Red
  exit 1
}

# TEST 2: Service describe shows invoker IAM enabled
Write-Host "`n--- TEST 2: SERVICE DESCRIBE IAM AUDIT ---"
$describeYaml = gcloud run services describe truckwithease-1 --region $REGION --project $PROJECT_ID --format="yaml(metadata.annotations)"
Write-Host $describeYaml
if ($describeYaml -match "run.googleapis.com/invoker-iam-disabled: 'true'") {
  Write-Host "[FAIL] Invoker IAM is disabled!" -ForegroundColor Red
  exit 1
} else {
  Write-Host "[PASS] Invoker IAM is ENABLED." -ForegroundColor Green
}

# Acquire Cloud Run Identity Token
Write-Host "`nAcquiring identity token for private probing..."
$ID_TOKEN = (gcloud auth print-identity-token).Trim()

# TEST 3: /health returns 200
Write-Host "`n--- TEST 3: /health -> 200 ---"
$healthCode = & curl.exe -s -o nul -w "%{http_code}" -H "X-Serverless-Authorization: Bearer $ID_TOKEN" "$SERVICE_URL/health"
Write-Host "GET /health -> HTTP $healthCode (Expected: 200)"
if ($healthCode -eq "200") {
  Write-Host "[PASS] Health probe OK." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Expected 200, got: $healthCode" -ForegroundColor Red
  exit 1
}

# TEST 4: Unknown /api path returns JSON 404
Write-Host "`n--- TEST 4: Unknown /api Path -> JSON 404 ---"
$unknownOutput = & curl.exe -s -w "`nSTATUS:%{http_code}" -H "X-Serverless-Authorization: Bearer $ID_TOKEN" "$SERVICE_URL/api/nonexistent-route-audit"
Write-Host "GET /api/nonexistent-route-audit -> $unknownOutput"
if ($unknownOutput -match "STATUS:404" -and $unknownOutput -match "API endpoint not found") {
  Write-Host "[PASS] Fail-closed JSON 404 returned." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Expected 404 JSON" -ForegroundColor Red
  exit 1
}

# TEST 5: test_token_ returns 403
Write-Host "`n--- TEST 5: Legacy test_token_ Attempt -> 403 ---"
$testTokenCode = & curl.exe -s -o nul -w "%{http_code}" -H "X-Serverless-Authorization: Bearer $ID_TOKEN" -H "Authorization: Bearer test_token_benchowner_FLEET1_owner" "$SERVICE_URL/api/loads"
Write-Host "GET /api/loads (test_token_) -> HTTP $testTokenCode (Expected: 403)"
if ($testTokenCode -eq "403") {
  Write-Host "[PASS] test_token_ strictly rejected with 403 Forbidden." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Expected 403, got: $testTokenCode" -ForegroundColor Red
  exit 1
}

# TEST 6: /api/loads with no app token returns 401
Write-Host "`n--- TEST 6: /api/loads with No App Token -> 401 ---"
$noAppTokenCode = & curl.exe -s -o nul -w "%{http_code}" -H "X-Serverless-Authorization: Bearer $ID_TOKEN" "$SERVICE_URL/api/loads"
Write-Host "GET /api/loads (No App Token) -> HTTP $noAppTokenCode (Expected: 401)"
if ($noAppTokenCode -eq "401") {
  Write-Host "[PASS] Missing app token rejected with 401 Unauthorized." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Expected 401, got: $noAppTokenCode" -ForegroundColor Red
  exit 1
}

# TEST 7: /voice with no Twilio signature returns 403
Write-Host "`n--- TEST 7: /voice with No Twilio Signature -> 403 ---"
$twilioCode = & curl.exe -s -o nul -w "%{http_code}" -X POST -H "X-Serverless-Authorization: Bearer $ID_TOKEN" "$SERVICE_URL/voice"
Write-Host "POST /voice (No Twilio Sig) -> HTTP $twilioCode (Expected: 403)"
if ($twilioCode -eq "403") {
  Write-Host "[PASS] Unsigned Twilio webhook rejected with 403 Forbidden." -ForegroundColor Green
} else {
  Write-Host "[FAIL] Expected 403, got: $twilioCode" -ForegroundColor Red
  exit 1
}

Write-Host "`n============================================================"
Write-Host "ALL POST-DEPLOY VERIFICATION TESTS PASSED SUCCESSFULLY"
Write-Host "============================================================"
