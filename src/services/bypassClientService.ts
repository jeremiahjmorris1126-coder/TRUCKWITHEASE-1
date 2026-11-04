import { apiClient } from './apiClient';
import { offlineSyncService } from './offlineSyncService';

export interface WeighStation {
  id: string;
  name: string;
  state: string;
  highway: string;
  mileMarker: number;
  direction: 'NB' | 'SB' | 'EB' | 'WB' | 'BOTH';
  lat: number;
  lng: number;
  wimEquipped: boolean;
  prePassSupported: boolean;
  drivewyzeSupported: boolean;
  status: 'OPEN' | 'CLOSED' | 'E-SCREENING_ONLY';
  dotFacilityType: 'Scale & Inspection Barn' | 'Port of Entry' | 'Virtual WIM Gantry' | 'Rest Area Checkpoint';
}

export interface BypassCarrierCredentials {
  id: string;
  fleetId: string;
  carrierUsdot: string;
  carrierMc: string;
  companyName: string;
  drivewyzeStatus: 'ACTIVE' | 'PENDING' | 'NOT_ENROLLED';
  drivewyzeAccountId?: string;
  prePassStatus: 'ACTIVE' | 'PENDING' | 'NOT_ENROLLED';
  prePassTransponderId?: string;
  iftaStatus: 'ACTIVE' | 'EXPIRED';
  ucrStatus: 'ACTIVE' | 'EXPIRED';
  issScore: number;
  safetyRating: 'SATISFACTORY' | 'CONDITIONAL' | 'UNRATED';
}

export interface BypassEvaluationResult {
  id: string;
  fleetId: string;
  driverId: string;
  decision: 'BYPASS_APPROVED' | 'PULL_IN_REQUIRED';
  decisionTitle: string;
  decisionReason: string;
  station: WeighStation;
  vehicleWeights: {
    steerLbs: number;
    driveLbs: number;
    trailerLbs: number;
    grossLbs: number;
    maxGrossAllowed: number;
    apuCreditAppliedLbs: number;
    isWeightCompliant: boolean;
  };
  issScore: number;
  issRecommendation: 'PASS' | 'OPTIONAL' | 'INSPECT';
  clearanceToken: string;
  activeProvider: 'Drivewyze PreClear' | 'PrePass' | 'State DOT WIM Direct';
  transponderOrAccountId: string;
  timestamp: string;
}

const LOCAL_STORAGE_CREDENTIALS_KEY = 'twe_bypass_carrier_credentials';

export class BypassClientService {
  /**
   * Retrieves list of real weigh stations along US freight corridors
   */
  async getWeighStations(filter?: { state?: string; highway?: string }): Promise<WeighStation[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.state) params.set('state', filter.state);
      if (filter?.highway) params.set('highway', filter.highway);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<{ success: boolean; stations: WeighStation[] }>(`/api/bypass/stations${query}`);
      return res.stations || [];
    } catch (err) {
      console.warn('[BypassClientService] getWeighStations network fallback:', (err as Error).message);
      return [];
    }
  }

  /**
   * Retrieves carrier bypass credentials, transponder status, and ISS score
   */
  async getCarrierStatus(): Promise<BypassCarrierCredentials> {
    try {
      const res = await apiClient.get<{ success: boolean; credentials: BypassCarrierCredentials }>('/api/bypass/status');
      if (res.credentials) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LOCAL_STORAGE_CREDENTIALS_KEY, JSON.stringify(res.credentials));
        }
        return res.credentials;
      }
    } catch (err) {
      console.warn('[BypassClientService] getCarrierStatus falling back to local cache:', (err as Error).message);
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(LOCAL_STORAGE_CREDENTIALS_KEY);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {
            // ignore
          }
        }
      }
    }

    // Default carrier structure if not yet authenticated
    return {
      id: 'cred-offline',
      fleetId: 'FLEET1',
      carrierUsdot: 'USDOT-3849102',
      carrierMc: 'MC-1092841',
      companyName: 'Apex Continental Express LLC',
      drivewyzeStatus: 'ACTIVE',
      drivewyzeAccountId: 'DW-FLEET1-889104',
      prePassStatus: 'ACTIVE',
      prePassTransponderId: 'PP-TX-99210-A',
      iftaStatus: 'ACTIVE',
      ucrStatus: 'ACTIVE',
      issScore: 18,
      safetyRating: 'SATISFACTORY',
    };
  }

  /**
   * Evaluates Weigh-In-Motion screening at a designated weigh station
   */
  async evaluateBypass(payload: {
    stationId: string;
    vehicleUnit?: string;
    steerLbs?: number;
    driveLbs?: number;
    trailerLbs?: number;
    apuCreditLbs?: number;
  }): Promise<BypassEvaluationResult> {
    try {
      const res = await apiClient.post<{ success: boolean; evaluation: BypassEvaluationResult }>(
        '/api/bypass/evaluate',
        payload
      );
      return res.evaluation;
    } catch (err) {
      console.warn('[BypassClientService] evaluateBypass error:', (err as Error).message);
      throw err;
    }
  }

  /**
   * Registers or updates a carrier or driver PrePass RFID transponder ID
   */
  async registerPrePassTransponder(transponderId: string): Promise<BypassCarrierCredentials> {
    try {
      const res = await apiClient.post<{ success: boolean; credentials: BypassCarrierCredentials }>(
        '/api/prepass/transponder/register',
        { transponderId }
      );
      if (res.credentials && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_CREDENTIALS_KEY, JSON.stringify(res.credentials));
      }
      return res.credentials;
    } catch (err) {
      console.warn('[BypassClientService] registerPrePassTransponder error:', (err as Error).message);
      throw err;
    }
  }

  /**
   * Retrieves historical bypass events
   */
  async getBypassHistory(): Promise<BypassEvaluationResult[]> {
    try {
      const res = await apiClient.get<{ success: boolean; events: BypassEvaluationResult[] }>('/api/bypass/history');
      return res.events || [];
    } catch {
      return [];
    }
  }
}

export const bypassClientService = new BypassClientService();
