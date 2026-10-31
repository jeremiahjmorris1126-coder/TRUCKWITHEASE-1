/**
 * TruckWithEase // Commercial Driver Auth & Fleet Roster Service
 * Manages Driver Sign-Up Sheet, Sign-In, Session, and Roster Selection.
 */

import { DriverAuthRecord, DriverSignUpPayload, DriverSignInPayload } from '../types';

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
  private isInitialized: boolean = false;

  constructor() {
    this.activeDriver = this.loadPersistedDriver();
    this.token = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_AUTH_TOKEN) : null;
  }

  private loadPersistedDriver(): DriverAuthRecord {
    if (typeof window === 'undefined') return FALLBACK_DEFAULT_DRIVER;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_DRIVER);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read cached driver:', e);
    }
    return FALLBACK_DEFAULT_DRIVER;
  }

  private persistDriver(driver: DriverAuthRecord, token?: string) {
    this.activeDriver = driver;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_DRIVER, JSON.stringify(driver));
        if (token) {
          this.token = token;
          localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
        }
      } catch (e) {
        console.warn('Failed to cache driver locally:', e);
      }
    }
    this.notifyListeners(driver);
  }

  public subscribe(listener: DriverChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeDriver);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(driver: DriverAuthRecord) {
    this.listeners.forEach((listener) => {
      try {
        listener(driver);
      } catch (err) {
        console.error('Error in driver listener:', err);
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
      console.warn('Using local session cache:', e);
    }
    return { authenticated: true, driver: this.activeDriver };
  }

  /**
   * Complete Sign-Up Sheet: Register a new driver with fleet credentials & preferences
   */
  public async signup(payload: DriverSignUpPayload): Promise<{ success: boolean; driver: DriverAuthRecord; message: string }> {
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
          return {
            success: true,
            driver: data.driver,
            message: data.message || `Driver ${data.driver.name} enrolled and signed in.`,
          };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Sign-up failed with status ${res.status}`);
      }
    } catch (err) {
      console.warn('Offline fallback sign-up:', err);
    }

    // Client-side fallback if server unreachable
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
      message: `Driver ${fallbackDriver.name} enrolled and signed in.`,
    };
  }

  /**
   * Driver Sign-In
   */
  public async signin(payload: DriverSignInPayload): Promise<{ success: boolean; driver: DriverAuthRecord }> {
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
          return { success: true, driver: data.driver };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Sign-in failed.');
      }
    } catch (err) {
      console.warn('Sign-in network error:', err);
    }

    // Local lookup fallback
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
      this.persistDriver(match, `tok_${match.driverId}`);
      return { success: true, driver: match };
    }

    throw new Error(`Driver with credentials "${payload.identifier}" not found in roster.`);
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
      console.warn('Using cached fleet roster:', e);
    }

    // Load from local storage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SAVED_DRIVERS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
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
      console.warn('Offline driver select:', e);
    }

    const roster = await this.getAllDrivers();
    const target = roster.find((d) => d.driverId === driverId);
    if (!target) {
      throw new Error(`Driver ID ${driverId} not found.`);
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
    } catch (e) {}

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    }
    this.token = null;
  }

  private saveRosterLocally(drivers: DriverAuthRecord[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_DRIVERS, JSON.stringify(drivers));
    } catch (e) {}
  }

  private appendToLocalRoster(driver: DriverAuthRecord) {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_DRIVERS);
      let roster: DriverAuthRecord[] = saved ? JSON.parse(saved) : [FALLBACK_DEFAULT_DRIVER];
      roster = roster.filter((d) => d.driverId !== driver.driverId);
      roster.unshift(driver);
      localStorage.setItem(STORAGE_KEY_SAVED_DRIVERS, JSON.stringify(roster));
    } catch (e) {}
  }
}

export const authDriverService = new AuthDriverService();
