import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/firebaseClientAuth';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
  onTriggerAction?: (msg: string) => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onTriggerAction,
}) => {
  const [driverProfile, setDriverProfile] = useState<{
    name?: string;
    phone?: string;
    carrierName?: string;
    usdotNumber?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    authenticatedFetch('/api/driver/profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setDriverProfile(data.profile);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = (label: string, icon: string) => {
    if (onShowToast) onShowToast(label, icon);
    if (onTriggerAction) onTriggerAction(label);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container border-2 border-error/60 rounded-xl shadow-[0_0_40px_rgba(255,229,0,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-error/20 p-4 border-b border-error/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error text-white flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined font-bold">emergency</span>
            </div>
            <div>
              <h2 className="font-['Space_Grotesk'] text-lg font-bold text-white uppercase tracking-wider">
                Emergency Assistance
              </h2>
              <p className="text-xs font-mono text-error">
                IMMEDIATE ROADSIDE &amp; DISPATCH SUPPORT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-white p-1.5 rounded-lg hover:bg-surface-container-high transition cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          <div className="bg-surface-container-lowest p-3.5 rounded-lg border border-surface-container-high text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">DRIVER PROFILE:</span>
              <span className="text-white font-bold">
                {driverProfile?.name || 'Not signed in'}
              </span>
            </div>
            {driverProfile?.carrierName && (
              <div className="flex justify-between">
                <span className="text-on-surface-variant">CARRIER:</span>
                <span className="text-emerald-400">
                  {driverProfile.carrierName}
                  {driverProfile.usdotNumber ? ` (USDOT #${driverProfile.usdotNumber})` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {driverProfile?.phone ? (
              <a
                href={`tel:${driverProfile.phone}`}
                onClick={() =>
                  handleAction(
                    `Calling Carrier Dispatch (${driverProfile.phone})...`,
                    'phone_in_talk'
                  )
                }
                className="w-full py-3.5 px-4 bg-error hover:bg-red-600 text-white font-['Space_Grotesk'] font-bold rounded-lg flex items-center justify-between shadow-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">phone_in_talk</span>
                  <div className="text-left">
                    <div className="text-sm uppercase tracking-wider">Call 24/7 Fleet Dispatch</div>
                    <div className="text-[11px] font-mono opacity-80">{driverProfile.phone}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </a>
            ) : (
              <div className="w-full py-3 px-4 bg-surface-container-high text-on-surface-variant font-mono text-xs rounded-lg border border-slate-700">
                Sign in and add a carrier dispatch phone number in your Driver Profile to enable 1-click dispatch calling.
              </div>
            )}

            <button
              onClick={() =>
                handleAction(
                  'Roadside Breakdown & Tow Request Dispatched',
                  'car_repair'
                )
              }
              className="w-full py-3.5 px-4 bg-surface-container-high hover:bg-surface-container-highest text-white font-['Space_Grotesk'] font-bold rounded-lg flex items-center justify-between border border-amber-500/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-400">build_circle</span>
                <div className="text-left">
                  <div className="text-sm uppercase tracking-wider">Heavy-Duty Tow &amp; Repair</div>
                  <div className="text-[11px] font-mono text-on-surface-variant">
                    Request roadside service
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>

            <a
              href="tel:911"
              className="w-full py-3 px-4 bg-surface-container-low hover:bg-surface-container-high text-amber-300 font-['Space_Grotesk'] font-bold rounded-lg flex items-center justify-between border border-surface-container-high transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error">local_police</span>
                <div className="text-left">
                  <div className="text-sm uppercase tracking-wider">Emergency 911</div>
                  <div className="text-[11px] font-mono text-on-surface-variant">
                    Dial 911 immediately for highway emergencies
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-surface-container-lowest border-t border-surface-container-high flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-surface-container-high text-xs font-mono text-on-surface-variant hover:text-white transition cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
