/**
 * ELD / telematics integration tests.
 *
 * The provider HTTP APIs are stubbed with responses shaped like each vendor's
 * documented payloads, so these tests verify request construction (auth headers,
 * required query params, pagination), unit conversions, HOS clock mapping,
 * error reporting, and that no fabricated values are ever returned.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { TelematicsManager } from '../server/telematics/telematicsManager';
import { SamsaraAdapter } from '../server/telematics/samsaraAdapter';
import { MotiveAdapter } from '../server/telematics/motiveAdapter';
import { GeotabAdapter, timeSpanToMins } from '../server/telematics/geotabAdapter';

type Handler = (url: URL, init: RequestInit) => { status?: number; body: any };

const realFetch = globalThis.fetch;
let calls: { url: URL; init: RequestInit }[] = [];

function stubFetch(handler: Handler) {
  calls = [];
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init });
    const { status = 200, body } = handler(url, init);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

const ENV_KEYS = [
  'SAMSARA_API_TOKEN', 'SAMSARA_API_BASE', 'MOTIVE_API_KEY', 'MOTIVE_API_BASE',
  'GEOTAB_DATABASE', 'GEOTAB_USERNAME', 'GEOTAB_PASSWORD', 'GEOTAB_SESSION_ID', 'GEOTAB_SERVER', 'GEOTAB_API_USER',
  'TELEMATICS_FLEET_ID', 'TELEMATICS_DEMO_DATA', 'NODE_ENV',
];
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

// ─── Samsara ────────────────────────────────────────────────────────────────

function samsaraHandler(url: URL): { status?: number; body: any } {
  if (url.pathname === '/fleet/vehicles/stats') {
    const types = url.searchParams.get('types') || '';
    const after = url.searchParams.get('after');
    const base = (id: string, name: string) => ({ id, name, externalIds: { 'samsara.vin': `VIN-${id}` } });
    const stat = (id: string): any => {
      const r: any = base(id, id === '1001' ? 'Truck 7' : 'Truck 9');
      if (types.includes('gps')) r.gps = id === '1001'
        ? { time: '2026-11-07T01:00:00Z', latitude: 35.1, longitude: -90.0, headingDegrees: 90, speedMilesPerHour: 61.24, reverseGeo: { formattedLocation: 'I-40, Memphis, TN' } }
        : undefined;
      if (types.includes('engineStates')) r.engineStates = { value: id === '1001' ? 'On' : 'Off' };
      if (types.includes('engineRpm') && id === '1001') r.engineRpm = { value: 1400 };
      if (types.includes('fuelPercents') && id === '1001') r.fuelPercents = { value: 57 };
      if (types.includes('defLevelMilliPercent') && id === '1001') r.defLevelMilliPercent = { value: 81500 };
      if (types.includes('obdOdometerMeters') && id === '1001') r.obdOdometerMeters = { value: 160934400 };
      if (types.includes('obdEngineSeconds') && id === '1001') r.obdEngineSeconds = { value: 3600 * 2500 };
      if (types.includes('engineCoolantTemperatureMilliC') && id === '1001') r.engineCoolantTemperatureMilliC = { value: 90000 };
      if (types.includes('engineOilPressureKPa') && id === '1001') r.engineOilPressureKPa = { value: 300 };
      if (types.includes('faultCodes') && id === '1001') r.faultCodes = {
        obdii: { checkEngineLightIsOn: false, diagnosticTroubleCodes: [] },
        heavyDuty: { checkEngineLights: { warningIsOn: true, stopIsOn: false }, diagnosticTroubleCodes: [{ spnId: 3251, fmiId: 0, spnDescription: 'DPF pressure' }] },
      };
      return r;
    };
    // Two pages: first page has 1001, second has 1002.
    if (!after) return { body: { data: [stat('1001')], pagination: { endCursor: 'c1', hasNextPage: true } } };
    return { body: { data: [stat('1002')], pagination: { endCursor: '', hasNextPage: false } } };
  }
  if (url.pathname === '/fleet/hos/clocks') {
    return {
      body: {
        data: [{
          driver: { id: 'd-55', name: 'Real Driver' },
          currentDutyStatus: { hosStatusType: 'driving' },
          currentVehicle: { id: '1001', name: 'Truck 7' },
          clocks: {
            break: { timeUntilBreakDurationMs: 7_200_000 },
            drive: { driveRemainingDurationMs: 25_200_000 },
            shift: { shiftRemainingDurationMs: 36_000_000 },
            cycle: { cycleRemainingDurationMs: 180_000_000 },
          },
        }],
        pagination: { endCursor: '', hasNextPage: false },
      },
    };
  }
  return { status: 404, body: { message: 'not found' } };
}

describe('Samsara adapter', () => {
  it('requests stats with required types param + bearer auth, follows pagination, maps units', async () => {
    process.env.SAMSARA_API_TOKEN = 'samsara_test_token_123';
    stubFetch(samsaraHandler);
    const vehicles = await new SamsaraAdapter().getFleetVehicles();

    const statCalls = calls.filter((c) => c.url.pathname === '/fleet/vehicles/stats');
    expect(statCalls.every((c) => (c.url.searchParams.get('types') || '').length > 0)).toBe(true);
    expect(statCalls.every((c) => (c.init.headers as any).Authorization === 'Bearer samsara_test_token_123')).toBe(true);
    expect(statCalls.some((c) => c.url.searchParams.get('after') === 'c1')).toBe(true);

    expect(vehicles.length).toBe(2);
    const t7 = vehicles.find((v) => v.id === '1001')!;
    expect(t7.unitNumber).toBe('Truck 7');
    expect(t7.vin).toBe('VIN-1001');
    expect(t7.status).toBe('DRIVING');
    expect(t7.speedMph).toBe(61.2);
    expect(t7.fuelPercent).toBe(57);
    expect(t7.defLevelPercent).toBe(81.5);
    expect(t7.odometerMiles).toBe(100000);
    expect(t7.engineHours).toBe(2500);
    expect(t7.diagnostics.coolantTempF).toBe(194);
    expect(t7.diagnostics.oilPressurePsi).toBe(43.5);
    expect(t7.diagnostics.checkEngineLight).toBe(true);
    expect(t7.diagnostics.dtcCodes).toEqual(['SPN 3251 FMI 0 (DPF pressure)']);
    expect(t7.location?.address).toBe('I-40, Memphis, TN');

    // Truck 9 reported almost nothing: everything unreported must be null, not invented.
    const t9 = vehicles.find((v) => v.id === '1002')!;
    expect(t9.status).toBe('PARKED');
    expect(t9.location).toBeNull();
    expect(t9.speedMph).toBeNull();
    expect(t9.fuelPercent).toBeNull();
    expect(t9.odometerMiles).toBeNull();
    expect(t9.diagnostics.oilPressurePsi).toBeNull();
    expect(t9.diagnostics.coolantTempF).toBeNull();
  });

  it('maps HOS clocks from /fleet/hos/clocks (ms → minutes)', async () => {
    process.env.SAMSARA_API_TOKEN = 'samsara_test_token_123';
    stubFetch(samsaraHandler);
    const [d] = await new SamsaraAdapter().getDrivers();
    expect(d.id).toBe('d-55');
    expect(d.name).toBe('Real Driver');
    expect(d.dutyStatus).toBe('DRIVING');
    expect(d.currentVehicleId).toBe('1001');
    expect(d.hosClocks).toEqual({ drivingRemainingMins: 420, shiftRemainingMins: 600, cycleRemainingMins: 3000, breakWindowMins: 120 });
    expect(d.demo).toBeUndefined();
  });
});

// ─── Motive ─────────────────────────────────────────────────────────────────

describe('Motive adapter', () => {
  it('uses X-Api-Key, paginates vehicle_locations, maps location and HOS seconds', async () => {
    process.env.MOTIVE_API_KEY = 'motive_test_key';
    stubFetch((url) => {
      if (url.pathname === '/v1/vehicle_locations') {
        return {
          body: {
            vehicles: [{
              vehicle: {
                id: 77, number: 'T-77', year: '2023', make: 'Kenworth', model: 'T680', vin: 'VIN77',
                current_location: { lat: 32.7, lon: -96.8, bearing: 270, located_at: '2026-11-07T01:00:00Z', description: 'Dallas, TX', kph: 100 },
              },
            }],
            pagination: { per_page: 100, page_no: 1, total: 1 },
          },
        };
      }
      if (url.pathname === '/v1/available_time') {
        return {
          body: {
            users: [{ user: { id: 9, first_name: 'Ann', last_name: 'Lee', duty_status: 'on_duty', available_time: { drive: 39600, shift: 50400, cycle: 252000, break: 28800 } } }],
            pagination: { per_page: 100, page_no: 1, total: 1 },
          },
        };
      }
      return { status: 404, body: {} };
    });

    const adapter = new MotiveAdapter();
    const [v] = await adapter.getFleetVehicles();
    expect((calls[0].init.headers as any)['X-Api-Key']).toBe('motive_test_key');
    expect(calls[0].url.host).toBe('api.gomotive.com');
    expect(v.unitNumber).toBe('T-77');
    expect(v.makeModel).toBe('2023 Kenworth T680');
    expect(v.speedMph).toBe(62.1);
    expect(v.status).toBe('DRIVING');
    expect(v.location?.address).toBe('Dallas, TX');
    expect(v.fuelPercent).toBeNull();
    expect(v.engineRpm).toBeNull();

    const [d] = await adapter.getDrivers();
    expect(d.name).toBe('Ann Lee');
    expect(d.dutyStatus).toBe('ON_DUTY');
    expect(d.hosClocks).toEqual({ drivingRemainingMins: 660, shiftRemainingMins: 840, cycleRemainingMins: 4200, breakWindowMins: 480 });
  });
});

// ─── Geotab ─────────────────────────────────────────────────────────────────

describe('Geotab adapter', () => {
  it('authenticates, follows server redirect, merges Device + DeviceStatusInfo, maps DutyStatusAvailability', async () => {
    process.env.GEOTAB_DATABASE = 'acme';
    process.env.GEOTAB_USERNAME = 'api@acme.com';
    process.env.GEOTAB_PASSWORD = 'pw';
    stubFetch((url, init) => {
      const { method, params } = JSON.parse(String(init.body));
      if (method === 'Authenticate') {
        expect(url.host).toBe('my.geotab.com');
        return { body: { result: { credentials: { database: 'acme', userName: 'api@acme.com', sessionId: 'S1' }, path: 'my42.geotab.com' } } };
      }
      expect(url.host).toBe('my42.geotab.com');
      expect(params.credentials.sessionId).toBe('S1');
      if (method === 'Get' && params.typeName === 'Device') return { body: { result: [{ id: 'b1', name: 'Rig 1', vehicleIdentificationNumber: 'VINB1' }] } };
      if (method === 'Get' && params.typeName === 'DeviceStatusInfo') return { body: { result: [{ device: { id: 'b1' }, latitude: 41.8, longitude: -87.6, speed: 0, bearing: 10, isDriving: false, dateTime: '2026-11-07T01:00:00Z' }] } };
      if (method === 'Get' && params.typeName === 'User') return { body: { result: [{ id: 'u1', firstName: 'Bo', lastName: 'Ray', licenseNumber: 'L1' }] } };
      if (method === 'ExecuteMultiCall') return { body: { result: [[{ driving: '07:30:00', duty: '10:15:00', cycle: '2.06:00:00', drivingBreakDuration: '03:00:00' }]] } };
      return { body: { error: { message: 'unexpected' } } };
    });

    const adapter = new GeotabAdapter();
    const [v] = await adapter.getFleetVehicles();
    expect(v.unitNumber).toBe('Rig 1');
    expect(v.vin).toBe('VINB1');
    expect(v.status).toBe('PARKED');
    expect(v.location?.latitude).toBe(41.8);

    const [d] = await adapter.getDrivers();
    expect(d.name).toBe('Bo Ray');
    expect(d.hosClocks).toEqual({ drivingRemainingMins: 450, shiftRemainingMins: 615, cycleRemainingMins: 3240, breakWindowMins: 180 });
  });

  it('re-authenticates once when the session expires', async () => {
    process.env.GEOTAB_DATABASE = 'acme';
    process.env.GEOTAB_USERNAME = 'api@acme.com';
    process.env.GEOTAB_PASSWORD = 'pw';
    let auths = 0;
    let deviceCalls = 0;
    stubFetch((_url, init) => {
      const { method, params } = JSON.parse(String(init.body));
      if (method === 'Authenticate') {
        auths++;
        return { body: { result: { credentials: { database: 'acme', userName: 'u', sessionId: `S${auths}` }, path: 'ThisServer' } } };
      }
      if (params.typeName === 'Device') {
        deviceCalls++;
        if (params.credentials.sessionId === 'S1') return { body: { error: { message: 'expired', errors: [{ name: 'InvalidUserException' }] } } };
        return { body: { result: [] } };
      }
      return { body: { result: [] } };
    });
    await new GeotabAdapter().getFleetVehicles();
    expect(auths).toBe(2);
    expect(deviceCalls).toBe(2);
  });

  it('parses .NET TimeSpan strings', () => {
    expect(timeSpanToMins('11:00:00')).toBe(660);
    expect(timeSpanToMins('1.02:30:00')).toBe(1590);
    expect(timeSpanToMins('00:29:59.9990000')).toBe(29);
    expect(timeSpanToMins('-00:15:00')).toBe(0);
    expect(timeSpanToMins('garbage')).toBeNull();
    expect(timeSpanToMins(undefined)).toBeNull();
  });
});

// ─── Manager: errors, scoping, demo gating ──────────────────────────────────

describe('TelematicsManager', () => {
  const FLEET1_ADMIN = { uid: 'a1', role: 'fleet_admin' as const, fleetId: 'FLEET1' };
  const FLEET2_ADMIN = { uid: 'a2', role: 'fleet_admin' as const, fleetId: 'FLEET2' };

  it('reports CONFIGURED before first call, ERROR with masked reason on provider failure, and returns no fabricated data', async () => {
    process.env.SAMSARA_API_TOKEN = 'samsara_secret_token_abcdef123456';
    process.env.TELEMATICS_FLEET_ID = 'FLEET1';
    stubFetch(() => ({ status: 401, body: { message: 'invalid token samsara_secret_token_abcdef123456' } }));
    const mgr = new TelematicsManager([new SamsaraAdapter()]);
    expect(mgr.getAdapterStatus().samsara.mode).toBe('CONFIGURED');

    const vehicles = await mgr.getAllVehicles(FLEET1_ADMIN);
    expect(vehicles).toEqual([]);
    const s = mgr.getAdapterStatus().samsara;
    expect(s.mode).toBe('ERROR');
    expect(s.lastError).toContain('HTTP 401');
    expect(s.lastError).toContain('credential rejected');
    expect(s.lastError).not.toContain('samsara_secret_token_abcdef123456');
  });

  it('reports LIVE with counts after a successful call', async () => {
    process.env.SAMSARA_API_TOKEN = 't';
    process.env.TELEMATICS_FLEET_ID = 'FLEET1';
    stubFetch(samsaraHandler);
    const mgr = new TelematicsManager([new SamsaraAdapter()]);
    await mgr.getAllVehicles(FLEET1_ADMIN);
    await mgr.getAllDrivers(FLEET1_ADMIN);
    const s = mgr.getAdapterStatus().samsara;
    expect(s.mode).toBe('LIVE');
    expect(s.lastVehicleCount).toBe(2);
    expect(s.lastDriverCount).toBe(1);
  });

  it('only serves ELD data to the owning fleet (TELEMATICS_FLEET_ID)', async () => {
    process.env.SAMSARA_API_TOKEN = 't';
    process.env.TELEMATICS_FLEET_ID = 'FLEET1';
    stubFetch(samsaraHandler);
    const mgr = new TelematicsManager([new SamsaraAdapter()]);
    expect((await mgr.getAllVehicles(FLEET1_ADMIN)).length).toBe(2);
    expect(await mgr.getAllVehicles(FLEET2_ADMIN)).toEqual([]);
    expect(await mgr.getAllDrivers(FLEET2_ADMIN)).toEqual([]);
    expect(await mgr.getVehicle('1001', FLEET2_ADMIN)).toBeNull();
  });

  it('serves nothing to fleet callers when TELEMATICS_FLEET_ID is unset', async () => {
    process.env.SAMSARA_API_TOKEN = 't';
    stubFetch(samsaraHandler);
    const mgr = new TelematicsManager([new SamsaraAdapter()]);
    expect(await mgr.getAllVehicles(FLEET1_ADMIN)).toEqual([]);
    expect(calls.length).toBe(0);
  });

  it('never serves demo fixtures in production even if TELEMATICS_DEMO_DATA=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TELEMATICS_DEMO_DATA = 'true';
    const mgr = new TelematicsManager();
    expect(await mgr.getAllVehicles()).toEqual([]);
    expect(await mgr.getAllDrivers()).toEqual([]);
    expect(mgr.getAdapterStatus().samsara.mode).toBe('NOT_CONFIGURED');
  });
});
