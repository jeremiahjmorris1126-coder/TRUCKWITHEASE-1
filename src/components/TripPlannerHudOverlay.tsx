import React, { useState, useEffect, useCallback } from 'react';
import { TripWaypoint, WaypointCategory } from '../types';
import { tripPlannerService } from '../services/tripPlannerService';

interface TripPlannerHudOverlayProps {
  onShowToast?: (msg: string, icon?: string) => void;
  onNavigateToTripPlanner?: () => void;
}

export const TripPlannerHudOverlay: React.FC<TripPlannerHudOverlayProps> = ({
  onShowToast,
  onNavigateToTripPlanner,
}) => {
  const [waypoints, setWaypoints] = useState<TripWaypoint[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<WaypointCategory | 'ALL'>('ALL');
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = tripPlannerService.subscribe((plan) => {
      setWaypoints(plan.waypoints);
    });
    return () => unsubscribe();
  }, []);

  const requestGpsPosition = useCallback(() => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      onShowToast?.('Geolocation API not supported in browser. Using corridor defaults.', 'warning');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const speedMph = speed ? Math.round(speed * 2.23694) : 62;
        tripPlannerService.setDriverLocationAndSpeed(latitude, longitude, speedMph);
        setIsGpsActive(true);
        setIsLocating(false);
        onShowToast?.(`TRIP PLANNER GPS SYNCED: ${latitude.toFixed(3)}°, ${longitude.toFixed(3)}° (${speedMph} MPH)`, 'my_location');
      },
      (err) => {
        console.warn('Trip Planner GPS error:', err.message);
        setIsLocating(false);
        onShowToast?.('GPS permission pending. Showing corridor baseline milestones.', 'explore');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [onShowToast]);

  useEffect(() => {
    requestGpsPosition();
  }, [requestGpsPosition]);

  const filteredWaypoints = waypoints.filter((wp) => {
    if (activeCategoryFilter === 'ALL') return true;
    return wp.category === activeCategoryFilter;
  });

  const getCategoryBadge = (cat: WaypointCategory) => {
    switch (cat) {
      case 'REST_STOP':
        return { label: 'REST AREA', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: 'local_parking' };
      case 'FUEL_STATION':
        return { label: 'FUEL / DIESEL', class: 'bg-sky-500/20 text-sky-300 border-sky-500/40', icon: 'local_gas_station' };
      case 'WEIGH_STATION':
        return { label: 'WEIGH SCALE', class: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: 'scale' };
    }
  };

  return (
    <div className="bg-surface-container/95 p-3 sm:p-4 rounded-xl border-2 border-primary/40 shadow-2xl space-y-3 font-mono text-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">alt_route</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-primary uppercase tracking-wider">
                TRIP PLANNER • UPCOMING WAYPOINTS
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${isGpsActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-surface-container-highest text-outline border-outline/30'}`}>
                {isGpsActive ? 'GPS ACTIVE' : 'CORRIDOR MESH'}
              </span>
            </div>
            <p className="text-[10px] text-outline">
              Real-time distances to rest stops, diesel stations, &amp; weigh scales along I-70/I-55 corridor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={requestGpsPosition}
            disabled={isLocating}
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-primary/30 text-primary hover:text-on-surface text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Update driver GPS coordinates for live distance calculation"
          >
            <span className={`material-symbols-outlined text-[14px] ${isLocating ? 'animate-spin' : ''}`}>
              {isLocating ? 'autorenew' : 'my_location'}
            </span>
            <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'Sync GPS'}</span>
          </button>

          {onNavigateToTripPlanner && (
            <button
              onClick={onNavigateToTripPlanner}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:brightness-110 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow"
            >
              <span>Full Trip Hub</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
        {[
          { id: 'ALL', label: 'ALL MILESTONES', icon: 'route' },
          { id: 'REST_STOP', label: '🅿️ REST AREAS', icon: 'local_parking' },
          { id: 'FUEL_STATION', label: '⛽ DIESEL & DEF', icon: 'local_gas_station' },
          { id: 'WEIGH_STATION', label: '⚖️ WEIGH SCALES', icon: 'scale' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategoryFilter(tab.id as WaypointCategory | 'ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
              activeCategoryFilter === tab.id
                ? 'bg-primary text-on-primary shadow'
                : 'bg-surface-container-low text-outline hover:text-on-surface border border-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Upcoming Waypoints HUD Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {filteredWaypoints.slice(0, 4).map((wp) => {
          const badge = getCategoryBadge(wp.category);
          return (
            <div
              key={wp.id}
              className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/50 transition-all space-y-2 relative group"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${badge.class} flex items-center gap-1 shrink-0`}>
                    <span className="material-symbols-outlined text-[12px]">{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                  <span className="text-[10px] text-outline font-bold truncate">{wp.exitNumber}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-primary font-mono">{wp.distanceMiles} MI</span>
                  <span className="text-outline text-[9px] font-mono">({wp.etaMinutes} min)</span>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
                  {wp.name}
                </h4>
                <p className="text-[9px] text-outline truncate">{wp.corridor}</p>
              </div>

              {/* Waypoint Category Custom Metrics */}
              <div className="pt-1 border-t border-surface-container-high/40 text-[10px] flex items-center justify-between">
                {wp.category === 'FUEL_STATION' && (
                  <>
                    <div className="flex items-center gap-2 text-[#00E676] font-bold">
                      <span>Diesel: ${wp.dieselPricePerGal?.toFixed(3)}/gal</span>
                      {wp.defAvailable && <span className="text-[8px] px-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">DEF</span>}
                    </div>
                    <span className="text-outline text-[9px]">{wp.showersAvailable} Showers</span>
                  </>
                )}

                {wp.category === 'REST_STOP' && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-outline">Parking:</span>
                      <span className={`font-bold ${wp.parkingStatus === 'AMPLE' ? 'text-emerald-400' : wp.parkingStatus === 'LIMITED' ? 'text-amber-400' : 'text-red-400'}`}>
                        {wp.availableParkingSpots} / {wp.totalParkingSpots} Spots
                      </span>
                    </div>
                    <span className="text-outline text-[9px]">{wp.parkingStatus}</span>
                  </>
                )}

                {wp.category === 'WEIGH_STATION' && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold px-1.5 py-0.2 rounded text-[8px] ${wp.weighStationStatus === 'OPEN' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                        {wp.weighStationStatus}
                      </span>
                      {wp.prePassAuthorized && (
                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                          PrePass Bypass ({wp.bypassProbabilityPct}%)
                        </span>
                      )}
                    </div>
                    <span className="text-outline text-[9px] truncate max-w-[100px]">{wp.scaleType}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
