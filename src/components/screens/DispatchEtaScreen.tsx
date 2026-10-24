import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MOCK_DISPATCH_LOADS } from '../../data/mockData';
import { DispatchLoad, LoadStatus, DispatchMonitorDriver, BrokeredLoadMemory } from '../../types';
import {
  loadMonitorDrivers,
  saveMonitorDrivers,
  refreshDriverMarkers5s,
  getStatusStyle,
  getNextMasterLoopStatus,
  advanceDriverStatus,
  sendOneClickMessageToDriver,
  ONE_CLICK_MESSAGE_PRESETS,
} from '../../services/liveDispatchMonitorService';
import { brokeredLoadsMemoryService } from '../../services/brokeredLoadsMemoryService';
import { buildSmsDeepLink, playDispatchLoopChime, speakDispatchNotification } from '../../services/driverDispatchLoopService';

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
  const [dispatchViewMode, setDispatchViewMode] = useState<
    'DISPATCH_ZERO' | 'LIVE_DISPATCH_MONITOR' | 'BROKERED_MEMORY' | 'DOCK_TIMELINE'
  >('DISPATCH_ZERO');
  const [yieldLoads, setYieldLoads] = useState<QuantumYieldLoad[]>(INITIAL_YIELD_LOADS);
  const [loads, setLoads] = useState<DispatchLoad[]>(MOCK_DISPATCH_LOADS);
  const [draggedLoadId, setDraggedLoadId] = useState<string | null>(null);
  const [selectedLoadId, setSelectedLoadId] = useState<string>('load-8910');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSplitViewActive, setIsSplitViewActive] = useState<boolean>(true);
  const [mapLayer, setMapLayer] = useState<'VECTOR' | 'TRAFFIC' | 'SATELLITE'>('TRAFFIC');

  // ==========================================================================
  // LIVE DISPATCH MONITOR STATE & 5-SECOND GPS REFRESH ENGINE
  // ==========================================================================
  const [monitorDrivers, setMonitorDrivers] = useState<DispatchMonitorDriver[]>(loadMonitorDrivers);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-marcus-702'); // Starts on High Priority alert unit
  const [refreshCountdown, setRefreshCountdown] = useState<number>(5);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => new Date().toLocaleTimeString());
  const [onlyPriorityAlerts, setOnlyPriorityAlerts] = useState<boolean>(false);
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState<boolean>(true);

  // Active selected driver memo
  const activeSelectedDriver = useMemo(() => {
    return monitorDrivers.find((d) => d.id === selectedDriverId) || monitorDrivers[0];
  }, [monitorDrivers, selectedDriverId]);

  // High Priority Drivers with active alerts
  const highPriorityDrivers = useMemo(() => {
    return monitorDrivers.filter((d) => d.hasPriorityAlert);
  }, [monitorDrivers]);

  // Filtered monitor drivers list
  const filteredMonitorDrivers = useMemo(() => {
    if (onlyPriorityAlerts) {
      return monitorDrivers.filter((d) => d.hasPriorityAlert);
    }
    return monitorDrivers;
  }, [monitorDrivers, onlyPriorityAlerts]);

  // ==========================================================================
  // AUTOMATED 5-SECOND REFRESH ENGINE FOR LIVE_DISPATCH_MONITOR MODE
  // ==========================================================================
  useEffect(() => {
    if (dispatchViewMode !== 'LIVE_DISPATCH_MONITOR' || !isAutoRefreshActive) return;

    // 1-second countdown ticker
    const countdownTicker = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 5 : prev - 1));
    }, 1000);

    // 5-second marker position refresh
    const refreshInterval = setInterval(() => {
      setMonitorDrivers((prev) => {
        const refreshed = refreshDriverMarkers5s(prev);
        saveMonitorDrivers(refreshed);
        return refreshed;
      });
      setLastRefreshedAt(new Date().toLocaleTimeString());
      setRefreshCountdown(5);
    }, 5000);

    return () => {
      clearInterval(countdownTicker);
      clearInterval(refreshInterval);
    };
  }, [dispatchViewMode, isAutoRefreshActive]);

  // Manual GPS Marker Refresh Trigger
  const handleManualGpsRefresh = () => {
    setMonitorDrivers((prev) => {
      const refreshed = refreshDriverMarkers5s(prev);
      saveMonitorDrivers(refreshed);
      return refreshed;
    });
    setLastRefreshedAt(new Date().toLocaleTimeString());
    setRefreshCountdown(5);
    onShowToast('GPS RADAR REFRESH: All 5 fleet unit telemetry markers updated in 8ms!', 'my_location');
  };

  // ==========================================================================
  // BROKERED LOADS SHIPPERS & RECEIVERS REPEATED TIME MEMORY STATE
  // ==========================================================================
  const [brokeredMemories, setBrokeredMemories] = useState<BrokeredLoadMemory[]>(() =>
    brokeredLoadsMemoryService.getAll()
  );
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>('mem-chr-chi-atl');
  const [memorySearchQuery, setMemorySearchQuery] = useState<string>('');
  const [isLogDwellModalOpen, setIsLogDwellModalOpen] = useState<boolean>(false);
  const [logActualDwell, setLogActualDwell] = useState<number>(195);
  const [logActualUnload, setLogActualUnload] = useState<number>(150);
  const [logActualTransit, setLogActualTransit] = useState<number>(12.8);
  const [logContractedRate, setLogContractedRate] = useState<number>(2540);

  // Filtered Brokered Loads Memories
  const filteredMemories = useMemo(() => {
    return brokeredMemories.filter((mem) => {
      if (!memorySearchQuery.trim()) return true;
      const q = memorySearchQuery.toLowerCase();
      return (
        mem.brokerName.toLowerCase().includes(q) ||
        mem.shipperFacility.name.toLowerCase().includes(q) ||
        mem.shipperFacility.cityState.toLowerCase().includes(q) ||
        mem.receiverFacility.name.toLowerCase().includes(q) ||
        mem.receiverFacility.cityState.toLowerCase().includes(q) ||
        mem.commodity.toLowerCase().includes(q) ||
        mem.lane.corridor.toLowerCase().includes(q)
      );
    });
  }, [brokeredMemories, memorySearchQuery]);

  // Currently selected memory entry
  const selectedMemory = useMemo(() => {
    return brokeredMemories.find((m) => m.id === selectedMemoryId) || brokeredMemories[0];
  }, [brokeredMemories, selectedMemoryId]);

  // Handle Recording New Dwell Time into Rolling Memory
  const handleSaveDwellMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemory) return;

    const updated = brokeredLoadsMemoryService.recordNewCycle(
      selectedMemory.id,
      Number(logActualDwell),
      Number(logActualUnload),
      Number(logActualTransit),
      Number(logContractedRate)
    );

    if (updated) {
      setBrokeredMemories(brokeredLoadsMemoryService.getAll());
      onShowToast(
        `REPEATED TIME MEMORY UPDATED: ${updated.shipperFacility.name} (Avg Dwell: ${Math.floor(updated.shipperFacility.avgDwellMinutes / 60)}h ${updated.shipperFacility.avgDwellMinutes % 60}m across ${updated.shipperFacility.repeatedVisitsCount} loads)`,
        'history'
      );
    }
    setIsLogDwellModalOpen(false);
  };

  // Currently selected load for timeline
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

  // Drag & drop handlers
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

  const handleAutoOptimize = () => {
    setLoads((prevLoads) =>
      prevLoads.map((load) => {
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
    onShowToast('PREDICTIVE DOCK ARRIVAL ENGINE: All active load schedules re-optimized!', 'auto_awesome');
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
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* ==================================================================== */}
      {/* 1. TOP VIEW MODE SELECTOR: 4 INTEGRATED COCKPIT MODES                */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-1.5 rounded-2xl border border-[#1E2532] shadow-2xl max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {/* Button 1: DISPATCH ZERO */}
          <button
            onClick={() => setDispatchViewMode('DISPATCH_ZERO')}
            className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              dispatchViewMode === 'DISPATCH_ZERO'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.45)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>Dispatch Zero ($/Hr)</span>
          </button>

          {/* Button 2: LIVE DISPATCH MONITOR (AUTOMATIC 5s GPS REFRESH & ALERTS) */}
          <button
            onClick={() => setDispatchViewMode('LIVE_DISPATCH_MONITOR')}
            className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 relative overflow-hidden ${
              dispatchViewMode === 'LIVE_DISPATCH_MONITOR'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.45)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="material-symbols-outlined text-[16px]">radar</span>
            <span>Live Monitor (5s)</span>
          </button>

          {/* Button 3: BROKERED LOADS SHIPPERS & RECEIVERS REPEATED TIME MEMORY */}
          <button
            onClick={() => setDispatchViewMode('BROKERED_MEMORY')}
            className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              dispatchViewMode === 'BROKERED_MEMORY'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.45)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Brokered Memory</span>
          </button>

          {/* Button 4: DOCK TIMELINE & MAP */}
          <button
            onClick={() => setDispatchViewMode('DOCK_TIMELINE')}
            className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              dispatchViewMode === 'DOCK_TIMELINE'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.45)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_timeline</span>
            <span>Dock Timeline</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: DISPATCH ZERO $/HR YIELD VIEW                                */}
      {/* ==================================================================== */}
      {dispatchViewMode === 'DISPATCH_ZERO' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full animate-fade-in">
          {/* Header */}
          <div className="text-center pt-1 pb-1">
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              DISPATCH ZERO: $/HR YIELD
            </h1>
            <p className="text-sm font-medium text-slate-300 tracking-wide mt-1">
              Loads Ranked by Remaining Legal Hours
            </p>
          </div>

          {/* Yield Cards */}
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

                {/* Tactical Yellow CTA */}
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

      {/* ==================================================================== */}
      {/* MODE 2: LIVE DISPATCH MONITOR (AUTOMATIC 5s GPS REFRESH & ALERTS)    */}
      {/* ==================================================================== */}
      {dispatchViewMode === 'LIVE_DISPATCH_MONITOR' && (
        <div className="space-y-4 animate-fade-in">
          {/* Active High-Priority Alert Banner */}
          {highPriorityDrivers.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-2 border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500 text-red-400 flex items-center justify-center shrink-0 animate-pulse">
                  <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-500 text-black font-black text-[10px] tracking-widest uppercase">
                      CRITICAL FLEET ALERT
                    </span>
                    <span className="text-[11px] text-red-300 font-bold">
                      {highPriorityDrivers.length} Unit(s) Requiring Immediate Dispatch Intervention
                    </span>
                  </div>
                  <p className="text-[11px] text-red-100/90 mt-0.5">
                    <strong>Marcus Ortiz (TR-702):</strong> Reefer Temp Dev +6.2°F // <strong>Devon Hayes (TR-518):</strong> Detention +88m Exceeded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setOnlyPriorityAlerts(!onlyPriorityAlerts)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                    onlyPriorityAlerts
                      ? 'bg-red-500 text-black border border-red-400'
                      : 'bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                  <span>{onlyPriorityAlerts ? 'Showing Alert Units' : 'Filter Alert Markers'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Telemetry Transponder Control & Auto-Refresh Header Bar */}
          <div className="bg-[#0A0F14] p-3.5 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    LIVE DISPATCH GPS MONITOR
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>AUTO-REFRESH: 5s ACTIVE</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Last synced: <strong className="text-slate-200">{lastRefreshedAt}</strong></span>
                  <span>&bull;</span>
                  <span>Next GPS pulse in: <strong className="text-[#FFE500] font-bold">{refreshCountdown}s</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Map Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleManualGpsRefresh}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary border border-primary/40 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                title="Force instant GPS transponder telemetry refresh"
              >
                <span className="material-symbols-outlined text-[15px]">refresh</span>
                <span>Refresh Now</span>
              </button>

              <button
                onClick={() => setIsAutoRefreshActive(!isAutoRefreshActive)}
                className={`px-3 py-1.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  isAutoRefreshActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isAutoRefreshActive ? 'timer' : 'timer_off'}
                </span>
                <span>{isAutoRefreshActive ? '5s Loop On' : 'Paused'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Google Maps Platform / Radar Viewport */}
          <div className="bg-[#05080E] p-3 rounded-2xl border-2 border-[#1E2532] shadow-2xl space-y-3 relative overflow-hidden font-mono">
            {/* Maps Canvas Stage */}
            <div className="relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-slate-800 bg-[#070A10] select-none p-3 flex flex-col justify-between">
              {/* Tactical Radar Grid Watermark */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#FFE500_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05080E] via-transparent to-[#05080E]/90 pointer-events-none" />

              {/* Map Top Branding Layer */}
              <div className="relative z-10 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 bg-[#0A0F18]/90 border border-slate-700 px-3 py-1.5 rounded-xl backdrop-blur shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-white tracking-wide">
                    Google Maps Platform API &bull; Live Fleet Transponders (5s Stream)
                  </span>
                </div>

                <div className="bg-[#0A0F18]/90 border border-slate-700 px-2.5 py-1 rounded-xl backdrop-blur text-[10px] text-amber-300 font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                  <span>Corridor Radar Mesh</span>
                </div>
              </div>

              {/* ACTIVE FLEET MARKERS ON MAP (WITH HIGH PRIORITY HIGHLIGHTS) */}
              <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-auto">
                {filteredMonitorDrivers.map((drv) => {
                  const isSelected = selectedDriverId === drv.id;
                  const isHighPriority = drv.hasPriorityAlert;
                  const statusStyle = getStatusStyle(drv.currentStatus);

                  return (
                    <div
                      key={drv.id}
                      onClick={() => {
                        setSelectedDriverId(drv.id);
                        onShowToast(`SELECTED FLEET UNIT ${drv.truckUnit} (${drv.name}) ON MAP`, 'local_shipping');
                      }}
                      className={`relative p-3 rounded-2xl transition-all cursor-pointer backdrop-blur shadow-2xl flex flex-col justify-between space-y-2 ${
                        isHighPriority
                          ? 'bg-[#180A0A]/95 border-2 border-red-500 ring-4 ring-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.7)] scale-102'
                          : isSelected
                          ? 'bg-[#0E1522]/95 border-2 border-[#FFE500] ring-4 ring-[#FFE500]/40 shadow-[0_0_20px_rgba(255,229,0,0.35)] scale-102'
                          : 'bg-[#0A0F1A]/90 border border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* High Priority Pulsing Ping Wave */}
                      {isHighPriority && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90" />
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow" />
                        </span>
                      )}

                      {/* Top Header: Truck Unit, Driver Name & Status */}
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-7 h-7 rounded-lg ${drv.avatarColor} text-white flex items-center justify-center text-[10px] font-black shadow`}
                          >
                            {drv.avatarInitials}
                          </div>
                          <div>
                            <span className="text-white block font-black text-[13px]">{drv.truckUnit}</span>
                            <span className="text-[10px] text-slate-400 truncate block">{drv.name}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            isHighPriority
                              ? 'bg-red-500 text-black animate-pulse'
                              : `${statusStyle.badgeBg} ${statusStyle.badgeText}`
                          }`}
                        >
                          {isHighPriority ? 'HIGH PRIORITY' : statusStyle.pillLabel.split('//')[0]}
                        </span>
                      </div>

                      {/* HIGH PRIORITY CALLOUT DETAILS */}
                      {isHighPriority && drv.priorityAlertDetails && (
                        <div className="p-1.5 rounded-lg bg-red-950/80 border border-red-500/70 text-[10px] text-red-200 font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-red-400 animate-bounce">
                            warning
                          </span>
                          <span className="truncate">{drv.priorityAlertDetails}</span>
                        </div>
                      )}

                      {/* Speed, Heading, Location & Telemetry Strip */}
                      <div className="text-[10px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-[#FFE500] font-bold">
                          {drv.speedMph > 0 ? `${drv.speedMph} MPH` : 'AT DOCK'} &bull; {drv.headingDeg}° HDG
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {drv.milesRemaining > 0 ? `${drv.milesRemaining}m rem` : 'ARRIVED'}
                        </span>
                      </div>

                      {/* Location snippet */}
                      <div className="text-[9px] text-slate-400 truncate">
                        {drv.currentLocationName}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map Footer: Active Transponder Legend */}
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-300 bg-[#0A0E18]/95 p-2 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold">
                    Active Transponder: <strong className="text-[#FFE500]">{activeSelectedDriver.truckUnit} ({activeSelectedDriver.name})</strong>
                  </span>
                  <span>&bull;</span>
                  <span>Load: #{activeSelectedDriver.loadNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">Destination: {activeSelectedDriver.destinationCity}, {activeSelectedDriver.destinationState}</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    ETA {activeSelectedDriver.etaDestination}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Driver Detailed Telematics & Directives Console */}
            {activeSelectedDriver && (
              <div className="bg-[#0A0F18] p-4 rounded-xl border border-slate-800 shadow-xl space-y-3 animate-fade-in font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${activeSelectedDriver.avatarColor} text-white flex items-center justify-center font-bold text-sm shadow`}
                    >
                      {activeSelectedDriver.avatarInitials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white uppercase">{activeSelectedDriver.name}</h3>
                        <span className="px-2 py-0.5 rounded bg-[#1B263B] text-[#FFE500] text-xs font-bold">
                          UNIT {activeSelectedDriver.truckUnit} &bull; {activeSelectedDriver.trailerUnit}
                        </span>
                        {activeSelectedDriver.hasPriorityAlert && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold animate-pulse">
                            ACTIVE HIGH PRIORITY ALERT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Commodity: <strong className="text-slate-200">{activeSelectedDriver.commodity}</strong> &bull; BOL: {activeSelectedDriver.bolNumber}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Communications */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={buildSmsDeepLink(activeSelectedDriver.phone, `[TruckWithEase Dispatch] Directive for Unit ${activeSelectedDriver.truckUnit}: Please confirm status.`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-xs font-bold uppercase transition flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">sms</span>
                      <span>SMS Directive</span>
                    </a>

                    <a
                      href={`tel:${activeSelectedDriver.phone}`}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 text-xs font-bold uppercase transition flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">call</span>
                      <span>Direct Call</span>
                    </a>

                    <button
                      onClick={() => {
                        advanceDriverStatus(activeSelectedDriver.id, getNextMasterLoopStatus(activeSelectedDriver.currentStatus), monitorDrivers);
                        setMonitorDrivers(loadMonitorDrivers());
                        onShowToast(`ADVANCED DIRECTIVE: ${activeSelectedDriver.name} advanced to next stage!`, 'rocket_launch');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FFE500] hover:brightness-110 text-black text-xs font-black uppercase tracking-wider transition shadow flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">fast_forward</span>
                      <span>Advance Loop Phase</span>
                    </button>
                  </div>
                </div>

                {/* Live CAN-Bus & Sensor Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">TRANSIT SPEED / CRUISE</span>
                    <span className="text-base font-bold text-white block mt-0.5">{activeSelectedDriver.speedMph} MPH</span>
                    <span className="text-[10px] text-emerald-400">{activeSelectedDriver.cruiseControlStatus}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">ENGINE RPM / GEAR</span>
                    <span className="text-base font-bold text-[#FFE500] block mt-0.5">{activeSelectedDriver.engineRpm} RPM</span>
                    <span className="text-[10px] text-slate-400">{activeSelectedDriver.transmissionGear}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">COLD-CHAIN REEFER TEMP</span>
                    <span className={`text-base font-bold block mt-0.5 ${
                      activeSelectedDriver.hasPriorityAlert ? 'text-red-400 animate-pulse' : 'text-cyan-300'
                    }`}>
                      {activeSelectedDriver.reeferTempF !== undefined ? `${activeSelectedDriver.reeferTempF.toFixed(1)}°F` : 'DRY VAN N/A'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">
                      Setpoint: {activeSelectedDriver.reeferSetpointF !== undefined ? `${activeSelectedDriver.reeferSetpointF}°F` : 'N/A'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">HOS DRIVE CLOCK REMAINING</span>
                    <span className="text-base font-bold text-emerald-400 block mt-0.5">
                      {Math.floor((activeSelectedDriver.hosDriveRemainingMin || 495) / 60)}h {(activeSelectedDriver.hosDriveRemainingMin || 495) % 60}m
                    </span>
                    <span className="text-[10px] text-slate-400">11-Hour Federal Clock</span>
                  </div>
                </div>

                {/* Detention & Directive Presets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">DOCK DETENTION TIME ACCRUED</span>
                      <span className="text-sm font-bold text-amber-300">{activeSelectedDriver.detentionMinutes} Minutes</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">DETENTION CLAIM</span>
                      <span className="text-sm font-bold text-emerald-400">
                        ${Math.round((activeSelectedDriver.detentionMinutes / 60) * (activeSelectedDriver.detentionHourlyRate || 75))}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#05080E] border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">1-CLICK CAB BROADCAST</span>
                      <span className="text-xs text-slate-300 font-bold">Send Voice Telematics Directive</span>
                    </div>
                    <button
                      onClick={() => {
                        speakDispatchNotification(`Dispatch directive for fleet unit ${activeSelectedDriver.truckUnit}. Stand by for load acknowledgment.`);
                        onShowToast(`VOICE DIRECTIVE RELAYED TO CAB: Unit ${activeSelectedDriver.truckUnit}`, 'volume_up');
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">volume_up</span>
                      <span>Voice Cab</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 3: BROKERED LOADS SHIPPERS & RECEIVERS REPEATED TIME MEMORY     */}
      {/* ==================================================================== */}
      {dispatchViewMode === 'BROKERED_MEMORY' && (
        <div className="space-y-4 animate-fade-in font-mono">
          {/* Header Banner */}
          <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFE500]/20 border border-[#FFE500]/40 text-[#FFE500] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">history</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#FFE500] tracking-wider uppercase">
                    BROKERED LOADS: SHIPPERS &amp; RECEIVERS MEMORY
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/40">
                    REPEATED TIME ENGINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Automated memory of recurring shipper loading dwell times, receiver unload latencies &amp; broker rate yield
                </p>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Filter shipper, receiver, broker..."
                value={memorySearchQuery}
                onChange={(e) => setMemorySearchQuery(e.target.value)}
                className="w-full bg-[#05080E] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFE500]"
              />
            </div>
          </div>

          {/* KPI Strip for Repeated Time Memory */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#0A0F14] border border-[#1E2532] space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">RECURRING LANES IN MEMORY</span>
              <span className="text-xl font-bold text-white block">{brokeredMemories.length} Key Corridors</span>
              <span className="text-[10px] text-emerald-400">100% Lane History Saved</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-[#1E2532] space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL REPEATED CYCLES</span>
              <span className="text-xl font-bold text-[#FFE500] block">
                {brokeredMemories.reduce((sum, m) => sum + m.shipperFacility.repeatedVisitsCount, 0)} Cycles Logged
              </span>
              <span className="text-[10px] text-slate-400">Rolling Weighted Averages</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-[#1E2532] space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">AVG SHIPPER LOADING DWELL</span>
              <span className="text-xl font-bold text-amber-300 block">
                {Math.round(
                  brokeredMemories.reduce((sum, m) => sum + m.shipperFacility.avgDwellMinutes, 0) /
                    brokeredMemories.length
                )}{' '}
                Mins
              </span>
              <span className="text-[10px] text-slate-400">Historical Facility Turn</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-[#1E2532] space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">AVG RECEIVER UNLOAD DWELL</span>
              <span className="text-xl font-bold text-sky-400 block">
                {Math.round(
                  brokeredMemories.reduce((sum, m) => sum + m.receiverFacility.avgUnloadMinutes, 0) /
                    brokeredMemories.length
                )}{' '}
                Mins
              </span>
              <span className="text-[10px] text-slate-400">Dock Turnaround Velocity</span>
            </div>
          </div>

          {/* Brokered Loads Memory Cards Grid */}
          <div className="space-y-4">
            {filteredMemories.map((mem) => {
              const shipperHours = Math.floor(mem.shipperFacility.avgDwellMinutes / 60);
              const shipperMins = mem.shipperFacility.avgDwellMinutes % 60;
              const receiverHours = Math.floor(mem.receiverFacility.avgUnloadMinutes / 60);
              const receiverMins = mem.receiverFacility.avgUnloadMinutes % 60;

              return (
                <div
                  key={mem.id}
                  className="bg-[#0A0F14] p-4 sm:p-5 rounded-2xl border border-[#1E2532] shadow-2xl space-y-4 relative overflow-hidden"
                >
                  {/* Card Header: Broker & Reliability */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2532] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-[#FFE500] flex items-center justify-center font-bold text-xs">
                        MC
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white uppercase">{mem.brokerName}</span>
                          <span className="text-xs text-slate-400">({mem.brokerMc})</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{mem.commodity}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase">
                        GRADE {mem.reliabilityScorecard.overallGrade} RELIABILITY
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {mem.shipperFacility.repeatedVisitsCount} REPEATED RUNS
                      </span>
                    </div>
                  </div>

                  {/* Dual Facility Memory Columns: Shipper vs Receiver */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Shipper Facility Memory */}
                    <div className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">upload</span>
                          <span>ORIGIN SHIPPER FACILITY</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px]">
                          {mem.shipperFacility.repeatedVisitsCount} LOADS VISITED
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{mem.shipperFacility.name}</h4>
                      <p className="text-[11px] text-slate-400">{mem.shipperFacility.address}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">AVG LOADING DWELL</span>
                          <span className="text-base font-bold text-amber-300">
                            {shipperHours > 0 ? `${shipperHours}h ` : ''}{shipperMins}m
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">DOCK ON-TIME PROB</span>
                          <span className="text-base font-bold text-emerald-400">
                            {mem.shipperFacility.onTimeDockProbabilityPct}%
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-300 pt-1 space-y-0.5">
                        <div>Gate Code: <strong className="text-[#FFE500]">{mem.shipperFacility.gateCode}</strong></div>
                        <div className="text-slate-400 italic leading-snug">{mem.shipperFacility.notes}</div>
                      </div>
                    </div>

                    {/* Receiver Facility Memory */}
                    <div className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          <span>DESTINATION RECEIVER FACILITY</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[9px]">
                          {mem.receiverFacility.repeatedVisitsCount} UNLOADS VISITED
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{mem.receiverFacility.name}</h4>
                      <p className="text-[11px] text-slate-400">{mem.receiverFacility.address}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">AVG UNLOAD DWELL</span>
                          <span className="text-base font-bold text-sky-400">
                            {receiverHours > 0 ? `${receiverHours}h ` : ''}{receiverMins}m
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-bold">UNLOAD DETENTION</span>
                          <span className="text-base font-bold text-slate-200">
                            Free &lt; {mem.receiverFacility.detentionThresholdMinutes / 60}h
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-300 pt-1 space-y-0.5">
                        <div>Gate Code: <strong className="text-[#FFE500]">{mem.receiverFacility.gateCode}</strong></div>
                        <div className="text-slate-400 italic leading-snug">{mem.receiverFacility.notes}</div>
                      </div>
                    </div>
                  </div>

                  {/* Corridor Transit Velocity & Financial Yield Memory */}
                  <div className="p-3 rounded-xl bg-[#070B12] border border-[#1E2532] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">REPEATED TRANSIT CORRIDOR</span>
                      <span className="text-sm font-bold text-white">
                        {mem.lane.origin} &rarr; {mem.lane.destination} ({mem.lane.totalDistanceMiles} mi)
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        Avg Transit Velocity: <strong className="text-emerald-400">{mem.lane.avgHistoricalTransitHours} Hours</strong> across {mem.lane.repeatCyclesCount} cycles
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">HISTORICAL YIELD PER LEGAL HOUR</span>
                      <span className="font-['Space_Grotesk'] text-2xl font-black text-[#FFE500] drop-shadow-[0_0_10px_rgba(255,229,0,0.35)] block">
                        {mem.financialMemory.historicalYieldRate}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Contracted: ${mem.financialMemory.lastContractedRate.toLocaleString()} (${mem.financialMemory.avgRatePerMile}/mi) &bull; {mem.financialMemory.paymentTermsDays}d QuickPay
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons: 1-Click Quantum Dispatch & Record Actual Dwell */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedMemoryId(mem.id);
                        setLogActualDwell(mem.shipperFacility.avgDwellMinutes);
                        setLogActualUnload(mem.receiverFacility.avgUnloadMinutes);
                        setLogActualTransit(mem.lane.avgHistoricalTransitHours);
                        setLogContractedRate(mem.financialMemory.lastContractedRate);
                        setIsLogDwellModalOpen(true);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary border border-primary/40 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                      <span>+ Log Completed Run Dwell</span>
                    </button>

                    <button
                      onClick={() => {
                        onShowToast(
                          `ONE-CLICK QUANTUM DISPATCH LOCKED // ${mem.financialMemory.historicalYieldRate} FOR ${mem.lane.origin} -> ${mem.lane.destination} WITH SAVED FACILITY MEMORY BUFFERS`,
                          'bolt'
                        );
                      }}
                      className="py-2.5 px-3 rounded-xl btn-tactical-yellow text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>1-Click Dispatch With Memory</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Log Completed Run Dwell Modal */}
          {isLogDwellModalOpen && selectedMemory && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[#0A0F14] p-6 rounded-2xl border-2 border-[#FFE500] shadow-2xl max-w-lg w-full space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#FFE500] text-[24px]">history_edu</span>
                    <div>
                      <h3 className="text-base font-bold text-white uppercase">Log Completed Run Dwell</h3>
                      <p className="text-[11px] text-slate-400">Updates rolling repeated time memory for this corridor</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsLogDwellModalOpen(false)}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <form onSubmit={handleSaveDwellMemory} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Shipper Loading Dwell (Minutes):
                    </label>
                    <input
                      type="number"
                      value={logActualDwell}
                      onChange={(e) => setLogActualDwell(Number(e.target.value))}
                      className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-[#FFE500] focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Facility: {selectedMemory.shipperFacility.name}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Receiver Unload Dwell (Minutes):
                    </label>
                    <input
                      type="number"
                      value={logActualUnload}
                      onChange={(e) => setLogActualUnload(Number(e.target.value))}
                      className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-[#FFE500] focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Facility: {selectedMemory.receiverFacility.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                        Transit Time (Hours):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={logActualTransit}
                        onChange={(e) => setLogActualTransit(Number(e.target.value))}
                        className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-[#FFE500] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                        Contracted Rate ($):
                      </label>
                      <input
                        type="number"
                        value={logContractedRate}
                        onChange={(e) => setLogContractedRate(Number(e.target.value))}
                        className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-[#FFE500] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsLogDwellModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold uppercase text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl btn-tactical-yellow font-black uppercase text-xs cursor-pointer"
                    >
                      Save to Rolling Memory
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 4: DOCK TIMELINE & MAP VIEW                                     */}
      {/* ==================================================================== */}
      {dispatchViewMode === 'DOCK_TIMELINE' && (
        <>
          {/* Header Banner */}
          <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm font-mono">
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

          {/* Timeline Drag-and-Drop Slot Grid */}
          <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-2xl space-y-space-md font-mono">
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
                <p className="text-[11px] text-outline mt-0.5">
                  Drag load cards between time slots to adjust dock appointments and resolve predictive delay bottlenecks.
                </p>
              </div>
            </div>

            {/* Slots Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {TIMELINE_SLOTS.map((slot) => {
                const slotLoads = filteredLoads.filter((l) => l.scheduledSlotHour === slot.hour);
                return (
                  <div
                    key={slot.hour}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropSlot(slot.hour)}
                    className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between min-h-[220px] space-y-2"
                  >
                    <div className="border-b border-surface-container-high pb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">{slot.hour}:00 Slot</span>
                      <span className="text-[10px] text-outline font-bold">({slotLoads.length})</span>
                    </div>

                    <div className="space-y-2 flex-1">
                      {slotLoads.map((load) => {
                        const badge = getStatusBadge(load.status);
                        const isSelected = selectedLoadId === load.id;
                        return (
                          <div
                            key={load.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, load.id)}
                            onClick={() => setSelectedLoadId(load.id)}
                            className={`p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing space-y-1 ${
                              isSelected
                                ? 'bg-primary/20 border-primary text-white ring-1 ring-primary'
                                : 'bg-surface-container border-surface-container-high text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-primary">{load.truckUnit}</span>
                              <span className={`px-1 rounded text-[8px] border ${badge.badgeClass}`}>
                                {load.dockDoor}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold truncate">{load.driverName}</div>
                            <div className="text-[9px] text-outline truncate">{load.cargoDescription}</div>
                            <div className="text-[9px] text-emerald-400 flex items-center justify-between pt-1 border-t border-white/5">
                              <span>ETA: {load.predictiveEta}</span>
                              <span>{load.milesRemaining}m</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
