import { GeotabAdapter } from './geotabAdapter';
import { MotiveAdapter } from './motiveAdapter';
import { SamsaraAdapter } from './samsaraAdapter';
import { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

export class TelematicsManager {
  private adapters: Map<string, TelematicsProviderAdapter> = new Map();

  constructor() {
    this.adapters.set('samsara', new SamsaraAdapter());
    this.adapters.set('motive', new MotiveAdapter());
    this.adapters.set('geotab', new GeotabAdapter());
  }

  getAdapterStatus(): Record<string, { configured: boolean; mode: string }> {
    const status: Record<string, { configured: boolean; mode: string }> = {};
    for (const [key, adapter] of this.adapters.entries()) {
      const configured = adapter.isConfigured();
      status[key] = {
        configured,
        mode: configured ? 'LIVE_API' : 'DISCONNECTED',
      };
    }
    return status;
  }

  async getAllVehicles(): Promise<NormalizedVehicle[]> {
    const results: NormalizedVehicle[] = [];
    for (const [name, adapter] of this.adapters.entries()) {
      try {
        const vehicles = await adapter.getFleetVehicles();
        results.push(...vehicles);
      } catch (err) {
        console.error(`[TelematicsManager] Error fetching from ${name}:`, err);
      }
    }
    return results;
  }

  async getAllDrivers(): Promise<NormalizedDriver[]> {
    const results: NormalizedDriver[] = [];
    for (const [name, adapter] of this.adapters.entries()) {
      try {
        const drivers = await adapter.getDrivers();
        results.push(...drivers);
      } catch (err) {
        console.error(`[TelematicsManager] Error fetching drivers from ${name}:`, err);
      }
    }
    return results;
  }

  async getVehicle(id: string): Promise<NormalizedVehicle | null> {
    for (const adapter of this.adapters.values()) {
      const vehicle = await adapter.getVehicleById(id);
      if (vehicle) return vehicle;
    }
    return null;
  }
}

export const telematicsManager = new TelematicsManager();
