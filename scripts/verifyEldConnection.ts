/**
 * Verify the live ELD connection with your real provider credentials.
 *
 *   bun scripts/verifyEldConnection.ts            # reads .env
 *   bun scripts/verifyEldConnection.ts --json     # machine-readable output
 *
 * Calls each configured provider (Samsara / Motive / Geotab) directly, then
 * reports: connection result, vehicle + driver counts, how fresh the GPS and
 * HOS data is, and which fields the provider actually reports (vs. null).
 * No data is written anywhere. Credentials are never printed.
 */
import 'dotenv/config';
import { SamsaraAdapter } from '../server/telematics/samsaraAdapter';
import { MotiveAdapter } from '../server/telematics/motiveAdapter';
import { GeotabAdapter } from '../server/telematics/geotabAdapter';
import { redactSecrets } from '../server/telematics/http';
import type { NormalizedDriver, NormalizedVehicle, TelematicsProviderAdapter } from '../server/telematics/types';

const asJson = process.argv.includes('--json');

function coverage<T>(rows: T[], fields: Record<string, (r: T) => unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, get] of Object.entries(fields)) {
    const have = rows.filter((r) => {
      const v = get(r);
      return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
    }).length;
    out[name] = rows.length ? `${have}/${rows.length}` : '-';
  }
  return out;
}

function ageMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.round((Date.now() - t) / 60000) : null;
}

async function verify(adapter: TelematicsProviderAdapter) {
  const report: any = { provider: adapter.name, configured: adapter.isConfigured() };
  if (!report.configured) {
    report.result = 'NOT_CONFIGURED';
    return report;
  }

  let vehicles: NormalizedVehicle[] = [];
  let drivers: NormalizedDriver[] = [];
  try {
    vehicles = await adapter.getFleetVehicles();
    report.vehicles = {
      ok: true,
      count: vehicles.length,
      fieldsReported: coverage(vehicles, {
        location: (v) => v.location,
        speedMph: (v) => v.speedMph,
        vin: (v) => v.vin,
        fuelPercent: (v) => v.fuelPercent,
        odometerMiles: (v) => v.odometerMiles,
        engineHours: (v) => v.engineHours,
        coolantTempF: (v) => v.diagnostics.coolantTempF,
        dtcCodes: (v) => v.diagnostics.dtcCodes,
      }),
      newestGpsAgeMin: Math.min(...vehicles.map((v) => ageMinutes(v.location?.updatedAt) ?? Infinity)),
      sample: vehicles.slice(0, 3).map((v) => ({ unit: v.unitNumber, status: v.status, speedMph: v.speedMph, at: v.location?.updatedAt ?? null })),
    };
    if (!Number.isFinite(report.vehicles.newestGpsAgeMin)) report.vehicles.newestGpsAgeMin = null;
  } catch (err) {
    report.vehicles = { ok: false, error: redactSecrets((err as Error).message) };
  }

  try {
    drivers = await adapter.getDrivers();
    report.drivers = {
      ok: true,
      count: drivers.length,
      fieldsReported: coverage(drivers, {
        dutyStatus: (d) => (d.dutyStatus === 'UNKNOWN' ? null : d.dutyStatus),
        drivingRemaining: (d) => d.hosClocks.drivingRemainingMins,
        shiftRemaining: (d) => d.hosClocks.shiftRemainingMins,
        cycleRemaining: (d) => d.hosClocks.cycleRemainingMins,
        breakWindow: (d) => d.hosClocks.breakWindowMins,
      }),
      sample: drivers.slice(0, 3).map((d) => ({ name: d.name, duty: d.dutyStatus, driveLeftMin: d.hosClocks.drivingRemainingMins })),
    };
  } catch (err) {
    report.drivers = { ok: false, error: redactSecrets((err as Error).message) };
  }

  report.result = report.vehicles.ok && report.drivers.ok ? 'LIVE' : 'ERROR';
  return report;
}

const reports = [];
for (const adapter of [new SamsaraAdapter(), new MotiveAdapter(), new GeotabAdapter()]) {
  reports.push(await verify(adapter));
}

const owningFleet = process.env.TELEMATICS_FLEET_ID?.trim() || null;

if (asJson) {
  console.log(JSON.stringify({ owningFleet, reports }, null, 2));
} else {
  console.log('TruckWithEase — live ELD connection check\n');
  console.log(`TELEMATICS_FLEET_ID: ${owningFleet ?? 'NOT SET — the API will serve ELD data to no fleet until this is set'}\n`);
  for (const r of reports) {
    console.log(`■ ${r.provider}: ${r.result}`);
    if (r.result === 'NOT_CONFIGURED') {
      console.log('    no credentials in environment\n');
      continue;
    }
    for (const kind of ['vehicles', 'drivers'] as const) {
      const k = r[kind];
      if (!k.ok) {
        console.log(`    ${kind}: FAILED — ${k.error}`);
        continue;
      }
      console.log(`    ${kind}: ${k.count}`);
      if (k.newestGpsAgeMin !== undefined) console.log(`      newest GPS fix: ${k.newestGpsAgeMin ?? 'n/a'} min old`);
      console.log(`      fields reported: ${Object.entries(k.fieldsReported).map(([f, c]) => `${f} ${c}`).join(', ')}`);
      for (const s of k.sample) console.log(`      · ${JSON.stringify(s)}`);
    }
    console.log('');
  }
}

const configured = reports.filter((r) => r.configured);
if (configured.length === 0) {
  if (!asJson) console.log('No ELD provider credentials found. Set SAMSARA_API_TOKEN, MOTIVE_API_KEY, or GEOTAB_* and re-run.');
  process.exit(2);
}
process.exit(configured.every((r) => r.result === 'LIVE') ? 0 : 1);
