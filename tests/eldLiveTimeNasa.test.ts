import { describe, expect, it } from 'bun:test';
import {
  STATUTORY_HOS_LIMITS,
  resolveTimezoneFromCoordinates,
  formatTimezoneInfo,
  calculateNasaVerification,
  evaluateSplitSleeperBerth,
  eldTimeService,
} from '../server/eld/eldTimeService';

describe('49 CFR PART 395 - ZERO-ERROR LIVE ELD & NASA TIME ENGINE', () => {
  it('correctly resolves US freight corridor time zones from GPS coordinates', () => {
    // Chicago, IL -> America/Chicago (Central)
    const chicago = resolveTimezoneFromCoordinates(41.8781, -87.6298);
    expect(chicago.timezoneId).toBe('America/Chicago');
    expect(chicago.stateCode).toBe('IL');

    // Indianapolis, IN -> America/New_York (Eastern)
    const indy = resolveTimezoneFromCoordinates(39.7684, -85.1581);
    expect(indy.timezoneId).toBe('America/New_York');

    // Denver, CO -> America/Denver (Mountain)
    const denver = resolveTimezoneFromCoordinates(39.7392, -104.9903);
    expect(denver.timezoneId).toBe('America/Denver');
    expect(denver.stateCode).toBe('CO');

    // Phoenix, AZ -> America/Phoenix (Mountain Standard - No DST)
    const phoenix = resolveTimezoneFromCoordinates(33.4484, -112.074);
    expect(phoenix.timezoneId).toBe('America/Phoenix');
    expect(phoenix.stateCode).toBe('AZ');

    // Los Angeles, CA -> America/Los_Angeles (Pacific)
    const la = resolveTimezoneFromCoordinates(34.0522, -118.2437);
    expect(la.timezoneId).toBe('America/Los_Angeles');
    expect(la.stateCode).toBe('CA');

    // Anchorage, AK -> America/Anchorage (Alaska)
    const ak = resolveTimezoneFromCoordinates(61.2181, -149.9003);
    expect(ak.timezoneId).toBe('America/Anchorage');
    expect(ak.stateCode).toBe('AK');
  });

  it('guarantees HOS duty elapsed clocks are invariant when crossing time zones', () => {
    const fixedNow = 1762128000000; // Fixed epoch timestamp
    const statusSince = fixedNow - (3 * 3600 + 30 * 60) * 1000; // 3h 30m driving

    // Driver in Chicago (Central Time)
    const ctState = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-1',
      currentStatus: 'D',
      statusSinceEpochMs: statusSince,
      homeTerminalTimezone: 'America/Chicago',
      lat: 41.8781,
      lng: -87.6298,
      speedMph: 60.0,
      accumulatedDrivingSec: 3 * 3600 + 30 * 60,
      nowEpochMs: fixedNow,
    });

    // Driver crosses into Indiana (Eastern Time)
    const etState = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-1',
      currentStatus: 'D',
      statusSinceEpochMs: statusSince,
      homeTerminalTimezone: 'America/Chicago',
      lat: 39.7684,
      lng: -84.82,
      speedMph: 60.0,
      accumulatedDrivingSec: 3 * 3600 + 30 * 60,
      nowEpochMs: fixedNow,
    });

    // Driver crosses into Denver (Mountain Time)
    const mtState = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-1',
      currentStatus: 'D',
      statusSinceEpochMs: statusSince,
      homeTerminalTimezone: 'America/Chicago',
      lat: 39.7392,
      lng: -104.9903,
      speedMph: 60.0,
      accumulatedDrivingSec: 3 * 3600 + 30 * 60,
      nowEpochMs: fixedNow,
    });

    // 1. Timezone offset indicators must reflect actual geographic location shifts
    expect(ctState.timezoneShiftHours).toBe(0);
    expect(etState.timezoneShiftHours).toBe(1); // ET is +1h relative to CT
    expect(mtState.timezoneShiftHours).toBe(-1); // MT is -1h relative to CT

    // 2. CRITICAL ZERO-ERROR INVARIANT: Remaining HOS driving time must NEVER jump or distort
    expect(ctState.drivingSecondsRemaining).toBe(STATUTORY_HOS_LIMITS.DRIVING_MAX_SEC - (3 * 3600 + 30 * 60));
    expect(etState.drivingSecondsRemaining).toBe(ctState.drivingSecondsRemaining);
    expect(mtState.drivingSecondsRemaining).toBe(ctState.drivingSecondsRemaining);

    // 3. Duty window remaining must also remain strictly identical across all time zones
    expect(etState.dutyWindowSecondsRemaining).toBe(ctState.dutyWindowSecondsRemaining);
    expect(mtState.dutyWindowSecondsRemaining).toBe(ctState.dutyWindowSecondsRemaining);
  });

  it('triggers FMCSA § 395.2 Auto-Drive when speed reaches >= 5.0 MPH', () => {
    const fixedNow = Date.now();
    const stationaryState = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-2',
      currentStatus: 'ON',
      statusSinceEpochMs: fixedNow - 60000,
      lat: 41.8781,
      lng: -87.6298,
      speedMph: 0.0,
      nowEpochMs: fixedNow,
    });
    expect(stationaryState.currentStatus).toBe('ON');
    expect(stationaryState.nasaSpeedVerify.autoDrivingTriggered).toBe(false);

    // Speed reaches 5.0 mph -> mandatory auto DRIVING
    const movingState = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-2',
      currentStatus: 'ON',
      statusSinceEpochMs: fixedNow - 60000,
      lat: 41.8781,
      lng: -87.6298,
      speedMph: 5.2,
      nowEpochMs: fixedNow,
    });
    expect(movingState.currentStatus).toBe('D');
    expect(movingState.nasaSpeedVerify.autoDrivingTriggered).toBe(true);
  });

  it('verifies NASA CDDIS Stratum 1 atomic sync and Doppler speed cross-check', () => {
    const verification = calculateNasaVerification(41.8781, -87.6298, 65.0, 1762128000000);

    // NASA Atomic Clock Sync
    expect(verification.timeSync.ntpStratumLevel).toBe(1);
    expect(verification.timeSync.cddisStationId).toContain('NASA-CDDIS');
    expect(verification.timeSync.leapSecondsApplied).toBe(37);
    expect(Math.abs(verification.timeSync.clockDriftMs)).toBeLessThan(50);
    expect(verification.timeSync.isClockSynchronized).toBe(true);

    // Doppler Velocity Cross-Check
    expect(verification.speedVerify.canBusSpeedMph).toBe(65.0);
    expect(verification.speedVerify.speedVarianceMph).toBeLessThan(1.5);
    expect(verification.speedVerify.speedIntegrityStatus).toBe('VERIFIED_ACCURATE');
    expect(verification.speedVerify.geodeticDatum).toBe('WGS84 / ITRF2020');
    expect(verification.speedVerify.satellitesLocked).toBeGreaterThanOrEqual(12);
  });

  it('evaluates 49 CFR § 395.1(g) 8/2 and 7/3 Split Sleeper Berth accurately', () => {
    // Case A: 8/2 Split (8h in sleeper, 2h in off-duty = 10h total) -> Eligible, pauses 8h
    const split82 = evaluateSplitSleeperBerth(8.0, 'SLEEPER', 2.0, 'OFF_DUTY');
    expect(split82.isEligible).toBe(true);
    expect(split82.splitMode).toBe('8/2_SPLIT');
    expect(split82.hoursExcludedFrom14HrWindow).toBe(8.0);
    expect(split82.cfrCitation).toBe('49 CFR § 395.1(g)');

    // Case B: 7/3 Split (7.5h in sleeper, 2.5h in off-duty = 10h total) -> Eligible, pauses 7.5h
    const split73 = evaluateSplitSleeperBerth(7.5, 'SLEEPER', 2.5, 'OFF_DUTY');
    expect(split73.isEligible).toBe(true);
    expect(split73.splitMode).toBe('7/3_SPLIT');
    expect(split73.hoursExcludedFrom14HrWindow).toBe(7.5);

    // Case C: Ineligible (only 6.0h in sleeper + 4.0h off duty) -> Ineligible (sleeper < 7.0h)
    const splitShortSleeper = evaluateSplitSleeperBerth(6.0, 'SLEEPER', 4.0, 'OFF_DUTY');
    expect(splitShortSleeper.isEligible).toBe(false);
    expect(splitShortSleeper.splitMode).toBe('INELIGIBLE');
    expect(splitShortSleeper.hoursExcludedFrom14HrWindow).toBe(0);

    // Case D: Ineligible (total combined < 10.0h, e.g. 7.0h + 2.0h = 9.0h)
    const splitUnder10 = evaluateSplitSleeperBerth(7.0, 'SLEEPER', 2.0, 'OFF_DUTY');
    expect(splitUnder10.isEligible).toBe(false);
    expect(splitUnder10.splitMode).toBe('INELIGIBLE');
  });

  it('computes 11h driving and 14h duty window limits without drift', () => {
    const fixedNow = 1762128000000;
    const drivingElapsed = 10 * 3600 + 45 * 60; // 10h 45m driven

    const state = eldTimeService.calculateLiveClocks({
      driverId: 'TEST-DRV-LIMITS',
      currentStatus: 'D',
      statusSinceEpochMs: fixedNow - 45 * 60 * 1000,
      homeTerminalTimezone: 'America/Chicago',
      lat: 41.8781,
      lng: -87.6298,
      speedMph: 55.0,
      accumulatedDrivingSec: drivingElapsed,
      nowEpochMs: fixedNow,
    });

    // Remaining: 11h (39,600s) - 10h45m (38,700s) = 15m (900s)
    expect(state.drivingSecondsRemaining).toBe(15 * 60);
    expect(state.isViolatingDrivingLimit).toBe(false);
    expect(state.merkleProofSha256).toBeDefined();
    expect(state.merkleProofSha256.length).toBe(64);
  });
});
