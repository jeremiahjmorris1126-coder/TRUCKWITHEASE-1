import React, { useState } from 'react';
import { TabId } from '../../types';
import { TripPlannerScreen } from './TripPlannerScreen';
import { Radar54bScreen } from './Radar54bScreen';
import { DispatchEtaScreen } from './DispatchEtaScreen';
import { GoatScreen } from './GoatScreen';

interface RouteDispatchHubProps {
  initialSubTab?: 'planner' | 'weigh-scales' | 'dispatch' | 'clearance';
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToTab?: (tabId: TabId) => void;
  speed?: number;
}

export const RouteDispatchHub: React.FC<RouteDispatchHubProps> = ({
  initialSubTab = 'planner',
  onShowToast,
  onNavigateToTab,
  speed = 65,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'planner' | 'weigh-scales' | 'dispatch' | 'clearance'>(
    initialSubTab
  );

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto space-y-4">
      {/* UNIFIED SEGMENTED CONTROL BAR */}
      <div className="sticky top-16 z-30 bg-surface-container-lowest/95 backdrop-blur-md p-2 rounded-2xl border border-surface-container-high/60 shadow-xl">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-2 flex-1">
            <button
              onClick={() => setActiveSubTab('planner')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'planner'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">route</span>
              <span>Trip & Stops</span>
            </button>

            <button
              onClick={() => setActiveSubTab('weigh-scales')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'weigh-scales'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">radar</span>
              <span>Weigh Scales (54B)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('dispatch')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'dispatch'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">schedule_send</span>
              <span>Dispatch & Docks</span>
            </button>

            <button
              onClick={() => setActiveSubTab('clearance')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'clearance'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">height</span>
              <span>Low Clearance (G.O.A.T.)</span>
            </button>
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE MODULE */}
      <div className="w-full">
        {activeSubTab === 'planner' && (
          <TripPlannerScreen onShowToast={onShowToast} onNavigateToTab={onNavigateToTab} />
        )}
        {activeSubTab === 'weigh-scales' && (
          <Radar54bScreen onShowToast={onShowToast} speed={speed} />
        )}
        {activeSubTab === 'dispatch' && (
          <DispatchEtaScreen onShowToast={onShowToast} />
        )}
        {activeSubTab === 'clearance' && (
          <GoatScreen onShowToast={onShowToast} />
        )}
      </div>
    </div>
  );
};
