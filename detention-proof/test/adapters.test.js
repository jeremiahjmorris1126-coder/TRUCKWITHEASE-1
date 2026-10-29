import test from 'node:test';
import assert from 'node:assert/strict';
import { createSamsaraMapper } from '../src/adapters/samsara.js';
import { mapMotiveLocation, createMotiveDoorMapper } from '../src/adapters/motive.js';
import { pollSamsaraOnce } from '../src/adapters/poller.js';
import { createStopTracker } from '../src/detentionEngine.js';
import { createMemoryStore } from '../src/store.js';

const rec = (extra = {}) => ({
  id: 's-1',
  gps: [{ time: '2026-10-26T08:00:00Z', latitude: 38.78, longitude: -90.48, speedMilesPerHour: 0 }],
  auxInput1: [
    { time: '2026-10-26T08:10:00Z', value: false },
    { time: '2026-10-26T08:20:00Z', value: true },
    { time: '2026-10-26T08:21:00Z', value: true },
    { time: '2026-10-26T08:40:00Z', value: false },
  ],
  ...extra,
});

test('samsara mapper emits gps and only door transitions', () => {
  const ev = createSamsaraMapper()(rec());
  assert.equal(ev.filter((e) => e.type === 'gps').length, 1);
  const doors = ev.filter((e) => e.type === 'door').map((e) => e.state);
  assert.deepEqual(doors, ['closed', 'open', 'closed']);
});

test('samsara mapper handles a single-object snapshot and inverted sensors', () => {
  const ev = createSamsaraMapper({ doorOpenWhen: false })({ id: 'x', gps: { time: 1, latitude: 1, longitude: 2 }, auxInput1: { time: 2, value: false } });
  assert.equal(ev.find((e) => e.type === 'door').state, 'open');
});

test('motive mappers', () => {
  assert.deepEqual(mapMotiveLocation({ located_at: '2026-10-26T08:00:00Z', lat: 1, lon: 2 }), { type: 'gps', ts: Date.parse('2026-10-26T08:00:00Z'), lat: 1, lng: 2 });
  assert.equal(mapMotiveLocation({ lat: 1 }), null);
  const m = createMotiveDoorMapper();
  assert.equal(m('v', { time: 1, value: true }).state, 'open');
  assert.equal(m('v', { time: 2, value: true }), null);
});

test('poller pages through the feed, posts events, and saves the cursor', async () => {
  const store = createMemoryStore();
  const pages = [
    { data: [rec()], pagination: { endCursor: 'c1', hasNextPage: true } },
    { data: [{ id: 'unknown', gps: [] }], pagination: { endCursor: 'c2', hasNextPage: false } },
  ];
  const urls = [];
  const fetchImpl = async (url) => { urls.push(String(url)); return { ok: true, json: async () => pages.shift() }; };
  const posts = [];
  const out = await pollSamsaraOnce({ token: 't', vehicleMap: { 's-1': 'truck1' }, store, fetchImpl, post: async (id, ev) => { posts.push([id, ev.length]); return 202; } });
  assert.equal(out.pages, 2);
  assert.deepEqual(posts, [['truck1', 4]]);
  assert.equal(await store.getCursor('samsara-feed'), 'c2');
  assert.ok(urls[1].includes('after=c1'));
});

test('poller keeps the old cursor if the detention API errors, and ignores 404', async () => {
  const store = createMemoryStore();
  await store.setCursor('samsara-feed', 'old');
  const mk = () => async () => ({ ok: true, json: async () => ({ data: [rec()], pagination: { endCursor: 'new', hasNextPage: false } }) });
  await assert.rejects(pollSamsaraOnce({ token: 't', vehicleMap: { 's-1': 'truck1' }, store, fetchImpl: mk(), post: async () => 503 }));
  assert.equal(await store.getCursor('samsara-feed'), 'old');
  await pollSamsaraOnce({ token: 't', vehicleMap: { 's-1': 'truck1' }, store, fetchImpl: mk(), post: async () => 404 });
  assert.equal(await store.getCursor('samsara-feed'), 'new');
});

test('engine ignores duplicate pings so retries cannot trigger a false arrival', () => {
  const fence = { center: { lat: 38.78, lng: -90.48 }, radiusM: 200 };
  const t = createStopTracker({ stopId: 's', loadId: 'L', kind: 'pickup', fence });
  const ping = { type: 'gps', ts: 1000, lat: 38.78, lng: -90.48 };
  t.onEvent(ping); t.onEvent({ ...ping });
  assert.equal(t.snapshot().status, 'enroute'); // one real ping is not an arrival
});
