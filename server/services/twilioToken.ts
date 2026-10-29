import twilio from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export function isTwilioTelephonyConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID || process.env.TWILIO_API_KEY;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWIML_APP_SID || process.env.TWILIO_TWIML_APP_SID;

  return Boolean(accountSid && apiKeySid && apiKeySecret && twimlAppSid);
}

export function generateTwilioVoiceToken(identity: string): string | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID || process.env.TWILIO_API_KEY;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWIML_APP_SID || process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return null;
  }

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: identity || `web-${Date.now()}`,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}
