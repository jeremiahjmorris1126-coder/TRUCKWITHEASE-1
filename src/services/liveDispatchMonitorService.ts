import { DispatchMonitorDriver, DispatchMonitorStageStatus } from '../types';

const STORAGE_KEY = 'truckwithease_dispatch_monitor_drivers';

export const INITIAL_MONITOR_DRIVERS: DispatchMonitorDriver[] = [
  {
    id: 'drv-vance-904',
    name: 'Vance Reynolds',
    phone: '+13125558821',
    email: 'vance.reynolds@truckwithease.com',
    truckUnit: 'TR-904',
    trailerUnit: 'TRL-6112',
    loadNumber: 'CHR-88219',
    bolNumber: 'BOL-CHI-COL-9042',
    commodity: 'Refrigerated dairy and pharmaceuticals',
    currentStatus: 'DEPARTED_ORIGIN',
    currentLocationName: 'Chicago Central Logistics Yard',
    currentLocationCity: 'Bedford Park',
    currentLocationState: 'IL',
    originCity: 'Chicago',
    originState: 'IL',
    destinationCity: 'Columbus',
    destinationState: 'OH',
    homeTerminalCity: 'Chicago',
    originLat: 41.7589,
    originLng: -87.7412,
    destinationLat: 39.9829,
    destinationLng: -83.1235,
    homeTerminalLat: 41.7589,
    homeTerminalLng: -87.7412,
    lat: 41.135,
    lng: -85.2,
    headingDeg: 95,
    speedMph: 64,
    milesRemaining: 184,
    etaDestination: '2h 52m',
    odometerMiles: 184520,
    cycleNumber: 1,
    avatarColor: 'bg-amber-600',
    avatarInitials: 'VR',
    detentionMinutes: 0,
    detentionHourlyRate: 75,
    cruiseControlStatus: 'ACTIVE · 65 MPH',
    engineRpm: 1350,
    transmissionGear: '12th AUTO',
    fuelLevelPct: 78,
    defLevelPct: 85,
    coolantTempF: 192,
    oilPressurePsi: 42,
    reeferTempF: 34,
    reeferSetpointF: 34,
    reeferStatusText: 'CONTINUOUS · NORMAL',
    batteryVoltage: 13.8,
    brakeAirPressurePsi: { primary: 124, secondary: 122 },
    engineBrakeStatus: 'STAGE 2',
    instantMpg: 7.2,
    lastAlertText: 'Departed origin. En route to Columbus.',
    hosDriveRemainingMin: 525,
    hosShiftRemainingMin: 680,
    hosCycleRemainingMin: 2920,
    axleWeights: { steerLbs: 11840, driveLbs: 33480, trailerLbs: 33620, grossLbs: 78940 },
  },
];

export const ONE_CLICK_MESSAGE_PRESETS = [
  {
    id: 'status-check',
    badge: 'STATUS CHECK',
    title: 'Request a location and load-status check-in.',
    label: 'Request status',
    badgeColor: 'bg-cyan-400 text-slate-950',
    template: (driver: DispatchMonitorDriver) =>
      `Dispatch check-in: ${driver.truckUnit}, please confirm your current location and load status.`,
  },
  {
    id: 'safety-check',
    badge: 'SAFETY CHECK',
    title: 'Request a driver safety and equipment check-in.',
    label: 'Safety check',
    badgeColor: 'bg-amber-400 text-slate-950',
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
    return Array.isArray(parsed) ? parsed : INITIAL_MONITOR_DRIVERS;
  } catch {
    return INITIAL_MONITOR_DRIVERS;
  }
}

export function saveMonitorDrivers(drivers: DispatchMonitorDriver[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
  } catch {
    // Storage can be unavailable or full.
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
} {
  const styles: Record<DispatchMonitorStageStatus, { badgeBg: string; badgeText: string; pillLabel: string; dotColor: string }> = {
    DEPARTED_ORIGIN: { badgeBg: 'bg-sky-500/15', badgeText: 'text-sky-300', pillLabel: 'EN ROUTE', dotColor: 'bg-sky-400' },
    ARRIVING_DESTINATION: { badgeBg: 'bg-amber-500/15', badgeText: 'text-amber-300', pillLabel: 'ARRIVING', dotColor: 'bg-amber-400' },
    ARRIVED_DESTINATION: { badgeBg: 'bg-emerald-500/15', badgeText: 'text-emerald-300', pillLabel: 'AT DESTINATION', dotColor: 'bg-emerald-400' },
    DEPARTED_DESTINATION: { badgeBg: 'bg-violet-500/15', badgeText: 'text-violet-300', pillLabel: 'RETURNING', dotColor: 'bg-violet-400' },
    BACK_HOME: { badgeBg: 'bg-slate-500/15', badgeText: 'text-slate-300', pillLabel: 'BACK HOME', dotColor: 'bg-slate-400' },
  };
  return styles[status];
}

export async function advanceDriverStatus(
  driverId: string,
  status: DispatchMonitorStageStatus,
  currentDrivers: DispatchMonitorDriver[]
): Promise<DispatchMonitorDriver[]> {
  const updated = currentDrivers.map((driver) =>
    driver.id === driverId ? { ...driver, currentStatus: status } : driver
  );
  saveMonitorDrivers(updated);
  return updated;
}

export async function sendOneClickMessageToDriver(
  driverId: string,
  text: string,
  _presetId: string,
  currentDrivers: DispatchMonitorDriver[]
): Promise<{ updatedDrivers: DispatchMonitorDriver[]; receiptSid: string; timestamp: string }> {
  const driver = currentDrivers.find((item) => item.id === driverId);
  if (!driver) throw new Error('Selected driver was not found.');

  const response = await fetch('/api/dispatch-messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: driver.phone, text, attachedLoadId: driver.loadNumber }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true || typeof result.carrierSid !== 'string') {
    throw new Error(result?.error || `Message delivery failed with HTTP ${response.status}.`);
  }

  const updatedDrivers = currentDrivers.map((item) =>
    item.id === driverId ? { ...item, lastAlertText: text } : item
  );
  saveMonitorDrivers(updatedDrivers);
  return {
    updatedDrivers,
    receiptSid: result.carrierSid,
    timestamp: new Date().toISOString(),
  };
}
