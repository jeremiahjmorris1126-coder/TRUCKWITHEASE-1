import React, { useState } from 'react';
import { PreRunAuditCheck, DriverAlertnessData } from '../../types';
import { DriverAlertnessWidget } from '../DriverAlertnessWidget';

interface MasterSynchronizerProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPdfModal?: () => void;
  alertnessData?: DriverAlertnessData;
  onOpenRestModal?: () => void;
  onTriggerFatigue?: () => void;
  onResetAlertness?: () => void;
}

const INITIAL_AUDIT_CHECKS: PreRunAuditCheck[] = [
  {
    id: 'check-1',
    category: 'HOS_COMPLIANCE',
    title: 'FMCSA § 395.8 HOS Clocks & 30-Min Break',
    status: 'PASSED',
    detailValue: '06h 45m Drive / 08h 12m Shift Remaining',
    recommendation: 'Compliant for 280-mile trip segment. Next 30-min break due at 13:30 CDT.',
    icon: 'timer',
  },
  {
    id: 'check-2',
    category: 'BRIDGE_CLEARANCE',
    title: 'LiDAR Route Bridge Clearance Geofences',
    status: 'PASSED',
    detailValue: 'Trailer Height: 13\' 6" (Standard) • Min Bridge: 13\' 9"',
    recommendation: '+3" safe margin on BNSF Flyover. No low-clearance detours required on I-20.',
    icon: 'arch',
  },
  {
    id: 'check-3',
    category: 'AXLE_WEIGHT',
    title: 'Bridge Formula 54B Axle Group Weights',
    status: 'PASSED',
    detailValue: 'Gross: 79,220 LBS (Steer: 12.1k, Drive: 33.8k, Trailer: 33.2k)',
    recommendation: 'Fully legal for federal interstate travel. WIM transponder pre-pass active.',
    icon: 'scale',
  },
  {
    id: 'check-4',
    category: 'WEATHER_RADAR',
    title: 'Corridor Weather Radar & Crosswinds',
    status: 'WARNING',
    detailValue: 'Crosswind Gusts 22 MPH (I-20 Mile 485-510)',
    recommendation: 'Maintain firm two-handed steering grip across Trinity River bridge span.',
    icon: 'air',
  },
  {
    id: 'check-5',
    category: 'SECURITY_SEAL',
    title: 'HSM Cryptographic Inspection Log Seal',
    status: 'PASSED',
    detailValue: 'SHA-256 Hash: 7f8a9b2c...4d3e (Attested)',
    recommendation: '8-Day driver log package cryptographically sealed & ready for FMCSA audit.',
    icon: 'verified_user',
  },
  {
    id: 'check-6',
    category: 'DISPATCH_DOCK',
    title: 'Predictive Dock Arrival & Door Reservation',
    status: 'PASSED',
    detailValue: 'Dock Door 04 Reserved • 08:42 CDT Predictive ETA',
    recommendation: '18-minute buffer ahead of scheduled 09:00 CDT delivery window.',
    icon: 'dock',
  },
];

export const MasterSynchronizerScreen: React.FC<MasterSynchronizerProps> = ({
  onShowToast,
  onOpenPdfModal,
  alertnessData,
  onOpenRestModal,
  onTriggerFatigue,
  onResetAlertness,
}) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('07:45 CDT Today');
  const [readinessScore, setReadinessScore] = useState<number>(98);
  const [checks, setChecks] = useState<PreRunAuditCheck[]>(INITIAL_AUDIT_CHECKS);
  const [isInspectionModeActive, setIsInspectionModeActive] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  // Trigger automated pre-run diagnostic sweep
  const handleRunMasterSync = () => {
    setIsSyncing(true);
    onShowToast('EXECUTING PRE-RUN MASTER SYNCHRONIZATION SWEEP...', 'sync');

    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')} CDT Today`;
      setLastSyncedTime(timeStr);
      setReadinessScore(100);

      // Upgrade any warning to passed upon sweep completion
      setChecks((prev) =>
        prev.map((c) => ({
          ...c,
          status: 'PASSED',
          recommendation: c.recommendation + ' [Re-Verified OK]',
        }))
      );

      onShowToast(
        'DAILY PRE-RUN MASTER SYNC COMPLETE: 100% DISPATCH READINESS CLEARANCE ISSUED!',
        'verified'
      );
    }, 2200);
  };

  const handleApplyScenario = (scenarioId: string, label: string) => {
    setActiveScenario(scenarioId);
    if (scenarioId === 'scenario-break') {
      onShowToast(
        `SCENARIO APPLIED: 30-min break at Mile 480 added. Updated Dock ETA: 09:12 CDT.`,
        'free_breakfast'
      );
    } else if (scenarioId === 'scenario-reroute') {
      onShowToast(
        `SCENARIO APPLIED: Scale bypass reroute calculated. +4.2 miles, saves 12 min scale queue.`,
        'alt_route'
      );
    } else if (scenarioId === 'scenario-oversize') {
      onShowToast(
        `SCENARIO APPLIED: 14'0" High-Cube Swap verified. Route cleared via I-20 Skyway.`,
        'height'
      );
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md select-none">
      {/* HEADER HERO BANNER */}
      <div className="bg-gradient-to-r from-surface-container via-surface-container-high to-surface-container p-space-md rounded-2xl border border-primary/40 shadow-2xl space-y-space-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm relative z-10">
          <div className="flex items-center gap-space-sm">
            <div className="w-12 h-12 rounded-xl bg-primary text-on-primary font-bold flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
              <span className="material-symbols-outlined text-[28px]">stars</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-primary uppercase font-bold tracking-widest text-[11px]">
                  TruckWithEase &bull; Proprietary Daily Tool
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold uppercase">
                  Active
                </span>
              </div>
              <h1 className="font-headline-sm text-on-surface text-[20px] font-bold">
                Daily Pre-Run Master Synchronizer
              </h1>
            </div>
          </div>

          {/* Master Action Button */}
          <button
            disabled={isSyncing}
            onClick={handleRunMasterSync}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-caps text-[12px] font-bold uppercase tracking-wider shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start sm:self-center"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isSyncing ? 'animate-spin' : ''
              }`}
            >
              {isSyncing ? 'sync' : 'bolt'}
            </span>
            <span>{isSyncing ? 'Synchronizing...' : 'Execute Pre-Run Master Sync'}</span>
          </button>
        </div>

        {/* Readiness Meter & Status Bar */}
        <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-outline">Daily Dispatch Readiness Score:</span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[13px] border border-emerald-500/40">
              {readinessScore}% PASSED
            </span>
          </div>

          <div className="flex items-center gap-3 text-outline">
            <span>Last Pre-Run Audit: <strong className="text-on-surface">{lastSyncedTime}</strong></span>
            <span>&bull;</span>
            <span className="text-primary font-bold">Pass Code: #TWE-8902-SYNC</span>
          </div>
        </div>
      </div>

      {/* DRIVER COGNITIVE HEALTH & ALERTNESS WIDGET */}
      {alertnessData && onOpenRestModal && onTriggerFatigue && onResetAlertness && (
        <DriverAlertnessWidget
          alertnessData={alertnessData}
          onOpenRestModal={onOpenRestModal}
          onTriggerFatigue={onTriggerFatigue}
          onResetAlertness={onResetAlertness}
        />
      )}

      {/* ROADSIDE INSPECTION QUICK MODE OVERLAY BUTTON STRIP */}
      <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            shield_person
          </span>
          <div>
            <span className="font-label-caps text-[12px] text-primary uppercase font-bold tracking-wider block">
              Everyday One-Tap Roadside Inspection Mode
            </span>
            <span className="text-[11px] text-outline font-mono">
              Locks non-compliance driver interfaces and exposes cryptographically signed 8-day log QR.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => {
              setIsInspectionModeActive(!isInspectionModeActive);
              onShowToast(
                !isInspectionModeActive
                  ? 'ROADSIDE AUDIT MODE ACTIVATED: Screen locked for DOT officer verification.'
                  : 'ROADSIDE AUDIT MODE DEACTIVATED: Cockpit unlocked.',
                'lock'
              );
            }}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isInspectionModeActive
                ? 'bg-amber-500 text-slate-950 border border-amber-300 animate-pulse'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isInspectionModeActive ? 'lock_open' : 'qr_code_2'}
            </span>
            <span>{isInspectionModeActive ? 'Exit Audit Mode' : 'Activate Roadside Audit Mode'}</span>
          </button>

          {onOpenPdfModal && (
            <button
              onClick={onOpenPdfModal}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 text-[11px] font-mono font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              <span>View Certified PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* ROADSIDE INSPECTION MODAL BANNER WHEN ACTIVE */}
      {isInspectionModeActive && (
        <div className="bg-slate-900 border-2 border-amber-400 p-space-md rounded-2xl shadow-2xl text-center space-y-3 animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-mono font-bold text-[13px]">
            <span className="material-symbols-outlined text-[20px]">verified</span>
            <span>FMCSA § 395.15 ROADSIDE AUDIT VERIFICATION DISPLAY</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
            {/* Visual QR Code Display */}
            <div className="w-32 h-32 bg-white p-2 rounded-lg flex items-center justify-center shrink-0 shadow-xl">
              <div className="w-full h-full bg-slate-900 rounded p-1 flex flex-col justify-between text-[8px] font-mono text-emerald-400 overflow-hidden break-all text-center">
                <span>FMCSA-DOT-AUDIT</span>
                <span>SHA256:7f8a9b2c</span>
                <span>#TWE-8902</span>
                <span className="bg-emerald-500 text-slate-950 font-bold py-0.5">VERIFIED PASS</span>
              </div>
            </div>

            <div className="text-left space-y-1.5 font-mono text-[11px]">
              <div className="text-slate-300 font-bold">Officer Temporary Pin: <span className="text-amber-400 text-[14px]">#4138</span></div>
              <div className="text-slate-400">Carrier: Morrishive Logistics (USDOT #3928110)</div>
              <div className="text-slate-400">Driver: Jonathan Vance (ID: #DRV-8801)</div>
              <div className="text-emerald-400 font-bold">8-Day HOS Log Status: 100% COMPLIANT</div>
              <div className="text-slate-500 text-[9px]">Cryptographic Seal Hash: 7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c</div>
            </div>
          </div>
        </div>
      )}

      {/* 6-POINT PRE-RUN AUDIT CHECKLIST GRID */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-2xl space-y-space-md">
        <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              checklist
            </span>
            <h2 className="font-label-caps text-[14px] text-primary uppercase font-bold tracking-wider">
              Unified Pre-Run 6-Point Audit Checklist
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] font-bold">
            All Telemetry Layers Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {checks.map((check) => {
            const isPassed = check.status === 'PASSED';
            return (
              <div
                key={check.id}
                className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high shadow-md space-y-2 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      {check.icon}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-on-surface">
                      {check.title}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border shrink-0 ${
                      isPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-primary font-bold bg-surface-container-lowest p-2 rounded border border-white/5">
                  {check.detailValue}
                </div>

                <div className="text-[10px] font-mono text-outline leading-relaxed">
                  <strong className="text-on-surface">Action/Recommendation: </strong>
                  {check.recommendation}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EVERYDAY SHIFT SCENARIO OPTIMIZER SIMULATOR */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              science
            </span>
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
              Everyday "What-If" Shift Scenario Simulator
            </span>
          </div>
          <span className="text-[10px] text-outline font-mono">Instant Impact Calculator</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
          {[
            {
              id: 'scenario-break',
              title: '30-Min Rest Break @ MP 480',
              desc: 'Simulates statutory HOS rest stop at Love\'s Travel Stop.',
              impact: 'Resets 8-hr drive break timer; adds +30m to Dock ETA.',
              icon: 'free_breakfast',
            },
            {
              id: 'scenario-reroute',
              title: 'Scale Bypass Reroute (US-80)',
              desc: 'Bypasses WIM scale queue at Mile 482 during peak weigh hours.',
              impact: 'Saves 12m scale delay; +4.2 miles fuel delta.',
              icon: 'alt_route',
            },
            {
              id: 'scenario-oversize',
              title: '14\' 0" High-Cube Swap',
              desc: 'Tests route bridge clearance for oversized trailer configuration.',
              impact: 'Verifies I-20 Skyway 15\' 6" clearance; 0 obstructions.',
              icon: 'height',
            },
          ].map((sc) => {
            const isActive = activeScenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => handleApplyScenario(sc.id, sc.title)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isActive
                    ? 'bg-primary/15 border-primary text-on-surface shadow-lg'
                    : 'bg-surface-container-low hover:bg-surface-container-highest border-surface-container-high text-outline hover:text-on-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">{sc.icon}</span>
                    <span>{sc.title}</span>
                  </span>
                  {isActive && (
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">
                      check_circle
                    </span>
                  )}
                </div>

                <p className="text-[10px] font-mono leading-tight">{sc.desc}</p>
                <div className="text-[9px] font-mono text-emerald-400 font-bold pt-1 border-t border-white/5">
                  {sc.impact}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const MasterSynchronizer = MasterSynchronizerScreen;
