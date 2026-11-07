import React, { useState } from 'react';
import { TabId, FleetCustomizationSettings } from '../types';

interface FleetModuleCustomizerProps {
  settings: FleetCustomizationSettings;
  onUpdateSettings: (newSettings: FleetCustomizationSettings) => void;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

const ALL_MODULES: { id: TabId; name: string; desc: string; category: string; icon: string }[] = [
  { id: 'master-sync', name: 'Everyday Sync', desc: 'Master fleet control & unified dispatch', category: 'OPERATIONS', icon: 'stars' },
  { id: 'night-hud', name: 'Night HUD', desc: 'High-contrast driver in-cab cockpit', category: 'HUD', icon: 'dashboard' },
  { id: 'dispatch-eta', name: 'Dispatch ETA', desc: 'Google Maps corridor & dock slot management', category: 'OPERATIONS', icon: 'schedule_send' },
  { id: 'vault', name: 'Sec. Vault', desc: 'HSM cryptographic logs & 8-day inspection records', category: 'COMPLIANCE', icon: 'lock' },
  { id: 'fleet-expenses', name: 'Invoices & Expenses', desc: 'WebstaurantStore sales invoices, fuel & supply receipts', category: 'COMPLIANCE', icon: 'receipt_long' },
  { id: 'hos-clocks', name: 'HOS Clocks', desc: '70h / 8-day duty status timers & alerts', category: 'COMPLIANCE', icon: 'timer' },
  { id: 'radar-54b', name: 'Radar 54B', desc: 'Collision avoidance & Doppler radar distance', category: 'SAFETY', icon: 'radar' },
  { id: 'trip-planner', name: 'Trip Planner', desc: 'Realtime geolocation upcoming rest stops, fuel & weigh scales', category: 'OPERATIONS', icon: 'route' },
  { id: 'master-mechanic', name: 'The Master Mechanic', desc: 'J1939 ECU diagnostics, component health & repair dispatch', category: 'OPERATIONS', icon: 'build_circle' },
  { id: 'haptics', name: 'Haptics', desc: 'Steering wheel tactile driver warnings', category: 'SAFETY', icon: 'vibration' },
  { id: 'ecosystem', name: 'Trust Hub', desc: 'Broker & carrier vetting system', category: 'COMPLIANCE', icon: 'hub' },
  { id: 'telemetry', name: 'Telemetry', desc: '10Hz CAN-Bus diagnostics & memory tracker', category: 'ANALYTICS', icon: 'memory' },
];

export const FleetModuleCustomizer: React.FC<FleetModuleCustomizerProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onShowToast,
}) => {
  const [localSettings, setLocalSettings] = useState<FleetCustomizationSettings>(settings);

  const handleToggleModule = (id: TabId) => {
    const updatedEnabled = {
      ...localSettings.enabledModules,
      [id]: !localSettings.enabledModules[id],
    };
    const next = { ...localSettings, enabledModules: updatedEnabled };
    setLocalSettings(next);
    onUpdateSettings(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-surface-container p-6 rounded-2xl border-2 border-primary/50 shadow-2xl max-w-2xl w-full my-auto space-y-5 relative font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">tune</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-primary uppercase block">
                TRUCKWITHEASE Customizer
              </span>
              <h3 className="text-[18px] font-bold text-on-surface uppercase">
                Fleet Module &amp; Function Manager
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Driver & Fleet Threshold Customizer Controls */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
            1. FLEET OPERATIONAL THRESHOLDS &amp; DRIVER TOLERANCES
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            {/* Speed Alert Tolerance */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5">
              <span className="text-[10px] text-outline uppercase font-bold block">Speed Alert Tolerance</span>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-primary">+{localSettings.speedAlertToleranceMph} MPH</span>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={localSettings.speedAlertToleranceMph}
                  onChange={(e) => {
                    const next = { ...localSettings, speedAlertToleranceMph: parseInt(e.target.value) };
                    setLocalSettings(next);
                    onUpdateSettings(next);
                  }}
                  className="w-28 accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Brake Thermal Warning Threshold */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5">
              <span className="text-[10px] text-outline uppercase font-bold block">Brake Thermal Warning</span>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-amber-400">{localSettings.brakeThermalWarningTempF}°F</span>
                <input
                  type="range"
                  min="350"
                  max="550"
                  step="10"
                  value={localSettings.brakeThermalWarningTempF}
                  onChange={(e) => {
                    const next = { ...localSettings, brakeThermalWarningTempF: parseInt(e.target.value) };
                    setLocalSettings(next);
                    onUpdateSettings(next);
                  }}
                  className="w-28 accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Function Toggle Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              2. ACTIVE APP FUNCTIONS &amp; NAV MODULE TOGGLES
            </span>
            <span className="text-[9px] text-outline">TOGGLE TO ENABLE/DISABLE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {ALL_MODULES.map((mod) => {
              const isEnabled = localSettings.enabledModules[mod.id] !== false;
              return (
                <div
                  key={mod.id}
                  onClick={() => handleToggleModule(mod.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isEnabled
                      ? 'bg-primary/10 border-primary/40 text-on-surface'
                      : 'bg-surface-container-lowest border-surface-container-high text-outline opacity-60'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`material-symbols-outlined text-[20px] ${isEnabled ? 'text-primary' : 'text-outline'}`}>
                      {mod.icon}
                    </span>
                    <div className="truncate">
                      <span className="text-[12px] font-bold block leading-tight truncate">{mod.name}</span>
                      <span className="text-[9px] text-outline block truncate">{mod.desc}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${isEnabled ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-outline'
                    }`}>
                    {isEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <button
          onClick={() => {
            onClose();
            onShowToast('FLEET CUSTOMIZATIONS APPLIED & PERSISTED', 'check_circle');
          }}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-[12px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-lg"
        >
          Save &amp; Apply Fleet Preferences
        </button>
      </div>
    </div>
  );
};
