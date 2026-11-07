import { fetchProviderJson, num, round } from './http';
import { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter, TelematicsProviderError } from './types';

/**
 * Geotab MyGeotab JSON-RPC adapter (read-only).
 *   POST https://<server>/apiv1
 *   Authenticate → Get Device + DeviceStatusInfo (vehicles)
 *   Get User{isDriver} + DutyStatusAvailability (HOS remaining time)
 *
 * Env:
 *   GEOTAB_DATABASE (required), GEOTAB_USERNAME (or legacy GEOTAB_API_USER)
 *   GEOTAB_PASSWORD  — or an existing GEOTAB_SESSION_ID
 *   GEOTAB_SERVER    — default my.geotab.com
 */

interface GeotabCredentials {
  database: string;
  userName: string;
  sessionId: string;
}

const KMH_TO_MPH = 0.621371;

export class GeotabAdapter implements TelematicsProviderAdapter {
  id = 'geotab' as const;
  name = 'Geotab';

  private session: { credentials: GeotabCredentials; server: string } | null = null;
  /** In-flight Authenticate call, shared so concurrent requests sign in only once. */
  private authInFlight: Promise<{ credentials: GeotabCredentials; server: string }> | null = null;

  private env() {
    return {
      server: (process.env.GEOTAB_SERVER || 'my.geotab.com').replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      database: process.env.GEOTAB_DATABASE?.trim(),
      userName: (process.env.GEOTAB_USERNAME || process.env.GEOTAB_API_USER)?.trim(),
      password: process.env.GEOTAB_PASSWORD,
      sessionId: process.env.GEOTAB_SESSION_ID?.trim(),
    };
  }

  isConfigured(): boolean {
    const e = this.env();
    return Boolean(e.database && e.userName && (e.password || e.sessionId));
  }

  private async rpc<T = any>(server: string, method: string, params: Record<string, any>): Promise<T> {
    const body = await fetchProviderJson<any>('geotab', `https://${server}/apiv1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    if (body?.error) {
      const name = body.error.errors?.[0]?.name || body.error.name || 'GeotabError';
      const err = new TelematicsProviderError('geotab', `${name}: ${body.error.message || 'request failed'}`);
      (err as any).geotabErrorName = name;
      throw err;
    }
    return body?.result as T;
  }

  private authenticate(): Promise<{ credentials: GeotabCredentials; server: string }> {
    if (!this.authInFlight) {
      this.authInFlight = this.doAuthenticate().finally(() => {
        this.authInFlight = null;
      });
    }
    return this.authInFlight;
  }

  private async doAuthenticate(): Promise<{ credentials: GeotabCredentials; server: string }> {
    const e = this.env();
    if (!e.password && e.sessionId) {
      this.session = {
        credentials: { database: e.database!, userName: e.userName!, sessionId: e.sessionId },
        server: e.server,
      };
      return this.session;
    }
    const result = await this.rpc<any>(e.server, 'Authenticate', {
      database: e.database,
      userName: e.userName,
      password: e.password,
    });
    if (!result?.credentials?.sessionId) {
      throw new TelematicsProviderError('geotab', 'Authenticate returned no session.');
    }
    const server = result.path && result.path !== 'ThisServer' ? result.path : e.server;
    this.session = { credentials: result.credentials, server };
    return this.session;
  }

  /** Calls the API with the cached session; re-authenticates once on an expired session. */
  private async call<T = any>(method: string, params: Record<string, any>): Promise<T> {
    const session = this.session || (await this.authenticate());
    try {
      return await this.rpc<T>(session.server, method, { ...params, credentials: session.credentials });
    } catch (err) {
      const name = (err as any).geotabErrorName;
      if (name === 'InvalidUserException' && this.env().password) {
        // Only drop the session if no concurrent call has already replaced it.
        if (this.session === session) this.session = null;
        const fresh = this.session || (await this.authenticate());
        return this.rpc<T>(fresh.server, method, { ...params, credentials: fresh.credentials });
      }
      throw err;
    }
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    const [devices, statuses] = await Promise.all([
      this.call<any[]>('Get', { typeName: 'Device' }),
      this.call<any[]>('Get', { typeName: 'DeviceStatusInfo' }),
    ]);
    if (!Array.isArray(devices) || !Array.isArray(statuses)) {
      throw new TelematicsProviderError('geotab', 'Unexpected Device/DeviceStatusInfo response shape.');
    }
    const statusByDevice = new Map(statuses.map((s) => [s?.device?.id, s]));
    return devices.filter((d) => d?.id).map((d) => mapGeotabVehicle(d, statusByDevice.get(d.id)));
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    const users = await this.call<any[]>('Get', { typeName: 'User', search: { isDriver: true } });
    if (!Array.isArray(users)) {
      throw new TelematicsProviderError('geotab', 'Unexpected User response shape.');
    }
    if (users.length === 0) return [];

    const retrievedAt = new Date().toISOString();
    const availability = await this.call<any[]>('ExecuteMultiCall', {
      calls: users.map((u) => ({
        method: 'Get',
        params: { typeName: 'DutyStatusAvailability', search: { userSearch: { id: u.id } } },
      })),
    });

    return users.map((u, i): NormalizedDriver => {
      const a = Array.isArray(availability?.[i]) ? availability[i][0] : null;
      return {
        id: String(u.id),
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || String(u.id),
        provider: 'geotab',
        licenseNumber: u.licenseNumber || null,
        dutyStatus: 'UNKNOWN',
        currentVehicleId: null,
        hosClocks: {
          drivingRemainingMins: timeSpanToMins(a?.driving),
          shiftRemainingMins: timeSpanToMins(a?.duty),
          cycleRemainingMins: timeSpanToMins(a?.cycle),
          breakWindowMins: timeSpanToMins(a?.drivingBreakDuration),
        },
        hosAsOf: a ? retrievedAt : null,
      };
    });
  }
}

export function mapGeotabVehicle(device: any, status: any): NormalizedVehicle {
  const kmh = num(status?.speed);
  const speedMph = kmh === null ? null : kmh * KMH_TO_MPH;
  let vStatus: NormalizedVehicle['status'] = 'UNKNOWN';
  if (status?.isDriving === true) vStatus = 'DRIVING';
  else if (status?.isDriving === false) vStatus = speedMph !== null && speedMph > 3 ? 'DRIVING' : 'PARKED';

  return {
    id: String(device.id),
    unitNumber: device.name || String(device.id),
    vin: device.vehicleIdentificationNumber || null,
    makeModel: null,
    provider: 'geotab',
    status: vStatus,
    speedMph: round(speedMph),
    engineRpm: null,
    fuelPercent: null,
    defLevelPercent: null,
    odometerMiles: null,
    engineHours: null,
    location:
      num(status?.latitude) !== null && num(status?.longitude) !== null
        ? {
            latitude: status.latitude,
            longitude: status.longitude,
            address: null,
            heading: num(status.bearing),
            updatedAt: status.dateTime || new Date().toISOString(),
          }
        : null,
    diagnostics: {
      checkEngineLight: null,
      oilPressurePsi: null,
      coolantTempF: null,
      activeDtcCount: null,
      dtcCodes: [],
    },
  };
}

/** Parses a .NET TimeSpan string ("hh:mm:ss", "d.hh:mm:ss", optional fraction / sign) into minutes. */
export function timeSpanToMins(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(-)?(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(v.trim());
  if (!m) return null;
  const [, neg, d, h, min, s] = m;
  const total = (Number(d || 0) * 1440) + Number(h) * 60 + Number(min) + Number(s) / 60;
  return neg ? 0 : Math.floor(total);
}
