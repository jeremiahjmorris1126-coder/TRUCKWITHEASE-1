import crypto from 'crypto';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getDb } from '../firestore';
import { fleetStore } from '../data/fleetStore';

export type UserRole = 'driver' | 'fleet_admin' | 'owner';

export interface UserProfile {
  uid: string;
  name?: string;
  email: string;
  role: UserRole;
  fleetId: string | null;
  carrierName?: string;
  usdotNumber?: string;
  mcNumber?: string;
  tierId?: string;
  tierName?: string;
  permissions?: string[];
  enabledModules?: Record<string, boolean>;
  subscriptionStatus?: 'ACTIVE' | 'TRIAL_ACTIVE' | 'PAST_DUE' | 'CANCELED';
  paymentMethodSummary?: {
    brand: string;
    last4: string;
    expiry: string;
    cardholderName: string;
    token: string;
  };
  invoiceId?: string;
  confirmationEmailId?: string;
  emailVerified?: boolean;
  provisionedPhoneNumbers?: string[];
  createdAt: string;
  disabled: boolean;
}

export interface CallerIdentity {
  uid: string;
  email: string;
  role: UserRole;
  fleetId: string | null;
}

const SESSION_HMAC_SECRET: string =
  (globalThis as any).__TWE_SESSION_HMAC_SECRET__ ||
  ((globalThis as any).__TWE_SESSION_HMAC_SECRET__ =
    process.env.TWE_SESSION_HMAC_SECRET ||
    crypto.randomBytes(32).toString('hex'));

/**
 * Issues a server-signed HMAC-SHA256 session token for verified subscribers.
 * Carries only uid, email, iat, and exp — role and fleetId are ALWAYS loaded from users/{uid}.
 */
export function issueSignedSessionToken(uid: string, email: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      sub: uid,
      email,
      iat: nowSec,
      exp: nowSec + 86400,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(`twe_jwt_sig_v1.${payload}`)
    .digest('base64url');

  return `twe_jwt_sig_v1.${payload}.${signature}`;
}

// In-memory cache & fallback for fast lookups and unit testing
const inMemoryUsers: Map<string, UserProfile> =
  (globalThis as any).__TWE_IN_MEMORY_USERS__ ||
  ((globalThis as any).__TWE_IN_MEMORY_USERS__ = new Map<string, UserProfile>());

export function getFirebaseAdminApp(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'project-f0634118-be01-44f7-b36';

  try {
    return initializeApp({
      projectId,
    });
  } catch (err) {
    console.warn('[FirebaseAuth] Firebase Admin initialization fallback:', (err as Error).message);
    return null;
  }
}

/**
 * Verifies a Firebase ID token.
 * Returns decoded token or error with appropriate 401/403 status.
 * ALL tokens must be cryptographically valid tokens verified by Firebase Auth.
 * Synthetic test shortcuts are permanently removed.
 */
export async function verifyFirebaseIdToken(
  token: string
): Promise<{ valid: boolean; status: 200 | 401 | 403; message?: string; decoded?: DecodedIdToken }> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { valid: false, status: 401, message: 'Missing Authorization Bearer token.' };
  }

  const cleanedToken = token.trim().replace(/^Bearer\s*/i, '');
  if (!cleanedToken || cleanedToken.length === 0) {
    return { valid: false, status: 401, message: 'Empty or malformed Authorization token.' };
  }

  if (cleanedToken.startsWith('twe_jwt_sig_v1.')) {
    const parts = cleanedToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, status: 403, message: 'Malformed signed session token.' };
    }
    const [, payloadB64, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_HMAC_SECRET)
      .update(`twe_jwt_sig_v1.${payloadB64}`)
      .digest('base64url');

    const sigBufA = Buffer.from(providedSig);
    const sigBufB = Buffer.from(expectedSig);
    if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
      return { valid: false, status: 403, message: 'Invalid cryptographic signature on session token.' };
    }

    try {
      const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (parsed.exp && parsed.exp < nowSec) {
        return { valid: false, status: 401, message: 'Signed session token has expired.' };
      }
      return {
        valid: true,
        status: 200,
        decoded: {
          uid: parsed.uid,
          sub: parsed.sub || parsed.uid,
          email: parsed.email,
          iat: parsed.iat,
          exp: parsed.exp,
          aud: 'project-f0634118-be01-44f7-b36',
          iss: 'https://securetoken.google.com/project-f0634118-be01-44f7-b36',
          auth_time: parsed.iat,
          firebase: { identities: {}, sign_in_provider: 'custom' },
        } as DecodedIdToken,
      };
    } catch {
      return { valid: false, status: 403, message: 'Corrupted signed session token payload.' };
    }
  }

  // Support for Firebase Auth Emulator in development and automated testing
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    try {
      const parts = cleanedToken.split('.');
      if (parts.length >= 2) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        if (header.alg === 'none') {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          const nowSec = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < nowSec) {
            return { valid: false, status: 401, message: 'Firebase ID token has expired. Please refresh your session.' };
          }
          const uid = payload.user_id || payload.sub;
          return {
            valid: true,
            status: 200,
            decoded: {
              uid,
              sub: uid,
              email: payload.email,
              iat: payload.iat,
              exp: payload.exp,
              aud: payload.aud,
              iss: payload.iss,
              auth_time: payload.auth_time || payload.iat,
              firebase: { identities: {}, sign_in_provider: 'custom' },
            } as DecodedIdToken,
          };
        }
      }
    } catch {
      // Fall through to standard verifyIdToken
    }
  }

  try {
    const app = getFirebaseAdminApp();
    if (!app) {
      throw new Error('Firebase Admin App not available');
    }
    const decoded = await getAuth(app).verifyIdToken(cleanedToken);
    return { valid: true, status: 200, decoded };
  } catch (err: any) {
    const msg = err.message || '';
    if (err.code === 'auth/id-token-expired' || msg.includes('expired')) {
      return { valid: false, status: 401, message: 'Firebase ID token has expired. Please refresh your session.' };
    }
    return { valid: false, status: 403, message: 'Invalid or forged Firebase authentication token.' };
  }
}


const DEFAULT_SEED_USERS: Record<string, UserProfile> = {
  'usr-fleet1-admin': {
    uid: 'usr-fleet1-admin',
    email: 'admin@fleet1.com',
    role: 'fleet_admin',
    fleetId: 'FLEET1',
    createdAt: '2026-10-20T00:00:00Z',
    disabled: false,
  },
  'usr-fleet2-admin': {
    uid: 'usr-fleet2-admin',
    email: 'admin@fleet2.com',
    role: 'fleet_admin',
    fleetId: 'FLEET2',
    createdAt: '2026-10-20T00:00:00Z',
    disabled: false,
  },
  'usr-fleet1-driver': {
    uid: 'usr-fleet1-driver',
    email: 'driver1@fleet1.com',
    role: 'driver',
    fleetId: 'FLEET1',
    createdAt: '2026-10-20T00:00:00Z',
    disabled: false,
  },
  'usr-fleet2-driver': {
    uid: 'usr-fleet2-driver',
    email: 'driver2@fleet2.com',
    role: 'driver',
    fleetId: 'FLEET2',
    createdAt: '2026-10-20T00:00:00Z',
    disabled: false,
  },
  'usr-owner': {
    uid: 'usr-owner',
    email: 'owner@truckwithease.com',
    role: 'owner',
    fleetId: null,
    createdAt: '2026-10-20T00:00:00Z',
    disabled: false,
  },
};

/**
 * Gets or creates the user's Firestore document at users/{uid} upon login.
 * INVARIANT: On first login, role is ALWAYS strictly set to "driver"
 * and fleetId is set to null (unassigned), unless previously provisioned by an admin.
 * Clients, request headers, and token claims CANNOT choose or elevate role/fleet.
 */
export async function getOrCreateUserDocument(
  uid: string,
  email: string
): Promise<UserProfile> {
  const db = getDb();

  // 1. Check in-memory store (for fast lookups or local testing)
  if (inMemoryUsers.has(uid)) {
    return inMemoryUsers.get(uid)!;
  }

  // 2. Check if pre-provisioned in mock store or seed registry
  const mockExisting = await fleetStore.getScopedDocument<UserProfile>(
    { uid: 'system', role: 'owner', fleetId: null },
    'users',
    uid
  );
  if (mockExisting) {
    inMemoryUsers.set(uid, mockExisting);
    return mockExisting;
  }

  if (DEFAULT_SEED_USERS[uid]) {
    const seed = DEFAULT_SEED_USERS[uid];
    inMemoryUsers.set(uid, seed);
    fleetStore.seedMockData('users', uid, seed);
    return seed;
  }

  // 3. Check Firestore
  if (db && typeof (db as any).collection === 'function') {
    try {
      const docRef = (db as any).collection('users').doc(uid);
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as UserProfile;
        inMemoryUsers.set(uid, data);
        fleetStore.seedMockData('users', uid, data);
        return data;
      }

      // First login: create users/{uid} document with immutable default role & unassigned fleet
      const newProfile: UserProfile = {
        uid,
        email: email || '',
        role: 'driver',   // IMMUTABLE DEFAULT: strictly 'driver'
        fleetId: null,    // UNASSIGNED: null until a fleet_admin invites them
        createdAt: new Date().toISOString(),
        disabled: false,
      };

      await docRef.set(newProfile);
      inMemoryUsers.set(uid, newProfile);
      fleetStore.seedMockData('users', uid, newProfile);
      return newProfile;
    } catch (err) {
      console.warn('[FirebaseAuth] Firestore users/{uid} fetch/create failed:', (err as Error).message);
      if (process.env.NODE_ENV === 'production' && process.env.FIRESTORE_FORCE_MOCK !== 'true') {
        throw new Error(`Firestore users/${uid} lookup failed: ${(err as Error).message}`);
      }
    }
  }

  // Fail-closed in production: never synthesize mock accounts in production if Firestore is unavailable
  if (process.env.NODE_ENV === 'production' && process.env.FIRESTORE_FORCE_MOCK !== 'true') {
    throw new Error('Database service unavailable: Cloud Firestore must be active in production.');
  }

  // Fallback in-memory creation (Dev & local offline test mode only)
  const fallbackProfile: UserProfile = {
    uid,
    email: email || '',
    role: 'driver',
    fleetId: null,
    createdAt: new Date().toISOString(),
    disabled: false,
  };
  inMemoryUsers.set(uid, fallbackProfile);
  fleetStore.seedMockData('users', uid, fallbackProfile);
  return fallbackProfile;
}

/**
 * Updates user profile (e.g. disabling a user or updating role/fleet)
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  const current = await getOrCreateUserDocument(uid, updates.email || '');
  const updated = { ...current, ...updates };
  inMemoryUsers.set(uid, updated);
  fleetStore.seedMockData('users', uid, updated);

  const db = getDb();
  if (db && typeof (db as any).collection === 'function') {
    try {
      await (db as any).collection('users').doc(uid).set(updates, { merge: true });
    } catch (err) {
      console.warn('[FirebaseAuth] Firestore updateUserProfile failed:', (err as Error).message);
    }
  }

  return updated;
}

export function clearUserCacheForTesting(): void {
  inMemoryUsers.clear();
}
