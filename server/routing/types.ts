export type RoutingProviderType = 'trimble' | 'tomtom' | 'mock' | 'google';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  coords?: RouteCoordinates;
  provider: 'google' | 'mock';
}

export interface RouteCoordinates {
  lat: number;
  lon: number;
}

export interface RouteStop {
  coords: RouteCoordinates;
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export type HazmatClassType =
  | 'None'
  | 'General'
  | 'Explosive'
  | 'Flammable'
  | 'Radioactive'
  | 'Corrosive'
  | 'Inhalant'
  | 'Caustic';

export interface CommercialVehicleProfile {
  heightFt: number;           // e.g. 13.5 (13' 6") - Valid: 6.0 to 16.0 ft
  weightLbs: number;          // e.g. 80000 - Valid: 5,000 to 160,000 lbs
  lengthFt: number;           // e.g. 53 - Valid: 10.0 to 120.0 ft
  widthFt: number;            // e.g. 8.5 - Valid: 6.0 to 12.0 ft
  axles: number;              // e.g. 5 - Valid: 2 to 13
  isHazmat?: boolean;
  hazmatClass?: HazmatClassType;
  avoidTolls?: boolean;
  routingPreference?: 'PRACTICAL' | 'SHORTEST' | 'FASTEST';
}

export interface StoredVehicleProfileDoc extends CommercialVehicleProfile {
  id: string;                 // e.g. "profile_FLEET123_DRIVER456"
  fleetId: string;            // Required for fleet isolation
  driverId: string;           // Driver UID
  unitNumber?: string;        // e.g. "TRACTOR-101"
  updatedAt: string;
}

export interface TurnByTurnStep {
  stepIndex: number;
  instruction: string;
  distanceMiles: number;
  durationMinutes: number;
  streetName?: string;
}

export interface RouteLegSummary {
  legIndex: number;
  distanceMiles: number;
  driveTimeMinutes: number;
  tollDistanceMiles?: number | null;
}

export interface BridgeClearanceWarning {
  lat: number;
  lon: number;
  clearanceFt: number;
  bufferDeltaInches: number;
  structureName: string;
  isCompliant: boolean;
  warningSeverity: 'NONE' | 'ADVISORY' | 'CRITICAL';
}

export interface RouteOptions {
  avoidTolls?: boolean;
  routingPreference?: 'PRACTICAL' | 'SHORTEST' | 'FASTEST';
  traffic?: boolean;
  optimizeWaypoints?: boolean;
  mode?: 'planning' | 'navigation';
}

export interface NormalizedRouteResult {
  routeId: string;
  provider: RoutingProviderType;
  mock: boolean;
  fallbackTriggered: boolean;
  cached: boolean;
  totalDistanceMiles: number;
  totalTimeMinutes: number;
  /** Toll-road miles reported by the provider; null when the provider did not report them. */
  tollDistanceMiles: number | null;
  /** Toll cost reported by the provider (PC*MILER); null when not reported. Never estimated. */
  estimatedTollCostUsd: number | null;
  summaryPathCoords: [number, number][]; // [lat, lon][]
  legs: RouteLegSummary[];
  turnByTurnSteps: TurnByTurnStep[];
  bridgeClearanceWarnings: BridgeClearanceWarning[];
  truckRestrictionsApplied: boolean;
  trafficDelayMinutes?: number;
  calculatedAt: string;
}

export interface MileageResult {
  origin: string;
  destination: string;
  distanceMiles: number;
  durationMinutes: number;
  tollMiles?: number | null;
  provider: RoutingProviderType;
  mock: boolean;
  calculatedAt: string;
}

export interface GeocodeResult {
  query: string;
  formattedAddress: string;
  coords: RouteCoordinates;
  confidence?: number;
  provider: RoutingProviderType;
}

export interface RoutingProvider {
  providerName: RoutingProviderType;
  isConfigured(): boolean;
  calculateRoute(
    origin: RouteStop,
    destination: RouteStop,
    waypoints?: RouteStop[],
    vehicleProfile?: CommercialVehicleProfile,
    options?: RouteOptions
  ): Promise<NormalizedRouteResult>;
  getMileage(
    origin: RouteStop,
    destination: RouteStop,
    waypoints?: RouteStop[],
    vehicleProfile?: CommercialVehicleProfile
  ): Promise<MileageResult>;
  geocode(query: string): Promise<GeocodeResult>;
}

// Backward compatibility alias for existing code
export type RoutingEngineAdapter = RoutingProvider;

export const DEFAULT_COMMERCIAL_PROFILE: CommercialVehicleProfile = {
  heightFt: 13.5,
  weightLbs: 80000,
  lengthFt: 53.0,
  widthFt: 8.5,
  axles: 5,
  isHazmat: false,
  hazmatClass: 'None',
  avoidTolls: false,
  routingPreference: 'PRACTICAL',
};

const VALID_HAZMAT_CLASSES = new Set([
  'None',
  'General',
  'Explosive',
  'Flammable',
  'Radioactive',
  'Corrosive',
  'Inhalant',
  'Caustic',
]);

/**
 * Validates vehicle dimensions and parameters. Rejects impossible or illegal values.
 */
export function validateVehicleProfile(input: any): {
  valid: boolean;
  errors: string[];
  sanitized: CommercialVehicleProfile;
} {
  const errors: string[] = [];

  const heightFt = typeof input?.heightFt === 'number' ? input.heightFt : DEFAULT_COMMERCIAL_PROFILE.heightFt;
  if (heightFt < 6.0 || heightFt > 16.5) {
    errors.push(`heightFt (${heightFt}) is out of legal range [6.0, 16.5] ft`);
  }

  const weightLbs = typeof input?.weightLbs === 'number' ? input.weightLbs : DEFAULT_COMMERCIAL_PROFILE.weightLbs;
  if (weightLbs < 4000 || weightLbs > 160000) {
    errors.push(`weightLbs (${weightLbs}) is out of legal range [4,000, 160,000] lbs`);
  }

  const lengthFt = typeof input?.lengthFt === 'number' ? input.lengthFt : DEFAULT_COMMERCIAL_PROFILE.lengthFt;
  if (lengthFt < 10.0 || lengthFt > 120.0) {
    errors.push(`lengthFt (${lengthFt}) is out of legal range [10.0, 120.0] ft`);
  }

  const widthFt = typeof input?.widthFt === 'number' ? input.widthFt : DEFAULT_COMMERCIAL_PROFILE.widthFt;
  if (widthFt < 5.0 || widthFt > 12.0) {
    errors.push(`widthFt (${widthFt}) is out of legal range [5.0, 12.0] ft`);
  }

  const axles = typeof input?.axles === 'number' ? Math.round(input.axles) : DEFAULT_COMMERCIAL_PROFILE.axles;
  if (axles < 2 || axles > 13) {
    errors.push(`axles (${axles}) is out of legal range [2, 13]`);
  }

  let hazmatClass: HazmatClassType = 'None';
  if (input?.hazmatClass) {
    if (!VALID_HAZMAT_CLASSES.has(input.hazmatClass)) {
      errors.push(`Invalid hazmatClass: "${input.hazmatClass}". Valid classes: None, General, Explosive, Flammable, Radioactive, Corrosive, Inhalant, Caustic.`);
    } else {
      hazmatClass = input.hazmatClass as HazmatClassType;
    }
  }

  const isHazmat = Boolean(input?.isHazmat || (hazmatClass !== 'None'));
  const avoidTolls = Boolean(input?.avoidTolls);
  const routingPreference = ['PRACTICAL', 'SHORTEST', 'FASTEST'].includes(input?.routingPreference)
    ? input.routingPreference
    : 'PRACTICAL';

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      heightFt: parseFloat(heightFt.toFixed(2)),
      weightLbs: Math.round(weightLbs),
      lengthFt: parseFloat(lengthFt.toFixed(1)),
      widthFt: parseFloat(widthFt.toFixed(2)),
      axles,
      isHazmat,
      hazmatClass,
      avoidTolls,
      routingPreference,
    },
  };
}
