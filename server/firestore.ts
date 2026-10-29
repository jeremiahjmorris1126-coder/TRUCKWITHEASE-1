import { Firestore } from '@google-cloud/firestore';
import path from 'path';
import fs from 'fs';

export interface FirestoreHealthStatus {
  status: 'CONNECTED' | 'MOCK_FALLBACK' | 'ERROR';
  mode: 'CLOUD_FIRESTORE' | 'LOCAL_MOCK';
  projectId: string;
  databaseId: string;
  latencyMs?: number;
  error?: string;
}

let dbInstance: Firestore | null = null;
const mockStore = new Map<string, Map<string, any>>();

function hasGoogleCredentials(): boolean {
  if (process.env.FIRESTORE_FORCE_MOCK === 'true') return false;
  // On Google Cloud Run or GCE, K_SERVICE / GOOGLE_APPLICATION_CREDENTIALS exists
  if (process.env.K_SERVICE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  try {
    const defaultAdcPath = process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json')
      : path.join(process.env.HOME || '', '.config', 'gcloud', 'application_default_credentials.json');
    return fs.existsSync(defaultAdcPath);
  } catch {
    return false;
  }
}

export function getFirestoreDb(): Firestore | null {
  if (!hasGoogleCredentials()) return null;
  if (dbInstance) return dbInstance;

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'project-f0634118-be01-44f7-b36';
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'app-builder-38a26d99';

  try {
    dbInstance = new Firestore({
      projectId,
      databaseId: databaseId === '(default)' ? undefined : databaseId,
      ignoreUndefinedProperties: true,
    });
    return dbInstance;
  } catch (err) {
    console.warn('[Firestore] Real connection init failed, running in mock fallback mode:', (err as Error).message);
    return null;
  }
}

export const getDb = getFirestoreDb;

export async function testFirestoreReadWrite(): Promise<{ success: boolean; id: string; latencyMs: number; mode: string }> {
  const start = Date.now();
  const testId = `probe-${Date.now()}`;
  const payload = {
    testId,
    service: 'TruckWithEase Cockpit Probe',
    timestamp: new Date().toISOString(),
  };

  const db = getFirestoreDb();
  if (db) {
    try {
      const docRef = db.collection('system_health_probes').doc(testId);
      await docRef.set(payload);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new Error('Verification read failed: doc not found after write');
      }
      return {
        success: true,
        id: testId,
        latencyMs: Date.now() - start,
        mode: 'CLOUD_FIRESTORE',
      };
    } catch (err) {
      console.warn('[Firestore] Cloud read/write failed, using mock persistence:', (err as Error).message);
    }
  }

  // Fallback Mock Persistence
  if (!mockStore.has('system_health_probes')) {
    mockStore.set('system_health_probes', new Map());
  }
  mockStore.get('system_health_probes')!.set(testId, payload);

  return {
    success: true,
    id: testId,
    latencyMs: Date.now() - start,
    mode: 'LOCAL_MOCK',
  };
}

export async function checkFirestoreHealth(): Promise<FirestoreHealthStatus> {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'project-f0634118-be01-44f7-b36';
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'app-builder-38a26d99';

  try {
    const result = await testFirestoreReadWrite();
    return {
      status: result.mode === 'CLOUD_FIRESTORE' ? 'CONNECTED' : 'MOCK_FALLBACK',
      mode: result.mode as any,
      projectId,
      databaseId,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    return {
      status: 'MOCK_FALLBACK',
      mode: 'LOCAL_MOCK',
      projectId,
      databaseId,
      error: (err as Error).message,
    };
  }
}

// Multi-Tenant Collections that MUST be routed through FleetStore with caller identity
const PROTECTED_TENANT_COLLECTIONS = new Set([
  'freight_loads',
  'loads',
  'aux_alerts',
  'driver_profiles',
  'driver_documents',
  'vehicle_profiles',
]);

export async function saveDocument(collectionName: string, docId: string, data: any): Promise<void> {
  if (PROTECTED_TENANT_COLLECTIONS.has(collectionName)) {
    throw new Error(
      `Direct unfiltered call to saveDocument('${collectionName}') is blocked. Route all tenant reads/writes through fleetStore with caller identity.`
    );
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(collectionName).doc(docId).set(data, { merge: true });
      return;
    } catch (e) {
      console.warn(`[Firestore] Cloud write failed for ${collectionName}/${docId}`);
    }
  }

  if (!mockStore.has(collectionName)) {
    mockStore.set(collectionName, new Map());
  }
  const col = mockStore.get(collectionName)!;
  const existing = col.get(docId) || {};
  col.set(docId, { ...existing, ...data });
}

export async function getDocument<T = any>(collectionName: string, docId: string): Promise<T | null> {
  if (PROTECTED_TENANT_COLLECTIONS.has(collectionName)) {
    throw new Error(
      `Direct unfiltered call to getDocument('${collectionName}') is blocked. Route all tenant reads/writes through fleetStore with caller identity.`
    );
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(collectionName).doc(docId).get();
      if (snap.exists) {
        return snap.data() as T;
      }
    } catch (e) {
      console.warn(`[Firestore] Cloud read failed for ${collectionName}/${docId}`);
    }
  }

  return (mockStore.get(collectionName)?.get(docId) as T) || null;
}

export async function listCollection<T = any>(collectionName: string, limitCount = 50): Promise<T[]> {
  if (PROTECTED_TENANT_COLLECTIONS.has(collectionName)) {
    throw new Error(
      `Direct unfiltered call to listCollection('${collectionName}') is blocked. Route all tenant reads/writes through fleetStore with caller identity.`
    );
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(collectionName).limit(limitCount).get();
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
      }
    } catch (e) {
      console.warn(`[Firestore] Cloud list failed for ${collectionName}`);
    }
  }

  const col = mockStore.get(collectionName);
  if (!col) return [];
  return Array.from(col.values()).slice(0, limitCount) as T[];
}

export { fleetStore, FleetStore, type CallerIdentity, TenantAccessError } from './data/fleetStore';

