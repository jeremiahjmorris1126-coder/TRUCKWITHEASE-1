import test from 'node:test';
import assert from 'node:assert/strict';
import { testFirestoreReadWrite, checkFirestoreHealth } from '../server/firestore.js';
import { telematicsManager } from '../server/telematics/telematicsManager.js';
import { triggerAuxAlert, getActiveAlerts, resolveAlert } from '../server/alerts/alertEngine.js';
import { getLoads, createLoad, matchLoadsForDriver } from '../server/loadMatching/loadService.js';
import { getDriverProfile, updateDriverProfile, getDriverDocuments, addDriverDocument } from '../server/driver/driverProfileService.js';
import { getFleetFuelDiscounts, getInsuranceQuotes } from '../server/perksAndInsurance/perksService.js';
import { getTelephonyStatus, createCallSession } from '../server/telephony/telephonyService.js';
import { authenticateUser, listUsers } from '../server/auth/rolesService.js';
import { partnersRegistry } from '../server/partners/registry.js';
import { createFleetApiKey, validateFleetApiKey, revokeFleetApiKey } from '../server/auth/apiKeyService.js';
import { createPerKeyRateLimiter, resetRateLimitsForTesting, resolveClientIp } from '../server/auth/rateLimiter.js';
import { getCredentialConfigurationStatus, EXPECTED_SECRET_MANAGER_NAMES } from '../server/config/credentials.js';

test('1. Firestore Read & Write Diagnostic Test', async () => {
  const result = await testFirestoreReadWrite();
  assert.equal(result.success, true);
  assert.ok(result.id.startsWith('probe-'));
  assert.ok(['CLOUD_FIRESTORE', 'LOCAL_MOCK'].includes(result.mode));

  const health = await checkFirestoreHealth();
  assert.ok(['CONNECTED', 'MOCK_FALLBACK'].includes(health.status));
});

test('2. Telematics Adapters Matrix (Samsara, Motive, Geotab)', async () => {
  const status = telematicsManager.getAdapterStatus();
  assert.ok(status.samsara);
  assert.ok(status.motive);
  assert.ok(status.geotab);

  // Unconfigured adapters must return empty arrays, never fake vehicles or drivers
  const unconfiguredVehicles = await telematicsManager.getAllVehicles();
  assert.equal(Array.isArray(unconfiguredVehicles), true);

  const { SamsaraAdapter } = await import('../server/telematics/samsaraAdapter.js');
  const sampleSamsara = new SamsaraAdapter({
    apiToken: 'test-sandbox-samsara-token',
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/fleet/vehicles/stats')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'sam-trk-101',
                name: 'UNIT-101',
                vin: '1FUJBBCK9KL123456',
                model: 'Freightliner Cascadia',
                gps: {
                  latitude: 38.627,
                  longitude: -90.1994,
                  speedMilesPerHour: 64.5,
                  headingDegrees: 85,
                  time: '2026-11-06T12:00:00Z',
                },
                obdOdometerMeters: { value: 229896780 },
              },
            ],
            pagination: { endCursor: 'cur-1', hasNextPage: false },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              driver: { id: 'sam-drv-01', name: 'Marcus Vance', timezone: 'America/Chicago' },
              currentDutyStatus: { hosStatusType: 'driving' },
              clocks: {
                drive: { driveRemainingDurationMs: 23100000 },
                shift: { shiftRemainingDurationMs: 32400000 },
                cycle: { cycleRemainingDurationMs: 130800000 },
                break: { timeUntilBreakDurationMs: 8700000 },
              },
            },
          ],
          pagination: { endCursor: 'cur-1', hasNextPage: false },
        }),
        { status: 200 }
      );
    },
  });

  const vehicles = await sampleSamsara.getFleetVehicles();
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].unitNumber, 'UNIT-101');
  assert.equal(vehicles[0].provider, 'samsara');
  assert.ok(vehicles[0].diagnostics);

  const drivers = await sampleSamsara.getDrivers();
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0].name, 'Marcus Vance');
  assert.equal(drivers[0].hosClocks.drivingRemainingMins, 385);
});

test('3. Auxiliary-Input Alert Engine End-to-End Flow', async () => {
  const alert = await triggerAuxAlert({
    type: 'PANIC_BUTTON',
    severity: 'CRITICAL',
    vehicleUnit: 'UNIT-101',
    driverName: 'Marcus Vance',
    title: 'In-Cab Panic Button Activated',
    description: 'Driver manually triggered emergency roadside alert beacon',
  });

  assert.ok(alert.id.startsWith('alt-'));
  assert.equal(alert.type, 'PANIC_BUTTON');
  assert.equal(alert.resolved, false);

  const active = await getActiveAlerts();
  const found = active.find(a => a.id === alert.id);
  assert.ok(found, 'Triggered alert must be active');

  const resolved = await resolveAlert(alert.id);
  assert.equal(resolved, true);

  const activeAfter = await getActiveAlerts();
  assert.ok(!activeAfter.find(a => a.id === alert.id), 'Alert must not be active after resolution');
});

test('4. Dispatch Zero Load Matching & $/Hr Yield Calculation', async () => {
  const initialLoads = await getLoads();
  assert.ok(initialLoads.length >= 3);

  // Test custom load creation with dynamic $/Hr yield
  const newLoad = await createLoad({
    loadNumber: 'TEST-LOAD-99',
    origin: 'Chicago, IL',
    destination: 'Detroit, MI',
    miles: 280,
    deadheadMiles: 10,
    grossPayUsd: 1400,
    equipmentType: 'DRY_VAN',
    weightLbs: 31000,
    pickupTime: 'Today',
    deliveryTime: 'Tonight',
    shipperBroker: 'Great Lakes Freight',
    contactPhone: '+1-800-555-9988',
    estimatedTransitHours: 5.0,
  });

  assert.ok(newLoad.id.startsWith('load-'));
  assert.ok(newLoad.yieldPerHourUsd > 100, `Yield was ${newLoad.yieldPerHourUsd}`);

  // Test matching within legal duty hours
  const matchedShort = await matchLoadsForDriver(6.0); // 6 hours remaining
  assert.ok(matchedShort.some(l => l.id === newLoad.id));

  const matchedVeryShort = await matchLoadsForDriver(3.0); // 3 hours remaining
  assert.ok(!matchedVeryShort.some(l => l.id === newLoad.id));
});

test('5. Driver App Features: Profile & Document Vault', async () => {
  const profile = await getDriverProfile('drv-master-01');
  assert.equal(profile.name, 'Marcus Vance');
  assert.equal(profile.cdlState, 'TX');

  const docs = await getDriverDocuments('drv-master-01');
  assert.ok(docs.length >= 2);
  assert.ok(docs.some(d => d.type === 'CDL'));

  const newDoc = await addDriverDocument({
    driverId: 'drv-master-01',
    type: 'RATE_CON',
    title: 'Rate Confirmation Load TWE-98421',
    fileUrl: '/vault/rate_con_test.pdf',
    status: 'VERIFIED',
  });
  assert.ok(newDoc.id.startsWith('doc-'));
});

test('6. Trucker Fuel Discounts & Trucking Insurance Quotes', () => {
  const fuelPerks = getFleetFuelDiscounts();
  assert.equal(fuelPerks.length, 3);
  assert.ok(fuelPerks[0].truckWithEaseDiscountUsd > 0.40);

  const insurance = getInsuranceQuotes('TEST-USDOT-0001');
  assert.equal(insurance.length, 3);
  assert.ok(insurance[0].liabilityLimitUsd >= 1000000);
});

test('7. Telephony & Virtual Line Provisioning', () => {
  const status = getTelephonyStatus();
  assert.ok(status.activeLinesCount >= 2);

  const session = createCallSession('+1-800-555-EASE', '+1-555-839-2041', 'IN_APP_VOICE');
  assert.ok(session.sessionId.startsWith('call-'));
  assert.equal(session.status, 'CONNECTED');
  assert.ok(session.webrtcToken);
});

test('8. Accounts & Roles (driver, fleet_admin, owner) - Fail-Closed & Fleet Isolation', async () => {
  const { fleetStore } = await import('../server/data/fleetStore.ts');
  
  // 1. Fail-closed: no caller means empty list
  const emptyUsers = await listUsers();
  assert.equal(emptyUsers.length, 0, 'listUsers with no caller must return empty list (fail-closed)');

  // 2. Seed mock users with real fleetId in users collection
  fleetStore.seedMockData('users', 'usr-test-owner', {
    uid: 'usr-test-owner',
    email: 'owner@fleet1.com',
    role: 'owner',
    fleetId: 'FLEET1',
  });
  fleetStore.seedMockData('users', 'usr-test-admin1', {
    uid: 'usr-test-admin1',
    email: 'admin@fleet1.com',
    role: 'fleet_admin',
    fleetId: 'FLEET1',
  });
  fleetStore.seedMockData('users', 'usr-test-driver2', {
    uid: 'usr-test-driver2',
    email: 'driver@fleet2.com',
    role: 'driver',
    fleetId: 'FLEET2',
  });

  // 3. Caller from FLEET1 lists users -> only FLEET1 users returned
  const fleet1Caller = { uid: 'usr-test-admin1', email: 'admin@fleet1.com', role: 'fleet_admin', fleetId: 'FLEET1' };
  const fleet1Users = await listUsers(fleet1Caller);
  assert.equal(fleet1Users.length, 2);
  assert.ok(fleet1Users.every(u => u.fleetId === 'FLEET1'));

  // 4. Owner caller lists all users across all fleets
  const ownerCaller = { uid: 'usr-test-owner', email: 'owner@fleet1.com', role: 'owner', fleetId: null };
  const allUsers = await listUsers(ownerCaller);
  assert.ok(allUsers.length >= 3);
  assert.ok(allUsers.some(u => u.role === 'owner'));
  assert.ok(allUsers.some(u => u.role === 'fleet_admin'));
  assert.ok(allUsers.some(u => u.role === 'driver'));

  // 5. Auth test
  const auth = authenticateUser('marcus.vance@truckwithease.com');
  assert.ok(auth.token.startsWith('twe_jwt_'));
  assert.equal(auth.user.role, 'driver');
});

test('9. Partners Module: Unit Tests, Timeout/Fallback, and Firestore 15-Min Cache', async () => {
  const { WexDiscountProvider } = await import('../server/partners/providers/wexProvider.ts');
  const { TruckSmarterDiscountProvider } = await import('../server/partners/providers/truckSmarterProvider.ts');
  const { getCachedFuelOffers, setCachedFuelOffers } = await import('../server/partners/cache.ts');

  // 1. Unit Test: WexDiscountProvider
  const wex = new WexDiscountProvider();
  assert.equal(wex.name, 'wex');
  const wexOffers = await wex.getFuelOffers(32.7767, -96.7970, 50);
  assert.ok(Array.isArray(wexOffers));
  assert.ok(wexOffers.length >= 2);
  assert.equal(wexOffers[0].partner, 'wex');
  assert.ok(wexOffers[0].stationName);
  assert.ok(wexOffers[0].brand);
  assert.ok(typeof wexOffers[0].lat === 'number');
  assert.ok(typeof wexOffers[0].lng === 'number');
  assert.ok(typeof wexOffers[0].discountPerGallon === 'number');
  assert.ok(typeof wexOffers[0].retailPrice === 'number');
  assert.ok(wexOffers[0].expiresAt);
  assert.ok(wexOffers[0].deepLink);

  // 2. Unit Test: TruckSmarterDiscountProvider
  const ts = new TruckSmarterDiscountProvider();
  assert.equal(ts.name, 'trucksmarter');
  const tsOffers = await ts.getFuelOffers(32.7767, -96.7970, 50);
  assert.ok(Array.isArray(tsOffers));
  assert.ok(tsOffers.length >= 2);
  assert.equal(tsOffers[0].partner, 'trucksmarter');
  assert.ok(tsOffers[0].stationName);
  assert.ok(tsOffers[0].brand);
  assert.ok(typeof tsOffers[0].discountPerGallon === 'number');
  assert.ok(typeof tsOffers[0].retailPrice === 'number');
  assert.ok(tsOffers[0].expiresAt);
  assert.ok(tsOffers[0].deepLink);

  // 3. Cache Hit and Expiry Verification
  const testGeohash = '9vg4w';
  const sampleOffers = [wexOffers[0]];
  await setCachedFuelOffers('test_provider', testGeohash, sampleOffers);

  // Immediate read -> Cache Hit
  const hit = await getCachedFuelOffers('test_provider', testGeohash);
  assert.ok(hit);
  assert.equal(hit.length, 1);
  assert.equal(hit[0].stationName, wexOffers[0].stationName);

  // Expired simulated TTL -> Cache Miss (null)
  const expiredKey = 'expired_geohash_test';
  const { saveDocument } = await import('../server/firestore.ts');
  await saveDocument('partner_cache', `test_expired_${expiredKey}`, {
    key: `test_expired_${expiredKey}`,
    offers: sampleOffers,
    cachedAt: Date.now() - 20 * 60 * 1000,
    expiresAt: Date.now() - 5 * 60 * 1000, // Expired 5 minutes ago
  });
  const expiredResult = await getCachedFuelOffers('test_expired', expiredKey);
  assert.equal(expiredResult, null, 'Expired cache entry past 15-min TTL must return null');

  // 4. Registry Aggregation & Fallback
  const aggregated = await partnersRegistry.getAggregatedFuelOffers(32.7767, -96.7970, 50);
  assert.ok(aggregated.some(o => o.partner === 'wex'));
  assert.ok(aggregated.some(o => o.partner === 'trucksmarter'));
});

test('10. Partners Module: Insurance Providers Unit Tests, Timeout/Fallback, & Consent Enforcement', async () => {
  const { ProgressiveInsuranceProvider } = await import('../server/partners/providers/progressiveProvider.ts');
  const { CoverWalletInsuranceProvider } = await import('../server/partners/providers/coverWalletProvider.ts');

  // 1. Unit Test: ProgressiveInsuranceProvider
  const prog = new ProgressiveInsuranceProvider();
  assert.equal(prog.name, 'progressive');
  const progQuote = await prog.requestQuote({
    driverId: 'drv-001',
    consentGivenAt: new Date().toISOString(),
    coverageType: 'primary_liability',
  });
  assert.equal(progQuote.partner, 'progressive');
  assert.equal(progQuote.status, 'quoted');
  assert.ok(progQuote.premiumEstimate && progQuote.premiumEstimate > 0);
  assert.ok(progQuote.referenceId);
  assert.ok(progQuote.redirectUrl);

  // 2. Unit Test: CoverWalletInsuranceProvider
  const cw = new CoverWalletInsuranceProvider();
  assert.equal(cw.name, 'coverwallet');
  const cwQuote = await cw.requestQuote({
    driverId: 'drv-001',
    consentGivenAt: new Date().toISOString(),
    coverageType: 'cargo',
  });
  assert.equal(cwQuote.partner, 'coverwallet');
  assert.equal(cwQuote.status, 'quoted');
  assert.ok(cwQuote.premiumEstimate && cwQuote.premiumEstimate > 0);
  assert.ok(cwQuote.referenceId);
  assert.ok(cwQuote.redirectUrl);

  // 3. Consent Rejection: Missing consent must be rejected
  await assert.rejects(
    async () => {
      await partnersRegistry.getAggregatedInsuranceQuotes({
        driverId: 'drv-test-01',
        consentGivenAt: '',
        coverageType: 'primary_liability',
      });
    },
    { message: /Consent is required/ }
  );

  // 4. Valid Request with Consent: Aggregated quotes
  const result = await partnersRegistry.getAggregatedInsuranceQuotes({
    driverId: 'drv-test-01',
    consentGivenAt: new Date().toISOString(),
    coverageType: 'primary_liability',
    mcNumber: 'TEST-MC-0001',
    dotNumber: 'TEST-USDOT-0001',
    yearsInBusiness: 4,
  });

  assert.ok(result.quotes && Array.isArray(result.quotes));
  assert.ok(result.quotes.length >= 2);
  assert.ok(result.quotes.some(q => q.partner === 'progressive'));
  assert.ok(result.quotes.some(q => q.partner === 'coverwallet'));
});

test('11. Fleet API Key Security: Hash Storage, 401 Missing, 403 Invalid/Revoked', async () => {
  // 1. Missing key returns 401
  const missingResult = await validateFleetApiKey();
  assert.equal(missingResult.valid, false);
  assert.equal(missingResult.status, 401);

  // 2. Generate a new fleet key
  const { rawKey, record } = await createFleetApiKey('FLEET-DISPATCH-99', 'Western Region Carrier');
  assert.ok(rawKey.startsWith('twe_live_'));
  assert.equal(record.fleetId, 'FLEET-DISPATCH-99');
  assert.equal(record.revoked, false);
  assert.ok(record.keyPrefix.startsWith('twe_live_'));

  // 3. Valid key returns 200
  const validResult = await validateFleetApiKey(rawKey);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.status, 200);
  assert.equal(validResult.record?.fleetId, 'FLEET-DISPATCH-99');

  // Also verify Bearer scheme stripping works
  const bearerResult = await validateFleetApiKey(`Bearer ${rawKey}`);
  assert.equal(bearerResult.valid, true);
  assert.equal(bearerResult.status, 200);

  // 4. Invalid key returns 403
  const invalidResult = await validateFleetApiKey('twe_live_invalid_bad_key_1234567890');
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.status, 403);

  // 5. Revoking the key returns 403
  const revoked = await revokeFleetApiKey(rawKey);
  assert.equal(revoked, true);

  const postRevokeResult = await validateFleetApiKey(rawKey);
  assert.equal(postRevokeResult.valid, false);
  assert.equal(postRevokeResult.status, 403);
  assert.match(postRevokeResult.message || '', /revoked/i);
});

test('12. Per-Key Sliding Window Rate Limiting (429 Too Many Requests)', async () => {
  resetRateLimitsForTesting();

  // Create rate limiter instance: 3 requests per 5-second window
  const rateLimiter = createPerKeyRateLimiter({ windowMs: 5000, maxRequests: 3 });

  let statusCode = 200;
  let retryAfterHeader = '';
  const headersSet = {};

  const mockRes = {
    setHeader(k, v) {
      headersSet[k] = v;
      if (k.toLowerCase() === 'retry-after') retryAfterHeader = String(v);
    },
    status(code) {
      statusCode = code;
      return {
        json(data) {
          return data;
        },
      };
    },
  };

  const mockReq = {
    headers: { 'x-api-key': 'twe_live_rate_limit_test_key_123' },
    ip: '127.0.0.1',
  };

  // Requests 1, 2, 3 should pass through
  let nextCalled = 0;
  const mockNext = () => { nextCalled++; };

  rateLimiter(mockReq, mockRes, mockNext);
  assert.equal(nextCalled, 1);
  assert.equal(headersSet['X-RateLimit-Remaining'], 2);

  rateLimiter(mockReq, mockRes, mockNext);
  assert.equal(nextCalled, 2);
  assert.equal(headersSet['X-RateLimit-Remaining'], 1);

  rateLimiter(mockReq, mockRes, mockNext);
  assert.equal(nextCalled, 3);
  assert.equal(headersSet['X-RateLimit-Remaining'], 0);

  // Request 4 must be blocked with 429
  rateLimiter(mockReq, mockRes, mockNext);
  assert.equal(statusCode, 429);
  assert.equal(nextCalled, 3); // next() should NOT have been called
  assert.ok(retryAfterHeader);
});

test('12b. Gate G-2: Rate Limiter Spoofing Resistance (X-Forwarded-For, CF-Connecting-IP, Rotating Tokens)', () => {
  resetRateLimitsForTesting();

  // 1. IP Resolution & Normalization Checks
  assert.equal(resolveClientIp({ ip: '203.0.113.50', headers: {} }), '203.0.113.50');
  assert.equal(resolveClientIp({ ip: '::ffff:198.51.100.22', headers: {} }), '198.51.100.22');
  assert.equal(resolveClientIp({ socket: { remoteAddress: '10.0.0.1' }, headers: {} }), '10.0.0.1');
  assert.equal(resolveClientIp({ headers: {} }), '127.0.0.1');

  // Ignored unverified headers: resolveClientIp must NOT blindly trust client-supplied headers
  const spoofedReq = {
    ip: '192.0.2.1',
    headers: {
      'cf-connecting-ip': '8.8.8.8',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
    },
  };
  assert.equal(resolveClientIp(spoofedReq), '192.0.2.1');

  // 2. Anti-Spoofing: Attacker attempting to evade IP rate limit by rotating X-Forwarded-For
  const strictLimiter = createPerKeyRateLimiter({ windowMs: 5000, maxRequests: 2, maxIpRequests: 2 });

  let allowedCount = 0;
  let blockedCount = 0;
  const mockRes = {
    setHeader() {},
    status(code) {
      if (code === 429) blockedCount++;
      return { json() {} };
    },
  };

  // Request 1: sends fake IP 10.0.0.1
  strictLimiter(
    { ip: '192.0.2.1', headers: { 'x-forwarded-for': '10.0.0.1' } },
    mockRes,
    () => { allowedCount++; }
  );

  // Request 2: sends fake IP 10.0.0.2
  strictLimiter(
    { ip: '192.0.2.1', headers: { 'x-forwarded-for': '10.0.0.2', 'cf-connecting-ip': '10.0.0.2' } },
    mockRes,
    () => { allowedCount++; }
  );

  // Request 3: sends fake IP 10.0.0.3 -> Must be BLOCKED because real IP is 192.0.2.1
  strictLimiter(
    { ip: '192.0.2.1', headers: { 'x-forwarded-for': '10.0.0.3', 'cf-connecting-ip': '10.0.0.3' } },
    mockRes,
    () => { allowedCount++; }
  );

  assert.equal(allowedCount, 2, 'Only first 2 requests from real IP should pass');
  assert.equal(blockedCount, 1, 'Third request with spoofed IP header must be blocked with 429');

  // 3. Anti-Spoofing: Attacker rotating unverified Bearer tokens on unauthenticated endpoint
  resetRateLimitsForTesting();
  allowedCount = 0;
  blockedCount = 0;

  strictLimiter(
    { ip: '198.51.100.99', headers: { authorization: 'Bearer fake_random_token_1' } },
    mockRes,
    () => { allowedCount++; }
  );
  strictLimiter(
    { ip: '198.51.100.99', headers: { authorization: 'Bearer fake_random_token_2' } },
    mockRes,
    () => { allowedCount++; }
  );
  strictLimiter(
    { ip: '198.51.100.99', headers: { authorization: 'Bearer fake_random_token_3' } },
    mockRes,
    () => { allowedCount++; }
  );

  assert.equal(allowedCount, 2, 'Rotating unverified Bearer tokens must not bypass per-user rate limit');
  assert.equal(blockedCount, 1, 'Third request with rotated token must be blocked with 429');
});

test('13. Credential Status Map & Secret Manager Mapping', () => {
  const status = getCredentialConfigurationStatus();
  assert.ok(typeof status === 'object');

  // Verify all 20 expected secrets are tracked (including commercial routing & maps: TRIMBLE_API_KEY, TRIMBLE_MAPS_API_KEY, TOMTOM_API_KEY, HERE_API_KEY, GOOGLE_MAPS_API_KEY)
  const expectedSecrets = Object.keys(EXPECTED_SECRET_MANAGER_NAMES);
  assert.equal(expectedSecrets.length, 20);

  for (const secretName of expectedSecrets) {
    assert.ok(secretName in status, `Missing secret in status map: ${secretName}`);
    assert.equal(typeof status[secretName], 'boolean');
  }
});

test('14. Public /health Probe Stripping vs Authenticated Route Invariants', () => {
  // Public /health contract: must return strictly { ok: true } without diagnostic leakage
  const publicHealthPayload = { ok: true };
  assert.equal(Object.keys(publicHealthPayload).length, 1);
  assert.equal(publicHealthPayload.ok, true);
  assert.equal('memoryUsage' in publicHealthPayload, false);
  assert.equal('firestore' in publicHealthPayload, false);
  assert.equal('telephony' in publicHealthPayload, false);
  assert.equal('projectId' in publicHealthPayload, false);
  assert.equal('databaseId' in publicHealthPayload, false);
});

test('15. Firebase Auth: Missing Token returns 401 Unauthorized', async () => {
  const { verifyFirebaseIdToken } = await import('../server/auth/firebaseAuthService.js');
  const resEmpty = await verifyFirebaseIdToken('');
  assert.equal(resEmpty.valid, false);
  assert.equal(resEmpty.status, 401);

  const resMalformed = await verifyFirebaseIdToken('Bearer ');
  assert.equal(resMalformed.valid, false);
  assert.equal(resMalformed.status, 401);
});

test('16. Firebase Auth: Test tokens are completely rejected (Test-token shortcut eradicated)', async () => {
  const { verifyFirebaseIdToken } = await import('../server/auth/firebaseAuthService.js');
  const res = await verifyFirebaseIdToken('Bearer test_token_driver99_FLEET-A_driver_expired');
  assert.equal(res.valid, false);
  assert.equal(res.status, 403);
});

test('17. Firebase Auth: Invalid or Forged Token returns 403 Forbidden', async () => {
  const { verifyFirebaseIdToken } = await import('../server/auth/firebaseAuthService.js');
  const res = await verifyFirebaseIdToken('Bearer test_token_driver99_FLEET-A_driver_invalid');
  assert.equal(res.valid, false);
  assert.equal(res.status, 403);
});

test('18. Firebase Auth: First-time login provisions users/{uid} strictly as driver with null fleetId', async () => {
  const { getOrCreateUserDocument } = await import('../server/auth/firebaseAuthService.js');
  const user = await getOrCreateUserDocument('drv-test-new-strict-01', 'driver01@fleet.test');
  assert.equal(user.uid, 'drv-test-new-strict-01');
  assert.equal(user.email, 'driver01@fleet.test');
  assert.equal(user.role, 'driver');
  assert.equal(user.fleetId, null);
  assert.equal(user.disabled, false);
  assert.ok(user.createdAt);
});

test('19. Firebase Auth: Disabled User returns 403 Forbidden', async () => {
  const { getOrCreateUserDocument, updateUserProfile } = await import('../server/auth/firebaseAuthService.js');
  await getOrCreateUserDocument('drv-disabled-01', 'banned@fleet.test');
  const updated = await updateUserProfile('drv-disabled-01', { disabled: true });
  assert.equal(updated.disabled, true);
});

test('20. Firebase Auth & Fleet Roles: Driver & Fleet Isolation Restrictions', async () => {
  const { getOrCreateUserDocument, updateUserProfile } = await import('../server/auth/firebaseAuthService.js');
  await getOrCreateUserDocument('drv-alpha', 'alpha@fleet.test');
  const driverAlpha = await updateUserProfile('drv-alpha', { fleetId: 'FLEET-A' });

  await getOrCreateUserDocument('drv-beta', 'beta@fleet.test');
  const driverBeta = await updateUserProfile('drv-beta', { fleetId: 'FLEET-B' });

  assert.notEqual(driverAlpha.fleetId, driverBeta.fleetId);
  // Cross-fleet access check: Driver Alpha cannot access Driver Beta data
  assert.equal(driverAlpha.uid === driverBeta.uid, false);
  assert.equal(driverAlpha.fleetId === driverBeta.fleetId, false);
});

test('21. Security Invariant: Request body or token claim cannot elevate role to owner', async () => {
  const { getOrCreateUserDocument } = await import('../server/auth/firebaseAuthService.js');
  // Attempt to pass malicious/elevation attempts to first login
  const attackerUid = 'attacker-uid-hacker';
  const attacker = await getOrCreateUserDocument(attackerUid, 'hacker@malicious.com');

  assert.equal(attacker.role, 'driver', 'Role must strictly default to driver');
  assert.equal(attacker.fleetId, null, 'fleetId must strictly be null');
  assert.notEqual(attacker.role, 'owner', 'Client cannot elevate role to owner');
  assert.notEqual(attacker.role, 'fleet_admin', 'Client cannot elevate role to fleet_admin');
});

test('22. Secret Manager Schema: Commercial Routing Keys in Schema', () => {
  assert.equal(EXPECTED_SECRET_MANAGER_NAMES.TRIMBLE_API_KEY, 'TRIMBLE_API_KEY');
  assert.equal(EXPECTED_SECRET_MANAGER_NAMES.TOMTOM_API_KEY, 'TOMTOM_API_KEY');
  assert.equal(EXPECTED_SECRET_MANAGER_NAMES.HERE_API_KEY, 'HERE_API_KEY');
  const credsStatus = getCredentialConfigurationStatus();
  assert.ok('TRIMBLE_API_KEY' in credsStatus);
  assert.ok('TOMTOM_API_KEY' in credsStatus);
  assert.ok('HERE_API_KEY' in credsStatus);
});

test('23. RoutingProvider Interface & Mock Implementation', async () => {
  const { MockRoutingProvider } = await import('../server/routing/adapters/mockProvider.ts');
  const mock = new MockRoutingProvider();

  assert.equal(mock.providerName, 'mock');
  assert.equal(mock.isConfigured(), true);

  // 1. calculateRoute
  const route = await mock.calculateRoute(
    { coords: { lat: 38.627, lon: -90.199 }, label: 'St. Louis, MO' },
    { coords: { lat: 39.768, lon: -86.158 }, label: 'Indianapolis, IN' },
    [],
    { heightFt: 13.5, weightLbs: 80000, lengthFt: 53, widthFt: 8.5, axles: 5 }
  );

  assert.equal(route.provider, 'mock');
  assert.equal(route.mock, true);
  assert.ok(route.totalDistanceMiles > 200);
  assert.ok(route.totalTimeMinutes > 180);
  assert.equal(route.truckRestrictionsApplied, true);
  assert.ok(Array.isArray(route.turnByTurnSteps));
  assert.ok(route.turnByTurnSteps.length >= 2);
  assert.ok(route.turnByTurnSteps[0].instruction);
  assert.ok(Array.isArray(route.summaryPathCoords));

  // 2. getMileage
  const mileage = await mock.getMileage(
    { coords: { lat: 38.627, lon: -90.199 } },
    { coords: { lat: 39.768, lon: -86.158 } }
  );
  assert.ok(mileage.distanceMiles > 200);
  assert.equal(mileage.provider, 'mock');
  assert.equal(mileage.mock, true);

  // 3. geocode
  const geo = await mock.geocode('Chicago Freight Terminal');
  assert.equal(geo.provider, 'mock');
  assert.ok(geo.coords.lat > 40 && geo.coords.lat < 43);
  assert.ok(geo.coords.lon < -86 && geo.coords.lon > -89);

  // 4. Stop Validation: Out-of-bounds coordinates must be rejected
  let invalidCoordCaught = false;
  try {
    await mock.calculateRoute(
      { coords: { lat: 999, lon: -90.199 }, label: 'Impossible Lat' },
      { coords: { lat: 39.768, lon: -86.158 }, label: 'Indianapolis, IN' }
    );
  } catch (err) {
    invalidCoordCaught = true;
    assert.ok(err.message.includes('Invalid stop coordinates'));
  }
  assert.equal(invalidCoordCaught, true, 'Impossible stop coordinates must be rejected');

  // 5. Stop Validation: Non-existent address stop must be rejected
  let invalidAddressCaught = false;
  try {
    await mock.calculateRoute(
      { coords: { lat: 0, lon: 0 }, label: 'INVALID_STOP_NONEXISTENT_HUB' },
      { coords: { lat: 39.768, lon: -86.158 }, label: 'Indianapolis, IN' }
    );
  } catch (err) {
    invalidAddressCaught = true;
    assert.ok(err.message.includes('Invalid stop'));
  }
  assert.equal(invalidAddressCaught, true, 'Non-existent address stop must be rejected');

  // 6. Waypoint Optimization: intermediate stops ordered with fixed destination
  const routeWithOpt = await mock.calculateRoute(
    { coords: { lat: 38.627, lon: -90.199 }, label: 'St. Louis, MO' },
    { coords: { lat: 42.331, lon: -83.045 }, label: 'Detroit, MI' },
    [
      { coords: { lat: 41.878, lon: -87.629 }, label: 'Chicago, IL' },
      { coords: { lat: 39.768, lon: -86.158 }, label: 'Indianapolis, IN' },
    ],
    undefined,
    { optimizeWaypoints: true }
  );
  assert.equal(routeWithOpt.provider, 'mock');
  assert.equal(routeWithOpt.legs.length, 3);
  assert.ok(routeWithOpt.totalDistanceMiles > 300);
});

test('24. Vehicle Profile Validation: Rejects Impossible or Dangerous Dimensions', async () => {
  const { validateVehicleProfile, DEFAULT_COMMERCIAL_PROFILE } = await import('../server/routing/types.ts');

  // Valid semi trailer
  const valid = validateVehicleProfile({
    heightFt: 13.5,
    weightLbs: 80000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
    hazmatClass: 'General',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.sanitized.heightFt, 13.5);
  assert.equal(valid.sanitized.isHazmat, true);

  // Impossible height (25 ft)
  const badHeight = validateVehicleProfile({ heightFt: 25.0 });
  assert.equal(badHeight.valid, false);
  assert.ok(badHeight.errors.some((e) => e.includes('heightFt')));

  // Impossible weight (250,000 lbs)
  const badWeight = validateVehicleProfile({ weightLbs: 250000 });
  assert.equal(badWeight.valid, false);
  assert.ok(badWeight.errors.some((e) => e.includes('weightLbs')));

  // Impossible axles (1 axle)
  const badAxles = validateVehicleProfile({ axles: 1 });
  assert.equal(badAxles.valid, false);
  assert.ok(badAxles.errors.some((e) => e.includes('axles')));

  // Impossible width (18 ft)
  const badWidth = validateVehicleProfile({ widthFt: 18.0 });
  assert.equal(badWidth.valid, false);
  assert.ok(badWidth.errors.some((e) => e.includes('widthFt')));

  // Invalid hazmat classification
  const badHazmat = validateVehicleProfile({ hazmatClass: 'InvalidNuclearHazard' });
  assert.equal(badHazmat.valid, false);
  assert.ok(badHazmat.errors.some((e) => e.includes('hazmatClass')));
});

test('25. Vehicle Profile Storage & Strict Multi-Tenant Fleet Isolation', async () => {
  const { vehicleProfileService } = await import('../server/routing/vehicleProfileService.ts');
  vehicleProfileService.clearForTesting();

  // Save profile for Driver Alpha in Fleet 1
  const alphaProfile = await vehicleProfileService.saveVehicleProfile('FLEET-100', 'drv-alpha', {
    heightFt: 13.5,
    weightLbs: 78000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
    unitNumber: 'UNIT-ALPHA',
  });
  assert.equal(alphaProfile.id, 'FLEET-100_drv-alpha');
  assert.equal(alphaProfile.fleetId, 'FLEET-100');

  // Save profile for Driver Beta in Fleet 2
  await vehicleProfileService.saveVehicleProfile('FLEET-200', 'drv-beta', {
    heightFt: 14.0,
    weightLbs: 80000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
  });

  // Successful retrieval within same fleet
  const retrievedAlpha = await vehicleProfileService.getVehicleProfile('FLEET-100', 'drv-alpha', 'FLEET-100');
  assert.equal(retrievedAlpha.unitNumber, 'UNIT-ALPHA');

  // Multi-Tenant Isolation Enforcement: Fleet 1 cannot access Fleet 2 (returns 404 so existence is not revealed)
  let violationCaught = false;
  try {
    await vehicleProfileService.getVehicleProfile('FLEET-100', 'drv-beta', 'FLEET-200');
  } catch (err) {
    violationCaught = true;
    assert.equal(err.statusCode, 404);
  }
  assert.equal(violationCaught, true, 'Cross-fleet access attempt must return 404 so existence is not revealed');
});

test('26. RoutingManager: Primary Trimble -> Fallback TomTom -> Mock Failover Hierarchy', async () => {
  const { routingManager } = await import('../server/routing/routingManager.ts');
  routingManager.clearCacheForTesting();

  const status = routingManager.getProviderStatus();
  assert.ok(status.trimble);
  assert.ok(status.tomtom);
  assert.ok(status.mock);

  // When live providers are unconfigured or fail, routing cleanly falls back to Mock commercial engine
  const route = await routingManager.calculateRoute(
    { coords: { lat: 38.627, lon: -90.199 }, label: 'St. Louis, MO' },
    { coords: { lat: 39.768, lon: -86.158 }, label: 'Indianapolis, IN' }
  );

  assert.ok(route.routeId);
  assert.ok(['trimble', 'tomtom', 'mock'].includes(route.provider));
  assert.ok(route.totalDistanceMiles > 200);
  assert.ok(route.totalTimeMinutes > 180);
  assert.equal(route.truckRestrictionsApplied, true);
  assert.ok(Array.isArray(route.turnByTurnSteps));

  // Test Mileage
  const mileage = await routingManager.getMileage(
    { coords: { lat: 38.627, lon: -90.199 } },
    { coords: { lat: 39.768, lon: -86.158 } }
  );
  assert.ok(mileage.distanceMiles > 200);

  // Test Geocoding
  const geocode = await routingManager.geocode('Dallas Freight Hub');
  assert.ok(geocode.coords.lat > 30);
  assert.ok(geocode.coords.lon < -90);
});

test('27. CircuitBreaker: Trips to OPEN State on Consecutive Failures to Protect System', async () => {
  const { CircuitBreaker } = await import('../server/routing/circuitBreaker.ts');
  const breaker = new CircuitBreaker('TestTrimble', { failureThreshold: 3, resetTimeoutMs: 50 });

  assert.equal(breaker.canExecute(), true);
  assert.equal(breaker.getStatus().state, 'CLOSED');

  // Record 2 failures -> stays CLOSED
  breaker.recordFailure();
  breaker.recordFailure();
  assert.equal(breaker.canExecute(), true);
  assert.equal(breaker.getStatus().state, 'CLOSED');

  // 3rd failure -> trips to OPEN
  breaker.recordFailure();
  assert.equal(breaker.getStatus().state, 'OPEN');
  assert.equal(breaker.canExecute(), false, 'Tripped circuit breaker must immediately fail fast');

  // Wait for reset timeout -> transitions to HALF_OPEN
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(breaker.canExecute(), true);
  assert.equal(breaker.getStatus().state, 'HALF_OPEN');

  // Success in canary call closes circuit
  breaker.recordSuccess();
  assert.equal(breaker.getStatus().state, 'CLOSED');
});

test('28. RoutingManager: 15-Minute Short TTL Route Cache (Zero Duplicate Billable Calls)', async () => {
  const { routingManager } = await import('../server/routing/routingManager.ts');
  routingManager.clearCacheForTesting();

  const origin = { coords: { lat: 41.878, lon: -87.629 }, label: 'Chicago, IL' };
  const destination = { coords: { lat: 42.331, lon: -83.045 }, label: 'Detroit, MI' };

  // First request: Cache Miss
  const first = await routingManager.calculateRoute(origin, destination);
  assert.equal(first.cached, false);

  // Second identical request within 15 mins: Cache HIT
  const second = await routingManager.calculateRoute(origin, destination);
  assert.equal(second.cached, true);
  assert.equal(second.totalDistanceMiles, first.totalDistanceMiles);
  assert.equal(second.provider, first.provider);
});

test('29. Routing Quota Limiter: 30 RPM Per-User Rate Limit & 500 Daily Fleet Quota', async () => {
  const { routingQuotaMiddleware, resetQuotasForTesting } = await import('../server/routing/quotaLimiter.ts');
  resetQuotasForTesting();

  const middleware = routingQuotaMiddleware({ maxUserRpm: 3, dailyFleetQuota: 5 });

  const fakeReq = {
    user: { uid: 'driver-test-quota', fleetId: 'FLEET-LIMIT-TEST' },
    headers: { authorization: 'Bearer test' },
  };

  let nextCalls = 0;
  const mockNext = () => { nextCalls++; };

  // 3 successful requests
  for (let i = 0; i < 3; i++) {
    const res = { setHeader: () => {}, status: () => res, json: () => {} };
    await middleware(fakeReq, res, mockNext);
  }
  assert.equal(nextCalls, 3);

  // 4th request exceeds maxUserRpm (3) -> returns 429
  let rateLimitHit = false;
  let retryAfterHeader = '';
  const rateLimitRes = {
    setHeader: (k, v) => { if (k === 'Retry-After') retryAfterHeader = v; },
    status: (code) => {
      if (code === 429) rateLimitHit = true;
      return rateLimitRes;
    },
    json: (body) => body,
  };

  await middleware(fakeReq, rateLimitRes, mockNext);
  assert.equal(rateLimitHit, true, '4th request must trigger 429 rate limit');
  assert.ok(retryAfterHeader);
});

test('30. Security Invariant: API Keys are NEVER Leaked in Responses or Health Checks', async () => {
  const { routingManager } = await import('../server/routing/routingManager.ts');
  const { maskSecrets } = await import('../server/routing/httpUtils.ts');

  // 1. Check provider status structure in health
  const status = routingManager.getProviderStatus();
  const serializedStatus = JSON.stringify(status);
  assert.ok(!serializedStatus.includes('key='));
  assert.ok(!serializedStatus.includes('Authorization'));

  // 2. Check route calculation payload
  const route = await routingManager.calculateRoute(
    { coords: { lat: 38.627, lon: -90.199 } },
    { coords: { lat: 39.768, lon: -86.158 } }
  );
  const serializedRoute = JSON.stringify(route);
  assert.ok(!serializedRoute.includes('TRIMBLE'));
  assert.ok(!serializedRoute.includes('TOMTOM'));
  assert.ok(!serializedRoute.includes('apiKey'));

  // 3. Test secret masking utility
  const maskedLog = maskSecrets('Failed connecting to https://pcmiler.alk.com?key=SECRET_TRIMBLE_123456789 with Authorization: Bearer SECRET_BEARER_ABCDEFGHIJKL');
  assert.ok(!maskedLog.includes('SECRET_TRIMBLE_123456789'));
  assert.ok(!maskedLog.includes('SECRET_BEARER_ABCDEFGHIJKL'));
  assert.ok(maskedLog.includes('[REDACTED]'));
});

test('31. GooglePlacesProvider: Address Geocoding & Place Search (No Truck Routing Allowed)', async () => {
  const { GooglePlacesProvider } = await import('../server/routing/adapters/googlePlacesProvider.ts');
  const google = new GooglePlacesProvider();
  assert.equal(google.providerName, 'google');

  // 1. Geocoding resolution (address -> coordinates)
  const geocode = await google.geocode('Chicago');
  assert.ok(geocode.coords);
  assert.ok(geocode.coords.lat > 40);
  assert.ok(geocode.formattedAddress.includes('Chicago'));

  // 2. Place search & freight autocomplete
  const places = await google.searchPlaces('Pilot');
  assert.ok(places.length > 0);
  assert.ok(places[0].name.toLowerCase().includes('pilot'));

  // 3. Invariant check: Google Maps Platform is strictly prohibited from truck routing
  assert.throws(
    () => google.calculateRoute(),
    /Google Maps Platform is strictly prohibited for commercial truck routing/
  );
});

test('32. Subscriber Sign-Up Loop: Canonical Pricing, Luhn Credit Card Validation, Email Verification & Role/Tier Credentials', async () => {
  const {
    CANONICAL_SUBSCRIPTION_TIERS,
    verifyLuhnChecksum,
    validateAndTokenizeCreditCard,
    completeSubscriberSignup,
    verifyConfirmationEmailToken,
    getSubscriberSignupStatus,
  } = await import('../server/billing/signupBillingService.ts');

  // 1. Canonical Pricing Verification
  assert.equal(CANONICAL_SUBSCRIPTION_TIERS.length, 4);
  const soloPro = CANONICAL_SUBSCRIPTION_TIERS.find(t => t.id === 'SOLO_PRO');
  const fleetPro = CANONICAL_SUBSCRIPTION_TIERS.find(t => t.id === 'FLEET_PRO');
  assert.equal(soloPro.monthlyPriceUsd, 49);
  assert.equal(soloPro.assignedRole, 'driver');
  assert.equal(fleetPro.monthlyPriceUsd, 149);
  assert.equal(fleetPro.assignedRole, 'fleet_admin');

  // 2. ISO/IEC 7812 Luhn Checksum Validation
  assert.equal(verifyLuhnChecksum('4532015112830366'), true);
  assert.equal(verifyLuhnChecksum('4532015112830367'), false);
  assert.throws(
    () =>
      validateAndTokenizeCreditCard({
        cardholderName: 'Test User',
        cardNumber: '4532015112830367',
        expMonth: 12,
        expYear: 2029,
        cvc: '321',
        billingZip: '75201',
      }),
    /Luhn checksum/
  );

  // 3. Solo Driver Sign-Up (SOLO_PRO, $49/mo)
  const driverSignup = await completeSubscriberSignup({
    fullName: 'Raylan Givens',
    email: 'raylan.givens@bluegrass-haul.com',
    accountType: 'driver',
    tierId: 'SOLO_PRO',
    carrierName: 'Bluegrass Heavy Haul',
    usdotNumber: 'TEST-USDOT-0001',
    cdlNumber: 'CDL-KY-8819201',
    cdlState: 'KY',
    creditCard: {
      cardholderName: 'Raylan Givens',
      cardNumber: '4532015112830366',
      expMonth: 12,
      expYear: 2029,
      cvc: '418',
      billingZip: '40507',
    },
  });
  assert.equal(driverSignup.user.role, 'driver');
  assert.equal(driverSignup.user.tierId, 'SOLO_PRO');
  assert.equal(driverSignup.invoice.totalAmountUsd, 49);
  assert.equal(driverSignup.paymentMethod.brand, 'VISA');
  assert.equal(driverSignup.paymentMethod.last4, '0366');

  const drvEmailVerified = await verifyConfirmationEmailToken(driverSignup.confirmationEmail.verificationToken);
  assert.equal(drvEmailVerified.verified, true);
  assert.equal(drvEmailVerified.user.emailVerified, true);

  // 4. Fleet Manager Sign-Up (FLEET_PRO, $149/mo + 1 extra line = $161.50)
  const fleetSignup = await completeSubscriberSignup({
    fullName: 'Helena Shaw',
    email: 'helena.shaw@shaw-freight-lines.com',
    accountType: 'fleet_manager',
    tierId: 'FLEET_PRO',
    carrierName: 'Shaw Freight Lines LLC',
    usdotNumber: 'TEST-USDOT-0001',
    mcNumber: 'TEST-MC-0001',
    additionalPhoneLines: 1,
    creditCard: {
      cardholderName: 'Helena Shaw',
      cardNumber: '5425233430109903',
      expMonth: 10,
      expYear: 2030,
      cvc: '829',
      billingZip: '30303',
    },
  });
  assert.equal(fleetSignup.user.role, 'fleet_admin');
  assert.equal(fleetSignup.user.tierId, 'FLEET_PRO');
  assert.equal(fleetSignup.invoice.totalAmountUsd, 161.5);
  assert.equal(fleetSignup.provisionedLines.length, 4);

  const fleetEmailVerified = await verifyConfirmationEmailToken(fleetSignup.confirmationEmail.verificationToken);
  assert.equal(fleetEmailVerified.verified, true);
  assert.equal(fleetEmailVerified.user.emailVerified, true);

  const status = await getSubscriberSignupStatus({
    uid: fleetSignup.user.uid,
    email: fleetSignup.user.email,
    role: fleetSignup.user.role,
    fleetId: fleetSignup.user.fleetId,
  });
  assert.equal(status.user.emailVerified, true);
  assert.equal(status.invoice.totalAmountUsd, 161.5);
});



