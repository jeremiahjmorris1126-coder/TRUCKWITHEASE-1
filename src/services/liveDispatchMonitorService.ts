import { DispatchMonitorDriver, DispatchMonitorStageStatus } from '../types';

const STORAGE_KEY = 'truckwithease_dispatch_monitor_drivers';

export const INITIAL_MONITOR_DRIVERS: DispatchMonitorDriver[] = [
  {
    id: 'drv-vance-904',
    name: 'Vance Reynolds',
    truckUnit: 'TR-904',
    trailerUnit: 'TRL-6112',
    phone: '+13125558821',
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
    detentionHourlyRate: 75.0,
    loadNumber: 'CHR-88219',
    bolNumber: 'BOL-CHI-COL-9042',
    commodity: 'Refrigerated dairy and pharmaceuticals',
    etaDestination: '19:45 EST',
    avatarColor: '#FFE500',
    avatarInitials: 'VR',
    lastAlertText: 'Departed origin. En route to Columbus.',
    cruiseControlStatus: 'ENGAGED 68 MPH',
    engineRpm: 1240,
    transmissionGear: '12th (Auto DD12)',
    fuelLevelPct: 82,
    defLevelPct: 91,
    coolantTempF: 194,
    oilPressurePsi: 42,
    reeferTempF: 34.2,
    reeferSetpointF: 34.0,
    reeferStatusText: 'CONTINUOUS RUN · TEMP OK',
    batteryVoltage: 14.1,
    brakeAirPressurePsi: { primary: 122, secondary: 119 },
    engineBrakeStatus: 'LOW (OFF)',
    instantMpg: 7.4,
    hosDriveRemainingMin: 525,
    hosShiftRemainingMin: 680,
    hosCycleRemainingMin: 2920,
    axleWeights: { steerLbs: 11840, driveLbs: 33480, trailerLbs: 33620, grossLbs: 78940 },
    hasPriorityAlert: false,
  },
  {
    id: 'drv-jason-208',
    name: 'Jason Henderson',
    truckUnit: 'UNIT #208-T',
    trailerUnit: 'TRL-5501',
    phone: '+14125553901',
    email: 'jason.henderson@truckwithease.com',
    currentStatus: 'ARRIVING_DESTINATION',
    cycleNumber: 2,
    lat: 40.012,
    lng: -83.025,
    headingDeg: 180,
    speedMph: 24,
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
    currentLocationName: 'I-270 Outerbelt · Exit 12 (Roberts Rd)',
    currentLocationCity: 'Columbus',
    currentLocationState: 'OH',
    milesRemaining: 6.4,
    odometerMiles: 298104,
    detentionMinutes: 0,
    detentionHourlyRate: 75.0,
    loadNumber: 'TQL-44012',
    bolNumber: 'BOL-CHI-COL-2081',
    commodity: 'Automotive Stamping Dies & Tooling',
    etaDestination: '17:10 EST',
    avatarColor: '#38BDF8',
    avatarInitials: 'JH',
    lastAlertText: 'Within 10-mile radius. Inbound notice transmitted to receiver.',
    cruiseControlStatus: 'OFF (CITY TRAFFIC)',
    engineRpm: 1480,
    transmissionGear: '8th (Manual 13-Spd)',
    fuelLevelPct: 44,
    defLevelPct: 62,
    coolantTempF: 202,
    oilPressurePsi: 38,
    reeferTempF: undefined,
    reeferSetpointF: undefined,
    reeferStatusText: 'DRY VAN · AMBIENT',
    batteryVoltage: 13.9,
    brakeAirPressurePsi: { primary: 125, secondary: 123 },
    engineBrakeStatus: 'MED',
    instantMpg: 5.8,
    hosDriveRemainingMin: 210,
    hosShiftRemainingMin: 340,
    hosCycleRemainingMin: 1840,
    axleWeights: { steerLbs: 12050, driveLbs: 33920, trailerLbs: 33800, grossLbs: 79770 },
    hasPriorityAlert: true,
    priorityAlertLevel: 'HIGH',
    priorityAlertDetails: 'Guard Shack Gate Code: #8821*. Receiver Dock #04 assigned.',
    priorityAlertCode: 'DOCK_ASSIGNED',
  },
  {
    id: 'drv-marcus-711',
    name: 'Marcus Rodriguez',
    truckUnit: 'TR-711',
    trailerUnit: 'TRL-9921',
    phone: '+16145557732',
    email: 'marcus.rodriguez@truckwithease.com',
    currentStatus: 'ARRIVED_DESTINATION',
    cycleNumber: 3,
    lat: 39.9829,
    lng: -83.1235,
    headingDeg: 0,
    speedMph: 0,
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
    currentLocationName: 'Columbus Distribution Center · Dock 04',
    currentLocationCity: 'Columbus',
    currentLocationState: 'OH',
    milesRemaining: 0,
    odometerMiles: 88419,
    detentionMinutes: 48,
    detentionHourlyRate: 85.0,
    loadNumber: 'COY-99014',
    bolNumber: 'BOL-CHI-COL-7118',
    commodity: 'Retail Consumer Electronics',
    etaDestination: 'ARRIVED (ON DOCK)',
    avatarColor: '#10B981',
    avatarInitials: 'MR',
    lastAlertText: 'On Dock #04. Detention clock running: 48 min billable ($68.00 accrued).',
    cruiseControlStatus: 'ENGINE OFF / APU ON',
    engineRpm: 0,
    transmissionGear: 'Neutral (Parked)',
    fuelLevelPct: 68,
    defLevelPct: 84,
    coolantTempF: 140,
    oilPressurePsi: 0,
    reeferTempF: undefined,
    reeferSetpointF: undefined,
    reeferStatusText: 'SEAL VERIFIED #992104',
    batteryVoltage: 12.8,
    brakeAirPressurePsi: { primary: 128, secondary: 126 },
    engineBrakeStatus: 'OFF',
    instantMpg: 0.0,
    hosDriveRemainingMin: 410,
    hosShiftRemainingMin: 540,
    hosCycleRemainingMin: 2210,
    axleWeights: { steerLbs: 11900, driveLbs: 32800, trailerLbs: 33100, grossLbs: 77800 },
    hasPriorityAlert: false,
  },
  {
    id: 'drv-jamal-611',
    name: 'Jamal Washington',
    truckUnit: 'TR-611',
    trailerUnit: 'TRL-4412',
    phone: '+13175556214',
    email: 'jamal.washington@truckwithease.com',
    currentStatus: 'DEPARTED_DESTINATION',
    cycleNumber: 2,
    lat: 40.852,
    lng: -85.241,
    headingDeg: 295,
    speedMph: 65,
    originLat: 39.9829,
    originLng: -83.1235,
    originCity: 'Columbus',
    originState: 'OH',
    destinationLat: 41.7589,
    destinationLng: -87.7412,
    destinationCity: 'Chicago',
    destinationState: 'IL',
    homeTerminalLat: 41.7589,
    homeTerminalLng: -87.7412,
    homeTerminalCity: 'Chicago, IL',
    currentLocationName: 'US-30 WB · MP 122 near Fort Wayne, IN',
    currentLocationCity: 'Fort Wayne',
    currentLocationState: 'IN',
    milesRemaining: 154,
    odometerMiles: 215430,
    detentionMinutes: 0,
    detentionHourlyRate: 75.0,
    loadNumber: 'DAT-12904',
    bolNumber: 'BOL-COL-CHI-6114',
    commodity: 'Empty Pallets & Return Dunnage',
    etaDestination: '21:15 CST',
    avatarColor: '#F59E0B',
    avatarInitials: 'JW',
    lastAlertText: 'Departed destination Columbus. Inbound return leg to Chicago terminal.',
    cruiseControlStatus: 'ENGAGED 65 MPH',
    engineRpm: 1220,
    transmissionGear: '10th (Manual)',
    fuelLevelPct: 56,
    defLevelPct: 78,
    coolantTempF: 196,
    oilPressurePsi: 40,
    reeferTempF: undefined,
    reeferSetpointF: undefined,
    reeferStatusText: 'DEADHEAD / RETURN LEG',
    batteryVoltage: 14.0,
    brakeAirPressurePsi: { primary: 124, secondary: 122 },
    engineBrakeStatus: 'LOW',
    instantMpg: 8.1,
    hosDriveRemainingMin: 320,
    hosShiftRemainingMin: 450,
    hosCycleRemainingMin: 1680,
    axleWeights: { steerLbs: 11400, driveLbs: 17200, trailerLbs: 14800, grossLbs: 43400 },
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
    id: 'status-check',
    title: 'Location & Load-Status Check-In',
    badge: 'STATUS CHECK',
    badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
    template: (driver: DispatchMonitorDriver) =>
      `Dispatch check-in: ${driver.truckUnit}, please confirm your current location and load status.`,
  },
  {
    id: 'safety-check',
    title: 'Driver Safety & Equipment Check-In',
    badge: 'SAFETY CHECK',
    badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    template: (driver: DispatchMonitorDriver) =>
      `Safety check for ${driver.truckUnit}: confirm you are safe and report any route or equipment concerns.`,
  },
];

const STATUS_ORDER: DispatchMonitorStageStatus[] = [
  'DEPARTED_ORIGIN',
  'ARRIVING_DESTINATION',
  'ARRIVED_DESTINATION',
  'DEPARTED_DESTINATION',
  'BACK_HOME',
];

export function loadMonitorDrivers(): DispatchMonitorDriver[] {
  if (typeof localStorage === 'undefined') return INITIAL_MONITOR_DRIVERS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_MONITOR_DRIVERS;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MONITOR_DRIVERS;
  } catch {
    return INITIAL_MONITOR_DRIVERS;
  }
}

export function saveMonitorDrivers(drivers: DispatchMonitorDriver[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  } catch (err) {
    console.warn('Failed to persist monitor drivers to localStorage:', err);
  }
}

export function getNextMasterLoopStatus(status: DispatchMonitorStageStatus): DispatchMonitorStageStatus {
  const index = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(index + 1) % STATUS_ORDER.length];
}

export function getStatusStyle(status: DispatchMonitorStageStatus): {
  badgeBg: string;
  badgeText: string;
  pillLabel: string;
  dotColor: string;
  borderColor?: string;
} {
  const styles: Record<DispatchMonitorStageStatus, { badgeBg: string; badgeText: string; pillLabel: string; dotColor: string; borderColor: string }> = {
    DEPARTED_ORIGIN: { badgeBg: 'bg-sky-500/15', badgeText: 'text-sky-300', pillLabel: 'EN ROUTE // DEPARTED ORIGIN', dotColor: 'bg-sky-400', borderColor: 'border-sky-500/50' },
    ARRIVING_DESTINATION: { badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-300', pillLabel: 'INBOUND // ARRIVING DESTINATION', dotColor: 'bg-amber-400', borderColor: 'border-amber-500/50' },
    ARRIVED_DESTINATION: { badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-300', pillLabel: 'ON DOCK // AT DESTINATION', dotColor: 'bg-emerald-400', borderColor: 'border-emerald-500/50' },
    DEPARTED_DESTINATION: { badgeBg: 'bg-violet-500/15', badgeText: 'text-violet-300', pillLabel: 'RETURNING // DEPARTED DESTINATION', dotColor: 'bg-violet-400', borderColor: 'border-violet-500/50' },
    BACK_HOME: { badgeBg: 'bg-slate-500/15', badgeText: 'text-slate-300', pillLabel: 'COMPLETED // BACK HOME', dotColor: 'bg-slate-400', borderColor: 'border-slate-500/50' },
  };
  return styles[status] || styles.DEPARTED_ORIGIN;
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
  _presetId: string,
  drivers: DispatchMonitorDriver[]
): Promise<{ updatedDrivers: DispatchMonitorDriver[]; receiptSid: string; timestamp: string }> {
  const driver = drivers.find((item) => item.id === driverId);
  if (!driver) throw new Error('Selected driver was not found.');

  let receiptSid = `SID-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  // Attempt backend dispatch route if available
  try {
    const response = await fetch('/api/dispatch-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: driver.phone, text, attachedLoadId: driver.loadNumber }),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.success === true && typeof result.carrierSid === 'string') {
      receiptSid = result.carrierSid;
    }
  } catch {
    // Offline / client edge fallback
  }

  const updatedDrivers = drivers.map((item) =>
    item.id === driverId ? { ...item, lastAlertText: text } : item
  );

  saveMonitorDrivers(updatedDrivers);
  return {
    updatedDrivers,
    receiptSid,
    timestamp: new Date().toISOString(),
  };
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
    const milesIn5s = (drv.speedMph / 3600) * 5;
    const targetLat = drv.currentStatus === 'DEPARTED_DESTINATION' ? drv.homeTerminalLat : drv.destinationLat;
    const targetLng = drv.currentStatus === 'DEPARTED_DESTINATION' ? drv.homeTerminalLng : drv.destinationLng;

    const latDelta = targetLat - drv.lat;
    const lngDelta = targetLng - drv.lng;

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
