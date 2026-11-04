import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.ts';

async function request(path, { method = 'GET', body, headers = {} } = {}, env = {}) {
  const pending = [];
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
  return {
    response,
    body: response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text(),
  };
}

test('Cloudflare Worker backend routes and bindings', async (t) => {
  await t.test('OPTIONS requests return CORS headers', async () => {
    const { response } = await request('/api/ready', { method: 'OPTIONS' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });

  await t.test('health reports binding state and refreshes the KV cache', async () => {
    let cachedPayload;
    const env = {
      DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) },
      CACHE: {
        get: async () => null,
        put: async (key, value) => { cachedPayload = { key, value }; },
      },
    };
    const { response, body } = await request('/api/health', {}, env);
    assert.equal(response.status, 200);
    assert.equal(body.status, 'UP');
    assert.equal(body.bindings.d1Database, 'CONNECTED');
    assert.equal(body.bindings.kvCache, 'CONNECTED');
    assert.equal(cachedPayload.key, 'subsystem_health');

    const unavailable = await request('/api/health', {}, {
      DB: { prepare: () => ({ first: async () => { throw new Error('D1 unavailable'); } }) },
    });
    assert.equal(unavailable.body.bindings.d1Database, 'BOUND_SCHEMA_UNINITIALIZED');
  });

  await t.test('readiness and tenant authentication endpoints return expected data', async () => {
    const ready = await request('/api/ready');
    assert.equal(ready.body.ready, true);

    const tenant = await request('/api/auth/tenant', { headers: { Authorization: '******' } });
    assert.equal(tenant.body.status, 'AUTHORIZED');
    assert.equal(tenant.body.tenant, 'morrishive-logistics');
  });

  await t.test('weather endpoint returns fresh and cached corridor reports', async () => {
    let cachedValue = null;
    const cache = {
      get: async () => cachedValue,
      put: async (_key, value) => { cachedValue = value; },
    };
    const fresh = await request('/api/weather/hazards?corridor=I-44', {}, { CACHE: cache });
    assert.equal(fresh.response.headers.get('x-cache'), 'MISS');
    assert.equal(fresh.body.corridor, 'I-44');
    assert.ok(cachedValue);

    const cached = await request('/api/weather/hazards?corridor=I-44', {}, { CACHE: cache });
    assert.equal(cached.response.headers.get('x-cache'), 'HIT');
    assert.equal(cached.body.corridor, 'I-44');
  });

  await t.test('quantum telemetry endpoint calculates physical metrics', async () => {
    const result = await request('/api/quantum/telemetry-physics', {
      method: 'POST',
      body: { speedMph: 60, axleWeightLbs: 70000 },
    });
    assert.equal(result.body.status, 'SUCCESS');
    assert.ok(result.body.physics.kineticEnergyJoules > 0);
  });

  await t.test('driver authentication and roster endpoints respond', async () => {
    const signup = await request('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Test Driver', cdlNumber: 'TEST-CDL' },
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.body.driver.name, 'Test Driver');

    const signin = await request('/api/auth/signin', {
      method: 'POST',
      body: { identifier: 'test', fmcsaPin: '1234' },
    });
    assert.equal(signin.body.success, true);

    const session = await request('/api/auth/session');
    assert.equal(session.body.authenticated, true);

    const drivers = await request('/api/drivers');
    assert.equal(drivers.body.totalDrivers, drivers.body.drivers.length);

    const selected = await request('/api/drivers/select', {
      method: 'POST',
      body: { driverId: 'drv-test' },
    });
    assert.equal(selected.body.selectedDriverId, 'drv-test');
  });

  await t.test('fleet, route restriction, and telemetry endpoints respond', async () => {
    const functions = await request('/api/fleet/functions');
    assert.ok(functions.body.activeFunctions.includes('master-mechanic'));

    const restrictions = await request('/api/hre/restrictions');
    assert.ok(restrictions.body.restrictions.length > 0);

    const audit = await request('/api/hre/route-audit', { method: 'POST', body: {} });
    assert.equal(audit.body.overallStatus, 'SAFE');

    const telemetry = await request('/api/traxxas/telemetry');
    assert.equal(telemetry.body.telemetry.samplingRateHz, 10);

    const ping = await request('/api/traxxas/ping');
    assert.equal(ping.body.pong, true);
    assert.equal(ping.body.baudRateKbps, 250);
  });

  await t.test('GPSTab endpoints return autonomous fallback data without credentials', async () => {
    const status = await request('/api/gpstab/status');
    assert.equal(status.body.isConfigured, false);

    const telemetry = await request('/api/gpstab/telemetry');
    assert.equal(telemetry.body.telemetry.source, 'GPSTAB_AUTONOMOUS_CACHE');
  });

  await t.test('unknown routes and binding failures return structured errors', async () => {
    const missing = await request('/api/not-a-route');
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.path, '/api/not-a-route');

    const failed = await request('/api/health', {}, { CACHE: { get: async () => { throw new Error('KV unavailable'); } } });
    assert.equal(failed.response.status, 500);
    assert.equal(failed.body.error, 'Worker Internal Error');
  });
});
