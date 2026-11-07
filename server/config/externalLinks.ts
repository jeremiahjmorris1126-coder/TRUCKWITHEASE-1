/**
 * Resolves an outbound partner link from an env var, falling back to a default.
 * Only absolute https URLs are accepted so a misconfigured value can never turn
 * into a javascript:/http: link in the app.
 */
export function resolveHttpsUrl(
  raw: string | undefined,
  fallback: string,
  envName = 'link'
): { url: string; custom: boolean } {
  const candidate = raw?.trim();
  if (candidate) {
    try {
      const u = new URL(candidate);
      if (u.protocol === 'https:') return { url: u.toString(), custom: true };
      console.warn(`[ExternalLinks] ${envName} ignored: must be an https URL.`);
    } catch {
      console.warn(`[ExternalLinks] ${envName} ignored: not a valid URL.`);
    }
  }
  return { url: fallback, custom: false };
}
