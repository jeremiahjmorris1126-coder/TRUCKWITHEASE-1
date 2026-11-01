import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGpsTabConfigured,
  getGpsTabConfig,
  fetchGpsTabTelemetry,
  fetchGpsTabHos,
} from '../server/gpstabService.ts';
import { COMMERCIAL_ELD_PROFILES } from '../src/services/bluetoothEldService.ts';

test('GPSTab integration configuration and fallback resilience', async (t) => {
  await t.test('GPSTab configuration check reflects environment variable', () => {
    const original = process.env.GPSTAB_API_KEY;
    try {
      delete process.env.GPSTAB_API_KEY;
      assert.strictEqual(isGpsTabConfigured(), false);

      process.env.GPSTAB_API_KEY = 'test-token-123';
      assert.strictEqual(isGpsTabConfigured(), true);

      const config = getGpsTabConfig();
      assert.strictEqual(config.apiKey, 'test-token-123');
      assert.strictEqual(config.baseUrl, 'https://api.gpstab.com/v1');
    } finally {
      if (original !== undefined) {
        process.env.GPSTAB_API_KEY = original;
      } else {
        delete process.env.GPSTAB_API_KEY;
      }
    }
  });

  await t.test('GPSTab autonomous telemetry fallback returns compliant J1939 data', async () => {
    const telemetry = await fetchGpsTabTelemetry('TRK-904');
    assert.strictEqual(telemetry.unitNumber, 'TRK-904');
    assert.ok(telemetry.odometerMiles > 0);
    assert.ok(telemetry.fuelLevelPct > 0);
    assert.strictEqual(typeof telemetry.speedMph, 'number');
    assert.ok(telemetry.source === 'GPSTAB_AUTONOMOUS_CACHE' || telemetry.source === 'GPSTAB_CLOUD_API');
  });

  await t.test('GPSTab Hours of Service fallback returns valid 49 CFR § 395 records', async () => {
    const hos = await fetchGpsTabHos('DRV-101');
    assert.strictEqual(hos.driverId, 'DRV-101');
    assert.strictEqual(hos.fmcsaAttestationVerified, true);
    assert.ok(hos.drivingSecondsRemaining > 0);
    assert.ok(hos.shiftSecondsRemaining > 0);
  });

  await t.test('Commercial ELD profiles array includes GPSTab Flight ELD Gateway', () => {
    const gpsTabProfile = COMMERCIAL_ELD_PROFILES.find((p) => p.id === 'eld-gpstab-direct');
    assert.ok(gpsTabProfile, 'GPSTab hardware profile must exist in COMMERCIAL_ELD_PROFILES');
    assert.strictEqual(gpsTabProfile.vendor, 'GPSTab / TrackEnsure Inc.');
    assert.strictEqual(gpsTabProfile.isRegisteredFmcsa, true);
    assert.strictEqual(gpsTabProfile.connectorType, '9-PIN_DEUTSCH_GREEN');
  });
});
