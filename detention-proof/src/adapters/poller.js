import { createSamsaraMapper } from './samsara.js';

const FEED = 'https://api.samsara.com/fleet/vehicles/stats/feed';
const MAX_PAGES = 20;

/**
 * Poll Samsara once and push events to the detention API.
 *  - vehicleMap: { '<samsara vehicle id>': '<truckwithease vehicleId>' }
 *  - post(truckId, events) -> HTTP status from POST /v1/vehicles/:id/events
 * The cursor only advances after every page posts successfully, so a failed
 * run is retried from the same point (the engine ignores duplicate events).
 */
export async function pollSamsaraOnce({
  token, vehicleMap, store, post, mapper = createSamsaraMapper(),
  doorInput = 'auxInput1', fetchImpl = fetch, cursorName = 'samsara-feed',
}) {
  const ids = Object.keys(vehicleMap);
  if (!ids.length) return { posted: 0, pages: 0 };

  let after = await store.getCursor(cursorName);
  let posted = 0, pages = 0, lastCursor = after;

  while (pages < MAX_PAGES) {
    const url = new URL(FEED);
    url.searchParams.set('types', `gps,${doorInput}`);
    url.searchParams.set('vehicleIds', ids.join(','));
    if (after) url.searchParams.set('after', after);

    const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Samsara feed returned ${res.status}`);
    const body = await res.json();
    pages += 1;

    for (const record of body.data ?? []) {
      const truckId = vehicleMap[record.id];
      if (!truckId) continue;
      const events = mapper(record);
      for (let i = 0; i < events.length; i += 500) {
        const chunk = events.slice(i, i + 500);
        const status = await post(truckId, chunk);
        if (status === 404) break; // no active stop for this truck right now
        if (status >= 400) throw new Error(`detention API returned ${status} for ${truckId}`);
        posted += chunk.length;
      }
    }

    lastCursor = body.pagination?.endCursor ?? lastCursor;
    if (!body.pagination?.hasNextPage) break;
    after = lastCursor;
  }

  if (lastCursor) await store.setCursor(cursorName, lastCursor);
  return { posted, pages };
}
