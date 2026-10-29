const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;

export function validateStop(stop) {
  if (!stop || typeof stop !== 'object') return 'stop is required';
  if (!isStr(stop.stopId) || !isStr(stop.loadId)) return 'stop.stopId and stop.loadId are required';
  if (!['pickup', 'delivery'].includes(stop.kind)) return 'stop.kind must be pickup or delivery';
  const c = stop.fence?.center;
  if (!c || !isNum(c.lat) || !isNum(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) return 'stop.fence.center must have valid lat/lng';
  if (!isNum(stop.fence.radiusM) || stop.fence.radiusM < 25 || stop.fence.radiusM > 5000) return 'stop.fence.radiusM must be 25-5000';
  for (const k of ['appointmentTs', 'freeMinutes', 'ratePerHour']) {
    if (stop[k] != null && (!isNum(stop[k]) || stop[k] < 0)) return `stop.${k} must be a non-negative number`;
  }
  return null;
}

export function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return 'events must be a non-empty array';
  if (events.length > 500) return 'max 500 events per request';
  for (const e of events) {
    if (!e || !isNum(e.ts)) return 'every event needs a numeric ts (epoch ms)';
    if (e.type === 'gps') {
      if (!isNum(e.lat) || !isNum(e.lng) || Math.abs(e.lat) > 90 || Math.abs(e.lng) > 180) return 'gps events need valid lat/lng';
    } else if (e.type === 'door') {
      if (!['open', 'closed'].includes(e.state)) return 'door events need state open or closed';
    } else if (e.type === 'call') {
      if (!isNum(e.durationSec)) return 'call events need durationSec';
    } else return `unknown event type: ${e.type}`;
  }
  return null;
}
