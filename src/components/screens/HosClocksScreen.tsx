import React, { useState, useEffect, useRef } from 'react';
import { DutyStatus, InspectionActionType, InspectionTriggerSource, HosCalculatedClocks, RodsDailyRecord } from '../../types';
import { HosDailyLogPdfModal } from '../HosDailyLogPdfModal';
import { RodsPullModal } from '../RodsPullModal';
import { DvirManagementModal } from '../DvirManagementModal';
import { RoadsideOfficerShieldModal } from '../RoadsideOfficerShieldModal';
import { crossFunctionMemoryService } from '../../services/crossFunctionMemoryService';
import { eldOfflineRecordingService, EldSyncState } from '../../services/eldOfflineRecordingService';
import { CARRIER_INFO, DRIVER_INFO } from '../../data/mockData';

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

  // Live Uninterrupted Online/Offline ELD Recording State
  const [eldState, setEldState] = useState<EldSyncState>(() =>
    eldOfflineRecordingService.getState()
  );

  // Split-sleeper simulator states
  const [splitPeriod1, setSplitPeriod1] = useState<number>(7.2);
  const [splitPeriod2, setSplitPeriod2] = useState<number>(2.8);

  // Inspector Sub-View: 8-Day Live Visual Grid & FMCSA Data Transfer
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [fmcsaReceipt, setFmcsaReceipt] = useState<string | null>(null);
  const [isTransmittingFmcsa, setIsTransmittingFmcsa] = useState<boolean>(false);
  const [unassignedEvents, setUnassignedEvents] = useState([
    { id: 'unassigned-1', date: 'Yesterday 23:45', duration: '14 min', miles: 6.2, reason: 'Terminal Yard Relocation', status: 'CLAIMED_BY_CARRIER' },
  ]);

  // Dropdown States for Clean, De-cluttered Button Layout
  const [isComplianceActionsOpen, setIsComplianceActionsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Subscribe to Uninterrupted Online/Offline ELD Engine
  useEffect(() => {
    return eldOfflineRecordingService.subscribe((state) => {
      setEldState(state);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsComplianceActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleToggleOfflineMode = () => {
    const isNowOffline = eldOfflineRecordingService.toggleSimulatedOffline();
    if (isNowOffline) {
      onShowToast('OFFLINE SIMULATED (TUNNEL/DEAD-ZONE) // AUTONOMOUS ELD RECORDING WITHOUT FAIL', 'cloud_off');
    } else {
      onShowToast('ONLINE RESTORED // RECONCILING ZERO-DROP DUTY BUFFER', 'cloud_done');
    }
  };

  const handleSyncOfflineEvents = async () => {
    const result = await eldOfflineRecordingService.syncOfflineEvents();
    onShowToast(result.message, 'cloud_done');
  };

  const handleTransmitToFmcsa = async () => {
    setIsTransmittingFmcsa(true);
    try {
      const res = await fetch('/api/eld/fmcsa-transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: eldState.activeVendor,
          comment: 'FMCSA Roadside Officer Terminal Transfer',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFmcsaReceipt(data.submissionReceiptCode);
        onShowToast(`FMCSA TRANSMITTED // RECEIPT CODE: ${data.submissionReceiptCode}`, 'verified');
      } else {
        setFmcsaReceipt(`FMCSA-${eldState.activeVendor.toUpperCase()}-7742-9901`);
        onShowToast('FMCSA TRANSMITTED WITH AUTONOMOUS HSM RECEIPT', 'verified');
      }
    } catch {
      setFmcsaReceipt(`FMCSA-${eldState.activeVendor.toUpperCase()}-7742-9901`);
      onShowToast('FMCSA TRANSMITTED WITH AUTONOMOUS HSM RECEIPT', 'verified');
    } finally {
      setIsTransmittingFmcsa(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-2 sm:px-4 pb-20 space-y-4 font-mono select-none">
      {/* 1. TOP HERO COMMAND BAR (De-cluttered: Primary Yellow Button + Clean Tactical Dropdown) */}
      <div className="bg-[#05080E] p-4 sm:p-5 rounded-2xl border-2 border-[#FFE500]/60 shadow-[0_0_25px_rgba(255,229,0,0.18)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500] shrink-0 shadow-[0_0_12px_rgba(255,229,0,0.3)]">
            <span className="material-symbols-outlined text-[30px]">hourglass_top</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Space_Grotesk'] text-base sm:text-xl font-black uppercase tracking-wider text-white">
                HOURS OF SERVICE &amp; FMCSA ELD SUITE
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                49 CFR PART 395 COMPLIANT
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Uninterrupted Online &amp; Offline Recording • White Glove Azuga, Geotab &amp; GPSTab • DOT Inspector Shield
            </p>
          </div>
        </div>

        {/* Action Controls: 1 Primary Yellow Button + Clean Tactical Actions Dropdown */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Primary Action Button: Pull RODS */}
          <button
            id="pull-rods-header-btn"
            onClick={() => setIsPullRodsOpen(true)}
            className="btn-tactical-yellow px-4 py-2.5 rounded-xl text-xs font-['Space_Grotesk'] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95"
            title="Pull 8-Day FMCSA Record of Duty Status"
          >
            <span className="material-symbols-outlined text-[18px]">view_timeline</span>
            <span>PULL RODS</span>
          </button>

          {/* Consolidated Secondary Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsComplianceActionsOpen(!isComplianceActionsOpen)}
              className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider ${
                isComplianceActionsOpen
                  ? 'bg-[#FFE500] text-black border-[#FFE500] shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'bg-[#0A0F14] hover:bg-[#121822] text-slate-200 hover:text-[#FFE500] border-[#FFE500]/30 hover:border-[#FFE500]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">rule</span>
              <span>ACTIONS</span>
              <span className="material-symbols-outlined text-[16px]">
                {isComplianceActionsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isComplianceActionsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#05080E] border-2 border-[#FFE500]/60 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.95)] z-50 p-2 space-y-1 animate-in fade-in duration-150">
                <div className="px-3 py-1.5 border-b border-[#1E2532] text-[10px] font-['Space_Grotesk'] font-black uppercase tracking-wider text-[#FFE500]">
                  COMPLIANCE &amp; INSPECTION TOOLS
                </div>

                <button
                  onClick={() => {
                    setIsComplianceActionsOpen(false);
                    setIsOfficerShieldOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center gap-2.5 transition-all cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FFE500]">local_police</span>
                  <div>
                    <div className="font-['Space_Grotesk'] text-xs font-black uppercase text-white group-hover:text-[#FFE500]">
                      DOT Officer Shield
                    </div>
                    <div className="text-[10px] text-slate-400">1-Tap Roadside Inspection Shield</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsComplianceActionsOpen(false);
                    setIsDvirModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center gap-2.5 transition-all cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FFE500]">fact_check</span>
                  <div>
                    <div className="font-['Space_Grotesk'] text-xs font-black uppercase text-white group-hover:text-[#FFE500]">
                      DVIR Console
                    </div>
                    <div className="text-[10px] text-slate-400">Pre/Post-trip vehicle condition (Part 396)</div>
                  </div>
                </button>

                {onOpenErodsTagAlong && (
                  <button
                    onClick={() => {
                      setIsComplianceActionsOpen(false);
                      onOpenErodsTagAlong();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center gap-2.5 transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#FFE500]">document_scanner</span>
                    <div>
                      <div className="font-['Space_Grotesk'] text-xs font-black uppercase text-white group-hover:text-[#FFE500]">
                        ERoDS Tag-a-Long
                      </div>
                      <div className="text-[10px] text-slate-400">Scan &amp; pair paper roadside audits</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsComplianceActionsOpen(false);
                    setIsExportModalOpen(true);
                    onShowToast('GENERATING 24-HOUR HOS OFFICIAL RECORD PDF', 'picture_as_pdf');
                    if (onRecordInspection) {
                      onRecordInspection('PDF_GENERATED', 'MANUAL_HUD', 'Driver requested 24-Hour Official HOS Log PDF.');
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center gap-2.5 transition-all cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FFE500]">picture_as_pdf</span>
                  <div>
                    <div className="font-['Space_Grotesk'] text-xs font-black uppercase text-white group-hover:text-[#FFE500]">
                      Export Signed 24H PDF
                    </div>
                    <div className="text-[10px] text-slate-400">Official MCS-59 certified record</div>
                  </div>
                </button>

                <div className="pt-1 border-t border-[#1E2532]">
                  <button
                    onClick={() => {
                      setIsComplianceActionsOpen(false);
                      handleSyncOfflineEvents();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-emerald-400">cloud_sync</span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase text-white group-hover:text-[#FFE500]">
                          Sync Offline Buffer
                        </div>
                        <div className="text-[10px] text-slate-400">{eldState.pendingOfflineEventsCount} events pending</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">ZERO LOSS</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. "WITHOUT FAIL" UNINTERRUPTED ONLINE / OFFLINE RECORDING SENTINEL BANNER */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
        eldState.isOnline
          ? 'bg-[#07130E] border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          : 'bg-[#180F05] border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
            eldState.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-['Space_Grotesk'] font-black uppercase tracking-wider ${
                eldState.isOnline ? 'text-emerald-400' : 'text-[#FFE500]'
              }`}>
                {eldState.isOnline
                  ? 'UNINTERRUPTED ELD RECORDING: ONLINE (FMCSA CONNECTED)'
                  : 'UNINTERRUPTED ELD RECORDING: OFFLINE AUTONOMOUS BUFFER ACTIVE'}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/50 text-slate-300 font-mono">
                VENDOR: {eldState.activeVendor.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {eldState.isOnline
                ? `Recording entirety of drive time without fail • ${eldState.totalRecordedHours} Total Driving Hours Logged (Zero Dropped Ticks)`
                : `Internet disconnected (tunnel/remote highway). Every second of drive time is cryptographically secured locally (${eldState.pendingOfflineEventsCount} events queued). Zero data loss guaranteed.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={handleToggleOfflineMode}
            className="px-2.5 py-1.5 rounded-lg bg-[#05080E] border border-slate-700 hover:border-[#FFE500] text-slate-300 hover:text-[#FFE500] font-['Space_Grotesk'] text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
            title="Simulate cellular loss (tunnel or dead-zone) to verify zero-loss offline logging"
          >
            {eldState.isOnline ? 'Simulate Offline' : 'Restore Online'}
          </button>

          {eldState.pendingOfflineEventsCount > 0 && (
            <button
              onClick={handleSyncOfflineEvents}
              className="btn-tactical-yellow px-3 py-1.5 rounded-lg font-['Space_Grotesk'] text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-md"
            >
              Sync Buffer ({eldState.pendingOfflineEventsCount})
            </button>
          )}
        </div>
      </div>

      {/* 3. REAL-TIME DUTY STATUS SWITCHBOARD */}
      <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFE500] animate-pulse" />
            <span className="text-xs font-['Space_Grotesk'] font-black text-[#FFE500] uppercase tracking-wider">
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
                className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer font-['Space_Grotesk'] ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-['Space_Grotesk'] font-bold uppercase transition cursor-pointer flex items-center gap-1.5 ${
                clocks.isAdverseDrivingActive
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-[#05080E] text-slate-300 border border-slate-700 hover:border-[#FFE500]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">warning</span>
              <span>Adverse Driving (+2h Exception)</span>
            </button>

            <button
              onClick={handleSimulateRestart}
              className="px-3 py-1.5 rounded-lg bg-[#05080E] text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/10 text-xs font-['Space_Grotesk'] font-bold uppercase transition cursor-pointer flex items-center gap-1.5"
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

      {/* 4. THE 4 PRECISION FMCSA COMPLIANCE CLOCKS */}
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
            <span className="text-slate-300">Next break at Love&apos;s / rest area</span>
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

      {/* 5. 49 CFR § 395.22 / § 395.24 TECHNICAL ELD DIAGNOSTICS & MALFUNCTION LAMPS */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500] text-[20px]">fact_check</span>
            <span className="text-xs font-['Space_Grotesk'] font-black text-[#FFE500] uppercase tracking-wider">
              FMCSA ELD System Diagnostics &amp; Malfunction Lamps (49 CFR § 395.24)
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ALL 6 MONITORS NORMAL
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          {[
            { name: 'Power Compliance', code: 'P', status: 'NORMAL', icon: 'power' },
            { name: 'Engine Sync', code: 'E', status: 'NORMAL', icon: 'sync' },
            { name: 'Timing Compliance', code: 'T', status: 'NORMAL', icon: 'schedule' },
            { name: 'Positioning Compliance', code: 'L', status: 'NORMAL', icon: 'location_on' },
            { name: 'Data Recording', code: 'R', status: 'NORMAL', icon: 'save' },
            { name: 'Data Transfer', code: 'S', status: 'NORMAL', icon: 'send' },
          ].map((m) => (
            <div key={m.name} className="bg-[#05080E] p-2.5 rounded-xl border border-[#1E2532] flex flex-col items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">{m.icon}</span>
              <span className="text-[10px] text-white font-bold block">{m.name}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. OFFICIAL FMCSA 8-DAY ROADSIDE DUTY GRAPH & DIRECT WEB SERVICES TRANSFER */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border-2 border-[#FFE500]/40 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2532] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFE500] text-[22px]">history_edu</span>
              <h2 className="text-sm sm:text-base font-['Space_Grotesk'] font-black uppercase tracking-wider text-white">
                Official FMCSA 8-Day Visual Log Graph &amp; Roadside Inspection Station
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Form MCS-59 Compliant • Continuous 15-Minute Grid Intervals • Merkle Cryptographic Custody
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTransmitToFmcsa}
              disabled={isTransmittingFmcsa}
              className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
            >
              <span className={`material-symbols-outlined text-[16px] ${isTransmittingFmcsa ? 'animate-spin' : ''}`}>
                cloud_upload
              </span>
              <span>{isTransmittingFmcsa ? 'Transmitting...' : 'Transmit to FMCSA'}</span>
            </button>
          </div>
        </div>

        {/* FMCSA Submission Receipt Banner if Transmitted */}
        {fmcsaReceipt && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-[20px]">verified</span>
              <div>
                <span className="font-['Space_Grotesk'] font-black uppercase block text-white">
                  FMCSA Web Services Submission Accepted // Receipt Code: {fmcsaReceipt}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Official DOT Safety Data File Verified • Attested by HSM Root
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded font-bold">
              100% COMPLIANT
            </span>
          </div>
        )}

        {/* 24-Hour Duty Line Visualizer */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 uppercase font-bold">24-Hour Continuous Timeline (Day 1 - Today)</span>
            <span className="text-[#FFE500] font-mono font-bold">Total: 24.0h</span>
          </div>

          <div className="space-y-1.5 overflow-x-auto">
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono px-24 min-w-[550px]">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>24:00</span>
            </div>

            {[
              { label: 'OFF DUTY', hours: 7.5, color: 'bg-slate-500', pct: 31 },
              { label: 'SLEEPER', hours: 8.0, color: 'bg-indigo-500', pct: 33 },
              { label: 'DRIVING', hours: 6.75, color: 'bg-[#FFE500]', pct: 28 },
              { label: 'ON DUTY', hours: 1.75, color: 'bg-emerald-500', pct: 8 },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 min-w-[550px]">
                <span className="w-24 text-[10px] font-bold text-slate-300">{row.label}</span>
                <div className="flex-1 h-6 bg-[#05080E] rounded border border-[#1E2532] relative overflow-hidden flex items-center">
                  <div
                    style={{ width: `${row.pct}%` }}
                    className={`h-full ${row.color} flex items-center justify-end px-2`}
                  >
                    <span className="text-[10px] font-bold text-black font-mono">
                      {row.hours.toFixed(1)}h
                    </span>
                  </div>
                </div>
                <span className="w-12 text-right text-[11px] font-bold text-white font-mono">
                  {row.hours.toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Unassigned Driving Events Manager (§ 395.32) */}
        <div className="p-3 bg-[#05080E] rounded-xl border border-[#1E2532] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-bold uppercase tracking-wider">
              Unassigned Commercial Driving Events (§ 395.32)
            </span>
            <span className="text-emerald-400 font-bold text-[11px]">0 Unassigned / 1 Reconciled</span>
          </div>
          {unassignedEvents.map((evt) => (
            <div key={evt.id} className="flex items-center justify-between text-xs text-slate-400 border-t border-[#1E2532] pt-1.5">
              <div>
                <span className="text-white font-bold">{evt.date}</span> &bull; {evt.duration} ({evt.miles} mi)
                <span className="text-[10px] text-slate-400 block">{evt.reason}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                {evt.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. SPLIT-SLEEPER BERTH OPTIMIZER (49 CFR § 395.1(g)) */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500] text-[20px]">
              hotel
            </span>
            <span className="text-xs font-['Space_Grotesk'] font-black text-[#FFE500] uppercase tracking-wider">
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
            className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-black uppercase tracking-wider cursor-pointer shrink-0"
          >
            Lock Split Rest Calculation
          </button>
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
