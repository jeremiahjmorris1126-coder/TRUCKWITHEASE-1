import React, { useState } from 'react';
import { TabId } from '../../types';
import { TripPlannerScreen } from './TripPlannerScreen';
import { Radar54bScreen } from './Radar54bScreen';
import { DispatchEtaScreen } from './DispatchEtaScreen';
import { MasterMechanicScreen } from './MasterMechanicScreen';
import { TruckParkingScreen } from './TruckParkingScreen';
import { WeighBypassScreen } from './WeighBypassScreen';
import { ENABLE_RADAR_54B } from '../../config/featureFlags';

type HubSubTab = 'planner' | 'parking' | 'bypass' | 'weigh-scales' | 'dispatch' | 'clearance';

interface RouteDispatchHubProps {
  initialSubTab?: HubSubTab;
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
  const [activeSubTab, setActiveSubTab] = useState<HubSubTab>(
    initialSubTab === 'weigh-scales' && !ENABLE_RADAR_54B ? 'planner' : initialSubTab
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
              onClick={() => setActiveSubTab('parking')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'parking'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">local_parking</span>
              <span>Parking</span>
            </button>
            <button
              onClick={() => setActiveSubTab('bypass')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'bypass'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">scale</span>
              <span>Scale Bypass</span>
            </button>
            {ENABLE_RADAR_54B && (
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
            )}

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
              <span className="material-symbols-outlined text-[16px]">build_circle</span>
              <span>The Master Mechanic</span>
            </button>
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE MODULE */}
      <div className="w-full">
        {activeSubTab === 'planner' && (
          <TripPlannerScreen onShowToast={onShowToast} onNavigateToTab={onNavigateToTab} />
        )}
        {activeSubTab === 'parking' && <TruckParkingScreen />}
        {activeSubTab === 'bypass' && <WeighBypassScreen />}
        {ENABLE_RADAR_54B && activeSubTab === 'weigh-scales' && (
          <Radar54bScreen onShowToast={onShowToast} speed={speed} />
        )}
        {activeSubTab === 'dispatch' && (
          <DispatchEtaScreen onShowToast={onShowToast} />
        )}
        {activeSubTab === 'clearance' && (
          <MasterMechanicScreen onShowToast={onShowToast} speed={speed} />
        )}
      </div>
    </div>
  );
};
