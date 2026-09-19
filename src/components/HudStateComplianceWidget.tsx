import React, { useState, useEffect } from 'react';
import { stateGeolocationService, StateGeolocationState } from '../services/stateGeolocationService';
import { US_STATE_DOT_REGULATIONS } from '../data/stateRegulationsData';

interface HudStateComplianceWidgetProps {
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

export const HudStateComplianceWidget: React.FC<HudStateComplianceWidgetProps> = ({
  onShowToast,
  onRecordInspectionLog,
}) => {
  const [geoState, setGeoState] = useState<StateGeolocationState>(stateGeolocationService.getState());
  const [showFullRulesModal, setShowFullRulesModal] = useState<boolean>(false);
  const [showStatePicker, setShowStatePicker] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to stateGeolocationService updates
    const unsubscribe = stateGeolocationService.subscribe((newState) => {
      setGeoState(newState);
    });

    // Start GPS tracking on mount
    stateGeolocationService.startGpsTracking();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleGps = () => {
    if (geoState.isGpsActive) {
      stateGeolocationService.stopGpsTracking();
      onShowToast('GPS GEOLOCATION PAUSED', 'gps_off');
    } else {
      stateGeolocationService.startGpsTracking();
      onShowToast('GPS GEOLOCATION ACTIVATED // TRACKING STATE BOUNDARIES', 'gps_fixed');
    }
  };

  const handleSimulateState = (stateCode: string) => {
    stateGeolocationService.simulateStateCode(stateCode);
    const targetState = US_STATE_DOT_REGULATIONS[stateCode];
    onShowToast(
      `GEOLOCATION STATE OVERRIDE: ${targetState.stateName} (${targetState.stateCode}) • ${targetState.truckSpeedLimitMph} MPH LIMIT`,
      'travel_explore'
    );
  };

  const handleAttestStateCompliance = () => {
    const timestamp = new Date().toISOString().substring(0, 19).replace('T', ' ') + ' UTC';
    const st = geoState.stateData;
    const notes = `STATE GEOLOCATION COMPLIANCE ATTESTATION // State: ${st.stateName} (${st.stateCode}) // Truck Limit: ${st.truckSpeedLimitMph} MPH // Current Speed: ${geoState.currentSpeedMph} MPH // Lat/Lng: ${geoState.latitude}, ${geoState.longitude} // Lane Rules: ${st.laneRestrictions} // Weigh Station: ${st.weighStationPolicy} // Attested by Jonathan Vance (CDL IL-98104820) at ${timestamp}.`;

    if (onRecordInspectionLog) {
      onRecordInspectionLog('ROADSIDE_AUDIT', 'MANUAL_HUD', notes);
    }
    onShowToast(`GEOLOCATION STATE COMPLIANCE LOGGED FOR ${st.stateCode} TO HSM VAULT`, 'verified');
  };

  const st = geoState.stateData;

  return (
    <div className="bg-surface-container p-space-md rounded-xl border border-primary/50 shadow-2xl space-y-3 font-mono">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">location_on</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                STATE GEOLOCATION DOT SERVICE
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                geoState.isGpsActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {geoState.isGpsActive ? '✓ LIVE GPS BOUNDARY AGENT' : 'SIMULATED / PAUSED'}
              </span>
            </div>
            <span className="text-[10px] text-outline block">
              Auto-detects US state coordinates, applies commercial speed limits &amp; FMCSA/DOT regulations
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            onClick={handleToggleGps}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border ${
              geoState.isGpsActive
                ? 'bg-surface-container-high text-primary border-primary/40 hover:bg-surface-container-highest'
                : 'bg-primary text-on-primary border-primary hover:brightness-110'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {geoState.isGpsActive ? 'gps_fixed' : 'gps_not_fixed'}
            </span>
            <span>{geoState.isGpsActive ? 'GPS Active' : 'Enable GPS'}</span>
          </button>

          <button
            onClick={handleAttestStateCompliance}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[10px] uppercase font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">verified</span>
            <span>Attest DOT</span>
          </button>
        </div>
      </div>

      {/* Primary HUD Speed Limit & State Regulation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* State Identity & Location */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between space-y-1">
          <span className="text-[9px] text-outline uppercase font-bold block">DETECTED LOCATION STATE</span>
          <div className="flex items-center gap-2">
            <span className="text-[24px] leading-none">{st.flagEmoji}</span>
            <div>
              <span className="text-[16px] font-bold text-on-surface block leading-tight">
                {st.stateName} ({st.stateCode})
              </span>
              <span className="text-[9px] text-outline block font-mono">
                {geoState.latitude && geoState.longitude
                  ? `${geoState.latitude}°N, ${Math.abs(geoState.longitude)}°W`
                  : 'GPS Resolving...'}
              </span>
            </div>
          </div>
        </div>

        {/* Commercial Truck Speed Limit Card */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between space-y-1 transition-all ${
          geoState.isSpeeding
            ? 'bg-error/20 border-error/60 animate-pulse text-error'
            : 'bg-surface-container-low border-surface-container-high text-on-surface'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-outline uppercase font-bold block">TRUCK SPEED LIMIT</span>
            <span className="text-[9px] text-outline block">Cars: {st.carSpeedLimitMph} MPH</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className={`text-[26px] font-bold leading-none ${geoState.isSpeeding ? 'text-error' : 'text-primary'}`}>
              {st.truckSpeedLimitMph} <span className="text-[12px] font-normal">MPH</span>
            </span>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded border ${
              geoState.isSpeeding
                ? 'bg-error/30 text-error border-error/50'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {geoState.isSpeeding ? `+${geoState.speedDeltaMph} MPH OVER` : 'COMPLIANT'}
            </span>
          </div>
        </div>

        {/* Weigh Station Policy */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between space-y-1">
          <span className="text-[9px] text-outline uppercase font-bold block">WEIGH SCALE POLICY</span>
          <span className="text-[11px] font-bold text-emerald-400 leading-tight block truncate" title={st.weighStationPolicy}>
            {st.weighStationPolicy}
          </span>
          <span className="text-[9px] text-outline block">APU Weight Allowance: +{st.apuWeightAllowanceLbs} lbs</span>
        </div>

        {/* Lane Rules & Hotline */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between space-y-1">
          <span className="text-[9px] text-outline uppercase font-bold block">LANE RESTRICTIONS</span>
          <span className="text-[10px] text-on-surface leading-snug line-clamp-2" title={st.laneRestrictions}>
            {st.laneRestrictions}
          </span>
          <div className="flex items-center justify-between pt-0.5 text-[9px]">
            <span className="text-sky-400 font-bold">{st.dotHelpLine}</span>
            <button
              onClick={() => setShowFullRulesModal(true)}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              All Rules &gt;
            </button>
          </div>
        </div>
      </div>

      {/* State Corridor Selection (Quiet Background Automation) */}
      <div className="pt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-outline flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Active Corridor: <strong className="text-white">{st.stateName}</strong>
          </span>
          <button
            onClick={() => setShowStatePicker((prev) => !prev)}
            className="text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer text-[10px]"
          >
            <span>{showStatePicker ? 'Hide Corridor Selector' : 'Change Corridor'}</span>
            <span className="material-symbols-outlined text-[12px]">
              {showStatePicker ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>

        {showStatePicker && (
          <div className="p-2 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-between gap-2 text-[10px] overflow-x-auto">
            <span className="text-outline uppercase font-bold shrink-0">SELECT CORRIDOR:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {Object.keys(US_STATE_DOT_REGULATIONS).map((code) => {
                const isActive = geoState.stateCode === code;
                return (
                  <button
                    key={code}
                    onClick={() => handleSimulateState(code)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-high text-outline hover:text-on-surface'
                    }`}
                  >
                    {code} ({US_STATE_DOT_REGULATIONS[code].truckSpeedLimitMph} MPH)
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Regulations Modal */}
      {showFullRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-xl w-full space-y-4 relative font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-3">
                <span className="text-[32px]">{st.flagEmoji}</span>
                <div>
                  <span className="text-[11px] font-bold text-primary uppercase block">
                    FMCSA TITLE 49 STATE COMPLIANCE BRIEFING
                  </span>
                  <h3 className="text-[20px] font-bold text-on-surface uppercase">
                    {st.stateName} ({st.stateCode}) DOT REGULATIONS
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowFullRulesModal(false)}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[10px] font-bold text-primary uppercase block">Speed Limits &amp; Notes</span>
                <p className="text-[12px] font-bold text-on-surface">
                  Truck Max: {st.truckSpeedLimitMph} MPH | Car Max: {st.carSpeedLimitMph} MPH
                </p>
                <p className="text-[10px] text-outline">{st.speedLimitNotes}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase block">Lane Restrictions</span>
                <p className="text-[11px] text-on-surface">{st.laneRestrictions}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">Weigh Station Scale Mandates</span>
                <p className="text-[11px] text-on-surface">{st.weighStationPolicy}</p>
                <p className="text-[10px] text-outline">APU Weight Bonus: +{st.apuWeightAllowanceLbs} LBS certified scale credit.</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[10px] font-bold text-sky-400 uppercase block">Special State Mandates &amp; Tolls</span>
                <ul className="space-y-1 text-[10px] text-on-surface">
                  {st.specialDotMandates.map((m, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase block">Chain Law &amp; Winter Regulations</span>
                <p className="text-[11px] text-on-surface">{st.chainLawPolicy}</p>
                <p className="text-[10px] text-sky-400">Hotline: {st.dotHelpLine}</p>
              </div>
            </div>

            <button
              onClick={() => setShowFullRulesModal(false)}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-[12px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-lg"
            >
              Close State DOT Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
