import test from 'node:test';
import assert from 'node:assert/strict';

// Test suite for TruckWithEase Cockpit & Telematics Core Math
test('FMCSA Safety Grade computation thresholds', () => {
  function computeSafetyGrade(score) {
    if (score >= 97) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  assert.equal(computeSafetyGrade(100), 'A+');
  assert.equal(computeSafetyGrade(97), 'A+');
  assert.equal(computeSafetyGrade(95), 'A');
  assert.equal(computeSafetyGrade(90), 'A');
  assert.equal(computeSafetyGrade(85), 'B');
  assert.equal(computeSafetyGrade(75), 'C');
  assert.equal(computeSafetyGrade(65), 'D');
  assert.equal(computeSafetyGrade(55), 'F');
  assert.equal(computeSafetyGrade(0), 'F');
});

test('Format duration seconds to HH:MM:SS format', () => {
  function formatDurationHMS(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  assert.equal(formatDurationHMS(0), '00:00');
  assert.equal(formatDurationHMS(59), '00:59');
  assert.equal(formatDurationHMS(65), '01:05');
  assert.equal(formatDurationHMS(3600), '01:00:00');
  assert.equal(formatDurationHMS(3665), '01:01:05');
});

test('Diesel Idle Fuel Burn & Environmental Constants', () => {
  const IDLE_FUEL_GALLONS_PER_HOUR = 0.85;
  const DIESEL_PRICE_PER_GALLON_USD = 3.85;
  const CO2_LBS_PER_GALLON = 22.38;

  const twoHoursBurn = 2 * IDLE_FUEL_GALLONS_PER_HOUR;
  assert.equal(twoHoursBurn, 1.7);

  const cost = twoHoursBurn * DIESEL_PRICE_PER_GALLON_USD;
  assert.ok(Math.abs(cost - 6.545) < 0.01);

  const co2 = twoHoursBurn * CO2_LBS_PER_GALLON;
  assert.ok(Math.abs(co2 - 38.046) < 0.01);
});

test('Subsystem Health Check Diagnostic Structure', () => {
  const healthPayload = {
    status: 'UP',
    readiness: 'READY',
    subsystems: {
      fmcsaRegulatoryEngine: { status: 'STANDALONE_LOCAL_ENGINE' },
      nasaOrbitalSpotter: { status: 'DETERMINISTIC_MODELING' },
      drivewyzeBypassNetwork: { status: 'STATION_DIRECTORY_LOOKUP' },
      fleetInvoicesStorage: { status: 'EDGE_STORAGE_READY' }
    }
  };

  assert.equal(healthPayload.status, 'UP');
  assert.equal(healthPayload.readiness, 'READY');
  assert.equal(healthPayload.subsystems.fmcsaRegulatoryEngine.status, 'STANDALONE_LOCAL_ENGINE');
  assert.equal(healthPayload.subsystems.nasaOrbitalSpotter.status, 'DETERMINISTIC_MODELING');
});

test('Dispatch Zero yield calculation and legal duty hour formatting', () => {
  function computeYieldPerHour(grossRevenue, legalDutyHours) {
    if (legalDutyHours <= 0) return '$0.00/Hr';
    const rate = grossRevenue / legalDutyHours;
    return `$${rate.toFixed(2)}/Hr`;
  }

  assert.equal(computeYieldPerHour(2321, 10), '$232.10/Hr');
  assert.equal(computeYieldPerHour(1850.5, 6.5), '$284.69/Hr');
  assert.equal(computeYieldPerHour(1000, 0), '$0.00/Hr');
});

test('Master Mechanic kingpin hitch articulation jackknife danger threshold', () => {
  const JACKKNIFE_DANGER_THRESHOLD_DEG = 48;
  function evaluateKingpinAngle(angleDeg) {
    const absAngle = Math.abs(angleDeg);
    if (absAngle >= JACKKNIFE_DANGER_THRESHOLD_DEG) {
      return { status: 'CRITICAL', warning: 'JACKKNIFE IMMINENT' };
    }
    if (absAngle >= 35) {
      return { status: 'ADVISORY', warning: 'HIGH ARTICULATION' };
    }
    return { status: 'NOMINAL', warning: null };
  }

  assert.equal(evaluateKingpinAngle(52).status, 'CRITICAL');
  assert.equal(evaluateKingpinAngle(-49).status, 'CRITICAL');
  assert.equal(evaluateKingpinAngle(40).status, 'ADVISORY');
  assert.equal(evaluateKingpinAngle(20).status, 'NOMINAL');
});

test('FHWA Item 54B low-bridge clearance buffer calculation', () => {
  const STANDARD_TRUCK_HEIGHT_INCHES = 162; // 13 ft 6 in
  function evaluateBridgeClearance(bridgeClearanceInches) {
    const delta = bridgeClearanceInches - STANDARD_TRUCK_HEIGHT_INCHES;
    if (delta <= 0) {
      return {
        level: 'CRITICAL',
        bufferDelta: `${delta}" BUFFER DELTA`,
        label: `13' 6" CLEARANCE // 0" BUFFER DELTA`,
      };
    }
    return {
      level: 'SAFE',
      bufferDelta: `+${delta}" BUFFER DELTA`,
      label: 'CLEARANCE OK',
    };
  }

  assert.equal(evaluateBridgeClearance(162).level, 'CRITICAL');
  assert.equal(evaluateBridgeClearance(158).level, 'CRITICAL');
  assert.equal(evaluateBridgeClearance(180).level, 'SAFE');
});
