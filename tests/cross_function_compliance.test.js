import test from 'node:test';
import assert from 'node:assert/strict';
import { crossFunctionMemoryService, DEFAULT_DVIR_COMPONENTS } from '../src/services/crossFunctionMemoryService.ts';
import { dotDocumentsService } from '../src/services/dotDocumentsService.ts';

test('FMCSA & DOT Compliance Cross-Function Subsystem', async (t) => {
  await t.test('1. HOS Rule Engine: accurately tracks and calculates compliance clocks', () => {
    const clocks = crossFunctionMemoryService.getHosClocks();
    assert.ok(clocks.drivingSecondsRemaining >= 0, 'Drive clock must be non-negative');
    assert.ok(clocks.dutyWindowSecondsRemaining >= 0, 'Shift window must be non-negative');
    assert.ok(clocks.restBreakSecondsRemaining >= 0, 'Break clock must be non-negative');
    assert.ok(clocks.cycleSecondsRemaining >= 0, 'Cycle clock must be non-negative');
    assert.ok(clocks.cycleUsedSeconds >= 0, 'Cycle used seconds must be non-negative');
  });

  await t.test('2. HOS Duty Status Switchboard: records timeline event when duty changes', () => {
    const initialClocks = crossFunctionMemoryService.getHosClocks();
    const updated = crossFunctionMemoryService.setDutyStatus('ON');
    assert.strictEqual(updated.currentStatus, 'ON');

    // Switch to Driving
    const drivingClocks = crossFunctionMemoryService.setDutyStatus('D');
    assert.strictEqual(drivingClocks.currentStatus, 'D');

    // Check that event was added to today's RODS
    const todayRods = crossFunctionMemoryService.pullRods(0);
    assert.ok(todayRods.events.length > 0, 'Duty event must be logged in today RODS');
    const lastEvent = todayRods.events[todayRods.events.length - 1];
    assert.strictEqual(lastEvent.dutyStatus, 'D');
  });

  await t.test('3. Adverse Driving Conditions: grants +2 hours extension per 49 CFR § 395.1(b)(1)', () => {
    const baseline = crossFunctionMemoryService.getHosClocks();
    const initialDrive = baseline.drivingSecondsRemaining;
    const initialShift = baseline.dutyWindowSecondsRemaining;

    // Activate adverse conditions
    const extended = crossFunctionMemoryService.toggleAdverseDrivingConditions();
    assert.strictEqual(extended.isAdverseDrivingActive, true);
    assert.strictEqual(extended.drivingSecondsRemaining, initialDrive + 2 * 3600);
    assert.strictEqual(extended.dutyWindowSecondsRemaining, initialShift + 2 * 3600);

    // Deactivate adverse conditions
    const restored = crossFunctionMemoryService.toggleAdverseDrivingConditions();
    assert.strictEqual(restored.isAdverseDrivingActive, false);
    assert.strictEqual(restored.drivingSecondsRemaining, initialDrive);
    assert.strictEqual(restored.dutyWindowSecondsRemaining, initialShift);
  });

  await t.test('4. 34-Hour Restart: resets 70-hour / 8-day cycle clock to full 70:00:00', () => {
    const reset = crossFunctionMemoryService.simulate34HourRestart();
    assert.strictEqual(reset.cycleSecondsRemaining, 70 * 3600);
    assert.strictEqual(reset.cycleUsedSeconds, 0);
    assert.strictEqual(reset.isCycleViolated, false);
    assert.strictEqual(reset.restart34Eligible, true);
  });

  await t.test('5. Split Sleeper Berth Optimizer: verifies 49 CFR § 395.1(g) pairing rules', () => {
    // 7/3 split (valid qualifying pair totaling 10 hours)
    const validSplit = crossFunctionMemoryService.calculateSplitSleeper(7.0, 3.0);
    assert.strictEqual(validSplit.pairMatched, true);
    assert.strictEqual(validSplit.eligible, true);

    // 8/2 split (valid qualifying pair totaling 10 hours)
    const validSplit2 = crossFunctionMemoryService.calculateSplitSleeper(8.0, 2.0);
    assert.strictEqual(validSplit2.pairMatched, true);

    // Invalid split: 5.0 and 4.0 (total 9.0h < 10.0h)
    const invalidSplit = crossFunctionMemoryService.calculateSplitSleeper(5.0, 4.0);
    assert.strictEqual(invalidSplit.pairMatched, false);
    assert.strictEqual(invalidSplit.eligible, false);
  });

  await t.test('6. Pull RODS: pulls 8-day archive, validates 24.0-hour balance and generates compliant CSV', () => {
    const allRods = crossFunctionMemoryService.getAllRods();
    assert.strictEqual(allRods.length, 8, 'Archive must contain exactly 8 days of RODS records');

    // Validate each day totals 24 hours
    allRods.forEach((day, idx) => {
      const sum = day.totalDriveHours + day.totalOnDutyHours + day.totalSleeperHours + day.totalOffDutyHours;
      assert.ok(Math.abs(sum - 24.0) < 0.1, `Day ${idx} hours must balance to 24.0 hours, got ${sum}`);
      assert.ok(day.merkleProofHash.length === 64, 'Each day must carry a 64-character SHA-256 seal');
      assert.ok(day.isCertified, 'Each historical day must be certified');
    });

    // Generate ERoDS CSV
    const csv = crossFunctionMemoryService.generateErodsCsv();
    assert.ok(csv.includes('FMCSA ERoDS 49 CFR Part 395'), 'CSV must contain standard FMCSA header');
    assert.ok(csv.includes('USDOT'), 'CSV must declare carrier USDOT number');
    assert.ok(csv.includes('TotalDriveHours'), 'CSV must declare duty columns');
  });

  await t.test('7. FMCSA Roadside Electronic Data Transfer: transmits ERoDS and receives valid submission receipt', () => {
    const initialDocCount = dotDocumentsService.getDocuments().length;

    const receipt = crossFunctionMemoryService.transmitErods('FMCSA_WEB_SERVICES', 'Badge #4920 Inspection');
    assert.strictEqual(receipt.success, true);
    assert.ok(receipt.submissionReceiptCode.startsWith('FMCSA-'), 'Receipt code must follow FMCSA- prefix');
    assert.strictEqual(receipt.proofHash.length, 64, 'Proof hash must be SHA-256');

    // Must be automatically deposited in the Document Vault under DAILY_LOGS
    const newDocCount = dotDocumentsService.getDocuments().length;
    assert.strictEqual(newDocCount, initialDocCount + 1, 'Transmitted ERoDS must be archived in Document Vault');
  });

  await t.test('8. Electronic DVIR: creates Pre-Trip DVIR with 11 components and registers in Vault', () => {
    const initialVaultDvirs = dotDocumentsService.filterByCategory('VEHICLE_DVIR').length;

    const dvir = crossFunctionMemoryService.createDvir({
      inspectionType: 'PRE_TRIP',
      truckUnit: 'TRK-904',
      trailerUnit: 'TRL-5321',
      odometerMiles: 142850,
      defects: DEFAULT_DVIR_COMPONENTS.map((c, i) => ({ ...c, id: `test-comp-${i}` })),
      conditionSatisfactory: true,
      driverSignature: 'Jeremiah J. Morris (Certified Driver Inspector)',
    });

    assert.ok(dvir.dvirNumber.startsWith('DVIR-'));
    assert.strictEqual(dvir.inspectionType, 'PRE_TRIP');
    assert.strictEqual(dvir.conditionSatisfactory, true);
    assert.strictEqual(dvir.certifiedSafeToOperate, true);
    assert.strictEqual(dvir.status, 'SAFE_PASS');

    // Automatically added to Document Vault under VEHICLE_DVIR
    const updatedVaultDvirs = dotDocumentsService.filterByCategory('VEHICLE_DVIR').length;
    assert.strictEqual(updatedVaultDvirs, initialVaultDvirs + 1, 'New DVIR must be archived in Federal Document Vault');
  });

  await t.test('9. Master Mechanic J1939 Fault Code Integration: imports active DTCs into DVIR checklist', () => {
    const mockFaults = [
      { spn: 3251, fmi: 0, description: 'DPF restriction 84%', system: 'AFTERTREATMENT' },
      { spn: 110, fmi: 3, description: 'Coolant sensor spike', system: 'COOLING' },
    ];

    const checklist = crossFunctionMemoryService.importJ1939FaultsToDvir(mockFaults);
    assert.strictEqual(checklist.length, DEFAULT_DVIR_COMPONENTS.length + 2);
    const dtcItem = checklist.find((c) => c.j1939DtcCode === 'SPN 3251 FMI 0');
    assert.ok(dtcItem, 'SPN 3251 must be present in imported DVIR component list');
    assert.strictEqual(dtcItem.hasDefect, true);
  });

  await t.test('10. Scanned Hardcopy DVIR Upload: archives physical photographed inspection into Federal Vault', () => {
    const initialDocCount = dotDocumentsService.getDocuments().length;

    const scanned = crossFunctionMemoryService.scanAndUploadPaperDvir({
      scannedImageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      inspectionType: 'POST_TRIP',
      truckUnit: 'TRK-904',
      trailerUnit: 'TRL-5321',
      odometerMiles: 142850,
      notes: 'Roadside paper inspection sheet photographed in cab',
    });

    assert.ok(scanned.dvirNumber.startsWith('DVIR-SCAN-'));
    assert.strictEqual(scanned.isScannedPaperUpload, true);
    assert.strictEqual(scanned.certifiedSafeToOperate, true);

    const newDocCount = dotDocumentsService.getDocuments().length;
    assert.strictEqual(newDocCount, initialDocCount + 1, 'Scanned paper DVIR must be persisted in Vault');
  });

  await t.test('11. Zero-Shut-Down Backup Plan: verifies all 6 mandatory federal documents are present in dossier', () => {
    const dossier = crossFunctionMemoryService.getRoadsideAuditDossier();
    assert.ok(dossier.documents.rods8DayPackage.length === 8, 'Dossier must include 8-day pullable RODS package');
    assert.ok(dossier.documents.medicalCardExp.length > 0, 'Dossier must include Medical Card expiration');
    assert.ok(dossier.documents.cdlCardExp.length > 0, 'Dossier must include CDL expiration');
    assert.ok(dossier.documents.annualInspectionExp.length > 0, 'Dossier must include Annual Inspection expiration');
    assert.ok(dossier.documents.iftaCabCardExp.length > 0, 'Dossier must include IFTA / Cab Card expiration');
    assert.ok(dossier.documents.insurancePolicy.length > 0, 'Dossier must include Active Insurance Policy');
    assert.strictEqual(dossier.custodianAttestation.sealVerified, true, 'Custodian attestation seal must be verified');
  });
});
