import React from 'react';
import { DriverAlertnessData } from '../types';

interface RestAreaAlertModalProps {
  isOpen: boolean;
  /** Kept for compatibility; the app cannot measure fatigue, so no score is shown. */
  alertnessData?: DriverAlertnessData;
  onClose: () => void;
  /** Clears the app's local tired-flag when the driver closes the prompt. */
  onResetAlertness?: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
  /** Opens the truck parking page (live counts where states publish them). */
  onFindParking?: () => void;
}

/**
 * Rest prompt.
 *
 * The app has no way to measure a driver's fatigue (screen-tap timing is not a
 * fatigue measure), so this makes no claims about alertness, shows no scores,
 * and offers no "test" that could clear a warning. It points the driver to
 * real parking and gets out of the way.
 */
export const RestAreaAlertModal: React.FC<RestAreaAlertModalProps> = ({ isOpen, onClose, onResetAlertness, onFindParking }) => {
  if (!isOpen) return null;

  const close = () => {
    onResetAlertness?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85" role="dialog" aria-modal="true" aria-labelledby="rest-title">
      <div className="w-full max-w-md rounded-2xl border-2 border-primary bg-black p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[32px]">bed</span>
          <h2 id="rest-title" className="text-primary text-lg font-black uppercase tracking-wide">
            Time for a break?
          </h2>
        </div>

        <p className="text-on-surface text-sm leading-relaxed">
          If you feel tired, pull over somewhere safe and rest. Only stop where truck parking is allowed.
        </p>

        <div className="flex flex-col gap-2">
          {onFindParking && (
            <button
              onClick={() => {
                close();
                onFindParking();
              }}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">local_parking</span>
              Find Truck Parking
            </button>
          )}
          <button
            onClick={close}
            className="w-full py-3 rounded-xl border border-primary/40 text-primary font-bold uppercase tracking-wider text-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
