import { createStopTracker } from './detentionEngine.js';
import { buildEvidencePacket, verifyEvidencePacket } from './evidence.js';
import { buildDetentionInvoice } from './invoice.js';
import { createMemoryStore, createFirestoreStore } from './store.js';

export {
  createStopTracker, buildEvidencePacket, verifyEvidencePacket,
  buildDetentionInvoice, createMemoryStore, createFirestoreStore,
};

/**
 * Service wrapper: one tracker per active stop. Feed it normalized events
 * from your fleet adapters; call finalize() when the truck departs.
 */
export function createDetentionService({ store, defaults = {} } = {}) {
  const trackers = new Map(); // key: `${vehicleId}`

  return {
    startStop(vehicleId, stop, ctx = {}) {
      trackers.set(vehicleId, { tracker: createStopTracker(stop, defaults), ctx });
    },
    ingest(vehicleId, ev) {
      trackers.get(vehicleId)?.tracker.onEvent(ev);
    },
    status(vehicleId) {
      return trackers.get(vehicleId)?.tracker.summary() ?? null;
    },
    async finalize(vehicleId, { invoiceNumber, billTo } = {}) {
      const entry = trackers.get(vehicleId);
      if (!entry) return null;
      const packet = buildEvidencePacket({ tracker: entry.tracker, ...entry.ctx });
      await store?.savePacket(packet);
      const invoice = packet.metrics.detentionMinutes > 0
        ? buildDetentionInvoice({ packet, invoiceNumber, billTo, carrier: entry.ctx.carrier })
        : null;
      trackers.delete(vehicleId);
      return { packet, invoice };
    },
  };
}
