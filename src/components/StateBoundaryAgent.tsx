import React, { useState, useEffect } from 'react';
import { US_STATE_DOT_REGULATIONS, StateDotRegulation } from '../data/stateRegulationsData';
import { stateGeolocationService } from '../services/stateGeolocationService';

interface StateBoundaryAgentProps {
  currentSpeedMph: number;
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

export const StateBoundaryAgent: React.FC<StateBoundaryAgentProps> = ({
  currentSpeedMph,
  onShowToast,
  onRecordInspectionLog,
}) => {
  const [activeStateCode, setActiveStateCode] = useState<string>('IL');
  const [previousStateCode, setPreviousStateCode] = useState<string>('TX');
  const [showBorderCrossingModal, setShowBorderCrossingModal] = useState<boolean>(false);
  const [lastBorderTimestamp, setLastBorderTimestamp] = useState<string>('17:14:02 CDT');

  useEffect(() => {
    const unsubscribe = stateGeolocationService.subscribe((geoState) => {
      if (geoState.stateCode && geoState.stateCode !== activeStateCode) {
        setPreviousStateCode(activeStateCode);
        setActiveStateCode(geoState.stateCode);

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} CDT`;
        setLastBorderTimestamp(timeStr);
        setShowBorderCrossingModal(true);
      }
    });

    return () => unsubscribe();
  }, [activeStateCode]);

  const currentState = US_STATE_DOT_REGULATIONS[activeStateCode] || US_STATE_DOT_REGULATIONS['IL'];
  const isSpeeding = currentSpeedMph > currentState.truckSpeedLimitMph;
  const speedDelta = currentSpeedMph - currentState.truckSpeedLimitMph;

  const handleSimulateBorderCrossing = (targetStateCode: string) => {
    if (targetStateCode === activeStateCode) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} CDT`;

    setPreviousStateCode(activeStateCode);
    setActiveStateCode(targetStateCode);
    setLastBorderTimestamp(timeStr);
    setShowBorderCrossingModal(true);

    const newState = US_STATE_DOT_REGULATIONS[targetStateCode];
    onShowToast(
      `STATE BORDER CROSSING: Entered ${newState.stateName} (${newState.stateCode}) • Speed Limit: ${newState.truckSpeedLimitMph} MPH`,
      'travel_explore'
    );
  };

  const handleAttestStateCompliance = () => {
    const timestamp = new Date().toISOString().substring(0, 19).replace('T', ' ') + ' UTC';
    const notes = `STATE BOUNDARY COMPLIANCE ATTESTATION // State: ${currentState.stateName} (${currentState.stateCode}) // Truck Speed Limit: ${currentState.truckSpeedLimitMph} MPH // Vehicle Speed: ${currentSpeedMph} MPH // Lane Restriction: ${currentState.laneRestrictions} // Weigh Station Policy: ${currentState.weighStationPolicy} // Attested by Jonathan Vance (CDL IL-98104820) at ${timestamp}.`;

    if (onRecordInspectionLog) {
      onRecordInspectionLog('ROADSIDE_AUDIT', 'MANUAL_HUD', notes);
    }
    onShowToast(`STATE COMPLIANCE ATTESTED FOR ${currentState.stateCode} // LOGGED TO VAULT`, 'verified');
  };

  return (
    <div className="bg-surface-container p-space-md rounded-xl border border-primary/40 shadow-xl space-y-4 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[26px]">fmcsa</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                TRUCKWITHEASE State Boundary &amp; DOT Agent
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                ACTIVE GPS AGENT
              </span>
            </div>
            <span className="text-[10px] text-outline font-mono block">
              Automated state boundary tracking, commercial speed limits &amp; FMCSA/DOT regulatory enforcement
            </span>
          </div>
        </div>

        {/* State Selection Dropdown & Sim Button */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <select
            value={activeStateCode}
            onChange={(e) => handleSimulateBorderCrossing(e.target.value)}
            className="bg-surface-container-lowest text-primary font-bold text-[12px] px-3 py-2 rounded-xl border border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {Object.values(US_STATE_DOT_REGULATIONS).map((st) => (
              <option key={st.stateCode} value={st.stateCode}>
                {st.flagEmoji} {st.stateName} ({st.truckSpeedLimitMph} MPH TRUCK)
              </option>
            ))}
          </select>

          <button
            onClick={handleAttestStateCompliance}
            className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Attest State DOT</span>
          </button>
        </div>
      </div>

      {/* Active State Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm">
        {/* Current State & Flag */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
          <div>
            <span className="text-[9px] text-outline uppercase block">CURRENT STATE REGULATION</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[20px]">{currentState.flagEmoji}</span>
              <span className="text-[17px] font-bold text-on-surface">{currentState.stateName} ({currentState.stateCode})</span>
            </div>
            <span className="text-[9px] text-outline block mt-1">Border Entry: {lastBorderTimestamp}</span>
          </div>
        </div>

        {/* Commercial Truck Speed Limit */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
          isSpeeding ? 'bg-error/15 border-error/50 animate-pulse' : 'bg-surface-container-low border-surface-container-high'
        }`}>
          <div>
            <span className="text-[9px] text-outline uppercase block">COMMERCIAL TRUCK SPEED LIMIT</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className={`text-[24px] font-bold ${isSpeeding ? 'text-error' : 'text-primary'}`}>
                {currentState.truckSpeedLimitMph} MPH
              </span>
              <span className="text-[10px] text-outline">Cars: {currentState.carSpeedLimitMph} MPH</span>
            </div>
          </div>
          <div className="pt-1">
            {isSpeeding ? (
              <span className="text-[9px] font-bold text-error bg-error/20 px-2 py-0.5 rounded border border-error/40 block">
                ⚠️ OVER SPEED BY +{speedDelta} MPH!
              </span>
            ) : (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 block">
                ✓ SPEED COMPLIANT ({currentSpeedMph} MPH)
              </span>
            )}
          </div>
        </div>

        {/* Weigh Station & Scale Policy */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
          <span className="text-[9px] text-outline uppercase block">WEIGH STATION SCALE POLICY</span>
          <span className="text-[12px] font-bold text-emerald-400 block truncate" title={currentState.weighStationPolicy}>
            {currentState.weighStationPolicy}
          </span>
          <span className="text-[9px] text-outline block">APU Weight Bonus: +{currentState.apuWeightAllowanceLbs} LBS</span>
        </div>

        {/* DOT Hotline */}
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
          <span className="text-[9px] text-outline uppercase block">STATE DOT HOTLINE</span>
          <a
            href={`tel:${currentState.dotHelpLine.replace(/[^0-9]/g, '')}`}
            className="text-[13px] font-bold text-sky-400 block hover:underline"
          >
            {currentState.dotHelpLine}
          </a>
          <span className="text-[9px] text-outline block">Chain Law: {currentState.chainLawPolicy}</span>
        </div>
      </div>

      {/* Detailed State Regulations Breakdown Card */}
      <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-surface-container-high space-y-3">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
          <span className="text-[11px] font-bold text-primary uppercase">
            Mandatory {currentState.stateName} State DOT Regulations &amp; Lane Rules
          </span>
          <span className="text-[9px] text-outline">FMCSA TITLE 49 COMPLIANCE</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          {/* Lane Restrictions & Speed Rules */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="material-symbols-outlined text-[16px]">signpost</span>
              <span>LANE RESTRICTIONS &amp; SPEED RULES</span>
            </div>
            <p className="text-[10px] text-on-surface leading-relaxed">{currentState.laneRestrictions}</p>
            <p className="text-[9px] text-outline">{currentState.speedLimitNotes}</p>
          </div>

          {/* Special State Mandates */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="material-symbols-outlined text-[16px]">gavel</span>
              <span>SPECIAL MANDATES &amp; TOLLWAY RULES</span>
            </div>
            <ul className="space-y-1 text-[10px] text-on-surface">
              {currentState.specialDotMandates.map((mandate, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">&bull;</span>
                  <span>{mandate}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* State Border Crossing Modal Alert */}
      {showBorderCrossingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4 relative">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-3">
                <span className="text-[32px]">{currentState.flagEmoji}</span>
                <div>
                  <span className="text-[11px] font-bold text-primary uppercase block">
                    STATE BORDER CROSSING DETECTED
                  </span>
                  <h3 className="text-[20px] font-bold text-on-surface uppercase">
                    ENTERED {currentState.stateName.toUpperCase()} ({currentState.stateCode})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowBorderCrossingModal(false)}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Speed Limit Notice */}
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              isSpeeding ? 'bg-error/20 border-error/50' : 'bg-emerald-500/15 border-emerald-500/40'
            }`}>
              <div>
                <span className="text-[10px] text-outline uppercase block">STATE TRUCK SPEED LIMIT</span>
                <span className="text-[26px] font-bold text-primary">{currentState.truckSpeedLimitMph} MPH</span>
              </div>
              <div>
                <span className="text-[10px] text-outline uppercase block">CURRENT TRUCK SPEED</span>
                <span className={`text-[26px] font-bold ${isSpeeding ? 'text-error animate-pulse' : 'text-emerald-400'}`}>
                  {currentSpeedMph} MPH
                </span>
              </div>
            </div>

            {isSpeeding && (
              <div className="p-3 rounded-xl bg-error/20 border border-error/40 text-[11px] text-error font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>ATTENTION: Reduce speed by {speedDelta} MPH to comply with {currentState.stateName} commercial limits!</span>
              </div>
            )}

            {/* Border Crossing Mandatory Regulations Briefing */}
            <div className="space-y-2 text-[11px]">
              <span className="text-[10px] font-bold text-outline uppercase block">
                MANDATORY STATE REGULATIONS BRIEFING:
              </span>
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1.5 text-[10px] text-on-surface">
                <div><strong className="text-primary">Lane Rules:</strong> {currentState.laneRestrictions}</div>
                <div><strong className="text-emerald-400">Scales:</strong> {currentState.weighStationPolicy}</div>
                <div><strong className="text-amber-400">Hotline:</strong> {currentState.dotHelpLine}</div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowBorderCrossingModal(false);
                onShowToast(`ACKNOWLEDGED ${currentState.stateName} STATE REGULATIONS`, 'check_circle');
              }}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-[12px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-lg"
            >
              Acknowledge &amp; Resume Driving HUD
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
