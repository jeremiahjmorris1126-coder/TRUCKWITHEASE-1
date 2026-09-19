import React from 'react';
import { DriverAlertnessData } from '../types';

interface DriverAlertnessWidgetProps {
  alertnessData: DriverAlertnessData;
  onOpenRestModal: () => void;
  onTriggerFatigue: () => void;
  onResetAlertness: () => void;
}

export const DriverAlertnessWidget: React.FC<DriverAlertnessWidgetProps> = ({
  alertnessData,
  onOpenRestModal,
  onTriggerFatigue,
  onResetAlertness,
}) => {
  const isOptimal = alertnessData.status === 'OPTIMAL';
  const isWarning = alertnessData.status === 'FATIGUE_WARNING' || alertnessData.status === 'CRITICAL_EXHAUSTION';

  return (
    <div className="bg-surface-container p-space-md rounded-2xl border border-surface-container-high shadow-xl space-y-space-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-space-2xs border-b border-surface-container-high">
        <div className="flex items-center gap-space-xs">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-md ${
              isWarning
                ? 'bg-error/20 text-error border border-error/40'
                : 'bg-primary/20 text-primary border border-primary/40'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isWarning ? 'bed' : 'psychology'}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                Cognitive Health Telemetry
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                  isOptimal
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : isWarning
                    ? 'bg-error/20 text-error border border-error/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {alertnessData.status}
              </span>
            </div>
            <h3 className="font-headline-sm text-on-surface text-[15px] font-bold">
              Driver Alertness Index
            </h3>
          </div>
        </div>

        {/* Readiness Meter */}
        <div className="text-right font-mono">
          <div className="text-[20px] font-bold text-on-surface">
            <span
              className={
                isWarning
                  ? 'text-error font-bold'
                  : isOptimal
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }
            >
              {alertnessData.score}%
            </span>
          </div>
          <div className="text-[9px] text-outline uppercase">Alertness Score</div>
        </div>
      </div>

      {/* Latency Telemetry Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs font-mono text-[11px]">
        <div className="bg-surface-container-low p-2.5 rounded-xl border border-white/5 space-y-0.5">
          <span className="text-outline text-[9px] uppercase block">UI Interaction Latency</span>
          <span className="text-primary font-bold text-[13px] block">
            {alertnessData.averageLatencyMs} ms
          </span>
          <span className="text-[8px] text-outline">Rolling average reaction</span>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-xl border border-white/5 space-y-0.5">
          <span className="text-outline text-[9px] uppercase block">Last Tap Speed</span>
          <span className="text-on-surface font-bold text-[13px] block">
            {alertnessData.lastLatencyMs} ms
          </span>
          <span className="text-[8px] text-outline">Micro-interaction speed</span>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-xl border border-white/5 space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-outline text-[9px] uppercase block">Suggested Rest Stop</span>
          <span className="text-emerald-400 font-bold text-[11px] truncate block">
            {alertnessData.recommendedRestArea?.name || 'Love\'s #402'}
          </span>
          <span className="text-[8px] text-outline">
            {alertnessData.recommendedRestArea?.milesAway || 14} Miles &bull; {alertnessData.recommendedRestArea?.availableSpots || 42} Spots
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-xs pt-1">
        <button
          onClick={onOpenRestModal}
          className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-primary text-on-primary font-label-caps text-[11px] font-bold uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">local_parking</span>
          <span>View Rest Area Advice</span>
        </button>

        {alertnessData.fatigueFlagged ? (
          <button
            onClick={onResetAlertness}
            className="w-full sm:w-auto py-2 px-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono text-[10px] font-bold uppercase cursor-pointer hover:bg-emerald-500/30 transition-all"
          >
            Reset Score
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-[10px] text-outline border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Passive Safety Monitor Active</span>
          </div>
        )}
      </div>
    </div>
  );
};
