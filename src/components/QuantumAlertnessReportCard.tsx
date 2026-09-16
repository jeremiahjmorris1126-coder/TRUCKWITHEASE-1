import React, { useState, useEffect } from 'react';
import {
  memoryPerformanceService,
  QuantumPredictiveFleetReport,
  DriverAlertnessData,
} from '../services/memoryPerformanceService';

interface QuantumAlertnessReportCardProps {
  currentSpeedMph?: number;
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

export const QuantumAlertnessReportCard: React.FC<QuantumAlertnessReportCardProps> = ({
  currentSpeedMph = 65,
  onShowToast,
  onRecordInspectionLog,
}) => {
  const [report, setReport] = useState<QuantumPredictiveFleetReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Driver state inputs for statistical modeling
  const [alertnessScore, setAlertnessScore] = useState<number>(88);
  const [driveHours, setDriveHours] = useState<number>(5.5);
  const [hardBrakingEvents, setHardBrakingEvents] = useState<number>(2);
  const [laneDriftEvents, setLaneDriftEvents] = useState<number>(1);
  const [idleMinutes, setIdleMinutes] = useState<number>(12);

  const fetchLatestReport = async () => {
    setIsLoading(true);
    const data: DriverAlertnessData = {
      alertnessScore,
      blinkRatePerMin: Math.round(14 + (100 - alertnessScore) * 0.25),
      steeringMicroCorrections: Math.round(18 + driveHours * 3),
      laneDriftEvents,
      driveHours,
      hardBrakingEvents,
      speedMph: currentSpeedMph,
      idleMinutes,
    };

    const result = await memoryPerformanceService.processQuantumPredictiveAnalytics(data);
    if (result) {
      setReport(result);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLatestReport();
  }, [currentSpeedMph]);

  const handleRunModelPass = async () => {
    await fetchLatestReport();
    onShowToast('QUANTUM PREDICTIVE STATISTICAL MODEL EXECUTED // REPORT GENERATED', 'analytics');
  };

  const handleLogReportToVault = () => {
    if (!report) return;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const notes = `QUANTUM PREDICTIVE FLEET EFFICIENCY REPORT // Timestamp: ${timestamp} // Driver Alertness Index: ${report.driverAlertnessIndex}/100 // Fatigue Prob: ${(report.fatigueProbability * 100).toFixed(1)}% // Reaction Delay: ${report.reactionDelayMs}ms // Efficiency Score: ${report.quantumPredictiveEfficiencyScore}/100 // Fuel Waste Rate: ${report.expectedFuelWasteRateGalPer100Mi} Gal/100mi // Directives Logged: ${report.actionableDirectives.length} items. Attested by Jonathan Vance (CDL IL-98104820).`;

    if (onRecordInspectionLog) {
      onRecordInspectionLog('ROADSIDE_AUDIT', 'QUANTUM_INDEX_AUDIT', notes);
    }
    onShowToast('QUANTUM EFFICIENCY REPORT LOGGED TO HSM VAULT', 'lock');
  };

  return (
    <div className="bg-surface-container p-space-md rounded-xl border border-primary/40 shadow-xl space-y-4 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">insights</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                TRUCKWITHEASE Quantum Predictive Analytics
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                STATISTICAL MODEL ENGINE
              </span>
            </div>
            <span className="text-[10px] text-outline font-mono block">
              Driver alertness profiling, reaction delay metrics &amp; actionable fleet efficiency reports
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleRunModelPass}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">autorenew</span>
            <span>{isLoading ? 'Computing...' : 'Recalculate Report'}</span>
          </button>

          <button
            onClick={handleLogReportToVault}
            className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Log Report to Vault</span>
          </button>
        </div>
      </div>

      {/* Interactive Drivers Statistical Input Controls */}
      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2 text-[11px]">
        <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">
          DRIVER ALERTNESS &amp; DRIVING PERFORMANCE STATISTICAL INPUTS
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Driver Alertness Slider */}
          <div className="space-y-1 p-2 rounded-lg bg-surface-container-low border border-surface-container-high">
            <span className="text-[9px] text-outline uppercase block font-bold">Driver Alertness Index</span>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-emerald-400">{alertnessScore}/100</span>
              <input
                type="range"
                min="50"
                max="100"
                value={alertnessScore}
                onChange={(e) => setAlertnessScore(parseInt(e.target.value))}
                className="w-20 accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Continuous Drive Hours */}
          <div className="space-y-1 p-2 rounded-lg bg-surface-container-low border border-surface-container-high">
            <span className="text-[9px] text-outline uppercase block font-bold">Continuous Drive Hours</span>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-sky-400">{driveHours} hrs</span>
              <input
                type="range"
                min="0.5"
                max="11.0"
                step="0.5"
                value={driveHours}
                onChange={(e) => setDriveHours(parseFloat(e.target.value))}
                className="w-20 accent-sky-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Hard Braking Events */}
          <div className="space-y-1 p-2 rounded-lg bg-surface-container-low border border-surface-container-high">
            <span className="text-[9px] text-outline uppercase block font-bold">Hard Deceleration Spikes</span>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-amber-400">{hardBrakingEvents} events</span>
              <input
                type="range"
                min="0"
                max="8"
                value={hardBrakingEvents}
                onChange={(e) => setHardBrakingEvents(parseInt(e.target.value))}
                className="w-20 accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Idle Duration */}
          <div className="space-y-1 p-2 rounded-lg bg-surface-container-low border border-surface-container-high">
            <span className="text-[9px] text-outline uppercase block font-bold">Engine Idle Duration</span>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-primary">{idleMinutes} mins</span>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={idleMinutes}
                onChange={(e) => setIdleMinutes(parseInt(e.target.value))}
                className="w-20 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Model Output Statistical Grid */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm text-[11px]">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">PREDICTIVE EFFICIENCY SCORE</span>
            <span className="text-[22px] font-bold text-primary block">
              {report.quantumPredictiveEfficiencyScore}/100
            </span>
            <span className="text-[9px] text-emerald-400 block">
              Confidence: {report.statisticalConfidencePercent}%
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">FATIGUE PROBABILITY MODEL</span>
            <span className={`text-[22px] font-bold block ${
              report.fatigueProbability > 0.35 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {(report.fatigueProbability * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] text-outline block">
              Reaction Delay: {report.reactionDelayMs} ms
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">ESTIMATED FUEL WASTE RATE</span>
            <span className="text-[22px] font-bold text-amber-400 block">
              {report.expectedFuelWasteRateGalPer100Mi} Gal
            </span>
            <span className="text-[9px] text-outline block">per 100 Miles Traveled</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">MODEL COHERENCE INDEX</span>
            <span className="text-[22px] font-bold text-sky-400 block">
              {(report.modelCoherence * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] text-outline block">
              Algorithm: Sigmoid Logistic
            </span>
          </div>
        </div>
      )}

      {/* Actionable Directives List */}
      {report && report.actionableDirectives && report.actionableDirectives.length > 0 && (
        <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2.5">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
            <span className="text-[11px] font-bold text-primary uppercase">
              ACTIONABLE FLEET EFFICIENCY &amp; SAFETY DIRECTIVES
            </span>
            <span className="text-[9px] text-outline">
              {report.actionableDirectives.length} ACTIVE DIRECTIVE(S)
            </span>
          </div>

          <div className="space-y-2">
            {report.actionableDirectives.map((dir) => (
              <div
                key={dir.id}
                className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      dir.priority === 'HIGH'
                        ? 'bg-error/20 text-error border border-error/40'
                        : dir.priority === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {dir.priority} PRIORITY
                    </span>
                    <span className="font-bold text-on-surface text-[12px]">{dir.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-400 font-bold">+{dir.expectedFuelSavingsGal} Gal Saved</span>
                    <span className="text-sky-400 font-bold">-{dir.riskReductionPercent}% Risk</span>
                  </div>
                </div>
                <p className="text-[10px] text-outline leading-relaxed">{dir.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
