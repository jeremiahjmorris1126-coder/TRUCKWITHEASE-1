import React, { useState, useEffect } from 'react';
import {
  regionalWeatherHazardService,
  RegionalWeatherHazardFeedState,
} from '../services/regionalWeatherHazardService';

interface RouteFocusedCorridorRibbonProps {
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToTripPlanner?: () => void;
  onOpenHazards?: () => void;
}

export const RouteFocusedCorridorRibbon: React.FC<RouteFocusedCorridorRibbonProps> = ({
  onShowToast,
  onNavigateToTripPlanner,
  onOpenHazards,
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
  const primaryHazard = activeHazards[0];
  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-950/40 border-2 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.2)] font-mono space-y-3 animate-fade-in">
      {/* HEADER: ACTIVE HIGHWAY CORRIDOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-500/30 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400 text-sky-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">alt_route</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black text-white uppercase tracking-wider">
                ROUTE FOCUSED CORRIDOR TELEMETRY
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-500/30 text-sky-200 border border-sky-400">
                LIVE GPS
              </span>
            </div>
            <p className="text-[10px] text-sky-200/70">
              I-44 Eastbound Corridor • Mile Marker 184.2 • St. Louis Metro Approach (ETA 15:45 CDT)
            </p>
          </div>
        </div>

        {onNavigateToTripPlanner && (
          <button
            type="button"
            onClick={onNavigateToTripPlanner}
            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-[10px] uppercase flex items-center gap-1 self-start sm:self-center transition-all cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-[14px]">map</span>
            <span>Full Trip Planner</span>
          </button>
        )}
      </div>

      {/* 4 HIGHWAY TELEMETRY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        {/* Card 1: Next Scale */}
        <div className="p-2.5 rounded-xl bg-black/60 border border-sky-500/40 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-sky-300 uppercase font-bold">
            <span>Next Scale</span>
            <span className="text-emerald-400 font-bold">BYPASS</span>
          </div>
          <span className="text-[14px] font-black text-white block">18 Miles</span>
          <span className="text-[9px] text-neutral-300 block truncate">Joplin Weight Station</span>
        </div>

        {/* Card 2: Next Diesel Stop */}
        <div className="p-2.5 rounded-xl bg-black/60 border border-sky-500/40 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-sky-300 uppercase font-bold">
            <span>Cheapest Diesel</span>
            <span className="text-amber-400 font-bold">$3.89</span>
          </div>
          <span className="text-[14px] font-black text-white block">12 Miles</span>
          <span className="text-[9px] text-neutral-300 block truncate">Love&apos;s #402 (I-44 MM 184)</span>
        </div>

        {/* Card 3: Next Rest & Parking */}
        <div className="p-2.5 rounded-xl bg-black/60 border border-sky-500/40 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-sky-300 uppercase font-bold">
            <span>Truck Parking</span>
            <span className="text-emerald-400 font-bold">28 OPEN</span>
          </div>
          <span className="text-[14px] font-black text-white block">14 Miles</span>
          <span className="text-[9px] text-neutral-300 block truncate">St. James Rest Stop</span>
        </div>

        {/* Card 4: Radar Alert Status & Grounded Hazards */}
        <div
          onClick={onOpenHazards}
          className={`p-2.5 rounded-xl border space-y-1 transition-all ${
            primaryHazard
              ? primaryHazard.severity === 'CRITICAL'
                ? 'bg-rose-950/70 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer hover:brightness-110'
                : 'bg-amber-950/60 border-amber-500 cursor-pointer hover:brightness-110'
              : 'bg-black/60 border-sky-500/40'
          }`}
          title={primaryHazard ? 'Click to inspect Regional Weather Hazards' : undefined}
        >
          <div className="flex items-center justify-between text-[9px] uppercase font-bold">
            <span className={primaryHazard ? 'text-white' : 'text-sky-300'}>Hazard Feed</span>
            <span
              className={`font-bold ${
                primaryHazard
                  ? primaryHazard.severity === 'CRITICAL'
                    ? 'text-rose-400 animate-pulse'
                    : 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {primaryHazard ? primaryHazard.type : 'ALL CLEAR'}
            </span>
          </div>
          <span className="text-[13px] font-black text-white block truncate">
            {primaryHazard ? `${primaryHazard.recommendedSpeedMph} MPH CAP` : 'Corridor Nominal'}
          </span>
          <span className="text-[9px] text-neutral-300 block truncate">
            {primaryHazard
              ? primaryHazard.title
              : 'Google Search Grounded • NWS Clean'}
          </span>
        </div>
      </div>
    </div>
  );
};
