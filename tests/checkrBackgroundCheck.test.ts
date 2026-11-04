import test from 'node:test';
import assert from 'node:assert/strict';
import { checkrService, isPoBox, validateCheckrAddress } from '../server/checkr/checkrService.ts';
import { CallerIdentity } from '../server/data/fleetStore.ts';
import { CreateCandidateRequest } from '../server/checkr/types.ts';

const FLEET1_ADMIN: CallerIdentity = { uid: 'adm-f1-checkr', role: 'fleet_admin', fleetId: 'FLEET1' };
const FLEET2_ADMIN: CallerIdentity = { uid: 'adm-f2-checkr', role: 'fleet_admin', fleetId: 'FLEET2' };
const UNAUTHENTICATED: CallerIdentity = { uid: '', role: 'driver', fleetId: null };

test('Checkr Class A - 1. Address Validation: Prohibits PO Box and enforces 49 CFR § 391.21 residential requirement', () => {
  // Test PO Box regex
  assert.equal(isPoBox('P.O. Box 452'), true);
  assert.equal(isPoBox('PO Box 1029'), true);
  assert.equal(isPoBox('Post Office Box 88'), true);
  assert.equal(isPoBox('1240 Industrial Blvd'), false);
  assert.equal(isPoBox('450 Commerce Pkwy Ste 200'), false);

  // Address validation rejects PO Box
  const poBoxResult = validateCheckrAddress({
    street: 'PO Box 1234',
    city: 'Dallas',
    state: 'TX',
    zip: '75201',
    country: 'US',
    isPhysicalResidential: true,
  });
  assert.equal(poBoxResult.valid, false);
  assert.ok(poBoxResult.errors.some((e) => e.includes('PO Box addresses are prohibited')));

  // Address validation rejects invalid state or ZIP
  const invalidZipResult = validateCheckrAddress({
    street: '1240 Industrial Blvd',
    city: 'Dallas',
    state: 'TEXAS', // Must be 2-letter
    zip: '752',     // Invalid ZIP
    country: 'US',
    isPhysicalResidential: true,
  });
  assert.equal(invalidZipResult.valid, false);
  assert.ok(invalidZipResult.errors.length >= 2);

  // Valid residential physical address passes
  const validResult = validateCheckrAddress({
    street: '1240 Industrial Blvd',
    unit: 'Ste 400',
    city: 'Dallas',
    state: 'TX',
    zip: '75207',
    country: 'US',
    isPhysicalResidential: true,
  });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);
});

test('Checkr Class A - 2. Candidate Creation: Validates CDL credentials and multi-tenant fleet scoping', async () => {
  // Unauthenticated request rejected
  let unauthFailed = false;
  try {
    await checkrService.createCandidateScreening(UNAUTHENTICATED, {
      driverId: 'drv-unauth',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      phone: '555-1234',
      dob: '1985-01-01',
      ssnLast4: '1234',
      cdlNumber: 'CDL123',
      cdlState: 'TX',
      currentAddress: { street: '123 Main', city: 'Dallas', state: 'TX', zip: '75201', country: 'US', isPhysicalResidential: true },
    });
  } catch (err: any) {
    unauthFailed = true;
    assert.equal(err.statusCode, 401);
  }
  assert.equal(unauthFailed, true, 'Unauthenticated candidate creation must fail with 401');

  // Missing CDL rejected
  let missingCdlFailed = false;
  try {
    await checkrService.createCandidateScreening(FLEET1_ADMIN, {
      driverId: 'drv-test-01',
      firstName: 'Marcus',
      lastName: 'Reynolds',
      email: 'marcus@test.com',
      phone: '555-8910',
      dob: '1988-04-12',
      ssnLast4: '9912',
      cdlNumber: '', // Missing
      cdlState: 'TX',
      currentAddress: { street: '123 Main', city: 'Dallas', state: 'TX', zip: '75201', country: 'US', isPhysicalResidential: true },
    });
  } catch (err: any) {
    missingCdlFailed = true;
    assert.equal(err.statusCode, 400);
  }
  assert.equal(missingCdlFailed, true, 'Missing CDL number must fail with 400');

  // Valid Class A candidate created
  const candidateReq: CreateCandidateRequest = {
    driverId: 'drv-f1-checkr-01',
    firstName: 'Marcus',
    lastName: 'Reynolds',
    email: 'marcus.reynolds@fleetone.com',
    phone: '+1-555-224-8192',
    dob: '1982-08-24',
    ssnLast4: '4192',
    cdlNumber: 'CDL-TX-998201',
    cdlState: 'TX',
    cdlClass: 'A',
    currentAddress: {
      street: '400 Commerce Way',
      city: 'Fort Worth',
      state: 'TX',
      zip: '76102',
      country: 'US',
      isPhysicalResidential: true,
    },
    packageType: 'class_a_full_mvr_clearinghouse',
  };

  const record = await checkrService.createCandidateScreening(FLEET1_ADMIN, candidateReq);
  assert.ok(record.id.startsWith('chkr-'));
  assert.equal(record.fleetId, 'FLEET1');
  assert.equal(record.status, 'INVITATION_SENT');
  assert.equal(record.addressMismatchDetected, false);
  assert.ok(record.invitationUrl.includes('invitations.checkr.com/candidates/'));
  assert.ok(record.redirectUrl.includes('/vault?checkr_status=completed'));
  assert.ok(record.merkleProofSha256.length === 64, 'Must have valid SHA-256 Merkle proof');
});

test('Checkr Class A - 3. Address Mismatch Detection: Flags jurisdictional divergence between domicile and CDL state', async () => {
  const mismatchReq: CreateCandidateRequest = {
    driverId: 'drv-f1-mismatch',
    firstName: 'Travis',
    lastName: 'Vance',
    email: 'travis@fleetone.com',
    phone: '+1-555-901-2910',
    dob: '1990-03-15',
    ssnLast4: '3819',
    cdlNumber: 'CDL-OK-448102',
    cdlState: 'OK', // CDL issued in Oklahoma
    cdlClass: 'A',
    currentAddress: {
      street: '882 North Central Expressway',
      city: 'Richardson',
      state: 'TX',  // Domiciled in Texas
      zip: '75080',
      country: 'US',
      isPhysicalResidential: true,
    },
  };

  const record = await checkrService.createCandidateScreening(FLEET1_ADMIN, mismatchReq);
  assert.equal(record.addressMismatchDetected, true, 'Address mismatch must be detected');
  assert.ok(record.addressMismatchDetails?.includes('differs from CDL issuing jurisdiction'));
});

test('Checkr Class A - 4. Scenario Testing Matrix: Works through all possible lifecycle outcomes', async () => {
  // Create base candidate
  const baseReq: CreateCandidateRequest = {
    driverId: 'drv-f1-scenarios',
    firstName: 'Devon',
    lastName: 'Miller',
    email: 'devon@fleetone.com',
    phone: '+1-555-442-1092',
    dob: '1987-11-04',
    ssnLast4: '5512',
    cdlNumber: 'CDL-TX-551201',
    cdlState: 'TX',
    cdlClass: 'A',
    currentAddress: {
      street: '720 Elm Street',
      city: 'Dallas',
      state: 'TX',
      zip: '75202',
      country: 'US',
      isPhysicalResidential: true,
    },
  };

  const screening = await checkrService.createCandidateScreening(FLEET1_ADMIN, baseReq);

  // Scenario 1: CLEAR
  const clearRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'CLEAR');
  assert.equal(clearRecord.status, 'CLEAR');
  assert.equal(clearRecord.mvrResult?.licenseStatus, 'VALID');
  assert.equal(clearRecord.mvrResult?.points, 0);
  assert.equal(clearRecord.clearinghouseResult?.result, 'NOT_PROHIBITED');
  assert.equal(clearRecord.pspResult?.fmcsaPspScore, 98);
  assert.equal(clearRecord.criminalResult?.countyCriminalClear, true);

  // Scenario 2: CONSIDER
  const considerRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'CONSIDER');
  assert.equal(considerRecord.status, 'CONSIDER');
  assert.equal(considerRecord.mvrResult?.points, 4);
  assert.equal(considerRecord.mvrResult?.violationsCount, 1);
  assert.ok(considerRecord.mvrResult?.violations[0].description.includes('Speeding 16-20 MPH'));

  // Scenario 3: SUSPENDED_DOCUMENT_REQUIRED
  const suspendedRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'SUSPENDED_DOCUMENT_REQUIRED');
  assert.equal(suspendedRecord.status, 'SUSPENDED');
  assert.ok(suspendedRecord.notes.includes('Checkr action required'));

  // Scenario 4: PRE_ADVERSE_ACTION
  const preAdverseRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'PRE_ADVERSE_ACTION');
  assert.equal(preAdverseRecord.status, 'ADVERSE_ACTION_PENDING');
  assert.ok(preAdverseRecord.adverseAction?.disputeDeadline);
  assert.equal(preAdverseRecord.adverseAction?.summaryOfRightsProvided, true);

  // Scenario 5: DISPUTE_FILED
  const disputeRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'DISPUTE_FILED');
  assert.equal(disputeRecord.status, 'DISPUTED');
  assert.ok(disputeRecord.notes.includes('Driver filed formal FCRA dispute'));

  // Scenario 6: EXPIRED
  const expiredRecord = await checkrService.simulateScenario(FLEET1_ADMIN, screening.id, 'EXPIRED');
  assert.equal(expiredRecord.status, 'EXPIRED');
  assert.ok(expiredRecord.notes.includes('Annual Review EXPIRED'));
});

test('Checkr Class A - 5. Multi-Tenant Fleet Isolation: FLEET2 cannot view or manipulate FLEET1 screenings', async () => {
  const req: CreateCandidateRequest = {
    driverId: 'drv-f1-isolated',
    firstName: 'Kyle',
    lastName: 'Hudson',
    email: 'kyle@fleetone.com',
    phone: '+1-555-771-8291',
    dob: '1980-05-18',
    ssnLast4: '7192',
    cdlNumber: 'CDL-TX-719201',
    cdlState: 'TX',
    cdlClass: 'A',
    currentAddress: {
      street: '1500 Express Lane',
      city: 'Mesquite',
      state: 'TX',
      zip: '75149',
      country: 'US',
      isPhysicalResidential: true,
    },
  };

  const created = await checkrService.createCandidateScreening(FLEET1_ADMIN, req);

  // FLEET1 can read
  const f1Read = await checkrService.getScreening(FLEET1_ADMIN, created.id);
  assert.ok(f1Read);
  assert.equal(f1Read?.id, created.id);

  // FLEET2 reading returns null (fail-closed, zero leakage)
  const f2Read = await checkrService.getScreening(FLEET2_ADMIN, created.id);
  assert.equal(f2Read, null, 'FLEET2 must not see FLEET1 screening record');

  // FLEET2 attempting to simulate scenario on FLEET1 fails with 404
  let f2SimFailed = false;
  try {
    await checkrService.simulateScenario(FLEET2_ADMIN, created.id, 'CLEAR');
  } catch (err: any) {
    f2SimFailed = true;
    assert.equal(err.statusCode, 404);
  }
  assert.equal(f2SimFailed, true, 'Cross-tenant mutation must fail with 404');
});

test('Checkr Class A - 6. Webhook Processing: Handles incoming Checkr webhooks and updates record state', async () => {
  const req: CreateCandidateRequest = {
    driverId: 'drv-f1-webhook',
    firstName: 'Sam',
    lastName: 'Fisher',
    email: 'sam@fleetone.com',
    phone: '+1-555-881-2918',
    dob: '1979-12-01',
    ssnLast4: '9921',
    cdlNumber: 'CDL-TX-992101',
    cdlState: 'TX',
    cdlClass: 'A',
    currentAddress: {
      street: '330 Logistics Way',
      city: 'Irving',
      state: 'TX',
      zip: '75038',
      country: 'US',
      isPhysicalResidential: true,
    },
  };

  const record = await checkrService.createCandidateScreening(FLEET1_ADMIN, req);

  // Webhook: invitation.completed
  const invRes = await checkrService.handleWebhook({
    id: 'evt_test_01',
    type: 'invitation.completed',
    data: { candidate_id: record.candidateId },
  });
  assert.equal(invRes.handled, true);

  const updatedInv = await checkrService.getScreening(FLEET1_ADMIN, record.id);
  assert.equal(updatedInv?.status, 'CONSENT_SIGNED');

  // Webhook: report.completed with result CLEAR
  const repRes = await checkrService.handleWebhook({
    id: 'evt_test_02',
    type: 'report.completed',
    data: { candidate_id: record.candidateId, result: 'CLEAR' },
  });
  assert.equal(repRes.handled, true);

  const updatedRep = await checkrService.getScreening(FLEET1_ADMIN, record.id);
  assert.equal(updatedRep?.status, 'CLEAR');
  assert.equal(updatedRep?.mvrResult?.licenseStatus, 'VALID');
});
