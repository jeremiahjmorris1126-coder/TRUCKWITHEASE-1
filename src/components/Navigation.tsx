import React from 'react';
import { TabId } from '../types';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'night-hud', label: 'NIGHT HUD', icon: 'dashboard' },
  { id: 'hos-clocks', label: 'HOS CLOCKS', icon: 'timer' },
  { id: 'radar-54b', label: 'RADAR 54B', icon: 'radar' },
  { id: 'the-g-o-a-t-', label: 'THE G.O.A.T.', icon: 'alt_route' },
  { id: 'haptics', label: 'HAPTICS', icon: 'vibration' },
  { id: 'ecosystem', label: 'TRUST HUB', icon: 'hub' },
  { id: 'vault', label: 'SEC. VAULT', icon: 'lock' },
  { id: 'fleet-expenses', label: 'INVOICES', icon: 'receipt_long' },
  { id: 'telemetry', label: 'TELEMETRY', icon: 'memory' },
  { id: 'dispatch-eta', label: 'DISPATCH ETA', icon: 'schedule_send' },
  { id: 'master-sync', label: 'EVERYDAY SYNC', icon: 'stars' },
  { id: 'quantum-index', label: 'QUANTUM INDEX', icon: 'auto_awesome' },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.85)] border-t border-surface-container-low">
      <div className="max-w-5xl mx-auto flex justify-start md:justify-around items-center h-20 px-2 overflow-x-auto scrollbar-none gap-1 sm:gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[68px] sm:min-w-[76px] flex-1 py-1.5 px-1 transition-all rounded-xl cursor-pointer ${
                isActive
                  ? 'text-primary bg-primary/15 border border-primary/40 shadow-inner'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/30 border border-transparent'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] sm:text-[22px] ${
                  isActive ? 'scale-110 font-bold text-primary' : ''
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`font-label-caps text-[9px] sm:text-[10px] tracking-wider uppercase text-center truncate w-full ${
                  isActive ? 'font-bold text-primary' : 'text-outline'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
