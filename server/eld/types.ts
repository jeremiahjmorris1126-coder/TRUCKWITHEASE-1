/**
 * 49 CFR PART 395 - COMMERCIAL MOTOR VEHICLE HOURS OF SERVICE (HOS) & ELD TIMERS
 * NASA Atomic Time Synchronization & Doppler GPS Velocity Cross-Verification
 */

export type DutyStatus = 'OFF' | 'SB' | 'D' | 'ON' | 'YM' | 'PC';

export type TimezoneId =
  | 'America/New_York'
  | 'America/Chicago'
  | 'America/Denver'
  | 'America/Phoenix'
  | 'America/Los_Angeles'
  | 'America/Anchorage'
  | 'Pacific/Honolulu'
  | 'UTC';

export interface TimezoneInfo {
  timezoneId: TimezoneId;
  label: string;
  abbreviation: string;
  utcOffsetHours: number;
  isDst: boolean;
  formattedTime: string;
}

export interface NasaTimeSyncTelemetry {
  atomicUtcIso: string;
  clockDriftMs: number;
  isClockSynchronized: boolean;
  leapSecondsApplied: number; // Currently 37 seconds
  cddisStationId: string;     // e.g. 'NASA-CDDIS-GODE' (Goddard Geophysical and Astronomical Observatory)
  ntpStratumLevel: number;    // Stratum 1 Atomic Standard
  timestampMs: number;
}

export type SpeedIntegrityStatus =
  | 'VERIFIED_ACCURATE'
  | 'MINIMAL_DRIFT'
  | 'CALIBRATION_WARNING'
  | 'WHEEL_SLIP_DETECTED';

export interface NasaGpsSpeedVerification {
  latitude: number;
  longitude: number;
  confirmedState: string;
  confirmedTimezone: TimezoneId;
  rawGpsSpeedMph: number;
  canBusSpeedMph: number;
  nasaDopplerSpeedMph: number;
  speedVarianceMph: number;
  speedIntegrityStatus: SpeedIntegrityStatus;
  autoDrivingTriggered: boolean; // Mandated >= 5.0 mph per FMCSA § 395.2
  geodeticDatum: 'WGS84 / ITRF2020';
  satellitesLocked: number;
}

export interface HosDutyPeriod {
  status: DutyStatus;
  startEpochMs: number;
  endEpochMs?: number;
  durationSec: number;
  locationName: string;
  latitude: number;
  longitude: number;
  timezoneId: TimezoneId;
  canBusOdometerMiles: number;
  engineHours: number;
  nasaVerified: boolean;
}

export interface SplitSleeperEvaluation {
  isEligible: boolean;
  period1DurationHours: number;
  period2DurationHours: number;
  period1Type: 'SLEEPER' | 'OFF_DUTY';
  period2Type: 'SLEEPER' | 'OFF_DUTY';
  splitMode: '8/2_SPLIT' | '7/3_SPLIT' | 'INELIGIBLE';
  hoursExcludedFrom14HrWindow: number;
  newDrivingAvailableHours: number;
  newDutyWindowAvailableHours: number;
  cfrCitation: '49 CFR § 395.1(g)';
  calculationNotes: string;
}

export interface LiveEldTimesState {
  currentStatus: DutyStatus;
  statusSinceEpochMs: number;
  currentStatusDurationSec: number;

  // Real-Time Clocks
  homeTerminalTimezone: TimezoneId;
  homeTerminalTime: TimezoneInfo;
  currentLocationTimezone: TimezoneId;
  currentLocationTime: TimezoneInfo;
  utcTime: TimezoneInfo;
  timezoneShiftHours: number; // Location offset relative to Home Terminal

  // The 4 Statutory Duty Clocks (in Seconds Remaining)
  drivingSecondsRemaining: number;     // 11-Hour Driving Limit (Max 39,600s)
  dutyWindowSecondsRemaining: number;  // 14-Hour Consecutive Duty Window (Max 50,400s)
  restBreakSecondsRemaining: number;   // 8-Hour Rest Break Window (Max 28,800s until 30m break)
  cycleSecondsRemaining: number;       // 70-Hour / 8-Day Cycle Limit (Max 252,000s)

  // Maximum statutory allowances for percentages
  maxDrivingSeconds: number;     // 39,600 (11h)
  maxDutyWindowSeconds: number;  // 50,400 (14h)
  maxRestBreakSeconds: number;   // 28,800 (8h)
  maxCycleSeconds: number;       // 252,000 (70h)

  // Statutory Violation Flags
  isViolatingDrivingLimit: boolean;
  isViolatingDutyWindow: boolean;
  isViolatingRestBreak: boolean;
  isViolatingCycleLimit: boolean;

  // Split-Sleeper Evaluation
  splitSleeper: SplitSleeperEvaluation;

  // NASA Atomic & Doppler Telemetry Verification
  nasaTimeSync: NasaTimeSyncTelemetry;
  nasaSpeedVerify: NasaGpsSpeedVerification;

  // Cryptographic Audit Proof
  merkleProofSha256: string;
  calculatedAtEpochMs: number;
}
