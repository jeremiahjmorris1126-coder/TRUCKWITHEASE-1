import React, { useState, useEffect, useCallback } from 'react';
import { TripWaypoint, WaypointCategory, TripRoutePlan } from '../../types';
import { tripPlannerService } from '../../services/tripPlannerService';

interface TripPlannerScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const TripPlannerScreen: React.FC<TripPlannerScreenProps> = ({
  onShowToast,
  onNavigateToTab,
}) => {
  const [tripPlan, setTripPlan] = useState<TripRoutePlan>(tripPlannerService.getPlan());
  const [activeCategory, setActiveCategory] = useState<WaypointCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Waypoint Form State
  const [wpName, setWpName] = useState<string>('');
  const [wpCategory, setWpCategory] = useState<WaypointCategory>('REST_STOP');
  const [wpCorridor, setWpCorridor] = useState<string>('I-70 Corridor');
  const [wpMileMarker, setWpMileMarker] = useState<number>(215.0);
  const [wpLat, setWpLat] = useState<number>(38.85);
  const [wpLon, setWpLon] = useState<number>(-90.95);
  const [wpExit, setWpExit] = useState<string>('Exit 215');
  const [wpPrice, setWpPrice] = useState<number>(3.849);
  const [wpParking, setWpParking] = useState<number>(50);
  const [wpNotes, setWpNotes] = useState<string>('Driver recommended rest & staging location.');

  useEffect(() => {
    const unsubscribe = tripPlannerService.subscribe((plan) => {
      setTripPlan(plan);
    });
    return () => unsubscribe();
  }, []);

  const requestGpsSync = useCallback(() => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      onShowToast('Browser Geolocation API unequipped. Using Freight Corridor Geofence.', 'warning');
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
        onShowToast(`GPS POSITION LOCKED: ${latitude.toFixed(3)}°, ${longitude.toFixed(3)}° (${speedMph} MPH)`, 'my_location');
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setIsLocating(false);
        onShowToast('GPS permission pending. Loaded Missouri Corridor baseline milestones.', 'explore');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [onShowToast]);

  useEffect(() => {
    requestGpsSync();
  }, [requestGpsSync]);

  const filteredWaypoints = tripPlan.waypoints.filter((wp) => {
    const matchesCategory = activeCategory === 'ALL' || wp.category === activeCategory;
    const matchesSearch =
      wp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wp.corridor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wp.exitNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddWaypointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpName) {
      onShowToast('Please enter a milestone name.', 'warning');
      return;
    }

    tripPlannerService.addWaypoint({
      name: wpName,
      category: wpCategory,
      corridor: wpCorridor,
      mileMarker: Number(wpMileMarker),
      lat: Number(wpLat),
      lon: Number(wpLon),
      exitNumber: wpExit,
      dieselPricePerGal: wpCategory === 'FUEL_STATION' ? Number(wpPrice) : undefined,
      availableParkingSpots: wpCategory === 'REST_STOP' ? Number(wpParking) : undefined,
      totalParkingSpots: wpCategory === 'REST_STOP' ? Number(wpParking) * 2 : undefined,
      parkingStatus: wpCategory === 'REST_STOP' ? 'AMPLE' : undefined,
      weighStationStatus: wpCategory === 'WEIGH_STATION' ? 'OPEN' : undefined,
      prePassAuthorized: wpCategory === 'WEIGH_STATION' ? true : undefined,
      notes: wpNotes,
    });

    onShowToast(`ADDED WAYPOINT: ${wpName.toUpperCase()}`, 'add_location');
    setShowAddModal(false);
    setWpName('');
  };

  const handleRemove = (id: string, name: string) => {
    tripPlannerService.removeWaypoint(id);
    onShowToast(`REMOVED MILESTONE: ${name.toUpperCase()}`, 'delete');
  };

  const handleReset = () => {
    tripPlannerService.resetToDefault();
    onShowToast('RESET TRIP PLANNER TO DEFAULT CORRIDOR WAYPOINTS', 'restore');
  };

  // Stats calculation
  const totalWaypoints = tripPlan.waypoints.length;
  const restStopsCount = tripPlan.waypoints.filter((w) => w.category === 'REST_STOP').length;
  const fuelStopsCount = tripPlan.waypoints.filter((w) => w.category === 'FUEL_STATION').length;
  const weighScalesCount = tripPlan.waypoints.filter((w) => w.category === 'WEIGH_STATION').length;

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-4 font-mono text-on-surface p-2 sm:p-4">
      {/* Header Banner */}
      <div className="bg-surface-container p-4 rounded-2xl border border-surface-container-high shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border-2 border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">route</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-on-surface uppercase tracking-wider">
                TRIP PLANNER &amp; ROUTE MILESTONES
              </h2>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${isGpsActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                {isGpsActive ? 'GPS LOCATED' : 'CORRIDOR MESH'}
              </span>
            </div>
            <p className="text-[11px] text-outline mt-0.5">
              Current route: <strong className="text-primary">{tripPlan.title}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={requestGpsSync}
            disabled={isLocating}
            className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-primary/30 text-primary font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLocating ? 'animate-spin' : ''}`}>
              {isLocating ? 'autorenew' : 'my_location'}
            </span>
            <span>{isLocating ? 'Locating...' : 'Sync GPS'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            <span>Add Waypoint</span>
          </button>

          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-surface-container-high text-outline hover:text-on-surface font-bold text-[10px] uppercase transition-all"
            title="Reset to default I-70 corridor milestones"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Corridor Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
          <span className="text-[9px] text-outline uppercase block font-bold">TOTAL ROUTE DISTANCE</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[22px] font-bold text-primary">{tripPlan.totalDistanceMiles} MI</span>
            <span className="text-[10px] text-outline">{tripPlan.totalEstHours} Hours</span>
          </div>
        </div>

        <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
          <span className="text-[9px] text-outline uppercase block font-bold">REST AREAS &amp; HAVENS</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[22px] font-bold text-emerald-400">{restStopsCount} Stops</span>
            <span className="text-[10px] text-emerald-300">Parking Active</span>
          </div>
        </div>

        <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
          <span className="text-[9px] text-outline uppercase block font-bold">DIESEL &amp; DEF STATIONS</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[22px] font-bold text-sky-400">{fuelStopsCount} Stations</span>
            <span className="text-[10px] text-sky-300">Avg $3.839/gal</span>
          </div>
        </div>

        <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
          <span className="text-[9px] text-outline uppercase block font-bold">WEIGH SCALES &amp; INSPECTION</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[22px] font-bold text-amber-400">{weighScalesCount} Scales</span>
            <span className="text-[10px] text-amber-300">PrePass Active</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'ALL', label: `ALL (${totalWaypoints})`, icon: 'map' },
            { id: 'REST_STOP', label: `REST AREAS (${restStopsCount})`, icon: 'local_parking' },
            { id: 'FUEL_STATION', label: `DIESEL (${fuelStopsCount})`, icon: 'local_gas_station' },
            { id: 'WEIGH_STATION', label: `SCALES (${weighScalesCount})`, icon: 'scale' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as WaypointCategory | 'ALL')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-lowest text-outline hover:text-on-surface border border-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search milestones, exits, corridors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-9 pr-4 py-2 text-[11px] text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Waypoint Detailed Cards List */}
      <div className="space-y-3">
        {filteredWaypoints.length === 0 ? (
          <div className="bg-surface-container p-8 rounded-2xl border border-surface-container-high text-center space-y-2">
            <span className="material-symbols-outlined text-[36px] text-outline">no_crash</span>
            <p className="text-outline text-[12px]">No milestones match your search query or category filter.</p>
          </div>
        ) : (
          filteredWaypoints.map((wp, index) => (
            <div
              key={wp.id}
              className="bg-surface-container p-4 rounded-2xl border border-surface-container-high hover:border-primary/50 transition-all shadow-lg space-y-3 group"
            >
              {/* Card Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center shrink-0 border border-primary/30">
                    {index + 1}
                  </span>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors">
                        {wp.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container-highest border border-surface-container-high text-primary">
                        {wp.exitNumber}
                      </span>
                    </div>
                    <p className="text-[10px] text-outline mt-0.5">{wp.corridor} • Mile Marker {wp.mileMarker}</p>
                  </div>
                </div>

                {/* Distance & ETA Badge */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[16px] font-bold text-primary block leading-none">{wp.distanceMiles} MI AWAY</span>
                    <span className="text-[10px] text-outline">EST. ARRIVAL: ~{wp.etaMinutes} MIN</span>
                  </div>

                  <button
                    onClick={() => handleRemove(wp.id, wp.name)}
                    className="p-1.5 rounded-lg text-outline hover:text-red-400 hover:bg-surface-container-high transition-colors cursor-pointer"
                    title="Remove waypoint from trip"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Waypoint Specific Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {wp.category === 'FUEL_STATION' && (
                  <>
                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Diesel Price:</span>
                      <span className="text-[#00E676] font-bold text-[12px]">${wp.dieselPricePerGal?.toFixed(3)}/gal</span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">DEF &amp; High Flow:</span>
                      <span className="text-sky-300 font-bold">{wp.defAvailable ? 'Yes (Bulk Pump)' : 'Bottle Only'}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Showers:</span>
                      <span className="text-primary font-bold">{wp.showersAvailable || 0} Reservable</span>
                    </div>
                  </>
                )}

                {wp.category === 'REST_STOP' && (
                  <>
                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Available Spots:</span>
                      <span className="text-emerald-400 font-bold text-[12px]">{wp.availableParkingSpots} / {wp.totalParkingSpots}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Status:</span>
                      <span className={`font-bold ${wp.parkingStatus === 'AMPLE' ? 'text-emerald-400' : 'text-amber-400'}`}>{wp.parkingStatus}</span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Amenities:</span>
                      <span className="text-primary font-bold truncate max-w-[120px]">{wp.amenities?.join(', ') || 'Restrooms, Lights'}</span>
                    </div>
                  </>
                )}

                {wp.category === 'WEIGH_STATION' && (
                  <>
                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Scales Status:</span>
                      <span className={`font-bold text-[12px] ${wp.weighStationStatus === 'OPEN' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {wp.weighStationStatus}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">PrePass Bypass:</span>
                      <span className="text-sky-300 font-bold">{wp.bypassProbabilityPct}% Likelihood</span>
                    </div>

                    <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex justify-between items-center">
                      <span className="text-outline text-[10px]">Scale Type:</span>
                      <span className="text-primary font-bold truncate max-w-[120px]">{wp.scaleType || 'WIM Platform'}</span>
                    </div>
                  </>
                )}
              </div>

              {wp.notes && (
                <p className="text-[10px] text-outline italic bg-surface-container-lowest p-2 rounded-xl border border-surface-container-high/60">
                  💡 Note: {wp.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Waypoint Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-6 rounded-2xl border border-primary/40 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">add_location</span>
                <h3 className="text-base font-bold text-on-surface uppercase">Add Custom Waypoint</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddWaypointSubmit} className="space-y-3 text-[11px]">
              <div>
                <label className="block text-[10px] text-outline uppercase font-bold mb-1">Waypoint Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TA Express Exit 188 / Customer Receiver Dock B"
                  value={wpName}
                  onChange={(e) => setWpName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Category</label>
                  <select
                    value={wpCategory}
                    onChange={(e) => setWpCategory(e.target.value as WaypointCategory)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="REST_STOP">Rest Area / Parking</option>
                    <option value="FUEL_STATION">Fuel / Diesel Station</option>
                    <option value="WEIGH_STATION">Weigh Scale Station</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Exit Number</label>
                  <input
                    type="text"
                    value={wpExit}
                    onChange={(e) => setWpExit(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Corridor</label>
                  <input
                    type="text"
                    value={wpCorridor}
                    onChange={(e) => setWpCorridor(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Mile Marker</label>
                  <input
                    type="number"
                    step="0.1"
                    value={wpMileMarker}
                    onChange={(e) => setWpMileMarker(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={wpLat}
                    onChange={(e) => setWpLat(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {wpCategory === 'FUEL_STATION' && (
                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Diesel Price ($/gal)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={wpPrice}
                    onChange={(e) => setWpPrice(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {wpCategory === 'REST_STOP' && (
                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">Est. Parking Spots</label>
                  <input
                    type="number"
                    value={wpParking}
                    onChange={(e) => setWpParking(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-outline uppercase font-bold mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={wpNotes}
                  onChange={(e) => setWpNotes(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface font-bold text-[10px] uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-[10px] uppercase hover:brightness-110 shadow-lg"
                >
                  Save Waypoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
