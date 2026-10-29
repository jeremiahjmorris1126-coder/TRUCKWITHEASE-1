import { createHash } from 'node:crypto';

// Stable stringify so the same packet always hashes the same.
function stable(obj) {
  if (Array.isArray(obj)) return `[${obj.map(stable).join(',')}]`;
  if (obj && typeof obj === 'object') {
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

const iso = (ts) => (ts ? new Date(ts).toISOString() : null);

/**
 * Build a tamper-evident evidence packet. The SHA-256 lets a broker or
 * claims adjuster verify the packet was not edited after generation.
 */
export function buildEvidencePacket({ tracker, vehicle, driver, carrier, generatedTs = Date.now() }) {
  const s = tracker.summary(generatedTs);
  const snap = tracker.snapshot();

  const body = {
    version: 1,
    generatedAt: iso(generatedTs),
    carrier: carrier ?? null,
    vehicle: vehicle ?? null,
    driver: driver ?? null,
    stop: {
      stopId: s.stopId,
      loadId: s.loadId,
      kind: s.kind,
      fence: snap.stop.fence,
    },
    timeline: {
      appointment: iso(s.appointmentTs),
      arrival: iso(s.arrivalTs),
      firstDoorOpen: iso(s.firstDoorOpenTs),
      lastDoorClose: iso(s.lastDoorCloseTs),
      departure: iso(s.departureTs),
    },
    metrics: {
      dwellMinutes: s.dwellMinutes,
      freeMinutes: s.freeMinutes,
      detentionMinutes: s.detentionMinutes,
      ratePerHour: s.ratePerHour,
      amount: s.amount,
      waitBeforeDoorMinutes: s.waitBeforeDoorMinutes,
      dockWorkMinutes: s.dockWorkMinutes,
    },
    doorEvents: snap.doorEvents.map((d) => ({ at: iso(d.ts), state: d.state })),
    gpsTrail: snap.gpsTrail.map((g) => ({ at: iso(g.ts), lat: g.lat, lng: g.lng, speedMph: g.speedMph ?? null })),
    callLog: snap.calls.map((c) => ({
      at: iso(c.ts),
      direction: c.direction,
      durationSec: c.durationSec,
      number: c.number,
    })),
  };

  const sha256 = createHash('sha256').update(stable(body)).digest('hex');
  return { ...body, integrity: { algorithm: 'sha256', hash: sha256 } };
}

export function verifyEvidencePacket(packet) {
  const { integrity, ...body } = packet;
  const hash = createHash('sha256').update(stable(body)).digest('hex');
  return integrity?.hash === hash;
}
