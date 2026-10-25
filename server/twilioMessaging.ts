interface TwilioMessageResponse {
  sid: string;
  status: string;
}

export class TwilioConfigurationError extends Error {}

export class TwilioDeliveryError extends Error {}

export class TwilioRecipientError extends Error {}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.TWILIO_DISPATCH_TO_NUMBER
  );
}

export async function sendDispatchSms(body: string, recipient?: string): Promise<{
  sid: string;
  status: string;
  to: string;
}> {
  const {
    TWILIO_ACCOUNT_SID: accountSid,
    TWILIO_AUTH_TOKEN: authToken,
    TWILIO_FROM_NUMBER: from,
    TWILIO_DISPATCH_TO_NUMBER: dispatchTo,
    TWILIO_ALLOWED_TO_NUMBERS: allowedRecipients = '',
  } = process.env;

  if (!accountSid || !authToken || !from || !dispatchTo) {
    throw new TwilioConfigurationError('Twilio SMS is not configured.');
  }

  const to = recipient || dispatchTo;
  if (!/^\+[1-9]\d{7,14}$/.test(from) || !/^\+[1-9]\d{7,14}$/.test(to)) {
    throw new TwilioConfigurationError('Twilio phone numbers must use E.164 format.');
  }
  const allowedNumbers = new Set([
    dispatchTo,
    ...allowedRecipients.split(',').map((number) => number.trim()).filter(Boolean),
  ]);
  if (!allowedNumbers.has(to)) {
    throw new TwilioRecipientError('The recipient is not enabled for SMS delivery.');
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const result = (await response.json().catch(() => null)) as TwilioMessageResponse | null;
    if (!response.ok || !result?.sid) {
      throw new TwilioDeliveryError('Twilio rejected the SMS request.');
    }

    return { sid: result.sid, status: result.status, to };
  } catch (error) {
    if (error instanceof TwilioDeliveryError) throw error;
    throw new TwilioDeliveryError('Twilio SMS request failed.');
  }
}
