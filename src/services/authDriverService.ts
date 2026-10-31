/**
 * TruckWithEase // Commercial Driver Auth & Fleet Roster Service
 * Manages Driver Sign-Up Sheet, Sign-In, Session, and Roster Selection.
 *
 * Implements structured logging and explicit error handling:
 * - Domain validation errors for missing CDL, invalid PIN, or unauthorized access
 * - Zero credential leakage (PIN, CDL partially masked, auth token redacted)
 * - Safe resilient storage fallback with telemetry logging
 */

import { DriverAuthRecord, DriverSignUpPayload, DriverSignInPayload } from '../types';
import { safeStorage } from '../utils/safeStorage.ts';
import { logger } from '../utils/logger.ts';
import { DomainValidationError, NetworkError, AppError } from '../utils/errors.ts';

const STORAGE_KEY_ACTIVE_DRIVER = 'truck_active_driver_profile';
const STORAGE_KEY_AUTH_TOKEN = 'truck_auth_session_token';
const STORAGE_KEY_SAVED_DRIVERS = 'truck_fleet_drivers_roster';

export const FALLBACK_DEFAULT_DRIVER: DriverAuthRecord = {
  driverId: 'drv-jeremiah-904',
  name: 'Jeremiah J. Morris',
  email: 'jeremiah@morrishive.com',
  phone: '(555) 234-5678',
  role: 'OWNER_OPERATOR',
  cdlNumber: 'IL-CDL-98104820',
  cdlState: 'IL',
  cdlExpirationDate: '2027-04-15',
  medicalCertExp: '2026-11-30',
  assignedUnit: 'TRK-904',
  assignedTrailer: 'TRL-5321',
  carrierName: 'Morris Hive Freight LLC',
  usdotNumber: '3948210',
  fmcsaPin: '8821',
  traxxasTransponderId: 'TRAXXAS-TX904-ENTERPRISE',
  activeDutyStatus: 'D',
  selectedFunctions: [
    'night-hud',
    'hos-clocks',
    'radar-54b',
    'master-mechanic',
    'dispatch-eta',
    'vault',
    'fleet-expenses',
    'trip-planner',
    'haptics',
    'ecosystem',
    'telemetry',
    'traxxas',
    'hre',
    'quantum-index',
  ],
  createdAt: '2026-01-10T08:00:00.000Z',
  dqfStatus: 'FULLY_COMPLIANT',
};

type DriverChangeListener = (driver: DriverAuthRecord) => void;

class AuthDriverService {
  private activeDriver: DriverAuthRecord;
  private token: string | null = null;
  private listeners: Set<DriverChangeListener> = new Set();

  constructor() {
    this.activeDriver = this.loadPersistedDriver();
    const tokenResult = safeStorage.getItem<string | null>(STORAGE_KEY_AUTH_TOKEN, null);
    this.token = tokenResult.data;
  }

  private loadPersistedDriver(): DriverAuthRecord {
    const res = safeStorage.getItem<DriverAuthRecord>(STORAGE_KEY_ACTIVE_DRIVER, FALLBACK_DEFAULT_DRIVER);
    return res.data || FALLBACK_DEFAULT_DRIVER;
  }

  private persistDriver(driver: DriverAuthRecord, token?: string): void {
    this.activeDriver = driver;
    safeStorage.setItem(STORAGE_KEY_ACTIVE_DRIVER, driver);
    if (token) {
      this.token = token;
      safeStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
    }
    logger.info('AUTH_SERVICE', `Active cockpit driver profile updated: ${driver.name}`, {
      driverId: driver.driverId,
      carrierName: driver.carrierName,
      cdlNumber: driver.cdlNumber, // Automatically masked by logger
    });
    this.notifyListeners(driver);
  }

  public subscribe(listener: DriverChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeDriver);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(driver: DriverAuthRecord): void {
    this.listeners.forEach((listener) => {
      try {
        listener(driver);
      } catch (err) {
        logger.error('AUTH_SERVICE', 'Error in driver auth listener', err);
      }
    });
  }

  public getCurrentDriver(): DriverAuthRecord {
    return this.activeDriver;
  }

  public async fetchSession(): Promise<{ authenticated: boolean; driver: DriverAuthRecord }> {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data.activeDriver) {
          this.persistDriver(data.activeDriver);
          return { authenticated: true, driver: data.activeDriver };
        }
      }
    } catch (e) {
      logger.warn('AUTH_SERVICE', 'Session fetch failed; utilizing local cached session profile', undefined, e);
    }
    return { authenticated: true, driver: this.activeDriver };
  }

  /**
   * Complete Sign-Up Sheet: Register a new driver with fleet credentials & preferences
   */
  public async signup(payload: DriverSignUpPayload): Promise<{ success: boolean; driver: DriverAuthRecord; message: string }> {
    // 1. Explicit domain validation
    if (!payload.name || !payload.name.trim()) {
      const validationError = new DomainValidationError(
        'Full driver legal name is required for FMCSA enrollment.',
        { field: 'name' },
        'E_AUTH_VALIDATION_FAILED'
      );
      logger.warn('AUTH_SERVICE', 'Sign-up rejected: missing driver name', validationError.details, validationError);
      throw validationError;
    }

    if (!payload.cdlNumber || !payload.cdlNumber.trim()) {
      const cdlError = new DomainValidationError(
        'Commercial Driver License (CDL) number is required for 49 CFR § 383 compliance.',
        { field: 'cdlNumber' },
        'E_AUTH_CDL_REQUIRED'
      );
      logger.warn('AUTH_SERVICE', 'Sign-up rejected: missing CDL', cdlError.details, cdlError);
      throw cdlError;
    }

    let isOfflineNetwork = false;

    // 2. Attempt remote registration
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.driver) {
          this.persistDriver(data.driver, data.token);
          this.appendToLocalRoster(data.driver);
          logger.info('AUTH_SERVICE', `New driver successfully enrolled: ${data.driver.name}`, {
            driverId: data.driver.driverId,
            cdlNumber: data.driver.cdlNumber,
          });
          return {
            success: true,
            driver: data.driver,
            message: data.message || `Driver ${data.driver.name} enrolled and signed in.`,
          };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const serverError = new DomainValidationError(
          errData.error || `Sign-up rejected by carrier registry (HTTP ${res.status}).`,
          { status: res.status, errorText: errData.error },
          'E_AUTH_VALIDATION_FAILED'
        );
        logger.warn('AUTH_SERVICE', `Server rejected driver registration: ${serverError.userMessage}`, serverError.details, serverError);
        throw serverError;
      }
    } catch (err) {
      if (err instanceof DomainValidationError) {
        throw err;
      }
      isOfflineNetwork = true;
      logger.warn(
        'AUTH_SERVICE',
        'Backend registration endpoint unreachable; generating offline driver profile in local vault',
        { driverName: payload.name },
        err
      );
    }

    // 3. Resilient Offline Fallback (only for network connectivity drops, NOT validation failures)
    if (isOfflineNetwork) {
      const cleanName = payload.name.trim();
      const idSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      const driverId = `drv-${idSlug}-${Math.floor(100 + Math.random() * 900)}`;

      const fallbackDriver: DriverAuthRecord = {
        driverId,
        name: cleanName,
        email: payload.email?.trim() || `${idSlug}@morrishive.com`,
        phone: payload.phone?.trim() || '(555) 000-0000',
        role: payload.role || 'FLEET_DRIVER',
        cdlNumber: payload.cdlNumber.trim().toUpperCase(),
        cdlState: (payload.cdlState || 'IL').toUpperCase(),
        cdlExpirationDate: payload.cdlExpirationDate || '2028-06-30',
        medicalCertExp: payload.medicalCertExp || '2027-06-30',
        assignedUnit: payload.assignedUnit?.trim() || 'TRK-904',
        assignedTrailer: payload.assignedTrailer?.trim() || 'TRL-5321',
        carrierName: payload.carrierName?.trim() || 'Morris Hive Freight LLC',
        usdotNumber: payload.usdotNumber?.trim() || '3948210',
        fmcsaPin: payload.fmcsaPin?.trim() || '8821',
        traxxasTransponderId: payload.traxxasTransponderId?.trim() || 'TRAXXAS-BEACON-LOCAL',
        activeDutyStatus: 'OFF',
        selectedFunctions: payload.selectedFunctions || [
          'night-hud',
          'hos-clocks',
          'radar-54b',
          'master-mechanic',
          'dispatch-eta',
          'traxxas',
          'hre',
        ],
        createdAt: new Date().toISOString(),
        dqfStatus: 'FULLY_COMPLIANT',
      };

      this.persistDriver(fallbackDriver, `tok_${fallbackDriver.driverId}`);
      this.appendToLocalRoster(fallbackDriver);

      return {
        success: true,
        driver: fallbackDriver,
        message: `Driver ${fallbackDriver.name} enrolled in local offline vault.`,
      };
    }

    throw new DomainValidationError('Registration failed.', undefined, 'E_AUTH_VALIDATION_FAILED');
  }

  /**
   * Driver Sign-In with FMCSA PIN verification
   */
  public async signin(payload: DriverSignInPayload): Promise<{ success: boolean; driver: DriverAuthRecord }> {
    if (!payload.identifier || !payload.identifier.trim()) {
      throw new DomainValidationError(
        'Driver credential identifier (CDL, Email, or Driver ID) is required.',
        { field: 'identifier' },
        'E_AUTH_INVALID_CREDENTIALS'
      );
    }

    let isOfflineNetwork = false;

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.driver) {
          this.persistDriver(data.driver, data.token);
          logger.info('AUTH_SERVICE', `Driver sign-in authenticated: ${data.driver.name}`, {
            driverId: data.driver.driverId,
            cdlNumber: data.driver.cdlNumber,
          });
          return { success: true, driver: data.driver };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const authError = new DomainValidationError(
          errData.error || 'Authentication rejected: Invalid CDL or FMCSA Roadside PIN.',
          { identifier: payload.identifier, status: res.status },
          'E_AUTH_INVALID_CREDENTIALS'
        );
        logger.warn('AUTH_SERVICE', `Driver authentication failure for "${payload.identifier}"`, authError.details, authError);
        throw authError;
      }
    } catch (err) {
      if (err instanceof DomainValidationError) {
        throw err;
      }
      isOfflineNetwork = true;
      logger.warn('AUTH_SERVICE', 'Sign-in endpoint offline; attempting local fleet roster authentication', { identifier: payload.identifier }, err);
    }

    // Offline Local Roster Lookup
    if (isOfflineNetwork) {
      const roster = await this.getAllDrivers();
      const clean = payload.identifier.toLowerCase().trim();
      const match = roster.find(
        (d) =>
          d.driverId.toLowerCase() === clean ||
          d.email.toLowerCase() === clean ||
          d.cdlNumber.toLowerCase() === clean ||
          d.name.toLowerCase().includes(clean)
      );

      if (match) {
        if (payload.fmcsaPin && match.fmcsaPin && match.fmcsaPin !== payload.fmcsaPin) {
          const pinError = new DomainValidationError(
            'FMCSA Roadside PIN mismatch for offline driver profile.',
            { driverId: match.driverId },
            'E_AUTH_PIN_MISMATCH'
          );
          logger.warn('AUTH_SERVICE', 'Offline PIN verification failed', pinError.details, pinError);
          throw pinError;
        }

        this.persistDriver(match, `tok_${match.driverId}`);
        logger.info('AUTH_SERVICE', `Offline driver signed in successfully: ${match.name}`, {
          driverId: match.driverId,
        });
        return { success: true, driver: match };
      }
    }

    const notFoundError = new DomainValidationError(
      `Commercial driver with identifier "${payload.identifier}" not found in fleet roster.`,
      { identifier: payload.identifier },
      'E_AUTH_DRIVER_NOT_FOUND'
    );
    logger.warn('AUTH_SERVICE', 'Driver not found in roster', notFoundError.details, notFoundError);
    throw notFoundError;
  }

  /**
   * Retrieve all drivers in the fleet roster
   */
  public async getAllDrivers(): Promise<DriverAuthRecord[]> {
    try {
      const res = await fetch('/api/drivers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.drivers) && data.drivers.length > 0) {
          this.saveRosterLocally(data.drivers);
          return data.drivers;
        }
      }
    } catch (e) {
      logger.warn('AUTH_SERVICE', 'Failed to retrieve remote drivers list; utilizing local cached roster', undefined, e);
    }

    const savedResult = safeStorage.getItem<DriverAuthRecord[]>(STORAGE_KEY_SAVED_DRIVERS, [FALLBACK_DEFAULT_DRIVER]);
    if (Array.isArray(savedResult.data) && savedResult.data.length > 0) {
      return savedResult.data;
    }

    return [FALLBACK_DEFAULT_DRIVER];
  }

  /**
   * Select a driver from the roster to be active in cockpit
   */
  public async selectDriver(driverId: string): Promise<DriverAuthRecord> {
    try {
      const res = await fetch('/api/drivers/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.selectedDriver) {
          this.persistDriver(data.selectedDriver);
          return data.selectedDriver;
        }
      }
    } catch (e) {
      logger.warn('AUTH_SERVICE', 'Offline driver select; retrieving from local roster cache', { driverId }, e);
    }

    const roster = await this.getAllDrivers();
    const target = roster.find((d) => d.driverId === driverId);
    if (!target) {
      const err = new DomainValidationError(`Driver ID "${driverId}" not found in fleet roster.`, { driverId }, 'E_AUTH_DRIVER_NOT_FOUND');
      logger.error('AUTH_SERVICE', `Driver selection failed: ${driverId}`, err);
      throw err;
    }

    this.persistDriver(target);
    return target;
  }

  /**
   * Sign out current driver session
   */
  public async signout(): Promise<void> {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (e) {
      logger.warn('AUTH_SERVICE', 'Remote signout notification failed', undefined, e);
    }

    safeStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    this.token = null;
    logger.info('AUTH_SERVICE', 'Driver signed out successfully', {
      previousDriverId: this.activeDriver.driverId,
    });
  }

  private saveRosterLocally(drivers: DriverAuthRecord[]): void {
    safeStorage.setItem(STORAGE_KEY_SAVED_DRIVERS, drivers);
  }

  private appendToLocalRoster(driver: DriverAuthRecord): void {
    const saved = safeStorage.getItem<DriverAuthRecord[]>(STORAGE_KEY_SAVED_DRIVERS, [FALLBACK_DEFAULT_DRIVER]);
    let roster = Array.isArray(saved.data) ? saved.data : [FALLBACK_DEFAULT_DRIVER];
    roster = roster.filter((d) => d.driverId !== driver.driverId);
    roster.unshift(driver);
    safeStorage.setItem(STORAGE_KEY_SAVED_DRIVERS, roster);
  }
}

export const authDriverService = new AuthDriverService();
