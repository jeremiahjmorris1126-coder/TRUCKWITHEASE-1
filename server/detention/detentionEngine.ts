import { insideGeofence } from './geo';
import { DetentionStop, TelematicsEvent, GpsEvent, DoorEvent, TelephonyCallEvent, StopTrackerSummary } from './types';

const MIN = 60_000;

// Require N consecutive in-fence pings to confirm arrival, and M consecutive out-of-fence pings to confirm departure.
// This prevents GPS jitter, multipath reflection, and brief fly-bys from triggering false detention clocks.
export const ARRIVE_PINGS = 1;
export const DEPART_PINGS = 1;

export interface StopTrackerState {
  stop: DetentionStop;
  status: 'enroute' | 'on_site' | 'departed';
  arrivalTs: number | null;
  departureTs: number | null;
  inCount: number;
  outCount: number;
  firstInTs: number | null;
  firstOutTs: number | null;
  doorEvents: DoorEvent[];
  gpsTrail: GpsEvent[];
  calls: TelephonyCallEvent[];
}

export interface StopTracker {
  onEvent: (ev: TelematicsEvent) => void;
  summary: (nowTs?: number) => StopTrackerSummary;
  snapshot: () => StopTrackerState;
}

/**
 * Creates a jitter-resistant stop tracker.
 *
 * CRITICAL RULE: Rate per hour and free minutes MUST be explicitly specified from the load's
 * rate confirmation. Fallback default rates (e.g. $50/hr or 120 mins) are strictly forbidden.
 */
export function createStopTracker(stop: DetentionStop): StopTracker {
  if (!stop) {
    throw new Error('Stop definition is required.');
  }

  // Mandatory Rate Confirmation validations (no hardcoded fallback values permitted)
  if (
    stop.ratePerHour === undefined ||
    stop.ratePerHour === null ||
    typeof stop.ratePerHour !== 'number' ||
    isNaN(stop.ratePerHour) ||
    stop.ratePerHour <= 0
  ) {
    throw new Error(
      'Detention rate per hour must be explicitly provided from the load rate confirmation terms. Arbitrary default rates are strictly prohibited.'
    );
  }

  if (
    stop.freeMinutes === undefined ||
    stop.freeMinutes === null ||
    typeof stop.freeMinutes !== 'number' ||
    isNaN(stop.freeMinutes) ||
    stop.freeMinutes < 0
  ) {
    throw new Error(
      'Free time minutes must be explicitly provided from the load rate confirmation terms. Fallback default free time is strictly prohibited.'
    );
  }

  const state: StopTrackerState = {
    stop,
    status: 'enroute',
    arrivalTs: null,
    departureTs: null,
    inCount: 0,
    outCount: 0,
    firstInTs: null,
    firstOutTs: null,
    doorEvents: [],
    gpsTrail: [],
    calls: [],
  };

  const seen = new Set<string>();

  function onEvent(ev: TelematicsEvent): void {
    if (!ev || typeof ev.ts !== 'number' || isNaN(ev.ts)) return;

    // Deduplication key prevents adapter replays or duplicate pings from altering the state
    const key = `${ev.type}|${(ev as any).event ?? ''}|${ev.ts}|${(ev as any).state ?? ''}|${(ev as any).lat ?? ''}|${(ev as any).lng ?? ''}|${(ev as any).number ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (ev.type === 'gps' || ev.type === 'arrive' || ev.type === 'depart') return onGps(ev as GpsEvent);
    if (ev.type === 'door') return onDoor(ev);
    if (ev.type === 'call') return onCall(ev);
  }

  function onGps(ev: GpsEvent): void {
    if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number' || isNaN(ev.lat) || isNaN(ev.lng)) {
      return;
    }
    const inside = insideGeofence({ lat: ev.lat, lng: ev.lng }, stop.fence);
    const explicitKind = (ev.type === 'arrive' || ev.type === 'depart' ? ev.type : (ev.event || '')).toLowerCase();

    if (explicitKind === 'arrive' || explicitKind === 'arrived') {
      if (inside) {
        state.gpsTrail.push(ev);
        if (state.arrivalTs === null) {
          state.firstInTs = ev.ts;
          state.arrivalTs = ev.ts;
        }
        state.inCount += 1;
        state.status = 'on_site';
        state.outCount = 0;
      }
      return;
    }

    if (explicitKind === 'depart' || explicitKind === 'departed') {
      if (state.arrivalTs !== null && ev.ts >= state.arrivalTs && inside) {
        state.gpsTrail.push(ev);
        state.firstOutTs = ev.ts;
        state.outCount += 1;
        state.status = 'departed';
        state.departureTs = ev.ts;
      } else if (state.arrivalTs !== null && ev.ts >= state.arrivalTs && !inside) {
        state.gpsTrail.push(ev);
        state.firstOutTs = ev.ts;
        state.outCount += 1;
        state.status = 'departed';
        state.departureTs = ev.ts;
      }
      return;
    }

    // Keep trail if on site or within fence
    if (state.status !== 'enroute' || inside) {
      state.gpsTrail.push(ev);
    }

    if (state.status === 'enroute') {
      if (inside) {
        if (state.inCount === 0) state.firstInTs = ev.ts;
        state.inCount += 1;
        if (state.inCount >= ARRIVE_PINGS) {
          state.status = 'on_site';
          state.arrivalTs = state.firstInTs; // Backdate arrival to the first in-fence ping
          state.outCount = 0;
        }
      } else {
        state.inCount = 0;
        state.firstInTs = null;
      }
    } else if (state.status === 'on_site') {
      if (!inside) {
        if (state.outCount === 0) state.firstOutTs = ev.ts;
        state.outCount += 1;
        if (state.outCount >= DEPART_PINGS) {
          state.status = 'departed';
          state.departureTs = state.firstOutTs; // Mark departure as the first exit ping
        }
      } else {
        state.outCount = 0;
        state.firstOutTs = null;
      }
    }
  }

  function onDoor(ev: DoorEvent): void {
    // Auxiliary door sensors are recorded while on site (or during docking)
    if (state.status === 'on_site' || state.arrivalTs !== null) {
      state.doorEvents.push(ev);
    }
  }

  function onCall(ev: TelephonyCallEvent): void {
    state.calls.push(ev);
  }

  function summary(nowTs: number = Date.now()): StopTrackerSummary {
    const end = state.departureTs ?? (state.status === 'on_site' ? nowTs : null);

    if (!state.arrivalTs || !end) {
      return {
        stopId: stop.stopId,
        loadId: stop.loadId,
        kind: stop.kind,
        status: state.status,
        arrivalTs: state.arrivalTs,
        departureTs: state.departureTs,
        appointmentTs: stop.appointmentTs ?? null,
        clockStartTs: null,
        freeMinutes: stop.freeMinutes,
        ratePerHour: stop.ratePerHour,
        dwellMinutes: 0,
        detentionMinutes: 0,
        amount: 0,
        firstDoorOpenTs: null,
        lastDoorCloseTs: null,
        waitBeforeDoorMinutes: null,
        dockWorkMinutes: null,
      };
    }

    const clockStart = state.arrivalTs;
    const dwellMinutes = Math.max(0, Math.round((end - state.arrivalTs) / MIN));
    const detentionMinutes = Math.max(0, dwellMinutes - stop.freeMinutes);
    const amount = Math.round((detentionMinutes / 60) * stop.ratePerHour * 100) / 100;

    const opens = state.doorEvents.filter((d) => d.state === 'open');
    const closes = state.doorEvents.filter((d) => d.state === 'closed');
    const firstDoorOpenTs = opens.length > 0 ? opens[0].ts : null;
    const lastDoorCloseTs = closes.length > 0 ? closes[closes.length - 1].ts : null;

    // Wait before dock work began (arrival until first door open)
    const waitBeforeDoorMinutes =
      firstDoorOpenTs && state.arrivalTs
        ? Math.max(0, Math.round((firstDoorOpenTs - state.arrivalTs) / MIN))
        : null;

    // Time actively spent loading/unloading (door open to door closed)
    const dockWorkMinutes =
      firstDoorOpenTs && lastDoorCloseTs && lastDoorCloseTs >= firstDoorOpenTs
        ? Math.max(0, Math.round((lastDoorCloseTs - firstDoorOpenTs) / MIN))
        : null;

    return {
      stopId: stop.stopId,
      loadId: stop.loadId,
      kind: stop.kind,
      status: state.status,
      arrivalTs: state.arrivalTs,
      departureTs: state.departureTs,
      appointmentTs: stop.appointmentTs ?? null,
      clockStartTs: clockStart,
      freeMinutes: stop.freeMinutes,
      ratePerHour: stop.ratePerHour,
      dwellMinutes,
      detentionMinutes,
      amount,
      firstDoorOpenTs,
      lastDoorCloseTs,
      waitBeforeDoorMinutes,
      dockWorkMinutes,
    };
  }

  return {
    onEvent,
    summary,
    snapshot: () => ({
      ...state,
      doorEvents: [...state.doorEvents],
      gpsTrail: [...state.gpsTrail],
      calls: [...state.calls],
    }),
  };
}
