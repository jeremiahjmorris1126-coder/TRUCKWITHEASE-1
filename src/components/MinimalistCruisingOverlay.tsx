import React, { useState, useEffect } from 'react';
import {
  regionalWeatherHazardService,
  RegionalWeatherHazardFeedState,
} from '../services/regionalWeatherHazardService';

interface MinimalistCruisingOverlayProps {
  onOpenPdfModal: () => void;
  onOpenEmergency: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onSwitchToRoute: () => void;
  onSwitchToHighContrast: () => void;
}

export const MinimalistCruisingOverlay: React.FC<MinimalistCruisingOverlayProps> = ({
  onOpenPdfModal,
  onOpenEmergency,
  onShowToast,
  onSwitchToRoute,
  onSwitchToHighContrast,
}) => {
  const [hazardState, setHazardState] = useState<RegionalWeatherHazardFeedState>(
    regionalWeatherHazardService.getState()
  );

  useEffect(() => {
    const unsub = regionalWeatherHazardService.subscribe((s) => setHazardState(s));
    return () => unsub();
  }, []);

  const activeHazards = hazardState.hazards.filter(
    (h) => !hazardState.dismissedHazardIds.includes(h.id)
  );
  const topHazard = activeHazards[0];
  return (
    <div className="flex flex-col gap-4 font-mono animate-fade-in">
      {/* JUMBO HEADS-UP COCKPIT GAUGE PANEL */}
      <div className="p-6 sm:p-8 rounded-3xl bg-black border-2 border-emerald-400/60 shadow-[0_0_30px_rgba(52,211,153,0.15)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle background radar ring */}
        <div className="absolute -right-16 -top-16 w-64 h-64 border border-emerald-500/10 rounded-full pointer-events-none" />
        <div className="absolute -right-8 -top-8 w-48 h-48 border border-emerald-500/20 rounded-full pointer-events-none" />

        {/* LEFT: JUMBO SPEEDOMETER & LEGAL POSTED LIMIT */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-emerald-400/80 uppercase font-bold tracking-widest">
              CURRENT VELOCITY
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-[72px] sm:text-[84px] font-black text-white tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                64
              </span>
              <span className="text-[16px] font-bold text-emerald-400">MPH</span>
            </div>
            <span className="text-[10px] text-emerald-300/80 uppercase flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              CRUISE CONTROL ENGAGED
            </span>
          </div>

          {/* Legal Posted Speed Limit Sign */}
          <div className="flex flex-col items-center justify-center w-20 h-24 bg-white rounded-xl border-4 border-black p-1 shadow-lg text-black shrink-0">
            <span className="text-[8px] font-black tracking-tight leading-none uppercase">SPEED</span>
            <span className="text-[8px] font-black tracking-tight leading-none uppercase mb-0.5">LIMIT</span>
            <span className="text-[34px] font-black tracking-tighter leading-none">70</span>
            <span className="text-[7px] font-bold text-neutral-600 uppercase mt-0.5">TRUCKS</span>
          </div>
        </div>

        {/* CENTER: KEY HOS TIMERS (DRIVE & SHIFT COUNTDOWN) */}
        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-emerald-500/40 text-center flex flex-col justify-center min-w-[130px]">
            <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">
              DRIVE REMAINING
            </span>
            <span className="text-[26px] font-black text-emerald-400 my-0.5">
              06h 14m
            </span>
            <span className="text-[9px] text-emerald-300 font-bold">49 CFR § 395.3(a)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-700 text-center flex flex-col justify-center min-w-[130px]">
            <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">
              DUTY SHIFT
            </span>
            <span className="text-[26px] font-black text-white my-0.5">
              08h 40m
            </span>
            <span className="text-[9px] text-neutral-400 font-bold">14h WINDOW</span>
          </div>
        </div>

        {/* RIGHT: NEXT UPCOMING WAYPOINT & BYPASS STATUS */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold mb-1.5">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            <span>PREPASS BYPASS: GREEN LIGHT</span>
          </div>
          <span className="text-[18px] font-bold text-white uppercase">
            Joplin Scale (MM 18)
          </span>
          <span className="text-[11px] text-neutral-300 mt-0.5">
            18 Miles Ahead • Missouri DOT Weight Station
          </span>
        </div>
      </div>

      {/* ESSENTIAL ROUTE STATUS & EMERGENCY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Next Rest Stop */}
        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-neutral-400 uppercase block font-bold">NEXT REST AREA</span>
            <span className="text-[13px] font-bold text-white block">St. James Plaza (14 Mi)</span>
            <span className="text-[10px] text-emerald-400">28 Truck Parking Spaces Open</span>
          </div>
          <span className="material-symbols-outlined text-neutral-500 text-[26px]">local_parking</span>
        </div>

        {/* Next Diesel Stop */}
        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-neutral-400 uppercase block font-bold">NEXT DIESEL DISCOUNT</span>
            <span className="text-[13px] font-bold text-white block">Love&apos;s #402 (12 Mi)</span>
            <span className="text-[10px] text-amber-400">$3.89/gal • In-App Fleet Pay</span>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-[26px]">local_gas_station</span>
        </div>

        {/* Weather & Road Condition / Hazard Alert */}
        <div
          onClick={topHazard ? onSwitchToRoute : undefined}
          className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
            topHazard
              ? topHazard.severity === 'CRITICAL'
                ? 'bg-rose-950/70 border-rose-500 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:brightness-110'
                : 'bg-amber-950/60 border-amber-500 cursor-pointer hover:brightness-110'
              : 'bg-neutral-950 border-neutral-800'
          }`}
          title={topHazard ? 'Tap to view full Regional Weather Hazards feed' : undefined}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] uppercase font-bold ${
                  topHazard ? 'text-amber-300' : 'text-neutral-400'
                }`}
              >
                {topHazard ? `REGIONAL HAZARD • ${topHazard.type}` : 'CORRIDOR WEATHER'}
              </span>
              {topHazard && (
                <span className="text-[8px] bg-rose-500 text-white px-1 rounded font-bold uppercase">
                  {topHazard.recommendedSpeedMph} MPH CAP
                </span>
              )}
            </div>
            <span className="text-[13px] font-bold text-white block truncate max-w-[200px]">
              {topHazard ? topHazard.title : 'I-44 EB • Clear 68°F'}
            </span>
            <span
              className={`text-[10px] block truncate max-w-[200px] ${
                topHazard ? 'text-amber-200' : 'text-sky-400'
              }`}
            >
              {topHazard
                ? `${topHazard.conditions.visibility} Vis • ${topHazard.conditions.windGust} Gusts`
                : 'Dry Pavement • Wind 8 MPH NW'}
            </span>
          </div>
          <span
            className={`material-symbols-outlined text-[26px] ${
              topHazard
                ? topHazard.severity === 'CRITICAL'
                  ? 'text-rose-400 animate-pulse'
                  : 'text-amber-400'
                : 'text-sky-400'
            }`}
          >
            {topHazard ? (topHazard.type === 'FOG' ? 'foggy' : topHazard.type === 'HIGH_WIND' ? 'air' : 'ac_unit') : 'sunny'}
          </span>
        </div>
      </div>

      {/* QUICK COMMAND ACTION FOOTER */}
      <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[11px] uppercase flex items-center gap-1.5 border border-neutral-600 transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">picture_as_pdf</span>
            <span>Show Inspection [I]</span>
          </button>

          <button
            type="button"
            onClick={onOpenEmergency}
            className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-[11px] uppercase flex items-center gap-1.5 border border-rose-800 transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] text-rose-400">emergency</span>
            <span>Emergency [E]</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400">Minimalist View Active:</span>
          <button
            type="button"
            onClick={onSwitchToRoute}
            className="text-[10px] font-bold text-sky-400 hover:underline cursor-pointer"
          >
            Expand Route &amp; Radar
          </button>
          <span className="text-neutral-600">•</span>
          <button
            type="button"
            onClick={onSwitchToHighContrast}
            className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
          >
            High Contrast
          </button>
        </div>
      </div>
    </div>
  );
};
