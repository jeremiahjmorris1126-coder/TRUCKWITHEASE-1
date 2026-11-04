import { TripWaypoint, TripRoutePlan, CommercialVehicleProfileInput } from '../types';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'truck_with_ease_trip_planner_v2';

export const EMPTY_TRIP_PLAN: TripRoutePlan = {
  id: '',
  title: 'No Active Route Planned',
  origin: '',
  destination: '',
  totalDistanceMiles: 0,
  totalEstHours: 0,
  activeCorridor: 'Pending Commercial Route',
  waypoints: [],
  routingEngine: undefined,
  mock: false,
  turnByTurnSteps: [],
  bridgeClearanceWarnings: [],
};

// Haversine distance in miles
export const calculateDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

export interface PlaceSearchResultItem {
  placeId: string;
  name: string;
  formattedAddress: string;
  coords?: { lat: number; lon: number };
  provider?: string;
}

export interface GeocodeResultItem {
  query: string;
  formattedAddress: string;
  coords: { lat: number; lon: number };
  confidence?: number;
  provider?: string;
}

class TripPlannerService {
  private currentPlan: TripRoutePlan = EMPTY_TRIP_PLAN;
  private listeners: ((plan: TripRoutePlan) => void)[] = [];
  private currentDriverLat: number = 38.805;
  private currentDriverLon: number = -90.652;
  private currentSpeedMph: number = 62;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.currentPlan = JSON.parse(stored);
      } else {
        this.currentPlan = EMPTY_TRIP_PLAN;
      }
    } catch (e) {
      console.warn('Failed to load trip plan from storage:', e);
      this.currentPlan = EMPTY_TRIP_PLAN;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentPlan));
    } catch (e) {
      console.warn('Failed to save trip plan to storage:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.currentPlan }));
  }

  public subscribe(listener: (plan: TripRoutePlan) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.currentPlan });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public setDriverLocationAndSpeed(lat: number, lon: number, speedMph = 62) {
    this.currentDriverLat = lat;
    this.currentDriverLon = lon;
    this.currentSpeedMph = Math.max(15, speedMph);
    this.updateWaypointCalculations();
  }

  private updateWaypointCalculations() {
    if (!this.currentPlan.waypoints || this.currentPlan.waypoints.length === 0) return;

    const updatedWaypoints = this.currentPlan.waypoints.map((wp) => {
      const distanceMiles = calculateDistanceMiles(
        this.currentDriverLat,
        this.currentDriverLon,
        wp.lat,
        wp.lon
      );
      const etaMinutes = Math.round((distanceMiles / Math.max(20, this.currentSpeedMph)) * 60);
      return {
        ...wp,
        distanceMiles,
        etaMinutes,
      };
    });

    updatedWaypoints.sort((a, b) => a.distanceMiles - b.distanceMiles);

    this.currentPlan = {
      ...this.currentPlan,
      waypoints: updatedWaypoints,
    };
    this.saveToStorage();
  }

  public getPlan(): TripRoutePlan {
    return { ...this.currentPlan };
  }

  public clearPlan(): void {
    this.currentPlan = EMPTY_TRIP_PLAN;
    this.saveToStorage();
  }

  /**
   * Search places via server Google Places / Freight Hub Autocomplete
   */
  public async searchPlaces(query: string, bias?: { lat: number; lon: number }): Promise<PlaceSearchResultItem[]> {
    if (!query || !query.trim()) return [];
    try {
      const params = new URLSearchParams({ input: query.trim() });
      if (bias) {
        params.append('lat', String(bias.lat));
        params.append('lon', String(bias.lon));
      }
      const data = await apiClient.get<PlaceSearchResultItem[]>(
        `/api/routing/places/autocomplete?${params.toString()}`,
        { skipUnauthorizedRedirect: true }
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[TripPlannerService] searchPlaces error:', err);
      return [];
    }
  }

  /**
   * Geocode address or postal query via server geocode endpoint
   */
  public async geocode(query: string): Promise<GeocodeResultItem | null> {
    if (!query || !query.trim()) return null;
    try {
      const data = await apiClient.get<GeocodeResultItem>(
        `/api/routing/geocode?q=${encodeURIComponent(query.trim())}`,
        { skipUnauthorizedRedirect: true }
      );
      return data;
    } catch (err) {
      console.warn('[TripPlannerService] geocode error:', err);
      return null;
    }
  }

  /**
   * Retrieve driver's stored commercial vehicle profile from server
   */
  public async getVehicleProfile(): Promise<CommercialVehicleProfileInput | null> {
    try {
      const res = await apiClient.get<{ success: boolean; profile: CommercialVehicleProfileInput }>(
        '/api/routing/vehicle-profile',
        { skipUnauthorizedRedirect: true }
      );
      return res?.profile || null;
    } catch (err) {
      console.warn('[TripPlannerService] getVehicleProfile error:', err);
      return null;
    }
  }

  /**
   * Save driver's commercial vehicle profile to server
   */
  public async saveVehicleProfile(profile: CommercialVehicleProfileInput): Promise<boolean> {
    try {
      await apiClient.post('/api/routing/vehicle-profile', profile);
      return true;
    } catch (err) {
      console.error('[TripPlannerService] saveVehicleProfile error:', err);
      throw err;
    }
  }

  public addWaypoint(newWp: Omit<TripWaypoint, 'id' | 'distanceMiles' | 'etaMinutes'>): TripWaypoint {
    const distanceMiles = calculateDistanceMiles(
      this.currentDriverLat,
      this.currentDriverLon,
      newWp.lat,
      newWp.lon
    );
    const etaMinutes = Math.round((distanceMiles / Math.max(20, this.currentSpeedMph)) * 60);

    const wp: TripWaypoint = {
      ...newWp,
      id: `wp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      distanceMiles,
      etaMinutes,
    };

    const newWaypoints = [...(this.currentPlan.waypoints || []), wp];
    newWaypoints.sort((a, b) => a.distanceMiles - b.distanceMiles);

    this.currentPlan = {
      ...this.currentPlan,
      waypoints: newWaypoints,
    };
    this.saveToStorage();
    return wp;
  }

  public removeWaypoint(id: string): boolean {
    const initialLen = this.currentPlan.waypoints?.length || 0;
    const filtered = (this.currentPlan.waypoints || []).filter((w) => w.id !== id);
    if (filtered.length !== initialLen) {
      this.currentPlan = {
        ...this.currentPlan,
        waypoints: filtered,
      };
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Dispatch route calculation request to backend Commercial Engine (Trimble -> TomTom -> Mock)
   */
  public async calculateCommercialEngineRoute(
    origin: { label: string; coords: { lat: number; lon: number } },
    destination: { label: string; coords: { lat: number; lon: number } },
    vehicleProfile?: CommercialVehicleProfileInput
  ): Promise<TripRoutePlan> {
    const waypointsPayload = (this.currentPlan.waypoints || []).map((wp) => ({
      coords: { lat: wp.lat, lon: wp.lon },
      label: wp.name,
    }));

    const bodyPayload = {
      origin: { coords: origin.coords, label: origin.label },
      destination: { coords: destination.coords, label: destination.label },
      waypoints: waypointsPayload,
      vehicle: {
        heightFt: vehicleProfile?.heightFt || 13.5,
        weightLbs: vehicleProfile?.weightLbs || 80000,
        lengthFt: vehicleProfile?.lengthFt || 53.0,
        widthFt: vehicleProfile?.widthFt || 8.5,
        axles: vehicleProfile?.axles || 5,
        hazmatClass: vehicleProfile?.hazmatClass || 'None',
        avoidTolls: vehicleProfile?.avoidTolls || false,
      },
    };

    const routeData = await apiClient.post<any>('/api/routing/calculate', bodyPayload);

    const plan: TripRoutePlan = {
      id: routeData.routeId || `route-${Date.now()}`,
      title: `${origin.label} → ${destination.label}`,
      origin: origin.label,
      destination: destination.label,
      originCoords: origin.coords,
      destinationCoords: destination.coords,
      totalDistanceMiles: routeData.totalDistanceMiles || 0,
      totalEstHours: parseFloat(((routeData.totalTimeMinutes || 0) / 60).toFixed(1)),
      activeCorridor: routeData.summaryTitle || `${origin.label} Corridor`,
      waypoints: this.currentPlan.waypoints || [],
      routingEngine: routeData.provider,
      mock: routeData.mock === true || routeData.provider === 'mock',
      fallbackTriggered: routeData.fallbackTriggered || false,
      tollDistanceMiles: routeData.tollDistanceMiles || 0,
      estimatedTollCostUsd: routeData.estimatedTollCostUsd || 0,
      bridgeWarningsCount: routeData.bridgeClearanceWarnings?.length || 0,
      bridgeClearanceWarnings: routeData.bridgeClearanceWarnings || [],
      turnByTurnSteps: routeData.turnByTurnSteps || [],
      cached: routeData.cached || false,
    };

    this.currentPlan = plan;
    this.saveToStorage();
    return { ...this.currentPlan };
  }
}

export const tripPlannerService = new TripPlannerService();
