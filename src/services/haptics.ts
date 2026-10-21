/**
 * In-Cab Haptic Feedback Service
 * Uses the Web Vibration API (navigator.vibrate) to deliver subtle tactile confirmations
 * to drivers when voice commands are parsed and executed.
 */

export type HapticType =
  | 'subtle'
  | 'light'
  | 'medium'
  | 'success'
  | 'double'
  | 'tick'
  | 'alert'
  | 'resume'
  | 'bypass-green'
  | 'pull-in-red'
  | 'high-severity-speed';

export const isVibrationSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function'
  );
};

let lastVibrateTime = 0;

/**
 * Triggers subtle haptic feedback on devices with vibration motors.
 * @param type Preset pattern or custom duration/array of durations in milliseconds
 * @returns boolean indicating if the vibration call succeeded
 */
export const triggerHapticFeedback = (
  type: HapticType | number | number[] = 'subtle'
): boolean => {
  if (!isVibrationSupported()) {
    return false;
  }

  // Prevent vibration overlap spam within 100ms
  const now = Date.now();
  if (now - lastVibrateTime < 100) {
    return false;
  }
  lastVibrateTime = now;

  try {
    let pattern: number | number[];

    if (typeof type === 'number' || Array.isArray(type)) {
      pattern = type;
    } else {
      switch (type) {
        case 'tick':
        case 'light':
          // Single ultra-subtle micro tick (25ms)
          pattern = 25;
          break;
        case 'medium':
          pattern = [40, 40, 40];
          break;
        case 'subtle':
        case 'success':
          // Subtle crisp double-pulse confirmation (35ms vibration, 40ms pause, 35ms vibration)
          // Engineered specifically for commercial vehicle mounted or handheld driver terminals
          pattern = [35, 40, 35];
          break;
        case 'double':
          pattern = [40, 50, 40];
          break;
        case 'resume':
          pattern = [25, 30, 25, 30, 50];
          break;
        case 'alert':
          pattern = [60, 40, 60];
          break;
        case 'bypass-green':
          // Smooth harmonic double-pulse for approved weigh station bypass
          pattern = [45, 60, 45];
          break;
        case 'pull-in-red':
          // Urgent triple cautionary pulse for mandatory scale house pull-in
          pattern = [90, 60, 90, 60, 120];
          break;
        case 'high-severity-speed':
          // Authoritative high-severity warning pulse for sustained speeding (>5 mph for >30s)
          pattern = [120, 60, 120, 60, 240];
          break;
        default:
          pattern = 35;
      }
    }

    return navigator.vibrate(pattern);
  } catch (err) {
    // Cross-origin iframe or browser permission constraints may prevent vibration
    console.debug('Haptic feedback unavailable or restricted by browser policy:', err);
    return false;
  }
};
