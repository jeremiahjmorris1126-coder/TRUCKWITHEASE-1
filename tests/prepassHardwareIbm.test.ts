import { describe, it, expect, beforeAll } from 'bun:test';
import { bypassService } from '../server/bypass/bypassService';
import { ibmSterlingService } from '../server/ibm/ibmSterlingService';
import { hardwareOrderService } from '../server/hardware/hardwareOrderService';
import { partnersRegistry } from '../server/partners/registry';
import { CallerIdentity } from '../server/data/fleetStore';

describe('PREPASS, IBM STERLING, HARDWARE STORE & GAS DISCOUNTS INTEGRATION', () => {
  const driverCaller: CallerIdentity = {
    uid: 'drv-test-01',
    role: 'driver',
    fleetId: 'FLEET1',
  };

  const fleet2Caller: CallerIdentity = {
    uid: 'drv-test-02',
    role: 'driver',
    fleetId: 'FLEET2',
  };

  // 1. PREPASS & CVISN SCALE BYPASS
  it('1. PrePass: Returns carrier transponder credentials and ISS safety score', async () => {
    const cred = await bypassService.getCarrierCredentials(driverCaller);
    expect(cred).toBeDefined();
    expect(cred.fleetId).toBe('FLEET1');
    expect(cred.prePassStatus).toBe('ACTIVE');
    expect(cred.prePassTransponderId).toBeDefined();
    expect(cred.issScore).toBe(18); // Pass tier
  });

  it('2. PrePass: Allows driver to update or register RFID transponder ID', async () => {
    const updated = await bypassService.updatePrePassTransponder(driverCaller, 'PP-TX-994102-B');
    expect(updated.prePassTransponderId).toBe('PP-TX-994102-B');
    expect(updated.prePassStatus).toBe('ACTIVE');
  });

  it('3. PrePass: Approves bypass (Green Light) for legal weights and passing ISS score', async () => {
    const stations = bypassService.getWeighStations({ state: 'IL' });
    expect(stations.length).toBeGreaterThan(0);
    const station = stations[0];

    const result = await bypassService.evaluateBypass(driverCaller, {
      stationId: station.id,
      steerLbs: 11800,
      driveLbs: 32400,
      trailerLbs: 32200,
      apuCreditLbs: 400,
    });

    expect(result.decision).toBe('BYPASS_APPROVED');
    expect(result.decisionTitle).toContain('BYPASS APPROVED');
    expect(result.clearanceToken).toMatch(/^DW-BYPASS-/);
    expect(result.issRecommendation).toBe('PASS');
  });

  it('4. PrePass: Enforces Federal Bridge Formula and requires Pull-In (Red Light) when overweight', async () => {
    const stations = bypassService.getWeighStations({ state: 'TX' });
    const station = stations[0];

    const result = await bypassService.evaluateBypass(driverCaller, {
      stationId: station.id,
      steerLbs: 12000,
      driveLbs: 36000, // Over 34,000 lbs
      trailerLbs: 34000,
    });

    expect(result.decision).toBe('PULL_IN_REQUIRED');
    expect(result.decisionTitle).toContain('AXLE OVERWEIGHT DETECTED');
    expect(result.vehicleWeights.isWeightCompliant).toBe(false);
  });

  // 2. GAS & DIESEL DISCOUNTS
  it('5. Gas/Fuel Discounts: Partners registry aggregates live discount offers from WEX and TruckSmarter', async () => {
    const offers = await partnersRegistry.getAggregatedFuelOffers(32.7767, -96.7970, 50);
    expect(Array.isArray(offers)).toBe(true);
    expect(offers.length).toBeGreaterThan(0);

    const first = offers[0];
    expect(first.stationName).toBeDefined();
    expect(first.discountPerGallon).toBeGreaterThan(0);
    expect(first.retailPrice).toBeGreaterThan(0);
  });

  // 3. IBM STERLING B2B EDI & WATSONX RISK
  it('6. IBM Sterling: High-speed EDI 204 tender parser extracts shipment and BOL details', () => {
    const sampleEdi204 = `
      ISA*00*          *00*          *ZZ*SHIPPER        *ZZ*TRUCKWITHEASE  *261103*1800*U*00401*000000001*0*P*>~
      GS*SM*SHIPPER*TRUCKWITHEASE*20261103*1800*1*X*004010~
      ST*204*0001~
      B2**TWE*SHP-DALLAS-9921~
      B2A*00*BOL-48201~
      L0*1*42500*G***42500*L~
      L3*42500*G*285000~
      SE*7*0001~
    `;

    const parsed = ibmSterlingService.parseEdi204(sampleEdi204);
    expect(parsed.shipmentId).toBe('SHP-DALLAS-9921');
    expect(parsed.billOfLading).toBe('BOL-48201');
    expect(parsed.weightLbs).toBe(42500);
  });

  it('7. IBM Sterling & watsonx: Granite 3.0 deterministic risk modeling runs in sub-10ms with zero billable cost', () => {
    const start = performance.now();
    const risk = ibmSterlingService.evaluateWatsonxRisk('LOAD-98421', 'TX', 'GA', 42500);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
    expect(risk.modelIdentifier).toBe('IBM-watsonx-Granite-3.0-Trucking-Risk');
    expect(risk.onTimeDeliveryProbabilityPct).toBeGreaterThan(90);
    expect(risk.insights.length).toBeGreaterThan(0);
  });

  // 4. HARDWARE STORE & DROP-SHIP FULFILLMENT
  it('8. Hardware Store: Rejects order without mandatory user FMCSA registration acknowledgment', async () => {
    let errorCaught: any = null;
    try {
      await hardwareOrderService.submitOrder(driverCaller, {
        tierId: 'TIER_PRO',
        hardwareId: 'samsara_vg54',
        cameraId: 'camera_dual_ai',
        shippingAddress: {
          recipientName: 'Marcus Vance',
          streetAddress: '1000 Freightway Blvd',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75201',
          phone: '+1-555-839-2041',
        },
        userSoleFmcsaRegistrationAcknowledged: false, // Must be true!
      });
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught.statusCode).toBe(400);
  });

  it('9. Hardware Store: Successfully places drop-ship order direct to user with documented serial numbers', async () => {
    const order = await hardwareOrderService.submitOrder(driverCaller, {
      tierId: 'TIER_PRO',
      hardwareId: 'samsara_vg54',
      cameraId: 'camera_dual_ai',
      shippingAddress: {
        recipientName: 'Marcus Vance',
        streetAddress: '1000 Freightway Blvd',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        phone: '+1-555-839-2041',
      },
      userSoleFmcsaRegistrationAcknowledged: true,
    });

    expect(order.id).toBeDefined();
    expect(order.vendor).toBe('Samsara');
    expect(order.assignedSerialNumbers.length).toBeGreaterThanOrEqual(2); // Device + Camera
    expect(order.assignedSerialNumbers[0]).toMatch(/^SAM-VG54-/);
    expect(order.vendorFulfillmentStatus).toBe('SUBMITTED_TO_VENDOR');
    expect(order.fmcsaStatutoryNotice).toContain('49 CFR PART 395');
  });

  it('10. Hardware Store: BYOD Opt-Out connects existing ELD without shipping delay', async () => {
    const order = await hardwareOrderService.submitOrder(driverCaller, {
      tierId: 'TIER_STARTER',
      hardwareId: 'opt_out_existing',
      cameraId: 'camera_none',
      existingVendor: 'Geotab',
      existingDeviceSerialNumber: 'GEO-GO9-88310-TX',
      shippingAddress: {
        recipientName: 'Marcus Vance',
        streetAddress: '1000 Freightway Blvd',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        phone: '+1-555-839-2041',
      },
      userSoleFmcsaRegistrationAcknowledged: true,
    });

    expect(order.isOptOutExistingEld).toBe(true);
    expect(order.vendor).toBe('Geotab');
    expect(order.assignedSerialNumbers[0]).toBe('GEO-GO9-88310-TX');
    expect(order.vendorFulfillmentStatus).toBe('ACTIVE_BYOD');
  });

  it('11. Multi-Tenant Fleet Isolation: FLEET2 cannot view FLEET1 hardware orders', async () => {
    const fleet2Orders = await hardwareOrderService.listOrders(fleet2Caller);
    const hasFleet1 = fleet2Orders.some((o) => o.fleetId === 'FLEET1');
    expect(hasFleet1).toBe(false);
  });
});
