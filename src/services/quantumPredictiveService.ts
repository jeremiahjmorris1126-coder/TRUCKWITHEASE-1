export interface QuantumPhysicsResponse {
  status: string;
  engine: string;
  timestamp: string;
  physics: {
    kineticEnergyJoules: number;
    brakeRotorTempEstF: number;
    entropyIndex: number;
    coherenceRatio: number;
    phaseAngleDegrees: number;
    recommendedBrakeDissipationKw: number;
  };
}

export interface QuantumHosResponse {
  status: string;
  engine: string;
  timestamp: string;
  hosOptimization: {
    recommendedBreakWindowMins: number;
    fatigueProbabilityScore: number;
    optimalSleeperSplitHours: string;
    complianceRisk: string;
  };
}

export interface QuantumFunctionsCatalog {
  status: string;
  platform: string;
  timestamp: string;
  activeAlgorithms: Array<{
    name: string;
    endpoint: string;
    type: string;
  }>;
  systemHealth: {
    backendLatencyMs: number;
    quantumRegistersActive: number;
    coherenceScore: number;
  };
}

export const quantumPredictiveService = {
  // 1. Resolve predictive state eigenstate
  async resolveState(speedMph: number = 65, grossWeightLbs: number = 76220, routeCorridor: string = 'I-20') {
    try {
      const res = await fetch('/api/predictive/resolve-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMph, grossWeightLbs, routeCorridor }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to call predictive state resolution:', err);
      return null;
    }
  },

  // 2. Run fleet load annealing solver
  async runAnnealing(numStops: number = 4, maxAxleWeightLbs: number = 34000) {
    try {
      const res = await fetch('/api/predictive/anneal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numStops, maxAxleWeightLbs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to run load annealing solver:', err);
      return null;
    }
  },

  // 3. Calculate quantum kinetic & thermal physics
  async calculatePhysics(speedMph: number = 65, oilTempF: number = 195, defLevel: number = 78, axleWeightLbs: number = 76220): Promise<QuantumPhysicsResponse | null> {
    try {
      const res = await fetch('/api/quantum/telemetry-physics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMph, oilTempF, defLevel, axleWeightLbs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to calculate quantum physics:', err);
      return null;
    }
  },

  // 4. Optimize HOS duty cycle using quantum annealer
  async optimizeHos(driveTimeRemainingMins: number = 320, dutyTimeRemainingMins: number = 540): Promise<QuantumHosResponse | null> {
    try {
      const res = await fetch('/api/quantum/hos-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveTimeRemainingMins, dutyTimeRemainingMins }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to optimize HOS quantum schedule:', err);
      return null;
    }
  },

  // 5. Fetch catalog of all active quantum & predictive functions
  async getCatalog(): Promise<QuantumFunctionsCatalog | null> {
    try {
      const res = await fetch('/api/quantum/all-functions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch quantum functions catalog:', err);
      return null;
    }
  },
};
