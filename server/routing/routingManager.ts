import crypto from 'crypto';
import { getFirestoreDb } from '../firestore';
import { GooglePlacesProvider } from './adapters/googlePlacesProvider';
import { MockRoutingProvider } from './adapters/mockProvider';
import { TomTomRoutingProvider } from './adapters/tomtomProvider';
import { TrimbleRoutingProvider } from './adapters/trimbleProvider';
import { CircuitBreaker } from './circuitBreaker';
import {
  CommercialVehicleProfile,
  DEFAULT_COMMERCIAL_PROFILE,
  GeocodeResult,
  MileageResult,
  NormalizedRouteResult,
  PlaceSearchResult,
  RouteCoordinates,
  RouteOptions,
  RouteStop,
  RoutingProvider,
  validateVehicleProfile,
} from './types';

const ROUTING_CACHE_COLLECTION = 'routing_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL (Complies with Trimble 24-hr limit and TomTom live traffic terms)

interface CacheEntry {
  cacheKey: string;
  cachedAt: string;
  routeResult: NormalizedRouteResult;
}

export class RoutingManager {
  private trimbleProvider: TrimbleRoutingProvider;
  private tomtomProvider: TomTomRoutingProvider;
  private mockProvider: MockRoutingProvider;
  private googlePlacesProvider: GooglePlacesProvider;

  public trimbleCircuit: CircuitBreaker;
  public tomtomCircuit: CircuitBreaker;

  private inMemoryCache: Map<string, CacheEntry> = new Map();

  constructor() {
    this.trimbleProvider = new TrimbleRoutingProvider();
    this.tomtomProvider = new TomTomRoutingProvider();
    this.mockProvider = new MockRoutingProvider();
    this.googlePlacesProvider = new GooglePlacesProvider();

    // Circuit breakers trip after 3 consecutive failures and pause the failing provider for 30s
    this.trimbleCircuit = new CircuitBreaker('TrimbleMaps', { failureThreshold: 3, resetTimeoutMs: 30000 });
    this.tomtomCircuit = new CircuitBreaker('TomTomRouting', { failureThreshold: 3, resetTimeoutMs: 30000 });
  }

  public getProviderStatus() {
    return {
      trimble: {
        configured: this.trimbleProvider.isConfigured(),
        circuitState: this.trimbleCircuit.getStatus().state,
        consecutiveFailures: this.trimbleCircuit.getStatus().consecutiveFailures,
        mode: this.trimbleProvider.isConfigured() ? 'LIVE_PC_MILER_REST' : 'NOT_CONFIGURED',
      },
      tomtom: {
        configured: this.tomtomProvider.isConfigured(),
        circuitState: this.tomtomCircuit.getStatus().state,
        consecutiveFailures: this.tomtomCircuit.getStatus().consecutiveFailures,
        mode: this.tomtomProvider.isConfigured() ? 'LIVE_TRUCK_REST' : 'NOT_CONFIGURED',
      },
      google: {
        configured: this.googlePlacesProvider.isConfigured(),
        mode: this.googlePlacesProvider.isConfigured() ? 'LIVE_PLACES_GEOCODE_REST' : 'NOT_CONFIGURED',
        purpose: 'ADDRESS_SEARCH_ONLY',
      },
      mock: {
        available: true,
        mode: 'DETERMINISTIC_COMMERCIAL_SIMULATOR',
      },
    };
  }

  public generateCacheKey(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile
  ): string {
    const v = vehicleProfile || DEFAULT_COMMERCIAL_PROFILE;
    const waypointsKey = waypoints
      .map((w) => `${w.coords.lat.toFixed(4)},${w.coords.lon.toFixed(4)}`)
      .join(';');

    const raw = `${origin.coords.lat.toFixed(4)},${origin.coords.lon.toFixed(4)}->${destination.coords.lat.toFixed(4)},${destination.coords.lon.toFixed(4)}|v:${v.heightFt}-${v.weightLbs}-${v.widthFt}-${v.lengthFt}-${v.axles}-${v.isHazmat}-${v.hazmatClass}-${v.avoidTolls}|wp:${waypointsKey}`;

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async getFromCache(cacheKey: string): Promise<NormalizedRouteResult | null> {
    const now = Date.now();

    // 1. In-memory fast cache
    const memItem = this.inMemoryCache.get(cacheKey);
    if (memItem) {
      const age = now - new Date(memItem.cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return { ...memItem.routeResult, cached: true };
      }
      this.inMemoryCache.delete(cacheKey);
    }

    // 2. Firestore cache
    try {
      const db = getFirestoreDb();
      if (db && typeof (db as any).collection === 'function') {
        const docSnap = await (db as any).collection(ROUTING_CACHE_COLLECTION).doc(cacheKey).get();
        if (docSnap.exists) {
          const data = docSnap.data() as CacheEntry;
          const age = now - new Date(data.cachedAt).getTime();
          if (age < CACHE_TTL_MS) {
            this.inMemoryCache.set(cacheKey, data);
            return { ...data.routeResult, cached: true };
          }
        }
      }
    } catch (err) {
      console.warn('[RoutingManager] Cache retrieval error:', (err as Error).message);
    }

    return null;
  }

  private async saveToCache(cacheKey: string, result: NormalizedRouteResult): Promise<void> {
    const entry: CacheEntry = {
      cacheKey,
      cachedAt: new Date().toISOString(),
      routeResult: { ...result, cached: false },
    };

    this.inMemoryCache.set(cacheKey, entry);

    try {
      const db = getFirestoreDb();
      if (db && typeof (db as any).collection === 'function') {
        await (db as any).collection(ROUTING_CACHE_COLLECTION).doc(cacheKey).set(entry);
      }
    } catch (err) {
      console.warn('[RoutingManager] Cache write error:', (err as Error).message);
    }
  }

  public clearCacheForTesting(): void {
    this.inMemoryCache.clear();
    this.trimbleCircuit.resetForTesting();
    this.tomtomCircuit.resetForTesting();
  }

  /**
   * Primary Route Calculation:
   * 1. 15-Minute Cache Check
   * 2. Trimble Maps (Primary) with Circuit Breaker
   * 3. TomTom Truck (Fallback) with Circuit Breaker
   * 4. Mock Commercial Simulator (Safe Failover)
   * 5. Sanitized Log: Logs provider used, distance, and cache status without PII or coordinates.
   */
  async calculateRoute(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile,
    options?: RouteOptions
  ): Promise<NormalizedRouteResult> {
    const cacheKey = this.generateCacheKey(origin, destination, waypoints, vehicleProfile);

    // 1. Check Cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[RoutingManager] Request served by [${cached.provider}] (cached: true, distance: ${cached.totalDistanceMiles} mi)`);
      return cached;
    }

    let result: NormalizedRouteResult | null = null;
    const isNavigationMode = options?.mode === 'navigation';

    if (isNavigationMode) {
      // LIVE NAVIGATION MODE:
      // TomTom is the dedicated on-device live-navigation engine to ensure 100% geometric alignment
      // with TomTom Vector Maps and prevent dynamic rerouting discrepancies or map matching conflicts.
      if (this.tomtomProvider.isConfigured() && this.tomtomCircuit.canExecute()) {
        try {
          result = await this.tomtomProvider.calculateRoute(origin, destination, waypoints, vehicleProfile, options);
          result.fallbackTriggered = false;
          this.tomtomCircuit.recordSuccess();
        } catch (err: any) {
          this.tomtomCircuit.recordFailure();
          console.warn(`[RoutingManager] TomTom navigation error: ${err.message}. Initiating Trimble fallback.`);
        }
      }

      if (!result && this.trimbleProvider.isConfigured() && this.trimbleCircuit.canExecute()) {
        try {
          result = await this.trimbleProvider.calculateRoute(origin, destination, waypoints, vehicleProfile, options);
          result.fallbackTriggered = true;
          this.trimbleCircuit.recordSuccess();
        } catch (err: any) {
          this.trimbleCircuit.recordFailure();
          console.warn(`[RoutingManager] Trimble fallback error: ${err.message}. Initiating mock fallback.`);
        }
      }
    } else {
      // PLANNING & BILLING MODE (Default):
      // Trimble PC*MILER is the primary commercial planning, IFTA compliance, and tariff mileage authority.
      if (this.trimbleProvider.isConfigured() && this.trimbleCircuit.canExecute()) {
        try {
          result = await this.trimbleProvider.calculateRoute(origin, destination, waypoints, vehicleProfile, options);
          result.fallbackTriggered = false;
          this.trimbleCircuit.recordSuccess();
        } catch (err: any) {
          this.trimbleCircuit.recordFailure();
          console.warn(`[RoutingManager] Trimble primary error: ${err.message}. Initiating TomTom fallback.`);
        }
      }

      if (!result && this.tomtomProvider.isConfigured() && this.tomtomCircuit.canExecute()) {
        try {
          result = await this.tomtomProvider.calculateRoute(origin, destination, waypoints, vehicleProfile, options);
          result.fallbackTriggered = true;
          this.tomtomCircuit.recordSuccess();
        } catch (err: any) {
          this.tomtomCircuit.recordFailure();
          console.warn(`[RoutingManager] TomTom fallback error: ${err.message}. Initiating mock fallback.`);
        }
      }
    }

    // Fallback: Safe Mock Commercial Simulator
    if (!result) {
      result = await this.mockProvider.calculateRoute(origin, destination, waypoints, vehicleProfile, options);
      const hadConfiguredLive = this.trimbleProvider.isConfigured() || this.tomtomProvider.isConfigured();
      result.fallbackTriggered = hadConfiguredLive;
      result.mock = true;
    }

    // 5. Store in cache
    await this.saveToCache(cacheKey, result);

    // 6. Log provider used without personal data or coordinates
    console.log(
      `[RoutingManager] Request served by [${result.provider}] (distance: ${result.totalDistanceMiles} mi, fallback: ${result.fallbackTriggered}, mock: ${result.mock}, cached: false)`
    );

    return result;
  }

  /**
   * Fast Commercial Mileage / Distance Calculation
   */
  async getMileage(
    origin: RouteStop,
    destination: RouteStop,
    waypoints: RouteStop[] = [],
    vehicleProfile?: CommercialVehicleProfile
  ): Promise<MileageResult> {
    if (this.trimbleProvider.isConfigured() && this.trimbleCircuit.canExecute()) {
      try {
        const res = await this.trimbleProvider.getMileage(origin, destination, waypoints, vehicleProfile);
        this.trimbleCircuit.recordSuccess();
        console.log(`[RoutingManager] Mileage served by [trimble] (${res.distanceMiles} mi)`);
        return res;
      } catch (err: any) {
        this.trimbleCircuit.recordFailure();
        console.warn(`[RoutingManager] Trimble mileage error: ${err.message}. Falling back to TomTom.`);
      }
    }

    if (this.tomtomProvider.isConfigured() && this.tomtomCircuit.canExecute()) {
      try {
        const res = await this.tomtomProvider.getMileage(origin, destination, waypoints, vehicleProfile);
        this.tomtomCircuit.recordSuccess();
        console.log(`[RoutingManager] Mileage served by [tomtom] (${res.distanceMiles} mi)`);
        return res;
      } catch (err: any) {
        this.tomtomCircuit.recordFailure();
        console.warn(`[RoutingManager] TomTom mileage error: ${err.message}. Falling back to mock.`);
      }
    }

    const res = await this.mockProvider.getMileage(origin, destination, waypoints, vehicleProfile);
    console.log(`[RoutingManager] Mileage served by [mock] (${res.distanceMiles} mi)`);
    return res;
  }

  /**
   * Address & Freight Terminal Geocoding
   */
  async geocode(query: string): Promise<GeocodeResult> {
    if (!query || !query.trim()) {
      throw new Error('Query string cannot be empty');
    }

    // 1. If Google Places is configured, use it for address geocoding
    if (this.googlePlacesProvider.isConfigured()) {
      try {
        return await this.googlePlacesProvider.geocode(query);
      } catch (err: any) {
        // Fall back to Trimble / TomTom / Mock
      }
    }

    // 2. Trimble Maps geocoding
    if (this.trimbleProvider.isConfigured() && this.trimbleCircuit.canExecute()) {
      try {
        const res = await this.trimbleProvider.geocode(query);
        this.trimbleCircuit.recordSuccess();
        return res;
      } catch (err: any) {
        this.trimbleCircuit.recordFailure();
      }
    }

    // 3. TomTom geocoding
    if (this.tomtomProvider.isConfigured() && this.tomtomCircuit.canExecute()) {
      try {
        const res = await this.tomtomProvider.geocode(query);
        this.tomtomCircuit.recordSuccess();
        return res;
      } catch (err: any) {
        this.tomtomCircuit.recordFailure();
      }
    }

    // 4. Mock geocoding fallback
    return this.mockProvider.geocode(query);
  }

  /**
   * Place Search & Autocomplete (Freight Hubs, Warehouses, Truck Stops)
   * Uses Google Places Platform (NOT for truck routing)
   */
  async searchPlaces(query: string, locationBias?: RouteCoordinates): Promise<PlaceSearchResult[]> {
    return this.googlePlacesProvider.searchPlaces(query, locationBias);
  }
}

export const routingManager = new RoutingManager();
