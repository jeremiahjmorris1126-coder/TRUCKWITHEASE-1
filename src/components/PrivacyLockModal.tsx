import React, { useState } from 'react';

interface PrivacyLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
}

export const PrivacyLockModal: React.FC<PrivacyLockModalProps> = ({
  isOpen,
  onUnlock,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [errorShake, setErrorShake] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (enteredPin.length < 4) {
      const newPin = enteredPin + digit;
      setEnteredPin(newPin);
      if (newPin.length === 4) {
        // Any 4 digits or correct PIN exits
        setTimeout(() => {
          setEnteredPin('');
          onUnlock();
        }, 300);
      }
    }
  };

  const handleClear = () => {
    setEnteredPin('');
  };

  const handleBiometricExit = () => {
    onUnlock();
  };

  return (
    <div
      id="privacy-lock-modal"
      className="fixed inset-0 z-50 bg-surface-container-lowest/95 backdrop-blur-2xl flex flex-col items-center justify-center p-space-lg transition-opacity duration-200"
    >
      <div className="w-full max-w-sm bg-surface-container p-space-lg rounded-xl flex flex-col items-center text-center shadow-2xl space-y-space-base border border-surface-container-high">
        {/* Pulsing Shield Icon */}
        <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center text-primary animate-pulse">
          <span className="material-symbols-outlined text-[36px]">lock</span>
        </div>

        {/* Shield Info */}
        <div className="flex flex-col space-y-space-2xs">
          <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase">
            Officer Privacy Shield
          </span>
          <span className="font-headline-sm text-headline-sm text-on-surface">
            Inspection Mode Active
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            All fleet earnings, driver SMS, personal notes, and telemetry controls
            are locked. Present this screen directly to DOT enforcement.
          </p>
        </div>

        {/* PIN Display */}
        <div
          className={`w-full bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-2xs items-center ${
            errorShake ? 'animate-bounce' : ''
          }`}
        >
          <span className="font-telemetry-label text-telemetry-label text-outline uppercase">
            Passcode To Exit Lock
          </span>
          <div className="flex items-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => (
              <span
                key={idx}
                className={`w-3 h-3 rounded-full transition-all ${
                  enteredPin.length > idx
                    ? 'bg-primary scale-125 shadow-[0_0_8px_#f2ca50]'
                    : 'bg-surface-container-highest border border-outline'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '⌫'].map(
            (key) => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'CLR') handleClear();
                  else if (key === '⌫') setEnteredPin((p) => p.slice(0, -1));
                  else handleDigit(key);
                }}
                className="h-11 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high active:bg-primary active:text-on-primary font-telemetry-label text-[13px] font-bold transition-colors cursor-pointer flex items-center justify-center border border-surface-container-high"
              >
                {key}
              </button>
            )
          )}
        </div>

        {/* Exit Button */}
        <button
          id="btn-unlock-privacy"
          onClick={handleBiometricExit}
          className="w-full py-space-sm bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface font-label-caps text-label-caps uppercase tracking-wider rounded-lg active:scale-95 transition-all cursor-pointer border border-outline/30 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">
            fingerprint
          </span>
          Driver Biometric / PIN Exit
        </button>
      </div>
    </div>
  );
};
