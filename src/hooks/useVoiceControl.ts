import { useState, useEffect, useCallback, useRef } from 'react';
import { TabId } from '../types';

export interface VoiceControlOptions {
  onTriggerInspection: () => void;
  onTriggerEmergency: () => void;
  onTriggerPrivacyLock?: () => void;
  onTriggerProfile?: () => void;
  onSelectTab?: (tab: TabId) => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export interface VoiceControlReturn {
  isListening: boolean;
  transcript: string;
  lastCommand: string | null;
  feedbackMessage: string | null;
  speechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  simulateVoiceCommand: (phrase: string) => void;
  isVoiceBarOpen: boolean;
  setIsVoiceBarOpen: (open: boolean) => void;
}

// Audio tactical feedback generator using Web Audio API
const playTacticalChime = (type: 'listen' | 'recognized' | 'error') => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'listen') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'recognized') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // AudioContext autoplay restrictions or unsupported
  }
};

export const useVoiceControl = ({
  onTriggerInspection,
  onTriggerEmergency,
  onTriggerPrivacyLock,
  onTriggerProfile,
  onSelectTab,
  onShowToast,
}: VoiceControlOptions): VoiceControlReturn => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isVoiceBarOpen, setIsVoiceBarOpen] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const clearFeedbackTimer = () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  };

  const setTimedFeedback = (cmd: string, msg: string, icon = 'mic') => {
    clearFeedbackTimer();
    setLastCommand(cmd);
    setFeedbackMessage(msg);
    setIsVoiceBarOpen(true);
    playTacticalChime('recognized');
    onShowToast(`VOICE [${cmd}]: ${msg}`, icon);

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // Core Command Dispatcher
  const processVoicePhrase = useCallback(
    (rawPhrase: string) => {
      const phrase = rawPhrase.trim().toLowerCase();
      if (!phrase) return;

      setTranscript(rawPhrase);

      // 1. "Show Inspection" / Roadside PDF Modal
      if (
        phrase.includes('show inspection') ||
        phrase.includes('inspection') ||
        phrase.includes('view inspection') ||
        phrase.includes('roadside inspection') ||
        phrase.includes('show log') ||
        phrase.includes('show logs') ||
        phrase.includes('open pdf') ||
        phrase.includes('pdf modal') ||
        phrase.includes('fmcsa record')
      ) {
        setTimedFeedback(
          'SHOW INSPECTION',
          'TRIGGERING FMCSA ROADSIDE INSPECTION RECORD PDF',
          'picture_as_pdf'
        );
        onTriggerInspection();
        return;
      }

      // 2. "Emergency" / E911 Modal
      if (
        phrase.includes('emergency') ||
        phrase.includes('e911') ||
        phrase.includes('911') ||
        phrase.includes('sos') ||
        phrase.includes('mayday') ||
        phrase.includes('accident') ||
        phrase.includes('call police') ||
        phrase.includes('call 911')
      ) {
        setTimedFeedback(
          'EMERGENCY',
          'LAUNCHING 24/7 DOT DISPATCH & E911 ASSISTANCE',
          'e911_emergency'
        );
        onTriggerEmergency();
        return;
      }

      // 3. "Privacy Lock" / Officer Shield
      if (
        phrase.includes('privacy lock') ||
        phrase.includes('lock') ||
        phrase.includes('officer shield') ||
        phrase.includes('lock screen') ||
        phrase.includes('shield')
      ) {
        if (onTriggerPrivacyLock) {
          setTimedFeedback('PRIVACY LOCK', 'ACTIVATING OFFICER AUDIT SHIELD', 'lock');
          onTriggerPrivacyLock();
        }
        return;
      }

      // 4. "Driver Profile" / CDL Credentials
      if (
        phrase.includes('driver profile') ||
        phrase.includes('profile') ||
        phrase.includes('cdl') ||
        phrase.includes('credentials')
      ) {
        if (onTriggerProfile) {
          setTimedFeedback('DRIVER PROFILE', 'OPENING DRIVER CDL CREDENTIALS', 'person');
          onTriggerProfile();
        }
        return;
      }

      // 5. Screen Navigation Commands
      if (onSelectTab) {
        if (phrase.includes('night hud') || phrase.includes('hud') || phrase.includes('home')) {
          setTimedFeedback('NIGHT HUD', 'SWITCHING TO NIGHT COCKPIT HUD', 'dashboard');
          onSelectTab('night-hud');
          return;
        }
        if (phrase.includes('hos') || phrase.includes('clocks') || phrase.includes('hours of service')) {
          setTimedFeedback('HOS CLOCKS', 'SWITCHING TO 49 CFR § 395 CLOCKS', 'schedule');
          onSelectTab('hos-clocks');
          return;
        }
        if (phrase.includes('radar') || phrase.includes('54b') || phrase.includes('clearance')) {
          setTimedFeedback('RADAR 54B', 'SWITCHING TO HIGHWAY BRIDGE RADAR', 'radar');
          onSelectTab('radar-54b');
          return;
        }
        if (phrase.includes('goat') || phrase.includes('load board') || phrase.includes('freight')) {
          setTimedFeedback('THE G.O.A.T.', 'SWITCHING TO QUANTUM LOAD BOARD', 'alt_route');
          onSelectTab('the-g-o-a-t-');
          return;
        }
        if (phrase.includes('haptics') || phrase.includes('vibration')) {
          setTimedFeedback('HAPTICS', 'SWITCHING TO CAN-BUS HAPTIC TEST SUITE', 'vibration');
          onSelectTab('haptics');
          return;
        }
        if (phrase.includes('trust hub') || phrase.includes('ecosystem')) {
          setTimedFeedback('TRUST HUB', 'SWITCHING TO ECOSYSTEM TRUST HUB', 'hub');
          onSelectTab('ecosystem');
          return;
        }
        if (phrase.includes('vault') || phrase.includes('security vault')) {
          setTimedFeedback('SECURITY VAULT', 'SWITCHING TO CRYPTOGRAPHIC VAULT', 'lock');
          onSelectTab('vault');
          return;
        }
        if (phrase.includes('telemetry') || phrase.includes('diagnostics')) {
          setTimedFeedback('TELEMETRY', 'SWITCHING TO J1939 FLEET TELEMETRY', 'memory');
          onSelectTab('telemetry');
          return;
        }
      }

      // 6. HUD Vision Toggle Overlay Commands
      if (phrase.includes('high contrast') || phrase.includes('glare mode') || phrase.includes('contrast mode')) {
        localStorage.setItem('truck_hud_vision_profile', 'HIGH_CONTRAST');
        window.dispatchEvent(new CustomEvent('truck_vision_profile_changed', { detail: 'HIGH_CONTRAST' }));
        setTimedFeedback('VISION: HIGH CONTRAST', 'MAXIMUM OPTICAL GLARE & NIGHT FOG FILTER ENGAGED', 'contrast');
        onShowToast('VISION PROFILE: HIGH CONTRAST ACTIVATED', 'contrast');
        return;
      }
      if (phrase.includes('minimalist') || phrase.includes('cruise mode') || phrase.includes('simple hud') || phrase.includes('clean hud')) {
        localStorage.setItem('truck_hud_vision_profile', 'MINIMALIST');
        window.dispatchEvent(new CustomEvent('truck_vision_profile_changed', { detail: 'MINIMALIST' }));
        setTimedFeedback('VISION: MINIMALIST', 'DISTRACTION-FREE INTERSTATE CRUISE COCKPIT ENGAGED', 'speed');
        onShowToast('VISION PROFILE: MINIMALIST ACTIVATED', 'speed');
        return;
      }
      if (phrase.includes('route focused') || phrase.includes('route mode') || phrase.includes('corridor mode') || phrase.includes('radar mode')) {
        localStorage.setItem('truck_hud_vision_profile', 'ROUTE_FOCUSED');
        window.dispatchEvent(new CustomEvent('truck_vision_profile_changed', { detail: 'ROUTE_FOCUSED' }));
        setTimedFeedback('VISION: ROUTE FOCUSED', 'HIGHWAY CORRIDOR, WEIGH BYPASS & RADAR ENGAGED', 'alt_route');
        onShowToast('VISION PROFILE: ROUTE FOCUSED ACTIVATED', 'alt_route');
        return;
      }
      if (phrase.includes('vision toggle') || phrase.includes('cycle vision') || phrase.includes('cycle overlay') || phrase.includes('switch vision')) {
        window.dispatchEvent(new CustomEvent('truck_vision_profile_cycle'));
        setTimedFeedback('VISION TOGGLE', 'CYCLING HUD OVERLAY PROFILE', 'visibility');
        return;
      }

      // 7. Regional Weather Hazard Voice Commands
      if (
        phrase.includes('weather hazard') ||
        phrase.includes('weather alert') ||
        phrase.includes('fog alert') ||
        phrase.includes('wind alert') ||
        phrase.includes('ice alert') ||
        phrase.includes('road weather')
      ) {
        onSelectTab('night-hud');
        window.dispatchEvent(new CustomEvent('truck_open_weather_hazards'));
        setTimedFeedback(
          'REGIONAL HAZARDS',
          'POLLING NWS SEARCH GROUNDING FOR CURRENT LOCATION',
          'travel_explore'
        );
        onShowToast('POLLING NWS SEARCH GROUNDED HAZARDS FEED', 'travel_explore');
        return;
      }

      // Unrecognized phrase
      playTacticalChime('error');
      setTranscript(rawPhrase);
      setFeedbackMessage(`UNRECOGNIZED VOICE COMMAND: "${rawPhrase}". TRY "SHOW INSPECTION" OR "EMERGENCY".`);
      setIsVoiceBarOpen(true);
    },
    [
      onTriggerInspection,
      onTriggerEmergency,
      onTriggerPrivacyLock,
      onTriggerProfile,
      onSelectTab,
      onShowToast,
    ]
  );

  // Initialize Web Speech API if supported
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setIsVoiceBarOpen(true);
          playTacticalChime('listen');
        };

        recognition.onresult = (event: any) => {
          const spokenText = event.results?.[0]?.[0]?.transcript;
          if (spokenText) {
            processVoicePhrase(spokenText);
          }
        };

        recognition.onerror = (event: any) => {
          console.info('Speech recognition status:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            onShowToast('MIC ACCESS RESTRICTED: USE KEYBOARD [I] FOR INSPECTION, [E] FOR EMERGENCY');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('SpeechRecognition init error:', e);
      }
    }

    return () => {
      clearFeedbackTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [processVoicePhrase, onShowToast]);

  const startListening = useCallback(() => {
    setIsVoiceBarOpen(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        // May already be active
      }
    }
    // Fallback simulation state
    setIsListening(true);
    playTacticalChime('listen');
    setFeedbackMessage('LISTENING (SPEAK OR CLICK SIMULATED VOICE CHIPS)...');
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const simulateVoiceCommand = useCallback(
    (phrase: string) => {
      setIsVoiceBarOpen(true);
      processVoicePhrase(phrase);
    },
    [processVoicePhrase]
  );

  // Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keystrokes when typing inside inputs, textareas, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;

      // [V] or [v]: Toggle voice listener
      if (key === 'v' || key === 'V') {
        event.preventDefault();
        toggleListening();
        return;
      }

      // [I] or [i]: Trigger "Show Inspection" directly via hotkey
      if (key === 'i' || key === 'I') {
        event.preventDefault();
        processVoicePhrase('show inspection');
        return;
      }

      // [E] or [e]: Trigger "Emergency" directly via hotkey
      if (key === 'e' || key === 'E') {
        event.preventDefault();
        processVoicePhrase('emergency');
        return;
      }

      // [L] or [l]: Privacy Lock / Officer Shield
      if (key === 'l' || key === 'L') {
        event.preventDefault();
        processVoicePhrase('privacy lock');
        return;
      }

      // [Escape]: Close voice command overlay if open
      if (key === 'Escape') {
        if (isVoiceBarOpen) {
          setIsVoiceBarOpen(false);
          stopListening();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleListening, processVoicePhrase, isVoiceBarOpen, stopListening]);

  return {
    isListening,
    transcript,
    lastCommand,
    feedbackMessage,
    speechSupported,
    startListening,
    stopListening,
    toggleListening,
    simulateVoiceCommand,
    isVoiceBarOpen,
    setIsVoiceBarOpen,
  };
};
