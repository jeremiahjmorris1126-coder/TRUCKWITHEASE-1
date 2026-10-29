import {
  BridgeClearanceWarning,
  CommercialVehicleProfile,
  DEFAULT_COMMERCIAL_PROFILE,
  GeocodeResult,
  MileageResult,
  NormalizedRouteResult,
  RouteCoordinates,
  RouteOptions,
  RouteStop,
  RoutingProvider,
  TurnByTurnStep,
  validateVehicleProfile,
} from '../types';

interface KnownBridgeHazard {
  lat: number;
  lon: number;
  clearanceFt: number;
  structureName: string;
}

const KNOWN_FHWA_54B_BRIDGES: KnownBridgeHazard[] = [
  { lat: 38.627, lon: -90.199, clearanceFt: 13.5, structureName: 'I-44 Commercial Rail Overpass (St. Louis, MO)' },
  { lat: 41.921, lon: -87.697, clearanceFt: 12.67, structureName: 'Stave St Low Rail Viaduct (Chicago, IL)' },
  { lat: 43.085, lon: -76.177, clearanceFt: 10.75, structureName: 'Onondaga Lake Pkwy Railroad Bridge (Syracuse, NY)' },
  { lat: 42.351, lon: -71.071, clearanceFt: 10.0, structureName: 'Storrow Drive Footbridge (Boston, MA)' },
  { lat: 39.100, lon: -94.590, clearanceFt: 13.25, structureName: '12th Street Lower Viaduct (Kansas City, MO)' },
];

function haversineMiles(coord1: RouteCoordinates, coord2: RouteCoordinates): number {
  const R = 3958.8;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lon - coord1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class MockRoutingProvider implements RoutingProvider {
  public readonly providerName = 'mock' as const;

  isConfigured(): boolean {
    return true;
  }

  /**
   * Validate and geocode stop before routing, rejecting invalid queries or out-of-bounds coordinates.
   */
  public async validateAndResolveStop(
    stop: RouteStop,
    stopLabel: string = 'Stop'
  ): Promise<{ coords: RouteCoordinates; label: string }> {
    if (!stop) {
      throw new Error(`Invalid stop: ${stopLabel} is undefined`);
    }

    if (stop.label && (stop.label.includes('INVALID_STOP') || stop.label.includes('NONEXISTENT_LOCATION'))) {
      throw new Error(`Invalid stop: Unable to validate or geocode stop "${stop.label}"`);
    }

    if (stop.coords && typeof stop.coords.lat === 'number' && typeof stop.coords.lon === 'number') {
      const { lat, lon } = stop.coords;
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid stop coordinates for ${stopLabel} ("${stop.label || 'unknown'}"): NaN detected`);
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error(
          `Invalid stop coordinates for ${stopLabel} ("${stop.label || 'unknown'}"): latitude must be in [-90, 90] and longitude in [-180, 180] (got ${lat}, ${lon})`
        );
      }

      if (lat === 0 && lon === 0) {
        if (stop.label && stop.label.trim().length > 0) {
          const geo = await this.geocode(stop.label);
          return { coords: geo.coords, label: geo.formattedAddress || stop.label };
        }
        throw new Error(`Invalid stop: ${stopLabel} specifies (0,0) without an address label`);
      }

      return { coords: { lat, lon }, label: stop.label || `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
    }

    const query = stop.label || [stop.street, stop.city, stop.state, stop.postalCode].filter(Boolean).join(', ');
    if (!query || query.trim().length === 0) {
      throw new Error(`Invalid stop: ${stopLabel} must contain either valid coordinates or address text`);
    }

    const geo = await this.geocode(query);
    return { coords: geo.coords, label: geo.formattedAddress || query };
  }

  /**
   * Optimize intermediate waypoint sequencing while keeping the final destination fixed.
   */
  private optimizeIntermediateWaypoints(
    origin: RouteCoordinates,
    waypoints: { coords: RouteCoordinates; label: string }[],
    destination: RouteCoordinates
  ): { coords: RouteCoordinates; label: string }[] {
    if (waypoints.length <= 1) return waypoints;

    const remaining = [...waypoints];
    const optimized: { coords: RouteCoordinates; label: string }[] = [];
    let current = origin;

    while (remaining.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const d = haversineMiles(current, remaining[i].coords);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = i;
        }
      }

      const [nextStop] = remaining.splice(closestIdx, 1);
      optimized.push(nextStop);
      current = nextStop.coords;
    }

    return optimized;
  }

  async calculateRoute(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile,
    options?: RouteOptions
  ): Promise<NormalizedRouteResult> {
    // Step 1: Validate and geocode each stop
    const resolvedOrigin = await this.validateAndResolveStop(origin, 'Origin');
    const resolvedDestination = await this.validateAndResolveStop(destination, 'Destination');
    const resolvedWaypoints: { coords: RouteCoordinates; label: string }[] = [];
    for (let i = 0; i < waypoints.length; i++) {
      resolvedWaypoints.push(await this.validateAndResolveStop(waypoints[i], `Waypoint ${i + 1}`));
    }

    // Step 2: Validate vehicle profile
    const validation = validateVehicleProfile(vehicleProfile || DEFAULT_COMMERCIAL_PROFILE);
    if (!validation.valid) {
      throw new Error(`Invalid vehicle profile: ${validation.errors.join(', ')}`);
    }
    const v = validation.sanitized;

    // Step 3: Optional stop optimization while keeping final destination fixed
    let finalWaypoints = resolvedWaypoints;
    if (options?.optimizeWaypoints && resolvedWaypoints.length > 1) {
      finalWaypoints = this.optimizeIntermediateWaypoints(
        resolvedOrigin.coords,
        resolvedWaypoints,
        resolvedDestination.coords
      );
    }

    const stops: RouteCoordinates[] = [
      resolvedOrigin.coords,
      ...finalWaypoints.map((w) => w.coords),
      resolvedDestination.coords,
    ];

    let totalDirectMiles = 0;
    const legs = [];
    const interpolatedCoords: [number, number][] = [];
    const turnByTurnSteps: TurnByTurnStep[] = [];
    let stepCount = 1;

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const direct = haversineMiles(from, to);
      const truckLegMiles = parseFloat((direct * 1.18).toFixed(1));
      const legMinutes = Math.round((truckLegMiles / 58) * 60);

      totalDirectMiles += truckLegMiles;
      legs.push({
        legIndex: i,
        distanceMiles: truckLegMiles,
        driveTimeMinutes: legMinutes,
        tollDistanceMiles: (options?.avoidTolls || v.avoidTolls) ? 0 : parseFloat((truckLegMiles * 0.22).toFixed(1)),
      });

      turnByTurnSteps.push({
        stepIndex: stepCount++,
        instruction: `Merge onto Commercial Freight Interstate corridor toward stop ${i + 1}`,
        distanceMiles: parseFloat((truckLegMiles * 0.85).toFixed(1)),
        durationMinutes: Math.round(legMinutes * 0.8),
        streetName: 'Interstate Freight Corridor',
      });
      turnByTurnSteps.push({
        stepIndex: stepCount++,
        instruction: `Take designated commercial vehicle terminal access road`,
        distanceMiles: parseFloat((truckLegMiles * 0.15).toFixed(1)),
        durationMinutes: Math.round(legMinutes * 0.2),
        streetName: 'Freight Logistics Blvd',
      });

      for (let step = 0; step <= 10; step++) {
        const ratio = step / 10;
        const lat = parseFloat((from.lat + (to.lat - from.lat) * ratio).toFixed(5));
        const lon = parseFloat((from.lon + (to.lon - from.lon) * ratio).toFixed(5));
        interpolatedCoords.push([lat, lon]);
      }
    }

    const totalDistanceMiles = parseFloat(totalDirectMiles.toFixed(1));
    const totalTimeMinutes = legs.reduce((acc, l) => acc + l.driveTimeMinutes, 0);
    const tollDistanceMiles = (options?.avoidTolls || v.avoidTolls) ? 0 : parseFloat((totalDistanceMiles * 0.22).toFixed(1));
    const estimatedTollCostUsd = (options?.avoidTolls || v.avoidTolls) ? 0 : parseFloat((tollDistanceMiles * 0.38).toFixed(2));

    // Evaluate bridge clearance warnings
    const warnings: BridgeClearanceWarning[] = [];
    for (const bridge of KNOWN_FHWA_54B_BRIDGES) {
      const nearOrigin = haversineMiles(resolvedOrigin.coords, bridge) < 45;
      const nearDest = haversineMiles(resolvedDestination.coords, bridge) < 45;
      if (nearOrigin || nearDest) {
        const bufferDeltaInches = Math.round((bridge.clearanceFt - v.heightFt) * 12);
        const isCompliant = bufferDeltaInches >= 6;
        warnings.push({
          lat: bridge.lat,
          lon: bridge.lon,
          clearanceFt: bridge.clearanceFt,
          bufferDeltaInches,
          structureName: bridge.structureName,
          isCompliant,
          warningSeverity: isCompliant ? 'NONE' : bufferDeltaInches < 0 ? 'CRITICAL' : 'ADVISORY',
        });
      }
    }

    // Step 4: Return normalized output
    return {
      routeId: `rt-mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: 'mock',
      mock: true,
      fallbackTriggered: false,
      cached: false,
      totalDistanceMiles,
      totalTimeMinutes,
      tollDistanceMiles,
      estimatedTollCostUsd,
      summaryPathCoords: interpolatedCoords,
      legs,
      turnByTurnSteps,
      bridgeClearanceWarnings: warnings,
      truckRestrictionsApplied: true,
      calculatedAt: new Date().toISOString(),
    };
  }

  async getMileage(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile
  ): Promise<MileageResult> {
    const route = await this.calculateRoute(origin, destination, waypoints, vehicleProfile);
    return {
      origin: origin.label || (origin.coords ? `${origin.coords.lat},${origin.coords.lon}` : 'Origin'),
      destination: destination.label || (destination.coords ? `${destination.coords.lat},${destination.coords.lon}` : 'Destination'),
      distanceMiles: route.totalDistanceMiles,
      durationMinutes: route.totalTimeMinutes,
      tollMiles: route.tollDistanceMiles,
      provider: 'mock',
      mock: true,
      calculatedAt: new Date().toISOString(),
    };
  }

  async geocode(query: string): Promise<GeocodeResult> {
    const normalized = query.toLowerCase();

    if (normalized.includes('invalid_stop') || normalized.includes('nonexistent')) {
      throw new Error(`Mock geocode: No location match found for "${query}"`);
    }

    const MOCK_GEOCODES: Record<string, { lat: number; lon: number; formatted: string }> = {
      'st. louis': { lat: 38.6270, lon: -90.1994, formatted: 'St. Louis, MO, USA' },
      'chicago': { lat: 41.8781, lon: -87.6298, formatted: 'Chicago, IL, USA' },
      'indianapolis': { lat: 39.7684, lon: -86.1581, formatted: 'Indianapolis, IN, USA' },
      'detroit': { lat: 42.3314, lon: -83.0458, formatted: 'Detroit, MI, USA' },
      'dallas': { lat: 32.7767, lon: -96.7970, formatted: 'Dallas, TX, USA' },
      'atlanta': { lat: 33.7490, lon: -84.3880, formatted: 'Atlanta, GA, USA' },
      'kansas city': { lat: 39.0997, lon: -94.5786, formatted: 'Kansas City, MO, USA' },
    };

    for (const [key, val] of Object.entries(MOCK_GEOCODES)) {
      if (normalized.includes(key)) {
        return {
          query,
          formattedAddress: val.formatted,
          coords: { lat: val.lat, lon: val.lon },
          confidence: 0.95,
          provider: 'mock',
        };
      }
    }

    return {
      query,
      formattedAddress: `${query} (Commercial Hub Geocoded)`,
      coords: { lat: 39.8283, lon: -98.5795 },
      confidence: 0.8,
      provider: 'mock',
    };
  }
}
