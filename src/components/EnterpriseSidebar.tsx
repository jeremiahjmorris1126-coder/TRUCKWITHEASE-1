import React from 'react';
import { TabId } from '../types';
import { DRIVER_INFO, CARRIER_INFO } from '../data/mockData';

interface EnterpriseSidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  speed: number;
  alertnessScore: number;
  isListening: boolean;
  onToggleVoice: () => void;
  onOpenEmergency: () => void;
  onOpenProfile: () => void;
  onOpenAlertnessModal: () => void;
  onOpenPrivacyLock: () => void;
  onOpenPdfModal: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  enabledModules?: Record<TabId, boolean>;
  onOpenCustomizer?: () => void;
}

interface CommandMenuItem {
  id: TabId;
  label: string;
  sublabel: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
}

const COMMAND_MENU_ITEMS: CommandMenuItem[] = [
  {
    id: 'master-sync',
    label: 'EVERYDAY SYNC',
    sublabel: 'Master Fleet Control',
    icon: 'stars',
    badge: 'UNIFIED',
    badgeColor: 'bg-primary/20 text-primary border-primary/40',
  },
  {
    id: 'night-hud',
    label: 'NIGHT HUD',
    sublabel: 'Driver In-Cab Cockpit',
    icon: 'dashboard',
    badge: 'LIVE',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  },
  {
    id: 'dispatch-eta',
    label: 'DISPATCH ETA',
    sublabel: 'Google Maps Fleet & Slots',
    icon: 'schedule_send',
    badge: 'MAP',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
  },
  {
    id: 'vault',
    label: 'SEC. VAULT',
    sublabel: 'HSM Ledger & DVIR',
    icon: 'lock',
    badge: 'FIPS',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  {
    id: 'fleet-expenses',
    label: 'INVOICES & EXPENSES',
    sublabel: 'Ledger & Receipts',
    icon: 'receipt_long',
    badge: 'NEW',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  },
  {
    id: 'hos-clocks',
    label: 'HOS CLOCKS',
    sublabel: '70h / 8-Day Duty Cycle',
    icon: 'timer',
  },
  {
    id: 'radar-54b',
    label: 'RADAR 54B',
    sublabel: 'Collision Avoidance',
    icon: 'radar',
  },
  {
    id: 'the-g-o-a-t-',
    label: 'THE G.O.A.T.',
    sublabel: 'Profitability Load Board',
    icon: 'alt_route',
  },
  {
    id: 'haptics',
    label: 'HAPTICS',
    sublabel: 'Steering Wheel Advisory',
    icon: 'vibration',
  },
  {
    id: 'ecosystem',
    label: 'TRUST HUB',
    sublabel: 'Carrier & Broker Vetting',
    icon: 'hub',
  },
  {
    id: 'telemetry',
    label: 'TELEMETRY',
    sublabel: '10Hz ECM CAN-Bus',
    icon: 'memory',
  },
  {
    id: 'quantum-index',
    label: 'PREDICTIVE INDEX',
    sublabel: 'Adaptive Mechanics & Fleet Physics',
    icon: 'auto_awesome',
    badge: 'NEW',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
];

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  activeTab,
  onSelectTab,
  speed,
  alertnessScore,
  isListening,
  onToggleVoice,
  onOpenEmergency,
  onOpenProfile,
  onOpenAlertnessModal,
  onOpenPrivacyLock,
  onOpenPdfModal,
  isOpenMobile,
  onCloseMobile,
  enabledModules,
  onOpenCustomizer,
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden animate-fade-in"
        />
      )}

      {/* Enterprise Side Navigation & Commands Console */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-surface-container-lowest border-r border-surface-container-high/60 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header: Enterprise Brand & Driver Card */}
        <div className="p-4 border-b border-surface-container-high space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                alt="TruckWithEase Logo"
                className="h-8 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRDd4aV-S_c-pzVwdc-nBwER0x2C87d731vYbRse210GKfcJCaJUQvdkv8CioPWe53TcOKkYaRnjgAAsnfGEMgdEPhm2zYVDRpRNv7Za2w4AIfrVVQwdLrNZJhtrXY9Av1h3PEThYJuRHPdjpF8m31HHfVCMUbDMLl7gA3RMjbKCVNcN_dL7a83_xH9r_PNGjW07H2ZGmBHy_BrmJ8z3ocUn_SEgYFO38wjtZjj2Up858SertqcEJW"
              />
              <div>
                <span className="font-label-caps text-[12px] text-primary uppercase font-bold tracking-widest block leading-none">
                  TRUCKWITHEASE
                </span>
                <span className="text-[10px] text-outline font-mono block mt-0.5">
                  ENTERPRISE FLEET COMMAND
                </span>
              </div>
            </div>

            {/* Close button for mobile */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Active Driver Profile Widget */}
          <div
            onClick={onOpenProfile}
            className="p-2.5 rounded-xl bg-surface-container border border-surface-container-high/80 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between"
            title="View Driver CDL Credentials & Profile"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-[12px]">
                JV
              </div>
              <div>
                <span className="font-bold text-[12px] text-on-surface block leading-tight">
                  {DRIVER_INFO.name}
                </span>
                <span className="text-[9px] text-outline font-mono block">
                  USDOT #{CARRIER_INFO.usdot} &bull; TRK-904
                </span>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-[12px] font-bold text-primary block">{speed} MPH</span>
              <span className="text-[8px] text-emerald-400 block font-bold">ECM 10Hz</span>
            </div>
          </div>
        </div>

        {/* Middle Scrollable Section: All Enterprise Navigation Tabs */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-mono font-bold text-outline uppercase tracking-wider">
              ENTERPRISE COMMAND MODULES
            </span>
            {onOpenCustomizer && (
              <button
                onClick={onOpenCustomizer}
                className="text-[9px] font-mono text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                title="Customize App Functions & Fleet Settings"
              >
                <span className="material-symbols-outlined text-[12px]">tune</span>
                <span>CUSTOMIZE</span>
              </button>
            )}
          </div>

          {COMMAND_MENU_ITEMS.filter((item) => enabledModules ? enabledModules[item.id] !== false : true).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                  isActive
                    ? 'bg-primary text-on-primary font-bold shadow-lg scale-[1.02]'
                    : 'bg-surface-container/40 hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isActive ? 'text-on-primary' : 'text-primary'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="truncate min-w-0">
                    <span className="font-label-caps text-[11px] block uppercase truncate leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono truncate block ${
                        isActive ? 'text-on-primary/80' : 'text-outline'
                      }`}
                    >
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border shrink-0 ${
                      isActive ? 'bg-on-primary/20 text-on-primary border-on-primary/40' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Section: Side Commands Quick Actions */}
        <div className="p-3 border-t border-surface-container-high bg-surface-container-lowest space-y-2">
          <div className="px-2 text-[10px] font-mono font-bold text-outline uppercase tracking-wider flex items-center justify-between">
            <span>SIDE COMMAND ACTIONS</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* Voice Control Side Command */}
            <button
              onClick={onToggleVoice}
              className={`p-2 rounded-lg text-[10px] font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                isListening
                  ? 'bg-error text-on-error border-error animate-pulse'
                  : 'bg-surface-container text-primary border-primary/30 hover:bg-surface-container-high'
              }`}
              title="Voice Command Recognition"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
              <span>{isListening ? 'Listening...' : 'Voice Command'}</span>
            </button>

            {/* Driver Alertness Score Side Command */}
            <button
              onClick={onOpenAlertnessModal}
              className={`p-2 rounded-lg text-[10px] font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                alertnessScore < 75
                  ? 'bg-error/20 text-error border-error/50 animate-pulse'
                  : 'bg-surface-container text-emerald-400 border-surface-container-high hover:bg-surface-container-high'
              }`}
              title="Driver Alertness Index & Advisory"
            >
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              <span>{alertnessScore}% Alert</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {/* Roadside Audit Officer Shield */}
            <button
              onClick={onOpenPrivacyLock}
              className="p-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-[10px] font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Lock Officer Shield Privacy Mode"
            >
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Audit Shield</span>
            </button>

            {/* Print Daily DVIR Report Direct Command */}
            <button
              onClick={() => {
                onOpenPdfModal();
                setTimeout(() => window.print(), 350);
              }}
              className="p-2 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 text-[10px] font-mono font-bold uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
              title="Print Daily DVIR & Log Report"
            >
              <span className="material-symbols-outlined text-[14px]">print</span>
              <span>Print DVIR</span>
            </button>
          </div>

          {/* Emergency SOS Command Button */}
          <button
            onClick={onOpenEmergency}
            className="w-full p-2.5 rounded-xl bg-error text-on-error font-label-caps text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">e911_emergency</span>
            <span>24/7 E911 Emergency SOS</span>
          </button>
        </div>
      </aside>
    </>
  );
};
