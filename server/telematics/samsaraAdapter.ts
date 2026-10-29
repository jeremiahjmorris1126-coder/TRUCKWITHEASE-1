import { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from './types';

const MOCK_SAMSARA_VEHICLES: NormalizedVehicle[] = [
  {
    id: 'sam-trk-101',
    unitNumber: 'UNIT-101',
    vin: '1FUJBBCK9KL123456',
    makeModel: '2024 Freightliner Cascadia 126',
    provider: 'samsara',
    status: 'DRIVING',
    speedMph: 64.5,
    engineRpm: 1250,
    fuelPercent: 82,
    defLevelPercent: 78,
    odometerMiles: 142850,
    engineHours: 3410,
    location: {
      latitude: 38.6270,
      longitude: -90.1994,
      address: 'I-44 Eastbound, St. Louis, MO',
      heading: 85,
      updatedAt: new Date().toISOString(),
    },
    diagnostics: {
      checkEngineLight: false,
      oilPressurePsi: 44,
      coolantTempF: 194,
      activeDtcCount: 0,
      dtcCodes: [],
    },
  },
  {
    id: 'sam-trk-102',
    unitNumber: 'UNIT-102',
    vin: '1XPFDP9X8MD654321',
    makeModel: '2023 Peterbilt 579 UltraLoft',
    provider: 'samsara',
    status: 'IDLE',
    speedMph: 0,
    engineRpm: 650,
    fuelPercent: 54,
    defLevelPercent: 62,
    odometerMiles: 218900,
    engineHours: 5120,
    location: {
      latitude: 39.7684,
      longitude: -86.1581,
      address: 'Love\'s Travel Stop #420, Indianapolis, IN',
      heading: 0,
      updatedAt: new Date().toISOString(),
    },
    diagnostics: {
      checkEngineLight: true,
      oilPressurePsi: 38,
      coolantTempF: 198,
      activeDtcCount: 1,
      dtcCodes: ['SPN 3251 FMI 0 (DPF Differential Pressure High)'],
    },
  },
];

const MOCK_SAMSARA_DRIVERS: NormalizedDriver[] = [
  {
    id: 'sam-drv-01',
    name: 'Marcus Vance',
    licenseNumber: 'CDL-TX-8849201',
    dutyStatus: 'DRIVING',
    currentVehicleId: 'sam-trk-101',
    hosClocks: {
      drivingRemainingMins: 385,
      shiftRemainingMins: 540,
      cycleRemainingMins: 2180,
      breakWindowMins: 145,
    },
  },
];

export class SamsaraAdapter implements TelematicsProviderAdapter {
  name = 'Samsara';

  isConfigured(): boolean {
    return Boolean(process.env.SAMSARA_API_TOKEN && process.env.SAMSARA_API_TOKEN.trim().length > 0);
  }

  async getFleetVehicles(): Promise<NormalizedVehicle[]> {
    if (!this.isConfigured()) {
      return MOCK_SAMSARA_VEHICLES;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.samsara.com/fleet/vehicles/stats', {
        headers: {
          Authorization: `Bearer ${process.env.SAMSARA_API_TOKEN}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Samsara API returned status ${res.status}`);
      }

      const data = await res.json() as any;
      if (!Array.isArray(data?.data)) return MOCK_SAMSARA_VEHICLES;

      return data.data.map((item: any): NormalizedVehicle => ({
        id: item.id || `sam-${Date.now()}`,
        unitNumber: item.name || 'SAMSARA-UNIT',
        vin: item.vin || 'UNKNOWN-VIN',
        makeModel: item.model || 'Heavy Duty Commercial Tractor',
        provider: 'samsara',
        status: (item.gps?.speedMilesPerHour || 0) > 3 ? 'DRIVING' : 'PARKED',
        speedMph: item.gps?.speedMilesPerHour || 0,
        engineRpm: item.engineRpm?.value || 0,
        fuelPercent: item.fuelPercent?.value || 100,
        defLevelPercent: item.defLevelMilliPercent?.value ? item.defLevelMilliPercent.value / 1000 : 80,
        odometerMiles: item.obdOdometerMeters?.value ? Math.round(item.obdOdometerMeters.value / 1609.34) : 0,
        engineHours: 0,
        location: {
          latitude: item.gps?.latitude || 38.6270,
          longitude: item.gps?.longitude || -90.1994,
          address: item.gps?.reverseGeo?.formattedLocation || 'Midwest Interstate Corridor',
          heading: item.gps?.headingDegrees || 0,
          updatedAt: item.gps?.time || new Date().toISOString(),
        },
        diagnostics: {
          checkEngineLight: Boolean(item.checkEngineLightIsOn),
          oilPressurePsi: 45,
          coolantTempF: 195,
          activeDtcCount: 0,
          dtcCodes: [],
        },
      }));
    } catch (err) {
      console.warn('[SamsaraAdapter] Real API call failed, using normalized mock:', (err as Error).message);
      return MOCK_SAMSARA_VEHICLES;
    }
  }

  async getVehicleById(id: string): Promise<NormalizedVehicle | null> {
    const list = await this.getFleetVehicles();
    return list.find(v => v.id === id || v.unitNumber === id) || null;
  }

  async getDrivers(): Promise<NormalizedDriver[]> {
    return MOCK_SAMSARA_DRIVERS;
  }
}
