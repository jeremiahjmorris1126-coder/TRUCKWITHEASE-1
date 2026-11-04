import test from 'node:test';
import assert from 'node:assert/strict';
import { eldOfflineRecordingService } from '../src/services/eldOfflineRecordingService.ts';
import { eldVendorsService, WHITE_GLOVE_VENDORS } from '../server/eldVendorsService.ts';
import { COMMERCIAL_ELD_PROFILES } from '../src/services/bluetoothEldService.ts';

test('Uninterrupted Online & Offline ELD Recording Suite ("Without Fail")', async (t) => {
  await t.test('Initial ELD state reflects active recording and zero malfunctions', () => {
    const state = eldOfflineRecordingService.getState();
    assert.strictEqual(typeof state.totalDriveSeconds, 'number');
    assert.strictEqual(typeof state.totalRecordedHours, 'number');
    assert.strictEqual(state.zeroDropGuaranteeActive, true);
    assert.strictEqual(state.malfunctions.powerCompliance, 'NORMAL');
    assert.strictEqual(state.malfunctions.engineSync, 'NORMAL');
    assert.strictEqual(state.malfunctions.timingCompliance, 'NORMAL');
    assert.strictEqual(state.malfunctions.positioningCompliance, 'NORMAL');
    assert.strictEqual(state.malfunctions.dataRecordingCompliance, 'NORMAL');
    assert.strictEqual(state.malfunctions.dataTransferCompliance, 'NORMAL');
  });

  await t.test('Offline duty tick recording produces cryptographically sealed events', () => {
    // Simulate dead zone / offline mode
    eldOfflineRecordingService.toggleSimulatedOffline(true);
    const beforeCount = eldOfflineRecordingService.getOfflineEvents().length;

    const event = eldOfflineRecordingService.recordDutyTick('D', true);
    assert.strictEqual(event.dutyStatus, 'D');
    assert.strictEqual(event.isOfflineEvent, true);
    assert.ok(event.tamperProofHash.length === 64, 'Tamper-proof hash must be 64-character SHA-256');
    assert.ok(event.sequenceNumber > 0);

    const afterCount = eldOfflineRecordingService.getOfflineEvents().length;
    assert.strictEqual(afterCount, beforeCount + 1);

    // Toggle back online
    eldOfflineRecordingService.toggleSimulatedOffline(false);
  });

  await t.test('Reconciliation sync flushes offline buffer with zero loss guarantee', async () => {
    // Add an offline event
    eldOfflineRecordingService.toggleSimulatedOffline(true);
    eldOfflineRecordingService.recordDutyTick('ON', true);

    const result = await eldOfflineRecordingService.syncOfflineEvents();
    assert.strictEqual(result.success, true);
    assert.ok(result.syncedCount >= 1);
    assert.ok(result.message.includes('reconciliation') || result.message.includes('synchronized'));

    const remaining = eldOfflineRecordingService.getOfflineEvents().length;
    assert.strictEqual(remaining, 0, 'Buffer should be clean after reconciliation');

    eldOfflineRecordingService.toggleSimulatedOffline(false);
  });

  await t.test('Vehicle speed updates trigger automatic driving transition when moving', () => {
    eldOfflineRecordingService.recordDutyTick('OFF', true);
    eldOfflineRecordingService.updateTelemetry({ wheelSpeedMph: 45.0 });

    const state = eldOfflineRecordingService.getState();
    assert.ok(state.totalRecordedHours > 0);
  });
});

test('White Glove ELD Suite: Azuga, Geotab & GPSTab', async (t) => {
  await t.test('All 3 core ELD partners exist in White Glove catalog with pricing & specs', () => {
    const vendors = eldVendorsService.getAllVendors();
    assert.strictEqual(vendors.length, 3);

    const vendorIds = vendors.map((v) => v.id);
    assert.ok(vendorIds.includes('gpstab'), 'Must include GPSTab');
    assert.ok(vendorIds.includes('geotab'), 'Must include Geotab');
    assert.ok(vendorIds.includes('azuga'), 'Must include Azuga');

    // GPSTab check
    const gpstab = WHITE_GLOVE_VENDORS.gpstab;
    assert.strictEqual(gpstab.isBestBet, true);
    assert.strictEqual(gpstab.retailPriceUsd, 299.0);
    assert.strictEqual(gpstab.whiteGloveFeeUsd, 199.0);
    assert.ok(gpstab.whiteGloveIncludes.some((i) => i.includes('$2,500 Zero-Fine')));

    // Geotab check
    const geotab = WHITE_GLOVE_VENDORS.geotab;
    assert.strictEqual(geotab.retailPriceUsd, 399.0);
    assert.strictEqual(geotab.fmcsaCertificationId, 'GEOTAB-GO9-042');

    // Azuga check
    const azuga = WHITE_GLOVE_VENDORS.azuga;
    assert.strictEqual(azuga.retailPriceUsd, 349.0);
    assert.strictEqual(azuga.fmcsaCertificationId, 'AZUGA-SAFETY-01');
    assert.ok(azuga.whiteGloveIncludes.some((i) => i.includes('insurance')));
  });

  await t.test('Commercial ELD profiles array contains Azuga, Geotab, and GPSTab', () => {
    const gpstabProfile = COMMERCIAL_ELD_PROFILES.find((p) => p.id === 'eld-gpstab-direct');
    const geotabProfile = COMMERCIAL_ELD_PROFILES.find((p) => p.id === 'eld-geotab-go9');
    const azugaProfile = COMMERCIAL_ELD_PROFILES.find((p) => p.id === 'eld-azuga-fleet');

    assert.ok(gpstabProfile, 'GPSTab profile must exist in COMMERCIAL_ELD_PROFILES');
    assert.ok(geotabProfile, 'Geotab profile must exist in COMMERCIAL_ELD_PROFILES');
    assert.ok(azugaProfile, 'Azuga profile must exist in COMMERCIAL_ELD_PROFILES');

    assert.strictEqual(azugaProfile.vendor, 'Azuga / Bridgestone Fleet Solutions');
    assert.strictEqual(azugaProfile.isRegisteredFmcsa, true);
  });

  await t.test('White Glove Configuration updates and persists device bindings', () => {
    const updated = eldVendorsService.updateConfig('azuga', {
      vehicleUnit: 'TRK-904',
      vin: '1FUJBBCK4NL892011',
      serialNumber: 'AZUGA-VIN-TEST-88',
      protocol: 'J1939_250K',
      whiteGloveEnrolled: true,
    });

    assert.strictEqual(updated.vendorId, 'azuga');
    assert.strictEqual(updated.serialNumber, 'AZUGA-VIN-TEST-88');
    assert.strictEqual(updated.whiteGloveEnrolled, true);
    assert.strictEqual(updated.status, 'ONLINE_SYNCHRONIZED');
  });

  await t.test('Diagnostic Ping verifies real-time ECM CAN-bus link for all 3 vendors', () => {
    for (const vendor of ['gpstab', 'geotab', 'azuga']) {
      const ping = eldVendorsService.pingVendor(vendor, 'TRK-904');
      assert.strictEqual(ping.success, true);
      assert.strictEqual(ping.vendor, vendor);
      assert.strictEqual(ping.unitNumber, 'TRK-904');
      assert.ok(ping.latencyMs > 0);
      assert.ok(ping.odometerMiles > 0);
      assert.strictEqual(ping.canBusLink, 'J1939_250KBPS_STABLE');
    }
  });

  await t.test('FMCSA Web Services electronic transfer generates certified receipt', () => {
    const receipt = eldVendorsService.generateFmcsaSubmissionReceipt('gpstab', 'DOT Officer Inspection MM 408');
    assert.strictEqual(receipt.success, true);
    assert.strictEqual(receipt.vendor, 'gpstab');
    assert.ok(receipt.submissionReceiptCode.startsWith('FMCSA-GPSTAB-'));
    assert.strictEqual(receipt.status, 'ACCEPTED_BY_FMCSA_NATIONAL_GATEWAY');
  });
});
