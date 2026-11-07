import React, { useState, useEffect } from 'react';
import { TabId } from '../types';
import { offlineSyncService, SyncState } from '../services/offlineSyncService';

interface HeaderProps {
  activeTab: TabId;
  speed: number;
  onOpenEmergency: () => void;
  onOpenProfile: () => void;
  onToggleVoice?: () => void;
  isListening?: boolean;
  alertnessScore?: number;
  onOpenAlertnessModal?: () => void;
  onToggleMobileSidebar?: () => void;
  onOpenAuthLogin?: () => void;
  currentUser?: any;
  driverName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  speed,
  onOpenEmergency,
  onOpenProfile,
  onToggleVoice,
  isListening = false,
  alertnessScore = 98,
  onOpenAlertnessModal,
  onToggleMobileSidebar,
  onOpenAuthLogin,
  currentUser = null,
  driverName,
}) => {
  const [syncState, setSyncState] = useState<SyncState>(() => offlineSyncService.getState());

  useEffect(() => {
    return offlineSyncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  const getTabTitle = (tab: TabId) => {
    switch (tab) {
      case 'night-hud':
        return 'Driver In-Cab HUD';
      case 'hos-clocks':
        return 'HOS & Compliance';
      case 'trip-planner':
      case 'truck-parking':
      case 'weigh-bypass':
      case 'radar-54b':
      case 'dispatch-eta':
      case 'master-mechanic':
        return 'Route, Stops & Dispatch';
      case 'fleet-expenses':
      case 'vault':
      case 'ecosystem':
      case 'master-sync':
        return 'Fleet Operations & Vault';
      case 'signup':
        return 'Sign Up';
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
      <div className="max-w-5xl mx-auto h-16 px-2 sm:px-gutter-mobile flex items-center justify-between gap-1 sm:gap-space-xs">
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
          <div className="flex flex-col min-w-0">
            <span className="font-label-caps text-[9px] sm:text-label-caps text-primary uppercase leading-tight font-bold tracking-wider truncate max-w-[90px] sm:max-w-none">
              TRUCKWITHEASE
            </span>
            <span className="font-headline-sm text-[11px] sm:text-headline-sm text-on-surface uppercase tracking-wide truncate max-w-[85px] sm:max-w-[240px]">
              {getTabTitle(activeTab)}
            </span>
          </div>
        </div>

        {/* Right Telemetry & Status Badges */}
        <div className="flex items-center gap-space-xs shrink-0">
          {/* Offline Sync Status Indicator (Phase 4 Guaranteed Persistence) */}
          <button
            onClick={() => offlineSyncService.processQueue()}
            title={
              !syncState.isOnline
                ? 'Offline mode: All DVIRs, receipts & detention events saved locally.'
                : syncState.pendingCount > 0
                ? `${syncState.pendingCount} records waiting to sync. Click to retry now.`
                : 'All records synced to server.'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-bold transition-all cursor-pointer ${
              !syncState.isOnline
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                : syncState.pendingCount > 0
                ? 'bg-sky-950/60 text-sky-300 border-sky-500/50 animate-pulse'
                : 'bg-surface-container text-emerald-400 border-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">
              {!syncState.isOnline
                ? 'cloud_off'
                : syncState.isSyncing
                ? 'sync'
                : syncState.pendingCount > 0
                ? 'cloud_upload'
                : 'cloud_done'}
            </span>
            <span className="font-bold">
              {!syncState.isOnline
                ? syncState.pendingCount > 0 ? `Offline (${syncState.pendingCount})` : 'Offline'
                : syncState.isSyncing
                ? `Syncing (${syncState.pendingCount})...`
                : syncState.pendingCount > 0
                ? `Waiting to sync (${syncState.pendingCount})`
                : 'Synced'}
            </span>
          </button>

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

          {/* Speed Indicator */}
          <div
            className="flex items-center gap-space-2xs bg-surface-container px-space-xs py-1 rounded border border-surface-container-high"
            title="Current Speed (MPH)"
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
              className={`hidden sm:flex min-h-[40px] px-2.5 items-center justify-center gap-1 active:scale-95 transition-all rounded cursor-pointer shadow-md border ${
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

          {/* Firebase Auth Login Button */}
          {onOpenAuthLogin && (
            <button
              id="btn-auth-login"
              aria-label="Fleet Authenticator"
              onClick={onOpenAuthLogin}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer transition-all hover:brightness-110 active:scale-95 text-xs font-mono font-bold ${
                currentUser
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50'
                  : 'bg-[#FFE500] text-black border-[#FFE500] shadow-[0_0_12px_rgba(255,229,0,0.35)]'
              }`}
              title="Firebase Driver & Fleet Admin Login"
            >
              <span className="material-symbols-outlined text-[15px]">
                {currentUser ? 'verified_user' : 'lock'}
              </span>
              <span className="hidden sm:inline font-['Space_Grotesk'] text-[11px] font-black uppercase tracking-wider">
                {currentUser ? (currentUser.email ? currentUser.email.split('@')[0] : 'AUTHENTICATED') : 'SIGN IN'}
              </span>
            </button>
          )}

          {/* Profile Avatar Button */}
          <button
            id="btn-driver-profile"
            aria-label={currentUser ? `Driver: ${driverName || currentUser.displayName || currentUser.email}` : "Driver Profile (Sign-in required)"}
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 ml-space-2xs active:scale-95 transition-transform cursor-pointer shadow-sm hover:brightness-110"
            title={currentUser ? `Signed in as ${driverName || currentUser.email}` : "Driver Profile (Sign-in required)"}
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
