import React from 'react';
import { TabId } from '../../types';
import { ENABLE_MASTER_SYNC } from '../../config/featureFlags';

interface MasterSynchronizerProps {
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateTab?: (tab: TabId) => void;
  onOpenInspectionPdf?: () => void;
  onRecordInspectionEvent?: (
    type: 'PDF_GENERATED' | 'PRINTED',
    source: 'MANUAL_HUD' | 'CAB_PRINTER' | 'VOICE_CONTROL'
  ) => void;
  driverHeightFt?: number;
  onDriverHeightChange?: (height: number) => void;
}

export const MasterSynchronizerScreen: React.FC<MasterSynchronizerProps> = () => {
  if (!ENABLE_MASTER_SYNC) {
    return null;
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      <div className="bg-[#0A0F14] p-6 rounded-xl border border-[#1E2532] text-center font-mono text-xs text-slate-400">
        Pre-trip inspection reports are managed in the DVIR module (/v1/dvir).
      </div>
    </div>
  );
};
