import { fetchWithRetryOn5xx, maskSecrets } from '../httpUtils';
import { GeocodeResult, PlaceSearchResult, RouteCoordinates } from '../types';

/**
 * Google Maps Platform Adapter
 * STRICT ARCHITECTURAL INVARIANT:
 * Google Maps Platform is used EXCLUSIVELY for:
 * 1. Address search and geocoding (converting address/query to lat/lon)
 * 2. Place autocomplete (freight terminals, warehouses, travel centers)
 * 3. Reverse geocoding (converting lat/lon to street address)
 *
 * It is STRICTLY FORBIDDEN to use Google Maps Platform for commercial truck
 * route calculation or on-device navigation guidance, as Google Maps does not
 * evaluate FHWA low bridges, gross vehicle weight limits, or hazmat restrictions.
 */
export class GooglePlacesProvider {
  public readonly providerName = 'google' as const;

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0 && !key.includes('PLACEHOLDER'));
  }

  /**
   * ARCHITECTURAL ENFORCEMENT:
   * Google Maps Platform must NEVER be used for commercial truck routing.
   */
  calculateRoute(): never {
    throw new Error('Google Maps Platform is strictly prohibited for commercial truck routing. Use Trimble or TomTom.');
  }

  private getApiKey(): string | undefined {
    return (
      (process.env.GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_GEOCODING_API_KEY ||
        '').trim() || undefined
    );
  }

  /**
   * Geocode an address query to coordinates using Google Geocoding API
   */
  async geocode(query: string): Promise<GeocodeResult> {
    if (!query || !query.trim()) {
      throw new Error('Address query cannot be empty');
    }

    if (!this.isConfigured()) {
      return this.mockGeocode(query);
    }

    const apiKey = this.getApiKey()!;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'Google Geocoding', timeoutMs: 4000 }
    );

    if (!res.ok) {
      throw new Error(`Google Geocoding API returned status ${res.status}`);
    }

    const data = await res.json() as any;
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      if (data.status === 'ZERO_RESULTS') {
        throw new Error(`Google could not locate address: "${query}"`);
      }
      throw new Error(`Google Geocoding error (${data.status}): ${maskSecrets(data.error_message || '')}`);
    }

    const best = data.results[0];
    return {
      query,
      formattedAddress: best.formatted_address || query,
      coords: {
        lat: parseFloat(best.geometry.location.lat),
        lon: parseFloat(best.geometry.location.lng),
      },
      confidence: best.geometry.location_type === 'ROOFTOP' ? 1.0 : 0.85,
      provider: 'google',
    };
  }

  /**
   * Search places / address autocomplete using Google Places API
   */
  async searchPlaces(query: string, locationBias?: RouteCoordinates): Promise<PlaceSearchResult[]> {
    if (!query || !query.trim()) {
      return [];
    }

    if (!this.isConfigured()) {
      return this.mockSearchPlaces(query);
    }

    const apiKey = this.getApiKey()!;
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:us&key=${apiKey}`;
    if (locationBias) {
      url += `&location=${locationBias.lat},${locationBias.lon}&radius=50000`;
    }

    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'Google Places Autocomplete', timeoutMs: 4000 }
    );

    if (!res.ok) {
      throw new Error(`Google Places Autocomplete returned status ${res.status}`);
    }

    const data = await res.json() as any;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places error (${data.status}): ${maskSecrets(data.error_message || '')}`);
    }

    const predictions = Array.isArray(data.predictions) ? data.predictions : [];
    return predictions.map((p: any) => ({
      placeId: p.place_id,
      name: p.structured_formatting?.main_text || p.description,
      formattedAddress: p.description,
      provider: 'google',
    }));
  }

  /**
   * Reverse geocode lat/lon to nearest street address
   */
  async reverseGeocode(coords: RouteCoordinates): Promise<GeocodeResult> {
    if (!this.isConfigured()) {
      return {
        query: `${coords.lat}, ${coords.lon}`,
        formattedAddress: `Interstate Commercial Corridor near (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`,
        coords,
        confidence: 0.9,
        provider: 'mock',
      };
    }

    const apiKey = this.getApiKey()!;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lon}&key=${apiKey}`;

    const res = await fetchWithRetryOn5xx(
      url,
      { headers: { Accept: 'application/json' } },
      { providerName: 'Google Reverse Geocoding', timeoutMs: 4000 }
    );

    if (!res.ok) {
      throw new Error(`Google Reverse Geocoding returned status ${res.status}`);
    }

    const data = await res.json() as any;
    const best = Array.isArray(data.results) ? data.results[0] : null;

    return {
      query: `${coords.lat}, ${coords.lon}`,
      formattedAddress: best?.formatted_address || `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
      coords,
      confidence: 0.95,
      provider: 'google',
    };
  }

  /**
   * Mock fallback geocoding for offline/test environments
   */
  private mockGeocode(query: string): GeocodeResult {
    const q = query.toLowerCase();
    const MOCK_LOCATIONS: Record<string, { lat: number; lon: number; formatted: string }> = {
      'dallas': { lat: 32.7767, lon: -96.7970, formatted: 'Dallas Freight Hub, Dallas, TX, USA' },
      'chicago': { lat: 41.8781, lon: -87.6298, formatted: 'Chicago Intermodal Terminal, Chicago, IL, USA' },
      'st. louis': { lat: 38.6270, lon: -90.1994, formatted: 'St. Louis Riverfront Freight Hub, St. Louis, MO, USA' },
      'indianapolis': { lat: 39.7684, lon: -86.1581, formatted: 'Crossroads Logistics Hub, Indianapolis, IN, USA' },
      'detroit': { lat: 42.3314, lon: -83.0458, formatted: 'Detroit Commercial Logistics Port, Detroit, MI, USA' },
      'atlanta': { lat: 33.7490, lon: -84.3880, formatted: 'Atlanta Southeast Freight Center, Atlanta, GA, USA' },
    };

    for (const [key, val] of Object.entries(MOCK_LOCATIONS)) {
      if (q.includes(key)) {
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
      formattedAddress: `${query} (Google Geocoded Address)`,
      coords: { lat: 39.8283, lon: -98.5795 },
      confidence: 0.85,
      provider: 'mock',
    };
  }

  /**
   * Mock fallback place search for offline/test environments
   */
  private mockSearchPlaces(query: string): PlaceSearchResult[] {
    const q = query.toLowerCase();
    const COMMON_FREIGHT_POIS: PlaceSearchResult[] = [
      {
        placeId: 'place_loves_420',
        name: "Love's Travel Stop #420",
        formattedAddress: "Love's Travel Stop #420, I-44 Exit 184, Rolla, MO",
        coords: { lat: 37.951, lon: -91.771 },
        provider: 'mock',
      },
      {
        placeId: 'place_pilot_102',
        name: 'Pilot Flying J Travel Plaza #102',
        formattedAddress: 'Pilot Travel Plaza #102, I-55 Exit 90, Springfield, IL',
        coords: { lat: 39.781, lon: -89.650 },
        provider: 'mock',
      },
      {
        placeId: 'place_ta_dallas',
        name: 'TA Travel Center Dallas South',
        formattedAddress: 'TA Travel Center, I-20 Exit 472, Dallas, TX',
        coords: { lat: 32.682, lon: -96.840 },
        provider: 'mock',
      },
      {
        placeId: 'place_bnsf_chicago',
        name: 'BNSF Corwith Intermodal Rail Terminal',
        formattedAddress: 'BNSF Corwith Yard, 3500 W Pershing Rd, Chicago, IL',
        coords: { lat: 41.821, lon: -87.712 },
        provider: 'mock',
      },
    ];

    const matched = COMMON_FREIGHT_POIS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.formattedAddress.toLowerCase().includes(q)
    );

    return matched.length > 0 ? matched : [
      {
        placeId: `place_mock_${Date.now()}`,
        name: query,
        formattedAddress: `${query}, Commercial Freight Terminal, USA`,
        coords: { lat: 39.8283, lon: -98.5795 },
        provider: 'mock',
      },
    ];
  }
}
