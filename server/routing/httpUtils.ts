export interface FetchWithRetryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
  providerName: string;
}

export function maskSecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/(key=|Authorization:\s*|authToken=|apiKey=)([a-zA-Z0-9_\-]{8,})/gi, '$1[REDACTED]')
    .replace(/Bearer\s+([a-zA-Z0-9_\-\.]{15,})/gi, 'Bearer [REDACTED]');
}

/**
 * Executes fetch with timeout and retries on 5xx status codes only.
 * 4xx errors (bad requests, 429 rate limit, 401 auth) fail immediately without retry.
 */
export async function fetchWithRetryOn5xx(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions
): Promise<Response> {
  const timeoutMs = options.timeoutMs || 5000;
  const maxRetries = options.maxRetries ?? 2;
  const baseBackoffMs = options.backoffMs || 300;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Retry only on 5xx server errors
      if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
        attempt++;
        const backoff = baseBackoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === 'AbortError') {
        throw new Error(`${options.providerName} request timed out after ${timeoutMs}ms`);
      }
      // If network connection error, retry if attempts remain
      if (attempt < maxRetries) {
        attempt++;
        const backoff = baseBackoffMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw new Error(`${options.providerName} network error: ${maskSecrets(err.message)}`);
    }
  }

  throw lastError || new Error(`${options.providerName} failed after ${maxRetries} retries`);
}
