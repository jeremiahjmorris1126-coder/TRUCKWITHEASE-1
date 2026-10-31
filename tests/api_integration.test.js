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
  // 9. 404 NOT FOUND STRUCTURED HANDLING
  // ==========================================================================
  await t.test('GET /api/unmapped-endpoint -> 404 formatted with standard error schema', async () => {
    const res = await fetch(`${env.baseUrl}/api/unmapped-endpoint`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'E_SYS_NOT_FOUND');
    assert.ok(body.error.correlationId);
  });
});
