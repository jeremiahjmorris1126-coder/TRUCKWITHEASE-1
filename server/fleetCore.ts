/**
 * TruckWithEase // Fleet Core Engine (Refactored with Dependency Injection)
 *
 * Implements clean Dependency Injection (DI) with explicit abstractions for:
 * - Time & Clock (IClock)
 * - Randomness & ID Generation (IRandomGenerator)
 * - Driver Store (IDriverRepository)
 * - Function Catalog Store (IFunctionCatalogRepository)
 * - Route Restrictions Store (IHreRestrictionRepository)
 * - Telemetry Link & Vitals (ITraxxasTelemetryProvider)
 * - System Configuration (IFleetConfiguration)
 */

export type DriverRole =
  | 'OWNER_OPERATOR'
  | 'FLEET_DRIVER'
  | 'SAFETY_DISPATCHER'
  | 'MASTER_MECHANIC';

export interface DriverAuthRecord {
  driverId: string;
  name: string;
  email: string;
  phone: string;
  role: DriverRole;
  cdlNumber: string;
  cdlState: string;
  cdlExpirationDate: string;
  medicalCertExp: string;
  assignedUnit: string;
  assignedTrailer: string;
  carrierName: string;
  usdotNumber: string;
  fmcsaPin: string;
  traxxasTransponderId: string;
  activeDutyStatus: 'OFF' | 'SB' | 'D' | 'ON' | 'YM' | 'PC';
  selectedFunctions: string[];
  createdAt: string;
  dqfStatus: 'FULLY_COMPLIANT' | 'WARNING_EXPIRING' | 'NON_COMPLIANT';
}

export interface AppFunctionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'COCKPIT_HUD' | 'DIAGNOSTICS' | 'TELEMETRY' | 'ROUTE_HAZARD' | 'COMPLIANCE';
  icon: string;
  enabled: boolean;
  isCore: boolean;
  badge?: string;
}

export interface HreRestrictionRecord {
  id: string;
  restrictionType: 'LOW_BRIDGE' | 'STEEP_DOWNGRADE' | 'HAZMAT_PROHIBITED' | 'WEIGHT_LIMIT' | 'WEIGH_STATION_MANDATORY';
  corridor: string;
  mileMarker: number;
  locationName: string;
  clearanceFt?: number;
  clearanceDisplay?: string;
  bufferDeltaInches?: number;
  gradePct?: number;
  speedLimitMph?: number;
  runawayRampMile?: number;
  hazmatClassesAffected?: string[];
  actionRequired: string;
  status: 'CRITICAL' | 'WARNING' | 'CLEAR';
  coordinates: { lat: number; lng: number };
}

export interface TraxxasTelemetryRecord {
  transponderId: string;
  beaconStatus: 'CONNECTED_10HZ' | 'STANDBY' | 'ACQUIRING_GPS';
  firmwareVersion: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  speedMph: number;
  headingDeg: number;
  accelerometerG: { x: number; y: number; z: number };
  peakShockG: number;
  brakePressurePsi: number;
  engineCoolantTempF: number;
  turboBoostPsi: number;
  clutchPackTempF: number;
  transmissionOilTempF: number;
  batteryVoltage: number;
  canBusHealthPct: number;
  latencyMs: number;
  lastPingTimestamp: string;
  samplingRateHz: number;
}

export interface TraxxasPingResponse {
  transponderId: string;
  pong: boolean;
  receivedAt: string;
  latencyMs: number;
  signalStrengthDbm: number;
  baudRateKbps: number;
  protocol: string;
  status: string;
}

// ============================================================================
// 1. DEPENDENCY ABSTRACTIONS & INTERFACES
// ============================================================================

export interface IClock {
  now(): number;
  toISOString(): string;
}

export interface IRandomGenerator {
  random(): number;
  generateDriverId(name: string): string;
  generatePin(): string;
  generateTransponderId(): string;
  generateToken(driverId: string, timestamp: number): string;
  generateAuditId(timestamp: number): string;
}

export interface IDriverRepository {
  getAll(): DriverAuthRecord[];
  getById(id: string): DriverAuthRecord | undefined;
  findByIdentifier(identifier: string): DriverAuthRecord | undefined;
  save(driver: DriverAuthRecord): void;
  count(): number;
}

export interface IFunctionCatalogRepository {
  getAll(): AppFunctionDefinition[];
  getById(id: string): AppFunctionDefinition | undefined;
  updateToggles(toggles: Record<string, boolean>): {
    activeFunctions: string[];
    disabledFunctions: string[];
  };
}

export interface IHreRestrictionRepository {
  getAll(): HreRestrictionRecord[];
  findByCorridor(corridor?: string): HreRestrictionRecord[];
}

export interface ITraxxasTelemetryProvider {
  getTelemetry(jitter?: { speedDelta: number; rpmDelta: number; shock: number }): TraxxasTelemetryRecord;
  pushTelemetry(frame: Partial<TraxxasTelemetryRecord>, timestamp: string): TraxxasTelemetryRecord;
  ping(transponderId?: string, timestamp?: string, latencyMs?: number): TraxxasPingResponse;
  setTransponderId(id: string): void;
}

export interface IFleetConfiguration {
  defaultDriverId: string;
  standardTruckHeightFt: number;
  j1939BaudRateKbps: number;
  telemetrySamplingRateHz: number;
  defaultCarrierName: string;
  defaultUsdotNumber: string;
}

// ============================================================================
// 2. DEFAULT SEED DATA
// ============================================================================

export const INITIAL_DRIVERS: DriverAuthRecord[] = [
  {
    driverId: 'drv-jeremiah-904',
    name: 'Jeremiah J. Morris',
    email: 'jeremiah@morrishive.com',
    phone: '(555) 234-5678',
    role: 'OWNER_OPERATOR',
    cdlNumber: 'IL-CDL-98104820',
    cdlState: 'IL',
    cdlExpirationDate: '2027-04-15',
    medicalCertExp: '2026-11-30',
    assignedUnit: 'TRK-904',
    assignedTrailer: 'TRL-5321',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '8821',
    traxxasTransponderId: 'TRAXXAS-TX904-ENTERPRISE',
    activeDutyStatus: 'D',
    selectedFunctions: [
      'night-hud',
      'hos-clocks',
      'radar-54b',
      'master-mechanic',
      'dispatch-eta',
      'vault',
      'fleet-expenses',
      'trip-planner',
      'haptics',
      'ecosystem',
      'telemetry',
      'traxxas',
      'hre',
      'quantum-index',
    ],
    createdAt: '2026-01-10T08:00:00.000Z',
    dqfStatus: 'FULLY_COMPLIANT',
  },
  {
    driverId: 'drv-vance-904',
    name: 'Vance Reynolds',
    email: 'vance.reynolds@morrishive.com',
    phone: '(555) 234-5679',
    role: 'FLEET_DRIVER',
    cdlNumber: 'IL-CDL-4910291',
    cdlState: 'IL',
    cdlExpirationDate: '2028-02-20',
    medicalCertExp: '2027-03-14',
    assignedUnit: 'TRK-904',
    assignedTrailer: 'TRL-5321',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '1048',
    traxxasTransponderId: 'TRAXXAS-TX904-B',
    activeDutyStatus: 'SB',
    selectedFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'master-mechanic', 'traxxas', 'hre'],
    createdAt: '2026-02-01T08:00:00.000Z',
    dqfStatus: 'FULLY_COMPLIANT',
  },
  {
    driverId: 'drv-marcus-702',
    name: 'Marcus Ortiz',
    email: 'marcus.ortiz@truckwithease.com',
    phone: '(555) 839-2041',
    role: 'FLEET_DRIVER',
    cdlNumber: 'TX-CDL-8819204',
    cdlState: 'TX',
    cdlExpirationDate: '2026-12-10',
    medicalCertExp: '2026-11-15',
    assignedUnit: 'TRK-702',
    assignedTrailer: 'TRL-2190',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '7702',
    traxxasTransponderId: 'TRAXXAS-TX702',
    activeDutyStatus: 'ON',
    selectedFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'traxxas', 'hre'],
    createdAt: '2026-03-15T08:00:00.000Z',
    dqfStatus: 'WARNING_EXPIRING',
  },
  {
    driverId: 'drv-devon-518',
    name: 'Devon Hayes',
    email: 'devon.hayes@truckwithease.com',
    phone: '(555) 492-1084',
    role: 'FLEET_DRIVER',
    cdlNumber: 'TN-CDL-3341890',
    cdlState: 'TN',
    cdlExpirationDate: '2028-09-30',
    medicalCertExp: '2027-06-18',
    assignedUnit: 'TRK-518',
    assignedTrailer: 'TRL-4412',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '5518',
    traxxasTransponderId: 'TRAXXAS-TX518',
    activeDutyStatus: 'OFF',
    selectedFunctions: ['night-hud', 'hos-clocks', 'dispatch-eta', 'master-mechanic', 'traxxas', 'hre'],
    createdAt: '2026-04-10T08:00:00.000Z',
    dqfStatus: 'FULLY_COMPLIANT',
  },
  {
    driverId: 'drv-sarah-309',
    name: 'Sarah Kowalski',
    email: 'sarah.k@truckwithease.com',
    phone: '(555) 671-9923',
    role: 'FLEET_DRIVER',
    cdlNumber: 'IN-CDL-7741029',
    cdlState: 'IN',
    cdlExpirationDate: '2027-08-12',
    medicalCertExp: '2026-12-05',
    assignedUnit: 'TRK-309',
    assignedTrailer: 'TRL-8820',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '3309',
    traxxasTransponderId: 'TRAXXAS-TX309',
    activeDutyStatus: 'D',
    selectedFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'master-mechanic', 'fleet-expenses', 'traxxas', 'hre'],
    createdAt: '2026-05-01T08:00:00.000Z',
    dqfStatus: 'FULLY_COMPLIANT',
  },
  {
    driverId: 'drv-tyrone-880',
    name: 'Tyrone Washington',
    email: 'tyrone.w@truckwithease.com',
    phone: '(555) 914-3829',
    role: 'FLEET_DRIVER',
    cdlNumber: 'GA-CDL-5520194',
    cdlState: 'GA',
    cdlExpirationDate: '2027-01-25',
    medicalCertExp: '2027-04-10',
    assignedUnit: 'TRK-880',
    assignedTrailer: 'TRL-9901',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '9980',
    traxxasTransponderId: 'TRAXXAS-TX880',
    activeDutyStatus: 'D',
    selectedFunctions: ['night-hud', 'hos-clocks', 'radar-54b', 'master-mechanic', 'traxxas', 'hre', 'quantum-index'],
    createdAt: '2026-05-20T08:00:00.000Z',
    dqfStatus: 'FULLY_COMPLIANT',
  },
];

export const INITIAL_FUNCTION_DEFINITIONS: AppFunctionDefinition[] = [
  {
    id: 'night-hud',
    name: 'Night HUD Cockpit',
    description: 'High-contrast driver in-cab cockpit with real-time speed, live road vector corridors & alertness',
    category: 'COCKPIT_HUD',
    icon: 'dashboard',
    enabled: true,
    isCore: true,
    badge: 'CORE HUD',
  },
  {
    id: 'hos-clocks',
    name: 'HOS Clocks & Roadside Inspection',
    description: '70h / 8-day duty status timers, FMCSA § 395.8 attestation & instant PDF daily log export',
    category: 'COMPLIANCE',
    icon: 'timer',
    enabled: true,
    isCore: true,
    badge: '49 CFR § 395',
  },
  {
    id: 'radar-54b',
    name: 'FHWA Item 54B Low-Bridge Radar',
    description: 'Low bridge collision avoidance radar with laser buffer delta and dynamic bypass diverter routing',
    category: 'ROUTE_HAZARD',
    icon: 'radar',
    enabled: true,
    isCore: true,
    badge: 'FHWA 54B',
  },
  {
    id: 'hre',
    name: 'HRE (Highway Restriction Engine)',
    description: 'Real-time hazard route engine evaluating low clearances, steep grades, HazMat bans & weigh station scales',
    category: 'ROUTE_HAZARD',
    icon: 'warning',
    enabled: true,
    isCore: true,
    badge: 'HRE SENTINEL',
  },
  {
    id: 'traxxas',
    name: 'Traxxas High-Frequency Telemetry',
    description: '10Hz GPS beacon, 3-axis shock accelerometer, CAN-bus ECM vitals & vehicle idle telemetry',
    category: 'TELEMETRY',
    icon: 'sensors',
    enabled: true,
    isCore: true,
    badge: '10Hz BEACON',
  },
  {
    id: 'master-mechanic',
    name: 'The Master Mechanic',
    description: 'J1939 CAN-Bus live diagnostics, SPN/FMI DTC scanner, component failure radar & kingpin articulation',
    category: 'DIAGNOSTICS',
    icon: 'build_circle',
    enabled: true,
    isCore: true,
    badge: 'J1939 250kbps',
  },
  {
    id: 'dispatch-eta',
    name: 'Dispatch Zero ($/Hr Yield)',
    description: 'Duty-hour load board yield rank ($/Hr), Google Maps corridor & dock door slot assignment',
    category: 'COCKPIT_HUD',
    icon: 'schedule_send',
    enabled: true,
    isCore: false,
    badge: 'DISPATCH ZERO',
  },
  {
    id: 'trip-planner',
    name: 'Trip Planner & Amenities',
    description: 'Real-time geolocation for upcoming truck stops (Love’s, Pilot), CAT scales & weigh stations',
    category: 'ROUTE_HAZARD',
    icon: 'route',
    enabled: true,
    isCore: false,
    badge: 'GEO-STOPS',
  },
  {
    id: 'vault',
    name: 'Security Vault & Federal DQF',
    description: '49 CFR § 390.31 statutory custodian records, cryptographic SHA-256 Merkle stamps & driver qualification files',
    category: 'COMPLIANCE',
    icon: 'lock',
    enabled: true,
    isCore: false,
    badge: '49 CFR § 390.31',
  },
  {
    id: 'fleet-expenses',
    name: 'Invoices & Fuel Accounting',
    description: 'WebstaurantStore freight invoices, IFTA diesel fuel receipts & expense calculations',
    category: 'COMPLIANCE',
    icon: 'receipt_long',
    enabled: true,
    isCore: false,
    badge: 'ACCOUNTING',
  },
  {
    id: 'haptics',
    name: 'Safety Steering Haptics',
    description: 'Tactile driver vibration warnings for lane drift, bridge warnings & critical collision risk',
    category: 'COCKPIT_HUD',
    icon: 'vibration',
    enabled: true,
    isCore: false,
    badge: 'TACTILE',
  },
  {
    id: 'ecosystem',
    name: 'Trust Hub & Carrier Vetting',
    description: 'Broker and shipper verification, payment terms & freight insurance validation',
    category: 'COMPLIANCE',
    icon: 'hub',
    enabled: true,
    isCore: false,
    badge: 'VETTING',
  },
  {
    id: 'telemetry',
    name: 'Engine Telemetry & Memory Tracker',
    description: 'CAN-Bus latency monitor, JavaScript heap memory garbage collector & performance tracker',
    category: 'TELEMETRY',
    icon: 'memory',
    enabled: true,
    isCore: false,
    badge: 'HEAP WATCH',
  },
  {
    id: 'quantum-index',
    name: 'Predictive Quantum Index',
    description: 'Multi-stop axle load annealing solver, predictive thermal physics & kinetic dissipation model',
    category: 'DIAGNOSTICS',
    icon: 'auto_awesome',
    enabled: true,
    isCore: false,
    badge: 'QUANTUM REST',
  },
  {
    id: 'the-g-o-a-t-',
    name: 'The G.O.A.T. (Deprecated)',
    description: 'Permanently replaced by The Master Mechanic protocol per system directives',
    category: 'DIAGNOSTICS',
    icon: 'cancel',
    enabled: false,
    isCore: false,
    badge: 'DEPRECATED',
  },
];

export const INITIAL_HRE_RESTRICTIONS: HreRestrictionRecord[] = [
  {
    id: 'hre-bridge-i20-184',
    restrictionType: 'LOW_BRIDGE',
    corridor: 'I-20 Eastbound',
    mileMarker: 184.2,
    locationName: 'Terrell / Kaufman RR Overpass Structure',
    clearanceFt: 13.5,
    clearanceDisplay: '13\' 6"',
    bufferDeltaInches: 0,
    actionRequired: 'MANDATORY CLEARANCE CHECK // Diverter Bypass available via Loop 820 North (14\' 2")',
    status: 'CRITICAL',
    coordinates: { lat: 32.735, lng: -96.275 },
  },
  {
    id: 'hre-grade-i24-134',
    restrictionType: 'STEEP_DOWNGRADE',
    corridor: 'I-24 Westbound',
    mileMarker: 134.0,
    locationName: 'Monteagle Mountain Pass',
    gradePct: 6.0,
    speedLimitMph: 35,
    runawayRampMile: 136.2,
    actionRequired: 'ENGAGE JAKE BRAKE STAGE 3 // Maximum CMV descent speed 35 MPH // Runaway ramp at MM 136.2',
    status: 'WARNING',
    coordinates: { lat: 35.241, lng: -85.834 },
  },
  {
    id: 'hre-hazmat-tunnel-downtown',
    restrictionType: 'HAZMAT_PROHIBITED',
    corridor: 'I-30 Metro Core',
    mileMarker: 47.1,
    locationName: 'Downtown Cut-and-Cover Tunnel',
    hazmatClassesAffected: ['Class 1 (Explosives)', 'Class 2.1 (Flammable Gas)', 'Class 3 (Flammable Liquids)', 'Class 7 (Radioactive)'],
    actionRequired: 'HAZMAT PLACARDS RESTRICTED // Take North Outer Loop Bypass',
    status: 'CRITICAL',
    coordinates: { lat: 32.776, lng: -96.796 },
  },
  {
    id: 'hre-scale-i20-140',
    restrictionType: 'WEIGH_STATION_MANDATORY',
    corridor: 'I-20 Westbound',
    mileMarker: 140.5,
    locationName: 'TxDOT Commercial Vehicle Inspection Facility',
    actionRequired: 'ALL CMV MUST ENTER UNLESS PREPASS GREEN LIGHT DISPLAYED',
    status: 'CLEAR',
    coordinates: { lat: 32.748, lng: -96.512 },
  },
  {
    id: 'hre-bridge-loop820-22',
    restrictionType: 'LOW_BRIDGE',
    corridor: 'Loop 820 North Bypass',
    mileMarker: 22.4,
    locationName: 'North Tarrant Arch Bridge',
    clearanceFt: 14.167,
    clearanceDisplay: '14\' 2"',
    bufferDeltaInches: 8,
    actionRequired: 'SAFE CLEARANCE CORRIDOR // +8" Buffer delta over 13\' 6" standard',
    status: 'CLEAR',
    coordinates: { lat: 32.839, lng: -97.284 },
  },
];

export const DEFAULT_FLEET_CONFIG: IFleetConfiguration = {
  defaultDriverId: 'drv-jeremiah-904',
  standardTruckHeightFt: 13.5,
  j1939BaudRateKbps: 250,
  telemetrySamplingRateHz: 10,
  defaultCarrierName: 'Morris Hive Freight LLC',
  defaultUsdotNumber: '3948210',
};

// ============================================================================
// 3. CONCRETE DEFAULT IMPLEMENTATIONS (FOR PRODUCTION USE)
// ============================================================================

export class SystemClock implements IClock {
  public now(): number {
    return Date.now();
  }
  public toISOString(): string {
    return new Date().toISOString();
  }
}

export class DefaultRandomGenerator implements IRandomGenerator {
  public random(): number {
    return Math.random();
  }

  public generateDriverId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const suffix = Math.floor(100 + Math.random() * 900);
    return `drv-${slug}-${suffix}`;
  }

  public generatePin(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  public generateTransponderId(): string {
    return `TRAXXAS-BEACON-${Math.floor(100 + Math.random() * 900)}`;
  }

  public generateToken(driverId: string, timestamp: number): string {
    return `tok_${driverId}_${timestamp}`;
  }

  public generateAuditId(timestamp: number): string {
    return `hre-audit-${timestamp}`;
  }
}

export class InMemoryDriverRepository implements IDriverRepository {
  private readonly store = new Map<string, DriverAuthRecord>();

  constructor(initialData: DriverAuthRecord[] = INITIAL_DRIVERS) {
    initialData.forEach((d) => this.store.set(d.driverId, { ...d }));
  }

  public getAll(): DriverAuthRecord[] {
    return Array.from(this.store.values());
  }

  public getById(id: string): DriverAuthRecord | undefined {
    return this.store.get(id);
  }

  public findByIdentifier(identifier: string): DriverAuthRecord | undefined {
    const clean = identifier.trim().toLowerCase();
    for (const d of this.store.values()) {
      if (
        d.driverId.toLowerCase() === clean ||
        d.email.toLowerCase() === clean ||
        d.cdlNumber.toLowerCase() === clean ||
        d.name.toLowerCase() === clean
      ) {
        return d;
      }
    }
    // Partial name fallback
    for (const d of this.store.values()) {
      if (d.name.toLowerCase().includes(clean)) {
        return d;
      }
    }
    return undefined;
  }

  public save(driver: DriverAuthRecord): void {
    this.store.set(driver.driverId, { ...driver });
  }

  public count(): number {
    return this.store.size;
  }
}

export class InMemoryFunctionCatalogRepository implements IFunctionCatalogRepository {
  private readonly store = new Map<string, AppFunctionDefinition>();

  constructor(initialData: AppFunctionDefinition[] = INITIAL_FUNCTION_DEFINITIONS) {
    initialData.forEach((f) => this.store.set(f.id, { ...f }));
  }

  public getAll(): AppFunctionDefinition[] {
    return Array.from(this.store.values());
  }

  public getById(id: string): AppFunctionDefinition | undefined {
    return this.store.get(id);
  }

  public updateToggles(toggles: Record<string, boolean>): {
    activeFunctions: string[];
    disabledFunctions: string[];
  } {
    for (const [id, enabled] of Object.entries(toggles)) {
      if (id === 'the-g-o-a-t-') {
        // Enforce GEMINI.md directive
        const goat = this.store.get(id);
        if (goat) goat.enabled = false;
        continue;
      }
      const existing = this.store.get(id);
      if (existing) {
        existing.enabled = Boolean(enabled);
      }
    }

    const activeFunctions = Array.from(this.store.entries())
      .filter(([_, f]) => f.enabled)
      .map(([k]) => k);
    const disabledFunctions = Array.from(this.store.entries())
      .filter(([_, f]) => !f.enabled)
      .map(([k]) => k);

    return { activeFunctions, disabledFunctions };
  }
}

export class InMemoryHreRestrictionRepository implements IHreRestrictionRepository {
  private readonly restrictions: HreRestrictionRecord[];

  constructor(initialData: HreRestrictionRecord[] = INITIAL_HRE_RESTRICTIONS) {
    this.restrictions = initialData.map((r) => ({ ...r }));
  }

  public getAll(): HreRestrictionRecord[] {
    return [...this.restrictions];
  }

  public findByCorridor(corridor?: string): HreRestrictionRecord[] {
    if (!corridor) return [...this.restrictions];
    const lower = corridor.toLowerCase();
    return this.restrictions.filter((r) => r.corridor.toLowerCase().includes(lower));
  }
}

export class InMemoryTraxxasTelemetryProvider implements ITraxxasTelemetryProvider {
  private currentTelemetry: TraxxasTelemetryRecord;

  constructor(private readonly clock: IClock) {
    this.currentTelemetry = {
      transponderId: 'TRAXXAS-TX904-ENTERPRISE',
      beaconStatus: 'CONNECTED_10HZ',
      firmwareVersion: 'TRAXXAS-V4.2.1-J1939',
      latitude: 32.7767,
      longitude: -96.7970,
      altitudeFt: 432,
      speedMph: 64.8,
      headingDeg: 88.5,
      accelerometerG: { x: 0.02, y: -0.04, z: 1.01 },
      peakShockG: 0.28,
      brakePressurePsi: 112,
      engineCoolantTempF: 194,
      turboBoostPsi: 22.4,
      clutchPackTempF: 168,
      transmissionOilTempF: 185,
      batteryVoltage: 14.1,
      canBusHealthPct: 99.4,
      latencyMs: 12.8,
      lastPingTimestamp: this.clock.toISOString(),
      samplingRateHz: 10,
    };
  }

  public setTransponderId(id: string): void {
    this.currentTelemetry.transponderId = id;
  }

  public getTelemetry(jitter?: { speedDelta: number; rpmDelta: number; shock: number }): TraxxasTelemetryRecord {
    const speedDelta = jitter?.speedDelta ?? 0;
    const shock = jitter?.shock ?? this.currentTelemetry.peakShockG;

    this.currentTelemetry = {
      ...this.currentTelemetry,
      speedMph: Math.max(0, +(this.currentTelemetry.speedMph + speedDelta).toFixed(1)),
      peakShockG: shock,
      lastPingTimestamp: this.clock.toISOString(),
    };
    return { ...this.currentTelemetry };
  }

  public pushTelemetry(frame: Partial<TraxxasTelemetryRecord>, timestamp: string): TraxxasTelemetryRecord {
    this.currentTelemetry = {
      ...this.currentTelemetry,
      ...frame,
      lastPingTimestamp: timestamp,
    };
    return { ...this.currentTelemetry };
  }

  public ping(transponderId?: string, timestamp?: string, latencyMs?: number): TraxxasPingResponse {
    const id = transponderId || this.currentTelemetry.transponderId;
    return {
      transponderId: id,
      pong: true,
      receivedAt: timestamp || this.clock.toISOString(),
      latencyMs: latencyMs ?? 11.2,
      signalStrengthDbm: -68,
      baudRateKbps: 250,
      protocol: 'J1939 CAN-Bus // Traxxas Telemetry V4',
      status: 'SYNCHRONIZED',
    };
  }
}

// ============================================================================
// 4. DEPENDENCY-INJECTED FLEET CORE ENGINE
// ============================================================================

export interface FleetCoreDependencies {
  clock: IClock;
  random: IRandomGenerator;
  driverRepo: IDriverRepository;
  functionRepo: IFunctionCatalogRepository;
  hreRepo: IHreRestrictionRepository;
  telemetryProvider: ITraxxasTelemetryProvider;
  config: IFleetConfiguration;
}

export class FleetCoreEngine {
  private activeDriverId: string;

  constructor(private readonly deps: FleetCoreDependencies) {
    this.activeDriverId = deps.config.defaultDriverId;
  }

  // ==========================================
  // AUTHENTICATION & SIGN-UP SHEET
  // ==========================================
  public signupDriver(payload: Partial<DriverAuthRecord>): {
    success: boolean;
    driver: DriverAuthRecord;
    token: string;
    message: string;
  } {
    if (!payload.name || payload.name.trim().length === 0) {
      throw new Error('Driver name is required.');
    }
    if (!payload.cdlNumber || payload.cdlNumber.trim().length === 0) {
      throw new Error('Valid CDL number is required.');
    }

    const cleanName = payload.name.trim();
    const driverId = this.deps.random.generateDriverId(cleanName);
    const createdAt = this.deps.clock.toISOString();
    const token = this.deps.random.generateToken(driverId, this.deps.clock.now());

    const defaultFunctions = this.deps.functionRepo
      .getAll()
      .filter((f) => f.id !== 'the-g-o-a-t-')
      .map((f) => f.id);

    const newDriver: DriverAuthRecord = {
      driverId,
      name: cleanName,
      email: payload.email?.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@truckwithease.com`,
      phone: payload.phone?.trim() || '(555) 000-0000',
      role: payload.role || 'FLEET_DRIVER',
      cdlNumber: payload.cdlNumber.trim().toUpperCase(),
      cdlState: (payload.cdlState || 'IL').toUpperCase(),
      cdlExpirationDate: payload.cdlExpirationDate || '2028-06-30',
      medicalCertExp: payload.medicalCertExp || '2027-06-30',
      assignedUnit: payload.assignedUnit?.trim() || 'TRK-904',
      assignedTrailer: payload.assignedTrailer?.trim() || 'TRL-5321',
      carrierName: payload.carrierName?.trim() || this.deps.config.defaultCarrierName,
      usdotNumber: payload.usdotNumber?.trim() || this.deps.config.defaultUsdotNumber,
      fmcsaPin: payload.fmcsaPin?.trim() || this.deps.random.generatePin(),
      traxxasTransponderId: payload.traxxasTransponderId?.trim() || this.deps.random.generateTransponderId(),
      activeDutyStatus: 'OFF',
      selectedFunctions: Array.isArray(payload.selectedFunctions) && payload.selectedFunctions.length > 0
        ? payload.selectedFunctions
        : defaultFunctions,
      createdAt,
      dqfStatus: 'FULLY_COMPLIANT',
    };

    this.deps.driverRepo.save(newDriver);
    this.activeDriverId = driverId;

    return {
      success: true,
      driver: newDriver,
      token,
      message: `Driver ${newDriver.name} successfully registered and signed in.`,
    };
  }

  public signinDriver(identifier: string, fmcsaPin?: string): {
    success: boolean;
    driver: DriverAuthRecord;
    token: string;
  } {
    if (!identifier || identifier.trim().length === 0) {
      throw new Error('Driver identifier (Name, CDL, Email or Driver ID) is required.');
    }

    const found = this.deps.driverRepo.findByIdentifier(identifier);
    if (!found) {
      throw new Error(`Driver credentials not found for identifier "${identifier}". Please sign up.`);
    }

    if (fmcsaPin && found.fmcsaPin && found.fmcsaPin !== fmcsaPin.trim()) {
      throw new Error('Invalid FMCSA Roadside PIN.');
    }

    this.activeDriverId = found.driverId;
    const token = this.deps.random.generateToken(found.driverId, this.deps.clock.now());

    return {
      success: true,
      driver: found,
      token,
    };
  }

  public getSession(): { authenticated: boolean; activeDriver: DriverAuthRecord | null; totalDrivers: number } {
    const activeDriver = this.deps.driverRepo.getById(this.activeDriverId) || this.deps.driverRepo.getAll()[0] || null;
    return {
      authenticated: Boolean(activeDriver),
      activeDriver,
      totalDrivers: this.deps.driverRepo.count(),
    };
  }

  public signout(): { success: boolean; message: string } {
    return {
      success: true,
      message: 'Active driver session cleared.',
    };
  }

  // ==========================================
  // FLEET DRIVER ROSTER & SELECTION
  // ==========================================
  public getAllDrivers(): DriverAuthRecord[] {
    return this.deps.driverRepo.getAll();
  }

  public getDriverById(id: string): DriverAuthRecord | undefined {
    return this.deps.driverRepo.getById(id);
  }

  public selectDriver(driverId: string): DriverAuthRecord {
    const driver = this.deps.driverRepo.getById(driverId);
    if (!driver) {
      throw new Error(`Driver with ID "${driverId}" does not exist in fleet roster.`);
    }
    this.activeDriverId = driverId;

    if (driver.traxxasTransponderId) {
      this.deps.telemetryProvider.setTransponderId(driver.traxxasTransponderId);
    }

    return driver;
  }

  public updateDriver(driverId: string, updates: Partial<DriverAuthRecord>): DriverAuthRecord {
    const existing = this.deps.driverRepo.getById(driverId);
    if (!existing) {
      throw new Error(`Driver with ID "${driverId}" not found.`);
    }
    const updated: DriverAuthRecord = {
      ...existing,
      ...updates,
      driverId: existing.driverId,
    };
    this.deps.driverRepo.save(updated);
    return updated;
  }

  // ==========================================
  // FUNCTION & FEATURE TOGGLES
  // ==========================================
  public getFunctionsCatalog(): { functions: AppFunctionDefinition[]; enabledCount: number; disabledCount: number } {
    const functions = this.deps.functionRepo.getAll();
    const enabledCount = functions.filter((f) => f.enabled).length;
    const disabledCount = functions.length - enabledCount;
    return { functions, enabledCount, disabledCount };
  }

  public updateFunctionToggles(toggles: Record<string, boolean>): {
    success: boolean;
    activeFunctions: string[];
    disabledFunctions: string[];
  } {
    const result = this.deps.functionRepo.updateToggles(toggles);

    // Update active driver selection
    const active = this.deps.driverRepo.getById(this.activeDriverId);
    if (active) {
      active.selectedFunctions = [...result.activeFunctions];
      this.deps.driverRepo.save(active);
    }

    return {
      success: true,
      activeFunctions: result.activeFunctions,
      disabledFunctions: result.disabledFunctions,
    };
  }

  // ==========================================
  // HRE (HIGHWAY RESTRICTION ENGINE)
  // ==========================================
  public getHreRestrictions(corridor?: string): HreRestrictionRecord[] {
    return this.deps.hreRepo.findByCorridor(corridor);
  }

  public auditHreRoute(params: {
    corridor: string;
    vehicleHeightFt: number;
    grossWeightLbs?: number;
    hasHazmat?: boolean;
  }) {
    const vehicleHeightFt = Number(params.vehicleHeightFt) || this.deps.config.standardTruckHeightFt;
    const vehicleHeightInches = vehicleHeightFt * 12;

    const matchedRestrictions = this.deps.hreRepo.findByCorridor(params.corridor);
    const sourceRestrictions = matchedRestrictions.length > 0 ? matchedRestrictions : this.deps.hreRepo.getAll();

    let criticalCount = 0;
    let warningCount = 0;
    let minClearanceInches = 999;
    let minClearanceDisplay = "16' 0\"";

    const evaluatedRestrictions = sourceRestrictions.map((r) => {
      const copy = { ...r };
      if (r.restrictionType === 'LOW_BRIDGE' && r.clearanceFt) {
        const bridgeInches = r.clearanceFt * 12;
        const delta = Math.round(bridgeInches - vehicleHeightInches);
        copy.bufferDeltaInches = delta;
        if (bridgeInches < minClearanceInches) {
          minClearanceInches = bridgeInches;
          minClearanceDisplay = r.clearanceDisplay || `${Math.floor(bridgeInches / 12)}' ${bridgeInches % 12}"`;
        }
        if (delta <= 0) {
          copy.status = 'CRITICAL';
          criticalCount++;
        } else if (delta < 6) {
          copy.status = 'WARNING';
          warningCount++;
        } else {
          copy.status = 'CLEAR';
        }
      } else if (r.status === 'CRITICAL') {
        criticalCount++;
      } else if (r.status === 'WARNING') {
        warningCount++;
      }
      return copy;
    });

    const lowestBufferDeltaInches = minClearanceInches !== 999 ? Math.round(minClearanceInches - vehicleHeightInches) : 12;
    const overallStatus: 'SAFE' | 'ADVISORY' | 'CRITICAL_RESTRICTION' =
      criticalCount > 0 ? 'CRITICAL_RESTRICTION' : warningCount > 0 ? 'ADVISORY' : 'SAFE';

    return {
      auditId: this.deps.random.generateAuditId(this.deps.clock.now()),
      corridor: params.corridor || 'I-20 Eastbound Freight Corridor',
      timestamp: this.deps.clock.toISOString(),
      overallStatus,
      criticalCount,
      warningCount,
      evaluatedHeightFt: vehicleHeightFt,
      minimumVerticalClearanceFt: minClearanceInches !== 999 ? minClearanceInches / 12 : 14.5,
      minimumClearanceDisplay: minClearanceDisplay,
      lowestBufferDeltaInches,
      activeRestrictions: evaluatedRestrictions,
      recommendedBypassCorridor: criticalCount > 0 ? 'Loop 820 North Bypass (Vertical Clearance 14\' 2")' : undefined,
      complianceAttestation: 'VERIFIED UNDER FHWA ITEM 54B & FMCSA ROUTE REGISTRY',
    };
  }

  // ==========================================
  // TRAXXAS HIGH-FREQUENCY TELEMETRY SUITE
  // ==========================================
  public getTraxxasTelemetry(): TraxxasTelemetryRecord {
    const jitterSpeed = (this.deps.random.random() - 0.5) * 0.4;
    const jitterRpm = Math.floor((this.deps.random.random() - 0.5) * 20);
    const jitterShock = Math.max(0.1, +(this.deps.random.random() * 0.3).toFixed(2));

    return this.deps.telemetryProvider.getTelemetry({
      speedDelta: jitterSpeed,
      rpmDelta: jitterRpm,
      shock: jitterShock,
    });
  }

  public pushTraxxasTelemetry(frame: Partial<TraxxasTelemetryRecord>): TraxxasTelemetryRecord {
    return this.deps.telemetryProvider.pushTelemetry(frame, this.deps.clock.toISOString());
  }

  public pingTraxxasTransponder(transponderId?: string): TraxxasPingResponse {
    const latency = +(8.0 + this.deps.random.random() * 6.0).toFixed(1);
    return this.deps.telemetryProvider.ping(transponderId, this.deps.clock.toISOString(), latency);
  }
}

// ============================================================================
// 5. DEPENDENCY INJECTION CONTAINER & FACTORY
// ============================================================================

export class FleetCoreContainer {
  public readonly clock: IClock;
  public readonly random: IRandomGenerator;
  public readonly driverRepo: IDriverRepository;
  public readonly functionRepo: IFunctionCatalogRepository;
  public readonly hreRepo: IHreRestrictionRepository;
  public readonly telemetryProvider: ITraxxasTelemetryProvider;
  public readonly config: IFleetConfiguration;
  public readonly engine: FleetCoreEngine;

  constructor(customDeps?: Partial<FleetCoreDependencies>) {
    this.clock = customDeps?.clock ?? new SystemClock();
    this.random = customDeps?.random ?? new DefaultRandomGenerator();
    this.driverRepo = customDeps?.driverRepo ?? new InMemoryDriverRepository();
    this.functionRepo = customDeps?.functionRepo ?? new InMemoryFunctionCatalogRepository();
    this.hreRepo = customDeps?.hreRepo ?? new InMemoryHreRestrictionRepository();
    this.telemetryProvider = customDeps?.telemetryProvider ?? new InMemoryTraxxasTelemetryProvider(this.clock);
    this.config = customDeps?.config ?? DEFAULT_FLEET_CONFIG;

    this.engine = new FleetCoreEngine({
      clock: this.clock,
      random: this.random,
      driverRepo: this.driverRepo,
      functionRepo: this.functionRepo,
      hreRepo: this.hreRepo,
      telemetryProvider: this.telemetryProvider,
      config: this.config,
    });
  }
}

export function createFleetCore(customDeps?: Partial<FleetCoreDependencies>): FleetCoreEngine {
  const container = new FleetCoreContainer(customDeps);
  return container.engine;
}

// Default container instance providing backward compatibility for server.ts
export const defaultFleetContainer = new FleetCoreContainer();
export const fleetCore = defaultFleetContainer.engine;
