import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { TrimbleRoutingProvider, parsePcmilerReports, feetInches, hoursToMinutes, isHazmatLoad } from '../server/routing/adapters/trimbleProvider';
import { TomTomRoutingProvider, tomtomLoadTypes, tollMilesFromSections } from '../server/routing/adapters/tomtomProvider';
import { routingManager, simulatedRoutesAllowed } from '../server/routing/routingManager';

const realFetch = globalThis.fetch;
const ENV = ['TRIMBLE_API_KEY', 'TRIMBLE_MAPS_API_KEY', 'TOMTOM_API_KEY', 'NODE_ENV', 'ROUTING_ALLOW_SIMULATED', 'GOOGLE_MAPS_API_KEY'];
let saved: Record<string, string | undefined> = {};
let calls: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  calls = [];
  routingManager.clearCacheForTesting();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function stub(handler: (url: string, init: RequestInit) => { status?: number; body: any }) {
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    const { status = 200, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const DALLAS = { label: 'Dallas, TX', coords: { lat: 32.7767, lon: -96.797 } };
const ATLANTA = { label: 'Atlanta, GA', coords: { lat: 33.749, lon: -84.388 } };
const PROFILE = { heightFt: 13.5, weightLbs: 80000, widthFt: 8.5, lengthFt: 53, axles: 5, isHazmat: true, hazmatClass: 'Corrosive', avoidTolls: false } as any;

// Shaped like PC*MILER's documented routeReports response: an array of reports keyed by __type.
const PCM_RESPONSE = [
  {
    __type: 'MileageReport:http://pcmiler.alk.com/APIs/v1.0',
    ReportLines: [
      { Stop: { Label: 'Dallas' }, LMiles: '0.000', TMiles: '0.000', LHours: '0:00', THours: '0:00', TTolls: '0.00' },
      { Stop: { Label: 'Atlanta' }, LMiles: '780.4', TMiles: '780.4', LHours: '12:30', THours: '12:30', TTolls: '$23.75' },
    ],
  },
  {
    __type: 'DirectionsReport:http://pcmiler.alk.com/APIs/v1.0',
    ReportLines: [{ Segments: [{ Direction: 'Depart Dallas on I-30 E', Dist: '12.5', Time: '0:14' }, { Direction: 'Arrive Atlanta', Dist: '0.0', Time: '0:00' }] }],
  },
  {
    __type: 'GeoTunnelReport:http://pcmiler.alk.com/APIs/v1.0',
    GeoTunnelPoints: [{ Lat: '32.7767', Lon: '-96.797' }, { Lat: '33.0', Lon: '-90.0' }, { Lat: '33.749', Lon: '-84.388' }],
  },
];

describe('PC*MILER (Trimble) adapter', () => {
  it('sends the documented ReportRoutes request with truck config and real hazmat class', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    stub(() => ({ body: PCM_RESPONSE }));
    const r = await new TrimbleRoutingProvider().calculateRoute(DALLAS, ATLANTA, [], PROFILE);

    expect(calls[0].url).toBe('https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/route/routeReports?dataVersion=Current');
    expect((calls[0].init.headers as any).Authorization).toBe('trimble-key');
    const body = JSON.parse(String(calls[0].init.body));
    const route = body.ReportRoutes[0];
    expect(route.Stops.length).toBe(2);
    expect(route.Options.VehicleType).toBe(0);
    expect(route.Options.HazMatTypes).toEqual([2]); // Corrosive → caustic, not "none"
    expect(route.Options.TruckCfg).toEqual({ Units: 0, Height: `13'6"`, Width: '102"', Length: `53'0"`, Weight: '80000', Axles: 5, LCV: false });
    expect(route.ReportTypes.map((t: any) => t.__type)).toEqual([
      'MileageReportType:http://pcmiler.alk.com/APIs/v1.0',
      'DirectionsReportType:http://pcmiler.alk.com/APIs/v1.0',
      'GeoTunnelReportType:http://pcmiler.alk.com/APIs/v1.0',
    ]);

    expect(r.provider).toBe('trimble');
    expect(r.mock).toBe(false);
    expect(r.totalDistanceMiles).toBe(780.4);
    expect(r.totalTimeMinutes).toBe(750); // from THours, not miles/55
    expect(r.estimatedTollCostUsd).toBe(23.75); // reported by PC*MILER
    expect(r.tollDistanceMiles).toBeNull(); // not reported → null, never 22% of miles
    expect(r.summaryPathCoords.length).toBe(3);
    expect(r.turnByTurnSteps[0]).toMatchObject({ instruction: 'Depart Dallas on I-30 E', distanceMiles: 12.5, durationMinutes: 14 });
  });

  it('mileage uses the same documented POST and real drive time', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    stub(() => ({ body: [PCM_RESPONSE[0]] }));
    const m = await new TrimbleRoutingProvider().getMileage(DALLAS, ATLANTA, [], PROFILE);
    expect(calls[0].url).toContain('/route/routeReports');
    expect(m.distanceMiles).toBe(780.4);
    expect(m.durationMinutes).toBe(750);
  });

  it('fails instead of guessing when PC*MILER returns no mileage', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    stub(() => ({ body: [] }));
    await expect(new TrimbleRoutingProvider().calculateRoute(DALLAS, ATLANTA, [], PROFILE)).rejects.toThrow('no mileage');
  });

  it('helpers', () => {
    expect(feetInches(13.5)).toBe(`13'6"`);
    expect(feetInches(13.99)).toBe(`14'0"`);
    expect(hoursToMinutes('12:30')).toBe(750);
    expect(hoursToMinutes('1.5')).toBe(90);
    expect(hoursToMinutes(undefined)).toBeNull();
    expect(isHazmatLoad({ isHazmat: false, hazmatClass: 'Explosive' })).toBe(true);
    expect(isHazmatLoad({ isHazmat: false, hazmatClass: 'None' })).toBe(false);
    expect(parsePcmilerReports(null).totalMiles).toBeNull();
  });
});

describe('TomTom truck adapter', () => {
  const TOMTOM_RESPONSE = {
    routes: [
      {
        summary: { lengthInMeters: 1255000, travelTimeInSeconds: 45000, trafficDelayInSeconds: 600 },
        legs: [
          {
            summary: { lengthInMeters: 1255000, travelTimeInSeconds: 45000 },
            points: [{ latitude: 32.7767, longitude: -96.797 }, { latitude: 33.0, longitude: -95.0 }, { latitude: 33.2, longitude: -93.0 }, { latitude: 33.749, longitude: -84.388 }],
          },
        ],
        sections: [{ sectionType: 'TOLL_ROAD', startPointIndex: 0, endPointIndex: 1 }, { sectionType: 'TRAFFIC', startPointIndex: 1, endPointIndex: 2 }],
        guidance: {
          instructions: [
            { message: 'Head east on I-30', routeOffsetInMeters: 0, travelTimeInSeconds: 0 },
            { message: 'Keep left onto I-20', routeOffsetInMeters: 16093, travelTimeInSeconds: 900 },
            { message: 'Arrive', routeOffsetInMeters: 1255000, travelTimeInSeconds: 45000 },
          ],
        },
      },
    ],
  };

  it('requests truck routing with dimensions, specific hazmat classes and toll sections', async () => {
    process.env.TOMTOM_API_KEY = 'tt-key';
    stub(() => ({ body: TOMTOM_RESPONSE }));
    const r = await new TomTomRoutingProvider().calculateRoute(DALLAS, ATLANTA, [], { ...PROFILE, hazmatClass: 'Flammable' });
    const u = new URL(calls[0].url);
    expect(u.pathname).toBe('/routing/1/calculateRoute/32.7767,-96.797:33.749,-84.388/json');
    expect(u.searchParams.get('travelMode')).toBe('truck');
    expect(u.searchParams.get('vehicleHeight')).toBe('4.11');
    expect(u.searchParams.get('vehicleWeight')).toBe('36287');
    expect(u.searchParams.get('vehicleNumberOfAxles')).toBe('5');
    expect(u.searchParams.getAll('vehicleLoadType')).toEqual(['USHazmatClass3', 'USHazmatClass4']);
    expect(u.searchParams.get('sectionType')).toBe('tollRoad');

    expect(r.totalDistanceMiles).toBe(779.8);
    expect(r.totalTimeMinutes).toBe(750);
    expect(r.trafficDelayMinutes).toBe(10);
    expect(r.estimatedTollCostUsd).toBeNull(); // TomTom doesn't price tolls; never invented
    expect(r.tollDistanceMiles).toBeGreaterThan(100); // only the TOLL_ROAD section
    expect(r.tollDistanceMiles).toBeLessThan(120);
    // Step distances are differences between cumulative offsets.
    expect(r.turnByTurnSteps[0]).toMatchObject({ instruction: 'Head east on I-30', distanceMiles: 10, durationMinutes: 15 });
  });

  it('hazmat class mapping and toll helper', () => {
    expect(tomtomLoadTypes('Corrosive')).toEqual(['USHazmatClass8']);
    expect(tomtomLoadTypes('Explosive')).toEqual(['USHazmatClass1']);
    expect(tomtomLoadTypes('General')).toEqual(['otherHazmat']);
    expect(tollMilesFromSections(undefined, [])).toBeNull();
    expect(tollMilesFromSections([], [[0, 0], [1, 1]])).toBe(0);
  });
});

describe('Routing manager: providers first, never a simulated route in production', () => {
  it('uses PC*MILER for planning and TomTom for navigation', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    process.env.TOMTOM_API_KEY = 'tt-key';
    stub((url) => (url.includes('pcmiler') ? { body: PCM_RESPONSE } : { body: { routes: [{ summary: { lengthInMeters: 1609344, travelTimeInSeconds: 3600 }, legs: [] }] } }));
    expect((await routingManager.calculateRoute(DALLAS, ATLANTA, [], PROFILE)).provider).toBe('trimble');
    routingManager.clearCacheForTesting();
    expect((await routingManager.calculateRoute(DALLAS, ATLANTA, [], PROFILE, { mode: 'navigation' } as any)).provider).toBe('tomtom');
  });

  it('falls back from PC*MILER to TomTom when PC*MILER fails', async () => {
    process.env.TRIMBLE_API_KEY = 'trimble-key';
    process.env.TOMTOM_API_KEY = 'tt-key';
    stub((url) => (url.includes('pcmiler') ? { status: 401, body: { Message: 'bad key' } } : { body: { routes: [{ summary: { lengthInMeters: 1609344, travelTimeInSeconds: 3600 }, legs: [] }] } }));
    const r = await routingManager.calculateRoute(DALLAS, ATLANTA, [], PROFILE);
    expect(r.provider).toBe('tomtom');
    expect(r.fallbackTriggered).toBe(true);
  });

  it('in production with no working provider: 503, not a simulated truck route', async () => {
    process.env.NODE_ENV = 'production';
    expect(simulatedRoutesAllowed()).toBe(false);
    await expect(routingManager.calculateRoute(DALLAS, ATLANTA, [], PROFILE)).rejects.toMatchObject({ statusCode: 503 });
    await expect(routingManager.getMileage(DALLAS, ATLANTA, [], PROFILE)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('outside production the simulator is allowed but always flagged mock', async () => {
    process.env.NODE_ENV = 'test';
    const r = await routingManager.calculateRoute(DALLAS, ATLANTA, [], PROFILE);
    expect(r.mock).toBe(true);
  });
});
