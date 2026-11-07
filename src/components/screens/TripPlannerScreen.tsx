import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TripWaypoint,
  WaypointCategory,
  TripRoutePlan,
  TabId,
  CommercialVehicleProfileInput,
} from '../../types';
import {
  tripPlannerService,
  PlaceSearchResultItem,
  EMPTY_TRIP_PLAN,
} from '../../services/tripPlannerService';

interface TripPlannerScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToTab?: (tabId: TabId) => void;
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
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Origin & Destination Inputs
  const [originInput, setOriginInput] = useState<string>(tripPlan.origin || '');
  const [destinationInput, setDestinationInput] = useState<string>(tripPlan.destination || '');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(
    tripPlan.originCoords || null
  );
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lon: number } | null>(
    tripPlan.destinationCoords || null
  );

  // Autocomplete Suggestions State
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSearchResultItem[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<PlaceSearchResultItem[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState<boolean>(false);
  const [isSearchingDest, setIsSearchingDest] = useState<boolean>(false);
  const [showOriginDropdown, setShowOriginDropdown] = useState<boolean>(false);
  const [showDestDropdown, setShowDestDropdown] = useState<boolean>(false);

  // Vehicle Dimensions & Profile Inputs
  const [unitNumber, setUnitNumber] = useState<string>('TRACTOR-01');
  const [heightFt, setHeightFt] = useState<number>(13.5);
  const [widthFt, setWidthFt] = useState<number>(8.5);
  const [lengthFt, setLengthFt] = useState<number>(53.0);
  const [weightLbs, setWeightLbs] = useState<number>(80000);
  const [axles, setAxles] = useState<number>(5);
  const [hazmatClass, setHazmatClass] = useState<string>('None');
  const [avoidTolls, setAvoidTolls] = useState<boolean>(false);
  const [showVehicleSpecs, setShowVehicleSpecs] = useState<boolean>(true);

  // New Waypoint Form State
  const [wpName, setWpName] = useState<string>('');
  const [wpCategory, setWpCategory] = useState<WaypointCategory>('REST_STOP');
  const [wpCorridor, setWpCorridor] = useState<string>('Freight Corridor');
  const [wpMileMarker, setWpMileMarker] = useState<number>(100.0);
  const [wpLat, setWpLat] = useState<number>(39.0);
  const [wpLon, setWpLon] = useState<number>(-90.0);
  const [wpExit, setWpExit] = useState<string>('Exit 100');
  const [wpPrice, setWpPrice] = useState<number>(3.849);
  const [wpParking, setWpParking] = useState<number>(40);
  const [wpNotes, setWpNotes] = useState<string>('');

  const originSearchTimerRef = useRef<any>(null);
  const destSearchTimerRef = useRef<any>(null);

  // Subscribe to service updates
  useEffect(() => {
    const unsubscribe = tripPlannerService.subscribe((plan) => {
      setTripPlan(plan);
      if (plan.origin && !originInput) setOriginInput(plan.origin);
      if (plan.destination && !destinationInput) setDestinationInput(plan.destination);
      if (plan.originCoords) setOriginCoords(plan.originCoords);
      if (plan.destinationCoords) setDestinationCoords(plan.destinationCoords);
    });
    return () => unsubscribe();
  }, []);

  // Fetch driver's vehicle profile from server on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await tripPlannerService.getVehicleProfile();
        if (stored && mounted) {
          if (stored.heightFt) setHeightFt(stored.heightFt);
          if (stored.widthFt) setWidthFt(stored.widthFt);
          if (stored.lengthFt) setLengthFt(stored.lengthFt);
          if (stored.weightLbs) setWeightLbs(stored.weightLbs);
          if (stored.axles) setAxles(stored.axles);
          if (stored.hazmatClass) setHazmatClass(stored.hazmatClass);
          if (stored.avoidTolls !== undefined) setAvoidTolls(stored.avoidTolls);
          if (stored.unitNumber) setUnitNumber(stored.unitNumber);
        }
      } catch (err) {
        console.warn('Vehicle profile initial load:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Geolocation lock
  const requestGpsSync = useCallback(() => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      onShowToast('Browser Geolocation API unequipped.', 'warning');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const speedMph = speed ? Math.round(speed * 2.23694) : 0;
        tripPlannerService.setDriverLocationAndSpeed(latitude, longitude, speedMph);
        setIsGpsActive(true);
        setIsLocating(false);
        onShowToast(
          `GPS LOCKED: ${latitude.toFixed(3)}°, ${longitude.toFixed(3)}° (${speedMph} MPH)`,
          'my_location'
        );
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setIsLocating(false);
        onShowToast('GPS permission required for live device location.', 'explore');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [onShowToast]);

  useEffect(() => {
    requestGpsSync();
  }, [requestGpsSync]);

  // Autocomplete for Origin
  const handleOriginChange = (val: string) => {
    setOriginInput(val);
    setOriginCoords(null);
    setErrorMessage(null);
    if (originSearchTimerRef.current) clearTimeout(originSearchTimerRef.current);
    if (!val.trim()) {
      setOriginSuggestions([]);
      setShowOriginDropdown(false);
      return;
    }
    originSearchTimerRef.current = setTimeout(async () => {
      setIsSearchingOrigin(true);
      const results = await tripPlannerService.searchPlaces(val);
      setOriginSuggestions(results);
      setShowOriginDropdown(results.length > 0);
      setIsSearchingOrigin(false);
    }, 300);
  };

  // Autocomplete for Destination
  const handleDestinationChange = (val: string) => {
    setDestinationInput(val);
    setDestinationCoords(null);
    setErrorMessage(null);
    if (destSearchTimerRef.current) clearTimeout(destSearchTimerRef.current);
    if (!val.trim()) {
      setDestinationSuggestions([]);
      setShowDestDropdown(false);
      return;
    }
    destSearchTimerRef.current = setTimeout(async () => {
      setIsSearchingDest(true);
      const results = await tripPlannerService.searchPlaces(val);
      setDestinationSuggestions(results);
      setShowDestDropdown(results.length > 0);
      setIsSearchingDest(false);
    }, 300);
  };

  const handleSelectOrigin = async (place: PlaceSearchResultItem) => {
    setOriginInput(place.formattedAddress || place.name);
    setShowOriginDropdown(false);
    if (place.coords) {
      setOriginCoords(place.coords);
    } else {
      const geo = await tripPlannerService.geocode(place.formattedAddress || place.name);
      if (geo) setOriginCoords(geo.coords);
    }
  };

  const handleSelectDestination = async (place: PlaceSearchResultItem) => {
    setDestinationInput(place.formattedAddress || place.name);
    setShowDestDropdown(false);
    if (place.coords) {
      setDestinationCoords(place.coords);
    } else {
      const geo = await tripPlannerService.geocode(place.formattedAddress || place.name);
      if (geo) setDestinationCoords(geo.coords);
    }
  };

  // Swap Origin & Destination
  const handleSwapAddresses = () => {
    const tempInput = originInput;
    const tempCoords = originCoords;
    setOriginInput(destinationInput);
    setOriginCoords(destinationCoords);
    setDestinationInput(tempInput);
    setDestinationCoords(tempCoords);
  };

  // Save Vehicle Profile
  const handleSaveVehicleProfile = async () => {
    setIsSavingProfile(true);
    setErrorMessage(null);
    try {
      const profile: CommercialVehicleProfileInput = {
        unitNumber,
        heightFt: Number(heightFt),
        widthFt: Number(widthFt),
        lengthFt: Number(lengthFt),
        weightLbs: Number(weightLbs),
        axles: Number(axles),
        hazmatClass,
        avoidTolls,
      };
      await tripPlannerService.saveVehicleProfile(profile);
      onShowToast(`VEHICLE SPECS SAVED: ${heightFt} FT • ${weightLbs} LBS • ${axles} AXLES`, 'check_circle');
    } catch (err: any) {
      const msg = err.message || 'Failed to save vehicle profile.';
      setErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Commercial Route Calculation
  const handleCalculateRoute = async () => {
    if (!originInput.trim()) {
      setErrorMessage('Please enter an origin address or terminal.');
      return;
    }
    if (!destinationInput.trim()) {
      setErrorMessage('Please enter a destination address or dock.');
      return;
    }

    setIsCalculatingRoute(true);
    setErrorMessage(null);
    setShowOriginDropdown(false);
    setShowDestDropdown(false);

    try {
      // 1. Resolve Origin Coords if missing
      let resolvedOriginCoords = originCoords;
      if (!resolvedOriginCoords) {
        const geoOrigin = await tripPlannerService.geocode(originInput.trim());
        if (!geoOrigin || !geoOrigin.coords) {
          throw new Error(`Unable to geocode origin address: "${originInput}". Please check spelling.`);
        }
        resolvedOriginCoords = geoOrigin.coords;
        setOriginCoords(resolvedOriginCoords);
      }

      // 2. Resolve Destination Coords if missing
      let resolvedDestCoords = destinationCoords;
      if (!resolvedDestCoords) {
        const geoDest = await tripPlannerService.geocode(destinationInput.trim());
        if (!geoDest || !geoDest.coords) {
          throw new Error(`Unable to geocode destination address: "${destinationInput}". Please check spelling.`);
        }
        resolvedDestCoords = geoDest.coords;
        setDestinationCoords(resolvedDestCoords);
      }

      const vehicleProfile: CommercialVehicleProfileInput = {
        unitNumber,
        heightFt: Number(heightFt),
        widthFt: Number(widthFt),
        lengthFt: Number(lengthFt),
        weightLbs: Number(weightLbs),
        axles: Number(axles),
        hazmatClass,
        avoidTolls,
      };

      const calculated = await tripPlannerService.calculateCommercialEngineRoute(
        { label: originInput.trim(), coords: resolvedOriginCoords },
        { label: destinationInput.trim(), coords: resolvedDestCoords },
        vehicleProfile
      );

      const isMock = calculated.mock || calculated.routingEngine === 'mock';
      const toastMsg = isMock
        ? `ROUTE ESTIMATE (${calculated.totalDistanceMiles} MI) — NOT TRUCK-VERIFIED`
        : `ROUTE VERIFIED (${calculated.totalDistanceMiles} MI) VIA ${calculated.routingEngine?.toUpperCase()}`;
      onShowToast(toastMsg, isMock ? 'warning' : 'verified');
    } catch (err: any) {
      console.error('[TripPlannerScreen] Route error:', err);
      const msg = err.message || 'Route calculation failed. Check network or addresses.';
      setErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Clear / Reset
  const handleResetTrip = () => {
    tripPlannerService.clearPlan();
    setOriginInput('');
    setDestinationInput('');
    setOriginCoords(null);
    setDestinationCoords(null);
    setErrorMessage(null);
    onShowToast('TRIP CLEARED', 'delete');
  };

  // Add Waypoint
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
      notes: wpNotes,
    });

    onShowToast(`ADDED WAYPOINT: ${wpName.toUpperCase()}`, 'add_location');
    setShowAddModal(false);
    setWpName('');
  };

  const handleRemoveWaypoint = (id: string, name: string) => {
    tripPlannerService.removeWaypoint(id);
    onShowToast(`REMOVED: ${name.toUpperCase()}`, 'delete');
  };

  // Filter waypoints
  const waypoints = tripPlan.waypoints || [];
  const filteredWaypoints = waypoints.filter((wp) => {
    const matchesCategory = activeCategory === 'ALL' || wp.category === activeCategory;
    const matchesSearch =
      wp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wp.corridor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wp.exitNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const hasActiveRoute = Boolean(tripPlan.origin && tripPlan.totalDistanceMiles > 0);
  const isMockRoute = tripPlan.mock === true || tripPlan.routingEngine === 'mock';

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-4 font-mono text-on-surface p-2 sm:p-4">
      {/* Header Banner */}
      <div className="bg-surface-container p-4 rounded-2xl border border-surface-container-high shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border-2 border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">route</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-on-surface uppercase tracking-wider">
                TRIP PLANNER &amp; COMMERCIAL ROUTING
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                  isGpsActive
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {isGpsActive ? 'GPS ACTIVE' : 'GPS STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-outline mt-0.5">
              FMCSA Commercial Low-Clearance &amp; Axle-Weight Compliant Navigation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasActiveRoute && (
            <button
              onClick={handleResetTrip}
              className="px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-surface-container-high text-outline hover:text-on-surface font-bold text-[10px] uppercase transition-all"
              title="Clear current planned route"
            >
              Clear Route
            </button>
          )}
        </div>
      </div>

      {/* ERROR ALERT */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-xl flex items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400">error</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-outline hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ROUTING CONTROLS: ORIGIN / DESTINATION / VEHICLE SPECS */}
      <div className="bg-surface-container p-4 rounded-2xl border border-surface-container-high shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
          <span className="text-[12px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">alt_route</span>
            Commercial Trip Parameters
          </span>
          <button
            type="button"
            onClick={() => setShowVehicleSpecs(!showVehicleSpecs)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            <span>{showVehicleSpecs ? 'Hide Vehicle Specs' : 'Edit Vehicle Specs'}</span>
            <span className="material-symbols-outlined text-[14px]">
              {showVehicleSpecs ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {/* Origin & Destination Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          {/* Origin Search */}
          <div className="relative">
            <label className="block text-[10px] text-outline uppercase font-bold mb-1">
              Origin (Terminal / Shipper)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-[18px]">
                trip_origin
              </span>
              <input
                type="text"
                value={originInput}
                onChange={(e) => handleOriginChange(e.target.value)}
                onFocus={() => originSuggestions.length > 0 && setShowOriginDropdown(true)}
                placeholder="Enter origin address, city, or terminal..."
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-9 pr-8 py-2.5 text-[12px] text-on-surface focus:outline-none focus:border-primary"
              />
              {isSearchingOrigin && (
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[16px] animate-spin">
                  sync
                </span>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showOriginDropdown && originSuggestions.length > 0 && (
              <div className="absolute z-40 left-0 right-0 mt-1 bg-surface-container-high border border-primary/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {originSuggestions.map((p) => (
                  <div
                    key={p.placeId}
                    onClick={() => handleSelectOrigin(p)}
                    className="p-2.5 hover:bg-primary/20 cursor-pointer border-b border-surface-container-highest last:border-0 transition-colors"
                  >
                    <div className="text-[11px] font-bold text-on-surface">{p.name}</div>
                    <div className="text-[10px] text-outline truncate">{p.formattedAddress}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center md:pt-4">
            <button
              type="button"
              onClick={handleSwapAddresses}
              title="Swap Origin and Destination"
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest text-outline hover:text-white transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            </button>
          </div>

          {/* Destination Search */}
          <div className="relative">
            <label className="block text-[10px] text-outline uppercase font-bold mb-1">
              Destination (Receiver / Dock)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-[18px]">
                location_on
              </span>
              <input
                type="text"
                value={destinationInput}
                onChange={(e) => handleDestinationChange(e.target.value)}
                onFocus={() => destinationSuggestions.length > 0 && setShowDestDropdown(true)}
                placeholder="Enter destination address, city, or dock..."
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-9 pr-8 py-2.5 text-[12px] text-on-surface focus:outline-none focus:border-primary"
              />
              {isSearchingDest && (
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[16px] animate-spin">
                  sync
                </span>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showDestDropdown && destinationSuggestions.length > 0 && (
              <div className="absolute z-40 left-0 right-0 mt-1 bg-surface-container-high border border-primary/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {destinationSuggestions.map((p) => (
                  <div
                    key={p.placeId}
                    onClick={() => handleSelectDestination(p)}
                    className="p-2.5 hover:bg-primary/20 cursor-pointer border-b border-surface-container-highest last:border-0 transition-colors"
                  >
                    <div className="text-[11px] font-bold text-on-surface">{p.name}</div>
                    <div className="text-[10px] text-outline truncate">{p.formattedAddress}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Commercial Vehicle Specs Card */}
        {showVehicleSpecs && (
          <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high/80 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                Vehicle Profile &amp; Dimensions (Enforced in Routing Engine)
              </span>
              <button
                type="button"
                onClick={handleSaveVehicleProfile}
                disabled={isSavingProfile}
                className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-bold text-[10px] uppercase transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingProfile ? 'Saving...' : 'Save Specs to Profile'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-[11px]">
              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Unit #</label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Height (ft)</label>
                <input
                  type="number"
                  step="0.1"
                  min="6"
                  max="16.5"
                  value={heightFt}
                  onChange={(e) => setHeightFt(Number(e.target.value))}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Width (ft)</label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="12"
                  value={widthFt}
                  onChange={(e) => setWidthFt(Number(e.target.value))}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Length (ft)</label>
                <input
                  type="number"
                  step="0.5"
                  min="10"
                  max="120"
                  value={lengthFt}
                  onChange={(e) => setLengthFt(Number(e.target.value))}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Gross Wt (lbs)</label>
                <input
                  type="number"
                  step="500"
                  min="4000"
                  max="160000"
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(Number(e.target.value))}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Axles</label>
                <input
                  type="number"
                  min="2"
                  max="13"
                  value={axles}
                  onChange={(e) => setAxles(Number(e.target.value))}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                />
              </div>

              <div>
                <label className="block text-[9px] text-outline uppercase font-bold mb-0.5">Hazmat Class</label>
                <select
                  value={hazmatClass}
                  onChange={(e) => setHazmatClass(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg p-1.5 text-on-surface"
                >
                  <option value="None">None</option>
                  <option value="General">General</option>
                  <option value="Flammable">Flammable</option>
                  <option value="Corrosive">Corrosive</option>
                  <option value="Explosive">Explosive</option>
                  <option value="Radioactive">Radioactive</option>
                  <option value="Inhalant">Inhalant</option>
                  <option value="Caustic">Caustic</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-outline pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avoidTolls}
                  onChange={(e) => setAvoidTolls(e.target.checked)}
                  className="rounded border-surface-container-high text-primary focus:ring-0"
                />
                <span className="text-on-surface font-bold">Avoid Toll Roads</span>
              </label>
              <span>Bridge clearance safety buffer: 6 inches</span>
            </div>

            {weightLbs >= 18000 && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-400">local_shipping</span>
                  <span>COMMERCIAL TRUCK ROUTING (GVWR &gt; 18,000 LBS): Low bridge radar active • Prohibits parkways & non-truck roads</span>
                </div>
                <span className="text-[9px] text-outline uppercase tracking-wider">FHWA / STAA ONLY</span>
              </div>
            )}
          </div>
        )}

        {/* Calculate Button */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={handleCalculateRoute}
            disabled={isCalculatingRoute}
            className="btn-tactical-yellow px-5 py-3 rounded-xl text-black font-black uppercase text-[12px] tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] disabled:opacity-50 w-full sm:w-auto justify-center"
          >
            <span className={`material-symbols-outlined text-[18px] ${isCalculatingRoute ? 'animate-spin' : ''}`}>
              {isCalculatingRoute ? 'sync' : 'alt_route'}
            </span>
            <span>{isCalculatingRoute ? 'Calculating Route...' : 'Calculate Commercial Route'}</span>
          </button>
        </div>
      </div>

      {/* PROVIDER ATTRIBUTION BADGE (REQUIRED) */}
      {hasActiveRoute && (
        <div>
          {isMockRoute ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/50 text-amber-300 p-4 rounded-2xl flex items-start sm:items-center gap-3 shadow-lg">
              <span className="material-symbols-outlined text-amber-400 text-[26px] shrink-0 mt-0.5 sm:mt-0">
                warning
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-black uppercase tracking-wider text-amber-200">
                  Estimated route — not truck-verified
                </div>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Commercial routing provider offline or using simulation fallback. Verify all bridge clearances, weight limits, and hazardous materials restrictions independently before departure.
                </p>
              </div>
            </div>
          ) : tripPlan.routingEngine === 'tomtom' ? (
            <div className="bg-sky-500/10 border-2 border-sky-500/40 text-sky-300 p-4 rounded-2xl flex items-start sm:items-center gap-3 shadow-lg">
              <span className="material-symbols-outlined text-sky-400 text-[26px] shrink-0 mt-0.5 sm:mt-0">
                verified
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-black uppercase tracking-wider text-sky-200">
                  Truck-Verified Commercial Route (TomTom)
                </div>
                <p className="text-[11px] text-sky-300/80 mt-0.5">
                  Route verified against live commercial vector maps with bridge clearance ({heightFt} ft) and gross weight ({weightLbs.toLocaleString()} lbs) enforcement.
                  {tripPlan.cached ? ' • 15M CACHED' : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FFE500]/10 border-2 border-[#FFE500]/40 text-[#FFE500] p-4 rounded-2xl flex items-start sm:items-center gap-3 shadow-lg">
              <span className="material-symbols-outlined text-[#FFE500] text-[26px] shrink-0 mt-0.5 sm:mt-0">
                verified
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-black uppercase tracking-wider text-white">
                  Truck-Verified Commercial Route (Trimble PC*MILER)
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Official commercial mileage, IFTA verified, and low-clearance radar applied.
                  {tripPlan.cached ? ' • 15M CACHED' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOW BRIDGE ASSIST WARNING RADAR (>18,000 LBS & HEIGHT OVERHEAD CLEARANCES) */}
      {hasActiveRoute && (tripPlan.bridgeClearanceWarnings?.length || 0) > 0 && (
        <div className="bg-red-500/15 border-2 border-red-500/60 p-4 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center gap-3 text-red-400">
            <span className="material-symbols-outlined text-[28px] shrink-0 text-red-400">warning</span>
            <div>
              <div className="text-[14px] font-black uppercase tracking-wider text-red-200">
                LOW BRIDGE ASSIST WARNING: {tripPlan.bridgeClearanceWarnings?.length} Overhead Structure(s) Ahead
              </div>
              <p className="text-[11px] text-red-300">
                Vehicle Height: {heightFt} ft • Gross Weight: {weightLbs.toLocaleString()} lbs. Bridge clearances evaluated via FHWA Item 54B database against Google/TomTom/Trimble commercial network.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {tripPlan.bridgeClearanceWarnings?.map((b: any, idx: number) => (
              <div key={idx} className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                  <span className="font-bold text-white">{b.structureName || b.location || 'Overhead Bridge Structure'}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-red-300">{b.clearanceFt} ft Clearance</span>
                  <div className="text-[9px] text-amber-300 font-bold">
                    {b.bufferDeltaInches !== undefined ? `${b.bufferDeltaInches > 0 ? '+' : ''}${b.bufferDeltaInches} in buffer` : (b.severity || 'CRITICAL')}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-red-200 bg-red-900/40 p-2 rounded-lg font-medium">
            STAA National Network compliance: Trucks over 18,000 lbs must follow designated commercial truck corridors from Google Truck Maps, TomTom Truck, or Trimble PC*MILER. Non-truck parkways strictly prohibited.
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!hasActiveRoute && !isCalculatingRoute && (
        <div className="bg-surface-container p-10 rounded-2xl border border-surface-container-high text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container-highest flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[32px]">directions_boat</span>
          </div>
          <h3 className="text-base font-bold text-on-surface uppercase tracking-wide">
            No Route Planned Yet
          </h3>
          <p className="text-outline text-[12px] max-w-md mx-auto">
            Enter an origin and destination address above, check your vehicle dimensions ({heightFt} ft / {weightLbs.toLocaleString()} lbs), and tap &ldquo;Calculate Commercial Route&rdquo; to plan a truck-safe path.
          </p>
        </div>
      )}

      {/* LOADING STATE */}
      {isCalculatingRoute && (
        <div className="bg-surface-container p-10 rounded-2xl border border-surface-container-high text-center space-y-3 animate-pulse">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[32px] animate-spin">sync</span>
          </div>
          <h3 className="text-base font-bold text-primary uppercase tracking-wide">
            Calculating Commercial Route...
          </h3>
          <p className="text-outline text-[12px] max-w-md mx-auto">
            Evaluating low bridges, axle weight restrictions, and toll corridors for your {heightFt} ft tractor-trailer.
          </p>
        </div>
      )}

      {/* ACTIVE ROUTE METRICS */}
      {hasActiveRoute && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
              <span className="text-[9px] text-outline uppercase block font-bold">TOTAL ROUTE DISTANCE</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-primary">{tripPlan.totalDistanceMiles} MI</span>
                <span className="text-[10px] text-outline">{tripPlan.totalEstHours} Hours</span>
              </div>
            </div>

            <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
              <span className="text-[9px] text-outline uppercase block font-bold">TOLLS</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-emerald-400">
                  {typeof tripPlan.estimatedTollCostUsd === 'number' ? `$${tripPlan.estimatedTollCostUsd.toFixed(2)}` : 'Not reported'}
                </span>
                <span className="text-[10px] text-emerald-300">
                  {typeof tripPlan.tollDistanceMiles === 'number'
                    ? tripPlan.tollDistanceMiles > 0
                      ? `${tripPlan.tollDistanceMiles} mi toll`
                      : 'No toll roads'
                    : ''}
                </span>
              </div>
            </div>

            <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
              <span className="text-[9px] text-outline uppercase block font-bold">BRIDGE CLEARANCES</span>
              <div className="flex items-baseline justify-between mt-1">
                <span
                  className={`text-[22px] font-bold ${
                    (tripPlan.bridgeWarningsCount || 0) > 0 ? 'text-red-400' : 'text-sky-400'
                  }`}
                >
                  {(tripPlan.bridgeWarningsCount || 0) > 0 ? `${tripPlan.bridgeWarningsCount} Hazards` : 'All Clear'}
                </span>
                <span className="text-[10px] text-sky-300">&gt; {heightFt} ft Min</span>
              </div>
            </div>

            <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high shadow-lg">
              <span className="text-[9px] text-outline uppercase block font-bold">WAYPOINTS &amp; STOPS</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-amber-400">{waypoints.length}</span>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-[10px] text-primary hover:underline font-bold"
                >
                  + Add Stop
                </button>
              </div>
            </div>
          </div>

          {/* TURN-BY-TURN DIRECTIONS / STEPS */}
          {tripPlan.turnByTurnSteps && tripPlan.turnByTurnSteps.length > 0 && (
            <div className="bg-surface-container p-4 rounded-2xl border border-surface-container-high shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
                <span className="text-[12px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">turn_sharp_right</span>
                  Turn-By-Turn Route Guidance ({tripPlan.turnByTurnSteps.length} Steps)
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {tripPlan.turnByTurnSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high/60 flex items-center justify-between gap-3 text-[11px]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {step.stepIndex || idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-on-surface">{step.instruction}</div>
                        {step.streetName && (
                          <div className="text-[10px] text-outline">{step.streetName}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-primary">{step.distanceMiles} mi</span>
                      <div className="text-[9px] text-outline">~{step.durationMinutes} min</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WAYPOINTS SECTION */}
          <div className="bg-surface-container p-4 rounded-2xl border border-surface-container-high shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2 flex-wrap gap-2">
              <span className="text-[12px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">add_location_alt</span>
                Route Stops &amp; Waypoints ({waypoints.length})
              </span>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-[10px] uppercase hover:brightness-110 shadow flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Add Waypoint</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
                {[
                  { id: 'ALL', label: `ALL (${waypoints.length})`, icon: 'map' },
                  {
                    id: 'REST_STOP',
                    label: `REST (${waypoints.filter((w) => w.category === 'REST_STOP').length})`,
                    icon: 'local_parking',
                  },
                  {
                    id: 'FUEL_STATION',
                    label: `DIESEL (${waypoints.filter((w) => w.category === 'FUEL_STATION').length})`,
                    icon: 'local_gas_station',
                  },
                  {
                    id: 'WEIGH_STATION',
                    label: `SCALES (${waypoints.filter((w) => w.category === 'WEIGH_STATION').length})`,
                    icon: 'scale',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id as WaypointCategory | 'ALL')}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      activeCategory === tab.id
                        ? 'bg-primary text-on-primary shadow'
                        : 'bg-surface-container-lowest text-outline hover:text-on-surface border border-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-60">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter milestones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Waypoints List */}
            {filteredWaypoints.length === 0 ? (
              <div className="p-6 text-center text-outline text-[11px]">
                No waypoints added along this corridor yet. Tap &ldquo;Add Waypoint&rdquo; to add a rest stop or fuel station.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredWaypoints.map((wp, index) => (
                  <div
                    key={wp.id}
                    className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 transition-all flex items-center justify-between gap-3 text-[11px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-on-surface">{wp.name}</div>
                        <div className="text-[10px] text-outline">
                          {wp.exitNumber} • MM {wp.mileMarker} • {wp.corridor}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-primary block leading-none">
                          {wp.distanceMiles} MI
                        </span>
                        <span className="text-[9px] text-outline">~{wp.etaMinutes} min</span>
                      </div>
                      <button
                        onClick={() => handleRemoveWaypoint(wp.id, wp.name)}
                        className="text-outline hover:text-red-400 p-1 rounded hover:bg-surface-container-high transition-colors"
                        title="Remove stop"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
                <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                  Waypoint Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TA Express Exit 188 / Receiver Dock B"
                  value={wpName}
                  onChange={(e) => setWpName(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Category
                  </label>
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
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Exit Number
                  </label>
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
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Corridor
                  </label>
                  <input
                    type="text"
                    value={wpCorridor}
                    onChange={(e) => setWpCorridor(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Mile Marker
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={wpMileMarker}
                    onChange={(e) => setWpMileMarker(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Latitude (°N)
                  </label>
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
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Diesel Price ($/gal)
                  </label>
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
                  <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                    Est. Parking Spots
                  </label>
                  <input
                    type="number"
                    value={wpParking}
                    onChange={(e) => setWpParking(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-2 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                  Notes / Instructions
                </label>
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
