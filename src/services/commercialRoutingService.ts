/**
 * TruckWithEase // Client Commercial Routing Service
 * Handles live calls to TomTom Truck Routing and Trimble MAPS / PC*MILER APIs
 */

import type {
  TomTomTruckRouteRequest,
  TomTomTruckRouteResponse,
  TrimblePcMilerRouteRequest,
  TrimblePcMilerRouteResponse,
  CommercialRoutingProvidersStatus,
  CommercialNavigationProvider,
} from '../types';

const STORAGE_KEY_ENGINE = 'truck_active_nav_engine';

class CommercialRoutingService {
  private activeEngine: CommercialNavigationProvider = 'TOMTOM_TRUCK';
  private listeners: ((engine: CommercialNavigationProvider) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_ENGINE);
        if (stored === 'TOMTOM_TRUCK' || stored === 'TRIMBLE_PCMILER' || stored === 'FHWA_RADAR_54B') {
          this.activeEngine = stored;
        }
      } catch (e) {}
    }
  }

  public getActiveEngine(): CommercialNavigationProvider {
    return this.activeEngine;
  }

  public setActiveEngine(engine: CommercialNavigationProvider) {
    this.activeEngine = engine;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ENGINE, engine);
      } catch (e) {}
    }
    this.listeners.forEach((l) => l(engine));
  }

  public subscribeEngine(listener: (engine: CommercialNavigationProvider) => void): () => void {
    this.listeners.push(listener);
    listener(this.activeEngine);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Request route calculation via TomTom Commercial Truck API
   */
  public async getTomTomRoute(req?: Partial<TomTomTruckRouteRequest>): Promise<TomTomTruckRouteResponse> {
    const payload: TomTomTruckRouteRequest = {
      origin: req?.origin || { lat: 32.7767, lng: -96.7970, address: 'DFW Logistics Staging Hub' },
      destination: req?.destination || { lat: 33.7490, lng: -84.3880, address: 'Atlanta Terminal Dock D-04' },
      vehicleProfile: req?.vehicleProfile || {
        heightFt: 13.5,
        widthInches: 102,
        lengthFt: 53.0,
        grossWeightLbs: 80000,
        axles: 5,
        isCommercial: true,
        hazmatClass: 'NONE',
      },
      routeType: req?.routeType || 'FASTEST',
      avoidTolls: req?.avoidTolls || false,
    };

    const res = await fetch('/api/navigation/tomtom/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`TomTom Truck Routing error: HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Request route calculation via Trimble MAPS / PC*MILER
   */
  public async getTrimblePcMilerRoute(req?: Partial<TrimblePcMilerRouteRequest>): Promise<TrimblePcMilerRouteResponse> {
    const payload: TrimblePcMilerRouteRequest = {
      origin: req?.origin || { lat: 32.7767, lng: -96.7970, address: 'DFW Logistics Staging Hub' },
      destination: req?.destination || { lat: 33.7490, lng: -84.3880, address: 'Atlanta Terminal Dock D-04' },
      routingType: req?.routingType || 'PRACTICAL',
      vehicleProfile: req?.vehicleProfile || {
        heightFt: 13.5,
        widthInches: 102,
        lengthFt: 53.0,
        grossWeightLbs: 80000,
        axles: 5,
        isCommercial: true,
        hazmatClass: 'NONE',
      },
      computeIftaJurisdictionSplits: true,
    };

    const res = await fetch('/api/navigation/trimble/pcmiler-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Trimble PC*MILER error: HTTP ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Fetch current status of commercial navigation providers
   */
  public async getProvidersStatus(): Promise<CommercialRoutingProvidersStatus> {
    const res = await fetch('/api/navigation/providers');
    if (!res.ok) {
      throw new Error(`Failed to fetch provider status: HTTP ${res.status}`);
    }
    return await res.json();
  }
}

export const commercialRoutingService = new CommercialRoutingService();
