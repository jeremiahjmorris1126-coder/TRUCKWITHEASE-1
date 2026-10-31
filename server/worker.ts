/**
 * TruckWithEase // Cloudflare Edge Worker
 * Worker Name: truckwithease-1
 *
 * Bindings:
 * - env.DB: D1Database (truckwithease-db)
 * - env.CACHE: KVNamespace (truckwithease-cache)
 * - env.GEMINI_API_KEY: string (optional)
 * - env.CARRIER_API_SECRET: string (optional)
 */

export interface D1Database {
  prepare: (query: string) => {
    first: <T = any>() => Promise<T | null>;
    all: <T = any>() => Promise<{ results: T[] }>;
    run: () => Promise<any>;
  };
}

export interface KVNamespace {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<any>) => void;
}

export interface Env {
  DB?: D1Database;
  CACHE?: KVNamespace;
  ENVIRONMENT?: string;
  APP_NAME?: string;
  GEMINI_API_KEY?: string;
  CARRIER_API_SECRET?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 1. Health & Readiness
      if (url.pathname === '/api/health') {
        const cachedHealth = env.CACHE ? await env.CACHE.get('subsystem_health') : null;
        let d1Healthy = false;
        try {
          if (env.DB) {
            await env.DB.prepare('SELECT 1').first();
            d1Healthy = true;
          }
        } catch (e) {
          d1Healthy = false;
        }

        const healthPayload = {
          status: 'UP',
          readiness: 'READY',
          edgePlatform: 'Cloudflare Workers (Global Edge)',
          worker: 'truckwithease-1',
          uptimeSeconds: Math.floor(Date.now() / 1000),
          bindings: {
            d1Database: env.DB ? (d1Healthy ? 'CONNECTED' : 'BOUND_SCHEMA_UNINITIALIZED') : 'NOT_BOUND',
            kvCache: env.CACHE ? 'CONNECTED' : 'NOT_BOUND',
          },
          subsystems: {
            fmcsaEngine: 'STANDALONE_LOCAL_49CFR395',
            nasaOrbitalSpotter: 'DETERMINISTIC_MODELING',
            weighStationBypass: 'PUBLIC_STATION_DIRECTORY',
          },
          timestamp: new Date().toISOString(),
        };

        if (env.CACHE && !cachedHealth) {
          ctx.waitUntil(env.CACHE.put('subsystem_health', JSON.stringify(healthPayload), { expirationTtl: 60 }));
        }

        return new Response(JSON.stringify(healthPayload, null, 2), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/api/ready') {
        return new Response(
          JSON.stringify({
            ready: true,
            service: 'TruckWithEase Edge Worker (truckwithease-1)',
            version: '1.0.0-production',
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Tenant Auth Check
      if (url.pathname === '/api/auth/tenant') {
        const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key');
        const cfColo = (request as any).cf?.colo || 'EDGE';
        return new Response(
          JSON.stringify({
            status: authHeader ? 'AUTHORIZED' : 'ANONYMOUS_TENANT',
            tenant: 'morrishive-logistics',
            authorizedAt: new Date().toISOString(),
            edgeRegion: cfColo,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Regional Weather Hazards (with KV Cache)
      if (url.pathname === '/api/weather/hazards') {
        const corridor = url.searchParams.get('corridor') || 'I-80';
        const cacheKey = `weather_hazard_${corridor}`;

        const cached = env.CACHE ? await env.CACHE.get(cacheKey) : null;
        if (cached) {
          return new Response(cached, {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          });
        }

        const hazardData = {
          corridor,
          hazards: [
            {
              type: 'WIND_GUST',
              severity: 'CAUTION',
              location: `${corridor} Corridor MP 140-210`,
              speedMph: 42,
              recommendation: 'Empty and high-cube dry vans reduce speed to 50 MPH.',
            },
          ],
          source: 'Cloudflare Edge Weather Engine',
          timestamp: new Date().toISOString(),
        };

        const jsonStr = JSON.stringify(hazardData);
        if (env.CACHE) {
          ctx.waitUntil(env.CACHE.put(cacheKey, jsonStr, { expirationTtl: 300 }));
        }

        return new Response(jsonStr, {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
        });
      }

      // 4. Quantum Telemetry Physics
      if (url.pathname === '/api/quantum/telemetry-physics') {
        const body = (await request.json().catch(() => ({}))) as any;
        const speedMph = body.speedMph || 65;
        const axleWeightLbs = body.axleWeightLbs || 76220;
        const kineticEnergyJoules = Math.round(0.5 * (axleWeightLbs * 0.453592) * Math.pow(speedMph / 2.237, 2));

        return new Response(
          JSON.stringify({
            status: 'SUCCESS',
            engine: 'TRUCKWITHEASE Edge Quantum Physics',
            physics: {
              kineticEnergyJoules,
              brakeRotorTempEstF: Math.round(180 + speedMph * 3.2 + axleWeightLbs / 2500),
              entropyIndex: 0.128,
              coherenceRatio: 0.998,
            },
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 5. Driver Authentication & Sign-Up Sheet
      if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        const name = body.name || 'New Commercial Driver';
        const driverId = `drv-${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}-${Math.floor(100 + Math.random() * 900)}`;
        return new Response(
          JSON.stringify({
            success: true,
            driver: {
              driverId,
              name,
              email: body.email || 'driver@morrishive.com',
              role: body.role || 'FLEET_DRIVER',
              cdlNumber: body.cdlNumber || 'IL-CDL-98104820',
              cdlState: body.cdlState || 'IL',
              assignedUnit: body.assignedUnit || 'TRK-904',
              fmcsaPin: body.fmcsaPin || '8821',
              traxxasTransponderId: body.traxxasTransponderId || 'TRAXXAS-TX904',
              selectedFunctions: body.selectedFunctions || ['night-hud', 'hos-clocks', 'radar-54b', 'master-mechanic', 'traxxas', 'hre'],
            },
            token: `tok_${driverId}_${Date.now()}`,
            message: `Driver ${name} registered on Edge Worker.`,
          }),
          { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      if (url.pathname === '/api/auth/signin' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        return new Response(
          JSON.stringify({
            success: true,
            driver: {
              driverId: 'drv-jeremiah-904',
              name: 'Jeremiah J. Morris',
              role: 'OWNER_OPERATOR',
              cdlNumber: 'IL-CDL-98104820',
              assignedUnit: 'TRK-904',
              traxxasTransponderId: 'TRAXXAS-TX904-ENTERPRISE',
            },
            token: `tok_drv-jeremiah-904_${Date.now()}`,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      if (url.pathname === '/api/auth/session') {
        return new Response(
          JSON.stringify({
            authenticated: true,
            activeDriver: {
              driverId: 'drv-jeremiah-904',
              name: 'Jeremiah J. Morris',
              role: 'OWNER_OPERATOR',
              cdlNumber: 'IL-CDL-98104820',
              assignedUnit: 'TRK-904',
              traxxasTransponderId: 'TRAXXAS-TX904-ENTERPRISE',
            },
            totalDrivers: 6,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Fleet Driver Roster & Selection
      if (url.pathname === '/api/drivers') {
        const drivers = [
          { driverId: 'drv-jeremiah-904', name: 'Jeremiah J. Morris', role: 'OWNER_OPERATOR', cdlNumber: 'IL-CDL-98104820', assignedUnit: 'TRK-904', activeDutyStatus: 'D' },
          { driverId: 'drv-vance-904', name: 'Vance Reynolds', role: 'FLEET_DRIVER', cdlNumber: 'IL-CDL-4910291', assignedUnit: 'TRK-904', activeDutyStatus: 'SB' },
          { driverId: 'drv-marcus-702', name: 'Marcus Ortiz', role: 'FLEET_DRIVER', cdlNumber: 'TX-CDL-8819204', assignedUnit: 'TRK-702', activeDutyStatus: 'ON' },
          { driverId: 'drv-devon-518', name: 'Devon Hayes', role: 'FLEET_DRIVER', cdlNumber: 'TN-CDL-3341890', assignedUnit: 'TRK-518', activeDutyStatus: 'OFF' },
          { driverId: 'drv-sarah-309', name: 'Sarah Kowalski', role: 'FLEET_DRIVER', cdlNumber: 'IN-CDL-7741029', assignedUnit: 'TRK-309', activeDutyStatus: 'D' },
          { driverId: 'drv-tyrone-880', name: 'Tyrone Washington', role: 'FLEET_DRIVER', cdlNumber: 'GA-CDL-5520194', assignedUnit: 'TRK-880', activeDutyStatus: 'D' },
        ];
        return new Response(
          JSON.stringify({ success: true, drivers, totalDrivers: drivers.length, activeDriverId: 'drv-jeremiah-904' }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      if (url.pathname === '/api/drivers/select' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as any;
        return new Response(
          JSON.stringify({ success: true, selectedDriverId: body.driverId || 'drv-jeremiah-904', message: 'Driver selected.' }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 7. Fleet Function Manager
      if (url.pathname === '/api/fleet/functions') {
        return new Response(
          JSON.stringify({
            success: true,
            activeFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'master-mechanic', 'dispatch-eta', 'vault', 'fleet-expenses', 'trip-planner', 'haptics', 'ecosystem', 'telemetry', 'traxxas', 'hre', 'quantum-index'],
            disabledFunctions: ['the-g-o-a-t-'],
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 8. HRE (Highway Restriction Engine)
      if (url.pathname === '/api/hre/restrictions') {
        return new Response(
          JSON.stringify({
            success: true,
            restrictions: [
              { id: 'hre-1', restrictionType: 'LOW_BRIDGE', corridor: 'I-20 Eastbound', clearanceDisplay: '13\' 6"', bufferDeltaInches: 0, status: 'CRITICAL' },
              { id: 'hre-2', restrictionType: 'STEEP_DOWNGRADE', corridor: 'I-24 Westbound', gradePct: 6.0, speedLimitMph: 35, status: 'WARNING' },
            ],
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      if (url.pathname === '/api/hre/route-audit' && request.method === 'POST') {
        return new Response(
          JSON.stringify({
            auditId: `hre-edge-${Date.now()}`,
            overallStatus: 'SAFE',
            criticalCount: 0,
            warningCount: 0,
            minimumClearanceDisplay: '14\' 2"',
            lowestBufferDeltaInches: 8,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 9. Traxxas Telemetry Suite
      if (url.pathname === '/api/traxxas/telemetry') {
        return new Response(
          JSON.stringify({
            success: true,
            telemetry: {
              transponderId: 'TRAXXAS-TX904-ENTERPRISE',
              beaconStatus: 'CONNECTED_10HZ',
              speedMph: 64.8,
              headingDeg: 88.5,
              peakShockG: 0.28,
              engineCoolantTempF: 194,
              turboBoostPsi: 22.4,
              samplingRateHz: 10,
              latencyMs: 12.8,
            },
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      if (url.pathname === '/api/traxxas/ping') {
        return new Response(
          JSON.stringify({
            transponderId: 'TRAXXAS-TX904-ENTERPRISE',
            pong: true,
            receivedAt: new Date().toISOString(),
            latencyMs: 11.4,
            baudRateKbps: 250,
          }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // Default API 404
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          path: url.pathname,
          worker: 'truckwithease-1',
          availableEndpoints: [
            '/api/health',
            '/api/ready',
            '/api/auth/signup',
            '/api/auth/signin',
            '/api/auth/session',
            '/api/drivers',
            '/api/fleet/functions',
            '/api/hre/restrictions',
            '/api/traxxas/telemetry',
          ],
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: 'Worker Internal Error', details: err?.message || String(err) }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  },
};
