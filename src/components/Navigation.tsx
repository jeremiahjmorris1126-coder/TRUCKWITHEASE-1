import React from 'react';
import { TabId } from '../types';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

interface NavGroup {
  id: TabId;
  label: string;
  icon: string;
  sublabel: string;
  matches: TabId[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'night-hud',
    label: 'COCKPIT',
    sublabel: 'HUD & Radar',
    icon: 'dashboard',
    matches: ['night-hud', 'telemetry', 'haptics'],
  },
  {
    id: 'hos-clocks',
    label: 'HOS & AUDIT',
    sublabel: 'Clocks & Inspection',
    icon: 'timer',
    matches: ['hos-clocks'],
  },
  {
    id: 'trip-planner',
    label: 'ROUTE & DISPATCH',
    sublabel: 'Stops, Scales & Docks',
    icon: 'route',
    matches: ['trip-planner', 'radar-54b', 'dispatch-eta', 'the-g-o-a-t-'],
  },
  {
    id: 'fleet-expenses',
    label: 'FLEET & VAULT',
    sublabel: 'Invoices, Trust & Sync',
    icon: 'receipt_long',
    matches: ['fleet-expenses', 'vault', 'ecosystem', 'master-sync', 'quantum-index'],
  },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.85)] border-t border-surface-container-low">
      <div className="max-w-4xl mx-auto flex items-center justify-between h-20 px-3 sm:px-6 gap-2">
        {NAV_GROUPS.map((group) => {
          const isActive = group.matches.includes(activeTab);
          return (
            <button
              key={group.id}
              id={`nav-tab-${group.id}`}
              onClick={() => onSelectTab(group.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-2 px-2 flex-1 transition-all rounded-xl cursor-pointer ${
                isActive
                  ? 'text-primary bg-primary/15 border border-primary/40 shadow-inner'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/30 border border-transparent'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] sm:text-[24px] ${
                  isActive ? 'scale-110 font-bold text-primary' : 'text-outline'
                }`}
              >
                {group.icon}
              </span>
              <span
                className={`font-label-caps text-[10px] sm:text-[11px] tracking-wider uppercase text-center truncate w-full ${
                  isActive ? 'font-bold text-primary' : 'text-outline'
                }`}
              >
                {group.label}
              </span>
              <span className="hidden sm:block text-[8px] text-outline/70 font-mono tracking-tight -mt-0.5">
                {group.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
