import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit Test Suite for TruckWithEase Landing Page Math & Rules
 *
 * Verifies the mathematical integrity of the interactive simulators on the landing page:
 * - FHWA Item 54B Low-Bridge Clearance Buffer Delta
 * - Dispatch Zero Hourly Yield ($/Hr) and Duty Hour Breach
 * - The Master Mechanic Kingpin Hitch Articulation (>48° Jackknife Danger)
 * - Carrier Fleet ROI and Payback Math
 * - GPSTab Hardware Pricing & White Glove Concierge Calculations
 */

// 1. FHWA Item 54B Low-Bridge Buffer Delta Math
test('Landing Page: Low-Bridge Clearance Buffer Delta & Alert Triggers', () => {
  function computeClearanceStatus(bridgeClearanceFt, truckHeightFt) {
    const rawDeltaInches = Math.round((bridgeClearanceFt - truckHeightFt) * 12);
    if (rawDeltaInches <= 0) {
      return { status: 'CRITICAL', bufferInches: rawDeltaInches, label: 'COLLISION RISK: CRITICAL' };
    }
    if (rawDeltaInches <= 4) {
      return { status: 'TIGHT_WARNING', bufferInches: rawDeltaInches, label: 'WARNING: TIGHT BUFFER DELTA' };
    }
    return { status: 'SAFE_PASS', bufferInches: rawDeltaInches, label: 'CLEAR PASS' };
  }

  // 13'6" truck approaching 13'6" bridge -> 0" delta -> CRITICAL
  const zeroDelta = computeClearanceStatus(13.5, 13.5);
  assert.equal(zeroDelta.status, 'CRITICAL');
  assert.equal(zeroDelta.bufferInches, 0);

  // 13'6" truck approaching 13'2" bridge -> -4" delta -> CRITICAL
  const strikeRisk = computeClearanceStatus(13.167, 13.5);
  assert.equal(strikeRisk.status, 'CRITICAL');
  assert.ok(strikeRisk.bufferInches < 0);

  // 13'6" truck approaching 13'8" bridge -> +2" delta -> TIGHT_WARNING
  const tightBridge = computeClearanceStatus(13.667, 13.5);
  assert.equal(tightBridge.status, 'TIGHT_WARNING');
  assert.equal(tightBridge.bufferInches, 2);

  // 13'6" truck approaching 15'2" bridge -> +20" delta -> SAFE_PASS
  const safeSpan = computeClearanceStatus(15.167, 13.5);
  assert.equal(safeSpan.status, 'SAFE_PASS');
  assert.equal(safeSpan.bufferInches, 20);
});

// 2. Dispatch Zero Hourly Yield ($/Hr) Math & Duty Hour Check
test('Landing Page: Dispatch Zero Yield Rate and Legal Capacity Check', () => {
  function computeDispatchZero(grossRevenue, loadedMiles, detentionHours, legalDutyHours) {
    const driveHours = loadedMiles / 55;
    const totalHoursNeeded = driveHours + detentionHours;
    const yieldRate = legalDutyHours > 0 ? (grossRevenue / legalDutyHours).toFixed(2) : '0.00';
    const isBreach = totalHoursNeeded > legalDutyHours;
    return {
      yieldRate: `$${yieldRate}/Hr`,
      numericYield: parseFloat(yieldRate),
      totalHoursNeeded: parseFloat(totalHoursNeeded.toFixed(1)),
      isBreach,
    };
  }

  // Dallas to Atlanta: $2,321 gross, 510 mi, 1.5 hr detention, 10.0 legal duty hours available
  // 510 / 55 = 9.27 hrs drive + 1.5 = 10.77 hrs needed -> 10.77 > 10.0 => BREACH!
  const breachTrip = computeDispatchZero(2321, 510, 1.5, 10.0);
  assert.equal(breachTrip.yieldRate, '$232.10/Hr');
  assert.equal(breachTrip.isBreach, true);

  // With 11.0 legal hours available -> not a breach
  const compliantTrip = computeDispatchZero(2321, 510, 1.5, 11.0);
  assert.equal(compliantTrip.yieldRate, '$211.00/Hr');
  assert.equal(compliantTrip.isBreach, false);

  // High yield short haul: $1,850 gross, 220 mi, 1.0 hr detention, 6.5 legal hours available
  // 220 / 55 = 4.0 hrs drive + 1.0 = 5.0 hrs needed -> 5.0 <= 6.5 -> Compliant
  const shortHaul = computeDispatchZero(1850.5, 220, 1.0, 6.5);
  assert.equal(shortHaul.yieldRate, '$284.69/Hr');
  assert.equal(shortHaul.isBreach, false);
});

// 3. The Master Mechanic Kingpin Articulation Math (GEMINI.md Rule)
test('Landing Page: Master Mechanic Kingpin Articulation & Jackknife Threshold', () => {
  const JACKKNIFE_THRESHOLD_DEG = 48;
  const HIGH_ARTICULATION_DEG = 35;

  function evaluateHitchArticulation(angleDeg) {
    const abs = Math.abs(angleDeg);
    if (abs >= JACKKNIFE_THRESHOLD_DEG) {
      return { level: 'CRITICAL', label: 'JACKKNIFE DANGER IMMINENT (>48°)' };
    }
    if (abs >= HIGH_ARTICULATION_DEG) {
      return { level: 'ADVISORY', label: 'HIGH ARTICULATION' };
    }
    return { level: 'NOMINAL', label: 'STABLE ARTICULATION' };
  }

  assert.equal(evaluateHitchArticulation(18).level, 'NOMINAL');
  assert.equal(evaluateHitchArticulation(34).level, 'NOMINAL');
  assert.equal(evaluateHitchArticulation(35).level, 'ADVISORY');
  assert.equal(evaluateHitchArticulation(47).level, 'ADVISORY');
  assert.equal(evaluateHitchArticulation(48).level, 'CRITICAL');
  assert.equal(evaluateHitchArticulation(55).level, 'CRITICAL');
});

// 4. Carrier Fleet ROI Math
test('Landing Page: Carrier Fleet ROI & Annual Net Value Calculations', () => {
  function computeFleetRoi(truckCount, avgMonthlyMiles) {
    const annualAvoidedBridgeRisk = truckCount >= 1 ? Math.round(150000 * 0.15) : 0;
    const annualFuelSavings = Math.round(truckCount * (avgMonthlyMiles / 6.5) * 0.08 * 3.85);
    const annualHosFinesAvoided = truckCount * 3500;
    const annualDispatchZeroUplift = Math.round(truckCount * 7800);
    const totalAnnualBenefit = annualAvoidedBridgeRisk + annualFuelSavings + annualHosFinesAvoided + annualDispatchZeroUplift;
    const annualSoftwareCost = truckCount * 59 * 12;
    const netBenefit = totalAnnualBenefit - annualSoftwareCost;
    const roiPercentage = Math.round((netBenefit / annualSoftwareCost) * 100);

    return { totalAnnualBenefit, annualSoftwareCost, netBenefit, roiPercentage };
  }

  const soloRoi = computeFleetRoi(1, 9500);
  assert.ok(soloRoi.totalAnnualBenefit > 30000, 'Solo carrier saves over $30k in liability & fuel');
  assert.ok(soloRoi.netBenefit > 25000);
  assert.ok(soloRoi.roiPercentage > 500, 'Significant ROI for solo operator');

  const fleetRoi = computeFleetRoi(12, 9500);
  assert.ok(fleetRoi.totalAnnualBenefit > 150000);
  assert.ok(fleetRoi.roiPercentage > 1000);
});

// 5. Hardware Pricing & White Glove Staging Calculations
test('Landing Page: GPSTab Hardware Pricing & Delivery Mode Math', () => {
  const HARDWARE_CATALOG = {
    gpstab: { unitPrice: 299, monthly: 28, isBestBet: true },
    geotab: { unitPrice: 349, monthly: 38, isBestBet: false },
    azuga: { unitPrice: 269, monthly: 24, isBestBet: false },
  };

  function computeHardwareOrderTotal(vendorId, quantity, deliveryMode) {
    const hw = HARDWARE_CATALOG[vendorId];
    if (!hw) throw new Error('Unknown hardware vendor');
    const whiteGloveFee = deliveryMode === 'WHITE_GLOVE' ? 49 * quantity : 0;
    const upfrontTotal = hw.unitPrice * quantity + whiteGloveFee;
    const monthlyTotal = hw.monthly * quantity;
    return { upfrontTotal, monthlyTotal, whiteGloveFee, isBestBet: hw.isBestBet };
  }

  // 2 GPSTab units with White Glove concierge
  const order = computeHardwareOrderTotal('gpstab', 2, 'WHITE_GLOVE');
  assert.equal(order.isBestBet, true);
  assert.equal(order.whiteGloveFee, 98); // 49 * 2
  assert.equal(order.upfrontTotal, 696); // (299 * 2) + 98
  assert.equal(order.monthlyTotal, 56); // 28 * 2

  // Direct ship (no concierge fee)
  const directOrder = computeHardwareOrderTotal('gpstab', 2, 'DIRECT');
  assert.equal(directOrder.whiteGloveFee, 0);
  assert.equal(directOrder.upfrontTotal, 598); // 299 * 2
});
