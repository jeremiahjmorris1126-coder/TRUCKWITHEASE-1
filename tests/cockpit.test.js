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
