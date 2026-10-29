import twilio from 'twilio';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export interface FleetPhoneLine {
  id: string;
  phoneNumber: string;
  assignedFleet: string;
  lineType: 'DISPATCH_PSTN' | 'DRIVER_DIRECT' | 'EMERGENCY_ROADSIDE' | 'SALES' | 'SUPPORT';
  status: 'ACTIVE' | 'PROVISIONING';
  provider: 'twilio_voice' | 'mock_telephony';
  webrtcSupported: boolean;
}

export interface TelephonySession {
  sessionId: string;
  callerNumber: string;
  calleeNumber: string;
  callType: 'IN_APP_VOICE' | 'PSTN_OUTBOUND';
  status: 'RINGING' | 'CONNECTED' | 'COMPLETED';
  webrtcToken?: string;
  startedAt: string;
}

export const FLEET_PHONE_LINES: Record<string, string> = {
  dispatch: process.env.TWILIO_DISPATCH_TO_NUMBER || '+15551230001',
  driver: process.env.TWILIO_ALLOWED_TO_NUMBERS || '+15551230002',
  roadside: '+15551230003',
  sales: '+15551230001',
  support: '+15551230002',
};

let activeLines: FleetPhoneLine[] = [
  {
    id: 'line-main-01',
    phoneNumber: process.env.TWILIO_FROM_NUMBER || '+1-800-555-EASE',
    assignedFleet: 'TruckWithEase Enterprise Fleet',
    lineType: 'DISPATCH_PSTN',
    status: 'ACTIVE',
    provider: process.env.TWILIO_ACCOUNT_SID ? 'twilio_voice' : 'mock_telephony',
    webrtcSupported: true,
  },
  {
    id: 'line-driver-02',
    phoneNumber: '+1-555-839-2041',
    assignedFleet: 'TruckWithEase Unit 101 Direct',
    lineType: 'DRIVER_DIRECT',
    status: 'ACTIVE',
    provider: 'mock_telephony',
    webrtcSupported: true,
  },
];

export function isTwilioVoiceConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY &&
    process.env.TWILIO_API_SECRET
  );
}

export function generateTwilioVoiceToken(identity?: string): string {
  const callerId = identity || `web-driver-${Date.now()}`;

  if (isTwilioVoiceConfigured()) {
    try {
      const token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_API_KEY!,
        process.env.TWILIO_API_SECRET!,
        { identity: callerId }
      );

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: process.env.TWIML_APP_SID || process.env.TWILIO_TWIML_APP_SID,
        incomingAllow: true,
      });

      token.addGrant(voiceGrant);
      return token.toJwt();
    } catch (err) {
      console.warn('[TelephonyService] Live Twilio token generation threw, falling back to mock JWT:', (err as Error).message);
    }
  }

  // Fallback JWT for testing WebRTC when Twilio API Key is not yet configured in local environment
  const payload = {
    iss: 'TruckWithEase-Softphone',
    sub: callerId,
    mode: 'MOCK_VOICE_GATEWAY',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `mock_voice_token_${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

export function generateVoiceTwiML(lineKey = 'dispatch', customCallerId?: string): string {
  const destinationNumber = FLEET_PHONE_LINES[lineKey] || FLEET_PHONE_LINES.dispatch;
  const callerId = customCallerId || process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_NUMBER || '+15551230000';

  const vr = new twilio.twiml.VoiceResponse();
  const dial = vr.dial({ callerId });
  dial.number(destinationNumber);
  return vr.toString();
}

export function getTelephonyStatus(): { configured: boolean; provider: string; activeLinesCount: number; lines: FleetPhoneLine[] } {
  const configured = isTwilioVoiceConfigured();
  return {
    configured,
    provider: configured ? 'Twilio Voice SDK + WebRTC Softphone' : 'Twilio Softphone Gateway (Mock Fallback)',
    activeLinesCount: activeLines.length,
    lines: activeLines,
  };
}

export function createCallSession(caller: string, callee: string, callType: 'IN_APP_VOICE' | 'PSTN_OUTBOUND'): TelephonySession {
  return {
    sessionId: `call-${Date.now()}`,
    callerNumber: caller,
    calleeNumber: callee,
    callType,
    status: 'CONNECTED',
    webrtcToken: generateTwilioVoiceToken(caller),
    startedAt: new Date().toISOString(),
  };
}

export function provisionFleetLine(fleetName: string, lineType: FleetPhoneLine['lineType']): FleetPhoneLine {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newLine: FleetPhoneLine = {
    id: `line-${Date.now()}`,
    phoneNumber: `+1-555-01${randomSuffix.toString().slice(0, 2)}`,
    assignedFleet: fleetName,
    lineType,
    status: 'ACTIVE',
    provider: isTwilioVoiceConfigured() ? 'twilio_voice' : 'mock_telephony',
    webrtcSupported: true,
  };
  activeLines.push(newLine);
  return newLine;
}
