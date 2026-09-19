import React from 'react';
import { HudVisionProfile } from '../types';

interface HudVisionToggleProps {
  currentProfile: HudVisionProfile;
  onProfileChange: (profile: HudVisionProfile) => void;
  className?: string;
}

interface ProfileMetadata {
  id: HudVisionProfile;
  label: string;
  badge: string;
  icon: string;
  desc: string;
  accentColor: string;
  borderColor: string;
  activeBg: string;
}

export const VISION_PROFILES: ProfileMetadata[] = [
  {
    id: 'HIGH_CONTRAST',
    label: 'High Contrast',
    badge: 'Glare & Fog Filter',
    icon: 'contrast',
    desc: 'Deep jet blacks, neon amber accents & max legible contrast for direct sunlight glare or dense night fog.',
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-400',
    activeBg: 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
  },
  {
    id: 'MINIMALIST',
    label: 'Minimalist',
    badge: 'Interstate Cruising',
    icon: 'speed',
    desc: 'Distraction-free heads-up display. Jumbo speedometer, drive clock countdown & essential safety alerts.',
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-400',
    activeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]',
  },
  {
    id: 'ROUTE_FOCUSED',
    label: 'Route Focused',
    badge: 'Corridor & Radar',
    icon: 'alt_route',
    desc: 'Prioritizes highway corridor, upcoming weigh bypasses, real-time severe weather radar & diesel stops.',
    accentColor: 'text-sky-400',
    borderColor: 'border-sky-400',
    activeBg: 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]',
  },
];

export const HudVisionToggle: React.FC<HudVisionToggleProps> = ({
  currentProfile,
  onProfileChange,
  className = '',
}) => {
  const currentMeta = VISION_PROFILES.find((p) => p.id === currentProfile) || VISION_PROFILES[0];

  const handleCycleProfile = () => {
    const currentIndex = VISION_PROFILES.findIndex((p) => p.id === currentProfile);
    const nextIndex = (currentIndex + 1) % VISION_PROFILES.length;
    onProfileChange(VISION_PROFILES[nextIndex].id);
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 font-mono ${
        currentProfile === 'HIGH_CONTRAST'
          ? 'bg-black/95 border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
          : currentProfile === 'MINIMALIST'
          ? 'bg-surface-container-lowest border-emerald-500/40 shadow-md'
          : 'bg-surface-container-low border-sky-500/40 shadow-md'
      } p-2.5 sm:p-3 space-y-2 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* LEFT: TITLE & CYCLE BUTTON */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCycleProfile}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold uppercase transition-all active:scale-95 cursor-pointer ${
              currentProfile === 'HIGH_CONTRAST'
                ? 'bg-amber-500 text-black border-amber-300 hover:bg-amber-400'
                : currentProfile === 'MINIMALIST'
                ? 'bg-emerald-500 text-black border-emerald-300 hover:bg-emerald-400'
                : 'bg-sky-500 text-black border-sky-300 hover:bg-sky-400'
            }`}
            title="Cycle vision overlay profile (Hotkey: [O])"
          >
            <span className="material-symbols-outlined text-[16px] animate-spin-slow">
              visibility
            </span>
            <span>Vision Toggle</span>
            <span className="text-[9px] opacity-80 border-l border-black/30 pl-1 ml-0.5">
              [O]
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-outline uppercase font-bold hidden sm:inline">
              Active Profile:
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                currentMeta.activeBg
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {currentMeta.icon}
              </span>
              <span>{currentMeta.label}</span>
            </span>
          </div>
        </div>

        {/* RIGHT: PROFILE SELECTOR TABS */}
        <div className="flex items-center gap-1 bg-surface-container-lowest/80 p-1 rounded-xl border border-surface-container-high/80 overflow-x-auto">
          {VISION_PROFILES.map((profile) => {
            const isActive = currentProfile === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onProfileChange(profile.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? profile.activeBg
                    : 'text-outline hover:text-white hover:bg-surface-container/60 border border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {profile.icon}
                </span>
                <span>{profile.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUICK STATUS TICKER & CONTEXT DESCRIPTION */}
      <div className="flex items-center justify-between text-[9px] pt-1 border-t border-surface-container-high/50 text-outline">
        <div className="flex items-center gap-2 truncate">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="truncate">{currentMeta.desc}</span>
        </div>
        <span className="hidden md:inline text-[9px] opacity-75 shrink-0 ml-2">
          1-Tap cycle anytime while driving • Zero screen departure
        </span>
      </div>
    </div>
  );
};
