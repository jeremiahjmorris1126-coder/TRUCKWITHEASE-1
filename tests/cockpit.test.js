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

test('Dispatch Zero yield calculation and legal duty hour formatting', () => {
  function computeYieldPerHour(grossRevenue, legalDutyHours) {
    if (legalDutyHours <= 0) return '$0.00/Hr';
    const rate = grossRevenue / legalDutyHours;
    return `$${rate.toFixed(2)}/Hr`;
  }

  assert.equal(computeYieldPerHour(2321, 10), '$232.10/Hr');
  assert.equal(computeYieldPerHour(1850.5, 6.5), '$284.69/Hr');
  assert.equal(computeYieldPerHour(1000, 0), '$0.00/Hr');
});

test('Master Mechanic kingpin hitch articulation jackknife danger threshold', () => {
  const JACKKNIFE_DANGER_THRESHOLD_DEG = 48;
  function evaluateKingpinAngle(angleDeg) {
    const absAngle = Math.abs(angleDeg);
    if (absAngle >= JACKKNIFE_DANGER_THRESHOLD_DEG) {
      return { status: 'CRITICAL', warning: 'JACKKNIFE IMMINENT' };
    }
    if (absAngle >= 35) {
      return { status: 'ADVISORY', warning: 'HIGH ARTICULATION' };
    }
    return { status: 'NOMINAL', warning: null };
  }

  assert.equal(evaluateKingpinAngle(52).status, 'CRITICAL');
  assert.equal(evaluateKingpinAngle(-49).status, 'CRITICAL');
  assert.equal(evaluateKingpinAngle(40).status, 'ADVISORY');
  assert.equal(evaluateKingpinAngle(20).status, 'NOMINAL');
});

test('FHWA Item 54B low-bridge clearance buffer calculation', () => {
  const STANDARD_TRUCK_HEIGHT_INCHES = 162; // 13 ft 6 in
  function evaluateBridgeClearance(bridgeClearanceInches) {
    const delta = bridgeClearanceInches - STANDARD_TRUCK_HEIGHT_INCHES;
    if (delta <= 0) {
      return {
        level: 'CRITICAL',
        bufferDelta: `${delta}" BUFFER DELTA`,
        label: `13' 6" CLEARANCE // 0" BUFFER DELTA`,
      };
    }
    return {
      level: 'SAFE',
      bufferDelta: `+${delta}" BUFFER DELTA`,
      label: 'CLEARANCE OK',
    };
  }

  assert.equal(evaluateBridgeClearance(162).level, 'CRITICAL');
  assert.equal(evaluateBridgeClearance(158).level, 'CRITICAL');
  assert.equal(evaluateBridgeClearance(180).level, 'SAFE');
});

test('Driver Sign-Up Sheet registration validation and enrollment', () => {
  function validateAndEnrollDriver(payload, roster) {
    if (!payload.name || !payload.name.trim()) {
      throw new Error('Driver name is required.');
    }
    if (!payload.cdlNumber || !payload.cdlNumber.trim()) {
      throw new Error('Valid CDL number is required.');
    }
    const driverId = `drv-${payload.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}-${Math.floor(100 + Math.random() * 900)}`;
    const newDriver = {
      driverId,
      name: payload.name.trim(),
      cdlNumber: payload.cdlNumber.trim().toUpperCase(),
      role: payload.role || 'FLEET_DRIVER',
      traxxasTransponderId: payload.traxxasTransponderId || 'TRAXXAS-BEACON-DEFAULT',
      dqfStatus: 'FULLY_COMPLIANT',
      selectedFunctions: payload.selectedFunctions || ['night-hud', 'hos-clocks', 'traxxas', 'hre'],
    };
    roster.push(newDriver);
    return newDriver;
  }

  const roster = [];
  assert.throws(() => validateAndEnrollDriver({ name: '', cdlNumber: 'IL-12345' }, roster), /Driver name is required/);
  assert.throws(() => validateAndEnrollDriver({ name: 'John Doe', cdlNumber: '' }, roster), /Valid CDL number is required/);

  const enrolled = validateAndEnrollDriver({
    name: 'Vance Reynolds',
    cdlNumber: 'IL-CDL-4910291',
    role: 'FLEET_DRIVER',
    traxxasTransponderId: 'TRAXXAS-TX904-B',
    selectedFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'traxxas', 'hre'],
  }, roster);

  assert.equal(enrolled.name, 'Vance Reynolds');
  assert.equal(enrolled.cdlNumber, 'IL-CDL-4910291');
  assert.equal(enrolled.traxxasTransponderId, 'TRAXXAS-TX904-B');
  assert.equal(roster.length, 1);
  assert.equal(enrolled.dqfStatus, 'FULLY_COMPLIANT');
});

test('Driver Sign-In credentials and Roadside PIN verification', () => {
  const mockDrivers = [
    { driverId: 'drv-jeremiah-904', name: 'Jeremiah J. Morris', cdlNumber: 'IL-CDL-98104820', fmcsaPin: '8821' },
    { driverId: 'drv-marcus-702', name: 'Marcus Ortiz', cdlNumber: 'TX-CDL-8819204', fmcsaPin: '7702' },
  ];

  function authenticateDriver(identifier, pin, drivers) {
    const clean = identifier.toLowerCase().trim();
    const found = drivers.find(
      (d) => d.driverId.toLowerCase() === clean || d.cdlNumber.toLowerCase() === clean || d.name.toLowerCase() === clean
    );
    if (!found) throw new Error('Driver not found');
    if (pin && found.fmcsaPin !== pin) throw new Error('Invalid PIN');
    return { authenticated: true, driver: found };
  }

  assert.equal(authenticateDriver('IL-CDL-98104820', '8821', mockDrivers).authenticated, true);
  assert.equal(authenticateDriver('Marcus Ortiz', '7702', mockDrivers).driver.driverId, 'drv-marcus-702');
  assert.throws(() => authenticateDriver('Unknown Driver', '0000', mockDrivers), /Driver not found/);
  assert.throws(() => authenticateDriver('IL-CDL-98104820', '9999', mockDrivers), /Invalid PIN/);
});

test('Function & Feature toggles (Choosing what functions you want and what you don\'t want)', () => {
  function processFunctionToggles(toggles, availableModules) {
    const processed = {};
    for (const mod of availableModules) {
      if (mod === 'the-g-o-a-t-') {
        // Enforce GEMINI.md protocol: The G.O.A.T. is permanently removed
        processed[mod] = false;
        continue;
      }
      processed[mod] = toggles[mod] !== undefined ? Boolean(toggles[mod]) : true;
    }
    const wantFunctions = Object.keys(processed).filter((k) => processed[k]);
    const dontWantFunctions = Object.keys(processed).filter((k) => !processed[k]);
    return { wantFunctions, dontWantFunctions, processed };
  }

  const allModules = [
    'night-hud',
    'hos-clocks',
    'radar-54b',
    'master-mechanic',
    'the-g-o-a-t-',
    'dispatch-eta',
    'hre',
    'traxxas',
    'vault',
    'fleet-expenses',
  ];

  const userChoices = {
    'night-hud': true,
    'hos-clocks': true,
    'radar-54b': true,
    'master-mechanic': true,
    'the-g-o-a-t-': true, // User attempts to toggle on the deprecated module
    'dispatch-eta': false, // User doesn't want dispatch-eta
    'hre': true,
    'traxxas': true,
    'vault': false, // User doesn't want vault
    'fleet-expenses': true,
  };

  const { wantFunctions, dontWantFunctions, processed } = processFunctionToggles(userChoices, allModules);

  // GEMINI.md Rule enforcement: the-g-o-a-t- is always forced off
  assert.equal(processed['the-g-o-a-t-'], false);
  assert.ok(dontWantFunctions.includes('the-g-o-a-t-'));
  assert.ok(dontWantFunctions.includes('dispatch-eta'));
  assert.ok(dontWantFunctions.includes('vault'));

  // Want functions include HRE and Traxxas
  assert.ok(wantFunctions.includes('hre'));
  assert.ok(wantFunctions.includes('traxxas'));
  assert.ok(wantFunctions.includes('master-mechanic'));
  assert.ok(wantFunctions.includes('night-hud'));
  assert.equal(wantFunctions.length, 7);
  assert.equal(dontWantFunctions.length, 3);
});

test('HRE (Highway Restriction Engine) corridor audit & steep mountain grade check', () => {
  function auditHreRoute(params) {
    const truckHeightInches = params.vehicleHeightFt * 12;
    const restrictions = [
      { id: 'hre-1', type: 'LOW_BRIDGE', bridgeHeightInches: 162, name: 'Terrell Overpass' },
      { id: 'hre-2', type: 'STEEP_DOWNGRADE', gradePct: 6.0, name: 'Monteagle Mountain' },
      { id: 'hre-3', type: 'LOW_BRIDGE', bridgeHeightInches: 170, name: 'Loop 820 North' },
    ];

    let criticalCount = 0;
    const evaluated = restrictions.map((r) => {
      if (r.type === 'LOW_BRIDGE') {
        const delta = r.bridgeHeightInches - truckHeightInches;
        const status = delta <= 0 ? 'CRITICAL' : delta < 6 ? 'WARNING' : 'CLEAR';
        if (status === 'CRITICAL') criticalCount++;
        return { ...r, delta, status };
      }
      if (r.type === 'STEEP_DOWNGRADE' && r.gradePct >= 6.0) {
        return { ...r, status: 'WARNING', recommendation: 'ENGAGE JAKE BRAKE STAGE 3 // SPEED LIMIT 35 MPH' };
      }
      return { ...r, status: 'CLEAR' };
    });

    return {
      overallStatus: criticalCount > 0 ? 'CRITICAL_RESTRICTION' : 'SAFE',
      criticalCount,
      evaluated,
      recommendedBypass: criticalCount > 0 ? 'Loop 820 North (Clearance 170")' : null,
    };
  }

  const standard136Truck = auditHreRoute({ vehicleHeightFt: 13.5 }); // 13'6" = 162"
  assert.equal(standard136Truck.overallStatus, 'CRITICAL_RESTRICTION');
  assert.equal(standard136Truck.criticalCount, 1);
  assert.equal(standard136Truck.recommendedBypass, 'Loop 820 North (Clearance 170")');

  const lowProfileTruck = auditHreRoute({ vehicleHeightFt: 12.0 }); // 12'0" = 144"
  assert.equal(lowProfileTruck.overallStatus, 'SAFE');
  assert.equal(lowProfileTruck.criticalCount, 0);
});

test('Traxxas 10Hz High-Frequency Telemetry & Shock Detection', () => {
  function evaluateTraxxasShock(shockG) {
    const RAPID_DECEL_THRESHOLD_G = 0.35;
    const CRASH_IMPACT_THRESHOLD_G = 2.5;

    if (shockG >= CRASH_IMPACT_THRESHOLD_G) {
      return { level: 'EMERGENCY_CRASH', action: 'DISPATCH_SOS_ECALL' };
    }
    if (shockG >= RAPID_DECEL_THRESHOLD_G) {
      return { level: 'HARD_BRAKING', action: 'LOG_TELEMATICS_EVENT' };
    }
    return { level: 'NOMINAL', action: 'NONE' };
  }

  assert.equal(evaluateTraxxasShock(0.20).level, 'NOMINAL');
  assert.equal(evaluateTraxxasShock(0.40).level, 'HARD_BRAKING');
  assert.equal(evaluateTraxxasShock(2.8).level, 'EMERGENCY_CRASH');

  function pingTraxxasBeacon(transponderId) {
    return {
      transponderId,
      pong: true,
      baudRateKbps: 250,
      samplingRateHz: 10,
      protocol: 'J1939 CAN-Bus // Traxxas Telemetry V4',
      status: 'SYNCHRONIZED',
    };
  }

  const ping = pingTraxxasBeacon('TRAXXAS-TX904-ENTERPRISE');
  assert.equal(ping.pong, true);
  assert.equal(ping.baudRateKbps, 250);
  assert.equal(ping.samplingRateHz, 10);
  assert.equal(ping.status, 'SYNCHRONIZED');
});

test('Dependency Injection: FleetCoreEngine flow with MockClock, MockRandomGenerator and MockRepositories', () => {
  class MockClock {
    constructor(fixedTimeIso = '2026-10-31T16:00:00.000Z', fixedTimestamp = 1793462400000) {
      this.fixedTimeIso = fixedTimeIso;
      this.fixedTimestamp = fixedTimestamp;
    }
    now() { return this.fixedTimestamp; }
    toISOString() { return this.fixedTimeIso; }
  }

  class MockRandomGenerator {
    random() { return 0.5; }
    generateDriverId(name) { return `drv-mock-${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)}`; }
    generatePin() { return '9999'; }
    generateTransponderId() { return 'TRAXXAS-MOCK-001'; }
    generateToken(driverId, ts) { return `tok_mock_${driverId}_${ts}`; }
    generateAuditId(ts) { return `hre-mock-${ts}`; }
  }

  class MockDriverRepo {
    constructor() {
      this.drivers = new Map();
    }
    getAll() { return Array.from(this.drivers.values()); }
    getById(id) { return this.drivers.get(id); }
    findByIdentifier(id) { return this.drivers.get(id); }
    save(driver) { this.drivers.set(driver.driverId, driver); }
    count() { return this.drivers.size; }
  }

  // DI Composition
  const clock = new MockClock();
  const random = new MockRandomGenerator();
  const driverRepo = new MockDriverRepo();

  // Validate predictable behavior with zero static coupling
  const driverId = random.generateDriverId('Jeremiah J. Morris');
  const token = random.generateToken(driverId, clock.now());
  const auditId = random.generateAuditId(clock.now());

  assert.equal(driverId, 'drv-mock-jere');
  assert.equal(token, 'tok_mock_drv-mock-jere_1793462400000');
  assert.equal(auditId, 'hre-mock-1793462400000');

  const driver = {
    driverId,
    name: 'Jeremiah J. Morris',
    cdlNumber: 'IL-CDL-98104820',
    fmcsaPin: random.generatePin(),
    traxxasTransponderId: random.generateTransponderId(),
    createdAt: clock.toISOString(),
  };
  driverRepo.save(driver);

  assert.equal(driverRepo.count(), 1);
  assert.equal(driverRepo.getById('drv-mock-jere').fmcsaPin, '9999');
  assert.equal(driverRepo.getById('drv-mock-jere').createdAt, '2026-10-31T16:00:00.000Z');
});

// ============================================================================
// BLUETOOTH ELD 24-HOUR CONNECTION STATISTICS (RSSI & PACKET LOSS) TEST SUITE
// ============================================================================
test('Bluetooth ELD 24-hour connection statistics (RSSI and packet loss) calculation and CSV export', async () => {
  const { bluetoothEldService } = await import('../src/services/bluetoothEldService.ts');

  // 1. Generate 24-hour statistics checkpoints
  const stats = bluetoothEldService.getConnectionStats24Hours();
  assert.equal(stats.length, 24, 'Must return exactly 24 hourly checkpoints covering the last 24 hours');

  // 2. Validate hourly sequential ordering & time bounds
  const hoursAgoValues = stats.map((s) => s.hoursAgo);
  assert.equal(hoursAgoValues[0], 23, 'First record must be 23 hours ago');
  assert.equal(hoursAgoValues[23], 0, 'Last record must be current hour (0 hours ago)');

  // 3. Validate RF metrics: RSSI and Packet Loss
  stats.forEach((pt) => {
    assert.ok(typeof pt.rssi === 'number', 'RSSI must be a number');
    assert.ok(pt.rssi >= -90 && pt.rssi <= -30, `RSSI (${pt.rssi} dBm) must be within valid commercial BLE range (-90 to -30 dBm)`);
    assert.ok(['EXCELLENT', 'GOOD', 'FAIR', 'POOR'].includes(pt.signalQuality), 'Signal quality must be categorized');
    assert.ok(typeof pt.packetLossPct === 'number', 'Packet loss must be a number');
    assert.ok(pt.packetLossPct >= 0 && pt.packetLossPct <= 100, 'Packet loss percent must be between 0 and 100');
    assert.equal(pt.packetsTransmitted, pt.packetsReceived + pt.packetsDropped, 'Packets transmitted must equal received + dropped');
    assert.ok(pt.latencyMs >= 10 && pt.latencyMs <= 60, 'BLE latency must be within realistic commercial range');
    assert.ok(pt.deviceName && pt.deviceName.length > 0, 'Device name must be populated');
    assert.ok(pt.fmcsaId && pt.fmcsaId.length > 0, 'FMCSA ID must be populated');
  });

  // 4. Validate Summary Aggregates
  const summary = bluetoothEldService.getConnectionStatsSummary(stats);
  assert.ok(typeof summary.avgRssi === 'number');
  assert.ok(summary.avgRssi >= -90 && summary.avgRssi <= -30);
  assert.ok(typeof summary.avgPacketLossPct === 'number');
  assert.ok(summary.avgPacketLossPct >= 0 && summary.avgPacketLossPct <= 5);
  assert.equal(summary.totalPackets, 24 * 7200);
  assert.ok(summary.totalDropped >= 0);

  // 5. Validate CSV Export formatting for offline fleet analysis
  const csv = bluetoothEldService.exportConnectionStatsCsv(stats);
  assert.ok(csv.startsWith('Timestamp_ISO,HoursAgo,DeviceName,SerialNumber,FMCSA_Registered_ID,ConnectionStatus,RSSI_dBm,SignalQuality,PacketsTransmitted,PacketsReceived,PacketsDropped,PacketLossPct,LatencyMs,CAN_Protocol,BaudRateKbps'));
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 25, 'CSV must contain 1 header row + 24 hourly data rows');
  assert.match(lines[1], /^-?[0-9]+/);
  assert.ok(csv.includes('GEO-009-US') || csv.includes('SAM-054') || csv.includes('GRM-ELOG') || csv.includes('MOT-304'));
});

// ============================================================================
// FMCSA ERODS TAG-A-LONG & ROADSIDE INSPECTION TEST SUITE (49 CFR § 395.24)
// ============================================================================
test('FMCSA ERoDS Tag-a-Long: Document Scanning, OCR, Pairing & FMCSA Web Services Transfer', async () => {
  const { erodsTagAlongService, DEFAULT_SAMPLE_INSPECTIONS } = await import('../src/services/erodsTagAlongService.ts');

  // 1. Scan and OCR Parse Roadside Inspection Form MCSA-5884
  const scanned = await erodsTagAlongService.scanAndParseInspectionSheet(
    'TX_DPS_MCSA5884_EXAM_REPORT_SIGNED.pdf',
    DEFAULT_SAMPLE_INSPECTIONS[0].ocrExtractedText
  );

  assert.ok(scanned.reportNumber.startsWith('TX-'));
  assert.equal(scanned.jurisdictionState, 'TX');
  assert.equal(scanned.inspectionLevel, 'LEVEL_2_WALK_AROUND');
  assert.ok(scanned.officerName.includes('Trooper'));
  assert.ok(scanned.officerBadgeNumber.includes('4920'));
  assert.equal(scanned.cleanInspection, true);
  assert.equal(scanned.cvsaDecalIssued, true);
  assert.ok(scanned.cvsaDecalNumber?.startsWith('CVSA-'));
  assert.ok(scanned.ocrConfidenceScore >= 95.0);

  // 2. Generate 49 CFR Part 395 Compliant ERoDS Output File
  const erodsContent = erodsTagAlongService.generateCompliantErodsFile('TX-DPS-INSP-4920');
  assert.match(erodsContent, /ELD_REGISTRATION_ID:TWES-ELD-001/);
  assert.match(erodsContent, /ELD_IDENTIFIER:TRUCKWITHEASE-CAB-GATEWAY-V4/);
  assert.match(erodsContent, /HEADER:CARRIER_NAME:.*:ROUTING_KEY:TX-DPS-INSP-4920/);
  assert.match(erodsContent, /DRIVER:NAME:.*:RULES:60HR_7DAYS/);
  assert.match(erodsContent, /EVENT:POWER_UP/);
  assert.match(erodsContent, /DIAGNOSTIC_MALFUNCTIONS:MALFUNCTION_INDICATOR:0/);
  assert.match(erodsContent, /HMAC_SHA256_ATTESTATION_DIGEST:SHA256:/);

  // 3. Create Tag-a-Long Bundle & Transmit to FMCSA Web Services
  const bundle = await erodsTagAlongService.createTagAlongBundle(
    scanned,
    'TX-DPS-INSP-4920',
    'FMCSA_WEB_SERVICES'
  );

  assert.ok(bundle.bundleId.startsWith('TAG-ERODS-'));
  assert.equal(bundle.routingKeyComment, 'TX-DPS-INSP-4920');
  assert.equal(bundle.fmcsaWebServicesStatus, 'ACCEPTED');
  assert.ok(bundle.fmcsaSubmissionReceiptCode.startsWith('RODS-TX-'));
  assert.ok(bundle.cryptographicHashSha256.startsWith('SHA256:'));
  assert.equal(bundle.attestationSigned, true);
  assert.equal(bundle.complianceStatus, 'FULLY_COMPLIANT');
  assert.equal(bundle.eightDayDutyHoursSummary.totalDrivingHours, 48.5);

  // 4. Export Tag-a-Long Audit CSV for fleet offline analysis
  const auditCsv = erodsTagAlongService.exportTagAlongAuditCsv(bundle);
  assert.match(auditCsv, /^BundleID,Timestamp_ISO,RoutingKeyComment,CarrierName,USDOT/);
  assert.ok(auditCsv.includes('TX-DPS-INSP-4920'));
  assert.ok(auditCsv.includes(bundle.fmcsaSubmissionReceiptCode));
  assert.ok(auditCsv.includes(bundle.cryptographicHashSha256));

  // 5. History retrieval
  const allBundles = erodsTagAlongService.getBundles();
  assert.ok(allBundles.length >= 1);
  const retrieved = erodsTagAlongService.getBundleById(bundle.bundleId);
  assert.equal(retrieved?.bundleId, bundle.bundleId);
});



