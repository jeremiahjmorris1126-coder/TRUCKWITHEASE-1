import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';

// Fresh test port
const PORT = 3188;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Helper for generating valid JWT tokens matching Firebase format
function createFirebaseToken(uid, role, fleetId) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    uid,
    user_id: uid,
    email: `${uid}@truckwithease.test`,
    role,
    fleetId,
    aud: 'project-f0634118-be01-44f7-b36',
    iss: 'https://securetoken.google.com/project-f0634118-be01-44f7-b36',
    sub: uid,
    auth_time: Math.floor(Date.now() / 1000) - 30,
    iat: Math.floor(Date.now() / 1000) - 30,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `Bearer ${header}.${payload}.`;
}

async function request(method, path, options = {}) {
  const url = new URL(path, BASE_URL);
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  const text = await res.text();
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } else {
    data = text;
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
    rawText: text,
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log(`LAUNCHING TEST SERVER: node dist/server.cjs ON PORT ${PORT} (SERVE_STATIC=true)`);
  console.log('='.repeat(80));

  // Start dedicated mock auth emulator on 9288 so Firebase Admin validates tokens
  const emulatorPort = 9288;
  const mockEmulator = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const localId = data.localId ? data.localId[0] : 'test-user';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        users: [{
          localId,
          email: `${localId}@truckwithease.test`,
          emailVerified: true,
          disabled: false,
        }]
      }));
    });
  });
  await new Promise(r => mockEmulator.listen(emulatorPort, r));

  const mainEnv = { ...process.env };
  delete mainEnv.TWILIO_AUTH_TOKEN;

  const serverProc = spawn('node', ['dist/server.cjs'], {
    env: {
      ...mainEnv,
      PORT: String(PORT),
      SERVE_STATIC: 'true',
      NODE_ENV: 'production',
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${emulatorPort}`,
      GCP_PROJECT_ID: 'project-f0634118-be01-44f7-b36',
      FIRESTORE_FORCE_MOCK: 'true',
      RATE_LIMIT_MAX_USER: '2000',
      RATE_LIMIT_MAX_IP: '4000',
      DISABLE_NOTIFICATION_BURST_LIMIT: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', d => {
    const msg = d.toString().trim();
    if (!msg.includes('OPTIONS') && !msg.includes('GET /health')) {
      // console.log(`[SERVER STDOUT] ${msg}`);
    }
  });
  serverProc.stderr.on('data', d => {
    console.error(`[SERVER STDERR] ${d.toString().trim()}`);
  });

  // Wait for server health
  let healthy = false;
  for (let i = 0; i < 40; i++) {
    try {
      const h = await request('GET', '/health');
      if (h.status === 200 && h.data.ok === true) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  if (!healthy) {
    console.error('Failed to start test server within 6 seconds.');
    serverProc.kill();
    mockEmulator.close();
    process.exit(1);
  }

  console.log(`Server healthy at ${BASE_URL}/health`);

  const results = [];
  function record(category, testName, expectedStatus, actualStatus, pass, details = '') {
    results.push({ category, testName, expectedStatus, actualStatus, pass, details });
    const mark = pass ? '[PASS]' : '[FAIL]';
    if (!pass || results.length % 10 === 0 || category.includes('Twilio') || category.includes('Tamper') || category.includes('Leak')) {
      console.log(`${mark} [${category}] ${testName} -> Expected: ${expectedStatus}, Got: ${actualStatus} ${details}`);
    }
  }

  try {
    // 1. Generate caller tokens for 4 distinct roles + cross-tenant actors
    const f1AdminToken = createFirebaseToken('usr-fleet1-admin', 'fleet_admin', 'FLEET1');
    const f1DriverToken = createFirebaseToken('usr-fleet1-driver', 'driver', 'FLEET1');
    const ownerToken = createFirebaseToken('usr-owner', 'owner', null);
    const f2AdminToken = createFirebaseToken('usr-fleet2-admin', 'fleet_admin', 'FLEET2');
    const f2DriverToken = createFirebaseToken('usr-fleet2-driver', 'driver', 'FLEET2');

    // Pre-warm user cache by resolving tenant endpoint
    await request('GET', '/api/auth/tenant', { headers: { Authorization: f1AdminToken } });
    await request('GET', '/api/auth/tenant', { headers: { Authorization: f1DriverToken } });
    await request('GET', '/api/auth/tenant', { headers: { Authorization: ownerToken } });
    await request('GET', '/api/auth/tenant', { headers: { Authorization: f2AdminToken } });
    await request('GET', '/api/auth/tenant', { headers: { Authorization: f2DriverToken } });

    // 2. Pre-seed FLEET1 baseline resources
    console.log('\n--- SECTION 0: PRE-SEEDING FLEET1 BASELINE RESOURCES ---');
    const seedLoadRes = await request('POST', '/api/loads', {
      headers: { Authorization: f1AdminToken },
      body: {
        origin: 'Atlanta, GA',
        destination: 'Nashville, TN',
        grossPayUsd: 1450,
        miles: 250,
        deadheadMiles: 12,
        estimatedTransitHours: 4.5,
        loadNumber: 'CONFIDENTIAL-FLEET1-LOAD-01',
      },
    });
    record('Baseline Seed', 'FLEET1 Admin creates baseline load', 201, seedLoadRes.status, seedLoadRes.status === 201);
    const fleet1LoadId = seedLoadRes.data?.load?.id;

    const seedAlertRes = await request('POST', '/api/alerts/trigger', {
      headers: { Authorization: f1AdminToken },
      body: {
        type: 'TEMP_HIGH',
        vehicleUnit: 'UNIT-101',
        driverName: 'Marcus Vance',
        title: 'Reefer Temp Alert',
        severity: 'HIGH',
      },
    });
    record('Baseline Seed', 'FLEET1 Admin creates baseline alert', 201, seedAlertRes.status, seedAlertRes.status === 201);
    const fleet1AlertId = seedAlertRes.data?.alert?.id;

    const seedDocRes = await request('POST', '/api/driver/documents', {
      headers: { Authorization: f1AdminToken },
      body: {
        docType: 'CDL_FRONT',
        documentUrl: 'https://vault.truckwithease.test/cdl-f1.pdf',
        driverId: 'usr-fleet1-driver',
        title: 'Commercial Driver License',
      },
    });
    record('Baseline Seed', 'FLEET1 Admin creates baseline document', 201, seedDocRes.status, seedDocRes.status === 201);
    const fleet1DocId = seedDocRes.data?.document?.id;

    const seedVehRes = await request('POST', '/v1/routing/vehicle-profile', {
      headers: { Authorization: f1AdminToken },
      body: {
        name: 'Semi-Truck-Fleet1',
        weightLbs: 65000,
        heightFt: 13.5,
        widthFt: 8.5,
        lengthFt: 53,
        axleCount: 5,
        hazmatClasses: [],
      },
    });
    record('Baseline Seed', 'FLEET1 Admin creates vehicle profile', 201, seedVehRes.status, [200, 201].includes(seedVehRes.status));

    const seedDriverProfileRes = await request('PUT', '/api/driver/profile', {
      headers: { Authorization: f1DriverToken },
      body: {
        name: 'Marcus Vance',
        phone: '+1-555-839-2041',
      },
    });
    record('Baseline Seed', 'FLEET1 Driver seeds driver profile', 200, seedDriverProfileRes.status, seedDriverProfileRes.status === 200);

    const seedAdminProfileRes = await request('PUT', '/api/driver/profile', {
      headers: { Authorization: f1AdminToken },
      body: {
        name: 'Fleet 1 Admin',
        phone: '+1-555-839-2000',
      },
    });
    record('Baseline Seed', 'FLEET1 Admin seeds admin profile', 200, seedAdminProfileRes.status, seedAdminProfileRes.status === 200);

    const seedOwnerProfileRes = await request('PUT', '/api/driver/profile', {
      headers: { Authorization: ownerToken },
      body: {
        name: 'System Owner',
        phone: '+1-555-839-9999',
      },
    });
    record('Baseline Seed', 'Owner seeds owner profile', 200, seedOwnerProfileRes.status, seedOwnerProfileRes.status === 200);

    const seedMsgRes = await request('POST', '/api/messages', {
      headers: { Authorization: f1AdminToken },
      body: {
        channel: 'DISPATCH',
        text: 'Initial Fleet 1 Dispatch Instruction',
        priority: 'HIGH',
      },
    });
    record('Baseline Seed', 'FLEET1 Admin creates in-cab message', 201, seedMsgRes.status, seedMsgRes.status === 201);
    const fleet1MsgId = seedMsgRes.data?.message?.id;

    // 3. Define the Full Express Route Inventory (Every route in server.ts)
    const ROUTE_MATRIX = [
      // Subsystem 1: Health & Diagnostics
      {
        name: 'GET /health (Public probe)',
        method: 'GET',
        path: '/health',
        expected: { unauthenticated: 200, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /health/diagnostic (Internal diagnostic leak check)',
        method: 'GET',
        path: '/health/diagnostic',
        expected: { unauthenticated: 403, driver: 403, fleet_admin: 403, owner: 403 },
      },
      {
        name: 'GET /api/health (Owner diagnostic under /api)',
        method: 'GET',
        path: '/api/health',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 403, owner: 200 },
      },
      {
        name: 'GET /api/ready (Readiness probe)',
        method: 'GET',
        path: '/api/ready',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 2: Routing Subsystem (/v1 and /api aliases)
      {
        name: 'GET /v1/routing/status',
        method: 'GET',
        path: '/v1/routing/status',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/routing/status',
        method: 'GET',
        path: '/api/routing/status',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /v1/routing/calculate',
        method: 'POST',
        path: '/v1/routing/calculate',
        body: {
          origin: { coords: { lat: 32.7767, lon: -96.7970 } },
          destination: { coords: { lat: 30.2672, lon: -97.7431 } },
        },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /v1/routing/mileage',
        method: 'POST',
        path: '/v1/routing/mileage',
        body: {
          origin: { coords: { lat: 32.7767, lon: -96.7970 } },
          destination: { coords: { lat: 30.2672, lon: -97.7431 } },
        },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /v1/routing/geocode',
        method: 'GET',
        path: '/v1/routing/geocode?q=Dallas',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /v1/routing/places/autocomplete',
        method: 'GET',
        path: '/v1/routing/places/autocomplete?input=Dallas',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /v1/routing/vehicle-profile',
        method: 'GET',
        path: '/v1/routing/vehicle-profile',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 401 }, // Owner has no fleetId
      },
      {
        name: 'POST /v1/routing/vehicle-profile',
        method: 'POST',
        path: '/v1/routing/vehicle-profile',
        body: {
          name: 'Semi-53ft',
          weightLbs: 65000,
          heightFt: 13.5,
          widthFt: 8.5,
          lengthFt: 53,
          axleCount: 5,
        },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 400 }, // Owner has no fleetId
      },
      {
        name: 'PUT /v1/routing/vehicle-profile',
        method: 'PUT',
        path: '/v1/routing/vehicle-profile',
        body: {
          name: 'Semi-53ft-Mod',
          weightLbs: 65000,
          heightFt: 13.5,
          widthFt: 8.5,
          lengthFt: 53,
          axleCount: 5,
        },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 400 },
      },

      // Subsystem 3: Telematics & Auxiliary Alerts
      {
        name: 'GET /api/telematics/vehicles',
        method: 'GET',
        path: '/api/telematics/vehicles',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/telematics/vehicles/:id',
        method: 'GET',
        path: '/api/telematics/vehicles/sam-trk-101',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/telematics/drivers (Driver restricted)',
        method: 'GET',
        path: '/api/telematics/drivers',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/telematics/idle-alert',
        method: 'POST',
        path: '/api/telematics/idle-alert',
        body: { vehicleUnit: 'UNIT-101', driverName: 'Marcus Vance', idleDurationMinutes: 15 },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'GET /api/alerts/active',
        method: 'GET',
        path: '/api/alerts/active',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/alerts/all',
        method: 'GET',
        path: '/api/alerts/all',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/alerts/trigger',
        method: 'POST',
        path: '/api/alerts/trigger',
        body: { type: 'DOOR_OPEN', vehicleUnit: 'UNIT-101', driverName: 'Marcus Vance' },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'POST /api/alerts/:id/resolve',
        method: 'POST',
        path: `/api/alerts/${fleet1AlertId}/resolve`,
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 4: Load Matching & Freight Dispatch
      {
        name: 'GET /api/loads',
        method: 'GET',
        path: '/api/loads',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/loads/:id',
        method: 'GET',
        path: `/api/loads/${fleet1LoadId}`,
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/loads (Drivers forbidden)',
        method: 'POST',
        path: '/api/loads',
        body: { origin: 'Dallas, TX', destination: 'Houston, TX', grossPayUsd: 1100, miles: 240 },
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'GET /api/loads/matched',
        method: 'GET',
        path: '/api/loads/matched',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/loads/:id/dispatch (Drivers forbidden)',
        method: 'POST',
        path: `/api/loads/${fleet1LoadId}/dispatch`,
        body: { driverId: 'usr-fleet1-driver', unitId: 'UNIT-101' },
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 5: Driver Profiles & Vault Documents
      {
        name: 'GET /api/driver/profile',
        method: 'GET',
        path: '/api/driver/profile',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'PUT /api/driver/profile',
        method: 'PUT',
        path: '/api/driver/profile',
        body: { name: 'Marcus Vance' },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/driver/documents',
        method: 'GET',
        path: '/api/driver/documents',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/driver/documents/:id',
        method: 'GET',
        path: `/api/driver/documents/${fleet1DocId}`,
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/driver/documents',
        method: 'POST',
        path: '/api/driver/documents',
        body: { docType: 'IFTA_RECEIPT', documentUrl: 'https://vault.test/ifta.pdf', title: 'IFTA Fuel Q3' },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },

      // Subsystem 6: Perks & Insurance
      {
        name: 'GET /api/perks/fuel-discounts',
        method: 'GET',
        path: '/api/perks/fuel-discounts',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/insurance/quotes',
        method: 'GET',
        path: '/api/insurance/quotes?dot=1234567',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /v1/offers/fuel',
        method: 'GET',
        path: '/v1/offers/fuel?lat=32.77&lng=-96.79',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /v1/insurance/quotes',
        method: 'POST',
        path: '/v1/insurance/quotes',
        body: { driverId: 'usr-fleet1-driver', consentGivenAt: '2026-10-29T00:00:00Z', coverageType: 'PRIMARY' },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 7: Telephony & Softphone
      {
        name: 'GET /api/telephony/status',
        method: 'GET',
        path: '/api/telephony/status',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/telephony/call-session',
        method: 'POST',
        path: '/api/telephony/call-session',
        body: { caller: '+18005550199', callee: '+18005550198' },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'POST /api/telephony/provision-line',
        method: 'POST',
        path: '/api/telephony/provision-line',
        body: { fleetName: 'Fleet 1' },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'GET /api/telephony/token',
        method: 'GET',
        path: '/api/telephony/token',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 8: Accounts & Roles
      {
        name: 'GET /api/auth/roles',
        method: 'GET',
        path: '/api/auth/roles',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/auth/users (Driver blocked 403)',
        method: 'GET',
        path: '/api/auth/users',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/auth/tenant',
        method: 'GET',
        path: '/api/auth/tenant',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/auth/login',
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'admin@fleet1.com' },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 9: Admin Tools & System Audit Logs
      {
        name: 'GET /api/admin/logs (Driver blocked 403)',
        method: 'GET',
        path: '/api/admin/logs',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/admin/integrations (Driver blocked 403)',
        method: 'GET',
        path: '/api/admin/integrations',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 10: Memory Diagnostics & Performance (restrictDriver)
      {
        name: 'POST /api/memory/track (Driver blocked 403)',
        method: 'POST',
        path: '/api/memory/track',
        body: { usedHeapMb: 50, totalHeapMb: 100 },
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/memory/stats (Driver blocked 403)',
        method: 'GET',
        path: '/api/memory/stats',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/memory/apply-optimization (Driver blocked 403)',
        method: 'POST',
        path: '/api/memory/apply-optimization',
        body: {},
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 11: Predictive Analytics & Annealing (restrictDriver)
      {
        name: 'POST /api/predictive/resolve-states (Driver blocked 403)',
        method: 'POST',
        path: '/api/predictive/resolve-states',
        body: { speedMph: 65 },
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/predictive/anneal (Driver blocked 403)',
        method: 'POST',
        path: '/api/predictive/anneal',
        body: {},
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 12: Quantum Computing Engine (restrictDriver)
      {
        name: 'POST /api/quantum/telemetry-physics (Driver blocked 403)',
        method: 'POST',
        path: '/api/quantum/telemetry-physics',
        body: { speedMph: 65, axleWeightLbs: 70000 },
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/quantum/hos-optimizer (Driver blocked 403)',
        method: 'POST',
        path: '/api/quantum/hos-optimizer',
        body: {},
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/quantum/all-functions (Driver blocked 403)',
        method: 'GET',
        path: '/api/quantum/all-functions',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 13: Regional Weather Hazards
      {
        name: 'GET /api/weather/regional-hazards',
        method: 'GET',
        path: '/api/weather/regional-hazards?lat=37.95&lon=-91.77',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/weather/regional-hazards',
        method: 'POST',
        path: '/api/weather/regional-hazards',
        body: { lat: 37.95, lon: -91.77 },
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },

      // Subsystem 14: In-Cab Messaging & Dispatch
      {
        name: 'GET /api/messages',
        method: 'GET',
        path: '/api/messages',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/messages/channels/:channelId',
        method: 'GET',
        path: '/api/messages/channels/DISPATCH',
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'GET /api/messages/:id',
        method: 'GET',
        path: `/api/messages/${fleet1MsgId}`,
        expected: { unauthenticated: 401, driver: 200, fleet_admin: 200, owner: 200 },
      },
      {
        name: 'POST /api/messages',
        method: 'POST',
        path: '/api/messages',
        body: { text: 'In-cab test message' },
        expected: { unauthenticated: 401, driver: 201, fleet_admin: 201, owner: 201 },
      },
      {
        name: 'POST /api/dispatch-messages (Twilio unconfigured fallback)',
        method: 'POST',
        path: '/api/dispatch-messages',
        body: { to: '+15551234567', text: 'Dispatch' },
        expected: { unauthenticated: 401, driver: 503, fleet_admin: 503, owner: 503 },
      },
      {
        name: 'POST /api/dispatch-loop/alert (Twilio unconfigured fallback)',
        method: 'POST',
        path: '/api/dispatch-loop/alert',
        body: { smsBody: 'Loop alert' },
        expected: { unauthenticated: 401, driver: 503, fleet_admin: 503, owner: 503 },
      },

      // Subsystem 15: Sovereign System Export
      {
        name: 'GET /api/export-cloudflare-github/status (Owner only)',
        method: 'GET',
        path: '/api/export-cloudflare-github/status',
        expected: { unauthenticated: 401, driver: 403, fleet_admin: 403, owner: 200 },
      },
    ];

    console.log(`\n--- SECTION 1: EXHAUSTIVE 4-ROLE ROUTE MATRIX (${ROUTE_MATRIX.length} ROUTES X 4 ROLES) ---`);
    for (const route of ROUTE_MATRIX) {
      // 1. Unauthenticated
      const unauthRes = await request(route.method, route.path, { body: route.body });
      record(
        'Route Matrix [Unauthenticated]',
        `${route.name} as Unauthenticated`,
        route.expected.unauthenticated,
        unauthRes.status,
        unauthRes.status === route.expected.unauthenticated,
        unauthRes.status !== route.expected.unauthenticated ? `Body: ${JSON.stringify(unauthRes.data)}` : ''
      );

      // 2. Driver
      const driverRes = await request(route.method, route.path, {
        headers: { Authorization: f1DriverToken },
        body: route.body,
      });
      record(
        'Route Matrix [Driver]',
        `${route.name} as Driver`,
        route.expected.driver,
        driverRes.status,
        driverRes.status === route.expected.driver,
        driverRes.status !== route.expected.driver ? `Body: ${JSON.stringify(driverRes.data)}` : ''
      );

      // 3. Fleet Admin
      const adminRes = await request(route.method, route.path, {
        headers: { Authorization: f1AdminToken },
        body: route.body,
      });
      record(
        'Route Matrix [Fleet Admin]',
        `${route.name} as Fleet Admin`,
        route.expected.fleet_admin,
        adminRes.status,
        adminRes.status === route.expected.fleet_admin,
        adminRes.status !== route.expected.fleet_admin ? `Body: ${JSON.stringify(adminRes.data)}` : ''
      );

      // 4. Owner
      const ownerRes = await request(route.method, route.path, {
        headers: { Authorization: ownerToken },
        body: route.body,
      });
      record(
        'Route Matrix [Owner]',
        `${route.name} as Owner`,
        route.expected.owner,
        ownerRes.status,
        ownerRes.status === route.expected.owner,
        ownerRes.status !== route.expected.owner ? `Body: ${JSON.stringify(ownerRes.data)}` : ''
      );
    }

    // SECTION 2: Unknown Routes & SPA Protection
    console.log('\n--- SECTION 2: UNKNOWN ROUTE 404 & SPA ROUTING TESTS ---');
    const u1 = await request('GET', '/api/nonexistent-endpoint');
    record('Unknown Routes', 'GET /api/nonexistent-endpoint (No Token)', 404, u1.status, u1.status === 404 && typeof u1.data === 'object' && u1.data.error);

    const u2 = await request('GET', '/v1/nonexistent-routing-path');
    record('Unknown Routes', 'GET /v1/nonexistent-routing-path (No Token)', 404, u2.status, u2.status === 404 && typeof u2.data === 'object');

    const u3 = await request('GET', '/api/nonexistent-with-token', { headers: { Authorization: f1AdminToken } });
    record('Unknown Routes', 'GET /api/nonexistent-with-token (With Token)', 404, u3.status, u3.status === 404 && typeof u3.data === 'object');

    const u4 = await request('GET', '/v1/routing/invalid-action', { headers: { Authorization: f1AdminToken } });
    record('Unknown Routes', 'GET /v1/routing/invalid-action (With Token)', 404, u4.status, u4.status === 404 && typeof u4.data === 'object');

    const u5 = await request('POST', '/api/nonexistent-mutation', { headers: { Authorization: f1AdminToken }, body: { foo: 'bar' } });
    record('Unknown Routes', 'POST /api/nonexistent-mutation (With Token)', 404, u5.status, u5.status === 404 && typeof u5.data === 'object');

    const spaRes1 = await request('GET', '/dashboard');
    record('SPA Routing', 'GET /dashboard (Non-API path)', 200, spaRes1.status, spaRes1.status === 200 && spaRes1.rawText.includes('<html'));

    const spaRes2 = await request('GET', '/loads');
    record('SPA Routing', 'GET /loads (Non-API path)', 200, spaRes2.status, spaRes2.status === 200 && spaRes2.rawText.includes('<html'));

    // SECTION 3: Token Verification & Fail-Closed Invariants
    console.log('\n--- SECTION 3: AUTHENTICATION INVARIANTS & S2S KEY BOUNDARIES ---');
    const a1 = await request('GET', '/api/loads');
    record('Auth', 'GET /api/loads without token returns 401 JSON', 401, a1.status, a1.status === 401 && typeof a1.data === 'object');

    const a2 = await request('GET', '/api/loads', { headers: { Authorization: 'Bearer test_token_benchowner_FLEET1_owner' } });
    record('Auth', 'GET /api/loads with legacy test_token_ is strictly rejected (403)', 403, a2.status, a2.status === 403);

    const a3 = await request('GET', '/api/loads', { headers: { Authorization: 'Bearer invalid.bogus.jwt' } });
    record('Auth', 'GET /api/loads with forged JWT is strictly rejected (403)', 403, a3.status, a3.status === 403);

    const a4 = await request('GET', '/api/telematics/vehicles', { headers: { 'x-api-key': 'invalid_raw_api_key' } });
    record('Auth', 'GET /api/telematics/vehicles with invalid x-api-key rejected (403)', 403, a4.status, a4.status === 403);

    const a5 = await request('GET', '/api/auth/users', { headers: { 'x-api-key': 'invalid_raw_api_key' } });
    record('Auth', 'x-api-key prohibited from user management /api/auth/users (403)', 403, a5.status, a5.status === 403);

    // SECTION 4: Cross-Tenant Data Leak Attacks (FLEET2 Probing FLEET1)
    console.log('\n--- SECTION 4: CROSS-TENANT DATA LEAK TESTS (FLEET2 -> FLEET1) ---');
    const f2LoadsList = await request('GET', '/api/loads', { headers: { Authorization: f2AdminToken } });
    const leakedLoadInList = f2LoadsList.data?.loads?.some(l => l.id === fleet1LoadId);
    record('Data Leak', 'FLEET2 lists loads: FLEET1 load must NOT appear', 200, f2LoadsList.status, !leakedLoadInList, leakedLoadInList ? 'LEAKED' : 'SAFE');

    const f2LoadById = await request('GET', `/api/loads/${fleet1LoadId}`, { headers: { Authorization: f2AdminToken } });
    record('Data Leak', `FLEET2 GET /api/loads/${fleet1LoadId} returns 404 (Not Found)`, 404, f2LoadById.status, f2LoadById.status === 404);

    const f2AlertsList = await request('GET', `/api/alerts/all`, { headers: { Authorization: f2AdminToken } });
    const leakedAlert = f2AlertsList.data?.alerts?.some(a => a.id === fleet1AlertId);
    record('Data Leak', 'FLEET2 lists alerts: FLEET1 alert must NOT appear', 200, f2AlertsList.status, !leakedAlert, leakedAlert ? 'LEAKED' : 'SAFE');

    const f2DocById = await request('GET', `/api/driver/documents/${fleet1DocId}`, { headers: { Authorization: f2AdminToken } });
    record('Data Leak', `FLEET2 GET /api/driver/documents/${fleet1DocId} returns 404 (Not Found)`, 404, f2DocById.status, f2DocById.status === 404);

    const f2DocByQuery = await request('GET', '/api/driver/documents?driverId=usr-fleet1-driver', { headers: { Authorization: f2AdminToken } });
    const leakedDoc = f2DocByQuery.data?.documents?.some(d => d.id === fleet1DocId);
    record('Data Leak', 'FLEET2 probes driver documents of FLEET1: returns empty/404', 200, f2DocByQuery.status, !leakedDoc, leakedDoc ? 'LEAKED' : 'SAFE');

    const f2DriverProfile = await request('GET', '/api/driver/profile/usr-fleet1-driver', { headers: { Authorization: f2AdminToken } });
    record('Data Leak', 'FLEET2 GET /api/driver/profile/usr-fleet1-driver returns 404', 404, f2DriverProfile.status, f2DriverProfile.status === 404);

    const f2MsgById = await request('GET', `/api/messages/${fleet1MsgId}`, { headers: { Authorization: f2AdminToken } });
    record('Data Leak', `FLEET2 GET /api/messages/${fleet1MsgId} returns 404`, 404, f2MsgById.status, f2MsgById.status === 404);

    const f2MsgList = await request('GET', '/api/messages', { headers: { Authorization: f2AdminToken } });
    const leakedMsg = f2MsgList.data?.messages?.some(m => m.id === fleet1MsgId);
    record('Data Leak', 'FLEET2 lists messages: FLEET1 message must NOT appear', 200, f2MsgList.status, !leakedMsg, leakedMsg ? 'LEAKED' : 'SAFE');

    // SECTION 5: Cross-Tenant Mutation & Tampering Attacks (FLEET2 -> FLEET1)
    console.log('\n--- SECTION 5: CROSS-TENANT MUTATION & TAMPERING ATTACKS ---');
    const f2Dispatch = await request('POST', `/api/loads/${fleet1LoadId}/dispatch`, {
      headers: { Authorization: f2AdminToken },
      body: { driverId: 'usr-fleet2-driver' },
    });
    record('Mutation Tampering', `FLEET2 attempts to dispatch FLEET1 load (Must return 404)`, 404, f2Dispatch.status, f2Dispatch.status === 404);

    const f2AlertResolve = await request('POST', `/api/alerts/${fleet1AlertId}/resolve`, {
      headers: { Authorization: f2AdminToken },
    });
    record('Mutation Tampering', `FLEET2 attempts to resolve FLEET1 alert (Must return 404)`, 404, f2AlertResolve.status, f2AlertResolve.status === 404);

    // Client-supplied fleetId tampering
    const f1TamperBody = await request('POST', '/api/loads', {
      headers: { Authorization: f1AdminToken },
      body: {
        origin: 'Dallas, TX',
        destination: 'Houston, TX',
        grossPayUsd: 900,
        miles: 240,
        fleetId: 'FLEET2', // Attempting to inject into FLEET2
      },
    });
    record('ID Tampering', 'Client attempts to set fleetId in body (Must reject 400)', 400, f1TamperBody.status, f1TamperBody.status === 400);

    const f1TamperQuery = await request('GET', '/api/driver/documents?fleetId=FLEET2', {
      headers: { Authorization: f1AdminToken },
    });
    record('ID Tampering', 'Client attempts cross-tenant query fleetId=FLEET2 (Must return 404)', 404, f1TamperQuery.status, f1TamperQuery.status === 404);

    // SECTION 6: Target Object Integrity Read-Back
    console.log('\n--- SECTION 6: TARGET OBJECT INTEGRITY READ-BACK ---');
    const f1ReadBack = await request('GET', `/api/loads/${fleet1LoadId}`, { headers: { Authorization: f1AdminToken } });
    const targetLoad = f1ReadBack.data?.load;
    const isIntact = targetLoad &&
      targetLoad.id === fleet1LoadId &&
      targetLoad.fleetId === 'FLEET1' &&
      targetLoad.grossPayUsd === 1450 &&
      targetLoad.miles === 250;
    record('Integrity Read-Back', `Target load ${fleet1LoadId} verified intact and unchanged`, 200, f1ReadBack.status, isIntact, isIntact ? 'SAFE' : 'MUTATED');

    // SECTION 7: Twilio Webhook Fail-Closed & Signature Matrix
    console.log('\n--- SECTION 7: TWILIO WEBHOOK SIGNATURE & FAIL-CLOSED MATRIX ---');
    const twilioNoTokenNoSig = await request('POST', '/voice', { body: 'line=dispatch' });
    record('Twilio Webhook', 'POST /voice with NO TWILIO_AUTH_TOKEN set returns 403', 403, twilioNoTokenNoSig.status, twilioNoTokenNoSig.status === 403);

    const twilioNoTokenTelephony = await request('POST', '/api/telephony/voice', { body: 'line=dispatch' });
    record('Twilio Webhook', 'POST /api/telephony/voice with NO TWILIO_AUTH_TOKEN set returns 403', 403, twilioNoTokenTelephony.status, twilioNoTokenTelephony.status === 403);

    // Test with dedicated Twilio server
    const twilioPort = 3192;
    const twilioServerProc = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(twilioPort),
        SERVE_STATIC: 'true',
        NODE_ENV: 'production',
        TWILIO_AUTH_TOKEN: 'test_twilio_secret_token_abc123',
        FIRESTORE_FORCE_MOCK: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      // wait for twilio server health
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${twilioPort}/health`);
          if (res.status === 200) break;
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }

      // With token set: No signature returns 403
      const resNoSig = await fetch(`http://127.0.0.1:${twilioPort}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'line=dispatch',
      });
      record('Twilio Webhook', 'POST /voice with token set but no signature returns 403', 403, resNoSig.status, resNoSig.status === 403);

      // With token set: Forged signature returns 403
      const resForged = await fetch(`http://127.0.0.1:${twilioPort}/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'forged_bogus_signature_xyz=',
        },
        body: 'line=dispatch',
      });
      record('Twilio Webhook', 'POST /voice with token set and forged signature returns 403', 403, resForged.status, resForged.status === 403);

      // With token set: Valid HMAC-SHA1 signature returns 200 XML
      const twilioSdk = await import('twilio');
      const validSig = twilioSdk.getExpectedTwilioSignature(
        'test_twilio_secret_token_abc123',
        `http://127.0.0.1:${twilioPort}/voice`,
        { line: 'dispatch' }
      );
      const resValid = await fetch(`http://127.0.0.1:${twilioPort}/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': validSig,
        },
        body: 'line=dispatch',
      });
      const validText = await resValid.text();
      record('Twilio Webhook', 'POST /voice with token set and valid signature returns 200 XML', 200, resValid.status, resValid.status === 200 && validText.includes('<Response>'));
    } finally {
      twilioServerProc.kill();
    }

  } finally {
    serverProc.kill();
    mockEmulator.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log('ROUTE MATRIX & MULTI-TENANT TEST SUMMARY:');
  console.log('='.repeat(80));
  const failed = results.filter(r => !r.pass);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.length - failed.length} | FAILED: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFAILED ROWS:');
    for (const f of failed) {
      console.log(`- FAIL: [${f.category}] ${f.testName} (Expected: ${f.expectedStatus}, Got: ${f.actualStatus}) ${f.details}`);
    }
  } else {
    console.log('EVERY SINGLE ROW PASSED (0 FAILURES). Zero policy mismatches, zero leaks, zero mutations.');
  }
  console.log('='.repeat(80));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
