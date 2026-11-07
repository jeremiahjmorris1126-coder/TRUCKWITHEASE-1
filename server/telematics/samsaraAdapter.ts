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

export interface SamsaraAdapterOptions {
  apiToken?: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

function parseRetryAfterMs(res: Response): number | null {
  const header = res.headers?.get?.('retry-after') || res.headers?.get?.('Retry-After');
  if (!header) return null;
  const secs = Number(header);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

export class SamsaraAdapter implements TelematicsProviderAdapter {
  name = 'Samsara';
  private apiTokenOverride?: string;
  private fetchImpl: typeof fetch;
  private maxPages: number;

  constructor(options: SamsaraAdapterOptions = {}) {
    this.apiTokenOverride = options.apiToken;
    this.fetchImpl = options.fetchImpl || fetch;
    this.maxPages = options.maxPages || 50;
  }

  private getToken(): string {
    return (this.apiTokenOverride ?? process.env.SAMSARA_API_TOKEN ?? '').trim();
  }

  isConfigured(): boolean {
    return this.getToken().length > 0;
  }

  private async fetchPaginatedSamsara(
    baseUrl: string,
    startCursor?: string
  ): Promise<{ items: any[]; rawPages: any[]; lastCursor: string | null }> {
    const token = this.getToken();
    if (!token) {
      return { items: [], rawPages: [], lastCursor: null };
    }

    const items: any[] = [];
    const rawPages: any[] = [];
    let after: string | null = startCursor || null;
    let pages = 0;

    while (pages < this.maxPages) {
      const url = new URL(baseUrl);
      if (after) {
        url.searchParams.set('after', after);
      }

      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
      } catch (err) {
        throw new EldSyncError(
          'samsara',
          503,
          `Samsara network error: ${(err as Error).message}`
        );
      }

      if (!res.ok) {
        throw new EldSyncError(
          'samsara',
          res.status,
          `Samsara API returned status ${res.status}`,
          parseRetryAfterMs(res)
        );
      }

      const body = (await res.json()) as any;
      rawPages.push(body);
      pages += 1;

      if (Array.isArray(body?.data)) {
        items.push(...body.data);
      }

      const endCursor = body?.pagination?.endCursor || null;
      const hasNextPage = Boolean(body?.pagination?.hasNextPage && endCursor);
      if (endCursor) {
        after = endCursor;
      }
      if (!hasNextPage) {
        break;
      }
    }

    return { items, rawPages, lastCursor: after };
  }

  /**
   * Maps a single Samsara vehicle stats object (`GET /fleet/vehicles/stats`) without inventing defaults.
   * Official source: https://developers.samsara.com/reference/getvehiclestats
   */
  mapVehicleRecord(item: any): NormalizedVehicle {
    const speedMph =
      typeof item.gps?.speedMilesPerHour === 'number' ? item.gps.speedMilesPerHour : null;
    const rawOdoMeters =
      typeof item.obdOdometerMeters?.value === 'number' ? item.obdOdometerMeters.value : null;
    const { odometerRaw, odometerMiles } = convertOdometerToMiles(rawOdoMeters, 'm');

    const rawEngineSeconds =
      typeof item.obdEngineSeconds?.value === 'number' ? item.obdEngineSeconds.value : null;
    const { engineHoursRaw, engineHours } = convertEngineTimeToHours(rawEngineSeconds, 'seconds');

    const oilPressureKpa =
      typeof item.engineOilPressureKPa?.value === 'number'
        ? item.engineOilPressureKPa.value
        : null;
    const oilPressurePsi =
      oilPressureKpa !== null ? Number((oilPressureKpa * 0.1450377).toFixed(1)) : null;

    const coolantMilliC =
      typeof item.engineCoolantTemperatureMilliC?.value === 'number'
        ? item.engineCoolantTemperatureMilliC.value
        : null;
    const coolantTempF =
      coolantMilliC !== null
        ? Number(((coolantMilliC / 1000) * 1.8 + 32).toFixed(1))
        : null;

    return {
      id: String(item.id || ''),
      unitNumber: item.name || String(item.id || ''),
      vin: item.vin || '',
      makeModel: item.model || '',
      provider: 'samsara',
      status: speedMph !== null && speedMph > 3 ? 'DRIVING' : 'PARKED',
      speedMph,
      engineRpm: typeof item.engineRpm?.value === 'number' ? item.engineRpm.value : null,
      fuelPercent: typeof item.fuelPercent?.value === 'number' ? item.fuelPercent.value : null,
      defLevelPercent:
        typeof item.defLevelMilliPercent?.value === 'number'
          ? item.defLevelMilliPercent.value / 1000
          : null,
      odometerMiles,
      odometerRaw,
      engineHours,
      engineHoursRaw,
      location: {
        latitude: typeof item.gps?.latitude === 'number' ? item.gps.latitude : null,
        longitude: typeof item.gps?.longitude === 'number' ? item.gps.longitude : null,
        address: item.gps?.reverseGeo?.formattedLocation || '',
        heading: typeof item.gps?.headingDegrees === 'number' ? item.gps.headingDegrees : null,
        updatedAt: item.gps?.time || '',
      },
      diagnostics: {
        checkEngineLight: Boolean(item.checkEngineLightIsOn),
        oilPressurePsi,
        coolantTempF,
        activeDtcCount: Array.isArray(item.faultCodes) ? item.faultCodes.length : 0,
        dtcCodes: Array.isArray(item.faultCodes) ? item.faultCodes.map(String) : [],
      },
    };
  }

  /**
   * Maps Samsara `GET /fleet/hos/clocks` items to provider-reported EldClocksRecord objects.
   * Official source: https://developers.samsara.com/reference/gethosclocks
   */
  mapHosClocksItems(
    items: any[],
    receivedAtUtc = new Date().toISOString()
  ): Array<Omit<EldClocksRecord, 'id' | 'fleetId' | 'attributionLabel'>> {
    return items.map((entry: any) => {
      const rawStatus = entry.currentDutyStatus?.hosStatusType ?? '';
      const normalizedStatus = normalizeProviderDutyStatus('samsara', rawStatus);

      const driveMs =
        typeof entry.clocks?.drive?.driveRemainingDurationMs === 'number'
          ? entry.clocks.drive.driveRemainingDurationMs
          : null;
      const shiftMs =
        typeof entry.clocks?.shift?.shiftRemainingDurationMs === 'number'
          ? entry.clocks.shift.shiftRemainingDurationMs
          : null;
      const cycleMs =
        typeof entry.clocks?.cycle?.cycleRemainingDurationMs === 'number'
          ? entry.clocks.cycle.cycleRemainingDurationMs
          : null;
      const breakMs =
        typeof entry.clocks?.break?.timeUntilBreakDurationMs === 'number'
          ? entry.clocks.break.timeUntilBreakDurationMs
          : null;

      const violations: string[] = [];
      if (
        typeof entry.violations?.Append?.shiftDrivingViolationDurationMs === 'number' &&
        entry.violations.Append.shiftDrivingViolationDurationMs > 0
      ) {
        violations.push('SHIFT_DRIVING_VIOLATION');
      }
      if (
        typeof entry.violations?.cycleViolationDurationMs === 'number' &&
        entry.violations.cycleViolationDurationMs > 0
      ) {
        violations.push('CYCLE_VIOLATION');
      }

      const driverId = String(entry.driver?.id || '');
      return {
        driverId,
        providerDriverId: driverId,
        driverName: entry.driver?.name || null,
        provider: 'samsara',
        currentDutyStatus: normalizedStatus.dutyStatus,
        rawCurrentDutyStatus: normalizedStatus.rawDutyStatus,
        ruleset: entry.eldSettings?.rulesets?.[0]?.cycle || entry.ruleset || null,
        homeTerminalTimeZone: entry.driver?.timezone || entry.timezone || null,
        clocks: {
          driveRemainingMs: driveMs,
          shiftRemainingMs: shiftMs,
          cycleRemainingMs: cycleMs,
          breakRemainingMs: breakMs,
          rawProviderClocks: {
            drive: driveMs !== null ? { value: driveMs, unit: 'ms' } : null,
            shift: shiftMs !== null ? { value: shiftMs, unit: 'ms' } : null,
            cycle: cycleMs !== null ? { value: cycleMs, unit: 'ms' } : null,
            break: breakMs !== null ? { value: breakMs, unit: 'ms' } : null,
          },
        },
        activeViolations: violations,
        providerSyncedAtUtc: entry.clocks?. calculatedAtTime || receivedAtUtc,
        receivedAtUtc,
      };
    });
  }

  /**
   * Maps Samsara `GET /fleet/hos/logs` items into normalized read-only ELD log records.
   * Official source: https://developers.samsara.com/reference/gethoslogs
   */
  mapHosLogsItems(
    items: any[],
    rawEventId: string,
    defaultHomeTz = 'UTC'
  ): Array<Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }> {
    const mapped: Array<
      Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }
    > = [];

    for (const entry of items) {
      const driverId = String(entry.driver?.id || 'UNASSIGNED');
      const driverName = entry.driver?.name || null;
      const homeTz = entry.driver?.timezone || entry.timezone || defaultHomeTz;
      const ruleset = entry.eldSettings?.rulesets?.[0]?.cycle || entry.ruleset || null;
      const carrierName = entry.carrier?.name || null;
      const carrierUsdotNumber = entry.carrier?.dotNumber ? String(entry.carrier.dotNumber) : null;

      const hosLogs = Array.isArray(entry.hosLogs) ? entry.hosLogs : [entry];

      for (const log of hosLogs) {
        const isUnassigned = !entry.driver?.id && !log.driver?.id;
        const rawStatus = log.hosStatusType ?? log.status ?? '';
        const { dutyStatus, rawDutyStatus, flaggedForReview } = normalizeProviderDutyStatus(
          'samsara',
          rawStatus,
          isUnassigned
        );

        const startTimeUtc = log.logStartTime || log.startTime;
        const endTimeUtc = log.logEndTime || log.endTime || null;
        if (!startTimeUtc) continue;

        const { localDateInHomeTz, durationMs, dstTransitionInfo } =
          computeHomeTerminalDateAndDst(startTimeUtc, endTimeUtc, homeTz);

        const rawLat = log.logRecordedLocation?.latitude;
        const rawLon = log.logRecordedLocation?.longitude;
        const rawDesc = log.logRecordedLocation?.formattedLocation || null;
        const location = maskLocationForDutyStatus(dutyStatus, rawLat, rawLon, rawDesc);

        const rawOdoMeters =
          typeof log.obdOdometerMeters === 'number'
            ? log.obdOdometerMeters
            : typeof log.distanceTraveledMeters === 'number'
            ? log.distanceTraveledMeters
            : null;
        const odoConv =
          dutyStatus === 'PERSONAL_CONVEYANCE'
            ? { odometerRaw: null, odometerMiles: null }
            : convertOdometerToMiles(rawOdoMeters, 'm');

        const rawEngSecs =
          typeof log.obdEngineSeconds === 'number' ? log.obdEngineSeconds : null;
        const engConv =
          dutyStatus === 'PERSONAL_CONVEYANCE'
            ? { engineHoursRaw: null, engineHours: null }
            : convertEngineTimeToHours(rawEngSecs, 'seconds');

        const providerLogId = String(
          log.id || `${driverId}-${startTimeUtc}`
        );

        const coDriverIds = Array.isArray(log.codrivers)
          ? log.codrivers.map((c: any) => String(c.id))
          : [];

        const annotations = log.remark
          ? [{ text: String(log.remark), author: driverName || driverId, createdAtUtc: startTimeUtc }]
          : [];

        mapped.push({
          provider: 'samsara',
          providerLogId,
          replacesProviderLogId: log.replacesLogId ? String(log.replacesLogId) : undefined,
          driverId: String(log.driver?.id || driverId),
          providerDriverId: String(log.driver?.id || driverId),
          driverName: log.driver?.name || driverName,
          vehicleId: log.vehicle?.id ? String(log.vehicle.id) : null,
          providerVehicleId: log.vehicle?.id ? String(log.vehicle.id) : null,
          coDriverIds,
          carrierName,
          carrierUsdotNumber,
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
            : log.origin === 'carrierEdit'
            ? 'CARRIER_EDIT'
            : log.origin === 'automatic'
            ? 'AUTOMATIC'
            : 'DRIVER',
          annotations,
          certified: Boolean(log.isCertified ?? entry.logMetaData?.isCertified),
          certifiedAtUtc: log.certifiedAtTime || entry.logMetaData?.certifiedAtTime || null,
          malfunctionOrDiagnosticCode: log.malfunctionCode || null,
          ruleset,
          rawEventId,
        });
      }
    }

    return mapped;
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const { items } = await this.fetchPaginatedSamsara(
      'https://api.samsara.com/fleet/vehicles/stats'
    );
    return items.map((item) => this.mapVehicleRecord(item));
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
    const { items } = await this.fetchPaginatedSamsara(
      'https://api.samsara.com/fleet/hos/clocks'
    );
    const mappedClocks = this.mapHosClocksItems(items, receivedAtUtc);

    return mappedClocks.map((c) => ({
      id: c.driverId,
      name: c.driverName || c.driverId,
      licenseNumber: '',
      dutyStatus: c.currentDutyStatus,
      rawDutyStatus: c.rawCurrentDutyStatus,
      ruleset: c.ruleset,
      homeTerminalTimeZone: c.homeTerminalTimeZone,
      attributionLabel: formatEldClockAttribution('samsara', receivedAtUtc),
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
   * Syncs Samsara HOS clocks and HOS logs into read-only Firestore collections for a fleet.
   */
  async syncFleetHosToStore(
    fleetId: string,
    options?: { clocksCursor?: string; logsCursor?: string; defaultHomeTz?: string }
  ): Promise<{
    clocksSaved: EldClocksRecord[];
    logsSaved: EldNormalizedLogRecord[];
    lastClocksCursor: string | null;
    lastLogsCursor: string | null;
  }> {
    try {
      const receivedAtUtc = new Date().toISOString();
      const clocksPage = await this.fetchPaginatedSamsara(
        'https://api.samsara.com/fleet/hos/clocks',
        options?.clocksCursor
      );
      for (const page of clocksPage.rawPages) {
        await eldSyncService.appendRawEvent(
          fleetId,
          'samsara',
          '/fleet/hos/clocks',
          page,
          receivedAtUtc
        );
      }
      const clocksRecords = this.mapHosClocksItems(clocksPage.items, receivedAtUtc);
      const clocksSaved = await eldSyncService.saveProviderClocks(fleetId, clocksRecords);

      const logsPage = await this.fetchPaginatedSamsara(
        'https://api.samsara.com/fleet/hos/logs',
        options?.logsCursor
      );
      let lastRawEventId = `raw-samsara-${Date.now()}`;
      for (const page of logsPage.rawPages) {
        const rawEvt = await eldSyncService.appendRawEvent(
          fleetId,
          'samsara',
          '/fleet/hos/logs',
          page,
          receivedAtUtc
        );
        lastRawEventId = rawEvt.id;
      }
      const normalizedLogs = this.mapHosLogsItems(
        logsPage.items,
        lastRawEventId,
        options?.defaultHomeTz || 'UTC'
      );
      const logsSaved = await eldSyncService.ingestNormalizedLogs(fleetId, normalizedLogs);

      await eldSyncService.recordSyncSuccess(fleetId, 'samsara', {
        ...(clocksPage.lastCursor ? { clocksCursor: clocksPage.lastCursor } : {}),
        ...(logsPage.lastCursor ? { logsCursor: logsPage.lastCursor } : {}),
      });

      return {
        clocksSaved,
        logsSaved,
        lastClocksCursor: clocksPage.lastCursor,
        lastLogsCursor: logsPage.lastCursor,
      };
    } catch (err) {
      await eldSyncService.recordSyncFailure(fleetId, 'samsara', err);
      throw err;
    }
  }
}
