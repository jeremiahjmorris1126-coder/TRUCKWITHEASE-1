import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

/**
 * Client-side Firebase configuration.
 * Supplied via environment variables (VITE_FIREBASE_*)
 */
export const firebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoPlaceholderKey',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'truckwithease.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'project-f0634118-be01-44f7-b36',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'truckwithease.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '405307027459',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:405307027459:web:abcdef123456',
};

// Initialize Firebase client app once
export const clientApp = getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);
export const clientAuth = getAuth(clientApp);

// Connect to local Firebase Auth Emulator ONLY in non-production when VITE_USE_FIREBASE_EMULATOR === 'true'
let emulatorConnected = false;
if (
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  !import.meta.env.PROD &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
  !emulatorConnected
) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  try {
    connectAuthEmulator(clientAuth, emulatorHost, { disableWarnings: true });
    emulatorConnected = true;
  } catch {
    // Ignore if already connected
  }
}

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged };
export type { User };

const SUBSCRIBER_SESSION_STORAGE_KEY = 'twe_subscriber_session_v1';

export interface StoredSubscriberSession {
  sessionToken: string;
  user: {
    uid: string;
    name?: string;
    email: string;
    role: 'driver' | 'fleet_admin' | 'owner';
    fleetId: string | null;
    carrierName?: string;
    usdotNumber?: string;
    mcNumber?: string;
    tierId?: string;
    tierName?: string;
    permissions?: string[];
    enabledModules?: Record<string, boolean>;
    subscriptionStatus?: string;
    paymentMethodSummary?: {
      brand: string;
      last4: string;
      expiry: string;
      cardholderName: string;
      token: string;
    };
    emailVerified?: boolean;
    provisionedPhoneNumbers?: string[];
  };
  invoice?: {
    id: string;
    baseAmountUsd: number;
    additionalLinesCount: number;
    additionalLinesAmountUsd: number;
    totalAmountUsd: number;
    status: string;
    transactionHash: string;
    createdAt: string;
  };
  confirmationEmail?: {
    id: string;
    messageId: string;
    verificationToken: string;
    verificationUrl: string;
    verified: boolean;
    verifiedAt?: string;
    subject: string;
    deliveryProvider: string;
  };
}

let inMemorySession: StoredSubscriberSession | null = null;

export function saveSubscriberSession(session: StoredSubscriberSession): void {
  inMemorySession = session;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SUBSCRIBER_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

export function getSubscriberSession(): StoredSubscriberSession | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SUBSCRIBER_SESSION_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as StoredSubscriberSession;
    }
  } catch {
    // ignore storage errors
  }
  return inMemorySession;
}

export function clearSubscriberSession(): void {
  inMemorySession = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SUBSCRIBER_SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns current Firebase ID token (JWT) or signed subscriber session token to attach to Authorization header.
 * Refreshes token if expired.
 */
export async function getBearerToken(): Promise<string | null> {
  const user = clientAuth.currentUser;
  if (user) return user.getIdToken();
  const stored = getSubscriberSession();
  if (stored?.sessionToken) return stored.sessionToken;
  return null;
}

/**
 * Authenticated fetch wrapper that automatically attaches Authorization: Bearer <ID_TOKEN>
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getBearerToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
