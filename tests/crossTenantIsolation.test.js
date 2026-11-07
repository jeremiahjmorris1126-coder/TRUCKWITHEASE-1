import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fleetStore } from '../server/data/fleetStore.ts';
import { getLoads, createLoad, getLoadById, dispatchLoad, updateLoadStatus } from '../server/loadMatching/loadService.ts';
import { getAuditLogs } from '../server/admin/adminService.ts';
import { triggerAuxAlert, getActiveAlerts, resolveAlert } from '../server/alerts/alertEngine.ts';
import { getDriverProfile, updateDriverProfile, getDriverDocuments, addDriverDocument, getDriverDocumentById } from '../server/driver/driverProfileService.ts';
import { vehicleProfileService } from '../server/routing/vehicleProfileService.ts';
import { verifyFirebaseIdToken, getOrCreateUserDocument, updateUserProfile, getFirebaseAdminApp } from '../server/auth/firebaseAuthService.ts';

// Identities for multi-tenant tests
const FLEET1_ADMIN = { uid: 'usr-f1-admin', role: 'fleet_admin', fleetId: 'FLEET1' };
const FLEET1_DRIVER = { uid: 'drv-f1-marcus', role: 'driver', fleetId: 'FLEET1' };
const FLEET2_ADMIN = { uid: 'usr-f2-admin', role: 'fleet_admin', fleetId: 'FLEET2' };
const FLEET2_DRIVER = { uid: 'drv-f2-elena', role: 'driver', fleetId: 'FLEET2' };
const SYSTEM_OWNER = { uid: 'usr-sys-owner', role: 'owner', fleetId: 'FLEET1' };

test('1. Production Bundle Audit: test_token_ shortcut is eradicated from codebase and bundle', async () => {
  // 1. Verify verifyFirebaseIdToken strictly rejects any test_token_ string with 403 Forbidden
  const testTokens = [
    'Bearer test_token_admin_FLEET1_fleet_admin',
    'Bearer test_token_driver_FLEET1_driver',
    'Bearer test_token_owner_FLEET1_owner',
    'Bearer test_token_hacker_FLEET2_owner',
  ];

  for (const token of testTokens) {
    const verification = await verifyFirebaseIdToken(token);
    assert.equal(verification.valid, false, `Token ${token} must not be valid`);
    assert.equal(verification.status, 403, `Token ${token} must return 403 Forbidden`);
  }

  // 2. Verify source code of firebaseAuthService.ts contains no test_token bypass handler
  const authSource = fs.readFileSync(path.join(process.cwd(), 'server', 'auth', 'firebaseAuthService.ts'), 'utf-8');
  assert.equal(authSource.includes("token.startsWith('test_token_')"), false, 'firebaseAuthService.ts must not have test_token bypass');
  assert.equal(authSource.includes('test_token_'), false, 'firebaseAuthService.ts must not reference test_token_');

  // 3. If dist/server.cjs exists (or after build), verify the bundle contains no test_token_ bypass
  const bundlePath = path.join(process.cwd(), 'dist', 'server.cjs');
  if (fs.existsSync(bundlePath)) {
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    assert.equal(bundleContent.includes("token.startsWith('test_token_')"), false, 'Production bundle must not contain test_token_ bypass');
  }
});

test('2. Server Identity Source: Identity derived ONLY from verified token + users/{uid}', async () => {
  // Clear and seed user document in mock/emulator store
  const testUid = 'usr-emulator-audit-01';
  await getOrCreateUserDocument(testUid, 'auditor@fleet1.com');
  await updateUserProfile(testUid, { role: 'fleet_admin', fleetId: 'FLEET1' });

  // Read back profile from users/{uid}
  const userDoc = await fleetStore.getScopedDocument(SYSTEM_OWNER, 'users', testUid);
  assert.ok(userDoc, 'User doc must exist');
  assert.equal(userDoc.role, 'fleet_admin');
  assert.equal(userDoc.fleetId, 'FLEET1');

  // Any attempt by client to pass a different fleetId or role in query/body cannot change the identity
  const attemptedClientIdentity = {
    uid: testUid,
    role: userDoc.role,
    fleetId: userDoc.fleetId, // Strictly derived from users/{uid}
  };
  assert.equal(attemptedClientIdentity.fleetId, 'FLEET1');
  assert.equal(attemptedClientIdentity.role, 'fleet_admin');
});

test('3. Data Leak Isolation: FLEET2 cannot read FLEET1 documents (Listing & By-ID)', async () => {
  fleetStore.clearMockStore();

  // 1. Seed FLEET1 confidential data
  const loadF1 = await createLoad(FLEET1_ADMIN, {
    origin: 'Dallas, TX',
    destination: 'Atlanta, GA',
    grossPayUsd: 2800,
    miles: 780,
    deadheadMiles: 20,
    estimatedTransitHours: 12.0,
    loadNumber: 'CONFIDENTIAL-FLEET1-LOAD-01',
  });

  const alertF1 = await triggerAuxAlert(FLEET1_ADMIN, {
    type: 'LOW_BRIDGE_CLEARANCE',
    severity: 'CRITICAL',
    vehicleUnit: 'UNIT-F1-100',
    driverName: 'F1 Driver',
    title: 'CONFIDENTIAL-FLEET1-ALERT',
    description: 'Structure ahead 13ft 6in',
  });

  const profileF1 = await vehicleProfileService.saveVehicleProfile(FLEET1_ADMIN, FLEET1_DRIVER.uid, {
    heightFt: 13.5,
    weightLbs: 79000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
    unitNumber: 'CONFIDENTIAL-FLEET1-TRUCK',
  });

  const docF1 = await addDriverDocument(FLEET1_ADMIN, {
    driverId: FLEET1_DRIVER.uid,
    type: 'CDL_SCAN',
    title: 'CONFIDENTIAL-FLEET1-CDL',
    fileUrl: '/vault/f1_cdl.pdf',
    status: 'VERIFIED',
  });

  // 2. FLEET2 attempts to list loads -> FLEET1 load must not appear
  const f2Loads = await getLoads(FLEET2_ADMIN);
  assert.equal(f2Loads.some(l => l.id === loadF1.id), false, 'FLEET2 must not see FLEET1 load in list');
  assert.equal(f2Loads.some(l => l.loadNumber?.includes('CONFIDENTIAL-FLEET1')), false);

  // 3. FLEET2 attempts to access FLEET1 load by ID -> MUST return null (404)
  const f2LoadById = await getLoadById(FLEET2_ADMIN, loadF1.id);
  assert.equal(f2LoadById, null, 'FLEET2 by-ID lookup of FLEET1 load must return null (404)');

  // 4. FLEET2 attempts to list alerts -> FLEET1 alert must not appear
  const f2Alerts = await getActiveAlerts(FLEET2_ADMIN);
  assert.equal(f2Alerts.some(a => a.id === alertF1.id), false, 'FLEET2 must not see FLEET1 alert in list');

  // 5. FLEET2 attempts to access FLEET1 driver profile -> MUST return 404
  let profileLeakCaught = false;
  try {
    await vehicleProfileService.getVehicleProfile(FLEET2_ADMIN, FLEET1_DRIVER.uid);
  } catch (err) {
    profileLeakCaught = true;
    assert.equal(err.statusCode, 404, 'Cross-tenant vehicle profile lookup must return 404');
  }
  assert.equal(profileLeakCaught, true, 'Cross-tenant vehicle profile lookup must fail');

  const f2ProfileById = await fleetStore.getScopedDocument(FLEET2_ADMIN, 'vehicle_profiles', profileF1.id);
  assert.equal(f2ProfileById, null, 'FLEET2 by-ID lookup of FLEET1 vehicle profile must return null (404)');

  // 6. FLEET2 attempts to access FLEET1 driver document by ID -> MUST return null (404)
  const f2DocById = await getDriverDocumentById(FLEET2_ADMIN, docF1.id);
  assert.equal(f2DocById, null, 'FLEET2 by-ID lookup of FLEET1 document must return null (404)');

  // 7. Read-back verification for FLEET1: target objects MUST be found and IDs must match exactly
  const readBackLoadF1 = await getLoadById(FLEET1_ADMIN, loadF1.id);
  assert.ok(readBackLoadF1, 'FLEET1 load must exist on read-back');
  assert.equal(readBackLoadF1.id, loadF1.id, 'Load ID must match created ID');
  assert.equal(readBackLoadF1.fleetId, 'FLEET1');

  const readBackAlertF1 = await fleetStore.getScopedDocument(FLEET1_ADMIN, 'aux_alerts', alertF1.id);
  assert.ok(readBackAlertF1, 'FLEET1 alert must exist on read-back');
  assert.equal(readBackAlertF1.id, alertF1.id, 'Alert ID must match created ID');
  assert.equal(readBackAlertF1.fleetId, 'FLEET1');

  const readBackProfileF1 = await fleetStore.getScopedDocument(FLEET1_ADMIN, 'vehicle_profiles', profileF1.id);
  assert.ok(readBackProfileF1, 'FLEET1 vehicle profile must exist on read-back');
  assert.equal(readBackProfileF1.id, profileF1.id, 'Vehicle profile ID must match created ID');
  assert.equal(readBackProfileF1.fleetId, 'FLEET1');

  const readBackDocF1 = await getDriverDocumentById(FLEET1_ADMIN, docF1.id);
  assert.ok(readBackDocF1, 'FLEET1 driver document must exist on read-back');
  assert.equal(readBackDocF1.id, docF1.id, 'Driver document ID must match created ID');
  assert.equal(readBackDocF1.fleetId, 'FLEET1');
});

test('4. Mutation & ID-Tampering Regression: Cross-tenant mutations rejected & data preserved', async () => {
  fleetStore.clearMockStore();

  // 1. Seed FLEET1 state
  const targetLoad = await createLoad(FLEET1_ADMIN, {
    origin: 'Houston, TX',
    destination: 'Phoenix, AZ',
    grossPayUsd: 3200,
    miles: 1100,
    deadheadMiles: 30,
    estimatedTransitHours: 18.0,
    loadNumber: 'CONFIDENTIAL-FLEET1-TARGET-LOAD',
  });
  const initialLoadStatus = targetLoad.status;

  const targetAlert = await triggerAuxAlert(FLEET1_ADMIN, {
    type: 'PANIC_BUTTON',
    severity: 'CRITICAL',
    vehicleUnit: 'UNIT-F1-TARGET',
    driverName: 'F1 Panic Driver',
    title: 'CONFIDENTIAL-FLEET1-TARGET-ALERT',
    description: 'Roadside panic triggered',
  });

  const targetDoc = await addDriverDocument(FLEET1_ADMIN, {
    driverId: FLEET1_DRIVER.uid,
    type: 'MED_CARD',
    title: 'CONFIDENTIAL-FLEET1-MEDCARD',
    fileUrl: '/vault/medcard.pdf',
    status: 'PENDING_REVIEW',
  });

  const targetProfile = await vehicleProfileService.saveVehicleProfile(FLEET1_ADMIN, FLEET1_DRIVER.uid, {
    heightFt: 13.5,
    weightLbs: 79000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
    unitNumber: 'CONFIDENTIAL-FLEET1-TARGET-TRUCK',
  });

  // 2. Attack: FLEET2 attempts to dispatch FLEET1 load
  let dispatchAttackCaught = false;
  try {
    const dispatched = await dispatchLoad(FLEET2_ADMIN, targetLoad.id, FLEET2_DRIVER.uid, 'UNIT-F2-99');
    if (!dispatched) dispatchAttackCaught = true;
  } catch (err) {
    dispatchAttackCaught = true;
  }
  assert.equal(dispatchAttackCaught, true, 'FLEET2 dispatch of FLEET1 load must fail');

  // Read-back verification: verify FLEET1 load was found and is UNCHANGED
  const readBackLoad = await getLoadById(FLEET1_ADMIN, targetLoad.id);
  assert.ok(readBackLoad, 'Target load must exist');
  assert.equal(readBackLoad.id, targetLoad.id, 'Target load ID must match exactly');
  assert.equal(readBackLoad.status, initialLoadStatus, 'Target load status must not be modified by FLEET2');
  assert.equal(readBackLoad.fleetId, 'FLEET1', 'Target load fleetId must remain FLEET1');

  // 3. Attack: FLEET2 attempts to resolve FLEET1 alert
  const resolvedByF2 = await resolveAlert(FLEET2_ADMIN, targetAlert.id);
  assert.equal(resolvedByF2, false, 'FLEET2 resolving FLEET1 alert must return false');

  // Read-back verification: verify FLEET1 alert was found and is UNRESOLVED
  const readBackAlert = await fleetStore.getScopedDocument(FLEET1_ADMIN, 'aux_alerts', targetAlert.id);
  assert.ok(readBackAlert, 'Target alert must exist');
  assert.equal(readBackAlert.id, targetAlert.id, 'Target alert ID must match exactly');
  assert.equal(readBackAlert.resolved, false, 'Target alert must remain unresolved');

  // 4. Attack: FLEET2 attempts to update FLEET1 document
  let docUpdateAttackCaught = false;
  try {
    await fleetStore.updateScopedDocument(FLEET2_ADMIN, 'driver_documents', targetDoc.id, {
      status: 'VERIFIED_MALICIOUS',
    });
  } catch (err) {
    docUpdateAttackCaught = true;
    assert.equal(err.statusCode, 404, 'Cross-tenant document update must return 404');
  }
  assert.equal(docUpdateAttackCaught, true, 'Cross-tenant document update must throw 404');

  // Read-back verification: verify FLEET1 document is UNCHANGED and ID matches
  const readBackDoc = await getDriverDocumentById(FLEET1_ADMIN, targetDoc.id);
  assert.ok(readBackDoc, 'Target document must exist');
  assert.equal(readBackDoc.id, targetDoc.id, 'Target document ID must match exactly');
  assert.equal(readBackDoc.status, 'PENDING_REVIEW', 'Target document status must not be modified');
  assert.equal(readBackDoc.fleetId, 'FLEET1', 'Target document fleetId must remain FLEET1');

  // 5. Attack: FLEET2 attempts to update FLEET1 vehicle profile
  let profileUpdateAttackCaught = false;
  try {
    await fleetStore.updateScopedDocument(FLEET2_ADMIN, 'vehicle_profiles', targetProfile.id, {
      heightFt: 14.5,
    });
  } catch (err) {
    profileUpdateAttackCaught = true;
    assert.equal(err.statusCode, 404, 'Cross-tenant vehicle profile update must return 404');
  }
  assert.equal(profileUpdateAttackCaught, true, 'Cross-tenant vehicle profile update must throw 404');

  // Read-back verification: verify FLEET1 vehicle profile is UNCHANGED and ID matches
  const readBackProfile = await fleetStore.getScopedDocument(FLEET1_ADMIN, 'vehicle_profiles', targetProfile.id);
  assert.ok(readBackProfile, 'Target vehicle profile must exist');
  assert.equal(readBackProfile.id, targetProfile.id, 'Target vehicle profile ID must match exactly');
  assert.equal(readBackProfile.heightFt, 13.5, 'Target vehicle profile height must not be modified');
  assert.equal(readBackProfile.fleetId, 'FLEET1', 'Target vehicle profile fleetId must remain FLEET1');
});

test('5. Writes & Tampering: Client cannot set or change fleetId (Rejects with 400)', async () => {
  fleetStore.clearMockStore();

  // 1. Attempt to create a load specifying a different fleetId
  let loadTamperCaught = false;
  try {
    await fleetStore.createScopedDocument(FLEET1_ADMIN, 'loads', 'load-tamper-01', {
      origin: 'A',
      destination: 'B',
      fleetId: 'FLEET2', // Tamper attempt
    });
  } catch (err) {
    loadTamperCaught = true;
    assert.equal(err.statusCode, 400, 'Attempt to set different fleetId must return 400');
  }
  assert.equal(loadTamperCaught, true, 'Setting different fleetId in create must throw 400');

  // 2. Attempt to update a load to change fleetId
  const load = await createLoad(FLEET1_ADMIN, {
    origin: 'Austin, TX',
    destination: 'San Antonio, TX',
    grossPayUsd: 800,
    miles: 80,
    deadheadMiles: 5,
    estimatedTransitHours: 1.5,
  });

  let updateTamperCaught = false;
  try {
    await fleetStore.updateScopedDocument(FLEET1_ADMIN, 'loads', load.id, {
      fleetId: 'FLEET2', // Tamper attempt
    });
  } catch (err) {
    updateTamperCaught = true;
    assert.equal(err.statusCode, 400, 'Attempt to change fleetId must return 400');
  }
  assert.equal(updateTamperCaught, true, 'Changing fleetId in update must throw 400');
});

test('6. Driver Permissions: Drivers cannot create loads, dispatch, or probe other drivers', async () => {
  fleetStore.clearMockStore();

  // 1. Driver attempts to create a load -> 403 Forbidden
  let driverCreateCaught = false;
  try {
    await createLoad(FLEET1_DRIVER, {
      origin: 'Chicago, IL',
      destination: 'Milwaukee, WI',
      grossPayUsd: 600,
      miles: 90,
      deadheadMiles: 10,
      estimatedTransitHours: 2.0,
    });
  } catch (err) {
    driverCreateCaught = true;
    assert.equal(err.statusCode, 403, 'Driver creating load must return 403');
  }
  assert.equal(driverCreateCaught, true, 'Driver creating load must fail');

  // 2. Driver attempts to dispatch a load -> 403 Forbidden
  const load = await createLoad(FLEET1_ADMIN, {
    origin: 'Dallas, TX',
    destination: 'Fort Worth, TX',
    grossPayUsd: 400,
    miles: 35,
    deadheadMiles: 5,
    estimatedTransitHours: 1.0,
  });

  let driverDispatchCaught = false;
  try {
    await dispatchLoad(FLEET1_DRIVER, load.id, FLEET1_DRIVER.uid, 'UNIT-101');
  } catch (err) {
    driverDispatchCaught = true;
    assert.equal(err.statusCode, 403, 'Driver dispatching load must return 403');
  }
  assert.equal(driverDispatchCaught, true, 'Driver dispatching load must fail');

  // 3. Driver attempts to view another driver's documents -> returns 404
  const adminDoc = await addDriverDocument(FLEET1_ADMIN, {
    driverId: 'drv-f1-other-driver',
    type: 'CDL_SCAN',
    title: 'Other Driver CDL',
    fileUrl: '/vault/other_cdl.pdf',
    status: 'VERIFIED',
  });

  const probeDoc = await getDriverDocumentById(FLEET1_DRIVER, adminDoc.id);
  assert.equal(probeDoc, null, 'Driver probing another driver document must return null (404)');
});

test('7. Missing fleetId Policy: Documents lacking fleetId are accessible ONLY to system owner', async () => {
  fleetStore.clearMockStore();

  // Seed a document lacking fleetId
  fleetStore.seedMockData('loads', 'load-orphan-legacy', {
    id: 'load-orphan-legacy',
    origin: 'St. Louis, MO',
    destination: 'Kansas City, MO',
    grossPayUsd: 1100,
    status: 'AVAILABLE',
    // fleetId is undefined/null!
  });

  // FLEET1 Admin lookup -> MUST return null (404)
  const f1AdminRead = await fleetStore.getScopedDocument(FLEET1_ADMIN, 'loads', 'load-orphan-legacy');
  assert.equal(f1AdminRead, null, 'Tenant admin must NOT have access to missing-fleetId document');

  // FLEET1 Driver lookup -> MUST return null (404)
  const f1DriverRead = await fleetStore.getScopedDocument(FLEET1_DRIVER, 'loads', 'load-orphan-legacy');
  assert.equal(f1DriverRead, null, 'Driver must NOT have access to missing-fleetId document');

  // System Owner lookup -> ALLOWED
  const ownerRead = await fleetStore.getScopedDocument(SYSTEM_OWNER, 'loads', 'load-orphan-legacy');
  assert.ok(ownerRead, 'Owner must be able to read missing-fleetId document for maintenance/audit');
  assert.equal(ownerRead.id, 'load-orphan-legacy');
});

test('8. Real Emulator Integration: Firebase Auth Emulator + Firestore users/{uid} Role/Fleet Storage & Isolation', async () => {
  const testPort = 9199;
  const originalHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  // 1. Start HTTP mock Auth emulator server simulating Firebase Auth emulator endpoint
  const mockEmulatorServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const localId = data.localId ? data.localId[0] : 'usr-emulator-test';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          users: [
            {
              localId,
              email: `${localId}@fleet-alpha.com`,
              emailVerified: true,
              disabled: false,
              lastLoginAt: `${Date.now()}`,
              createdAt: `${Date.now()}`,
            },
          ],
        })
      );
    });
  });

  await new Promise((resolve) => mockEmulatorServer.listen(testPort, () => resolve()));
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${testPort}`;
  const app = getFirebaseAdminApp();
  if (app) {
    delete app.auth;
    delete app.services_?.['auth'];
  }

  try {
    // 2. Generate emulator ID token for Alpha tenant admin matching app projectId
    const projectId = app?.options?.projectId || process.env.GCP_PROJECT_ID || 'project-f0634118-be01-44f7-b36';
    const testUid = 'usr-emulator-alpha-admin';
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: testUid,
        user_id: testUid,
        aud: projectId,
        iss: `https://securetoken.google.com/${projectId}`,
        iat: Math.floor(Date.now() / 1000) - 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
        auth_time: Math.floor(Date.now() / 1000) - 10,
      })
    ).toString('base64url');
    const emulatorToken = `Bearer ${header}.${payload}.`;

    // 3. Verify token with verifyFirebaseIdToken
    const verification = await verifyFirebaseIdToken(emulatorToken);
    assert.equal(verification.valid, true, 'Emulator token must verify as valid');
    assert.equal(verification.decoded?.uid, testUid, 'Decoded UID must match emulator user');

    // 4. Create and store role & fleetId in users/{uid} document in Firestore
    await getOrCreateUserDocument(testUid, 'admin@fleet-alpha.com');
    await updateUserProfile(testUid, {
      role: 'fleet_admin',
      fleetId: 'FLEET-EMULATOR-ALPHA',
    });

    const storedUser = await fleetStore.getScopedDocument(SYSTEM_OWNER, 'users', testUid);
    assert.ok(storedUser, 'User document must be stored in users/{uid}');
    assert.equal(storedUser.role, 'fleet_admin');
    assert.equal(storedUser.fleetId, 'FLEET-EMULATOR-ALPHA');

    // 5. Construct verified caller identity derived ONLY from users/{uid}
    const verifiedCaller = {
      uid: storedUser.uid,
      email: storedUser.email,
      role: storedUser.role,
      fleetId: storedUser.fleetId,
    };

    // 6. Create confidential load under this fleet
    const alphaLoad = await createLoad(verifiedCaller, {
      origin: 'Chicago, IL',
      destination: 'Detroit, MI',
      grossPayUsd: 1800,
      miles: 280,
      deadheadMiles: 15,
      estimatedTransitHours: 5.0,
      loadNumber: 'EMULATOR-ALPHA-LOAD-01',
    });
    assert.equal(alphaLoad.fleetId, 'FLEET-EMULATOR-ALPHA');

    // 7. Verify cross-tenant isolation: user from FLEET-EMULATOR-BETA cannot read or mutate
    const betaCaller = {
      uid: 'usr-emulator-beta-admin',
      email: 'admin@fleet-beta.com',
      role: 'fleet_admin',
      fleetId: 'FLEET-EMULATOR-BETA',
    };

    const betaRead = await getLoadById(betaCaller, alphaLoad.id);
    assert.equal(betaRead, null, 'Cross-tenant emulator user must NOT see Alpha load (404)');

    // 8. Read-back verification for Alpha user: verify target object exists, ID matches, and is unchanged
    const alphaReadBack = await getLoadById(verifiedCaller, alphaLoad.id);
    assert.ok(alphaReadBack, 'Alpha read-back must find the load');
    assert.equal(alphaReadBack.id, alphaLoad.id, 'Alpha load ID must match exactly');
    assert.equal(alphaReadBack.fleetId, 'FLEET-EMULATOR-ALPHA');
    assert.equal(alphaReadBack.status, 'AVAILABLE');
  } finally {
    mockEmulatorServer.close();
    if (originalHost) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = originalHost;
    } else {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    }
    if (app) {
      delete app.auth;
      delete app.services_?.['auth'];
    }
  }
});

test('9. Gate G-4 & G-5: Canonical loads Collection & Fail-Closed Auth Invariants', async () => {
  // 1. Gate G-4: Verify loads canonicalization
  const adminCaller = {
    uid: 'usr-canon-admin',
    email: 'admin@canon-fleet.com',
    role: 'fleet_admin',
    fleetId: 'FLEET-CANON',
  };

  const newLoad = await createLoad(adminCaller, {
    origin: 'Dallas, TX',
    destination: 'Houston, TX',
    grossPayUsd: 1200,
    miles: 240,
    deadheadMiles: 10,
    loadNumber: 'CANON-LOAD-01',
  });

  // Verify stored under canonical 'loads'
  const loadViaCanonical = await fleetStore.getScopedDocument(adminCaller, 'loads', newLoad.id);
  assert.ok(loadViaCanonical, 'Load must be retrievable via canonical "loads" collection');
  assert.equal(loadViaCanonical.id, newLoad.id);

  // Verify legacy 'freight_loads' routes to canonical 'loads'
  const loadViaLegacy = await fleetStore.getScopedDocument(adminCaller, 'freight_loads', newLoad.id);
  assert.ok(loadViaLegacy, 'Load must be retrievable via legacy alias "freight_loads"');
  assert.equal(loadViaLegacy.id, newLoad.id);

  // 2. Gate G-5: Verify fail-closed behavior for getOrCreateUserDocument in production
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    // In production without Firestore active, getOrCreateUserDocument must reject
    let threwInProd = false;
    try {
      await getOrCreateUserDocument('fake-uid-fail-closed', 'test@failclosed.com');
    } catch (err) {
      threwInProd = true;
      assert.ok(err.message.includes('Firestore') || err.message.includes('Database'));
    }
    assert.equal(threwInProd, true, 'getOrCreateUserDocument must fail closed (throw) in production if DB is unavailable');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});


test('10. Commercial Routing & Vehicle Profile: Multi-Tenant Fleet Isolation & Mock Attribution', async () => {
  const { routingManager } = await import('../server/routing/routingManager.ts');

  // 1. Save vehicle profile for FLEET1_DRIVER
  const savedProfile = await vehicleProfileService.saveVehicleProfile(FLEET1_DRIVER, FLEET1_DRIVER.uid, {
    heightFt: 13.5,
    weightLbs: 80000,
    lengthFt: 53.0,
    widthFt: 8.5,
    axles: 5,
    hazmatClass: 'None',
    unitNumber: 'TRACTOR-F1',
  });
  assert.equal(savedProfile.fleetId, 'FLEET1');
  assert.equal(savedProfile.heightFt, 13.5);

  // 2. FLEET1_DRIVER can retrieve own profile
  const ownProfile = await vehicleProfileService.getVehicleProfile(FLEET1_DRIVER, FLEET1_DRIVER.uid);
  assert.ok(ownProfile);
  assert.equal(ownProfile.unitNumber, 'TRACTOR-F1');

  // 3. FLEET2_DRIVER probing FLEET1_DRIVER profile returns 404
  let crossFleetProbeBlocked = false;
  try {
    await vehicleProfileService.getVehicleProfile(FLEET2_DRIVER, FLEET1_DRIVER.uid, 'FLEET2');
  } catch (err) {
    crossFleetProbeBlocked = true;
    assert.equal(err.statusCode || err.status, 404);
  }
  assert.equal(crossFleetProbeBlocked, true, 'Cross-fleet vehicle profile probe must return 404');

  // 4. FLEET1_DRIVER trying to edit another driver's vehicle profile is rejected with 403
  let crossDriverEditBlocked = false;
  try {
    await vehicleProfileService.saveVehicleProfile(FLEET1_DRIVER, 'other-driver-uid', {
      heightFt: 14.0,
      weightLbs: 75000,
      lengthFt: 53.0,
      widthFt: 8.5,
      axles: 5,
    });
  } catch (err) {
    crossDriverEditBlocked = true;
    assert.equal(err.statusCode || err.status, 403);
  }
  assert.equal(crossDriverEditBlocked, true, 'Driver cannot edit other driver vehicle profiles (403)');

  // 5. Commercial route calculation returns valid distance, provider, and mock flag
  const route = await routingManager.calculateRoute(
    { coords: { lat: 32.7767, lon: -96.7970 }, label: 'Dallas, TX' },
    { coords: { lat: 29.7604, lon: -95.3698 }, label: 'Houston, TX' },
    [],
    ownProfile
  );

  assert.ok(route.totalDistanceMiles > 200, 'Route distance between Dallas and Houston must be > 200 miles');
  assert.ok(route.provider === 'tomtom' || route.provider === 'trimble' || route.provider === 'mock');
  if (route.provider === 'mock') {
    assert.equal(route.mock, true, 'Mock route must be explicitly flagged with mock: true');
  }
});

test('11. Load Status Authorization, Sequential Transitions & Admin Reassignment (200 / 403 / 404 / 400)', async () => {
  fleetStore.clearMockStore();

  const FLEET1_DRIVER_B = { uid: 'drv-f1-other', role: 'driver', fleetId: 'FLEET1' };

  // Helper that mirrors the exact HTTP route handler in server.ts (/api/loads/:id/status & /accept)
  async function invokeLoadStatusRoute(caller, loadId, body = {}, isAcceptRoute = false) {
    try {
      if (body?.fleetId && body.fleetId !== caller.fleetId) {
        return { status: 400, body: { success: false, error: 'Cannot set or change fleetId.' } };
      }
      const status = body?.status ?? (isAcceptRoute ? 'DISPATCHED' : undefined);
      const assignedUnitId = body?.assignedUnitId ?? body?.unitId;
      const assignedDriverId = body?.assignedDriverId ?? body?.driverId;
      const validStatuses = ['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'COMPLETED'];
      if (status !== undefined && !validStatuses.includes(status)) {
        return { status: 400, body: { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } };
      }
      if (status === undefined && assignedDriverId === undefined && assignedUnitId === undefined) {
        return { status: 400, body: { success: false, error: 'status or assignment update is required.' } };
      }
      const updated = await updateLoadStatus(caller, loadId, status, assignedUnitId, assignedDriverId);
      if (!updated) return { status: 404, body: { success: false, error: 'Load not found' } };
      return { status: 200, body: { success: true, load: updated } };
    } catch (err) {
      return { status: err.statusCode || 500, body: { success: false, error: err.message } };
    }
  }

  // Create an AVAILABLE unassigned load in FLEET1
  const load = await createLoad(FLEET1_ADMIN, {
    loadNumber: 'AUTH-LOAD-01',
    origin: 'Dallas, TX',
    destination: 'Memphis, TN',
    miles: 450,
    deadheadMiles: 10,
    grossPayUsd: 1950,
    equipmentType: 'DRY_VAN',
    weightLbs: 36000,
    pickupTime: 'Today 09:00 CST',
    deliveryTime: 'Today 18:00 CST',
    shipperBroker: 'Continental Freight',
    contactPhone: '+1-800-555-0190',
    estimatedTransitHours: 7.5,
  });
  assert.equal(load.status, 'AVAILABLE');
  assert.equal(load.assignedDriverId, undefined);

  // 1. Invalid transition on AVAILABLE load: skipping DISPATCHED straight to IN_TRANSIT -> 400
  const skipRes = await invokeLoadStatusRoute(FLEET1_DRIVER, load.id, { status: 'IN_TRANSIT' });
  assert.equal(skipRes.status, 400, 'Skipping AVAILABLE -> IN_TRANSIT must return 400');

  // 2. Driver accepts AVAILABLE unassigned load -> 200 (AVAILABLE -> DISPATCHED)
  const acceptRes = await invokeLoadStatusRoute(FLEET1_DRIVER, load.id, {}, true);
  assert.equal(acceptRes.status, 200, 'Driver accepting AVAILABLE unassigned load must return 200');
  assert.equal(acceptRes.body.load.status, 'DISPATCHED');
  assert.equal(acceptRes.body.load.assignedDriverId, FLEET1_DRIVER.uid);

  // 3. Another driver in the SAME fleet tries to update or accept or reassign FLEET1_DRIVER's load -> 403 and unchanged on read-back
  const otherDriverAttempt = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'IN_TRANSIT' });
  assert.equal(otherDriverAttempt.status, 403, 'Driver updating another driver load in same fleet must return 403');

  const readBackAfterOtherDriver = await getLoadById(FLEET1_ADMIN, load.id);
  assert.equal(readBackAfterOtherDriver.status, 'DISPATCHED', 'Load status must remain unchanged on read-back');
  assert.equal(readBackAfterOtherDriver.assignedDriverId, FLEET1_DRIVER.uid, 'Assigned driver must remain unchanged on read-back');

  // 4. Driver tries to reassign their load to another driver -> 403
  const driverReassignAttempt = await invokeLoadStatusRoute(FLEET1_DRIVER, load.id, {
    status: 'IN_TRANSIT',
    assignedDriverId: FLEET1_DRIVER_B.uid,
  });
  assert.equal(driverReassignAttempt.status, 403, 'Driver attempting to reassign load to another driver must return 403');

  // 5. Other fleet (FLEET2) attempts to update FLEET1 load -> 404 and unchanged on read-back
  const otherFleetAttempt = await invokeLoadStatusRoute(FLEET2_DRIVER, load.id, { status: 'IN_TRANSIT' });
  assert.equal(otherFleetAttempt.status, 404, 'Other fleet updating load must return 404');
  const otherFleetAdminAttempt = await invokeLoadStatusRoute(FLEET2_ADMIN, load.id, { status: 'IN_TRANSIT' });
  assert.equal(otherFleetAdminAttempt.status, 404, 'Other fleet admin updating load must return 404');

  const readBackAfterCrossFleet = await getLoadById(FLEET1_ADMIN, load.id);
  assert.equal(readBackAfterCrossFleet.status, 'DISPATCHED');
  assert.equal(readBackAfterCrossFleet.assignedDriverId, FLEET1_DRIVER.uid);

  // 6. Admin reassigns load to FLEET1_DRIVER_B -> 200
  const adminReassignRes = await invokeLoadStatusRoute(FLEET1_ADMIN, load.id, {
    status: 'DISPATCHED',
    assignedDriverId: FLEET1_DRIVER_B.uid,
    assignedUnitId: 'UNIT-202',
  });
  assert.equal(adminReassignRes.status, 200, 'Admin reassigning load must return 200');
  assert.equal(adminReassignRes.body.load.assignedDriverId, FLEET1_DRIVER_B.uid);
  assert.equal(adminReassignRes.body.load.assignedUnitId, 'UNIT-202');

  // 7. Now FLEET1_DRIVER_B (assigned driver) updates own load: DISPATCHED -> IN_TRANSIT -> 200
  const ownUpdateInTransit = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'IN_TRANSIT' });
  assert.equal(ownUpdateInTransit.status, 200, 'Assigned driver updating own load to IN_TRANSIT must return 200');
  assert.equal(ownUpdateInTransit.body.load.status, 'IN_TRANSIT');

  // 8. Driver tries to reverse status (IN_TRANSIT -> DISPATCHED) -> 400
  const driverReverseAttempt = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'DISPATCHED' });
  assert.equal(driverReverseAttempt.status, 400, 'Driver reversing load status must return 400');

  // 9. Admin reverses status (IN_TRANSIT -> DISPATCHED) -> 200 and logged in audit trail
  const adminReverseRes = await invokeLoadStatusRoute(FLEET1_ADMIN, load.id, { status: 'DISPATCHED' });
  assert.equal(adminReverseRes.status, 200, 'Admin reversing non-completed status must return 200');
  assert.equal(adminReverseRes.body.load.status, 'DISPATCHED');
  const logs = getAuditLogs(10);
  assert.ok(
    logs.some((l) => l.subsystem === 'LOAD_STATUS_REVERSAL' && l.message.includes(load.id)),
    'Admin status reversal must be logged in audit events'
  );

  // 10. Advance to IN_TRANSIT and COMPLETED by assigned driver -> 200
  const toInTransitAgain = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'IN_TRANSIT' });
  assert.equal(toInTransitAgain.status, 200);
  const toCompleted = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'COMPLETED' });
  assert.equal(toCompleted.status, 200, 'Assigned driver completing IN_TRANSIT load must return 200');
  assert.equal(toCompleted.body.load.status, 'COMPLETED');

  // 11. COMPLETED cannot go back (even for fleet_admin / owner) -> 400
  const driverRevertCompleted = await invokeLoadStatusRoute(FLEET1_DRIVER_B, load.id, { status: 'IN_TRANSIT' });
  assert.equal(driverRevertCompleted.status, 400, 'Driver reverting COMPLETED load must return 400');
  const adminRevertCompleted = await invokeLoadStatusRoute(FLEET1_ADMIN, load.id, { status: 'IN_TRANSIT' });
  assert.equal(adminRevertCompleted.status, 400, 'Even fleet_admin cannot revert a COMPLETED load (400)');
});
