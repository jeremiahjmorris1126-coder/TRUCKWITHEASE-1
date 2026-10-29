import { fleetStore, CallerIdentity } from '../data/fleetStore';
import { sendDispatchSms, isTwilioConfigured } from '../twilioMessaging';

export type AuxInputType =
  | 'DOOR_OPEN'
  | 'PTO_ENGAGED'
  | 'PANIC_BUTTON'
  | 'LOW_BRIDGE_CLEARANCE'
  | 'EXCESSIVE_IDLE'
  | 'ENGINE_OVERHEAT'
  | 'REEFER_TEMP_BREACH'
  | 'JACKKNIFE_RISK';

export interface AuxAlert {
  id: string;
  fleetId?: string;
  type: AuxInputType;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  vehicleUnit: string;
  driverName: string;
  title: string;
  description: string;
  resolved: boolean;
  timestamp: string;
  telemetryMetadata?: Record<string, any>;
  smsNotificationSent?: boolean;
}

const DEFAULT_CALLER: CallerIdentity = {
  uid: 'usr-admin-01',
  role: 'owner',
  fleetId: 'FLEET1',
};

const INITIAL_ALERTS: AuxAlert[] = [
  {
    id: 'alt-init-1',
    fleetId: 'FLEET1',
    type: 'LOW_BRIDGE_CLEARANCE',
    severity: 'CRITICAL',
    vehicleUnit: 'UNIT-101',
    driverName: 'Marcus Vance',
    title: 'Low Bridge Clearance Detected',
    description: '13ft 6in clearance structure ahead at MM 184.2 with 0 buffer delta. Reroute corridor active.',
    resolved: false,
    timestamp: new Date().toISOString(),
    telemetryMetadata: { clearanceInches: 162, vehicleHeightInches: 162, deltaInches: 0 },
    smsNotificationSent: false,
  },
];

// Seed initial alerts into fleetStore
for (const a of INITIAL_ALERTS) {
  fleetStore.seedMockData('aux_alerts', a.id, a);
}

export async function triggerAuxAlert(
  callerOrAlert: CallerIdentity | Omit<AuxAlert, 'id' | 'timestamp' | 'resolved'>,
  maybeAlert?: Omit<AuxAlert, 'id' | 'timestamp' | 'resolved'>
): Promise<AuxAlert> {
  const caller: CallerIdentity = maybeAlert ? (callerOrAlert as CallerIdentity) : DEFAULT_CALLER;
  const alertData = maybeAlert || (callerOrAlert as Omit<AuxAlert, 'id' | 'timestamp' | 'resolved'>);

  const alert: AuxAlert = {
    ...alertData,
    id: `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    resolved: false,
    timestamp: new Date().toISOString(),
  };

  // If Twilio is configured and severity is CRITICAL or PANIC, send SMS notification
  if ((alert.severity === 'CRITICAL' || alert.type === 'PANIC_BUTTON') && isTwilioConfigured()) {
    try {
      const smsBody = `[TRUCKWITHEASE ALERT] ${alert.severity}: ${alert.title} on Unit ${alert.vehicleUnit}. Driver: ${alert.driverName}. Details: ${alert.description}`;
      await sendDispatchSms(smsBody);
      alert.smsNotificationSent = true;
    } catch (e) {
      console.warn('[AlertEngine] Failed to dispatch SMS for alert:', (e as Error).message);
    }
  }

  // Persist with mandatory caller fleetId isolation
  return fleetStore.createScopedDocument<AuxAlert>(caller, 'aux_alerts', alert.id, alert);
}

export async function getActiveAlerts(caller?: CallerIdentity): Promise<AuxAlert[]> {
  const activeCaller = caller || DEFAULT_CALLER;
  const alerts = await fleetStore.listScopedCollection<AuxAlert>(activeCaller, 'aux_alerts');
  return alerts.filter(a => !a.resolved);
}

export async function getAllAlerts(caller?: CallerIdentity): Promise<AuxAlert[]> {
  const activeCaller = caller || DEFAULT_CALLER;
  return fleetStore.listScopedCollection<AuxAlert>(activeCaller, 'aux_alerts');
}

export async function resolveAlert(
  callerOrId: CallerIdentity | string,
  maybeId?: string
): Promise<boolean> {
  let caller: CallerIdentity;
  let id: string;

  if (typeof callerOrId === 'object' && callerOrId !== null) {
    caller = callerOrId as CallerIdentity;
    id = maybeId as string;
  } else {
    caller = DEFAULT_CALLER;
    id = callerOrId as string;
  }

  // Load object and verify tenant isolation
  const existing = await fleetStore.getScopedDocument<AuxAlert>(caller, 'aux_alerts', id);
  if (!existing) {
    return false; // Returns false -> route returns 404 (does not reveal existence)
  }

  await fleetStore.updateScopedDocument<AuxAlert>(caller, 'aux_alerts', id, {
    resolved: true,
  });
  return true;
}
