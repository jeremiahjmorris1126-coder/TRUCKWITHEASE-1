// ============================================================================
// TRUCKWITHEASE TELEMATICS & ELD SAFETY ENGINE
// Industry-leading FMCSA §395 compliant telematics suite:
// - Harsh Braking Detection (> -0.35g / > -8.5 mph/s)
// - Speeding Sentinel & Duration Watchdog (1-5, 6-10, 11-14, 15+ FMCSA Serious Violation)
// - 3-Axis Collision & Crash Impact Pulse with 5s Pre-Crash Black Box
// - When Stopped & Stop Duration Stopwatch (00:00:00) + Idle Fuel Burn ($/gal)
// - Automated FMCSA §395.26 Driving ( >5 mph ) and 5-min Stationary On-Duty Prompts
// - CAN-bus SAE J1939 / GPS Telemetry Stream Fusion & Live Driver Safety Score (0-100)
// ============================================================================

export type MotionStatus = 'DRIVING' | 'ROLLING_SLOW' | 'STOPPED' | 'IDLING' | 'ACCELERATING' | 'DECELERATING';

export type SpeedingTier = 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL_DOT';

export interface GForceVector {
  x: number; // Lateral (+ Right, - Left)
  y: number; // Longitudinal (+ Accel, - Decel)
  z: number; // Vertical (+ Bump, - Drop)
  magnitude: number;
}

export interface HarshBrakingEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  latitude: number;
  longitude: number;
  locationName: string;
  initialSpeedMph: number;
  finalSpeedMph: number;
  speedDeltaMph: number;
  peakDecelG: number;
  durationMs: number;
  absTriggered: boolean;
  brakePressurePsi: number;
  severity: 'MODERATE' | 'SEVERE' | 'EMERGENCY_STOP';
  driverScoreImpact: number;
  notes: string;
}

export interface SpeedingEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  currentSpeedMph: number;
  speedLimitMph: number;
  deltaMph: number;
  tier: SpeedingTier;
  durationSeconds: number;
  location: string;
  dotCitationCode?: string; // e.g. '49 CFR §383.51 (Serious Traffic Violation)' if 15+
}

export interface HarshCorneringEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  lateralG: number;
  speedMph: number;
  direction: 'LEFT' | 'RIGHT';
  location: string;
  rollAngleDeg: number;
  severity: 'MODERATE' | 'SEVERE';
}

export interface CollisionEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  latitude: number;
  longitude: number;
  locationName: string;
  impactG: number;
  speedAtImpactMph: number;
  impactVector: 'FRONTAL' | 'REAR' | 'SIDE_LEFT' | 'SIDE_RIGHT' | 'ROLLOVER';
  eCallTriggered: boolean;
  sosDispatched: boolean;
  preCrashBlackBox: {
    timeOffsetSec: number;
    speedMph: number;
    rpm: number;
    throttlePct: number;
    brakePressurePsi: number;
    gForceY: number;
  }[];
  notes: string;
}

export interface ShiftStopEvent {
  id: string;
  startedAt: number;
  startedAtFormatted: string;
  endedAtFormatted?: string;
  durationMinutes: number;
  locationName: string;
  latitude: number;
  longitude: number;
  stopCategory:
    | 'EXCESSIVE_IDLE'
    | 'DOCK_DETENTION'
    | 'TRAFFIC_CONGESTION'
    | 'MANDATORY_30MIN_REST'
    | 'FUEL_AND_DVIR'
    | 'ENGINE_OFF_PARKED'
    | 'WEIGH_STATION';
  engineMode: 'IDLING' | 'ENGINE_OFF' | 'APU_ACTIVE';
  fuelWastedGallons: number;
  fuelCostUsd: number;
  co2EmittedLbs: number;
  notes: string;
}

export interface DriverDailyShiftSummary {
  id: string;
  shiftDate: string;
  shiftLabel: string;
  driverName: string;
  truckUnit: string;
  shiftStartTime: string;
  shiftEndTime: string;
  totalShiftDurationMinutes: number;
  movingTimeMinutes: number;
  movingTimePercent: number;
  idlingTimeMinutes: number;
  idlingTimePercent: number;
  engineOffStoppedTimeMinutes: number;
  engineOffStoppedTimePercent: number;
  totalMilesDriven: number;
  avgMovingSpeedMph: number;
  movingFuelConsumedGallons: number;
  idleFuelWastedGallons: number;
  idleFuelCostUsd: number;
  apuSavingsPotentialUsd: number;
  stopEvents: ShiftStopEvent[];
  cleanIdleCompliance: boolean;
  overallShiftEfficiencyScore: number;
}

export const INITIAL_SHIFT_SUMMARIES: DriverDailyShiftSummary[] = [
  {
    id: 'shift-today',
    shiftDate: 'Today (Live Shift)',
    shiftLabel: 'Current Shift · I-80 EB Corridor',
    driverName: 'Marcus Kowalski (PA-CDL-9048123)',
    truckUnit: 'UNIT #104-E · 2024 Freightliner Cascadia DD15',
    shiftStartTime: '06:00 EDT',
    shiftEndTime: 'Active En Route',
    totalShiftDurationMinutes: 442, // ~7h 22m
    movingTimeMinutes: 358,        // ~5h 58m (81.0%)
    movingTimePercent: 81.0,
    idlingTimeMinutes: 46,         // ~46m (10.4%)
    idlingTimePercent: 10.4,
    engineOffStoppedTimeMinutes: 38,// ~38m (8.6%)
    engineOffStoppedTimePercent: 8.6,
    totalMilesDriven: 362.4,
    avgMovingSpeedMph: 60.7,
    movingFuelConsumedGallons: 47.6,
    idleFuelWastedGallons: 0.65,
    idleFuelCostUsd: 2.50,
    apuSavingsPotentialUsd: 1.85,
    cleanIdleCompliance: false, // > 10% slightly
    overallShiftEfficiencyScore: 92,
    stopEvents: [
      {
        id: 'stop-01',
        startedAt: Date.now() - 3600000 * 5.2,
        startedAtFormatted: '07:48 EDT',
        endedAtFormatted: '08:02 EDT',
        durationMinutes: 14,
        locationName: 'I-80 E Exit 161 (Milesburg Pilot Flying J)',
        latitude: 40.941,
        longitude: -77.794,
        stopCategory: 'FUEL_AND_DVIR',
        engineMode: 'ENGINE_OFF',
        fuelWastedGallons: 0.0,
        fuelCostUsd: 0.0,
        co2EmittedLbs: 0.0,
        notes: 'Pre-trip safety walkthrough & 120 Gallon DEF top-off.',
      },
      {
        id: 'stop-02',
        startedAt: Date.now() - 3600000 * 3.4,
        startedAtFormatted: '09:35 EDT',
        endedAtFormatted: '10:09 EDT',
        durationMinutes: 34,
        locationName: 'I-80 E MM 188 Rest Area (Loganton, PA)',
        latitude: 41.042,
        longitude: -77.319,
        stopCategory: 'MANDATORY_30MIN_REST',
        engineMode: 'APU_ACTIVE',
        fuelWastedGallons: 0.08,
        fuelCostUsd: 0.31,
        co2EmittedLbs: 1.79,
        notes: 'FMCSA §395.3(a)(3)(ii) mandatory 30-minute uninterrupted rest break. Auxiliary APU active.',
      },
      {
        id: 'stop-03',
        startedAt: Date.now() - 3600000 * 1.8,
        startedAtFormatted: '11:12 EDT',
        endedAtFormatted: '11:48 EDT',
        durationMinutes: 36,
        locationName: 'Crossroads Logistics Hub · Receiving Gate #4',
        latitude: 41.135,
        longitude: -76.892,
        stopCategory: 'DOCK_DETENTION',
        engineMode: 'IDLING',
        fuelWastedGallons: 0.51,
        fuelCostUsd: 1.96,
        co2EmittedLbs: 11.41,
        notes: 'Excessive high idle at security check-in gate awaiting guard clearance. Billable detention logged.',
      },
    ],
  },
  {
    id: 'shift-yesterday',
    shiftDate: 'Yesterday (Sep 28)',
    shiftLabel: 'Allentown, PA → Columbus, OH (Completed 14h Shift)',
    driverName: 'Marcus Kowalski (PA-CDL-9048123)',
    truckUnit: 'UNIT #104-E · 2024 Freightliner Cascadia DD15',
    shiftStartTime: '05:30 EDT',
    shiftEndTime: '18:50 EDT',
    totalShiftDurationMinutes: 800, // 13h 20m
    movingTimeMinutes: 624,        // 10h 24m (78.0%)
    movingTimePercent: 78.0,
    idlingTimeMinutes: 52,         // 52m (6.5%)
    idlingTimePercent: 6.5,
    engineOffStoppedTimeMinutes: 124,// 2h 04m (15.5%)
    engineOffStoppedTimePercent: 15.5,
    totalMilesDriven: 618.2,
    avgMovingSpeedMph: 59.4,
    movingFuelConsumedGallons: 81.3,
    idleFuelWastedGallons: 0.74,
    idleFuelCostUsd: 2.85,
    apuSavingsPotentialUsd: 2.10,
    cleanIdleCompliance: true, // < 10% target met!
    overallShiftEfficiencyScore: 97,
    stopEvents: [
      {
        id: 'stop-y-01',
        startedAt: Date.now() - 86400000 - 3600000 * 10,
        startedAtFormatted: '07:15 EDT',
        endedAtFormatted: '07:35 EDT',
        durationMinutes: 20,
        locationName: 'I-80 W Exit 120 (Clearfield, PA TA Petro)',
        latitude: 41.054,
        longitude: -78.432,
        stopCategory: 'FUEL_AND_DVIR',
        engineMode: 'ENGINE_OFF',
        fuelWastedGallons: 0.0,
        fuelCostUsd: 0.0,
        co2EmittedLbs: 0.0,
        notes: 'Pre-trip inspection & 150 Gal Diesel #2 fill.',
      },
      {
        id: 'stop-y-02',
        startedAt: Date.now() - 86400000 - 3600000 * 6,
        startedAtFormatted: '11:40 EDT',
        endedAtFormatted: '12:25 EDT',
        durationMinutes: 45,
        locationName: 'I-80 W MM 48 Travel Plaza',
        latitude: 41.178,
        longitude: -79.821,
        stopCategory: 'MANDATORY_30MIN_REST',
        engineMode: 'ENGINE_OFF',
        fuelWastedGallons: 0.0,
        fuelCostUsd: 0.0,
        co2EmittedLbs: 0.0,
        notes: 'Driver meal & DOT 30-min compliance rest.',
      },
      {
        id: 'stop-y-03',
        startedAt: Date.now() - 86400000 - 3600000 * 2,
        startedAtFormatted: '15:10 EDT',
        endedAtFormatted: '16:02 EDT',
        durationMinutes: 52,
        locationName: 'Midwest Logistics Center · Dock 18',
        latitude: 40.012,
        longitude: -83.082,
        stopCategory: 'DOCK_DETENTION',
        engineMode: 'IDLING',
        fuelWastedGallons: 0.74,
        fuelCostUsd: 2.85,
        co2EmittedLbs: 16.56,
        notes: 'Live unload. Engine high idle to maintain cab climate before APU engaged.',
      },
    ],
  },
  {
    id: 'shift-sep27',
    shiftDate: 'Sep 27, 2026',
    shiftLabel: 'Cleveland, OH → Pittsburgh, PA (Regional Turn)',
    driverName: 'Marcus Kowalski (PA-CDL-9048123)',
    truckUnit: 'UNIT #104-E · 2024 Freightliner Cascadia DD15',
    shiftStartTime: '07:00 EDT',
    shiftEndTime: '17:15 EDT',
    totalShiftDurationMinutes: 615, // 10h 15m
    movingTimeMinutes: 472,        // 7h 52m (76.7%)
    movingTimePercent: 76.7,
    idlingTimeMinutes: 88,         // 1h 28m (14.3%)
    idlingTimePercent: 14.3,
    engineOffStoppedTimeMinutes: 55,// 55m (8.9%)
    engineOffStoppedTimePercent: 8.9,
    totalMilesDriven: 442.0,
    avgMovingSpeedMph: 56.2,
    movingFuelConsumedGallons: 58.9,
    idleFuelWastedGallons: 1.25,
    idleFuelCostUsd: 4.81,
    apuSavingsPotentialUsd: 3.65,
    cleanIdleCompliance: false,
    overallShiftEfficiencyScore: 84,
    stopEvents: [
      {
        id: 'stop-p-01',
        startedAt: Date.now() - 86400000 * 2 - 3600000 * 6,
        startedAtFormatted: '09:20 EDT',
        endedAtFormatted: '10:05 EDT',
        durationMinutes: 45,
        locationName: 'PA Turnpike I-76 MM 28 Gateway Plaza',
        latitude: 40.812,
        longitude: -80.392,
        stopCategory: 'TRAFFIC_CONGESTION',
        engineMode: 'IDLING',
        fuelWastedGallons: 0.64,
        fuelCostUsd: 2.46,
        co2EmittedLbs: 14.32,
        notes: 'Turnpike construction bottleneck standstill.',
      },
      {
        id: 'stop-p-02',
        startedAt: Date.now() - 86400000 * 2 - 3600000 * 2,
        startedAtFormatted: '13:30 EDT',
        endedAtFormatted: '14:13 EDT',
        durationMinutes: 43,
        locationName: 'Steel City Distribution · Bay 07',
        latitude: 40.441,
        longitude: -79.995,
        stopCategory: 'EXCESSIVE_IDLE',
        engineMode: 'IDLING',
        fuelWastedGallons: 0.61,
        fuelCostUsd: 2.35,
        co2EmittedLbs: 13.65,
        notes: 'Excessive high idle during paper BOL processing.',
      },
    ],
  },
];


export interface GeolocationSpeedZone {
  id: string;
  roadName: string;
  zoneType: string;
  state: string;
  speedLimitMph: number;
  truckSpeedLimitMph: number;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  description: string;
}

export const GEOLOCATION_SPEED_ZONES: GeolocationSpeedZone[] = [
  {
    id: 'zone-i80-workzone',
    roadName: 'I-80 W (Lock Haven Corridor)',
    zoneType: 'Active Work Zone (Double Fines)',
    state: 'PA',
    speedLimitMph: 55,
    truckSpeedLimitMph: 55,
    latMin: 41.18,
    latMax: 41.28,
    lngMin: -78.05,
    lngMax: -77.80,
    description: 'Pavement rehabilitation & bridge deck reconstruction. Reduced statutory limit with Doppler radar enforcement.',
  },
  {
    id: 'zone-i80-mountain',
    roadName: 'I-80 Snow Shoe Mountain Pass',
    zoneType: 'Mountain Grade Downgrade Zone',
    state: 'PA',
    speedLimitMph: 50,
    truckSpeedLimitMph: 50,
    latMin: 40.95,
    latMax: 41.10,
    lngMin: -78.25,
    lngMax: -77.95,
    description: 'Steep 6% downgrade with runaway truck ramp. Mandatory CMV brake cooling speed threshold.',
  },
  {
    id: 'zone-logistics-spur',
    roadName: 'Logistics Parkway / Terminal Spur',
    zoneType: 'Commercial Freight Terminal Zone',
    state: 'PA',
    speedLimitMph: 35,
    truckSpeedLimitMph: 35,
    latMin: 41.10,
    latMax: 41.16,
    lngMin: -77.75,
    lngMax: -77.68,
    description: 'Distribution hub access road and truck staging approach.',
  },
  {
    id: 'zone-us30',
    roadName: 'US-30 Industrial Highway',
    zoneType: 'Divided Arterial Highway',
    state: 'OH / PA',
    speedLimitMph: 55,
    truckSpeedLimitMph: 55,
    latMin: 40.60,
    latMax: 41.00,
    lngMin: -83.50,
    lngMax: -80.00,
    description: 'Semi-rural industrial corridor with commercial intersections.',
  },
  {
    id: 'zone-i80-standard',
    roadName: 'I-80 Interstate Trunk Line',
    zoneType: 'Interstate Highway Corridor',
    state: 'PA',
    speedLimitMph: 65,
    truckSpeedLimitMph: 65,
    latMin: 40.50,
    latMax: 42.50,
    lngMin: -82.00,
    lngMax: -75.00,
    description: 'Standard 4-lane interstate commercial freight corridor.',
  },
];

export function fetchLocalSpeedLimitByGps(lat: number, lng: number): {
  speedLimitMph: number;
  roadName: string;
  zoneType: string;
  state: string;
  description: string;
} {
  for (const zone of GEOLOCATION_SPEED_ZONES) {
    if (
      lat >= zone.latMin &&
      lat <= zone.latMax &&
      lng >= zone.lngMin &&
      lng <= zone.lngMax
    ) {
      return {
        speedLimitMph: zone.speedLimitMph,
        roadName: zone.roadName,
        zoneType: zone.zoneType,
        state: zone.state,
        description: zone.description,
      };
    }
  }

  return {
    speedLimitMph: 65,
    roadName: 'I-80 Interstate Corridor',
    zoneType: 'Interstate Highway',
    state: 'PA',
    description: 'Standard FMCSA Commercial Vehicle Interstate Speed Limit.',
  };
}

export interface TelematicsTelemetryState {
  currentSpeedMph: number;
  speedLimitMph: number;
  speedDeltaMph: number;
  isSpeeding: boolean;
  speedingTier: SpeedingTier;
  speedingDurationSeconds: number;
  totalSpeedingTimeMinutes: number;

  gps: { lat: number; lng: number };
  roadName: string;
  zoneType: string;
  continuousSpeedingDurationSec: number;
  isHighSeveritySpeedAlertActive: boolean;

  motionStatus: MotionStatus;
  isStopped: boolean;
  stoppedSinceTimestamp: number | null;
  stoppedDurationSeconds: number;
  totalStoppedDurationSeconds: number;

  isIdling: boolean;
  idleDurationSeconds: number;
  idleFuelWastedGallons: number;
  idleFuelCostUsd: number;
  co2EmittedLbs: number;

  engineRpm: number;
  throttlePct: number;
  brakePressurePsi: number;
  gear: string;
  engineLoadPct: number;
  coolantTempF: number;
  fuelLevelPct: number;

  gForce: GForceVector;
  rollAngleDeg: number;
  pitchAngleDeg: number;

  driverSafetyScore: number; // 0 - 100
  driverSafetyGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  harshBrakeCount: number;
  harshCornerCount: number;
  harshAccelCount: number;
  speedingIncidentCount: number;
  collisionIncidentCount: number;

  fmcsaPromptRemainingSec: number | null; // 60s countdown when stopped for 5 min
  fmcsaCurrentDutyStatus: 'DRIVING' | 'ON_DUTY' | 'OFF_DUTY' | 'SLEEPER' | 'YARD_MOVE' | 'PERSONAL_CONVEYANCE';

  lastHarshBrake: HarshBrakingEvent | null;
  lastCollision: CollisionEvent | null;
}

// Initial state for telematics engine
export const createInitialTelematicsState = (): TelematicsTelemetryState => ({
  currentSpeedMph: 64.2,
  speedLimitMph: 65,
  speedDeltaMph: -0.8,
  isSpeeding: false,
  speedingTier: 'NONE',
  speedingDurationSeconds: 0,
  totalSpeedingTimeMinutes: 1.4,

  gps: { lat: 41.135, lng: -77.72 },
  roadName: 'I-80 Interstate Trunk Line',
  zoneType: 'Interstate Highway Corridor',
  continuousSpeedingDurationSec: 0,
  isHighSeveritySpeedAlertActive: false,

  motionStatus: 'DRIVING',
  isStopped: false,
  stoppedSinceTimestamp: null,
  stoppedDurationSeconds: 0,
  totalStoppedDurationSeconds: 1240,

  isIdling: false,
  idleDurationSeconds: 0,
  idleFuelWastedGallons: 0.18,
  idleFuelCostUsd: 0.69,
  co2EmittedLbs: 4.03,

  engineRpm: 1280,
  throttlePct: 42,
  brakePressurePsi: 0,
  gear: '11th Auto',
  engineLoadPct: 58,
  coolantTempF: 194,
  fuelLevelPct: 76,

  gForce: { x: 0.02, y: 0.01, z: 0.99, magnitude: 1.0 },
  rollAngleDeg: 0.4,
  pitchAngleDeg: -0.2,

  driverSafetyScore: 94,
  driverSafetyGrade: 'A',

  harshBrakeCount: 1,
  harshCornerCount: 0,
  harshAccelCount: 2,
  speedingIncidentCount: 1,
  collisionIncidentCount: 0,

  fmcsaPromptRemainingSec: null,
  fmcsaCurrentDutyStatus: 'DRIVING',

  lastHarshBrake: {
    id: 'hb-sample-01',
    timestamp: Date.now() - 3600000 * 2.4,
    timeFormatted: new Date(Date.now() - 3600000 * 2.4).toLocaleTimeString(),
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
    notes: 'Cutoff by merging 4-wheeler on wet asphalt. ABS modulated brake chamber air.',
  },
  lastCollision: null,
});

// Format seconds into HH:MM:SS or MM:SS
export function formatDurationHMS(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Compute Safety Grade from Score
export function computeSafetyGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 97) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// Diesel burn rate constants (Class 8 standard 15L DD15 / Cummins X15)
export const IDLE_FUEL_GALLONS_PER_HOUR = 0.85;
export const DIESEL_PRICE_PER_GALLON_USD = 3.85;
export const CO2_LBS_PER_GALLON = 22.38;

// Telematics safety audio chimes generator via Web Audio API
export function playTelematicsSoundAlert(type: 'HARSH_BRAKE' | 'SPEEDING' | 'HIGH_SEVERITY_SPEED' | 'COLLISION' | 'STOPPED_5MIN' | 'DUTY_SWITCH') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    if (type === 'HARSH_BRAKE') {
      // Rapid descending warning pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'HIGH_SEVERITY_SPEED') {
      // Urgent staccato alternating frequency pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.setValueAtTime(1400, now + 0.09);
      osc.frequency.setValueAtTime(1100, now + 0.18);
      osc.frequency.setValueAtTime(1400, now + 0.27);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (type === 'SPEEDING') {
      // High-frequency dual chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.setValueAtTime(1200, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'COLLISION') {
      // Urgent siren burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.2);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.4);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'STOPPED_5MIN') {
      // Soft attention triple-tone
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.2, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.01, now + (idx + 1) * 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + (idx + 1) * 0.12);
      });
    } else if (type === 'DUTY_SWITCH') {
      // Positive confirm chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Audio context fallback
  }
}
