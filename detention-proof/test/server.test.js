import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createMemoryStore } from '../src/store.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);
const KEY = 'test-key';
const stop = { stopId: 's1', loadId: 'L1', kind: 'delivery', fence: { center: { lat: 38.78, lng: -90.48 }, radiusM: 200 }, freeMinutes: 60, ratePerHour: 60 };
const gps = (ts, inside) => ({ type: 'gps', ts, lat: inside ? 38.7801 : 38.8, lng: inside ? -90.4801 : -90.5 });

async function boot(store = createMemoryStore()) {
  const server = createServer({ store, apiKey: KEY });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, key = KEY) =>
    fetch(base + path, { method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(async (r) => ({ status: r.status, body: await r.json() }));
  return { server, call, store };
}

test('rejects missing/wrong key but serves healthz', async () => {
  const { server, call } = await boot();
  assert.equal((await call('GET', '/healthz')).status, 200);
  assert.equal((await call('GET', '/v1/vehicles/t1/status', null, 'nope')).status, 401);
  server.close();
});

test('full flow: dispatch, ingest, status, finalize, fetch packet, verify', async () => {
  const { server, call } = await boot();
  assert.equal((await call('POST', '/v1/stops', { vehicleId: 't1', stop, ctx: { carrier: { name: 'Test Carrier' } } })).status, 201);
  const ing = await call('POST', '/v1/vehicles/t1/events', { events: [
    gps(T0, true), gps(T0 + MIN, true),
    { type: 'door', ts: T0 + 90 * MIN, state: 'open' },
    { type: 'door', ts: T0 + 110 * MIN, state: 'closed' },
    gps(T0 + 150 * MIN, false), gps(T0 + 151 * MIN, false),
  ] });
  assert.equal(ing.status, 202);
  const fin = await call('POST', '/v1/vehicles/t1/finalize', { invoiceNumber: 'D-9', billTo: { name: 'Broker' } });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.packet.metrics.detentionMinutes, 90);
  assert.equal(fin.body.packet.metrics.amount, 90);
  const got = await call('GET', '/v1/packets/L1/s1');
  assert.equal(got.status, 200);
  assert.equal((await call('POST', '/v1/verify', got.body)).body.valid, true);
  assert.equal((await call('GET', '/v1/vehicles/t1/status')).status, 404); // cleaned up
  server.close();
});

test('a second instance rebuilds state from the store', async () => {
  const store = createMemoryStore();
  const a = await boot(store);
  await a.call('POST', '/v1/stops', { vehicleId: 't2', stop });
  await a.call('POST', '/v1/vehicles/t2/events', { events: [gps(T0, true), gps(T0 + MIN, true)] });
  a.server.close();
  const b = await boot(store); // fresh process, same Firestore
  const st = await b.call('GET', '/v1/vehicles/t2/status');
  assert.equal(st.status, 200);
  assert.equal(st.body.status, 'on_site');
  b.server.close();
});

test('validation errors return 400', async () => {
  const { server, call } = await boot();
  assert.equal((await call('POST', '/v1/stops', { vehicleId: 't3', stop: { ...stop, kind: 'lunch' } })).status, 400);
  await call('POST', '/v1/stops', { vehicleId: 't3', stop });
  assert.equal((await call('POST', '/v1/vehicles/t3/events', { events: [{ type: 'gps', ts: 1, lat: 999, lng: 0 }] })).status, 400);
  assert.equal((await call('POST', '/v1/vehicles/nobody/events', { events: [gps(T0, true)] })).status, 404);
  server.close();
});
