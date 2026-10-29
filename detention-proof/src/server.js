import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createPersistentService } from './persistent.js';
import { verifyEvidencePacket } from './index.js';
import { validateStop, validateEvents } from './validate.js';

const MAX_BODY = 1_000_000; // 1 MB

function safeEqual(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

export function createServer({ store, apiKey, defaults } = {}) {
  if (!apiKey) throw new Error('apiKey is required');
  const service = createPersistentService({ store, defaults });

  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });

      const auth = req.headers.authorization ?? '';
      if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), apiKey)) return send(res, 401, { error: 'unauthorized' });

      if (parts[0] !== 'v1') return send(res, 404, { error: 'not found' });

      // POST /v1/stops  — dispatch a driver to a stop
      if (req.method === 'POST' && parts[1] === 'stops' && parts.length === 2) {
        const { vehicleId, stop, ctx } = await readJson(req);
        if (!vehicleId || typeof vehicleId !== 'string') return send(res, 400, { error: 'vehicleId is required' });
        const err = validateStop(stop);
        if (err) return send(res, 400, { error: err });
        await service.startStop(vehicleId, stop, ctx ?? {});
        return send(res, 201, { ok: true });
      }

      // /v1/vehicles/:id/(events|status|finalize)
      if (parts[1] === 'vehicles' && parts.length === 4) {
        const vehicleId = parts[2];
        const action = parts[3];

        if (req.method === 'POST' && action === 'events') {
          const { events } = await readJson(req);
          const err = validateEvents(events);
          if (err) return send(res, 400, { error: err });
          const ok = await service.ingest(vehicleId, events);
          return ok ? send(res, 202, { accepted: events.length }) : send(res, 404, { error: 'no active stop for vehicle' });
        }
        if (req.method === 'GET' && action === 'status') {
          const status = await service.status(vehicleId);
          return status ? send(res, 200, status) : send(res, 404, { error: 'no active stop for vehicle' });
        }
        if (req.method === 'POST' && action === 'finalize') {
          const body = await readJson(req);
          const result = await service.finalize(vehicleId, { invoiceNumber: body.invoiceNumber, billTo: body.billTo });
          return result ? send(res, 200, result) : send(res, 404, { error: 'no active stop for vehicle' });
        }
      }

      // GET /v1/packets/:loadId/:stopId
      if (req.method === 'GET' && parts[1] === 'packets' && parts.length === 4) {
        const packet = await service.getPacket(parts[2], parts[3]);
        return packet ? send(res, 200, packet) : send(res, 404, { error: 'packet not found' });
      }

      // POST /v1/verify — brokers/adjusters can check a packet's integrity
      if (req.method === 'POST' && parts[1] === 'verify' && parts.length === 2) {
        const packet = await readJson(req);
        return send(res, 200, { valid: verifyEvidencePacket(packet) });
      }

      return send(res, 404, { error: 'not found' });
    } catch (e) {
      if (e.status) return send(res, e.status, { error: e.message });
      console.error(e);
      return send(res, 500, { error: 'internal error' });
    }
  });
}

// Entrypoint for Cloud Run
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createFirestoreStore, createMemoryStore } = await import('./store.js');
  const store = process.env.USE_MEMORY_STORE === '1' ? createMemoryStore() : await createFirestoreStore();
  const server = createServer({ store, apiKey: process.env.DETENTION_API_KEY });
  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => console.log(`detention-proof listening on ${port}`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
