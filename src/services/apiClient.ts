import { getBearerToken } from './firebaseClientAuth';

/**
 * Shared API Client for TruckWithEase
 *
 * Rules enforced:
 * 1. Automatically attaches the Firebase ID token (`Authorization: Bearer <token>`) to every request.
 * 2. Uses a single API base URL from build settings (`VITE_API_BASE_URL`, defaulting to same-origin `''`).
 * 3. Handles 401 (triggers login modal), 403 ("Not allowed for your role"), 404 ("Not found"),
 *    429 ("Slow down, try again in X seconds"), and network errors with plain-language messages.
 * 4. Strips any untrusted identity fields (`fleetId`, `role`, `driverId`) from outgoing request bodies
 *    unless explicitly permitted for fleet_admin dispatch operations.
 */

export const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    typeof (import.meta as any).env.VITE_API_BASE_URL === 'string'
    ? (import.meta as any).env.VITE_API_BASE_URL.replace(/\/+$/, '')
    : '');

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'SERVER_ERROR';
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'SERVER_ERROR',
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type UnauthorizedHandler = () => void;
type RateLimitHandler = (message: string, retryAfterSeconds: number) => void;

let onUnauthorizedCallback: UnauthorizedHandler | null = null;
let onRateLimitCallback: RateLimitHandler | null = null;

export function registerApiAuthHandlers(handlers: {
  onUnauthorized?: UnauthorizedHandler;
  onRateLimited?: RateLimitHandler;
}) {
  if (handlers.onUnauthorized) onUnauthorizedCallback = handlers.onUnauthorized;
  if (handlers.onRateLimited) onRateLimitCallback = handlers.onRateLimited;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  allowTargetDriverId?: boolean; // Only true for fleet_admin /api/loads/:id/dispatch
  skipUnauthorizedRedirect?: boolean;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function sanitizeOutgoingBody(body: any, allowTargetDriverId = false): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  const clone: Record<string, any> = { ...body };
  // Never send fleetId or role from the client as trusted values
  delete clone.fleetId;
  delete clone.role;
  if (!allowTargetDriverId) {
    delete clone.driverId;
  }
  return clone;
}

export async function apiRequest<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = await getBearerToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let serializedBody: BodyInit | undefined = undefined;
  if (options.body !== undefined) {
    if (typeof options.body === 'string' || options.body instanceof FormData) {
      serializedBody = options.body;
    } else {
      headers.set('Content-Type', 'application/json');
      const cleaned = sanitizeOutgoingBody(options.body, options.allowTargetDriverId);
      serializedBody = JSON.stringify(cleaned);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      headers,
      body: serializedBody,
    });
  } catch (networkErr: any) {
    throw new ApiClientError(
      'Network connection unavailable. Check your signal or USB connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  let payload: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  if (response.ok) {
    return payload as T;
  }

  if (response.status === 401) {
    if (!options.skipUnauthorizedRedirect && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    throw new ApiClientError(
      'Please sign in to view or update fleet data.',
      401,
      'UNAUTHORIZED'
    );
  }

  if (response.status === 403) {
    const serverMsg = payload?.message || payload?.error;
    throw new ApiClientError(
      serverMsg ? `Not allowed: ${serverMsg}` : 'Not allowed for your account role.',
      403,
      'FORBIDDEN'
    );
  }

  if (response.status === 404) {
    const serverMsg = payload?.message || payload?.error || 'Requested record was not found.';
    throw new ApiClientError(serverMsg, 404, 'NOT_FOUND');
  }

  if (response.status === 429) {
    const retryHeader = response.headers.get('Retry-After') || response.headers.get('X-RateLimit-Reset');
    const retrySeconds = Number(payload?.retryAfterSeconds || retryHeader) || 15;
    const friendlyMessage = `Slow down, try again in ${retrySeconds} seconds.`;
    if (onRateLimitCallback) {
      onRateLimitCallback(friendlyMessage, retrySeconds);
    }
    throw new ApiClientError(friendlyMessage, 429, 'RATE_LIMITED', retrySeconds);
  }

  const fallbackError =
    payload?.message || payload?.error || `Server error (${response.status}). Please try again.`;
  throw new ApiClientError(fallbackError, response.status, 'SERVER_ERROR');
}

export const apiClient = {
  get: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T = any>(path: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
