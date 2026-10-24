import { DispatchMonitorDriver, DispatchMonitorStageStatus } from '../types';

const STORAGE_KEY = 'twe_live_dispatch_drivers_v1';

export const INITIAL_MONITOR_DRIVERS: DispatchMonitorDriver[] = [
  {
    id: 'drv-vance-904',
    name: 'Vance Reynolds',
    truckUnit: 'TR-904',
    trailerUnit: 'TRL-6112',
    phone: '(312) 555-8821',
    email: 'vance.reynolds@truckwithease.com',
    currentStatus: 'DEPARTED_ORIGIN',
    cycleNumber: 1,
    lat: 41.521,
    lng: -86.812,
    headingDeg: 115,
    speedMph: 68,
    originLat: 41.7589,
    originLng: -87.7412,
    originCity: 'Chicago',
    originState: 'IL',
    destinationLat: 39.9829,
    destinationLng: -83.1235,
    destinationCity: 'Columbus',
    destinationState: 'OH',
    homeTerminalLat: 41.7589,
    homeTerminalLng: -87.7412,
    homeTerminalCity: 'Chicago, IL',
    currentLocationName: 'I-80 EB Corridor · MP 44 near South Bend, IN',
    currentLocationCity: 'South Bend',
    currentLocationState: 'IN',
    milesRemaining: 218,
    odometerMiles: 143012,
    detentionMinutes: 0,
    detentionHourlyRate: 75,
    loadNumber: 'CHR-88219',
    bolNumber: 'BOL-CHI-COL-9042',
    commodity: 'Class A Dairy & Pharmaceuticals (Reefer 34°F)',
    etaDestination: '14:25 EDT',
    avatarColor: 'bg-blue-600',
    avatarInitials: 'VR',
    lastAlertText: '[DIRECTIVE] Unit TR-904 departed Chicago Yard #4. On-route I-80 EB. ETA Columbus 14:25 EDT.',
    cruiseControlStatus: 'CRUISE ACTIVE · 68 MPH',
    engineRpm: 1320,
    transmissionGear: '12th AUTO',
    fuelLevelPct: 82,
    defLevelPct: 88,
    coolantTempF: 194,
    oilPressurePsi: 44,
    reeferTempF: 34.1,
    reeferSetpointF: 34.0,
    reeferStatusText: 'CONTINUOUS FREEZE · NOMINAL (0.1°F DELTA)',
    batteryVoltage: 13.9,
    brakeAirPressurePsi: { primary: 125, secondary: 123 },
    engineBrakeStatus: 'STAGE 2 STANDBY',
    instantMpg: 7.4,
    hosDriveRemainingMin: 495,
    hosShiftRemainingMin: 650,
    hosCycleRemainingMin: 2840,
    axleWeights: { steerLbs: 11820, driveLbs: 33410, trailerLbs: 33610, grossLbs: 78840 },
    hasPriorityAlert: false,
  },
  {
    id: 'drv-marcus-702',
    name: 'Marcus Ortiz',
    truckUnit: 'TR-702',
    trailerUnit: 'TRL-8941',
    phone: '(214) 555-3910',
    email: 'marcus.ortiz@truckwithease.com',
    currentStatus: 'ARRIVING_DESTINATION',
    cycleNumber: 3,
    lat: 32.748,
    lng: -97.285,
    headingDeg: 270,
    speedMph: 24,
    originLat: 32.7767,
    originLng: -96.797,
    originCity: 'Dallas',
    originState: 'TX',
    destinationLat: 32.7555,
    destinationLng: -97.3308,
    destinationCity: 'Fort Worth',
    destinationState: 'TX',
    homeTerminalLat: 32.7767,
    homeTerminalLng: -96.797,
    homeTerminalCity: 'Dallas, TX',
    currentLocationName: 'I-30 WB Approach · 3.5 mi from Fort Worth Gateway',
    currentLocationCity: 'Fort Worth',
    currentLocationState: 'TX',
    milesRemaining: 4,
    odometerMiles: 219480,
    detentionMinutes: 18,
    detentionHourlyRate: 85,
    loadNumber: 'COY-91048',
    bolNumber: 'BOL-DAL-FTW-7021',
    commodity: 'Frozen Poultry & Specialty Produce (Reefer -10°F)',
    etaDestination: '08:42 CDT',
    avatarColor: 'bg-amber-600',
    avatarInitials: 'MO',
    lastAlertText: '[CRITICAL ALERT] Unit TR-702 Approaching Dock Door 04. Reefer temp fluctuating +6.2°F above setpoint.',
    cruiseControlStatus: 'CITY SLOWDOWN',
    engineRpm: 980,
    transmissionGear: '4th LOW',
    fuelLevelPct: 46,
    defLevelPct: 62,
    coolantTempF: 208,
    oilPressurePsi: 38,
    reeferTempF: -3.8,
    reeferSetpointF: -10.0,
    reeferStatusText: 'THERMAL EXCURSION WARNING // TEMP ELEVATED (+6.2°F)',
    batteryVoltage: 13.6,
    brakeAirPressurePsi: { primary: 118, secondary: 114 },
    engineBrakeStatus: 'OFF',
    instantMpg: 5.9,
    hosDriveRemainingMin: 185,
    hosShiftRemainingMin: 220,
    hosCycleRemainingMin: 1420,
    axleWeights: { steerLbs: 11950, driveLbs: 33890, trailerLbs: 33920, grossLbs: 79760 },
    // HIGH PRIORITY ALERT (TRIGGER FOR MAP HIGHLIGHT)
    hasPriorityAlert: true,
    priorityAlertLevel: 'CRITICAL',
    priorityAlertDetails: 'CRITICAL REEFER SPIKE (+6.2°F) // IMMEDIATE DOCK DOOR 04 EXPEDITE',
    priorityAlertCode: 'REEFER_TEMP_DEV_CRIT',
  },
  {
    id: 'drv-devon-518',
    name: 'Devon Hayes',
    truckUnit: 'TR-518',
    trailerUnit: 'TRL-4419',
    phone: '(615) 555-7281',
    email: 'devon.hayes@truckwithease.com',
    currentStatus: 'ARRIVED_DESTINATION',
    cycleNumber: 2,
    lat: 36.1627,
    lng: -86.7816,
    headingDeg: 0,
    speedMph: 0,
    originLat: 41.8781,
    originLng: -87.6298,
    originCity: 'Chicago',
    originState: 'IL',
    destinationLat: 36.1627,
    destinationLng: -86.7816,
    destinationCity: 'Nashville',
    destinationState: 'TN',
    homeTerminalLat: 41.8781,
    homeTerminalLng: -87.6298,
    homeTerminalCity: 'Chicago, IL',
    currentLocationName: 'Nashville Central Crossdock · Staging Bay #14',
    currentLocationCity: 'Nashville',
    currentLocationState: 'TN',
    milesRemaining: 0,
    odometerMiles: 184510,
    detentionMinutes: 88,
    detentionHourlyRate: 75,
    loadNumber: 'ECH-48192',
    bolNumber: 'BOL-CHI-BNA-5188',
    commodity: 'High-Value Automotive Components & Precision Tooling',
    etaDestination: 'ARRIVED (DETENTION +88m)',
    avatarColor: 'bg-red-600',
    avatarInitials: 'DH',
    lastAlertText: '[DETENTION WARNING] Unit TR-518 waiting on dock door assignment for 88 min. Claim generated: $110.',
    cruiseControlStatus: 'ENGINE IDLE',
    engineRpm: 650,
    transmissionGear: 'PARK / NEUTRAL',
    fuelLevelPct: 54,
    defLevelPct: 78,
    coolantTempF: 188,
    oilPressurePsi: 36,
    batteryVoltage: 13.7,
    brakeAirPressurePsi: { primary: 122, secondary: 120 },
    instantMpg: 0.0,
    hosDriveRemainingMin: 240,
    hosShiftRemainingMin: 290,
    hosCycleRemainingMin: 1980,
    axleWeights: { steerLbs: 11700, driveLbs: 32900, trailerLbs: 32800, grossLbs: 77400 },
    // HIGH PRIORITY ALERT (TRIGGER FOR MAP HIGHLIGHT)
    hasPriorityAlert: true,
    priorityAlertLevel: 'HIGH',
    priorityAlertDetails: 'DETENTION EXCEEDED (+88m) // UNLOAD BOTTLENECK AT BAY 14',
    priorityAlertCode: 'DETENTION_TIMEOUT_ALERT',
  },
  {
    id: 'drv-sarah-309',
    name: 'Sarah Kowalski',
    truckUnit: 'TR-309',
    trailerUnit: 'TRL-9902',
    phone: '(317) 555-4491',
    email: 'sarah.k@truckwithease.com',
    currentStatus: 'DEPARTED_DESTINATION',
    cycleNumber: 1,
    lat: 39.7684,
    lng: -86.1581,
    headingDeg: 310,
    speedMph: 64,
    originLat: 35.1495,
    originLng: -90.049,
    originCity: 'Memphis',
    originState: 'TN',
    destinationLat: 39.7684,
    destinationLng: -86.1581,
    destinationCity: 'Indianapolis',
    destinationState: 'IN',
    homeTerminalLat: 35.1495,
    homeTerminalLng: -90.049,
    homeTerminalCity: 'Memphis, TN',
    currentLocationName: 'I-65 NB Corridor · MP 112 outbound toward Lafayette',
    currentLocationCity: 'Indianapolis',
    currentLocationState: 'IN',
    milesRemaining: 340,
    odometerMiles: 98400,
    detentionMinutes: 0,
    detentionHourlyRate: 75,
    loadNumber: 'TQL-77190',
    bolNumber: 'BOL-MEM-IND-3091',
    commodity: 'Consumer Electronics & Battery Modules (UN3480)',
    etaDestination: '19:10 CDT',
    avatarColor: 'bg-emerald-600',
    avatarInitials: 'SK',
    lastAlertText: '[DIRECTIVE] Unit TR-309 departed Indianapolis. Electronic POD signed and uploaded to vault.',
    cruiseControlStatus: 'CRUISE ACTIVE · 64 MPH',
    engineRpm: 1290,
    transmissionGear: '12th AUTO',
    fuelLevelPct: 68,
    defLevelPct: 82,
    coolantTempF: 191,
    oilPressurePsi: 43,
    batteryVoltage: 14.1,
    brakeAirPressurePsi: { primary: 126, secondary: 124 },
    instantMpg: 7.8,
    hosDriveRemainingMin: 360,
    hosShiftRemainingMin: 480,
    hosCycleRemainingMin: 2600,
    axleWeights: { steerLbs: 11650, driveLbs: 31800, trailerLbs: 32100, grossLbs: 75550 },
    hasPriorityAlert: false,
  },
  {
    id: 'drv-tyrone-880',
    name: 'Tyrone Washington',
    truckUnit: 'TR-880',
    trailerUnit: 'TRL-5520',
    phone: '(404) 555-1920',
    email: 'tyrone.w@truckwithease.com',
    currentStatus: 'BACK_HOME',
    cycleNumber: 4,
    lat: 41.7589,
    lng: -87.7412,
    headingDeg: 0,
    speedMph: 0,
    originLat: 41.7589,
    originLng: -87.7412,
    originCity: 'Chicago',
    originState: 'IL',
    destinationLat: 33.749,
    destinationLng: -84.388,
    destinationCity: 'Atlanta',
    destinationState: 'GA',
    homeTerminalLat: 41.7589,
    homeTerminalLng: -87.7412,
    homeTerminalCity: 'Chicago, IL',
    currentLocationName: 'Chicago Home Base Shop & Fleet Yard #4',
    currentLocationCity: 'Chicago',
    currentLocationState: 'IL',
    milesRemaining: 0,
    odometerMiles: 312890,
    detentionMinutes: 0,
    detentionHourlyRate: 75,
    loadNumber: 'LND-33418',
    bolNumber: 'BOL-ATL-CHI-8804',
    commodity: 'General Freight & Packaged Retail',
    etaDestination: 'CYCLE COMPLETE (SHOP)',
    avatarColor: 'bg-teal-600',
    avatarInitials: 'TW',
    lastAlertText: '[LOOP COMPLETE] Unit TR-880 parked at Chicago shop. Post-trip DVIR passed without defects.',
    cruiseControlStatus: 'PARKED / SECURED',
    engineRpm: 0,
    transmissionGear: 'PARK',
    fuelLevelPct: 92,
    defLevelPct: 95,
    coolantTempF: 78,
    oilPressurePsi: 0,
    batteryVoltage: 12.8,
    brakeAirPressurePsi: { primary: 125, secondary: 125 },
    instantMpg: 0.0,
    hosDriveRemainingMin: 580,
    hosShiftRemainingMin: 720,
    hosCycleRemainingMin: 3400,
    axleWeights: { steerLbs: 11200, driveLbs: 16500, trailerLbs: 14200, grossLbs: 41900 },
    hasPriorityAlert: false,
  },
];

export const ONE_CLICK_MESSAGE_PRESETS = [
  {
    id: 'preset-traffic-alert',
    title: 'Traffic & Route Bypass Diverter',
    badge: 'ROUTE ADVISORY',
    badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    template: (drv: DispatchMonitorDriver) =>
      `[DISPATCH DIRECTIVE] Unit ${drv.truckUnit}: Traffic slowdown detected ahead on corridor. Diverter route confirmed via secondary bypass. Maintain safe following distance.`,
  },
  {
    id: 'preset-dock-bay-ready',
    title: 'Dock Door & Gate Code Assigned',
    badge: 'DOCK ASSIGNMENT',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    template: (drv: DispatchMonitorDriver) =>
      `[DISPATCH DIRECTIVE] Unit ${drv.truckUnit}: Dock Door 04 assigned at ${drv.destinationCity} facility. Guard gate code #8821*. Back in upon arrival.`,
  },
  {
    id: 'preset-reefer-audit',
    title: 'Cold-Chain Reefer Audit Request',
    badge: 'TEMP AUDIT',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    template: (drv: DispatchMonitorDriver) =>
      `[CRITICAL DIRECTIVE] Unit ${drv.truckUnit}: Please verify reefer controller display matches manifest setpoint (${drv.reeferSetpointF || 34.0}°F). Transmit manual reading to dispatch.`,
  },
  {
    id: 'preset-detention-start',
    title: 'Formal Detention Notice to Shipper',
    badge: 'DETENTION LOGGED',
    badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    template: (drv: DispatchMonitorDriver) =>
      `[LEGAL DETENTION RECORD] Unit ${drv.truckUnit} has reached detention threshold at facility dock. Official timer active at $${drv.detentionHourlyRate || 75}/hr under contract terms.`,
  },
];

export function loadMonitorDrivers(): DispatchMonitorDriver[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load monitor drivers from storage:', err);
  }
  return INITIAL_MONITOR_DRIVERS;
}

export function saveMonitorDrivers(drivers: DispatchMonitorDriver[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  } catch (err) {
    console.warn('Failed to persist monitor drivers:', err);
  }
}

export function getStatusStyle(status: DispatchMonitorStageStatus) {
  switch (status) {
    case 'DEPARTED_ORIGIN':
      return {
        pillLabel: 'EN ROUTE // DEPARTED ORIGIN',
        dotColor: 'bg-blue-400',
        badgeBg: 'bg-blue-500/20',
        badgeText: 'text-blue-300',
        borderColor: 'border-blue-500/50',
      };
    case 'ARRIVING_DESTINATION':
      return {
        pillLabel: 'INBOUND // ARRIVING DESTINATION',
        dotColor: 'bg-amber-400',
        badgeBg: 'bg-amber-500/20',
        badgeText: 'text-amber-300',
        borderColor: 'border-amber-500/50',
      };
    case 'ARRIVED_DESTINATION':
      return {
        pillLabel: 'ON-SITE // AT DESTINATION DOCK',
        dotColor: 'bg-emerald-400',
        badgeBg: 'bg-emerald-500/20',
        badgeText: 'text-emerald-300',
        borderColor: 'border-emerald-500/50',
      };
    case 'DEPARTED_DESTINATION':
      return {
        pillLabel: 'RETURN TRANSIT // DEPARTED DEST',
        dotColor: 'bg-purple-400',
        badgeBg: 'bg-purple-500/20',
        badgeText: 'text-purple-300',
        borderColor: 'border-purple-500/50',
      };
    case 'BACK_HOME':
    default:
      return {
        pillLabel: 'COMPLETED // BACK AT HOME TERMINAL',
        dotColor: 'bg-teal-400',
        badgeBg: 'bg-teal-500/20',
        badgeText: 'text-teal-300',
        borderColor: 'border-teal-500/50',
      };
  }
}

export function getNextMasterLoopStatus(current: DispatchMonitorStageStatus): DispatchMonitorStageStatus {
  switch (current) {
    case 'DEPARTED_ORIGIN':
      return 'ARRIVING_DESTINATION';
    case 'ARRIVING_DESTINATION':
      return 'ARRIVED_DESTINATION';
    case 'ARRIVED_DESTINATION':
      return 'DEPARTED_DESTINATION';
    case 'DEPARTED_DESTINATION':
      return 'BACK_HOME';
    case 'BACK_HOME':
    default:
      return 'DEPARTED_ORIGIN';
  }
}

export async function advanceDriverStatus(
  driverId: string,
  nextStatus: DispatchMonitorStageStatus,
  drivers: DispatchMonitorDriver[]
): Promise<DispatchMonitorDriver[]> {
  const updated = drivers.map((drv) => {
    if (drv.id !== driverId) return drv;

    let odoIncrement = 0;
    let speed = drv.speedMph;
    if (nextStatus === 'ARRIVED_DESTINATION' || nextStatus === 'BACK_HOME') {
      speed = 0;
    } else {
      speed = 65;
    }

    if (nextStatus === 'ARRIVING_DESTINATION') odoIncrement = 310;
    if (nextStatus === 'DEPARTED_DESTINATION') odoIncrement = 2;
    if (nextStatus === 'BACK_HOME') odoIncrement = 312;

    const style = getStatusStyle(nextStatus);
    const newAlert = `[DIRECTIVE CONFIRMED] Unit ${drv.truckUnit} advanced to ${style.pillLabel} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return {
      ...drv,
      currentStatus: nextStatus,
      speedMph: speed,
      odometerMiles: drv.odometerMiles + odoIncrement,
      lastAlertText: newAlert,
      cycleNumber: nextStatus === 'DEPARTED_ORIGIN' ? drv.cycleNumber + 1 : drv.cycleNumber,
    };
  });

  saveMonitorDrivers(updated);
  return updated;
}

export async function sendOneClickMessageToDriver(
  driverId: string,
  text: string,
  presetId: string,
  drivers: DispatchMonitorDriver[]
): Promise<{ updatedDrivers: DispatchMonitorDriver[]; receiptSid: string; timestamp: string }> {
  const receiptSid = `SID-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const updatedDrivers = drivers.map((drv) => {
    if (drv.id !== driverId) return drv;
    return {
      ...drv,
      lastAlertText: text,
    };
  });

  saveMonitorDrivers(updatedDrivers);
  return { updatedDrivers, receiptSid, timestamp };
}

/**
 * 5-Second Automated GPS Marker Refresh Algorithm for LIVE_DISPATCH_MONITOR Mode
 * Updates GPS latitude/longitude, milepost markers, and heading based on active velocity
 */
export function refreshDriverMarkers5s(drivers: DispatchMonitorDriver[]): DispatchMonitorDriver[] {
  return drivers.map((drv) => {
    if (drv.speedMph === 0 || drv.currentStatus === 'ARRIVED_DESTINATION' || drv.currentStatus === 'BACK_HOME') {
      if (drv.currentStatus === 'ARRIVED_DESTINATION') {
        return {
          ...drv,
          detentionMinutes: drv.detentionMinutes + 1,
        };
      }
      return drv;
    }

    // Delta movement for 5 seconds at current speed:
    // 65 mph ≈ 0.018 miles per second => ~0.09 miles per 5s
    const milesIn5s = (drv.speedMph / 3600) * 5;
    const targetLat = drv.currentStatus === 'DEPARTED_DESTINATION' ? drv.homeTerminalLat : drv.destinationLat;
    const targetLng = drv.currentStatus === 'DEPARTED_DESTINATION' ? drv.homeTerminalLng : drv.destinationLng;

    const latDelta = targetLat - drv.lat;
    const lngDelta = targetLng - drv.lng;
    const distanceToTarget = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) || 0.001;

    // Move ~0.0015 to 0.003 degrees per 5s
    const stepPct = Math.min(0.008, 0.0015 + (drv.speedMph / 100) * 0.002);
    const newLat = +(drv.lat + latDelta * stepPct).toFixed(4);
    const newLng = +(drv.lng + lngDelta * stepPct).toFixed(4);
    const newMilesRemaining = Math.max(0, +(drv.milesRemaining - milesIn5s).toFixed(1));

    // Calculate heading in degrees
    const headingDeg = Math.round(
      (Math.atan2(lngDelta, latDelta) * (180 / Math.PI) + 360) % 360
    );

    return {
      ...drv,
      lat: newLat,
      lng: newLng,
      headingDeg,
      milesRemaining: newMilesRemaining,
      odometerMiles: +(drv.odometerMiles + milesIn5s).toFixed(1),
    };
  });
}
