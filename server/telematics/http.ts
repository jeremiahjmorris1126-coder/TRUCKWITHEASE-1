import { fetchWithRetryOn5xx, maskSecrets } from '../routing/httpUtils';
import { TelematicsProviderError, TelematicsProviderId } from './types';

const SECRET_ENV_KEYS = ['SAMSARA_API_TOKEN', 'MOTIVE_API_KEY', 'GEOTAB_PASSWORD', 'GEOTAB_SESSION_ID'];

/** Removes configured ELD credential values (and token-looking strings) from any text. */
export function redactSecrets(text: string): string {
  let out = maskSecrets(text);
  for (const key of SECRET_ENV_KEYS) {
    const v = process.env[key]?.trim();
    if (v && v.length >= 4) out = out.split(v).join('[REDACTED]');
  }
  return out;
}

/**
 * JSON fetch for ELD provider APIs. Retries 5xx/network errors, fails fast on
 * 4xx (bad key, rate limit), and never leaks credentials into error messages.
 */
export async function fetchProviderJson<T = any>(
  provider: TelematicsProviderId,
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithRetryOn5xx(url, init, { providerName: provider, timeoutMs, maxRetries: 2 });
  } catch (err) {
    throw new TelematicsProviderError(provider, redactSecrets((err as Error).message));
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = redactSecrets((await res.text()).slice(0, 200));
    } catch {
      /* ignore */
    }
    const hint =
      res.status === 401 || res.status === 403
        ? ' (credential rejected — check the API key/token and its scopes)'
        : res.status === 429
        ? ' (rate limited by provider)'
        : '';
    throw new TelematicsProviderError(provider, `HTTP ${res.status}${hint}${detail ? `: ${detail}` : ''}`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new TelematicsProviderError(provider, 'Provider returned a non-JSON response.');
  }
}

export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export const msToMins = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n / 60000));
};

export const secToMins = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n / 60));
};

export const round = (v: number | null, digits = 1): number | null =>
  v === null ? null : parseFloat(v.toFixed(digits));
