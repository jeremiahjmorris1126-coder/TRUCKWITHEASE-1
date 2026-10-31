import React from 'react';
import { TabId } from '../types';
import { DRIVER_INFO } from '../data/mockData';

interface HeaderProps {
  activeTab: TabId;
  speed: number;
  onOpenEmergency: () => void;
  onOpenProfile: () => void;
  onOpenDriverPortal?: (tab?: 'signin' | 'signup' | 'roster' | 'functions') => void;
  activeDriverName?: string;
  onToggleVoice?: () => void;
  isListening?: boolean;
  alertnessScore?: number;
  onOpenAlertnessModal?: () => void;
  onToggleMobileSidebar?: () => void;
  onOpenBluetoothModal?: () => void;
  isBluetoothConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  speed,
  onOpenEmergency,
  onOpenProfile,
  onOpenDriverPortal,
  activeDriverName = DRIVER_INFO.name,
  onToggleVoice,
  isListening = false,
  alertnessScore = 98,
  onOpenAlertnessModal,
  onToggleMobileSidebar,
  onOpenBluetoothModal,
  isBluetoothConnected = false,
}) => {
  const getTabTitle = (tab: TabId) => {
    switch (tab) {
      case 'night-hud':
        return 'Driver In-Cab HUD';
      case 'hos-clocks':
        return 'HOS & Compliance';
      case 'trip-planner':
      case 'radar-54b':
      case 'dispatch-eta':
      case 'master-mechanic':
      case 'the-g-o-a-t-':
        return 'Route, Stops & Dispatch';
      case 'fleet-expenses':
      case 'vault':
      case 'ecosystem':
      case 'master-sync':
      case 'quantum-index':
        return 'Fleet Operations & Vault';
      case 'haptics':
        return 'Safety Haptics';
      case 'telemetry':
        return 'Fleet Telemetry';
      default:
        return 'Driver In-Cab HUD';
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 lg:left-72 z-40 bg-surface-container-lowest/90 backdrop-blur-xl pt-safe shadow-[0_4px_20px_rgba(0,0,0,0.7)] border-b border-surface-container-low transition-all">
      <div className="max-w-5xl mx-auto h-16 px-gutter-mobile flex items-center justify-between gap-space-xs">
        {/* Left: Mobile Sidebar Trigger & Title */}
        <div className="flex items-center gap-space-sm shrink-0">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-lg bg-surface-container border border-surface-container-high text-primary hover:bg-surface-container-high cursor-pointer flex items-center justify-center"
              title="Open Enterprise Side Commands"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          )}

          <img
            alt="TruckWithEase Logo"
            className="h-8 w-auto object-contain hidden sm:block"
            src="/assets/logo.png"
          />
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-primary uppercase leading-tight font-bold tracking-wider">
              TRUCKWITHEASE ENTERPRISE
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wide truncate max-w-[180px] sm:max-w-[240px]">
              {getTabTitle(activeTab)}
            </span>
          </div>
        </div>

        {/* Right Telemetry & Status Badges */}
        <div className="flex items-center gap-space-xs shrink-0">
          {/* Driver Alertness Index Pill */}
          {onOpenAlertnessModal && (
            <button
              onClick={onOpenAlertnessModal}
              className={`flex items-center gap-space-2xs px-space-xs py-1 rounded border cursor-pointer transition-all hover:brightness-110 active:scale-95 ${
                alertnessScore < 75
                  ? 'bg-error/20 text-error border-error/50 animate-pulse'
                  : 'bg-surface-container text-emerald-400 border-surface-container-high'
              }`}
              title="Driver Alertness Index & Rest Area Advisory"
            >
              <span className="material-symbols-outlined text-[14px]">
                {alertnessScore < 75 ? 'bed' : 'psychology'}
              </span>
              <span className="font-telemetry-label text-telemetry-label font-bold">
                {alertnessScore}%
              </span>
            </button>
          )}

          {/* Bluetooth ELD Telemetry Gateway Pill */}
          {onOpenBluetoothModal && (
            <button
              onClick={onOpenBluetoothModal}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer transition-all hover:brightness-110 active:scale-95 text-xs font-mono font-bold ${
                isBluetoothConnected
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-amber-950/40 text-[#FFE500] border-amber-500/50 hover:bg-amber-900/50'
              }`}
              title="Commercial Bluetooth ELD & 10Hz J1939 Telemetry Suite"
            >
              <span className="material-symbols-outlined text-[15px] animate-pulse">
                {isBluetoothConnected ? 'bluetooth_connected' : 'bluetooth'}
              </span>
              <span className="hidden sm:inline font-['Space_Grotesk'] text-[11px] font-black uppercase tracking-wider">
                {isBluetoothConnected ? 'ELD PAIRED' : 'PAIR ELD'}
              </span>
            </button>
          )}

          {/* GPS Rate Pill */}
          <div
            className="flex items-center gap-space-2xs bg-surface-container px-space-xs py-1 rounded border border-surface-container-high"
            title="ECM J1939 CAN-Bus 10Hz High-Fidelity Telemetry"
          >
            <span className="material-symbols-outlined text-primary text-[14px] animate-pulse">
              satellite_alt
            </span>
            <span className="font-telemetry-label text-telemetry-label text-on-surface">
              10Hz
            </span>
          </div>

          {/* Speed Indicator */}
          <div
            className="flex items-center gap-space-2xs bg-surface-container px-space-xs py-1 rounded border border-surface-container-high"
            title="Current J1939 Wheel Speed (MPH)"
          >
            <span className="material-symbols-outlined text-secondary-fixed-dim text-[14px]">
              speed
            </span>
            <span className="font-telemetry-label text-telemetry-label text-primary-fixed font-bold">
              {speed}
            </span>
          </div>

          {/* Voice Control HUD Button */}
          {onToggleVoice && (
            <button
              id="btn-hud-voice-control"
              aria-label="Voice Control HUD [V]"
              onClick={onToggleVoice}
              className={`min-h-[40px] px-2.5 flex items-center justify-center gap-1 active:scale-95 transition-all rounded cursor-pointer shadow-md border ${
                isListening
                  ? 'bg-error text-on-error border-white animate-pulse'
                  : 'bg-surface-container hover:bg-surface-container-high text-primary border-surface-container-high hover:border-primary/50'
              }`}
              title="Voice Control [V]: Say 'Show Inspection' or 'Emergency'"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
              <span className="font-telemetry-label text-[10px] hidden sm:inline font-bold">
                {isListening ? 'LISTENING' : 'VOICE [V]'}
              </span>
            </button>
          )}

          {/* Emergency Hotline Button */}
          <button
            id="btn-emergency-hotline"
            aria-label="Emergency Hotline"
            onClick={onOpenEmergency}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-error-container text-on-error-container active:scale-95 transition-transform rounded cursor-pointer shadow-md hover:bg-error-container/90"
            title="24/7 Roadside Assistance & DOT Hotline"
          >
            <span className="material-symbols-outlined text-[20px] animate-bounce text-error">
              e911_emergency
            </span>
          </button>

          {/* Driver Portal & Sign-In/Up Sheet Trigger */}
          {onOpenDriverPortal && (
            <button
              onClick={() => onOpenDriverPortal('roster')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black font-['Space_Grotesk'] text-[11px] uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(255,229,0,0.35)] hover:brightness-110 active:scale-95"
              title="Driver Sign-Up, Sign-In, Fleet Roster & Function Manager"
            >
              <span className="material-symbols-outlined text-[15px]">badge</span>
              <span className="hidden sm:inline truncate max-w-[110px]">{activeDriverName.split(' ')[0]}</span>
              <span className="text-[9px] bg-black text-[#FFE500] px-1 py-0.2 rounded font-mono">PORTAL</span>
            </button>
          )}

          {/* Profile Avatar Button */}
          <button
            id="btn-driver-profile"
            aria-label={`Driver: ${activeDriverName}`}
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 ml-space-2xs active:scale-95 transition-transform cursor-pointer shadow-sm hover:brightness-110"
            title="Driver Profile & CDL Credentials"
          >
            <span className="material-symbols-outlined text-on-primary text-[18px]">
              person
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
