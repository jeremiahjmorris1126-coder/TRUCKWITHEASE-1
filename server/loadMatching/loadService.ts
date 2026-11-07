import { fleetStore, CallerIdentity } from '../data/fleetStore';
import { logAuditEvent } from '../admin/adminService';

const LOAD_STATUS_ORDER: Record<'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED', number> = {
  AVAILABLE: 0,
  DISPATCHED: 1,
  IN_TRANSIT: 2,
  COMPLETED: 3,
};

export interface FreightLoad {
  id: string;
  fleetId?: string;
  loadNumber: string;
  origin: string;
  destination: string;
  miles: number;
  deadheadMiles: number;
  grossPayUsd: number;
  equipmentType: 'DRY_VAN' | 'REEFER' | 'FLATBED' | 'STEP_DECK' | 'POWER_ONLY';
  weightLbs: number;
  pickupTime: string;
  deliveryTime: string;
  shipperBroker: string;
  contactPhone: string;
  status: 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED';
  assignedDriverId?: string;
  assignedUnitId?: string;
  estimatedTransitHours: number;
  yieldPerHourUsd: number; // Dispatch Zero metric: ($ / Hr)
  detentionRatePerHour?: number; // From rate confirmation ($/hr)
  freeMinutes?: number; // Free dwell time from rate confirmation (minutes)
  shipperBrokerEmail?: string;
  rateConDocUrl?: string;
  deliveryFacilityName?: string;
  deliveryAddress?: string;
  originFacilityName?: string;
  originAddress?: string;
  deliveryCoordinates?: { lat: number; lng: number };
  appointmentTs?: number;
}

const DEFAULT_CALLER: CallerIdentity = {
  uid: 'usr-admin-01',
  role: 'owner',
  fleetId: 'FLEET1',
};

const INITIAL_LOADS: FreightLoad[] = [
  {
    id: 'load-tx-01',
    fleetId: 'FLEET1',
    loadNumber: 'TWE-98421',
    origin: 'Dallas, TX',
    destination: 'Atlanta, GA',
    miles: 780,
    deadheadMiles: 14,
    grossPayUsd: 2850,
    equipmentType: 'DRY_VAN',
    weightLbs: 34500,
    pickupTime: 'Today 14:00 CST',
    deliveryTime: 'Tomorrow 10:00 EST',
    shipperBroker: 'Apex Logistics Freight',
    contactPhone: '+1-800-555-0199',
    shipperBrokerEmail: 'billing@apexlogistics.example.com',
    status: 'AVAILABLE',
    estimatedTransitHours: 12.2,
    yieldPerHourUsd: 233.60,
    detentionRatePerHour: 75.0,
    freeMinutes: 120,
    deliveryFacilityName: 'Apex Southeast Distribution Center',
    deliveryAddress: '4200 Logistics Pkwy, Atlanta, GA 30336',
    deliveryCoordinates: { lat: 33.749, lng: -84.388 },
  },
  {
    id: 'load-mo-02',
    fleetId: 'FLEET1',
    loadNumber: 'TWE-77192',
    origin: 'St. Louis, MO',
    destination: 'Columbus, OH',
    miles: 415,
    deadheadMiles: 8,
    grossPayUsd: 1650,
    equipmentType: 'REEFER',
    weightLbs: 38200,
    pickupTime: 'Today 18:00 CST',
    deliveryTime: 'Tomorrow 06:00 EST',
    shipperBroker: 'Heartland Cold Chain Corp',
    contactPhone: '+1-800-555-0144',
    shipperBrokerEmail: 'dispatch@heartlandcold.example.com',
    status: 'AVAILABLE',
    estimatedTransitHours: 6.8,
    yieldPerHourUsd: 242.65,
    detentionRatePerHour: 85.0,
    freeMinutes: 60,
    deliveryFacilityName: 'Heartland Frozen Logistics Terminal',
    deliveryAddress: '880 Cold Storage Way, Columbus, OH 43215',
    deliveryCoordinates: { lat: 39.9612, lng: -82.9988 },
  },
  {
    id: 'load-in-03',
    fleetId: 'FLEET1',
    loadNumber: 'TWE-66318',
    origin: 'Indianapolis, IN',
    destination: 'Nashville, TN',
    miles: 290,
    deadheadMiles: 5,
    grossPayUsd: 1100,
    equipmentType: 'FLATBED',
    weightLbs: 42000,
    pickupTime: 'Tomorrow 08:00 EST',
    deliveryTime: 'Tomorrow 14:00 CST',
    shipperBroker: 'Midwest Steel Express',
    contactPhone: '+1-800-555-0182',
    shipperBrokerEmail: 'settlements@midweststeel.example.com',
    status: 'AVAILABLE',
    estimatedTransitHours: 4.6,
    yieldPerHourUsd: 239.13,
    detentionRatePerHour: 70.0,
    freeMinutes: 120,
    deliveryFacilityName: 'Midwest Tube & Beam Yard',
    deliveryAddress: '120 Industrial Blvd, Nashville, TN 37210',
    deliveryCoordinates: { lat: 36.1627, lng: -86.7816 },
  },
];

// Seed initial loads into fleetStore
for (const l of INITIAL_LOADS) {
  fleetStore.seedMockData('loads', l.id, l);
}

export async function getLoads(caller?: CallerIdentity, status?: string): Promise<FreightLoad[]> {
  const activeCaller = caller || DEFAULT_CALLER;
  return fleetStore.listScopedCollection<FreightLoad>(
    activeCaller,
    'loads',
    status ? { status } : undefined
  );
}

export async function getLoadById(caller: CallerIdentity, loadId: string): Promise<FreightLoad | null> {
  return fleetStore.getScopedDocument<FreightLoad>(caller, 'loads', loadId);
}

export async function createLoad(
  callerOrLoadData: CallerIdentity | Omit<FreightLoad, 'id' | 'yieldPerHourUsd' | 'status'>,
  maybeLoadData?: Omit<FreightLoad, 'id' | 'yieldPerHourUsd' | 'status'>
): Promise<FreightLoad> {
  const caller: CallerIdentity = maybeLoadData ? (callerOrLoadData as CallerIdentity) : DEFAULT_CALLER;
  const loadData = maybeLoadData || (callerOrLoadData as Omit<FreightLoad, 'id' | 'yieldPerHourUsd' | 'status'>);

  const estimatedHours = loadData.estimatedTransitHours || (loadData.miles / 55);
  const fuelEst = (loadData.miles / 6.5) * 3.85;
  const netProfit = loadData.grossPayUsd - fuelEst;
  const yieldPerHourUsd = parseFloat((netProfit / Math.max(1, estimatedHours)).toFixed(2));

  const newLoad: FreightLoad = {
    ...loadData,
    id: `load-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: 'AVAILABLE',
    estimatedTransitHours: parseFloat(estimatedHours.toFixed(1)),
    yieldPerHourUsd,
  };

  return fleetStore.createScopedDocument<FreightLoad>(caller, 'loads', newLoad.id, newLoad);
}

export async function matchLoadsForDriver(
  callerOrHours: CallerIdentity | number,
  driverHoursOrOrigin?: number | string,
  originLocation?: string
): Promise<FreightLoad[]> {
  let caller: CallerIdentity;
  let driverHoursRemaining: number;

  if (typeof callerOrHours === 'object' && callerOrHours !== null) {
    caller = callerOrHours as CallerIdentity;
    driverHoursRemaining = typeof driverHoursOrOrigin === 'number' ? driverHoursOrOrigin : 10;
  } else {
    caller = DEFAULT_CALLER;
    driverHoursRemaining = typeof callerOrHours === 'number' ? callerOrHours : 10;
  }

  const allLoads = await getLoads(caller, 'AVAILABLE');

  // Sort by Yield per Hour ($/Hr) descending, filtering within legal hours
  return allLoads
    .filter(load => load.estimatedTransitHours <= driverHoursRemaining)
    .sort((a, b) => b.yieldPerHourUsd - a.yieldPerHourUsd);
}

export async function dispatchLoad(
  callerOrLoadId: CallerIdentity | string,
  loadIdOrDriverId: string,
  driverIdOrUnitId: string,
  maybeUnitId?: string
): Promise<FreightLoad | null> {
  let caller: CallerIdentity;
  let loadId: string;
  let driverId: string;
  let unitId: string;

  if (typeof callerOrLoadId === 'object' && callerOrLoadId !== null) {
    caller = callerOrLoadId as CallerIdentity;
    loadId = loadIdOrDriverId;
    driverId = driverIdOrUnitId;
    unitId = maybeUnitId || 'UNIT-101';
  } else {
    caller = DEFAULT_CALLER;
    loadId = callerOrLoadId as string;
    driverId = loadIdOrDriverId;
    unitId = driverIdOrUnitId;
  }

  // Load object and verify tenant isolation
  const existing = await fleetStore.getScopedDocument<FreightLoad>(caller, 'loads', loadId);
  if (!existing) {
    return null; // Returns null -> route returns 404 (does not reveal existence)
  }

  if (caller.role === 'driver') {
    const err = new Error('Drivers cannot dispatch loads.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (existing.status === 'COMPLETED') {
    const err = new Error('Invalid status transition: COMPLETED load cannot be reverted to DISPATCHED.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (LOAD_STATUS_ORDER['DISPATCHED'] < LOAD_STATUS_ORDER[existing.status]) {
    logAuditEvent(
      'WARN',
      'LOAD_STATUS_REVERSAL',
      `Load ${loadId} status reversed from ${existing.status} to DISPATCHED by ${caller.role} (${caller.uid})`,
      caller.uid
    );
  }

  return fleetStore.updateScopedDocument<FreightLoad>(caller, 'loads', loadId, {
    status: 'DISPATCHED',
    assignedDriverId: driverId,
    assignedUnitId: unitId,
  });
}

export async function updateLoadStatus(
  caller: CallerIdentity,
  loadId: string,
  status?: 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED',
  assignedUnitId?: string,
  assignedDriverId?: string
): Promise<FreightLoad | null> {
  const existing = await fleetStore.getScopedDocument<FreightLoad>(caller, 'loads', loadId);
  if (!existing) {
    return null;
  }

  const targetStatus = status ?? existing.status;
  if (!(targetStatus in LOAD_STATUS_ORDER)) {
    const err = new Error(`Invalid status. Must be one of: ${Object.keys(LOAD_STATUS_ORDER).join(', ')}`);
    (err as any).statusCode = 400;
    throw err;
  }

  const isAdminOrOwner = caller.role === 'fleet_admin' || caller.role === 'owner';

  if (caller.role === 'driver') {
    if (assignedDriverId !== undefined && assignedDriverId !== caller.uid) {
      const err = new Error('Forbidden: Only fleet_admin or owner can assign or reassign loads to drivers.');
      (err as any).statusCode = 403;
      throw err;
    }

    if (existing.assignedDriverId && existing.assignedDriverId !== caller.uid) {
      const err = new Error('Forbidden: Load is assigned to another driver.');
      (err as any).statusCode = 403;
      throw err;
    }

    if (!existing.assignedDriverId && existing.status !== 'AVAILABLE') {
      const err = new Error('Forbidden: Drivers may only update loads assigned to them or accept an AVAILABLE unassigned load.');
      (err as any).statusCode = 403;
      throw err;
    }
  }

  const currentOrder = LOAD_STATUS_ORDER[existing.status];
  const nextOrder = LOAD_STATUS_ORDER[targetStatus];

  if (existing.status === 'COMPLETED' && targetStatus !== 'COMPLETED') {
    const err = new Error(`Invalid status transition: COMPLETED load cannot be reverted to ${targetStatus}.`);
    (err as any).statusCode = 400;
    throw err;
  }

  if (nextOrder > currentOrder) {
    if (nextOrder !== currentOrder + 1) {
      const err = new Error(
        `Invalid status transition from ${existing.status} to ${targetStatus}. Valid order is AVAILABLE -> DISPATCHED -> IN_TRANSIT -> COMPLETED.`
      );
      (err as any).statusCode = 400;
      throw err;
    }
  } else if (nextOrder < currentOrder) {
    if (!isAdminOrOwner) {
      const err = new Error(
        `Invalid status transition from ${existing.status} to ${targetStatus}. Only fleet_admin or owner can reverse a load status.`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    logAuditEvent(
      'WARN',
      'LOAD_STATUS_REVERSAL',
      `Load ${loadId} status reversed from ${existing.status} to ${targetStatus} by ${caller.role} (${caller.uid})`,
      caller.uid
    );
  } else {
    const isAdminReassign =
      isAdminOrOwner &&
      ((assignedDriverId !== undefined && assignedDriverId !== existing.assignedDriverId) ||
        (assignedUnitId !== undefined && assignedUnitId !== existing.assignedUnitId));
    if (!isAdminReassign || existing.status === 'COMPLETED') {
      const err = new Error(`Invalid status transition: Load is already in status ${existing.status}.`);
      (err as any).statusCode = 400;
      throw err;
    }
  }

  const updates: Partial<FreightLoad> = {
    status: targetStatus,
  };

  if (caller.role === 'driver') {
    updates.assignedDriverId = caller.uid;
    if (assignedUnitId) updates.assignedUnitId = assignedUnitId;
  } else if (isAdminOrOwner) {
    if (assignedDriverId !== undefined) {
      updates.assignedDriverId = assignedDriverId;
    } else if (targetStatus === 'AVAILABLE') {
      updates.assignedDriverId = undefined;
    }
    if (assignedUnitId !== undefined) {
      updates.assignedUnitId = assignedUnitId;
    }
  }

  return fleetStore.updateScopedDocument<FreightLoad>(caller, 'loads', loadId, updates);
}
