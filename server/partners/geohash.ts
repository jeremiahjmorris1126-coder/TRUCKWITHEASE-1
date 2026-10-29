/**
 * Standard Base32 Geohash Encoder for Firestore spatial cache keys
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(latitude: number, longitude: number, precision = 5): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let bits = 0;
  let charBits = 0;
  let isEven = true;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) {
        charBits = (charBits << 1) | 1;
        lonMin = mid;
      } else {
        charBits = (charBits << 1) | 0;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        charBits = (charBits << 1) | 1;
        latMin = mid;
      } else {
        charBits = (charBits << 1) | 0;
        latMax = mid;
      }
    }
    isEven = !isEven;
    bits++;

    if (bits === 5) {
      geohash += BASE32[charBits];
      bits = 0;
      charBits = 0;
    }
  }

  return geohash;
}
