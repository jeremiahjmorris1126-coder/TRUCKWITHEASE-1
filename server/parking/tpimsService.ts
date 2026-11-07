import { fetchWithRetryOn5xx, maskSecrets } from '../routing/httpUtils';

/**
 * Real-time truck parking from state DOT TPIMS feeds (Truck Parking Information
 * Management System; MAASTO Regional TPIMS Data Exchange specification).
 *
 * Each state publishes two JSON feeds:
 *   - dynamic: { siteId, timeStamp, timeStampStatic, reportedAvailable, trend, open, trustData, capacity }
 *     updated every 1–5 minutes. reportedAvailable is a string and may be "Low".
 *   - static:  site metadata (name, location, highway, direction, capacity, amenities)
 *
 * Configure with TPIMS_FEEDS, a JSON array (feed URLs include the state's API key):
 *   [{"state":"KS","dynamicUrl":"https://...","staticUrl":"https://..."}, ...]
 *
 * Nothing is fabricated: unconfigured -> no sites; a failing state feed is reported
 * with its error; counts the site itself marks untrustworthy are withheld.
 */

export interface TpimsFeedConfig {
  state: string;
  dynamicUrl: string;
  staticUrl?: string;
}

export interface ParkingSite {
  siteId: string;
  state: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  highway: string | null;
  direction: string | null;
  exitId: string | null;
  address: string | null;
  capacity: number | null;
  /** Open truck spaces reported by the site; null when unknown or untrusted. */
  available: number | null;
  /** True when the site reports "Low" instead of a number. */
  availabilityLow: boolean;
  trend: string | null;
  open: boolean | null;
  /** false = site reports its sensors are not operating normally. */
  trustData: boolean | null;
  amenities: string[];
  updatedAt: string | null;
  /** True when the reading is older than STALE_AFTER_MIN. */
  stale: boolean;
  distanceMi: number | null;
}

export interface TpimsFeedStatus {
  state: string;
  ok: boolean;
  siteCount: number;
  lastFetchAt: string | null;
  error: string | null;
}

const DYNAMIC_TTL_MS = 2 * 60_000;
const STATIC_TTL_MS = 6 * 60 * 60_000;
export const STALE_AFTER_MIN = 15;

export function parseFeedConfig(raw = process.env.TPIMS_FEEDS): TpimsFeedConfig[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[TPIMS] TPIMS_FEEDS is not valid JSON; parking feeds disabled.');
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((f: any) => f && typeof f.state === 'string' && isHttps(f.dynamicUrl) && (f.staticUrl === undefined || isHttps(f.staticUrl)))
    .map((f: any) => ({ state: f.state.trim().toUpperCase(), dynamicUrl: f.dynamicUrl, staticUrl: f.staticUrl }));
}

function isHttps(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
}

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Some feeds wrap records in an object; accept a bare array or the first array property. */
function asRecords(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    for (const v of Object.values(body)) if (Array.isArray(v)) return v;
  }
  throw new Error('Feed did not contain a list of sites.');
}

export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export function mergeSite(state: string, dyn: any, stat: any | undefined, now = Date.now()): ParkingSite {
  const loc = stat?.location || {};
  const rawAvail = dyn?.reportedAvailable;
  const availabilityLow = typeof rawAvail === 'string' && rawAvail.trim().toLowerCase() === 'low';
  const trustData = typeof dyn?.trustData === 'boolean' ? dyn.trustData : null;
  const updatedAt = strOrNull(dyn?.timeStamp);
  const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
  const amenities = Array.isArray(stat?.amenities)
    ? stat.amenities.map((a: any) => (typeof a === 'string' ? a : a?.name || a?.amenity)).filter((a: any) => typeof a === 'string')
    : [];
  return {
    siteId: String(dyn.siteId),
    state,
    name: strOrNull(stat?.name) || String(dyn.siteId),
    latitude: numOrNull(loc.latitude ?? loc.lat ?? stat?.latitude),
    longitude: numOrNull(loc.longitude ?? loc.lon ?? loc.lng ?? stat?.longitude),
    highway: strOrNull(loc.relevantHighway ?? stat?.relevantHighway),
    direction: strOrNull(loc.directionOfTravel ?? stat?.directionOfTravel),
    exitId: strOrNull(loc.exitId ?? stat?.exitId),
    address: [strOrNull(loc.streetAdr), strOrNull(loc.city), strOrNull(loc.state)].filter(Boolean).join(', ') || null,
    capacity: numOrNull(dyn?.capacity ?? stat?.capacity),
    // Withhold the count when the site says its own data is not trustworthy.
    available: trustData === false || availabilityLow ? null : numOrNull(rawAvail),
    availabilityLow: trustData === false ? false : availabilityLow,
    trend: strOrNull(dyn?.trend),
    open: typeof dyn?.open === 'boolean' ? dyn.open : null,
    trustData,
    amenities,
    updatedAt,
    stale: !Number.isFinite(updatedMs) || now - updatedMs > STALE_AFTER_MIN * 60_000,
    distanceMi: null,
  };
}

export class TpimsService {
  private dynCache = new Map<string, { at: number; rows: any[] }>();
  private staticCache = new Map<string, { at: number; byId: Map<string, any> }>();
  private status = new Map<string, TpimsFeedStatus>();

  isConfigured(): boolean {
    return parseFeedConfig().length > 0;
  }

  getFeedStatus(): TpimsFeedStatus[] {
    return parseFeedConfig().map(
      (f) => this.status.get(f.state) || { state: f.state, ok: false, siteCount: 0, lastFetchAt: null, error: null }
    );
  }

  clearCache(): void {
    this.dynCache.clear();
    this.staticCache.clear();
    this.status.clear();
  }

  private async getJson(url: string, state: string): Promise<unknown> {
    const res = await fetchWithRetryOn5xx(url, { headers: { Accept: 'application/json' } }, {
      providerName: `TPIMS-${state}`,
      timeoutMs: 8000,
      maxRetries: 1,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (API key rejected)' : ''}`);
    return res.json();
  }

  private async loadState(feed: TpimsFeedConfig): Promise<ParkingSite[]> {
    const now = Date.now();
    let dyn = this.dynCache.get(feed.state);
    if (!dyn || now - dyn.at > DYNAMIC_TTL_MS) {
      dyn = { at: now, rows: asRecords(await this.getJson(feed.dynamicUrl, feed.state)) };
      this.dynCache.set(feed.state, dyn);
    }

    let stat = this.staticCache.get(feed.state);
    if (feed.staticUrl && (!stat || now - stat.at > STATIC_TTL_MS)) {
      try {
        const rows = asRecords(await this.getJson(feed.staticUrl, feed.state));
        stat = { at: now, byId: new Map(rows.filter((r) => r?.siteId).map((r) => [String(r.siteId), r])) };
        this.staticCache.set(feed.state, stat);
      } catch (err) {
        // Static metadata is optional; keep serving live counts without names/locations.
        console.warn(`[TPIMS] ${feed.state} static feed failed: ${maskSecrets((err as Error).message)}`);
      }
    }

    return dyn.rows.filter((r) => r?.siteId).map((r) => mergeSite(feed.state, r, stat?.byId.get(String(r.siteId)), now));
  }

  async getSites(opts: { lat?: number; lon?: number; limit?: number } = {}): Promise<ParkingSite[]> {
    const feeds = parseFeedConfig();
    const all: ParkingSite[] = [];
    await Promise.all(
      feeds.map(async (feed) => {
        try {
          const sites = await this.loadState(feed);
          all.push(...sites);
          this.status.set(feed.state, { state: feed.state, ok: true, siteCount: sites.length, lastFetchAt: new Date().toISOString(), error: null });
        } catch (err) {
          const msg = maskSecrets((err as Error).message).replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
          this.status.set(feed.state, { state: feed.state, ok: false, siteCount: 0, lastFetchAt: new Date().toISOString(), error: msg });
          console.error(`[TPIMS] ${feed.state} dynamic feed failed: ${msg}`);
        }
      })
    );

    const { lat, lon } = opts;
    if (typeof lat === 'number' && typeof lon === 'number') {
      for (const s of all) {
        if (s.latitude !== null && s.longitude !== null) {
          s.distanceMi = Math.round(haversineMi(lat, lon, s.latitude, s.longitude) * 10) / 10;
        }
      }
      all.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
    } else {
      all.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
    }
    return all.slice(0, Math.max(1, Math.min(opts.limit ?? 50, 200)));
  }
}

export const tpimsService = new TpimsService();
