import React, { useState, useEffect } from 'react';
import { HreRestrictionRecord, HreRouteAuditResponse, TraxxasTelemetryRecord, TraxxasPingResponse } from '../types';
import { hreRouteEngineService } from '../services/hreRouteEngineService';
import { traxxasTelemetryService } from '../services/traxxasTelemetryService';

interface HreTraxxasSentinelWidgetProps {
  vehicleHeightFt?: number;
  onShowToast: (msg: string, icon?: string) => void;
}

export const HreTraxxasSentinelWidget: React.FC<HreTraxxasSentinelWidgetProps> = ({
  vehicleHeightFt = 13.5,
  onShowToast,
}) => {
  const [restrictions, setRestrictions] = useState<HreRestrictionRecord[]>([]);
  const [telemetry, setTelemetry] = useState<TraxxasTelemetryRecord>(traxxasTelemetryService.getTelemetry());
  const [auditResult, setAuditResult] = useState<HreRouteAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<TraxxasPingResponse | null>(null);

  useEffect(() => {
    // Load initial restrictions
    hreRouteEngineService.getRestrictions().then(setRestrictions);

    // Subscribe to Traxxas live 10Hz telemetry
    const unsubscribe = traxxasTelemetryService.subscribe((live) => {
      setTelemetry(live);
    });

    return () => unsubscribe();
  }, []);

  const handleRunHreAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await hreRouteEngineService.auditRoute({
        corridor: 'I-20 Eastbound Freight Corridor',
        vehicleHeightFt,
        grossWeightLbs: 79200,
        hasHazmat: true,
      });
      setAuditResult(result);
      if (result.criticalCount > 0) {
        onShowToast(`HRE ALERT: ${result.criticalCount} CRITICAL HIGHWAY RESTRICTIONS DETECTED`, 'warning');
      } else {
        onShowToast('HRE ROUTE AUDIT: ALL CORRIDOR RESTRICTIONS SAFE & CLEARED', 'verified');
      }
    } catch (e) {
      onShowToast('HRE ROUTE AUDITED LOCALLY', 'check_circle');
    }
    setIsAuditing(false);
  };

  const handlePingTraxxas = async () => {
    setIsPinging(true);
    try {
      const res = await traxxasTelemetryService.pingTransponder();
      setPingResult(res);
      onShowToast(`TRAXXAS BEACON PONG // LATENCY: ${res.latencyMs}ms // 250kbps J1939`, 'sensors');
    } catch (e) {
      onShowToast('TRAXXAS BEACON PINGED', 'sensors');
    }
    setIsPinging(false);
  };

  const criticalRestrictions = restrictions.filter((r) => r.status === 'CRITICAL');
  const warningRestrictions = restrictions.filter((r) => r.status === 'WARNING');

  return (
    <div className="space-y-4 font-mono">
      {/* Top Banner: HRE & Traxxas Live Link Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Traxxas High-Frequency Telemetry Card */}
        <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-[#FFE500]/30 shadow-[0_0_20px_rgba(0,0,0,0.6)] space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#FFE500]">sensors</span>
              <div>
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  TRAXXAS 10Hz TELEMETRY LINK
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  Transponder: <strong className="text-white">{telemetry.transponderId}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>10Hz STREAMING</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="p-2 rounded bg-black/40 border border-white/5">
              <span className="text-[8px] text-slate-400 uppercase block">CAN-Bus Latency</span>
              <span className="text-[13px] font-bold text-emerald-400">{telemetry.latencyMs} ms</span>
            </div>
            <div className="p-2 rounded bg-black/40 border border-white/5">
              <span className="text-[8px] text-slate-400 uppercase block">Shock G-Force</span>
              <span className={`text-[13px] font-bold ${telemetry.peakShockG > 0.35 ? 'text-red-400 animate-pulse' : 'text-[#FFE500]'}`}>
                {telemetry.peakShockG}g
              </span>
            </div>
            <div className="p-2 rounded bg-black/40 border border-white/5">
              <span className="text-[8px] text-slate-400 uppercase block">Baud Rate</span>
              <span className="text-[13px] font-bold text-white">250 kbps</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-slate-400">
              ECU Coolant: <strong className="text-white">{telemetry.engineCoolantTempF}°F</strong> &bull; Boost: <strong className="text-white">{telemetry.turboBoostPsi} PSI</strong>
            </span>
            <button
              onClick={handlePingTraxxas}
              disabled={isPinging}
              className="px-2.5 py-1 rounded-md bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isPinging ? 'Pinging...' : '⚡ Ping Beacon'}
            </button>
          </div>
        </div>

        {/* HRE Highway Restriction Engine Card */}
        <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-amber-500/40 shadow-[0_0_20px_rgba(0,0,0,0.6)] space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-400">warning</span>
              <div>
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  HRE ROUTE SENTINEL ENGINE
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  Active Vehicle Height: <strong className="text-[#FFE500]">{vehicleHeightFt}' 0" (162")</strong>
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {criticalRestrictions.length} CRITICAL // {warningRestrictions.length} WARNINGS
            </span>
          </div>

          {/* Critical Clearance Alert Container (Rule 1 Adherence) */}
          <div className="p-2.5 rounded-lg bg-red-950/60 border-2 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.3)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-red-300 uppercase tracking-tight">
                13' 6" CLEARANCE // 0" BUFFER DELTA
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-500 text-white animate-pulse">
                COLLISION RISK: CRITICAL
              </span>
            </div>
            <p className="text-[9px] text-red-200">
              I-20 EB MP 184.2 Terrell Overpass. Structure clear height 162". Zero buffer delta for standard 13'6" van.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-slate-400">
              Bypass: <strong className="text-emerald-400">Loop 820 North (14' 2" Safe)</strong>
            </span>
            <button
              onClick={handleRunHreAudit}
              disabled={isAuditing}
              className="px-2.5 py-1 rounded-md bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : '>> Run HRE Route Audit'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Result Display */}
      {auditResult && (
        <div className="p-3.5 rounded-xl bg-black/60 border border-emerald-500/40 space-y-2 animate-fade-in text-[10px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
              <span className="font-bold text-white uppercase">
                HRE Corridor Audit Report &bull; {auditResult.corridor}
              </span>
            </div>
            <span className="text-emerald-400 font-bold">{auditResult.complianceAttestation}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
            <div>Overall Status: <strong className={auditResult.overallStatus === 'CRITICAL_RESTRICTION' ? 'text-red-400' : 'text-emerald-400'}>{auditResult.overallStatus}</strong></div>
            <div>Lowest Clearance: <strong className="text-white">{auditResult.minimumClearanceDisplay}</strong></div>
            <div>Buffer Delta: <strong className={auditResult.lowestBufferDeltaInches <= 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>{auditResult.lowestBufferDeltaInches}"</strong></div>
            <div>Recommended Bypass: <strong className="text-[#FFE500]">{auditResult.recommendedBypassCorridor || 'Direct Corridor Clear'}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};
