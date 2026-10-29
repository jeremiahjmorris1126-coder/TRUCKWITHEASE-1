// Storage adapters. Memory for tests/dev; Firestore for Cloud Run.

export function createMemoryStore() {
  const packets = new Map();
  const active = new Map(); // vehicleId -> { stop, ctx }
  const events = new Map(); // vehicleId -> event[]
  const cursors = new Map();
  return {
    async getCursor(name) { return cursors.get(name) ?? null; },
    async setCursor(name, value) { cursors.set(name, value); },
    async saveActiveStop(vehicleId, data) { active.set(vehicleId, structuredClone(data)); events.set(vehicleId, []); },
    async getActiveStop(vehicleId) { return structuredClone(active.get(vehicleId) ?? null); },
    async appendEvents(vehicleId, evs) { events.set(vehicleId, [...(events.get(vehicleId) ?? []), ...structuredClone(evs)]); },
    async getEvents(vehicleId) { return structuredClone(events.get(vehicleId) ?? []); },
    async deleteActive(vehicleId) { active.delete(vehicleId); events.delete(vehicleId); },
    async savePacket(packet) {
      packets.set(`${packet.stop.loadId}:${packet.stop.stopId}`, packet);
    },
    async getPacket(loadId, stopId) {
      return packets.get(`${loadId}:${stopId}`) ?? null;
    },
  };
}

// Firestore keeps one doc per stop under detentionPackets/. Packets stay well
// under the 1 MiB doc limit unless a stop has thousands of GPS pings; cap the
// trail upstream if that becomes an issue.
export async function createFirestoreStore({ collection = 'detentionPackets' } = {}) {
  const { Firestore, FieldValue } = await import('@google-cloud/firestore');
  const db = new Firestore(); // uses Cloud Run's default service account
  const stops = db.collection('detentionActiveStops');
  const evs = db.collection('detentionEvents');
  const cur = db.collection('detentionCursors');
  return {
    async getCursor(name) { const s = await cur.doc(name).get(); return s.exists ? s.data().value : null; },
    async setCursor(name, value) { await cur.doc(name).set({ value }); },
    async saveActiveStop(vehicleId, data) {
      await stops.doc(vehicleId).set(data);
      await evs.doc(vehicleId).set({ events: [] });
    },
    async getActiveStop(vehicleId) {
      const snap = await stops.doc(vehicleId).get();
      return snap.exists ? snap.data() : null;
    },
    // arrayUnion also de-duplicates identical events if an adapter retries a batch.
    async appendEvents(vehicleId, list) {
      if (!list.length) return;
      await evs.doc(vehicleId).set({ events: FieldValue.arrayUnion(...list) }, { merge: true });
    },
    async getEvents(vehicleId) {
      const snap = await evs.doc(vehicleId).get();
      return snap.exists ? snap.data().events ?? [] : [];
    },
    async deleteActive(vehicleId) {
      await Promise.all([stops.doc(vehicleId).delete(), evs.doc(vehicleId).delete()]);
    },
    async savePacket(packet) {
      await db.collection(collection).doc(`${packet.stop.loadId}_${packet.stop.stopId}`).set(packet);
    },
    async getPacket(loadId, stopId) {
      const snap = await db.collection(collection).doc(`${loadId}_${stopId}`).get();
      return snap.exists ? snap.data() : null;
    },
  };
}
