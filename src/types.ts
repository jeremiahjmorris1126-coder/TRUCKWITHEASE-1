export type TabId = 'night-hud' | 'hos-clocks' | 'radar-54b' | 'the-g-o-a-t-' | 'haptics' | 'ecosystem' | 'vault' | 'telemetry' | 'dispatch-eta' | 'master-sync' | 'quantum-index' | 'fleet-expenses' | 'trip-planner';

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
  enabledModules: Record<TabId, boolean>;
}

export type InspectionActionType = 'PDF_GENERATED' | 'PRINTED' | 'ROADSIDE_AUDIT' | 'VOICE_TRIGGERED' | 'FMCSA_PORTAL_SYNC';
export type InspectionTriggerSource = 'VOICE_CONTROL' | 'MANUAL_HUD' | 'OFFICER_REQUEST' | 'CAB_PRINTER' | 'SCHEDULED_DISPATCH' | 'QUANTUM_INDEX_AUDIT';

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
  driverName: string; // e.g. "Jonathan Vance"
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

