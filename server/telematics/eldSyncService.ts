import crypto from 'crypto';
import { CallerIdentity, fleetStore, TenantAccessError } from '../data/fleetStore';
import {
  EldClocksRecord,
  EldConnectionRecord,
  EldDutyStatus,
  EldLogVersionEntry,
  EldNormalizedLogRecord,
  EldProviderName,
  EldRawEventRecord,
  EldSyncError,
} from './types';

const SYSTEM_OWNER: CallerIdentity = {
  uid: 'system-eld-sync',
  role: 'owner',
  fleetId: null,
};

const PROVIDER_DISPLAY_NAMES: Record<EldProviderName, string> = {
  samsara: 'Samsara',
  motive: 'Motive',
  geotab: 'Geotab',
};

/**
 * Normalizes provider duty status strings according to 49 CFR § 395.24(b).
 * Unknown or unrecognized status values are NEVER silently converted to OFF_DUTY;
 * they are stored as 'UNKNOWN' with rawDutyStatus preserved and flaggedForReview = true.
 */
export function normalizeProviderDutyStatus(
  provider: EldProviderName,
  rawStatus: unknown,
  isUnassigned = false
): { dutyStatus: EldDutyStatus; rawDutyStatus: string; flaggedForReview: boolean } {
  const rawStr = typeof rawStatus === 'string' ? rawStatus.trim() : String(rawStatus ?? '');
  if (!rawStr) {
    return { dutyStatus: 'UNKNOWN', rawDutyStatus: rawStr, flaggedForReview: true };
  }

  if (isUnassigned) {
    return { dutyStatus: 'UNIDENTIFIED_DRIVING', rawDutyStatus: rawStr, flaggedForReview: true };
  }

  const lower = rawStr.toLowerCase();

  if (provider === 'samsara') {
    switch (lower) {
      case 'offduty':
      case 'off_duty':
        return { dutyStatus: 'OFF_DUTY', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'sleeperberth':
      case 'sleeper_berth':
        return { dutyStatus: 'SLEEPER_BERTH', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'driving':
        return { dutyStatus: 'DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'onduty':
      case 'on_duty':
      case 'ondutynotdriving':
        return { dutyStatus: 'ON_DUTY_NOT_DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'personalconveyance':
      case 'personal_conveyance':
        return { dutyStatus: 'PERSONAL_CONVEYANCE', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'yardmove':
      case 'yard_move':
        return { dutyStatus: 'YARD_MOVE', rawDutyStatus: rawStr, flaggedForReview: false };
      default:
        return { dutyStatus: 'UNKNOWN', rawDutyStatus: rawStr, flaggedForReview: true };
    }
  }

  if (provider === 'motive') {
    switch (lower) {
      case 'off_duty':
        return { dutyStatus: 'OFF_DUTY', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'sleeper':
      case 'sleeper_berth':
        return { dutyStatus: 'SLEEPER_BERTH', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'driving':
        return { dutyStatus: 'DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'on_duty':
      case 'on_duty_not_driving':
        return { dutyStatus: 'ON_DUTY_NOT_DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'personal_conveyance':
        return { dutyStatus: 'PERSONAL_CONVEYANCE', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'yard_moves':
      case 'yard_move':
        return { dutyStatus: 'YARD_MOVE', rawDutyStatus: rawStr, flaggedForReview: false };
      default:
        return { dutyStatus: 'UNKNOWN', rawDutyStatus: rawStr, flaggedForReview: true };
    }
  }

  if (provider === 'geotab') {
    switch (rawStr) {
      case 'Off':
      case 'OFF':
        return { dutyStatus: 'OFF_DUTY', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'SB':
        return { dutyStatus: 'SLEEPER_BERTH', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'D':
      case 'Drive':
        return { dutyStatus: 'DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'ON':
      case 'On':
        return { dutyStatus: 'ON_DUTY_NOT_DRIVING', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'PC':
        return { dutyStatus: 'PERSONAL_CONVEYANCE', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'YM':
        return { dutyStatus: 'YARD_MOVE', rawDutyStatus: rawStr, flaggedForReview: false };
      case 'M':
      case 'Malfunction':
        return { dutyStatus: 'MALFUNCTION', rawDutyStatus: rawStr, flaggedForReview: true };
      case 'Diag':
      case 'Diagnostic':
        return { dutyStatus: 'DIAGNOSTIC', rawDutyStatus: rawStr, flaggedForReview: true };
      default:
        return { dutyStatus: 'UNKNOWN', rawDutyStatus: rawStr, flaggedForReview: true };
    }
  }

  return { dutyStatus: 'UNKNOWN', rawDutyStatus: rawStr, flaggedForReview: true };
}

/**
 * Computes UTC offset in minutes for a specific Date in an IANA time zone.
 */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value);
    }
  }
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUtcMs = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  const utcSecTrimmed = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtcMs - utcSecTrimmed) / 60000);
}

/**
 * Formats a Date into YYYY-MM-DD in the driver's home terminal time zone (49 CFR § 395.8(f)(12)).
 */
export function formatLocalDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Evaluates home terminal date and Daylight Saving Time (DST) transitions
 * across startTimeUtc and endTimeUtc.
 */
export function computeHomeTerminalDateAndDst(
  startTimeUtc: string,
  endTimeUtc: string | null,
  homeTerminalTimeZone: string
): {
  localDateInHomeTz: string;
  durationMs: number | null;
  dstTransitionInfo: {
    startOffsetMinutes: number;
    endOffsetMinutes: number | null;
    crossesDstChange: boolean;
    crossesLocalMidnight: boolean;
  };
} {
  const tz = homeTerminalTimeZone || 'UTC';
  const startDate = new Date(startTimeUtc);
  const localDateStart = formatLocalDateInTimeZone(startDate, tz);
  const startOffsetMinutes = getTimeZoneOffsetMinutes(startDate, tz);

  if (!endTimeUtc) {
    return {
      localDateInHomeTz: localDateStart,
      durationMs: null,
      dstTransitionInfo: {
        startOffsetMinutes,
        endOffsetMinutes: null,
        crossesDstChange: false,
        crossesLocalMidnight: false,
      },
    };
  }

  const endDate = new Date(endTimeUtc);
  const localDateEnd = formatLocalDateInTimeZone(endDate, tz);
  const endOffsetMinutes = getTimeZoneOffsetMinutes(endDate, tz);
  const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());

  return {
    localDateInHomeTz: localDateStart,
    durationMs,
    dstTransitionInfo: {
      startOffsetMinutes,
      endOffsetMinutes,
      crossesDstChange: startOffsetMinutes !== endOffsetMinutes,
      crossesLocalMidnight: localDateStart !== localDateEnd,
    },
  };
}

/**
 * Converts provider odometer reading to miles while preserving raw value and unit.
 * 1 mile = 1609.344 meters; 1 km = 0.6213711922 miles.
 */
export function convertOdometerToMiles(
  rawValue: number | null | undefined,
  unit: 'mi' | 'km' | 'm'
): { odometerRaw: { value: number; unit: 'mi' | 'km' | 'm' } | null; odometerMiles: number | null } {
  if (rawValue === null || rawValue === undefined || !Number.isFinite(rawValue)) {
    return { odometerRaw: null, odometerMiles: null };
  }
  let miles = rawValue;
  if (unit === 'm') {
    miles = rawValue / 1609.344;
  } else if (unit === 'km') {
    miles = rawValue * 0.6213711922;
  }
  return {
    odometerRaw: { value: rawValue, unit },
    odometerMiles: Number(miles.toFixed(2)),
  };
}

/**
 * Converts provider engine time to hours while preserving raw value and unit.
 */
export function convertEngineTimeToHours(
  rawValue: number | null | undefined,
  unit: 'hours' | 'seconds'
): { engineHoursRaw: { value: number; unit: 'hours' | 'seconds' } | null; engineHours: number | null } {
  if (rawValue === null || rawValue === undefined || !Number.isFinite(rawValue)) {
    return { engineHoursRaw: null, engineHours: null };
  }
  const hours = unit === 'seconds' ? rawValue / 3600 : rawValue;
  return {
    engineHoursRaw: { value: rawValue, unit },
    engineHours: Number(hours.toFixed(2)),
  };
}

/**
 * Parses Geotab TimeSpan / ISO-8601 duration strings into milliseconds.
 * Supports:
 * - "HH:MM:SS" or "d.HH:MM:SS" (e.g., "08:30:00", "2.10:15:00")
 * - ISO-8601 "PT8H30M0S"
 * - numeric milliseconds
 */
export function parseGeotabDurationToMs(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;

  const str = raw.trim();
  if (!str) return null;

  // Match d.HH:MM:SS or HH:MM:SS(.fff)
  const tsMatch = str.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (tsMatch) {
    const days = tsMatch[1] ? Number(tsMatch[1]) : 0;
    const hours = Number(tsMatch[2]);
    const mins = Number(tsMatch[3]);
    const secs = Number(tsMatch[4]);
    return ((days * 24 + hours) * 3600 + mins * 60 + secs) * 1000;
  }

  // Match ISO-8601 PT#H#M#S
  const isoMatch = str.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3] || isoMatch[4])) {
    const days = isoMatch[1] ? Number(isoMatch[1]) : 0;
    const hours = isoMatch[2] ? Number(isoMatch[2]) : 0;
    const mins = isoMatch[3] ? Number(isoMatch[3]) : 0;
    const secs = isoMatch[4] ? Number(isoMatch[4]) : 0;
    return Math.round(((days * 24 + hours) * 3600 + mins * 60 + secs) * 1000);
  }

  return null;
}

/**
 * Applies 49 CFR § 395.26(d)(2) and Part 395 Appendix A Section 4.3.1.6 privacy masking:
 * - Personal Conveyance & Off Duty: 1 decimal place (~10-mile radius), street description masked.
 * - On-duty / Driving / Sleeper / Yard Move: 2 decimal places (~1-mile ELD precision) or exact.
 */
export function maskLocationForDutyStatus(
  dutyStatus: EldDutyStatus,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  description: string | null | undefined
): {
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  precision: 'STANDARD_2_DEC' | 'PRIVACY_1_DEC_10_MILE' | 'NONE';
} {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return {
      latitude: null,
      longitude: null,
      description: null,
      precision: 'NONE',
    };
  }

  if (dutyStatus === 'PERSONAL_CONVEYANCE' || dutyStatus === 'OFF_DUTY') {
    return {
      latitude: Math.round(latitude * 10) / 10,
      longitude: Math.round(longitude * 10) / 10,
      description: null,
      precision: 'PRIVACY_1_DEC_10_MILE',
    };
  }

  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    description: description ?? null,
    precision: 'STANDARD_2_DEC',
  };
}

/**
 * Formats the mandatory read-only ELD clock attribution label:
 * "From [provider], last synced [time]"
 */
export function formatEldClockAttribution(provider: EldProviderName, syncedAtIso: string): string {
  const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider;
  return `From ${displayName}, last synced ${syncedAtIso}`;
}

export class EldSyncService {
  /**
   * Registers or updates a fleet's ELD connection in `eld_connections`.
   * Rejects any request that attempts to store a raw API key, token, or password.
   */
  async upsertConnection(
    caller: CallerIdentity,
    params: {
      provider: EldProviderName;
      secretManagerRef: string;
      status?: EldConnectionRecord['status'];
      retentionDays?: number;
    }
  ): Promise<EldConnectionRecord> {
    if (caller.role === 'driver') {
      throw new TenantAccessError('Only fleet_admin or owner can configure ELD connections.', 403);
    }
    if (!caller.fleetId && caller.role !== 'owner') {
      throw new TenantAccessError('Caller must belong to a fleet.', 403);
    }

    const ref = (params.secretManagerRef || '').trim();
    if (!ref.startsWith('projects/') || !ref.includes('/secrets/')) {
      throw new TenantAccessError(
        'ELD credentials must be stored in Google Cloud Secret Manager (projects/*/secrets/*). Raw keys are prohibited in Firestore.',
        400
      );
    }

    const fleetId = caller.fleetId || 'FLEET-SYSTEM';
    const id = `eld-conn-${fleetId}-${params.provider}`;
    const existing = await fleetStore.getScopedDocument<EldConnectionRecord>(caller, 'eld_connections', id);

    const record: EldConnectionRecord = {
      id,
      fleetId,
      provider: params.provider,
      status: params.status || existing?.status || 'CONNECTED',
      secretManagerRef: ref,
      lastSyncSuccessAt: existing?.lastSyncSuccessAt || null,
      lastSyncAttemptAt: existing?.lastSyncAttemptAt || null,
      lastSyncError: existing?.lastSyncError || null,
      syncCursors: existing?.syncCursors || {},
      retentionDays: params.retentionDays ?? existing?.retentionDays ?? 184,
    };

    return fleetStore.createScopedDocument(caller, 'eld_connections', id, record);
  }

  /**
   * Appends an immutable raw payload to `eld_raw_events` (49 CFR § 395.30(d)).
   */
  async appendRawEvent(
    fleetId: string,
    provider: EldProviderName,
    endpoint: string,
    rawPayload: unknown,
    receivedAtUtc = new Date().toISOString()
  ): Promise<EldRawEventRecord> {
    const rawJson = JSON.stringify(rawPayload);
    const payloadSha256 = crypto.createHash('sha256').update(rawJson).digest('hex');
    const id = `raw-${provider}-${payloadSha256.slice(0, 16)}`;

    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };

    const existing = await fleetStore.getScopedDocument<EldRawEventRecord>(
      scopedCaller,
      'eld_raw_events',
      id
    );
    if (existing) {
      return existing;
    }

    const record: EldRawEventRecord = {
      id,
      fleetId,
      provider,
      endpoint,
      receivedAtUtc,
      payloadSha256,
      rawPayload,
    };

    return fleetStore.createScopedDocument(scopedCaller, 'eld_raw_events', id, record);
  }

  /**
   * Ingests normalized read-only ELD duty status logs into `eld_logs`.
   * - Deduplicates identical records.
   * - Preserves prior version in `versionHistory[]` when a provider-side edit updates a past log.
   * - Sorts logs chronologically by `startTimeUtc`.
   */
  async ingestNormalizedLogs(
    fleetId: string,
    logs: Array<Omit<EldNormalizedLogRecord, 'id' | 'fleetId' | 'versionHistory'> & { replacesProviderLogId?: string }>
  ): Promise<EldNormalizedLogRecord[]> {
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };

    // Sort chronologically by startTimeUtc before processing so out-of-order arrivals settle deterministically
    const sorted = [...logs].sort(
      (a, b) => new Date(a.startTimeUtc).getTime() - new Date(b.startTimeUtc).getTime()
    );

    const savedRecords: EldNormalizedLogRecord[] = [];

    for (const incoming of sorted) {
      const targetProviderLogId = incoming.replacesProviderLogId || incoming.providerLogId;
      const docId = `eld-log-${incoming.provider}-${targetProviderLogId}`;

      const existing = await fleetStore.getScopedDocument<EldNormalizedLogRecord>(
        scopedCaller,
        'eld_logs',
        docId
      );

      let versionHistory: EldLogVersionEntry[] = existing?.versionHistory ? [...existing.versionHistory] : [];

      if (existing) {
        // Check if content actually changed (provider-side edit, annotation, or certification update)
        const isIdentical =
          existing.providerLogId === incoming.providerLogId &&
          existing.dutyStatus === incoming.dutyStatus &&
          existing.rawDutyStatus === incoming.rawDutyStatus &&
          existing.startTimeUtc === incoming.startTimeUtc &&
          existing.endTimeUtc === incoming.endTimeUtc &&
          existing.certified === incoming.certified &&
          JSON.stringify(existing.annotations) === JSON.stringify(incoming.annotations);

        if (isIdentical) {
          savedRecords.push(existing);
          continue;
        }

        const { versionHistory: _oldVh, ...previousSnapshot } = existing;
        versionHistory.push({
          replacedAtUtc: new Date().toISOString(),
          rawEventId: incoming.rawEventId,
          previousRecord: previousSnapshot,
        });
      }

      const { replacesProviderLogId: _unused, ...cleanIncoming } = incoming;
      const recordToSave: EldNormalizedLogRecord = {
        ...cleanIncoming,
        id: docId,
        fleetId,
        versionHistory,
      };

      const saved = await fleetStore.createScopedDocument(
        scopedCaller,
        'eld_logs',
        docId,
        recordToSave
      );
      savedRecords.push(saved);
    }

    return savedRecords;
  }

  /**
   * Stores provider-reported remaining HOS clocks in `eld_clocks`.
   * Never calculates or modifies clock durations locally.
   */
  async saveProviderClocks(
    fleetId: string,
    clocksList: Array<Omit<EldClocksRecord, 'id' | 'fleetId' | 'attributionLabel'>>
  ): Promise<EldClocksRecord[]> {
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };

    const saved: EldClocksRecord[] = [];
    for (const item of clocksList) {
      const docId = item.driverId;
      const record: EldClocksRecord = {
        ...item,
        id: docId,
        fleetId,
        attributionLabel: formatEldClockAttribution(item.provider, item.receivedAtUtc),
      };
      const res = await fleetStore.createScopedDocument(scopedCaller, 'eld_clocks', docId, record);
      saved.push(res);
    }
    return saved;
  }

  /**
   * Records a sync error (401 / 429 / 503) on the fleet's ELD connection without losing or inventing data.
   */
  async recordSyncFailure(
    fleetId: string,
    provider: EldProviderName,
    err: unknown
  ): Promise<EldConnectionRecord | null> {
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };
    const id = `eld-conn-${fleetId}-${provider}`;
    const existing = await fleetStore.getScopedDocument<EldConnectionRecord>(
      scopedCaller,
      'eld_connections',
      id
    );
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    const status =
      err instanceof EldSyncError ? err.syncState : 'SYNC_DELAYED';
    const message = err instanceof Error ? err.message : String(err);

    return fleetStore.updateScopedDocument<EldConnectionRecord>(
      scopedCaller,
      'eld_connections',
      id,
      {
        status,
        lastSyncAttemptAt: nowIso,
        lastSyncError: message,
      }
    );
  }

  /**
   * Records a successful sync and updates pagination cursors.
   */
  async recordSyncSuccess(
    fleetId: string,
    provider: EldProviderName,
    cursors?: Record<string, string | number>
  ): Promise<EldConnectionRecord | null> {
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };
    const id = `eld-conn-${fleetId}-${provider}`;
    const existing = await fleetStore.getScopedDocument<EldConnectionRecord>(
      scopedCaller,
      'eld_connections',
      id
    );
    if (!existing) return null;

    const nowIso = new Date().toISOString();
    return fleetStore.updateScopedDocument<EldConnectionRecord>(
      scopedCaller,
      'eld_connections',
      id,
      {
        status: 'CONNECTED',
        lastSyncSuccessAt: nowIso,
        lastSyncAttemptAt: nowIso,
        lastSyncError: null,
        syncCursors: {
          ...existing.syncCursors,
          ...(cursors || {}),
        },
      }
    );
  }

  /**
   * Lists stored read-only ELD logs for a caller (enforcing fleet and driver isolation).
   */
  async listLogs(caller: CallerIdentity): Promise<EldNormalizedLogRecord[]> {
    const list = await fleetStore.listScopedCollection<EldNormalizedLogRecord>(caller, 'eld_logs');
    return list.sort(
      (a, b) => new Date(a.startTimeUtc).getTime() - new Date(b.startTimeUtc).getTime()
    );
  }

  /**
   * Gets a single ELD log by ID (returns null / 404 if other fleet or other driver).
   */
  async getLogById(caller: CallerIdentity, logId: string): Promise<EldNormalizedLogRecord | null> {
    return fleetStore.getScopedDocument<EldNormalizedLogRecord>(caller, 'eld_logs', logId);
  }

  /**
   * Lists stored read-only ELD clocks for a caller (enforcing fleet and driver isolation).
   */
  async listClocks(caller: CallerIdentity): Promise<EldClocksRecord[]> {
    return fleetStore.listScopedCollection<EldClocksRecord>(caller, 'eld_clocks');
  }

  /**
   * Gets a driver's ELD clock snapshot by driverId.
   */
  async getClocksForDriver(caller: CallerIdentity, driverId: string): Promise<EldClocksRecord | null> {
    return fleetStore.getScopedDocument<EldClocksRecord>(caller, 'eld_clocks', driverId);
  }

  /**
   * Enforces the 6-month (184-day) retention rule under 49 CFR § 395.8(k)(1) and § 395.30(f).
   * Purges `eld_logs` and `eld_raw_events` older than `retentionDays` (default 184 days).
   */
  async purgeExpiredRecords(
    fleetId: string,
    retentionDays = 184,
    nowMs = Date.now()
  ): Promise<{ logsPurged: number; rawEventsPurged: number }> {
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };
    const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
    let logsPurged = 0;
    let rawEventsPurged = 0;

    const allLogs = await fleetStore.listScopedCollection<EldNormalizedLogRecord>(
      scopedCaller,
      'eld_logs',
      { limit: 10000 }
    );
    for (const log of allLogs) {
      if (log.fleetId !== fleetId) continue;
      const logTimeMs = new Date(log.endTimeUtc || log.startTimeUtc).getTime();
      if (Number.isFinite(logTimeMs) && logTimeMs < cutoffMs) {
        await fleetStore.deleteScopedDocument(scopedCaller, 'eld_logs', log.id);
        logsPurged += 1;
      }
    }

    const allRaw = await fleetStore.listScopedCollection<EldRawEventRecord>(
      scopedCaller,
      'eld_raw_events',
      { limit: 10000 }
    );
    for (const evt of allRaw) {
      if (evt.fleetId !== fleetId) continue;
      const evtTimeMs = new Date(evt.receivedAtUtc).getTime();
      if (Number.isFinite(evtTimeMs) && evtTimeMs < cutoffMs) {
        await fleetStore.deleteScopedDocument(scopedCaller, 'eld_raw_events', evt.id);
        rawEventsPurged += 1;
      }
    }

    return { logsPurged, rawEventsPurged };
  }

  /**
   * Customer offboarding / ELD disconnect: marks connection DISCONNECTED and purges all stored
   * `eld_connections`, `eld_raw_events`, `eld_logs`, and `eld_clocks` for that fleet.
   */
  async disconnectAndPurgeFleetEld(
    caller: CallerIdentity
  ): Promise<{ connectionsPurged: number; logsPurged: number; clocksPurged: number; rawEventsPurged: number }> {
    if (caller.role === 'driver' || !caller.fleetId) {
      throw new TenantAccessError('Only fleet_admin or owner can disconnect and purge fleet ELD data.', 403);
    }
    const fleetId = caller.fleetId;
    const scopedCaller: CallerIdentity = {
      uid: SYSTEM_OWNER.uid,
      role: 'owner',
      fleetId,
    };

    const conns = (await fleetStore.listScopedCollection<EldConnectionRecord>(scopedCaller, 'eld_connections', { limit: 1000 }))
      .filter((c) => c.fleetId === fleetId);
    for (const c of conns) {
      await fleetStore.deleteScopedDocument(scopedCaller, 'eld_connections', c.id);
    }

    const logs = (await fleetStore.listScopedCollection<EldNormalizedLogRecord>(scopedCaller, 'eld_logs', { limit: 10000 }))
      .filter((l) => l.fleetId === fleetId);
    for (const l of logs) {
      await fleetStore.deleteScopedDocument(scopedCaller, 'eld_logs', l.id);
    }

    const clocks = (await fleetStore.listScopedCollection<EldClocksRecord>(scopedCaller, 'eld_clocks', { limit: 1000 }))
      .filter((c) => c.fleetId === fleetId);
    for (const c of clocks) {
      await fleetStore.deleteScopedDocument(scopedCaller, 'eld_clocks', c.id);
    }

    const rawEvents = (await fleetStore.listScopedCollection<EldRawEventRecord>(scopedCaller, 'eld_raw_events', { limit: 10000 }))
      .filter((r) => r.fleetId === fleetId);
    for (const r of rawEvents) {
      await fleetStore.deleteScopedDocument(scopedCaller, 'eld_raw_events', r.id);
    }

    return {
      connectionsPurged: conns.length,
      logsPurged: logs.length,
      clocksPurged: clocks.length,
      rawEventsPurged: rawEvents.length,
    };
  }
}

export const eldSyncService = new EldSyncService();
