import { fetchProviderJson, num, round, secToMins } from './http';
import { DutyStatus, NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

/**
 * Motive (formerly KeepTruckin) REST API adapter (read-only).
 *   Vehicles: GET /v1/vehicle_locations   (page_no / per_page pagination)
 *   HOS:      GET /v1/available_time      (remaining clocks in seconds)
 * Auth: X-Api-Key: <MOTIVE_API_KEY>
 */

const PER_PAGE = 100;
const MAX_PAGES = 50;

const DUTY_STATUS: Record<string, DutyStatus> = {
  off_duty: 'OFF_DUTY',
  sleeper: 'SLEEPER_BERTH',
  sleeper_berth: 'SLEEPER_BERTH',
  driving: 'DRIVING',
  on_duty: 'ON_DUTY',
  yard_move: 'YARD_MOVE',
  personal_conveyance: 'PERSONAL_CONVEYANCE',
};

export class MotiveAdapter implements TelematicsProviderAdapter {
  id = 'motive' as const;
  name = 'Motive';

  private get key(): string | undefined {
    const k = process.env.MOTIVE_API_KEY?.trim();
    return k ? k : undefined;
  }

  private get baseUrl(): string {
    return (process.env.MOTIVE_API_BASE || 'https://api.gomotive.com').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.key);
  }

  private async getAllPages(path: string, listKey: string): Promise<any[]> {
    const rows: any[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await fetchProviderJson<any>(
        'motive',
        `${this.baseUrl}${path}?per_page=${PER_PAGE}&page_no=${page}`,
        { headers: { 'X-Api-Key': this.key!, Accept: 'application/json' } }
      );
      const list = body?.[listKey];
      if (!Array.isArray(list)) {
        throw new Error(`Motive ${path} response missing "${listKey}" array.`);
      }
      rows.push(...list);
      const total = num(body?.pagination?.total);
      if (list.length < PER_PAGE || (total !== null && rows.length >= total)) break;
    }
    return rows;
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    const rows = await this.getAllPages('/v1/vehicle_locations', 'vehicles');
    return rows.map((r) => r?.vehicle).filter((v) => v?.id !== undefined).map(mapMotiveVehicle);
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    const retrievedAt = new Date().toISOString();
    const rows = await this.getAllPages('/v1/available_time', 'users');
    return rows
      .map((r) => r?.user)
      .filter((u) => u?.id !== undefined)
      .map((u): NormalizedDriver => {
        const avail = u.available_time || {};
        return {
          id: String(u.id),
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.id),
          provider: 'motive',
          licenseNumber: u.drivers_license_number || null,
          dutyStatus: DUTY_STATUS[u.duty_status] || 'UNKNOWN',
          currentVehicleId: u.current_vehicle?.id !== undefined ? String(u.current_vehicle.id) : null,
          hosClocks: {
            drivingRemainingMins: secToMins(avail.drive),
            shiftRemainingMins: secToMins(avail.shift),
            cycleRemainingMins: secToMins(avail.cycle),
            breakWindowMins: secToMins(avail.break),
          },
          hosAsOf: retrievedAt,
        };
      });
  }
}

export function mapMotiveVehicle(v: any): NormalizedVehicle {
  const loc = v.current_location;
  const speedMph =
    num(loc?.speed) ?? (num(loc?.kph) !== null ? (loc.kph as number) * 0.621371 : null);
  const makeModel = [v.year, v.make, v.model].filter(Boolean).join(' ') || null;
  return {
    id: String(v.id),
    unitNumber: v.number || String(v.id),
    vin: v.vin || null,
    makeModel,
    provider: 'motive',
    status: speedMph === null ? 'UNKNOWN' : speedMph > 3 ? 'DRIVING' : 'PARKED',
    speedMph: round(speedMph),
    engineRpm: null,
    fuelPercent: null,
    defLevelPercent: null,
    odometerMiles: null,
    engineHours: null,
    location:
      num(loc?.lat) !== null && num(loc?.lon) !== null
        ? {
            latitude: loc.lat,
            longitude: loc.lon,
            address: loc.description || null,
            heading: num(loc.bearing),
            updatedAt: loc.located_at || new Date().toISOString(),
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
