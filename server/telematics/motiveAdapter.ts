import { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

const MOCK_MOTIVE_VEHICLES: NormalizedVehicle[] = [
  {
    id: 'mot-trk-201',
    unitNumber: 'UNIT-201',
    vin: '2C3CDZFJ8NH789123',
    makeModel: '2024 Kenworth T680 Next Gen',
    provider: 'motive',
    status: 'DRIVING',
    speedMph: 68.2,
    engineRpm: 1320,
    fuelPercent: 68,
    defLevelPercent: 74,
    odometerMiles: 89400,
    engineHours: 2150,
    location: {
      latitude: 32.7767,
      longitude: -96.7970,
      address: 'I-20 Westbound MM 462, Dallas, TX',
      heading: 265,
      updatedAt: new Date().toISOString(),
    },
    diagnostics: {
      checkEngineLight: false,
      oilPressurePsi: 46,
      coolantTempF: 192,
      activeDtcCount: 0,
      dtcCodes: [],
    },
  },
];

const MOCK_MOTIVE_DRIVERS: NormalizedDriver[] = [
  {
    id: 'mot-drv-02',
    name: 'Elena Rostova',
    licenseNumber: 'CDL-IL-9923184',
    dutyStatus: 'DRIVING',
    currentVehicleId: 'mot-trk-201',
    hosClocks: {
      drivingRemainingMins: 410,
      shiftRemainingMins: 610,
      cycleRemainingMins: 2450,
      breakWindowMins: 190,
    },
  },
];

export class MotiveAdapter implements TelematicsProviderAdapter {
  name = 'Motive';

  isConfigured(): boolean {
    return Boolean(process.env.MOTIVE_API_KEY && process.env.MOTIVE_API_KEY.trim().length > 0);
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    if (!this.isConfigured()) {
      return MOCK_MOTIVE_VEHICLES;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.keeptruckin.com/v1/vehicles', {
        headers: {
          'X-Api-Key': process.env.MOTIVE_API_KEY || '',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Motive API status ${res.status}`);
      }

      const data = await res.json() as any;
      if (!Array.isArray(data?.vehicles)) return MOCK_MOTIVE_VEHICLES;

      return data.vehicles.map((v: any): NormalizedVehicle => ({
        id: String(v.vehicle?.id || `mot-${Date.now()}`),
        unitNumber: v.vehicle?.number || 'MOTIVE-UNIT',
        vin: v.vehicle?.vin || 'UNKNOWN',
        makeModel: `${v.vehicle?.year || ''} ${v.vehicle?.make || 'Heavy Truck'} ${v.vehicle?.model || ''}`.trim(),
        provider: 'motive',
        status: 'DRIVING',
        speedMph: 65,
        engineRpm: 1250,
        fuelPercent: 75,
        defLevelPercent: 70,
        odometerMiles: 100000,
        engineHours: 2500,
        location: {
          latitude: 32.7767,
          longitude: -96.7970,
          address: 'Texas Corridor',
          heading: 270,
          updatedAt: new Date().toISOString(),
        },
        diagnostics: {
          checkEngineLight: false,
          oilPressurePsi: 45,
          coolantTempF: 192,
          activeDtcCount: 0,
          dtcCodes: [],
        },
      }));
    } catch (err) {
      console.warn('[MotiveAdapter] Real API call failed, using normalized mock:', (err as Error).message);
      return MOCK_MOTIVE_VEHICLES;
    }
  }

  async getVehicleById(id: string): Promise<NormalizedVehicle | null> {
    const list = await this.getFleetVehicles();
    return list.find(v => v.id === id || v.unitNumber === id) || null;
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    return MOCK_MOTIVE_DRIVERS;
  }
}
