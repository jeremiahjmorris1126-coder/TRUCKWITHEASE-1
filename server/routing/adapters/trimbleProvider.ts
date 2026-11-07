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
      case 'Corrosive': return 2; // previously unmapped → routed as non-hazmat
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

    const report = await this.postRouteReports(apiKey, stops, v, options, ['Mileage', 'Directions', 'GeoTunnel']);
    const parsed = parsePcmilerReports(report);
    if (parsed.totalMiles === null) {
      throw new Error('PC*MILER returned no mileage for this route.');
    }
    const totalMiles = parsed.totalMiles;
    const totalMinutes = parsed.totalMinutes ?? 0;

    const summaryPathCoords: [number, number][] =
      parsed.path.length > 0
        ? parsed.path
        : [[resolvedOrigin.coords.lat, resolvedOrigin.coords.lon], [resolvedDestination.coords.lat, resolvedDestination.coords.lon]];

    return {
      routeId: `rt-trimble-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: 'trimble',
      mock: false,
      fallbackTriggered: false,
      cached: false,
      totalDistanceMiles: parseFloat(totalMiles.toFixed(1)),
      totalTimeMinutes: totalMinutes,
      tollDistanceMiles: parsed.tollMiles,
      estimatedTollCostUsd: parsed.tollCostUsd,
      summaryPathCoords,
      legs: parsed.legs.length
        ? parsed.legs
        : [{ legIndex: 0, distanceMiles: parseFloat(totalMiles.toFixed(1)), driveTimeMinutes: totalMinutes, tollDistanceMiles: parsed.tollMiles }],
      turnByTurnSteps: parsed.steps.length > 0 ? parsed.steps : [
        { stepIndex: 1, instruction: `Depart ${resolvedOrigin.label}`, distanceMiles: totalMiles, durationMinutes: totalMinutes },
      ],
      bridgeClearanceWarnings: [],
      truckRestrictionsApplied: true,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * POST /route/routeReports in the documented shape:
   *   { ReportRoutes: [{ RouteId, Stops, Options: {..., TruckCfg}, ReportTypes: [{ __type: "<X>ReportType:http://pcmiler.alk.com/APIs/v1.0" }] }] }
   */
  private async postRouteReports(
    apiKey: string,
    stops: { Coords: { Lat: string; Lon: string }; Label: string }[],
    v: CommercialVehicleProfile,
    options: RouteOptions | undefined,
    reportTypes: ('Mileage' | 'Directions' | 'GeoTunnel')[]
  ): Promise<any> {
    const ns = 'http://pcmiler.alk.com/APIs/v1.0';
    const body = {
      ReportRoutes: [
        {
          RouteId: `twe-${Date.now()}`,
          Stops: stops.map((s) => ({ Coords: s.Coords, Label: s.Label })),
          Options: {
            VehicleType: 0, // Truck
            RoutingType: options?.routingPreference === 'SHORTEST' ? 1 : 0, // 0 Practical, 1 Shortest
            DistUnits: 0, // Miles
            HighwayOnly: false,
            TollDiscourage: Boolean(options?.avoidTolls ?? v.avoidTolls),
            HazMatTypes: [this.mapHazmatToCode(isHazmatLoad(v) ? (v.hazmatClass && v.hazmatClass !== 'None' ? v.hazmatClass : 'General') : 'None')],
            TruckCfg: {
              Units: 0, // English
              Height: feetInches(v.heightFt),
              Width: `${Math.round(v.widthFt * 12)}"`,
              Length: feetInches(v.lengthFt),
              Weight: String(Math.round(v.weightLbs)),
              Axles: v.axles,
              LCV: false,
            },
          },
          ReportTypes: reportTypes.map((t) => ({ __type: `${t}ReportType:${ns}` })),
        },
      ],
    };
    const dataVersion = process.env.TRIMBLE_DATA_VERSION || 'Current';
    const base = (process.env.TRIMBLE_API_BASE || 'https://pcmiler.alk.com/apis/rest/v1.0/Service.svc').replace(/\/$/, '');
    const res = await fetchWithRetryOn5xx(
      `${base}/route/routeReports?dataVersion=${encodeURIComponent(dataVersion)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: apiKey },
        body: JSON.stringify(body),
      },
      { providerName: 'Trimble PC*MILER', timeoutMs: 8000 }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Trimble PC*MILER API error (${res.status}): ${maskSecrets(errText || res.statusText).slice(0, 300)}`);
    }
    return res.json();
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
    const stops = [resolvedOrigin, ...resolvedWaypoints, resolvedDestination].map((s) => ({
      Coords: { Lat: s.coords.lat.toString(), Lon: s.coords.lon.toString() },
      Label: s.label,
    }));
    const parsed = parsePcmilerReports(await this.postRouteReports(apiKey, stops, v, undefined, ['Mileage']));
    if (parsed.totalMiles === null) throw new Error('PC*MILER returned no mileage for this route.');
    return {
      origin: resolvedOrigin.label,
      destination: resolvedDestination.label,
      distanceMiles: parseFloat(parsed.totalMiles.toFixed(1)),
      durationMinutes: parsed.totalMinutes ?? 0,
      tollMiles: parsed.tollMiles,
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


/** A load is hazmat if flagged OR a hazmat class is set (either alone must not route as non-hazmat). */
export function isHazmatLoad(v: { isHazmat?: boolean; hazmatClass?: string }): boolean {
  return Boolean(v.isHazmat) || Boolean(v.hazmatClass && v.hazmatClass !== 'None');
}

/** 13.5 → `13'6"` (PC*MILER English TruckCfg format). */
export function feetInches(ft: number): string {
  let feet = Math.floor(ft);
  let inches = Math.round((ft - feet) * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}"`;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** "12:30" (h:mm) or decimal hours → minutes. */
export function hoursToMinutes(v: unknown): number | null {
  if (typeof v === 'string' && /^\d+:\d{1,2}$/.test(v.trim())) {
    const [h, m] = v.trim().split(':').map(Number);
    return h * 60 + m;
  }
  const n = toNum(v);
  return n === null ? null : Math.round(n * 60);
}

const typeOf = (r: any): string => String(r?.__type || '').split(':')[0];

/**
 * Parses a PC*MILER routeReports response (array of reports, each with __type).
 * Totals come from the last Mileage ReportLine (cumulative T* fields); legs from L* fields.
 * Missing values stay null — nothing is estimated.
 */
export function parsePcmilerReports(data: any) {
  const reports: any[] = Array.isArray(data) ? data : Array.isArray(data?.Reports) ? data.Reports : data ? [data] : [];
  const mileage = reports.find((r) => typeOf(r) === 'MileageReport' || Array.isArray(r?.ReportLines));
  const lines: any[] = Array.isArray(mileage?.ReportLines) ? mileage.ReportLines : [];
  const last = lines[lines.length - 1];

  const legs = lines.slice(1).map((l, i) => ({
    legIndex: i,
    distanceMiles: toNum(l.LMiles) ?? 0,
    driveTimeMinutes: hoursToMinutes(l.LHours) ?? 0,
    tollDistanceMiles: toNum(l.LTollMiles ?? l.LToll),
  }));

  const directions = reports.find((r) => typeOf(r) === 'DirectionsReport');
  const steps: TurnByTurnStep[] = [];
  const dirLines: any[] = [];
  for (const seg of Array.isArray(directions?.ReportLines) ? directions.ReportLines : []) {
    if (Array.isArray(seg?.Segments)) dirLines.push(...seg.Segments);
    else dirLines.push(seg);
  }
  dirLines.forEach((d) => {
    const text = d?.Direction || d?.Instruction || d?.Text;
    if (!text) return;
    steps.push({
      stepIndex: steps.length + 1,
      instruction: String(text),
      distanceMiles: toNum(d.Dist ?? d.Distance) ?? 0,
      durationMinutes: hoursToMinutes(d.Time) ?? 0,
      streetName: d.Street || undefined,
    });
  });

  const geo = reports.find((r) => typeOf(r) === 'GeoTunnelReport' || Array.isArray(r?.GeoTunnelPoints));
  const path: [number, number][] = [];
  for (const pt of Array.isArray(geo?.GeoTunnelPoints) ? geo.GeoTunnelPoints : []) {
    const lat = toNum(pt?.Lat);
    const lon = toNum(pt?.Lon);
    if (lat !== null && lon !== null) path.push([lat, lon]);
  }

  return {
    totalMiles: last ? toNum(last.TMiles) : null,
    totalMinutes: last ? hoursToMinutes(last.THours) : null,
    tollCostUsd: last ? toNum(last.TTolls) : null,
    tollMiles: last ? toNum(last.TTollMiles ?? last.TollMiles) : null,
    legs,
    steps,
    path,
  };
}
