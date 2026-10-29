// Motive (KeepTruckin) mapping. Location shape is {located_at, lat, lon}.
// Motive's door/aux-input source varies by hardware and account, so the door
// mapper takes an already-extracted reading { time, value }. Confirm which
// Motive endpoint or webhook carries your door sensor, then feed it here.
const toMs = (t) => (typeof t === 'number' ? t : Date.parse(t));

export function mapMotiveLocation(loc) {
  const ts = toMs(loc.located_at);
  if (!Number.isFinite(ts) || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return null;
  return { type: 'gps', ts, lat: loc.lat, lng: loc.lon };
}

export function createMotiveDoorMapper({ openWhen = true } = {}) {
  const last = new Map();
  return function mapDoor(vehicleId, reading) {
    const ts = toMs(reading.time);
    if (!Number.isFinite(ts)) return null;
    const state = (reading.value === true || reading.value === 'true' || reading.value === 1) === openWhen ? 'open' : 'closed';
    if (last.get(vehicleId) === state) return null;
    last.set(vehicleId, state);
    return { type: 'door', ts, state };
  };
}
