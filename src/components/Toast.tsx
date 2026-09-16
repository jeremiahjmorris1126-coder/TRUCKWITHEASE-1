import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = 'verified_user' }) => {
  if (!message) return null;

  return (
    <div
      id="hud-toast"
      role="alert"
      className="fixed top-20 left-4 right-4 max-w-md mx-auto z-50 transition-all duration-300 flex items-center justify-between p-space-sm rounded-lg bg-surface-container-highest shadow-2xl text-on-surface border border-surface-container-high animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-center gap-space-sm">
        <span className="material-symbols-outlined text-primary text-[20px]">
          {icon}
        </span>
        <span className="font-telemetry-label text-telemetry-label text-on-surface tracking-wider">
          {message}
        </span>
      </div>
      <span className="material-symbols-outlined text-outline text-[16px]">
        done
      </span>
    </div>
  );
};
