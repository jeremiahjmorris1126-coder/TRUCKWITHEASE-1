import { fetchWithRetryOn5xx, maskSecrets } from '../httpUtils';
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
    });

    if (options?.avoidTolls || v.avoidTolls) {
      params.append('avoid', 'tollRoads');
    }

    if (v.isHazmat) {
      params.append('vehicleLoadType', 'otherHazmat');
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
      tollDistanceMiles: options?.avoidTolls || v.avoidTolls ? 0 : parseFloat((((leg.summary?.lengthInMeters || 0) / 1609.344) * 0.2).toFixed(1)),
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
    const turnByTurnSteps: TurnByTurnStep[] = [];
    if (Array.isArray(route.guidance?.instructions)) {
      route.guidance.instructions.forEach((inst: any, idx: number) => {
        turnByTurnSteps.push({
          stepIndex: idx + 1,
          instruction: inst.message || `Maneuver ${inst.maneuver || ''}`,
          distanceMiles: parseFloat(((inst.routeOffsetInMeters || 0) / 1609.344).toFixed(1)),
          durationMinutes: Math.round((inst.travelTimeInSeconds || 0) / 60),
          streetName: inst.street,
        });
      });
    }

    const tollDist = options?.avoidTolls || v.avoidTolls ? 0 : parseFloat((totalDistanceMiles * 0.22).toFixed(1));
    const estimatedTollCost = options?.avoidTolls || v.avoidTolls ? 0 : parseFloat((tollDist * 0.38).toFixed(2));

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
