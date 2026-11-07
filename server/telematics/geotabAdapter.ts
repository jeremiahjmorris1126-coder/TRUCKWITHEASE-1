import {
  computeHomeTerminalDateAndDst,
  convertEngineTimeToHours,
  convertOdometerToMiles,
  eldSyncService,
  formatEldClockAttribution,
  maskLocationForDutyStatus,
  normalizeProviderDutyStatus,
  parseGeotabDurationToMs,
} from './eldSyncService';
import {
  EldClocksRecord,
  EldNormalizedLogRecord,
  EldSyncError,
  NormalizedDriver,
  NormalizedVehicle,
  TelematicsProviderAdapter,
} from './types';

export interface GeotabAdapterOptions {
  sessionId?: string;
  userName?: string;
  database?: string;
  serverUrl?: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

export class GeotabAdapter implements TelematicsProviderAdapter {
  name = 'Geotab';
  private sessionIdOverride?: string;
  private userNameOverride?: string;
  private databaseOverride?: string;
  private serverUrl: string;
  private fetchImpl: typeof fetch;
  private maxPages: number;

  constructor(options: GeotabAdapterOptions = {}) {
    this.sessionIdOverride = options.sessionId;
    this.userNameOverride = options.userName;
    this.databaseOverride = options.database;
    this.serverUrl = options.serverUrl || 'https://my.geotab.com/apiv1';
    this.fetchImpl = options.fetchImpl || fetch;
    this.maxPages = options.maxPages || 50;
  }

  private getCredentials(): { sessionId: string; userName: string; database: string } | null {
    const sessionId = (this.sessionIdOverride ?? process.env.GEOTAB_SESSION_ID ?? '').trim();
    const userName = (this.userNameOverride ?? process.env.GEOTAB_API_USER ?? '').trim();
    const database = (this.databaseOverride ?? process.env.GEOTAB_DATABASE ?? 'default').trim();
    if (!sessionId && !userName) {
      return null;
    }
    return { sessionId, userName, database };
  }

  isConfigured(): boolean {
    return this.getCredentials() !== null;
  }

  private async rpcCall(method: string, params: Record<string, any>): Promise<any> {
    const creds = this.getCredentials();
    if (!creds) {
      return { result: [] };
    }

    let res: Response;
    try {
      res = await this.fetchImpl(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          method,
          params: {
            ...params,
            credentials: creds,
          },
        }),
      });
    } catch (err) {
      throw new EldSyncError('geotab', 503, `Geotab network error: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new EldSyncError('geotab', res.status, `Geotab RPC returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as any;
    if (body?.error) {
      const errMsg = body.error.message || 'Geotab JSON-RPC error';
      const isAuthErr =
        /InvalidUserException|DbUnavailableException|SessionExpired/i.test(errMsg) ||
        body.error.code === -32000;
      throw new EldSyncError('geotab', isAuthErr ? 401 : 500, errMsg);
    }

    return body;
  }

  /**
   * Maps a Geotab Device / DeviceStatusInfo object into NormalizedVehicle without inventing defaults.
   * Official source: https://developers.geotab.com/mygeotab/apiReference/objects/DeviceStatusInfo/
   */
  mapVehicleRecord(item: any): NormalizedVehicle {
    const deviceId = String(item.device?.id || item.id || '');
    const speedKmh = typeof item.speed === 'number' ? item.speed : null;
    const speedMph = speedKmh !== null ? Number((speedKmh * 0.6213711922).toFixed(1)) : null;

    const rawOdoMeters = typeof item.odometer === 'number' ? item.odometer : null;
    const { odometerRaw, odometerMiles } = convertOdometerToMiles(rawOdoMeters, 'm');

    const rawEngineSeconds = typeof item.engineHours === 'number' ? item.engineHours : null;
    const { engineHoursRaw, engineHours } = convertEngineTimeToHours(rawEngineSeconds, 'seconds');

    return {
      id: deviceId,
      unitNumber: item.name || item.device?.name || deviceId,
      vin: item.vehicleIdentificationNumber || item.vin || '',
      makeModel: item.model || '',
      provider: 'geotab',
      status: item.isDriving || (speedMph !== null && speedMph > 3) ? 'DRIVING' : 'PARKED',
      speedMph,
      engineRpm: null,
      fuelPercent: typeof item.fuelLevel === 'number' ? item.fuelLevel : null,
      defLevelPercent: null,
      odometerMiles,
      odometerRaw,
      engineHours,
      engineHoursRaw,
      location: {
        latitude: typeof item.latitude === 'number' ? item.latitude : null,
        longitude: typeof item.longitude === 'number' ? item.longitude : null,
        address: item.address || '',
        heading: typeof item.bearing === 'number' ? item.bearing : null,
        updatedAt: item.dateTime || '',
      },
      diagnostics: {
        checkEngineLight: Boolean(item.checkEngineLight),
        oilPressurePsi: null,
        coolantTempF: null,
        activeDtcCount: Array.isArray(item.faults) ? item.faults.length : 0,
        dtcCodes: Array.isArray(item.faults) ? item.faults.map(String) : [],
      },
    };
  }

  /**
   * Maps Geotab `DutyStatusAvailability` items into provider-reported EldClocksRecord objects.
   * Official source: https://developers.geotab.com/mygeotab/apiReference/objects/DutyStatusAvailability/
   */
  mapDutyStatusAvailabilityItems(
    items: any[],
    receivedAtUtc = new Date().toISOString()
  ): Array<Omit<EldClocksRecord, 'id' | 'fleetId' | 'attributionLabel'>> {
    return items.map((item: any) => {
      const driverId = String(item.driver?.id || item.userId || '');
      const rawStatus = item.currentDutyStatus ?? item.status ?? '';
      const normalizedStatus = normalizeProviderDutyStatus('geotab', rawStatus);

      const rawDriving = item.driving ?? null;
      const rawDuty = item.duty ?? item.workday ?? null;
      const rawCycle = item.cycle ?? null;
      const rawRest = item.rest ?? item.break ?? null;

      const driveMs = parseGeotabDurationToMs(rawDriving);
      const shiftMs = parseGeotabDurationToMs(rawDuty);
      const cycleMs = parseGeotabDurationToMs(rawCycle);
      const breakMs = parseGeotabDurationToMs(rawRest);

      return {
        driverId,
        providerDriverId: driverId,
        driverName: item.driver?.name || null,
        provider: 'geotab',
        currentDutyStatus: normalizedStatus.dutyStatus,
        rawCurrentDutyStatus: normalizedStatus.rawDutyStatus,
        ruleset: item.hosRuleSet || item.driver?.hosRuleSet || null,
        homeTerminalTimeZone: item.driver?.timeZoneId || item.timeZoneId || null,
        clocks: {
          driveRemainingMs: driveMs,
          shiftRemainingMs: shiftMs,
          cycleRemainingMs: cycleMs,
          breakRemainingMs: breakMs,
          rawProviderClocks: {
            drive: rawDriving !== null ? { value: rawDriving, unit: 'timespan' } : null,
            shift: rawDuty !== null ? { value: rawDuty, unit: 'timespan' } : null,
            cycle: rawCycle !== null ? { value: rawCycle, unit: 'timespan' } : null,
            break: rawRest !== null ? { value: rawRest, unit: 'timespan' } : null,
          },
        },
        activeViolations: Array.isArray(item.availabilitiesViolations)
          ? item.availabilitiesViolations.map(String)
          : [],
        providerSyncedAtUtc: item.dateTime || receivedAtUtc,
        receivedAtUtc,
      };
    });
  }

  /**
   * Maps Geotab `DutyStatusLog` items into normalized read-only ELD log records.
   * Official source: https://developers.geotab.com/mygeotab/apiReference/objects/DutyStatusLog/
   */
  mapDutyStatusLogItems(
    items: any[],
    rawEventId: string,
    defaultHomeTz = 'UTC'
  ): Array<Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }> {
    const mapped: Array<
      Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }
    > = [];

    for (const log of items) {
      const originRaw = String(log.origin || '');
      const isUnassigned =
        originRaw === 'UnassignedDriver' ||
        log.driver?.id === 'NoDriverId' ||
        !log.driver?.id;
      const driverId = isUnassigned ? 'UNASSIGNED' : String(log.driver.id);
      const driverName = log.driver?.name || null;

      const rawStatus = log.status ?? '';
      const { dutyStatus, rawDutyStatus, flaggedForReview } = normalizeProviderDutyStatus(
        'geotab',
        rawStatus,
        isUnassigned
      );

      const startTimeUtc = log.dateTime;
      const endTimeUtc = log.endDateTime || null;
      if (!startTimeUtc) continue;

      const homeTz = log.driver?.timeZoneId || log.timeZoneId || defaultHomeTz;
      const { localDateInHomeTz, durationMs, dstTransitionInfo } =
        computeHomeTerminalDateAndDst(startTimeUtc, endTimeUtc, homeTz);

      const rawLat = log.location?.location?.y ?? log.location?.latitude ?? null;
      const rawLon = log.location?.location?.x ?? log.location?.longitude ?? null;
      const rawDesc = log.location?.name || null;
      const location = maskLocationForDutyStatus(dutyStatus, rawLat, rawLon, rawDesc);

      const rawOdoMeters = typeof log.odometer === 'number' ? log.odometer : null;
      const odoConv =
        dutyStatus === 'PERSONAL_CONVEYANCE'
          ? { odometerRaw: null, odometerMiles: null }
          : convertOdometerToMiles(rawOdoMeters, 'm');

      const rawEngineSeconds = typeof log.engineHours === 'number' ? log.engineHours : null;
      const engConv =
        dutyStatus === 'PERSONAL_CONVEYANCE'
          ? { engineHoursRaw: null, engineHours: null }
          : convertEngineTimeToHours(rawEngineSeconds, 'seconds');

      const annotations: Array<{ text: string; author?: string; createdAtUtc?: string }> = [];
      if (Array.isArray(log.annotations)) {
        for (const a of log.annotations) {
          if (a?.comment) {
            annotations.push({
              text: String(a.comment),
              author: a.driver?.id ? String(a.driver.id) : driverName || driverId,
              createdAtUtc: a.dateTime || startTimeUtc,
            });
          }
        }
      }

      const parentId = log.parentId?.id || (typeof log.parentId === 'string' ? log.parentId : null);

      mapped.push({
        provider: 'geotab',
        providerLogId: String(log.id || `${driverId}-${startTimeUtc}`),
        replacesProviderLogId: parentId ? String(parentId) : undefined,
        driverId,
        providerDriverId: driverId,
        driverName,
        vehicleId: log.device?.id ? String(log.device.id) : null,
        providerVehicleId: log.device?.id ? String(log.device.id) : null,
        coDriverIds: Array.isArray(log.coDrivers)
          ? log.coDrivers.map((c: any) => String(c.id || c))
          : [],
        carrierName: log.carrierName || null,
        carrierUsdotNumber: log.carrierNumber ? String(log.carrierNumber) : null,
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
          : parentId || originRaw === 'Manual'
          ? 'CARRIER_EDIT'
          : originRaw === 'Automatic'
          ? 'AUTOMATIC'
          : 'DRIVER',
        annotations,
        certified: Boolean(log.verifyDateTime),
        certifiedAtUtc: log.verifyDateTime || null,
        malfunctionOrDiagnosticCode:
          dutyStatus === 'MALFUNCTION' || dutyStatus === 'DIAGNOSTIC'
            ? String(log.malfunction || rawDutyStatus)
            : null,
        ruleset: log.hosRuleSet || log.driver?.hosRuleSet || null,
        rawEventId,
      });
    }

    return mapped;
  }

  private async fetchDutyStatusLogFeed(
    startVersion?: string
  ): Promise<{ items: any[]; rawPages: any[]; toVersion: string | null }> {
    if (!this.isConfigured()) {
      return { items: [], rawPages: [], toVersion: null };
    }

    const items: any[] = [];
    const rawPages: any[] = [];
    let fromVersion: string | undefined = startVersion;
    let toVersion: string | null = startVersion || null;
    let pages = 0;

    while (pages < this.maxPages) {
      const body = await this.rpcCall('GetFeed', {
        typeName: 'DutyStatusLog',
        ...(fromVersion ? { fromVersion } : {}),
      });
      rawPages.push(body);
      pages += 1;

      const feedResult = body?.result ?? {};
      const data = Array.isArray(feedResult.data)
        ? feedResult.data
        : Array.isArray(feedResult)
        ? feedResult
        : [];
      items.push(...data);

      const nextVersion = feedResult.toVersion || null;
      if (!nextVersion || nextVersion === fromVersion || data.length === 0) {
        toVersion = nextVersion || toVersion;
        break;
      }
      fromVersion = nextVersion;
      toVersion = nextVersion;
    }

    return { items, rawPages, toVersion };
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const body = await this.rpcCall('Get', { typeName: 'DeviceStatusInfo' });
    const list = Array.isArray(body?.result) ? body.result : [];
    return list.map((item: any) => this.mapVehicleRecord(item));
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
    const body = await this.rpcCall('Get', { typeName: 'DutyStatusAvailability' });
    const list = Array.isArray(body?.result) ? body.result : [];
    const mappedClocks = this.mapDutyStatusAvailabilityItems(list, receivedAtUtc);

    return mappedClocks.map((c) => ({
      id: c.driverId,
      name: c.driverName || c.driverId,
      licenseNumber: '',
      dutyStatus: c.currentDutyStatus,
      rawDutyStatus: c.rawCurrentDutyStatus,
      ruleset: c.ruleset,
      homeTerminalTimeZone: c.homeTerminalTimeZone,
      attributionLabel: formatEldClockAttribution('geotab', receivedAtUtc),
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
   * Syncs Geotab DutyStatusAvailability clocks and DutyStatusLog feed into read-only Firestore collections.
   */
  async syncFleetHosToStore(
    fleetId: string,
    options?: { fromVersion?: string; defaultHomeTz?: string }
  ): Promise<{
    clocksSaved: EldClocksRecord[];
    logsSaved: EldNormalizedLogRecord[];
    toVersion: string | null;
  }> {
    try {
      const receivedAtUtc = new Date().toISOString();
      const availBody = await this.rpcCall('Get', { typeName: 'DutyStatusAvailability' });
      await eldSyncService.appendRawEvent(
        fleetId,
        'geotab',
        'Get<DutyStatusAvailability>',
        availBody,
        receivedAtUtc
      );
      const availItems = Array.isArray(availBody?.result) ? availBody.result : [];
      const clocksRecords = this.mapDutyStatusAvailabilityItems(availItems, receivedAtUtc);
      const clocksSaved = await eldSyncService.saveProviderClocks(fleetId, clocksRecords);

      const feedRes = await this.fetchDutyStatusLogFeed(options?.fromVersion);
      let lastRawEventId = `raw-geotab-${Date.now()}`;
      for (const page of feedRes.rawPages) {
        const rawEvt = await eldSyncService.appendRawEvent(
          fleetId,
          'geotab',
          'GetFeed<DutyStatusLog>',
          page,
          receivedAtUtc
        );
        lastRawEventId = rawEvt.id;
      }

      const normalizedLogs = this.mapDutyStatusLogItems(
        feedRes.items,
        lastRawEventId,
        options?.defaultHomeTz || 'UTC'
      );
      const logsSaved = await eldSyncService.ingestNormalizedLogs(fleetId, normalizedLogs);

      await eldSyncService.recordSyncSuccess(fleetId, 'geotab', {
        ...(feedRes.toVersion ? { fromVersion: feedRes.toVersion } : {}),
      });

      return {
        clocksSaved,
        logsSaved,
        toVersion: feedRes.toVersion,
      };
    } catch (err) {
      await eldSyncService.recordSyncFailure(fleetId, 'geotab', err);
      throw err;
    }
  }
}
