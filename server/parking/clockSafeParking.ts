import type { CallerIdentity } from '../data/fleetStore';
import { fleetStore } from '../data/fleetStore';
import { telematicsManager } from '../telematics/telematicsManager';
import type { NormalizedDriver } from '../telematics/types';
import { routingManager } from '../routing/routingManager';
import { tpimsService, haversineMi, type ParkingSite } from './tpimsService';

/**
 * Clock-Safe Parking
 *
 * Answers one question for a driver on the road: "Which truck parking can I
 * legally reach before my hours run out, and is there space there now?"
 *
 *  - Hours left: read-only from the driver's ELD (Samsara / Motive / Geotab),
 *    the tightest of drive, shift, break and cycle clocks. Never computed here.
 *  - Spaces: live state DOT TPIMS counts and trend.
 *  - Drive time: real truck drive time from PC*MILER / TomTom for the nearest
 *    candidates. If routing isn't available, straight-line distance is shown
 *    and reachability is reported as "unverified" rather than guessed.
 */

export const SAFETY_BUFFER_MIN = 15;
const MAX_ROUTED_CANDIDATES = 6;
const PLANNING_MPH_CEILING = 65; // only to pre-filter candidates that cannot possibly be reached

export interface DriverClock {
  minutesLeft: number;
  limitedBy: 'drive' | 'shift' | 'break' | 'cycle';
  clocks: NormalizedDriver['hosClocks'];
  asOf: string | null;
  provider: string;
  matchedBy: 'eldDriverId' | 'name';
}

export interface ClockSafeSite extends ParkingSite {
  driveMinutes: number | null;
  driveMiles: number | null;
  /** true/false when real drive time is known; null when unverified. */
  reachable: boolean | null;
  minutesToSpare: number | null;
  routedBy: string | null;
}

export interface ClockSafeResult {
  clock: DriverClock | null;
  clockUnavailableReason: string | null;
  parkingConfigured: boolean;
  sites: ClockSafeSite[];
  routingNote: string | null;
}

export function bindingClock(c: NormalizedDriver['hosClocks']): { minutesLeft: number; limitedBy: DriverClock['limitedBy'] } | null {
  const options: [DriverClock['limitedBy'], number | null][] = [
    ['drive', c.drivingRemainingMins],
    ['shift', c.shiftRemainingMins],
    ['break', c.breakWindowMins],
    ['cycle', c.cycleRemainingMins],
  ];
  const known = options.filter((o): o is [DriverClock['limitedBy'], number] => typeof o[1] === 'number');
  if (known.length === 0) return null;
  const [limitedBy, minutesLeft] = known.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { minutesLeft, limitedBy };
}

/** Finds the signed-in driver's ELD record: by linked eldDriverId, else a unique exact name match. */
export async function getDriverClock(caller: CallerIdentity): Promise<{ clock: DriverClock | null; reason: string | null }> {
  if (caller.role !== 'driver') return { clock: null, reason: 'Hours are shown for the signed-in driver.' };
  if (!telematicsManager.canAccess(caller)) return { clock: null, reason: 'Your fleet has not connected an ELD yet.' };

  const profile = await fleetStore.getScopedDocument<any>(caller, 'driver_profiles', caller.uid);
  const drivers = await telematicsManager.getAllDrivers(caller);
  if (drivers.length === 0) return { clock: null, reason: 'No hours available from your ELD right now.' };

  let match: NormalizedDriver | undefined;
  let matchedBy: DriverClock['matchedBy'] = 'eldDriverId';
  if (profile?.eldDriverId) {
    match = drivers.find((d) => d.id === String(profile.eldDriverId));
  } else if (profile?.name) {
    const same = drivers.filter((d) => d.name.trim().toLowerCase() === String(profile.name).trim().toLowerCase());
    if (same.length === 1) {
      match = same[0];
      matchedBy = 'name';
    }
  }
  if (!match) return { clock: null, reason: 'Your ELD driver record is not linked to this account. Ask your fleet admin to link it.' };

  const bound = bindingClock(match.hosClocks);
  if (!bound) return { clock: null, reason: 'Your ELD did not report remaining hours.' };
  return {
    clock: { ...bound, clocks: match.hosClocks, asOf: match.hosAsOf, provider: match.provider, matchedBy },
    reason: null,
  };
}

export async function findClockSafeParking(
  caller: CallerIdentity,
  position: { lat: number; lon: number },
  opts: { limit?: number } = {}
): Promise<ClockSafeResult> {
  const { clock, reason } = await getDriverClock(caller);
  const parkingConfigured = tpimsService.isConfigured();
  if (!parkingConfigured) {
    return { clock, clockUnavailableReason: reason, parkingConfigured, sites: [], routingNote: null };
  }

  const all = await tpimsService.getSites({ lat: position.lat, lon: position.lon, limit: 200 });
  // Open sites (or unknown status) with a location; skip sites reporting zero spaces.
  let candidates = all.filter((s) => s.open !== false && s.latitude !== null && s.longitude !== null && s.available !== 0);
  if (clock) {
    const maxMiles = (Math.max(0, clock.minutesLeft) / 60) * PLANNING_MPH_CEILING;
    candidates = candidates.filter((s) => (s.distanceMi ?? Infinity) <= maxMiles);
  }
  candidates = candidates.slice(0, Math.max(MAX_ROUTED_CANDIDATES, opts.limit ?? 10));

  let routingNote: string | null = null;
  const results: ClockSafeSite[] = [];
  for (const [i, s] of candidates.entries()) {
    let driveMinutes: number | null = null;
    let driveMiles: number | null = null;
    let routedBy: string | null = null;
    if (i < MAX_ROUTED_CANDIDATES) {
      try {
        const m = await routingManager.getMileage(
          { label: 'Current location', coords: position },
          { label: s.name, coords: { lat: s.latitude!, lon: s.longitude! } }
        );
        if (!m.mock) {
          driveMinutes = m.durationMinutes;
          driveMiles = m.distanceMiles;
          routedBy = m.provider;
        } else {
          routingNote = 'Truck routing is not connected, so drive times are not verified.';
        }
      } catch {
        routingNote = 'Truck routing is unavailable right now, so drive times are not verified.';
      }
    }
    const reachable = clock && driveMinutes !== null ? driveMinutes + SAFETY_BUFFER_MIN <= clock.minutesLeft : null;
    results.push({
      ...s,
      driveMinutes,
      driveMiles,
      reachable,
      minutesToSpare: clock && driveMinutes !== null ? clock.minutesLeft - driveMinutes : null,
      routedBy,
    });
  }

  // Reachable first (most spaces, then nearest), then unverified, then not reachable.
  const rank = (r: ClockSafeSite) => (r.reachable === true ? 0 : r.reachable === null ? 1 : 2);
  results.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.available ?? -1) - (a.available ?? -1) ||
      (a.driveMinutes ?? a.distanceMi ?? Infinity) - (b.driveMinutes ?? b.distanceMi ?? Infinity)
  );
  return { clock, clockUnavailableReason: reason, parkingConfigured, sites: results.slice(0, opts.limit ?? 10), routingNote };
}

export { haversineMi };
