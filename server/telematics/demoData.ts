import { NormalizedDriver, NormalizedVehicle, TelematicsProviderId } from './types';

/**
 * Demo fixtures for local development and automated tests ONLY.
 * Served only when TELEMATICS_DEMO_DATA=true AND NODE_ENV !== 'production'.
 * Every record is flagged `demo: true` so it can never be mistaken for ELD data.
 */

export function isDemoModeEnabled(): boolean {
  return process.env.TELEMATICS_DEMO_DATA === 'true' && process.env.NODE_ENV !== 'production';
}

const emptyDiagnostics = { checkEngineLight: false, oilPressurePsi: null, coolantTempF: null, activeDtcCount: 0, dtcCodes: [] as string[] };

function vehicle(provider: TelematicsProviderId, id: string, unitNumber: string, lat: number, lon: number, speedMph: number): NormalizedVehicle {
  return {
    id,
    unitNumber,
    vin: null,
    makeModel: 'Demo tractor',
    provider,
    demo: true,
    status: speedMph > 3 ? 'DRIVING' : 'PARKED',
    speedMph,
    engineRpm: null,
    fuelPercent: null,
    defLevelPercent: null,
    odometerMiles: null,
    engineHours: null,
    location: { latitude: lat, longitude: lon, address: 'Demo location', heading: 0, updatedAt: new Date().toISOString() },
    diagnostics: { ...emptyDiagnostics },
  };
}

function driver(provider: TelematicsProviderId, id: string, name: string, vehicleId: string): NormalizedDriver {
  return {
    id,
    name,
    provider,
    demo: true,
    licenseNumber: null,
    dutyStatus: 'DRIVING',
    currentVehicleId: vehicleId,
    hosClocks: { drivingRemainingMins: 385, shiftRemainingMins: 540, cycleRemainingMins: 2180, breakWindowMins: 145 },
    hosAsOf: new Date().toISOString(),
  };
}

export const DEMO_VEHICLES: Record<TelematicsProviderId, NormalizedVehicle[]> = {
  samsara: [
    vehicle('samsara', 'sam-trk-101', 'UNIT-101', 38.627, -90.1994, 64.5),
    vehicle('samsara', 'sam-trk-102', 'UNIT-102', 39.7684, -86.1581, 0),
  ],
  motive: [vehicle('motive', 'mot-trk-201', 'UNIT-201', 32.7767, -96.797, 68.2)],
  geotab: [vehicle('geotab', 'geo-trk-301', 'UNIT-301', 41.8781, -87.6298, 0)],
};

export const DEMO_DRIVERS: Record<TelematicsProviderId, NormalizedDriver[]> = {
  samsara: [driver('samsara', 'sam-drv-01', 'Marcus Vance', 'sam-trk-101')],
  motive: [driver('motive', 'mot-drv-02', 'Elena Rostova', 'mot-trk-201')],
  geotab: [],
};
