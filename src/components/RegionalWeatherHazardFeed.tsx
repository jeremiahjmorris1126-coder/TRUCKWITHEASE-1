import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  regionalWeatherHazardService,
  RegionalWeatherHazardFeedState,
  RegionalWeatherHazardItem,
  GeographicCorridorTarget,
} from '../services/regionalWeatherHazardService';

interface RegionalWeatherHazardFeedProps {
  onShowToast?: (msg: string, icon?: string) => void;
  compact?: boolean;
}

export const RegionalWeatherHazardFeed: React.FC<RegionalWeatherHazardFeedProps> = ({
  onShowToast,
  compact = false,
}) => {
  const [feedState, setFeedState] = useState<RegionalWeatherHazardFeedState>(
    regionalWeatherHazardService.getState()
  );
  const [showLocationSelector, setShowLocationSelector] = useState<boolean>(false);
  const [showGroundingCitations, setShowGroundingCitations] = useState<boolean>(false);
  const [expandedHazardId, setExpandedHazardId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = regionalWeatherHazardService.subscribe((s) => {
      setFeedState(s);
    });
    return () => unsubscribe();
  }, []);

  const {
    currentTarget,
    availableTargets,
    overallRisk,
    summary,
    hazards,
    searchGrounding,
    source,
    isLoading,
    lastUpdated,
    dismissedHazardIds,
  } = feedState;

  const activeHazards = hazards.filter((h) => !dismissedHazardIds.includes(h.id));

  const handleRefresh = async () => {
    onShowToast?.(
      `POLLING NWS SEARCH GROUNDING FOR ${currentTarget.name.toUpperCase()}`,
      'travel_explore'
    );
    await regionalWeatherHazardService.refreshHazards(true);
  };

  const handleSelectLocation = async (target: GeographicCorridorTarget) => {
    setShowLocationSelector(false);
    onShowToast?.(`CORRIDOR LOCATED: ${target.name}`, 'my_location');
    await regionalWeatherHazardService.setGeographicLocation(target);
  };

  const handleDismissHazard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    regionalWeatherHazardService.dismissHazard(id);
    onShowToast?.('HAZARD ADVISORY ACKNOWLEDGED', 'check_circle');
  };

  const handleRestoreAll = () => {
    regionalWeatherHazardService.restoreDismissedHazards();
    onShowToast?.('RESTORED ALL CORRIDOR HAZARDS', 'history');
  };

  const getHazardBadgeColor = (type: RegionalWeatherHazardItem['type']) => {
    switch (type) {
      case 'FOG':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'ICE':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'HIGH_WIND':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'SEVERE_STORM':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const getHazardIcon = (type: RegionalWeatherHazardItem['type']) => {
    switch (type) {
      case 'FOG':
        return 'foggy';
      case 'ICE':
        return 'ac_unit';
      case 'HIGH_WIND':
        return 'air';
      case 'SEVERE_STORM':
        return 'thunderstorm';
      default:
        return 'warning';
    }
  };

  const getRiskLevelBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-600/90 text-white animate-pulse',
          border: 'border-rose-500',
          label: 'CRITICAL HAZARD ALERT',
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-600/90 text-white',
          border: 'border-amber-500',
          label: 'HIGH HAZARD RISK',
        };
      case 'MODERATE':
        return {
          bg: 'bg-yellow-600/90 text-white',
          border: 'border-yellow-500',
          label: 'MODERATE CORRIDOR RISK',
        };
      default:
        return {
          bg: 'bg-emerald-600/90 text-white',
          border: 'border-emerald-500',
          label: 'NOMINAL CORRIDOR CONDITIONS',
        };
    }
  };

  const riskBadge = getRiskLevelBadge(overallRisk);

  return (
    <div
      id="regional-weather-hazard-feed"
      className="w-full rounded-2xl bg-surface-container-low/95 border border-primary/40 shadow-2xl p-3 sm:p-4 text-on-surface font-mono relative overflow-hidden transition-all duration-200"
    >
      {/* Background Subtle Radar Scan Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* HEADER SECTION: CORRIDOR TARGET, RISK BADGE & GROUNDING INDICATOR */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-surface-container-high/80">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-primary/20 border border-primary/50 text-primary flex items-center justify-center shrink-0 shadow-inner">
            <span
              className={`material-symbols-outlined text-[24px] ${
                isLoading ? 'animate-spin text-amber-400' : 'text-primary'
              }`}
            >
              {isLoading ? 'autorenew' : 'travel_explore'}
            </span>
            {overallRisk === 'CRITICAL' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] sm:text-[15px] font-bold text-white tracking-wide">
                REGIONAL WEATHER HAZARDS
              </span>
              <span
                className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold border ${riskBadge.bg} ${riskBadge.border}`}
              >
                {riskBadge.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-outline mt-0.5 flex-wrap">
              <span className="text-primary font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">near_me</span>
                {currentTarget.name}
              </span>
              <span>•</span>
              <span className="text-white/80">{currentTarget.corridor}</span>
              {currentTarget.isCurrentGps && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-bold">
                  GPS LOCKED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CONTROLS: REFRESH, LOCATION SWITCHER & CITATION BUTTON */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          <button
            id="btn-switch-hazard-location"
            onClick={() => setShowLocationSelector(!showLocationSelector)}
            className="px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-highest rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Change Geographic Location"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">location_city</span>
            <span className="hidden sm:inline">SWITCH CORRIDOR</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>

          <button
            id="btn-grounding-citations"
            onClick={() => setShowGroundingCitations(!showGroundingCitations)}
            className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/40 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="View Google Search Grounding Sources"
          >
            <span className="material-symbols-outlined text-[15px]">verified</span>
            <span className="hidden sm:inline">SEARCH GROUNDED</span>
          </button>

          <button
            id="btn-refresh-hazards"
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-highest rounded-lg text-[11px] flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Live Weather Hazards"
          >
            <span
              className={`material-symbols-outlined text-[18px] text-primary ${
                isLoading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* LOCATION SELECTOR DROPDOWN TRAY */}
      <AnimatePresence>
        {showLocationSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-neutral-950/90 border border-primary/40 rounded-xl overflow-hidden shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60 mb-2">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1 uppercase">
                <span className="material-symbols-outlined text-[15px]">alt_route</span>
                SELECT ROUTE HIGHWAY CORRIDOR
              </span>
              <button
                onClick={() => setShowLocationSelector(false)}
                className="text-outline hover:text-white text-[10px] uppercase font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {availableTargets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => handleSelectLocation(target)}
                  className={`p-2 rounded-lg text-left border text-[11px] transition-all cursor-pointer flex flex-col justify-between ${
                    currentTarget.id === target.id
                      ? 'bg-primary/20 border-primary text-white font-bold'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-outline hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{target.name}</span>
                    {target.isCurrentGps && (
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded">
                        GPS
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-outline mt-0.5 truncate">{target.corridor}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEARCH GROUNDING CITATIONS MODAL / DRAWER */}
      <AnimatePresence>
        {showGroundingCitations && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3.5 bg-neutral-950/95 border border-primary/50 rounded-xl overflow-hidden shadow-2xl text-[11px]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <div>
                  <span className="font-bold text-white uppercase block">
                    Google Search Grounding Verification
                  </span>
                  <span className="text-[10px] text-outline">
                    Model: gemini-3.8-flash • Tool: googleSearch
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowGroundingCitations(false)}
                className="text-outline hover:text-white text-[11px] font-bold uppercase"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-outline uppercase block font-bold">
                  Active Web Search Queries:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {searchGrounding.searchQueries.map((q, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-surface-container text-white/90 border border-surface-container-highest text-[10px]"
                    >
                      "{q}"
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-outline uppercase block font-bold mt-2">
                  Official Meteorological Sources &amp; DOT Feeds:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {searchGrounding.citations.map((cite, idx) => (
                    <a
                      key={idx}
                      href={cite.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded bg-surface-container-low hover:bg-surface-container border border-surface-container-highest flex items-center justify-between text-primary hover:underline transition-colors"
                    >
                      <div className="truncate mr-2">
                        <span className="font-bold block truncate text-white">{cite.title}</span>
                        <span className="text-[9px] text-outline truncate block">{cite.uri}</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px] shrink-0">open_in_new</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUMMARY BANNER */}
      <div className="mt-3 p-2.5 bg-surface-container-low/90 border border-surface-container-high rounded-xl flex items-start gap-2.5">
        <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <div className="flex-1">
          <p className="text-[12px] text-white/90 leading-relaxed font-sans">{summary}</p>
          <div className="flex items-center gap-3 text-[10px] text-outline mt-1 font-mono">
            <span>
              Engine:{' '}
              <strong className="text-white font-bold">
                {source === 'GEMINI_SEARCH_GROUNDED'
                  ? 'Gemini 3.8 Flash (Live Search Grounded)'
                  : 'NWS Meteorological Telemetry'}
              </strong>
            </span>
            {lastUpdated && (
              <span>
                Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE HAZARDS FEED LIST */}
      <div className="mt-3 space-y-2.5">
        {activeHazards.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center text-emerald-300">
            <span className="material-symbols-outlined text-[28px] block mb-1">check_circle</span>
            <span className="text-[13px] font-bold">NO SEVERE WEATHER HAZARDS DETECTED</span>
            <p className="text-[11px] text-outline mt-0.5">
              Corridor visibility, wind speeds, and road friction are within safe commercial operating limits.
            </p>
            {dismissedHazardIds.length > 0 && (
              <button
                onClick={handleRestoreAll}
                className="mt-2 text-[10px] uppercase font-bold text-primary hover:underline"
              >
                Restore Acknowledged Hazards ({dismissedHazardIds.length})
              </button>
            )}
          </div>
        ) : (
          activeHazards.map((hazard) => {
            const isExpanded = expandedHazardId === hazard.id;
            const badgeClass = getHazardBadgeColor(hazard.type);
            const icon = getHazardIcon(hazard.type);

            return (
              <div
                key={hazard.id}
                className={`rounded-xl border transition-all ${
                  hazard.severity === 'CRITICAL'
                    ? 'bg-neutral-950/90 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                    : hazard.severity === 'WARNING'
                    ? 'bg-neutral-950/80 border-amber-500/80'
                    : 'bg-surface-container-low border-surface-container-highest'
                }`}
              >
                {/* HAZARD HEADER BAR */}
                <div
                  onClick={() => setExpandedHazardId(isExpanded ? null : hazard.id)}
                  className="p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-surface-container-high/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${badgeClass}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${badgeClass}`}
                        >
                          {hazard.type} • {hazard.severity}
                        </span>
                        <span className="text-[10px] text-outline font-bold">
                          EXP: {hazard.validUntil}
                        </span>
                      </div>

                      <h4 className="text-[13px] sm:text-[14px] font-bold text-white mt-1 leading-snug">
                        {hazard.title}
                      </h4>
                      <p className="text-[11px] text-outline mt-0.5 leading-normal">
                        {hazard.headline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleDismissHazard(hazard.id, e)}
                      className="p-1 rounded bg-surface-container hover:bg-surface-container-highest text-outline hover:text-white transition-colors text-[10px] uppercase font-bold"
                      title="Acknowledge Hazard"
                    >
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                    <span className="material-symbols-outlined text-[18px] text-outline">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* HAZARD TELEMETRY PILLS */}
                <div className="px-3 pb-2.5 pt-1 border-t border-surface-container-high/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-surface-container/60 p-2 rounded-lg">
                    <span className="text-[9px] text-outline block uppercase">Visibility</span>
                    <span
                      className={`font-bold ${
                        hazard.type === 'FOG' ? 'text-amber-400 font-extrabold text-[12px]' : 'text-white'
                      }`}
                    >
                      {hazard.conditions.visibility}
                    </span>
                  </div>

                  <div className="bg-surface-container/60 p-2 rounded-lg">
                    <span className="text-[9px] text-outline block uppercase">Wind &amp; Gusts</span>
                    <span
                      className={`font-bold ${
                        hazard.type === 'HIGH_WIND' ? 'text-rose-400 font-extrabold text-[12px]' : 'text-white'
                      }`}
                    >
                      {hazard.conditions.windGust} ({hazard.conditions.windSpeed})
                    </span>
                  </div>

                  <div className="bg-surface-container/60 p-2 rounded-lg">
                    <span className="text-[9px] text-outline block uppercase">Safe Speed Cap</span>
                    <span className="font-bold text-emerald-400 text-[12px]">
                      {hazard.recommendedSpeedMph} MPH
                    </span>
                  </div>

                  <div className="bg-surface-container/60 p-2 rounded-lg">
                    <span className="text-[9px] text-outline block uppercase">Following Gap</span>
                    <span className="font-bold text-sky-400 text-[12px]">
                      {hazard.minFollowingDistanceSec} Seconds
                    </span>
                  </div>
                </div>

                {/* EXPANDED COMMERCIAL DIRECTIVES & SPECIFICS */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-3 pb-3 border-t border-surface-container-high/40 pt-2.5 bg-neutral-950/60"
                    >
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-primary uppercase block mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                            Mandatory Commercial Driver Safety Directives:
                          </span>
                          <ul className="space-y-1 pl-1">
                            {hazard.truckingSafetyDirectives.map((dir, idx) => (
                              <li
                                key={idx}
                                className="text-[11px] text-white/90 flex items-start gap-1.5 leading-snug"
                              >
                                <span className="text-amber-400 font-bold shrink-0">›</span>
                                <span>{dir}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-surface-container-high/30 flex items-center justify-between text-[10px] text-outline flex-wrap gap-2">
                          <span>
                            Road Surface:{' '}
                            <strong className="text-white">{hazard.conditions.roadCondition}</strong>
                          </span>
                          <span>
                            Corridor Stretch:{' '}
                            <strong className="text-white">{hazard.affectedCorridor}</strong>
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER BAR: ACKNOWLEDGED COUNT & RECOVERY */}
      {dismissedHazardIds.length > 0 && activeHazards.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-surface-container-high/60 flex items-center justify-between text-[10px] text-outline">
          <span>{dismissedHazardIds.length} hazard advisory acknowledged</span>
          <button
            onClick={handleRestoreAll}
            className="text-primary hover:underline font-bold uppercase"
          >
            Show All
          </button>
        </div>
      )}
    </div>
  );
};
