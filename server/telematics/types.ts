export type EldProviderName = 'samsara' | 'motive' | 'geotab';

export type EldDutyStatus =
  | 'OFF_DUTY'
  | 'SLEEPER_BERTH'
  | 'DRIVING'
  | 'ON_DUTY_NOT_DRIVING'
  | 'PERSONAL_CONVEYANCE'
  | 'YARD_MOVE'
  | 'UNIDENTIFIED_DRIVING'
  | 'MALFUNCTION'
  | 'DIAGNOSTIC'
  | 'UNKNOWN';

export type EldSyncConnectionStatus =
  | 'CONNECTED'
  | 'SYNC_DELAYED'
  | 'AUTH_EXPIRED'
  | 'DISCONNECTED';

export class EldSyncError extends Error {
  provider: EldProviderName;
  statusCode: number;
  retryAfterMs: number | null;
  syncState: 'AUTH_EXPIRED' | 'SYNC_DELAYED';

  constructor(
    provider: EldProviderName,
    statusCode: number,
    message: string,
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = 'EldSyncError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
    this.syncState = statusCode === 401 || statusCode === 403 ? 'AUTH_EXPIRED' : 'SYNC_DELAYED';
  }
}

export interface EldConnectionRecord {
  id: string;
  fleetId: string;
  provider: EldProviderName;
  status: EldSyncConnectionStatus;
  /** Reference to Google Cloud Secret Manager resource — never the raw key/token */
  secretManagerRef: string;
  lastSyncSuccessAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;
  syncCursors: Record<string, string | number>;
  /** Default 184 days (6 months) per 49 CFR § 395.8(k)(1) and § 395.30(f) */
  retentionDays: number;
}

export interface EldRawEventRecord {
  id: string;
  fleetId: string;
  provider: EldProviderName;
  endpoint: string;
  receivedAtUtc: string;
  payloadSha256: string;
  rawPayload: unknown;
}

export interface EldLogVersionEntry {
  replacedAtUtc: string;
  rawEventId: string;
  previousRecord: Omit<EldNormalizedLogRecord, 'versionHistory'>;
}

export interface EldNormalizedLogRecord {
  id: string;
  fleetId: string;
  provider: EldProviderName;
  providerLogId: string;
  driverId: string;
  providerDriverId: string;
  driverName: string | null;
  vehicleId: string | null;
  providerVehicleId: string | null;
  coDriverIds: string[];
  carrierName: string | null;
  carrierUsdotNumber: string | null;
  dutyStatus: EldDutyStatus;
  rawDutyStatus: string;
  flaggedForReview: boolean;
  startTimeUtc: string;
  endTimeUtc: string | null;
  durationMs: number | null;
  homeTerminalTimeZone: string;
  localDateInHomeTz: string;
  dstTransitionInfo: {
    startOffsetMinutes: number;
    endOffsetMinutes: number | null;
    crossesDstChange: boolean;
    crossesLocalMidnight: boolean;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    description: string | null;
    precision: 'STANDARD_2_DEC' | 'PRIVACY_1_DEC_10_MILE' | 'NONE';
  };
  odometerRaw: { value: number; unit: 'mi' | 'km' | 'm' } | null;
  odometerMiles: number | null;
  engineHoursRaw: { value: number; unit: 'hours' | 'seconds' } | null;
  engineHours: number | null;
  origin: 'AUTOMATIC' | 'DRIVER' | 'CARRIER_EDIT' | 'UNASSIGNED' | 'UNKNOWN';
  annotations: Array<{ text: string; author?: string; createdAtUtc?: string }>;
  certified: boolean;
  certifiedAtUtc: string | null;
  malfunctionOrDiagnosticCode: string | null;
  ruleset: string | null;
  rawEventId: string;
  versionHistory: EldLogVersionEntry[];
}

export interface EldClocksRecord {
  id: string;
  fleetId: string;
  driverId: string;
  providerDriverId: string;
  driverName: string | null;
  provider: EldProviderName;
  currentDutyStatus: EldDutyStatus;
  rawCurrentDutyStatus: string;
  ruleset: string | null;
  homeTerminalTimeZone: string | null;
  clocks: {
    driveRemainingMs: number | null;
    shiftRemainingMs: number | null;
    cycleRemainingMs: number | null;
    breakRemainingMs: number | null;
    rawProviderClocks: {
      drive: { value: number | string; unit: 'ms' | 's' | 'timespan' } | null;
      shift: { value: number | string; unit: 'ms' | 's' | 'timespan' } | null;
      cycle: { value: number | string; unit: 'ms' | 's' | 'timespan' } | null;
      break: { value: number | string; unit: 'ms' | 's' | 'timespan' } | null;
    };
  };
  activeViolations: string[];
  providerSyncedAtUtc: string;
  receivedAtUtc: string;
  /** Must always be labeled "From [Provider], last synced [Time]" */
  attributionLabel: string;
}

export interface NormalizedVehicle {
  id: string;
  unitNumber: string;
  vin: string;
  makeModel: string;
  provider: 'samsara' | 'motive' | 'geotab' | 'mock';
  status: 'DRIVING' | 'IDLE' | 'PARKED' | 'MAINTENANCE';
  speedMph: number | null;
  engineRpm: number | null;
  fuelPercent: number | null;
  defLevelPercent: number | null;
  odometerMiles: number | null;
  odometerRaw?: { value: number; unit: 'mi' | 'km' | 'm' } | null;
  engineHours: number | null;
  engineHoursRaw?: { value: number; unit: 'hours' | 'seconds' } | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    address: string;
    heading: number | null;
    updatedAt: string;
  };
  diagnostics: {
    checkEngineLight: boolean;
    oilPressurePsi: number | null;
    coolantTempF: number | null;
    activeDtcCount: number;
    dtcCodes: string[];
  };
}

export interface NormalizedDriver {
  id: string;
  name: string;
  licenseNumber: string;
  dutyStatus: 'ON_DUTY' | 'DRIVING' | 'SLEEPER_BERTH' | 'OFF_DUTY' | EldDutyStatus;
  rawDutyStatus?: string;
  flaggedForReview?: boolean;
  currentVehicleId?: string;
  ruleset?: string | null;
  homeTerminalTimeZone?: string | null;
  attributionLabel?: string;
  hosClocks: {
    drivingRemainingMins: number | null;
    shiftRemainingMins: number | null;
    cycleRemainingMins: number | null;
    breakWindowMins: number | null;
    driveRemainingMs?: number | null;
    shiftRemainingMs?: number | null;
    cycleRemainingMs?: number | null;
    breakRemainingMs?: number | null;
  };
}

export interface TelematicsProviderAdapter {
  name: string;
  isConfigured(): boolean;
  getFleetVehicles(): Promise<NormalizedVehicle[]>;
  getVehicleById(id: string): Promise<NormalizedVehicle | null>;
  getDrivers(): Promise<NormalizedDriver[]>;
}
