import test from 'node:test';
import assert from 'node:assert/strict';
import { dvirService, MANDATORY_DVIR_COMPONENTS } from '../server/dvir/dvirService.ts';
import { invoiceService } from '../server/invoices/invoiceService.ts';
import { signedUploadService } from '../server/storage/signedUploadService.ts';
import { detentionService } from '../server/detention/detentionService.ts';
import { CallerIdentity } from '../server/data/fleetStore.ts';

const FLEET1_DRIVER: CallerIdentity = { uid: 'drv-f1-test', role: 'driver', fleetId: 'FLEET1' };
const FLEET1_ADMIN: CallerIdentity = { uid: 'adm-f1-test', role: 'fleet_admin', fleetId: 'FLEET1' };
const FLEET2_DRIVER: CallerIdentity = { uid: 'drv-f2-test', role: 'driver', fleetId: 'FLEET2' };
const FLEET2_ADMIN: CallerIdentity = { uid: 'adm-f2-test', role: 'fleet_admin', fleetId: 'FLEET2' };
const UNAUTHENTICATED: CallerIdentity = { uid: '', role: 'driver', fleetId: null };

test('Phase 3 - 1. DVIR: Rejects uncertified submission and enforced defect checklist', async () => {
  // Rejects unauthenticated caller
  let unauthError = false;
  try {
    await dvirService.createDvir(UNAUTHENTICATED, { unitNumber: 'TRK-101', odometer: 120500 });
  } catch (err: any) {
    unauthError = true;
    assert.equal(err.statusCode, 401);
  }
  assert.equal(unauthError, true, 'Unauthenticated DVIR creation must fail with 401');

  // Rejects missing driver certification signature
  let uncertifiedError = false;
  try {
    await dvirService.createDvir(FLEET1_DRIVER, {
      unitNumber: 'TRK-101',
      odometer: 120500,
      certifiedBy: '', // Missing signature
      defects: [{ component: 'Brakes', hasDefect: false }],
      safeToOperate: true,
    });
  } catch (err: any) {
    uncertifiedError = true;
    assert.equal(err.statusCode, 400);
    assert.ok(err.message.includes('certification signature'));
  }
  assert.equal(uncertifiedError, true, 'DVIR cannot be submitted without driver signature');

  // Rejects empty defect checklist (cannot default to "no defects")
  let emptyDefectsError = false;
  try {
    await dvirService.createDvir(FLEET1_DRIVER, {
      unitNumber: 'TRK-101',
      odometer: 120500,
      certifiedBy: 'Marcus Driver',
      defects: [], // Empty checklist
      safeToOperate: true,
    });
  } catch (err: any) {
    emptyDefectsError = true;
    assert.equal(err.statusCode, 400);
    assert.ok(err.message.includes('can never default to "no defects"'));
  }
  assert.equal(emptyDefectsError, true, 'DVIR cannot default to no defects without component evaluation');

  // Rejects OUT_OF_SERVICE defect certified as safe to operate
  let oosSafetyError = false;
  try {
    await dvirService.createDvir(FLEET1_DRIVER, {
      unitNumber: 'TRK-101',
      odometer: 120500,
      certifiedBy: 'Marcus Driver',
      defects: [{ component: 'Service Brakes & Air Lines', hasDefect: true, severity: 'OUT_OF_SERVICE' }],
      safeToOperate: true, // Impossible: cannot be safe with OOS defect
    });
  } catch (err: any) {
    oosSafetyError = true;
    assert.equal(err.statusCode, 400);
    assert.ok(err.message.includes('OUT_OF_SERVICE'));
  }
  assert.equal(oosSafetyError, true, 'Vehicle with OUT_OF_SERVICE defect cannot be declared safe');
});

test('Phase 3 - 2. DVIR: Successful creation, listing, and multi-tenant isolation', async () => {
  // Successful creation with real defect checklist & driver signature
  const created = await dvirService.createDvir(FLEET1_DRIVER, {
    unitNumber: 'TRK-101',
    odometer: 145200,
    type: 'PRE_TRIP',
    certifiedBy: 'Marcus Vance, CDL-A',
    defects: MANDATORY_DVIR_COMPONENTS.map((c) => ({
      component: c,
      hasDefect: c.toLowerCase().includes('wiper'), // Flag windshield wipers minor defect
      severity: c.toLowerCase().includes('wiper') ? 'MINOR' : undefined,
      notes: c.toLowerCase().includes('wiper') ? 'Left blade streaking' : undefined,
    })),
    safeToOperate: true,
    defectNotes: 'Replaced wiper blade at staging lot. Safe for interstate departure.',
  });

  assert.equal(created.fleetId, 'FLEET1');
  assert.equal(created.driverId, FLEET1_DRIVER.uid);
  assert.equal(created.hasDefects, true);
  assert.equal(created.safeToOperate, true);
  assert.equal(created.status, 'CERTIFIED_SAFE');

  // FLEET1_DRIVER can view their own DVIR
  const ownDvir = await dvirService.getDvirById(FLEET1_DRIVER, created.id);
  assert.ok(ownDvir);
  assert.equal(ownDvir.id, created.id);

  // Cross-tenant probe: FLEET2_DRIVER receives 404 (existence not revealed)
  const crossDvir = await dvirService.getDvirById(FLEET2_DRIVER, created.id);
  assert.equal(crossDvir, null, 'Cross-tenant DVIR probe must return null (404)');

  // List scoped to FLEET1
  const fleet1List = await dvirService.listDvir(FLEET1_DRIVER);
  assert.ok(fleet1List.some((d) => d.id === created.id));

  // FLEET2 list contains 0 documents from FLEET1
  const fleet2List = await dvirService.listDvir(FLEET2_DRIVER);
  assert.equal(fleet2List.some((d) => d.id === created.id), false);

  // 49 CFR § 396.11(a)(3)(i): Carrier/mechanic repair certification
  const repaired = await dvirService.certifyRepair(FLEET1_ADMIN, created.id, {
    certifiedBy: 'John Miller, Certified Fleet Mechanic #404',
    repairStatus: 'REPAIR_COMPLETED',
    notes: 'Replaced left windshield wiper blade assembly with OEM Bosch 28-inch.',
  });
  assert.equal(repaired.status, 'REPAIRED');
  assert.equal(repaired.repairCertification?.certifiedBy, 'John Miller, Certified Fleet Mechanic #404');
  assert.equal(repaired.repairCertification?.repairStatus, 'REPAIR_COMPLETED');

  // 49 CFR § 396.11(a)(3)(ii): Next driver review and sign-off
  const reviewed = await dvirService.reviewPreviousDvir(FLEET1_DRIVER, created.id, {
    reviewedBy: 'Marcus Vance, Departing CDL-A Driver',
    signatureAcknowledged: true,
    notes: 'Verified new wiper blade operates cleanly with zero streaks.',
  });
  assert.equal(reviewed.status, 'CERTIFIED_SAFE');
  assert.equal(reviewed.driverReview?.signatureAcknowledged, true);
  assert.equal(reviewed.driverReview?.reviewedBy, 'Marcus Vance, Departing CDL-A Driver');
});

test('Phase 3 - 3. Fuel Logs & Expenses: Creation and tenant isolation', async () => {
  // 1. Create fuel log
  const fuelLog = await invoiceService.createFuelLog(FLEET1_DRIVER, {
    date: '2026-11-01',
    gallons: 110.5,
    pricePerGallon: 3.849,
    currentOdometer: 145500,
    previousOdometer: 144800,
    stationName: "Love's Travel Stop #812",
    city: 'Festus',
    state: 'MO',
  });

  assert.equal(fuelLog.fleetId, 'FLEET1');
  assert.equal(fuelLog.gallons, 110.5);
  assert.equal(fuelLog.milesDriven, 700);
  assert.equal(fuelLog.fuelMpg, 6.33);

  // 2. Create expense
  const expense = await invoiceService.createExpense(FLEET1_DRIVER, {
    date: '2026-11-01',
    category: 'MAINTENANCE',
    amount: 42.50,
    vendor: 'TA Truck Service',
    description: 'Heavy duty wiper blade replacement',
  });

  assert.equal(expense.fleetId, 'FLEET1');
  assert.equal(expense.amount, 42.50);

  // 3. Multi-tenant isolation: FLEET2 cannot read FLEET1 fuel logs or expenses
  const fleet2Fuel = await invoiceService.listFuelLogs(FLEET2_DRIVER);
  assert.equal(fleet2Fuel.some((f) => f.id === fuelLog.id), false);

  const fleet2Exp = await invoiceService.listExpenses(FLEET2_DRIVER);
  assert.equal(fleet2Exp.some((e) => e.id === expense.id), false);
});

test('Phase 3 - 4. Freight Invoices: Money owed to driver/carrier & multi-tenant isolation', async () => {
  const invoice = await invoiceService.createInvoice(FLEET1_ADMIN, {
    brokerCarrierName: 'CH Robinson Freight Services',
    brokerEmail: 'billing@chrobinson-freight.com',
    amountUsd: 2850.00,
    lineItems: [
      { description: 'Linehaul Freight Transit St. Louis to Dallas', amount: 2700.00, type: 'FREIGHT' },
      { description: '2 Hours Billable Facility Detention', amount: 150.00, type: 'DETENTION' },
    ],
    status: 'ISSUED',
  });

  assert.equal(invoice.fleetId, 'FLEET1');
  assert.equal(invoice.amountUsd, 2850.00);
  assert.equal(invoice.lineItems.length, 2);

  // FLEET1 can retrieve invoice
  const retrieved = await invoiceService.getInvoiceById(FLEET1_DRIVER, invoice.id);
  assert.ok(retrieved);
  assert.equal(retrieved.invoiceNumber, invoice.invoiceNumber);

  // FLEET2 cannot read FLEET1 invoice (returns null / 404)
  const crossInvoice = await invoiceService.getInvoiceById(FLEET2_DRIVER, invoice.id);
  assert.equal(crossInvoice, null, 'Cross-tenant invoice query must return null (404)');
});

test('Phase 3 - 5. Private Storage Signed URLs: 15-minute expiration & private scoping', async () => {
  // Rejects unauthenticated request
  let unauthError = false;
  try {
    await signedUploadService.generateUploadUrl(UNAUTHENTICATED, {
      fileName: 'bol_proof.jpg',
      contentType: 'image/jpeg',
    });
  } catch (err: any) {
    unauthError = true;
    assert.equal(err.statusCode, 401);
  }
  assert.equal(unauthError, true);

  // Generates short-lived private signed upload URL
  const signed = await signedUploadService.generateUploadUrl(FLEET1_DRIVER, {
    fileName: 'dvir_brake_pad.jpg',
    contentType: 'image/jpeg',
    documentType: 'dvir',
  });

  assert.equal(signed.isPrivateBucket, true);
  assert.ok(signed.uploadUrl.startsWith('/api/storage/upload/'));
  assert.ok(signed.objectPath.startsWith(`private/fleet_FLEET1/driver_${FLEET1_DRIVER.uid}/dvir/`));

  // Token is valid
  const token = signed.uploadUrl.replace('/api/storage/upload/', '');
  const verified = signedUploadService.verifyUploadToken(token);
  assert.equal(verified.valid, true);
  assert.equal(verified.record.fleetId, 'FLEET1');

  // Invalid token rejected
  const badToken = signedUploadService.verifyUploadToken('invalid-fake-token-xyz');
  assert.equal(badToken.valid, false);
});

test('Phase 3 - 6. Detention: Phone GPS labeled in evidence packet & rate con enforcement', async () => {
  const vehicleId = 'TRK-DET-F1';

  // 1. Rejects startStop without ratePerHour and freeMinutes
  let missingRateError = false;
  try {
    await detentionService.startStop(FLEET1_DRIVER, vehicleId, {
      stopId: 'stop-001',
      loadId: 'load-no-rate',
      kind: 'delivery',
      // No ratePerHour, no freeMinutes
    });
  } catch (err: any) {
    missingRateError = true;
    assert.equal(err.statusCode, 400);
    assert.ok(err.message.includes('rate per hour must be explicitly provided'));
  }
  assert.equal(missingRateError, true, 'Detention without explicit rate confirmation terms must be rejected');

  // 2. Start stop with explicit rate confirmation terms ($75/hr, 120 mins free time)
  await detentionService.startStop(FLEET1_DRIVER, vehicleId, {
    stopId: 'stop-002',
    loadId: 'load-valid-01',
    kind: 'delivery',
    ratePerHour: 75.0,
    freeMinutes: 120,
    facilityName: 'Dallas Distribution Hub Door 4',
  });

  // 3. Ingest driver phone GPS events
  const arrivalTime = Date.now() - 180 * 60 * 1000; // 3 hours ago
  const events = [
    { type: 'gps' as const, ts: arrivalTime, lat: 32.7767, lng: -96.7970, speedMph: 0, source: 'phone_gps' as const },
    { type: 'door' as const, ts: arrivalTime + 10 * 60 * 1000, state: 'open' as const },
    { type: 'gps' as const, ts: Date.now(), lat: 32.7767, lng: -96.7970, speedMph: 0, source: 'phone_gps' as const },
  ];

  await detentionService.ingestEvents(vehicleId, events);

  // 4. Status reflects on-site dwell
  const status = await detentionService.getStatus(vehicleId);
  assert.ok(status);
  assert.equal(status.status, 'on_site');
  assert.equal(status.ratePerHour, 75.0);
  assert.equal(status.freeMinutes, 120);
  assert.ok(status.dwellMinutes >= 170);
  assert.ok(status.detentionMinutes >= 50);

  // 5. Finalize stop: verify phone GPS is labeled in evidence packet
  const finalized = await detentionService.finalize(FLEET1_DRIVER, vehicleId);
  assert.ok(finalized.packet);
  assert.ok(finalized.packet.integrity.hash);

  const phoneGpsEntries = finalized.packet.gpsTrail.filter((g) => g.source === 'PHONE_GPS');
  assert.ok(phoneGpsEntries.length > 0, 'Driver phone GPS points must be labeled as PHONE_GPS in evidence packet');
  assert.equal(phoneGpsEntries[0].source, 'PHONE_GPS');

  // 6. Cross-tenant isolation on finalize
  // Finalizing again or another fleet's stop returns 404
  let crossFinalizeBlocked = false;
  try {
    await detentionService.finalize(FLEET2_DRIVER, vehicleId);
  } catch (err: any) {
    crossFinalizeBlocked = true;
    assert.equal(err.statusCode, 404);
  }
  assert.equal(crossFinalizeBlocked, true);
});
