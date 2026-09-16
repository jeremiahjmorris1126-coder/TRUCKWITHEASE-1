import React from 'react';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO } from '../data/mockData';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface-container w-full max-w-md rounded-xl border border-surface-container-high shadow-2xl p-space-md space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[28px]">badge</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-on-surface font-bold">
                {DRIVER_INFO.name}
              </h3>
              <span className="font-telemetry-label text-[10px] text-primary block">
                {DRIVER_INFO.cdlClass}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Credentials Grid */}
        <div className="space-y-2.5 text-body-sm">
          <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-mono block">Commercial Driver License</span>
              <span className="font-bold text-on-surface">{DRIVER_INFO.cdlNumber}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">
              ACTIVE IL-SOS
            </span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-mono block">DOT Medical Card (Form MCSA-5876)</span>
              <span className="font-bold text-on-surface">Valid through {DRIVER_INFO.medicalCertExp}</span>
            </div>
            <span className="material-symbols-outlined text-primary text-[18px]">
              verified
            </span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-mono block">Operating Carrier</span>
              <span className="font-bold text-on-surface">{CARRIER_INFO.name}</span>
              <span className="text-[11px] text-primary block">USDOT {CARRIER_INFO.usdot} // MC {CARRIER_INFO.mc}</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-mono block">Assigned Power Unit</span>
              <span className="font-bold text-on-surface">{EQUIPMENT_INFO.powerUnit}</span>
              <span className="text-[10px] text-outline font-mono block">VIN: {EQUIPMENT_INFO.vin}</span>
            </div>
            <span className="material-symbols-outlined text-outline text-[20px]">
              local_shipping
            </span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-mono block">FMCSA Roadside Quick PIN</span>
              <span className="font-telemetry-metric text-[18px] text-primary font-bold tracking-widest">{DRIVER_INFO.fmcsaPin}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-primary text-on-primary font-label-caps text-[11px] uppercase font-bold rounded-lg cursor-pointer hover:brightness-110 active:scale-95 transition-all"
        >
          Close Credentials
        </button>
      </div>
    </div>
  );
};
