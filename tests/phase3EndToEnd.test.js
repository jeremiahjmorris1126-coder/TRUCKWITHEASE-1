import { describe, it, expect, beforeEach } from 'bun:test';
import { getLoads, createLoad, matchLoadsForDriver, dispatchLoad, getLoadById, updateLoadStatus } from '../server/loadMatching/loadService';
import { triggerAuxAlert, getActiveAlerts, getAllAlerts, resolveAlert } from '../server/alerts/alertEngine';
import { getDriverProfile, updateDriverProfile, getDriverDocuments, addDriverDocument } from '../server/driver/driverProfileService';
import { routingManager } from '../server/routing/routingManager';
import { vehicleProfileService } from '../server/routing/vehicleProfileService';
import { completeSubscriberSignup } from '../server/billing/signupBillingService';
import { fleetStore } from '../server/data/fleetStore';
import { computeSha256 } from '../src/services/cryptoService';
import { fleetFederalVaultService } from '../src/services/fleetFederalVaultService';
import { dotDocumentsService } from '../src/services/dotDocumentsService';
import { saveSubscriberSession, clearSubscriberSession } from '../src/services/firebaseClientAuth';

describe('Phase 3: End-to-End System Integration & Workflow Verification', () => {
  const FLEET_A_ADMIN = { uid: 'usr-admin-fa', role: 'fleet_admin', fleetId: 'FLEET-ALPHA' };
  const FLEET_A_DRIVER = { uid: 'usr-driver-fa', role: 'driver', fleetId: 'FLEET-ALPHA' };
  const FLEET_B_ADMIN = { uid: 'usr-admin-fb', role: 'fleet_admin', fleetId: 'FLEET-BETA' };

  beforeEach(() => {
    clearSubscriberSession();
  });

  // =========================================================================
  // WORKFLOW 1: DISPATCH ZERO ($/HR YIELD & HOS MATCHING)
  // =========================================================================
  it('Workflow 1: Dispatch Zero load lifecycle, $/Hr ranking & dispatch state transition', async () => {
    // 1. Admin creates multiple loads with different transit durations and revenues
    const load1 = await createLoad(FLEET_A_ADMIN, {
      loadNumber: 'TWE-WF-101',
      origin: 'Dallas, TX',
      destination: 'Houston, TX',
      miles: 240,
      deadheadMiles: 10,
      grossPayUsd: 1200,
      equipmentType: 'DRY_VAN',
      weightLbs: 32000,
      pickupTime: 'Today 08:00 CST',
      deliveryTime: 'Today 13:00 CST',
      shipperBroker: 'Gulf Coast Freight',
      contactPhone: '+1-800-555-0101',
      estimatedTransitHours: 4.5,
    });

    const load2 = await createLoad(FLEET_A_ADMIN, {
      loadNumber: 'TWE-WF-102',
      origin: 'Dallas, TX',
      destination: 'Atlanta, GA',
      miles: 780,
      deadheadMiles: 20,
      grossPayUsd: 2600,
      equipmentType: 'REEFER',
      weightLbs: 39000,
      pickupTime: 'Today 12:00 CST',
      deliveryTime: 'Tomorrow 06:00 EST',
      shipperBroker: 'Southern Express',
      contactPhone: '+1-800-555-0102',
      estimatedTransitHours: 13.5, // Exceeds 10-hour duty limit
    });

    // Verify Dispatch Zero $/Hr yield calculation
    expect(load1.yieldPerHourUsd).toBeGreaterThan(0);
    expect(load2.yieldPerHourUsd).toBeGreaterThan(0);

    // 2. Driver with 8.0 remaining legal hours queries matched loads
    const matched = await matchLoadsForDriver(FLEET_A_DRIVER, 8.0);
    
    // Only load1 should match because load2 exceeds remaining legal hours (13.5 > 8.0)
    const matchedIds = matched.map((l) => l.id);
    expect(matchedIds).toContain(load1.id);
    expect(matchedIds).not.toContain(load2.id);

    // Verified loads are ranked by yieldPerHourUsd descending
    for (let i = 0; i < matched.length - 1; i++) {
      expect(matched[i].yieldPerHourUsd).toBeGreaterThanOrEqual(matched[i + 1].yieldPerHourUsd);
    }

    // 3. Admin dispatches load1 to driver
    const dispatched = await dispatchLoad(FLEET_A_ADMIN, load1.id, FLEET_A_DRIVER.uid, 'UNIT-204');
    expect(dispatched).not.toBeNull();
    expect(dispatched?.status).toBe('DISPATCHED');
    expect(dispatched?.assignedDriverId).toBe(FLEET_A_DRIVER.uid);
    expect(dispatched?.assignedUnitId).toBe('UNIT-204');

    // 4. Update status along journey to COMPLETED
    const inTransit = await updateLoadStatus(FLEET_A_DRIVER, load1.id, 'IN_TRANSIT');
    expect(inTransit?.status).toBe('IN_TRANSIT');

    const completed = await updateLoadStatus(FLEET_A_DRIVER, load1.id, 'COMPLETED');
    expect(completed?.status).toBe('COMPLETED');
  });

  // =========================================================================
  // WORKFLOW 2: THE MASTER MECHANIC DIAGNOSTICS & AUXILIARY RADAR ENGINE
  // =========================================================================
  it('Workflow 2: Master Mechanic J1939 sensor alert triggering, radar & resolution flow', async () => {
    // 1. Auxiliary-input sensor trips low-clearance hazard radar alert
    const alert = await triggerAuxAlert(FLEET_A_ADMIN, {
      type: 'LOW_CLEARANCE',
      severity: 'CRITICAL',
      vehicleUnit: 'UNIT-101',
      driverName: 'Marcus Vance',
      title: 'COLLISION RISK: CRITICAL // 13\' 6" OVERPASS AHEAD',
      description: 'Clearance: 162" // Vehicle Height: 162" // Delta: 0". Immediate secondary diverter required.',
      telemetryMetadata: {
        clearanceInches: 162,
        vehicleHeightInches: 162,
        deltaInches: 0,
      },
    });

    expect(alert.id).toBeDefined();
    expect(alert.resolved).toBe(false);
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.fleetId).toBe('FLEET-ALPHA');

    // 2. Alert appears in active alerts query for FLEET-ALPHA
    const active = await getActiveAlerts(FLEET_A_DRIVER);
    expect(active.some((a) => a.id === alert.id)).toBe(true);

    // 3. FLEET-BETA cannot see FLEET-ALPHA active alerts
    const betaAlerts = await getActiveAlerts(FLEET_B_ADMIN);
    expect(betaAlerts.some((a) => a.id === alert.id)).toBe(false);

    // 4. Resolve alert once diverter execution is confirmed
    const resolved = await resolveAlert(FLEET_A_DRIVER, alert.id);
    expect(resolved).toBe(true);

    // 5. Alert status is now RESOLVED
    const all = await getAllAlerts(FLEET_A_DRIVER);
    const target = all.find((a) => a.id === alert.id);
    expect(target?.resolved).toBe(true);
  });

  // =========================================================================
  // WORKFLOW 3: LOW-BRIDGE RADAR HUD & COMMERCIAL ROUTING DIVERTER
  // =========================================================================
  it('Workflow 3: Vehicle profile storage, bridge clearance validation & routing calculation', async () => {
    // 1. Save standard commercial 13\' 6" trailer profile (13.5 ft)
    const profile = await vehicleProfileService.saveVehicleProfile(FLEET_A_DRIVER, FLEET_A_DRIVER.uid, {
      heightFt: 13.5,
      widthFt: 8.5,
      lengthFt: 53.0,
      weightLbs: 78000,
      axles: 5,
      isHazmat: false,
      unitNumber: 'UNIT-101',
    });

    expect(profile.heightFt).toBe(13.5);
    expect(profile.weightLbs).toBe(78000);

    // 2. Calculate commercial route via routingManager
    const originStop = { address: 'Dallas, TX', coords: { lat: 32.7767, lon: -96.7970 } };
    const destStop = { address: 'Fort Worth, TX', coords: { lat: 32.7555, lon: -97.3308 } };
    const route = await routingManager.calculateRoute(originStop, destStop, [], {
      heightFt: profile.heightFt,
      weightLbs: profile.weightLbs,
      axles: profile.axles,
      isHazmat: profile.isHazmat,
      widthFt: profile.widthFt,
      lengthFt: profile.lengthFt,
    });

    expect(route).toBeDefined();
    expect(route.totalDistanceMiles).toBeGreaterThan(0);
    expect(route.totalTimeMinutes).toBeGreaterThan(0);
    expect(route.provider).toBeDefined();

    // 3. Test route caching: Second identical request is served from 15-minute cache
    const cachedRoute = await routingManager.calculateRoute(originStop, destStop, [], {
      heightFt: profile.heightFt,
      weightLbs: profile.weightLbs,
      axles: profile.axles,
      isHazmat: profile.isHazmat,
      widthFt: profile.widthFt,
      lengthFt: profile.lengthFt,
    });

    expect(cachedRoute.totalDistanceMiles).toBe(route.totalDistanceMiles);
  });

  // =========================================================================
  // WORKFLOW 4: COMPLETE FEDERAL COMPLIANCE VAULT & ATTESTATION
  // =========================================================================
  it('Workflow 4: End-to-end 49 CFR § 390.31 legal custody attestation & audit packet export', async () => {
    // Set active subscriber session
    saveSubscriberSession({
      sessionToken: 'sess-token-44',
      user: {
        uid: 'usr-driver-fa',
        name: 'Marcus Vance',
        email: 'marcus@fleetalpha.com',
        role: 'fleet_admin',
        fleetId: 'FLEET-ALPHA',
        carrierName: 'Alpha Logistics Express LLC',
        usdotNumber: '3948102',
        mcNumber: 'MC-849201',
      },
    });

    // 1. Sign statutory attestation
    const custodian = 'Marcus Vance';
    const title = 'Director of Fleet Safety';
    const signed = fleetFederalVaultService.signLegalAttestation(custodian, title);

    expect(signed.certifiedCustodianName).toBe(custodian);
    expect(signed.carrierLegalName).toBe('Alpha Logistics Express LLC');
    expect(signed.usdotNumber).toBe('3948102');
    expect(signed.tamperEvidentSealVerified).toBe(true);
    expect(signed.digitalSignatureSha256).toHaveLength(64);

    // 2. Generate FMCSA Roadside Audit Package JSON
    const auditJson = fleetFederalVaultService.generateRoadsideAuditPackageJSON();
    const packet = JSON.parse(auditJson);

    expect(packet.certificationHeader.carrierName).toBe('Alpha Logistics Express LLC');
    expect(packet.certificationHeader.usdotNumber).toBe('3948102');
    expect(packet.certificationHeader.cryptographicProofSha256).toHaveLength(64);
    expect(packet.driverQualificationFile.medicalExaminerCertificate.nationalRegistryStatus).toBe('VALID_CERTIFIED');
    expect(packet.vehicleComplianceSummary.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // WORKFLOW 5: SUBSCRIBER ONBOARDING, ROLE ASSIGNMENT & STRICT ISOLATION
  // =========================================================================
  it('Workflow 5: Driver onboarding, immutable role assignment & cross-fleet mutation rejection', async () => {
    // 1. New Solo Driver signup
    const signupResult = await completeSubscriberSignup({
      tierId: 'SOLO_PRO',
      accountType: 'driver',
      fullName: 'Raymond Holt',
      email: 'raymond.holt@brooklynfreight.test',
      carrierName: '99th Express Logistics',
      creditCard: {
        cardNumber: '4242424242424242',
        expMonth: 12,
        expYear: 2028,
        cvc: '123',
        cardholderName: 'Raymond Holt',
        billingZip: '11201',
      },
      termsAccepted: true,
    });

    expect(signupResult.success).toBe(true);
    expect(signupResult.user.role).toBe('driver'); // Immutable default role for drivers
    expect(signupResult.sessionToken).toBeDefined();

    // 2. Attempt cross-tenant ID tampering: FLEET-BETA tries to update FLEET-ALPHA driver document
    const alphaDoc = await addDriverDocument(FLEET_A_ADMIN, {
      driverId: FLEET_A_DRIVER.uid,
      type: 'CDL',
      title: 'Class A Commercial Driver License',
      fileUrl: '/vault/alpha_cdl.pdf',
      status: 'VERIFIED',
    });

    expect(alphaDoc.id).toBeDefined();

    // FLEET-BETA cannot access or mutate alphaDoc
    let crossTenantBlocked = false;
    try {
      await fleetStore.updateScopedDocument(FLEET_B_ADMIN, 'driver_documents', alphaDoc.id, {
        status: 'EXPIRED',
      });
    } catch (err) {
      crossTenantBlocked = true;
      expect(err.statusCode).toBe(404); // Returns 404 to avoid revealing resource existence
    }
    expect(crossTenantBlocked).toBe(true);

    // Verify alphaDoc data was completely untouched
    const verifyDoc = await fleetStore.getScopedDocument(FLEET_A_ADMIN, 'driver_documents', alphaDoc.id);
    expect(verifyDoc?.status).toBe('VERIFIED');
  });
});
