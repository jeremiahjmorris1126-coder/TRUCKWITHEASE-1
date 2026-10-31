/**
 * TruckWithEase // Tactical Cockpit HUD Toast Notification
 *
 * Displays high-contrast tactical notifications across the cockpit.
 * Supports typed variants: 'success', 'warning', 'error', 'info'.
 * Conforms to workspace rules: Deep Obsidian surface, Safety Yellow highlights,
 * Emerald verification pills, and Ruby critical hazard alerts.
 */

import React from 'react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  message: string | null;
  icon?: string;
  variant?: ToastVariant;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  icon = 'verified_user',
  variant = 'success',
  onClose,
}) => {
  if (!message) return null;

  // Determine variant styling
  let containerBorder = 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
  let iconColor = 'text-emerald-400';
  let badgeText = 'VERIFIED';
  let badgeBg = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';

  if (variant === 'error') {
    containerBorder = 'border-[#EF4444] shadow-[0_0_25px_rgba(239,68,68,0.4)]';
    iconColor = 'text-[#EF4444]';
    badgeText = 'CRITICAL FAULT';
    badgeBg = 'bg-red-950/80 text-red-300 border-[#EF4444]/60';
  } else if (variant === 'warning') {
    containerBorder = 'border-[#FFE500] shadow-[0_0_20px_rgba(255,229,0,0.35)]';
    iconColor = 'text-[#FFE500]';
    badgeText = 'ADVISORY';
    badgeBg = 'bg-yellow-950/80 text-yellow-300 border-[#FFE500]/50';
  } else if (variant === 'info') {
    containerBorder = 'border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]';
    iconColor = 'text-cyan-400';
    badgeText = 'DISPATCH';
    badgeBg = 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40';
  }

  return (
    <div
      id="hud-toast"
      role="alert"
      aria-live="assertive"
      className={`fixed top-16 left-4 right-4 max-w-lg mx-auto z-50 transition-all duration-300 flex items-center justify-between p-3.5 rounded-xl bg-[#0A0F14]/95 backdrop-blur-md border ${containerBorder} animate-in fade-in slide-in-from-top-4`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span className={`material-symbols-outlined ${iconColor} text-[22px] shrink-0`}>
          {icon}
        </span>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded border ${badgeBg}`}>
              {badgeText}
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-white tracking-wide truncate">
            {message}
          </span>
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 ml-2 cursor-pointer transition-colors"
          aria-label="Dismiss toast"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
};
