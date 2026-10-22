import React, { useState, useMemo } from 'react';
import { MOCK_DISPATCH_LOADS } from '../../data/mockData';
import { DispatchLoad, LoadStatus } from '../../types';

interface DispatchEtaProps {
  onShowToast: (msg: string, icon?: string) => void;
}

const TIMELINE_SLOTS = [
  { hour: 8, label: '08:00 - 10:00 CDT', title: '08:00 Morning Slot' },
  { hour: 10, label: '10:00 - 12:00 CDT', title: '10:00 Midday Slot' },
  { hour: 12, label: '12:00 - 14:00 CDT', title: '12:00 Afternoon Slot' },
  { hour: 14, label: '14:00 - 16:00 CDT', title: '14:00 Late Afternoon' },
  { hour: 16, label: '16:00 - 18:00 CDT', title: '16:00 Evening Slot' },
];

interface QuantumYieldLoad {
  id: string;
  revenuePerDutyHour: string;
  origin: string;
  destination: string;
  corridorDistance: string;
  netQuantumClock: string;
  hosCoherence: string;
  verified: boolean;
  fuelArbitrage?: string;
  cargoTag?: string;
  safetyTags?: string[];
  isDispatched?: boolean;
}

const INITIAL_YIELD_LOADS: QuantumYieldLoad[] = [
  {
    id: 'yield-dal-atl',
    revenuePerDutyHour: '$232.10/Hr',
    origin: 'Dallas, TX',
    destination: 'Atlanta, GA',
    corridorDistance: '781 mi • Corridor',
    netQuantumClock: '$218.40 / Clock',
    hosCoherence: '0%',
    verified: true,
    fuelArbitrage: 'Save $74.40 at Shreveport Pilot ($3.38/gal)',
  },
  {
    id: 'yield-chi-bna',
    revenuePerDutyHour: '$218.40/Hr',
    origin: 'Chicago, IL',
    destination: 'Nashville, TN',
    corridorDistance: '472 mi • 8.2h',
    netQuantumClock: '$232.10 / Clock',
    hosCoherence: 'QP 2%',
    verified: false,
    cargoTag: 'Pharma 34°F • Coyote (QP 2%)',
    safetyTags: ['Zero Sleeper On Road', 'I-65 Corridor Clear'],
  },
  {
    id: 'yield-mem-ind',
    revenuePerDutyHour: '$204.80/Hr',
    origin: 'Memphis, TN',
    destination: 'Indianapolis, IN',
    corridorDistance: '485 mi • Corridor',
    netQuantumClock: '$198.50 / Clock',
    hosCoherence: '96%',
    verified: true,
    fuelArbitrage: 'Save $52.10 at Effingham Flying J ($3.41/gal)',
    safetyTags: ['Direct Crossdock D-12', 'Hazmat Endorsement N/A'],
  },
];

export const DispatchEtaScreen: React.FC<DispatchEtaProps> = ({ onShowToast }) => {
  const [dispatchViewMode, setDispatchViewMode] = useState<'DISPATCH_ZERO' | 'DOCK_TIMELINE'>('DISPATCH_ZERO');
  const [yieldLoads, setYieldLoads] = useState<QuantumYieldLoad[]>(INITIAL_YIELD_LOADS);
  const [loads, setLoads] = useState<DispatchLoad[]>(MOCK_DISPATCH_LOADS);
  const [draggedLoadId, setDraggedLoadId] = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string>('load-8910');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSplitViewActive, setIsSplitViewActive] = useState<boolean>(true);
  const [mapLayer, setMapLayer] = useState<'VECTOR' | 'TRAFFIC' | 'SATELLITE'>('TRAFFIC');

  // Currently selected load
  const selectedLoad = useMemo(() => {
    return loads.find((l) => l.id === selectedLoadId) || loads[0];
  }, [loads, selectedLoadId]);

  // Filtered loads list
  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      if (filterStatus !== 'ALL' && load.status !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          load.loadNumber.toLowerCase().includes(q) ||
          load.driverName.toLowerCase().includes(q) ||
          load.cargoDescription.toLowerCase().includes(q) ||
          load.dockDoor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [loads, filterStatus, searchQuery]);

  // Handle Drag & Drop to Move Load to new Timeline Slot
  const handleDragStart = (e: React.DragEvent, loadId: string) => {
    setDraggedLoadId(loadId);
    e.dataTransfer.setData('text/plain', loadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropSlot = (targetHour: number) => {
    if (!draggedLoadId) return;
    moveLoadToSlot(draggedLoadId, targetHour);
    setDraggedLoadId(null);
  };

  const moveLoadToSlot = (loadId: string, targetHour: number) => {
    const slotInfo = TIMELINE_SLOTS.find((s) => s.hour === targetHour);
    if (!slotInfo) return;

    setLoads((prevLoads) =>
      prevLoads.map((load) => {
        if (load.id !== loadId) return load;

        // Calculate new predictive status based on new slot hour
        let newStatus: LoadStatus = 'ON_TIME';
        let newEtaDisplay = `${String(targetHour).padStart(2, '0')}:45 CDT`;
        let newRisk = 'Adjusted to fit predictive driver HOS and dock availability.';
        let newConfidence = 94;

        if (targetHour >= 16) {
          newStatus = 'DELAY_RISK';
          newRisk = 'Late evening dock slot; high receiver shift change congestion.';
          newConfidence = 78;
        } else if (targetHour === 14 && load.milesRemaining > 200) {
          newStatus = 'CRITICAL_LATE';
          newRisk = 'Transit distance requires mandatory 30m HOS break before 14:00.';
          newConfidence = 65;
        }

        return {
          ...load,
          scheduledSlotHour: targetHour,
          scheduledWindowDisplay: slotInfo.label,
          predictiveEta: newEtaDisplay,
          status: newStatus,
          confidenceScore: newConfidence,
          riskFactor: newRisk,
        };
      })
    );

    const targetLoad = loads.find((l) => l.id === loadId);
    onShowToast(
      `SCHEDULE RE-OPTIMIZED: Load #${targetLoad?.loadNumber || loadId} shifted to ${slotInfo.label}`,
      'edit_calendar'
    );
  };

  // Auto-Optimize algorithm that resolves all delay risks and conflicts automatically
  const handleAutoOptimize = () => {
    setLoads((prevLoads) =>
      prevLoads.map((load) => {
        // Optimize LD-8910 and LD-8920 to realistic non-conflicting slots
        if (load.id === 'load-8910') {
          return {
            ...load,
            scheduledSlotHour: 14,
            scheduledWindowDisplay: '14:00 - 16:00 CDT',
            predictiveEta: '14:20 CDT',
            predictiveEtaMinutesOffset: +20,
            status: 'ON_TIME',
            confidenceScore: 96,
            riskFactor: 'Predictive buffer applied (+20m). I-20 fog risk bypassed via US-80 detour.',
          };
        }
        if (load.id === 'load-8920') {
          return {
            ...load,
            scheduledSlotHour: 18,
            scheduledWindowDisplay: '16:00 - 18:00 CDT',
            predictiveEta: '16:45 CDT',
            predictiveEtaMinutesOffset: +15,
            status: 'ON_TIME',
            confidenceScore: 91,
            riskFactor: 'HOS break scheduled at Tyler Rest Area (MP 540). Dock Door 01 reserved.',
          };
        }
        return load;
      })
    );

    onShowToast('PREDICTIVE DOCK ARRIVAL ENGINE: All 5 active load schedules re-optimized!', 'auto_awesome');
  };

  const handleResetSchedule = () => {
    setLoads(MOCK_DISPATCH_LOADS);
    onShowToast('DISPATCH SCHEDULE RESET TO ORIGINAL BASELINE', 'restart_alt');
  };

  const getStatusBadge = (status: LoadStatus) => {
    switch (status) {
      case 'ON_TIME':
        return {
          label: 'ON-TIME ARRIVAL',
          icon: 'check_circle',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        };
      case 'DELAY_RISK':
        return {
          label: 'DELAY RISK (+88m)',
          icon: 'warning',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'EARLY':
        return {
          label: 'EARLY ARRIVAL',
          icon: 'schedule',
          badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
        };
      case 'CRITICAL_LATE':
      default:
        return {
          label: 'CRITICAL LATE RISK',
          icon: 'error',
          badgeClass: 'bg-error/20 text-error border-error/40 animate-pulse',
        };
    }
  };

  const handleDispatchYieldLoad = (loadId: string) => {
    setYieldLoads((prev) =>
      prev.map((l) => (l.id === loadId ? { ...l, isDispatched: true } : l))
    );
    const target = yieldLoads.find((l) => l.id === loadId);
    onShowToast(`ONE-CLICK QUANTUM DISPATCH LOCKED // ${target?.revenuePerDutyHour} FOR ${target?.origin} -> ${target?.destination}`, 'bolt');
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* 1. TOP VIEW MODE SELECTOR: DISPATCH ZERO vs DOCK TIMELINE */}
      <div className="flex items-center justify-center gap-2 p-1 bg-[#0A0F14] rounded-xl border border-[#1E2532] shadow-lg max-w-md mx-auto w-full">
        <button
          onClick={() => setDispatchViewMode('DISPATCH_ZERO')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            dispatchViewMode === 'DISPATCH_ZERO'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          <span>Dispatch Zero ($/Hr Yield)</span>
        </button>

        <button
          onClick={() => setDispatchViewMode('DOCK_TIMELINE')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            dispatchViewMode === 'DOCK_TIMELINE'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">map</span>
          <span>Timeline &amp; Fleet Map</span>
        </button>
      </div>

      {/* DISPATCH ZERO $/HR YIELD VIEW (Exact Match from Image 2) */}
      {dispatchViewMode === 'DISPATCH_ZERO' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {/* Header matching Image 2 */}
          <div className="text-center pt-1 pb-1">
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              DISPATCH ZERO: $/HR YIELD
            </h1>
            <p className="text-sm font-medium text-slate-300 tracking-wide mt-1">
              Loads Ranked by Remaining Legal Hours
            </p>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {yieldLoads.map((load) => (
              <div
                key={load.id}
                className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3 relative overflow-hidden"
              >
                {/* Top Label & Verified */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#F59E0B] tracking-wider uppercase">
                    REVENUE PER LEGAL DUTY HOUR
                  </span>
                  {load.verified && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                      <span>&#10004;</span>
                      <span>VERIFIED</span>
                    </span>
                  )}
                </div>

                {/* Rate & Origin/Destination */}
                <div className="flex items-baseline flex-wrap gap-2">
                  <span className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-black text-[#FFE500] tracking-tight drop-shadow-[0_0_10px_rgba(255,229,0,0.35)]">
                    {load.revenuePerDutyHour}
                  </span>
                  <span className="text-slate-400 text-lg">&rarr;</span>
                  <span className="font-['Space_Grotesk'] text-lg sm:text-xl font-bold text-white">
                    {load.origin} <span className="text-slate-400 font-normal text-sm sm:text-base">to</span> {load.destination}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-mono -mt-1">
                  {load.corridorDistance}
                </p>

                {/* Net Quantum & Details */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1E2532] text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block">NET QUANTUM</span>
                    <span className="text-[#FFE500] font-bold text-sm">{load.netQuantumClock}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase block">
                      {load.cargoTag ? 'COLD-CHAIN CARGO' : 'HOS Coherence'}
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {load.cargoTag || load.hosCoherence}
                    </span>
                  </div>
                </div>

                {load.fuelArbitrage && (
                  <div className="p-2 rounded-lg bg-[#05080E] border border-[#1E2532] flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="material-symbols-outlined text-[16px] text-amber-400">local_gas_station</span>
                    <span>Fuel Arb: {load.fuelArbitrage}</span>
                  </div>
                )}

                {load.safetyTags && (
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    {load.safetyTags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#05080E] border border-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        <span className="text-[#FFE500]">&#9733;</span>
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Giant Yellow Action Button */}
                <button
                  onClick={() => handleDispatchYieldLoad(load.id)}
                  disabled={load.isDispatched}
                  className={`w-full py-3.5 px-4 rounded-xl font-['Space_Grotesk'] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    load.isDispatched
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                      : 'btn-tactical-yellow'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>{load.isDispatched ? 'DISPATCHED // ON MASTER SCHEDULE' : 'ONE-CLICK QUANTUM DISPATCH'}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Breach Guard Container */}
          <div className="banner-hos-breach p-3.5 sm:p-4 text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-red-400 font-bold">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>HOS Breach Guard: Driver Window 08h 10m remaining</span>
            </div>
            <p className="text-[11px] text-red-200/80 leading-relaxed pl-6">
              Transit demands 12h 15m. Net yield collapsed by Florida Turnpike tolls and empty outbound deadhead.
            </p>
          </div>
        </div>
      )}

      {/* DOCK TIMELINE & MAP VIEW */}
      {dispatchViewMode === 'DOCK_TIMELINE' && (
        <>
      {/* Header Banner */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[26px]">schedule_send</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                Dispatch ETA & Dock Arrival Intelligence
              </span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold uppercase">
                Predictive AI Active
              </span>
            </div>
            <h1 className="font-headline-sm text-on-surface text-[18px] font-bold">
              Dispatch ETA Timeline & Re-Optimization Dashboard
            </h1>
          </div>
        </div>

        {/* Global Dispatch Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            onClick={() => setIsSplitViewActive(!isSplitViewActive)}
            className={`px-3.5 py-2 rounded-lg text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isSplitViewActive
                ? 'bg-primary text-on-primary border border-primary'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSplitViewActive ? 'view_kanban' : 'map'}
            </span>
            <span>{isSplitViewActive ? 'Split-View: Map + Timeline' : 'Show Live Fleet Map'}</span>
          </button>

          <button
            onClick={handleAutoOptimize}
            className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-caps text-[11px] font-bold uppercase tracking-wider border border-primary/30 shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Automatically re-optimize delivery windows to resolve dock conflicts and traffic delays"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>Auto-Optimize</span>
          </button>

          <button
            onClick={handleResetSchedule}
            className="px-2.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface border border-surface-container-high text-[11px] font-mono font-bold transition-all cursor-pointer"
            title="Reset to baseline schedule"
          >
            Reset
          </button>
        </div>
      </div>

      {/* SPLIT VIEW GOOGLE MAPS LIVE FLEET STAGE */}
      {isSplitViewActive && (
        <div className="bg-surface-container p-space-md rounded-xl border border-primary/40 shadow-2xl space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">map</span>
              <div>
                <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px] block">
                  Live Google Maps Fleet Radar & Active Telemetry
                </span>
                <span className="text-[10px] text-outline font-mono">
                  Real-time GPS coordinates, vector traffic alerts & dock ETA vectors for 5 active units.
                </span>
              </div>
            </div>

            {/* Map Controls */}
            <div className="flex items-center gap-1.5 self-start sm:self-center font-mono text-[10px]">
              <span className="text-outline uppercase mr-1">Map View:</span>
              {(['TRAFFIC', 'VECTOR', 'SATELLITE'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  className={`px-2.5 py-1 rounded border transition-all cursor-pointer font-bold ${
                    mapLayer === layer
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-outline border-white/5 hover:text-on-surface'
                  }`}
                >
                  {layer}
                </button>
              ))}
              <button
                onClick={() => onShowToast('GPS FLEET REFRESH: All 5 truck positions updated in 12ms!', 'refresh')}
                className="px-2 py-1 rounded bg-surface-container-high text-primary border border-primary/30 cursor-pointer hover:bg-surface-container-highest"
                title="Refresh active GPS telemetry feed"
              >
                <span className="material-symbols-outlined text-[14px]">my_location</span>
              </button>
            </div>
          </div>

          {/* Interactive Google Maps Stage Render */}
          <div className="relative w-full h-[280px] sm:h-[320px] rounded-xl overflow-hidden border border-surface-container-high bg-[#0f172a] shadow-inner select-none flex flex-col justify-between p-3">
            {/* Simulated Satellite/Vector Background Canvas */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/80 pointer-events-none" />

            {/* Google Maps Header Branding Tag */}
            <div className="relative z-10 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1 rounded-lg backdrop-blur shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono text-[11px] font-bold text-slate-200">
                  Google Maps Platform API &bull; Active Fleet Layer ({mapLayer})
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-700 px-2.5 py-1 rounded-lg backdrop-blur font-mono text-[10px] text-amber-300 font-bold">
                I-20 Corridor &bull; Fort Worth Terminal Gateway
              </div>
            </div>

            {/* Active Fleet Markers Overlay */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-2 my-auto">
              {loads.map((load, idx) => {
                const isSelected = selectedLoadId === load.id;
                const positions = [
                  { lat: '32.7555', lng: '-97.3308', pos: '32%' },
                  { lat: '32.6102', lng: '-96.7970', pos: '48%' },
                  { lat: '32.7300', lng: '-97.1000', pos: '62%' },
                  { lat: '32.8000', lng: '-96.9000', pos: '75%' },
                  { lat: '32.7100', lng: '-97.4000', pos: '88%' },
                ];
                const pos = positions[idx % positions.length];

                return (
                  <div
                    key={load.id}
                    onClick={() => {
                      setSelectedLoadId(load.id);
                      onShowToast(`SELECTED FLEET UNIT ${load.truckUnit} (${load.driverName}) ON MAP`, 'local_shipping');
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer space-y-1 shadow-lg backdrop-blur ${
                      isSelected
                        ? 'bg-primary/25 border-primary text-on-surface ring-2 ring-primary/60 scale-105'
                        : 'bg-slate-900/90 border-slate-700 hover:border-primary/50 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                      <span className="text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                        <span>{load.truckUnit}</span>
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded text-[8px] uppercase ${
                          load.status === 'ON_TIME'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : load.status === 'DELAY_RISK'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {load.dockDoor}
                      </span>
                    </div>

                    <div className="text-[9px] font-mono text-slate-400 truncate">
                      {load.driverName}
                    </div>

                    <div className="text-[9px] font-mono text-emerald-400 flex justify-between pt-0.5 border-t border-slate-800">
                      <span>ETA: {load.predictiveEta}</span>
                      <span>{load.milesRemaining}m</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map Legend Footer Bar */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-slate-400 bg-slate-950/90 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-slate-200 font-bold">Selected Target: <strong className="text-primary">{selectedLoad.truckUnit} ({selectedLoad.driverName})</strong></span>
                <span>&bull;</span>
                <span>Cargo: {selectedLoad.cargoDescription}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span>Destination: {selectedLoad.destinationTerminal}</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  {selectedLoad.dockDoor}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
        <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high shadow-md">
          <span className="font-telemetry-label text-outline text-[10px] uppercase block">
            ACTIVE IN-TRANSIT LOADS
          </span>
          <span className="font-mono text-[18px] font-bold text-primary block mt-0.5">
            {loads.length} Active Shipments
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">100% GPS Connected</span>
        </div>

        <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high shadow-md">
          <span className="font-telemetry-label text-outline text-[10px] uppercase block">
            ON-TIME DOCK PROBABILITY
          </span>
          <span className="font-mono text-[18px] font-bold text-emerald-400 block mt-0.5">
            {Math.round(
              (loads.filter((l) => l.status === 'ON_TIME' || l.status === 'EARLY').length /
                loads.length) *
                100
            )}%
          </span>
          <span className="text-[10px] text-outline font-mono">Predictive AI Model</span>
        </div>

        <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high shadow-md">
          <span className="font-telemetry-label text-outline text-[10px] uppercase block">
            DOCK CONFLICT STATUS
          </span>
          <span className="font-mono text-[18px] font-bold text-on-surface block mt-0.5">
            {loads.filter((l) => l.status === 'CRITICAL_LATE' || l.status === 'DELAY_RISK').length > 0
              ? `${loads.filter((l) => l.status === 'CRITICAL_LATE' || l.status === 'DELAY_RISK').length} Risk Alerts`
              : '0 Conflicts'}
          </span>
          <span className="text-[10px] text-amber-300 font-mono">Live Dock Monitoring</span>
        </div>

        <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high shadow-md">
          <span className="font-telemetry-label text-outline text-[10px] uppercase block">
            AVERAGE ETA VARIANCE
          </span>
          <span className="font-mono text-[18px] font-bold text-sky-400 block mt-0.5">
            +18.4 Min
          </span>
          <span className="text-[10px] text-outline font-mono">Weather/Traffic Factored</span>
        </div>
      </div>

      {/* UNIFIED TIMELINE VISUALIZATION & DRAG-AND-DROP SLOT MATRIX */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-2xl space-y-space-md">
        {/* Section Header & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs border-b border-surface-container-high">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">view_timeline</span>
              <h2 className="font-label-caps text-[14px] text-primary uppercase font-bold tracking-wider">
                Unified Delivery Window Timeline
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono text-[10px] font-bold">
                Drag-and-Drop Slot Re-Optimization
              </span>
            </div>
            <p className="text-[11px] text-outline font-body-sm mt-0.5">
              Drag load cards between time slots to adjust dock appointments and resolve predictive delay bottlenecks.
            </p>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'ON_TIME', 'DELAY_RISK', 'CRITICAL_LATE'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  filterStatus === st
                    ? 'bg-primary text-on-primary shadow'
                    : 'bg-surface-container-low text-outline hover:text-on-surface border border-surface-container-high'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* TIMELINE GRID COLUMNS (08:00 to 18:00) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-space-xs overflow-x-auto min-w-full">
          {TIMELINE_SLOTS.map((slot) => {
            const slotLoads = filteredLoads.filter(
              (load) => load.scheduledSlotHour === slot.hour
            );

            return (
              <div
                key={slot.hour}
                onDragOver={handleDragOver}
                onDrop={() => handleDropSlot(slot.hour)}
                className="bg-surface-container-lowest/80 p-2.5 rounded-xl border border-surface-container-high min-h-[220px] flex flex-col justify-between space-y-2 transition-colors hover:border-primary/40 relative group"
              >
                {/* Time Slot Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <span className="font-mono font-bold text-[12px] text-primary block">
                      {slot.hour}:00 Slot
                    </span>
                    <span className="text-[9px] text-outline font-mono block">
                      {slot.label}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-outline text-[9px] font-mono font-bold">
                    {slotLoads.length} Loads
                  </span>
                </div>

                {/* Slot Loads Container */}
                <div className="space-y-2 flex-1 my-1">
                  {slotLoads.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-3 text-center border-2 border-dashed border-white/5 rounded-lg text-[10px] font-mono text-outline/60">
                      <span className="material-symbols-outlined text-[18px] mb-1">
                        drag_indicator
                      </span>
                      <span>Drop Load Here to Re-Schedule</span>
                    </div>
                  ) : (
                    slotLoads.map((load) => {
                      const badge = getStatusBadge(load.status);
                      const isSelected = selectedLoad.id === load.id;

                      return (
                        <div
                          key={load.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, load.id)}
                          onClick={() => setSelectedLoadId(load.id)}
                          className={`p-2.5 rounded-lg border shadow-md transition-all cursor-grab active:cursor-grabbing select-none ${
                            isSelected
                              ? 'ring-2 ring-primary bg-surface-container-high border-primary/60'
                              : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-outline">
                                drag_handle
                              </span>
                              <span className="font-mono text-[12px] font-bold text-on-surface">
                                {load.loadNumber}
                              </span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border ${badge.badgeClass}`}
                            >
                              {load.status.replace('_', ' ')}
                            </span>
                          </div>

                          <span className="text-[10px] font-mono text-outline block truncate">
                            {load.driverName} &bull; {load.truckUnit}
                          </span>

                          <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9px] font-mono">
                            <span className="text-primary font-bold">{load.dockDoor}</span>
                            <span className="text-outline">ETA {load.predictiveEta}</span>
                          </div>

                          {/* Quick Shift Hour Controls for Touch / Accessibility */}
                          <div className="mt-2 flex items-center justify-between pt-1 border-t border-white/5 gap-1">
                            <button
                              disabled={slot.hour <= 8}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveLoadToSlot(load.id, slot.hour - 2);
                              }}
                              className="px-1.5 py-0.5 rounded bg-surface-container-highest hover:bg-primary/20 text-outline hover:text-primary disabled:opacity-30 text-[9px] font-mono flex items-center gap-0.5 cursor-pointer"
                              title="Shift window 2 hours earlier"
                            >
                              <span className="material-symbols-outlined text-[10px]">arrow_back</span>
                              <span>Earlier</span>
                            </button>

                            <button
                              disabled={slot.hour >= 16}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveLoadToSlot(load.id, slot.hour + 2);
                              }}
                              className="px-1.5 py-0.5 rounded bg-surface-container-highest hover:bg-primary/20 text-outline hover:text-primary disabled:opacity-30 text-[9px] font-mono flex items-center gap-0.5 cursor-pointer"
                              title="Shift window 2 hours later"
                            >
                              <span>Later</span>
                              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="text-[8px] font-mono text-outline text-center">
                  Predictive Dock Slot #{slot.hour / 2 - 3}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED LOAD PREDICTIVE DOCK ARRIVAL DETAILS CARD */}
      {selectedLoad && (
        <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-2 border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">analytics</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
                    Load #{selectedLoad.loadNumber} &bull; {selectedLoad.cargoDescription}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono text-[9px] font-bold">
                    {selectedLoad.priority} PRIORITY
                  </span>
                </div>
                <span className="text-[11px] text-outline font-mono block mt-0.5">
                  Driver: {selectedLoad.driverName} ({selectedLoad.truckUnit} / {selectedLoad.trailerUnit})
                </span>
              </div>
            </div>

            {/* Notify Driver & Receiver Action */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() =>
                  onShowToast(
                    `DISPATCH SYNC: Direct ETA alert sent to Driver ${selectedLoad.driverName}'s HUD and Receiver Terminal.`,
                    'cell_tower'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary border border-surface-container-highest font-label-caps text-[11px] font-bold uppercase tracking-wider shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                <span>Notify Driver & Receiver</span>
              </button>
            </div>
          </div>

          {/* Predictive Metrics Detail Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-white/5">
              <span className="text-[9px] text-outline uppercase block">SCHEDULED WINDOW</span>
              <span className="text-[13px] font-bold text-primary block mt-0.5">
                {selectedLoad.scheduledWindowDisplay}
              </span>
              <span className="text-[9px] text-outline block mt-0.5">
                Terminal Slot #{selectedLoad.scheduledSlotHour}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-white/5">
              <span className="text-[9px] text-outline uppercase block">PREDICTIVE DOCK ETA</span>
              <span className="text-[13px] font-bold text-on-surface block mt-0.5">
                {selectedLoad.predictiveEta}
              </span>
              <span
                className={`text-[9px] font-bold block mt-0.5 ${
                  selectedLoad.predictiveEtaMinutesOffset > 0 ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {selectedLoad.predictiveEtaMinutesOffset > 0
                  ? `+${selectedLoad.predictiveEtaMinutesOffset}m Variance`
                  : `${selectedLoad.predictiveEtaMinutesOffset}m Variance`}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-white/5">
              <span className="text-[9px] text-outline uppercase block">AI CONFIDENCE SCORE</span>
              <span className="text-[13px] font-bold text-emerald-400 block mt-0.5">
                {selectedLoad.confidenceScore}% Confidence
              </span>
              <span className="text-[9px] text-outline block mt-0.5">LiDAR + GPS Mesh</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-white/5">
              <span className="text-[9px] text-outline uppercase block">DOCK DOOR ASSIGNMENT</span>
              <span className="text-[13px] font-bold text-primary block mt-0.5">
                {selectedLoad.dockDoor}
              </span>
              <span className="text-[9px] text-outline block mt-0.5">
                {selectedLoad.destinationTerminal}
              </span>
            </div>
          </div>

          {/* Predictive Risk Factor Analysis Banner */}
          <div className="p-3 rounded-lg bg-surface-container-lowest border border-white/5 text-[11px] font-mono leading-relaxed space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-primary font-bold uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">psychology</span>
                <span>Predictive Dock Arrival Analysis & Risk Factors:</span>
              </span>
              <span className="text-outline text-[10px]">
                HOS Clock Remaining: <strong className="text-on-surface">{selectedLoad.hosRemaining}</strong>
              </span>
            </div>

            <p className="text-outline">{selectedLoad.riskFactor}</p>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
