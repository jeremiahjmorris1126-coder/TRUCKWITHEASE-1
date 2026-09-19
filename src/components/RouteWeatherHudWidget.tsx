import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  realtimeRouteWeatherService,
  RouteWeatherState,
  RouteLocationTarget,
  RouteSevereAlert,
} from '../services/realtimeRouteWeatherService';

interface RouteWeatherHudWidgetProps {
  onShowToast?: (msg: string, icon?: string) => void;
}

export const RouteWeatherHudWidget: React.FC<RouteWeatherHudWidgetProps> = ({ onShowToast }) => {
  const [weatherState, setWeatherState] = useState<RouteWeatherState>(
    realtimeRouteWeatherService.getState()
  );
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = realtimeRouteWeatherService.subscribe((state) => {
      setWeatherState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const {
    currentLocation,
    availableRouteLocations,
    weather,
    activeAlerts,
    isLoading,
    isGpsLocked,
    isSimulated,
    simulatedScenario,
    lastUpdatedText,
    error,
  } = weatherState;

  // Filter out dismissed alerts
  const visibleAlerts = activeAlerts.filter((a) => !dismissedAlertIds.has(a.id));
  const hasCriticalAlert = visibleAlerts.some((a) => a.severity === 'CRITICAL');
  const hasWarningAlert = visibleAlerts.some((a) => a.severity === 'WARNING');

  const handleRefresh = () => {
    realtimeRouteWeatherService.fetchWeatherForLocation(currentLocation);
    onShowToast?.(
      `POLLING REAL-TIME WEATHER RADAR FOR ${currentLocation.label.toUpperCase()}`,
      'radar'
    );
  };

  const handleSelectLocation = (loc: RouteLocationTarget) => {
    realtimeRouteWeatherService.setRouteLocation(loc);
    setShowLocationPicker(false);
    onShowToast?.(`ROUTE WEATHER LOCKED: ${loc.label}`, 'my_location');
  };

  const handleSimulate = (scenario: 'HIGH_WIND' | 'DENSE_FOG' | 'BLACK_ICE' | 'SEVERE_STORM' | 'CLEAR') => {
    realtimeRouteWeatherService.simulateScenario(scenario);
    if (scenario === 'CLEAR') {
      onShowToast?.('WEATHER RADAR RESET TO LIVE SATELLITE SENSORS', 'wb_sunny');
    } else {
      onShowToast?.(`SIMULATED DRILL ACTIVE: ${scenario.replace('_', ' ')}`, 'warning');
    }
  };

  const toggleExpandAlert = (id: string) => {
    setExpandedAlertId((prev) => (prev === id ? null : id));
  };

  const dismissAlert = (id: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, id]));
    onShowToast?.('WEATHER ADVISORY ACKNOWLEDGED & DISMISSED', 'check_circle');
  };

  return (
    <div className="w-full flex flex-col gap-space-xs font-mono text-on-surface">
      {/* MAIN CONTAINER */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container/95 border border-primary/40 shadow-2xl p-3 sm:p-4 space-y-3">
        {/* Subtle background radar scanline */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

        {/* TOP STATUS BAR: ROUTE LOCATION, GPS INDICATOR & CONTROLS */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high/80 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <span className={`material-symbols-outlined text-[20px] ${isLoading ? 'animate-spin' : ''}`}>
                {isLoading ? 'autorenew' : isSimulated ? 'science' : 'satellite_alt'}
              </span>
              {isGpsLocked && !isSimulated && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                  ROUTE WEATHER TELEMETRY
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${
                    isSimulated
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : isGpsLocked
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-surface-container-highest text-outline border-outline/30'
                  }`}
                >
                  {isSimulated ? `SIM: ${simulatedScenario}` : isGpsLocked ? 'GPS LIVE LOCK' : 'CORRIDOR MESH'}
                </span>
                {weather?.roadSurface === 'BLACK_ICE_GLAZE' && (
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse">
                    BLACK ICE WARNING
                  </span>
                )}
              </div>

              {/* CURRENT ROUTE LOCATION LABEL */}
              <div className="flex items-center gap-1.5 text-white text-[12px] font-bold truncate max-w-[280px] sm:max-w-[420px]">
                <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
                  {currentLocation.isGps ? 'near_me' : 'place'}
                </span>
                <span className="truncate">{currentLocation.label}</span>
                {currentLocation.mileMarker && (
                  <span className="text-[10px] text-outline font-normal">
                    (MP {currentLocation.mileMarker})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS: LOCATION SELECTOR, REFRESH & SIMULATOR TOGGLE */}
          <div className="flex items-center gap-1.5 self-end sm:self-center">
            {/* Location selector toggle */}
            <button
              onClick={() => setShowLocationPicker((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest text-white hover:text-primary text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Inspect weather ahead along the route corridor"
            >
              <span className="material-symbols-outlined text-[14px] text-primary">route</span>
              <span className="hidden sm:inline">Route Ahead</span>
              <span className="material-symbols-outlined text-[12px]">
                {showLocationPicker ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Live refresh */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-2 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest text-primary hover:text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Refresh live National Weather Service & Open-Meteo satellite feed"
            >
              <span className={`material-symbols-outlined text-[14px] ${isLoading ? 'animate-spin' : ''}`}>
                autorenew
              </span>
              <span className="hidden md:inline">{isLoading ? 'Syncing...' : 'Sync Radar'}</span>
            </button>

            {/* Drill simulator toggle */}
            <button
              onClick={() => setShowSimControls((prev) => !prev)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isSimulated
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-surface-container-high hover:bg-surface-container-highest border-surface-container-highest text-outline hover:text-white'
              }`}
              title="Simulate extreme weather hazards (Tule Fog, Crosswinds, Black Ice)"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isSimulated ? 'science' : 'tune'}
              </span>
              <span className="hidden lg:inline">{isSimulated ? 'Sim Active' : 'Drill'}</span>
            </button>
          </div>
        </div>

        {/* ROUTE LOCATION SELECTOR DROPDOWN (PREVIEW WEATHER AHEAD ON ROUTE) */}
        <AnimatePresence>
          {showLocationPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-surface-container-lowest/90 border border-primary/30 rounded-lg p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">alt_route</span>
                  SELECT ROUTE MILEPOST OR GPS COORDINATE
                </span>
                <span className="text-[9px] text-outline">
                  Real-time conditions updated per point
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {availableRouteLocations.map((loc) => {
                  const isSelected = loc.id === currentLocation.id;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc)}
                      className={`text-left p-2 rounded-lg border transition-all text-[10px] cursor-pointer flex flex-col justify-between gap-1 ${
                        isSelected
                          ? 'bg-primary/20 border-primary text-white font-bold'
                          : 'bg-surface-container/60 hover:bg-surface-container border-surface-container-high text-outline hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{loc.label}</span>
                        {loc.isGps && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            GPS
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-outline truncate">{loc.corridor}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SIMULATION DRILL CONTROLS (IF EXPANDED) */}
        <AnimatePresence>
          {showSimControls && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-surface-container-lowest/90 border border-amber-500/30 rounded-lg p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">science</span>
                  DOT ROUTE SEVERE WEATHER DRILL SIMULATOR
                </span>
                {isSimulated && (
                  <button
                    onClick={() => handleSimulate('CLEAR')}
                    className="text-[9px] text-emerald-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                    Reset Live Satellite
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleSimulate('HIGH_WIND')}
                  className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">air</span>
                  Gale Crosswinds (56 MPH)
                </button>
                <button
                  onClick={() => handleSimulate('DENSE_FOG')}
                  className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-red-500/40 text-red-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">foggy</span>
                  Zero-Visibility Tule Fog
                </button>
                <button
                  onClick={() => handleSimulate('BLACK_ICE')}
                  className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">ac_unit</span>
                  Black Ice Glaze (29°F)
                </button>
                <button
                  onClick={() => handleSimulate('SEVERE_STORM')}
                  className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-yellow-500/40 text-yellow-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">thunderstorm</span>
                  Severe Thunderstorm & Hail
                </button>
                <button
                  onClick={() => handleSimulate('CLEAR')}
                  className="px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">wb_sunny</span>
                  Clear Corridor (72°F)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LOADING SKELETON */}
        {isLoading && !weather ? (
          <div className="py-6 text-center space-y-2 text-outline text-[11px] animate-pulse">
            <span className="material-symbols-outlined text-[32px] text-primary block animate-spin">
              autorenew
            </span>
            <p className="font-bold text-white tracking-wider">
              INTERFACING REAL-TIME NOAA SATELLITE & CORRIDOR WEATHER RADAR...
            </p>
            <p className="text-[10px] text-outline/80">
              Querying live atmospheric conditions for {currentLocation.label}
            </p>
          </div>
        ) : weather ? (
          <>
            {/* CURRENT CONDITIONS TELEMETRY GRID (HIGH CONTRAST COCKPIT) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {/* 1. TEMPERATURE & REAL FEEL */}
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high/80 flex flex-col justify-between space-y-1">
                <div className="flex items-center justify-between text-[9px] text-outline uppercase font-bold">
                  <span>Temperature</span>
                  <span className="material-symbols-outlined text-[14px] text-primary">
                    {weather.icon}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[22px] font-bold text-white tracking-tight">
                    {weather.temperatureF}°F
                  </span>
                  <div className="text-right">
                    <span className="text-[9px] text-outline block">Feels Like</span>
                    <span className="text-[11px] text-primary font-bold">
                      {weather.apparentTemperatureF}°F
                    </span>
                  </div>
                </div>
                <div className="text-[9px] text-white/90 truncate font-semibold">
                  {weather.conditionText}
                </div>
              </div>

              {/* 2. VISIBILITY & SIGHTLINE BARRIER */}
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high/80 flex flex-col justify-between space-y-1">
                <div className="flex items-center justify-between text-[9px] text-outline uppercase font-bold">
                  <span>Visibility Sightline</span>
                  <span
                    className={`text-[8px] px-1 rounded font-bold ${
                      weather.visibilityMiles >= 5
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : weather.visibilityMiles >= 2
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400 animate-pulse'
                    }`}
                  >
                    {weather.visibilityMiles >= 5 ? 'OPTIMAL' : weather.visibilityMiles >= 2 ? 'CAUTION' : 'CRITICAL'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-[22px] font-bold tracking-tight ${
                      weather.visibilityMiles < 2 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {weather.visibilityMiles}
                  </span>
                  <span className="text-[10px] text-outline font-bold">Miles</span>
                </div>
                <div className="text-[9px] text-outline truncate">
                  {weather.visibilityMiles < 1.0 ? 'Low Beams Required' : 'Standard Headway'}
                </div>
              </div>

              {/* 3. WIND VECTOR & 53FT TRAILER CROSSWIND */}
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high/80 flex flex-col justify-between space-y-1">
                <div className="flex items-center justify-between text-[9px] text-outline uppercase font-bold">
                  <span>Wind & Gusts</span>
                  <span
                    className={`text-[8px] px-1 rounded font-bold ${
                      weather.windSpeedMph >= 35 || weather.windGustsMph >= 45
                        ? 'bg-red-500/20 text-red-400'
                        : weather.windSpeedMph >= 25
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-surface-container-highest text-outline'
                    }`}
                  >
                    {weather.windDirectionCardinal}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-[22px] font-bold tracking-tight ${
                      weather.windSpeedMph >= 30 ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    {weather.windSpeedMph}
                  </span>
                  <div className="text-right">
                    <span className="text-[9px] text-outline block">Peak Gusts</span>
                    <span
                      className={`text-[11px] font-bold ${
                        weather.windGustsMph >= 40 ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      {weather.windGustsMph} MPH
                    </span>
                  </div>
                </div>
                <div className="text-[9px] text-outline truncate">
                  {weather.windGustsMph >= 40 ? 'Crosswind Rollover Risk' : 'Standard Lateral Shear'}
                </div>
              </div>

              {/* 4. ROAD SURFACE & TRACTION STATUS */}
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high/80 flex flex-col justify-between space-y-1">
                <div className="flex items-center justify-between text-[9px] text-outline uppercase font-bold">
                  <span>Pavement Grip</span>
                  <span
                    className={`text-[8px] px-1 rounded font-bold ${
                      weather.roadSurface === 'BLACK_ICE_GLAZE'
                        ? 'bg-red-500/20 text-red-400'
                        : weather.roadSurface === 'DRY_PAVEMENT'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {weather.roadSurface === 'BLACK_ICE_GLAZE'
                      ? 'ICE'
                      : weather.roadSurface === 'DRY_PAVEMENT'
                      ? 'DRY'
                      : 'SLIPPERY'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-bold text-white truncate">
                    {weather.roadSurface === 'BLACK_ICE_GLAZE'
                      ? 'GLAZE ICE'
                      : weather.roadSurface === 'HYDROPLANE_HAZARD'
                      ? 'HYDROPLANE'
                      : weather.roadSurface === 'DENSE_FOG_REDUCED_SIGHT'
                      ? 'DENSE FOG'
                      : weather.roadSurface === 'WET_TRACTION_REDUCED'
                      ? 'WET SURFACE'
                      : 'DRY SURFACE'}
                  </span>
                  <span className="text-[10px] text-outline">
                    Dew {weather.dewPointF}°F
                  </span>
                </div>
                <div className="text-[9px] text-outline truncate">
                  {weather.roadSurface === 'BLACK_ICE_GLAZE'
                    ? 'NO JAKE BRAKE'
                    : weather.precipitationInHr > 0
                    ? `Precip: ${weather.precipitationInHr} in/hr`
                    : '100% Pavement Friction'}
                </div>
              </div>
            </div>

            {/* SEVERE WEATHER ALERTS FOR DRIVER'S ROUTE LOCATION */}
            <div className="space-y-2">
              {visibleAlerts.length > 0 ? (
                visibleAlerts.map((alertItem: RouteSevereAlert) => {
                  const isCritical = alertItem.severity === 'CRITICAL';
                  const isExpanded = expandedAlertId === alertItem.id;

                  const containerClass = isCritical
                    ? 'bg-[#280c10] border-red-500/60 shadow-[0_4px_24px_rgba(239,68,68,0.2)]'
                    : 'bg-[#261805] border-amber-500/60 shadow-[0_4px_24px_rgba(245,158,11,0.15)]';

                  const badgeClass = isCritical
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                  const iconColor = isCritical ? 'text-red-400' : 'text-amber-400';

                  return (
                    <div
                      key={alertItem.id}
                      className={`relative overflow-hidden rounded-xl border ${containerClass} p-3 transition-all space-y-2`}
                    >
                      {/* Top Header of Alert */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className={`w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 ${iconColor}`}
                          >
                            <span className="material-symbols-outlined text-[18px] animate-pulse">
                              {alertItem.event.toLowerCase().includes('wind')
                                ? 'air'
                                : alertItem.event.toLowerCase().includes('fog')
                                ? 'foggy'
                                : alertItem.event.toLowerCase().includes('ice') ||
                                  alertItem.event.toLowerCase().includes('winter')
                                ? 'ac_unit'
                                : 'warning'}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-[12px] tracking-wide uppercase">
                                {alertItem.event}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${badgeClass}`}>
                                {alertItem.severity}
                              </span>
                              <span className="text-[8px] text-outline px-1 rounded bg-black/30 border border-outline/20">
                                {alertItem.source === 'NWS_GOV' ? 'OFFICIAL NWS' : 'RADAR TELEMETRY'}
                              </span>
                            </div>
                            <p className="text-[10px] text-outline mt-0.5">{alertItem.headline}</p>
                          </div>
                        </div>

                        {/* Speed Advisory Pill & Expand/Dismiss */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {alertItem.speedAdvisoryMph && (
                            <div className="px-2 py-0.5 rounded bg-black/50 border border-white/20 text-right">
                              <span className="text-[7px] text-outline block uppercase font-bold">Advisory</span>
                              <span className="text-[11px] font-bold text-amber-400">
                                {alertItem.speedAdvisoryMph} MPH
                              </span>
                            </div>
                          )}

                          <button
                            onClick={() => toggleExpandAlert(alertItem.id)}
                            className="p-1 rounded bg-black/30 hover:bg-black/50 text-outline hover:text-white transition-all cursor-pointer"
                            title="View official NWS advisory details"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>

                          <button
                            onClick={() => dismissAlert(alertItem.id)}
                            className="p-1 rounded bg-black/30 hover:bg-black/50 text-outline hover:text-white transition-all cursor-pointer"
                            title="Acknowledge alert"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      </div>

                      {/* Equipment Hazard & Following Distance Notice */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] bg-black/30 rounded-lg p-2 border border-white/5">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-primary shrink-0">
                            local_shipping
                          </span>
                          <span className="text-white/90">
                            <strong className="text-white">Commercial Hazard:</strong>{' '}
                            {alertItem.truckEquipmentHazard}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-amber-400 shrink-0">
                            space_dashboard
                          </span>
                          <span className="text-white/90">
                            <strong className="text-white">Minimum Following Gap:</strong>{' '}
                            {alertItem.followingDistanceSec} Seconds Headway
                          </span>
                        </div>
                      </div>

                      {/* Expandable NWS official statement and instructions */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden space-y-2 pt-1 border-t border-white/10 text-[10px]"
                          >
                            <div>
                              <span className="font-bold text-white uppercase block mb-0.5">
                                Official Meteorological Statement:
                              </span>
                              <p className="text-outline leading-relaxed">{alertItem.description}</p>
                            </div>
                            {alertItem.instruction && (
                              <div className="bg-primary/10 border border-primary/20 rounded p-2 text-primary">
                                <span className="font-bold block uppercase mb-0.5">Driver Action Directives:</span>
                                <p className="text-[10px] leading-relaxed text-white/90">
                                  {alertItem.instruction}
                                </p>
                              </div>
                            )}
                            {alertItem.sender && (
                              <div className="text-[8px] text-outline/80 text-right">
                                Issued by {alertItem.sender}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              ) : (
                /* OPTIMAL / CORRIDOR CLEAR HUD BAR */
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                      verified
                    </span>
                    <div>
                      <span className="font-bold text-emerald-300 uppercase tracking-wider">
                        CORRIDOR CLEAR • NO ACTIVE SEVERE WEATHER HAZARDS
                      </span>
                      <p className="text-[10px] text-outline">
                        Pavement dry, wind velocities nominal, and sightlines clear across active transit sector.
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 shrink-0">
                    CRUISE NOMINAL
                  </span>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* BOTTOM METADATA BAR */}
        <div className="flex items-center justify-between text-[9px] text-outline border-t border-surface-container-high/60 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{lastUpdatedText}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Coordinates: {currentLocation.lat.toFixed(3)}°N, {Math.abs(currentLocation.lon).toFixed(3)}°W</span>
            {error && <span className="text-amber-400 italic">({error})</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
