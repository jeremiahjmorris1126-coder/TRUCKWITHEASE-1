import React from 'react';
import { ENABLE_TELEMETRY_SCREEN } from '../../config/featureFlags';

interface TelemetryScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  driverHeightFt?: number;
  onDriverHeightChange?: (newHeight: number) => void;
}

export const TelemetryScreen: React.FC<TelemetryScreenProps> = () => {
  if (!ENABLE_TELEMETRY_SCREEN) {
    return null;
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      <div className="bg-[#0A0F14] p-6 rounded-xl border border-[#1E2532] text-center font-mono text-xs text-slate-400">
        Telemetry requires an active ELD connection.
      </div>
    </div>
  );
};
