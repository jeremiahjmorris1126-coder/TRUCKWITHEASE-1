import { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

const MOCK_GEOTAB_VEHICLES: NormalizedVehicle[] = [
  {
    id: 'geo-trk-301',
    unitNumber: 'UNIT-301',
    vin: '3AKJHHDR5LS987456',
    makeModel: '2025 Volvo VNL 860',
    provider: 'geotab',
    status: 'PARKED',
    speedMph: 0,
    engineRpm: 0,
    fuelPercent: 91,
    defLevelPercent: 88,
    odometerMiles: 42100,
    engineHours: 980,
    location: {
      latitude: 41.8781,
      longitude: -87.6298,
      address: 'Chicago South Freight Yard, IL',
      heading: 180,
      updatedAt: new Date().toISOString(),
    },
    diagnostics: {
      checkEngineLight: false,
      oilPressurePsi: 0,
      coolantTempF: 75,
      activeDtcCount: 0,
      dtcCodes: [],
    },
  },
];

export class GeotabAdapter implements TelematicsProviderAdapter {
  name = 'Geotab';

  isConfigured(): boolean {
    return Boolean(process.env.GEOTAB_SESSION_ID || process.env.GEOTAB_API_USER);
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    return MOCK_GEOTAB_VEHICLES;
  }

  async getVehicleById(id: string): Promise<NormalizedVehicle | null> {
    return MOCK_GEOTAB_VEHICLES.find(v => v.id === id || v.unitNumber === id) || null;
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    return [];
  }
}
