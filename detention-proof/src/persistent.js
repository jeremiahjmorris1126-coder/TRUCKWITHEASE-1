import { createDetentionService } from './index.js';

/**
 * Wraps the in-memory service so any Cloud Run instance can serve any request:
 * active stops and their events live in the store, and a tracker is rebuilt by
 * replaying events when an instance has not seen that vehicle yet.
 */
export function createPersistentService({ store, defaults = {} }) {
  const svc = createDetentionService({ store, defaults });

  async function ensure(vehicleId) {
    if (svc.status(vehicleId) !== null) return true;
    const active = await store.getActiveStop(vehicleId);
    if (!active) return false;
    svc.startStop(vehicleId, active.stop, active.ctx);
    const past = (await store.getEvents(vehicleId)).sort((a, b) => a.ts - b.ts);
    past.forEach((e) => svc.ingest(vehicleId, e));
    return true;
  }

  return {
    async startStop(vehicleId, stop, ctx = {}) {
      await store.saveActiveStop(vehicleId, { stop, ctx });
      svc.startStop(vehicleId, stop, ctx);
    },
    async ingest(vehicleId, events) {
      if (!(await ensure(vehicleId))) return false;
      events.forEach((e) => svc.ingest(vehicleId, e));
      await store.appendEvents(vehicleId, events);
      return true;
    },
    async status(vehicleId) {
      return (await ensure(vehicleId)) ? svc.status(vehicleId) : null;
    },
    async finalize(vehicleId, opts) {
      if (!(await ensure(vehicleId))) return null;
      const result = await svc.finalize(vehicleId, opts);
      await store.deleteActive(vehicleId);
      return result;
    },
    getPacket: (loadId, stopId) => store.getPacket(loadId, stopId),
  };
}
