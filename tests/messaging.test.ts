import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { fleetStore } from '../server/data/fleetStore';
import { listMessages, listThreads, listFleetDrivers, sendMessage, clearMessagesForTesting } from '../server/messaging/messageService';

const ADMIN = { uid: 'msg-admin', role: 'fleet_admin' as const, fleetId: 'FLEETM' };
const DRIVER = { uid: 'msg-drv1', email: 'd1@m.test', role: 'driver' as const, fleetId: 'FLEETM' };
const OTHER_DRIVER = { uid: 'msg-drv2', role: 'driver' as const, fleetId: 'FLEETM' };
const FOREIGN_ADMIN = { uid: 'msg-admin-x', role: 'fleet_admin' as const, fleetId: 'FLEETX' };

const realFetch = globalThis.fetch;
const TW = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_DISPATCH_TO_NUMBER', 'TWILIO_ALLOWED_TO_NUMBERS'];
let saved: Record<string, string | undefined> = {};
let smsCalls: URLSearchParams[] = [];

beforeEach(() => {
  clearMessagesForTesting();
  saved = Object.fromEntries(TW.map((k) => [k, process.env[k]]));
  for (const k of TW) delete process.env[k];
  smsCalls = [];
  fleetStore.seedMockData('driver_profiles', 'msg-drv1', { id: 'msg-drv1', driverId: 'msg-drv1', fleetId: 'FLEETM', name: 'Dana Driver', phone: '+15550001111' });
  fleetStore.seedMockData('driver_profiles', 'msg-drv2', { id: 'msg-drv2', driverId: 'msg-drv2', fleetId: 'FLEETM', name: 'Sam Second' });
  fleetStore.seedMockData('driver_profiles', 'msg-drvx', { id: 'msg-drvx', driverId: 'msg-drvx', fleetId: 'FLEETX', name: 'Xavier' });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function enableTwilio() {
  process.env.TWILIO_ACCOUNT_SID = 'AC123';
  process.env.TWILIO_AUTH_TOKEN = 'tok';
  process.env.TWILIO_FROM_NUMBER = '+15550000000';
  process.env.TWILIO_DISPATCH_TO_NUMBER = '+15559990000';
  globalThis.fetch = (async (_url: any, init: RequestInit = {}) => {
    smsCalls.push(new URLSearchParams(String(init.body)));
    return new Response(JSON.stringify({ sid: `SM${smsCalls.length}`, status: 'queued' }), { status: 201 });
  }) as typeof fetch;
}

describe('Dispatch ⇄ driver messaging', () => {
  it('dispatch and driver share one thread, in order, with incremental polling', async () => {
    const m1 = await sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'Pickup moved to 3pm' });
    await new Promise((r) => setTimeout(r, 5));
    const m2 = await sendMessage(DRIVER, { text: 'Copy, on my way' });
    expect(m1.senderRole).toBe('dispatch');
    expect(m2.senderRole).toBe('driver');
    expect(m2.driverId).toBe('msg-drv1');

    const asDriver = await listMessages(DRIVER);
    expect(asDriver.messages.map((m) => m.text)).toEqual(['Pickup moved to 3pm', 'Copy, on my way']);
    const asAdmin = await listMessages(ADMIN, { driverId: 'msg-drv1' });
    expect(asAdmin.messages.length).toBe(2);
    expect(asAdmin.driverName).toBe('Dana Driver');

    const newer = await listMessages(ADMIN, { driverId: 'msg-drv1', since: m1.createdAt });
    expect(newer.messages.map((m) => m.id)).toEqual([m2.id]);

    const threads = await listThreads(ADMIN);
    expect(threads.length).toBe(1);
    expect(threads[0].lastText).toBe('Copy, on my way');
    expect(threads[0].lastSenderRole).toBe('driver');
  });

  it('drivers cannot read or write other drivers’ threads', async () => {
    await sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'private to Dana' });
    await expect(listMessages(OTHER_DRIVER, { driverId: 'msg-drv1' })).rejects.toThrow('not found');
    await expect(sendMessage(OTHER_DRIVER, { driverId: 'msg-drv1', text: 'hi' })).rejects.toThrow('not found');
    expect((await listMessages(OTHER_DRIVER)).messages).toEqual([]);
    expect(await listThreads(OTHER_DRIVER)).toEqual([]);
  });

  it('other fleets cannot see or message this fleet’s drivers', async () => {
    await sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'fleet M only' });
    await expect(listMessages(FOREIGN_ADMIN, { driverId: 'msg-drv1' })).rejects.toThrow('not found');
    await expect(sendMessage(FOREIGN_ADMIN, { driverId: 'msg-drv1', text: 'x' })).rejects.toThrow('not found');
    expect(await listThreads(FOREIGN_ADMIN)).toEqual([]);
    const drivers = await listFleetDrivers(ADMIN);
    expect(drivers.map((d) => d.driverId).sort()).toEqual(['msg-drv1', 'msg-drv2']);
    expect(drivers.find((d) => d.driverId === 'msg-drv1')!.hasPhone).toBe(true);
  });

  it('validates text and requires a fleet', async () => {
    await expect(sendMessage(ADMIN, { driverId: 'msg-drv1', text: '   ' })).rejects.toThrow('Type a message');
    await expect(sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'x'.repeat(1001) })).rejects.toThrow('limited');
    await expect(sendMessage(ADMIN, { text: 'no driver' })).rejects.toThrow('Choose a driver');
    await expect(sendMessage({ uid: 'u', role: 'driver', fleetId: null }, { text: 'x' })).rejects.toThrow('Join a fleet');
  });
});

describe('SMS copies via Twilio', () => {
  it('reports SMS not set up instead of pretending', async () => {
    const m = await sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'hello', alsoSms: true });
    expect(m.sms).toEqual({ status: 'FAILED', error: 'Text messaging is not set up.' });
  });

  it('texts the driver’s phone on file (verified in-fleet) and the dispatch number for driver replies', async () => {
    enableTwilio();
    const toDriver = await sendMessage(ADMIN, { driverId: 'msg-drv1', text: 'Load ready', alsoSms: true });
    expect(toDriver.sms?.status).toBe('SENT');
    expect(smsCalls[0].get('To')).toBe('+15550001111');
    expect(smsCalls[0].get('Body')).toBe('Dispatch: Load ready');

    const toDispatch = await sendMessage(DRIVER, { text: 'Arrived', alsoSms: true });
    expect(toDispatch.sms?.status).toBe('SENT');
    expect(smsCalls[1].get('To')).toBe('+15559990000');
    expect(smsCalls[1].get('Body')).toBe('Dana Driver: Arrived');
  });

  it('does not text a driver with no phone on file', async () => {
    enableTwilio();
    const m = await sendMessage(ADMIN, { driverId: 'msg-drv2', text: 'hi', alsoSms: true });
    expect(m.sms?.status).toBe('FAILED');
    expect(m.sms?.error).toContain('no phone');
    expect(smsCalls.length).toBe(0);
  });
});
