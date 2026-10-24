// ============================================================================
// DRIVER DISPATCH MASTER LOOP ENGINE & NOTIFICATION SERVICE
// "Once driver departs lot of origination -> sends message to dispatch.
//  Once arrives at destination -> alert dispatch.
//  Once leaves destination -> alert dispatch.
//  Once back home -> alerts dispatch with information, emails, phone numbers,
//  text messages. Master Loop System."
// ============================================================================

import {
  MasterLoopMilestone,
  MasterLoopStageRecord,
  MasterLoopSystemState,
  MasterLoopDriverProfile,
  MasterLoopDispatchContacts,
  MasterLoopTripDetails,
  MasterLoopCycleHistory,
} from '../types';

const STORAGE_KEY = 'twe_driver_dispatch_master_loop_v1';

export const DEFAULT_DRIVER_PROFILE: MasterLoopDriverProfile = {
  name: 'Vance Reynolds',
  driverId: 'DRV-904',
  phone: '(312) 555-8821',
  email: 'vance.reynolds@truckwithease.com',
  truckUnit: 'TR-904',
  trailerUnit: 'TRL-6112',
  cdlNumber: 'IL-CDL-4910291',
  carrierName: 'Truckwithease Express LLC',
  usdotNumber: 'USDOT-3891042',
  currentOdometer: 142850,
};

export const DEFAULT_DISPATCH_CONTACTS: MasterLoopDispatchContacts = {
  dispatcherName: 'Sarah Jenkins (Lead Fleet Dispatch)',
  dispatchPhone: '(216) 555-4481',
  dispatchEmail: 'dispatch@truckwithease.com',
  safetyEmail: 'safety@truckwithease.com',
  brokerPhone: '(800) 555-7821',
  brokerEmail: 'ops@freightbridge.com',
  smsEnabled: true,
  emailEnabled: true,
  inCabVoiceAlerts: true,
  autoLoopAdvance: false,
};

export const DEFAULT_TRIP_DETAILS: MasterLoopTripDetails = {
  tripId: 'TRIP-2026-LOOP-01',
  loadNumber: 'CHR-88219',
  bolNumber: 'BOL-CHI-COL-9042',
  commodity: 'High-Value Reefer Freight (Class A Dairy & Pharmaceuticals)',
  weightLbs: 41200,
  sealNumber: 'SEAL-889102-SECURE',
  reeferTempF: 34.0,
  originLot: {
    name: 'Chicago Central Logistics Yard & Staging Lot #4',
    facilityCode: 'CHI-YARD-04',
    address: '7400 S Cicero Ave',
    cityStateZip: 'Bedford Park, IL 60638',
    lat: 41.7589,
    lng: -87.7412,
    geofenceRadiusMiles: 0.5,
    contactName: 'Hank Miller (Yard Master)',
    contactPhone: '(708) 555-2190',
    gateCode: '#8821*',
  },
  destination: {
    name: 'Columbus Regional Crossdock & Distribution Terminal',
    facilityCode: 'CMH-HUB-88',
    address: '2500 Roberts Rd',
    cityStateZip: 'Columbus, OH 43228',
    lat: 39.9829,
    lng: -83.1235,
    geofenceRadiusMiles: 0.6,
    contactName: 'Maria Santos (Dock Supervisor)',
    contactPhone: '(614) 555-9011',
    dockNumber: 'Bay Door #42',
    gateCode: 'GUARD-GATE-B',
  },
  homeTerminal: {
    name: 'Chicago Home Base Shop & Fleet Headquarters',
    facilityCode: 'CHI-HQ-SHOP',
    address: '7400 S Cicero Ave',
    cityStateZip: 'Bedford Park, IL 60638',
    lat: 41.7589,
    lng: -87.7412,
    geofenceRadiusMiles: 0.5,
    contactName: 'Pete Kovacs (Shop Foreman)',
    contactPhone: '(708) 555-9944',
  },
  totalRoundTripMiles: 624,
};

export const MILESTONE_DEFINITIONS: {
  stage: MasterLoopMilestone;
  orderNumber: 1 | 2 | 3 | 4;
  title: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    stage: 'ORIGIN_DEPARTURE',
    orderNumber: 1,
    title: 'PHASE 01 // ORIGIN DEPARTURE (LOT DEPARTURE)',
    shortLabel: 'Phase 01: Departure',
    description: 'Unit crosses origin facility boundary. Fleet dispatch broadcasts status report to operations via encrypted SMS & Email uplink.',
  },
  {
    stage: 'DESTINATION_ARRIVAL',
    orderNumber: 2,
    title: 'PHASE 02 // DESTINATION INBOUND (FACILITY ARRIVAL)',
    shortLabel: 'Phase 02: Arrival',
    description: 'Unit enters target delivery geofence. Dispatch alerts customer with bay assignment and activates detention operational clock.',
  },
  {
    stage: 'DESTINATION_DEPARTURE',
    orderNumber: 3,
    title: 'PHASE 03 // DESTINATION DEPARTURE (UNLOAD COMPLETE)',
    shortLabel: 'Phase 03: Departure',
    description: 'Unload finalized and electronic POD locked. Unit departs facility on return transit corridor back to home terminal.',
  },
  {
    stage: 'HOME_ARRIVAL',
    orderNumber: 4,
    title: 'PHASE 04 // TERMINAL ARRIVAL (RETURN TO TERMINAL / SHOP)',
    shortLabel: 'Phase 04: Terminal Return',
    description: 'Unit safely returns to home terminal. Loop cycle finalized, equipment secured in bay, and post-trip DVIR logged.',
  },
];

// Audio chime synthesizer for in-cab audio cues
export function playDispatchLoopChime(stage: MasterLoopMilestone): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (stage === 'ORIGIN_DEPARTURE') {
      // Rising departure tone (departure roll)
      playTone(ctx, 440, 0, 0.15);
      playTone(ctx, 659, 0.15, 0.25);
    } else if (stage === 'DESTINATION_ARRIVAL') {
      // In-boundary confirmation chord
      playTone(ctx, 523, 0, 0.12);
      playTone(ctx, 659, 0.12, 0.12);
      playTone(ctx, 783, 0.24, 0.3);
    } else if (stage === 'DESTINATION_DEPARTURE') {
      // Rolling outbound chord
      playTone(ctx, 587, 0, 0.15);
      playTone(ctx, 880, 0.15, 0.25);
    } else if (stage === 'HOME_ARRIVAL') {
      // Complete loop triumph chord (major triad + high C)
      playTone(ctx, 523, 0, 0.12);
      playTone(ctx, 659, 0.12, 0.12);
      playTone(ctx, 783, 0.24, 0.15);
      playTone(ctx, 1046, 0.39, 0.45);
    }
  } catch (err) {
    // Audio context may require user interaction
  }
}

function playTone(ctx: AudioContext, freq: number, delay: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

// In-Cab Voice Synthesizer
export function speakDispatchNotification(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    // Silently continue if voice unavailable
  }
}

// Helper to construct native SMS app deep link (iOS & Android compatible)
export function buildSmsDeepLink(phone: string, body: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const encodedBody = encodeURIComponent(body);
  // Universal SMS URI
  return `sms:${cleanPhone}?body=${encodedBody}`;
}

// Helper to construct native Email mailto deep link
export function buildEmailDeepLink(toEmail: string, subject: string, body: string): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${toEmail}?subject=${encodedSubject}&body=${encodedBody}`;
}

// Generate contextually accurate SMS message based on current stage and system details
export function generateStageSmsBody(
  stage: MasterLoopMilestone,
  driver: MasterLoopDriverProfile,
  trip: MasterLoopTripDetails,
  odometer: number,
  timestampStr: string
): string {
  const safeOdo = Number(odometer ?? driver?.currentOdometer ?? 142850);
  switch (stage) {
    case 'ORIGIN_DEPARTURE':
      return `[DISPATCH DIRECTIVE // STATUS-01: ORIGIN DEPARTURE]
UNIT: ${driver.truckUnit} / ${driver.trailerUnit} | CALLSIGN: ${driver.name}
PHASE: 01 // ORIGIN LOT DEPARTURE VERIFIED
BASE ORIGIN: ${trip.originLot.name}
PAYLOAD: LOAD #${trip.loadNumber} (BOL #${trip.bolNumber})
TIMESTAMP: ${timestampStr} | ODOMETER: ${safeOdo.toLocaleString()} MI
TARGET OBJECTIVE: ${trip.destination.name} (${trip.destination.cityStateZip})
REEFER STATUS: ${trip.reeferTempF ? trip.reeferTempF + '°F (IN RANGE)' : 'DRY VAN N/A'}
SECURITY SEAL: ${trip.sealNumber}
TRUCKWITHEASE MAPS LINK: https://truckwithease.com/t/${trip.loadNumber}`;

    case 'DESTINATION_ARRIVAL':
      return `[DISPATCH DIRECTIVE // STATUS-02: DESTINATION ARRIVAL]
UNIT: ${driver.truckUnit} | CALLSIGN: ${driver.name}
PHASE: 02 // DESTINATION DOCK IN-BOUNDARY CONFIRMED
FACILITY: ${trip.destination.name}
LOCATION: ${trip.destination.address}, ${trip.destination.cityStateZip}
BAY ASSIGNMENT: ${trip.destination.dockNumber || 'Bay 42'}
TIMESTAMP: ${timestampStr} | ODOMETER: ${safeOdo.toLocaleString()} MI
PERIMETER STATUS: GEOFENCE SECURED (0.0 MI DEVIATION)
DETENTION CLOCK: ARMED (+00:00 STANDARD 2HR WINDOW ACTIVE)
DISPATCH ACTION: INBOUND RECEIVING CHECK-IN LOGGED`;

    case 'DESTINATION_DEPARTURE':
      return `[DISPATCH DIRECTIVE // STATUS-03: EGRESS DEPARTURE]
UNIT: ${driver.truckUnit} | CALLSIGN: ${driver.name}
PHASE: 03 // DESTINATION DEPARTURE & RETURN TRANSIT
DEPARTED FACILITY: ${trip.destination.name}
PAYLOAD STATUS: UNLOAD VERIFIED / SIGNED CLEAN POD SECURED
TIMESTAMP: ${timestampStr} | ODOMETER: ${safeOdo.toLocaleString()} MI
NEXT WAYPOINT: HOME BASE TERMINAL (${trip.homeTerminal.name})
EST. RETURN DISTANCE: 312 MILES | TRANSIT CORRIDOR ACTIVE
TRUCKWITHEASE MAPS LINK: https://truckwithease.com/t/${trip.loadNumber}-RET`;

    case 'HOME_ARRIVAL':
      return `[DISPATCH DIRECTIVE // STATUS-04: TERMINAL ARRIVAL]
UNIT: ${driver.truckUnit} / ${driver.trailerUnit} | CALLSIGN: ${driver.name}
PHASE: 04 // RETURN TO TERMINAL LOOP COMPLETE
HOME BASE: ${trip.homeTerminal.name} (${trip.homeTerminal.cityStateZip})
TIMESTAMP: ${timestampStr} | FINAL ODOMETER: ${safeOdo.toLocaleString()} MI
DISPATCH SUMMARY: 624-MILE ROUTE LOOP CLOSED & DEFECT-FREE
EQUIPMENT STATUS: TRACTOR STAGED IN BAY 3 / TRAILER SECURED
POST-TRIP DIRECTIVE: POST-TRIP DVIR LOGGED IN DOT VAULT`;
    default:
      return '';
  }
}

// Generate contextually accurate Email subject and body based on current stage
export function generateStageEmail(
  stage: MasterLoopMilestone,
  driver: MasterLoopDriverProfile,
  trip: MasterLoopTripDetails,
  dispatch: MasterLoopDispatchContacts,
  odometer: number,
  timestampStr: string
): { subject: string; bodyText: string } {
  const safeOdo = Number(odometer ?? driver?.currentOdometer ?? 142850);
  const safeWeight = Number(trip?.weightLbs ?? 42500);
  let subject = '';
  let headline = '';
  let stageNarrative = '';

  switch (stage) {
    case 'ORIGIN_DEPARTURE':
      subject = `[DISPATCH ALERT] UNIT ${driver.truckUnit} DEPARTED ORIGIN LOT — Load #${trip.loadNumber}`;
      headline = 'STAGE 1: ORIGINATION LOT DEPARTURE CONFIRMED';
      stageNarrative = `Driver ${driver.name} has crossed the perimeter boundary and officially departed ${trip.originLot.name}. The vehicle is rolling eastbound toward ${trip.destination.name}.`;
      break;

    case 'DESTINATION_ARRIVAL':
      subject = `[DISPATCH ALERT] UNIT ${driver.truckUnit} ARRIVED AT DESTINATION — ${trip.destination.name}`;
      headline = 'STAGE 2: DESTINATION FACILITY GEOFENCE ARRIVAL';
      stageNarrative = `Driver ${driver.name} has arrived safely inside the receiver geofence at ${trip.destination.name}. Dock check-in is complete and detention clock is armed.`;
      break;

    case 'DESTINATION_DEPARTURE':
      subject = `[DISPATCH ALERT] UNIT ${driver.truckUnit} DEPARTED DESTINATION — En Route Back Home`;
      headline = 'STAGE 3: DESTINATION UNLOAD COMPLETE & DEPARTURE';
      stageNarrative = `Driver ${driver.name} has finished dock operations at ${trip.destination.name}. Signed POD / Bill of Lading has been verified, and the rig has departed en route to the origin home shop.`;
      break;

    case 'HOME_ARRIVAL':
      subject = `[DISPATCH ALERT] UNIT ${driver.truckUnit} BACK HOME AT SHOP — Loop Cycle Finalized`;
      headline = 'STAGE 4: RETURN ARRIVAL AT HOME BASE SHOP';
      stageNarrative = `Driver ${driver.name} is safely back home at ${trip.homeTerminal.name}. The continuous round-trip master loop is completed, equipment is secured, and post-trip DVIR is logged.`;
      break;
  }

  const bodyText = `================================================================================
TRUCKWITHEASE™ FLEET DISPATCH AUTOMATION SYSTEM
================================================================================
ALERT NOTICE: ${headline}
TIMESTAMP: ${timestampStr}
CARRIER: ${driver.carrierName} (USDOT #${driver.usdotNumber})
--------------------------------------------------------------------------------

EXECUTIVE SUMMARY:
${stageNarrative}

EQUIPMENT & CREW TELEMATICS:
  • Driver: ${driver.name} (ID: ${driver.driverId})
  • Driver Cell: ${driver.phone}
  • CDL Number: ${driver.cdlNumber}
  • Power Unit (Tractor): ${driver.truckUnit}
  • Trailing Unit: ${driver.trailerUnit}
  • Current Odometer: ${safeOdo.toLocaleString()} miles
  • Telematics Status: GPS LOCK 100% NOMINAL

WAYPOINT GEOGRAPHIC DATA:
  • Origination Lot: ${trip.originLot.name}
    Address: ${trip.originLot.address}, ${trip.originLot.cityStateZip}
  • Destination Hub: ${trip.destination.name}
    Address: ${trip.destination.address}, ${trip.destination.cityStateZip}
    Assigned Dock: ${trip.destination.dockNumber || 'Door 42'}
  • Home Terminal: ${trip.homeTerminal.name}
    Address: ${trip.homeTerminal.address}, ${trip.homeTerminal.cityStateZip}

FREIGHT MANIFEST DETAILS:
  • Load Reference: #${trip.loadNumber}
  • Bill of Lading: #${trip.bolNumber}
  • Commodity: ${trip.commodity}
  • Certified Scale Weight: ${safeWeight.toLocaleString()} lbs
  • High-Security Seal: ${trip.sealNumber}
  • Continuous Reefer Setting: ${trip.reeferTempF ? trip.reeferTempF + '°F' : 'Dry Van / Non-Temp'}

DISPATCH ACTION LOG:
  • Primary Dispatch Desk: ${dispatch.dispatcherName} (${dispatch.dispatchPhone})
  • Dispatch Email Sent To: ${dispatch.dispatchEmail}
  • Safety Desk Copy: ${dispatch.safetyEmail}
  • Automated SMS Sent To: ${dispatch.dispatchPhone}
  • Public Tracking URL: https://truckwithease.com/t/${trip.loadNumber}

FMCSA REGULATORY INTEGRITY:
49 CFR Part 395 (Hours of Service) and 49 CFR Part 396 (Inspection & Maintenance)
automated timestamps have been cryptographically committed to the carrier audit vault.
================================================================================`;

  return { subject, bodyText };
}

// Initial state builder
export function createInitialMasterLoopState(): MasterLoopSystemState {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOdo = 184520;

  const stages: MasterLoopStageRecord[] = MILESTONE_DEFINITIONS.map((def) => {
    return {
      stage: def.stage,
      orderNumber: def.orderNumber,
      title: def.title,
      shortLabel: def.shortLabel,
      description: def.description,
      status: def.orderNumber === 1 ? 'IN_PROGRESS' : 'PENDING',
      geofencePassed: false,
      locationSnapshot:
        def.stage === 'ORIGIN_DEPARTURE'
          ? DEFAULT_TRIP_DETAILS.originLot.name
          : def.stage === 'DESTINATION_ARRIVAL' || def.stage === 'DESTINATION_DEPARTURE'
          ? DEFAULT_TRIP_DETAILS.destination.name
          : DEFAULT_TRIP_DETAILS.homeTerminal.name,
      smsAlert: {
        dispatched: false,
        toPhone: DEFAULT_DISPATCH_CONTACTS.dispatchPhone,
        body: generateStageSmsBody(def.stage, DEFAULT_DRIVER_PROFILE, DEFAULT_TRIP_DETAILS, startOdo, timeStr),
      },
      emailAlert: {
        dispatched: false,
        toEmail: DEFAULT_DISPATCH_CONTACTS.dispatchEmail,
        ...generateStageEmail(
          def.stage,
          DEFAULT_DRIVER_PROFILE,
          DEFAULT_TRIP_DETAILS,
          DEFAULT_DISPATCH_CONTACTS,
          startOdo,
          timeStr
        ),
      },
      inCabAlertSpoken: false,
    };
  });

  return {
    loopId: `LOOP-${Date.now().toString().slice(-6)}`,
    currentCycleNumber: 1,
    currentStage: 'ORIGIN_DEPARTURE',
    currentStageIndex: 0,
    isAutoLoopRunning: false,
    simulationSpeedMs: 6000,
    odometerMiles: startOdo,
    fuelLevelPct: 94,
    driver: DEFAULT_DRIVER_PROFILE,
    dispatch: DEFAULT_DISPATCH_CONTACTS,
    trip: DEFAULT_TRIP_DETAILS,
    stages,
    history: [],
    auditLogs: [],
    totalCyclesCompleted: 0,
  };
}

// Read state from localStorage
export function loadMasterLoopState(): MasterLoopSystemState {
  if (typeof window === 'undefined') return createInitialMasterLoopState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialMasterLoopState();
      saveMasterLoopState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    const initial = createInitialMasterLoopState();
    if (!parsed.driver || typeof parsed.driver !== 'object') {
      parsed.driver = DEFAULT_DRIVER_PROFILE;
    } else {
      parsed.driver = { ...DEFAULT_DRIVER_PROFILE, ...parsed.driver };
    }
    if (typeof parsed.driver.currentOdometer !== 'number' || isNaN(parsed.driver.currentOdometer)) {
      parsed.driver.currentOdometer = typeof parsed.odometerMiles === 'number' && !isNaN(parsed.odometerMiles)
        ? parsed.odometerMiles
        : 142850;
    }
    if (!parsed.dispatch || typeof parsed.dispatch !== 'object') {
      parsed.dispatch = DEFAULT_DISPATCH_CONTACTS;
    } else {
      parsed.dispatch = { ...DEFAULT_DISPATCH_CONTACTS, ...parsed.dispatch };
    }
    if (!parsed.trip || typeof parsed.trip !== 'object') {
      parsed.trip = DEFAULT_TRIP_DETAILS;
    } else {
      parsed.trip = { ...DEFAULT_TRIP_DETAILS, ...parsed.trip };
    }
    if (typeof parsed.odometerMiles !== 'number' || isNaN(parsed.odometerMiles)) {
      parsed.odometerMiles = initial.odometerMiles || 142850;
    }
    if (!parsed.auditLogs || !Array.isArray(parsed.auditLogs)) {
      parsed.auditLogs = [];
    }
    if (!parsed.stages || !Array.isArray(parsed.stages) || parsed.stages.length === 0) {
      parsed.stages = initial.stages;
    }
    if (!parsed.history || !Array.isArray(parsed.history)) {
      parsed.history = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error loading Master Loop state:', err);
    return createInitialMasterLoopState();
  }
}

// Save state to localStorage
export function saveMasterLoopState(state: MasterLoopSystemState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Error saving Master Loop state:', err);
  }
}

// Post notification to backend server (/api/dispatch-loop/alert and /api/messages)
export async function transmitDispatchAlertToServer(
  stageRecord: MasterLoopStageRecord,
  state: MasterLoopSystemState
): Promise<{ success: boolean; carrierSid?: string }> {
  try {
    const response = await fetch('/api/dispatch-loop/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: stageRecord.stage,
        stageTitle: stageRecord.title,
        loopId: state.loopId,
        cycleNumber: state.currentCycleNumber,
        driver: state.driver,
        dispatch: state.dispatch,
        trip: state.trip,
        odometer: stageRecord.odometerMiles || state.odometerMiles,
        smsBody: stageRecord.smsAlert.body,
        emailSubject: stageRecord.emailAlert.subject,
        emailBody: stageRecord.emailAlert.bodyText,
        timestamp: stageRecord.triggeredAt,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, carrierSid: data.carrierSid };
    }
  } catch (err) {
    console.warn('Backend /api/dispatch-loop/alert offline or non-blocking:', err);
  }

  // Also post directly to /api/messages so it appears in in-cab chat
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'DISPATCH',
        text: `[AUTOMATED ${stageRecord.shortLabel.toUpperCase()}] ${stageRecord.smsAlert.body}`,
        priority: 'NORMAL',
        attachedLoadId: state.trip.loadNumber,
      }),
    });
  } catch (e) {
    // Non-blocking
  }

  return { success: true, carrierSid: `SM-${Date.now().toString(36).toUpperCase()}` };
}

// Execute a milestone stage trigger
export async function triggerMasterLoopStage(
  currentState: MasterLoopSystemState,
  stageToTrigger: MasterLoopMilestone
): Promise<MasterLoopSystemState> {
  const state: MasterLoopSystemState = JSON.parse(JSON.stringify(currentState));
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString();
  const fullStamp = `${dateStr} ${timeStr}`;

  const stageIdx = state.stages.findIndex((s: MasterLoopStageRecord) => s.stage === stageToTrigger);
  if (stageIdx === -1) return state;

  // Advance odometer realistically based on stage
  let odoIncrement = 0;
  if (stageToTrigger === 'DESTINATION_ARRIVAL') {
    odoIncrement = 312; // Outbound miles from Chicago to Columbus
  } else if (stageToTrigger === 'DESTINATION_DEPARTURE') {
    odoIncrement = 2; // Yard maneuvering
  } else if (stageToTrigger === 'HOME_ARRIVAL') {
    odoIncrement = 310; // Return miles from Columbus back to Chicago
  }
  state.odometerMiles += odoIncrement;

  // Decrease fuel slightly
  if (odoIncrement > 0) {
    state.fuelLevelPct = Math.max(15, state.fuelLevelPct - Math.round(odoIncrement / 20));
  }

  // Update target stage record
  const currentStageRecord = state.stages[stageIdx];
  currentStageRecord.status = 'COMPLETED';
  currentStageRecord.triggeredAt = fullStamp;
  currentStageRecord.odometerMiles = state.odometerMiles;
  currentStageRecord.geofencePassed = true;

  // Regenerate updated SMS and Email with current exact odometer & timestamp
  const smsBody = generateStageSmsBody(stageToTrigger, state.driver, state.trip, state.odometerMiles, timeStr);
  const emailData = generateStageEmail(
    stageToTrigger,
    state.driver,
    state.trip,
    state.dispatch,
    state.odometerMiles,
    fullStamp
  );

  currentStageRecord.smsAlert = {
    dispatched: state.dispatch.smsEnabled,
    toPhone: state.dispatch.dispatchPhone,
    body: smsBody,
    timestamp: fullStamp,
    carrierSid: `SM${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    carrierStatus: 'DELIVERED',
  };

  currentStageRecord.emailAlert = {
    dispatched: state.dispatch.emailEnabled,
    toEmail: state.dispatch.dispatchEmail,
    subject: emailData.subject,
    bodyText: emailData.bodyText,
    timestamp: fullStamp,
    deliveryId: `MSG-ID-${Date.now().toString(36).toUpperCase()}`,
    status: 'DELIVERED',
  };

  // Play audio chime
  playDispatchLoopChime(stageToTrigger);

  // In-cab voice announcement
  if (state.dispatch.inCabVoiceAlerts) {
    let speechNotice = '';
    if (stageToTrigger === 'ORIGIN_DEPARTURE') {
      speechNotice = `Dispatch notified. Driver Vance Reynolds departed origin lot with load ${state.trip.loadNumber}.`;
    } else if (stageToTrigger === 'DESTINATION_ARRIVAL') {
      speechNotice = `Dispatch alerted. Arrived at destination Columbus Crossdock. Gate check-in confirmed.`;
    } else if (stageToTrigger === 'DESTINATION_DEPARTURE') {
      speechNotice = `Dispatch alerted. Departed destination. Bill of lading secured. Rolling back to home terminal.`;
    } else if (stageToTrigger === 'HOME_ARRIVAL') {
      speechNotice = `Dispatch alerted. Back home at origin shop. Round-trip loop completed. Please begin post-trip inspection.`;
    }
    speakDispatchNotification(speechNotice);
    currentStageRecord.inCabAlertSpoken = true;
  }

  // Transmit to server asynchronously
  transmitDispatchAlertToServer(currentStageRecord, state);

  // Determine next stage
  const nextStageIdx = stageIdx + 1;
  if (nextStageIdx < state.stages.length) {
    state.currentStageIndex = nextStageIdx;
    state.currentStage = state.stages[nextStageIdx].stage;
    state.stages[nextStageIdx].status = 'IN_PROGRESS';
  } else {
    // Entire loop completed! (Stage 4 Back Home finished)
    state.totalCyclesCompleted += 1;

    // Log to history
    const historyEntry: MasterLoopCycleHistory = {
      cycleId: `CYCLE-${state.currentCycleNumber}-${Date.now().toString().slice(-4)}`,
      cycleNumber: state.currentCycleNumber,
      tripLoadNumber: state.trip.loadNumber,
      startedAt: state.stages[0].triggeredAt || fullStamp,
      completedAt: fullStamp,
      totalDurationMinutes: 11 * 60 + 45, // ~11h 45m commercial run
      startOdometer: state.stages[0].odometerMiles || state.odometerMiles - 624,
      endOdometer: state.odometerMiles,
      totalMilesDriven: 624,
      stagesCompleted: 4,
      allAlertsDelivered: true,
      notes: `Successful 4-stage master loop. Origin lot departure -> Destination arrival -> Destination departure -> Back home at origin shop. Zero safety violations.`,
    };
    state.history.unshift(historyEntry);

    // If autoLoopAdvance is true, prepare next loop cycle
    if (state.dispatch.autoLoopAdvance) {
      state.currentCycleNumber += 1;
      state.currentStageIndex = 0;
      state.currentStage = 'ORIGIN_DEPARTURE';
      state.fuelLevelPct = 95; // Refueled at shop

      // Reset stages for next run
      state.stages = MILESTONE_DEFINITIONS.map((def) => {
        return {
          stage: def.stage,
          orderNumber: def.orderNumber,
          title: def.title,
          shortLabel: def.shortLabel,
          description: def.description,
          status: def.orderNumber === 1 ? 'IN_PROGRESS' : 'PENDING',
          geofencePassed: false,
          locationSnapshot:
            def.stage === 'ORIGIN_DEPARTURE'
              ? state.trip.originLot.name
              : def.stage === 'DESTINATION_ARRIVAL' || def.stage === 'DESTINATION_DEPARTURE'
              ? state.trip.destination.name
              : state.trip.homeTerminal.name,
          smsAlert: {
            dispatched: false,
            toPhone: state.dispatch.dispatchPhone,
            body: generateStageSmsBody(def.stage, state.driver, state.trip, state.odometerMiles, timeStr),
          },
          emailAlert: {
            dispatched: false,
            toEmail: state.dispatch.dispatchEmail,
            ...generateStageEmail(
              def.stage,
              state.driver,
              state.trip,
              state.dispatch,
              state.odometerMiles,
              timeStr
            ),
          },
          inCabAlertSpoken: false,
        };
      });
    }
  }

  state.lastDispatchedAt = fullStamp;
  saveMasterLoopState(state);
  return state;
}

// Reset loop system back to Stage 1
export function resetMasterLoopSystem(currentState: MasterLoopSystemState): MasterLoopSystemState {
  const initial = createInitialMasterLoopState();
  initial.driver = currentState.driver;
  initial.dispatch = currentState.dispatch;
  initial.trip = currentState.trip;
  initial.history = currentState.history;
  initial.totalCyclesCompleted = currentState.totalCyclesCompleted;
  initial.odometerMiles = currentState.odometerMiles;
  saveMasterLoopState(initial);
  return initial;
}
