import { TripWaypoint, TripRoutePlan } from '../types';
import { MOCK_TRIP_PLAN, INITIAL_WAYPOINTS } from '../data/mockTripData';

const STORAGE_KEY = 'truck_with_ease_trip_planner_v1';

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

class TripPlannerService {
  private currentPlan: TripRoutePlan = MOCK_TRIP_PLAN;
  private listeners: ((plan: TripRoutePlan) => void)[] = [];
  private currentDriverLat: number = 38.805;
  private currentDriverLon: number = -90.652;
  private currentSpeedMph: number = 62;

  constructor() {
    this.loadFromStorage();
    this.updateWaypointCalculations();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.currentPlan = JSON.parse(stored);
      } else {
        this.currentPlan = MOCK_TRIP_PLAN;
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Failed to load trip plan from storage:', e);
      this.currentPlan = MOCK_TRIP_PLAN;
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

    // Sort waypoints by distance from current location
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

    const newWaypoints = [...this.currentPlan.waypoints, wp];
    newWaypoints.sort((a, b) => a.distanceMiles - b.distanceMiles);

    this.currentPlan = {
      ...this.currentPlan,
      waypoints: newWaypoints,
    };
    this.saveToStorage();
    return wp;
  }

  public removeWaypoint(id: string): boolean {
    const initialLen = this.currentPlan.waypoints.length;
    const filtered = this.currentPlan.waypoints.filter((w) => w.id !== id);
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

  public resetToDefault(): TripRoutePlan {
    this.currentPlan = MOCK_TRIP_PLAN;
    this.updateWaypointCalculations();
    return { ...this.currentPlan };
  }
}

export const tripPlannerService = new TripPlannerService();
