import {
  computeHomeTerminalDateAndDst,
  convertEngineTimeToHours,
  convertOdometerToMiles,
  eldSyncService,
  formatEldClockAttribution,
  maskLocationForDutyStatus,
  normalizeProviderDutyStatus,
} from './eldSyncService';
import {
  EldClocksRecord,
  EldNormalizedLogRecord,
  EldSyncError,
  NormalizedDriver,
  NormalizedVehicle,
  TelematicsProviderAdapter,
} from './types';

export interface MotiveAdapterOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

function parseRetryAfterMs(res: Response): number | null {
  const header = res.headers?.get?.('retry-after') || res.headers?.get?.('Retry-After');
  if (!header) return null;
  const secs = Number(header);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

export class MotiveAdapter implements TelematicsProviderAdapter {
  name = 'Motive';
  private apiKeyOverride?: string;
  private fetchImpl: typeof fetch;
  private maxPages: number;

  constructor(options: MotiveAdapterOptions = {}) {
    this.apiKeyOverride = options.apiKey;
    this.fetchImpl = options.fetchImpl || fetch;
    this.maxPages = options.maxPages || 50;
  }

  private getApiKey(): string {
    return (this.apiKeyOverride ?? process.env.MOTIVE_API_KEY ?? '').trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  private async fetchPaginatedMotive(
    baseUrl: string,
    arrayKey: 'vehicles' | 'users' | 'hos_logs',
    startPage = 1
  ): Promise<{ items: any[]; rawPages: any[]; lastPage: number }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { items: [], rawPages: [], lastPage: startPage };
    }

    const items: any[] = [];
    const rawPages: any[] = [];
    let pageNo = startPage;
    let pagesFetched = 0;

    while (pagesFetched < this.maxPages) {
      const url = new URL(baseUrl);
      url.searchParams.set('page_no', String(pageNo));
      if (!url.searchParams.has('per_page')) {
        url.searchParams.set('per_page', '100');
      }

      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), {
          headers: {
            'X-Api-Key': apiKey,
            Accept: 'application/json',
          },
        });
      } catch (err) {
        throw new EldSyncError(
          'motive',
          503,
          `Motive network error: ${(err as Error).message}`
        );
      }

      if (!res.ok) {
        throw new EldSyncError(
          'motive',
          res.status,
          `Motive API status ${res.status}`,
          parseRetryAfterMs(res)
        );
      }

      const body = (await res.json()) as any;
      rawPages.push(body);
      pagesFetched += 1;

      const pageItems = Array.isArray(body?.[arrayKey]) ? body[arrayKey] : [];
      items.push(...pageItems);

      const pagination = body?.pagination;
      if (!pagination || typeof pagination.total !== 'number' || typeof pagination.per_page !== 'number') {
        break;
      }

      const currentPage = typeof pagination.page_no === 'number' ? pagination.page_no : pageNo;
      if (currentPage * pagination.per_page >= pagination.total || pageItems.length === 0) {
        pageNo = currentPage;
        break;
      }
      pageNo = currentPage + 1;
    }

    return { items, rawPages, lastPage: pageNo };
  }

  /**
   * Maps a Motive vehicle object (`GET /v1/vehicles`) without inventing defaults.
   * Official source: https://developer.gomotive.com/reference/get-v1-vehicles
   */
  mapVehicleRecord(wrapper: any): NormalizedVehicle {
    const v = wrapper?.vehicle ?? wrapper ?? {};
    const loc = v.current_location ?? {};
    const speedMph = typeof loc.speed === 'number' ? loc.speed : null;

    const odoUnit: 'mi' | 'km' = v.metric_units === true || loc.metric_units === true ? 'km' : 'mi';
    const rawOdo = typeof loc.odometer === 'number' ? loc.odometer : null;
    const { odometerRaw, odometerMiles } = convertOdometerToMiles(rawOdo, odoUnit);

    const rawEngineHours = typeof loc.engine_hours === 'number' ? loc.engine_hours : null;
    const { engineHoursRaw, engineHours } = convertEngineTimeToHours(rawEngineHours, 'hours');

    return {
      id: String(v.id || ''),
      unitNumber: v.number || String(v.id || ''),
      vin: v.vin || '',
      makeModel: [v.year, v.make, v.model].filter(Boolean).join(' ').trim(),
      provider: 'motive',
      status: speedMph !== null && speedMph > 3 ? 'DRIVING' : 'PARKED',
      speedMph,
      engineRpm: null,
      fuelPercent:
        typeof v.fuel_primary_remaining_percentage === 'number'
          ? v.fuel_primary_remaining_percentage
          : null,
      defLevelPercent: null,
      odometerMiles,
      odometerRaw,
      engineHours,
      engineHoursRaw,
      location: {
        latitude: typeof loc.lat === 'number' ? loc.lat : null,
        longitude: typeof loc.lon === 'number' ? loc.lon : null,
        address: loc.description || '',
        heading: typeof loc.bearing === 'number' ? loc.bearing : null,
        updatedAt: loc.located_at || '',
      },
      diagnostics: {
        checkEngineLight: false,
        oilPressurePsi: null,
        coolantTempF: null,
        activeDtcCount: 0,
        dtcCodes: [],
      },
    };
  }

  /**
   * Maps Motive `GET /v1/available_time` items into provider-reported EldClocksRecord objects.
   * Official source: https://developer.gomotive.com/reference/get-v1-available_time
   * Motive returns `available_time.drive`, `shift`, `cycle`, `break` in seconds.
   */
  mapAvailableTimeItems(
    items: any[],
    receivedAtUtc = new Date().toISOString()
  ): Array<Omit<EldClocksRecord, 'id' | 'fleetId' | 'attributionLabel'>> {
    return items.map((wrapper: any) => {
      const u = wrapper?.user ?? wrapper ?? {};
      const avail = u.available_time ?? wrapper?.available_time ?? {};
      const rawStatus = u.duty_status ?? avail.duty_status ?? '';
      const normalizedStatus = normalizeProviderDutyStatus('motive', rawStatus);

      const driveSec = typeof avail.drive === 'number' ? avail.drive : null;
      const shiftSec = typeof avail.shift === 'number' ? avail.shift : null;
      const cycleSec = typeof avail.cycle === 'number' ? avail.cycle : null;
      const breakSec = typeof avail.break === 'number' ? avail.break : null;

      const driverId = String(u.id || '');
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || null;

      return {
        driverId,
        providerDriverId: driverId,
        driverName: fullName,
        provider: 'motive',
        currentDutyStatus: normalizedStatus.dutyStatus,
        rawCurrentDutyStatus: normalizedStatus.rawDutyStatus,
        ruleset: u.hos_ruleset || avail.hos_ruleset || null,
        homeTerminalTimeZone: u.time_zone || null,
        clocks: {
          driveRemainingMs: driveSec !== null ? driveSec * 1000 : null,
          shiftRemainingMs: shiftSec !== null ? shiftSec * 1000 : null,
          cycleRemainingMs: cycleSec !== null ? cycleSec * 1000 : null,
          breakRemainingMs: breakSec !== null ? breakSec * 1000 : null,
          rawProviderClocks: {
            drive: driveSec !== null ? { value: driveSec, unit: 's' } : null,
            shift: shiftSec !== null ? { value: shiftSec, unit: 's' } : null,
            cycle: cycleSec !== null ? { value: cycleSec, unit: 's' } : null,
            break: breakSec !== null ? { value: breakSec, unit: 's' } : null,
          },
        },
        activeViolations: Array.isArray(u.hos_violations) ? u.hos_violations.map(String) : [],
        providerSyncedAtUtc: avail.updated_at || receivedAtUtc,
        receivedAtUtc,
      };
    });
  }

  /**
   * Maps Motive `GET /v1/hos_logs` items into normalized read-only ELD log records.
   * Official source: https://developer.gomotive.com/reference/get-v1-hos_logs
   */
  mapHosLogsItems(
    items: any[],
    rawEventId: string,
    defaultHomeTz = 'UTC'
  ): Array<Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }> {
    const mapped: Array<
      Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }
    > = [];

    for (const wrapper of items) {
      const log = wrapper?.hos_log ?? wrapper ?? {};
      const driverObj = log.driver ?? wrapper?.driver ?? {};
      const isUnassigned = !driverObj.id && !log.driver_id;
      const driverId = String(driverObj.id || log.driver_id || 'UNASSIGNED');
      const driverName =
        [driverObj.first_name, driverObj.last_name].filter(Boolean).join(' ').trim() ||
        driverObj.name ||
        null;

      const rawStatus = log.status ?? log.duty_status ?? '';
      const { dutyStatus, rawDutyStatus, flaggedForReview } = normalizeProviderDutyStatus(
        'motive',
        rawStatus,
        isUnassigned
      );

      const startTimeUtc = log.start_time || log.startTime;
      const endTimeUtc = log.end_time || log.endTime || null;
      if (!startTimeUtc) continue;

      const homeTz = log.time_zone || driverObj.time_zone || defaultHomeTz;
      const { localDateInHomeTz, durationMs, dstTransitionInfo } =
        computeHomeTerminalDateAndDst(startTimeUtc, endTimeUtc, homeTz);

      const rawLat = typeof log.lat === 'number' ? log.lat : log.location?.lat;
      const rawLon = typeof log.lon === 'number' ? log.lon : log.location?.lon;
      const rawDesc = log.loc_name || log.location?.description || null;
      const location = maskLocationForDutyStatus(dutyStatus, rawLat, rawLon, rawDesc);

      const odoUnit: 'mi' | 'km' = log.metric_units === true ? 'km' : 'mi';
      const rawOdo =
        typeof log.odometer === 'number'
          ? log.odometer
          : typeof log.start_odometer === 'number'
          ? log.start_odometer
          : null;
      const odoConv =
        dutyStatus === 'PERSONAL_CONVEYANCE'
          ? { odometerRaw: null, odometerMiles: null }
          : convertOdometerToMiles(rawOdo, odoUnit);

      const rawEngHours =
        typeof log.engine_hours === 'number' ? log.engine_hours : null;
      const engConv =
        dutyStatus === 'PERSONAL_CONVEYANCE'
          ? { engineHoursRaw: null, engineHours: null }
          : convertEngineTimeToHours(rawEngHours, 'hours');

      const providerLogId = String(log.id || `${driverId}-${startTimeUtc}`);
      const annotations: Array<{ text: string; author?: string; createdAtUtc?: string }> = [];
      if (log.annotation || log.remark || log.notes) {
        annotations.push({
          text: String(log.annotation || log.remark || log.notes),
          author: driverName || driverId,
          createdAtUtc: log.updated_at || startTimeUtc,
        });
      }
      if (Array.isArray(log.annotations)) {
        for (const a of log.annotations) {
          if (a?.text || a?.comment) {
            annotations.push({
              text: String(a.text || a.comment),
              author: a.author || driverName || driverId,
              createdAtUtc: a.created_at || startTimeUtc,
            });
          }
        }
      }

      mapped.push({
        provider: 'motive',
        providerLogId,
        replacesProviderLogId: log.replaces_id ? String(log.replaces_id) : undefined,
        driverId,
        providerDriverId: driverId,
        driverName,
        vehicleId: log.vehicle_id || log.vehicle?.id ? String(log.vehicle_id || log.vehicle.id) : null,
        providerVehicleId: log.vehicle_id || log.vehicle?.id ? String(log.vehicle_id || log.vehicle.id) : null,
        coDriverIds: Array.isArray(log.co_driver_ids) ? log.co_driver_ids.map(String) : [],
        carrierName: log.carrier_name || null,
        carrierUsdotNumber: log.carrier_dot_number ? String(log.carrier_dot_number) : null,
        dutyStatus,
        rawDutyStatus,
        flaggedForReview,
        startTimeUtc,
        endTimeUtc,
        durationMs,
        homeTerminalTimeZone: homeTz,
        localDateInHomeTz,
        dstTransitionInfo,
        location,
        odometerRaw: odoConv.odometerRaw,
        odometerMiles: odoConv.odometerMiles,
        engineHoursRaw: engConv.engineHoursRaw,
        engineHours: engConv.engineHours,
        origin: isUnassigned
          ? 'UNASSIGNED'
          : log.edited
          ? 'CARRIER_EDIT'
          : log.origin === 'automatic'
          ? 'AUTOMATIC'
          : 'DRIVER',
        annotations,
        certified: Boolean(log.certified || log.driver_signature_url || log.certified_at),
        certifiedAtUtc: log.certified_at || null,
        malfunctionOrDiagnosticCode: log.malfunction_code || log.diagnostic_code || null,
        ruleset: log.hos_ruleset || driverObj.hos_ruleset || null,
        rawEventId,
      });
    }

    return mapped;
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const { items } = await this.fetchPaginatedMotive(
      'https://api.keeptruckin.com/v1/vehicles',
      'vehicles'
    );
    return items.map((v) => this.mapVehicleRecord(v));
  }

  async getVehicleById(id: string): Promise<NormalizedVehicle | null> {
    const list = await this.getFleetVehicles();
    return list.find((v) => v.id === id || v.unitNumber === id) || null;
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const receivedAtUtc = new Date().toISOString();
    const { items } = await this.fetchPaginatedMotive(
      'https://api.keeptruckin.com/v1/available_time',
      'users'
    );
    const mappedClocks = this.mapAvailableTimeItems(items, receivedAtUtc);

    return mappedClocks.map((c) => ({
      id: c.driverId,
      name: c.driverName || c.driverId,
      licenseNumber: '',
      dutyStatus: c.currentDutyStatus,
      rawDutyStatus: c.rawCurrentDutyStatus,
      ruleset: c.ruleset,
      homeTerminalTimeZone: c.homeTerminalTimeZone,
      attributionLabel: formatEldClockAttribution('motive', receivedAtUtc),
      hosClocks: {
        drivingRemainingMins:
          c.clocks.driveRemainingMs !== null ? Math.floor(c.clocks.driveRemainingMs / 60000) : null,
        shiftRemainingMins:
          c.clocks.shiftRemainingMs !== null ? Math.floor(c.clocks.shiftRemainingMs / 60000) : null,
        cycleRemainingMins:
          c.clocks.cycleRemainingMs !== null ? Math.floor(c.clocks.cycleRemainingMs / 60000) : null,
        breakWindowMins:
          c.clocks.breakRemainingMs !== null ? Math.floor(c.clocks.breakRemainingMs / 60000) : null,
        driveRemainingMs: c.clocks.driveRemainingMs,
        shiftRemainingMs: c.clocks.shiftRemainingMs,
        cycleRemainingMs: c.clocks.cycleRemainingMs,
        breakRemainingMs: c.clocks.breakRemainingMs,
      },
    }));
  }

  /**
   * Syncs Motive available_time clocks and hos_logs into read-only Firestore collections for a fleet.
   */
  async syncFleetHosToStore(
    fleetId: string,
    options?: { startPage?: number; defaultHomeTz?: string }
  ): Promise<{
    clocksSaved: EldClocksRecord[];
    logsSaved: EldNormalizedLogRecord[];
    lastLogsPage: number;
  }> {
    try {
      const receivedAtUtc = new Date().toISOString();
      const clocksRes = await this.fetchPaginatedMotive(
        'https://api.keeptruckin.com/v1/available_time',
        'users',
        1
      );
      for (const page of clocksRes.rawPages) {
        await eldSyncService.appendRawEvent(
          fleetId,
          'motive',
          '/v1/available_time',
          page,
          receivedAtUtc
        );
      }
      const clocksRecords = this.mapAvailableTimeItems(clocksRes.items, receivedAtUtc);
      const clocksSaved = await eldSyncService.saveProviderClocks(fleetId, clocksRecords);

      const logsRes = await this.fetchPaginatedMotive(
        'https://api.keeptruckin.com/v1/hos_logs',
        'hos_logs',
        options?.startPage || 1
      );
      let lastRawEventId = `raw-motive-${Date.now()}`;
      for (const page of logsRes.rawPages) {
        const rawEvt = await eldSyncService.appendRawEvent(
          fleetId,
          'motive',
          '/v1/hos_logs',
          page,
          receivedAtUtc
        );
        lastRawEventId = rawEvt.id;
      }
      const normalizedLogs = this.mapHosLogsItems(
        logsRes.items,
        lastRawEventId,
        options?.defaultHomeTz || 'UTC'
      );
      const logsSaved = await eldSyncService.ingestNormalizedLogs(fleetId, normalizedLogs);

      await eldSyncService.recordSyncSuccess(fleetId, 'motive', {
        lastLogsPage: logsRes.lastPage,
      });

      return {
        clocksSaved,
        logsSaved,
        lastLogsPage: logsRes.lastPage,
      };
    } catch (err) {
      await eldSyncService.recordSyncFailure(fleetId, 'motive', err);
      throw err;
    }
  }
}
