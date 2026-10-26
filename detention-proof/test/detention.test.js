import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetentionService, createMemoryStore, verifyEvidencePacket } from '../src/index.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);
const fence = { center: { lat: 38.78, lng: -90.48 }, radiusM: 200 };
const inside = (ts) => ({ type: 'gps', ts, lat: 38.7801, lng: -90.4801 });
const outside = (ts) => ({ type: 'gps', ts, lat: 38.80, lng: -90.50 });

function run(events, stopOverrides = {}) {
  const store = createMemoryStore();
  const svc = createDetentionService({ store });
  svc.startStop('truck1', { stopId: 's1', loadId: 'L100', kind: 'pickup', fence, freeMinutes: 120, ratePerHour: 60, ...stopOverrides },
    { carrier: { name: 'Morris Trucking' }, vehicle: { id: 'truck1' }, driver: { name: 'Test Driver' } });
  events.forEach((e) => svc.ingest('truck1', e));
  return { svc, store };
}

test('bills detention beyond free time and records wait before door open', async () => {
  const { svc } = run([
    outside(T0 - 10 * MIN),
    inside(T0), inside(T0 + 5 * MIN),
    { type: 'door', ts: T0 + 200 * MIN, state: 'open' },
    { type: 'door', ts: T0 + 230 * MIN, state: 'closed' },
    inside(T0 + 235 * MIN),
    outside(T0 + 240 * MIN), outside(T0 + 245 * MIN),
  ]);
  const { packet, invoice } = await svc.finalize('truck1', { invoiceNumber: 'D-1', billTo: { name: 'Broker Co' } });
  assert.equal(packet.metrics.dwellMinutes, 240);
  assert.equal(packet.metrics.detentionMinutes, 120);
  assert.equal(packet.metrics.amount, 120);
  assert.equal(packet.metrics.waitBeforeDoorMinutes, 200);
  assert.equal(packet.metrics.dockWorkMinutes, 30);
  assert.ok(invoice.text.includes('AMOUNT DUE: $120.00'));
  assert.ok(verifyEvidencePacket(packet));
});

test('no invoice when within free time', async () => {
  const { svc } = run([inside(T0), inside(T0 + MIN), outside(T0 + 60 * MIN), outside(T0 + 61 * MIN)]);
  const { invoice, packet } = await svc.finalize('truck1');
  assert.equal(packet.metrics.detentionMinutes, 0);
  assert.equal(invoice, null);
});

test('clock starts at appointment time when truck arrives early', async () => {
  const { svc } = run([inside(T0), inside(T0 + MIN), outside(T0 + 240 * MIN), outside(T0 + 241 * MIN)],
    { appointmentTs: T0 + 60 * MIN });
  const { packet } = await svc.finalize('truck1');
  assert.equal(packet.metrics.detentionMinutes, 60); // 240 - 60 appt - 120 free
});

test('ignores single GPS blips and tampering is detected', async () => {
  const { svc } = run([inside(T0), outside(T0 + MIN), inside(T0 + 2 * MIN), inside(T0 + 3 * MIN),
    outside(T0 + 200 * MIN), outside(T0 + 201 * MIN)]);
  const { packet } = await svc.finalize('truck1');
  assert.equal(packet.timeline.arrival, new Date(T0 + 2 * MIN).toISOString());
  const tampered = structuredClone(packet);
  tampered.metrics.detentionMinutes += 30;
  assert.equal(verifyEvidencePacket(tampered), false);
});
