import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatE164Phone,
  generateDispatchTwiML,
  initiateDispatchVoiceCall,
  terminateVoiceCall,
  recordTelecomSms,
  getTelecomCallHistory,
  getTelecomLedgerSummary,
  TWILIO_VOICE_RATE_PER_MIN_USD,
  TWILIO_SMS_RATE_PER_SEGMENT_USD,
} from '../server/twilioMessaging.ts';

test('Phone number E.164 formatting & normalization', () => {
  assert.equal(formatE164Phone('(312) 555-8821'), '+13125558821');
  assert.equal(formatE164Phone('1-800-555-0199'), '+18005550199');
  assert.equal(formatE164Phone('3125558821'), '+13125558821');
  assert.equal(formatE164Phone('+13125558821'), '+13125558821');
  assert.equal(formatE164Phone(''), '+15550000000');
});

test('TwiML XML voice generation & safety text escaping', () => {
  const twiml = generateDispatchTwiML(
    'Low clearance bridge ahead on I-20 & detour required <test>',
    'TRK-904',
    'Jeremiah Morris'
  );

  assert.ok(twiml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(twiml.includes('<Response>'));
  assert.ok(twiml.includes('<Say voice="Polly.Matthew" language="en-US">'));
  assert.ok(twiml.includes('Jeremiah Morris'));
  assert.ok(twiml.includes('TRK-904'));
  // Special characters like < > must be escaped
  assert.ok(!twiml.includes('<test>'));
  assert.ok(twiml.includes('</Response>'));
});

test('Voice call initiation pings server and records to telecom ledger', async () => {
  const call = await initiateDispatchVoiceCall({
    to: '(312) 555-8821',
    driverName: 'Jeremiah J. Morris',
    truckUnit: 'TRK-904',
    message: 'Clearance alert: Please detour via Loop 820 North.',
    isEmergency: false,
  });

  assert.ok(call.callSid.startsWith('CA'));
  assert.equal(call.to, '+13125558821');
  assert.equal(call.driverName, 'Jeremiah J. Morris');
  assert.equal(call.truckUnit, 'TRK-904');
  assert.equal(call.costUsd, TWILIO_VOICE_RATE_PER_MIN_USD);
  assert.ok(['initiated', 'in-progress', 'queued'].includes(call.status));

  const history = getTelecomCallHistory(10);
  const found = history.find((c) => c.callSid === call.callSid);
  assert.ok(found, 'Call record must be logged in server ledger');
});

test('Call termination calculates carrier toll accounting ("paying the server")', async () => {
  // Test with 75 seconds duration -> 2 billable minutes
  const call = await initiateDispatchVoiceCall({
    to: '+13125558821',
    driverName: 'Toll Test Driver',
    truckUnit: 'TRK-904',
  });

  const completed = terminateVoiceCall(call.callSid, 75);
  assert.ok(completed !== null);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.durationSeconds, 75);

  // 75s = 2 minutes @ $0.014/min = $0.0280
  const expectedToll = Number((2 * TWILIO_VOICE_RATE_PER_MIN_USD).toFixed(4));
  assert.equal(completed.costUsd, expectedToll);
});

test('SMS recording and telecommunications ledger summary calculation', () => {
  const sms = recordTelecomSms({
    sid: 'SM-TEST-AUDIT-01',
    to: '+13125558821',
    body: 'Priority load dispatch confirmation for Load LD-904.',
    attachedLoadId: 'LD-904',
  });

  assert.equal(sms.messageSid, 'SM-TEST-AUDIT-01');
  assert.equal(sms.costUsd, TWILIO_SMS_RATE_PER_SEGMENT_USD);
  assert.equal(sms.status, 'delivered');

  const summary = getTelecomLedgerSummary();
  assert.ok(summary.totalCalls >= 1);
  assert.ok(summary.totalSmsSent >= 1);
  assert.ok(summary.totalTelecomCostUsd > 0);
  assert.equal(summary.voiceRatePerMinuteUsd, TWILIO_VOICE_RATE_PER_MIN_USD);
  assert.equal(summary.smsRatePerSegmentUsd, TWILIO_SMS_RATE_PER_SEGMENT_USD);
});
