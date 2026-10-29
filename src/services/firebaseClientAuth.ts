import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
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

/**
 * Returns current Firebase ID token (JWT) to attach to Authorization header.
 * Refreshes token if expired.
 */
export async function getBearerToken(): Promise<string | null> {
  const user = clientAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
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
