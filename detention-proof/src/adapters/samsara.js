// Maps Samsara vehicle-stats records to normalized detention events.
//
// Expected record (one vehicle from GET /fleet/vehicles/stats/feed):
//   { id, name,
//     gps:       [{ time, latitude, longitude, speedMilesPerHour }],
//     auxInput1: [{ time, value: true|false }] }
// Samsara returns each stat as an array in the feed and as a single object in
// the snapshot endpoint; both shapes are accepted. VERIFY against a real
// payload from your account before relying on door events.

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const toMs = (t) => (typeof t === 'number' ? t : Date.parse(t));

export function createSamsaraMapper({ doorInput = 'auxInput1', doorOpenWhen = true } = {}) {
  const lastDoor = new Map(); // samsara vehicle id -> last emitted state

  return function map(record) {
    const events = [];

    for (const g of asArray(record.gps)) {
      const ts = toMs(g.time);
      if (!Number.isFinite(ts) || typeof g.latitude !== 'number' || typeof g.longitude !== 'number') continue;
      events.push({ type: 'gps', ts, lat: g.latitude, lng: g.longitude, speedMph: g.speedMilesPerHour });
    }

    const doorReadings = asArray(record[doorInput])
      .map((r) => ({ ts: toMs(r.time), open: (r.value === true || r.value === 'true' || r.value === 1) === doorOpenWhen }))
      .filter((r) => Number.isFinite(r.ts))
      .sort((a, b) => a.ts - b.ts);

    for (const r of doorReadings) {
      const state = r.open ? 'open' : 'closed';
      if (lastDoor.get(record.id) === state) continue; // only emit real transitions
      lastDoor.set(record.id, state);
      events.push({ type: 'door', ts: r.ts, state });
    }

    return events.sort((a, b) => a.ts - b.ts);
  };
}
