export type TabId = 'night-hud' | 'hos-clocks' | 'radar-54b' | 'master-mechanic' | 'the-g-o-a-t-' | 'haptics' | 'ecosystem' | 'vault' | 'telemetry' | 'dispatch-eta' | 'master-sync' | 'quantum-index' | 'fleet-expenses' | 'trip-planner';

export type DutyStatus = 'OFF' | 'SB' | 'D' | 'ON' | 'YM' | 'PC';

export interface DayLog {
  id: string;
  dayLabel: string;
  shortDate: string;
  dateStr: string;
  driveHours: string;
  onDutyHours: string;
  sleeperHours: string;
  offDutyHours: string;
  deficiencies: number;
  status: 'COMPLIANT' | 'VIOLATION' | 'UNVERIFIED';
  verifiedHash: string;
  milesTraveled: number;
  signature: string;
  manifest: string;
}

export interface WeighStation {
  id: string;
  name: string;
  corridor: string;
  mileMarker: number;
  milesAway: number;
  status: 'OPEN' | 'CLOSED' | 'BYPASS_ACTIVE';
  prePassAuthorized: boolean;
  scaleType: string;
}

export interface ParkingSpot {
  id: string;
  name: string;
  brand: 'Love\'s' | 'Pilot Flying J' | 'TA Express' | 'Rest Area';
  exit: string;
  mileMarker: number;
  milesAway: number;
  totalSpots: number;
  availableSpots: number;
  amenities: string[];
  status: 'AMPLE' | 'LIMITED' | 'FULL';
}

export interface FleetModuleSetting {
  id: TabId;
  name: string;
  description: string;
  category: 'HUD' | 'SAFETY' | 'OPERATIONS' | 'COMPLIANCE' | 'ANALYTICS';
  enabled: boolean;
  userEditable: boolean;
}

export interface FleetCustomizationSettings {
  speedAlertToleranceMph: number; // 0 to 15
  brakeThermalWarningTempF: number; // 350 to 550
  vehicleHeightFt: number; // 12.5 to 14.5
  defaultStartTab: TabId;
  autoStateBoundaryAlerts: boolean;
  voiceControlEnabled: boolean;
  enabledModules: Partial<Record<TabId, boolean>>;
}

export type InspectionActionType = 'PDF_GENERATED' | 'PRINTED' | 'ROADSIDE_AUDIT' | 'VOICE_TRIGGERED' | 'FMCSA_PORTAL_SYNC' | 'DVIR_SIGNOFF';
export type InspectionTriggerSource = 'VOICE_CONTROL' | 'MANUAL_HUD' | 'OFFICER_REQUEST' | 'CAB_PRINTER' | 'SCHEDULED_DISPATCH' | 'QUANTUM_INDEX_AUDIT' | 'ONE_TAP_COCKPIT';

export interface InspectionLogEntry {
  id: string;
  timestamp: string; // ISO 8601 or ISO string
  displayTime: string; // e.g. "2026-09-11 15:02:18 CDT"
  relativeTime: string; // e.g. "Just now", "2 hours ago"
  actionTitle: string; // e.g. "FMCSA § 395.8 8-Day Driver Daily Log Package"
  actionType: InspectionActionType;
  triggerSource: InspectionTriggerSource;
  cycle: string; // e.g. "70-Hour / 8-Day"
  daysCovered: number; // 8
  merkleHash: string; // SHA-256
  recordNumber: string; // e.g. "REC-2026-0911-4138"
  fileSize: string; // e.g. "342 KB"
  verified: boolean;
  notes: string;
}

export interface BridgeGeofence {
  id: string;
  name: string;
  highway: string;
  mileMarker: number;
  clearanceFt: number; // Height in decimal feet, e.g. 13.167 = 13'2", 13.5 = 13'6", 14.0 = 14'0", 15.167 = 15'2"
  clearanceDisplay: string; // Display text e.g. "13' 2\"", "13' 5\"", "13' 6\"", "14' 0\"", "15' 2\""
  direction: string;
  positionPercent: number; // 0-100% position on mini-map corridor
  coordinates: { x: number; y: number }; // (x, y) % on 2D grid
  restrictionStatus: 'CRITICAL_LOW' | 'WARNING_TIGHT' | 'SAFE_PASS' | 'HIGH_CLEARANCE';
  laserSensorReading?: string;
  notes: string;
}

export type LoadStatus = 'ON_TIME' | 'DELAY_RISK' | 'EARLY' | 'CRITICAL_LATE';

export interface DispatchLoad {
  id: string;
  loadNumber: string; // e.g. "LD-8902"
  driverName: string; // e.g. "Jeremiah J. Morris"
  truckUnit: string; // e.g. "TRK-904"
  trailerUnit: string; // e.g. "TRL-5321"
  cargoDescription: string; // e.g. "Automotive Components (High Value)"
  originFacility: string; // e.g. "Dallas Hub (TX)"
  destinationTerminal: string; // e.g. "Fort Worth Logistics Gateway"
  dockDoor: string; // e.g. "Door 04"
  scheduledSlotHour: number; // 8, 10, 12, 14, 16 (hour 8-18)
  scheduledWindowDisplay: string; // e.g. "08:00 - 10:00 CDT"
  predictiveEta: string; // e.g. "08:42 CDT"
  predictiveEtaMinutesOffset: number; // e.g. +12 or -15
  confidenceScore: number; // e.g. 96 (%)
  status: LoadStatus;
  riskFactor: string; // e.g. "I-20 Construction slowdown (+12m)"
  hosRemaining: string; // e.g. "06h 45m"
  temperatureControlled: boolean;
  requiredTempFt?: string; // e.g. "-10°F Reefers"
  milesRemaining: number;
  priority: 'CRITICAL' | 'EXPEDITED' | 'STANDARD';
}

export interface PreRunAuditCheck {
  id: string;
  category: 'HOS_COMPLIANCE' | 'BRIDGE_CLEARANCE' | 'AXLE_WEIGHT' | 'WEATHER_RADAR' | 'SECURITY_SEAL' | 'DISPATCH_DOCK';
  title: string;
  status: 'PASSED' | 'WARNING' | 'ACTION_REQUIRED';
  detailValue: string;
  recommendation: string;
  icon: string;
}

export type DriverAlertnessStatus = 'OPTIMAL' | 'MILD_LOWER' | 'FATIGUE_WARNING' | 'CRITICAL_EXHAUSTION';

export interface DriverAlertnessData {
  score: number; // 0 - 100
  status: DriverAlertnessStatus;
  averageLatencyMs: number; // Rolling average latency in ms
  lastLatencyMs: number; // Last interaction latency in ms
  totalInteractions: number;
  fatigueFlagged: boolean;
  recommendedRestArea?: {
    name: string;
    brand: string;
    exit: string;
    mileMarker: number;
    milesAway: number;
    availableSpots: number;
    amenities: string[];
  };
}

export type DotDocCategory =
  | 'DAILY_LOGS'
  | 'DRIVER_DQF'
  | 'DRUG_ALCOHOL'
  | 'VEHICLE_DVIR'
  | 'FLEET_INSURANCE'
  | 'HAZMAT_SAFETY';

export type DotDocStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'PENDING_AUDIT';

export interface DotDocumentRecord {
  id: string;
  documentTitle: string;
  category: DotDocCategory;
  cfrReference: string;
  issuedDate: string;
  expirationDate: string;
  status: DotDocStatus;
  issuingAuthority: string;
  documentNumber: string;
  driverName: string;
  unitNumber: string;
  merkleProofHash: string;
  fileSizeBytes: number;
  fileFormat: string;
  notes: string;
  certified: boolean;
  imageUrl?: string;
  capturedViaCamera?: boolean;
  cameraMetadata?: {
    timestamp: string;
    geoCoordinates?: string;
    resolution?: string;
  };
}

export type DotDocSortField = 'expirationDate' | 'issuedDate' | 'documentTitle' | 'category' | 'status';
export type DotDocSortOrder = 'asc' | 'desc';

export type InvoiceCategory =
  | 'FLEET_MEMBERSHIPS_SUPPLIES'
  | 'FUEL_DIESEL'
  | 'MAINTENANCE_PARTS'
  | 'TOLLS_SCALES'
  | 'MEALS_CATERING'
  | 'LODGING_TRAVEL';

export interface InvoiceItem {
  itemNumber: string;
  description: string;
  unitPrice: number;
  qty: number;
  estTax: number;
  total: number;
}

export interface FleetInvoiceRecord {
  id: string;
  orderNumber: string;
  userId?: string;
  dateOrdered: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorContactEmail: string;
  billToName: string;
  billToCompany?: string;
  billToAddress: string;
  shipToName: string;
  shipToCompany?: string;
  shipToAddress: string;
  shippingMethod: string;
  customerPo?: string;
  customerPhone: string;
  category: InvoiceCategory;
  items: InvoiceItem[];
  subtotal: number;
  shippingAndHandling: number;
  estimatedTax: number;
  totalAmount: number;
  balanceDue: number;
  paymentMethod: string;
  notes?: string;
  taxDeductible: boolean;
  status: 'PAID' | 'PENDING' | 'REIMBURSED' | 'AUDITED';
  capturedViaCamera?: boolean;
}

export type WaypointCategory = 'REST_STOP' | 'FUEL_STATION' | 'WEIGH_STATION';

export interface TripWaypoint {
  id: string;
  name: string;
  category: WaypointCategory;
  corridor: string;
  mileMarker: number;
  lat: number;
  lon: number;
  distanceMiles: number; // Computed live from driver lat/lon
  etaMinutes: number; // Computed live based on current speed
  exitNumber: string;
  
  // Specific attributes for Fuel Stations
  dieselPricePerGal?: number;
  defAvailable?: boolean;
  highFlowPumps?: boolean;
  showersAvailable?: number;
  
  // Specific attributes for Rest Areas / Parking
  availableParkingSpots?: number;
  totalParkingSpots?: number;
  parkingStatus?: 'AMPLE' | 'LIMITED' | 'FULL';
  amenities?: string[];
  
  // Specific attributes for Weigh Stations
  weighStationStatus?: 'OPEN' | 'CLOSED' | 'BYPASS_ACTIVE';
  prePassAuthorized?: boolean;
  scaleType?: string;
  bypassProbabilityPct?: number;

  notes?: string;
}

export interface TripRoutePlan {
  id: string;
  title: string;
  origin: string;
  destination: string;
  totalDistanceMiles: number;
  totalEstHours: number;
  activeCorridor: string;
  waypoints: TripWaypoint[];
}

export interface FuelLogEntry {
  id: string;
  date: string;
  timestamp: number;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
  currentOdometer: number;
  previousOdometer: number;
  milesDriven: number;
  mpg: number;
  costPerMile: number;
  fuelType?: 'DIESEL' | 'DEF' | 'REEFER';
  stationName?: string;
  notes?: string;
}

export type HudVisionProfile = 'HIGH_CONTRAST' | 'MINIMALIST' | 'ROUTE_FOCUSED';

export type CockpitLayoutMode = 'FLIGHT_DECK' | 'PERIMETER' | 'MINIMALIST';

export interface CockpitActionControl {
  id: string;
  label: string;
  iconName?: string;
  zone: 'TOP' | 'SIDE' | 'BOTTOM' | 'DROPDOWN';
  category: 'PRIMARY' | 'OPERATIONAL' | 'INTEGRATION' | 'DIRECTIVE';
  badge?: string;
  active?: boolean;
}

export interface ExternalBenchmarkBridge {
  id: 'SAMSARA' | 'MOTIVE' | 'GEOTAB' | 'KEEP_TRUCKIN';
  name: string;
  category: 'TELEMATICS_BRIDGE';
  status: 'CONNECTED' | 'DISCONNECTED' | 'COMPLIANT_BYPASS';
  syncLatencyMs: number;
}

// ============================================================================
// LIVE DISPATCH MONITOR TYPES & DRIVER RADAR
// ============================================================================
export type DispatchMonitorStageStatus =
  | 'DEPARTED_ORIGIN'
  | 'ARRIVING_DESTINATION'
  | 'ARRIVED_DESTINATION'
  | 'DEPARTED_DESTINATION'
  | 'BACK_HOME';

export interface DispatchMonitorDriver {
  id: string;
  name: string;
  truckUnit: string;
  trailerUnit?: string;
  phone: string;
  email?: string;
  currentStatus: DispatchMonitorStageStatus;
  cycleNumber: number;
  lat: number;
  lng: number;
  headingDeg: number;
  speedMph: number;
  originLat: number;
  originLng: number;
  originCity: string;
  originState: string;
  destinationLat: number;
  destinationLng: number;
  destinationCity: string;
  destinationState: string;
  homeTerminalLat: number;
  homeTerminalLng: number;
  homeTerminalCity: string;
  currentLocationName: string;
  currentLocationCity: string;
  currentLocationState?: string;
  milesRemaining: number;
  odometerMiles: number;
  detentionMinutes: number;
  detentionHourlyRate?: number;
  loadNumber: string;
  bolNumber?: string;
  commodity?: string;
  etaDestination: string;
  avatarColor: string;
  avatarInitials: string;
  lastAlertText: string;
  cruiseControlStatus?: string;
  engineRpm?: number;
  transmissionGear?: string;
  fuelLevelPct: number;
  defLevelPct?: number;
  coolantTempF?: number;
  oilPressurePsi?: number;
  reeferTempF?: number;
  reeferSetpointF?: number;
  reeferStatusText?: string;
  batteryVoltage?: number;
  brakeAirPressurePsi?: { primary: number; secondary: number };
  engineBrakeStatus?: string;
  instantMpg?: number;
  hosDriveRemainingMin?: number;
  hosShiftRemainingMin?: number;
  hosCycleRemainingMin?: number;
  axleWeights?: { steerLbs: number; driveLbs: number; trailerLbs: number; grossLbs: number };

  // Priority Alert Telemetry (High Priority Marker Highlights)
  hasPriorityAlert?: boolean;
  priorityAlertLevel?: 'CRITICAL' | 'HIGH' | 'EXPEDITED';
  priorityAlertDetails?: string;
  priorityAlertCode?: string;
}

// ============================================================================
// BROKERED LOADS SHIPPERS & RECEIVERS REPEATED TIME MEMORY
// ============================================================================
export interface BrokeredLoadMemory {
  id: string;
  brokerName: string;
  brokerMc: string;
  commodity: string;
  shipperFacility: {
    name: string;
    cityState: string;
    address: string;
    avgDwellMinutes: number;
    historicalLoadTimesCount: number;
    onTimeDockProbabilityPct: number;
    gateCode?: string;
    operatingHours: string;
    detentionThresholdMinutes: number;
    repeatedVisitsCount: number;
    notes: string;
  };
  receiverFacility: {
    name: string;
    cityState: string;
    address: string;
    avgUnloadMinutes: number;
    historicalUnloadTimesCount: number;
    onTimeDockProbabilityPct: number;
    gateCode?: string;
    operatingHours: string;
    detentionThresholdMinutes: number;
    repeatedVisitsCount: number;
    notes: string;
  };
  lane: {
    origin: string;
    destination: string;
    corridor: string;
    totalDistanceMiles: number;
    avgHistoricalTransitHours: number;
    repeatCyclesCount: number;
  };
  financialMemory: {
    avgRatePerMile: number;
    historicalYieldRate: string;
    lastContractedRate: number;
    paymentTermsDays: number;
    quickPayFeePct: number;
  };
  reliabilityScorecard: {
    overallGrade: 'A+' | 'A' | 'B+' | 'B' | 'C';
    detentionRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    recommendation: string;
  };
  lastDispatchedDate: string;
}

// ============================================================================
// DOT & FMCSA FEDERAL DOCUMENT CUSTODY & FLEET RECORDS
// ============================================================================
export interface FederalComplianceAttestation {
  cfrRegulation: '49 CFR § 390.31' | '49 CFR § 391.51' | '49 CFR § 395.8' | '49 CFR § 396.11' | '49 CFR § 382.701';
  carrierLegalName: string;
  usdotNumber: string;
  mcNumber: string;
  certifiedCustodianName: string;
  custodianTitle: string;
  digitalSignatureSha256: string;
  timestampIso: string;
  retentionExpiryDate: string;
  tamperEvidentSealVerified: boolean;
  legalCustodyResponsibilityAccepted: boolean;
}

export interface FleetDriverFileRecord {
  driverId: string;
  driverName: string;
  cdlNumber: string;
  cdlState: string;
  cdlExpirationDate: string;
  medCardExpirationDate: string;
  annualMvrReviewDate: string;
  clearinghouseQueryDate: string;
  dvirLastSignedDate: string;
  dqfStatus: 'FULLY_COMPLIANT' | 'WARNING_EXPIRING' | 'NON_COMPLIANT';
  dqfCompletionPct: number;
  documentsCount: number;
  lastAuditPassed: boolean;
}

// ============================================================================
// DRIVER DISPATCH MASTER LOOP ENGINE TYPES
// ============================================================================
export interface TacticalNotification {
  id: string;
  timestamp?: string;
  time?: string;
  category?: 'SAFETY' | 'MAINTENANCE' | 'COMPLIANCE' | 'WEATHER' | 'DISPATCH';
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'alert' | 'warning' | 'info';
  read: boolean;
  actionRequired?: boolean;
}
export type MasterLoopMilestone =
  | 'ORIGIN_DEPARTURE'
  | 'DESTINATION_ARRIVAL'
  | 'DESTINATION_DEPARTURE'
  | 'HOME_ARRIVAL';

export interface MasterLoopDriverProfile {
  name: string;
  driverId: string;
  phone: string;
  email: string;
  truckUnit: string;
  trailerUnit: string;
  cdlNumber: string;
  carrierName: string;
  usdotNumber: string;
  currentOdometer: number;
}

export interface MasterLoopDispatchContacts {
  dispatcherName: string;
  dispatchPhone: string;
  dispatchEmail: string;
  safetyEmail: string;
  brokerPhone: string;
  brokerEmail: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  inCabVoiceAlerts: boolean;
  autoLoopAdvance: boolean;
}

export interface MasterLoopFacility {
  name: string;
  facilityCode: string;
  address: string;
  cityStateZip: string;
  lat: number;
  lng: number;
  geofenceRadiusMiles: number;
  contactName: string;
  contactPhone: string;
  gateCode?: string;
  dockNumber?: string;
}

export interface MasterLoopTripDetails {
  tripId: string;
  loadNumber: string;
  bolNumber: string;
  commodity: string;
  weightLbs: number;
  sealNumber: string;
  reeferTempF: number;
  originLot: MasterLoopFacility & { gateCode?: string };
  destination: MasterLoopFacility & { dockNumber?: string; gateCode?: string };
  homeTerminal: MasterLoopFacility;
  totalRoundTripMiles: number;
}

export interface MasterLoopStageRecord {
  stage: MasterLoopMilestone;
  orderNumber: 1 | 2 | 3 | 4;
  title: string;
  shortLabel: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  geofencePassed: boolean;
  locationSnapshot: string;
  odometerMiles?: number;
  triggeredAt?: string;
  smsAlert: {
    dispatched: boolean;
    toPhone: string;
    body: string;
    timestamp?: string;
    carrierSid?: string;
    carrierStatus?: string;
  };
  emailAlert: {
    dispatched: boolean;
    toEmail: string;
    subject: string;
    bodyText: string;
    timestamp?: string;
    deliveryId?: string;
    status?: string;
  };
  inCabAlertSpoken: boolean;
}

export interface MasterLoopCycleHistory {
  cycleId: string;
  cycleNumber: number;
  tripLoadNumber: string;
  startedAt: string;
  completedAt: string;
  totalDurationMinutes: number;
  startOdometer: number;
  endOdometer: number;
  totalMilesDriven: number;
  stagesCompleted: number;
  allAlertsDelivered: boolean;
  notes: string;
}

export interface MasterLoopSystemState {
  loopId: string;
  currentCycleNumber: number;
  currentStage: MasterLoopMilestone;
  currentStageIndex: number;
  isAutoLoopRunning: boolean;
  simulationSpeedMs: number;
  odometerMiles: number;
  fuelLevelPct: number;
  stages: MasterLoopStageRecord[];
  driver: MasterLoopDriverProfile;
  dispatch: MasterLoopDispatchContacts;
  trip: MasterLoopTripDetails;
  history: MasterLoopCycleHistory[];
  auditLogs: (string | any)[];
  totalCyclesCompleted: number;
  lastDispatchedAt?: string;
}

// ============================================================================
// DRIVER AUTH, ROSTER SELECTION & MODULAR APP FUNCTIONS
// ============================================================================
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
  activeDutyStatus: DutyStatus;
  selectedFunctions: string[];
  createdAt: string;
  dqfStatus: 'FULLY_COMPLIANT' | 'WARNING_EXPIRING' | 'NON_COMPLIANT';
}

export interface DriverSignUpPayload {
  name: string;
  email: string;
  phone: string;
  role: DriverRole;
  cdlNumber: string;
  cdlState: string;
  cdlExpirationDate?: string;
  medicalCertExp?: string;
  assignedUnit?: string;
  assignedTrailer?: string;
  carrierName?: string;
  usdotNumber?: string;
  fmcsaPin?: string;
  traxxasTransponderId?: string;
  selectedFunctions?: string[];
}

export interface DriverSignInPayload {
  identifier: string; // driverId, email, or CDL
  fmcsaPin?: string;
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

// ============================================================================
// HRE (HIGHWAY RESTRICTION & HAZARD ROUTE ENGINE)
// ============================================================================
export type HreRestrictionType =
  | 'LOW_BRIDGE'
  | 'STEEP_DOWNGRADE'
  | 'HAZMAT_PROHIBITED'
  | 'WEIGHT_LIMIT'
  | 'WEIGH_STATION_MANDATORY';

export interface HreRestrictionRecord {
  id: string;
  restrictionType: HreRestrictionType;
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

export interface HreRouteAuditRequest {
  corridor: string;
  vehicleHeightFt: number;
  grossWeightLbs?: number;
  hasHazmat?: boolean;
}

export interface HreRouteAuditResponse {
  auditId: string;
  corridor: string;
  timestamp: string;
  overallStatus: 'SAFE' | 'ADVISORY' | 'CRITICAL_RESTRICTION';
  criticalCount: number;
  warningCount: number;
  evaluatedHeightFt: number;
  minimumVerticalClearanceFt: number;
  minimumClearanceDisplay: string;
  lowestBufferDeltaInches: number;
  activeRestrictions: HreRestrictionRecord[];
  recommendedBypassCorridor?: string;
  complianceAttestation: string;
}

// ============================================================================
// TRAXXAS HIGH-FREQUENCY TELEMETRY SUITE
// ============================================================================
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
}

