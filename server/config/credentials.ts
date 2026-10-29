/**
 * Centralized Credential & Secret Manager Schema
 *
 * All credentials are read from environment variables injected at runtime
 * by Google Cloud Run via Google Secret Manager.
 * No real secret values are ever hardcoded in code or committed to git.
 */

export interface AppSecretsConfig {
  // 1. Google Gemini AI Engine
  geminiApiKey?: string;

  // 2. Twilio Messaging & Softphone
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioDispatchToNumber?: string;
  twilioApiKeySid?: string;
  twilioApiKeySecret?: string;
  twilioTwimlAppSid?: string;

  // 3. Commercial Telematics Providers
  samsaraApiToken?: string;
  motiveApiKey?: string;
  geotabSessionId?: string;

  // 4. Partner Discount & Insurance Integrations
  wexApiKey?: string;
  truckSmarterApiKey?: string;
  progressiveApiKey?: string;
  coverWalletApiKey?: string;

  // 5. Commercial Truck Routing Engines & Geocoding
  trimbleMapsApiKey?: string;
  tomtomApiKey?: string;
  hereApiKey?: string;
  googleMapsApiKey?: string;
}

/**
 * Expected Secret Manager Secret Names on Google Cloud Platform
 */
export const EXPECTED_SECRET_MANAGER_NAMES = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  TWILIO_ACCOUNT_SID: 'TWILIO_ACCOUNT_SID',
  TWILIO_AUTH_TOKEN: 'TWILIO_AUTH_TOKEN',
  TWILIO_FROM_NUMBER: 'TWILIO_FROM_NUMBER',
  TWILIO_DISPATCH_TO_NUMBER: 'TWILIO_DISPATCH_TO_NUMBER',
  TWILIO_API_KEY_SID: 'TWILIO_API_KEY_SID',
  TWILIO_API_KEY_SECRET: 'TWILIO_API_KEY_SECRET',
  TWILIO_TWIML_APP_SID: 'TWILIO_TWIML_APP_SID',
  SAMSARA_API_TOKEN: 'SAMSARA_API_TOKEN',
  MOTIVE_API_KEY: 'MOTIVE_API_KEY',
  GEOTAB_SESSION_ID: 'GEOTAB_SESSION_ID',
  WEX_API_KEY: 'WEX_API_KEY',
  TRUCKSMARTER_API_KEY: 'TRUCKSMARTER_API_KEY',
  PROGRESSIVE_API_KEY: 'PROGRESSIVE_API_KEY',
  COVERWALLET_API_KEY: 'COVERWALLET_API_KEY',
  TRIMBLE_API_KEY: 'TRIMBLE_API_KEY',
  TRIMBLE_MAPS_API_KEY: 'TRIMBLE_MAPS_API_KEY',
  TOMTOM_API_KEY: 'TOMTOM_API_KEY',
  HERE_API_KEY: 'HERE_API_KEY',
  GOOGLE_MAPS_API_KEY: 'GOOGLE_MAPS_API_KEY',
} as const;

export type SecretKeyName = keyof typeof EXPECTED_SECRET_MANAGER_NAMES;

/**
 * Reads a secret value from environment variables (injected by Cloud Run Secret Manager).
 * Never prints or logs the raw secret value.
 */
export function getSecret(name: SecretKeyName): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Audit helper: checks which secrets are configured in the current environment
 * without ever exposing or leaking the secret values.
 */
export function getCredentialConfigurationStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const [key] of Object.entries(EXPECTED_SECRET_MANAGER_NAMES)) {
    status[key] = Boolean(process.env[key] && process.env[key]!.trim().length > 0);
  }
  return status;
}
