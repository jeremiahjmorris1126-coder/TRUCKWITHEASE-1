/**
 * Normalized ELD / telematics shapes.
 *
 * TruckWithEase is NOT an ELD and never generates duty-status records. Every
 * value here is a read-only copy of what the carrier's registered ELD provider
 * reported. Any field the provider did not report is `null` — never a default
 * or estimated number — so the UI can show "not reported" instead of a value
 * that looks real but isn't.
 */

export type TelematicsProviderId = 'samsara' | 'motive' | 'geotab';

export interface NormalizedVehicle {
  id: string;
  unitNumber: string;
  vin: string | null;
  makeModel: string | null;
  provider: TelematicsProviderId;
  /** Set only when the record came from built-in demo fixtures (never in production). */
  demo?: true;
  status: 'DRIVING' | 'IDLE' | 'PARKED' | 'MAINTENANCE' | 'UNKNOWN';
  speedMph: number | null;
  engineRpm: number | null;
  fuelPercent: number | null;
  defLevelPercent: number | null;
  odometerMiles: number | null;
  engineHours: number | null;
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
    heading: number | null;
    updatedAt: string;
  } | null;
  diagnostics: {
    checkEngineLight: boolean | null;
    oilPressurePsi: number | null;
    coolantTempF: number | null;
    activeDtcCount: number | null;
    dtcCodes: string[];
  };
}

export type DutyStatus =
  | 'OFF_DUTY'
  | 'SLEEPER_BERTH'
  | 'DRIVING'
  | 'ON_DUTY'
  | 'YARD_MOVE'
  | 'PERSONAL_CONVEYANCE'
  | 'UNKNOWN';

export interface NormalizedDriver {
  id: string;
  name: string;
  provider: TelematicsProviderId;
  demo?: true;
  licenseNumber: string | null;
  dutyStatus: DutyStatus;
  currentVehicleId: string | null;
  /** Remaining time in minutes as reported by the ELD; null when not reported. */
  hosClocks: {
    drivingRemainingMins: number | null;
    shiftRemainingMins: number | null;
    cycleRemainingMins: number | null;
    breakWindowMins: number | null;
  };
  /** When the provider computed these clocks (ISO); null if not reported. */
  hosAsOf: string | null;
}

/**
 * NOT_CONFIGURED: no credentials. CONFIGURED: credentials set, not contacted yet.
 * LIVE: last call succeeded. ERROR: last call failed (see lastError). DEMO: test fixtures.
 */
export type ProviderMode = 'NOT_CONFIGURED' | 'CONFIGURED' | 'LIVE' | 'ERROR' | 'DEMO';

export interface ProviderStatus {
  provider: TelematicsProviderId;
  configured: boolean;
  mode: ProviderMode;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastVehicleCount: number | null;
  lastDriverCount: number | null;
}

/**
 * Adapters throw on any failure. They never substitute fabricated data —
 * the manager records the error and reports the provider as ERROR.
 */
export interface TelematicsProviderAdapter {
  id: TelematicsProviderId;
  name: string;
  isConfigured(): boolean;
  getFleetVehicles(): Promise<NormalizedVehicle[]>;
  getDrivers(): Promise<NormalizedDriver[]>;
}

export class TelematicsProviderError extends Error {
  constructor(public provider: TelematicsProviderId, message: string, public httpStatus?: number) {
    super(`[${provider}] ${message}`);
    this.name = 'TelematicsProviderError';
  }
}
