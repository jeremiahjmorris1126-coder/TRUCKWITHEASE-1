/**
 * TruckWithEase // Cloudflare Edge Gateway Worker
 * Worker Name: truckwithease-1
 *
 * Edge Responsibilities:
 * 1. Hosts custom domains: truckwithease.com, morrishive.com
 * 2. Edge caching with Cloudflare KV (truckwithease-cache)
 * 3. Structured audit logging with Cloudflare D1 (truckwithease-db)
 * 4. Reverse proxies /api/*, /v1/*, /health, /voice to Google Cloud Run backend
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
  PRIMARY_DOMAIN?: string;
  ENTERPRISE_PORTAL_DOMAIN?: string;
  BACKEND_URL?: string;
  GEMINI_API_KEY?: string;
  CARRIER_API_SECRET?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-carrier-token, x-serverless-authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type, X-Cache, X-Backend-Provider',
};

const DEFAULT_CLOUD_RUN_BACKEND = 'https://truckwithease-1-62nxuqhmtq-uc.a.run.app';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight at edge
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 1. Edge-Accelerated Weather Hazards (Served directly from KV if present)
      if (url.pathname === '/api/weather/hazards' && request.method === 'GET') {
        const corridor = url.searchParams.get('corridor') || 'I-80';
        const cacheKey = `weather_hazard_${corridor}`;

        const cached = env.CACHE ? await env.CACHE.get(cacheKey) : null;
        if (cached) {
          return new Response(cached, {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'X-Cache': 'HIT',
              'X-Edge-Provider': 'Cloudflare-KV',
            },
          });
        }
      }

      // 2. Edge Diagnostics Probe
      if (url.pathname === '/api/edge/status') {
        let d1Healthy = false;
        try {
          if (env.DB) {
            await env.DB.prepare('SELECT 1').first();
            d1Healthy = true;
          }
        } catch {
          d1Healthy = false;
        }

        const edgeStatus = {
          status: 'UP',
          edgePlatform: 'Cloudflare Global Edge Anycast',
          worker: 'truckwithease-1',
          uptimeSeconds: Math.floor(Date.now() / 1000),
          backendOrigin: env.BACKEND_URL || DEFAULT_CLOUD_RUN_BACKEND,
          bindings: {
            d1Database: env.DB ? (d1Healthy ? 'CONNECTED' : 'BOUND_SCHEMA_UNINITIALIZED') : 'NOT_BOUND',
            kvCache: env.CACHE ? 'CONNECTED' : 'NOT_BOUND',
          },
          colo: (request as any).cf?.colo || 'EDGE',
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(edgeStatus, null, 2), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 3. Reverse Proxy all API, Telemetry, and Webhook Routes to Google Cloud Run
      const isBackendRoute =
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/v1/') ||
        url.pathname === '/health' ||
        url.pathname === '/ready' ||
        url.pathname === '/voice';

      if (isBackendRoute) {
        const backendOrigin = (env.BACKEND_URL || DEFAULT_CLOUD_RUN_BACKEND).replace(/\/+$/, '');
        const targetUrl = new URL(url.pathname + url.search, backendOrigin);

        // Forward caller headers while augmenting with Cloudflare proxy telemetry
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.set('x-forwarded-host', url.host);
        proxyHeaders.set('x-forwarded-proto', url.protocol.replace(':', ''));
        const clientIp = request.headers.get('cf-connecting-ip');
        if (clientIp) {
          proxyHeaders.set('x-forwarded-for', clientIp);
          proxyHeaders.set('cf-connecting-ip', clientIp);
        }

        const proxyReq = new Request(targetUrl.toString(), {
          method: request.method,
          headers: proxyHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'follow',
        });

        const backendResponse = await fetch(proxyReq);

        // Create response with CORS headers retained
        const responseHeaders = new Headers(backendResponse.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => {
          if (!responseHeaders.has(k)) {
            responseHeaders.set(k, v);
          }
        });
        responseHeaders.set('X-Backend-Provider', 'Google-Cloud-Run');

        // Cache successful weather hazard responses in Cloudflare KV asynchronously
        if (url.pathname === '/api/weather/hazards' && backendResponse.status === 200 && env.CACHE) {
          const cloned = backendResponse.clone();
          ctx.waitUntil(
            cloned.text().then((body) => {
              const corridor = url.searchParams.get('corridor') || 'I-80';
              return env.CACHE!.put(`weather_hazard_${corridor}`, body, { expirationTtl: 300 });
            })
          );
        }

        return new Response(backendResponse.body, {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          headers: responseHeaders,
        });
      }

      // 4. Fallback: Not Found
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          path: url.pathname,
          worker: 'truckwithease-1',
          backendTarget: env.BACKEND_URL || DEFAULT_CLOUD_RUN_BACKEND,
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Edge Gateway Error',
          details: err?.message || String(err),
          backendOrigin: env.BACKEND_URL || DEFAULT_CLOUD_RUN_BACKEND,
        }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  },
};
