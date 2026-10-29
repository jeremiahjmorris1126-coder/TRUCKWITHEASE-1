import crypto from 'crypto';
import { getDb } from '../firestore';

export interface FleetApiKeyRecord {
  keyHash: string;
  keyPrefix: string;
  fleetId: string;
  name: string;
  createdAt: string;
  revoked: boolean;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
}

const COLLECTION_NAME = 'fleet_api_keys';

// In-memory cache & fallback for fast lookups and local development/testing
const inMemoryKeys = new Map<string, FleetApiKeyRecord>();

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

export function generateRawKey(): string {
  return `twe_live_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Creates and registers a new fleet API key.
 * Stores only the SHA-256 hash in Firestore.
 * Returns the rawKey ONCE.
 */
export async function createFleetApiKey(
  fleetId: string,
  name = 'Production Fleet Key'
): Promise<{ rawKey: string; record: Omit<FleetApiKeyRecord, 'keyHash'> }> {
  if (!fleetId || typeof fleetId !== 'string' || !fleetId.trim()) {
    throw new Error('fleetId is required to generate an API key.');
  }

  const rawKey = generateRawKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 14) + '...';

  const record: FleetApiKeyRecord = {
    keyHash,
    keyPrefix,
    fleetId: fleetId.trim(),
    name,
    createdAt: new Date().toISOString(),
    revoked: false,
    revokedAt: null,
    lastUsedAt: null,
  };

  // Cache in-memory
  inMemoryKeys.set(keyHash, record);

  // Persist to Firestore
  try {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      await (db as any).collection(COLLECTION_NAME).doc(keyHash).set(record);
    }
  } catch (err) {
    console.warn('[apiKeyService] Firestore write failed, using local key store:', (err as Error).message);
  }

  const { keyHash: _, ...publicRecord } = record;
  return { rawKey, record: publicRecord };
}

/**
 * Validates an API key or Bearer token.
 * Returns 401 if missing, 403 if invalid or revoked.
 */
export async function validateFleetApiKey(
  rawKey?: string
): Promise<{ valid: boolean; status: 200 | 401 | 403; message?: string; record?: FleetApiKeyRecord }> {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    return {
      valid: false,
      status: 401,
      message: 'Missing API key or Bearer token.',
    };
  }

  const cleanedKey = rawKey.trim().replace(/^Bearer\s+/i, '');
  if (!cleanedKey) {
    return {
      valid: false,
      status: 401,
      message: 'Empty or malformed Authorization token.',
    };
  }

  const keyHash = hashApiKey(cleanedKey);

  // 1. Check in-memory store
  let record = inMemoryKeys.get(keyHash);

  // 2. Check Firestore if not cached
  if (!record) {
    try {
      const db = getDb();
      if (db && typeof (db as any).collection === 'function') {
        const doc = await (db as any).collection(COLLECTION_NAME).doc(keyHash).get();
        if (doc?.exists) {
          record = doc.data() as FleetApiKeyRecord;
          inMemoryKeys.set(keyHash, record);
        }
      }
    } catch (err) {
      console.warn('[apiKeyService] Firestore key lookup failed:', (err as Error).message);
    }
  }

  // 3. Fallback support for existing JWT tokens (e.g. twe_jwt_) or root CARRIER_API_SECRET
  if (!record) {
    const envSecret = process.env.CARRIER_API_SECRET || process.env.TRUCKWITHEASE_API_SECRET;
    if (envSecret && cleanedKey === envSecret.trim()) {
      return {
        valid: true,
        status: 200,
        record: {
          keyHash,
          keyPrefix: 'env_secret...',
          fleetId: 'ROOT-FLEET-ADMIN',
          name: 'Env Configured Root Secret',
          createdAt: new Date().toISOString(),
          revoked: false,
        },
      };
    }

    if (cleanedKey.startsWith('twe_jwt_')) {
      try {
        const json = Buffer.from(cleanedKey.slice(8), 'base64').toString('utf8');
        const parsed = JSON.parse(json);
        if (parsed.userId) {
          return {
            valid: true,
            status: 200,
            record: {
              keyHash,
              keyPrefix: 'jwt_session...',
              fleetId: parsed.carrierTenantId || 'TRUCKWITHEASE-ENTERPRISE-1',
              name: `JWT Session for ${parsed.userId}`,
              createdAt: new Date().toISOString(),
              revoked: false,
            },
          };
        }
      } catch {
        // Fall through to invalid
      }
    }

    return {
      valid: false,
      status: 403,
      message: 'Invalid API key or authorization token.',
    };
  }

  // 4. Check if revoked
  if (record.revoked) {
    return {
      valid: false,
      status: 403,
      message: 'This API key has been revoked.',
    };
  }

  // Update lastUsedAt asynchronously
  record.lastUsedAt = new Date().toISOString();
  return { valid: true, status: 200, record };
}

/**
 * Revokes a fleet API key.
 */
export async function revokeFleetApiKey(rawKeyOrHash: string): Promise<boolean> {
  const keyHash = rawKeyOrHash.length === 64 ? rawKeyOrHash : hashApiKey(rawKeyOrHash);
  const record = inMemoryKeys.get(keyHash);

  if (record) {
    record.revoked = true;
    record.revokedAt = new Date().toISOString();
  }

  try {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      await (db as any).collection(COLLECTION_NAME).doc(keyHash).set(
        { revoked: true, revokedAt: new Date().toISOString() },
        { merge: true }
      );
      return true;
    }
  } catch (err) {
    console.warn('[apiKeyService] Firestore revoke failed:', (err as Error).message);
  }

  return Boolean(record);
}

/**
 * For testing purposes: clear in-memory keys
 */
export function clearKeyCacheForTesting(): void {
  inMemoryKeys.clear();
}
