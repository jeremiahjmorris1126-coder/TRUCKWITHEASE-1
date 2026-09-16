import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRealtimeWeather, WeatherAlertType } from '../hooks/useRealtimeWeather';

interface WeatherAlertProps {
  onShowToast?: (msg: string) => void;
}

export const WeatherAlert: React.FC<WeatherAlertProps> = ({ onShowToast }) => {
  const {
    weather,
    alert,
    loading,
    error,
    isSimulated,
    refetch,
    simulateCondition,
  } = useRealtimeWeather();

  const [isDismissed, setIsDismissed] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);

  // Loading skeleton state
  if (loading && !weather) {
    return (
      <div className="flex items-center justify-between p-space-sm bg-surface-container/80 rounded-xl border border-surface-container-highest animate-pulse">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center">
            <span className="material-symbols-outlined text-outline text-[18px] animate-spin">
              autorenew
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-telemetry-label text-outline text-[10px] tracking-wider">
              SCANNING CORRIDOR ATMOSPHERIC TELEMETRY...
            </span>
            <span className="font-telemetry-label text-[9px] text-outline/60">
              CONNECTING TO REAL-TIME WEATHER RADAR
            </span>
          </div>
        </div>
        <span className="font-mono text-[9px] text-outline px-2 py-0.5 rounded bg-black/30 border border-outline/20">
          CAN-BUS LIVE
        </span>
      </div>
    );
  }

  // If dismissed or clear, allow compact HUD bar or show minimal status
  const isHazard = alert && alert.type !== 'CLEAR';

  // Aesthetic styling variables
  const isFog = alert?.type === 'FOG';
  const isSevere = alert?.type === 'SEVERE';
  const isWind = alert?.type === 'WIND';

  let containerBg = 'bg-[#1b1912]';
  let borderColor = 'border-[#f2ca50]/50';
  let accentColor = 'text-[#f2ca50]';
  let badgeBg = 'bg-[#f2ca50]/15 text-[#f2ca50] border-[#f2ca50]/40';
  let mainIcon = 'air';

  if (isFog) {
    containerBg = 'bg-[#260e12]';
    borderColor = 'border-[#ef4444]/60';
    accentColor = 'text-[#ef4444]';
    badgeBg = 'bg-[#ef4444]/20 text-[#fca5a5] border-[#ef4444]/40';
    mainIcon = 'foggy';
  } else if (isSevere) {
    containerBg = 'bg-[#291307]';
    borderColor = 'border-[#f97316]/60';
    accentColor = 'text-[#f97316]';
    badgeBg = 'bg-[#f97316]/20 text-[#fdba74] border-[#f97316]/40';
    mainIcon = 'ac_unit';
  } else if (isWind) {
    containerBg = 'bg-[#1f1a07]';
    borderColor = 'border-[#eab308]/70';
    accentColor = 'text-[#facc15]';
    badgeBg = 'bg-[#eab308]/20 text-[#fde047] border-[#eab308]/40';
    mainIcon = 'air';
  }

  return (
    <div className="w-full flex flex-col gap-space-2xs">
      <AnimatePresence mode="wait">
        {isHazard && !isDismissed ? (
          <motion.div
            key={alert.type + alert.title}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`relative overflow-hidden rounded-xl border ${containerBg} ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-space-md transition-colors`}
          >
            {/* Background subtle glowing watermark icon */}
            <div className="absolute -top-3 -right-3 pointer-events-none opacity-10">
              <span className="material-symbols-outlined text-[100px] text-white">
                {mainIcon}
              </span>
            </div>

            {/* Subtle radar scanline overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-space-sm">
              {/* Header bar: Title, Severity badge, & Action buttons */}
              <div className="flex items-start justify-between gap-space-xs">
                <div className="flex items-center gap-space-xs flex-wrap">
                  {/* Pulsing hazard beacon */}
                  <div className="relative flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-black/40 border border-white/10">
                    <span
                      className={`material-symbols-outlined text-[20px] ${accentColor} animate-pulse`}
                    >
                      {mainIcon}
                    </span>
                    <span
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                        isFog || isSevere ? 'bg-red-500' : 'bg-yellow-400'
                      } animate-ping`}
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-label-caps text-[11px] tracking-widest ${accentColor} uppercase`}>
                        {alert.title}
                      </span>
                      <span className={`font-telemetry-label text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${badgeBg}`}>
                        {alert.severity} ADVISORY
                      </span>
                      {isSimulated && (
                        <span className="font-telemetry-label text-[8px] text-outline px-1.5 py-0.5 rounded bg-black/40 border border-outline/30">
                          CORRIDOR SIM
                        </span>
                      )}
                    </div>
                    {weather && (
                      <span className="font-mono text-[10px] text-outline/80 mt-0.5">
                        {weather.locationLabel} • {weather.conditionText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right controls: Refresh, Simulation switch, Dismiss */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      refetch();
                      onShowToast?.('REFRESHING ATMOSPHERIC SATELLITE RADAR...');
                    }}
                    title="Refresh live weather"
                    className="p-1.5 rounded-lg bg-black/30 border border-white/10 text-outline hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] block">sync</span>
                  </button>

                  <button
                    onClick={() => setShowSimControls(!showSimControls)}
                    title="Toggle hazard simulation controls"
                    className={`p-1.5 rounded-lg bg-black/30 border text-[11px] font-mono transition-colors ${
                      showSimControls
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-white/10 text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] block">tune</span>
                  </button>

                  <button
                    onClick={() => setIsDismissed(true)}
                    title="Dismiss alert to compact HUD bar"
                    className="p-1.5 rounded-lg bg-black/30 border border-white/10 text-outline hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] block">close</span>
                  </button>
                </div>
              </div>

              {/* Advisory message */}
              <p className="font-body-sm text-[13px] leading-relaxed text-on-surface font-medium border-l-2 pl-3 border-current" style={{ borderColor: isFog || isSevere ? '#ef4444' : '#f2ca50' }}>
                {alert.message}
              </p>

              {/* Telemetry Metric Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {/* Wind Velocity */}
                <div className="flex flex-col p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                    Sustained Wind
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-telemetry-metric text-[18px] text-white">
                      {weather?.windSpeed ?? '--'}
                    </span>
                    <span className="font-mono text-[10px] text-outline">MPH</span>
                    {weather && weather.windGusts > weather.windSpeed && (
                      <span className="font-mono text-[9px] text-yellow-400 ml-auto">
                        Gusts {weather.windGusts}
                      </span>
                    )}
                  </div>
                </div>

                {/* Corridor Visibility */}
                <div className="flex flex-col p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                    Visual Distance
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      className={`font-telemetry-metric text-[18px] ${
                        weather && weather.visibilityMiles < 2 ? 'text-red-400 font-bold' : 'text-white'
                      }`}
                    >
                      {weather ? weather.visibilityMiles : '--'}
                    </span>
                    <span className="font-mono text-[10px] text-outline">MI</span>
                  </div>
                </div>

                {/* Speed Advisory */}
                <div className="flex flex-col p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                    Max Safe Speed
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-telemetry-metric text-[18px] text-primary">
                      {alert.speedAdvisoryMph ? `${alert.speedAdvisoryMph}` : 'NOMINAL'}
                    </span>
                    {alert.speedAdvisoryMph && (
                      <span className="font-mono text-[10px] text-outline">MPH</span>
                    )}
                  </div>
                </div>

                {/* Road Equipment Target */}
                <div className="flex flex-col p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                    At-Risk Gear
                  </span>
                  <span className="font-mono text-[11px] text-white font-semibold truncate mt-1">
                    {alert.equipmentHazard}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Compact Minimal HUD status bar when clear or dismissed */
          <motion.div
            key="clear-bar"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between px-space-md py-space-xs bg-surface-container rounded-xl border border-surface-container-high/70 shadow-md text-outline text-[11px]"
          >
            <div className="flex items-center gap-space-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHazard ? (isFog ? 'bg-red-400' : 'bg-yellow-400') : 'bg-emerald-400'
                }`}
              />
              <span className="font-telemetry-label text-[10px] text-on-surface font-semibold uppercase tracking-wider">
                {isHazard && isDismissed
                  ? `ALERT SILENCED: ${alert.title}`
                  : 'CORRIDOR ATMOSPHERE: CLEAR'}
              </span>
              {weather && (
                <span className="font-mono text-[10px] text-outline hidden sm:inline">
                  • {weather.windSpeed} MPH Wind • {weather.visibilityMiles} mi Vis • {weather.temperature}°F
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDismissed && isHazard && (
                <button
                  onClick={() => setIsDismissed(false)}
                  className="font-telemetry-label text-[9px] text-primary underline hover:text-white"
                >
                  EXPAND ALERT
                </button>
              )}
              <button
                onClick={() => setShowSimControls(!showSimControls)}
                title="Test different weather scenarios"
                className="font-telemetry-label text-[9px] px-2 py-0.5 rounded bg-surface-container-highest border border-outline/30 text-on-surface hover:border-primary/50 transition-colors"
              >
                TEST SIM
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Simulation Controls (Drawer / Accordion) */}
      <AnimatePresence>
        {showSimControls && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-surface-container-low p-space-sm rounded-xl border border-surface-container-high text-[11px] flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] text-primary uppercase font-bold tracking-wider">
                ATMOSPHERIC SIMULATION BENCH (FMCSA AUDITOR TEST)
              </span>
              <button
                onClick={() => setShowSimControls(false)}
                className="text-outline hover:text-white"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  simulateCondition('WIND');
                  setIsDismissed(false);
                  onShowToast?.('TRIGGERED HIGH-WIND ADVISORY SIMULATION (42 MPH)');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a220b] border border-[#eab308]/40 text-yellow-300 hover:border-yellow-300 font-mono text-[10px] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">air</span>
                Simulate High Wind (42 MPH)
              </button>

              <button
                onClick={() => {
                  simulateCondition('FOG');
                  setIsDismissed(false);
                  onShowToast?.('TRIGGERED ZERO-VISIBILITY TULE FOG SIMULATION');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#280c10] border border-[#ef4444]/40 text-red-300 hover:border-red-300 font-mono text-[10px] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">foggy</span>
                Simulate Dense Fog (0.3 mi)
              </button>

              <button
                onClick={() => {
                  simulateCondition('SEVERE');
                  setIsDismissed(false);
                  onShowToast?.('TRIGGERED BLACK ICE ROAD ADVISORY');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2e1305] border border-[#f97316]/40 text-orange-300 hover:border-orange-300 font-mono text-[10px] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">ac_unit</span>
                Simulate Black Ice (29°F)
              </button>

              <button
                onClick={() => {
                  simulateCondition('CLEAR');
                  onShowToast?.('ATMOSPHERE RESET TO CLEAR CORRIDOR');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest border border-outline/30 text-emerald-300 hover:border-emerald-300 font-mono text-[10px] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Simulate Clear Skies
              </button>

              <button
                onClick={() => {
                  refetch();
                  setIsDismissed(false);
                  onShowToast?.('SWITCHED TO LIVE GPS POSITION WEATHER');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 font-mono text-[10px] transition-colors ml-auto"
              >
                <span className="material-symbols-outlined text-[14px]">my_location</span>
                Reset to Live GPS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
