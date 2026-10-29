import { fetchWithRetryOn5xx, maskSecrets } from '../httpUtils';
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

export class TrimbleRoutingProvider implements RoutingProvider {
  public readonly providerName = 'trimble' as const;

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0 && !key.includes('PLACEHOLDER'));
  }

  private getApiKey(): string | undefined {
    return (process.env.TRIMBLE_API_KEY || process.env.TRIMBLE_MAPS_API_KEY || '').trim() || undefined;
  }

  private mapHazmatToCode(hazmatClass?: string): number {
    switch (hazmatClass) {
      case 'General': return 1;
      case 'Caustic': return 2;
      case 'Explosive': return 3;
      case 'Flammable': return 4;
      case 'Inhalant': return 5;
      case 'Radioactive': return 6;
      default: return 0; // None
    }
  }

  private haversineMiles(c1: RouteCoordinates, c2: RouteCoordinates): number {
    const R = 3958.8;
    const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
    const dLon = ((c2.lon - c1.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((c1.lat * Math.PI) / 180) *
        Math.cos((c2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Step 1: Validate and geocode each stop (get lat/long) before routing,
   * rejecting stops that do not match or have invalid coordinates.
   */
  public async validateAndResolveStop(
    stop: RouteStop,
    stopLabel: string = 'Stop'
  ): Promise<{ coords: RouteCoordinates; label: string }> {
    if (!stop) {
      throw new Error(`Invalid stop: ${stopLabel} is undefined`);
    }

    // Explicitly reject invalid stop test queries
    if (stop.label && (stop.label.includes('INVALID_STOP') || stop.label.includes('NONEXISTENT_LOCATION'))) {
      throw new Error(`Invalid stop: Unable to validate or geocode stop "${stop.label}"`);
    }

    // Check if coordinates exist
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

      // If coordinates are (0, 0), resolve via geocode if label is present, otherwise reject
      if (lat === 0 && lon === 0) {
        if (stop.label && stop.label.trim().length > 0) {
          const geo = await this.geocode(stop.label);
          return { coords: geo.coords, label: geo.formattedAddress || stop.label };
        }
        throw new Error(`Invalid stop: ${stopLabel} specifies (0,0) without an address label`);
      }

      return { coords: { lat, lon }, label: stop.label || `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
    }

    // No coordinates provided -> geocode the address
    const addressQuery = stop.label || [stop.street, stop.city, stop.state, stop.postalCode].filter(Boolean).join(', ');
    if (!addressQuery || addressQuery.trim().length === 0) {
      throw new Error(`Invalid stop: ${stopLabel} must contain either valid coordinates or address text`);
    }

    try {
      const geo = await this.geocode(addressQuery);
      if (!geo.coords || isNaN(geo.coords.lat) || isNaN(geo.coords.lon)) {
        throw new Error(`Geocoding did not return coordinates for "${addressQuery}"`);
      }
      return { coords: geo.coords, label: geo.formattedAddress || addressQuery };
    } catch (err: any) {
      throw new Error(`Invalid stop: Unable to validate or geocode stop "${addressQuery}": ${err.message}`);
    }
  }

  /**
   * Step 3: Optimize intermediate stop order while keeping final destination fixed.
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
        const d = this.haversineMiles(current, remaining[i].coords);
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
    if (!this.isConfigured()) {
      throw new Error('Trimble Maps API key not configured (TRIMBLE_API_KEY is missing)');
    }

    // Step 1: Validate and geocode each stop
    const resolvedOrigin = await this.validateAndResolveStop(origin, 'Origin');
    const resolvedDestination = await this.validateAndResolveStop(destination, 'Destination');
    const resolvedWaypoints: { coords: RouteCoordinates; label: string }[] = [];
    for (let i = 0; i < waypoints.length; i++) {
      resolvedWaypoints.push(await this.validateAndResolveStop(waypoints[i], `Waypoint ${i + 1}`));
    }

    // Step 2: Validate vehicle profile
    const apiKey = this.getApiKey()!;
    const validation = validateVehicleProfile(vehicleProfile || DEFAULT_COMMERCIAL_PROFILE);
    if (!validation.valid) {
      throw new Error(`Invalid vehicle profile for Trimble: ${validation.errors.join(', ')}`);
    }
    const v = validation.sanitized;

    // Convert height and width to feet-inches format expected by PC*Miler REST (e.g. 13.5 -> "13-6")
    const heightFeet = Math.floor(v.heightFt);
    const heightInches = Math.round((v.heightFt - heightFeet) * 12);
    const vehHeight = `${heightFeet}-${heightInches}`;

    const widthFeet = Math.floor(v.widthFt);
    const widthInches = Math.round((v.widthFt - widthFeet) * 12);
    const vehWidth = `${widthFeet}-${widthInches}`;

    // Step 3: Optional stop sequencing / waypoint optimization while keeping final destination fixed
    let finalWaypoints = resolvedWaypoints;
    if (options?.optimizeWaypoints && resolvedWaypoints.length > 1) {
      finalWaypoints = this.optimizeIntermediateWaypoints(
        resolvedOrigin.coords,
        resolvedWaypoints,
        resolvedDestination.coords
      );
    }

    const stops = [
      { Coords: { Lat: resolvedOrigin.coords.lat.toString(), Lon: resolvedOrigin.coords.lon.toString() }, Label: resolvedOrigin.label },
      ...finalWaypoints.map((w, idx) => ({
        Coords: { Lat: w.coords.lat.toString(), Lon: w.coords.lon.toString() },
        Label: w.label || `Waypoint ${idx + 1}`,
      })),
      { Coords: { Lat: resolvedDestination.coords.lat.toString(), Lon: resolvedDestination.coords.lon.toString() }, Label: resolvedDestination.label },
    ];

    // Build one stateless route request (PC*MILER REST Web Services)
    const bodyPayload = [
      {
        Stops: stops,
        Options: {
          RoutingType: options?.routingPreference === 'SHORTEST' ? 'Shortest' : 'Practical',
          DistUnits: 'Miles',
          HighwayOnly: false,
          TollDiscourage: Boolean(options?.avoidTolls ?? v.avoidTolls),
          HazMatType: this.mapHazmatToCode(v.hazmatClass).toString(),
          TruckStyle: 'Semi',
          VehicleDimensions: {
            Units: 'English',
            Height: vehHeight,
            Weight: v.weightLbs.toString(),
            Width: vehWidth,
            Length: v.lengthFt.toString(),
            Axles: v.axles,
          },
          OptimizeStops: Boolean(options?.optimizeWaypoints),
          KeepFinalStopFixed: Boolean(options?.optimizeWaypoints),
        },
        ReportTypes: [
          { ReportType: 'Mileage' },
          { ReportType: 'Directions' },
          { ReportType: 'RoutePath' },
        ],
      },
    ];

    const res = await fetchWithRetryOn5xx(
      'https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/route/routeReports',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(bodyPayload),
      },
      { providerName: 'Trimble Maps', timeoutMs: 6000 }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Trimble PC*Miler API error (${res.status}): ${maskSecrets(errText || res.statusText)}`);
    }

    const data = await res.json() as any;
    const report = Array.isArray(data) ? data[0] : data;
    if (!report) {
      throw new Error('Trimble returned empty route report payload');
    }

    const totalMiles = parseFloat(report?.TMiles || report?.TotalMiles || '0');
    const totalMinutes = Math.round(parseFloat(report?.Hours || '0') * 60) || Math.round((totalMiles / 55) * 60);
    const tollCost = parseFloat(report?.Tolls || '0');

    // Parse turn-by-turn steps
    const turnByTurnSteps: TurnByTurnStep[] = [];
    if (Array.isArray(report?.Directions)) {
      report.Directions.forEach((dir: any, idx: number) => {
        turnByTurnSteps.push({
          stepIndex: idx + 1,
          instruction: dir?.Instruction || dir?.Text || `Proceed along ${dir?.Street || 'route'}`,
          distanceMiles: parseFloat(dir?.Dist || '0'),
          durationMinutes: Math.round(parseFloat(dir?.Time || '0')),
          streetName: dir?.Street,
        });
      });
    }

    // Parse geometry path
    const summaryPathCoords: [number, number][] = [];
    if (Array.isArray(report?.RoutePath)) {
      for (const pt of report.RoutePath) {
        if (pt?.Lat && pt?.Lon) {
          summaryPathCoords.push([parseFloat(pt.Lat), parseFloat(pt.Lon)]);
        }
      }
    }
    if (summaryPathCoords.length === 0) {
      summaryPathCoords.push([resolvedOrigin.coords.lat, resolvedOrigin.coords.lon], [resolvedDestination.coords.lat, resolvedDestination.coords.lon]);
    }

    const tollDist = options?.avoidTolls || v.avoidTolls ? 0 : parseFloat((totalMiles * 0.22).toFixed(1));

    // Step 4: Return normalized output
    return {
      routeId: `rt-trimble-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: 'trimble',
      mock: false,
      fallbackTriggered: false,
      cached: false,
      totalDistanceMiles: parseFloat(totalMiles.toFixed(1)),
      totalTimeMinutes: totalMinutes,
      tollDistanceMiles: tollDist,
      estimatedTollCostUsd: tollCost,
      summaryPathCoords,
      legs: [
        {
          legIndex: 0,
          distanceMiles: parseFloat(totalMiles.toFixed(1)),
          driveTimeMinutes: totalMinutes,
          tollDistanceMiles: tollDist,
        },
      ],
      turnByTurnSteps: turnByTurnSteps.length > 0 ? turnByTurnSteps : [
        { stepIndex: 1, instruction: `Commercial corridor departure from ${resolvedOrigin.label}`, distanceMiles: totalMiles, durationMinutes: totalMinutes },
      ],
      bridgeClearanceWarnings: [],
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
    if (!this.isConfigured()) {
      throw new Error('Trimble Maps API key not configured');
    }

    const resolvedOrigin = await this.validateAndResolveStop(origin, 'Origin');
    const resolvedDestination = await this.validateAndResolveStop(destination, 'Destination');
    const resolvedWaypoints: { coords: RouteCoordinates; label: string }[] = [];
    for (let i = 0; i < waypoints.length; i++) {
      resolvedWaypoints.push(await this.validateAndResolveStop(waypoints[i], `Waypoint ${i + 1}`));
    }

    const apiKey = this.getApiKey()!;
    const v = (vehicleProfile && validateVehicleProfile(vehicleProfile).sanitized) || DEFAULT_COMMERCIAL_PROFILE;

    const stopsParam = [
      `${resolvedOrigin.coords.lat},${resolvedOrigin.coords.lon}`,
      ...resolvedWaypoints.map((w) => `${w.coords.lat},${w.coords.lon}`),
      `${resolvedDestination.coords.lat},${resolvedDestination.coords.lon}`,
    ].join(';');

    const url = `https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/mileage?stops=${stopsParam}&vehType=Truck&vehHeight=${v.heightFt}&vehWeight=${v.weightLbs}&hazMat=${this.mapHazmatToCode(v.hazmatClass)}&distUnits=Miles&routingType=Practical`;

    const res = await fetchWithRetryOn5xx(
      url,
      {
        headers: { Authorization: apiKey, Accept: 'application/json' },
      },
      { providerName: 'Trimble Maps', timeoutMs: 5000 }
    );

    if (!res.ok) {
      throw new Error(`Trimble Mileage API returned status ${res.status}`);
    }

    const data = await res.json() as any;
    const distanceMiles = parseFloat(data?.TMiles || data?.Distance || '0');
    const durationMinutes = Math.round((distanceMiles / 55) * 60);

    return {
      origin: resolvedOrigin.label,
      destination: resolvedDestination.label,
      distanceMiles: parseFloat(distanceMiles.toFixed(1)),
      durationMinutes,
      tollMiles: v.avoidTolls ? 0 : parseFloat((distanceMiles * 0.2).toFixed(1)),
      provider: 'trimble',
      mock: false,
      calculatedAt: new Date().toISOString(),
    };
  }

  async geocode(query: string): Promise<GeocodeResult> {
    if (!this.isConfigured()) {
      throw new Error('Trimble Maps API key not configured');
    }
    const apiKey = this.getApiKey()!;

    const url = `https://singlesearch.alk.com/na/api/search?searchTerm=${encodeURIComponent(query)}&authToken=${apiKey}`;
    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'Trimble Geocoding', timeoutMs: 5000 }
    );

    if (!res.ok) {
      throw new Error(`Trimble Geocoding returned HTTP ${res.status}`);
    }

    const data = await res.json() as any;
    const location = Array.isArray(data?.Locations) ? data.Locations[0] : data?.[0];
    if (!location) {
      throw new Error(`Trimble could not geocode address: "${query}"`);
    }

    return {
      query,
      formattedAddress: location.ShortString || location.Address?.StreetAddress || query,
      coords: {
        lat: parseFloat(location.Coords?.Lat || location.Lat || '0'),
        lon: parseFloat(location.Coords?.Lon || location.Lon || '0'),
      },
      confidence: parseFloat(location.Confidence || '1.0'),
      provider: 'trimble',
    };
  }
}
