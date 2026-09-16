export interface MemorySnapshot {
  id: string;
  timestamp: string;
  usedHeapMb: number;
  totalHeapMb: number;
  heapLimitMb: number;
  domNodeCount: number;
  fps: number;
  canBusLatencyMs: number;
  memoryHealthScore: number;
  leakProbability: number;
  activeRoute: string;
}

export interface PerformanceOptimization {
  id: string;
  timestamp: string;
  actionType: 'GC_DOM_PRUNE' | 'BUFFER_FLUSH' | 'DEBOUNCE_THROTTLE' | 'CAN_BUS_RATE_LIMIT';
  description: string;
  memorySavedMb: number;
  appliedState: 'SUCCESS' | 'ACTIVE';
}

export interface MemoryStatsResponse {
  latestSnapshot: MemorySnapshot;
  aggregatedStats: {
    totalSnapshotsRecorded: number;
    avgUsedHeapMb: number;
    peakHeapMb: number;
    totalMemorySavedMb: number;
    optimizationsAppliedCount: number;
  };
  recentLogs: MemorySnapshot[];
  appliedOptimizations: PerformanceOptimization[];
}

export interface DriverAlertnessData {
  alertnessScore: number; // 0 to 100
  blinkRatePerMin?: number;
  steeringMicroCorrections?: number;
  laneDriftEvents?: number;
  driveHours?: number;
  hardBrakingEvents?: number;
  speedMph?: number;
  idleMinutes?: number;
}

export interface ActionableDirective {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SAFETY_BREAK' | 'CRUISE_CALIBRATION' | 'SCHEDULE_SHIFT' | 'IDLE_SHUTDOWN';
  title: string;
  description: string;
  expectedFuelSavingsGal: number;
  riskReductionPercent: number;
}

export interface QuantumPredictiveFleetReport {
  timestamp: string;
  driverAlertnessIndex: number; // 0-100
  fatigueProbability: number; // 0.0 - 1.0
  reactionDelayMs: number;
  statisticalConfidencePercent: number;
  quantumPredictiveEfficiencyScore: number; // 0-100
  expectedFuelWasteRateGalPer100Mi: number;
  actionableDirectives: ActionableDirective[];
  modelCoherence: number;
}

// Client Memory Tracker API wrapper
export const memoryPerformanceService = {
  // Post real-time memory telemetry to backend
  async trackSnapshot(data: {
    usedHeapMb?: number;
    totalHeapMb?: number;
    heapLimitMb?: number;
    domNodeCount?: number;
    fps?: number;
    canBusLatencyMs?: number;
    activeRoute?: string;
  }) {
    try {
      // Collect client browser performance if performance.memory is available
      let heapUsed = data.usedHeapMb;
      let heapTotal = data.totalHeapMb;
      let heapLimit = data.heapLimitMb;

      if (typeof window !== 'undefined' && (performance as any).memory) {
        const mem = (performance as any).memory;
        heapUsed = parseFloat((mem.usedJSHeapSize / (1024 * 1024)).toFixed(2));
        heapTotal = parseFloat((mem.totalJSHeapSize / (1024 * 1024)).toFixed(2));
        heapLimit = parseFloat((mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(2));
      }

      const domCount = data.domNodeCount || (typeof document !== 'undefined' ? document.querySelectorAll('*').length : 380);

      const res = await fetch('/api/memory/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usedHeapMb: heapUsed || 42.5,
          totalHeapMb: heapTotal || 88.0,
          heapLimitMb: heapLimit || 512.0,
          domNodeCount: domCount,
          fps: data.fps || 60,
          canBusLatencyMs: data.canBusLatencyMs || 1.1,
          activeRoute: data.activeRoute || 'Cockpit',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend memory tracking endpoint fallback:', err);
      return null;
    }
  },

  // Fetch memory stats & applied optimizations history
  async getMemoryStats(): Promise<MemoryStatsResponse | null> {
    try {
      const res = await fetch('/api/memory/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch backend memory stats:', err);
      return null;
    }
  },

  // Apply manual memory performance optimization pass
  async applyOptimization(actionType: string = 'GC_DOM_PRUNE', targetScope: string = 'ALL_MODULES') {
    try {
      const res = await fetch('/api/memory/apply-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, targetScope }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to trigger backend memory optimization:', err);
      return null;
    }
  },

  // Process driver alertness & performance data using quantum predictive statistical modeling
  async processQuantumPredictiveAnalytics(data: DriverAlertnessData): Promise<QuantumPredictiveFleetReport | null> {
    try {
      const res = await fetch('/api/memory/quantum-predictive-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to run quantum predictive analytics report:', err);
      return null;
    }
  },

  // Get the latest stored quantum predictive efficiency report
  async getLatestEfficiencyReport(): Promise<QuantumPredictiveFleetReport | null> {
    try {
      const res = await fetch('/api/memory/quantum-predictive-report');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch quantum predictive report:', err);
      return null;
    }
  },
};

