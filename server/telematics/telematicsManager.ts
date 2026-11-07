import type { CallerIdentity } from '../data/fleetStore';
import { redactSecrets } from './http';
import { DEMO_DRIVERS, DEMO_VEHICLES, isDemoModeEnabled } from './demoData';
import { GeotabAdapter } from './geotabAdapter';
import { MotiveAdapter } from './motiveAdapter';
import { SamsaraAdapter } from './samsaraAdapter';
import {
  NormalizedDriver,
  NormalizedVehicle,
  ProviderStatus,
  TelematicsProviderAdapter,
  TelematicsProviderId,
} from './types';

const CACHE_TTL_MS = 30_000;

type Kind = 'vehicles' | 'drivers';

/**
 * Aggregates read-only ELD data from the carrier's registered providers.
 *
 * - Never fabricates data. A configured provider that fails is reported as
 *   ERROR with the reason; its data is simply absent.
 * - ELD credentials are server-wide, so the data belongs to ONE fleet
 *   (TELEMATICS_FLEET_ID). Callers from any other fleet get nothing.
 * - Demo fixtures are only served when TELEMATICS_DEMO_DATA=true outside production.
 */
export class TelematicsManager {
  private adapters = new Map<TelematicsProviderId, TelematicsProviderAdapter>();
  private status = new Map<TelematicsProviderId, ProviderStatus>();
  private cache = new Map<string, { at: number; data: any[] }>();

  constructor(adapters?: TelematicsProviderAdapter[]) {
    for (const a of adapters || [new SamsaraAdapter(), new MotiveAdapter(), new GeotabAdapter()]) {
      this.adapters.set(a.id, a);
      this.status.set(a.id, {
        provider: a.id,
        configured: false,
        mode: 'NOT_CONFIGURED',
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        lastVehicleCount: null,
        lastDriverCount: null,
      });
    }
  }

  /** Fleet that owns the server-wide ELD credentials. */
  getOwningFleetId(): string | null {
    return process.env.TELEMATICS_FLEET_ID?.trim() || null;
  }

  /** Whether this caller may see ELD data. Internal calls (no caller) are allowed. */
  canAccess(caller?: CallerIdentity | null): boolean {
    if (!caller) return true;
    if (caller.role === 'owner') return true;
    if (isDemoModeEnabled()) return true;
    const owning = this.getOwningFleetId();
    return Boolean(owning && caller.fleetId && caller.fleetId === owning);
  }

  getAdapterStatus(): Record<string, ProviderStatus> {
    const demo = isDemoModeEnabled();
    const out: Record<string, ProviderStatus> = {};
    for (const [id, adapter] of this.adapters) {
      const s = this.status.get(id)!;
      const configured = adapter.isConfigured();
      const mode: ProviderStatus['mode'] = !configured
        ? demo ? 'DEMO' : 'NOT_CONFIGURED'
        : s.mode === 'LIVE' || s.mode === 'ERROR' ? s.mode : 'CONFIGURED';
      out[id] = { ...s, configured, mode };
    }
    return out;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private record(id: TelematicsProviderId, kind: Kind, ok: boolean, countOrErr: number | string) {
    const s = this.status.get(id)!;
    const now = new Date().toISOString();
    if (ok) {
      s.mode = 'LIVE';
      s.lastSuccessAt = now;
      s.lastError = null;
      if (kind === 'vehicles') s.lastVehicleCount = countOrErr as number;
      else s.lastDriverCount = countOrErr as number;
    } else {
      s.mode = 'ERROR';
      s.lastErrorAt = now;
      s.lastError = redactSecrets(String(countOrErr)).slice(0, 300);
    }
  }

  private async collect<T>(kind: Kind, caller?: CallerIdentity | null): Promise<T[]> {
    if (!this.canAccess(caller)) return [];
    const demo = isDemoModeEnabled();
    const results: T[] = [];

    await Promise.all(
      [...this.adapters].map(async ([id, adapter]) => {
        if (!adapter.isConfigured()) {
          if (demo) results.push(...((kind === 'vehicles' ? DEMO_VEHICLES[id] : DEMO_DRIVERS[id]) as unknown as T[]));
          return;
        }
        const key = `${id}:${kind}`;
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
          results.push(...(hit.data as T[]));
          return;
        }
        try {
          const data = (kind === 'vehicles' ? await adapter.getFleetVehicles() : await adapter.getDrivers()) as unknown as T[];
          this.cache.set(key, { at: Date.now(), data });
          this.record(id, kind, true, data.length);
          results.push(...data);
        } catch (err) {
          const msg = (err as Error).message;
          this.record(id, kind, false, msg);
          console.error(`[TelematicsManager] ${adapter.name} ${kind} fetch failed: ${redactSecrets(msg)}`);
        }
      })
    );
    return results;
  }

  getAllVehicles(caller?: CallerIdentity | null): Promise<NormalizedVehicle[]> {
    return this.collect<NormalizedVehicle>('vehicles', caller);
  }

  getAllDrivers(caller?: CallerIdentity | null): Promise<NormalizedDriver[]> {
    return this.collect<NormalizedDriver>('drivers', caller);
  }

  async getVehicle(id: string, caller?: CallerIdentity | null): Promise<NormalizedVehicle | null> {
    const all = await this.getAllVehicles(caller);
    return all.find((v) => v.id === id || v.unitNumber === id) || null;
  }
}

export const telematicsManager = new TelematicsManager();
