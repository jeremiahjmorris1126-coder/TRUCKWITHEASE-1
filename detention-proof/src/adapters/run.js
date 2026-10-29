// Cloud Run Job entrypoint: run once per invocation, triggered by Cloud Scheduler (e.g. every minute).
// Env: SAMSARA_TOKEN, VEHICLE_MAP (JSON), DETENTION_URL, DETENTION_API_KEY, DOOR_INPUT, DOOR_OPEN_WHEN
import { pollSamsaraOnce } from './poller.js';
import { createSamsaraMapper } from './samsara.js';
import { createFirestoreStore, createMemoryStore } from '../store.js';

const need = (k) => { if (!process.env[k]) throw new Error(`${k} is required`); return process.env[k]; };

const store = process.env.USE_MEMORY_STORE === '1' ? createMemoryStore() : await createFirestoreStore();
const base = need('DETENTION_URL').replace(/\/$/, '');
const key = need('DETENTION_API_KEY');
const doorInput = process.env.DOOR_INPUT || 'auxInput1';

const post = async (truckId, events) => {
  const r = await fetch(`${base}/v1/vehicles/${encodeURIComponent(truckId)}/events`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  return r.status;
};

const result = await pollSamsaraOnce({
  token: need('SAMSARA_TOKEN'),
  vehicleMap: JSON.parse(need('VEHICLE_MAP')),
  store, post, doorInput,
  mapper: createSamsaraMapper({ doorInput, doorOpenWhen: process.env.DOOR_OPEN_WHEN !== 'false' }),
});
console.log(JSON.stringify(result));
