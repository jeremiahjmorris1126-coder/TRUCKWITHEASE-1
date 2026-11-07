import test from 'node:test';
import assert from 'node:assert/strict';
import { fleetStore, CallerIdentity } from '../server/data/fleetStore.ts';
import {
  eldSyncService,
  computeHomeTerminalDateAndDst,
  convertOdometerToMiles,
  convertEngineTimeToHours,
  parseGeotabDurationToMs,
  normalizeProviderDutyStatus,
  maskLocationForDutyStatus,
} from '../server/telematics/eldSyncService.ts';
import { SamsaraAdapter } from '../server/telematics/samsaraAdapter.ts';
import { MotiveAdapter } from '../server/telematics/motiveAdapter.ts';
import { GeotabAdapter } from '../server/telematics/geotabAdapter.ts';
import { EldSyncError } from '../server/telematics/types.ts';

const FLEET1_ADMIN: CallerIdentity = {
  uid: 'adm-eld-f1',
  email: 'admin@fleet1.example.com',
  role: 'fleet_admin',
  fleetId: 'FLEET-ELD-1',
};

const FLEET1_DRIVER_A: CallerIdentity = {
  uid: 'sam-drv-101',
  email: 'driverA@fleet1.example.com',
  role: 'driver',
  fleetId: 'FLEET-ELD-1',
};

const FLEET1_DRIVER_B: CallerIdentity = {
  uid: 'sam-drv-102',
  email: 'driverB@fleet1.example.com',
  role: 'driver',
  fleetId: 'FLEET-ELD-1',
};

const FLEET2_ADMIN: CallerIdentity = {
  uid: 'adm-eld-f2',
  email: 'admin@fleet2.example.com',
  role: 'fleet_admin',
  fleetId: 'FLEET-ELD-2',
};

test('Phase 2 - 1. Samsara Adapter: Field-by-field accuracy, missing-field nulls, multi-page pagination & clock parity', async () => {
  fleetStore.clearMockStore();

  await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'samsara',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-eld-1-samsara/versions/1',
  });

  // Official Samsara sample response structures from:
  // - https://developers.samsara.com/reference/gethosclocks
  // - https://developers.samsara.com/reference/gethoslogs
  // - https://developers.samsara.com/reference/getvehiclestats
  const samsaraAdapter = new SamsaraAdapter({
    apiToken: 'sandbox-samsara-token',
    fetchImpl: (async (input: any) => {
      const url = new URL(String(input));
      const after = url.searchParams.get('after');

      if (url.pathname.endsWith('/fleet/vehicles/stats')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'veh-sam-1',
                name: 'TRK-401',
                vin: '1FUJGLDR5CSBM1234',
                model: 'Cascadia',
                gps: {
                  latitude: 35.1495,
                  longitude: -90.049,
                  speedMilesPerHour: 62.5,
                  headingDegrees: 90,
                  time: '2026-11-06T14:00:00Z',
                  reverseGeo: { formattedLocation: 'Memphis, TN' },
                },
                obdOdometerMeters: { value: 160934400 }, // Exact 100,000.00 miles
                obdEngineSeconds: { value: 7200000 }, // Exact 2,000.00 hours
                // fuelPercent, defLevelMilliPercent, oilPressure, coolantTemp intentionally omitted
              },
            ],
            pagination: { endCursor: 'v-cur-1', hasNextPage: false },
          }),
          { status: 200 }
        );
      }

      if (url.pathname.endsWith('/fleet/hos/clocks')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
                currentDutyStatus: { hosStatusType: 'driving' },
                eldSettings: { rulesets: [{ cycle: 'US Property 70-hour / 8-day' }] },
                clocks: {
                  drive: { driveRemainingDurationMs: 28800000 }, // 480 mins
                  shift: { shiftRemainingDurationMs: 36000000 }, // 600 mins
                  cycle: { cycleRemainingDurationMs: 180000000 }, // 3000 mins
                  break: { timeUntilBreakDurationMs: 14400000 }, // 240 mins
                },
              },
            ],
            pagination: { endCursor: 'c-cur-1', hasNextPage: false },
          }),
          { status: 200 }
        );
      }

      if (url.pathname.endsWith('/fleet/hos/logs')) {
        // 3-page pagination test
        if (!after) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
                  eldSettings: { rulesets: [{ cycle: 'US Property 70-hour / 8-day' }] },
                  hosLogs: [
                    {
                      id: 'sam-log-p1',
                      hosStatusType: 'offDuty',
                      logStartTime: '2026-11-06T00:00:00Z',
                      logEndTime: '2026-11-06T04:00:00Z',
                      logRecordedLocation: {
                        latitude: 35.14953,
                        longitude: -90.04898,
                        formattedLocation: '123 Private Residence St, Memphis, TN',
                      },
                    },
                  ],
                },
              ],
              pagination: { endCursor: 'page-2-cursor', hasNextPage: true },
            }),
            { status: 200 }
          );
        }
        if (after === 'page-2-cursor') {
          return new Response(
            JSON.stringify({
              data: [
                {
                  driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
                  hosLogs: [
                    {
                      id: 'sam-log-p2',
                      hosStatusType: 'driving',
                      logStartTime: '2026-11-06T04:00:00Z',
                      logEndTime: '2026-11-06T08:00:00Z',
                      obdOdometerMeters: 160934400,
                      obdEngineSeconds: 7200000,
                      logRecordedLocation: {
                        latitude: 35.14953,
                        longitude: -90.04898,
                        formattedLocation: 'I-40 E, Memphis, TN',
                      },
                      isCertified: true,
                      certifiedAtTime: '2026-11-06T08:05:00Z',
                    },
                  ],
                },
              ],
              pagination: { endCursor: 'page-3-cursor', hasNextPage: true },
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
                hosLogs: [
                  {
                    id: 'sam-log-p3',
                    hosStatusType: 'personalConveyance',
                    logStartTime: '2026-11-06T08:00:00Z',
                    logEndTime: '2026-11-06T08:30:00Z',
                    obdOdometerMeters: 161000000,
                    obdEngineSeconds: 7201800,
                    logRecordedLocation: {
                      latitude: 35.22891,
                      longitude: -89.91234,
                      formattedLocation: '456 Diner Rd, Memphis, TN',
                    },
                  },
                ],
              },
            ],
            pagination: { endCursor: 'page-3-end', hasNextPage: false },
          }),
          { status: 200 }
        );
      }

      return new Response('{}', { status: 404 });
    }) as any,
  });

  // 1. Vehicle stats: verify exact unit conversion & null for missing fields (no invented 100% fuel or 45 PSI oil)
  const vehicles = await samsaraAdapter.getFleetVehicles();
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].odometerMiles, 100000);
  assert.deepEqual(vehicles[0].odometerRaw, { value: 160934400, unit: 'm' });
  assert.equal(vehicles[0].engineHours, 2000);
  assert.deepEqual(vehicles[0].engineHoursRaw, { value: 7200000, unit: 'seconds' });
  assert.equal(vehicles[0].fuelPercent, null, 'Missing fuelPercent must be null, never 100');
  assert.equal(vehicles[0].defLevelPercent, null, 'Missing defLevelPercent must be null, never 80');
  assert.equal(vehicles[0].diagnostics.oilPressurePsi, null, 'Missing oilPressurePsi must be null, never 45');
  assert.equal(vehicles[0].diagnostics.coolantTempF, null, 'Missing coolantTempF must be null, never 195');

  // 2. Sync HOS clocks & 3 pages of HOS logs
  const syncRes = await samsaraAdapter.syncFleetHosToStore('FLEET-ELD-1');
  assert.equal(syncRes.clocksSaved.length, 1);
  assert.equal(syncRes.logsSaved.length, 3, 'All 3 paginated pages of HOS logs must be stored without loss');

  // 3. Verify exact clock parity & attribution label
  const storedClock = await eldSyncService.getClocksForDriver(FLEET1_DRIVER_A, 'sam-drv-101');
  assert.ok(storedClock);
  assert.equal(storedClock.clocks.driveRemainingMs, 28800000);
  assert.equal(storedClock.clocks.shiftRemainingMs, 36000000);
  assert.equal(storedClock.clocks.cycleRemainingMs, 180000000);
  assert.equal(storedClock.clocks.breakRemainingMs, 14400000);
  assert.equal(storedClock.ruleset, 'US Property 70-hour / 8-day');
  assert.ok(
    storedClock.attributionLabel.startsWith('From Samsara, last synced '),
    `Expected attribution label, got: ${storedClock.attributionLabel}`
  );

  // 4. Verify Personal Conveyance & Off-Duty privacy masking (49 CFR § 395.26(d)(2): 1 decimal place, blank miles/hours on PC)
  const logs = await eldSyncService.listLogs(FLEET1_DRIVER_A);
  assert.equal(logs.length, 3);

  const offDutyLog = logs.find((l) => l.providerLogId === 'sam-log-p1')!;
  assert.equal(offDutyLog.dutyStatus, 'OFF_DUTY');
  assert.equal(offDutyLog.location.precision, 'PRIVACY_1_DEC_10_MILE');
  assert.equal(offDutyLog.location.latitude, 35.1);
  assert.equal(offDutyLog.location.longitude, -90.0);
  assert.equal(offDutyLog.location.description, null, 'Off-duty street address must be masked');

  const drivingLog = logs.find((l) => l.providerLogId === 'sam-log-p2')!;
  assert.equal(drivingLog.dutyStatus, 'DRIVING');
  assert.equal(drivingLog.location.precision, 'STANDARD_2_DEC');
  assert.equal(drivingLog.location.latitude, 35.15);
  assert.equal(drivingLog.location.longitude, -90.05);
  assert.equal(drivingLog.odometerMiles, 100000);
  assert.equal(drivingLog.engineHours, 2000);
  assert.equal(drivingLog.certified, true);

  const pcLog = logs.find((l) => l.providerLogId === 'sam-log-p3')!;
  assert.equal(pcLog.dutyStatus, 'PERSONAL_CONVEYANCE');
  assert.equal(pcLog.location.precision, 'PRIVACY_1_DEC_10_MILE');
  assert.equal(pcLog.location.latitude, 35.2);
  assert.equal(pcLog.location.longitude, -89.9);
  assert.equal(pcLog.location.description, null);
  assert.equal(pcLog.odometerMiles, null, '49 CFR § 395.26(d)(2): PC log leaves vehicle miles blank');
  assert.equal(pcLog.engineHours, null, '49 CFR § 395.26(d)(2): PC log leaves engine hours blank');
});

test('Phase 2 - 2. Motive & Geotab Adapters: Pagination, units (seconds/km/TimeSpan), edits & version history', async () => {
  fleetStore.clearMockStore();

  await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'motive',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-eld-1-motive/versions/1',
  });
  await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'geotab',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-eld-1-geotab/versions/1',
  });

  // Motive sample payloads from:
  // - https://developer.gomotive.com/reference/get-v1-available_time
  // - https://developer.gomotive.com/reference/get-v1-hos_logs
  const motiveAdapter = new MotiveAdapter({
    apiKey: 'sandbox-motive-key',
    fetchImpl: (async (input: any) => {
      const url = new URL(String(input));
      const pageNo = Number(url.searchParams.get('page_no') || '1');

      if (url.pathname.endsWith('/v1/available_time')) {
        return new Response(
          JSON.stringify({
            users: [
              {
                user: {
                  id: 'sam-drv-101',
                  first_name: 'Elena',
                  last_name: 'Rostova',
                  duty_status: 'on_duty',
                  hos_ruleset: 'US 70hr / 8days',
                  time_zone: 'America/New_York',
                  available_time: {
                    drive: 39600, // 11 hours = 39,600,000 ms
                    shift: 50400, // 14 hours = 50,400,000 ms
                    cycle: 252000, // 70 hours = 252,000,000 ms
                    break: 28800, // 8 hours = 28,800,000 ms
                    updated_at: '2026-11-06T15:00:00Z',
                  },
                },
              },
            ],
            pagination: { per_page: 100, page_no: 1, total: 1 },
          }),
          { status: 200 }
        );
      }

      if (url.pathname.endsWith('/v1/hos_logs')) {
        if (pageNo === 1) {
          return new Response(
            JSON.stringify({
              hos_logs: [
                {
                  hos_log: {
                    id: 'mot-log-2',
                    driver_id: 'sam-drv-101',
                    status: 'yard_moves',
                    start_time: '2026-11-06T12:00:00Z',
                    end_time: '2026-11-06T13:00:00Z',
                    odometer: 100,
                    metric_units: true, // 100 km = 62.14 miles
                    engine_hours: 1500.5,
                    loc_name: 'Atlanta Terminal Yard',
                    lat: 33.749,
                    lon: -84.388,
                  },
                },
              ],
              pagination: { per_page: 1, page_no: 1, total: 2 },
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            hos_logs: [
              {
                hos_log: {
                  id: 'mot-log-1',
                  driver_id: 'sam-drv-101',
                  status: 'sleeper',
                  start_time: '2026-11-06T02:00:00Z',
                  end_time: '2026-11-06T12:00:00Z',
                  odometer: 60,
                  metric_units: false,
                  engine_hours: 1500.0,
                },
              },
            ],
            pagination: { per_page: 1, page_no: 2, total: 2 },
          }),
          { status: 200 }
        );
      }

      return new Response('{}', { status: 404 });
    }) as any,
  });

  const motSync = await motiveAdapter.syncFleetHosToStore('FLEET-ELD-1');
  assert.equal(motSync.clocksSaved.length, 1);
  assert.equal(motSync.logsSaved.length, 2, 'Motive multi-page logs must be synced and ordered chronologically');
  // Out-of-order check: mot-log-1 (02:00Z) must come before mot-log-2 (12:00Z)
  assert.equal(motSync.logsSaved[0].providerLogId, 'mot-log-1');
  assert.equal(motSync.logsSaved[1].providerLogId, 'mot-log-2');
  assert.equal(motSync.logsSaved[1].dutyStatus, 'YARD_MOVE');
  assert.deepEqual(motSync.logsSaved[1].odometerRaw, { value: 100, unit: 'km' });
  assert.equal(motSync.logsSaved[1].odometerMiles, 62.14);

  const motClock = await eldSyncService.getClocksForDriver(FLEET1_DRIVER_A, 'sam-drv-101');
  assert.ok(motClock);
  assert.equal(motClock.clocks.driveRemainingMs, 39600000);
  assert.deepEqual(motClock.clocks.rawProviderClocks.drive, { value: 39600, unit: 's' });

  // Geotab sample payloads from:
  // - https://developers.geotab.com/mygeotab/apiReference/objects/DutyStatusAvailability/
  // - https://developers.geotab.com/mygeotab/apiReference/objects/DutyStatusLog/
  let geotabFeedCalls = 0;
  const geotabAdapter = new GeotabAdapter({
    sessionId: 'sandbox-geotab-session',
    userName: 'sandbox@geotab.example.com',
    fetchImpl: (async (_url: any, init: any) => {
      const reqBody = JSON.parse(init.body);
      const { method, params } = reqBody;

      if (method === 'Get' && params.typeName === 'DutyStatusAvailability') {
        return new Response(
          JSON.stringify({
            result: [
              {
                driver: { id: 'sam-drv-101', name: 'Elena Rostova', timeZoneId: 'America/Chicago', hosRuleSet: 'America70Hour8Day' },
                currentDutyStatus: 'ON',
                driving: '09:30:00', // 34,200,000 ms
                duty: '12:15:00', // 44,100,000 ms
                cycle: '2.04:00:00', // 52 hours = 187,200,000 ms
                rest: '06:00:00', // 21,600,000 ms
                dateTime: '2026-11-06T16:00:00Z',
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (method === 'GetFeed' && params.typeName === 'DutyStatusLog') {
        geotabFeedCalls += 1;
        if (geotabFeedCalls === 1) {
          return new Response(
            JSON.stringify({
              result: {
                data: [
                  {
                    id: 'geo-log-orig',
                    driver: { id: 'sam-drv-101', name: 'Elena Rostova', timeZoneId: 'America/Chicago' },
                    status: 'ON',
                    dateTime: '2026-11-06T13:00:00Z',
                    endDateTime: '2026-11-06T14:00:00Z',
                    origin: 'Automatic',
                    odometer: 80467.2, // 50.00 miles
                    engineHours: 36000, // 10.00 hours
                  },
                ],
                toVersion: 'v-0001',
              },
            }),
            { status: 200 }
          );
        }
        if (geotabFeedCalls === 2) {
          // Page 2: Provider-side edit to geo-log-orig via parentId + annotation + certification, plus an unknown status
          return new Response(
            JSON.stringify({
              result: {
                data: [
                  {
                    id: 'geo-log-edited-v2',
                    parentId: { id: 'geo-log-orig' },
                    driver: { id: 'sam-drv-101', name: 'Elena Rostova', timeZoneId: 'America/Chicago' },
                    status: 'SB',
                    dateTime: '2026-11-06T13:00:00Z',
                    endDateTime: '2026-11-06T14:00:00Z',
                    origin: 'Manual',
                    annotations: [{ comment: 'Driver forgot to switch to Sleeper Berth at rest area', dateTime: '2026-11-06T15:00:00Z' }],
                    verifyDateTime: '2026-11-06T15:05:00Z',
                    odometer: 80467.2,
                    engineHours: 36000,
                  },
                  {
                    id: 'geo-log-unknown',
                    driver: { id: 'sam-drv-101', name: 'Elena Rostova', timeZoneId: 'America/Chicago' },
                    status: 'FutureExperimentalStatus_X9',
                    dateTime: '2026-11-06T14:00:00Z',
                    endDateTime: '2026-11-06T14:30:00Z',
                  },
                ],
                toVersion: 'v-0002',
              },
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            result: { data: [], toVersion: 'v-0002' },
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    }) as any,
  });

  const geoSync = await geotabAdapter.syncFleetHosToStore('FLEET-ELD-1');
  assert.equal(geoSync.toVersion, 'v-0002');

  // Verify Geotab clock TimeSpan parsing
  const geoClock = await eldSyncService.getClocksForDriver(FLEET1_DRIVER_A, 'sam-drv-101');
  assert.ok(geoClock);
  assert.equal(geoClock.clocks.driveRemainingMs, 34200000);
  assert.equal(geoClock.clocks.shiftRemainingMs, 44100000);
  assert.equal(geoClock.clocks.cycleRemainingMs, 187200000);
  assert.equal(geoClock.clocks.breakRemainingMs, 21600000);

  // Verify provider-side edit updated the copy AND kept the original version in versionHistory[]
  const editedLog = await eldSyncService.getLogById(FLEET1_DRIVER_A, 'eld-log-geotab-geo-log-orig');
  assert.ok(editedLog, 'Edited log must update the target record');
  assert.equal(editedLog.dutyStatus, 'SLEEPER_BERTH', 'Current status must reflect the provider edit (SB)');
  assert.equal(editedLog.certified, true);
  assert.equal(editedLog.annotations.length, 1);
  assert.equal(editedLog.annotations[0].text, 'Driver forgot to switch to Sleeper Berth at rest area');
  assert.equal(editedLog.versionHistory.length, 1, 'Prior unedited version must be preserved in versionHistory');
  assert.equal(editedLog.versionHistory[0].previousRecord.dutyStatus, 'ON_DUTY_NOT_DRIVING');
  assert.equal(editedLog.versionHistory[0].previousRecord.certified, false);

  // Verify unknown status is kept and flagged, never silently converted to OFF_DUTY
  const unknownLog = await eldSyncService.getLogById(FLEET1_DRIVER_A, 'eld-log-geotab-geo-log-unknown');
  assert.ok(unknownLog);
  assert.equal(unknownLog.dutyStatus, 'UNKNOWN');
  assert.equal(unknownLog.rawDutyStatus, 'FutureExperimentalStatus_X9');
  assert.equal(unknownLog.flaggedForReview, true);
});

test('Phase 2 - 3. Midnight & Daylight Saving Time (DST) Transition Proof (Spring Forward 23h & Fall Back 25h)', () => {
  // 1. US Spring-Forward DST transition in America/Chicago (2026-03-08: 02:00 CST -> 03:00 CDT)
  // Driver starts driving at 2026-03-08T05:00:00Z (2026-03-07 23:00 CST, UTC-6 = -360m)
  // and ends at 2026-03-08T10:00:00Z (2026-03-08 05:00 CDT, UTC-5 = -300m).
  // Crosses BOTH local midnight in Chicago AND the 02:00 AM DST jump!
  // Actual elapsed physical time is 5 hours (18,000,000 ms), NOT 6 hours!
  const springDst = computeHomeTerminalDateAndDst(
    '2026-03-08T05:00:00Z',
    '2026-03-08T10:00:00Z',
    'America/Chicago'
  );
  assert.equal(springDst.localDateInHomeTz, '2026-03-07');
  assert.equal(springDst.durationMs, 5 * 3600 * 1000);
  assert.equal(springDst.dstTransitionInfo.startOffsetMinutes, -360);
  assert.equal(springDst.dstTransitionInfo.endOffsetMinutes, -300);
  assert.equal(springDst.dstTransitionInfo.crossesDstChange, true);
  assert.equal(springDst.dstTransitionInfo.crossesLocalMidnight, true);

  // 2. US Fall-Back DST transition in America/Chicago (2026-11-01: 02:00 CDT -> 01:00 CST)
  // Driver starts at 2026-11-01T05:30:00Z (00:30 CDT, UTC-5 = -300m)
  // and ends at 2026-11-01T08:30:00Z (02:30 CST, UTC-6 = -360m).
  // Elapsed physical time is 3 hours (10,800,000 ms), NOT 2 hours!
  const fallDst = computeHomeTerminalDateAndDst(
    '2026-11-01T05:30:00Z',
    '2026-11-01T08:30:00Z',
    'America/Chicago'
  );
  assert.equal(fallDst.localDateInHomeTz, '2026-11-01');
  assert.equal(fallDst.durationMs, 3 * 3600 * 1000);
  assert.equal(fallDst.dstTransitionInfo.startOffsetMinutes, -300);
  assert.equal(fallDst.dstTransitionInfo.endOffsetMinutes, -360);
  assert.equal(fallDst.dstTransitionInfo.crossesDstChange, true);
  assert.equal(fallDst.dstTransitionInfo.crossesLocalMidnight, false);
});

test('Phase 2 - 4. Resilience on 401 / 429 / 503 Outage & Strict Multi-Tenant + Driver Isolation', async () => {
  fleetStore.clearMockStore();

  // Reject raw API keys in eld_connections (only Secret Manager resource paths allowed)
  let rawKeyRejected = false;
  try {
    await eldSyncService.upsertConnection(FLEET1_ADMIN, {
      provider: 'samsara',
      secretManagerRef: 'samsara_api_live_key_12345',
    });
  } catch (err: any) {
    rawKeyRejected = true;
    assert.equal(err.statusCode, 400);
  }
  assert.equal(rawKeyRejected, true);

  // Register valid Secret Manager ref
  await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'samsara',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-1-samsara/versions/1',
  });

  // Seed initial valid log for Driver A
  await eldSyncService.ingestNormalizedLogs('FLEET-ELD-1', [
    {
      provider: 'samsara',
      providerLogId: 'sam-log-keep-1',
      driverId: 'sam-drv-101',
      providerDriverId: 'sam-drv-101',
      driverName: 'Driver Alpha',
      vehicleId: 'veh-1',
      providerVehicleId: 'veh-1',
      coDriverIds: [],
      carrierName: 'Fleet One LLC',
      carrierUsdotNumber: 'TEST-USDOT-0001',
      dutyStatus: 'DRIVING',
      rawDutyStatus: 'driving',
      flaggedForReview: false,
      startTimeUtc: '2026-11-06T08:00:00Z',
      endTimeUtc: '2026-11-06T10:00:00Z',
      durationMs: 7200000,
      homeTerminalTimeZone: 'America/Chicago',
      localDateInHomeTz: '2026-11-06',
      dstTransitionInfo: {
        startOffsetMinutes: -360,
        endOffsetMinutes: -360,
        crossesDstChange: false,
        crossesLocalMidnight: false,
      },
      location: {
        latitude: 35.15,
        longitude: -90.05,
        description: 'Memphis, TN',
        precision: 'STANDARD_2_DEC',
      },
      odometerRaw: { value: 160934.4, unit: 'm' },
      odometerMiles: 100,
      engineHoursRaw: { value: 3600, unit: 'seconds' },
      engineHours: 1,
      origin: 'AUTOMATIC',
      annotations: [],
      certified: true,
      certifiedAtUtc: '2026-11-06T10:05:00Z',
      malfunctionOrDiagnosticCode: null,
      ruleset: 'US Property 70-hour / 8-day',
      rawEventId: 'raw-1',
    },
  ]);

  // 1. Simulate 429 Rate Limit -> Throws EldSyncError, marks connection SYNC_DELAYED, preserves existing log
  const rateLimitedAdapter = new SamsaraAdapter({
    apiToken: 'sandbox-token',
    fetchImpl: (async () =>
      new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      })) as any,
  });

  let caught429: EldSyncError | null = null;
  try {
    await rateLimitedAdapter.syncFleetHosToStore('FLEET-ELD-1');
  } catch (err: any) {
    caught429 = err;
  }
  assert.ok(caught429 instanceof EldSyncError);
  assert.equal(caught429!.statusCode, 429);
  assert.equal(caught429!.retryAfterMs, 60000);
  assert.equal(caught429!.syncState, 'SYNC_DELAYED');

  const connAfter429 = await fleetStore.getScopedDocument<any>(
    FLEET1_ADMIN,
    'eld_connections',
    'eld-conn-FLEET-ELD-1-samsara'
  );
  assert.equal(connAfter429.status, 'SYNC_DELAYED');

  // Existing log is untouched and no fake logs were invented
  const logsAfter429 = await eldSyncService.listLogs(FLEET1_DRIVER_A);
  assert.equal(logsAfter429.length, 1);
  assert.equal(logsAfter429[0].providerLogId, 'sam-log-keep-1');

  // 2. Simulate 401 Token Expired -> Marks connection AUTH_EXPIRED
  const expiredAdapter = new SamsaraAdapter({
    apiToken: 'expired-token',
    fetchImpl: (async () => new Response('Unauthorized', { status: 401 })) as any,
  });
  try {
    await expiredAdapter.syncFleetHosToStore('FLEET-ELD-1');
  } catch {
    // expected
  }
  const connAfter401 = await fleetStore.getScopedDocument<any>(
    FLEET1_ADMIN,
    'eld_connections',
    'eld-conn-FLEET-ELD-1-samsara'
  );
  assert.equal(connAfter401.status, 'AUTH_EXPIRED');

  // 3. Multi-tenant & role isolation:
  // - Driver B in same fleet cannot read Driver A's ELD log
  const driverBReadA = await eldSyncService.getLogById(
    FLEET1_DRIVER_B,
    'eld-log-samsara-sam-log-keep-1'
  );
  assert.equal(driverBReadA, null);
  const driverBList = await eldSyncService.listLogs(FLEET1_DRIVER_B);
  assert.equal(driverBList.length, 0);

  // - Fleet 2 Admin cannot read Fleet 1 ELD log (returns null / 404)
  const fleet2Read = await eldSyncService.getLogById(
    FLEET2_ADMIN,
    'eld-log-samsara-sam-log-keep-1'
  );
  assert.equal(fleet2Read, null);
  const fleet2List = await eldSyncService.listLogs(FLEET2_ADMIN);
  assert.equal(fleet2List.length, 0);
});

test('Phase 3 - 5. 6-Month (184-Day) Record Retention (49 CFR § 395.8(k)(1) & § 395.30(f)) and Customer Offboarding Deletion', async () => {
  fleetStore.clearMockStore();

  await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'samsara',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-1-samsara/versions/1',
  });

  const nowMs = Date.parse('2026-11-06T12:00:00Z');
  const expiredIso = new Date(nowMs - 200 * 24 * 60 * 60 * 1000).toISOString(); // 200 days old (> 184 days)
  const recentIso = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days old (< 184 days)

  await eldSyncService.appendRawEvent('FLEET-ELD-1', 'samsara', '/fleet/hos/logs', { old: 1 }, expiredIso);
  await eldSyncService.appendRawEvent('FLEET-ELD-1', 'samsara', '/fleet/hos/logs', { recent: 1 }, recentIso);

  await eldSyncService.ingestNormalizedLogs('FLEET-ELD-1', [
    {
      provider: 'samsara',
      providerLogId: 'old-log-200d',
      driverId: 'sam-drv-101',
      providerDriverId: 'sam-drv-101',
      driverName: 'Driver Alpha',
      vehicleId: 'veh-1',
      providerVehicleId: 'veh-1',
      coDriverIds: [],
      carrierName: 'Fleet One LLC',
      carrierUsdotNumber: 'TEST-USDOT-0001',
      dutyStatus: 'OFF_DUTY',
      rawDutyStatus: 'offDuty',
      flaggedForReview: false,
      startTimeUtc: expiredIso,
      endTimeUtc: expiredIso,
      durationMs: 0,
      homeTerminalTimeZone: 'America/Chicago',
      localDateInHomeTz: '2026-04-20',
      dstTransitionInfo: {
        startOffsetMinutes: -300,
        endOffsetMinutes: -300,
        crossesDstChange: false,
        crossesLocalMidnight: false,
      },
      location: { latitude: 35.1, longitude: -90.0, description: null, precision: 'PRIVACY_1_DEC_10_MILE' },
      odometerRaw: null,
      odometerMiles: null,
      engineHoursRaw: null,
      engineHours: null,
      origin: 'AUTOMATIC',
      annotations: [],
      certified: true,
      certifiedAtUtc: expiredIso,
      malfunctionOrDiagnosticCode: null,
      ruleset: 'US Property 70-hour / 8-day',
      rawEventId: 'raw-old',
    },
    {
      provider: 'samsara',
      providerLogId: 'recent-log-30d',
      driverId: 'sam-drv-101',
      providerDriverId: 'sam-drv-101',
      driverName: 'Driver Alpha',
      vehicleId: 'veh-1',
      providerVehicleId: 'veh-1',
      coDriverIds: [],
      carrierName: 'Fleet One LLC',
      carrierUsdotNumber: 'TEST-USDOT-0001',
      dutyStatus: 'DRIVING',
      rawDutyStatus: 'driving',
      flaggedForReview: false,
      startTimeUtc: recentIso,
      endTimeUtc: recentIso,
      durationMs: 0,
      homeTerminalTimeZone: 'America/Chicago',
      localDateInHomeTz: '2026-10-07',
      dstTransitionInfo: {
        startOffsetMinutes: -300,
        endOffsetMinutes: -300,
        crossesDstChange: false,
        crossesLocalMidnight: false,
      },
      location: { latitude: 35.15, longitude: -90.05, description: 'Memphis, TN', precision: 'STANDARD_2_DEC' },
      odometerRaw: { value: 160934.4, unit: 'm' },
      odometerMiles: 100,
      engineHoursRaw: { value: 3600, unit: 'seconds' },
      engineHours: 1,
      origin: 'AUTOMATIC',
      annotations: [],
      certified: true,
      certifiedAtUtc: recentIso,
      malfunctionOrDiagnosticCode: null,
      ruleset: 'US Property 70-hour / 8-day',
      rawEventId: 'raw-recent',
    },
  ]);

  // 1. Purge expired (> 184 days) records
  const purgeRes = await eldSyncService.purgeExpiredRecords('FLEET-ELD-1', 184, nowMs);
  assert.equal(purgeRes.logsPurged, 1);
  assert.equal(purgeRes.rawEventsPurged, 1);

  const remainingLogs = await eldSyncService.listLogs(FLEET1_ADMIN);
  assert.equal(remainingLogs.length, 1);
  assert.equal(remainingLogs[0].providerLogId, 'recent-log-30d');

  // 2. Customer leaves / disconnects ELD: all fleet ELD data is purged
  const offboardRes = await eldSyncService.disconnectAndPurgeFleetEld(FLEET1_ADMIN);
  assert.equal(offboardRes.connectionsPurged, 1);
  assert.equal(offboardRes.logsPurged, 1);
  assert.equal(offboardRes.rawEventsPurged, 1);

  const logsAfterOffboard = await eldSyncService.listLogs(FLEET1_ADMIN);
  assert.equal(logsAfterOffboard.length, 0);
});

test('Phase 5 - 6. End-to-End 7-Day Sandbox Sync, Record-by-Record & Clock Comparison, Disconnect & Purge', async () => {
  fleetStore.clearMockStore();

  // 1. Connect Samsara via Secret Manager reference
  const conn = await eldSyncService.upsertConnection(FLEET1_ADMIN, {
    provider: 'samsara',
    secretManagerRef: 'projects/project-f0634118-be01-44f7-b36/secrets/fleet-eld-1-samsara-7d/versions/1',
  });
  assert.equal(conn.status, 'CONNECTED');

  // 2. Build 7 full days of official-format Samsara HOS logs (28 duty transitions across 7 days)
  const sevenDaySourceLogs: any[] = [];
  const baseStartMs = Date.parse('2026-10-30T06:00:00Z');
  const dayMs = 24 * 3600 * 1000;

  for (let day = 0; day < 7; day++) {
    const dayStart = baseStartMs + day * dayMs;
    const transitions = [
      { suffix: 'on', status: 'onDuty', offsetStartH: 0, offsetEndH: 0.5 },
      { suffix: 'drv1', status: 'driving', offsetStartH: 0.5, offsetEndH: 8.0 },
      { suffix: 'brk', status: 'offDuty', offsetStartH: 8.0, offsetEndH: 8.5 },
      { suffix: 'sb', status: 'sleeperBerth', offsetStartH: 8.5, offsetEndH: 24.0 },
    ];
    for (const t of transitions) {
      sevenDaySourceLogs.push({
        id: `sam-7d-day${day + 1}-${t.suffix}`,
        hosStatusType: t.status,
        logStartTime: new Date(dayStart + t.offsetStartH * 3600 * 1000).toISOString(),
        logEndTime: new Date(dayStart + t.offsetEndH * 3600 * 1000).toISOString(),
        obdOdometerMeters: (100000 + day * 450) * 1609.344,
        obdEngineSeconds: (2500 + day * 8) * 3600,
        isCertified: true,
        certifiedAtTime: new Date(dayStart + 24 * 3600 * 1000).toISOString(),
      });
    }
  }

  const expectedClocks = {
    driveRemainingDurationMs: 12600000, // 3h 30m
    shiftRemainingDurationMs: 19800000, // 5h 30m
    cycleRemainingDurationMs: 63000000, // 17h 30m
    timeUntilBreakDurationMs: 12600000, // 3h 30m
  };

  const sandboxAdapter = new SamsaraAdapter({
    apiToken: 'sandbox-7day-token',
    fetchImpl: (async (input: any) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/fleet/hos/clocks')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
                currentDutyStatus: { hosStatusType: 'sleeperBerth' },
                eldSettings: { rulesets: [{ cycle: 'US Property 70-hour / 8-day' }] },
                clocks: {
                  drive: { driveRemainingDurationMs: expectedClocks.driveRemainingDurationMs },
                  shift: { shiftRemainingDurationMs: expectedClocks.shiftRemainingDurationMs },
                  cycle: { cycleRemainingDurationMs: expectedClocks.cycleRemainingDurationMs },
                  break: { timeUntilBreakDurationMs: expectedClocks.timeUntilBreakDurationMs },
                },
              },
            ],
            pagination: { endCursor: '7d-clocks', hasNextPage: false },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          data: [
            {
              driver: { id: 'sam-drv-101', name: 'Driver Alpha', timezone: 'America/Chicago' },
              eldSettings: { rulesets: [{ cycle: 'US Property 70-hour / 8-day' }] },
              hosLogs: sevenDaySourceLogs,
            },
          ],
          pagination: { endCursor: '7d-logs', hasNextPage: false },
        }),
        { status: 200 }
      );
    }) as any,
  });

  // 3. Sync the full 7-day log set and compare every single record and clock against the raw source
  const syncResult = await sandboxAdapter.syncFleetHosToStore('FLEET-ELD-1');
  assert.equal(syncResult.logsSaved.length, 28, 'All 28 duty status records across 7 days must be stored');

  const storedLogs = await eldSyncService.listLogs(FLEET1_DRIVER_A);
  assert.equal(storedLogs.length, 28);

  for (let i = 0; i < sevenDaySourceLogs.length; i++) {
    const src = sevenDaySourceLogs[i];
    const stored = storedLogs.find((l) => l.providerLogId === src.id);
    assert.ok(stored, `Record ${src.id} must exist`);
    assert.equal(stored.startTimeUtc, src.logStartTime);
    assert.equal(stored.endTimeUtc, src.logEndTime);
    assert.equal(stored.rawDutyStatus, src.hosStatusType);
    assert.equal(stored.certified, true);
  }

  const storedClock = await eldSyncService.getClocksForDriver(FLEET1_DRIVER_A, 'sam-drv-101');
  assert.ok(storedClock);
  assert.equal(storedClock.clocks.driveRemainingMs, expectedClocks.driveRemainingDurationMs);
  assert.equal(storedClock.clocks.shiftRemainingMs, expectedClocks.shiftRemainingDurationMs);
  assert.equal(storedClock.clocks.cycleRemainingMs, expectedClocks.cycleRemainingDurationMs);
  assert.equal(storedClock.clocks.breakRemainingMs, expectedClocks.timeUntilBreakDurationMs);
  assert.ok(storedClock.attributionLabel.startsWith('From Samsara, last synced '));

  // 4. Disconnect and confirm connection reference and all ELD data are removed
  const purge = await eldSyncService.disconnectAndPurgeFleetEld(FLEET1_ADMIN);
  assert.equal(purge.connectionsPurged, 1);
  assert.equal(purge.logsPurged, 28);
  assert.equal(purge.clocksPurged, 1);
  assert.equal((await eldSyncService.listLogs(FLEET1_DRIVER_A)).length, 0);
  assert.equal(await eldSyncService.getClocksForDriver(FLEET1_DRIVER_A, 'sam-drv-101'), null);
});
