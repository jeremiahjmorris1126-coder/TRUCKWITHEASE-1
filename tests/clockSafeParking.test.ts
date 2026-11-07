import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { fleetStore } from '../server/data/fleetStore';
import { findClockSafeParking, bindingClock, getDriverClock } from '../server/parking/clockSafeParking';
import { tpimsService } from '../server/parking/tpimsService';
import { routingManager } from '../server/routing/routingManager';
import { telematicsManager } from '../server/telematics/telematicsManager';

const DRIVER = { uid: 'cs-driver', email: 'cs@fleet1.test', role: 'driver' as const, fleetId: 'FLEET1' };
const HERE = { lat: 39.0, lon: -95.0 };

const ENV = ['TPIMS_FEEDS', 'TRIMBLE_API_KEY', 'TOMTOM_API_KEY', 'TELEMATICS_DEMO_DATA', 'TELEMATICS_FLEET_ID', 'SAMSARA_API_TOKEN', 'MOTIVE_API_KEY', 'NODE_ENV'];
const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};

// Demo ELD driver "Marcus Vance": drive 385, shift 540, break 145, cycle 2180 → binding = break, 145 min.
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  process.env.TELEMATICS_DEMO_DATA = 'true';
  tpimsService.clearCache();
  routingManager.clearCacheForTesting();
  telematicsManager.clearCache();
  fleetStore.seedMockData('driver_profiles', 'cs-driver', { id: 'cs-driver', driverId: 'cs-driver', fleetId: 'FLEET1', name: 'Marcus Vance' });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const now = new Date().toISOString();
// Point ~X miles north of HERE (1° lat ≈ 69 mi).
const north = (mi: number) => ({ latitude: HERE.lat + mi / 69, longitude: HERE.lon });

function stubFeedsAndRouting(driveMinutesBySite: Record<string, number>) {
  process.env.TPIMS_FEEDS = JSON.stringify([{ state: 'KS', dynamicUrl: 'https://ks.example/dyn', staticUrl: 'https://ks.example/static' }]);
  const sites: Record<string, { mi: number; avail: string; name: string }> = {
    near: { mi: 25, avail: '10', name: 'Near Rest Area' },
    mid: { mi: 100, avail: '30', name: 'Mid Truck Lot' },
    full: { mi: 30, avail: '0', name: 'Full Lot' },
    far: { mi: 400, avail: '50', name: 'Too Far Lot' },
  };
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const json = (b: any) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url === 'https://ks.example/dyn') {
      return json(Object.entries(sites).map(([id, s]) => ({ siteId: id, timeStamp: now, reportedAvailable: s.avail, open: true, trustData: true, trend: 'FILLING' })));
    }
    if (url === 'https://ks.example/static') {
      return json(Object.entries(sites).map(([id, s]) => ({ siteId: id, name: s.name, location: north(s.mi) })));
    }
    if (url.includes('pcmiler')) {
      const body = JSON.parse(String(init.body));
      const dest = body.ReportRoutes[0].Stops.at(-1).Label as string;
      const id = Object.entries(sites).find(([, s]) => s.name === dest)![0];
      const mins = driveMinutesBySite[id];
      return json([{ __type: 'MileageReport:http://pcmiler.alk.com/APIs/v1.0', ReportLines: [{ TMiles: '0', THours: '0:00' }, { TMiles: String(sites[id].mi * 1.2), THours: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}` }] }]);
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

describe('Clock-Safe Parking', () => {
  it('picks the tightest ELD clock', () => {
    expect(bindingClock({ drivingRemainingMins: 385, shiftRemainingMins: 540, breakWindowMins: 145, cycleRemainingMins: 2180 })).toEqual({ minutesLeft: 145, limitedBy: 'break' });
    expect(bindingClock({ drivingRemainingMins: null, shiftRemainingMins: null, breakWindowMins: null, cycleRemainingMins: null })).toBeNull();
  });

  it('reads the driver’s hours from their ELD record (matched by name), never computing them', async () => {
    const { clock } = await getDriverClock(DRIVER);
    expect(clock).toMatchObject({ minutesLeft: 145, limitedBy: 'break', provider: 'samsara', matchedBy: 'name' });
  });

  it('says why when the ELD is not linked instead of guessing hours', async () => {
    fleetStore.seedMockData('driver_profiles', 'cs-driver', { id: 'cs-driver', driverId: 'cs-driver', fleetId: 'FLEET1', name: 'Someone Else' });
    const { clock, reason } = await getDriverClock(DRIVER);
    expect(clock).toBeNull();
    expect(reason).toContain('not linked');
  });

  it('ranks open lots the driver can legally reach, using real truck drive times', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    stubFeedsAndRouting({ near: 40, mid: 140, full: 35, far: 420 });
    const r = await findClockSafeParking(DRIVER, HERE);

    expect(r.clock?.minutesLeft).toBe(145);
    const names = r.sites.map((s) => s.name);
    expect(names).not.toContain('Full Lot'); // 0 spaces
    expect(names).not.toContain('Too Far Lot'); // beyond what 145 min could ever cover

    const near = r.sites.find((s) => s.name === 'Near Rest Area')!;
    expect(near).toMatchObject({ reachable: true, driveMinutes: 40, minutesToSpare: 105, routedBy: 'trimble', available: 10 });
    const mid = r.sites.find((s) => s.name === 'Mid Truck Lot')!;
    // 140 min drive + 15 min safety buffer > 145 min left → not reachable, even though it has more spaces.
    expect(mid).toMatchObject({ reachable: false, driveMinutes: 140, minutesToSpare: 5 });
    expect(r.sites[0].name).toBe('Near Rest Area');
    expect(r.routingNote).toBeNull();
  });

  it('marks reachability as unverified (not guessed) when truck routing is unavailable', async () => {
    stubFeedsAndRouting({});
    const r = await findClockSafeParking(DRIVER, HERE);
    expect(r.sites.length).toBeGreaterThan(0);
    expect(r.sites.every((s) => s.reachable === null && s.driveMinutes === null)).toBe(true);
    expect(r.routingNote).toContain('not verified');
  });

  it('returns nothing (not made-up lots) when parking feeds are not configured', async () => {
    const r = await findClockSafeParking(DRIVER, HERE);
    expect(r.parkingConfigured).toBe(false);
    expect(r.sites).toEqual([]);
  });
});
