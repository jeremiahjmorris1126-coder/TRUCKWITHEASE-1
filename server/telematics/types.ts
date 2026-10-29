export interface NormalizedVehicle {
  id: string;
  unitNumber: string;
  vin: string;
  makeModel: string;
  provider: 'samsara' | 'motive' | 'geotab' | 'mock';
  status: 'DRIVING' | 'IDLE' | 'PARKED' | 'MAINTENANCE';
  speedMph: number;
  engineRpm: number;
  fuelPercent: number;
  defLevelPercent: number;
  odometerMiles: number;
  engineHours: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    heading: number;
    updatedAt: string;
  };
  diagnostics: {
    checkEngineLight: boolean;
    oilPressurePsi: number;
    coolantTempF: number;
    activeDtcCount: number;
    dtcCodes: string[];
  };
}

export interface NormalizedDriver {
  id: string;
  name: string;
  licenseNumber: string;
  dutyStatus: 'ON_DUTY' | 'DRIVING' | 'SLEEPER_BERTH' | 'OFF_DUTY';
  currentVehicleId?: string;
  hosClocks: {
    drivingRemainingMins: number;
    shiftRemainingMins: number;
    cycleRemainingMins: number;
    breakWindowMins: number;
  };
}

export interface TelematicsProviderAdapter {
  name: string;
  isConfigured(): boolean;
  getFleetVehicles(): Promise<NormalizedVehicle[]>;
  getVehicleById(id: string): Promise<NormalizedVehicle | null>;
  getDrivers(): Promise<NormalizedDriver[]>;
}
