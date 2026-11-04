import { fleetStore, CallerIdentity, TenantAccessError } from '../data/fleetStore';
import crypto from 'node:crypto';

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
  issScore: number; // 1-100 (1-49: PASS, 50-74: OPTIONAL, 75-100: INSPECT)
  safetyRating: 'SATISFACTORY' | 'CONDITIONAL' | 'UNRATED';
}

export interface BypassEvaluationRequest {
  stationId: string;
  vehicleUnit?: string;
  steerLbs?: number;
  driveLbs?: number;
  trailerLbs?: number;
  apuCreditLbs?: number;
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

// Canonical high-volume weigh stations along major US freight corridors
export const CORRIDOR_WEIGH_STATIONS: WeighStation[] = [
  {
    id: 'ws-tx-01',
    name: 'New Braunfels Inspection Facility',
    state: 'TX',
    highway: 'I-35',
    mileMarker: 184,
    direction: 'NB',
    lat: 29.703,
    lng: -98.124,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-tx-02',
    name: 'Mount Pleasant Eastbound Weigh Station',
    state: 'TX',
    highway: 'I-30',
    mileMarker: 162,
    direction: 'EB',
    lat: 33.155,
    lng: -94.968,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-il-01',
    name: 'Effingham Eastbound DOT Inspection Station',
    state: 'IL',
    highway: 'I-70',
    mileMarker: 94,
    direction: 'EB',
    lat: 39.121,
    lng: -88.543,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-il-02',
    name: 'South Beloit Port of Entry & Scale',
    state: 'IL',
    highway: 'I-90 / I-39',
    mileMarker: 3,
    direction: 'EB',
    lat: 42.486,
    lng: -89.034,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Port of Entry',
  },
  {
    id: 'ws-in-01',
    name: 'Chesterton Commercial Inspection Complex',
    state: 'IN',
    highway: 'I-94',
    mileMarker: 24,
    direction: 'EB',
    lat: 41.611,
    lng: -87.051,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-oh-01',
    name: 'Amherst Virtual WIM Gantry & Scale Complex',
    state: 'OH',
    highway: 'I-80 / I-90',
    mileMarker: 140,
    direction: 'EB',
    lat: 41.398,
    lng: -82.225,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Virtual WIM Gantry',
  },
  {
    id: 'ws-ca-01',
    name: 'Banning Scales (San Gorgonio Pass)',
    state: 'CA',
    highway: 'I-10',
    mileMarker: 101,
    direction: 'WB',
    lat: 33.926,
    lng: -116.876,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-fl-01',
    name: 'Yulee I-95 Southbound Inspection Station',
    state: 'FL',
    highway: 'I-95',
    mileMarker: 377,
    direction: 'SB',
    lat: 30.632,
    lng: -81.605,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'OPEN',
    dotFacilityType: 'Scale & Inspection Barn',
  },
  {
    id: 'ws-mo-01',
    name: 'Joplin I-44 Weigh Station',
    state: 'MO',
    highway: 'I-44',
    mileMarker: 4,
    direction: 'EB',
    lat: 37.084,
    lng: -94.513,
    wimEquipped: true,
    prePassSupported: true,
    drivewyzeSupported: true,
    status: 'CLOSED',
    dotFacilityType: 'Scale & Inspection Barn',
  },
];

// Seed initial carrier credentials for FLEET1 and FLEET2
const INITIAL_CARRIER_CREDENTIALS: BypassCarrierCredentials[] = [
  {
    id: 'bypass-cred-fleet1',
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
    issScore: 18, // 18 = Low risk, automatic PASS under 49 CFR
    safetyRating: 'SATISFACTORY',
  },
  {
    id: 'bypass-cred-fleet2',
    fleetId: 'FLEET2',
    carrierUsdot: 'USDOT-4910291',
    carrierMc: 'MC-2194012',
    companyName: 'Vanguard Freightways LLC',
    drivewyzeStatus: 'ACTIVE',
    drivewyzeAccountId: 'DW-FLEET2-441203',
    prePassStatus: 'NOT_ENROLLED',
    iftaStatus: 'ACTIVE',
    ucrStatus: 'ACTIVE',
    issScore: 42, // PASS
    safetyRating: 'SATISFACTORY',
  },
];

for (const cred of INITIAL_CARRIER_CREDENTIALS) {
  fleetStore.seedMockData('bypass_credentials', cred.id, cred);
}

export class BypassService {
  /**
   * Retrieves list of corridor weigh stations, optionally filtered by state or highway
   */
  public getWeighStations(filter?: { state?: string; highway?: string }): WeighStation[] {
    let results = [...CORRIDOR_WEIGH_STATIONS];
    if (filter?.state) {
      const stateUpper = filter.state.toUpperCase().trim();
      results = results.filter((ws) => ws.state.toUpperCase() === stateUpper);
    }
    if (filter?.highway) {
      const hwUpper = filter.highway.toUpperCase().trim();
      results = results.filter((ws) => ws.highway.toUpperCase().includes(hwUpper));
    }
    return results;
  }

  /**
   * Retrieves a weigh station by ID
   */
  public getWeighStationById(stationId: string): WeighStation | null {
    return CORRIDOR_WEIGH_STATIONS.find((ws) => ws.id === stationId) || null;
  }

  /**
   * Retrieves the carrier bypass credentials and ISS safety score for the caller's fleet
   */
  public async getCarrierCredentials(caller: CallerIdentity): Promise<BypassCarrierCredentials> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }

    const effectiveFleetId = caller.fleetId || 'FLEET1';
    const docId = `bypass-cred-${effectiveFleetId.toLowerCase()}`;
    const cred = await fleetStore.getScopedDocument<BypassCarrierCredentials>(caller, 'bypass_credentials', docId);

    if (cred) {
      return cred;
    }

    // Default fallback carrier credentials for new or unregistered fleets
    return {
      id: docId,
      fleetId: effectiveFleetId,
      carrierUsdot: 'USDOT-UNKNOWN',
      carrierMc: 'MC-UNKNOWN',
      companyName: 'Fleet Carrier Unassigned',
      drivewyzeStatus: 'NOT_ENROLLED',
      prePassStatus: 'NOT_ENROLLED',
      iftaStatus: 'ACTIVE',
      ucrStatus: 'ACTIVE',
      issScore: 50,
      safetyRating: 'UNRATED',
    };
  }

  /**
   * Evaluates a real-time Weigh-In-Motion (WIM) bypass adjudication
   * Enforces 49 CFR Axle weights (Steer 12,500, Drive 34,000, Trailer 34,000, Gross 80,000)
   * plus clean APU credit (up to 400 lbs) and FMCSA ISS Safety Score rules.
   */
  public async evaluateBypass(
    caller: CallerIdentity,
    req: BypassEvaluationRequest
  ): Promise<BypassEvaluationResult> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }

    const station = this.getWeighStationById(req.stationId);
    if (!station) {
      throw new TenantAccessError(`Weigh station ${req.stationId} not found in corridor registry.`, 404);
    }

    const cred = await this.getCarrierCredentials(caller);

    // Default realistic weights if not supplied by onboard sensors
    const steerLbs = req.steerLbs ?? 11800;
    const driveLbs = req.driveLbs ?? 32400;
    const trailerLbs = req.trailerLbs ?? 32200;
    const apuCreditLbs = Math.min(Math.max(req.apuCreditLbs ?? 400, 0), 400); // Max 400 lbs certified APU
    const grossLbs = steerLbs + driveLbs + trailerLbs;
    const maxGrossAllowed = 80000 + apuCreditLbs;

    const isWeightCompliant =
      steerLbs <= 12500 &&
      driveLbs <= 34000 &&
      trailerLbs <= 34000 &&
      grossLbs <= maxGrossAllowed;

    // FMCSA ISS Algorithm:
    // 1 - 49: PASS
    // 50 - 74: OPTIONAL (requires good standing credentials)
    // 75 - 100: INSPECT (mandatory pull-in)
    const issScore = cred.issScore;
    const issRecommendation: 'PASS' | 'OPTIONAL' | 'INSPECT' =
      issScore <= 49 ? 'PASS' : issScore <= 74 ? 'OPTIONAL' : 'INSPECT';

    // Provider determination
    let activeProvider: 'Drivewyze PreClear' | 'PrePass' | 'State DOT WIM Direct' = 'State DOT WIM Direct';
    let transponderOrAccountId = 'UNENROLLED';

    if (cred.drivewyzeStatus === 'ACTIVE' && station.drivewyzeSupported) {
      activeProvider = 'Drivewyze PreClear';
      transponderOrAccountId = cred.drivewyzeAccountId || 'DW-ACTIVE';
    } else if (cred.prePassStatus === 'ACTIVE' && station.prePassSupported) {
      activeProvider = 'PrePass';
      transponderOrAccountId = cred.prePassTransponderId || 'PP-ACTIVE';
    }

    const hasActiveBypassSubscription =
      activeProvider === 'Drivewyze PreClear' || activeProvider === 'PrePass';

    // Clearance logic
    let decision: 'BYPASS_APPROVED' | 'PULL_IN_REQUIRED' = 'PULL_IN_REQUIRED';
    let decisionTitle = 'PULL IN — PREPARE TO ENTER WEIGH STATION';
    let decisionReason = '';

    if (station.status === 'CLOSED') {
      decision = 'BYPASS_APPROVED';
      decisionTitle = 'BYPASS APPROVED — STATION CLOSED';
      decisionReason = `${station.name} is currently closed. Maintain highway cruising speed.`;
    } else if (!isWeightCompliant) {
      decision = 'PULL_IN_REQUIRED';
      decisionTitle = 'PULL IN — AXLE OVERWEIGHT DETECTED';
      if (grossLbs > maxGrossAllowed) {
        decisionReason = `Gross weight ${grossLbs.toLocaleString()} lbs exceeds legal maximum of ${maxGrossAllowed.toLocaleString()} lbs (+${apuCreditLbs} lb APU credit).`;
      } else if (driveLbs > 34000) {
        decisionReason = `Drive tandem ${driveLbs.toLocaleString()} lbs exceeds 34,000 lb legal axle rating.`;
      } else if (trailerLbs > 34000) {
        decisionReason = `Trailer tandem ${trailerLbs.toLocaleString()} lbs exceeds 34,000 lb legal axle rating.`;
      } else {
        decisionReason = `Steer axle ${steerLbs.toLocaleString()} lbs exceeds 12,500 lb rating.`;
      }
    } else if (issRecommendation === 'INSPECT') {
      decision = 'PULL_IN_REQUIRED';
      decisionTitle = 'PULL IN — MANDATORY CVSA INSPECTION REQUIRED';
      decisionReason = `Carrier ISS Safety Score is ${issScore} (Threshold >= 75 requires roadside inspection per 49 CFR).`;
    } else if (!hasActiveBypassSubscription) {
      decision = 'PULL_IN_REQUIRED';
      decisionTitle = 'PULL IN — NO ACTIVE BYPASS TRANSPONDER/SUBSCRIPTION';
      decisionReason = `Vehicle is weight-compliant, but carrier is not actively enrolled in Drivewyze PreClear or PrePass for ${station.state}.`;
    } else {
      // Full clearance granted
      decision = 'BYPASS_APPROVED';
      decisionTitle = 'BYPASS APPROVED — PROCEED AT HIGHWAY SPEED';
      decisionReason = `${activeProvider} verified credentials (${transponderOrAccountId}) and WIM axle weights (${grossLbs.toLocaleString()} lbs). ISS Score ${issScore} (PASS).`;
    }

    const clearanceToken =
      decision === 'BYPASS_APPROVED'
        ? `DW-BYPASS-${station.state}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        : `DW-PULLIN-${station.state}-${Date.now().toString(36).toUpperCase()}`;

    const result: BypassEvaluationResult = {
      id: `ev-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      fleetId: caller.fleetId || 'FLEET1',
      driverId: caller.uid,
      decision,
      decisionTitle,
      decisionReason,
      station,
      vehicleWeights: {
        steerLbs,
        driveLbs,
        trailerLbs,
        grossLbs,
        maxGrossAllowed,
        apuCreditAppliedLbs: apuCreditLbs,
        isWeightCompliant,
      },
      issScore,
      issRecommendation,
      clearanceToken,
      activeProvider,
      transponderOrAccountId,
      timestamp: new Date().toISOString(),
    };

    // Store audit event in fleetStore under multi-tenant isolation
    await fleetStore.createScopedDocument(caller, 'scale_bypass_events', result, result.id);

    return result;
  }

  /**
   * Updates or registers a carrier or driver PrePass RFID transponder ID
   */
  public async updatePrePassTransponder(
    caller: CallerIdentity,
    transponderId: string
  ): Promise<BypassCarrierCredentials> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }
    const cleanId = transponderId ? transponderId.trim() : '';
    if (!cleanId) {
      throw new TenantAccessError('Valid PrePass transponder ID is required.', 400);
    }
    const effectiveFleetId = caller.fleetId || 'FLEET1';
    const docId = `bypass-cred-${effectiveFleetId.toLowerCase()}`;
    const cred = await this.getCarrierCredentials(caller);
    cred.prePassStatus = 'ACTIVE';
    cred.prePassTransponderId = cleanId;
    fleetStore.seedMockData('bypass_credentials', docId, cred);
    return cred;
  }

  /**
   * Lists historical bypass adjudication events for the caller's fleet
   */
  public async listBypassHistory(caller: CallerIdentity): Promise<BypassEvaluationResult[]> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }
    const docs = await fleetStore.listScopedCollection<BypassEvaluationResult>(caller, 'scale_bypass_events');
    return docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const bypassService = new BypassService();
