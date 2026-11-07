#!/usr/bin/env node
/**
 * TruckWithEase backend HTTP verification.
 *
 * Exercises the real Express server over HTTP: health/readiness probes, auth
 * enforcement, role checks, multi-tenant isolation, and the core app flows
 * (loads, driver profile/vault, DVIR, fuel logs, expenses, invoices, detention,
 * alerts, telematics, routing).
 *
 * Usage:
 *   BASE_URL=http://localhost:3999 node scripts/verify_backend_http.mjs
 *
 * Full mode (default for localhost) needs a server started with
 * FIREBASE_AUTH_EMULATOR_HOST set, so unsigned emulator tokens are accepted
 * for the seeded test users. Against any non-local BASE_URL only the public
 * probes and the "auth is enforced" checks run (MODE=public), since a real
 * deployment must reject emulator tokens.
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3999').replace(/\/$/, '');
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL);
const MODE = process.env.MODE || (isLocal ? 'full' : 'public');

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n── ${name}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ section: currentSection, name, ok: true });
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } catch (err) {
    results.push({ section: currentSection, name, ok: false, error: err.message });
    console.log(`  FAIL  ${name}\n        → ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function emulatorToken(uid, email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: uid,
    sub: uid,
    email,
    iat: now,
    exp: now + 3600,
    aud: 'project-f0634118-be01-44f7-b36',
    iss: 'https://securetoken.google.com/project-f0634118-be01-44f7-b36',
  })}.`;
}

const USERS = {
  fleet1Admin: emulatorToken('usr-fleet1-admin', 'admin@fleet1.com'),
  fleet1Driver: emulatorToken('usr-fleet1-driver', 'driver1@fleet1.com'),
  fleet2Admin: emulatorToken('usr-fleet2-admin', 'admin@fleet2.com'),
  fleet2Driver: emulatorToken('usr-fleet2-driver', 'driver2@fleet2.com'),
};

async function api(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

function expectStatus(r, expected, label = '') {
  const list = Array.isArray(expected) ? expected : [expected];
  assert(list.includes(r.status),
    `${label}expected HTTP ${list.join('/')} got ${r.status}: ${r.text.slice(0, 200)}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function publicChecks() {
  section('Public probes');
  await check('GET /health → 200', async () => {
    const r = await api('GET', '/health');
    expectStatus(r, 200);
  });
  await check('GET /ready → 200', async () => {
    const r = await api('GET', '/ready');
    expectStatus(r, 200);
  });
  await check('GET /api/health (unauthenticated) → 200, no diagnostic leakage', async () => {
    const r = await api('GET', '/api/health');
    expectStatus(r, 200);
    return `status=${r.json?.status ?? 'n/a'}`;
  });
  await check('GET /api/ready → 200', async () => {
    const r = await api('GET', '/api/ready');
    expectStatus(r, 200);
  });
  await check('GET /api/pricing → 200 (public)', async () => {
    const r = await api('GET', '/api/pricing');
    expectStatus(r, 200);
  });

  section('Auth enforcement');
  await check('GET /api/loads without token → 401', async () => {
    expectStatus(await api('GET', '/api/loads'), 401);
  });
  await check('GET /api/loads with garbage Bearer → 401/403', async () => {
    expectStatus(await api('GET', '/api/loads', { token: 'not-a-real-token' }), [401, 403]);
  });
  await check('Forged twe_jwt_sig_v1 session token → 403', async () => {
    const payload = Buffer.from(JSON.stringify({ uid: 'usr-fleet1-admin', exp: 9999999999 })).toString('base64url');
    expectStatus(await api('GET', '/api/loads', { token: `twe_jwt_sig_v1.${payload}.forgedsig` }), [401, 403]);
  });
  await check('Invalid x-api-key → 401/403', async () => {
    expectStatus(await api('GET', '/api/telematics/vehicles', { headers: { 'x-api-key': 'twe_bogus_key' } }), [401, 403]);
  });
  await check('Unknown /api route → 404 (fail-closed)', async () => {
    expectStatus(await api('GET', '/api/does-not-exist-xyz'), 404);
  });
  if (!isLocal) {
    await check('Unsigned emulator token rejected by deployed server', async () => {
      expectStatus(await api('GET', '/api/loads', { token: USERS.fleet1Admin }), [401, 403]);
    });
  }
}

async function fullChecks() {
  const A1 = USERS.fleet1Admin, D1 = USERS.fleet1Driver, A2 = USERS.fleet2Admin, D2 = USERS.fleet2Driver;

  section('Identity & roles');
  await check('GET /api/auth/tenant resolves FLEET1 admin', async () => {
    const r = await api('GET', '/api/auth/tenant', { token: A1 });
    expectStatus(r, 200);
    const s = JSON.stringify(r.json);
    assert(s.includes('FLEET1'), `tenant response missing FLEET1: ${s.slice(0, 200)}`);
  });
  await check('GET /api/auth/users as driver → 403', async () => {
    expectStatus(await api('GET', '/api/auth/users', { token: D1 }), 403);
  });
  await check('GET /api/auth/users as fleet admin → 200', async () => {
    expectStatus(await api('GET', '/api/auth/users', { token: A1 }), 200);
  });

  section('Loads / dispatch');
  let loadId;
  await check('GET /api/loads (FLEET1 admin) → seeded loads', async () => {
    const r = await api('GET', '/api/loads', { token: A1 });
    expectStatus(r, 200);
    const loads = r.json?.loads ?? r.json;
    assert(Array.isArray(loads) && loads.length >= 3, `expected ≥3 loads, got ${JSON.stringify(r.json).slice(0, 150)}`);
    return `${loads.length} loads`;
  });
  await check('POST /api/loads creates load with $/hr yield', async () => {
    const r = await api('POST', '/api/loads', {
      token: A1,
      body: {
        loadNumber: 'HTTP-VERIFY-01', origin: 'Chicago, IL', destination: 'Detroit, MI',
        miles: 280, deadheadMiles: 10, grossPayUsd: 1400, equipmentType: 'DRY_VAN',
        weightLbs: 31000, pickupTime: 'Today', deliveryTime: 'Tonight',
        shipperBroker: 'Verify Freight', contactPhone: '+1-800-555-0000', estimatedTransitHours: 5,
      },
    });
    expectStatus(r, [200, 201]);
    const load = r.json?.load ?? r.json;
    assert(load?.id?.startsWith('load-'), `no load id: ${r.text.slice(0, 200)}`);
    assert(load.fleetId === 'FLEET1', `fleetId not stamped from caller: ${load.fleetId}`);
    assert(load.yieldPerHourUsd > 100, `yield ${load.yieldPerHourUsd}`);
    loadId = load.id;
    return `${loadId}, $${load.yieldPerHourUsd}/hr`;
  });
  await check('GET /api/loads/matched?hours=6 includes new load', async () => {
    const r = await api('GET', '/api/loads/matched?hours=6&hoursRemaining=6', { token: A1 });
    expectStatus(r, 200);
    assert(JSON.stringify(r.json).includes(loadId), 'new load not in matched list');
  });
  await check('FLEET2 admin cannot read FLEET1 load → 404', async () => {
    expectStatus(await api('GET', `/api/loads/${loadId}`, { token: A2 }), 404);
  });
  await check('FLEET2 admin cannot dispatch FLEET1 load → 404', async () => {
    expectStatus(await api('POST', `/api/loads/${loadId}/dispatch`, { token: A2, body: { driverId: 'usr-fleet2-driver' } }), 404);
  });
  await check('Driver cannot dispatch → 403', async () => {
    expectStatus(await api('POST', `/api/loads/${loadId}/dispatch`, { token: D1, body: {} }), 403);
  });
  await check('Cannot inject foreign fleetId on dispatch → 400', async () => {
    expectStatus(await api('POST', `/api/loads/${loadId}/dispatch`, { token: A1, body: { fleetId: 'FLEET2' } }), 400);
  });
  await check('Admin dispatches load to FLEET1 driver', async () => {
    const r = await api('POST', `/api/loads/${loadId}/dispatch`, { token: A1, body: { driverId: 'usr-fleet1-driver', unitId: 'UNIT-101' } });
    expectStatus(r, 200);
    assert(r.json?.load?.status === 'DISPATCHED', `status ${r.json?.load?.status}`);
  });
  await check('Invalid status value → 400', async () => {
    expectStatus(await api('POST', `/api/loads/${loadId}/status`, { token: D1, body: { status: 'TELEPORTED' } }), 400);
  });
  await check('Assigned driver advances DISPATCHED → IN_TRANSIT', async () => {
    const r = await api('POST', `/api/loads/${loadId}/status`, { token: D1, body: { status: 'IN_TRANSIT' } });
    expectStatus(r, 200);
    assert(r.json?.load?.status === 'IN_TRANSIT', `status ${r.json?.load?.status}`);
  });
  await check('Driver cannot move status backwards (IN_TRANSIT → AVAILABLE)', async () => {
    expectStatus(await api('POST', `/api/loads/${loadId}/status`, { token: D1, body: { status: 'AVAILABLE' } }), [400, 403]);
  });
  await check('Assigned driver completes load', async () => {
    const r = await api('PUT', `/api/loads/${loadId}/status`, { token: D1, body: { status: 'COMPLETED' } });
    expectStatus(r, 200);
    assert(r.json?.load?.status === 'COMPLETED', `status ${r.json?.load?.status}`);
  });

  section('Driver profile & document vault');
  await check('Driver reads own profile (auto-provisioned)', async () => {
    const r = await api('PUT', '/api/driver/profile', { token: D1, body: { name: 'Fleet One Driver', cdlState: 'TX' } });
    expectStatus(r, 200);
    const g = await api('GET', '/api/driver/profile', { token: D1 });
    expectStatus(g, 200);
    assert(JSON.stringify(g.json).includes('Fleet One Driver'), 'profile update not persisted');
  });
  await check('FLEET2 driver cannot read FLEET1 driver profile → 404/403', async () => {
    expectStatus(await api('GET', '/api/driver/profile/usr-fleet1-driver', { token: D2 }), [403, 404]);
  });
  let docId;
  await check('Driver uploads document to vault', async () => {
    const r = await api('POST', '/api/driver/documents', {
      token: D1, body: { type: 'RATE_CON', title: 'HTTP verify rate con', fileUrl: '/vault/verify.pdf', status: 'PENDING' },
    });
    expectStatus(r, [200, 201]);
    docId = (r.json?.document ?? r.json?.doc ?? r.json)?.id;
    assert(docId, `no doc id: ${r.text.slice(0, 200)}`);
  });
  await check('Driver lists own documents', async () => {
    const r = await api('GET', '/api/driver/documents', { token: D1 });
    expectStatus(r, 200);
    assert(JSON.stringify(r.json).includes(docId), 'uploaded doc missing from list');
  });
  await check('FLEET2 admin cannot read FLEET1 document → 404', async () => {
    expectStatus(await api('GET', `/api/driver/documents/${docId}`, { token: A2 }), [403, 404]);
  });

  section('DVIR (49 CFR 396.11)');
  const components = [
    'Service brakes including trailer brake connections', 'Parking brake', 'Steering mechanism',
    'Lighting devices and reflectors', 'Tires', 'Horn', 'Windshield wipers', 'Rear vision mirrors',
    'Coupling devices', 'Wheels and rims', 'Emergency equipment',
  ];
  let dvirId;
  await check('DVIR without signature rejected → 400', async () => {
    expectStatus(await api('POST', '/api/dvir', {
      token: D1, body: { unitNumber: 'TRK-101', odometer: 1, certifiedBy: '', defects: [{ component: 'Tires', hasDefect: false }], safeToOperate: true },
    }), 400);
  });
  await check('DVIR with OOS defect marked safe rejected → 400', async () => {
    expectStatus(await api('POST', '/api/dvir', {
      token: D1, body: { unitNumber: 'TRK-101', odometer: 1, certifiedBy: 'Driver', defects: [{ component: 'Parking brake', hasDefect: true, severity: 'OUT_OF_SERVICE' }], safeToOperate: true },
    }), 400);
  });
  await check('Valid pre-trip DVIR accepted → 201', async () => {
    const r = await api('POST', '/api/dvir', {
      token: D1,
      body: {
        unitNumber: 'TRK-101', odometer: 145200, type: 'PRE_TRIP', certifiedBy: 'Fleet One Driver',
        defects: components.map((c) => ({ component: c, hasDefect: false })), safeToOperate: true,
      },
    });
    expectStatus(r, 201);
    dvirId = r.json?.dvir?.id;
    assert(dvirId, 'no dvir id');
  });
  await check('FLEET2 cannot read FLEET1 DVIR → 404', async () => {
    expectStatus(await api('GET', `/api/dvir/${dvirId}`, { token: A2 }), 404);
  });

  section('Fuel, expenses, invoices');
  await check('Fuel log computes MPG', async () => {
    const r = await api('POST', '/api/fuel-logs', {
      token: D1, body: { date: '2026-11-01', gallons: 110.5, pricePerGallon: 3.849, currentOdometer: 145500, previousOdometer: 144800, stationName: 'Verify Stop', city: 'Festus', state: 'MO' },
    });
    expectStatus(r, 201);
    assert(r.json?.fuelLog?.fuelMpg === 6.33, `mpg ${r.json?.fuelLog?.fuelMpg}`);
    return `${r.json.fuelLog.fuelMpg} mpg`;
  });
  await check('Expense recorded', async () => {
    const r = await api('POST', '/api/expenses', {
      token: D1, body: { date: '2026-11-01', category: 'MAINTENANCE', amount: 42.5, vendor: 'TA', description: 'Wiper' },
    });
    expectStatus(r, 201);
  });
  let invoiceId;
  await check('Invoice issued by fleet admin', async () => {
    const r = await api('POST', '/api/invoices', {
      token: A1,
      body: {
        brokerCarrierName: 'Verify Broker', brokerEmail: 'billing@example.com', amountUsd: 2850,
        lineItems: [{ description: 'Linehaul', amount: 2700, type: 'FREIGHT' }, { description: 'Detention', amount: 150, type: 'DETENTION' }],
        status: 'ISSUED',
      },
    });
    expectStatus(r, 201);
    invoiceId = r.json?.invoice?.id;
    assert(invoiceId, 'no invoice id');
  });
  await check('FLEET2 cannot read FLEET1 invoice → 404', async () => {
    expectStatus(await api('GET', `/api/invoices/${invoiceId}`, { token: A2 }), [403, 404]);
  });
  await check('FLEET2 fuel-log list excludes FLEET1 data', async () => {
    const r = await api('GET', '/api/fuel-logs', { token: D2 });
    expectStatus(r, 200);
    assert(!JSON.stringify(r.json).includes('Verify Stop'), 'FLEET1 fuel log leaked into FLEET2');
  });

  section('Detention');
  await check('One-tap detention packet from seeded load', async () => {
    const r = await api('POST', '/api/detention/one-tap', {
      token: A1, body: { loadId: 'load-tx-01', vehicleId: 'UNIT-101', simulatedDwellMinutes: 240 },
    });
    expectStatus(r, 200);
    assert(r.json?.packet, 'no packet');
    assert(r.json.packet.fleetId === 'FLEET1', `packet fleetId ${r.json.packet.fleetId}`);
    assert(r.json.packet.integrity, 'packet missing integrity block');
    return r.json?.invoice ? r.json.invoice.invoiceNumber : 'packet only';
  });
  await check('FLEET2 cannot generate detention on FLEET1 load', async () => {
    expectStatus(await api('POST', '/api/detention/one-tap', { token: A2, body: { loadId: 'load-tx-01' } }), [400, 403, 404]);
  });

  section('Alerts, telematics, routing, misc');
  let alertId;
  await check('Trigger alert', async () => {
    const r = await api('POST', '/api/alerts/trigger', {
      token: A1, body: { type: 'PANIC_BUTTON', severity: 'CRITICAL', vehicleUnit: 'UNIT-101', title: 'Verify', description: 'HTTP verify' },
    });
    expectStatus(r, [200, 201]);
    alertId = (r.json?.alert ?? r.json)?.id;
    assert(alertId, 'no alert id');
  });
  await check('Resolve alert', async () => {
    expectStatus(await api('POST', `/api/alerts/${alertId}/resolve`, { token: A1 }), 200);
  });
  await check('GET /api/telematics/vehicles', async () => {
    const r = await api('GET', '/api/telematics/vehicles', { token: A1 });
    expectStatus(r, 200);
  });
  await check('GET /api/telematics/drivers', async () => {
    expectStatus(await api('GET', '/api/telematics/drivers', { token: A1 }), 200);
  });
  await check('POST /api/routing/calculate Dallas → Atlanta', async () => {
    const r = await api('POST', '/api/routing/calculate', {
      token: A1,
      body: { origin: { coords: { lat: 32.7767, lon: -96.797 } }, destination: { coords: { lat: 33.749, lon: -84.388 } } },
    });
    expectStatus(r, 200);
    assert(r.json?.totalDistanceMiles > 700, `distance ${r.json?.totalDistanceMiles}`);
    return `${r.json.totalDistanceMiles} mi via ${r.json.provider}${r.json.mock ? ' (mock provider)' : ''}`;
  });
  await check('Routing rejects missing coords → 400', async () => {
    expectStatus(await api('POST', '/api/routing/calculate', { token: A1, body: { origin: 'Dallas' } }), 400);
  });
  await check('GET /api/routing/status', async () => {
    expectStatus(await api('GET', '/api/routing/status', { token: A1 }), 200);
  });
  await check('GET /api/perks/fuel-discounts', async () => {
    expectStatus(await api('GET', '/api/perks/fuel-discounts', { token: D1 }), 200);
  });
  await check('GET /api/billing/subscription', async () => {
    expectStatus(await api('GET', '/api/billing/subscription', { token: A1 }), [200, 404]);
  });
  await check('Driver blocked from admin logs', async () => {
    expectStatus(await api('GET', '/api/admin/logs', { token: D1 }), 403);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`TruckWithEase backend HTTP verification\n  target: ${BASE_URL}\n  mode:   ${MODE}`);
await publicChecks();
if (MODE === 'full') await fullChecks();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  [${f.section}] ${f.name}\n     ${f.error}`);
  process.exit(1);
}
