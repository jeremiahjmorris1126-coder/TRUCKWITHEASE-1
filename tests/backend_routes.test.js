process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiApp } from '../server.ts';
import { createFleetCore } from '../server/fleetCore.ts';

const externalConfig = [
  'CARRIER_API_SECRET',
  'TRUCKWITHEASE_API_SECRET',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GPSTAB_API_KEY',
  'GPSTAB_COMPANY_ID',
  'GPSTAB_API_URL',
  'SALESFORCE_INSTANCE_URL',
  'SALESFORCE_ACCESS_TOKEN',
  'SALESFORCE_CLIENT_ID',
  'SALESFORCE_CLIENT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_VOICE_PHONE_NUMBER',
  'TWILIO_TO_PHONE_NUMBER',
];

async function setupTestServer() {
  const server = http.createServer(createApiApp(createFleetCore()));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function requestJson(baseUrl, path, method = 'GET', body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test('Uncovered Express backend routes use isolated local fallbacks', async (t) => {
  const savedEnvironment = Object.fromEntries(
    externalConfig.map((key) => [key, process.env[key]]),
  );
  externalConfig.forEach((key) => delete process.env[key]);

  const api = await setupTestServer();
  t.after(async () => {
    await api.close();
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await t.test('readiness and tenant session endpoints return their response schemas', async () => {
    const ready = await requestJson(api.baseUrl, '/api/ready');
    assert.equal(ready.response.status, 200);
    assert.equal(ready.body.ready, true);

    const tenant = await requestJson(api.baseUrl, '/api/auth/tenant');
    assert.equal(tenant.body.status, 'OK');
    assert.equal(tenant.body.tenant.tenantId, 'DEFAULT-CARRIER-TENANT');

    const session = await requestJson(api.baseUrl, '/api/auth/session');
    assert.equal(typeof session.body.authenticated, 'boolean');

    const signout = await requestJson(api.baseUrl, '/api/auth/signout', 'POST', {});
    assert.equal(signout.body.success, true);
  });

  await t.test('memory and predictive endpoints accept and return computed values', async () => {
    const tracked = await requestJson(api.baseUrl, '/api/memory/track', 'POST', {
      usedHeapMb: 80,
      totalHeapMb: 100,
      canBusLatencyMs: 6,
    });
    assert.equal(tracked.body.status, 'OK');
    assert.equal(tracked.body.snapshot.memoryHealthScore, 53);

    const report = await requestJson(api.baseUrl, '/api/memory/quantum-predictive-report', 'POST', {
      alertnessScore: 60,
      driveHours: 9,
      laneDriftEvents: 2,
    });
    assert.equal(report.body.driverAlertnessIndex, 60);
    assert.ok(report.body.actionableDirectives.length > 0);

    const latestReport = await requestJson(api.baseUrl, '/api/memory/quantum-predictive-report');
    assert.equal(latestReport.body.driverAlertnessIndex, 60);

    const anneal = await requestJson(api.baseUrl, '/api/predictive/anneal', 'POST', { numStops: 3 });
    assert.equal(anneal.body.status, 'OPTIMIZED');
    assert.equal(anneal.body.results.optimizedStopsSequence.length, 4);

    const physics = await requestJson(api.baseUrl, '/api/quantum/telemetry-physics', 'POST', {
      speedMph: 60,
      axleWeightLbs: 70000,
    });
    assert.equal(physics.body.status, 'SUCCESS');
    assert.ok(physics.body.physics.kineticEnergyJoules > 0);

    const hos = await requestJson(api.baseUrl, '/api/quantum/hos-optimizer', 'POST', {
      driveTimeRemainingMins: 300,
    });
    assert.equal(hos.body.status, 'SUCCESS');
    assert.ok(hos.body.hosOptimization.recommendedBreakWindowMins > 0);

    const algorithms = await requestJson(api.baseUrl, '/api/quantum/all-functions');
    assert.equal(algorithms.body.status, 'OPERATIONAL');
    assert.ok(algorithms.body.activeAlgorithms.some((algorithm) => algorithm.endpoint === '/api/predictive/anneal'));
  });

  await t.test('driver and vehicle configuration endpoints handle updates and diagnostics', async () => {
    const driver = await requestJson(api.baseUrl, '/api/drivers/drv-jeremiah-904', 'PUT', {
      assignedUnit: 'TRK-905',
    });
    assert.equal(driver.response.status, 200);
    assert.equal(driver.body.driver.assignedUnit, 'TRK-905');

    const restrictions = await requestJson(api.baseUrl, '/api/hre/restrictions?corridor=I-20');
    assert.equal(restrictions.body.corridor, 'I-20');
    assert.ok(Array.isArray(restrictions.body.restrictions));

    const traxxas = await requestJson(api.baseUrl, '/api/traxxas/config');
    assert.equal(traxxas.body.baudRateKbps, 250);
    assert.equal(traxxas.body.samplingRateHz, 10);

    const gpstabStatus = await requestJson(api.baseUrl, '/api/gpstab/status');
    assert.equal(gpstabStatus.body.isConfigured, false);

    const telemetry = await requestJson(api.baseUrl, '/api/gpstab/telemetry?unit=TRK-777');
    assert.equal(telemetry.body.telemetry.unitNumber, 'TRK-777');
    assert.equal(telemetry.body.telemetry.source, 'GPSTAB_AUTONOMOUS_CACHE');

    const hos = await requestJson(api.baseUrl, '/api/gpstab/hos?driverId=DRV-777');
    assert.equal(hos.body.hos.driverId, 'DRV-777');
    assert.equal(hos.body.hos.fmcsaAttestationVerified, true);

    const sync = await requestJson(api.baseUrl, '/api/gpstab/sync', 'POST', {
      unit: 'TRK-778',
      driverId: 'DRV-778',
    });
    assert.equal(sync.body.telemetry.unitNumber, 'TRK-778');
    assert.equal(sync.body.hos.driverId, 'DRV-778');
  });

  await t.test('external integration fallbacks and input validation remain safe', async () => {
    const twimlResponse = await fetch(`${api.baseUrl}/api/telecom/voice-twiml?message=Bridge%20ahead&unit=TRK-904`);
    const twiml = await twimlResponse.text();
    assert.equal(twimlResponse.status, 200);
    assert.match(twimlResponse.headers.get('content-type'), /text\/xml/);
    assert.match(twiml, /Bridge ahead/);

    const telecom = await requestJson(api.baseUrl, '/api/telecom/messages', 'POST', {
      to: '+13125558821',
      text: 'test only',
    });
    assert.equal(telecom.response.status, 201);
    assert.equal(telecom.body.success, true);

    const call = await requestJson(api.baseUrl, '/api/dispatch-calls', 'POST', {});
    assert.equal(call.response.status, 400);

    const hangup = await requestJson(api.baseUrl, '/api/telecom/calls/not-a-call/hangup', 'POST', {});
    assert.equal(hangup.response.status, 404);

    const loopAlert = await requestJson(api.baseUrl, '/api/dispatch-loop/alert', 'POST', { smsBody: 'dispatch test' });
    assert.equal(loopAlert.response.status, 201);

    const idleAlert = await requestJson(api.baseUrl, '/api/telematics/idle-alert', 'POST', {
      vehicleUnit: 'TRK-904',
      driverName: 'Test Driver',
      idleDurationMinutes: 15,
    });
    assert.equal(idleAlert.response.status, 201);

    const weatherPost = await requestJson(api.baseUrl, '/api/weather/regional-hazards', 'POST', {
      location: 'Test locality',
      corridor: 'I-44',
      lat: 37.95,
      lon: -91.77,
    });
    assert.equal(weatherPost.body.status, 'FALLBACK');
    assert.equal(weatherPost.body.location.corridor, 'I-44');

    const weatherGet = await requestJson(api.baseUrl, '/api/weather/regional-hazards?location=Test&corridor=I-70');
    assert.equal(weatherGet.body.status, 'FALLBACK');
    assert.equal(weatherGet.body.location.corridor, 'I-70');

    const salesforce = await requestJson(api.baseUrl, '/api/salesforce/sync', 'POST', {});
    assert.equal(salesforce.body.success, true);

    const transactions = await requestJson(api.baseUrl, '/api/edi/transactions');
    assert.equal(transactions.body.count, transactions.body.transactions.length);

    const edi990 = await requestJson(api.baseUrl, '/api/edi/generate-990', 'POST', { loadId: 'LOAD-TEST-990' });
    assert.equal(edi990.response.status, 201);
    assert.equal(edi990.body.transaction.transactionType, '990');

    const addons = await requestJson(api.baseUrl, '/api/hardware/addons');
    assert.equal(addons.body.count, addons.body.addons.length);
  });

  await t.test('repository export endpoints reject requests when a secret is configured', async () => {
    process.env.CARRIER_API_SECRET = 'test-secret';
    const download = await requestJson(api.baseUrl, '/api/export-cloudflare-github/download');
    assert.equal(download.response.status, 401);

    const push = await requestJson(api.baseUrl, '/api/export-cloudflare-github/push', 'POST', {});
    assert.equal(push.response.status, 401);
    delete process.env.CARRIER_API_SECRET;
  });
});
