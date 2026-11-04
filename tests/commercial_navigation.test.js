process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  calculateTomTomTruckRoute,
  calculateTrimblePcMilerRoute,
  getCommercialRoutingProvidersStatus,
  isTomTomConfigured,
  isTrimbleConfigured,
} from '../server/commercialRoutingService.ts';
import { createApiApp } from '../server.ts';
import { createFleetCore } from '../server/fleetCore.ts';

function setupTestServer() {
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
        close: () => new Promise((res) => server.close(res)),
      });
    });
    server.on('error', reject);
  });
}

test('Commercial Navigation Engine: TomTom Truck & Trimble MAPS (PC*MILER)', async (t) => {
  // --------------------------------------------------------------------------
  // 1. TomTom Truck Routing Tests
  // --------------------------------------------------------------------------
  await t.test('TomTom Truck: Calculates route and applies dynamic bypass diverter for 13\' 6" CMV', async () => {
    const route = await calculateTomTomTruckRoute({
      origin: { lat: 32.7767, lng: -96.7970, address: 'Dallas DFW Freight Terminal' },
      destination: { lat: 33.7490, lng: -84.3880, address: 'Atlanta Logistics Dock D-04' },
      vehicleProfile: {
        heightFt: 13.5,
        widthInches: 102,
        lengthFt: 53.0,
        grossWeightLbs: 80000,
        axles: 5,
        isCommercial: true,
      },
      avoidTolls: false,
    });

    assert.equal(route.provider, 'TOMTOM_TRUCK');
    assert.equal(route.success, true);
    assert.ok(route.totalDistanceMiles > 700);
    assert.ok(route.travelTimeMinutes > 0);
    assert.equal(route.clearanceVerified, true);
    assert.equal(route.diverterExecuted, true);
    assert.ok(route.minimumClearanceEncounteredFt >= 15.0);
    assert.equal(route.webfleetTelematicsStatus, 'CONNECTED');
    assert.ok(route.legs.length >= 3);

    // Verify diverter leg exists
    const diverterLeg = route.legs.find((leg) => leg.roadName.includes('Loop 820'));
    assert.ok(diverterLeg, 'Expected Loop 820 diverter leg in route');
    assert.ok(diverterLeg.clearanceNote?.includes("15' 8\""));
  });

  await t.test('TomTom Truck: Handles standard low truck profile without mandatory diverter', async () => {
    const route = await calculateTomTomTruckRoute({
      origin: { lat: 32.7767, lng: -96.7970 },
      destination: { lat: 33.7490, lng: -84.3880 },
      vehicleProfile: {
        heightFt: 12.0, // Low profile flatbed / straight truck
        widthInches: 96,
        lengthFt: 35.0,
        grossWeightLbs: 33000,
        axles: 2,
        isCommercial: true,
      },
    });

    assert.equal(route.provider, 'TOMTOM_TRUCK');
    assert.equal(route.success, true);
    assert.equal(route.diverterExecuted, false);
    assert.equal(route.lowBridgeHazardsAvoided, 0);
  });

  // --------------------------------------------------------------------------
  // 2. Trimble MAPS / PC*MILER Commercial Routing Tests
  // --------------------------------------------------------------------------
  await t.test('Trimble PC*MILER: Computes Practical miles and statutory IFTA state jurisdiction splits', async () => {
    const route = await calculateTrimblePcMilerRoute({
      origin: { lat: 32.7767, lng: -96.7970, address: 'DFW Logistics Staging' },
      destination: { lat: 33.7490, lng: -84.3880, address: 'Atlanta Terminal Hub' },
      routingType: 'PRACTICAL',
      computeIftaJurisdictionSplits: true,
    });

    assert.equal(route.provider, 'TRIMBLE_PCMILER');
    assert.equal(route.success, true);
    assert.equal(route.routingType, 'PRACTICAL');
    assert.ok(route.totalMiles > 750);
    assert.ok(route.tollMiles >= 0);
    assert.ok(route.nonTollMiles > 0);
    assert.equal(parseFloat((route.tollMiles + route.nonTollMiles).toFixed(1)), route.totalMiles);

    // Verify IFTA State splits
    assert.ok(route.stateMileageSplits.length >= 4);
    const stateCodes = route.stateMileageSplits.map((s) => s.state);
    assert.ok(stateCodes.includes('TX'));
    assert.ok(stateCodes.includes('LA'));
    assert.ok(stateCodes.includes('MS'));
    assert.ok(stateCodes.includes('GA'));

    // Sum of state splits should equal total route miles
    const sumStateMiles = route.stateMileageSplits.reduce((acc, curr) => acc + curr.totalMiles, 0);
    assert.equal(parseFloat(sumStateMiles.toFixed(1)), route.totalMiles);

    // Verify weigh stations
    assert.ok(route.weighStations.length >= 2);
    const txdotScale = route.weighStations.find((ws) => ws.state === 'TX');
    assert.ok(txdotScale);
    assert.equal(txdotScale.bypassEligible, true);

    // Verify HazMat and telematics
    assert.ok(route.hazmatComplianceAttestation.includes('49 CFR PART 397'));
    assert.equal(route.trimbleInstinctStatus, 'SYNCED');
  });

  await t.test('Trimble PC*MILER: Respects Shortest route calculation', async () => {
    const practicalRoute = await calculateTrimblePcMilerRoute({
      origin: { lat: 32.7767, lng: -96.7970 },
      destination: { lat: 33.7490, lng: -84.3880 },
      routingType: 'PRACTICAL',
    });

    const shortestRoute = await calculateTrimblePcMilerRoute({
      origin: { lat: 32.7767, lng: -96.7970 },
      destination: { lat: 33.7490, lng: -84.3880 },
      routingType: 'SHORTEST',
    });

    assert.ok(shortestRoute.totalMiles <= practicalRoute.totalMiles, 'Shortest miles should be <= practical miles');
  });

  // --------------------------------------------------------------------------
  // 3. Providers Catalog & Status Verification
  // --------------------------------------------------------------------------
  await t.test('Providers Status: Reports TomTom, Trimble PC*MILER, and FHWA Radar as operational', () => {
    const status = getCommercialRoutingProvidersStatus();

    assert.ok(status.tomtom);
    assert.equal(status.tomtom.status, 'OPERATIONAL');
    assert.ok(status.tomtom.features.length >= 4);

    assert.ok(status.trimble);
    assert.equal(status.trimble.status, 'OPERATIONAL');
    assert.ok(status.trimble.features.length >= 4);

    assert.ok(status.fhwaRadar54b);
    assert.equal(status.fhwaRadar54b.status, 'OPERATIONAL');
  });

  // --------------------------------------------------------------------------
  // 4. Server API Endpoint Integration Tests
  // --------------------------------------------------------------------------
  const env = await setupTestServer();
  t.after(async () => {
    await env.close();
  });

  await t.test('GET /api/navigation/providers -> Returns all commercial providers', async () => {
    const res = await fetch(`${env.baseUrl}/api/navigation/providers`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.tomtom.status, 'OPERATIONAL');
    assert.equal(body.trimble.status, 'OPERATIONAL');
    assert.equal(body.fhwaRadar54b.status, 'OPERATIONAL');
  });

  await t.test('POST /api/navigation/tomtom/route -> Returns TomTom commercial truck route', async () => {
    const res = await fetch(`${env.baseUrl}/api/navigation/tomtom/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: 32.7767, lng: -96.7970 },
        destination: { lat: 33.7490, lng: -84.3880 },
        vehicleProfile: { heightFt: 13.5 },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.provider, 'TOMTOM_TRUCK');
    assert.equal(body.success, true);
    assert.equal(body.clearanceVerified, true);
  });

  await t.test('GET /api/navigation/tomtom/status -> Returns TomTom status', async () => {
    const res = await fetch(`${env.baseUrl}/api/navigation/tomtom/status`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.tomtom.status, 'OPERATIONAL');
  });

  await t.test('POST /api/navigation/trimble/pcmiler-route -> Returns Trimble PC*MILER route with IFTA splits', async () => {
    const res = await fetch(`${env.baseUrl}/api/navigation/trimble/pcmiler-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: 32.7767, lng: -96.7970 },
        destination: { lat: 33.7490, lng: -84.3880 },
        routingType: 'PRACTICAL',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.provider, 'TRIMBLE_PCMILER');
    assert.equal(body.success, true);
    assert.ok(body.stateMileageSplits.length >= 4);
  });

  await t.test('GET /api/navigation/trimble/status -> Returns Trimble status', async () => {
    const res = await fetch(`${env.baseUrl}/api/navigation/trimble/status`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.trimble.status, 'OPERATIONAL');
  });

  await t.test('GET /api/health -> Includes TomTom and Trimble in integrations and subsystems', async () => {
    const res = await fetch(`${env.baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.integrations.tomtomTruckRouting);
    assert.ok(body.integrations.trimbleMapsPcMiler);
    assert.equal(body.subsystems.tomtomTruckNavigation.status, 'OPERATIONAL');
    assert.equal(body.subsystems.trimbleMapsPcMiler.status, 'OPERATIONAL');
  });
});
