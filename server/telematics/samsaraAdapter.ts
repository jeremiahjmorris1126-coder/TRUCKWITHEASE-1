import { fetchProviderJson, msToMins, num, round } from './http';
import { DutyStatus, NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

/**
 * Samsara REST API adapter (read-only).
 *   Vehicles: GET /fleet/vehicles/stats?types=...   (cursor-paginated)
 *   HOS:      GET /fleet/hos/clocks                 (cursor-paginated)
 * Auth: Authorization: Bearer <SAMSARA_API_TOKEN>
 * Token scopes needed: "Read Vehicle Statistics" and "Read ELD Hours of Service".
 */

// Samsara limits how many stat types one request may ask for, so they are split into groups.
const STAT_TYPE_GROUPS = [
  ['gps', 'engineStates', 'engineRpm'],
  ['fuelPercents', 'defLevelMilliPercent', 'obdOdometerMeters'],
  ['obdEngineSeconds', 'engineCoolantTemperatureMilliC', 'engineOilPressureKPa'],
  ['faultCodes'],
];

const MAX_PAGES = 50;

const HOS_STATUS: Record<string, DutyStatus> = {
  offDuty: 'OFF_DUTY',
  sleeperBed: 'SLEEPER_BERTH',
  driving: 'DRIVING',
  onDuty: 'ON_DUTY',
  yardMove: 'YARD_MOVE',
  personalConveyance: 'PERSONAL_CONVEYANCE',
};

export class SamsaraAdapter implements TelematicsProviderAdapter {
  id = 'samsara' as const;
  name = 'Samsara';

  private get token(): string | undefined {
    const t = process.env.SAMSARA_API_TOKEN?.trim();
    return t ? t : undefined;
  }

  private get baseUrl(): string {
    return (process.env.SAMSARA_API_BASE || 'https://api.samsara.com').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  private async getAllPages(path: string, params: Record<string, string> = {}): Promise<any[]> {
    const rows: any[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams({ ...params, ...(after ? { after } : {}) });
      const body = await fetchProviderJson<any>('samsara', `${this.baseUrl}${path}?${qs}`, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
      });
      if (!Array.isArray(body?.data)) {
        throw new Error(`Samsara ${path} response missing "data" array.`);
      }
      rows.push(...body.data);
      if (!body.pagination?.hasNextPage || !body.pagination?.endCursor) break;
      after = body.pagination.endCursor;
    }
    return rows;
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    const merged = new Map<string, any>();
    for (const types of STAT_TYPE_GROUPS) {
      const rows = await this.getAllPages('/fleet/vehicles/stats', { types: types.join(',') });
      for (const row of rows) {
        if (!row?.id) continue;
        merged.set(row.id, { ...(merged.get(row.id) || {}), ...row });
      }
    }
    return [...merged.values()].map(mapSamsaraVehicle);
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    const retrievedAt = new Date().toISOString();
    const rows = await this.getAllPages('/fleet/hos/clocks');
    return rows
      .filter((r) => r?.driver?.id)
      .map((r): NormalizedDriver => ({
        id: String(r.driver.id),
        name: r.driver.name || String(r.driver.id),
        provider: 'samsara',
        licenseNumber: null,
        dutyStatus: HOS_STATUS[r.currentDutyStatus?.hosStatusType] || 'UNKNOWN',
        currentVehicleId: r.currentVehicle?.id ? String(r.currentVehicle.id) : null,
        hosClocks: {
          drivingRemainingMins: msToMins(r.clocks?.drive?.driveRemainingDurationMs),
          shiftRemainingMins: msToMins(r.clocks?.shift?.shiftRemainingDurationMs),
          cycleRemainingMins: msToMins(r.clocks?.cycle?.cycleRemainingDurationMs),
          breakWindowMins: msToMins(r.clocks?.break?.timeUntilBreakDurationMs),
        },
        hosAsOf: retrievedAt,
      }));
  }
}

export function mapSamsaraVehicle(item: any): NormalizedVehicle {
  const gps = item.gps;
  const speed = num(gps?.speedMilesPerHour);
  const engineState: string | undefined = item.engineStates?.value ?? item.engineState?.value;
  let status: NormalizedVehicle['status'] = 'UNKNOWN';
  if (engineState === 'Off') status = 'PARKED';
  else if (speed !== null && speed > 3) status = 'DRIVING';
  else if (engineState === 'Idle' || engineState === 'On') status = 'IDLE';

  const coolantMilliC = num(item.engineCoolantTemperatureMilliC?.value);
  const oilKpa = num(item.engineOilPressureKPa?.value);
  const odoMeters = num(item.obdOdometerMeters?.value);
  const engineSec = num(item.obdEngineSeconds?.value);
  const defMilli = num(item.defLevelMilliPercent?.value);

  const { checkEngineLight, codes } = parseSamsaraFaults(item.faultCodes);

  return {
    id: String(item.id),
    unitNumber: item.name || String(item.id),
    vin: item.externalIds?.['samsara.vin'] || item.vin || null,
    makeModel: null,
    provider: 'samsara',
    status,
    speedMph: round(speed),
    engineRpm: num(item.engineRpm?.value),
    fuelPercent: num(item.fuelPercents?.value ?? item.fuelPercent?.value),
    defLevelPercent: defMilli === null ? null : round(defMilli / 1000),
    odometerMiles: odoMeters === null ? null : Math.round(odoMeters / 1609.344),
    engineHours: engineSec === null ? null : Math.round(engineSec / 3600),
    location:
      num(gps?.latitude) !== null && num(gps?.longitude) !== null
        ? {
            latitude: gps.latitude,
            longitude: gps.longitude,
            address: gps.reverseGeo?.formattedLocation || null,
            heading: num(gps.headingDegrees),
            updatedAt: gps.time || new Date().toISOString(),
          }
        : null,
    diagnostics: {
      checkEngineLight,
      oilPressurePsi: oilKpa === null ? null : round(oilKpa * 0.145038),
      coolantTempF: coolantMilliC === null ? null : Math.round((coolantMilliC / 1000) * 9 / 5 + 32),
      activeDtcCount: item.faultCodes ? codes.length : null,
      dtcCodes: codes,
    },
  };
}

/** Fault codes arrive grouped by protocol (obdii / heavy-duty); read every group generically. */
function parseSamsaraFaults(faultCodes: any): { checkEngineLight: boolean | null; codes: string[] } {
  if (!faultCodes || typeof faultCodes !== 'object') return { checkEngineLight: null, codes: [] };
  let cel: boolean | null = null;
  const codes: string[] = [];
  for (const group of Object.values(faultCodes)) {
    if (!group || typeof group !== 'object') continue;
    const g = group as any;
    if (typeof g.checkEngineLightIsOn === 'boolean') cel = Boolean(cel) || g.checkEngineLightIsOn;
    if (g.checkEngineLights && typeof g.checkEngineLights === 'object') {
      cel = Boolean(cel) || Object.values(g.checkEngineLights).some((v) => v === true);
    }
    for (const dtc of Array.isArray(g.diagnosticTroubleCodes) ? g.diagnosticTroubleCodes : []) {
      if (dtc.spnId !== undefined) {
        codes.push(`SPN ${dtc.spnId} FMI ${dtc.fmiId ?? '?'}${dtc.spnDescription ? ` (${dtc.spnDescription})` : ''}`);
      } else if (dtc.dtcShortCode || dtc.dtcId !== undefined) {
        codes.push(`${dtc.dtcShortCode || dtc.dtcId}${dtc.dtcDescription ? ` (${dtc.dtcDescription})` : ''}`);
      }
    }
  }
  return { checkEngineLight: cel, codes };
}
