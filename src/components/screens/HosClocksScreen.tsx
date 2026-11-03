import React, { useState, useEffect } from 'react';
import { DutyStatus, InspectionActionType, InspectionTriggerSource, HosCalculatedClocks } from '../../types';
import { HosDailyLogPdfModal } from '../HosDailyLogPdfModal';
import { RodsPullModal } from '../RodsPullModal';
import { DvirManagementModal } from '../DvirManagementModal';
import { RoadsideOfficerShieldModal } from '../RoadsideOfficerShieldModal';
import { crossFunctionMemoryService } from '../../services/crossFunctionMemoryService';

interface HosClocksScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  speed: number;
  onRecordInspection?: (
    actionType: InspectionActionType,
    triggerSource: InspectionTriggerSource,
    notes: string
  ) => void;
  onOpenErodsTagAlong?: () => void;
}

export const HosClocksScreen: React.FC<HosClocksScreenProps> = ({
  onShowToast,
  speed,
  onRecordInspection,
  onOpenErodsTagAlong,
}) => {
  // Live HOS Clocks from Central Cross-Function Memory Service
  const [clocks, setClocks] = useState<HosCalculatedClocks>(() =>
    crossFunctionMemoryService.getHosClocks()
  );

  // Split-sleeper simulator states
  const [splitPeriod1, setSplitPeriod1] = useState<number>(7.2);
  const [splitPeriod2, setSplitPeriod2] = useState<number>(2.8);

  // Modals State
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isPullRodsOpen, setIsPullRodsOpen] = useState<boolean>(false);
  const [isDvirModalOpen, setIsDvirModalOpen] = useState<boolean>(false);
  const [isOfficerShieldOpen, setIsOfficerShieldOpen] = useState<boolean>(false);

  // Subscribe to Cross-Function Central Memory
  useEffect(() => {
    return crossFunctionMemoryService.subscribe((snapshot) => {
      setClocks(snapshot.hos);
    });
  }, []);

  const formatHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStatusChange = (newStatus: DutyStatus) => {
    if (newStatus === clocks.currentStatus) return;
    const updated = crossFunctionMemoryService.setDutyStatus(newStatus);
    setClocks(updated);

    const labels: Record<DutyStatus, string> = {
      D: 'STATUS: DRIVING (D) • 11-HOUR CLOCK RUNNING',
      ON: 'STATUS: ON-DUTY NOT DRIVING (ON)',
      SB: 'STATUS: SLEEPER BERTH (SB) • REST ACCUMULATING',
      OFF: 'STATUS: OFF-DUTY (OFF)',
      YM: 'STATUS: YARD MOVE (YM) • 32 MPH CAP',
      PC: 'STATUS: PERSONAL CONVEYANCE (PC)',
    };
    onShowToast(labels[newStatus], 'timer');
  };

  const handleToggleAdverse = () => {
    const updated = crossFunctionMemoryService.toggleAdverseDrivingConditions();
    setClocks(updated);
    if (updated.isAdverseDrivingActive) {
      onShowToast('ADVERSE DRIVING EXCEPTION ACTIVATED (+2H DRIVE / +2H SHIFT // 49 CFR § 395.1(b))', 'warning');
    } else {
      onShowToast('ADVERSE DRIVING EXCEPTION DEACTIVATED // STANDARD 11H/14H RESTORED', 'check_circle');
    }
  };

  const handleSimulateRestart = () => {
    const updated = crossFunctionMemoryService.simulate34HourRestart();
    setClocks(updated);
    onShowToast('34-HOUR CONSECUTIVE REST COMPLETED // 70-HOUR CYCLE RESET TO 70:00:00', 'verified');
  };

  const handleApplySplitSleeper = () => {
    const result = crossFunctionMemoryService.calculateSplitSleeper(splitPeriod1, splitPeriod2);
    onShowToast(`SPLIT SLEEPER: ${result.message}`, result.pairMatched ? 'verified' : 'info');
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-2 sm:px-4 pb-20 space-y-4 font-mono select-none">
      {/* 1. TOP HERO COMMAND BAR (Signature Tactical Yellow & Deep Obsidian) */}
      <div className="bg-[#05080E] p-4 sm:p-5 rounded-2xl border-2 border-[#FFE500]/60 shadow-[0_0_25px_rgba(255,229,0,0.18)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500] shrink-0 shadow-[0_0_12px_rgba(255,229,0,0.3)]">
            <span className="material-symbols-outlined text-[30px]">hourglass_top</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Space_Grotesk'] text-base sm:text-xl font-black uppercase tracking-wider text-white">
                HOURS OF SERVICE CLOCKS &amp; FEDERAL RECORDS
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                FMCSA 49 CFR PART 395
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Pull RODS • Split-Berth Engine • Electronic &amp; Scanned DVIR (Part 396) • Roadside Shield
            </p>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            id="pull-rods-header-btn"
            onClick={() => setIsPullRodsOpen(true)}
            className="btn-tactical-yellow px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
            title="Pull 8-Day FMCSA Record of Duty Status"
          >
            <span className="material-symbols-outlined text-[16px]">view_timeline</span>
            <span>Pull RODS</span>
          </button>

          <button
            id="create-dvir-header-btn"
            onClick={() => setIsDvirModalOpen(true)}
            className="btn-tactical-yellow px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
            title="Create or Scan DVIR (49 CFR § 396.11)"
          >
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            <span>DVIR Console</span>
          </button>

          <button
            id="officer-shield-header-btn"
            onClick={() => setIsOfficerShieldOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-surface-container-high text-[#FFE500] border border-[#FFE500]/50 text-xs font-black uppercase hover:bg-surface-container-highest transition flex items-center gap-1.5 cursor-pointer shadow-md"
            title="1-Tap Roadside Inspection Officer Shield"
          >
            <span className="material-symbols-outlined text-[16px]">local_police</span>
            <span>DOT Officer Shield</span>
          </button>

          {onOpenErodsTagAlong && (
            <button
              onClick={onOpenErodsTagAlong}
              className="px-3 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
              title="FMCSA Tag-a-Long ERoDS Scanner"
            >
              <span className="material-symbols-outlined text-[16px]">document_scanner</span>
              <span>ERoDS</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsExportModalOpen(true);
              onShowToast('GENERATING 24-HOUR HOS OFFICIAL RECORD PDF', 'picture_as_pdf');
              if (onRecordInspection) {
                onRecordInspection('PDF_GENERATED', 'MANUAL_HUD', 'Driver requested 24-Hour Official HOS Log PDF.');
              }
            }}
            className="px-3 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
            title="Export signed PDF"
          >
            <span className="material-symbols-outlined text-[16px] text-red-400">picture_as_pdf</span>
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME DUTY STATUS SWITCHBOARD */}
      <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFE500] animate-pulse" />
            <span className="text-xs font-black text-[#FFE500] uppercase tracking-wider">
              FMCSA Duty Status Switchboard (Active: {clocks.currentStatus})
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {speed > 5 ? `VEHICLE IN MOTION (${speed} MPH)` : 'STATIONARY (ZERO SPEED)'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { id: 'D', label: 'DRIVING', code: 'D', color: 'bg-[#FFE500] text-black font-black' },
            { id: 'ON', label: 'ON DUTY', code: 'ON', color: 'bg-emerald-500 text-black font-black' },
            { id: 'SB', label: 'SLEEPER', code: 'SB', color: 'bg-indigo-400 text-black font-black' },
            { id: 'OFF', label: 'OFF DUTY', code: 'OFF', color: 'bg-slate-300 text-black font-black' },
            { id: 'YM', label: 'YARD MOVE', code: 'YM', color: 'bg-amber-400 text-black font-black' },
            { id: 'PC', label: 'PERS. CONV.', code: 'PC', color: 'bg-purple-400 text-black font-black' },
          ].map((item) => {
            const isSelected = clocks.currentStatus === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleStatusChange(item.id as DutyStatus)}
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                  isSelected
                    ? `${item.color} shadow-[0_0_15px_rgba(255,229,0,0.4)] border-[#FFE500] scale-102`
                    : 'bg-[#05080E] text-slate-400 hover:text-white border-[#1E2532] hover:border-slate-600'
                }`}
              >
                <span className="text-xl font-black leading-none">{item.code}</span>
                <span className="text-[9px] tracking-wider uppercase text-center truncate w-full font-bold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Regulatory Exception Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1E2532] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleAdverse}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer flex items-center gap-1.5 ${
                clocks.isAdverseDrivingActive
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-[#05080E] text-slate-300 border border-slate-700 hover:border-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">warning</span>
              <span>Adverse Driving (+2h Exception)</span>
            </button>

            <button
              onClick={handleSimulateRestart}
              className="px-3 py-1.5 rounded-lg bg-[#05080E] text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/10 text-xs font-bold uppercase transition cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span>Execute 34-Hour Restart</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Split-Sleeper: <strong className="text-emerald-400">{clocks.splitSleeperStatus.pairMatched ? 'QUALIFIED PAIR' : 'PENDING'}</strong>
          </span>
        </div>
      </div>

      {/* 3. THE 4 PRECISION FMCSA COMPLIANCE CLOCKS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 11-Hour Drive Limit */}
        <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              11-Hour Driving Clock (§ 395.3(a)(3))
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              clocks.drivingSecondsRemaining < 3600
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                : 'bg-[#FFE500]/15 text-[#FFE500]'
            }`}>
              {Math.round((clocks.drivingSecondsRemaining / (11 * 3600)) * 100)}% REMAINING
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${
              clocks.drivingSecondsRemaining < 3600 ? 'text-red-400' : 'text-[#FFE500]'
            }`}>
              {formatHMS(clocks.drivingSecondsRemaining)}
            </span>
            <span className="text-[11px] text-slate-400">
              LIMIT: {clocks.isAdverseDrivingActive ? '13:00:00 (ADVERSE)' : '11:00:00'}
            </span>
          </div>

          <div className="w-full bg-[#05080E] h-2.5 rounded-full overflow-hidden border border-[#1E2532]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                clocks.drivingSecondsRemaining < 3600 ? 'bg-red-500' : 'bg-[#FFE500]'
              }`}
              style={{ width: `${Math.min(100, (clocks.drivingSecondsRemaining / (11 * 3600)) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 pt-1">
            <span>Driven: 04h 15m 48s</span>
            <span className="text-emerald-400 font-bold">0 Violations</span>
          </div>
        </div>

        {/* 14-Hour Duty Window */}
        <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              14-Hour On-Duty Shift Window (§ 395.3(a)(2))
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              SPLIT EXTENDED
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
              {formatHMS(clocks.dutyWindowSecondsRemaining)}
            </span>
            <span className="text-[11px] text-slate-400">LIMIT: 14:00:00</span>
          </div>

          <div className="w-full bg-[#05080E] h-2.5 rounded-full overflow-hidden border border-[#1E2532]">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (clocks.dutyWindowSecondsRemaining / (14 * 3600)) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 pt-1">
            <span>Window Paused by Sleeper Split</span>
            <span className="text-emerald-400 font-bold">Compliant</span>
          </div>
        </div>

        {/* 30-Minute Rest Break Clock */}
        <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              30-Minute Rest Break Rule (§ 395.3(a)(3)(ii))
            </span>
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">
              check_circle
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl sm:text-3xl font-black text-[#FFE500] tracking-tight font-mono">
              {formatHMS(clocks.restBreakSecondsRemaining)}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              UNTIL 30-MIN BREAK DUE
            </span>
          </div>

          <div className="w-full bg-[#05080E] h-2.5 rounded-full overflow-hidden border border-[#1E2532]">
            <div
              className="bg-[#FFE500] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (clocks.restBreakSecondsRemaining / (8 * 3600)) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 pt-1">
            <span>Consecutive Driving Since Break: 03h 45m</span>
            <span className="text-slate-300">Next break at truck stop / rest area</span>
          </div>
        </div>

        {/* 70-Hour / 8-Day Cycle */}
        <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              70-Hour / 8-Day Rolling Cycle (§ 395.3(b))
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
              CYCLE ACTIVE
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              {formatHMS(clocks.cycleSecondsRemaining)}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">OF 70:00:00</span>
          </div>

          <div className="w-full bg-[#05080E] h-2.5 rounded-full overflow-hidden border border-[#1E2532]">
            <div
              className="bg-blue-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (clocks.cycleSecondsRemaining / (70 * 3600)) * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 pt-1">
            <span>Used: {Math.round(clocks.cycleUsedSeconds / 3600)}h / Remaining: {Math.round(clocks.cycleSecondsRemaining / 3600)}h</span>
            <span className="text-[#FFE500] font-bold">Midnight Gain: +08h 55m</span>
          </div>
        </div>
      </div>

      {/* 4. SPLIT-SLEEPER BERTH OPTIMIZER (49 CFR § 395.1(g)) */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500] text-[20px]">
              hotel
            </span>
            <span className="text-xs font-black text-[#FFE500] uppercase tracking-wider">
              49 CFR § 395.1(g) Split Sleeper Berth Calculator
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
            FMCSA RULE COMPLIANT
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Pair a 7/3, 8/2, or 7.5/2.5 period to pause the 14-hour clock. Neither period counts against your 14-hour driving window when paired correctly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-[#05080E] p-3 rounded-xl border border-[#1E2532] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 uppercase font-bold">Qualifying Period 1 (Sleeper Berth)</span>
              <span className="text-[#FFE500] font-bold font-mono">{splitPeriod1.toFixed(1)} Hours</span>
            </div>
            <input
              type="range"
              min="7.0"
              max="10.0"
              step="0.1"
              value={splitPeriod1}
              onChange={(e) => setSplitPeriod1(parseFloat(e.target.value))}
              className="w-full accent-[#FFE500] cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">
              Minimum 7.0 consecutive hours spent in sleeper berth
            </span>
          </div>

          <div className="bg-[#05080E] p-3 rounded-xl border border-[#1E2532] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 uppercase font-bold">Qualifying Period 2 (Rest / Berth)</span>
              <span className="text-[#FFE500] font-bold font-mono">{splitPeriod2.toFixed(1)} Hours</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="3.0"
              step="0.1"
              value={splitPeriod2}
              onChange={(e) => setSplitPeriod2(parseFloat(e.target.value))}
              className="w-full accent-[#FFE500] cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">
              Minimum 2.0 consecutive hours (Combined total &ge; 10.0h)
            </span>
          </div>
        </div>

        <div className="bg-[#05080E] p-3 rounded-xl border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-emerald-400 block">
              Total Rest: {(splitPeriod1 + splitPeriod2).toFixed(1)} Hours &bull; {clocks.splitSleeperStatus.message}
            </span>
            <span className="text-slate-400 text-[11px]">
              Pauses 14-Hour window by {splitPeriod1.toFixed(1)} hours without counting against shift limits.
            </span>
          </div>

          <button
            onClick={handleApplySplitSleeper}
            className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shrink-0"
          >
            Lock Split Rest Calculation
          </button>
        </div>
      </div>

      {/* 5. 8-DAY HISTORICAL HOS RECAP TABLE */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#FFE500] uppercase tracking-wider">
            8-Day Rolling Hours Recap &amp; Midnight Recapture
          </span>
          <span className="text-[11px] text-slate-400">70H / 8-DAY CYCLE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-[#1E2532] text-slate-400 text-[10px] uppercase">
                <th className="py-2 px-2">Shift Date</th>
                <th className="py-2 px-2">Drive Hours</th>
                <th className="py-2 px-2">On-Duty Total</th>
                <th className="py-2 px-2">70h Cumulative</th>
                <th className="py-2 px-2">Gain at 00:00</th>
                <th className="py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2532]/60 font-mono">
              <tr className="bg-[#FFE500]/5 font-bold">
                <td className="py-2 px-2 text-[#FFE500]">Day 1 (Today)</td>
                <td className="py-2 px-2 text-white">06h 45m</td>
                <td className="py-2 px-2 text-slate-300">08h 30m</td>
                <td className="py-2 px-2 text-[#FFE500]">37h 45m Used</td>
                <td className="py-2 px-2 text-emerald-400">+08h 55m</td>
                <td className="py-2 px-2 text-emerald-400">COMPLIANT</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-slate-300">Day 2 (Yesterday)</td>
                <td className="py-2 px-2 text-slate-300">08h 12m</td>
                <td className="py-2 px-2 text-slate-300">10h 06m</td>
                <td className="py-2 px-2 text-slate-300">29h 15m</td>
                <td className="py-2 px-2 text-emerald-400">+07h 15m</td>
                <td className="py-2 px-2 text-emerald-400">COMPLIANT</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-slate-400">Day 3</td>
                <td className="py-2 px-2 text-slate-400">07h 30m</td>
                <td className="py-2 px-2 text-slate-400">09h 18m</td>
                <td className="py-2 px-2 text-slate-400">19h 09m</td>
                <td className="py-2 px-2 text-emerald-400">+09h 10m</td>
                <td className="py-2 px-2 text-emerald-400">COMPLIANT</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-slate-400">Day 4</td>
                <td className="py-2 px-2 text-slate-400">09h 00m</td>
                <td className="py-2 px-2 text-slate-400">11h 12m</td>
                <td className="py-2 px-2 text-slate-400">09h 51m</td>
                <td className="py-2 px-2 text-emerald-400">+04h 30m</td>
                <td className="py-2 px-2 text-emerald-400">COMPLIANT</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      <RodsPullModal
        isOpen={isPullRodsOpen}
        onClose={() => setIsPullRodsOpen(false)}
        onShowToast={onShowToast}
      />

      <DvirManagementModal
        isOpen={isDvirModalOpen}
        onClose={() => setIsDvirModalOpen(false)}
        onShowToast={onShowToast}
      />

      <RoadsideOfficerShieldModal
        isOpen={isOfficerShieldOpen}
        onClose={() => setIsOfficerShieldOpen(false)}
        onShowToast={onShowToast}
        onOpenPullRods={() => {
          setIsOfficerShieldOpen(false);
          setIsPullRodsOpen(true);
        }}
        onOpenDvirModal={() => {
          setIsOfficerShieldOpen(false);
          setIsDvirModalOpen(true);
        }}
      />

      <HosDailyLogPdfModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onDownloaded={() => {
          onShowToast('OFFICIAL 24H HOS LOG EXPORTED & RECORDED', 'picture_as_pdf');
          if (onRecordInspection) {
            onRecordInspection(
              'PRINTED',
              'OFFICER_REQUEST',
              'Official 24-Hour HOS Log PDF downloaded/printed for roadside inspection.'
            );
          }
        }}
      />
    </div>
  );
};
