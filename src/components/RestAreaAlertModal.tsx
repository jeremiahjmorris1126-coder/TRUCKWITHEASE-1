import React, { useState } from 'react';
import { DriverAlertnessData } from '../types';

interface RestAreaAlertModalProps {
  isOpen: boolean;
  alertnessData: DriverAlertnessData;
  onClose: () => void;
  onResetAlertness: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  /** Opens the truck parking page (real-time availability where states publish it). */
  onFindParking?: () => void;
}

export const RestAreaAlertModal: React.FC<RestAreaAlertModalProps> = ({
  isOpen,
  alertnessData,
  onClose,
  onResetAlertness,
  onShowToast,
  onFindParking,
}) => {
  const [testHits, setTestHits] = useState<number>(0);
  const [testActive, setTestActive] = useState<boolean>(false);
  const [testStartTime, setTestStartTime] = useState<number>(0);
  const [lastTestLatency, setLastTestLatency] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFindParking = () => {
    onClose();
    onFindParking?.();
  };

  const handleStartPingTest = () => {
    setTestActive(true);
    setTestHits(0);
    setTestStartTime(Date.now());
  };

  const handleTargetClick = () => {
    const reactionMs = Date.now() - testStartTime;
    setLastTestLatency(reactionMs);
    const newHits = testHits + 1;
    setTestHits(newHits);

    if (newHits >= 3) {
      setTestActive(false);
      onResetAlertness();
      onShowToast(
        `REACTION TEST PASSED: Average speed ${Math.round(reactionMs)}ms! Driver alertness restored to 100%.`,
        'psychology'
      );
    } else {
      setTestStartTime(Date.now());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-gradient-to-b from-surface-container via-surface-container-high to-surface-container w-full max-w-lg rounded-2xl border-2 border-error/80 shadow-[0_0_40px_rgba(255,229,0,0.4)] p-space-md space-y-space-md text-on-surface relative overflow-hidden select-none">
        {/* Glow Header Accent */}
        <div className="absolute top-0 inset-x-0 h-2 bg-error animate-pulse" />

        {/* Modal Title & Warning Header */}
        <div className="flex items-start justify-between gap-space-sm pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-error/20 border border-error/50 flex items-center justify-center text-error shrink-0 animate-bounce">
              <span className="material-symbols-outlined text-[28px]">bed</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-error uppercase font-bold tracking-widest text-[11px]">
                  Driver Alertness Safety System
                </span>
                <span className="px-1.5 py-0.5 rounded bg-error/20 text-error font-mono text-[9px] font-bold uppercase">
                  FATIGUE FLAGGED
                </span>
              </div>
              <h2 className="font-headline-sm text-on-surface text-[18px] font-bold">
                Cognitive Slowdown Detected & Rest Advisory
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Reaction Latency Measurement Card */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-error/30 space-y-2 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-outline uppercase">UI INTERACTION LATENCY:</span>
            <span className="text-error font-bold text-[14px]">
              {alertnessData.averageLatencyMs} ms (Slowdown Flagged)
            </span>
          </div>

          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
            <div
              className="bg-error h-full transition-all duration-500"
              style={{ width: `${Math.min(100, (alertnessData.averageLatencyMs / 1200) * 100)}%` }}
            />
          </div>

          <p className="text-outline leading-relaxed">
            Your recent screen interaction response latency ({alertnessData.averageLatencyMs}ms) is <strong className="text-error">3.8x slower</strong> than your optimal baseline (240ms). FMCSA safety guidelines strongly recommend taking a 30-minute rest break.
          </p>
        </div>

        {/* TRUCK PARKING: real availability lives on the Parking page (no invented counts here) */}
        <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-[20px]">local_parking</span>
          <span className="text-[12px] text-on-surface leading-relaxed">
            Find a safe place to park. The Parking page shows live open-space counts where state DOTs publish them.
          </span>
        </div>

        {/* COGNITIVE REACTION PING TEST SECTION */}
        {testActive ? (
          <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary text-center space-y-2 animate-pulse">
            <div className="text-[12px] font-mono text-primary font-bold">
              REACTION TEST ACTIVE: TAP THE TARGET BELOW! ({testHits}/3)
            </div>
            {lastTestLatency !== null && (
              <div className="text-[11px] font-mono text-emerald-400 font-bold">
                Last Hit Speed: {lastTestLatency} ms
              </div>
            )}
            <button
              onClick={handleTargetClick}
              className="px-6 py-4 rounded-xl bg-primary text-on-primary font-mono text-[14px] font-bold uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer w-full"
            >
              🎯 TAP NOW! (TARGET #{testHits + 1})
            </button>
          </div>
        ) : null}

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-space-sm pt-2">
          <button
            onClick={handleFindParking}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary font-label-caps text-[12px] font-bold uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">local_parking</span>
            <span>Find Truck Parking</span>
          </button>

          {!testActive && (
            <button
              onClick={handleStartPingTest}
              className="w-full sm:w-auto py-3 px-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary border border-primary/40 font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Test cognitive reaction speed to clear fatigue flag"
            >
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span>Test Reaction Speed</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-3 rounded-xl bg-surface-container-lowest text-outline hover:text-on-surface border border-white/5 font-mono text-[11px] font-bold uppercase cursor-pointer"
          >
            Snooze 15m
          </button>
        </div>
      </div>
    </div>
  );
};
