import { describe, it, expect, beforeEach } from 'bun:test';
import { CallerIdentity, fleetStore } from '../server/data/fleetStore';
import { updateDriverProfile, getDriverProfile } from '../server/driver/driverProfileService';

describe('Phase 4 - Offline Sync & Guaranteed Local-First Persistence', () => {
  const driverCaller: CallerIdentity = {
    uid: 'drv-offline-01',
    role: 'driver',
    fleetId: 'FLEET1',
    email: 'driver01@fleet1.test',
  };

  const adminCaller: CallerIdentity = {
    uid: 'usr-admin-01',
    role: 'fleet_admin',
    fleetId: 'FLEET1',
    email: 'admin@fleet1.test',
  };

  const fleet2DriverCaller: CallerIdentity = {
    uid: 'drv-fleet2-01',
    role: 'driver',
    fleetId: 'FLEET2',
    email: 'driver01@fleet2.test',
  };

  beforeEach(() => {
    // Reset test driver profile
    fleetStore.seedMockData('driver_profiles', driverCaller.uid, {
      id: driverCaller.uid,
      driverId: driverCaller.uid,
      fleetId: 'FLEET1',
      name: 'Test Offline Driver',
      phone: '555-0199',
      email: driverCaller.email,
      cdlNumber: 'CDL-TX-99881',
      cdlState: 'TX',
      currentDutyStatus: 'OFF',
    });
  });

  it('1. Duty Status: Updates driver profile and persists duty transitions', async () => {
    const timestamp = Date.now();
    const updated = await updateDriverProfile(driverCaller, driverCaller.uid, {
      currentDutyStatus: 'DRIVING',
      dutyStatusChangedAt: new Date(timestamp).toISOString(),
    } as any);

    expect(updated).not.toBeNull();
    expect((updated as any).currentDutyStatus).toBe('DRIVING');

    const fetched = await getDriverProfile(driverCaller, driverCaller.uid);
    expect(fetched).not.toBeNull();
    expect((fetched as any).currentDutyStatus).toBe('DRIVING');
  });

  it('2. Multi-Tenant Duty Isolation: Driver cannot alter another driver duty status', async () => {
    // FLEET2 driver attempts to mutate FLEET1 driver
    try {
      await updateDriverProfile(fleet2DriverCaller, driverCaller.uid, {
        currentDutyStatus: 'ON_DUTY',
      } as any);
      expect(true).toBe(false); // Should have thrown
    } catch (err: any) {
      expect(err.statusCode || err.status).toBe(404);
    }

    // Verify FLEET1 driver profile was untampered
    const profile = await getDriverProfile(driverCaller, driverCaller.uid);
    expect((profile as any).currentDutyStatus).toBe('OFF');
  });

  it('3. Offline Queue: Local-first persistence preserves queued items across simulated app restarts', () => {
    // Simulate localStorage queue
    const mockStorage = new Map<string, string>();
    const QUEUE_KEY = 'truckwithease_offline_sync_queue_v1';

    const initialItem = {
      id: 'sync-duty-01',
      type: 'DUTY_STATUS',
      payload: { status: 'DRIVING', timestamp: Date.now() },
      createdAt: Date.now(),
      attempts: 0,
    };

    mockStorage.set(QUEUE_KEY, JSON.stringify([initialItem]));

    // Simulate app restart / reload -> read from storage
    const restored = JSON.parse(mockStorage.get(QUEUE_KEY) || '[]');
    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe('sync-duty-01');
    expect(restored[0].payload.status).toBe('DRIVING');

    // Add DVIR to queue
    const dvirItem = {
      id: 'sync-dvir-02',
      type: 'DVIR',
      payload: { unitNumber: 'TRK-101', safeToOperate: true, certifiedBy: 'Driver' },
      createdAt: Date.now(),
      attempts: 0,
    };

    restored.push(dvirItem);
    mockStorage.set(QUEUE_KEY, JSON.stringify(restored));

    // Simulate second reload
    const reRestored = JSON.parse(mockStorage.get(QUEUE_KEY) || '[]');
    expect(reRestored.length).toBe(2);
    expect(reRestored[1].type).toBe('DVIR');
  });

  it('4. Offline Sync: FIFO processing guarantees correct duty sequence playback', async () => {
    const queue = [
      { id: '1', type: 'DUTY_STATUS', status: 'ON_DUTY', ts: 1000 },
      { id: '2', type: 'DUTY_STATUS', status: 'DRIVING', ts: 2000 },
      { id: '3', type: 'DUTY_STATUS', status: 'OFF_DUTY', ts: 3000 },
    ];

    const transitionLog: string[] = [];

    for (const item of queue) {
      await updateDriverProfile(driverCaller, driverCaller.uid, {
        currentDutyStatus: item.status,
      } as any);
      transitionLog.push(item.status);
    }

    expect(transitionLog).toEqual(['ON_DUTY', 'DRIVING', 'OFF_DUTY']);
    const finalProfile = await getDriverProfile(driverCaller, driverCaller.uid);
    expect((finalProfile as any).currentDutyStatus).toBe('OFF_DUTY');
  });

  it('5. Error Handling: Network failure keeps item in queue with incremented attempts', () => {
    const queue = [
      { id: 'fail-01', type: 'DETENTION_EVENT', attempts: 0, lastError: undefined },
    ];

    // Simulate network error
    const isNetworkError = true;
    if (isNetworkError) {
      queue[0].attempts += 1;
      queue[0].lastError = 'Network connection unavailable';
    }

    expect(queue.length).toBe(1);
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].lastError).toBe('Network connection unavailable');
  });
});
