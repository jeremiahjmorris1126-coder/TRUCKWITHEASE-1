import { fleetStore, CallerIdentity } from '../data/fleetStore';
import {
  CommercialVehicleProfile,
  DEFAULT_COMMERCIAL_PROFILE,
  StoredVehicleProfileDoc,
  validateVehicleProfile,
} from './types';

export class VehicleProfileService {
  /**
   * Saves or updates a driver's vehicle profile via FleetStore with fleet isolation.
   */
  async saveVehicleProfile(
    callerOrFleetId: CallerIdentity | string,
    driverId: string,
    profileData: any,
    requestingFleetId?: string
  ): Promise<StoredVehicleProfileDoc> {
    let caller: CallerIdentity;

    if (typeof callerOrFleetId === 'object' && callerOrFleetId !== null) {
      caller = callerOrFleetId as CallerIdentity;
    } else {
      caller = {
        uid: driverId,
        role: 'fleet_admin',
        fleetId: requestingFleetId || (callerOrFleetId as string),
      };
    }

    const fleetId = caller.fleetId;
    if (!fleetId || !fleetId.trim()) {
      const err = new Error('fleetId is required to save vehicle profile');
      (err as any).statusCode = 400;
      throw err;
    }

    // Reject attempt to set/change fleetId from body
    if (profileData && profileData.fleetId && profileData.fleetId !== fleetId) {
      const err = new Error('Cannot set or change fleetId in request body. Tenant is derived strictly from authentication.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Driver can only save own profile
    const effectiveDriverId = caller.role === 'driver' ? caller.uid : driverId;
    if (caller.role === 'driver' && driverId !== caller.uid) {
      const err = new Error('Drivers cannot edit vehicle profiles for other drivers');
      (err as any).statusCode = 403;
      throw err;
    }

    // Validate dimensions and parameters
    const validation = validateVehicleProfile(profileData);
    if (!validation.valid) {
      const err = new Error(`Invalid vehicle profile: ${validation.errors.join('; ')}`);
      (err as any).statusCode = 400;
      throw err;
    }

    const docId = `${fleetId}_${effectiveDriverId}`;
    const doc: StoredVehicleProfileDoc = {
      id: docId,
      fleetId,
      driverId: effectiveDriverId,
      unitNumber: profileData.unitNumber || 'TRACTOR-01',
      ...validation.sanitized,
      updatedAt: new Date().toISOString(),
    };

    return fleetStore.createScopedDocument<StoredVehicleProfileDoc>(caller, 'vehicle_profiles', docId, doc);
  }

  /**
   * Retrieves a vehicle profile, enforcing strict multi-tenant fleet isolation.
   * Cross-tenant access returns 404 so resource existence is not revealed.
   */
  async getVehicleProfile(
    callerOrFleetId: CallerIdentity | string,
    driverId: string,
    targetFleetId?: string
  ): Promise<StoredVehicleProfileDoc> {
    let caller: CallerIdentity;

    if (typeof callerOrFleetId === 'object' && callerOrFleetId !== null) {
      caller = callerOrFleetId as CallerIdentity;
    } else {
      caller = {
        uid: driverId,
        role: 'fleet_admin',
        fleetId: callerOrFleetId as string,
      };
    }

    if (!caller.fleetId) {
      const err = new Error('requestingFleetId is required for fleet access');
      (err as any).statusCode = 401;
      throw err;
    }

    // Cross-tenant check: if caller attempts to access another fleet's profile, return 404
    if (targetFleetId && targetFleetId !== caller.fleetId) {
      const err = new Error('Vehicle profile not found');
      (err as any).statusCode = 404; // Return 404 so object existence isn't revealed
      throw err;
    }

    // Drivers can only access their own profile
    if (caller.role === 'driver' && driverId !== caller.uid) {
      const err = new Error('Vehicle profile not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const docId = `${caller.fleetId}_${driverId}`;
    const stored = await fleetStore.getScopedDocument<StoredVehicleProfileDoc>(caller, 'vehicle_profiles', docId);
    if (stored) {
      return stored;
    }

    // Only return auto-fallback profile if caller is retrieving their own profile
    if (caller.uid === driverId) {
      const fallbackDoc: StoredVehicleProfileDoc = {
        id: docId,
        fleetId: caller.fleetId,
        driverId,
        ...DEFAULT_COMMERCIAL_PROFILE,
        updatedAt: new Date().toISOString(),
      };
      fleetStore.seedMockData('vehicle_profiles', docId, fallbackDoc);
      return fallbackDoc;
    }

    const err = new Error('Vehicle profile not found');
    (err as any).statusCode = 404;
    throw err;
  }

  public clearForTesting(): void {
    fleetStore.clearMockStore();
  }
}

export const vehicleProfileService = new VehicleProfileService();
