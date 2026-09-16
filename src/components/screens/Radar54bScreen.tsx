import React, { useState, useEffect } from 'react';
import { WEIGH_STATIONS } from '../../data/mockData';
import { WeighStation } from '../../types';

interface Radar54bScreenProps {
  onShowToast: (msg: string) => void;
  speed: number;
}

export const Radar54bScreen: React.FC<Radar54bScreenProps> = ({
  onShowToast,
  speed,
}) => {
  const [currentMile, setCurrentMile] = useState<number>(492.4);
  const [radarAngle, setRadarAngle] = useState<number>(0);
  const [bypassSignal, setBypassSignal] = useState<'GREEN' | 'RED' | 'STANDBY'>('GREEN');
  const [activeStation] = useState<WeighStation>(WEIGH_STATIONS[0]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>('stop-1');

  // Route Polyline Waypoints (Planned Stops & Hazard Zones along I-20 Corridor)
  const ROUTE_WAYPOINTS = [
    {
      id: 'current-loc',
      mile: 492.4,
      title: 'Current Position (TRK-904)',
      type: 'VEHICLE',
      icon: 'local_shipping',
      color: 'text-primary bg-primary/20 border-primary',
      eta: 'NOW (16:45)',
      description: 'Highway Cruise speed 65 MPH. ECM Telemetry 10Hz active.',
      percentAlong: 5,
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
      percentAlong: 26,
    },
    {
      id: 'hazard-1',
      mile: 512.0,
      title: 'High Crosswind Zone',
      type: 'HAZARD_WIND',
      icon: 'air',
      color: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
      eta: '+21m (17:06)',
      description: 'Hazard Warning: 42 MPH Crosswind Gusts reported on open bridge section.',
      percentAlong: 42,
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
      percentAlong: 58,
    },
    {
      id: 'hazard-2',
      mile: 528.2,
      title: 'Micro-Fog Valley Corridor',
      type: 'HAZARD_FOG',
      icon: 'foggy',
      color: 'text-sky-400 bg-sky-500/20 border-sky-500/40',
      eta: '+40m (17:25)',
      description: 'Hazard Warning: Density fog causing visibility drop to 0.8 miles. Low beams recommended.',
      percentAlong: 74,
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
      percentAlong: 95,
    },
  ];

  const selectedWaypoint = ROUTE_WAYPOINTS.find((w) => w.id === selectedWaypointId) || ROUTE_WAYPOINTS[1];

  // Dynamic Trip Summary Calculations based on Route Polyline Data
  const destinationMile = ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].mile; // 541.0
  const remainingDistance = Math.max(0, parseFloat((destinationMile - currentMile).toFixed(1))); // 48.6 mi
  const currentSpeed = speed > 0 ? speed : 65; // MPH
  const remainingMinutes = Math.round((remainingDistance / currentSpeed) * 60);
  
  const estimatedArrivalDate = new Date();
  estimatedArrivalDate.setMinutes(estimatedArrivalDate.getMinutes() + remainingMinutes);
  const formattedETA = estimatedArrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const totalPlannedStops = ROUTE_WAYPOINTS.filter((w) => w.type === 'PLANNED_STOP').length;
  const totalHazardZones = ROUTE_WAYPOINTS.filter((w) => w.type.startsWith('HAZARD')).length;

  // Radar beam rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle((prev) => (prev + 3) % 360);
    }, 40);
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

  const handleTestBypass = () => {
    onShowToast('PREPASS TRANSPONDER SIGNAL: BYPASS CONFIRMED // AUDIT LOGGED');
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Corridor HUD Header */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">radar</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider">
                Radar 54B Telemetry
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="font-headline-sm text-on-surface text-[16px] font-bold">
              I-20 Eastbound Corridor (Mile {currentMile})
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="font-telemetry-label text-[10px] text-outline uppercase block">
            Next Facility
          </span>
          <span className="font-telemetry-metric text-[18px] text-primary font-bold">
            14.2 MILES
          </span>
        </div>
      </div>

      {/* PrePass / Drivewyze Green Light Cockpit Banner */}
      <div className="bg-surface-container-low p-space-md rounded-xl border border-emerald-500/40 shadow-xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[26px]">
              check_circle
            </span>
            <div>
              <span className="font-label-caps text-emerald-400 uppercase font-bold tracking-widest text-[11px] block">
                PREPASS &bull; DRIVEWYZE BYPASS AUTHORIZED
              </span>
              <h3 className="font-headline-sm text-on-surface text-[17px] font-bold">
                {activeStation.name}
              </h3>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-telemetry-label text-[11px] font-bold rounded-full border border-emerald-500/40 animate-pulse">
            GREEN LIGHT
          </span>
        </div>

        <p className="font-body-sm text-[12px] text-on-surface-variant">
          Carrier ISS safety score (74) qualifies for roadside scale bypass. Maintain highway speed in Lane 2 or 3. No pull-in required.
        </p>

        {/* Axle Weight Telemetry Grid (Bridge Formula Compliant) */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
          <div className="bg-surface-container p-2 rounded border border-surface-container-highest">
            <span className="text-[9px] text-outline uppercase block">Steer Axle</span>
            <span className="text-[13px] text-primary font-bold">11,840 lb</span>
            <span className="text-[8px] text-emerald-400 block">&le; 12,000 max</span>
          </div>
          <div className="bg-surface-container p-2 rounded border border-surface-container-highest">
            <span className="text-[9px] text-outline uppercase block">Drive Tandem</span>
            <span className="text-[13px] text-primary font-bold">32,180 lb</span>
            <span className="text-[8px] text-emerald-400 block">&le; 34,000 max</span>
          </div>
          <div className="bg-surface-container p-2 rounded border border-surface-container-highest">
            <span className="text-[9px] text-outline uppercase block">Trailer Tandem</span>
            <span className="text-[13px] text-primary font-bold">32,200 lb</span>
            <span className="text-[8px] text-emerald-400 block">&le; 34,000 max</span>
          </div>
          <div className="bg-surface-container p-2 rounded border border-surface-container-highest">
            <span className="text-[9px] text-outline uppercase block">Gross Weight</span>
            <span className="text-[13px] text-emerald-400 font-bold">76,220 lb</span>
            <span className="text-[8px] text-emerald-400 block">&le; 80,000 max</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-mono text-outline">
            Scale Telemetry: WIM Sensors Active &bull; RFID Transponder #889104
          </span>
          <button
            onClick={handleTestBypass}
            className="px-3 py-1 bg-surface-container hover:bg-surface-container-high border border-outline/30 rounded text-on-surface font-label-caps text-[10px] uppercase font-bold cursor-pointer active:scale-95"
          >
            Acknowledge Bypass
          </button>
        </div>
      </div>

      {/* SIMPLIFIED POLYLINE ROUTE PATH VISUALIZATION */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-container-high">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">alt_route</span>
            <div>
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px] block">
                Simplified Corridor Polyline Route & Waypoint Matrix
              </span>
              <span className="text-[10px] text-outline font-mono">
                Active Route: I-20 Eastbound &bull; 48.6 Miles Total Corridor Length
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-primary/15 text-primary border border-primary/30 font-mono text-[10px] font-bold self-start sm:self-center">
            GPS SYNCHRONIZED
          </span>
        </div>

        {/* Vector SVG Polyline Canvas */}
        <div className="relative w-full h-36 bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden p-3 flex flex-col justify-between">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

          {/* SVG Route Line connecting all points with Night-HUD Laser Glow */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs>
              {/* High-Luminance Night Glow Filter */}
              <filter id="nightGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Cyan Pulse Glow Filter */}
              <filter id="cyanLaserGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Layer 1: Ambient Neon Yellow/Gold Atmosphere Aura */}
            <path
              d="M 20,70 Q 150,30 300,70 T 600,60 T 900,70"
              fill="none"
              stroke="#f2ca50"
              strokeWidth="8"
              filter="url(#nightGlow)"
              className="opacity-60 animate-pulse"
            />

            {/* Layer 2: Animated Dash Stream Flow (Travel Direction Motion) */}
            <path
              d="M 20,70 Q 150,30 300,70 T 600,60 T 900,70"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="3.5"
              strokeDasharray="12 8"
              filter="url(#cyanLaserGlow)"
              className="opacity-95 [stroke-dashoffset:0] animate-[dashFlow_3s_linear_infinite]"
            />

            {/* Layer 3: Crisp Core Precision Cyan Laser */}
            <path
              d="M 20,70 Q 150,30 300,70 T 600,60 T 900,70"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              className="opacity-100 drop-shadow-[0_0_8px_#38bdf8]"
            />
          </svg>

          {/* Polyline Nodes & Waypoint Markers Overlay */}
          <div className="relative z-10 flex items-center justify-between h-full px-2">
            {ROUTE_WAYPOINTS.map((wp) => {
              const isSelected = selectedWaypointId === wp.id;
              return (
                <div
                  key={wp.id}
                  onClick={() => {
                    setSelectedWaypointId(wp.id);
                    onShowToast(`SELECTED ROUTE WAYPOINT: ${wp.title} (Mile ${wp.mile})`);
                  }}
                  className="flex flex-col items-center cursor-pointer group relative"
                  style={{ transform: `translateY(${wp.type === 'HAZARD_WIND' ? '-12px' : wp.type === 'HAZARD_FOG' ? '8px' : '0px'})` }}
                >
                  {/* Waypoint Icon Pill */}
                  <div
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shadow-lg ${wp.color} ${
                      isSelected ? 'ring-4 ring-primary/50 scale-125 z-20' : 'hover:scale-110'
                    }`}
                    title={`${wp.title} - Mile ${wp.mile}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {wp.icon}
                    </span>
                  </div>

                  {/* Waypoint Title Badge */}
                  <span className={`text-[9px] font-mono font-bold mt-1.5 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 border border-white/10 text-center whitespace-nowrap ${
                    isSelected ? 'text-primary border-primary font-extrabold' : 'text-slate-300'
                  }`}>
                    Mile {wp.mile}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waypoint Interactive Detail Card */}
        <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${selectedWaypoint.color}`}>
              <span className="material-symbols-outlined text-[22px]">
                {selectedWaypoint.icon}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface text-[13px]">{selectedWaypoint.title}</span>
                <span className="text-[10px] text-primary font-bold">Mile {selectedWaypoint.mile}</span>
              </div>
              <p className="text-[10px] text-outline mt-0.5">{selectedWaypoint.description}</p>
            </div>
          </div>

          <div className="text-right shrink-0 border-t sm:border-t-0 sm:border-l border-surface-container-high pt-2 sm:pt-0 sm:pl-3">
            <span className="text-[10px] text-outline uppercase block">ETA Impact</span>
            <span className="text-[13px] text-emerald-400 font-bold block">{selectedWaypoint.eta}</span>
          </div>
        </div>

        {/* TRIP SUMMARY PANEL */}
        <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 via-surface-container-lowest to-surface-container-lowest space-y-2">
          <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
              <span className="font-label-caps text-[11px] font-bold text-primary uppercase tracking-wider">
                Corridor Trip Summary
              </span>
            </div>
            <span className="text-[10px] font-mono text-outline">
              Calculated @ {currentSpeed} MPH Cruise
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
            {/* Total Remaining Distance */}
            <div className="bg-surface-container/60 p-2 rounded-lg border border-surface-container-high">
              <span className="text-[9px] text-outline uppercase block">Remaining Dist</span>
              <span className="text-[15px] font-bold text-primary block leading-tight">
                {remainingDistance} MI
              </span>
              <span className="text-[8px] text-outline block">Mile {currentMile} &rarr; 541.0</span>
            </div>

            {/* Estimated Arrival Time */}
            <div className="bg-surface-container/60 p-2 rounded-lg border border-surface-container-high">
              <span className="text-[9px] text-outline uppercase block">Est Arrival (ETA)</span>
              <span className="text-[15px] font-bold text-emerald-400 block leading-tight">
                {formattedETA}
              </span>
              <span className="text-[8px] text-emerald-300 block">in {remainingMinutes} mins</span>
            </div>

            {/* Planned Route Stops */}
            <div className="bg-surface-container/60 p-2 rounded-lg border border-surface-container-high">
              <span className="text-[9px] text-outline uppercase block">Planned Stops</span>
              <span className="text-[15px] font-bold text-on-surface block leading-tight">
                {totalPlannedStops} STOPS
              </span>
              <span className="text-[8px] text-outline block">Fuel & PrePass Scale</span>
            </div>

            {/* Active Hazard Alerts */}
            <div className="bg-surface-container/60 p-2 rounded-lg border border-surface-container-high">
              <span className="text-[9px] text-outline uppercase block">Corridor Hazards</span>
              <span className="text-[15px] font-bold text-amber-400 block leading-tight">
                {totalHazardZones} ZONES
              </span>
              <span className="text-[8px] text-amber-300/80 block">Wind & Fog Alerts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rotating Radar Sweep HUD Card */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Tactical Forward Radar (30-Mile Lookahead)
          </span>
          <span className="font-telemetry-label text-[10px] text-outline">
            RANGE: 30 MILES
          </span>
        </div>

        {/* Circular Radar Graphic with SVG */}
        <div className="relative w-full h-56 bg-surface-container-lowest rounded-xl overflow-hidden flex items-center justify-center border border-surface-container-high">
          {/* Radar Circles */}
          <div className="absolute w-44 h-44 rounded-full border border-primary/20" />
          <div className="absolute w-32 h-32 rounded-full border border-primary/25" />
          <div className="absolute w-16 h-16 rounded-full border border-primary/30" />

          {/* Crosshairs */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-primary/20" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-primary/20" />

          {/* Sweep Line */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ transform: `rotate(${radarAngle}deg)` }}
          >
            <div className="w-1/2 h-0.5 bg-gradient-to-r from-primary to-transparent origin-left absolute left-1/2" />
          </div>

          {/* Tractor Icon Center */}
          <div className="relative z-10 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_0_12px_#f2ca50]">
            <span className="material-symbols-outlined text-[16px]">navigation</span>
          </div>

          {/* Approaching Targets on Radar */}
          {/* Target 1: Weigh Station (14 miles ahead, top right) */}
          <div className="absolute top-10 right-24 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative z-10" />
            <span className="font-mono text-[9px] text-emerald-400 font-bold bg-black/60 px-1 rounded">
              POEs / Scale (14.2m)
            </span>
          </div>

          {/* Target 2: TA Travel Center (37 miles, top left) */}
          <div className="absolute top-16 left-20 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-mono text-[9px] text-primary font-bold bg-black/60 px-1 rounded">
              TA Travel (37m)
            </span>
          </div>

          {/* Target 3: Overpass (16 miles, right) */}
          <div className="absolute bottom-16 right-20 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-mono text-[9px] text-amber-400 font-bold bg-black/60 px-1 rounded">
              15'2" Bridge (Safe)
            </span>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-2 left-3 font-mono text-[9px] text-outline bg-black/70 px-2 py-1 rounded">
            NIGHT RADAR // 10Hz BEARING 082&deg; (E)
          </div>
        </div>
      </div>

      {/* Approaching Facilities List */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Corridor Inspection Posts &amp; Scales
          </span>
          <span className="font-telemetry-label text-[10px] text-primary font-bold">
            ALL AUTHORIZED
          </span>
        </div>

        <div className="space-y-2">
          {WEIGH_STATIONS.map((ws) => (
            <div
              key={ws.id}
              className="p-3 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  scale
                </span>
                <div>
                  <h4 className="font-body-md font-bold text-on-surface">
                    {ws.name}
                  </h4>
                  <span className="text-[11px] text-outline font-mono block">
                    {ws.corridor} &bull; Mile {ws.mileMarker} &bull; {ws.scaleType}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-telemetry-metric text-[15px] text-primary block">
                  {ws.milesAway} mi
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-telemetry-label text-[9px] font-bold">
                  BYPASS READY
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
