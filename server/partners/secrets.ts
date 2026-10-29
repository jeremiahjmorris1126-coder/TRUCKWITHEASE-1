/**
 * Secret Manager Helper for Partner Adapters
 * Cloud Run maps Secret Manager secrets into environment variables at runtime.
 */
export function getPartnerSecret(secretKeyName: string): string | undefined {
  // Cloud Run / Secret Manager env injection
  const secret = process.env[secretKeyName];
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  return undefined;
}
