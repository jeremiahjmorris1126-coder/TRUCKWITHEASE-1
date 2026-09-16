import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VoiceControlReturn } from '../hooks/useVoiceControl';

interface VoiceCommandOverlayProps {
  voice: VoiceControlReturn;
}

const PRESET_COMMANDS = [
  { phrase: 'Show Inspection', icon: 'picture_as_pdf', color: 'text-primary' },
  { phrase: 'Emergency', icon: 'e911_emergency', color: 'text-error' },
  { phrase: 'Privacy Lock', icon: 'lock', color: 'text-yellow-400' },
  { phrase: 'Driver Profile', icon: 'person', color: 'text-blue-400' },
  { phrase: 'Radar 54B', icon: 'radar', color: 'text-emerald-400' },
  { phrase: 'HOS Clocks', icon: 'schedule', color: 'text-primary' },
  { phrase: 'Night HUD', icon: 'dashboard', color: 'text-on-surface' },
];

export const VoiceCommandOverlay: React.FC<VoiceCommandOverlayProps> = ({ voice }) => {
  const [manualInput, setManualInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      voice.simulateVoiceCommand(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <>
      {/* Floating Push-To-Talk / Voice Command HUD Trigger (Bottom-Right, above Bottom Nav) */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 pointer-events-auto">
        <AnimatePresence>
          {voice.feedbackMessage && !voice.isVoiceBarOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className="bg-surface-container-high/95 border border-primary/40 px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md max-w-xs text-right"
            >
              <span className="font-telemetry-label text-[10px] text-primary uppercase font-bold tracking-wider block">
                VOICE ACKNOWLEDGED
              </span>
              <span className="font-body-sm text-[11px] text-on-surface font-medium block truncate">
                {voice.feedbackMessage}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tactical Voice PTT Button */}
        <div className="flex items-center gap-2">
          {/* Quick Keyboard Hint Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 border border-surface-container-high shadow-lg text-[10px] font-mono text-outline">
            <span>PRESS</span>
            <kbd className="px-1 py-0.2 bg-surface-container-highest border border-outline/40 rounded text-primary font-bold">
              V
            </kbd>
            <span>VOICE</span>
            <span className="text-surface-container-highest">|</span>
            <kbd className="px-1 py-0.2 bg-surface-container-highest border border-outline/40 rounded text-primary font-bold">
              I
            </kbd>
            <span>INSPECT</span>
            <span className="text-surface-container-highest">|</span>
            <kbd className="px-1 py-0.2 bg-surface-container-highest border border-outline/40 rounded text-error font-bold">
              E
            </kbd>
            <span>E911</span>
          </div>

          <button
            onClick={() => {
              if (voice.isVoiceBarOpen) {
                voice.toggleListening();
              } else {
                voice.setIsVoiceBarOpen(true);
                voice.startListening();
              }
            }}
            aria-label="Toggle Voice Control HUD"
            className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-2xl transition-all cursor-pointer ${
              voice.isListening
                ? 'bg-error text-on-error border-2 border-white scale-105 shadow-[0_0_24px_rgba(239,68,68,0.6)]'
                : 'bg-surface-container-high hover:bg-surface-container-highest text-primary border border-primary/50 hover:border-primary'
            }`}
            title="Voice Control [V]: Say 'Show Inspection' or 'Emergency'"
          >
            {/* Pulsing listening ripple */}
            {voice.isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-error/40 animate-ping" />
                <span className="absolute -inset-1.5 rounded-full border border-error/60 animate-pulse" />
              </>
            )}

            <span
              className={`material-symbols-outlined text-[24px] z-10 ${
                voice.isListening ? 'animate-pulse' : ''
              }`}
            >
              {voice.isListening ? 'mic' : 'mic_none'}
            </span>
          </button>
        </div>
      </div>

      {/* Expandable Night HUD Voice Control Console */}
      <AnimatePresence>
        {voice.isVoiceBarOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-[420px] z-50 bg-[#0e0f12]/95 backdrop-blur-xl border border-primary/40 rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {/* Header / Acoustic Visualizer Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest/80 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    voice.isListening ? 'bg-error animate-ping' : 'bg-primary'
                  }`}
                />
                <div className="flex flex-col">
                  <span className="font-label-caps text-[11px] text-primary uppercase font-bold tracking-wider">
                    VOICE HUD RECOGNITION
                  </span>
                  <span className="font-mono text-[9px] text-outline">
                    {voice.isListening
                      ? 'LISTENING TO ACOUSTIC CAN-BUS SENSORS'
                      : 'STANDBY // READY FOR SPOKEN INSTRUCTION'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 rounded text-outline hover:text-white"
                  title={isMinimized ? 'Expand' : 'Collapse'}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isMinimized ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    voice.setIsVoiceBarOpen(false);
                    voice.stopListening();
                  }}
                  className="p-1 rounded text-outline hover:text-white"
                  title="Close Voice HUD"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="p-4 flex flex-col gap-3">
                {/* Simulated Audio Wave Visualizer when listening */}
                <div className="flex items-center justify-center gap-1 h-8 bg-black/40 rounded-xl px-4 border border-white/5 overflow-hidden">
                  {voice.isListening ? (
                    <div className="flex items-center gap-1.5 w-full justify-center">
                      <span className="h-4 w-1 bg-red-500 rounded-full animate-pulse" />
                      <span className="h-6 w-1 bg-yellow-400 rounded-full animate-pulse delay-75" />
                      <span className="h-3 w-1 bg-emerald-400 rounded-full animate-pulse delay-100" />
                      <span className="h-7 w-1 bg-primary rounded-full animate-pulse delay-150" />
                      <span className="h-5 w-1 bg-red-400 rounded-full animate-pulse delay-200" />
                      <span className="h-3 w-1 bg-yellow-300 rounded-full animate-pulse delay-75" />
                      <span className="h-6 w-1 bg-primary rounded-full animate-pulse delay-300" />
                      <span className="font-telemetry-label text-[10px] text-on-surface font-semibold ml-2">
                        SAY &quot;SHOW INSPECTION&quot; OR &quot;EMERGENCY&quot;
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-[10px] text-outline">
                        MICROPHONE INACTIVE
                      </span>
                      <button
                        onClick={voice.startListening}
                        className="flex items-center gap-1 font-telemetry-label text-[10px] text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-[14px]">mic</span>
                        START MIC
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Transcript / Recognized Command Display */}
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/80 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                      HEARD SPEECH TRANSCRIBED
                    </span>
                    {voice.lastCommand && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-bold uppercase">
                        MATCH: {voice.lastCommand}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[12px] text-on-surface min-h-[20px] italic">
                    {voice.transcript ? `&quot;${voice.transcript}&quot;` : 'Waiting for voice input...'}
                  </p>
                  {voice.feedbackMessage && (
                    <div className="mt-1 pt-1.5 border-t border-white/5 flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>{voice.feedbackMessage}</span>
                    </div>
                  )}
                </div>

                {/* Preset Interactive Voice Chips (Instant Click Simulation) */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-telemetry-label text-[9px] text-outline uppercase tracking-wider">
                    SIMULATE SPOKEN PHRASE (ONE-TOUCH TEST):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COMMANDS.map((cmd) => (
                      <button
                        key={cmd.phrase}
                        onClick={() => voice.simulateVoiceCommand(cmd.phrase)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest hover:border-primary/40 text-[11px] font-mono transition-all active:scale-95"
                      >
                        <span
                          className={`material-symbols-outlined text-[14px] ${cmd.color}`}
                        >
                          {cmd.icon}
                        </span>
                        <span>&quot;{cmd.phrase}&quot;</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Text Simulation Input Field */}
                <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Type spoken phrase (e.g. show inspection)..."
                    className="flex-1 bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-1.5 text-[12px] font-mono text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-transform"
                  >
                    SAY
                  </button>
                </form>

                {/* Keyboard Shortcuts Help */}
                <div className="flex items-center justify-between text-[9px] font-mono text-outline/80 pt-1 border-t border-white/5">
                  <span>HOTKEYS: [I] INSPECT • [E] E911 • [V] MIC • [L] LOCK</span>
                  <span>ESC TO DISMISS</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
