// Geometry helpers. No dependencies.
const R = 6371000; // earth radius, meters
const rad = (d) => (d * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function insideGeofence(point, fence) {
  return distanceMeters(point, fence.center) <= fence.radiusM;
}
