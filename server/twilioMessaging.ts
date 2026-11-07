interface TwilioMessageResponse {
  sid: string;
  status: string;
}

export class TwilioConfigurationError extends Error {}

export class TwilioDeliveryError extends Error {}

export class TwilioRecipientError extends Error {}

const E164 = /^\+[1-9]\d{7,14}$/;

/** Twilio can send SMS (account credentials + sending number). */
export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/** SMS plus a fleet dispatch number for dispatch alerts. */
export function isTwilioConfigured(): boolean {
  return isSmsConfigured() && Boolean(process.env.TWILIO_DISPATCH_TO_NUMBER);
}

export function getDispatchNumber(): string | null {
  const n = process.env.TWILIO_DISPATCH_TO_NUMBER?.trim();
  return n && E164.test(n) ? n : null;
}

/**
 * Sends an SMS through Twilio's REST API.
 *
 * Recipients must be the dispatch number, on TWILIO_ALLOWED_TO_NUMBERS, or
 * (verifiedFleetRecipient) a driver phone the caller has already verified
 * belongs to their own fleet. This stops the endpoint being used to text
 * arbitrary numbers on the company's Twilio account.
 */
export async function sendSms(
  body: string,
  to: string,
  opts: { verifiedFleetRecipient?: boolean } = {}
): Promise<{ sid: string; status: string; to: string }> {
  const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken, TWILIO_FROM_NUMBER: from, TWILIO_ALLOWED_TO_NUMBERS: allowedRecipients = '' } =
    process.env;

  if (!accountSid || !authToken || !from) {
    throw new TwilioConfigurationError('Text messaging is not set up.');
  }
  if (!E164.test(from) || !E164.test(to)) {
    throw new TwilioConfigurationError('Phone numbers must use E.164 format (e.g. +15551234567).');
  }
  const allowed = new Set([getDispatchNumber(), ...allowedRecipients.split(',').map((n) => n.trim()).filter(Boolean)].filter(Boolean));
  if (!opts.verifiedFleetRecipient && !allowed.has(to)) {
    throw new TwilioRecipientError('The recipient is not enabled for SMS delivery.');
  }

  const base = (process.env.TWILIO_API_BASE || 'https://api.twilio.com').replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1600) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new TwilioDeliveryError('Could not reach Twilio.');
  }
  const result = (await response.json().catch(() => null)) as (TwilioMessageResponse & { message?: string; code?: number }) | null;
  if (!response.ok || !result?.sid) {
    throw new TwilioDeliveryError(
      result?.message ? `Twilio rejected the SMS: ${result.message}` : `Twilio rejected the SMS (HTTP ${response.status}).`
    );
  }
  return { sid: result.sid, status: result.status, to };
}

/** Dispatch alert SMS: defaults to the fleet dispatch number. */
export async function sendDispatchSms(body: string, recipient?: string): Promise<{ sid: string; status: string; to: string }> {
  const to = recipient || getDispatchNumber();
  if (!to) throw new TwilioConfigurationError('Twilio SMS is not configured.');
  return sendSms(body, to);
}
