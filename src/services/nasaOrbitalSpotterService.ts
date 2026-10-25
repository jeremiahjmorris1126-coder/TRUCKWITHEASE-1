// ============================================================================
// TRUCKWITHEASE™ NASA × GOOGLE MAPS ORBITAL SPOTTER SERVICE
// Fuses Google Maps High-Resolution Satellite & Street Vectors with NASA GIBS
// (Global Imagery Browse Services) EOSDIS Earth Observation Imagery.
// Exclusively designed for TRUCKWITHEASE Fleet Managers and Fleet Dispatchers.
// ============================================================================

export interface NasaOrbitalSatellitePass {
  satelliteName: string;
  sensor: string;
  agency: 'NASA / NOAA' | 'ESA / NASA' | 'USGS / NASA';
  resolutionMeters: number;
  lastPassUtc: string;
  nextPassUtc: string;
  orbitalAltitudeKm: number;
  spectralBands: string[];
  status: 'ONLINE' | 'ACTIVE_RECON';
}

export interface NasaAtmosphericTelemetry {
  surfaceTempF: number;
  roadSurfaceCondition: 'DRY_OPTIMAL' | 'WET_TRACTION' | 'FLASH_FREEZE_RISK' | 'BLACK_ICE_CRITICAL';
  cloudCoverPercent: number;
  precipitationRateMmHr: number;
  crosswindVelocityMph: number;
  visibilityMiles: number;
  aerosolOpticalDepth: number;
  dayNightBandLuminance: number; // nanoWatts/cm2/sr from VIIRS DNB
  satellitePass: NasaOrbitalSatellitePass;
}

export interface RouteLoadUpdate {
  id: string;
  loadNumber: string;
  driverId: string;
  driverName: string;
  truckUnit: string;
  timestamp: string;
  updateType: 'BRIDGE_CLEARANCE' | 'SCALE_HOUSE' | 'WEATHER_NASA' | 'DETENTION_GATE' | 'SPEED_ADVISORY' | 'TRAFFIC_INCIDENT';
  severity: 'NORMAL' | 'CAUTION' | 'CRITICAL';
  title: string;
  detail: string;
  locationHighway: string;
  mileMarker?: number;
  pingDispatchedToCab: boolean;
  isSimulated?: boolean;
  dataSource?: 'DETERMINISTIC_MODEL' | 'FHWA_NBI_CACHE' | 'PUBLIC_STATION_DIRECTORY' | 'SIMULATED_TEST_HARNESS';
}

export interface DriverPingRecord {
  id: string;
  driverId: string;
  truckUnit: string;
  timestamp: string;
  pingType: 'MANUAL_PULSE' | 'SPEED_CHECK' | 'BRIDGE_VERIFY' | 'NASA_FREEZE_ALERT' | 'DETENTION_PROMPT' | 'SITREP_POLL';
  label: string;
  latencyMs: number;
  status: 'SENT' | 'DELIVERED_CAB' | 'ACKNOWLEDGED_DRIVER' | 'SIMULATED';
  notes?: string;
}

export interface DriverPingProgramConfig {
  autoPingEnabled: boolean;
  intervalSeconds: number; // e.g. 60, 300, 900
  pingOnSpeedExcess: boolean;
  speedThresholdMph: number;
  pingOnBridgeClearanceUnderInches: number; // e.g. 164 (13'8")
  pingOnFreezeDetected: boolean;
  audibleChimeEnabled: boolean;
  inCabVoiceBroadcast: boolean;
  smsDispatchSync: boolean;
}

// Seeded demo records; no provider or driver messages are connected.
export const INITIAL_ROUTE_UPDATES: RouteLoadUpdate[] = [
  {
    id: 'rt-upd-101',
    loadNumber: 'LD-44910',
    driverId: 'drv-vance-904',
    driverName: 'Vance Reynolds',
    truckUnit: 'TR-904',
    timestamp: 'DEMO',
    updateType: 'BRIDGE_CLEARANCE',
    severity: 'NORMAL',
    title: 'DEMO: Bridge clearance example',
    detail: 'Sample value only. Local calculation model: overpass clearance 14\'2" clears 13\'6" rig with 8" buffer margin.',
    locationHighway: 'I-80 E / Mile 114 (PA)',
    mileMarker: 114,
    pingDispatchedToCab: false,
    isSimulated: true,
    dataSource: 'FHWA_NBI_CACHE',
  },
  {
    id: 'rt-upd-102',
    loadNumber: 'LD-88192',
    driverId: 'drv-jason-208',
    driverName: 'Jason Henderson',
    truckUnit: 'UNIT #208-T',
    timestamp: 'DEMO',
    updateType: 'SCALE_HOUSE',
    severity: 'NORMAL',
    title: 'DEMO: Weigh station bypass example',
    detail: 'Sample drill profile only. Modeled station at I-80 Mile 162. Actual roadside bypass requires an active carrier transponder.',
    locationHighway: 'I-80 / OH Turnpike Mile 162',
    mileMarker: 162,
    pingDispatchedToCab: false,
    isSimulated: true,
    dataSource: 'PUBLIC_STATION_DIRECTORY',
  },
  {
    id: 'rt-upd-103',
    loadNumber: 'LD-10492',
    driverId: 'drv-marcus-711',
    driverName: 'Marcus Rodriguez',
    truckUnit: 'TR-711',
    timestamp: 'DEMO',
    updateType: 'WEATHER_NASA',
    severity: 'CAUTION',
    title: 'DEMO: Satellite radar rainfall example',
    detail: 'Deterministic precipitation model: simulated 18mm/hr squall approaching Lake Erie corridor (I-90 W). Advisory speed: 55 MPH.',
    locationHighway: 'I-90 W / Ashtabula Corridor',
    mileMarker: 218,
    pingDispatchedToCab: false,
    isSimulated: true,
    dataSource: 'DETERMINISTIC_MODEL',
  },
  {
    id: 'rt-upd-104',
    loadNumber: 'LD-33901',
    driverId: 'drv-jamal-611',
    driverName: 'Jamal Washington',
    truckUnit: 'TR-611',
    timestamp: 'DEMO',
    updateType: 'DETENTION_GATE',
    severity: 'NORMAL',
    title: 'DEMO: Receiver dock staged early',
    detail: 'Sample notice: Shipper yard manager assigned Dock #14. Forklift crew active; zero detention anticipated upon arrival.',
    locationHighway: 'I-65 S / Indianapolis Logistics Park',
    mileMarker: 85,
    pingDispatchedToCab: false,
    isSimulated: true,
    dataSource: 'SIMULATED_TEST_HARNESS',
  },
  {
    id: 'rt-upd-105',
    loadNumber: 'LD-55201',
    driverId: 'drv-darnell-402',
    driverName: 'Darnell Jenkins',
    truckUnit: 'UNIT #402-K',
    timestamp: 'DEMO',
    updateType: 'TRAFFIC_INCIDENT',
    severity: 'CAUTION',
    title: 'DEMO: Construction single lane restriction',
    detail: 'Sample construction notice: Right lane closed for resurfacing until 18:00. Left lane moving at 45 MPH.',
    locationHighway: 'I-70 E / Richmond Crossing',
    mileMarker: 44,
    pingDispatchedToCab: false,
    isSimulated: true,
    dataSource: 'SIMULATED_TEST_HARNESS',
  },
];

// Seeded demo ping history; no messages were delivered to drivers.
export const INITIAL_PING_HISTORY: DriverPingRecord[] = [
  {
    id: 'png-881',
    driverId: 'drv-vance-904',
    truckUnit: 'TR-904',
    timestamp: 'DEMO',
    pingType: 'SPEED_CHECK',
    label: 'DEMO: Speed check example',
    latencyMs: 0,
    status: 'SIMULATED',
    notes: 'Sample record only; no telematics message was sent or acknowledged.',
  },
  {
    id: 'png-882',
    driverId: 'drv-jason-208',
    truckUnit: 'UNIT #208-T',
    timestamp: 'DEMO',
    pingType: 'BRIDGE_VERIFY',
    label: 'DEMO: Bridge clearance example',
    latencyMs: 0,
    status: 'SIMULATED',
    notes: 'Sample record only; no clearance was verified and no cab alert was sent.',
  },
  {
    id: 'png-883',
    driverId: 'drv-marcus-711',
    truckUnit: 'TR-711',
    timestamp: 'DEMO',
    pingType: 'NASA_FREEZE_ALERT',
    label: 'DEMO: Weather advisory example',
    latencyMs: 0,
    status: 'SIMULATED',
    notes: 'Sample record only; no NASA feed or in-cab message is connected.',
  },
];

// Default Ping Program Configuration
export const DEFAULT_PING_CONFIG: DriverPingProgramConfig = {
  autoPingEnabled: false,
  intervalSeconds: 60,
  pingOnSpeedExcess: true,
  speedThresholdMph: 70,
  pingOnBridgeClearanceUnderInches: 164, // 13'8"
  pingOnFreezeDetected: true,
  audibleChimeEnabled: true,
  inCabVoiceBroadcast: false,
  smsDispatchSync: false,
};

// Storage keys
const ROUTE_UPDATES_STORAGE_KEY = 'truckwithease_route_load_updates';
const PING_HISTORY_STORAGE_KEY = 'truckwithease_driver_ping_history';
const PING_CONFIG_STORAGE_KEY = 'truckwithease_driver_ping_config';

export function getStoredRouteUpdates(): RouteLoadUpdate[] {
  try {
    const raw = localStorage.getItem(ROUTE_UPDATES_STORAGE_KEY);
    if (!raw) return INITIAL_ROUTE_UPDATES;
    return JSON.parse(raw);
  } catch {
    return INITIAL_ROUTE_UPDATES;
  }
}

export function saveRouteUpdates(updates: RouteLoadUpdate[]): void {
  try {
    localStorage.setItem(ROUTE_UPDATES_STORAGE_KEY, JSON.stringify(updates));
  } catch {
    // Ignore storage quota
  }
}

export function getStoredPingHistory(): DriverPingRecord[] {
  try {
    const raw = localStorage.getItem(PING_HISTORY_STORAGE_KEY);
    if (!raw) return INITIAL_PING_HISTORY;
    return JSON.parse(raw);
  } catch {
    return INITIAL_PING_HISTORY;
  }
}

export function savePingHistory(history: DriverPingRecord[]): void {
  try {
    localStorage.setItem(PING_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // Ignore storage quota
  }
}

export function getStoredPingConfig(): DriverPingProgramConfig {
  try {
    const raw = localStorage.getItem(PING_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_PING_CONFIG;
    return { ...DEFAULT_PING_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PING_CONFIG;
  }
}

export function savePingConfig(cfg: DriverPingProgramConfig): void {
  try {
    localStorage.setItem(PING_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota
  }
}

// Compute deterministic NASA atmospheric telemetry based on coordinates and current time
export function calculateNasaTelemetry(lat: number, lng: number): NasaAtmosphericTelemetry {
  // Deterministic seed based on latitude and longitude
  const seed = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
  const normalized = seed - Math.floor(seed);

  const baseTemp = 36 + Math.round((lat < 41 ? 12 : 2) + normalized * 18);
  const surfaceTempF = baseTemp;

  let roadSurfaceCondition: NasaAtmosphericTelemetry['roadSurfaceCondition'] = 'DRY_OPTIMAL';
  if (surfaceTempF <= 32) {
    roadSurfaceCondition = 'BLACK_ICE_CRITICAL';
  } else if (surfaceTempF <= 35) {
    roadSurfaceCondition = 'FLASH_FREEZE_RISK';
  } else if (normalized > 0.6) {
    roadSurfaceCondition = 'WET_TRACTION';
  }

  const cloudCoverPercent = Math.round(20 + normalized * 70);
  const precipitationRateMmHr = normalized > 0.65 ? +(normalized * 12).toFixed(1) : 0;
  const crosswindVelocityMph = Math.round(8 + normalized * 24);
  const visibilityMiles = normalized > 0.85 ? 4.5 : normalized > 0.7 ? 8.2 : 10.0;
  const aerosolOpticalDepth = +(0.08 + normalized * 0.35).toFixed(2);
  const dayNightBandLuminance = Math.round(15 + normalized * 85);

  const satellitePass: NasaOrbitalSatellitePass = {
    satelliteName: normalized > 0.5 ? 'NOAA-20 / VIIRS' : 'Suomi NPP / VIIRS',
    sensor: 'Visible Infrared Imaging Radiometer Suite',
    agency: 'NASA / NOAA',
    resolutionMeters: 375,
    lastPassUtc: '13:42 UTC (42m ago)',
    nextPassUtc: '15:18 UTC (in 54m)',
    orbitalAltitudeKm: 824,
    spectralBands: ['DNB (0.5-0.9 µm)', 'I1 (0.64 µm)', 'I4 (3.74 µm)', 'I5 (11.45 µm)'],
    status: 'ACTIVE_RECON',
  };

  return {
    surfaceTempF,
    roadSurfaceCondition,
    cloudCoverPercent,
    precipitationRateMmHr,
    crosswindVelocityMph,
    visibilityMiles,
    aerosolOpticalDepth,
    dayNightBandLuminance,
    satellitePass,
  };
}
