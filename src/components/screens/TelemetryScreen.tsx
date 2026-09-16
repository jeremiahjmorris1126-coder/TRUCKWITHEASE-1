import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_BRIDGE_GEOFENCES, EQUIPMENT_INFO } from '../../data/mockData';
import { BridgeGeofence } from '../../types';
import { memoryPerformanceService, MemoryStatsResponse } from '../../services/memoryPerformanceService';
import { StateBoundaryAgent } from '../StateBoundaryAgent';
import { QuantumAlertnessReportCard } from '../QuantumAlertnessReportCard';

interface TelemetryProps {
  onShowToast: (msg: string, icon?: string) => void;
  speed?: number;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

const VEHICLE_HEIGHT_OPTIONS = [
  { label: `12' 6" (Lowboy)`, feet: 12.5 },
  { label: `13' 6" (Standard Dry Van)`, feet: 13.5 },
  { label: `14' 0" (High-Cube)`, feet: 14.0 },
  { label: `14' 6" (Oversize Load)`, feet: 14.5 },
];

export const TelemetryScreen: React.FC<TelemetryProps> = ({
  onShowToast,
  speed = 65,
  onRecordInspectionLog,
}) => {
  // Current vehicle trailer height configuration in decimal feet (default 13.5 = 13' 6")
  const [vehicleHeightFt, setVehicleHeightFt] = useState<number>(13.5);

  // Toggle filter: Hide bridge geofences that are higher than the current vehicle trailer configuration
  const [hideHigherBridges, setHideHigherBridges] = useState<boolean>(true);

  // Currently selected bridge geofence on mini-map overlay
  const [selectedBridgeId, setSelectedBridgeId] = useState<string>('bg-101');

  // Backend Memory & Performance Data Tracking State
  const [memoryStats, setMemoryStats] = useState<MemoryStatsResponse | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Periodic Backend Memory Snapshot Tracking
  useEffect(() => {
    let isMounted = true;
    const sendSnapshot = async () => {
      await memoryPerformanceService.trackSnapshot({ activeRoute: 'Corridor Telemetry' });
      const stats = await memoryPerformanceService.getMemoryStats();
      if (isMounted && stats) {
        setMemoryStats(stats);
      }
    };

    sendSnapshot();
    const interval = setInterval(sendSnapshot, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleManualMemoryOptimization = async () => {
    setIsOptimizing(true);
    onShowToast('EXECUTING BACKEND MEMORY PURGE & GC FLUSH...', 'memory');
    const res = await memoryPerformanceService.applyOptimization('GC_DOM_PRUNE', 'TELEMETRY_ENGINE');
    if (res && res.optimization) {
      onShowToast(`MEMORY OPTIMIZATION APPLIED: Reclaimed ${res.optimization.memorySavedMb} MB`, 'check_circle');
    }
    const updatedStats = await memoryPerformanceService.getMemoryStats();
    if (updatedStats) {
      setMemoryStats(updatedStats);
    }
    setIsOptimizing(false);
  };

  // Filtered bridges list based on 'Clearance Height' filter
  const visibleBridges = useMemo(() => {
    if (!hideHigherBridges) {
      return MOCK_BRIDGE_GEOFENCES;
    }
    // Hide bridges higher than current vehicle trailer height
    return MOCK_BRIDGE_GEOFENCES.filter(
      (bridge) => bridge.clearanceFt <= vehicleHeightFt
    );
  }, [hideHigherBridges, vehicleHeightFt]);

  const hiddenCount = MOCK_BRIDGE_GEOFENCES.length - visibleBridges.length;
  const selectedBridge = MOCK_BRIDGE_GEOFENCES.find((b) => b.id === selectedBridgeId) || visibleBridges[0] || MOCK_BRIDGE_GEOFENCES[0];

  const formatFeetToDisplay = (feet: number) => {
    const totalInches = Math.round(feet * 12);
    const ft = Math.floor(totalInches / 12);
    const inch = totalInches % 12;
    return `${ft}' ${inch}"`;
  };

  const getClearanceDelta = (bridgeClearanceFt: number, vehicleHtFt: number) => {
    const deltaInches = Math.round((bridgeClearanceFt - vehicleHtFt) * 12);
    if (deltaInches < 0) {
      return {
        text: `${Math.abs(deltaInches)}" UNDER CLEARANCE (HAZARD)`,
        status: 'CRITICAL',
        colorClass: 'text-error bg-error/15 border-error/40',
      };
    } else if (deltaInches === 0) {
      return {
        text: `EXACT TOUCH CLEARANCE (0" MARGIN)`,
        status: 'WARNING',
        colorClass: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
      };
    } else if (deltaInches <= 3) {
      return {
        text: `+${deltaInches}" TIGHT MARGIN`,
        status: 'TIGHT',
        colorClass: 'text-amber-300 bg-amber-500/15 border-amber-500/40',
      };
    } else {
      return {
        text: `+${deltaInches}" SAFE CLEARANCE`,
        status: 'SAFE',
        colorClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
      };
    }
  };

  const handleToggleFilter = () => {
    const nextState = !hideHigherBridges;
    setHideHigherBridges(nextState);
    if (nextState) {
      onShowToast(
        `CLEARANCE FILTER ACTIVE: Hiding bridges higher than ${formatFeetToDisplay(vehicleHeightFt)}`,
        'filter_alt'
      );
    } else {
      onShowToast('SHOWING ALL BRIDGE GEOFENCES ON MINI-MAP', 'map');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Telemetry Header */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[26px]">map</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                TelemetryView &bull; Corridor Radar
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold uppercase">
                J1939 + LiDAR Active
              </span>
            </div>
            <h1 className="font-headline-sm text-on-surface text-[18px] font-bold">
              GPS Telemetry & Bridge Clearance Mini-Map
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-3 py-1 bg-surface-container-high border border-primary/40 text-primary font-mono text-[11px] font-bold rounded flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            I-20 EASTBOUND &bull; MILE 492.4
          </span>
        </div>
      </div>

      {/* VEHICLE CONFIGURATION & CLEARANCE SETTINGS STRIP */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-container-high">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              local_shipping
            </span>
            <div>
              <span className="font-label-caps text-[12px] text-primary uppercase font-bold tracking-wider block">
                Active Vehicle Configuration & Trailer Height
              </span>
              <span className="text-[11px] text-outline font-mono">
                {EQUIPMENT_INFO.powerUnit} &bull; {EQUIPMENT_INFO.trailingUnit}
              </span>
            </div>
          </div>

          {/* Current Height Badge */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[10px] text-outline font-mono uppercase">Current Height:</span>
            <span className="px-3 py-1 rounded bg-primary text-on-primary font-mono text-[12px] font-bold tracking-tight shadow">
              {formatFeetToDisplay(vehicleHeightFt)}
            </span>
          </div>
        </div>

        {/* Height Quick Selection Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-outline">Select Vehicle Configuration:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {VEHICLE_HEIGHT_OPTIONS.map((opt) => {
              const isActive = vehicleHeightFt === opt.feet;
              return (
                <button
                  key={opt.feet}
                  onClick={() => {
                    setVehicleHeightFt(opt.feet);
                    onShowToast(
                      `VEHICLE TRAILER HEIGHT UPDATED: ${opt.label}`,
                      'height'
                    );
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-on-primary font-bold shadow'
                      : 'bg-surface-container-low text-outline hover:text-on-surface hover:bg-surface-container-highest border border-surface-container-high'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TELEMETRY VIEW MINI-MAP OVERLAY CONTAINER */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-2xl space-y-space-md relative overflow-hidden">
        {/* Mini-Map Header & CLEARANCE HEIGHT TOGGLE FILTER OVERLAY BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pb-space-xs border-b border-surface-container-high">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                layers
              </span>
              <h2 className="font-label-caps text-[14px] text-primary uppercase font-bold tracking-wider">
                Mini-Map Telemetry Overlay
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono text-[10px] font-bold">
                {visibleBridges.length} Visible
              </span>
            </div>
            <p className="text-[11px] text-outline font-body-sm">
              Real-time corridor radar with geofenced bridge clearance sensors and low overhead warnings.
            </p>
          </div>

          {/* CLEARANCE HEIGHT TOGGLE FILTER CONTROL BUTTON */}
          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-surface-container-high">
            <button
              onClick={handleToggleFilter}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                hideHigherBridges
                  ? 'bg-primary text-on-primary border border-primary/50'
                  : 'bg-surface-container-highest text-outline hover:text-on-surface border border-surface-container-high'
              }`}
              title="Toggle to hide bridge geofences higher than current trailer height configuration"
            >
              <span className="material-symbols-outlined text-[16px]">
                {hideHigherBridges ? 'filter_alt' : 'filter_alt_off'}
              </span>
              <span>
                {hideHigherBridges
                  ? 'Clearance Filter: ON (Hiding Higher Bridges)'
                  : 'Clearance Filter: OFF (Show All)'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Status Notification Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-container-lowest border border-white/5 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[15px]">info</span>
            <span className="text-on-surface">
              {hideHigherBridges ? (
                <span>
                  Filtering active: Showing bridges <strong className="text-primary">&le; {formatFeetToDisplay(vehicleHeightFt)}</strong>.{' '}
                  {hiddenCount > 0 ? (
                    <span className="text-outline">({hiddenCount} higher bridges hidden)</span>
                  ) : (
                    <span className="text-outline">(No bridges hidden)</span>
                  )}
                </span>
              ) : (
                <span className="text-outline">
                  Filter disabled: Displaying all {MOCK_BRIDGE_GEOFENCES.length} corridor bridge geofences on mini-map overlay.
                </span>
              )}
            </span>
          </div>

          <span className="text-[10px] text-primary font-mono shrink-0">
            LiDAR Height Array: Active
          </span>
        </div>

        {/* MINI-MAP VECTOR RADAR OVERLAY STAGE */}
        <div className="relative w-full h-64 sm:h-72 bg-slate-950 rounded-xl border border-surface-container-high overflow-hidden shadow-inner flex flex-col justify-between p-3 select-none">
          {/* Tactical Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
              backgroundSize: '24px 24px, 40px 40px, 40px 40px',
            }}
          />

          {/* Map Corridor Highway Line (I-20 Eastbound) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-14 bg-slate-900/90 border-y border-slate-700/80 flex items-center justify-between px-4 pointer-events-none">
            {/* Lane dividers */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-amber-500/30 w-full" />
            <span className="text-[9px] font-mono text-slate-500 z-10">MILE 480</span>
            <span className="text-[9px] font-mono text-slate-500 z-10">MILE 500</span>
            <span className="text-[9px] font-mono text-slate-500 z-10">MILE 520</span>
          </div>

          {/* Active Vehicle Marker (Truck Icon on Highway) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-all duration-700"
            style={{ left: '42%' }}
          >
            <div className="px-2 py-0.5 rounded bg-primary text-on-primary text-[9px] font-mono font-bold shadow mb-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-on-primary animate-ping" />
              <span>TRUCK #904 ({formatFeetToDisplay(vehicleHeightFt)})</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center text-primary shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-[18px]">navigation</span>
            </div>
          </div>

          {/* BRIDGE GEOFENCE MARKERS ON MINI-MAP */}
          <div className="absolute inset-0 pointer-events-auto">
            {visibleBridges.map((bridge) => {
              const isSelected = selectedBridge.id === bridge.id;
              const delta = getClearanceDelta(bridge.clearanceFt, vehicleHeightFt);
              const isUnderClearance = bridge.clearanceFt < vehicleHeightFt;

              let markerBg = 'bg-sky-500/20 text-sky-400 border-sky-400';
              if (delta.status === 'CRITICAL') {
                markerBg = 'bg-error/30 text-error border-error animate-pulse';
              } else if (delta.status === 'WARNING' || delta.status === 'TIGHT') {
                markerBg = 'bg-amber-500/30 text-amber-300 border-amber-400';
              } else if (delta.status === 'SAFE') {
                markerBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-400';
              }

              return (
                <div
                  key={bridge.id}
                  onClick={() => {
                    setSelectedBridgeId(bridge.id);
                    onShowToast(
                      `GEOFENCE SELECTED: ${bridge.name} (${bridge.clearanceDisplay})`,
                      'domain'
                    );
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer transition-all ${
                    isSelected ? 'scale-110 z-40' : 'hover:scale-105 opacity-90'
                  }`}
                  style={{
                    left: `${bridge.coordinates.x}%`,
                    top: `${bridge.coordinates.y}%`,
                  }}
                >
                  <div className="flex flex-col items-center">
                    {/* Badge Pill */}
                    <div
                      className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border shadow-md whitespace-nowrap flex items-center gap-1 mb-1 ${
                        isSelected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-slate-950 bg-slate-900 text-white'
                          : markerBg
                      }`}
                    >
                      <span className="material-symbols-outlined text-[11px]">
                        {isUnderClearance ? 'warning' : 'arch'}
                      </span>
                      <span>{bridge.clearanceDisplay}</span>
                    </div>

                    {/* Marker Icon Pin */}
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform ${
                        isSelected ? 'bg-primary border-white text-on-primary' : markerBg
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        sensor_window
                      </span>
                    </div>

                    {/* Bridge Title */}
                    <span className="text-[8px] font-mono text-slate-300 bg-slate-900/80 px-1.5 py-0.2 rounded mt-0.5 max-w-[90px] truncate text-center">
                      {bridge.name.split(' ')[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Compass & Legend Overlay */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-300">
            <span className="material-symbols-outlined text-primary text-[14px]">explore</span>
            <span>I-20 CORRIDOR MAP &bull; EASTBOUND</span>
          </div>

          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700 text-[9px] font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-error" />
            <span>Hazard</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Tight</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Safe</span>
          </div>

          {/* Map Scale Footer */}
          <div className="absolute bottom-2 left-2 z-10 text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            SCALE: 10 MILES / GRID
          </div>
        </div>

        {/* SELECTED BRIDGE GEOFENCE DETAIL INSPECTION CARD */}
        {selectedBridge && (
          <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high/90 space-y-2.5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  arch
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                      {selectedBridge.name}
                    </h3>
                    <span className="text-[10px] font-mono text-outline">
                      ({selectedBridge.highway})
                    </span>
                  </div>
                  <span className="text-[11px] text-outline font-mono block">
                    Direction: {selectedBridge.direction} &bull; Mile Marker {selectedBridge.mileMarker}
                  </span>
                </div>
              </div>

              {/* Clearance Delta Status Badge */}
              {(() => {
                const delta = getClearanceDelta(selectedBridge.clearanceFt, vehicleHeightFt);
                return (
                  <span
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1.5 self-start sm:self-center ${delta.colorClass}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {selectedBridge.clearanceFt < vehicleHeightFt ? 'dangerous' : 'verified'}
                    </span>
                    <span>{delta.text}</span>
                  </span>
                );
              })()}
            </div>

            {/* Quick Metrics Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded bg-surface-container-lowest border border-white/5">
                <span className="text-[9px] text-outline uppercase block">GEOFENCE CLEARANCE</span>
                <span className="text-[13px] font-bold text-primary block mt-0.5">
                  {selectedBridge.clearanceDisplay}
                </span>
              </div>

              <div className="p-2 rounded bg-surface-container-lowest border border-white/5">
                <span className="text-[9px] text-outline uppercase block">TRAILER CONFIG</span>
                <span className="text-[13px] font-bold text-on-surface block mt-0.5">
                  {formatFeetToDisplay(vehicleHeightFt)}
                </span>
              </div>

              <div className="p-2 rounded bg-surface-container-lowest border border-white/5">
                <span className="text-[9px] text-outline uppercase block">LIDAR PING</span>
                <span className="text-[12px] font-bold text-emerald-400 block mt-0.5 truncate">
                  {selectedBridge.laserSensorReading || 'Active'}
                </span>
              </div>

              <div className="p-2 rounded bg-surface-container-lowest border border-white/5">
                <span className="text-[9px] text-outline uppercase block">RESTRICTION TYPE</span>
                <span className="text-[11px] font-bold text-on-surface block mt-0.5">
                  {selectedBridge.restrictionStatus}
                </span>
              </div>
            </div>

            {/* Driver Notes & Detour Recommendation */}
            <div className="p-2.5 rounded-lg bg-surface-container/80 border border-white/5 text-[11px] font-mono text-outline leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                shield
              </span>
              <div>
                <span className="text-on-surface font-bold block mb-0.5">
                  Bridge Clearance Advisory:
                </span>
                <span>{selectedBridge.notes}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BACKEND MEMORY DATA TRACKING & APPLIED OPTIMIZATIONS PANEL */}
      <div className="bg-surface-container p-space-md rounded-xl border border-primary/40 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">hardware</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
                  Backend Memory Tracking &amp; Applied Optimization Engine
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/30">
                  EXPRESS REST CONNECTED
                </span>
              </div>
              <span className="text-[10px] text-outline font-mono block">
                Continuous telemetry data collection, JS Heap profiling &amp; dynamic GC state tuning
              </span>
            </div>
          </div>

          <button
            onClick={handleManualMemoryOptimization}
            disabled={isOptimizing}
            className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-caps text-[11px] uppercase font-bold tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 self-start sm:self-center cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">cleaning_services</span>
            <span>{isOptimizing ? 'Flushing Memory...' : 'Apply Memory Optimization'}</span>
          </button>
        </div>

        {/* Memory Metrics Display Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-mono text-[11px]">
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">JS HEAP USAGE</span>
            <span className="text-[16px] font-bold text-primary block">
              {memoryStats?.latestSnapshot ? `${memoryStats.latestSnapshot.usedHeapMb} MB` : '42.4 MB'}
            </span>
            <span className="text-[9px] text-outline block">
              Limit: {memoryStats?.latestSnapshot ? `${memoryStats.latestSnapshot.heapLimitMb} MB` : '512 MB'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">MEMORY HEALTH INDEX</span>
            <span className="text-[16px] font-bold text-emerald-400 block">
              {memoryStats?.latestSnapshot ? `${memoryStats.latestSnapshot.memoryHealthScore}/100` : '96/100'}
            </span>
            <span className="text-[9px] text-emerald-300 block">
              Leak Prob: {memoryStats?.latestSnapshot ? `${(memoryStats.latestSnapshot.leakProbability * 100).toFixed(1)}%` : '0.2%'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">DATA TRACKED SNAPSHOTS</span>
            <span className="text-[16px] font-bold text-sky-400 block">
              {memoryStats?.aggregatedStats ? `${memoryStats.aggregatedStats.totalSnapshotsRecorded}` : '18'}
            </span>
            <span className="text-[9px] text-outline block">
              Peak: {memoryStats?.aggregatedStats ? `${memoryStats.aggregatedStats.peakHeapMb} MB` : '54 MB'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block">TOTAL MEMORY RECLAIMED</span>
            <span className="text-[16px] font-bold text-amber-400 block">
              {memoryStats?.aggregatedStats ? `${memoryStats.aggregatedStats.totalMemorySavedMb} MB` : '28.4 MB'}
            </span>
            <span className="text-[9px] text-amber-300 block">
              Passes: {memoryStats?.aggregatedStats ? `${memoryStats.aggregatedStats.optimizationsAppliedCount}` : '2'}
            </span>
          </div>
        </div>

        {/* Applied Memory Optimizations History Log */}
        {memoryStats?.appliedOptimizations && memoryStats.appliedOptimizations.length > 0 && (
          <div className="space-y-2 pt-1 font-mono">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              RECENTLY APPLIED MEMORY TUNING ACTIONS (/api/memory/track)
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {memoryStats.appliedOptimizations.map((opt) => (
                <div
                  key={opt.id}
                  className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high flex items-center justify-between text-[10px] gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold shrink-0">
                      {opt.actionType}
                    </span>
                    <span className="text-on-surface truncate">{opt.description}</span>
                  </div>
                  <span className="text-emerald-400 font-bold shrink-0">
                    +{opt.memorySavedMb} MB RECLAIMED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TRUCKWITHEASE STATE BOUNDARY & DOT REGULATIONS AGENT */}
      <StateBoundaryAgent
        currentSpeedMph={speed}
        onShowToast={onShowToast}
        onRecordInspectionLog={onRecordInspectionLog}
      />

      {/* EXTENDED MEMORY SERVICE: QUANTUM PREDICTIVE DRIVER ALERTNESS & FLEET EFFICIENCY REPORT */}
      <QuantumAlertnessReportCard
        currentSpeedMph={speed}
        onShowToast={onShowToast}
        onRecordInspectionLog={onRecordInspectionLog}
      />

      {/* CAN-BUS J1939 SENSOR TELEMETRY GRID */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">memory</span>
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
              CAN-Bus J1939 Engine Diagnostics & Overhead LiDAR
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-bold">
            10Hz Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
          {[
            { label: 'OIL TEMP', value: '195°F', status: 'NORMAL', icon: 'oil_barrel' },
            { label: 'COOLANT', value: '185°F', status: 'OPTIMAL', icon: 'thermostat' },
            { label: 'DEF LEVEL', value: '78%', status: 'ADEQUATE', icon: 'water_drop' },
            { label: 'AIR PRESS', value: '120 PSI', status: 'FULL', icon: 'speed' },
            { label: 'OVERHEAD LIDAR', value: formatFeetToDisplay(vehicleHeightFt), status: 'ACTIVE', icon: 'height' },
            { label: 'TURBO BOOST', value: '28.4 PSI', status: 'ENGAGED', icon: 'bolt' },
            { label: 'FUEL RATE', value: '6.8 MPG', status: 'EFFICIENT', icon: 'local_gas_station' },
            { label: 'AXLE LOAD (GROSS)', value: '76,220 LBS', status: 'COMPLIANT', icon: 'scale' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container-low p-3 rounded-xl border border-surface-container-high shadow-md flex flex-col justify-between cursor-pointer hover:bg-surface-container-highest transition-colors space-y-1"
              onClick={() => onShowToast(`DIAGNOSTIC PING: ${stat.label} (${stat.value}) is ${stat.status}`)}
            >
              <div className="flex items-center justify-between text-outline text-[10px] font-mono">
                <span className="uppercase font-bold">{stat.label}</span>
                <span className="material-symbols-outlined text-[14px] text-primary">{stat.icon}</span>
              </div>
              <div className="flex items-baseline justify-between pt-1 font-mono">
                <span className="text-[17px] font-bold text-on-surface">{stat.value}</span>
                <span className="text-[9px] text-emerald-400 font-bold">{stat.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Alias export for compatibility
export const TelemetryView = TelemetryScreen;
