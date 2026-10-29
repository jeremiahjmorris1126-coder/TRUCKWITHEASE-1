import { fleetStore, CallerIdentity } from '../data/fleetStore';

export interface DriverProfile {
  id: string;
  fleetId?: string;
  driverId?: string;
  name: string;
  phone: string;
  email: string;
  cdlNumber: string;
  cdlState: string;
  cdlExpiration: string;
  medicalCardExpiration: string;
  assignedUnit: string;
  homeTerminal: string;
  totalMilesLogged: number;
  safetyScore: number;
}

export interface DriverDocument {
  id: string;
  fleetId?: string;
  driverId: string;
  type: 'CDL' | 'MEDICAL_CARD' | 'BOL' | 'RATE_CON' | 'IFTA_RECEIPT' | 'DVIR';
  title: string;
  fileUrl: string;
  uploadedAt: string;
  status: 'VERIFIED' | 'PENDING' | 'EXPIRED';
}

const DEFAULT_CALLER: CallerIdentity = {
  uid: 'usr-admin-01',
  role: 'owner',
  fleetId: 'FLEET1',
};

const DEFAULT_PROFILE: DriverProfile = {
  id: 'drv-master-01',
  fleetId: 'FLEET1',
  driverId: 'drv-master-01',
  name: 'Marcus Vance',
  phone: '+1-555-839-2041',
  email: 'marcus.vance@truckwithease.com',
  cdlNumber: 'CDL-TX-8849201',
  cdlState: 'TX',
  cdlExpiration: '2028-11-15',
  medicalCardExpiration: '2027-06-30',
  assignedUnit: 'UNIT-101',
  homeTerminal: 'Dallas Logistics Hub',
  totalMilesLogged: 482100,
  safetyScore: 98,
};

const INITIAL_DOCS: DriverDocument[] = [
  {
    id: 'doc-01',
    fleetId: 'FLEET1',
    driverId: 'drv-master-01',
    type: 'CDL',
    title: 'Class A CDL License (Front & Back)',
    fileUrl: '/vault/cdl_marcus_vance.pdf',
    uploadedAt: '2026-01-10T12:00:00Z',
    status: 'VERIFIED',
  },
  {
    id: 'doc-02',
    fleetId: 'FLEET1',
    driverId: 'drv-master-01',
    type: 'MEDICAL_CARD',
    title: 'DOT Medical Examiner Certificate MCSA-5876',
    fileUrl: '/vault/dot_med_card.pdf',
    uploadedAt: '2026-01-10T12:05:00Z',
    status: 'VERIFIED',
  },
  {
    id: 'doc-03',
    fleetId: 'FLEET1',
    driverId: 'drv-master-01',
    type: 'BOL',
    title: 'Bill of Lading - Load TWE-98421 (Dallas to Atlanta)',
    fileUrl: '/vault/bol_98421.pdf',
    uploadedAt: new Date().toISOString(),
    status: 'PENDING',
  },
];

// Seed initial profile and documents
fleetStore.seedMockData('driver_profiles', DEFAULT_PROFILE.id, DEFAULT_PROFILE);
for (const doc of INITIAL_DOCS) {
  fleetStore.seedMockData('driver_documents', doc.id, doc);
}

export async function getDriverProfile(
  callerOrDriverId: CallerIdentity | string = 'drv-master-01',
  maybeDriverId?: string
): Promise<DriverProfile | null> {
  let caller: CallerIdentity;
  let driverId: string;

  if (typeof callerOrDriverId === 'object' && callerOrDriverId !== null) {
    caller = callerOrDriverId as CallerIdentity;
    driverId = maybeDriverId || caller.uid;
  } else {
    caller = DEFAULT_CALLER;
    driverId = callerOrDriverId as string;
  }

  const profile = await fleetStore.getScopedDocument<DriverProfile>(caller, 'driver_profiles', driverId);
  return profile;
}

export async function updateDriverProfile(
  callerOrDriverId: CallerIdentity | string,
  driverIdOrUpdates: string | Partial<DriverProfile>,
  maybeUpdates?: Partial<DriverProfile>
): Promise<DriverProfile | null> {
  let caller: CallerIdentity;
  let driverId: string;
  let updates: Partial<DriverProfile>;

  if (typeof callerOrDriverId === 'object' && callerOrDriverId !== null) {
    caller = callerOrDriverId as CallerIdentity;
    driverId = driverIdOrUpdates as string;
    updates = maybeUpdates || {};
  } else {
    caller = DEFAULT_CALLER;
    driverId = callerOrDriverId as string;
    updates = driverIdOrUpdates as Partial<DriverProfile>;
  }

  const existing = await fleetStore.getScopedDocument<DriverProfile>(caller, 'driver_profiles', driverId);
  if (!existing) {
    const newProfile: DriverProfile = {
      id: driverId,
      driverId,
      fleetId: caller.fleetId || null,
      name: (updates as any).name || (updates as any).fullName || caller.uid,
      phone: updates.phone || '+1-555-839-2041',
      email: updates.email || caller.email || `${driverId}@truckwithease.test`,
      cdlNumber: updates.cdlNumber || 'CDL-TX-8849201',
      cdlState: updates.cdlState || 'TX',
      cdlExpiration: updates.cdlExpiration || '2028-11-15',
      medicalCardExpiration: updates.medicalCardExpiration || '2027-06-30',
      assignedUnit: updates.assignedUnit || 'UNIT-101',
      homeTerminal: updates.homeTerminal || 'Dallas Logistics Hub',
      totalMilesLogged: updates.totalMilesLogged || 482100,
      safetyScore: updates.safetyScore || 98,
      ...updates,
    };
    return fleetStore.createScopedDocument<DriverProfile>(caller, 'driver_profiles', driverId, newProfile);
  }

  return fleetStore.updateScopedDocument<DriverProfile>(caller, 'driver_profiles', driverId, updates);
}

export async function getDriverDocuments(
  callerOrDriverId: CallerIdentity | string = 'drv-master-01',
  maybeDriverId?: string
): Promise<DriverDocument[]> {
  let caller: CallerIdentity;
  let driverId: string | undefined;

  if (typeof callerOrDriverId === 'object' && callerOrDriverId !== null) {
    caller = callerOrDriverId as CallerIdentity;
    driverId = maybeDriverId || (caller.role === 'driver' ? caller.uid : undefined);
  } else {
    caller = DEFAULT_CALLER;
    driverId = callerOrDriverId as string;
  }

  const docs = await fleetStore.listScopedCollection<DriverDocument>(
    caller,
    'driver_documents',
    driverId ? { driverId } : undefined
  );
  return docs;
}

export async function getDriverDocumentById(
  caller: CallerIdentity,
  docId: string
): Promise<DriverDocument | null> {
  return fleetStore.getScopedDocument<DriverDocument>(caller, 'driver_documents', docId);
}

export async function addDriverDocument(
  callerOrDoc: CallerIdentity | Omit<DriverDocument, 'id' | 'uploadedAt'>,
  maybeDoc?: Omit<DriverDocument, 'id' | 'uploadedAt'>
): Promise<DriverDocument> {
  let caller: CallerIdentity;
  let doc: Omit<DriverDocument, 'id' | 'uploadedAt'>;

  if (maybeDoc) {
    caller = callerOrDoc as CallerIdentity;
    doc = maybeDoc;
  } else {
    caller = DEFAULT_CALLER;
    doc = callerOrDoc as Omit<DriverDocument, 'id' | 'uploadedAt'>;
  }

  const newDoc: DriverDocument = {
    ...doc,
    id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    uploadedAt: new Date().toISOString(),
  };

  return fleetStore.createScopedDocument<DriverDocument>(caller, 'driver_documents', newDoc.id, newDoc);
}
