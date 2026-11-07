import React from 'react';
import { ENABLE_RADAR_54B } from '../../config/featureFlags';

interface Radar54bProps {
  onShowToast: (msg: string, icon?: string) => void;
  driverHeightFt?: number;
  speed?: number;
}

export const Radar54bScreen: React.FC<Radar54bProps> = () => {
  if (!ENABLE_RADAR_54B) {
    return null;
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      <div className="bg-black p-6 rounded-xl border border-[#FFE500]/20 text-center font-mono text-xs text-slate-400">
        Low-bridge clearance checks are integrated into the Commercial Route Planner (/v1/routing/calculate).
      </div>
    </div>
  );
};
