import { getDocument, saveDocument } from '../firestore';
import { FuelOffer } from './types';

interface CachedOffersDoc {
  key: string;
  offers: FuelOffer[];
  cachedAt: number;
  expiresAt: number;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export async function getCachedFuelOffers(provider: string, geohash: string): Promise<FuelOffer[] | null> {
  const cacheKey = `${provider}_${geohash}`;
  try {
    const entry = await getDocument<CachedOffersDoc>('partner_cache', cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      return null; // Expired past 15-min TTL
    }

    return entry.offers;
  } catch (err) {
    return null;
  }
}

export async function setCachedFuelOffers(provider: string, geohash: string, offers: FuelOffer[]): Promise<void> {
  const cacheKey = `${provider}_${geohash}`;
  const now = Date.now();
  const entry: CachedOffersDoc = {
    key: cacheKey,
    offers,
    cachedAt: now,
    expiresAt: now + FIFTEEN_MINUTES_MS,
  };

  try {
    await saveDocument('partner_cache', cacheKey, entry);
  } catch (err) {
    console.warn('[PartnerCache] Non-blocking cache write failed:', (err as Error).message);
  }
}
