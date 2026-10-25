import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gauge,
  Activity,
  AlertTriangle,
  Zap,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  Download,
  FileJson,
  Truck,
  TrendingDown,
  TrendingUp,
  AlertOctagon,
  Sparkles,
  PhoneCall,
  Lock,
  ChevronRight,
  Info,
  Fuel,
  Printer,
  MapPin,
  Building2,
  MessageSquare,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  TelematicsTelemetryState,
  createInitialTelematicsState,
  HarshBrakingEvent,
  SpeedingEvent,
  CollisionEvent,
  formatDurationHMS,
  computeSafetyGrade,
  playTelematicsSoundAlert,
  IDLE_FUEL_GALLONS_PER_HOUR,
  DIESEL_PRICE_PER_GALLON_USD,
  CO2_LBS_PER_GALLON,
  DriverDailyShiftSummary,
  ShiftStopEvent,
  INITIAL_SHIFT_SUMMARIES,
  fetchLocalSpeedLimitByGps,
  GEOLOCATION_SPEED_ZONES,
  GeolocationSpeedZone,
} from '../services/telematicsSafetyService';
import { TacticalNotification } from '../types';
import { triggerHapticFeedback } from '../services/haptics';

interface TelematicsSafetySuiteProps {
  onNavigateToTab?: (tab: string) => void;
  onAddNotification?: (notification: TacticalNotification) => void;
  standalone?: boolean;
}

export const TelematicsSafetySuite: React.FC<TelematicsSafetySuiteProps> = ({
  onNavigateToTab,
  onAddNotification,
  standalone = true,
}) => {
  const [telematics, setTelematics] = useState<TelematicsTelemetryState>(createInitialTelematicsState);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'cockpit' | 'harsh_braking' | 'speeding' | 'collisions' | 'idle_stopped' | 'fmcsa_eld'>('cockpit');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('shift-today');
  const [shiftSummaries, setShiftSummaries] = useState<DriverDailyShiftSummary[]>(INITIAL_SHIFT_SUMMARIES);
  const [lastIdleAlertDispatched, setLastIdleAlertDispatched] = useState<boolean>(false);
  const lastIdleAlertTimestampRef = useRef<number>(0);
  const lastHighSeveritySpeedAlertTimestampRef = useRef<number>(0);
  const [isProvidersDropdownOpen, setIsProvidersDropdownOpen] = useState<boolean>(false);

  // Historical event ledgers
  const [harshBrakeLog, setHarshBrakeLog] = useState<HarshBrakingEvent[]>([
    {
      id: 'hb-101',
      timestamp: Date.now() - 3600000 * 2.1,
      timeFormatted: new Date(Date.now() - 3600000 * 2.1).toLocaleTimeString(),
      latitude: 41.2401,
      longitude: -77.8921,
      locationName: 'I-80 W Exit 178 Interchange (Lock Haven, PA)',
      initialSpeedMph: 66,
      finalSpeedMph: 24,
      speedDeltaMph: -42,
      peakDecelG: -0.48,
      durationMs: 2400,
      absTriggered: true,
      brakePressurePsi: 112,
      severity: 'SEVERE',
      driverScoreImpact: -4,
      notes: 'Cut off by merging passenger vehicle on wet pavement. ABS air pulse active.',
    },
    {
      id: 'hb-100',
      timestamp: Date.now() - 3600000 * 6.5,
      timeFormatted: new Date(Date.now() - 3600000 * 6.5).toLocaleTimeString(),
      latitude: 41.135,
      longitude: -77.72,
      locationName: 'I-80 WB Mile Marker 192 (Milesburg, PA)',
      initialSpeedMph: 58,
      finalSpeedMph: 35,
      speedDeltaMph: -23,
      peakDecelG: -0.37,
      durationMs: 1800,
      absTriggered: false,
      brakePressurePsi: 88,
      severity: 'MODERATE',
      driverScoreImpact: -2,
      notes: 'Slowdown for work zone arrow board.',
    },
  ]);

  const [speedingLog, setSpeedingLog] = useState<SpeedingEvent[]>([
    {
      id: 'spd-201',
      timestamp: Date.now() - 3600000 * 1.5,
      timeFormatted: new Date(Date.now() - 3600000 * 1.5).toLocaleTimeString(),
      currentSpeedMph: 72,
      speedLimitMph: 65,
      deltaMph: +7,
      tier: 'MODERATE',
      durationSeconds: 84,
      location: 'I-80 W Mile Marker 164',
    },
  ]);

  const [collisionLog, setCollisionLog] = useState<CollisionEvent[]>([]);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Real-Time Telematics Simulation Loop (1Hz tick)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTelematics((prev) => {
        let speed = prev.currentSpeedMph;
        let speedLimit = prev.speedLimitMph;
        let rpm = prev.engineRpm;
        let throttle = prev.throttlePct;
        let brakePsi = prev.brakePressurePsi;
        let stoppedSince = prev.stoppedSinceTimestamp;
        let stoppedSec = prev.stoppedDurationSeconds;
        let totalStopped = prev.totalStoppedDurationSeconds;
        let idleSec = prev.idleDurationSeconds;
        let idleFuel = prev.idleFuelWastedGallons;
        let idleCost = prev.idleFuelCostUsd;
        let co2 = prev.co2EmittedLbs;
        let motion = prev.motionStatus;
        let dutyStatus = prev.fmcsaCurrentDutyStatus;
        let fmcsaPrompt = prev.fmcsaPromptRemainingSec;
        let speedingSec = prev.speedingDurationSeconds;
        let totalSpeedingMin = prev.totalSpeedingTimeMinutes;

        // Jitter simulation
        if (speed > 5) {
          // Normal cruising driving mode with slight organic variation
          const jitter = (Math.random() - 0.48) * 0.8;
          speed = Math.min(82, Math.max(55, speed + jitter));
          rpm = Math.round(1100 + (speed / 75) * 450);
          throttle = Math.round(35 + (speed / 75) * 25);
          brakePsi = 0;
          motion = 'DRIVING';
          stoppedSince = null;
          stoppedSec = 0;
          fmcsaPrompt = null;

          // Check automatic FMCSA §395.26 driving duty status switch
          if (dutyStatus !== 'DRIVING' && speed > 5) {
            dutyStatus = 'DRIVING';
            if (audioEnabled) playTelematicsSoundAlert('DUTY_SWITCH');
          }
        } else if (speed === 0) {
          // Vehicle is stationary / stopped
          motion = prev.isIdling ? 'IDLING' : 'STOPPED';
          throttle = 0;

          if (!stoppedSince) {
            stoppedSince = Date.now();
            stoppedSec = 0;
          } else {
            stoppedSec += 1;
            totalStopped += 1;
          }

          if (prev.isIdling) {
            rpm = 650; // High idle standard
            idleSec += 1;
            const addedFuel = (IDLE_FUEL_GALLONS_PER_HOUR / 3600);
            idleFuel += addedFuel;
            idleCost = idleFuel * DIESEL_PRICE_PER_GALLON_USD;
            co2 = idleFuel * CO2_LBS_PER_GALLON;

            // Automated 15-Minute (900s) Consecutive Idle Watchdog Trigger
            if (idleSec >= 900 && Date.now() - lastIdleAlertTimestampRef.current > 300000) {
              lastIdleAlertTimestampRef.current = Date.now();
              setTimeout(() => {
                trigger15MinIdleMessagingAlert(false);
              }, 50);
            }
          } else {
            rpm = 0;
          }

          // FMCSA §395.26: When stopped for 5 consecutive minutes (300 sec), start 60s duty switch countdown
          if (stoppedSec >= 300 && dutyStatus === 'DRIVING') {
            if (fmcsaPrompt === null) {
              fmcsaPrompt = 60;
              if (audioEnabled) playTelematicsSoundAlert('STOPPED_5MIN');
            } else if (fmcsaPrompt > 1) {
              fmcsaPrompt -= 1;
            } else if (fmcsaPrompt === 1) {
              // Auto switch to ON_DUTY
              dutyStatus = 'ON_DUTY';
              fmcsaPrompt = null;
              if (audioEnabled) playTelematicsSoundAlert('DUTY_SWITCH');
            }
          }
        }

        // Geolocation Speed Limit Cross-Referencing
        const geoInfo = fetchLocalSpeedLimitByGps(prev.gps.lat, prev.gps.lng);
        speedLimit = geoInfo.speedLimitMph;

        // Speeding calculation
        const delta = speed - speedLimit;
        const isSpd = delta > 0.5;
        let tier: TelematicsTelemetryState['speedingTier'] = 'NONE';
        if (delta > 15) tier = 'CRITICAL_DOT';
        else if (delta > 10) tier = 'SEVERE';
        else if (delta > 5) tier = 'MODERATE';
        else if (delta > 0.5) tier = 'MINOR';

        if (isSpd) {
          speedingSec += 1;
          totalSpeedingMin += 1 / 60;
        } else {
          speedingSec = 0;
        }

        // Automated 5+ MPH for >30 Seconds High Severity Speed Watchdog
        let continuousOverSpeedSec = prev.continuousSpeedingDurationSec || 0;
        let isHighSeverityActive = false;

        if (delta >= 5.0 && speed > 5.0) {
          continuousOverSpeedSec += 1;
          if (continuousOverSpeedSec >= 30) {
            isHighSeverityActive = true;
            // Debounce haptic and auditory pulse every 15 seconds while high severity speeding persists
            if (Date.now() - lastHighSeveritySpeedAlertTimestampRef.current > 15000) {
              lastHighSeveritySpeedAlertTimestampRef.current = Date.now();
              triggerHapticFeedback('high-severity-speed');
              if (audioEnabled) playTelematicsSoundAlert('HIGH_SEVERITY_SPEED');

              if (onAddNotification) {
                onAddNotification({
                  id: `speed-high-alert-${Date.now()}`,
                  title: `🚨 HIGH SEVERITY SPEED ALERT (+${delta.toFixed(1)} MPH)`,
                  description: `Exceeding ${speedLimit} MPH limit by +${delta.toFixed(1)} MPH for ${continuousOverSpeedSec}s on ${geoInfo.roadName}. High severity visual and haptic alert triggered.`,
                  time: new Date().toLocaleTimeString(),
                  severity: 'alert',
                  read: false,
                });
              }
            }
          }
        } else {
          continuousOverSpeedSec = 0;
          isHighSeverityActive = false;
        }

        // Compute G forces with subtle road pitch/roll
        const gX = (Math.random() - 0.5) * 0.04;
        const gY = (Math.random() - 0.5) * 0.03;
        const gZ = 1.0 + (Math.random() - 0.5) * 0.02;

        return {
          ...prev,
          currentSpeedMph: Number(speed.toFixed(1)),
          speedLimitMph: speedLimit,
          speedDeltaMph: Number(delta.toFixed(1)),
          roadName: geoInfo.roadName,
          zoneType: geoInfo.zoneType,
          continuousSpeedingDurationSec: continuousOverSpeedSec,
          isHighSeveritySpeedAlertActive: isHighSeverityActive,
          isSpeeding: isSpd,
          speedingTier: tier,
          speedingDurationSeconds: speedingSec,
          totalSpeedingTimeMinutes: Number(totalSpeedingMin.toFixed(1)),
          motionStatus: motion,
          isStopped: speed === 0,
          stoppedSinceTimestamp: stoppedSince,
          stoppedDurationSeconds: stoppedSec,
          totalStoppedDurationSeconds: totalStopped,
          idleDurationSeconds: idleSec,
          idleFuelWastedGallons: Number(idleFuel.toFixed(2)),
          idleFuelCostUsd: Number(idleCost.toFixed(2)),
          co2EmittedLbs: Number(co2.toFixed(1)),
          engineRpm: rpm,
          throttlePct: throttle,
          brakePressurePsi: brakePsi,
          fmcsaCurrentDutyStatus: dutyStatus,
          fmcsaPromptRemainingSec: fmcsaPrompt,
          gForce: {
            x: Number(gX.toFixed(2)),
            y: Number(gY.toFixed(2)),
            z: Number(gZ.toFixed(2)),
            magnitude: Number(Math.sqrt(gX * gX + gY * gY + gZ * gZ).toFixed(2)),
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulating, audioEnabled]);

  // Trigger Harsh Braking Simulation
  const triggerSimulatedHarshBrake = () => {
    triggerHapticFeedback(180);
    if (audioEnabled) playTelematicsSoundAlert('HARSH_BRAKE');

    const startSpeed = telematics.currentSpeedMph > 20 ? telematics.currentSpeedMph : 68;
    const endSpeed = Math.round(startSpeed * 0.25);
    const speedDelta = endSpeed - startSpeed;
    const peakDecelG = -0.52;
    const durationMs = 2100;

    const newEvent: HarshBrakingEvent = {
      id: `hb-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      latitude: 41.135,
      longitude: -77.72,
      locationName: 'I-80 Corridor · Mile Marker 174',
      initialSpeedMph: Number(startSpeed.toFixed(0)),
      finalSpeedMph: endSpeed,
      speedDeltaMph: speedDelta,
      peakDecelG: peakDecelG,
      durationMs: durationMs,
      absTriggered: true,
      brakePressurePsi: 118,
      severity: 'EMERGENCY_STOP',
      driverScoreImpact: -5,
      notes: 'Aggressive rapid deceleration > -0.35g threshold. ABS anti-lock solenoid engaged.',
    };

    setHarshBrakeLog((prev) => [newEvent, ...prev]);
    setTelematics((prev) => {
      const newScore = Math.max(40, prev.driverSafetyScore - 5);
      return {
        ...prev,
        currentSpeedMph: endSpeed,
        brakePressurePsi: 118,
        throttlePct: 0,
        harshBrakeCount: prev.harshBrakeCount + 1,
        driverSafetyScore: newScore,
        driverSafetyGrade: computeSafetyGrade(newScore),
        lastHarshBrake: newEvent,
        gForce: { x: 0.05, y: -0.52, z: 1.05, magnitude: 1.17 },
      };
    });

    showToast('🚨 HARSH BRAKING EVENT DETECTED & LOGGED (Decel: -0.52g)');
  };

  // Trigger Speeding Incident
  const triggerSimulatedSpeeding = (delta: number) => {
    triggerHapticFeedback(120);
    if (audioEnabled) playTelematicsSoundAlert('SPEEDING');

    const newSpeed = telematics.speedLimitMph + delta;
    let tier: TelematicsTelemetryState['speedingTier'] = 'MINOR';
    if (delta >= 15) tier = 'CRITICAL_DOT';
    else if (delta >= 10) tier = 'SEVERE';
    else if (delta >= 6) tier = 'MODERATE';

    const newEvent: SpeedingEvent = {
      id: `spd-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      currentSpeedMph: newSpeed,
      speedLimitMph: telematics.speedLimitMph,
      deltaMph: delta,
      tier: tier,
      durationSeconds: 120,
      location: 'I-80 Corridor · Approaching Mile Marker 180',
      dotCitationCode: delta >= 15 ? '49 CFR §383.51 (Serious Traffic Violation)' : undefined,
    };

    setSpeedingLog((prev) => [newEvent, ...prev]);
    setTelematics((prev) => {
      const penalty = delta >= 15 ? 8 : delta >= 10 ? 4 : 2;
      const newScore = Math.max(40, prev.driverSafetyScore - penalty);
      return {
        ...prev,
        currentSpeedMph: newSpeed,
        speedDeltaMph: delta,
        isSpeeding: true,
        speedingTier: tier,
        speedingIncidentCount: prev.speedingIncidentCount + 1,
        driverSafetyScore: newScore,
        driverSafetyGrade: computeSafetyGrade(newScore),
      };
    });

    showToast(`⚠️ SPEEDING TRIGGERED: ${newSpeed} MPH (${delta > 0 ? '+' : ''}${delta} MPH OVER LIMIT)`);
  };

  // Trigger Simulated 5+ MPH for >30 Seconds High Severity Speed Alert
  const triggerSimulatedHighSeveritySpeed = (delta = 8, duration = 32) => {
    triggerHapticFeedback('high-severity-speed');
    if (audioEnabled) playTelematicsSoundAlert('HIGH_SEVERITY_SPEED');

    const newSpeed = telematics.speedLimitMph + delta;
    const newEvent: SpeedingEvent = {
      id: `spd-high-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      currentSpeedMph: newSpeed,
      speedLimitMph: telematics.speedLimitMph,
      deltaMph: delta,
      tier: 'MODERATE',
      durationSeconds: duration,
      location: `${telematics.roadName} (${telematics.zoneType})`,
      dotCitationCode: 'High Severity: Sustained 5+ MPH Over Limit (>30s)',
    };

    setSpeedingLog((prev) => [newEvent, ...prev]);
    setTelematics((prev) => {
      const newScore = Math.max(40, prev.driverSafetyScore - 6);
      return {
        ...prev,
        currentSpeedMph: newSpeed,
        speedDeltaMph: delta,
        isSpeeding: true,
        continuousSpeedingDurationSec: duration,
        isHighSeveritySpeedAlertActive: true,
        speedingIncidentCount: prev.speedingIncidentCount + 1,
        driverSafetyScore: newScore,
        driverSafetyGrade: computeSafetyGrade(newScore),
      };
    });

    if (onAddNotification) {
      onAddNotification({
        id: `speed-high-alert-manual-${Date.now()}`,
        title: `🚨 HIGH SEVERITY SPEED ALERT (+${delta} MPH / ${duration}s)`,
        description: `Vehicle exceeded ${telematics.speedLimitMph} MPH statutory limit by +${delta} MPH for ${duration} consecutive seconds on ${telematics.roadName}. High severity visual and haptic warning dispatched.`,
        time: new Date().toLocaleTimeString(),
        severity: 'alert',
        read: false,
      });
    }

    showToast(`🚨 HIGH SEVERITY SPEED ALERT: +${delta} MPH OVER LIMIT FOR ${duration}s (HAPTIC & VISUAL ARMED)`);
  };

  // Change Geolocation Speed Zone
  const handleChangeSpeedZone = (zone: GeolocationSpeedZone) => {
    triggerHapticFeedback(50);
    setTelematics((prev) => ({
      ...prev,
      gps: { lat: (zone.latMin + zone.latMax) / 2, lng: (zone.lngMin + zone.lngMax) / 2 },
      speedLimitMph: zone.speedLimitMph,
      roadName: zone.roadName,
      zoneType: zone.zoneType,
      speedDeltaMph: Number((prev.currentSpeedMph - zone.speedLimitMph).toFixed(1)),
    }));
    showToast(`GEOLOCATION ZONE SWITCHED: ${zone.roadName} (${zone.speedLimitMph} MPH LIMIT)`);
  };

  // Trigger Collision / Crash Pulse Impact
  const triggerSimulatedCollision = (severity: 'DOCK_BUMP' | 'CRASH_IMPACT') => {
    triggerHapticFeedback(400);
    if (audioEnabled) playTelematicsSoundAlert('COLLISION');

    const impactG = severity === 'CRASH_IMPACT' ? 4.85 : 1.45;
    const impactSpeed = telematics.currentSpeedMph > 0 ? telematics.currentSpeedMph : 48;

    const crashEvent: CollisionEvent = {
      id: `crash-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      latitude: 41.135,
      longitude: -77.72,
      locationName: 'I-80 Westbound · Clearfield / Clinton County Line',
      impactG: impactG,
      speedAtImpactMph: impactSpeed,
      impactVector: 'FRONTAL',
      eCallTriggered: severity === 'CRASH_IMPACT',
      sosDispatched: severity === 'CRASH_IMPACT',
      preCrashBlackBox: [
        { timeOffsetSec: -5.0, speedMph: impactSpeed, rpm: 1350, throttlePct: 50, brakePressurePsi: 0, gForceY: 0.02 },
        { timeOffsetSec: -4.0, speedMph: impactSpeed, rpm: 1350, throttlePct: 50, brakePressurePsi: 0, gForceY: 0.01 },
        { timeOffsetSec: -3.0, speedMph: impactSpeed - 2, rpm: 1250, throttlePct: 10, brakePressurePsi: 45, gForceY: -0.22 },
        { timeOffsetSec: -2.0, speedMph: impactSpeed - 8, rpm: 1100, throttlePct: 0, brakePressurePsi: 95, gForceY: -0.44 },
        { timeOffsetSec: -1.0, speedMph: impactSpeed - 14, rpm: 950, throttlePct: 0, brakePressurePsi: 120, gForceY: -0.58 },
        { timeOffsetSec: 0.0, speedMph: 0, rpm: 0, throttlePct: 0, brakePressurePsi: 120, gForceY: impactG * -1 },
      ],
      notes: severity === 'CRASH_IMPACT'
        ? 'High-magnitude 3-axis deceleration shock (> 2.5g threshold). Automatic 911/eCall SOS broadcast dispatched.'
        : 'Minor dock bumper contact impact below airbag deployment threshold.',
    };

    setCollisionLog((prev) => [crashEvent, ...prev]);
    setTelematics((prev) => ({
      ...prev,
      currentSpeedMph: 0,
      engineRpm: 0,
      throttlePct: 0,
      brakePressurePsi: 120,
      isStopped: true,
      motionStatus: 'STOPPED',
      collisionIncidentCount: prev.collisionIncidentCount + 1,
      lastCollision: crashEvent,
      gForce: { x: 0.8, y: -impactG, z: 2.1, magnitude: impactG },
    }));

    showToast(severity === 'CRASH_IMPACT' ? '🆘 HIGH-G COLLISION DETECTED — BLACK BOX LOGGED & DISPATCH SOS SENT' : '⚠️ MINOR DOCK BUMP RECORDED (< 2.0g)');
  };

  // Trigger 15-Minute Excessive Idle Alert via In-Cab Messaging System & Backend API
  const trigger15MinIdleMessagingAlert = async (isManual: boolean = false) => {
    triggerHapticFeedback(160);
    if (audioEnabled) playTelematicsSoundAlert('STOPPED_5MIN');

    const idleMinutes = isManual ? 15.4 : Math.max(15.0, +(telematics.idleDurationSeconds / 60).toFixed(1));
    const idleSecs = isManual ? 924 : Math.max(900, telematics.idleDurationSeconds);
    const wastedGal = isManual ? 0.22 : Math.max(0.21, telematics.idleFuelWastedGallons);
    const wastedCost = isManual ? 0.85 : Math.max(0.81, telematics.idleFuelCostUsd);

    let smsDispatched = false;
    try {
      const res = await fetch('/api/telematics/idle-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleUnit: 'UNIT #104-E',
          driverName: 'Marcus Kowalski',
          idleDurationMinutes: idleMinutes,
          idleDurationSeconds: idleSecs,
          engineRpm: telematics.engineRpm || 650,
          idleFuelWastedGallons: wastedGal,
          idleCostUsd: wastedCost,
          locationName: 'I-80 E Rest Area / Logistics Facility',
          latitude: 41.135,
          longitude: -77.72,
        }),
      });
      if (res.ok) {
        smsDispatched = true;
        setLastIdleAlertDispatched(true);
        lastIdleAlertTimestampRef.current = Date.now();
      } else {
        const response = await res.json().catch(() => null);
        console.warn('Backend idle alert was not dispatched:', response?.error || res.status);
      }
    } catch (err) {
      console.warn('Backend idle alert API fallback:', err);
    }

    // Broadcast tactical notification for In-Cab UI
    const notif: TacticalNotification = {
      id: `idle-alert-${Date.now()}`,
      title: '⚠️ 15-MIN EXCESSIVE IDLE ALERT',
      description: `Vehicle stationary idle exceeded 15 min (${formatDurationHMS(idleSecs)}). Engine at 650 RPM with ${wastedGal} gal ($${wastedCost}) burned. ${smsDispatched ? 'SMS accepted by Twilio for dispatch.' : 'SMS delivery was not confirmed; check backend and Twilio configuration.'}`,
      time: new Date().toLocaleTimeString(),
      severity: 'warning',
      read: false,
    };

    if (onAddNotification) {
      onAddNotification(notif);
    }

    setToastMessage(
      smsDispatched
        ? '⚠️ 15-MIN IDLE ALERT ACCEPTED BY TWILIO FOR DISPATCH'
        : '⚠️ IDLE ALERT CREATED LOCALLY; SMS DELIVERY NOT CONFIRMED'
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Toggle Vehicle Stopped / Idling / Driving State
  const toggleVehicleMotionState = (state: 'DRIVING' | 'STOPPED_IDLE' | 'STOPPED_OFF') => {
    triggerHapticFeedback(80);
    setTelematics((prev) => {
      if (state === 'DRIVING') {
        return {
          ...prev,
          currentSpeedMph: 65,
          speedLimitMph: 65,
          speedDeltaMph: 0,
          isSpeeding: false,
          speedingTier: 'NONE',
          motionStatus: 'DRIVING',
          isStopped: false,
          isIdling: false,
          engineRpm: 1300,
          throttlePct: 45,
          brakePressurePsi: 0,
          stoppedSinceTimestamp: null,
          stoppedDurationSeconds: 0,
          fmcsaCurrentDutyStatus: 'DRIVING',
          fmcsaPromptRemainingSec: null,
        };
      } else if (state === 'STOPPED_IDLE') {
        return {
          ...prev,
          currentSpeedMph: 0,
          speedDeltaMph: -prev.speedLimitMph,
          isSpeeding: false,
          speedingTier: 'NONE',
          motionStatus: 'IDLING',
          isStopped: true,
          isIdling: true,
          engineRpm: 650,
          throttlePct: 0,
          brakePressurePsi: 90,
          stoppedSinceTimestamp: Date.now(),
          stoppedDurationSeconds: 0,
        };
      } else {
        return {
          ...prev,
          currentSpeedMph: 0,
          speedDeltaMph: -prev.speedLimitMph,
          isSpeeding: false,
          speedingTier: 'NONE',
          motionStatus: 'STOPPED',
          isStopped: true,
          isIdling: false,
          engineRpm: 0,
          throttlePct: 0,
          brakePressurePsi: 90,
          stoppedSinceTimestamp: Date.now(),
          stoppedDurationSeconds: 0,
        };
      }
    });
    showToast(`VEHICLE STATE SWITCHED TO: ${state}`);
  };

  // Export Telematics Black Box Dossier
  const handleExportTelematicsJson = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      vehicleVin: '1FUJGLDR5PL904812',
      truckUnit: 'UNIT #104-E (2024 Freightliner Cascadia)',
      driver: 'Marcus Kowalski (PA-CDL-9048123)',
      fmcsaCertification: '49 CFR Part 395 Subpart B Compliant',
      telematicsState: telematics,
      harshBrakingLedger: harshBrakeLog,
      speedingLedger: speedingLog,
      collisionLedger: collisionLog,
      cryptographicHash: `SHA256-${Math.random().toString(36).substring(2, 15)}-FMCSA-SEALED`,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TruckWithEase-Telematics-Dossier-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportNotice('Telematics Cryptographic Audit Package Exported Successfully!');
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-[#121622] border-2 border-[#D4AF37] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 font-mono text-sm max-w-md"
          >
            <Sparkles className="w-5 h-5 text-[#D4AF37] animate-spin" />
            <span className="font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER WITH SAFETY SCORE & QUICK CONTROLS */}
      <div className="bg-[#0C0E14] border border-[#D4AF37]/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl text-[#D4AF37]">
              <Gauge className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black tracking-tight text-white uppercase font-sans">
                  UNTOUCHABLE TELEMATICS & ELD SAFETY SUITE
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/80 border border-emerald-500 text-emerald-400">
                  SIMULATED — NOT FMCSA CERTIFIED
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-950/80 border border-amber-500/80 text-amber-400">
                  HARNESS: SIMULATION STREAM
                </span>
              </div>
              <p className="text-sm text-slate-400 font-mono mt-0.5">
                Harsh Braking • Speeding Sentinel • Collision Black Box • Stop Duration • CAN-bus J1939 Engine Fusion
              </p>
            </div>
          </div>

          {/* Quick Audio & Stream Toggles + Providers Dropdown */}
          <div className="flex items-center flex-wrap gap-2 relative">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-colors ${
                audioEnabled
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
              <span>{audioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
            </button>

            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-colors ${
                isSimulating
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-500/60 text-rose-300'
              }`}
            >
              {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isSimulating ? 'SIMULATOR: ACTIVE' : 'SIMULATOR: PAUSED'}</span>
            </button>

            {/* Providers & Cryptographic Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProvidersDropdownOpen(!isProvidersDropdownOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/60 text-[#D4AF37] rounded-lg font-mono text-xs font-bold transition-all shadow-sm"
              >
                <Sliders className="w-4 h-4" />
                <span>INTEGRATIONS &amp; EXPORT</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isProvidersDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0C101A] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      TELEMATICS INTEGRATIONS
                    </span>
                    <button
                      onClick={() => setIsProvidersDropdownOpen(false)}
                      className="text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-sky-400" />
                        <div>
                          <div className="font-bold text-white">Samsara Gateway</div>
                          <div className="text-[10px] text-slate-400">J1939 ECU CAN data feed</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <div>
                          <div className="font-bold text-white">Motive / KeepTruckin</div>
                          <div className="text-[10px] text-slate-400">Certified e-Logs sync</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        READY
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="font-bold text-white">Geotab Fleet Telematics</div>
                          <div className="text-[10px] text-slate-400">G-Force accelerometer log</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                        READY
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        setIsProvidersDropdownOpen(false);
                        handleExportTelematicsJson();
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#D4AF37]/15 transition cursor-pointer border-t border-slate-800/80 pt-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <div>
                          <div className="font-bold text-[#D4AF37]">Export Black Box JSON</div>
                          <div className="text-[10px] text-slate-400">FMCSA sealed audit dossier</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DRIVER SAFETY SCORECARD STRIP */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Driver Safety Score */}
          <div className="bg-[#12151F] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>SAFETY SCORE</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{telematics.driverSafetyScore}</span>
              <span className="text-xs text-slate-400 font-mono">/ 100</span>
              <span className={`text-sm font-black px-1.5 py-0.5 rounded font-mono ${
                telematics.driverSafetyScore >= 90 ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500' :
                telematics.driverSafetyScore >= 80 ? 'bg-sky-900/80 text-sky-300 border border-sky-500' :
                'bg-rose-900/80 text-rose-300 border border-rose-500'
              }`}>
                {telematics.driverSafetyGrade}
              </span>
            </div>
          </div>

          {/* Current Speed vs Limit */}
          <div className={`border rounded-xl p-3 ${
            telematics.isSpeeding
              ? telematics.speedingTier === 'CRITICAL_DOT'
                ? 'bg-rose-950/60 border-rose-500 animate-pulse'
                : 'bg-amber-950/40 border-amber-500/80'
              : 'bg-[#12151F] border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>CURRENT SPEED</span>
              <Gauge className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{telematics.currentSpeedMph}</span>
              <span className="text-xs text-slate-400 font-mono">MPH</span>
              <span className="text-[10px] text-slate-400 font-mono">/ {telematics.speedLimitMph} Limit</span>
            </div>
          </div>

          {/* Motion Status & Stopped Duration */}
          <div className="bg-[#12151F] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>MOTION STATUS</span>
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-1 flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                telematics.motionStatus === 'DRIVING' ? 'bg-emerald-950 border border-emerald-500 text-emerald-300' :
                telematics.motionStatus === 'IDLING' ? 'bg-amber-950 border border-amber-500 text-amber-300' :
                'bg-slate-800 text-slate-300'
              }`}>
                {telematics.motionStatus}
              </span>
              {telematics.isStopped && (
                <span className="text-xs font-mono font-bold text-amber-400">
                  {formatDurationHMS(telematics.stoppedDurationSeconds)}
                </span>
              )}
            </div>
          </div>

          {/* Harsh Brakes */}
          <div className="bg-[#12151F] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>HARSH BRAKES</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{telematics.harshBrakeCount}</span>
              <span className="text-xs text-slate-400 font-mono">Events</span>
            </div>
          </div>

          {/* Speeding Minutes */}
          <div className="bg-[#12151F] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>SPEEDING TIME</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white font-mono">{telematics.totalSpeedingTimeMinutes}</span>
              <span className="text-xs text-slate-400 font-mono">Min</span>
            </div>
          </div>

          {/* Idle Fuel Burned */}
          <div className="bg-[#12151F] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>IDLE FUEL BURN</span>
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-xl font-black text-amber-400 font-mono">${telematics.idleFuelCostUsd}</span>
              <span className="text-xs text-slate-400 font-mono">({telematics.idleFuelWastedGallons} gal)</span>
            </div>
          </div>
        </div>

        {/* FMCSA §395.26 5-MINUTE STOPPING DUTY SWITCH ALERT BAR */}
        {telematics.fmcsaPromptRemainingSec !== null && (
          <div className="mt-4 p-4 bg-amber-950/80 border-2 border-amber-500 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center space-x-3">
              <AlertOctagon className="w-7 h-7 text-amber-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-amber-200 text-sm font-mono">
                  FMCSA MANDATORY PROMPT: VEHICLE STATIONARY FOR 5+ MINUTES
                </div>
                <div className="text-xs text-amber-300 font-mono mt-0.5">
                  Vehicle at 0 MPH for {formatDurationHMS(telematics.stoppedDurationSeconds)}. Auto-switching duty status to <strong className="underline">ON-DUTY (Not Driving)</strong> in {telematics.fmcsaPromptRemainingSec}s.
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setTelematics((prev) => ({ ...prev, fmcsaCurrentDutyStatus: 'ON_DUTY', fmcsaPromptRemainingSec: null }));
                  showToast('DUTY STATUS SWITCHED TO ON-DUTY');
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs rounded-lg shadow"
              >
                CONFIRM ON-DUTY
              </button>
              <button
                onClick={() => {
                  setTelematics((prev) => ({ ...prev, fmcsaCurrentDutyStatus: 'YARD_MOVE', fmcsaPromptRemainingSec: null }));
                  showToast('SWITCHED TO YARD MOVE');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold font-mono text-xs rounded-lg border border-slate-600"
              >
                YARD MOVE
              </button>
              <button
                onClick={() => {
                  setTelematics((prev) => ({ ...prev, fmcsaCurrentDutyStatus: 'PERSONAL_CONVEYANCE', fmcsaPromptRemainingSec: null }));
                  showToast('SWITCHED TO PERSONAL CONVEYANCE');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold font-mono text-xs rounded-lg border border-slate-600"
              >
                PC
              </button>
            </div>
          </div>
        )}

        {/* HIGH SEVERITY SPEED ALERT BANNER (5+ MPH OVER LIMIT FOR >30 SECONDS) */}
        {telematics.isHighSeveritySpeedAlertActive && (
          <div className="mt-4 p-4 bg-gradient-to-r from-rose-950/95 via-red-900/90 to-black border-2 border-rose-500 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_0_25px_rgba(244,63,94,0.35)] animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-lg animate-bounce shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="font-black text-rose-200 text-sm font-mono flex items-center gap-2">
                  <span>🚨 HIGH SEVERITY SPEED ALERT ACTIVATED</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-600 text-white font-black">
                    &gt;5 MPH OVER LIMIT FOR {telematics.continuousSpeedingDurationSec}s
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-black/60 text-rose-300 font-mono border border-rose-500/50">
                    📳 HAPTIC PULSED
                  </span>
                </div>
                <div className="text-xs text-rose-300 font-mono mt-0.5">
                  Velocity: <strong className="text-white text-sm">{telematics.currentSpeedMph} MPH</strong> vs GPS Limit: <strong className="text-white text-sm">{telematics.speedLimitMph} MPH</strong> (+{telematics.speedDeltaMph} MPH excess) on <strong>{telematics.roadName}</strong>.
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                  setTelematics((prev) => ({
                    ...prev,
                    currentSpeedMph: prev.speedLimitMph,
                    speedDeltaMph: 0,
                    isSpeeding: false,
                    speedingTier: 'NONE',
                    continuousSpeedingDurationSec: 0,
                    isHighSeveritySpeedAlertActive: false,
                  }));
                  triggerHapticFeedback(50);
                  showToast('SPEED REDUCED TO STATUTORY LIMIT (ALERT CLEARED)');
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black font-mono text-xs rounded-lg shadow uppercase"
              >
                DECELERATE TO {telematics.speedLimitMph} MPH
              </button>
              <button
                onClick={() => {
                  setActiveTab('speeding');
                  triggerHapticFeedback(40);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-[#D4AF37] border border-[#D4AF37]/50 font-bold font-mono text-xs rounded-lg shadow uppercase"
              >
                VIEW SPEED SENTINEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'cockpit', label: 'LIVE HUD & GAUGES', icon: Gauge },
          { id: 'harsh_braking', label: `HARSH BRAKING (${telematics.harshBrakeCount})`, icon: TrendingDown },
          { id: 'speeding', label: `SPEEDING SENTINEL (${telematics.speedingIncidentCount})`, icon: AlertTriangle },
          { id: 'idle_stopped', label: `ENGINE STOP & SHIFT SUMMARY (${formatDurationHMS(telematics.stoppedDurationSeconds)})`, icon: Clock },
          { id: 'collisions', label: `COLLISION BLACK BOX (${collisionLog.length})`, icon: ShieldAlert },
          { id: 'fmcsa_eld', label: 'FMCSA §395 RULES & BENCH', icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                triggerHapticFeedback(40);
              }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20'
                  : 'bg-[#12151F] text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: LIVE HUD & GAUGES */}
      {activeTab === 'cockpit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Glanceable High-Contrast Speedometer HUD */}
          <div className="lg:col-span-7 bg-[#0C0E14] border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-mono text-sm font-bold text-white uppercase">PRIMARY GLANCEABLE SPEEDOMETER</span>
              </div>
              <span className="text-xs font-mono text-slate-400">SAE J1939 PGN 65265 / SPN 84</span>
            </div>

            {/* SPEEDOMETER CORE */}
            <div className="flex flex-col items-center justify-center py-6 relative">
              {/* SPEED NUMBER DISPLAY */}
              <div className="text-center relative">
                <span className={`text-8xl sm:text-9xl font-black font-mono tracking-tighter ${
                  telematics.isSpeeding
                    ? telematics.speedingTier === 'CRITICAL_DOT'
                      ? 'text-rose-500 animate-pulse drop-shadow-[0_0_25px_rgba(244,63,94,0.6)]'
                      : 'text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                    : 'text-white'
                }`}>
                  {telematics.currentSpeedMph}
                </span>
                <div className="text-sm font-mono font-bold tracking-widest text-slate-400 uppercase mt-1">
                  MILES PER HOUR
                </div>
              </div>

              {/* POSTED SPEED LIMIT SIGN */}
              <div className="mt-4 flex items-center space-x-4">
                <div className="bg-white text-black font-sans font-black px-4 py-2 rounded-lg border-2 border-slate-400 shadow-md text-center">
                  <div className="text-[9px] uppercase tracking-wider leading-none">SPEED</div>
                  <div className="text-[9px] uppercase tracking-wider leading-none mb-0.5">LIMIT</div>
                  <div className="text-2xl leading-none font-mono">{telematics.speedLimitMph}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono text-slate-300">
                    SPEED DELTA: <strong className={telematics.speedDeltaMph > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {telematics.speedDeltaMph > 0 ? `+${telematics.speedDeltaMph}` : telematics.speedDeltaMph} MPH
                    </strong>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    SPEEDING TIER: <span className="font-bold text-white">{telematics.speedingTier}</span>
                  </div>
                </div>
              </div>

              {/* SPEED BAR VISUALIZER */}
              <div className="w-full mt-6 space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>0 MPH</span>
                  <span>45 MPH</span>
                  <span className="text-amber-400 font-bold">65 LIMIT</span>
                  <span>80+ MPH</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      telematics.currentSpeedMph > 75 ? 'bg-rose-500' :
                      telematics.currentSpeedMph > 65 ? 'bg-amber-400' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (telematics.currentSpeedMph / 85) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* QUICK TEST BENCH BUTTONS */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={triggerSimulatedHarshBrake}
                className="p-2.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/60 text-rose-200 rounded-xl font-mono text-xs font-bold transition-all text-center flex flex-col items-center justify-center space-y-1"
              >
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <span>TEST HARSH BRAKE</span>
              </button>

              <button
                onClick={() => triggerSimulatedSpeeding(12)}
                className="p-2.5 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/60 text-amber-200 rounded-xl font-mono text-xs font-bold transition-all text-center flex flex-col items-center justify-center space-y-1"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>TEST SPEEDING (+12)</span>
              </button>

              <button
                onClick={() => toggleVehicleMotionState(telematics.isStopped ? 'DRIVING' : 'STOPPED_IDLE')}
                className="p-2.5 bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/60 text-sky-200 rounded-xl font-mono text-xs font-bold transition-all text-center flex flex-col items-center justify-center space-y-1"
              >
                <Clock className="w-4 h-4 text-sky-400" />
                <span>{telematics.isStopped ? 'RESUME DRIVING' : 'SIMULATE STOP'}</span>
              </button>

              <button
                onClick={() => triggerSimulatedCollision('CRASH_IMPACT')}
                className="p-2.5 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/60 text-purple-200 rounded-xl font-mono text-xs font-bold transition-all text-center flex flex-col items-center justify-center space-y-1"
              >
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <span>TEST CRASH IMPACT</span>
              </button>
            </div>
          </div>

          {/* G-Force Vector Ball & Secondary Engine Telemetry */}
          <div className="lg:col-span-5 space-y-6">
            {/* 3-AXIS G-FORCE COMPASS BALL */}
            <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-sky-400" />
                  <span className="font-mono text-sm font-bold text-white uppercase">3-AXIS G-FORCE ACCELEROMETER</span>
                </div>
                <span className="text-xs font-mono text-slate-400">THRESHOLD: ±0.35g</span>
              </div>

              {/* 2D G-FORCE RADAR CIRCLE */}
              <div className="flex items-center justify-center py-4">
                <div className="relative w-44 h-44 rounded-full border-2 border-slate-700 bg-slate-950 flex items-center justify-center">
                  {/* Outer circle: 0.5g boundary */}
                  <div className="absolute inset-4 rounded-full border border-dashed border-rose-500/40 pointer-events-none" />
                  {/* Inner circle: 0.3g boundary */}
                  <div className="absolute inset-10 rounded-full border border-slate-700 pointer-events-none" />
                  {/* Crosshairs */}
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-800" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-800" />

                  {/* Labels */}
                  <span className="absolute top-1 text-[9px] font-mono text-slate-400">BRAKE (-G)</span>
                  <span className="absolute bottom-1 text-[9px] font-mono text-slate-400">ACCEL (+G)</span>
                  <span className="absolute left-1 text-[9px] font-mono text-slate-400">L</span>
                  <span className="absolute right-1 text-[9px] font-mono text-slate-400">R</span>

                  {/* DYNAMIC G-FORCE PUCK */}
                  <motion.div
                    animate={{
                      x: telematics.gForce.x * 60,
                      y: telematics.gForce.y * 60,
                    }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className={`w-6 h-6 rounded-full border-2 shadow-lg flex items-center justify-center ${
                      Math.abs(telematics.gForce.y) > 0.35 || Math.abs(telematics.gForce.x) > 0.35
                        ? 'bg-rose-500 border-white animate-ping'
                        : 'bg-[#D4AF37] border-white'
                    }`}
                  >
                    <div className="w-2 h-2 bg-black rounded-full" />
                  </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">LATERAL (X)</div>
                  <div className="text-sm font-bold text-white">{telematics.gForce.x} g</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">LONGITUDINAL (Y)</div>
                  <div className={`text-sm font-bold ${telematics.gForce.y < -0.35 ? 'text-rose-400 font-black' : 'text-white'}`}>
                    {telematics.gForce.y} g
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">TOTAL VECTOR</div>
                  <div className="text-sm font-bold text-[#D4AF37]">{telematics.gForce.magnitude} g</div>
                </div>
              </div>
            </div>

            {/* ENGINE RPM & THROTTLE / BRAKE PSI */}
            <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                <span>CAN-BUS J1939 POWERTRAIN STATUS</span>
                <span className="text-amber-400 font-bold">NO HARDWARE FEED</span>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">ENGINE RPM</div>
                  <div className="text-xl font-black text-white mt-1">{telematics.engineRpm}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">GEAR: {telematics.gear}</div>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">BRAKE PRESSURE</div>
                  <div className={`text-xl font-black mt-1 ${telematics.brakePressurePsi > 50 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {telematics.brakePressurePsi} PSI
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">THROTTLE: {telematics.throttlePct}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: HARSH BRAKING DETAILED LEDGER */}
      {activeTab === 'harsh_braking' && (
        <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-6 h-6 text-rose-400" />
                <h3 className="text-xl font-black font-sans text-white uppercase">HARSH BRAKING TELEMATICS LOG</h3>
              </div>
              <p className="text-sm text-slate-400 font-mono mt-1">
                Threshold: Deceleration &gt; -0.35g (-8.5 MPH/s). Logs brake pressure PSI, duration, and ABS engagement.
              </p>
            </div>
            <button
              onClick={triggerSimulatedHarshBrake}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded-xl shadow-lg transition-all flex items-center space-x-2 self-start"
            >
              <Zap className="w-4 h-4" />
              <span>TRIGGER HARSH BRAKE TEST</span>
            </button>
          </div>

          <div className="space-y-3">
            {harshBrakeLog.map((event) => (
              <div
                key={event.id}
                className="bg-[#12151F] border border-slate-800 hover:border-rose-500/50 rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-rose-950/80 border border-rose-500/60 rounded-lg text-rose-400 font-mono font-black text-sm">
                      {event.peakDecelG}g
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white font-mono text-sm">{event.locationName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-900/60 text-rose-300 border border-rose-500/50">
                          {event.severity}
                        </span>
                        {event.absTriggered && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500">
                            ABS PULSED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1">
                        Speed: <strong className="text-white">{event.initialSpeedMph} MPH</strong> → <strong className="text-white">{event.finalSpeedMph} MPH</strong> ({event.speedDeltaMph} MPH in {event.durationMs}ms) • Brake Pressure: {event.brakePressurePsi} PSI
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs text-slate-400">{event.timeFormatted}</div>
                    <div className="text-xs text-rose-400 font-bold mt-0.5">Score Impact: {event.driverScoreImpact} pts</div>
                  </div>
                </div>
                {event.notes && (
                  <div className="mt-3 text-xs font-mono text-slate-300 bg-black/40 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500">CAN-Bus Dossier Note:</span> {event.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: SPEEDING SENTINEL */}
      {activeTab === 'speeding' && (
        <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-black font-sans text-white uppercase">
                  GEOLOCATION SPEED SENTINEL &amp; 30s HIGH-SEVERITY WATCHDOG
                </h3>
              </div>
              <p className="text-sm text-slate-400 font-mono mt-1">
                Cross-references real-time ECM velocity against local speed limits fetched via GPS geofencing. Triggers High-Severity visual &amp; haptic pulses on sustained 5+ MPH speeding (&gt;30s).
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => triggerSimulatedHighSeveritySpeed(8, 32)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                title="Test 5+ MPH over speed limit for >30 seconds to trip High Severity alert"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>TEST +8 MPH (&gt;30s HIGH SEVERITY)</span>
              </button>
              <button
                onClick={() => triggerSimulatedSpeeding(16)}
                className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-500 text-rose-200 font-mono text-xs font-bold rounded-xl shadow transition-all"
              >
                +16 MPH CRITICAL DOT
              </button>
              <button
                onClick={() => {
                  setTelematics((prev) => ({
                    ...prev,
                    currentSpeedMph: prev.speedLimitMph,
                    speedDeltaMph: 0,
                    isSpeeding: false,
                    speedingTier: 'NONE',
                    continuousSpeedingDurationSec: 0,
                    isHighSeveritySpeedAlertActive: false,
                  }));
                  triggerHapticFeedback(40);
                  showToast('SPEED COMPLIANT: MATCHED LOCAL SPEED LIMIT');
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-xl shadow transition-all"
              >
                COMPLY WITH LIMIT
              </button>
            </div>
          </div>

          {/* ACTIVE GEOLOCATION SPEED LIMIT CROSS-REFERENCE CARD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
            {/* GPS Speed Zone Details */}
            <div className="lg:col-span-7 bg-[#12151F] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-bold text-white uppercase">ACTIVE GPS SPEED LIMIT ZONE</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  GPS: {telematics.gps.lat.toFixed(4)}°N, {telematics.gps.lng.toFixed(4)}°W
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">LOCAL ROADWAY</div>
                  <div className="text-sm font-black text-white truncate mt-0.5" title={telematics.roadName}>
                    {telematics.roadName}
                  </div>
                  <div className="text-[10px] text-amber-400 mt-1 truncate" title={telematics.zoneType}>
                    {telematics.zoneType}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">FETCHED SPEED LIMIT</div>
                  <div className="text-2xl font-black text-white mt-0.5 flex items-baseline gap-1">
                    <span>{telematics.speedLimitMph}</span>
                    <span className="text-xs text-slate-400 font-normal">MPH</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    Statutory CMV Profile
                  </div>
                </div>

                <div className={`p-3 rounded-lg border col-span-2 sm:col-span-1 ${
                  telematics.isHighSeveritySpeedAlertActive
                    ? 'bg-rose-950/80 border-rose-500 animate-pulse'
                    : telematics.isSpeeding
                    ? 'bg-amber-950/60 border-amber-500/80'
                    : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div className="text-[10px] text-slate-400 uppercase">CURRENT DELTA</div>
                  <div className={`text-2xl font-black mt-0.5 ${
                    telematics.speedDeltaMph > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {telematics.speedDeltaMph > 0 ? `+${telematics.speedDeltaMph}` : telematics.speedDeltaMph}
                    <span className="text-xs font-normal text-slate-400 ml-1">MPH</span>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1">
                    {telematics.isSpeeding ? `Tier: ${telematics.speedingTier}` : 'Within Safe Limit'}
                  </div>
                </div>
              </div>

              {/* Geolocation Corridor Zone Selector */}
              <div className="pt-2">
                <div className="text-[11px] text-slate-400 font-bold mb-1.5 uppercase flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>SIMULATE GEOLOCATION SPEED CORRIDOR:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                  {GEOLOCATION_SPEED_ZONES.map((zone) => {
                    const isSelected = telematics.roadName === zone.roadName;
                    return (
                      <button
                        key={zone.id}
                        onClick={() => handleChangeSpeedZone(zone)}
                        className={`p-2 rounded-lg text-left transition-all border ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow font-black'
                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[10px] font-bold truncate leading-tight">{zone.roadName}</div>
                        <div className="text-[9px] opacity-80 mt-0.5">{zone.speedLimitMph} MPH Limit</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 30-Second High-Severity Speeding Watchdog Progress */}
            <div className={`lg:col-span-5 rounded-xl p-4 space-y-3 border ${
              telematics.isHighSeveritySpeedAlertActive
                ? 'bg-rose-950/90 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.35)] animate-pulse'
                : 'bg-[#12151F] border-slate-800'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center space-x-2">
                  <Clock className={`w-4 h-4 ${telematics.isHighSeveritySpeedAlertActive ? 'text-rose-400' : 'text-amber-400'}`} />
                  <span className="text-xs font-bold text-white uppercase">30s HIGH-SEVERITY WATCHDOG</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  telematics.isHighSeveritySpeedAlertActive
                    ? 'bg-rose-600 text-white font-black'
                    : telematics.continuousSpeedingDurationSec > 0
                    ? 'bg-amber-500 text-black font-black'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {telematics.isHighSeveritySpeedAlertActive
                    ? '🚨 HIGH SEVERITY ACTIVE'
                    : telematics.continuousSpeedingDurationSec > 0
                    ? `COUNTDOWN: ${telematics.continuousSpeedingDurationSec}s / 30s`
                    : 'STANDBY / ARMED'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Continuous 5+ MPH Over-Speed:</span>
                  <span className={`font-black text-sm ${
                    telematics.continuousSpeedingDurationSec >= 30 ? 'text-rose-400' :
                    telematics.continuousSpeedingDurationSec > 0 ? 'text-amber-400' : 'text-slate-300'
                  }`}>
                    {telematics.continuousSpeedingDurationSec}s / 30s
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      telematics.continuousSpeedingDurationSec >= 30
                        ? 'bg-rose-600 animate-pulse'
                        : telematics.continuousSpeedingDurationSec > 15
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (telematics.continuousSpeedingDurationSec / 30) * 100)}%`,
                    }}
                  />
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Trigger condition: Exceeding local limit by <strong className="text-white">&ge;5.0 MPH</strong> for <strong className="text-white">&gt;30 consecutive seconds</strong> dispatches High Severity visual and haptic feedback to cab terminal.
                </div>
              </div>

              {/* Haptic Status Card */}
              <div className="bg-black/50 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-2">
                  <span className="text-base">📳</span>
                  <div>
                    <span className="font-bold text-white">HAPTIC ENGINE:</span>
                    <span className="text-slate-400 ml-1">Pattern [120ms, 60ms, 120ms, 60ms, 240ms]</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  telematics.isHighSeveritySpeedAlertActive
                    ? 'bg-rose-900/80 text-rose-200 border border-rose-500'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                }`}>
                  {telematics.isHighSeveritySpeedAlertActive ? 'PULSING CAB VIBRATOR' : 'READY'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400">TIER 1 (1-5 MPH)</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">Flow Range</div>
              <div className="text-[11px] text-slate-500 mt-1">Minor Traffic Buffer</div>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400">TIER 2 (6-10 MPH)</div>
              <div className="text-lg font-bold text-amber-400 mt-1">Caution Tier</div>
              <div className="text-[11px] text-slate-500 mt-1">Advisory Alert</div>
            </div>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400">TIER 3 (11-14 MPH)</div>
              <div className="text-lg font-bold text-orange-400 mt-1">Severe Alert</div>
              <div className="text-[11px] text-slate-500 mt-1">Audible Warning Buzzer</div>
            </div>
            <div className="bg-rose-950/40 p-4 rounded-xl border border-rose-500 text-center">
              <div className="text-xs text-rose-300">TIER 4 (15+ MPH)</div>
              <div className="text-lg font-black text-rose-400 mt-1">DOT VIOLATION</div>
              <div className="text-[11px] text-rose-300 mt-1">49 CFR §383.51 Serious</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase">
              SPEEDING INCIDENT AUDIT TRAIL ({speedingLog.length} EVENTS RECORDED)
            </div>
            {speedingLog.map((event) => (
              <div
                key={event.id}
                className="bg-[#12151F] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-mono"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-bold text-sm">{event.location}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      event.tier === 'CRITICAL_DOT' ? 'bg-rose-950 text-rose-300 border border-rose-500' :
                      event.tier === 'SEVERE' ? 'bg-orange-950 text-orange-300 border border-orange-500' :
                      'bg-amber-950 text-amber-300 border border-amber-500'
                    }`}>
                      {event.tier} ({event.deltaMph > 0 ? `+${event.deltaMph}` : event.deltaMph} MPH)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Recorded Speed: <strong className="text-white">{event.currentSpeedMph} MPH</strong> vs {event.speedLimitMph} MPH Limit • Duration: {event.durationSeconds}s
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>{event.timeFormatted}</div>
                  {event.dotCitationCode && (
                    <div className="text-rose-400 font-bold mt-0.5">{event.dotCitationCode}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: ENGINE STOP DURATION & DAILY SHIFT IDLE SUMMARY */}
      {activeTab === 'idle_stopped' && (
        <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          {/* Header Strip with Shift Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Clock className="w-6 h-6 text-sky-400" />
                <h3 className="text-xl font-black font-sans text-white uppercase">
                  ENGINE STOP DURATION &amp; SHIFT IDLE SUMMARY
                </h3>
              </div>
              <p className="text-sm text-slate-400 font-mono mt-1">
                Real-time stationary tracker &amp; FMCSA compliant daily shift breakdown: Idling vs. Moving time.
              </p>
            </div>

            {/* Shift Filter & Simulation Controls */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center bg-[#111319] p-1 rounded-xl border border-slate-800">
                {shiftSummaries.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => {
                      setSelectedShiftId(shift.id);
                      triggerHapticFeedback(40);
                      showToast(`LOADED SHIFT SUMMARY: ${shift.shiftDate}`);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                      selectedShiftId === shift.id
                        ? 'bg-[#D4AF37] text-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {shift.shiftDate}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => trigger15MinIdleMessagingAlert(true)}
                  className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-600 text-rose-200 font-mono text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow animate-pulse"
                  title="Test sending automated 15-minute excessive idle alert to in-cab messaging system"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>TEST 15-MIN IDLE ALERT</span>
                </button>
                <button
                  onClick={() => toggleVehicleMotionState('STOPPED_IDLE')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-mono text-xs font-bold rounded-xl transition-all"
                >
                  SIMULATE IDLE STOP
                </button>
                <button
                  onClick={() => toggleVehicleMotionState('STOPPED_OFF')}
                  className="px-3 py-1.5 bg-purple-900 hover:bg-purple-800 text-purple-200 font-mono text-xs font-bold rounded-xl border border-purple-600 transition-all"
                >
                  ENGINE OFF
                </button>
                <button
                  onClick={() => toggleVehicleMotionState('DRIVING')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-xl transition-all"
                >
                  RESUME DRIVING
                </button>
              </div>
            </div>
          </div>

          {/* 15-MINUTE EXCESSIVE IDLE MESSAGING SENTINEL BANNER */}
          {(telematics.idleDurationSeconds >= 900 || lastIdleAlertDispatched) && (
            <div className="p-4 bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-black border-2 border-rose-500 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_0_20px_rgba(239,68,68,0.25)] font-mono text-xs animate-fadeIn">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-600 rounded-lg text-white animate-bounce">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-white uppercase flex items-center gap-2">
                    <span>15+ MINUTE EXCESSIVE IDLE DETECTED</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-rose-600 text-white font-black animate-pulse">
                      ALERT TRANSMITTED TO DRIVER MESSAGING
                    </span>
                  </div>
                  <p className="text-rose-300 text-[11px] mt-0.5">
                    Engine idle: <strong>{formatDurationHMS(Math.max(900, telematics.idleDurationSeconds))}</strong> • High-priority notification logged to <strong className="text-white">Safety &amp; Compliance</strong> and <strong className="text-white">Central Dispatch</strong> threads.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (onNavigateToTab) onNavigateToTab('messaging');
                    showToast('OPENING IN-CAB MESSAGING: SAFETY & COMPLIANCE');
                  }}
                  className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#E5C158] text-black font-extrabold uppercase rounded-lg shadow flex items-center gap-1.5 transition-all text-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>VIEW IN IN-CAB MESSAGING</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE LIVE STOP DURATION WATCHDOG CARD */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
            <div className="bg-[#12151F] border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-xs text-slate-400 uppercase">CURRENT STOP DURATION</div>
              <div className="text-3xl font-black text-amber-400">
                {formatDurationHMS(telematics.stoppedDurationSeconds)}
              </div>
              <div className="text-xs text-slate-300">
                Vehicle State: <strong className={telematics.isStopped ? (telematics.isIdling ? 'text-amber-400' : 'text-purple-400') : 'text-emerald-400'}>
                  {telematics.isStopped ? (telematics.isIdling ? 'HIGH IDLE (650 RPM)' : 'ENGINE OFF (0 RPM)') : 'EN ROUTE MOVING'}
                </strong>
              </div>
            </div>

            <div className="bg-[#12151F] border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-xs text-slate-400 uppercase">CURRENT IDLE FUEL BURN</div>
              <div className="text-3xl font-black text-white">
                {telematics.idleFuelWastedGallons} <span className="text-sm text-slate-400 font-normal">GAL</span>
              </div>
              <div className="text-xs text-amber-400">
                Current Stop Loss: ${telematics.idleFuelCostUsd} (@ ${DIESEL_PRICE_PER_GALLON_USD}/gal)
              </div>
            </div>

            <div className="bg-[#12151F] border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-xs text-slate-400 uppercase">TOTAL STOPPED TODAY</div>
              <div className="text-3xl font-black text-sky-400">
                {formatDurationHMS(telematics.totalStoppedDurationSeconds)}
              </div>
              <div className="text-xs text-slate-400">
                Includes Rest, Docks &amp; Fueling
              </div>
            </div>

            <div className="bg-[#12151F] border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-xs text-slate-400 uppercase">CO₂ EMISSION FOOTPRINT</div>
              <div className="text-3xl font-black text-slate-300">
                {telematics.co2EmittedLbs} <span className="text-sm text-slate-400 font-normal">LBS</span>
              </div>
              <div className="text-xs text-slate-500">
                EPA Clean Idle Standard
              </div>
            </div>
          </div>

          {/* DAILY DRIVER SHIFT SUMMARY REPORT (ACTIVE SELECTION) */}
          {(() => {
            const currentShift = shiftSummaries.find((s) => s.id === selectedShiftId) || shiftSummaries[0];
            return (
              <div className="bg-[#111319] border-2 border-[#D4AF37]/50 rounded-xl p-5 space-y-5 font-mono">
                {/* Summary Report Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-black text-white uppercase">{currentShift.shiftLabel}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        currentShift.cleanIdleCompliance
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                          : 'bg-amber-950 text-amber-300 border border-amber-500'
                      }`}>
                        {currentShift.cleanIdleCompliance ? 'CARB CLEAN IDLE PASSED (<10%)' : 'IDLE WARNING (>10%)'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Driver: <strong className="text-white">{currentShift.driverName}</strong> • Rig: {currentShift.truckUnit} • Window: {currentShift.shiftStartTime} → {currentShift.shiftEndTime}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const payload = {
                          reportType: 'DRIVER_DAILY_SHIFT_IDLE_SUMMARY',
                          generatedAt: new Date().toISOString(),
                          shiftSummary: currentShift,
                          cryptographicSeal: `SHA256-${Math.random().toString(36).substring(2, 12)}-IFTA-SEALED`,
                        };
                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Shift-Idle-Summary-${currentShift.id}-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('EXPORTED SHIFT IDLE & STOP SUMMARY REPORT');
                      }}
                      className="px-3 py-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37] text-[#D4AF37] rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>EXPORT SHIFT REPORT</span>
                    </button>
                  </div>
                </div>

                {/* SEGMENTED MOVING VS. IDLING VS. ENGINE OFF PROGRESS BAR */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold uppercase">SHIFT TIME UTILIZATION BREAKDOWN</span>
                    <span className="text-slate-400">Total Shift: {Math.floor(currentShift.totalShiftDurationMinutes / 60)}h {currentShift.totalShiftDurationMinutes % 60}m</span>
                  </div>

                  {/* Multi-Colored Segmented Bar */}
                  <div className="w-full h-7 bg-slate-900 rounded-lg overflow-hidden flex border border-slate-700 shadow-inner">
                    {/* Moving Time Segment */}
                    <div
                      style={{ width: `${currentShift.movingTimePercent}%` }}
                      className="bg-emerald-500 hover:bg-emerald-400 transition-all flex items-center justify-center text-black font-black text-[11px] select-none"
                      title={`Moving En Route: ${currentShift.movingTimePercent}% (${Math.floor(currentShift.movingTimeMinutes / 60)}h ${currentShift.movingTimeMinutes % 60}m)`}
                    >
                      {currentShift.movingTimePercent > 15 && `MOVING ${currentShift.movingTimePercent}%`}
                    </div>

                    {/* Idling Time Segment */}
                    <div
                      style={{ width: `${currentShift.idlingTimePercent}%` }}
                      className="bg-amber-400 hover:bg-amber-300 transition-all flex items-center justify-center text-black font-black text-[11px] select-none"
                      title={`Engine Idling: ${currentShift.idlingTimePercent}% (${currentShift.idlingTimeMinutes}m)`}
                    >
                      {currentShift.idlingTimePercent > 8 && `IDLE ${currentShift.idlingTimePercent}%`}
                    </div>

                    {/* Engine Off Stopped Segment */}
                    <div
                      style={{ width: `${currentShift.engineOffStoppedTimePercent}%` }}
                      className="bg-purple-600 hover:bg-purple-500 transition-all flex items-center justify-center text-white font-black text-[11px] select-none"
                      title={`Engine Off / APU: ${currentShift.engineOffStoppedTimePercent}% (${Math.floor(currentShift.engineOffStoppedTimeMinutes / 60)}h ${currentShift.engineOffStoppedTimeMinutes % 60}m)`}
                    >
                      {currentShift.engineOffStoppedTimePercent > 8 && `OFF/APU ${currentShift.engineOffStoppedTimePercent}%`}
                    </div>
                  </div>

                  {/* Legend Below Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                      <span className="text-white font-bold">MOVING TIME:</span>
                      <span className="text-emerald-400">{Math.floor(currentShift.movingTimeMinutes / 60)}h {currentShift.movingTimeMinutes % 60}m ({currentShift.movingTimePercent}%)</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                      <span className="text-white font-bold">ENGINE IDLE TIME:</span>
                      <span className="text-amber-400">{Math.floor(currentShift.idlingTimeMinutes / 60) > 0 ? `${Math.floor(currentShift.idlingTimeMinutes / 60)}h ` : ''}{currentShift.idlingTimeMinutes % 60}m ({currentShift.idlingTimePercent}%)</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded bg-purple-600 inline-block" />
                      <span className="text-white font-bold">ENGINE OFF / APU:</span>
                      <span className="text-purple-300">{Math.floor(currentShift.engineOffStoppedTimeMinutes / 60) > 0 ? `${Math.floor(currentShift.engineOffStoppedTimeMinutes / 60)}h ` : ''}{currentShift.engineOffStoppedTimeMinutes % 60}m ({currentShift.engineOffStoppedTimePercent}%)</span>
                    </div>
                  </div>
                </div>

                {/* FUEL, MILEAGE & FINANCIAL ROI METRICS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">DISTANCE DRIVEN</span>
                    <div className="text-xl font-black text-white mt-0.5">{currentShift.totalMilesDriven} <span className="text-xs text-slate-400">MILES</span></div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Avg Speed: {currentShift.avgMovingSpeedMph} MPH</span>
                  </div>

                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">MOVING FUEL USED</span>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">{currentShift.movingFuelConsumedGallons} <span className="text-xs text-slate-400">GAL</span></div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">~{(currentShift.totalMilesDriven / currentShift.movingFuelConsumedGallons).toFixed(1)} MPG Cruising</span>
                  </div>

                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">IDLE DIESEL WASTED</span>
                    <div className="text-xl font-black text-amber-400 mt-0.5">{currentShift.idleFuelWastedGallons} <span className="text-xs text-slate-400">GAL</span></div>
                    <span className="text-[10px] text-rose-400 block mt-0.5">${currentShift.idleFuelCostUsd} Lost to Idle</span>
                  </div>

                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">APU ROI SAVINGS POTENTIAL</span>
                    <div className="text-xl font-black text-[#D4AF37] mt-0.5">${currentShift.apuSavingsPotentialUsd}</div>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Score: {currentShift.overallShiftEfficiencyScore}/100</span>
                  </div>
                </div>

                {/* CHRONOLOGICAL STOP EVENTS LEDGER FOR THIS SHIFT */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-bold uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>CHRONOLOGICAL STOP EVENTS DURING SHIFT ({currentShift.stopEvents.length} RECORDED)</span>
                    </span>
                    <span className="text-slate-400">FMCSA &amp; Facility Verified</span>
                  </div>

                  <div className="space-y-2">
                    {currentShift.stopEvents.map((stop) => (
                      <div
                        key={stop.id}
                        className="bg-black/60 border border-slate-800 hover:border-[#D4AF37]/50 rounded-xl p-3.5 transition-all space-y-1.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-800 text-slate-200">
                              {stop.startedAtFormatted} → {stop.endedAtFormatted || 'Now'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              stop.stopCategory === 'DOCK_DETENTION' ? 'bg-amber-950 text-amber-300 border border-amber-600' :
                              stop.stopCategory === 'MANDATORY_30MIN_REST' ? 'bg-sky-950 text-sky-300 border border-sky-600' :
                              stop.stopCategory === 'FUEL_AND_DVIR' ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' :
                              stop.stopCategory === 'EXCESSIVE_IDLE' ? 'bg-rose-950 text-rose-300 border border-rose-600' :
                              'bg-purple-950 text-purple-300 border border-purple-600'
                            }`}>
                              {stop.stopCategory.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              stop.engineMode === 'IDLING' ? 'text-amber-400 font-bold' :
                              stop.engineMode === 'APU_ACTIVE' ? 'text-emerald-400' :
                              'text-purple-300'
                            }`}>
                              ● {stop.engineMode}
                            </span>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-white font-bold">{stop.durationMinutes} Minutes</span>
                            {stop.fuelCostUsd > 0 && (
                              <span className="text-amber-400 ml-2">(${stop.fuelCostUsd} / {stop.fuelWastedGallons} gal)</span>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-slate-300">
                          <strong>{stop.locationName}</strong>
                        </div>
                        <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                          {stop.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FMCSA & CARB COMPLIANCE POLICY CARD */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <Lock className="w-4 h-4 text-[#D4AF37]" />
              <span>FMCSA §395 &amp; CARB CLEAN IDLE ENFORCEMENT PROTOCOLS</span>
            </div>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>
                <strong>Engine Idle Standard:</strong> Commercial rigs operating in CA and 14 standard IFTA states face up to $300 fines for non-essential engine idling exceeding 5 consecutive minutes unless certified Clean Idle / APU equipped.
              </li>
              <li>
                <strong>Billable Detention Verification:</strong> Stop durations exceeding 120 minutes at customer shipping/receiving docks automatically append GPS timestamped geofence proof to broker invoices for detention reimbursement ($75/hr).
              </li>
              <li>
                <strong>FMCSA §395.3(a)(3)(ii) Rest Break:</strong> Property-carrying CMV drivers must take 30 consecutive minutes of non-driving duty status after 8 cumulative hours of driving.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: COLLISION BLACK BOX */}
      {activeTab === 'collisions' && (
        <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-black font-sans text-white uppercase">3-AXIS COLLISION & BLACK BOX RECORDER</h3>
              </div>
              <p className="text-sm text-slate-400 font-mono mt-1">
                Captures high-frequency 5-second pre-crash telemetry trace upon impact G-force threshold (&gt; 2.5g).
              </p>
            </div>
            <button
              onClick={() => triggerSimulatedCollision('CRASH_IMPACT')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>SIMULATE CRASH IMPACT TEST</span>
            </button>
          </div>

          {collisionLog.length === 0 ? (
            <div className="text-center py-12 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-white font-bold">NO COLLISION IMPACTS DETECTED</div>
              <div className="text-xs text-slate-400">Accelerometer shock buffer active. Standing by for impact telemetry.</div>
            </div>
          ) : (
            <div className="space-y-6">
              {collisionLog.map((crash) => (
                <div key={crash.id} className="bg-[#12151F] border border-purple-500/60 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-purple-950 border border-purple-500 rounded-lg text-purple-300 font-mono font-black text-lg">
                        {crash.impactG}G
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-bold font-mono text-base">{crash.locationName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-900 text-purple-300 border border-purple-500">
                            {crash.impactVector} IMPACT
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Speed at Impact: <strong className="text-white">{crash.speedAtImpactMph} MPH</strong> • GPS: {crash.latitude.toFixed(4)}° N, {crash.longitude.toFixed(4)}° W
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs text-slate-400">{crash.timeFormatted}</div>
                      <div className="flex items-center space-x-1 text-xs text-emerald-400 font-bold mt-1 justify-end">
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>eCall SOS Broadcast Sent</span>
                      </div>
                    </div>
                  </div>

                  {/* PRE-CRASH 5-SECOND BLACK BOX TELEMETRY TABLE */}
                  <div className="space-y-2 font-mono">
                    <div className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                      <Activity className="w-4 h-4 text-[#D4AF37]" />
                      <span>5-SECOND PRE-CRASH BLACK BOX TELEMETRY TRACE</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                            <th className="p-2">OFFSET</th>
                            <th className="p-2">SPEED (MPH)</th>
                            <th className="p-2">RPM</th>
                            <th className="p-2">THROTTLE %</th>
                            <th className="p-2">BRAKE PSI</th>
                            <th className="p-2">DECEL G</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {crash.preCrashBlackBox.map((pt, idx) => (
                            <tr key={idx} className={pt.timeOffsetSec === 0 ? 'bg-rose-950/40 text-rose-300 font-bold' : 'text-slate-300'}>
                              <td className="p-2">{pt.timeOffsetSec === 0 ? 'IMPACT (0.0s)' : `${pt.timeOffsetSec}s`}</td>
                              <td className="p-2">{pt.speedMph} MPH</td>
                              <td className="p-2">{pt.rpm}</td>
                              <td className="p-2">{pt.throttlePct}%</td>
                              <td className="p-2">{pt.brakePressurePsi} PSI</td>
                              <td className="p-2">{pt.gForceY}g</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 6: FMCSA §395 RULES & BENCH */}
      {activeTab === 'fmcsa_eld' && (
        <div className="bg-[#0C0E14] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 font-mono">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-6 h-6 text-[#D4AF37]" />
              <h3 className="text-xl font-black font-sans text-white uppercase">FMCSA ELD COMPLIANCE SPECIFICATIONS</h3>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Federal Motor Carrier Safety Administration (FMCSA) 49 CFR Part 395 Subpart B Technical Mandate Matrix.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-sm font-bold text-emerald-400">§ 395.26 - Automatic Motion Status</div>
              <p className="text-xs text-slate-300">
                An ELD must automatically determine whether a commercial motor vehicle is in motion or is stationary based on vehicle speed. Speed &gt; 5.0 MPH triggers driving mode instantaneously without driver intervention.
              </p>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-sm font-bold text-amber-400">§ 395.22 - Stationary 5-Minute Warning</div>
              <p className="text-xs text-slate-300">
                When a vehicle remains stationary for 5 consecutive minutes, the ELD must prompt the driver to confirm driving status or switch to another duty status (On-Duty Not Driving, Yard Move, or Personal Conveyance).
              </p>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-sm font-bold text-rose-400">49 CFR § 383.51 - Serious Speeding Violation</div>
              <p className="text-xs text-slate-300">
                Speeding 15 MPH or more above the posted speed limit is classified as a Serious Traffic Violation, triggering an automatic CDL disqualification review after two consecutive occurrences.
              </p>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="text-sm font-bold text-sky-400">SAE J1939 Engine Diagnostics Fusion</div>
              <p className="text-xs text-slate-300">
                Continuous polling of PGN 65265 (Cruise Control / Vehicle Speed), PGN 61444 (Electronic Engine Controller 1 / RPM), and PGN 65248 (Vehicle Distance) with sub-100ms latency.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
