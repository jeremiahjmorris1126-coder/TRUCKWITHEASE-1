/**
 * Verify live truck routing with your real TomTom and Trimble PC*MILER keys.
 *
 *   bun scripts/verifyRoutingConnection.ts           # reads .env
 *
 * Routes Dallas, TX → Atlanta, GA for an 80,000 lb, 13'6" 5-axle tractor-trailer
 * through each configured provider directly (no simulator, no cache) and prints
 * distance, drive time, tolls, turn-by-turn and path size. Exit code 0 only if
 * every configured provider returned a real route.
 */
import 'dotenv/config';
import { TrimbleRoutingProvider } from '../server/routing/adapters/trimbleProvider';
import { TomTomRoutingProvider } from '../server/routing/adapters/tomtomProvider';

const ORIGIN = { label: 'Dallas, TX', coords: { lat: 32.7767, lon: -96.797 } };
const DEST = { label: 'Atlanta, GA', coords: { lat: 33.749, lon: -84.388 } };
const TRUCK = { heightFt: 13.5, weightLbs: 80000, widthFt: 8.5, lengthFt: 53, axles: 5, isHazmat: false, hazmatClass: 'None', avoidTolls: false } as any;

const providers = [
  { name: 'Trimble PC*MILER (planning & mileage)', p: new TrimbleRoutingProvider() },
  { name: 'TomTom Truck (live navigation)', p: new TomTomRoutingProvider() },
];

let configured = 0;
let failed = 0;
console.log('TruckWithEase — live truck routing check (Dallas → Atlanta, 80,000 lb, 13\'6", 5 axles)\n');
for (const { name, p } of providers) {
  if (!p.isConfigured()) {
    console.log(`■ ${name}: NOT CONFIGURED`);
    continue;
  }
  configured++;
  const t0 = Date.now();
  try {
    const r = await p.calculateRoute(ORIGIN, DEST, [], TRUCK);
    console.log(`■ ${name}: LIVE (${Date.now() - t0} ms)`);
    console.log(`    distance: ${r.totalDistanceMiles} mi   drive time: ${Math.floor(r.totalTimeMinutes / 60)}h ${r.totalTimeMinutes % 60}m`);
    console.log(`    tolls: ${r.estimatedTollCostUsd === null ? 'cost not reported' : `$${r.estimatedTollCostUsd}`}, ${r.tollDistanceMiles === null ? 'toll miles not reported' : `${r.tollDistanceMiles} toll mi`}`);
    console.log(`    path points: ${r.summaryPathCoords.length}   turn-by-turn steps: ${r.turnByTurnSteps.length}`);
    console.log(`    first step: ${r.turnByTurnSteps[0]?.instruction ?? '—'}`);
    if (r.totalDistanceMiles < 700 || r.totalDistanceMiles > 900) {
      console.log('    ⚠ distance looks wrong for this trip (expected ~780 mi) — check the response mapping');
      failed++;
    }
    if (r.summaryPathCoords.length <= 2) console.log('    ⚠ no route geometry returned');
  } catch (err) {
    failed++;
    console.log(`■ ${name}: FAILED — ${(err as Error).message}`);
  }
  console.log('');
}

if (configured === 0) {
  console.log('No routing keys found. Set TRIMBLE_API_KEY and/or TOMTOM_API_KEY and re-run.');
  process.exit(2);
}
process.exit(failed ? 1 : 0);
