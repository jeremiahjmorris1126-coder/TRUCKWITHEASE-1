import { getDb } from '../firestore';
import { EvidencePacket, DetentionInvoice, DetentionStop, TelematicsEvent } from './types';

// In-memory backing maps for test/development or when Firestore is offline
const memoryPackets = new Map<string, EvidencePacket>(); // hash -> EvidencePacket
const memoryInvoices = new Map<string, DetentionInvoice>(); // invoiceNumber -> DetentionInvoice
const memoryActiveStops = new Map<string, { stop: DetentionStop; ctx: any; fleetId?: string | null }>(); // vehicleId -> data
const memoryEvents = new Map<string, TelematicsEvent[]>(); // key (vehicleId, load:loadId, stop:stopId) -> events[]

export class DetentionStore {
  /**
   * Save an active stop tracker definition for a vehicle.
   */
  async saveActiveStop(
    vehicleId: string,
    data: { stop: DetentionStop; ctx: any; fleetId?: string | null }
  ): Promise<void> {
    memoryActiveStops.set(vehicleId, structuredClone(data));
    if (data.stop?.loadId) {
      memoryActiveStops.set(`load:${data.stop.loadId}`, structuredClone(data));
    }
    if (data.stop?.stopId) {
      memoryActiveStops.set(`stop:${data.stop.stopId}`, structuredClone(data));
    }
    memoryEvents.set(vehicleId, []);
    if (data.stop?.loadId) {
      memoryEvents.set(`load:${data.stop.loadId}`, []);
    }
    if (data.stop?.stopId) {
      memoryEvents.set(`stop:${data.stop.stopId}`, []);
    }

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection('detentionActiveStops').doc(vehicleId).set(data);
        await (db as any).collection('detentionEvents').doc(vehicleId).set({ events: [] });
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore saveActiveStop failed: ${err.message}`);
      }
    }
  }

  /**
   * Retrieve active stop for a vehicle.
   */
  async getActiveStop(
    vehicleId: string
  ): Promise<{ stop: DetentionStop; ctx: any; fleetId?: string | null } | null> {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection('detentionActiveStops').doc(vehicleId).get();
        if (snap.exists) return snap.data();
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getActiveStop failed: ${err.message}`);
      }
    }
    return structuredClone(memoryActiveStops.get(vehicleId) ?? null);
  }

  /**
   * Append telematics events for an active stop or load.
   */
  async appendEvents(
    vehicleId: string,
    events: TelematicsEvent[],
    meta?: { loadId?: string; stopId?: string }
  ): Promise<void> {
    if (!events.length) return;
    const active = memoryActiveStops.get(vehicleId);
    const loadId = meta?.loadId || active?.stop?.loadId;
    const stopId = meta?.stopId || active?.stop?.stopId;

    const keys = new Set<string>();
    if (vehicleId) keys.add(vehicleId);
    if (loadId) keys.add(`load:${loadId}`);
    if (stopId) keys.add(`stop:${stopId}`);

    for (const k of keys) {
      const existing = memoryEvents.get(k) || [];
      memoryEvents.set(k, [...existing, ...structuredClone(events)]);
    }

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const { FieldValue } = await import('@google-cloud/firestore').catch(() => ({ FieldValue: null as any }));
        if (FieldValue && typeof FieldValue.arrayUnion === 'function') {
          await (db as any)
            .collection('detentionEvents')
            .doc(vehicleId)
            .set({ events: FieldValue.arrayUnion(...events) }, { merge: true });
        } else {
          const snap = await (db as any).collection('detentionEvents').doc(vehicleId).get();
          const current = snap.exists ? snap.data().events || [] : [];
          await (db as any).collection('detentionEvents').doc(vehicleId).set({ events: [...current, ...events] });
        }
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore appendEvents failed: ${err.message}`);
      }
    }
  }

  /**
   * Get all accumulated telematics events for a load, stop, or vehicle.
   */
  async getEventsForLoadAndStop(
    loadId: string,
    stopId?: string,
    vehicleId?: string
  ): Promise<TelematicsEvent[]> {
    const combined: TelematicsEvent[] = [];
    const seen = new Set<string>();
    const candidateKeys = [
      `load:${loadId}`,
      loadId,
      ...(stopId ? [`stop:${stopId}`, stopId] : []),
      ...(vehicleId ? [vehicleId] : []),
    ];

    for (const k of candidateKeys) {
      const list = await this.getEvents(k);
      for (const ev of list) {
        const dedupKey = `${ev.type}|${(ev as any).event ?? ''}|${ev.ts}|${(ev as any).state ?? ''}|${(ev as any).lat ?? ''}|${(ev as any).lng ?? ''}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          combined.push(ev);
        }
      }
    }

    return combined.sort((a, b) => a.ts - b.ts);
  }

  /**
   * Get all accumulated telematics events for a vehicle.
   */
  async getEvents(vehicleId: string): Promise<TelematicsEvent[]> {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection('detentionEvents').doc(vehicleId).get();
        if (snap.exists) return snap.data().events || [];
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getEvents failed: ${err.message}`);
      }
    }
    return structuredClone(memoryEvents.get(vehicleId) ?? []);
  }

  /**
   * Delete active stop and its raw events upon finalization.
   */
  async deleteActive(vehicleId: string): Promise<void> {
    memoryActiveStops.delete(vehicleId);
    memoryEvents.delete(vehicleId);

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await Promise.all([
          (db as any).collection('detentionActiveStops').doc(vehicleId).delete(),
          (db as any).collection('detentionEvents').doc(vehicleId).delete(),
        ]);
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore deleteActive failed: ${err.message}`);
      }
    }
  }

  /**
   * Save finalized, immutable evidence packet keyed by its SHA-256 hash.
   */
  async savePacket(packet: EvidencePacket): Promise<void> {
    const hash = packet.integrity.hash.toLowerCase();
    memoryPackets.set(hash, structuredClone(packet));
    // Also index by loadId:stopId for fast load lookup
    memoryPackets.set(`${packet.stop.loadId}:${packet.stop.stopId}`, structuredClone(packet));

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection('detentionPackets').doc(hash).set(packet);
        await (db as any)
          .collection('detentionPacketsByLoad')
          .doc(`${packet.stop.loadId}_${packet.stop.stopId}`)
          .set({ hash, loadId: packet.stop.loadId, stopId: packet.stop.stopId, generatedAt: packet.generatedAt });
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore savePacket failed: ${err.message}`);
      }
    }
  }

  /**
   * Retrieve an evidence packet by SHA-256 hash.
   */
  async getPacketByHash(hash: string): Promise<EvidencePacket | null> {
    if (!hash || typeof hash !== 'string') return null;
    const cleanHash = hash.toLowerCase().trim();

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection('detentionPackets').doc(cleanHash).get();
        if (snap.exists) return snap.data();
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getPacketByHash failed: ${err.message}`);
      }
    }
    return structuredClone(memoryPackets.get(cleanHash) ?? null);
  }

  /**
   * Retrieve an evidence packet by load ID and stop ID.
   */
  async getPacketByLoadAndStop(loadId: string, stopId: string): Promise<EvidencePacket | null> {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const indexSnap = await (db as any).collection('detentionPacketsByLoad').doc(`${loadId}_${stopId}`).get();
        if (indexSnap.exists) {
          const hash = indexSnap.data().hash;
          return this.getPacketByHash(hash);
        }
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getPacketByLoadAndStop failed: ${err.message}`);
      }
    }
    return structuredClone(memoryPackets.get(`${loadId}:${stopId}`) ?? null);
  }

  /**
   * Save a generated detention invoice.
   */
  async saveInvoice(invoice: DetentionInvoice): Promise<void> {
    memoryInvoices.set(invoice.invoiceNumber, structuredClone(invoice));
    memoryInvoices.set(`load:${invoice.loadId}`, structuredClone(invoice));

    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        await (db as any).collection('detentionInvoices').doc(invoice.invoiceNumber).set(invoice);
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore saveInvoice failed: ${err.message}`);
      }
    }
  }

  /**
   * Retrieve an invoice by invoice number.
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<DetentionInvoice | null> {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection('detentionInvoices').doc(invoiceNumber).get();
        if (snap.exists) return snap.data();
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getInvoiceByNumber failed: ${err.message}`);
      }
    }
    return structuredClone(memoryInvoices.get(invoiceNumber) ?? null);
  }

  /**
   * Retrieve invoices for a load.
   */
  async getInvoiceByLoadId(loadId: string): Promise<DetentionInvoice | null> {
    const db = getDb();
    if (db && typeof (db as any).collection === 'function') {
      try {
        const snap = await (db as any).collection('detentionInvoices').where('loadId', '==', loadId).limit(1).get();
        if (!snap.empty) return snap.docs[0].data();
      } catch (err: any) {
        console.warn(`[DetentionStore] Firestore getInvoiceByLoadId failed: ${err.message}`);
      }
    }
    return structuredClone(memoryInvoices.get(`load:${loadId}`) ?? null);
  }
}

export const detentionStore = new DetentionStore();
