import React, { useState } from 'react';

interface HapticsScreenProps {
  onShowToast: (msg: string) => void;
}

export const HapticsScreen: React.FC<HapticsScreenProps> = ({ onShowToast }) => {
  const [intensity, setIntensity] = useState<number>(75);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [laneAssistEnabled, setLaneAssistEnabled] = useState<boolean>(true);
  const [fatiguePulseEnabled, setFatiguePulseEnabled] = useState<boolean>(true);
  const [blindSpotPulseEnabled, setBlindSpotPulseEnabled] = useState<boolean>(true);

  // Synthesize tactile low-frequency rumble tone using Web Audio API
  const playTactileRumble = (frequency: number = 75, durationMs: number = 300) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Low pass filter for heavy seat-rumble feel
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, ctx.currentTime);

      gain.gain.setValueAtTime((intensity / 100) * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio context may be restricted before gesture
    }

    // Also trigger mobile device hardware vibration if supported
    if (navigator.vibrate) {
      navigator.vibrate(durationMs);
    }
  };

  const triggerZoneHaptic = (zoneId: string, label: string, freq: number = 75) => {
    setActiveZone(zoneId);
    playTactileRumble(freq, 400);
    onShowToast(`HAPTIC PULSE DISPATCHED: ${label} (${intensity}%)`);
    setTimeout(() => setActiveZone(null), 500);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Header Banner */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">vibration</span>
          </div>
          <div>
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider block">
              Bose Ride &bull; Sears Seating Active Haptics
            </span>
            <span className="font-headline-sm text-on-surface text-[17px] font-bold">
              Tactile Cab &amp; Seat Pulse Telemetry
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 bg-primary/20 text-primary font-telemetry-label text-[10px] font-bold rounded">
          CONNECTED (CAN J1939)
        </span>
      </div>

      {/* Driver Seat Haptic Diagram */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Interactive Driver Seat Tactile Actuators
          </span>
          <span className="font-telemetry-label text-[10px] text-outline">
            TAP ANY ZONE TO TEST VIBE
          </span>
        </div>

        {/* Seat Silhouette Matrix */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high flex flex-col items-center justify-center">
          <div className="relative w-64 h-80 flex flex-col items-center justify-between">
            {/* Headrest */}
            <button
              onClick={() => triggerZoneHaptic('headrest', 'HEADREST FATIGUE WAKE CHIME', 90)}
              className={`w-24 h-14 rounded-t-2xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                activeZone === 'headrest'
                  ? 'bg-primary text-on-primary border-primary scale-105 shadow-[0_0_16px_#f2ca50]'
                  : 'bg-surface-container-high border-surface-container-highest text-outline hover:border-primary/50'
              }`}
            >
              <span className="text-[10px] font-mono font-bold">HEADREST</span>
            </button>

            {/* Backrest & Lumbar */}
            <div className="relative w-44 h-36 bg-surface-container-low border-2 border-surface-container-highest rounded-lg flex flex-col items-center justify-around p-2">
              <button
                onClick={() => triggerZoneHaptic('upperBack', 'UPPER THORACIC COLLISION WARNING', 110)}
                className={`w-36 h-10 rounded border transition-all cursor-pointer flex items-center justify-center ${
                  activeZone === 'upperBack'
                    ? 'bg-error text-on-error border-error scale-105 shadow-[0_0_14px_#ff5449]'
                    : 'bg-surface-container-high text-outline hover:border-primary/40'
                }`}
              >
                <span className="text-[9px] font-mono font-bold uppercase">Thoracic Alert</span>
              </button>

              <button
                onClick={() => triggerZoneHaptic('lumbar', 'LUMBAR POSTURE & ATTENTION NUDGE', 60)}
                className={`w-36 h-12 rounded border transition-all cursor-pointer flex items-center justify-center ${
                  activeZone === 'lumbar'
                    ? 'bg-primary text-on-primary border-primary scale-105 shadow-[0_0_14px_#f2ca50]'
                    : 'bg-surface-container-high text-outline hover:border-primary/40'
                }`}
              >
                <span className="text-[9px] font-mono font-bold uppercase">Lumbar Pulse</span>
              </button>
            </div>

            {/* Seat Cushion / Left & Right Thigh Bolsters */}
            <div className="w-52 h-20 bg-surface-container-low border-2 border-surface-container-highest rounded-b-2xl grid grid-cols-2 gap-2 p-2">
              <button
                onClick={() => triggerZoneHaptic('leftThigh', 'LEFT THIGH - LANE DRIFT LEFT', 70)}
                className={`h-full rounded border flex items-center justify-center transition-all cursor-pointer ${
                  activeZone === 'leftThigh'
                    ? 'bg-amber-400 text-black font-bold border-amber-400 scale-105 shadow-[0_0_14px_#fbbf24]'
                    : 'bg-surface-container-high text-outline hover:border-primary/40'
                }`}
              >
                <span className="text-[9px] font-mono text-center font-bold">LEFT THIGH (LANE)</span>
              </button>

              <button
                onClick={() => triggerZoneHaptic('rightThigh', 'RIGHT THIGH - BLIND SPOT OBJECT', 70)}
                className={`h-full rounded border flex items-center justify-center transition-all cursor-pointer ${
                  activeZone === 'rightThigh'
                    ? 'bg-amber-400 text-black font-bold border-amber-400 scale-105 shadow-[0_0_14px_#fbbf24]'
                    : 'bg-surface-container-high text-outline hover:border-primary/40'
                }`}
              >
                <span className="text-[9px] font-mono text-center font-bold">RIGHT THIGH (BLIND)</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] font-mono text-outline mt-3">
            Simulates pneumatic air suspension bladder vibration and rumble pulses
          </span>
        </div>
      </div>

      {/* Intensity & Sensitivity Settings */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Tactile Intensity Calibration
          </span>
          <span className="font-telemetry-metric text-[15px] text-primary font-bold">
            {intensity}% AMPLITUDE
          </span>
        </div>

        <input
          type="range"
          min="20"
          max="100"
          value={intensity}
          onChange={(e) => setIntensity(parseInt(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />

        <div className="flex justify-between text-[10px] font-mono text-outline">
          <span>Gentle (20%)</span>
          <span>DOT Recommended (75%)</span>
          <span>Heavy Cab Rig (100%)</span>
        </div>
      </div>

      {/* Safety Toggle Features */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Autonomous Safety Triggers
          </span>
          <span className="font-telemetry-label text-[10px] text-primary">
            3 ACTIVE
          </span>
        </div>

        <div className="space-y-2">
          {/* Toggle 1 */}
          <div className="p-3 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between">
            <div>
              <span className="font-body-md font-bold text-on-surface block">
                Lane Departure Rumble Warning
              </span>
              <span className="text-[11px] text-outline font-mono">
                Vibrates left or right seat bolsters when crossing road fog line without turn signal
              </span>
            </div>
            <button
              onClick={() => setLaneAssistEnabled(!laneAssistEnabled)}
              className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${
                laneAssistEnabled ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-surface-container-lowest transition-transform ${
                  laneAssistEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Toggle 2 */}
          <div className="p-3 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between">
            <div>
              <span className="font-body-md font-bold text-on-surface block">
                Driver Fatigue &amp; Eye-Closure Nudge
              </span>
              <span className="text-[11px] text-outline font-mono">
                Lumbar pulsation triggered if in-cab camera detects prolonged micro-sleep or gaze deflection
              </span>
            </div>
            <button
              onClick={() => setFatiguePulseEnabled(!fatiguePulseEnabled)}
              className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${
                fatiguePulseEnabled ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-surface-container-lowest transition-transform ${
                  fatiguePulseEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Toggle 3 */}
          <div className="p-3 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between">
            <div>
              <span className="font-body-md font-bold text-on-surface block">
                Blind Spot Radar Proximity Burst
              </span>
              <span className="text-[11px] text-outline font-mono">
                Right side bolster tactile warning when 4-wheelers enter trailer blind spot
              </span>
            </div>
            <button
              onClick={() => setBlindSpotPulseEnabled(!blindSpotPulseEnabled)}
              className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${
                blindSpotPulseEnabled ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-surface-container-lowest transition-transform ${
                  blindSpotPulseEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
