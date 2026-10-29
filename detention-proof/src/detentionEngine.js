import { insideGeofence } from './geo.js';

/**
 * Normalized events (adapters for Samsara/Motive/etc. should emit these):
 *   { type: 'gps',  ts, lat, lng, speedMph? }
 *   { type: 'door', ts, state: 'open' | 'closed' }
 *   { type: 'call', ts, durationSec, direction, number }   // telephony log
 * ts = epoch milliseconds.
 *
 * A "stop" = { stopId, loadId, kind: 'pickup'|'delivery', fence, appointmentTs?,
 *              freeMinutes?, ratePerHour? }
 */

const MIN = 60_000;

// Require N consecutive in-fence pings to confirm arrival, and an exit
// confirmed by M consecutive out-of-fence pings, to ignore GPS jitter.
const ARRIVE_PINGS = 2;
const DEPART_PINGS = 2;

export function createStopTracker(stop, opts = {}) {
  const freeMinutes = stop.freeMinutes ?? opts.freeMinutes ?? 120;
  const ratePerHour = stop.ratePerHour ?? opts.ratePerHour ?? 50;

  const state = {
    stop,
    status: 'enroute', // enroute | on_site | departed
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

  const seen = new Set();
  function onEvent(ev) {
    const key = `${ev.type}|${ev.ts}|${ev.state ?? ''}|${ev.lat ?? ''}|${ev.lng ?? ''}|${ev.number ?? ''}`;
    if (seen.has(key)) return; // adapter retry or replay: already applied
    seen.add(key);
    if (ev.type === 'gps') return onGps(ev);
    if (ev.type === 'door') return onDoor(ev);
    if (ev.type === 'call') return onCall(ev);
  }

  function onGps(ev) {
    const inside = insideGeofence(ev, stop.fence);
    if (state.status !== 'enroute' || inside) state.gpsTrail.push(ev);

    if (state.status === 'enroute') {
      if (inside) {
        if (state.inCount === 0) state.firstInTs = ev.ts;
        state.inCount += 1;
        if (state.inCount >= ARRIVE_PINGS) {
          state.status = 'on_site';
          state.arrivalTs = state.firstInTs; // backdate to first in-fence ping
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
          state.departureTs = state.firstOutTs;
        }
      } else {
        state.outCount = 0;
        state.firstOutTs = null;
      }
    }
  }

  function onDoor(ev) {
    // Only count door events while on site (or just arrived).
    if (state.status === 'on_site') state.doorEvents.push(ev);
  }

  function onCall(ev) {
    state.calls.push(ev);
  }

  function summary(nowTs = Date.now()) {
    const end = state.departureTs ?? (state.status === 'on_site' ? nowTs : null);
    if (!state.arrivalTs || !end) {
      return { stopId: stop.stopId, status: state.status, dwellMinutes: 0, detentionMinutes: 0, amount: 0 };
    }

    // Detention clock starts at the later of arrival and appointment time.
    const clockStart = Math.max(state.arrivalTs, stop.appointmentTs ?? 0);
    const dwellMinutes = Math.max(0, Math.round((end - state.arrivalTs) / MIN));
    const billableTotal = Math.max(0, Math.round((end - clockStart) / MIN));
    const detentionMinutes = Math.max(0, billableTotal - freeMinutes);
    const amount = Math.round((detentionMinutes / 60) * ratePerHour * 100) / 100;

    const opens = state.doorEvents.filter((d) => d.state === 'open');
    const closes = state.doorEvents.filter((d) => d.state === 'closed');
    const firstDoorOpenTs = opens[0]?.ts ?? null;
    const lastDoorCloseTs = closes.at(-1)?.ts ?? null;

    return {
      stopId: stop.stopId,
      loadId: stop.loadId,
      kind: stop.kind,
      status: state.status,
      arrivalTs: state.arrivalTs,
      departureTs: state.departureTs,
      appointmentTs: stop.appointmentTs ?? null,
      clockStartTs: clockStart,
      freeMinutes,
      ratePerHour,
      dwellMinutes,
      detentionMinutes,
      amount,
      firstDoorOpenTs,
      lastDoorCloseTs,
      // Minutes the truck sat before the dock work began; strong detention proof.
      waitBeforeDoorMinutes: firstDoorOpenTs
        ? Math.max(0, Math.round((firstDoorOpenTs - state.arrivalTs) / MIN))
        : null,
      // Minutes the dock work itself took (door open to door closed).
      dockWorkMinutes:
        firstDoorOpenTs && lastDoorCloseTs
          ? Math.max(0, Math.round((lastDoorCloseTs - firstDoorOpenTs) / MIN))
          : null,
    };
  }

  return {
    onEvent,
    summary,
    snapshot: () => ({ ...state, gpsTrail: [...state.gpsTrail] }),
  };
}
