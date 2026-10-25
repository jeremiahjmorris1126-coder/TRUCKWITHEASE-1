import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Truck,
  RotateCcw,
  Play,
  Pause,
  Phone,
  Mail,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Navigation,
  Compass,
  ArrowRight,
  Shield,
  Layers,
  Radio,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Building,
  User,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Flame,
  X,
  Volume2,
  Send,
  Thermometer,
  Gauge,
  Activity,
  Cpu,
  Zap,
  Scale,
  DollarSign,
  Fuel,
  MessageSquare,
  ShieldCheck,
  Rocket,
  Triangle,
  Download,
  Target,
  Crosshair,
  Terminal,
  Satellite,
  Globe,
  Bell,
  ChevronDown,
} from 'lucide-react';
import {
  DispatchMonitorDriver,
  DispatchMonitorStageStatus,
} from '../types';
import {
  loadMonitorDrivers,
  saveMonitorDrivers,
  advanceDriverStatus,
  getStatusStyle,
  getNextMasterLoopStatus,
  INITIAL_MONITOR_DRIVERS,
  ONE_CLICK_MESSAGE_PRESETS,
  sendOneClickMessageToDriver,
} from '../services/liveDispatchMonitorService';
import {
  buildSmsDeepLink,
  buildEmailDeepLink,
  playDispatchLoopChime,
} from '../services/driverDispatchLoopService';
import { triggerHapticFeedback } from '../services/haptics';
import { AntigravityExportModal } from './AntigravityExportModal';
import { NasaGoogleCloseUpOrbitalSpotter } from './NasaGoogleCloseUpOrbitalSpotter';
import {
  getStoredRouteUpdates,
  RouteLoadUpdate,
} from '../services/nasaOrbitalSpotterService';

interface LiveDispatchMonitorViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const LiveDispatchMonitorView: React.FC<LiveDispatchMonitorViewProps> = ({
  onNavigateToTab,
}) => {
  const [drivers, setDrivers] = useState<DispatchMonitorDriver[]>(loadMonitorDrivers);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || 'drv-vance-904');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DispatchMonitorStageStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveGpsActive, setIsLiveGpsActive] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [showRoutesOnMap, setShowRoutesOnMap] = useState<boolean>(true);
  const [showGeofenceCircles, setShowGeofenceCircles] = useState<boolean>(true);
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHudOpen, setIsHudOpen] = useState<boolean>(true);
  const [activeHudTab, setActiveHudTab] = useState<'TELEMATICS' | 'MESSAGING' | 'HOS' | 'CARGO'>('TELEMATICS');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customMsgInput, setCustomMsgInput] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [lastDeliveredReceipt, setLastDeliveredReceipt] = useState<{ sid: string; text: string; driver: string } | null>(null);
  const [displayMode, setDisplayMode] = useState<
    'EXTENDED_RADAR' | 'GOOGLE_MAPS_REGULAR' | 'ALL_NASA_EXCLUSIVE' | 'SPLIT_VIEW' | 'NASA_GOOGLE_ORBITAL'
  >('EXTENDED_RADAR');
  const [routeUpdates, setRouteUpdates] = useState<RouteLoadUpdate[]>(getStoredRouteUpdates);
  const [isCloseUpSpotterModalOpen, setIsCloseUpSpotterModalOpen] = useState<boolean>(false);
  const [isIntegrationsMenuOpen, setIsIntegrationsMenuOpen] = useState<boolean>(false);

  const simulationIntervalRef = useRef<any>(null);

  // Sync drivers to storage on change
  useEffect(() => {
    saveMonitorDrivers(drivers);
  }, [drivers]);

  // Toast auto-hide
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    triggerHapticFeedback('light');
  };

  // Active selected driver memo
  const activeSelectedDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedDriverId) || drivers[0];
  }, [drivers, selectedDriverId]);

  // Live GPS Movement Simulation Engine
  useEffect(() => {
    if (isLiveGpsActive) {
      const intervalMs = Math.max(1000, Math.floor(4000 / simSpeedMultiplier));
      simulationIntervalRef.current = setInterval(() => {
        setDrivers((prev) =>
          prev.map((drv) => {
            if (drv.currentStatus === 'ARRIVED_DESTINATION' || drv.currentStatus === 'BACK_HOME') {
              if (drv.currentStatus === 'ARRIVED_DESTINATION') {
                return { ...drv, detentionMinutes: drv.detentionMinutes + 1 };
              }
              return drv;
            }

            const speedFactor = 0.003 * simSpeedMultiplier;
            let dLat = 0;
            let dLng = 0;

            if (drv.currentStatus === 'DEPARTED_ORIGIN' || drv.currentStatus === 'ARRIVING_DESTINATION') {
              dLat = (drv.destinationLat - drv.lat) * speedFactor;
              dLng = (drv.destinationLng - drv.lng) * speedFactor;
            } else if (drv.currentStatus === 'DEPARTED_DESTINATION') {
              dLat = (drv.homeTerminalLat - drv.lat) * speedFactor;
              dLng = (drv.homeTerminalLng - drv.lng) * speedFactor;
            }

            const newLat = +(drv.lat + dLat).toFixed(4);
            const newLng = +(drv.lng + dLng).toFixed(4);
            const newMiles = Math.max(0, drv.milesRemaining - 1);

            return {
              ...drv,
              lat: newLat,
              lng: newLng,
              milesRemaining: newMiles,
              odometerMiles: drv.odometerMiles + 1,
            };
          })
        );
      }, intervalMs);
    } else {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    }

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [isLiveGpsActive, simSpeedMultiplier]);

  // Filtered driver list with multi-field search (Name, Unit #, Location, Load #)
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchesStatus = statusFilter === 'ALL' || d.currentStatus === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesStatus;

      const matchesSearch =
        d.name.toLowerCase().includes(query) ||
        d.truckUnit.toLowerCase().includes(query) ||
        (d.trailerUnit && d.trailerUnit.toLowerCase().includes(query)) ||
        d.loadNumber.toLowerCase().includes(query) ||
        d.currentLocationCity.toLowerCase().includes(query) ||
        (d.currentLocationState && d.currentLocationState.toLowerCase().includes(query)) ||
        d.originCity.toLowerCase().includes(query) ||
        (d.originState && d.originState.toLowerCase().includes(query)) ||
        d.destinationCity.toLowerCase().includes(query) ||
        (d.destinationState && d.destinationState.toLowerCase().includes(query)) ||
        (d.homeTerminalCity && d.homeTerminalCity.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [drivers, statusFilter, searchQuery]);

  // Status Metrics Counts
  const counts = useMemo(() => {
    return {
      all: drivers.length,
      departedOrigin: drivers.filter((d) => d.currentStatus === 'DEPARTED_ORIGIN').length,
      arriving: drivers.filter((d) => d.currentStatus === 'ARRIVING_DESTINATION').length,
      arrived: drivers.filter((d) => d.currentStatus === 'ARRIVED_DESTINATION').length,
      departedDest: drivers.filter((d) => d.currentStatus === 'DEPARTED_DESTINATION').length,
      home: drivers.filter((d) => d.currentStatus === 'BACK_HOME').length,
    };
  }, [drivers]);

  // 1-Click Milestone Advance
  const handleAdvanceStage = async (driverId: string) => {
    const target = drivers.find((d) => d.id === driverId);
    if (!target) return;
    const nextStatus = getNextMasterLoopStatus(target.currentStatus);
    triggerHapticFeedback('success');

    if (nextStatus === 'DEPARTED_ORIGIN') playDispatchLoopChime('ORIGIN_DEPARTURE');
    else if (nextStatus === 'ARRIVED_DESTINATION') playDispatchLoopChime('DESTINATION_ARRIVAL');
    else if (nextStatus === 'DEPARTED_DESTINATION') playDispatchLoopChime('DESTINATION_DEPARTURE');
    else if (nextStatus === 'BACK_HOME') playDispatchLoopChime('HOME_ARRIVAL');

    const updated = await advanceDriverStatus(driverId, nextStatus, drivers);
    setDrivers(updated);

    const style = getStatusStyle(nextStatus);
    showToast(`ADVANCED DIRECTIVE: ${target.name} (${target.truckUnit}) -> ${style.pillLabel}`);
  };

  // 1-Click Instant Message Trigger (Presets)
  const handleSendOneClickPreset = async (preset: typeof ONE_CLICK_MESSAGE_PRESETS[0]) => {
    if (!activeSelectedDriver) return;
    const text = preset.template(activeSelectedDriver);
    triggerHapticFeedback('double');

    try {
      const { updatedDrivers, receiptSid } = await sendOneClickMessageToDriver(
        activeSelectedDriver.id,
        text,
        preset.id,
        drivers
      );
      setDrivers(updatedDrivers);
      setLastDeliveredReceipt({
        sid: receiptSid,
        text,
        driver: `${activeSelectedDriver.name} (${activeSelectedDriver.truckUnit})`,
      });
      showToast(`SMS ACCEPTED BY TWILIO: [${preset.badge}] -> ${activeSelectedDriver.name} · SID: ${receiptSid}`);
    } catch (error) {
      showToast(`SMS NOT SENT: ${error instanceof Error ? error.message : 'Delivery unavailable.'}`);
    }
  };

  // 1-Click Send Custom Message
  const handleSendCustomMessage = async () => {
    if (!activeSelectedDriver || !customMsgInput.trim()) return;
    triggerHapticFeedback('success');

    const fullMsg = `[DISPATCH DIRECTIVE] Unit ${activeSelectedDriver.truckUnit}: ${customMsgInput.trim()}`;
    try {
      const { updatedDrivers, receiptSid } = await sendOneClickMessageToDriver(
        activeSelectedDriver.id,
        fullMsg,
        'custom-direct',
        drivers
      );
      setDrivers(updatedDrivers);
      setLastDeliveredReceipt({
        sid: receiptSid,
        text: fullMsg,
        driver: `${activeSelectedDriver.name} (${activeSelectedDriver.truckUnit})`,
      });
      setCustomMsgInput('');
      showToast(`SMS ACCEPTED BY TWILIO: ${activeSelectedDriver.name} · SID: ${receiptSid}`);
    } catch (error) {
      showToast(`SMS NOT SENT: ${error instanceof Error ? error.message : 'Delivery unavailable.'}`);
    }
  };

  // 1-Click Audio Voice Prompt
  const handleVoiceBroadcast = () => {
    if (!activeSelectedDriver) return;
    triggerHapticFeedback('light');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `Dispatch directive to fleet unit ${activeSelectedDriver.truckUnit}, operator ${activeSelectedDriver.name}. Stand by for status update acknowledgment.`
      );
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      window.speechSynthesis.speak(utterance);
      showToast(`Fleet voice relay broadcasted to unit: ${activeSelectedDriver.truckUnit}`);
    } else {
      showToast(`In-cab alert chime sent to ${activeSelectedDriver.truckUnit}`);
    }
  };

  // Copy helper
  const handleCopyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Map coordinate projections
  const mapBounds = {
    minLat: 38.5,
    maxLat: 43.8,
    minLng: -88.5,
    maxLng: -77.5,
  };

  const projectToMap = (lat: number, lng: number) => {
    const xPct = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100;
    const yPct = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 100;
    return {
      x: Math.max(4, Math.min(96, xPct)),
      y: Math.max(4, Math.min(96, yPct)),
    };
  };

  // Select driver with 1 click
  const handleSelectDriver = (driverId: string) => {
    setSelectedDriverId(driverId);
    setIsHudOpen(true);
    triggerHapticFeedback('light');
  };

  return (
    <div className="relative w-full h-[calc(100vh-60px)] min-h-[700px] bg-[#070A0F] text-slate-100 flex flex-col font-['Space_Grotesk',sans-serif] overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#0D1420]/95 border-2 border-amber-500/90 text-amber-300 rounded-lg shadow-2xl text-xs font-bold uppercase tracking-wide animate-in fade-in slide-in-from-top-2 backdrop-blur-md">
          <Terminal className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cloud Export Modal (Antigravity & GitHub) */}
      <AntigravityExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* ==================================================================== */}
      {/* 1. TOP COMMAND BAR: STATUS, SEARCH, VIEW MODE PILL & SYSTEMS MENU   */}
      {/* ==================================================================== */}
      <header className="absolute top-3 left-3 right-3 z-30 pointer-events-auto">
        <div className="bg-[#0A0E18]/95 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 shadow-2xl flex items-center justify-between gap-3">
          {/* Brand & Transponder Status Indicator */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#111A28] border border-[#D4AF37]/50 flex items-center justify-center shadow text-[#D4AF37]">
              <Crosshair className="w-4 h-4 animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-['Oswald',sans-serif] text-sm font-bold tracking-wider text-white uppercase">
                  FLEET RADAR MAPS
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {drivers.length} ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative flex-1 max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-[#D4AF37] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unit #, driver..."
              className="w-full bg-[#05080F] border border-slate-800 focus:border-[#D4AF37]/60 rounded-lg pl-8 pr-14 py-1 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
            />
            <div className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 pointer-events-none">
              {filteredDrivers.length}/{drivers.length}
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Segmented View Mode Switcher */}
          <div className="hidden md:flex items-center bg-[#070A12] border border-slate-800 rounded-lg p-0.5 shadow-inner">
            <button
              onClick={() => {
                setDisplayMode('EXTENDED_RADAR');
                triggerHapticFeedback('light');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition ${
                displayMode === 'EXTENDED_RADAR'
                  ? 'bg-[#D4AF37] text-black font-black shadow'
                  : 'text-slate-300 hover:text-white font-medium'
              }`}
              title="Extended Radar Grid"
            >
              <Crosshair className="w-3 h-3" />
              <span>Radar Grid</span>
            </button>
            <button
              onClick={() => {
                setDisplayMode('GOOGLE_MAPS_REGULAR');
                triggerHapticFeedback('light');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition ${
                displayMode === 'GOOGLE_MAPS_REGULAR'
                  ? 'bg-[#D4AF37] text-black font-black shadow'
                  : 'text-slate-300 hover:text-white font-medium'
              }`}
              title="Google Maps Roadway & Traffic"
            >
              <Globe className="w-3 h-3" />
              <span>Roadways</span>
            </button>
            <button
              onClick={() => {
                setDisplayMode('ALL_NASA_EXCLUSIVE');
                triggerHapticFeedback('light');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition ${
                displayMode === 'ALL_NASA_EXCLUSIVE'
                  ? 'bg-[#D4AF37] text-black font-black shadow'
                  : 'text-slate-300 hover:text-white font-medium'
              }`}
              title="NASA Satellite Earth Observation"
            >
              <Satellite className="w-3 h-3" />
              <span>Satellite</span>
            </button>
            <button
              onClick={() => {
                setDisplayMode('SPLIT_VIEW');
                triggerHapticFeedback('light');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition ${
                displayMode === 'SPLIT_VIEW'
                  ? 'bg-[#D4AF37] text-black font-black shadow'
                  : 'text-slate-300 hover:text-white font-medium'
              }`}
              title="Split Matrix Dual View"
            >
              <Layers className="w-3 h-3" />
              <span>Split Matrix</span>
            </button>
          </div>

          {/* Right Action: Cockpit HUD Toggle & Systems Dropdown */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <button
              onClick={() => setIsHudOpen(!isHudOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase transition border ${
                isHudOpen
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37]/60 text-[#D4AF37]'
                  : 'bg-[#0E1320] border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle Cockpit HUD Drawer"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{isHudOpen ? 'HUD On' : 'HUD Off'}</span>
            </button>

            {/* Integrations & Systems Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setIsIntegrationsMenuOpen(!isIntegrationsMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#0E1320] hover:bg-[#151D2E] border border-slate-700 text-slate-200 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Systems &amp; Integrations</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isIntegrationsMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0C101A] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      TELEMATICS BRIDGES &amp; EXPORTS
                    </span>
                    <button
                      onClick={() => setIsIntegrationsMenuOpen(false)}
                      className="text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-sky-400" />
                        <div>
                          <div className="font-bold text-white">Samsara J1939 Bridge</div>
                          <div className="text-[10px] text-slate-400">Direct ECU telemetry conduit</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        LIVE
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <div>
                          <div className="font-bold text-white">Motive / KeepTruckin API</div>
                          <div className="text-[10px] text-slate-400">HOS logs &amp; vehicle gateway</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        STANDBY
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="font-bold text-white">Geotab Fleet Integration</div>
                          <div className="text-[10px] text-slate-400">OBD-II accelerometer sync</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        READY
                      </span>
                    </div>

                    {onNavigateToTab && (
                      <div
                        onClick={() => {
                          setIsIntegrationsMenuOpen(false);
                          onNavigateToTab('superiority');
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#D4AF37]/10 transition cursor-pointer border-t border-slate-800/80 pt-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <div>
                            <div className="font-bold text-[#D4AF37]">Fleet Benchmarks Matrix</div>
                            <div className="text-[10px] text-slate-400">Compare TCO, DTC healing &amp; safe harbor</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    )}

                    <div
                      onClick={() => {
                        setIsIntegrationsMenuOpen(false);
                        setIsExportModalOpen(true);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#D4AF37]/10 transition cursor-pointer border-t border-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <Rocket className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <div>
                          <div className="font-bold text-white">Export Cryptographic Sync</div>
                          <div className="text-[10px] text-slate-400">GitHub &amp; Antigravity audit ledger</div>
                        </div>
                      </div>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. LEFT SIDE RAIL: OPERATIONAL TOOL RACK                              */}
      {/* ==================================================================== */}
      <aside className="absolute left-3 top-16 z-20 pointer-events-auto flex flex-col gap-2 bg-[#090D17]/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-1.5 shadow-2xl">
        {/* Radar Sweep Toggle */}
        <button
          onClick={() => {
            setIsLiveGpsActive(!isLiveGpsActive);
            triggerHapticFeedback('light');
          }}
          className={`p-2.5 rounded-lg transition flex items-center justify-center relative group ${
            isLiveGpsActive
              ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-400'
              : 'bg-[#101524] border border-slate-800 text-slate-400 hover:text-white'
          }`}
          title={isLiveGpsActive ? 'Radar Sweep Active (Pulsing)' : 'Radar Sweep Paused'}
        >
          <Radio className={`w-4 h-4 ${isLiveGpsActive ? 'animate-pulse' : ''}`} />
          <span className="absolute left-full ml-2 px-2 py-1 bg-[#070A12] border border-slate-700 text-slate-200 text-[10px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
            {isLiveGpsActive ? 'Radar Sweep: Active' : 'Radar Sweep: Paused'}
          </span>
        </button>

        {/* Velocity Multiplier */}
        <button
          onClick={() => {
            setSimSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 5 : 1));
            triggerHapticFeedback('light');
          }}
          className="p-2 rounded-lg bg-[#101524] hover:bg-[#182033] border border-slate-800 text-[#D4AF37] text-xs font-mono font-bold transition flex items-center justify-center relative group"
          title="Radar Sweep Velocity Multiplier"
        >
          <span>{simSpeedMultiplier}x</span>
          <span className="absolute left-full ml-2 px-2 py-1 bg-[#070A12] border border-slate-700 text-slate-200 text-[10px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
            Velocity: {simSpeedMultiplier}x
          </span>
        </button>

        {/* High-Resolution Orbit Spotter */}
        <button
          onClick={() => {
            setDisplayMode('ALL_NASA_EXCLUSIVE');
            triggerHapticFeedback('light');
          }}
          className="p-2.5 rounded-lg bg-[#101524] hover:bg-[#182033] border border-slate-800 text-cyan-400 transition flex items-center justify-center relative group"
          title="Launch Close-Up Space Recon Spotter"
        >
          <Satellite className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-[#070A12] border border-slate-700 text-slate-200 text-[10px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
            NASA Close-Up Spotter
          </span>
        </button>

        {/* Geofence Overlay Toggle */}
        <button
          onClick={() => {
            setShowGeofenceCircles(!showGeofenceCircles);
            triggerHapticFeedback('light');
          }}
          className={`p-2.5 rounded-lg transition flex items-center justify-center relative group ${
            showGeofenceCircles
              ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37]'
              : 'bg-[#101524] border border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle Geofence Boundaries"
        >
          <Layers className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-[#070A12] border border-slate-700 text-slate-200 text-[10px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
            {showGeofenceCircles ? 'Geofences: Visible' : 'Geofences: Hidden'}
          </span>
        </button>
      </aside>

      {/* ==================================================================== */}
      {/* 3. BOTTOM DOCK: ROUTE PHASES, TRANSPONDERS & 1-CLICK DIRECTIVES       */}
      {/* ==================================================================== */}
      <footer className="absolute bottom-3 left-3 right-3 z-30 pointer-events-auto flex flex-col gap-1.5">
        {/* Upper Strip: Route Phase Progression Tabs */}
        <div className="bg-[#090D17]/95 backdrop-blur-md border border-slate-800 rounded-lg px-2 py-1 shadow-xl flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-[#D4AF37] text-black shadow'
                : 'bg-[#101624] text-slate-300 hover:bg-[#1A2234]'
            }`}
          >
            All Routes ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter('DEPARTED_ORIGIN')}
            className={`px-2.5 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'DEPARTED_ORIGIN'
                ? 'bg-blue-500 text-black shadow'
                : 'bg-blue-950/40 text-blue-300 border border-blue-500/40 hover:bg-blue-900/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Phase 01 // En Route ({counts.departedOrigin})</span>
          </button>
          <button
            onClick={() => setStatusFilter('ARRIVING_DESTINATION')}
            className={`px-2.5 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'ARRIVING_DESTINATION'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Phase 02 // Approach ({counts.arriving})</span>
          </button>
          <button
            onClick={() => setStatusFilter('ARRIVED_DESTINATION')}
            className={`px-2.5 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'ARRIVED_DESTINATION'
                ? 'bg-emerald-500 text-black shadow'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Phase 03 // Dock ({counts.arrived})</span>
          </button>
          <button
            onClick={() => setStatusFilter('DEPARTED_DESTINATION')}
            className={`px-2.5 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'DEPARTED_DESTINATION'
                ? 'bg-purple-500 text-black shadow'
                : 'bg-purple-950/40 text-purple-300 border border-purple-500/40 hover:bg-purple-900/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Phase 04 // RTB ({counts.departedDest})</span>
          </button>
          <button
            onClick={() => setStatusFilter('BACK_HOME')}
            className={`px-2.5 py-1 rounded-md font-bold tracking-wider uppercase transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'BACK_HOME'
                ? 'bg-teal-400 text-black shadow'
                : 'bg-teal-950/40 text-teal-300 border border-teal-500/40 hover:bg-teal-900/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span>Phase 05 // Base ({counts.home})</span>
          </button>
        </div>

        {/* Lower Strip: Transponder Carousel & Selected Driver Directives */}
        <div className="bg-[#090D17]/95 backdrop-blur-md border border-slate-800 rounded-lg p-2 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Driver Selection Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs py-0.5">
            {filteredDrivers.map((drv) => {
              const isSelected = drv.id === selectedDriverId;
              const statusStyle = getStatusStyle(drv.currentStatus);

              return (
                <button
                  key={drv.id}
                  onClick={() => handleSelectDriver(drv.id)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[#D4AF37] text-black font-black ring-2 ring-[#E5C158] shadow-md'
                      : 'bg-[#101624] hover:bg-[#182136] text-slate-200 border border-slate-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : statusStyle.dotColor}`} />
                  <span className="font-bold">{drv.truckUnit}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-black/80' : 'text-slate-400'}`}>
                    [{drv.currentLocationCity}]
                  </span>
                </button>
              );
            })}
          </div>

          {/* Instant Driver Action Directives */}
          {activeSelectedDriver && (
            <div className="flex items-center gap-1.5 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-1.5 md:pt-0 md:pl-2">
              <a
                href={buildSmsDeepLink(activeSelectedDriver.phone, `[TruckWithEase Dispatch] Unit ${activeSelectedDriver.truckUnit}: Please report status.`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#101726] hover:bg-[#19243C] border border-slate-700 text-slate-200 rounded-md text-xs font-bold transition"
                title="Send SMS Directive"
              >
                <MessageSquare className="w-3 h-3 text-[#D4AF37]" />
                <span>SMS Directive</span>
              </a>

              <a
                href={`tel:${activeSelectedDriver.phone}`}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#101726] hover:bg-[#19243C] border border-slate-700 text-slate-200 rounded-md text-xs font-bold transition"
                title="Call Driver In-Cab"
              >
                <Phone className="w-3 h-3 text-emerald-400" />
                <span>Direct Call</span>
              </a>

              <button
                onClick={() => {
                  void advanceDriverStatus(
                    activeSelectedDriver.id,
                    getNextMasterLoopStatus(activeSelectedDriver.currentStatus),
                    drivers
                  ).then(setDrivers);
                  showToast(`Advanced ${activeSelectedDriver.name} to next stage`);
                }}
                className="flex items-center gap-1 px-3 py-1 bg-[#D4AF37] hover:bg-[#E5C158] text-black rounded-md text-xs font-black transition shadow"
              >
                <Rocket className="w-3 h-3" />
                <span>Advance Phase</span>
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* MAIN VIEWPORT: RADAR vs NASA x GOOGLE MAPS vs SPLIT SCREEN           */}
      {/* ==================================================================== */}
      {displayMode === 'NASA_GOOGLE_ORBITAL' ? (
        <div className="w-full h-full relative z-10 pt-16 pb-24 px-2">
          <NasaGoogleCloseUpOrbitalSpotter
            selectedDriver={activeSelectedDriver}
            allDrivers={filteredDrivers}
            onSelectDriver={handleSelectDriver}
            initialNasaEnabled
            initialMapType="hybrid"
            onClose={() => setDisplayMode('EXTENDED_RADAR')}
          />
        </div>
      ) : displayMode === 'GOOGLE_MAPS_REGULAR' ? (
        <div className="w-full h-full relative z-10 pt-16 pb-24 px-2">
          <NasaGoogleCloseUpOrbitalSpotter
            key="google-maps-regular"
            selectedDriver={activeSelectedDriver}
            allDrivers={filteredDrivers}
            onSelectDriver={handleSelectDriver}
            initialNasaEnabled={false}
            initialMapType="roadmap"
            onClose={() => setDisplayMode('EXTENDED_RADAR')}
          />
        </div>
      ) : displayMode === 'ALL_NASA_EXCLUSIVE' ? (
        <div className="w-full h-full relative z-10 pt-16 pb-24 px-2">
          <NasaGoogleCloseUpOrbitalSpotter
            key="all-nasa-exclusive"
            selectedDriver={activeSelectedDriver}
            allDrivers={filteredDrivers}
            onSelectDriver={handleSelectDriver}
            initialNasaEnabled={true}
            initialMapType="hybrid"
            onClose={() => setDisplayMode('EXTENDED_RADAR')}
          />
        </div>
      ) : (
        <div
          className={`w-full h-full relative flex ${
            displayMode === 'SPLIT_VIEW'
              ? 'flex-col xl:flex-row pt-16 pb-24 px-2 gap-2 overflow-hidden z-10'
              : ''
          }`}
        >
          {/* Extended+ Fleet Radar View */}
          <div
            className={`relative ${
              displayMode === 'SPLIT_VIEW'
                ? 'w-full xl:w-1/2 h-[45vh] xl:h-full border-2 border-slate-800 rounded-xl overflow-hidden shadow-2xl'
                : 'w-full h-full'
            }`}
          >
            <div
              className="w-full h-full relative overflow-hidden bg-[#05080E]"
              style={{
                transform: `scale(${mapZoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: '50% 50%',
                transition: 'transform 0.15s ease-out',
              }}
            >
        {/* Tactical Crosshair Watermark Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.04) 0%, transparent 75%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 60px 60px, 60px 60px',
          }}
        />

        {/* Radar Circular Sweep Pulse */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, rgba(245, 158, 11, 0.3) 0deg, transparent 60deg, transparent 360deg)',
            animation: 'spin 14s linear infinite',
          }}
        />

        {/* Transit Corridors Vector Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-slate-700/80 fill-none">
          {/* I-80 / I-90 Northern Spine */}
          <path
            d="M 12 34 Q 30 36, 52 42 T 88 56"
            stroke="#475569"
            strokeWidth="3.5"
            strokeDasharray="6 3"
          />
          {/* I-94 Corridor */}
          <path d="M 10 12 L 12 34" stroke="#475569" strokeWidth="3" strokeDasharray="4 2" />
          {/* I-65 & I-70 Central Corridor */}
          <path
            d="M 12 34 L 28 66 L 52 62 L 86 58"
            stroke="#475569"
            strokeWidth="3"
            strokeDasharray="5 3"
          />
          {/* I-71 Connector */}
          <path d="M 52 42 L 52 62 L 38 84" stroke="#475569" strokeWidth="2.5" strokeDasharray="4 2" />

          {/* ACTIVE DRIVER ROUTE VECTORS */}
          {showRoutesOnMap &&
            filteredDrivers.map((drv) => {
              const originPt = projectToMap(drv.originLat, drv.originLng);
              const destPt = projectToMap(drv.destinationLat, drv.destinationLng);
              const homePt = projectToMap(drv.homeTerminalLat, drv.homeTerminalLng);
              const isSelected = drv.id === selectedDriverId;

              return (
                <g key={`route-vector-${drv.id}`} opacity={isSelected ? 1 : 0.45}>
                  {/* Outbound Route Vector */}
                  <line
                    x1={`${originPt.x}%`}
                    y1={`${originPt.y}%`}
                    x2={`${destPt.x}%`}
                    y2={`${destPt.y}%`}
                    stroke={isSelected ? '#F59E0B' : '#64748B'}
                    strokeWidth={isSelected ? 3.5 : 1.5}
                    strokeDasharray={isSelected ? '8 4' : '4 4'}
                  />
                  {/* Return Transit Vector */}
                  <line
                    x1={`${destPt.x}%`}
                    y1={`${destPt.y}%`}
                    x2={`${homePt.x}%`}
                    y2={`${homePt.y}%`}
                    stroke={isSelected ? '#10B981' : '#475569'}
                    strokeWidth={isSelected ? 3 : 1}
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })}
        </svg>

        {/* METRO HUB LOGISTICS LABELS */}
        <div className="absolute pointer-events-none text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="absolute left-[11%] top-[31%] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500/80 rounded-sm" />
            <span className="text-slate-300">HUB CHI // CHICAGO LOGISTICS</span>
          </div>
          <div className="absolute left-[9%] top-[10%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>BASE MKE // MILWAUKEE DEPOT</span>
          </div>
          <div className="absolute left-[48%] top-[18%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>BASE DTW // DETROIT HUB</span>
          </div>
          <div className="absolute left-[54%] top-[39%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>BASE CLE // CLEVELAND CROSSDOCK</span>
          </div>
          <div className="absolute left-[53%] top-[60%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>TARGET CMH // COLUMBUS TERMINAL</span>
          </div>
          <div className="absolute left-[27%] top-[64%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>BASE IND // INDIANAPOLIS HUB</span>
          </div>
          <div className="absolute left-[36%] top-[82%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>TARGET CVG // CINCINNATI DOCK</span>
          </div>
          <div className="absolute left-[85%] top-[54%] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-500 rounded-sm" />
            <span>TARGET PIT // PITTSBURGH AIRSIDE</span>
          </div>
        </div>

        {/* GEOFENCE PERIMETERS */}
        {showGeofenceCircles &&
          filteredDrivers.map((drv) => {
            const orig = projectToMap(drv.originLat, drv.originLng);
            const dest = projectToMap(drv.destinationLat, drv.destinationLng);
            const isSelected = drv.id === selectedDriverId;

            return (
              <React.Fragment key={`geo-${drv.id}`}>
                <div
                  className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500/50 bg-blue-500/10 flex items-center justify-center pointer-events-none ${
                    isSelected ? 'ring-2 ring-blue-400 scale-125' : ''
                  }`}
                  style={{ left: `${orig.x}%`, top: `${orig.y}%` }}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm" />
                </div>

                <div
                  className={`absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-500/50 bg-emerald-500/10 flex items-center justify-center pointer-events-none ${
                    isSelected ? 'ring-2 ring-emerald-400 scale-125' : ''
                  }`}
                  style={{ left: `${dest.x}%`, top: `${dest.y}%` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" />
                </div>
              </React.Fragment>
            );
          })}

        {/* DRIVERS LIVE ON MAP (FLEET BEACONS) */}
        {filteredDrivers.map((drv) => {
          const pt = projectToMap(drv.lat, drv.lng);
          const isSelected = drv.id === selectedDriverId;
          const statusStyle = getStatusStyle(drv.currentStatus);

          return (
            <div
              key={drv.id}
              onClick={() => handleSelectDriver(drv.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 group z-30 pointer-events-auto"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              {/* Radar Target Pulse Wave */}
              <div
                className={`absolute -inset-3.5 rounded-full animate-ping opacity-35 ${statusStyle.dotColor}`}
              />

              {/* Fleet Marker Badge */}
              <div
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 shadow-2xl transition-all ${
                  isSelected
                    ? 'bg-[#0E1522] border-amber-400 ring-4 ring-amber-400/40 scale-125 z-40 shadow-amber-500/40'
                    : 'bg-[#0A0F1A]/95 border-slate-700 hover:scale-110 hover:border-slate-500'
                }`}
              >
                {/* Heading Crosshair */}
                <div
                  className="w-4 h-4 rounded-full bg-[#141E2F] flex items-center justify-center"
                  style={{ transform: `rotate(${drv.headingDeg}deg)` }}
                >
                  <Navigation className={`w-2.5 h-2.5 ${statusStyle.badgeText}`} />
                </div>

                {/* Transponder ID & Callsign */}
                <div className="flex flex-col leading-none">
                  <span className="font-['Oswald',sans-serif] text-xs font-bold text-white tracking-wide uppercase">
                    {drv.truckUnit}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold tracking-wider truncate max-w-[70px]">
                    {drv.name.split(' ')[0]}
                  </span>
                </div>

                {/* Speed Tag */}
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${statusStyle.badgeBg} ${statusStyle.badgeText}`}
                >
                  {drv.speedMph > 0 ? `${drv.speedMph} MPH` : 'DOCK'}
                </span>
              </div>

              {/* Hover SitRep Card */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col p-3 bg-[#0C121D] border-2 border-slate-700 rounded-xl shadow-2xl text-xs min-w-[230px] z-50 pointer-events-none">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
                  <strong className="font-['Oswald',sans-serif] text-white tracking-wide uppercase text-sm">
                    {drv.name}
                  </strong>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusStyle.badgeBg} ${statusStyle.badgeText}`}>
                    {statusStyle.pillLabel}
                  </span>
                </div>
                <div className="text-slate-300">UNIT: {drv.truckUnit} &bull; TRL: {drv.trailerUnit}</div>
                <div className="text-amber-400 font-bold">OP-ORDER: #{drv.loadNumber}</div>
                <div className="text-slate-400 truncate">GRID: {drv.currentLocationName}</div>
                <div className="text-emerald-400 font-bold mt-1">
                  {drv.milesRemaining > 0 ? `${drv.milesRemaining} MI TO TARGET &bull; ETA: ${drv.etaDestination}` : 'AT DESTINATION TERMINAL'}
                </div>
                <div className="text-[10px] text-amber-300 font-bold mt-1.5 tracking-wider uppercase">
                  👉 Click to arm 1-click telematics &amp; SitRep directives
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1-CLICK FLEET TELEMATICS & DIRECTIVES COCKPIT HUD                    */}
      {/* ==================================================================== */}
      {isHudOpen && activeSelectedDriver && (
        <aside className="absolute right-3 top-20 bottom-3 w-full sm:w-[480px] max-w-[95vw] bg-[#0A0E18]/95 backdrop-blur-xl border-2 border-slate-700/80 rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.8)] z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          {/* HUD Bezel Header */}
          <div className="p-3.5 bg-[#0F1626] border-b-2 border-slate-800 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg ${activeSelectedDriver.avatarColor} text-white flex items-center justify-center font-bold text-base shadow-lg`}
              >
                {activeSelectedDriver.avatarInitials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-['Oswald',sans-serif] text-base font-bold text-white tracking-wide uppercase">
                    {activeSelectedDriver.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-[#1A253A] text-amber-400 text-xs font-bold tracking-wider">
                    {activeSelectedDriver.truckUnit}
                  </span>
                </div>
                <p className="text-xs text-slate-400 tracking-wide mt-0.5">
                  CALLSIGN: {activeSelectedDriver.name.split(' ')[0]} &bull; COMM: {activeSelectedDriver.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setDisplayMode('NASA_GOOGLE_ORBITAL');
                  triggerHapticFeedback('light');
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                title="Lock on driver in NASA x Google Maps Close-Up View"
              >
                <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                <span>Close-Up Orbit</span>
              </button>

              <button
                onClick={() => setIsHudOpen(false)}
                className="p-1.5 rounded-lg bg-[#141E2F] hover:bg-[#1E2D47] text-slate-400 hover:text-white transition"
                title="Close Cockpit HUD"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MASTER LOOP ROUTE PROGRESS BAR & 1-CLICK DIRECTIVE TRIGGER */}
          <div className="p-3 bg-[#080C14] border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Dispatch Loop Protocol &bull; Cycle #{activeSelectedDriver.cycleNumber}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
                  getStatusStyle(activeSelectedDriver.currentStatus).badgeBg
                } ${getStatusStyle(activeSelectedDriver.currentStatus).badgeText}`}
              >
                {getStatusStyle(activeSelectedDriver.currentStatus).pillLabel}
              </span>
            </div>

            {/* 5-Stage Phase Track */}
            <div className="grid grid-cols-5 gap-1 text-[9px] font-bold text-center uppercase tracking-wider">
              <div
                className={`p-1 rounded border ${
                  activeSelectedDriver.currentStatus === 'DEPARTED_ORIGIN'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-[#0E1524] border-slate-800 text-slate-500'
                }`}
              >
                Phase 01
              </div>
              <div
                className={`p-1 rounded border ${
                  activeSelectedDriver.currentStatus === 'ARRIVING_DESTINATION'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-[#0E1524] border-slate-800 text-slate-500'
                }`}
              >
                Phase 02
              </div>
              <div
                className={`p-1 rounded border ${
                  activeSelectedDriver.currentStatus === 'ARRIVED_DESTINATION'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#0E1524] border-slate-800 text-slate-500'
                }`}
              >
                Phase 03
              </div>
              <div
                className={`p-1 rounded border ${
                  activeSelectedDriver.currentStatus === 'DEPARTED_DESTINATION'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-[#0E1524] border-slate-800 text-slate-500'
                }`}
              >
                Phase 04
              </div>
              <div
                className={`p-1 rounded border ${
                  activeSelectedDriver.currentStatus === 'BACK_HOME'
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                    : 'bg-[#0E1524] border-slate-800 text-slate-500'
                }`}
              >
                Phase 05
              </div>
            </div>

            {/* Advance Next Phase Action */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400 truncate">
                {activeSelectedDriver.currentLocationName}
              </span>
              <button
                onClick={() => handleAdvanceStage(activeSelectedDriver.id)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-['Oswald',sans-serif] text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1 shrink-0 shadow"
              >
                <span>Trigger Next Phase</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* HUD NAVIGATION TABS */}
          <div className="flex items-center bg-[#0C1220] border-b border-slate-800 text-xs font-bold p-1 gap-1">
            <button
              onClick={() => setActiveHudTab('TELEMATICS')}
              className={`flex-1 py-1.5 rounded-lg text-center uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                activeHudTab === 'TELEMATICS'
                  ? 'bg-amber-500 text-black shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Telemetry</span>
            </button>

            <button
              onClick={() => setActiveHudTab('MESSAGING')}
              className={`flex-1 py-1.5 rounded-lg text-center uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                activeHudTab === 'MESSAGING'
                  ? 'bg-amber-500 text-black shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Directives &amp; Comms</span>
            </button>

            <button
              onClick={() => setActiveHudTab('HOS')}
              className={`flex-1 py-1.5 rounded-lg text-center uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                activeHudTab === 'HOS'
                  ? 'bg-amber-500 text-black shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Duty Clocks</span>
            </button>

            <button
              onClick={() => setActiveHudTab('CARGO')}
              className={`flex-1 py-1.5 rounded-lg text-center uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                activeHudTab === 'CARGO'
                  ? 'bg-amber-500 text-black shadow font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Payload &amp; Axles</span>
            </button>
          </div>

          {/* HUD TAB CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* ================================================================ */}
            {/* TAB 1: ALL TELEMATICS IN 1 CLICK                                 */}
            {/* ================================================================ */}
            {activeHudTab === 'TELEMATICS' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      TRANSIT SPEED
                    </span>
                    <span className="font-['Oswald',sans-serif] text-xl font-bold text-white block mt-0.5">
                      {activeSelectedDriver.speedMph} MPH
                    </span>
                    <span className="text-[10px] text-emerald-400 block truncate mt-0.5">
                      {activeSelectedDriver.cruiseControlStatus || 'CRUISE STANDBY'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      POWERTRAIN RPM
                    </span>
                    <span className="font-['Oswald',sans-serif] text-xl font-bold text-amber-400 block mt-0.5">
                      {activeSelectedDriver.engineRpm || 1350} RPM
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                      GEAR: {activeSelectedDriver.transmissionGear || '12th AUTO'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      FUEL TANK LEVEL
                    </span>
                    <span className="font-['Oswald',sans-serif] text-xl font-bold text-emerald-400 block mt-0.5">
                      {activeSelectedDriver.fuelLevelPct}%
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                      DEF: {activeSelectedDriver.defLevelPct || 85}%
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070A10] border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      OIL / THERMAL
                    </span>
                    <span className="font-['Oswald',sans-serif] text-xl font-bold text-white block mt-0.5">
                      {activeSelectedDriver.coolantTempF || 192}°F
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                      OIL: {activeSelectedDriver.oilPressurePsi || 42} PSI
                    </span>
                  </div>
                </div>

                {/* Cold Chain Reefer Sensor */}
                {activeSelectedDriver.reeferTempF !== undefined && (
                  <div className="p-3.5 rounded-xl bg-[#081220] border-2 border-cyan-500/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-cyan-400" />
                        Reefer Cargo Thermal Telematics
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                        [AUDITED SENSOR]
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs text-slate-400 block">CURRENT SENSOR TEMP</span>
                        <span className="font-['Oswald',sans-serif] text-2xl font-bold text-cyan-300">
                          {activeSelectedDriver.reeferTempF.toFixed(1)}°F
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">TARGET SETPOINT</span>
                        <span className="font-['Oswald',sans-serif] text-xl font-bold text-white">
                          {activeSelectedDriver.reeferSetpointF?.toFixed(1) || '34.0'}°F
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-cyan-200/90 pt-0.5">
                      {activeSelectedDriver.reeferStatusText || 'CONTINUOUS FREEZE · NORMAL'}
                    </p>
                  </div>
                )}

                {/* Diagnostics & J1939 CANbus */}
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      J1939 CANbus Diagnostics
                    </span>
                    <span className="text-emerald-400 font-bold text-[10px] tracking-wider uppercase">
                      0 ACTIVE DTC FAULTS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block">BATTERY VOLTAGE</span>
                      <strong className="text-white">{activeSelectedDriver.batteryVoltage || 13.8}V</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">AIR BRAKE PRESSURE</span>
                      <strong className="text-white">
                        P: {activeSelectedDriver.brakeAirPressurePsi?.primary || 124} / S:{' '}
                        {activeSelectedDriver.brakeAirPressurePsi?.secondary || 122} PSI
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ENGINE BRAKE STAGE</span>
                      <strong className="text-white">{activeSelectedDriver.engineBrakeStatus || 'STAGE 2'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">AVERAGE ECONOMY</span>
                      <strong className="text-emerald-400">{activeSelectedDriver.instantMpg || 7.2} MPG</strong>
                    </div>
                  </div>
                </div>

                {/* Detention & Dock Timers */}
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      TERMINAL DETENTION TIME
                    </span>
                    <span className="font-['Oswald',sans-serif] text-base font-bold text-amber-400">
                      {activeSelectedDriver.detentionMinutes} MINUTES ACCRUED
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      BILLABLE DETENTION CLAIM
                    </span>
                    <span className="font-['Oswald',sans-serif] text-base font-bold text-emerald-400">
                      ${Math.round((activeSelectedDriver.detentionMinutes / 60) * (activeSelectedDriver.detentionHourlyRate || 75))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 2: DIRECTIVES & SECURE COMMS (1-CLICK)                       */}
            {/* ================================================================ */}
            {activeHudTab === 'MESSAGING' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      1-Click Command Directives:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      [ENCRYPTED UPLINK READY]
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ONE_CLICK_MESSAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSendOneClickPreset(preset)}
                        className="w-full p-3 rounded-lg bg-[#070A10] hover:bg-[#121B2A] border border-slate-800 hover:border-amber-500/70 transition text-left flex flex-col gap-1.5 group cursor-pointer shadow-sm active:scale-98"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-['Oswald',sans-serif] text-sm font-bold text-white group-hover:text-amber-400 tracking-wide uppercase">
                            {preset.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${preset.badgeColor}`}>
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {preset.template(activeSelectedDriver)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1-Click Custom Directive Transmitter */}
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Custom Command Directive to Cab:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customMsgInput}
                      onChange={(e) => setCustomMsgInput(e.target.value)}
                      placeholder={`Transmit directive to ${activeSelectedDriver.name.split(' ')[0]} in cab...`}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendCustomMessage()}
                      className="flex-1 bg-[#04060A] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-bold focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSendCustomMessage}
                      disabled={!customMsgInput.trim()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-['Oswald',sans-serif] text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1.5 shadow"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmit</span>
                    </button>
                  </div>
                </div>

                {/* Native Transmitters */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={buildSmsDeepLink(activeSelectedDriver.phone, activeSelectedDriver.lastAlertText)}
                    className="p-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 font-bold text-center text-xs tracking-wider uppercase flex flex-col items-center gap-1 transition"
                  >
                    <Phone className="w-4 h-4" />
                    <span>SMS Uplink</span>
                  </a>

                  <a
                    href={buildEmailDeepLink(
                      activeSelectedDriver.email,
                      `[DISPATCH DIRECTIVE] Unit ${activeSelectedDriver.truckUnit}`,
                      activeSelectedDriver.lastAlertText
                    )}
                    className="p-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 font-bold text-center text-xs tracking-wider uppercase flex flex-col items-center gap-1 transition"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email SitRep</span>
                  </a>

                  <button
                    onClick={handleVoiceBroadcast}
                    className="p-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 font-bold text-center text-xs tracking-wider uppercase flex flex-col items-center gap-1 transition"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Cab Voice</span>
                  </button>
                </div>

                {/* Last Transmitted Directive Card */}
                {lastDeliveredReceipt && (
                  <div className="p-3.5 rounded-xl bg-[#051A10] border-2 border-emerald-500/50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Accepted by Twilio for {lastDeliveredReceipt.driver}
                      </span>
                      <span className="text-emerald-400 font-bold">
                        SID: {lastDeliveredReceipt.sid}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {lastDeliveredReceipt.text}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 3: DUTY CLOCKS & FMCSA                                       */}
            {/* ================================================================ */}
            {activeHudTab === 'HOS' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      FMCSA 49 CFR Duty Clocks
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      SAMPLE DATA — NOT VERIFIED
                    </span>
                  </div>

                  {/* 11h Drive Clock */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">11-Hour Drive Time Remaining:</span>
                      <span className="font-['Oswald',sans-serif] text-base font-bold text-emerald-400">
                        {Math.floor((activeSelectedDriver.hosDriveRemainingMin || 525) / 60)}h{' '}
                        {(activeSelectedDriver.hosDriveRemainingMin || 525) % 60}m
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${((activeSelectedDriver.hosDriveRemainingMin || 525) / (11 * 60)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 14h Shift Duty Clock */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">14-Hour Shift Window Remaining:</span>
                      <span className="font-['Oswald',sans-serif] text-base font-bold text-amber-400">
                        {Math.floor((activeSelectedDriver.hosShiftRemainingMin || 680) / 60)}h{' '}
                        {(activeSelectedDriver.hosShiftRemainingMin || 680) % 60}m
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${((activeSelectedDriver.hosShiftRemainingMin || 680) / (14 * 60)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 70h Cycle Clock */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">70-Hour 8-Day Cycle Remaining:</span>
                      <span className="font-['Oswald',sans-serif] text-base font-bold text-blue-400">
                        {Math.floor((activeSelectedDriver.hosCycleRemainingMin || 2920) / 60)}h{' '}
                        {(activeSelectedDriver.hosCycleRemainingMin || 2920) % 60}m
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${((activeSelectedDriver.hosCycleRemainingMin || 2920) / (70 * 60)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 4: PAYLOAD & AXLES                                           */}
            {/* ================================================================ */}
            {activeHudTab === 'CARGO' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Cargo Manifest &amp; Bill of Lading
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">OP-LOAD #</span>
                      <strong className="text-amber-400">{activeSelectedDriver.loadNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">BOL #</span>
                      <strong className="text-white">{activeSelectedDriver.bolNumber}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">COMMODITY DESCRIPTION</span>
                      <strong className="text-slate-200">{activeSelectedDriver.commodity}</strong>
                    </div>
                  </div>
                </div>

                {/* Axle Weights */}
                <div className="p-3.5 rounded-xl bg-[#070A10] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-amber-400" />
                      CAT Scale Axle Load Distribution
                    </span>
                    <span className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase">
                      LEGAL &lt; 80,000 LBS
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Steer Axle:</span>
                      <strong className="text-white">
                        {activeSelectedDriver.axleWeights?.steerLbs.toLocaleString() || '11,840'} LBS
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Drive Tandems:</span>
                      <strong className="text-white">
                        {activeSelectedDriver.axleWeights?.driveLbs.toLocaleString() || '33,480'} LBS
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Trailer Tandems:</span>
                      <strong className="text-white">
                        {activeSelectedDriver.axleWeights?.trailerLbs.toLocaleString() || '33,620'} LBS
                      </strong>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-300 font-bold">Gross Total:</span>
                      <strong className="font-['Oswald',sans-serif] text-base text-amber-400 font-bold">
                        {activeSelectedDriver.axleWeights?.grossLbs.toLocaleString() || '78,940'} LBS
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HUD Footer */}
          <div className="p-3 bg-[#0C1220] border-t-2 border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">
              ODOMETER: <strong className="text-white">{activeSelectedDriver.odometerMiles.toLocaleString()} MI</strong>
            </span>

            <div className="flex items-center gap-2">
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('dispatch-loop')}
                  className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 text-xs font-bold uppercase tracking-wider"
                >
                  Loop Console
                </button>
              )}
              <button
                onClick={() => handleCopyText(activeSelectedDriver.lastAlertText, 'hud-alert', 'Last SitRep Text')}
                className="px-2.5 py-1 rounded bg-[#111A28] hover:bg-[#1A263B] text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1"
              >
                {copiedKey === 'hud-alert' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy SitRep</span>
              </button>
            </div>
          </div>
        </aside>
      )}
          </div>

          {/* If SPLIT_VIEW, right column is NASA Close-Up Spotter */}
          {displayMode === 'SPLIT_VIEW' && (
            <div className="relative w-full xl:w-1/2 h-[55vh] xl:h-full overflow-hidden">
              <NasaGoogleCloseUpOrbitalSpotter
                isInlineSplit={true}
                selectedDriver={activeSelectedDriver}
                allDrivers={filteredDrivers}
                onSelectDriver={handleSelectDriver}
                onClose={() => setDisplayMode('EXTENDED_RADAR')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
