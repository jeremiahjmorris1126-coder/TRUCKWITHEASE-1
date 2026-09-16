import { useState, useEffect, useCallback, useRef } from 'react';
import { DriverAlertnessData, DriverAlertnessStatus } from '../types';
import { PARKING_FACILITIES } from '../data/mockData';

const DEFAULT_RECOMMENDED_REST_AREA = {
  name: "Love's Travel Stop #402",
  brand: "Love's" as const,
  exit: 'Exit 488',
  mileMarker: 488,
  milesAway: 14.2,
  availableSpots: 42,
  amenities: ['Hot Showers', 'DEF Pump', 'Overnight Parking', '24/7 Diner'],
};

export function useAlertnessTracker(
  onShowToast?: (msg: string, icon?: string) => void
) {
  const [latencyHistory, setLatencyHistory] = useState<number[]>([240, 260, 280, 250, 290]);
  const [fatigueFlagged, setFatigueFlagged] = useState<boolean>(false);
  const [isRestModalOpen, setIsRestModalOpen] = useState<boolean>(false);
  const lastEventTimeRef = useRef<number>(Date.now());

  // Log an interaction event latency
  const logInteraction = useCallback(
    (explicitLatencyMs?: number) => {
      const now = Date.now();
      const measuredMs = explicitLatencyMs !== undefined ? explicitLatencyMs : Math.min(now - lastEventTimeRef.current, 1800);
      lastEventTimeRef.current = now;

      // Filter out idle pauses longer than 10 seconds to avoid false positives on normal inactivity
      if (measuredMs < 10000 && measuredMs > 100) {
        setLatencyHistory((prev) => {
          const next = [...prev.slice(-9), measuredMs];
          return next;
        });
      }
    },
    []
  );

  // Global listener for UI interactions
  useEffect(() => {
    const handleUserInteraction = () => {
      logInteraction();
    };

    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [logInteraction]);

  // Calculate current score and status derived from rolling average latency
  const avgLatency = Math.round(
    latencyHistory.reduce((a, b) => a + b, 0) / (latencyHistory.length || 1)
  );
  const lastLatency = latencyHistory[latencyHistory.length - 1] || 250;

  let status: DriverAlertnessStatus = 'OPTIMAL';
  let score = 98;

  if (avgLatency > 850 || fatigueFlagged) {
    status = 'CRITICAL_EXHAUSTION';
    score = Math.max(38, Math.min(58, Math.round(100 - avgLatency / 15)));
  } else if (avgLatency > 550) {
    status = 'FATIGUE_WARNING';
    score = Math.round(100 - avgLatency / 18);
  } else if (avgLatency > 350) {
    status = 'MILD_LOWER';
    score = Math.round(100 - avgLatency / 25);
  } else {
    status = 'OPTIMAL';
    score = Math.min(100, Math.round(105 - avgLatency / 30));
  }

  // Trigger simulated fatigue slowdown for demo testing
  const triggerSimulatedFatigue = useCallback(() => {
    setLatencyHistory([780, 890, 950, 1020, 1150]);
    setFatigueFlagged(true);
    setIsRestModalOpen(true);
    if (onShowToast) {
      onShowToast(
        'DRIVER ALERTNESS INDEX FLAGGED: Cognitive slowdown detected (1,020ms latency). Rest Area suggested!',
        'bed'
      );
    }
  }, [onShowToast]);

  // Reset to optimal alertness
  const resetAlertness = useCallback(() => {
    setLatencyHistory([240, 250, 260, 230, 270]);
    setFatigueFlagged(false);
    setIsRestModalOpen(false);
    if (onShowToast) {
      onShowToast(
        'DRIVER ALERTNESS INDEX RESET: Optimal cognitive reaction speed restored (250ms)',
        'sentiment_very_satisfied'
      );
    }
  }, [onShowToast]);

  const dismissRestAreaAlert = useCallback(() => {
    setIsRestModalOpen(false);
  }, []);

  const nearestParking = PARKING_FACILITIES[0] || DEFAULT_RECOMMENDED_REST_AREA;

  const alertnessData: DriverAlertnessData = {
    score,
    status,
    averageLatencyMs: avgLatency,
    lastLatencyMs: lastLatency,
    totalInteractions: latencyHistory.length,
    fatigueFlagged,
    recommendedRestArea: {
      name: nearestParking.name,
      brand: nearestParking.brand,
      exit: nearestParking.exit,
      mileMarker: nearestParking.mileMarker,
      milesAway: nearestParking.milesAway,
      availableSpots: nearestParking.availableSpots,
      amenities: nearestParking.amenities,
    },
  };

  return {
    alertnessData,
    logInteraction,
    triggerSimulatedFatigue,
    resetAlertness,
    dismissRestAreaAlert,
    isRestModalOpen,
    setIsRestModalOpen,
  };
}
