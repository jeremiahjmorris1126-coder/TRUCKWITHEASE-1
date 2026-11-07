import { fetchWithRetryOn5xx, maskSecrets } from '../httpUtils';
import { isHazmatLoad } from './trimbleProvider';
import {
  BridgeClearanceWarning,
  CommercialVehicleProfile,
  DEFAULT_COMMERCIAL_PROFILE,
  GeocodeResult,
  MileageResult,
  NormalizedRouteResult,
  RouteOptions,
  RouteStop,
  RoutingProvider,
  TurnByTurnStep,
  validateVehicleProfile,
} from '../types';

export class TomTomRoutingProvider implements RoutingProvider {
  public readonly providerName = 'tomtom' as const;

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0 && !key.includes('PLACEHOLDER'));
  }

  private getApiKey(): string | undefined {
    return (process.env.TOMTOM_API_KEY || '').trim() || undefined;
  }

  async calculateRoute(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile,
    options?: RouteOptions
  ): Promise<NormalizedRouteResult> {
    if (!this.isConfigured()) {
      throw new Error('TomTom API key not configured (TOMTOM_API_KEY is missing)');
    }

    const apiKey = this.getApiKey()!;
    const validation = validateVehicleProfile(vehicleProfile || DEFAULT_COMMERCIAL_PROFILE);
    if (!validation.valid) {
      throw new Error(`Invalid vehicle profile for TomTom: ${validation.errors.join(', ')}`);
    }
    const v = validation.sanitized;

    // Convert US customary units to metric required by TomTom REST API
    const heightMeters = parseFloat((v.heightFt * 0.3048).toFixed(2));
    const weightKg = Math.round(v.weightLbs * 0.453592);
    const widthMeters = parseFloat((v.widthFt * 0.3048).toFixed(2));
    const lengthMeters = parseFloat((v.lengthFt * 0.3048).toFixed(2));

    const locParts: string[] = [`${origin.coords.lat},${origin.coords.lon}`];
    for (const wp of waypoints) {
      locParts.push(`${wp.coords.lat},${wp.coords.lon}`);
    }
    locParts.push(`${destination.coords.lat},${destination.coords.lon}`);
    const locationsPath = locParts.join(':');

    const params = new URLSearchParams({
      key: apiKey,
      travelMode: 'truck',
      vehicleCommercial: 'true',
      vehicleHeight: heightMeters.toString(),
      vehicleWeight: weightKg.toString(),
      vehicleWidth: widthMeters.toString(),
      vehicleLength: lengthMeters.toString(),
      vehicleNumberOfAxles: v.axles.toString(),
      traffic: 'true',
      instructionsType: 'text',
      language: 'en-US',
      // Ask TomTom which stretches are toll roads instead of guessing.
      sectionType: 'tollRoad',
    });

    if (options?.avoidTolls || v.avoidTolls) {
      params.append('avoid', 'tollRoads');
    }

    if (isHazmatLoad(v)) {
      // Send the specific US hazmat classes so class-specific tunnel/road bans apply.
      for (const loadType of tomtomLoadTypes(v.hazmatClass)) params.append('vehicleLoadType', loadType);
    }

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${locationsPath}/json?${params.toString()}`;

    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'TomTom Routing', timeoutMs: 6000 }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`TomTom Routing API error (${res.status}): ${maskSecrets(errText || res.statusText)}`);
    }

    const data = await res.json() as any;
    const route = data?.routes?.[0];
    if (!route) {
      throw new Error('TomTom returned no route for specified commercial truck profile');
    }

    const summary = route.summary || {};
    const totalDistanceMiles = parseFloat(((summary.lengthInMeters || 0) / 1609.344).toFixed(1));
    const totalTimeMinutes = Math.round((summary.travelTimeInSeconds || 0) / 60);
    const trafficDelayMinutes = Math.round((summary.trafficDelayInSeconds || 0) / 60);

    const legs = (route.legs || []).map((leg: any, idx: number) => ({
      legIndex: idx,
      distanceMiles: parseFloat(((leg.summary?.lengthInMeters || 0) / 1609.344).toFixed(1)),
      driveTimeMinutes: Math.round((leg.summary?.travelTimeInSeconds || 0) / 60),
      tollDistanceMiles: null,
    }));

    // Extract geometry coordinates
    const summaryPathCoords: [number, number][] = [];
    for (const leg of route.legs || []) {
      for (const pt of leg.points || []) {
        summaryPathCoords.push([pt.latitude, pt.longitude]);
      }
    }
    if (summaryPathCoords.length === 0) {
      summaryPathCoords.push([origin.coords.lat, origin.coords.lon], [destination.coords.lat, destination.coords.lon]);
    }

    // Extract turn-by-turn guidance steps
    // routeOffsetInMeters / travelTimeInSeconds are cumulative from the start of the
    // route, so each step's length is the difference to the next instruction.
    const turnByTurnSteps: TurnByTurnStep[] = [];
    const instructions: any[] = Array.isArray(route.guidance?.instructions) ? route.guidance.instructions : [];
    instructions.forEach((inst: any, idx: number) => {
      const next = instructions[idx + 1];
      const stepMeters = next ? (next.routeOffsetInMeters || 0) - (inst.routeOffsetInMeters || 0) : 0;
      const stepSeconds = next ? (next.travelTimeInSeconds || 0) - (inst.travelTimeInSeconds || 0) : 0;
      turnByTurnSteps.push({
        stepIndex: idx + 1,
        instruction: inst.message || `Maneuver ${inst.maneuver || ''}`,
        distanceMiles: parseFloat((Math.max(0, stepMeters) / 1609.344).toFixed(1)),
        durationMinutes: Math.round(Math.max(0, stepSeconds) / 60),
        streetName: inst.street,
      });
    });

    // Toll-road miles from TomTom's tollRoad sections (point index ranges on the route polyline).
    const tollDist = tollMilesFromSections(route.sections, summaryPathCoords);
    // TomTom does not price tolls; cost is reported only by PC*MILER.
    const estimatedTollCost: number | null = null;

    return {
      routeId: `rt-tomtom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: 'tomtom',
      mock: false,
      fallbackTriggered: true,
      cached: false,
      totalDistanceMiles,
      totalTimeMinutes,
      tollDistanceMiles: tollDist,
      estimatedTollCostUsd: estimatedTollCost,
      summaryPathCoords,
      legs,
      turnByTurnSteps: turnByTurnSteps.length > 0 ? turnByTurnSteps : [
        { stepIndex: 1, instruction: `Truck corridor routing from ${origin.label || 'Origin'} via TomTom`, distanceMiles: totalDistanceMiles, durationMinutes: totalTimeMinutes },
      ],
      bridgeClearanceWarnings: [],
      truckRestrictionsApplied: true,
      trafficDelayMinutes,
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
      origin: origin.label || `${origin.coords.lat},${origin.coords.lon}`,
      destination: destination.label || `${destination.coords.lat},${destination.coords.lon}`,
      distanceMiles: route.totalDistanceMiles,
      durationMinutes: route.totalTimeMinutes,
      tollMiles: route.tollDistanceMiles,
      provider: 'tomtom',
      mock: false,
      calculatedAt: new Date().toISOString(),
    };
  }

  async geocode(query: string): Promise<GeocodeResult> {
    if (!this.isConfigured()) {
      throw new Error('TomTom API key not configured (TOMTOM_API_KEY is missing)');
    }
    const apiKey = this.getApiKey()!;

    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?key=${apiKey}&limit=1`;
    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'TomTom Geocoding', timeoutMs: 5000 }
    );

    if (!res.ok) {
      throw new Error(`TomTom Geocoding returned HTTP ${res.status}`);
    }

    const data = await res.json() as any;
    const result = data?.results?.[0];
    if (!result || !result.position) {
      throw new Error(`TomTom could not geocode address: "${query}"`);
    }

    return {
      query,
      formattedAddress: result.address?.freeformAddress || query,
      coords: {
        lat: result.position.lat,
        lon: result.position.lon,
      },
      confidence: result.score || 1.0,
      provider: 'tomtom',
    };
  }
}


/** Maps the app's hazmat categories to TomTom vehicleLoadType values (US classes). */
export function tomtomLoadTypes(hazmatClass?: string): string[] {
  switch (hazmatClass) {
    case 'Explosive':
      return ['USHazmatClass1'];
    case 'General':
    case undefined:
    case 'None':
      return ['otherHazmat'];
    case 'Flammable':
      return ['USHazmatClass3', 'USHazmatClass4'];
    case 'Inhalant':
      return ['USHazmatClass2', 'USHazmatClass6'];
    case 'Radioactive':
      return ['USHazmatClass7'];
    case 'Corrosive':
    case 'Caustic':
      return ['USHazmatClass8'];
    default:
      return ['otherHazmat'];
  }
}

function haversineMi(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** Sums polyline distance across tollRoad sections; null if TomTom returned no section data. */
export function tollMilesFromSections(sections: any, path: [number, number][]): number | null {
  if (!Array.isArray(sections)) return null;
  let miles = 0;
  for (const sec of sections) {
    if (sec?.sectionType !== 'TOLL_ROAD' && sec?.sectionType !== 'TOLL_VIGNETTE') continue;
    const start = Number(sec.startPointIndex);
    const end = Number(sec.endPointIndex);
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    for (let i = Math.max(0, start); i < Math.min(end, path.length - 1); i++) miles += haversineMi(path[i], path[i + 1]);
  }
  return parseFloat(miles.toFixed(1));
}
