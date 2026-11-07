import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { TpimsService, mergeSite, parseFeedConfig, haversineMi } from '../server/parking/tpimsService';
import { getBypassPrograms, PREPASS_DEFAULT_URL, DRIVEWYZE_DEFAULT_URL } from '../server/bypass/bypassPrograms';

const realFetch = globalThis.fetch;
const ENV = ['TPIMS_FEEDS', 'PREPASS_ENROLL_URL', 'DRIVEWYZE_ENROLL_URL'];
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function stub(routes: Record<string, { status?: number; body: any }>) {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const r = routes[url];
    if (!r) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const now = new Date().toISOString();
const old = new Date(Date.now() - 60 * 60_000).toISOString();

describe('TPIMS feed config', () => {
  it('accepts only https feeds and normalizes state codes', () => {
    const cfg = parseFeedConfig(JSON.stringify([
      { state: 'ks', dynamicUrl: 'https://a.example/dyn?key=1', staticUrl: 'https://a.example/static?key=1' },
      { state: 'IA', dynamicUrl: 'http://insecure.example/dyn' },
      { state: 'OH' },
    ]));
    expect(cfg).toEqual([{ state: 'KS', dynamicUrl: 'https://a.example/dyn?key=1', staticUrl: 'https://a.example/static?key=1' }]);
    expect(parseFeedConfig('not json')).toEqual([]);
    expect(parseFeedConfig(undefined)).toEqual([]);
  });
});

describe('TPIMS site merge', () => {
  const stat = {
    siteId: 'KS00070IS0012300EPA00', name: 'I-70 EB Rest Area MM 123',
    location: { latitude: 38.9, longitude: -97.6, relevantHighway: 'I-70', directionOfTravel: 'E', exitId: '123', city: 'Salina', state: 'KS' },
    amenities: ['Restrooms', 'Vending'],
  };

  it('parses string counts and merges static metadata', () => {
    const s = mergeSite('KS', { siteId: stat.siteId, timeStamp: now, reportedAvailable: '12', trend: 'FILLING', open: true, trustData: true, capacity: 30 }, stat);
    expect(s.available).toBe(12);
    expect(s.capacity).toBe(30);
    expect(s.name).toBe('I-70 EB Rest Area MM 123');
    expect(s.highway).toBe('I-70');
    expect(s.latitude).toBe(38.9);
    expect(s.amenities).toEqual(['Restrooms', 'Vending']);
    expect(s.stale).toBe(false);
  });

  it('reports "Low" without inventing a number', () => {
    const s = mergeSite('KS', { siteId: 'x', timeStamp: now, reportedAvailable: 'Low', open: true, trustData: true }, undefined);
    expect(s.available).toBeNull();
    expect(s.availabilityLow).toBe(true);
    expect(s.name).toBe('x');
  });

  it('withholds the count when the site flags its own data as untrustworthy', () => {
    const s = mergeSite('KS', { siteId: 'x', timeStamp: now, reportedAvailable: '20', trustData: false }, undefined);
    expect(s.available).toBeNull();
    expect(s.trustData).toBe(false);
  });

  it('marks old or missing timestamps as stale', () => {
    expect(mergeSite('KS', { siteId: 'x', timeStamp: old, reportedAvailable: '5' }, undefined).stale).toBe(true);
    expect(mergeSite('KS', { siteId: 'x', reportedAvailable: '5' }, undefined).stale).toBe(true);
  });

  it('computes distances correctly', () => {
    // Kansas City to St. Louis is roughly 238 miles great-circle.
    expect(Math.round(haversineMi(39.0997, -94.5786, 38.627, -90.1994))).toBeGreaterThan(230);
    expect(Math.round(haversineMi(39.0997, -94.5786, 38.627, -90.1994))).toBeLessThan(245);
  });
});

describe('TpimsService', () => {
  it('returns nothing when no feeds are configured', async () => {
    const svc = new TpimsService();
    expect(svc.isConfigured()).toBe(false);
    expect(await svc.getSites()).toEqual([]);
  });

  it('serves working states, reports failing ones, redacts keys, and sorts by distance', async () => {
    process.env.TPIMS_FEEDS = JSON.stringify([
      { state: 'KS', dynamicUrl: 'https://ks.example/dyn?key=SECRETKEY', staticUrl: 'https://ks.example/static?key=SECRETKEY' },
      { state: 'IA', dynamicUrl: 'https://ia.example/dyn?key=OTHERKEY' },
    ]);
    stub({
      'https://ks.example/dyn?key=SECRETKEY': {
        body: [
          { siteId: 'far', timeStamp: now, reportedAvailable: '3', open: true, trustData: true },
          { siteId: 'near', timeStamp: now, reportedAvailable: '25', open: true, trustData: true },
        ],
      },
      'https://ks.example/static?key=SECRETKEY': {
        body: [
          { siteId: 'far', name: 'Far Site', location: { latitude: 37.0, longitude: -100.0 } },
          { siteId: 'near', name: 'Near Site', location: { latitude: 39.0, longitude: -95.0 } },
        ],
      },
      'https://ia.example/dyn?key=OTHERKEY': { status: 403, body: { message: 'bad key OTHERKEY' } },
    });
    const svc = new TpimsService();
    const sites = await svc.getSites({ lat: 39.1, lon: -94.6 });
    expect(sites.map((s) => s.name)).toEqual(['Near Site', 'Far Site']);
    expect(sites[0].distanceMi).toBeLessThan(30);

    const status = svc.getFeedStatus();
    const ks = status.find((f) => f.state === 'KS')!;
    const ia = status.find((f) => f.state === 'IA')!;
    expect(ks.ok).toBe(true);
    expect(ks.siteCount).toBe(2);
    expect(ia.ok).toBe(false);
    expect(ia.error).toContain('403');
    expect(JSON.stringify(status)).not.toContain('OTHERKEY');
    expect(JSON.stringify(status)).not.toContain('SECRETKEY');
  });
});

describe('Weigh station bypass programs', () => {
  it('defaults to official PrePass and Drivewyze enrollment pages', () => {
    const [prepass, drivewyze] = getBypassPrograms();
    expect(prepass.id).toBe('PREPASS');
    expect(prepass.enrollUrl).toBe(PREPASS_DEFAULT_URL);
    expect(drivewyze.id).toBe('DRIVEWYZE');
    expect(drivewyze.enrollUrl).toBe(DRIVEWYZE_DEFAULT_URL);
  });

  it('uses https partner links when configured and ignores unsafe ones', () => {
    process.env.PREPASS_ENROLL_URL = 'https://prepass.com/partner/truckwithease';
    process.env.DRIVEWYZE_ENROLL_URL = 'javascript:alert(1)';
    const [prepass, drivewyze] = getBypassPrograms();
    expect(prepass.enrollUrl).toBe('https://prepass.com/partner/truckwithease');
    expect(prepass.partnerLink).toBe(true);
    expect(drivewyze.enrollUrl).toBe(DRIVEWYZE_DEFAULT_URL);
  });
});
