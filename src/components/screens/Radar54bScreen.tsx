import React, { useState, useEffect } from 'react';
import { WEIGH_STATIONS } from '../../data/mockData';
import { WeighStation } from '../../types';

interface Radar54bScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  speed: number;
  onNavigateToDispatch?: () => void;
}

export const Radar54bScreen: React.FC<Radar54bScreenProps> = ({
  onShowToast,
  speed,
  onNavigateToDispatch,
}) => {
  const [currentMile, setCurrentMile] = useState<number>(492.4);
  const [radarAngle, setRadarAngle] = useState<number>(0);
  const [isBypassExecuted, setIsBypassExecuted] = useState<boolean>(false);
  const [activeStation] = useState<WeighStation>(WEIGH_STATIONS[0]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>('bridge-danger');
  const [mapMode, setMapMode] = useState<'TACTICAL_3D' | 'GOOGLE_DARK' | 'SATELLITE'>('TACTICAL_3D');
  const [showWeighStationDetails, setShowWeighStationDetails] = useState<boolean>(false);

  // Corridor Waypoints including Sub-174" Bridge Danger Zone
  const ROUTE_WAYPOINTS = [
    {
      id: 'current-loc',
      mile: 492.4,
      title: 'Current Position (TRK-904)',
      type: 'VEHICLE',
      icon: 'local_shipping',
      color: 'text-[#FFE500] bg-[#FFE500]/20 border-[#FFE500]',
      eta: 'NOW (16:45)',
      description: 'Highway Cruise speed 65 MPH. ECM Telemetry 10Hz active.',
      clearance: "13' 6\" (Cab Height)",
    },
    {
      id: 'bridge-danger',
      mile: 498.2,
      title: 'BNSF Rail Overpass #54B',
      type: 'CRITICAL_BRIDGE',
      icon: 'warning',
      color: 'text-red-400 bg-red-950/60 border-red-500',
      eta: '+5m (16:50)',
      description: 'FHWA Item 54B Hazard: 13\' 6" Sub-174" structure. ZERO buffer margin.',
      clearance: "13' 6\" CRITICAL",
    },
    {
      id: 'stop-1',
      mile: 506.6,
      title: 'Love\'s Travel Stop #402',
      type: 'PLANNED_STOP',
      icon: 'local_gas_station',
      color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
      eta: '+14m (16:59)',
      description: 'Planned Stop: Ultra-Fast Diesel Bay 4 & Statutory 30-min HOS Rest Break.',
      clearance: "16' 2\" (Safe)",
    },
    {
      id: 'stop-2',
      mile: 520.4,
      title: 'Fort Worth PrePass Scale',
      type: 'PLANNED_STOP',
      icon: 'scale',
      color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
      eta: '+31m (17:16)',
      description: 'Inspection Post: Weigh-in-Motion Active. PrePass Bypass Authorized (Green Light).',
      clearance: "15' 8\" (Safe)",
    },
    {
      id: 'destination',
      mile: 541.0,
      title: 'Fort Worth Terminal Gateway',
      type: 'DESTINATION',
      icon: 'warehouse',
      color: 'text-purple-300 bg-purple-500/20 border-purple-500/40',
      eta: '+54m (17:39)',
      description: 'Final Destination: Assigned Dock Door D-04. Unloading window reserved.',
      clearance: "16' 0\" (Safe)",
    },
  ];

  const selectedWaypoint = ROUTE_WAYPOINTS.find((w) => w.id === selectedWaypointId) || ROUTE_WAYPOINTS[1];

  // Rotating Radar Sweep
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle((prev) => (prev + 3) % 360);
    }, 35);
    return () => clearInterval(interval);
  }, []);

  // Subtle mile marker progression
  useEffect(() => {
    if (speed > 0) {
      const mileTimer = setInterval(() => {
        setCurrentMile((prev) => parseFloat((prev + 0.05).toFixed(1)));
      }, 3000);
      return () => clearInterval(mileTimer);
    }
  }, [speed]);

  const handleExecuteBypass = () => {
    setIsBypassExecuted(true);
    onShowToast('DYNAMIC DIVERTER ROUTING ENGAGED // BYPASS VIA LOOP 820 AUTHORIZED (15\' 8" CLEARANCE)', 'alt_route');
  };

  const handlePriorityDispatchClick = () => {
    if (onNavigateToDispatch) {
      onNavigateToDispatch();
    } else {
      onShowToast('PRIORITY DISPATCH SYNTHETIC BOARD OPENED // $/HR YIELD RECALCULATED', 'bolt');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto px-2 sm:px-4 pb-20 space-y-4 font-mono select-none">
      {/* 1. TOP HERO HEADER (From Image 1) */}
      <div className="text-center pt-2 pb-1">
        <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          FHWA ITEM 54B LOW-BRIDGE RADAR
        </h1>
        <p className="text-sm sm:text-base font-medium text-emerald-300/90 tracking-wide mt-1">
          7,869 Sub-174&quot; Structures Mapped with Dynamic Diverter Routing
        </p>
      </div>

      {/* 2. TABLET HUD CHASSIS CONTAINER (Bezel Frame from Image 1) */}
      <div className="relative bg-[#05080E] border-2 sm:border-4 border-[#1A2536] rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Status Strip */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2C42]/80 text-[11px] sm:text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-bold tracking-widest uppercase">
              SYSTEM ACTIVE: GPS / RADAR
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Map Mode Switcher */}
            <div className="flex items-center bg-[#0C121D] p-0.5 rounded-lg border border-[#1E2C42] text-[10px]">
              <button
                onClick={() => setMapMode('TACTICAL_3D')}
                className={`px-2 py-0.5 rounded transition ${
                  mapMode === 'TACTICAL_3D'
                    ? 'bg-[#FFE500] text-black font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3D Vector
              </button>
              <button
                onClick={() => setMapMode('GOOGLE_DARK')}
                className={`px-2 py-0.5 rounded transition ${
                  mapMode === 'GOOGLE_DARK'
                    ? 'bg-[#FFE500] text-black font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Google Dark
              </button>
            </div>

            <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
              <span className="material-symbols-outlined text-[16px]">wifi</span>
              <span className="material-symbols-outlined text-[16px]">battery_full</span>
            </div>
          </div>
        </div>

        {/* 3. CENTER CRITICAL CLEARANCE ALERT BOX (Exact Match from Image 1) */}
        <div className="my-3 flex justify-center">
          <div
            className={`w-full max-w-xl transition-all duration-300 relative rounded-2xl p-3 sm:p-4 text-center ${
              isBypassExecuted
                ? 'bg-emerald-950/70 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
                : 'box-clearance-critical'
            }`}
          >
            {/* Main Clearance Metric Title */}
            <div className="flex items-center justify-center gap-2 text-lg sm:text-2xl md:text-3xl font-black font-['Space_Grotesk'] text-[#FFE500] tracking-wider uppercase drop-shadow-[0_0_12px_rgba(255,229,0,0.4)]">
              <span>{isBypassExecuted ? "15' 8\" CLEARANCE // +26\" BUFFER DELTA" : "13' 6\" CLEARANCE // 0\" BUFFER DELTA"}</span>
            </div>

            {/* Sub-Badge */}
            <div className="mt-1 flex items-center justify-center">
              <span
                className={`px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-widest uppercase border ${
                  isBypassExecuted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-red-950 text-red-400 border-red-500/60 animate-pulse'
                }`}
              >
                {isBypassExecuted ? 'COLLISION RISK: RESOLVED // SAFE BYPASS ACTIVE' : 'COLLISION RISK: CRITICAL'}
              </span>
            </div>

            {/* Sub-text Context */}
            <p className="mt-1.5 text-[10px] sm:text-[11px] text-slate-300/80 font-mono">
              {isBypassExecuted
                ? 'Diverter Corridor Active: Rerouted via Loop 820 North. Maximum structure clearance 15\' 8".'
                : 'Approaching BNSF Railway Low-Overpass at Mile 498.2. Sub-174" laser radar match.'}
            </p>
          </div>
        </div>

        {/* 4. DUAL-PANEL RADAR + 3D VECTOR MAP VIEWPORT (Exact Match from Image 1) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 my-2">
          {/* ======================================================== */}
          {/* LEFT PANEL: CIRCULAR TACTICAL SONAR RADAR HUD             */}
          {/* ======================================================== */}
          <div className="relative bg-[#070B12] rounded-xl border border-[#1E2C42] overflow-hidden p-3 h-72 sm:h-80 flex flex-col justify-between">
            {/* Top Telemetry Overlay */}
            <div className="relative z-10 flex justify-between text-[10px] text-emerald-400/90 font-mono leading-tight">
              <div>
                <span className="block font-bold">BRIDGE CLEARANCE ANALYSIS</span>
                <span className="block text-slate-400">SCAN: 200 YDM</span>
                <span className="block text-slate-400">TELEMETRY: 35.004</span>
              </div>
              <div className="text-right">
                <span className="text-[#FFE500] font-bold block">10Hz BEARING 082&deg; (E)</span>
                <span className="text-slate-400 block">SENSORS: LASER LIDAR</span>
              </div>
            </div>

            {/* CIRCULAR SONAR RADAR GRAPHIC WITH PERSPECTIVE ROADWAY */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Concentric Sonar Rings */}
              <div className="absolute w-64 h-64 rounded-full border border-emerald-500/25" />
              <div className="absolute w-48 h-48 rounded-full border border-emerald-500/35" />
              <div className="absolute w-32 h-32 rounded-full border border-emerald-500/40" />
              <div className="absolute w-16 h-16 rounded-full border border-emerald-500/50" />

              {/* Crosshair Axes */}
              <div className="absolute inset-x-4 top-1/2 h-[1px] bg-emerald-500/20" />
              <div className="absolute inset-y-4 left-1/2 w-[1px] bg-emerald-500/20" />

              {/* 3D Perspective Curving Yellow Road Grid (Winding into Sonar Center) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 300">
                <defs>
                  <linearGradient id="roadwayGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#FFE500" stopOpacity="0.8" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Perspective Curved Road Grid Lines */}
                <path
                  d="M 110,290 C 130,220 150,180 150,150 C 150,120 170,90 190,60"
                  fill="none"
                  stroke="#FFE500"
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                />
                <path
                  d="M 190,290 C 180,220 170,180 160,150 C 150,120 180,90 200,60"
                  fill="none"
                  stroke="#FFE500"
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                />

                {/* Road surface fill with mesh lines */}
                <path
                  d="M 110,290 C 130,220 150,180 150,150 C 150,120 170,90 190,60 L 200,60 C 180,90 150,120 160,150 C 170,180 180,220 190,290 Z"
                  fill="url(#roadwayGradient)"
                />

                {/* Horizontal distance rung lines */}
                <line x1="122" y1="260" x2="182" y2="260" stroke="#FFE500" strokeWidth="1" strokeOpacity="0.5" />
                <line x1="134" y1="220" x2="174" y2="220" stroke="#FFE500" strokeWidth="1" strokeOpacity="0.5" />
                <line x1="144" y1="180" x2="166" y2="180" stroke="#FFE500" strokeWidth="1" strokeOpacity="0.5" />

                {/* Warning Hazard Icon at Center Road */}
                {!isBypassExecuted && (
                  <g transform="translate(145, 138) scale(0.7)">
                    <polygon points="12,2 22,20 2,20" fill="#EF4444" stroke="#FFE500" strokeWidth="2" />
                    <text x="12" y="18" fill="#FFFFFF" fontSize="12" fontWeight="bold" textAnchor="middle">!</text>
                  </g>
                )}
              </svg>

              {/* Sweeping Sonar Beam */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${radarAngle}deg)` }}
              >
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-emerald-400 via-[#FFE500] to-transparent origin-left absolute left-1/2 shadow-[0_0_12px_#FFE500]" />
              </div>
            </div>

            {/* Bottom Sonar Telemetry Strip */}
            <div className="relative z-10 flex justify-between items-end text-[10px] text-slate-300 font-mono">
              <div>
                <span className="text-emerald-400 font-bold block">SCA Sonar</span>
                <span className="text-[9px] text-slate-400">RANGE 30 NM</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-slate-400 uppercase block">Speed</span>
                <span className="text-[14px] font-bold text-[#FFE500]">
                  {speed > 0 ? `${speed} MPH` : '35.2 MPH'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 uppercase block">ETA</span>
                <span className="text-[13px] font-bold text-emerald-400">0:30:30</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT PANEL: 3D VECTOR STREET MAP & ROUTE CORRIDOR        */}
          {/* ======================================================== */}
          <div className="relative bg-[#070B12] rounded-xl border border-[#1E2C42] overflow-hidden p-3 h-72 sm:h-80 flex flex-col justify-between">
            {/* Top Corridor Legend */}
            <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-300 font-mono">
              <span className="text-slate-400 uppercase font-bold tracking-wider">
                {mapMode === 'GOOGLE_DARK' ? 'Google Dark Tactical View' : 'Corridor Street Vector'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                13'6&quot; RESTRICTION MAP
              </span>
            </div>

            {/* VECTOR MAP SVG WITH GLOWING ROUTE CORRIDOR & BRIDGE AHEAD CALLOUTS */}
            <div className="absolute inset-0">
              <svg className="w-full h-full" viewBox="0 0 400 320" preserveAspectRatio="none">
                <defs>
                  {/* Route corridor gradient (Emerald green safe to amber hazard) */}
                  <linearGradient id="routeCorridorGlow" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="60%" stopColor="#22C55E" />
                    <stop offset="85%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor={isBypassExecuted ? "#10B981" : "#EF4444"} />
                  </linearGradient>

                  <filter id="corridorNeon" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Subtle Background Street Grid Lines */}
                <g stroke="#162235" strokeWidth="1.5" opacity="0.7">
                  <line x1="40" y1="20" x2="40" y2="300" />
                  <line x1="120" y1="10" x2="120" y2="310" />
                  <line x1="220" y1="20" x2="220" y2="300" />
                  <line x1="310" y1="10" x2="310" y2="310" />
                  <line x1="20" y1="60" x2="380" y2="60" />
                  <line x1="10" y1="140" x2="390" y2="140" />
                  <line x1="20" y1="230" x2="380" y2="230" />
                  {/* Angled road vectors */}
                  <line x1="60" y1="300" x2="260" y2="40" stroke="#1A2940" strokeWidth="2" />
                  <line x1="180" y1="310" x2="360" y2="80" stroke="#1A2940" strokeWidth="2" />
                </g>

                {/* Main Highway Route Corridor Line (S-curve from Image 1) */}
                {/* Neon Aura */}
                <path
                  d="M 220,300 C 220,250 290,200 280,140 C 270,80 230,70 230,20"
                  fill="none"
                  stroke="url(#routeCorridorGlow)"
                  strokeWidth="8"
                  filter="url(#corridorNeon)"
                  opacity="0.8"
                />
                {/* Core Laser Centerline */}
                <path
                  d="M 220,300 C 220,250 290,200 280,140 C 270,80 230,70 230,20"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  opacity="0.9"
                />

                {/* Alternate Diverter Bypass Route if Executed */}
                {isBypassExecuted && (
                  <path
                    d="M 220,240 C 160,220 140,140 180,80 C 200,50 220,30 230,20"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="5"
                    strokeDasharray="6 4"
                    filter="url(#corridorNeon)"
                  />
                )}
              </svg>

              {/* Vehicle Beacon Arrow Icon */}
              <div
                className="absolute z-20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                style={{ left: '55%', top: '88%' }}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_15px_#10B981]">
                  <span className="material-symbols-outlined text-[18px] text-white">navigation</span>
                </div>
              </div>

              {/* Callout Pins: "BRIDGE AHEAD" along the route path (From Image 1) */}
              <div
                className="absolute z-20 -translate-y-1/2 pointer-events-auto"
                style={{ left: '62%', top: '48%' }}
              >
                <div className="px-2.5 py-1 rounded bg-[#0C121D] border border-amber-400 text-amber-300 text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>BRIDGE AHEAD</span>
                </div>
              </div>

              <div
                className="absolute z-20 -translate-y-1/2 pointer-events-auto"
                style={{ left: '52%', top: '18%' }}
              >
                <div className="px-2.5 py-1 rounded bg-[#0C121D] border border-amber-400 text-amber-300 text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>BRIDGE AHEAD</span>
                </div>
              </div>

              {/* Vertical Elevation / Clearance Gauge on Right Margin (From Image 1) */}
              <div className="absolute right-3 top-10 bottom-10 w-2.5 bg-[#0C121D] border border-[#1E2C42] rounded-full flex flex-col justify-end p-0.5">
                <span className="absolute -top-4 right-0 text-[8px] font-mono text-slate-400">006</span>
                <div
                  className="w-full bg-gradient-to-t from-emerald-400 via-amber-400 to-red-500 rounded-full transition-all duration-500"
                  style={{ height: isBypassExecuted ? '40%' : '69%' }}
                />
                <span className="absolute -bottom-4 right-0 text-[8px] font-mono text-emerald-400 font-bold">
                  {isBypassExecuted ? '40%' : '69%'}
                </span>
              </div>
            </div>

            {/* Bottom Map Stats */}
            <div className="relative z-10 flex justify-between text-[10px] text-slate-400 font-mono">
              <span>SPEED 48 ms</span>
              <span className="text-[#FFE500]">PRIOR 26 nm</span>
              <span className="text-emerald-400 font-bold">ETA 1.3px</span>
            </div>
          </div>
        </div>

        {/* 5. DUAL MASSIVE TACTICAL BUTTONS AT BOTTOM (Exact Match from Image 1) */}
        <div className="mt-4 pt-2 border-t border-[#1E2C42]/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Button 1: EXECUTE BYPASS DIVERTER */}
          <button
            onClick={handleExecuteBypass}
            className={`py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-['Space_Grotesk'] font-black text-sm sm:text-base uppercase tracking-wider transition-all cursor-pointer ${
              isBypassExecuted
                ? 'bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                : 'btn-tactical-yellow'
            }`}
          >
            <span className="text-lg font-black">&gt;&gt;</span>
            <span>{isBypassExecuted ? 'BYPASS ACTIVE // REROUTED' : 'EXECUTE BYPASS DIVERTER'}</span>
          </button>

          {/* Button 2: PRIORITY DISPATCH */}
          <button
            onClick={handlePriorityDispatchClick}
            className="btn-tactical-yellow py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-['Space_Grotesk'] font-black text-sm sm:text-base uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px] font-black">tune</span>
            <span>PRIORITY DISPATCH</span>
          </button>
        </div>
      </div>

      {/* 6. SECONDARY COMPLIANCE DRAWER (Weigh Station, PrePass, Bridge Formula) */}
      <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500] text-[22px]">scale</span>
            <span className="font-['Space_Grotesk'] font-bold text-white text-sm uppercase tracking-wider">
              Bridge Formula &amp; Roadside Weigh Station Telemetry
            </span>
          </div>
          <button
            onClick={() => setShowWeighStationDetails(!showWeighStationDetails)}
            className="text-[11px] text-[#FFE500] hover:underline uppercase font-bold cursor-pointer"
          >
            {showWeighStationDetails ? 'Hide Telemetry' : 'View Axle Weights'}
          </button>
        </div>

        {/* Axle Weights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-[#05080E] p-2.5 rounded-lg border border-[#1E2532]">
            <span className="text-[10px] text-slate-400 uppercase block">Steer Axle</span>
            <span className="text-[15px] text-[#FFE500] font-bold">11,840 lb</span>
            <span className="text-[9px] text-emerald-400 block">&le; 12,000 max</span>
          </div>
          <div className="bg-[#05080E] p-2.5 rounded-lg border border-[#1E2532]">
            <span className="text-[10px] text-slate-400 uppercase block">Drive Tandem</span>
            <span className="text-[15px] text-[#FFE500] font-bold">32,180 lb</span>
            <span className="text-[9px] text-emerald-400 block">&le; 34,000 max</span>
          </div>
          <div className="bg-[#05080E] p-2.5 rounded-lg border border-[#1E2532]">
            <span className="text-[10px] text-slate-400 uppercase block">Trailer Tandem</span>
            <span className="text-[15px] text-[#FFE500] font-bold">32,200 lb</span>
            <span className="text-[9px] text-emerald-400 block">&le; 34,000 max</span>
          </div>
          <div className="bg-[#05080E] p-2.5 rounded-lg border border-[#1E2532]">
            <span className="text-[10px] text-slate-400 uppercase block">Gross Weight</span>
            <span className="text-[15px] text-emerald-400 font-bold">76,220 lb</span>
            <span className="text-[9px] text-emerald-400 block">&le; 80,000 max</span>
          </div>
        </div>

        {showWeighStationDetails && (
          <div className="p-3 bg-[#05080E] rounded-xl border border-emerald-500/40 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-[24px]">verified</span>
              <div>
                <span className="font-bold text-white block">{activeStation.name}</span>
                <span className="text-[10px] text-slate-400">PrePass Transponder #889104 &bull; ISS Safety Score 74</span>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/40">
              GREEN LIGHT // BYPASS
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
