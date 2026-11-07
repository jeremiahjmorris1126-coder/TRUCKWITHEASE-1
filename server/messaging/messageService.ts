import crypto from 'crypto';
import type { CallerIdentity } from '../data/fleetStore';
import { getDb } from '../firestore';
import { fleetStore } from '../data/fleetStore';
import { sendSms, isSmsConfigured, getDispatchNumber } from '../twilioMessaging';

/**
 * Dispatch ⇄ driver messaging.
 *
 * One conversation thread per driver, inside that driver's fleet:
 *   Firestore: message_threads/{fleetId}__{driverId}            (thread summary)
 *              message_threads/{fleetId}__{driverId}/messages/{id}
 * Ordering uses a single field (createdAt), so no composite index is needed.
 * Without Firestore credentials (local dev/tests) an in-memory store is used.
 *
 * Access rules (enforced here, not by the client):
 *   - driver: only their own thread
 *   - fleet_admin: any driver thread in their fleet
 *   - owner: any thread in the fleet they act for
 */

export interface DispatchMessage {
  id: string;
  fleetId: string;
  driverId: string; // thread key
  senderUid: string;
  senderRole: 'driver' | 'dispatch';
  text: string;
  createdAt: string;
  sms?: { status: 'SENT' | 'FAILED'; sid?: string; error?: string } | null;
}

export interface MessageThread {
  id: string;
  fleetId: string;
  driverId: string;
  driverName: string;
  lastText: string;
  lastAt: string;
  lastSenderRole: 'driver' | 'dispatch';
}

export class MessagingError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'MessagingError';
  }
}

const MAX_TEXT = 1000;
const memThreads = new Map<string, MessageThread>();
const memMessages = new Map<string, DispatchMessage[]>();

const threadKey = (fleetId: string, driverId: string) => `${fleetId}__${driverId}`;

/** Resolves which thread the caller may access; throws 403/404 otherwise. */
async function resolveThread(caller: CallerIdentity, requestedDriverId?: string): Promise<{ fleetId: string; driverId: string; driverName: string; driverPhone: string | null }> {
  if (!caller?.fleetId) throw new MessagingError('Join a fleet to use messaging.', 403);
  if (caller.role === 'driver') {
    if (requestedDriverId && requestedDriverId !== caller.uid) throw new MessagingError('Conversation not found.', 404);
    const profile = await fleetStore.getScopedDocument<any>(caller, 'driver_profiles', caller.uid);
    return { fleetId: caller.fleetId, driverId: caller.uid, driverName: profile?.name || caller.email || 'Driver', driverPhone: profile?.phone || null };
  }
  if (!requestedDriverId) throw new MessagingError('Choose a driver.', 400);
  // The driver must belong to the caller's fleet (getScopedDocument enforces tenant isolation).
  const profile = await fleetStore.getScopedDocument<any>(caller, 'driver_profiles', requestedDriverId);
  if (!profile || (caller.role !== 'owner' && profile.fleetId !== caller.fleetId)) {
    throw new MessagingError('Driver not found in your fleet.', 404);
  }
  return {
    fleetId: profile.fleetId || caller.fleetId,
    driverId: requestedDriverId,
    driverName: profile.name || requestedDriverId,
    driverPhone: typeof profile.phone === 'string' ? profile.phone : null,
  };
}

async function saveMessage(msg: DispatchMessage, thread: MessageThread): Promise<void> {
  const db = getDb() as any;
  if (db) {
    const ref = db.collection('message_threads').doc(thread.id);
    await ref.set(thread, { merge: true });
    await ref.collection('messages').doc(msg.id).set(msg);
    return;
  }
  memThreads.set(thread.id, thread);
  const list = memMessages.get(thread.id) || [];
  list.push(msg);
  memMessages.set(thread.id, list);
}

async function updateMessage(threadId: string, msg: DispatchMessage): Promise<void> {
  const db = getDb() as any;
  if (db) {
    await db.collection('message_threads').doc(threadId).collection('messages').doc(msg.id).set(msg, { merge: true });
  }
  // in-memory objects are mutated in place
}

export async function listMessages(
  caller: CallerIdentity,
  opts: { driverId?: string; since?: string; limit?: number } = {}
): Promise<{ driverId: string; driverName: string; messages: DispatchMessage[] }> {
  const t = await resolveThread(caller, opts.driverId);
  const id = threadKey(t.fleetId, t.driverId);
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 200));
  const sinceMs = opts.since ? Date.parse(opts.since) : NaN;
  let messages: DispatchMessage[];

  const db = getDb() as any;
  if (db) {
    let q = db.collection('message_threads').doc(id).collection('messages');
    if (Number.isFinite(sinceMs)) {
      q = q.where('createdAt', '>', new Date(sinceMs).toISOString()).orderBy('createdAt', 'asc').limit(limit);
      messages = (await q.get()).docs.map((d: any) => d.data());
    } else {
      // Most recent N, returned oldest-first.
      q = q.orderBy('createdAt', 'desc').limit(limit);
      messages = (await q.get()).docs.map((d: any) => d.data()).reverse();
    }
  } else {
    const all = memMessages.get(id) || [];
    messages = Number.isFinite(sinceMs) ? all.filter((m) => Date.parse(m.createdAt) > sinceMs).slice(0, limit) : all.slice(-limit);
  }
  return { driverId: t.driverId, driverName: t.driverName, messages };
}

export async function listThreads(caller: CallerIdentity): Promise<MessageThread[]> {
  if (!caller?.fleetId) throw new MessagingError('Join a fleet to use messaging.', 403);
  if (caller.role === 'driver') {
    const id = threadKey(caller.fleetId, caller.uid);
    const db = getDb() as any;
    const t = db ? (await db.collection('message_threads').doc(id).get()).data() : memThreads.get(id);
    return t ? [t] : [];
  }
  const db = getDb() as any;
  const threads: MessageThread[] = db
    ? (await db.collection('message_threads').where('fleetId', '==', caller.fleetId).limit(500).get()).docs.map((d: any) => d.data())
    : [...memThreads.values()].filter((t) => t.fleetId === caller.fleetId);
  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Drivers in the caller's fleet that dispatch can start a conversation with. */
export async function listFleetDrivers(caller: CallerIdentity): Promise<{ driverId: string; name: string; hasPhone: boolean; phone: string | null }[]> {
  if (!caller?.fleetId || caller.role === 'driver') throw new MessagingError('Only dispatch can list drivers.', 403);
  const profiles = await fleetStore.listScopedCollection<any>(caller, 'driver_profiles', { limit: 500 });
  return profiles
    .filter((p) => p.fleetId === caller.fleetId)
    .map((p) => {
      const hasPhone = typeof p.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(p.phone);
      return { driverId: p.driverId || p.id, name: p.name || p.id, hasPhone, phone: hasPhone ? p.phone : null };
    });
}

export async function sendMessage(
  caller: CallerIdentity,
  input: { driverId?: string; text?: string; alsoSms?: boolean }
): Promise<DispatchMessage> {
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (!text) throw new MessagingError('Type a message.');
  if (text.length > MAX_TEXT) throw new MessagingError(`Messages are limited to ${MAX_TEXT} characters.`);

  const t = await resolveThread(caller, input?.driverId);
  const senderRole: DispatchMessage['senderRole'] = caller.role === 'driver' ? 'driver' : 'dispatch';
  const now = new Date().toISOString();
  const msg: DispatchMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    fleetId: t.fleetId,
    driverId: t.driverId,
    senderUid: caller.uid,
    senderRole,
    text,
    createdAt: now,
    sms: null,
  };
  const thread: MessageThread = {
    id: threadKey(t.fleetId, t.driverId),
    fleetId: t.fleetId,
    driverId: t.driverId,
    driverName: t.driverName,
    lastText: text.slice(0, 140),
    lastAt: now,
    lastSenderRole: senderRole,
  };
  await saveMessage(msg, thread);

  // Optional SMS copy: dispatch → driver's phone on file; driver → fleet dispatch number.
  if (input?.alsoSms) {
    const to = senderRole === 'dispatch' ? t.driverPhone : getDispatchNumber();
    if (!isSmsConfigured()) {
      msg.sms = { status: 'FAILED', error: 'Text messaging is not set up.' };
    } else if (!to) {
      msg.sms = { status: 'FAILED', error: senderRole === 'dispatch' ? 'Driver has no phone number on file.' : 'No dispatch number set.' };
    } else {
      try {
        const prefix = senderRole === 'dispatch' ? 'Dispatch' : `${t.driverName}`;
        const r = await sendSms(`${prefix}: ${text}`, to, { verifiedFleetRecipient: senderRole === 'dispatch' });
        msg.sms = { status: 'SENT', sid: r.sid };
      } catch (err) {
        msg.sms = { status: 'FAILED', error: (err as Error).message };
      }
    }
    await updateMessage(thread.id, msg);
  }
  return msg;
}

/** Test helper. */
export function clearMessagesForTesting(): void {
  memThreads.clear();
  memMessages.clear();
}
