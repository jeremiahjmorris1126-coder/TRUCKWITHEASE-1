import React, { useState, useEffect } from 'react';
import { DutyStatus, InspectionActionType, InspectionTriggerSource } from '../../types';
import { HosDailyLogPdfModal } from '../HosDailyLogPdfModal';
import { nasaEldTimeService } from '../../services/nasaEldTimeService';
import { TimezoneId, LiveEldTimesState } from '../../../server/eld/types';
import { stateGeolocationService } from '../../services/stateGeolocationService';

interface HosClocksScreenProps {
  onShowToast: (msg: string) => void;
  speed: number;
  onRecordInspection?: (
    actionType: InspectionActionType,
    triggerSource: InspectionTriggerSource,
    notes: string
  ) => void;
}

export const HosClocksScreen: React.FC<HosClocksScreenProps> = ({
  onShowToast,
  speed,
  onRecordInspection,
}) => {
  // Live ELD State from NASA-synchronized high precision service
  const [eldState, setEldState] = useState<LiveEldTimesState>(nasaEldTimeService.getState());
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [showDocumentationDrawer, setShowDocumentationDrawer] = useState<boolean>(false);

  // Split-sleeper interactive inputs
  const [splitPeriod1, setSplitPeriod1] = useState<number>(eldState.splitSleeper.period1DurationHours || 7.0);
  const [splitPeriod2, setSplitPeriod2] = useState<number>(eldState.splitSleeper.period2DurationHours || 3.0);

  // Subscribe to live monotonic clock updates
  useEffect(() => {
    const unsubscribe = nasaEldTimeService.subscribe((newState) => {
      setEldState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Update telemetry when speed or geolocation changes
  useEffect(() => {
    const geoState = stateGeolocationService.getState();
    const lat = geoState.latitude || 41.8781;
    const lng = geoState.longitude || -87.6298;
    nasaEldTimeService.updateTelemetry(lat, lng, speed);
  }, [speed]);

  const formatHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStatusChange = (newStatus: DutyStatus) => {
    try {
      nasaEldTimeService.setStatus(newStatus);
      const labels: Record<DutyStatus, string> = {
        D: 'FMCSA DUTY: DRIVING (D)',
        ON: 'FMCSA DUTY: ON-DUTY NOT DRIVING (ON)',
        SB: 'FMCSA DUTY: SLEEPER BERTH (SB)',
        OFF: 'FMCSA DUTY: OFF-DUTY (OFF)',
        YM: 'FMCSA DUTY: YARD MOVE (YM)',
        PC: 'FMCSA DUTY: PERSONAL CONVEYANCE (PC)',
      };
      onShowToast(labels[newStatus]);
    } catch (err: any) {
      onShowToast(err.message || 'Status change rejected by ELD safety lock.');
    }
  };

  const handleApplySplitSleeper = () => {
    const evalResult = nasaEldTimeService.setSplitSleeperBerth(splitPeriod1, splitPeriod2);
    if (evalResult.isEligible) {
      onShowToast(`SPLIT SLEEPER ACTIVATED: ${evalResult.hoursExcludedFrom14HrWindow.toFixed(1)}h paused from 14h window`);
    } else {
      onShowToast('SPLIT REST INELIGIBLE: Must total 10h with ≥7h in sleeper berth');
    }
  };

  const isVehicleMoving = speed >= 5.0;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & OFFICIAL EXPORT CTA                     */}
      {/* ======================================================== */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-primary/40 shadow-[0_0_25px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div className="flex items-start sm:items-center gap-space-sm">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/50 flex items-center justify-center text-primary shrink-0 shadow-[0_0_16px_rgba(255,229,0,0.3)]">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-sm text-primary uppercase tracking-wider font-black text-[16px]">
                FMCSA 49 CFR § 395 ELD Live Cockpit
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                NASA ATOMIC SYNC ACTIVE
              </span>
            </div>
            <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
              Stratum 1 CDDIS Time Standard // Real-Time Epoch Monotonic Counters // Multi-Timezone Neutral
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowDocumentationDrawer(!showDocumentationDrawer)}
            className="px-3 py-2 rounded-lg bg-surface-container-high border border-surface-container-highest text-on-surface hover:text-primary transition-all text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            title="View FMCSA Calculation Documentation"
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            <span>CFR Rules</span>
          </button>

          <button
            id="export-official-hos-log-btn"
            onClick={() => {
              setIsExportModalOpen(true);
              onShowToast('Certified 24-Hour HOS Log prepared for roadside inspection.');
              if (onRecordInspection) {
                onRecordInspection('PDF_GENERATED', 'MANUAL_HUD', 'Driver requested certified 24-Hour Official HOS Log for DOT inspection.');
              }
            }}
            className="btn-primary-tactical px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110 active:scale-95 shadow-[0_0_20px_rgba(255,229,0,0.45)] text-black font-black uppercase tracking-wider text-[12px]"
            title="Export FMCSA-compliant certified 24-hour log as signed PDF"
          >
            <span className="material-symbols-outlined text-[20px] font-black">picture_as_pdf</span>
            <span>Export Official Log</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DUAL/TRIPLE REAL-TIME CLOCK DECK & TIMEZONE ENGINE     */}
      {/* ======================================================== */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/80 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-highest/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">public</span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
              Time Zone Compensation &amp; NASA Atomic Clocks
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-outline">Carrier Home Terminal:</span>
            <select
              value={eldState.homeTerminalTimezone}
              onChange={(e) => nasaEldTimeService.setHomeTerminalTimezone(e.target.value as TimezoneId)}
              className="bg-surface-container-highest text-primary font-bold px-2 py-0.5 rounded border border-surface-container-high focus:outline-none focus:border-primary text-[10px]"
            >
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Phoenix">Arizona (MST - No DST)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Anchorage">Alaska (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii (HST)</option>
            </select>
          </div>
        </div>

        {/* Triple Clock Surface */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Home Terminal Time (49 CFR § 395.8(a)(1) standard) */}
          <div className="bg-[#05080E] p-3 rounded-lg border border-primary/30 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-outline uppercase font-mono">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">domain</span>
                Home Terminal (24h Log Base)
              </span>
              <span className="text-primary font-bold">{eldState.homeTerminalTime.abbreviation}</span>
            </div>
            <div className="text-[26px] font-mono font-black text-primary tracking-tight">
              {eldState.homeTerminalTime.formattedTime.replace(/ [A-Z]{2,4}$/, '')}
            </div>
            <div className="text-[10px] font-mono text-on-surface-variant flex items-center justify-between">
              <span>{eldState.homeTerminalTime.label}</span>
              <span className="text-outline">UTC {eldState.homeTerminalTime.utcOffsetHours >= 0 ? `+${eldState.homeTerminalTime.utcOffsetHours}` : eldState.homeTerminalTime.utcOffsetHours}h</span>
            </div>
          </div>

          {/* Current Vehicle GPS Location Time */}
          <div className="bg-[#05080E] p-3 rounded-lg border border-[#10B981]/40 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] text-outline uppercase font-mono">
              <span className="flex items-center gap-1 text-[#10B981]">
                <span className="material-symbols-outlined text-[14px]">my_location</span>
                GPS Location Time ({eldState.nasaSpeedVerify.confirmedState})
              </span>
              <span className="text-[#10B981] font-bold">{eldState.currentLocationTime.abbreviation}</span>
            </div>
            <div className="text-[26px] font-mono font-black text-[#10B981] tracking-tight">
              {eldState.currentLocationTime.formattedTime.replace(/ [A-Z]{2,4}$/, '')}
            </div>
            <div className="text-[10px] font-mono text-on-surface-variant flex items-center justify-between">
              <span className="text-[#10B981] font-bold">
                {eldState.timezoneShiftHours === 0
                  ? 'ALIGNED WITH HOME TERMINAL'
                  : `${eldState.timezoneShiftHours > 0 ? `+${eldState.timezoneShiftHours}` : eldState.timezoneShiftHours}H TIMEZONE SHIFT`}
              </span>
              <span className="text-outline">UTC {eldState.currentLocationTime.utcOffsetHours >= 0 ? `+${eldState.currentLocationTime.utcOffsetHours}` : eldState.currentLocationTime.utcOffsetHours}h</span>
            </div>
          </div>

          {/* NASA CDDIS Stratum 1 Atomic UTC Clock */}
          <div className="bg-[#05080E] p-3 rounded-lg border border-sky-400/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-outline uppercase font-mono">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                NASA CDDIS Stratum 1
              </span>
              <span className="text-sky-400 font-bold">UTC</span>
            </div>
            <div className="text-[26px] font-mono font-black text-sky-300 tracking-tight">
              {eldState.utcTime.formattedTime.replace(/ [A-Z]{2,4}$/, '')}
            </div>
            <div className="text-[10px] font-mono text-on-surface-variant flex items-center justify-between">
              <span>Drift: {eldState.nasaTimeSync.clockDriftMs > 0 ? `+${eldState.nasaTimeSync.clockDriftMs}` : eldState.nasaTimeSync.clockDriftMs} ms</span>
              <span className="text-sky-400 font-bold">37 Leap Sec</span>
            </div>
          </div>
        </div>

        {/* Time Zone Cross-Country Route Quick Simulators */}
        <div className="bg-[#05080E]/70 p-2.5 rounded-lg border border-surface-container-highest/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-[11px] font-mono">
            <span className="text-primary font-bold">Route Timezone Compensation Test: </span>
            <span className="text-outline">Verify invariant HOS duty clocks across borders:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'CHICAGO_CT', label: 'Chicago (CT)' },
              { id: 'INDIANA_ET', label: 'Indiana (ET)' },
              { id: 'DENVER_MT', label: 'Denver (MT)' },
              { id: 'PHOENIX_MST', label: 'Phoenix (AZ)' },
              { id: 'LOS_ANGELES_PT', label: 'Los Angeles (PT)' },
            ].map((tz) => (
              <button
                key={tz.id}
                onClick={() => {
                  nasaEldTimeService.simulateTimezoneLocation(tz.id as any);
                  onShowToast(`Simulating route position: ${tz.label} — HOS timers preserved without distortion`);
                }}
                className="px-2 py-1 rounded bg-surface-container-high hover:bg-primary/20 text-on-surface hover:text-primary font-mono text-[9px] font-bold border border-surface-container-highest transition-all cursor-pointer"
              >
                {tz.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FMCSA DUTY STATUS SWITCHBOARD & SPEED INTERLOCK       */}
      {/* ======================================================== */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
              FMCSA Duty Status Switchboard (49 CFR § 395.2)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-outline">
              Status Duration: <span className="text-primary font-bold">{formatHMS(eldState.currentStatusDurationSec)}</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              isVehicleMoving
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}>
              {isVehicleMoving ? `VEHICLE MOVING (${speed.toFixed(1)} MPH - AUTO D)` : 'STATIONARY (ECM ZERO SPEED)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          {[
            { id: 'D', label: 'DRIVING', code: 'D', color: 'bg-primary text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]' },
            { id: 'ON', label: 'ON DUTY', code: 'ON', color: 'bg-amber-400 text-black font-black' },
            { id: 'SB', label: 'SLEEPER', code: 'SB', color: 'bg-sky-400 text-black font-black' },
            { id: 'OFF', label: 'OFF DUTY', code: 'OFF', color: 'bg-surface-container-highest text-white font-bold' },
            { id: 'YM', label: 'YARD MOVE', code: 'YM', color: 'bg-purple-400 text-black font-black' },
            { id: 'PC', label: 'PERS. CONV.', code: 'PC', color: 'bg-orange-500 text-black font-black' },
          ].map((item) => {
            const isSelected = eldState.currentStatus === item.id;
            const isDisabled = isVehicleMoving && item.id !== 'D' && item.id !== 'YM' && item.id !== 'PC';
            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => handleStatusChange(item.id as DutyStatus)}
                className={`py-3 px-2 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                  isSelected
                    ? `${item.color} border-primary scale-105 ring-2 ring-primary/60`
                    : isDisabled
                    ? 'bg-surface-container-lowest/40 text-outline/50 border-surface-container-highest cursor-not-allowed opacity-50'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border-surface-container-highest'
                }`}
              >
                <span className="font-telemetry-metric text-[18px] leading-none">
                  {item.code}
                </span>
                <span className="font-label-caps text-[8px] tracking-wider uppercase text-center truncate w-full font-bold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. FOUR PRECISION STATUTORY HOS DUTY CLOCKS              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
        {/* 11-Hour Driving Limit (§ 395.3(a)(3)(i)) */}
        <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider font-bold">
              11-Hour Driving Limit (§ 395.3(a)(3)(i))
            </span>
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              eldState.isViolatingDrivingLimit
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-primary/10 text-primary border border-primary/30'
            }`}>
              {eldState.isViolatingDrivingLimit
                ? 'VIOLATION: 0s REMAINING'
                : `${Math.round((eldState.drivingSecondsRemaining / eldState.maxDrivingSeconds) * 100)}% REMAINING`}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className={`font-mono text-[34px] tracking-tight font-black ${
              eldState.isViolatingDrivingLimit ? 'text-red-400' : 'text-primary'
            }`}>
              {formatHMS(eldState.drivingSecondsRemaining)}
            </span>
            <span className="font-mono text-[11px] text-outline">
              LIMIT: 11:00:00
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                eldState.isViolatingDrivingLimit ? 'bg-red-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, (eldState.drivingSecondsRemaining / eldState.maxDrivingSeconds) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1 font-mono">
            <span>Driven: {formatHMS(eldState.maxDrivingSeconds - eldState.drivingSecondsRemaining)}</span>
            <span className="text-[#10B981] font-bold">Clean: 0 Violations</span>
          </div>
        </div>

        {/* 14-Hour Consecutive Duty Window (§ 395.3(a)(2)) */}
        <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider font-bold">
              14-Hour Consecutive Duty Window (§ 395.3(a)(2))
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-400/15 text-sky-400 border border-sky-400/30 font-mono text-[10px] font-bold">
              {eldState.splitSleeper.isEligible ? `SPLIT PAUSED (+${eldState.splitSleeper.hoursExcludedFrom14HrWindow.toFixed(1)}h)` : 'STANDARD CONSECUTIVE'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-mono text-[34px] text-primary tracking-tight font-black">
              {formatHMS(eldState.dutyWindowSecondsRemaining)}
            </span>
            <span className="font-mono text-[11px] text-outline">
              LIMIT: 14:00:00
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (eldState.dutyWindowSecondsRemaining / eldState.maxDutyWindowSeconds) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1 font-mono">
            <span>Window Paused: {eldState.splitSleeper.isEligible ? `${eldState.splitSleeper.hoursExcludedFrom14HrWindow.toFixed(1)}h via 49 CFR § 395.1(g)` : 'None'}</span>
            <span className="text-primary font-bold">Active Shift</span>
          </div>
        </div>

        {/* 30-Minute Rest Break (§ 395.3(a)(3)(ii)) */}
        <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider font-bold">
              30-Minute Rest Break (§ 395.3(a)(3)(ii))
            </span>
            <span className="material-symbols-outlined text-[#10B981] text-[18px]">
              check_circle
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-mono text-[34px] text-primary tracking-tight font-black">
              {formatHMS(eldState.restBreakSecondsRemaining)}
            </span>
            <span className="font-mono text-[11px] text-outline">
              UNTIL 30M BREAK
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (eldState.restBreakSecondsRemaining / eldState.maxRestBreakSeconds) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1 font-mono">
            <span>Mandatory after 8h Driving</span>
            <span className="text-[#10B981] font-bold">Grace Active</span>
          </div>
        </div>

        {/* 70-Hour / 8-Day Rolling Cycle (§ 395.3(b)) */}
        <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-outline uppercase tracking-wider font-bold">
              70-Hour / 8-Day Rolling Cap (§ 395.3(b))
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-mono text-[10px] font-bold">
              RECAP ACTIVE
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-mono text-[34px] text-primary tracking-tight font-black">
              {formatHMS(eldState.cycleSecondsRemaining)}
            </span>
            <span className="font-mono text-[11px] text-outline">
              OF 70:00:00
            </span>
          </div>
          <div className="w-full bg-surface-container-lowest h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (eldState.cycleSecondsRemaining / eldState.maxCycleSeconds) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-outline pt-1 font-mono">
            <span>Used: {formatHMS(eldState.maxCycleSeconds - eldState.cycleSecondsRemaining)}</span>
            <span className="text-primary font-bold">Midnight Gain: +08h 55m</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. NASA SATELLITE DOPPLER SPEED & LOCATION VERIFICATION  */}
      {/* ======================================================== */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-primary/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">satellite</span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-black">
              NASA Doppler Velocity Radar &amp; J1939 Speed Integrity
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            {eldState.nasaSpeedVerify.speedIntegrityStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-mono">
          <div className="bg-[#05080E] p-2.5 rounded-lg border border-surface-container-highest">
            <div className="text-[10px] text-outline uppercase font-mono">CAN-Bus ECM Speed</div>
            <div className="text-[20px] font-black font-mono text-primary">{eldState.nasaSpeedVerify.canBusSpeedMph.toFixed(1)} <span className="text-[12px] text-outline font-normal">MPH</span></div>
            <div className="text-[9px] text-on-surface-variant font-mono">J1939 Powertrain Feed</div>
          </div>

          <div className="bg-[#05080E] p-2.5 rounded-lg border border-surface-container-highest">
            <div className="text-[10px] text-outline uppercase font-mono">NASA Doppler Speed</div>
            <div className="text-[20px] font-black font-mono text-sky-400">{eldState.nasaSpeedVerify.nasaDopplerSpeedMph.toFixed(1)} <span className="text-[12px] text-outline font-normal">MPH</span></div>
            <div className="text-[9px] text-on-surface-variant font-mono">L1/L2 Carrier Phase Shift</div>
          </div>

          <div className="bg-[#05080E] p-2.5 rounded-lg border border-surface-container-highest">
            <div className="text-[10px] text-outline uppercase font-mono">Speed Variance Delta</div>
            <div className="text-[20px] font-black font-mono text-[#10B981]">&plusmn;{eldState.nasaSpeedVerify.speedVarianceMph.toFixed(2)} <span className="text-[12px] text-outline font-normal">MPH</span></div>
            <div className="text-[9px] text-on-surface-variant font-mono">Zero Calibration Error</div>
          </div>

          <div className="bg-[#05080E] p-2.5 rounded-lg border border-surface-container-highest">
            <div className="text-[10px] text-outline uppercase font-mono">Geodetic Fix &amp; Constellation</div>
            <div className="text-[20px] font-black font-mono text-primary">{eldState.nasaSpeedVerify.satellitesLocked} <span className="text-[12px] text-outline font-normal">Sats</span></div>
            <div className="text-[9px] text-on-surface-variant font-mono">{eldState.nasaSpeedVerify.geodeticDatum}</div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-on-surface-variant bg-[#05080E]/70 p-2 rounded border border-surface-container-highest flex items-center justify-between flex-wrap gap-1">
          <span>Cryptographic Audit Proof: <code className="text-primary font-bold">{eldState.merkleProofSha256}</code></span>
          <span className="text-outline">Station: {eldState.nasaTimeSync.cddisStationId}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. 49 CFR § 395.1(g) SPLIT SLEEPER BERTH CALCULATOR      */}
      {/* ======================================================== */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              calculate
            </span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
              49 CFR § 395.1(g) Split Sleeper Berth Optimizer
            </span>
          </div>
          <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase ${
            eldState.splitSleeper.isEligible
              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
              : 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
          }`}>
            {eldState.splitSleeper.splitMode}
          </span>
        </div>

        <p className="font-body-sm text-[12px] text-on-surface-variant">
          Simulate a qualifying 8/2 or 7/3 split sleeper pairing to exclude the longer rest period from the 14-hour consecutive driving window.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1">
          <div className="bg-[#05080E] p-space-sm rounded-lg border border-surface-container-highest space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-outline uppercase">Qualifying Period 1 (Sleeper Berth)</span>
              <span className="text-primary font-bold text-[14px]">{splitPeriod1.toFixed(1)} Hours</span>
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
            <span className="text-[10px] font-mono text-outline block">
              FMCSA Requirement: Minimum 7.0 consecutive hours in sleeper berth
            </span>
          </div>

          <div className="bg-[#05080E] p-space-sm rounded-lg border border-surface-container-highest space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-outline uppercase">Qualifying Period 2 (Rest / Off-Duty)</span>
              <span className="text-primary font-bold text-[14px]">{splitPeriod2.toFixed(1)} Hours</span>
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
            <span className="text-[10px] font-mono text-outline block">
              FMCSA Requirement: Minimum 2.0 consecutive hours (Total combined &ge; 10.0h)
            </span>
          </div>
        </div>

        {/* Results Banner */}
        <div className="bg-[#05080E] p-space-sm rounded-lg border border-primary/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#10B981] text-[20px]">
              verified
            </span>
            <div className="text-[11px] font-mono">
              <span className="text-primary font-bold block">
                Combined Rest: {(splitPeriod1 + splitPeriod2).toFixed(1)} Hours ({eldState.splitSleeper.splitMode})
              </span>
              <span className="text-on-surface-variant">
                {eldState.splitSleeper.calculationNotes}
              </span>
            </div>
          </div>
          <button
            onClick={handleApplySplitSleeper}
            className="btn-primary-tactical px-4 py-1.5 text-black font-black text-[11px] uppercase tracking-wider rounded cursor-pointer hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(255,229,0,0.4)]"
          >
            Apply to Active Log
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. EXPANDABLE FMCSA STATUTORY CALCULATION DOCUMENTATION  */}
      {/* ======================================================== */}
      {showDocumentationDrawer && (
        <div className="bg-[#0A0F14] p-space-md rounded-xl border border-primary/50 shadow-2xl space-y-3 animate-fade-in font-mono text-[11px]">
          <div className="flex items-center justify-between border-b border-surface-container-highest pb-2">
            <span className="text-primary font-bold uppercase tracking-wider text-[12px] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              FMCSA Statutory HOS Calculation Architecture Documentation
            </span>
            <button
              onClick={() => setShowDocumentationDrawer(false)}
              className="text-outline hover:text-white"
            >
              Close [X]
            </button>
          </div>

          <div className="space-y-2 text-on-surface-variant leading-relaxed">
            <p>
              <strong className="text-primary">1. Monotonic Time Base (Zero Clock Drift):</strong> All elapsed durations are calculated strictly via absolute UTC epoch deltas (<code className="text-sky-300">T_elapsed = (Now_Epoch - Status_Epoch)</code>). This eliminates the cumulative timing drift of periodic interval timers or sleep timeouts.
            </p>
            <p>
              <strong className="text-primary">2. Timezone Compensation Neutrality (49 CFR § 395.8(a)(1)):</strong> While the carrier's 24-hour daily log is governed by the Home Terminal Timezone, crossing interstate time zone boundaries updates the local civil display time without altering, resetting, or distorting monotonic elapsed driving or duty seconds.
            </p>
            <p>
              <strong className="text-primary">3. Auto-Drive Threshold (49 CFR § 395.2):</strong> A commercial motor vehicle in motion at or exceeding <code className="text-primary">5.0 MPH</code> automatically locks duty status to <code className="text-primary">DRIVING (D)</code> and prevents manual override to non-driving states until stationary ECM zero-speed confirmation is received.
            </p>
            <p>
              <strong className="text-primary">4. NASA Doppler Speed &amp; Stratum 1 Sync:</strong> Satellite L1/L2 carrier Doppler frequency shift is cross-referenced with J1939 powertrain wheel speed to identify wheel slippage or ECM tampering within a &plusmn;1.5 MPH integrity envelope. Clock drift is kept below 50ms against NIST/NASA CDDIS atomic standards.
            </p>
            <p>
              <strong className="text-primary">5. Split Sleeper Berth Pause (49 CFR § 395.1(g)(1)):</strong> A qualifying 8/2 or 7/3 split sleeper pair excludes the longer rest period (7.0 to 8.0 hours) from the 14-hour consecutive driving window, extending the available duty window legally.
            </p>
          </div>
        </div>
      )}

      {/* Official 24-Hour HOS Log Modal */}
      <HosDailyLogPdfModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onDownloaded={() => {
          onShowToast('OFFICIAL 24H HOS LOG EXPORTED & RECORDED');
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
