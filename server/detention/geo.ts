/**
 * Haversine geofence calculation.
 */

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function insideGeofence(
  point: { lat: number; lng: number },
  fence: { center: { lat: number; lng: number }; radiusM: number }
): boolean {
  if (!point || !fence || !fence.center) return false;
  return haversineMeters(point.lat, point.lng, fence.center.lat, fence.center.lng) <= fence.radiusM;
}
