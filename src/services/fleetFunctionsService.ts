/**
 * TruckWithEase // Fleet Functions & Features Management Service
 * Configures active modules, customizable functions, and feature toggles.
 */

import { AppFunctionDefinition } from '../types';

export const DEFAULT_FUNCTION_DEFINITIONS: AppFunctionDefinition[] = [
  {
    id: 'night-hud',
    name: 'Night HUD Cockpit',
    description: 'High-contrast driver in-cab cockpit with real-time speed, live road vector corridors & alertness',
    category: 'COCKPIT_HUD',
    icon: 'dashboard',
    enabled: true,
    isCore: true,
    badge: 'CORE HUD',
  },
  {
    id: 'hos-clocks',
    name: 'HOS Clocks & Compliance',
    description: '70h / 8-day duty status timers, FMCSA § 395.8 attestation & instant PDF daily log export',
    category: 'COMPLIANCE',
    icon: 'timer',
    enabled: true,
    isCore: true,
    badge: '49 CFR § 395',
  },
  {
    id: 'radar-54b',
    name: 'FHWA Item 54B Low-Bridge Radar',
    description: 'Low bridge collision avoidance radar with laser buffer delta and dynamic bypass diverter routing',
    category: 'ROUTE_HAZARD',
    icon: 'radar',
    enabled: true,
    isCore: true,
    badge: 'FHWA 54B',
  },
  {
    id: 'hre',
    name: 'HRE (Highway Restriction Engine)',
    description: 'Real-time hazard route engine evaluating low clearances, steep grades, HazMat bans & weigh scales',
    category: 'ROUTE_HAZARD',
    icon: 'warning',
    enabled: true,
    isCore: true,
    badge: 'HRE SENTINEL',
  },
  {
    id: 'traxxas',
    name: 'Traxxas High-Frequency Telemetry',
    description: '10Hz GPS beacon, 3-axis shock accelerometer, CAN-bus ECM vitals & vehicle idle telemetry',
    category: 'TELEMETRY',
    icon: 'sensors',
    enabled: true,
    isCore: true,
    badge: '10Hz BEACON',
  },
  {
    id: 'master-mechanic',
    name: 'The Master Mechanic',
    description: 'J1939 CAN-Bus live diagnostics, SPN/FMI DTC scanner, component failure radar & kingpin articulation',
    category: 'DIAGNOSTICS',
    icon: 'build_circle',
    enabled: true,
    isCore: true,
    badge: 'J1939 250kbps',
  },
  {
    id: 'dispatch-eta',
    name: 'Dispatch Zero ($/Hr Yield)',
    description: 'Duty-hour load board yield rank ($/Hr), Google Maps corridor & dock door slot assignment',
    category: 'COCKPIT_HUD',
    icon: 'schedule_send',
    enabled: true,
    isCore: false,
    badge: 'DISPATCH ZERO',
  },
  {
    id: 'trip-planner',
    name: 'Trip Planner & Amenities',
    description: 'Real-time geolocation for upcoming truck stops (Love’s, Pilot), CAT scales & weigh stations',
    category: 'ROUTE_HAZARD',
    icon: 'route',
    enabled: true,
    isCore: false,
    badge: 'GEO-STOPS',
  },
  {
    id: 'vault',
    name: 'Security Vault & Federal DQF',
    description: '49 CFR § 390.31 statutory custodian records, cryptographic SHA-256 Merkle stamps & driver qualification files',
    category: 'COMPLIANCE',
    icon: 'lock',
    enabled: true,
    isCore: false,
    badge: '49 CFR § 390.31',
  },
  {
    id: 'fleet-expenses',
    name: 'Invoices & Fuel Accounting',
    description: 'WebstaurantStore freight invoices, IFTA diesel fuel receipts & expense calculations',
    category: 'COMPLIANCE',
    icon: 'receipt_long',
    enabled: true,
    isCore: false,
    badge: 'ACCOUNTING',
  },
  {
    id: 'haptics',
    name: 'Safety Steering Haptics',
    description: 'Tactile driver vibration warnings for lane drift, bridge warnings & critical collision risk',
    category: 'COCKPIT_HUD',
    icon: 'vibration',
    enabled: true,
    isCore: false,
    badge: 'TACTILE',
  },
  {
    id: 'ecosystem',
    name: 'Trust Hub & Carrier Vetting',
    description: 'Broker and shipper verification, payment terms & freight insurance validation',
    category: 'COMPLIANCE',
    icon: 'hub',
    enabled: true,
    isCore: false,
    badge: 'VETTING',
  },
  {
    id: 'telemetry',
    name: 'Engine Telemetry & Memory Tracker',
    description: 'CAN-Bus latency monitor, JavaScript heap memory garbage collector & performance tracker',
    category: 'TELEMETRY',
    icon: 'memory',
    enabled: true,
    isCore: false,
    badge: 'HEAP WATCH',
  },
  {
    id: 'quantum-index',
    name: 'Predictive Quantum Index',
    description: 'Multi-stop axle load annealing solver, predictive thermal physics & kinetic dissipation model',
    category: 'DIAGNOSTICS',
    icon: 'auto_awesome',
    enabled: true,
    isCore: false,
    badge: 'QUANTUM REST',
  },
  {
    id: 'the-g-o-a-t-',
    name: 'The G.O.A.T. (Deprecated)',
    description: 'Permanently replaced by The Master Mechanic protocol per system directives',
    category: 'DIAGNOSTICS',
    icon: 'cancel',
    enabled: false,
    isCore: false,
    badge: 'DEPRECATED',
  },
];

const STORAGE_KEY_FUNCTIONS = 'truck_customized_functions';

class FleetFunctionsService {
  private functions: AppFunctionDefinition[] = [...DEFAULT_FUNCTION_DEFINITIONS];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FUNCTIONS);
      if (saved) {
        const parsed: Record<string, boolean> = JSON.parse(saved);
        this.functions = this.functions.map((fn) => ({
          ...fn,
          enabled: fn.id === 'the-g-o-a-t-' ? false : parsed[fn.id] !== undefined ? Boolean(parsed[fn.id]) : fn.enabled,
        }));
      }
    } catch (e) {}
  }

  public async fetchCatalog(): Promise<AppFunctionDefinition[]> {
    try {
      const res = await fetch('/api/fleet/functions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.functions)) {
          this.functions = data.functions;
          return data.functions;
        }
      }
    } catch (e) {
      console.warn('Using local functions catalog:', e);
    }
    return this.functions;
  }

  public getFunctions(): AppFunctionDefinition[] {
    return this.functions;
  }

  public async updateToggles(toggles: Record<string, boolean>): Promise<{
    activeFunctions: string[];
    disabledFunctions: string[];
  }> {
    // Enforce rule: the-g-o-a-t- is always false
    toggles['the-g-o-a-t-'] = false;

    // Apply to local state
    this.functions = this.functions.map((fn) => ({
      ...fn,
      enabled: fn.id === 'the-g-o-a-t-' ? false : toggles[fn.id] !== undefined ? Boolean(toggles[fn.id]) : fn.enabled,
    }));

    if (typeof window !== 'undefined') {
      try {
        const obj: Record<string, boolean> = {};
        this.functions.forEach((f) => {
          obj[f.id] = f.enabled;
        });
        localStorage.setItem(STORAGE_KEY_FUNCTIONS, JSON.stringify(obj));
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/fleet/functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledModules: toggles }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          activeFunctions: data.activeFunctions,
          disabledFunctions: data.disabledFunctions,
        };
      }
    } catch (e) {}

    const activeFunctions = this.functions.filter((f) => f.enabled).map((f) => f.id);
    const disabledFunctions = this.functions.filter((f) => !f.enabled).map((f) => f.id);
    return { activeFunctions, disabledFunctions };
  }
}

export const fleetFunctionsService = new FleetFunctionsService();
