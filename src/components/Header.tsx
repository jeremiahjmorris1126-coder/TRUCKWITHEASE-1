import React, { useState, useRef, useEffect } from 'react';
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
  onOpenErodsModal?: () => void;
  onOpenOfficerShield?: () => void;
  onOpenPullRods?: () => void;
  onOpenDvir?: () => void;
  onNavigateToTab?: (tab: TabId) => void;
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
  onOpenErodsModal,
  onOpenOfficerShield,
  onOpenPullRods,
  onOpenDvir,
  onNavigateToTab,
}) => {
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsToolsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      case 'hardware-pricing':
        return 'Hardware Store & Pricing';
      case 'landing':
        return 'Business Landing Page';
      default:
        return 'Driver In-Cab HUD';
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 lg:left-72 z-40 bg-[#05080E]/95 backdrop-blur-xl pt-safe shadow-[0_4px_24px_rgba(0,0,0,0.85)] border-b border-[#1E2532] transition-all font-mono">
      <div className="max-w-6xl mx-auto h-16 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Sidebar Trigger & Title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-[#0A0F14] border border-[#FFE500]/30 hover:border-[#FFE500] text-[#FFE500] cursor-pointer flex items-center justify-center transition-all"
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
            <span className="font-['Space_Grotesk'] text-[10px] sm:text-xs text-[#FFE500] uppercase leading-tight font-black tracking-wider">
              TRUCKWITHEASE ENTERPRISE
            </span>
            <span className="font-['Space_Grotesk'] text-xs sm:text-sm text-white font-bold uppercase tracking-wide truncate max-w-[150px] sm:max-w-[220px]">
              {getTabTitle(activeTab)}
            </span>
          </div>
        </div>

        {/* Right Telemetry & Streamlined Dropdown Commands */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Driver Alertness Index Pill */}
          {onOpenAlertnessModal && (
            <button
              onClick={onOpenAlertnessModal}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer transition-all hover:brightness-110 active:scale-95 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-wider ${
                alertnessScore < 75
                  ? 'bg-red-950/60 text-red-400 border-red-500/50 animate-pulse'
                  : 'bg-[#0A0F14] text-emerald-400 border-emerald-500/30'
              }`}
              title="Driver Alertness Index"
            >
              <span className="material-symbols-outlined text-[14px]">
                {alertnessScore < 75 ? 'bed' : 'psychology'}
              </span>
              <span>{alertnessScore}%</span>
            </button>
          )}

          {/* GPS Rate Pill */}
          <div
            className="hidden sm:flex items-center gap-1 bg-[#0A0F14] px-2 py-1 rounded-lg border border-[#1E2532] text-xs font-mono"
            title="ECM J1939 CAN-Bus 10Hz High-Fidelity Telemetry"
          >
            <span className="material-symbols-outlined text-[#FFE500] text-[14px] animate-pulse">
              satellite_alt
            </span>
            <span className="text-slate-300 font-bold">10Hz</span>
          </div>

          {/* Speed Indicator */}
          <div
            className="flex items-center gap-1 bg-[#0A0F14] px-2.5 py-1 rounded-lg border border-[#FFE500]/30 text-xs font-mono"
            title="Current J1939 Wheel Speed (MPH)"
          >
            <span className="material-symbols-outlined text-[#FFE500] text-[14px]">speed</span>
            <span className="font-['Space_Grotesk'] font-black text-[#FFE500] text-sm">
              {speed} <span className="text-[10px] text-slate-400 font-normal">MPH</span>
            </span>
          </div>

          {/* Primary Action Button: 1-Tap Roadside Officer Shield (Signature Yellow) */}
          {onOpenOfficerShield && (
            <button
              id="btn-dot-officer-shield"
              aria-label="DOT Roadside Officer Shield"
              onClick={onOpenOfficerShield}
              className="btn-tactical-yellow min-h-[38px] px-3 sm:px-4 flex items-center justify-center gap-1.5 rounded-xl cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 text-xs font-['Space_Grotesk'] font-black uppercase tracking-wider"
              title="1-Tap Roadside Inspection Shield: 8-Day RODS, DQF & DVIR (49 CFR § 390.31)"
            >
              <span className="material-symbols-outlined text-[18px]">local_police</span>
              <span>DOT SHIELD</span>
            </button>
          )}

          {/* MINIMIZED BUTTONS: CONSOLIDATED TACTICAL QUICK ACTIONS DROPDOWN */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="btn-cockpit-quick-actions"
              onClick={() => setIsToolsDropdownOpen(!isToolsDropdownOpen)}
              className={`min-h-[38px] px-3 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider ${
                isToolsDropdownOpen
                  ? 'bg-[#FFE500] text-black border-[#FFE500] shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'bg-[#0A0F14] hover:bg-[#121822] text-slate-200 hover:text-[#FFE500] border-[#FFE500]/30 hover:border-[#FFE500]'
              }`}
              title="Quick Cockpit Commands & Functions Dropdown"
            >
              <span className="material-symbols-outlined text-[18px]">widgets</span>
              <span className="hidden md:inline">TOOLS</span>
              <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
                {isToolsDropdownOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Tactical Dropdown Menu */}
            {isToolsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#05080E] border-2 border-[#FFE500]/60 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.95)] z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#1E2532] flex items-center justify-between">
                  <span className="text-[10px] font-['Space_Grotesk'] font-black uppercase tracking-wider text-[#FFE500]">
                    COCKPIT QUICK ACTIONS
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    DRIVER: {activeDriverName.split(' ')[0]}
                  </span>
                </div>

                {/* 1. Bluetooth ELD Gateway */}
                {onOpenBluetoothModal && (
                  <button
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onOpenBluetoothModal();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                        bluetooth
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                          Bluetooth ELD Gateway
                        </div>
                        <div className="text-[10px] text-slate-400">Azuga, Geotab &amp; GPSTab CAN-Bus</div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isBluetoothConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {isBluetoothConnected ? 'PAIRED' : 'STANDALONE'}
                    </span>
                  </button>
                )}

                {/* 2. ERoDS Tag-a-Long */}
                {onOpenErodsModal && (
                  <button
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onOpenErodsModal();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                        document_scanner
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                          FMCSA ERoDS Tag-a-Long
                        </div>
                        <div className="text-[10px] text-slate-400">Scan &amp; pair roadside paper records</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">READY</span>
                  </button>
                )}

                {/* 3. Voice Control HUD Toggle */}
                {onToggleVoice && (
                  <button
                    id="btn-hud-voice-control"
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onToggleVoice();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                        {isListening ? 'mic' : 'mic_none'}
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                          Voice Control HUD [V]
                        </div>
                        <div className="text-[10px] text-slate-400">Hands-free cab acoustic commands</div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isListening ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isListening ? 'LISTENING' : 'OFF'}
                    </span>
                  </button>
                )}

                {/* 4. Driver Portal & Roster Sheet */}
                {onOpenDriverPortal && (
                  <button
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onOpenDriverPortal('roster');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                        badge
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                          Driver Portal &amp; Roster
                        </div>
                        <div className="text-[10px] text-slate-400">Credentials, sign-in sheet &amp; modules</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-[#FFE500] font-bold">PORTAL</span>
                  </button>
                )}

                {/* 5. Return to Business Landing Page */}
                {onNavigateToTab && (
                  <button
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onNavigateToTab('landing');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                        storefront
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                          Business Landing Page
                        </div>
                        <div className="text-[10px] text-slate-400">Product overview, ROI &amp; pricing</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">VIEW</span>
                  </button>
                )}

                {/* 6. Driver Profile & CDL Credentials */}
                <button
                  id="btn-driver-profile"
                  onClick={() => {
                    setIsToolsDropdownOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#0A0F14] text-slate-200 hover:text-[#FFE500] flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-[#FFE500] group-hover:scale-110 transition-transform">
                      person
                    </span>
                    <div>
                      <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-white group-hover:text-[#FFE500]">
                        Driver Profile &amp; CDL
                      </div>
                      <div className="text-[10px] text-slate-400">{DRIVER_INFO.cdlNumber} (Illinois)</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">ACTIVE</span>
                </button>

                {/* 7. Emergency 911 / Roadside Hotline */}
                <div className="pt-1 border-t border-[#1E2532]">
                  <button
                    id="btn-emergency-hotline"
                    onClick={() => {
                      setIsToolsDropdownOpen(false);
                      onOpenEmergency();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-red-400 animate-bounce">
                        e911_emergency
                      </span>
                      <div>
                        <div className="font-['Space_Grotesk'] text-xs font-black uppercase tracking-wider text-red-200">
                          24/7 Emergency &amp; Roadside
                        </div>
                        <div className="text-[10px] text-red-300/70">Immediate police, wrecker &amp; medical</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-red-400 font-black">SOS</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
