import twilio from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

/**
 * Twilio Voice (in-app calling) support.
 *
 * Nothing here is simulated: without credentials, voice is reported as not
 * configured and no token is issued. Phone numbers come only from env.
 *
 * Env (Secret Manager names; legacy names still accepted):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY_SID      (legacy: TWILIO_API_KEY)
 *   TWILIO_API_KEY_SECRET   (legacy: TWILIO_API_SECRET)
 *   TWILIO_TWIML_APP_SID    (legacy: TWIML_APP_SID)  TwiML App whose Voice URL is /api/telephony/voice
 *   TWILIO_FROM_NUMBER      caller ID for outbound calls
 *   TWILIO_DISPATCH_TO_NUMBER  the fleet dispatch phone
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export interface FleetPhoneLine {
  id: string;
  phoneNumber: string;
  lineType: 'DISPATCH' | 'OUTBOUND_CALLER_ID';
}

function env() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
    apiKeySid: (process.env.TWILIO_API_KEY_SID || process.env.TWILIO_API_KEY)?.trim(),
    apiKeySecret: (process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_API_SECRET)?.trim(),
    twimlAppSid: (process.env.TWILIO_TWIML_APP_SID || process.env.TWIML_APP_SID)?.trim(),
    from: process.env.TWILIO_FROM_NUMBER?.trim(),
    dispatch: process.env.TWILIO_DISPATCH_TO_NUMBER?.trim(),
  };
}

export function isTwilioVoiceConfigured(): boolean {
  const e = env();
  return Boolean(e.accountSid && e.apiKeySid && e.apiKeySecret && e.twimlAppSid && e.from && E164.test(e.from));
}

/** Configured phone lines (real numbers from env only). */
export function getFleetLines(): FleetPhoneLine[] {
  const e = env();
  const lines: FleetPhoneLine[] = [];
  if (e.dispatch && E164.test(e.dispatch)) lines.push({ id: 'dispatch', phoneNumber: e.dispatch, lineType: 'DISPATCH' });
  if (e.from && E164.test(e.from)) lines.push({ id: 'outbound', phoneNumber: e.from, lineType: 'OUTBOUND_CALLER_ID' });
  return lines;
}

export class VoiceNotConfiguredError extends Error {
  statusCode = 503;
}

/**
 * Issues a short-lived Twilio Voice access token for the signed-in user.
 * The identity is always the caller's uid (never client-chosen).
 */
export function generateTwilioVoiceToken(uid: string): string {
  if (!isTwilioVoiceConfigured()) {
    throw new VoiceNotConfiguredError('In-app calling is not set up.');
  }
  const e = env();
  const token = new AccessToken(e.accountSid!, e.apiKeySid!, e.apiKeySecret!, { identity: uid, ttl: 3600 });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: e.twimlAppSid, incomingAllow: true }));
  return token.toJwt();
}

/**
 * TwiML for an outbound in-app call: connects to the fleet dispatch line.
 * Only configured numbers can be dialed, so the softphone can't call arbitrary numbers.
 */
export function generateVoiceTwiML(lineKey = 'dispatch'): string {
  const vr = new twilio.twiml.VoiceResponse();
  const line = getFleetLines().find((l) => l.id === lineKey && l.lineType === 'DISPATCH') || getFleetLines().find((l) => l.lineType === 'DISPATCH');
  const callerId = env().from;
  if (!line || !callerId) {
    vr.say('Calling is not set up for this fleet.');
    return vr.toString();
  }
  vr.dial({ callerId }).number(line.phoneNumber);
  return vr.toString();
}

export function getTelephonyStatus(): {
  voiceConfigured: boolean;
  smsConfigured: boolean;
  dispatchNumber: string | null;
  lines: FleetPhoneLine[];
} {
  const e = env();
  return {
    voiceConfigured: isTwilioVoiceConfigured(),
    smsConfigured: Boolean(e.accountSid && process.env.TWILIO_AUTH_TOKEN && e.from),
    dispatchNumber: e.dispatch && E164.test(e.dispatch) ? e.dispatch : null,
    lines: getFleetLines(),
  };
}
