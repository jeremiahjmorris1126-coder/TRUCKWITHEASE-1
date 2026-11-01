process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createApiApp } from '../server.ts';
import { createFleetCore } from '../server/fleetCore.ts';

// Helper to spawn an ephemeral test server on port 0 with an isolated dependency injection container
function setupTestServer(options = {}) {
  const isolatedCore = createFleetCore();
  const app = createApiApp(isolatedCore);
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        baseUrl,
        isolatedCore,
        close: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}

test('Integration Test Suite: TruckWithEase API Endpoints', async (t) => {
  const env = await setupTestServer();

  t.after(async () => {
    await env.close();
  });

  // ==========================================================================
  // 1. HEALTH & READINESS (PUBLIC WHITELIST)
  // ==========================================================================
  await t.test('GET /api/health -> Happy Path returns 200 with operational subsystems', async () => {
    const res = await fetch(`${env.baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'UP');
    assert.equal(body.readiness, 'READY');
    assert.ok(body.integrations);
    assert.ok(body.subsystems?.telecommunicationsGateway);
    assert.equal(body.subsystems.telecommunicationsGateway.status, 'OPERATIONAL');

    // Correlation trace header must always be returned
    assert.ok(res.headers.get('x-correlation-id'));
  });

  // ==========================================================================
  // 2. SECURITY & AUTH / PERMISSION ENFORCEMENT
  // ==========================================================================
  await t.test('Protected Endpoints -> Auth/Permission Failure without Carrier Secret', async () => {
    // Temporarily enforce secret
    const prevSecret = process.env.CARRIER_API_SECRET;
    process.env.CARRIER_API_SECRET = 'SECRET_FLEET_TOKEN_XYZ';

    try {
      // 1. Unauthenticated request to protected route -> 401 Unauthorized
      const unauthorizedRes = await fetch(`${env.baseUrl}/api/export-cloudflare-github/status`);
      assert.equal(unauthorizedRes.status, 401);
      const unauthBody = await unauthorizedRes.json();
      assert.equal(unauthBody.error, 'Unauthorized');
      assert.match(unauthBody.message, /Carrier API Token or Bearer Authorization required/i);

      // 2. Request with invalid Bearer Token -> 401 Unauthorized
      const badTokenRes = await fetch(`${env.baseUrl}/api/export-cloudflare-github/status`, {
        headers: { Authorization: 'Bearer WRONG_TOKEN_VALUE' },
      });
      assert.equal(badTokenRes.status, 401);

      // 3. Request with valid Bearer Token -> 200 OK
      const authorizedRes = await fetch(`${env.baseUrl}/api/export-cloudflare-github/status`, {
        headers: { Authorization: 'Bearer SECRET_FLEET_TOKEN_XYZ' },
      });
      assert.equal(authorizedRes.status, 200);
      const authBody = await authorizedRes.json();
      assert.equal(authBody.status, 'READY');
    } finally {
      if (prevSecret === undefined) {
        delete process.env.CARRIER_API_SECRET;
      } else {
        process.env.CARRIER_API_SECRET = prevSecret;
      }
    }
  });

  // ==========================================================================
  // 3. DRIVER AUTHENTICATION & SIGN-UP SHEET
  // ==========================================================================
  await t.test('POST /api/auth/signup -> Happy Path registers a new commercial driver', async () => {
    const payload = {
      name: 'Marcus Brody',
      email: 'marcus.brody@morrishive.com',
      phone: '(312) 555-4920',
      role: 'FLEET_DRIVER',
      cdlNumber: 'TX-CDL-8849201',
      cdlState: 'TX',
      assignedUnit: 'TRK-880',
      fmcsaPin: '4410',
    };

    const res = await fetch(`${env.baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.driver.name, 'Marcus Brody');
    assert.equal(body.driver.cdlNumber, 'TX-CDL-8849201');
    assert.equal(body.driver.assignedUnit, 'TRK-880');
    assert.ok(body.token);
  });

  await t.test('POST /api/auth/signup -> Validation Error when full name is missing', async () => {
    const payload = {
      name: '   ',
      cdlNumber: 'IL-CDL-998811',
    };

    const res = await fetch(`${env.baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /name is required/i);
  });

  await t.test('POST /api/auth/signup -> Validation Error when CDL number is missing', async () => {
    const payload = {
      name: 'Johnathan Vance',
      cdlNumber: '',
    };

    const res = await fetch(`${env.baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /cdl number is required/i);
  });

  // ==========================================================================
  // 4. DRIVER SIGN-IN & FMCSA PIN VERIFICATION
  // ==========================================================================
  await t.test('POST /api/auth/signin -> Happy Path signs in with valid credentials', async () => {
    const res = await fetch(`${env.baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'drv-jeremiah-904',
        fmcsaPin: '8821',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.driver.driverId, 'drv-jeremiah-904');
    assert.ok(body.token);
  });

  await t.test('POST /api/auth/signin -> Validation Error when identifier is missing', async () => {
    const res = await fetch(`${env.baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /identifier .* is required/i);
  });

  await t.test('POST /api/auth/signin -> Auth Failure when FMCSA PIN is incorrect', async () => {
    const res = await fetch(`${env.baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'drv-jeremiah-904',
        fmcsaPin: '0000', // incorrect PIN
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /invalid fmcsa roadside pin/i);
  });

  // ==========================================================================
  // 5. FLEET DRIVER ROSTER & SELECTION
  // ==========================================================================
  await t.test('GET /api/drivers -> Happy Path returns roster list', async () => {
    const res = await fetch(`${env.baseUrl}/api/drivers`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.drivers));
    assert.ok(body.drivers.length >= 1);
  });

  await t.test('POST /api/drivers/select -> 404 when selecting nonexistent driver ID', async () => {
    const res = await fetch(`${env.baseUrl}/api/drivers/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: 'drv-nonexistent-9999' }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /does not exist|not found/i);
  });

  // ==========================================================================
  // 6. HRE (HIGHWAY RESTRICTION ENGINE) & FHWA 54B LOW-BRIDGE AUDIT
  // ==========================================================================
  await t.test('POST /api/hre/route-audit -> Happy Path: Safe clearance along Loop 820', async () => {
    const res = await fetch(`${env.baseUrl}/api/hre/route-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corridor: 'Loop 820 North Bypass',
        vehicleHeightFt: 13.0,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.overallStatus, 'SAFE');
    assert.ok(body.lowestBufferDeltaInches > 0);
    assert.ok(Array.isArray(body.activeRestrictions));
  });

  await t.test('POST /api/hre/route-audit -> Critical Overpass Hazard: 14\' 6" truck triggers bypass', async () => {
    const res = await fetch(`${env.baseUrl}/api/hre/route-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corridor: 'I-20 Eastbound Freight Corridor',
        vehicleHeightFt: 14.5, // 14' 6" - exceeds 13' 6" overpass
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.overallStatus, 'CRITICAL_RESTRICTION');
    assert.ok(body.criticalCount > 0);
    assert.ok(body.lowestBufferDeltaInches <= 0);
    assert.ok(body.recommendedBypassCorridor, 'Must recommend secondary bypass corridor');
    assert.match(body.recommendedBypassCorridor, /Loop 820 North/i);
  });

  // ==========================================================================
  // 7. TRAXXAS HIGH-FREQUENCY TELEMETRY & TRANSPONDER PING
  // ==========================================================================
  await t.test('GET /api/traxxas/telemetry -> Happy Path returns telematics vitals', async () => {
    const res = await fetch(`${env.baseUrl}/api/traxxas/telemetry`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.telemetry.speedMph, 'number');
    assert.equal(typeof body.telemetry.peakShockG, 'number');
    assert.equal(typeof body.telemetry.brakePressurePsi, 'number');
    assert.equal(typeof body.telemetry.canBusHealthPct, 'number');
  });

  await t.test('POST /api/traxxas/ping -> Happy Path returns CAN-Bus pong diagnostics', async () => {
    const res = await fetch(`${env.baseUrl}/api/traxxas/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transponderId: 'TRAXXAS-TX904-ENTERPRISE' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pong, true);
    assert.equal(body.baudRateKbps, 250);
    assert.equal(body.status, 'SYNCHRONIZED');
  });

  // ==========================================================================
  // 8. TELECOMMUNICATIONS (VOICE & SMS TOLL ACCOUNTING - "PAYING THE SERVER")
  // ==========================================================================
  await t.test('POST /api/telecom/calls -> Happy Path pings server & records voice dispatch call', async () => {
    const res = await fetch(`${env.baseUrl}/api/telecom/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+13125558821',
        driverName: 'Jeremiah J. Morris',
        truckUnit: 'TRK-904',
        message: 'Clearance bypass confirmation: rerouted via Loop 820 North.',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.carrierSid.startsWith('CA'));
    assert.equal(body.call.to, '+13125558821');
    assert.equal(body.call.driverName, 'Jeremiah J. Morris');
    assert.equal(body.call.truckUnit, 'TRK-904');
    assert.equal(body.costUsd, 0.014); // Standard $0.014/min carrier voice rate
  });

  await t.test('POST /api/telecom/calls -> Validation Error when recipient is missing', async () => {
    const res = await fetch(`${env.baseUrl}/api/telecom/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverName: 'Jeremiah',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /recipient phone number is required/i);
  });

  await t.test('POST /api/dispatch-messages -> Happy Path sends SMS directive & records toll', async () => {
    const res = await fetch(`${env.baseUrl}/api/dispatch-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+13125558821',
        text: 'Priority dispatch check-in: Report mileage at state scale.',
        attachedLoadId: 'LD-904-TX',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.carrierSid);
    assert.equal(body.to, '+13125558821');
  });

  await t.test('POST /api/dispatch-messages -> Validation Error on empty message text', async () => {
    const res = await fetch(`${env.baseUrl}/api/dispatch-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+13125558821',
        text: '   ',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /message .* required/i);
  });

  await t.test('GET /api/telecom/summary -> Happy Path returns carrier toll accounting ledger', async () => {
    const res = await fetch(`${env.baseUrl}/api/telecom/summary`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.summary.totalCalls >= 1);
    assert.ok(body.summary.totalTelecomCostUsd > 0);
    assert.equal(body.summary.voiceRatePerMinuteUsd, 0.014);
    assert.equal(body.summary.smsRatePerSegmentUsd, 0.0079);
  });

  // ==========================================================================
  // 9. IDEMPOTENT CHAT & MESSAGE DELETION (NO CRASH ON DOUBLE DELETE)
  // ==========================================================================
  await t.test('DELETE /api/messages/:id and /api/chats/:id -> Idempotent double delete does not crash', async () => {
    // 1. Create a message
    const createRes = await fetch(`${env.baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Test chat message for double delete', channel: 'DISPATCH' }),
    });
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    const msgId = createBody.message.id;

    // 2. First deletion
    const delRes1 = await fetch(`${env.baseUrl}/api/messages/${msgId}`, { method: 'DELETE' });
    assert.equal(delRes1.status, 200);
    const delBody1 = await delRes1.json();
    assert.equal(delBody1.success, true);

    // 3. Second deletion (idempotent - should not crash or throw 500)
    const delRes2 = await fetch(`${env.baseUrl}/api/messages/${msgId}`, { method: 'DELETE' });
    assert.equal(delRes2.status, 200);
    const delBody2 = await delRes2.json();
    assert.equal(delBody2.success, true);
    assert.equal(delBody2.alreadyDeleted, true);

    // 4. Double delete on /api/chats/:id
    const chatDel1 = await fetch(`${env.baseUrl}/api/chats/nonexistent-chat-999`, { method: 'DELETE' });
    assert.equal(chatDel1.status, 200);
    const chatDelBody1 = await chatDel1.json();
    assert.equal(chatDelBody1.success, true);
    assert.equal(chatDelBody1.alreadyDeleted, true);
  });

  // ==========================================================================
  // 10. 404 NOT FOUND STRUCTURED HANDLING
  // ==========================================================================
  await t.test('GET /api/unmapped-endpoint -> 404 formatted with standard error schema', async () => {
    const res = await fetch(`${env.baseUrl}/api/unmapped-endpoint`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'E_SYS_NOT_FOUND');
    assert.ok(body.error.correlationId);
  });

  // ==========================================================================
  // 11. FLEET FUNCTIONS CATALOG & TOGGLES (THE G.O.A.T. PERMANENTLY REMOVED)
  // ==========================================================================
  await t.test('GET and POST /api/fleet/functions -> Enforces Master Mechanic and disables the-g-o-a-t-', async () => {
    // 1. GET functions catalog
    const getRes = await fetch(`${env.baseUrl}/api/fleet/functions`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.ok(Array.isArray(getBody.functions));

    // 2. POST function toggles: user attempts to turn on deprecated module
    const postRes = await fetch(`${env.baseUrl}/api/fleet/functions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabledModules: {
          'night-hud': true,
          'hos-clocks': true,
          'radar-54b': true,
          'master-mechanic': true,
          'the-g-o-a-t-': true, // Must be forced to false per GEMINI.md
        },
      }),
    });
    assert.equal(postRes.status, 200);
    const postBody = await postRes.json();
    assert.equal(postBody.success, true);
    assert.equal(postBody.disabledFunctions.includes('the-g-o-a-t-'), true);
    assert.equal(postBody.activeFunctions.includes('the-g-o-a-t-'), false);
    assert.equal(postBody.activeFunctions.includes('master-mechanic'), true);
  });

  // ==========================================================================
  // 12. PREDICTIVE ANALYTICS & STATE RESOLUTION
  // ==========================================================================
  await t.test('POST /api/predictive/resolve-states -> Returns resolved eigenstate and physical metrics', async () => {
    const res = await fetch(`${env.baseUrl}/api/predictive/resolve-states`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speedMph: 68,
        grossWeightLbs: 78000,
        routeCorridor: 'I-20',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'SUCCESS');
    assert.ok(body.resolvedState);
    assert.ok(body.resolvedState.primaryRouteEigenstate.includes('I-20'));
    assert.equal(typeof body.resolvedState.kineticMomentumKgMs, 'number');
    assert.equal(typeof body.resolvedState.brakeRotorHeatDissipationKw, 'number');
  });

  // ==========================================================================
  // 13. MEMORY OPTIMIZATION & TELEMETRY HEALTH
  // ==========================================================================
  await t.test('POST /api/memory/apply-optimization and GET /api/memory/stats', async () => {
    const optRes = await fetch(`${env.baseUrl}/api/memory/apply-optimization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'GC_DOM_PRUNE',
        targetScope: 'TELEMETRY_ENGINE',
      }),
    });
    assert.equal(optRes.status, 200);
    const optBody = await optRes.json();
    assert.equal(optBody.status, 'SUCCESS');
    assert.ok(optBody.optimization?.memorySavedMb > 0);

    const statsRes = await fetch(`${env.baseUrl}/api/memory/stats`);
    assert.equal(statsRes.status, 200);
    const statsBody = await statsRes.json();
    assert.ok(statsBody.latestSnapshot);
    assert.ok(statsBody.aggregatedStats);
    assert.ok(statsBody.aggregatedStats.totalMemorySavedMb > 0);
  });

  // ==========================================================================
  // 14. SALESFORCE ENTERPRISE CRM & USER SUBSCRIPTION LEDGER (WHO, TIME, HOW MUCH)
  // ==========================================================================
  await t.test('POST /api/subscriptions -> Registers commercial subscriber with WHO, TIME, HOW MUCH & Salesforce sync', async () => {
    const newSubPayload = {
      userId: 'usr-jeremiah-101',
      driverName: 'Jeremiah J. Morris',
      email: 'jeremiah.morris@morrishive.com',
      phone: '+1 (312) 555-8821',
      cdlNumber: 'IL-CDL-98104820',
      cdlState: 'IL',
      carrierName: 'Morris Hive Freight LLC',
      usdotNumber: '3948210',
      assignedUnit: 'TRK-904',
      tier: 'FLEET_PRO',
      billingCycle: 'MONTHLY',
      paymentMethod: 'Corporate ACH Direct •••• 4962',
    };

    const res = await fetch(`${env.baseUrl}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSubPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.subscription);

    // Verify WHO: driver name, email, CDL, carrier
    assert.equal(body.who.driverName, 'Jeremiah J. Morris');
    assert.equal(body.who.email, 'jeremiah.morris@morrishive.com');
    assert.equal(body.who.cdlNumber, 'IL-CDL-98104820');
    assert.equal(body.who.carrierName, 'Morris Hive Freight LLC');

    // Verify TIME: timestamp, cycle, expiresAt
    assert.ok(body.time.subscribedAt);
    assert.equal(body.time.billingCycle, 'MONTHLY');
    assert.ok(body.time.expiresAt);
    assert.ok(body.time.formattedTime);

    // Verify HOW MUCH: tier, rate, currency
    assert.equal(body.howMuch.tier, 'FLEET_PRO');
    assert.equal(body.howMuch.amountUsd, 99.0);
    assert.equal(body.howMuch.currency, 'USD');

    // Verify Salesforce attestation & audit ledger hash
    assert.ok(body.subscription.salesforce);
    assert.ok(['SYNCED', 'FALLBACK_LEDGER'].includes(body.subscription.salesforce.status));
    assert.ok(body.subscription.salesforce.auditLedgerHash);
  });

  await t.test('GET /api/subscriptions & /api/salesforce/status -> Returns registered subscriptions & CRM sync state', async () => {
    const res = await fetch(`${env.baseUrl}/api/subscriptions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.subscriptions));
    assert.ok(body.count >= 2);
    assert.ok(body.salesforceStatus);
    assert.equal(typeof body.salesforceStatus.totalSynced, 'number');

    const statusRes = await fetch(`${env.baseUrl}/api/salesforce/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.ok(statusBody.instanceUrl);
    assert.ok(['PRODUCTION', 'SANDBOX', 'FALLBACK_LOCAL_LEDGER'].includes(statusBody.environment));
  });

  // ==========================================================================
  // 15. ANSI ASC X12 EDI INTEGRATION & 4 COST-MINIMIZING ALTERNATIVES
  // ==========================================================================
  await t.test('GET /api/edi/alternatives -> Returns 4 concrete cost-minimizing alternatives to high-cost REST APIs', async () => {
    const res = await fetch(`${env.baseUrl}/api/edi/alternatives`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totalAlternatives, 4);
    assert.ok(Array.isArray(body.alternatives));

    const titles = body.alternatives.map((a) => a.title);
    assert.ok(titles.some((t) => t.includes('ANSI ASC X12 EDI')));
    assert.ok(titles.some((t) => t.includes('Webhook / WebSocket')));
    assert.ok(titles.some((t) => t.includes('Edge Computing') || t.includes('Geofence Mesh')));
    assert.ok(titles.some((t) => t.includes('MQTT')));
  });

  await t.test('POST /api/edi/generate-204 -> Generates valid ANSI ASC X12 EDI 204 Motor Carrier Load Tender', async () => {
    const tenderPayload = {
      loadId: 'LD-TX-GA-904',
      billOfLading: 'BOL-88190',
      shipperName: 'Dallas Distribution Center Dock 4',
      shipperAddress: '3400 Interstate 20 East',
      shipperCity: 'Dallas',
      shipperState: 'TX',
      shipperZip: '75236',
      consigneeName: 'Atlanta Southeast Terminal',
      consigneeAddress: '8800 Logistics Way',
      consigneeCity: 'Atlanta',
      consigneeState: 'GA',
      consigneeZip: '30301',
      commodityDescription: 'High-Value Cold-Chain Freight',
      grossWeightLbs: 42800,
      contractRateUsd: 2540.0,
      carrierScac: 'TWES',
    };

    const res = await fetch(`${env.baseUrl}/api/edi/generate-204`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenderPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.transaction.transactionType, '204');
    assert.equal(body.transaction.carrierScac, 'TWES');
    assert.equal(body.transaction.parsedSummary.amountUsd, 2540.0);

    // Verify ANSI ASC X12 structural control segments
    const raw = body.transaction.rawEdiContent;
    assert.match(raw, /^ISA\*00\*/);
    assert.match(raw, /GS\*SM\*MORRISHIVE\*TWES/);
    assert.match(raw, /ST\*204\*/);
    assert.match(raw, /B2\*\*TWES\*LD-TX-GA-904\*\*PP/);
    assert.match(raw, /L11\*BOL-88190\*BM/);
    assert.match(raw, /N1\*SH\*Dallas Distribution Center Dock 4/);
    assert.match(raw, /N1\*CN\*Atlanta Southeast Terminal/);
    assert.match(raw, /SE\*17\*/);
    assert.match(raw, /GE\*1\*/);
    assert.match(raw, /IEA\*1\*/);
  });

  await t.test('POST /api/edi/generate-214 -> Generates valid ANSI ASC X12 EDI 214 Shipment Status Message', async () => {
    const statusPayload = {
      loadId: 'LD-TX-GA-904',
      statusCode: 'X6',
      statusDescription: 'En Route Interstate 20 Eastbound Corridor',
      cityName: 'Terrell',
      stateCode: 'TX',
      latitude: 32.735,
      longitude: -96.275,
      unitNumber: 'TRK-904',
      trailerNumber: 'TRL-5321',
    };

    const res = await fetch(`${env.baseUrl}/api/edi/generate-214`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.transaction.transactionType, '214');

    const raw = body.transaction.rawEdiContent;
    assert.match(raw, /^ISA\*00\*/);
    assert.match(raw, /GS\*QM\*TWES\*MORRISHIVE/);
    assert.match(raw, /ST\*214\*/);
    assert.match(raw, /B10\*LD-TX-GA-904/);
    assert.match(raw, /AT7\*X6\*NS/);
    assert.match(raw, /MS1\*Terrell\*TX\*USA/);
    assert.match(raw, /MS2\*TWES\*TRK-904/);
    assert.match(raw, /MS3\*TWES\*B\*O\*A\*TRL-5321/);
    assert.match(raw, /SE\*11\*/);
    assert.match(raw, /IEA\*1\*/);
  });

  await t.test('POST /api/edi/generate-210 -> Generates valid ANSI ASC X12 EDI 210 Freight Invoice', async () => {
    const invPayload = {
      invoiceNumber: 'INV-2026-904',
      loadId: 'LD-TX-GA-904',
      billToName: 'Morris Hive Freight Network Direct',
      billToAddress: '100 Logistics Blvd',
      billToCity: 'Dallas',
      billToState: 'TX',
      billToZip: '75201',
      linehaulAmountUsd: 2159.0,
      fuelSurchargeUsd: 381.0,
      totalAmountUsd: 2540.0,
      mileage: 780,
    };

    const res = await fetch(`${env.baseUrl}/api/edi/generate-210`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.transaction.transactionType, '210');

    const raw = body.transaction.rawEdiContent;
    assert.match(raw, /^ISA\*00\*/);
    assert.match(raw, /GS\*IM\*TWES\*MORRISHIVE/);
    assert.match(raw, /ST\*210\*/);
    assert.match(raw, /B3\*B\*INV-2026-904\*LD-TX-GA-904/);
    assert.match(raw, /L1\*1\*215900\*FR\*215900/);
    assert.match(raw, /L1\*2\*38100\*PM\*38100/);
    assert.match(raw, /L3\*254000\*G\*254000/);
    assert.match(raw, /SE\*14\*/);
    assert.match(raw, /IEA\*1\*/);
  });

  // ==========================================================================
  // 16. FMCSA ERODS TAG-A-LONG & ROADSIDE INSPECTION ENDPOINTS
  // ==========================================================================
  await t.test('POST /api/erods/tag-along/upload -> Happy Path transfers Tag-a-Long ERoDS & returns receipt', async () => {
    const payload = {
      routingKeyComment: 'TX-DPS-INSP-4920',
      reportNumber: 'TX-2026-094821-I',
      inspectionLevel: 'LEVEL_2_WALK_AROUND',
      officerName: 'Trooper J. Miller',
      officerBadgeNumber: 'Badge #4920',
      cleanInspection: true,
      cvsaDecalIssued: true,
      cvsaDecalNumber: 'CVSA-2026-Q4-88194',
    };

    const res = await fetch(`${env.baseUrl}/api/erods/tag-along/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.bundle);
    assert.equal(body.bundle.routingKeyComment, 'TX-DPS-INSP-4920');
    assert.equal(body.bundle.reportNumber, 'TX-2026-094821-I');
    assert.equal(body.bundle.fmcsaWebServicesStatus, 'ACCEPTED');
    assert.ok(body.bundle.fmcsaSubmissionReceiptCode.startsWith('RODS-TX-'));
    assert.ok(body.bundle.cryptographicHashSha256.startsWith('SHA256:'));
  });

  await t.test('POST /api/erods/tag-along/upload -> Validation Error when routingKeyComment is empty', async () => {
    const res = await fetch(`${env.baseUrl}/api/erods/tag-along/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routingKeyComment: '   ',
        reportNumber: 'TX-2026-094821-I',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /routing key .* required/i);
  });

  await t.test('GET /api/erods/tag-along/records -> Happy Path returns list of Tag-a-Long inspection records', async () => {
    const res = await fetch(`${env.baseUrl}/api/erods/tag-along/records`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.records));
    assert.ok(body.count >= 2);
    assert.ok(body.records.some((r) => r.routingKeyComment === 'TX-DPS-INSP-4920'));
  });

  await t.test('POST /api/erods/tag-along/parse-ocr -> Happy Path extracts inspection sheet metadata', async () => {
    const res = await fetch(`${env.baseUrl}/api/erods/tag-along/parse-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentName: 'TX_DPS_MCSA5884.pdf',
        rawText: 'STATE OF TEXAS FORM MCSA-5884 ROADSIDE REPORT',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.scannedInspection);
    assert.equal(body.scannedInspection.inspectionLevel, 'LEVEL_2_WALK_AROUND');
    assert.equal(body.scannedInspection.cleanInspection, true);
    assert.ok(body.scannedInspection.ocrConfidenceScore >= 95);
  });
});
