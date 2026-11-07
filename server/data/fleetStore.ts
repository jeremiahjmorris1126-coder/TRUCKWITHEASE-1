import { getDb } from '../firestore';

export interface CallerIdentity {
  uid: string;
  email?: string;
  role: 'driver' | 'fleet_admin' | 'owner';
  fleetId: string | null;
}

export class TenantAccessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 404) {
    super(message);
    this.name = 'TenantAccessError';
    this.statusCode = statusCode;
  }
}

// Global in-memory mock store for local development and offline unit testing
// Canonical collection resolver: map legacy 'freight_loads' to canonical 'loads'
function canonicalCol(col: string): string {
  return col === 'freight_loads' ? 'loads' : col;
}

const scopedMockStore: Map<string, Map<string, any>> =
  (globalThis as any).__TWE_SCOPED_MOCK_STORE__ ||
  ((globalThis as any).__TWE_SCOPED_MOCK_STORE__ = new Map<string, Map<string, any>>());

export class FleetStore {
  /**
   * Loads a document by ID and enforces strict multi-tenant isolation.
   * If the document does not exist OR belongs to another fleet, returns null.
   * Route handlers can return 404 so that resource existence is never revealed.
   */
  async getScopedDocument<T = any>(
    caller: CallerIdentity,
    rawColName: string,
    docId: string
  ): Promise<T | null> {
    const collectionName = canonicalCol(rawColName);
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required for data access.', 401);
    }
    if (!docId || typeof docId !== 'string') {
      return null;
    }

    let doc: any = null;

    // 1. Check Cloud Firestore if available
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection(collectionName).doc(docId).get();
        if (snap.exists) {
          doc = { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn(`[FleetStore] Firestore get failed for ${collectionName}/${docId}:`, (err as Error).message);
      }
    }

    // 2. Check local mock store
    if (!doc && scopedMockStore.has(collectionName)) {
      const colMap = scopedMockStore.get(collectionName)!;
      if (colMap.has(docId)) {
        doc = colMap.get(docId);
      }
    }

    if (!doc) {
      return null;
    }

    // OWNER has global diagnostic & governance access
    if (caller.role === 'owner') {
      return doc as T;
    }

    // Treat documents lacking fleetId as inaccessible to everyone except the OWNER
    if (!doc.fleetId || typeof doc.fleetId !== 'string' || !doc.fleetId.trim()) {
      return null;
    }

    // Cross-tenant check: if document belongs to another fleet, return null (404)
    if (!caller.fleetId || doc.fleetId !== caller.fleetId) {
      return null;
    }

    // Driver-specific access restrictions
    if (caller.role === 'driver') {
      // Driver profiles: driver can only access their own profile
      if (collectionName === 'driver_profiles') {
        const driverId = doc.driverId || doc.id;
        if (driverId !== caller.uid) {
          return null;
        }
      }

      // Driver documents: driver can only access their own documents
      if (collectionName === 'driver_documents') {
        if (doc.driverId !== caller.uid) {
          return null;
        }
      }

      // Vehicle profiles: driver can only access their own vehicle profile
      if (collectionName === 'vehicle_profiles') {
        if (doc.driverId && doc.driverId !== caller.uid) {
          return null;
        }
      }

      // Freight loads: drivers may only access available loads or loads assigned to them
      if (collectionName === 'freight_loads' || collectionName === 'loads') {
        if (doc.assignedDriverId && doc.assignedDriverId !== caller.uid && doc.status !== 'AVAILABLE') {
          return null;
        }
      }

      // DVIR records: driver can only access their own DVIRs
      if (collectionName === 'dvir') {
        if (doc.driverId && doc.driverId !== caller.uid) {
          return null;
        }
      }

      // Fuel logs: driver can only access their own fuel logs
      if (collectionName === 'fuel_logs') {
        if (doc.driverId && doc.driverId !== caller.uid) {
          return null;
        }
      }

      // Expenses: driver can only access their own recorded expenses
      if (collectionName === 'expenses') {
        if (doc.driverId && doc.driverId !== caller.uid) {
          return null;
        }
      }
    }

    return doc as T;
  }

  /**
   * Lists documents in a collection with mandatory fleetId filtering.
   */
  async listScopedCollection<T = any>(
    caller: CallerIdentity,
    rawColName: string,
    options?: { status?: string; driverId?: string; limit?: number }
  ): Promise<T[]> {
    const collectionName = canonicalCol(rawColName);
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required for data access.', 401);
    }

    // Non-owners with no fleet assigned have no data access
    if (caller.role !== 'owner' && (!caller.fleetId || !caller.fleetId.trim())) {
      return [];
    }

    const limitCount = options?.limit || 100;
    const results: any[] = [];

    // 1. Try Cloud Firestore
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        let query = (db as any).collection(collectionName);

        if (caller.role !== 'owner') {
          query = query.where('fleetId', '==', caller.fleetId);
        }

        if (options?.status) {
          query = query.where('status', '==', options.status);
        }

        if (caller.role === 'driver') {
          if (
            collectionName === 'driver_documents' ||
            collectionName === 'driver_profiles'
          ) {
            query = query.where('driverId', '==', caller.uid);
          }
        }

        query = query.limit(limitCount);
        const snap = await query.get();
        if (!snap.empty) {
          for (const d of snap.docs) {
            results.push({ id: d.id, ...d.data() });
          }
        }
      } catch (err) {
        console.warn(`[FleetStore] Firestore list failed for ${collectionName}:`, (err as Error).message);
      }
    }

    // 2. Query Mock Store
    if (results.length === 0 && scopedMockStore.has(collectionName)) {
      const colMap = scopedMockStore.get(collectionName)!;
      for (const item of colMap.values()) {
        // Owner sees all
        if (caller.role !== 'owner') {
          // Exclude documents lacking fleetId
          if (!item.fleetId || item.fleetId !== caller.fleetId) {
            continue;
          }
        }

        // Apply status filter
        if (options?.status && item.status !== options.status) {
          continue;
        }

        // Apply driver-specific filtering
        if (caller.role === 'driver') {
          if (collectionName === 'driver_documents' && item.driverId !== caller.uid) {
            continue;
          }
          if (collectionName === 'driver_profiles' && item.driverId !== caller.uid && item.id !== caller.uid) {
            continue;
          }
          if (collectionName === 'vehicle_profiles' && item.driverId && item.driverId !== caller.uid) {
            continue;
          }
          if ((collectionName === 'freight_loads' || collectionName === 'loads') &&
              item.assignedDriverId && item.assignedDriverId !== caller.uid && item.status !== 'AVAILABLE') {
            continue;
          }
          if (collectionName === 'dvir' && item.driverId && item.driverId !== caller.uid) {
            continue;
          }
          if (collectionName === 'fuel_logs' && item.driverId && item.driverId !== caller.uid) {
            continue;
          }
          if (collectionName === 'expenses' && item.driverId && item.driverId !== caller.uid) {
            continue;
          }
        }

        results.push(item);
        if (results.length >= limitCount) break;
      }
    }

    // In-memory driver restriction for freight loads (available unassigned OR assigned to caller)
    if (caller.role === 'driver' && (collectionName === 'freight_loads' || collectionName === 'loads')) {
      return results.filter(
        load => !load.assignedDriverId || load.assignedDriverId === caller.uid || load.status === 'AVAILABLE'
      ) as T[];
    }

    return results as T[];
  }

  /**
   * Creates a new document with mandatory fleetId assignment derived exclusively from caller.
   * Rejects any client attempt to set or mutate fleetId.
   */
  async createScopedDocument<T extends Record<string, any>>(
    caller: CallerIdentity,
    rawColName: string,
    docId: string,
    data: T
  ): Promise<T> {
    const collectionName = canonicalCol(rawColName);
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required for data access.', 401);
    }

    // Invariant 4: Reject any request that tries to set or change fleetId
    if (data.fleetId !== undefined && data.fleetId !== null && data.fleetId !== caller.fleetId) {
      throw new TenantAccessError(
        'Client-supplied fleetId is strictly prohibited. Identity is derived exclusively from server authentication.',
        400
      );
    }

    if (caller.role !== 'owner' && !caller.fleetId) {
      throw new TenantAccessError('User must belong to a fleet to create fleet resources.', 403);
    }

    // Driver restrictions: drivers cannot create loads
    if (caller.role === 'driver' && (collectionName === 'freight_loads' || collectionName === 'loads')) {
      throw new TenantAccessError('Drivers are not permitted to create freight loads.', 403);
    }

    const effectiveFleetId = caller.role === 'owner' && data.fleetId ? data.fleetId : (caller.fleetId || null);

    const docToSave: any = {
      ...data,
      id: docId,
      fleetId: effectiveFleetId,
    };

    // Drivers can only create records with their own driverId
    if (caller.role === 'driver') {
      if (collectionName === 'driver_documents' || collectionName === 'driver_profiles' || collectionName === 'vehicle_profiles') {
        docToSave.driverId = caller.uid;
      }
    }

    // 1. Write to Cloud Firestore
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection(collectionName).doc(docId).set(docToSave, { merge: true });
      } catch (err) {
        console.warn(`[FleetStore] Firestore create failed for ${collectionName}/${docId}:`, (err as Error).message);
      }
    }

    // 2. Write to mock store
    if (!scopedMockStore.has(collectionName)) {
      scopedMockStore.set(collectionName, new Map());
    }
    scopedMockStore.get(collectionName)!.set(docId, docToSave);

    return docToSave as T;
  }

  /**
   * Updates an existing document after verifying tenant ownership.
   * If the document does not exist or belongs to another fleet, returns null (404).
   * Rejects any attempt to change fleetId (400).
   */
  async updateScopedDocument<T extends Record<string, any>>(
    caller: CallerIdentity,
    rawColName: string,
    docId: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const collectionName = canonicalCol(rawColName);
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required for data access.', 401);
    }

    // Load existing document enforcing fleet isolation
    const existing = await this.getScopedDocument<T>(caller, collectionName, docId);
    if (!existing) {
      throw new TenantAccessError(`Document not found: ${collectionName}/${docId}`, 404);
    }

    // Invariant 4: Reject any request that tries to change fleetId
    if (updates.fleetId !== undefined && updates.fleetId !== null && updates.fleetId !== existing.fleetId) {
      throw new TenantAccessError(
        'Cannot modify fleetId on existing resource. Tenant ownership is immutable.',
        400
      );
    }

    // Driver restrictions
    if (caller.role === 'driver') {
      if (collectionName === 'freight_loads' || collectionName === 'loads') {
        // Drivers cannot dispatch loads or edit load terms
        if ((updates as any).status === 'DISPATCHED' || (updates as any).grossPayUsd !== undefined) {
          throw new TenantAccessError('Drivers are not authorized to dispatch or modify load terms.', 403);
        }
      }
    }

    const merged = {
      ...existing,
      ...updates,
      id: docId,
      fleetId: existing.fleetId, // Preserve original fleetId strictly
    };

    // 1. Write to Cloud Firestore
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection(collectionName).doc(docId).set(merged, { merge: true });
      } catch (err) {
        console.warn(`[FleetStore] Firestore update failed for ${collectionName}/${docId}:`, (err as Error).message);
      }
    }

    // 2. Write to mock store
    if (!scopedMockStore.has(collectionName)) {
      scopedMockStore.set(collectionName, new Map());
    }
    scopedMockStore.get(collectionName)!.set(docId, merged);

    return merged as T;
  }

  /**
   * Deletes a document with strict fleet isolation.
   * Returns false if document does not exist or belongs to another fleet (404).
   */
  async deleteScopedDocument(
    caller: CallerIdentity,
    rawColName: string,
    docId: string
  ): Promise<boolean> {
    const collectionName = canonicalCol(rawColName);
    const existing = await this.getScopedDocument(caller, collectionName, docId);
    if (!existing) {
      return false;
    }

    if (caller.role === 'driver') {
      throw new TenantAccessError('Drivers cannot delete fleet resources.', 403);
    }

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection(collectionName).doc(docId).delete();
      } catch (err) {
        console.warn(`[FleetStore] Firestore delete failed for ${collectionName}/${docId}:`, (err as Error).message);
      }
    }

    if (scopedMockStore.has(collectionName)) {
      scopedMockStore.get(collectionName)!.delete(docId);
    }

    return true;
  }

  /**
   * Seeds mock data directly for unit testing and regression suites.
   */
  seedMockData(rawColName: string, docId: string, data: any): void {
    const collectionName = canonicalCol(rawColName);
    if (!scopedMockStore.has(collectionName)) {
      scopedMockStore.set(collectionName, new Map());
    }
    scopedMockStore.get(collectionName)!.set(docId, data);
  }

  /**
   * Clears in-memory mock store for test isolation.
   */
  clearMockStore(): void {
    scopedMockStore.clear();
  }
}

export const fleetStore = new FleetStore();
