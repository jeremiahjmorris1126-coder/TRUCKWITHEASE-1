/**
 * Feature Flags for TruckWithEase
 *
 * Phase 1 Safety & Honesty Controls:
 * All unverified, simulated, or hardware-mocked modules are OFF by default.
 * They can only be enabled explicitly in development via VITE_ENABLE_* flags.
 */

const isFlagEnabled = (key: string): boolean => {
  try {
    return (
      typeof import.meta !== 'undefined' &&
      Boolean((import.meta as any).env) &&
      (import.meta as any).env[key] === 'true'
    );
  } catch {
    return false;
  }
};

export const ENABLE_UNVERIFIED_HOS_CLOCKS: boolean = isFlagEnabled('VITE_ENABLE_HOS_CLOCKS');
export const ENABLE_ONE_TAP_DVIR: boolean = true;
export const ENABLE_TELEMETRY_10HZ: boolean = isFlagEnabled('VITE_ENABLE_TELEMETRY_10HZ');
export const ENABLE_BLUETOOTH_ELD: boolean = isFlagEnabled('VITE_ENABLE_BLUETOOTH_ELD');
export const ENABLE_HAPTICS_SCREEN: boolean = isFlagEnabled('VITE_ENABLE_HAPTICS_SCREEN');
export const ENABLE_QUANTUM_INDEX: boolean = isFlagEnabled('VITE_ENABLE_QUANTUM_INDEX');
export const ENABLE_MASTER_SYNC: boolean = isFlagEnabled('VITE_ENABLE_MASTER_SYNC');
export const ENABLE_NASA_ORBITAL_SPOTTER: boolean = isFlagEnabled('VITE_ENABLE_NASA_ORBITAL_SPOTTER');
export const ENABLE_QUANTUM_ALERTNESS_CARD: boolean = isFlagEnabled('VITE_ENABLE_QUANTUM_ALERTNESS_CARD');
export const ENABLE_MEMORY_QUANTUM_DIAGNOSTICS: boolean = isFlagEnabled('VITE_ENABLE_MEMORY_QUANTUM_DIAGNOSTICS');
export const ENABLE_DEV_SAMPLE_DATA: boolean = isFlagEnabled('VITE_ENABLE_DEV_SAMPLE_DATA');
