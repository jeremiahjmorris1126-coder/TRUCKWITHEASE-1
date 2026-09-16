import { US_STATE_DOT_REGULATIONS, StateDotRegulation } from '../data/stateRegulationsData';

export interface StateGeolocationState {
  stateCode: string;
  stateData: StateDotRegulation;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  currentSpeedMph: number;
  isGpsActive: boolean;
  gpsPermissionStatus: 'GRANTED' | 'DENIED' | 'PROMPTING' | 'SIMULATED';
  lastUpdatedTimestamp: string;
  isSpeeding: boolean;
  speedDeltaMph: number;
}

type Listener = (state: StateGeolocationState) => void;

// Geofence Bounding Boxes for US States (Freight Corridors)
interface StateBounds {
  code: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

const STATE_BOUNDS: StateBounds[] = [
  { code: 'IL', minLat: 36.97, maxLat: 42.50, minLng: -91.51, maxLng: -87.50, centerLat: 40.0, centerLng: -89.0 },
  { code: 'TX', minLat: 25.84, maxLat: 36.50, minLng: -106.65, maxLng: -93.51, centerLat: 31.0, centerLng: -99.0 },
  { code: 'IN', minLat: 37.77, maxLat: 41.76, minLng: -88.09, maxLng: -84.78, centerLat: 39.8, centerLng: -86.1 },
  { code: 'OH', minLat: 38.40, maxLat: 41.98, minLng: -84.82, maxLng: -80.52, centerLat: 40.2, centerLng: -82.9 },
  { code: 'LA', minLat: 28.92, maxLat: 33.02, minLng: -94.04, maxLng: -88.81, centerLat: 31.0, centerLng: -92.0 },
  { code: 'MO', minLat: 35.99, maxLat: 40.61, minLng: -95.77, maxLng: -89.10, centerLat: 38.5, centerLng: -92.5 },
  { code: 'PA', minLat: 39.72, maxLat: 42.27, minLng: -80.52, maxLng: -74.69, centerLat: 40.8, centerLng: -77.8 },
  { code: 'CA', minLat: 32.53, maxLat: 42.00, minLng: -124.41, maxLng: -114.13, centerLat: 36.7, centerLng: -119.4 },
  { code: 'GA', minLat: 30.36, maxLat: 35.00, minLng: -85.61, maxLng: -80.84, centerLat: 32.8, centerLng: -83.6 },
  { code: 'FL', minLat: 24.52, maxLat: 31.00, minLng: -87.63, maxLng: -80.03, centerLat: 27.8, centerLng: -81.7 },
  { code: 'NY', minLat: 40.50, maxLat: 45.02, minLng: -79.76, maxLng: -71.86, centerLat: 43.0, centerLng: -75.5 },
  { code: 'TN', minLat: 34.98, maxLat: 36.68, minLng: -90.31, maxLng: -81.65, centerLat: 35.8, centerLng: -86.3 },
  { code: 'MI', minLat: 41.69, maxLat: 48.30, minLng: -90.42, maxLng: -82.41, centerLat: 44.3, centerLng: -85.4 },
  { code: 'WI', minLat: 42.49, maxLat: 47.08, minLng: -92.89, maxLng: -86.25, centerLat: 44.5, centerLng: -89.5 },
];

class StateGeolocationService {
  private currentState: StateGeolocationState;
  private listeners: Set<Listener> = new Set();
  private watchId: number | null = null;

  constructor() {
    const defaultStateCode = 'IL';
    const defaultData = US_STATE_DOT_REGULATIONS[defaultStateCode];

    this.currentState = {
      stateCode: defaultStateCode,
      stateData: defaultData,
      latitude: 41.8781, // Default Chicago IL
      longitude: -87.6298,
      accuracyMeters: 15,
      currentSpeedMph: 65,
      isGpsActive: false,
      gpsPermissionStatus: 'PROMPTING',
      lastUpdatedTimestamp: new Date().toLocaleTimeString(),
      isSpeeding: false,
      speedDeltaMph: 0,
    };
  }

  // Get active state snapshot
  public getState(): StateGeolocationState {
    return { ...this.currentState };
  }

  // Subscribe to state changes
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('Error in StateGeolocationService subscriber:', e);
      }
    });
  }

  // Resolve State Code from Lat/Long
  public resolveStateFromCoordinates(lat: number, lng: number): string {
    // Check bounding boxes
    for (const bounds of STATE_BOUNDS) {
      if (lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng) {
        return bounds.code;
      }
    }

    // Nearest centroid fallback using Euclidean distance
    let closestCode = 'IL';
    let minDistance = Infinity;

    for (const bounds of STATE_BOUNDS) {
      const d = Math.pow(lat - bounds.centerLat, 2) + Math.pow(lng - bounds.centerLng, 2);
      if (d < minDistance) {
        minDistance = d;
        closestCode = bounds.code;
      }
    }

    return closestCode;
  }

  // Start real browser GPS Geolocation watching
  public startGpsTracking(): void {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      console.warn('Geolocation API is not available in this browser environment.');
      this.currentState.gpsPermissionStatus = 'DENIED';
      this.notifyListeners();
      return;
    }

    if (this.watchId !== null) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const speedMph = speed !== null && speed > 0 ? Math.round(speed * 2.23694) : this.currentState.currentSpeedMph;
        
        this.updatePositionAndState(latitude, longitude, speedMph, accuracy, 'GRANTED');
      },
      (error) => {
        console.warn('Geolocation position watch error:', error.message);
        this.currentState.gpsPermissionStatus = 'DENIED';
        this.currentState.isGpsActive = false;
        this.notifyListeners();
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      }
    );
  }

  public stopGpsTracking(): void {
    if (this.watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.currentState.isGpsActive = false;
    this.notifyListeners();
  }

  // Update vehicle speed dynamically from CAN-Bus telemetry or UI speed slider
  public updateCurrentSpeed(speedMph: number): void {
    const isSpeeding = speedMph > this.currentState.stateData.truckSpeedLimitMph;
    const speedDeltaMph = Math.max(0, speedMph - this.currentState.stateData.truckSpeedLimitMph);

    this.currentState = {
      ...this.currentState,
      currentSpeedMph: speedMph,
      isSpeeding,
      speedDeltaMph,
      lastUpdatedTimestamp: new Date().toLocaleTimeString(),
    };
    this.notifyListeners();
  }

  // Internal helper to process updated lat/lng and map to DOT state
  public updatePositionAndState(
    lat: number,
    lng: number,
    speedMph: number,
    accuracyMeters: number | null = 10,
    permissionStatus: 'GRANTED' | 'DENIED' | 'PROMPTING' | 'SIMULATED' = 'GRANTED'
  ): void {
    const detectedCode = this.resolveStateFromCoordinates(lat, lng);
    const stateData = US_STATE_DOT_REGULATIONS[detectedCode] || US_STATE_DOT_REGULATIONS['IL'];

    const isSpeeding = speedMph > stateData.truckSpeedLimitMph;
    const speedDeltaMph = Math.max(0, speedMph - stateData.truckSpeedLimitMph);

    this.currentState = {
      stateCode: detectedCode,
      stateData,
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lng.toFixed(4)),
      accuracyMeters,
      currentSpeedMph: speedMph,
      isGpsActive: permissionStatus === 'GRANTED' || permissionStatus === 'SIMULATED',
      gpsPermissionStatus: permissionStatus,
      lastUpdatedTimestamp: new Date().toLocaleTimeString(),
      isSpeeding,
      speedDeltaMph,
    };

    this.notifyListeners();

    // Async reverse-geocoding validation call if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.address && data.address['ISO3166-2-lvl4']) {
            const isoCode = data.address['ISO3166-2-lvl4'].replace('US-', '').toUpperCase();
            if (isoCode && US_STATE_DOT_REGULATIONS[isoCode] && isoCode !== this.currentState.stateCode) {
              const validatedData = US_STATE_DOT_REGULATIONS[isoCode];
              this.currentState = {
                ...this.currentState,
                stateCode: isoCode,
                stateData: validatedData,
                isSpeeding: speedMph > validatedData.truckSpeedLimitMph,
                speedDeltaMph: Math.max(0, speedMph - validatedData.truckSpeedLimitMph),
              };
              this.notifyListeners();
            }
          }
        })
        .catch(() => {
          // Silently fallback to bounding box calculation
        });
    }
  }

  // Simulate entering a specific state code (e.g. crossing into California or Texas)
  public simulateStateCode(stateCode: string, overrideSpeedMph?: number): void {
    const stateData = US_STATE_DOT_REGULATIONS[stateCode] || US_STATE_DOT_REGULATIONS['IL'];
    const bounds = STATE_BOUNDS.find((b) => b.code === stateCode);
    const lat = bounds ? bounds.centerLat : 41.8781;
    const lng = bounds ? bounds.centerLng : -87.6298;

    const speedMph = overrideSpeedMph !== undefined ? overrideSpeedMph : this.currentState.currentSpeedMph;

    this.updatePositionAndState(lat, lng, speedMph, 5, 'SIMULATED');
  }
}

export const stateGeolocationService = new StateGeolocationService();
