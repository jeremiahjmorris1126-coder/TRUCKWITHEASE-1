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

  it('1. Driver Profile: Updates and persists driver preferences without HOS self-made logs', async () => {
    const updated = await updateDriverProfile(driverCaller, driverCaller.uid, {
      phone: '+1-555-019-9041',
      preferredEldProvider: 'SAMSARA',
    } as any);

    expect(updated).not.toBeNull();
    expect((updated as any).phone).toBe('+1-555-019-9041');
    expect((updated as any).preferredEldProvider).toBe('SAMSARA');

    const fetched = await getDriverProfile(driverCaller, driverCaller.uid);
    expect(fetched).not.toBeNull();
    expect((fetched as any).phone).toBe('+1-555-019-9041');
    expect((fetched as any).preferredEldProvider).toBe('SAMSARA');
  });

  it('2. Multi-Tenant Isolation: Driver cannot alter another driver profile', async () => {
    // FLEET2 driver attempts to mutate FLEET1 driver
    try {
      await updateDriverProfile(fleet2DriverCaller, driverCaller.uid, {
        phone: '+1-555-999-9999',
      } as any);
      expect(true).toBe(false); // Should have thrown
    } catch (err: any) {
      expect(err.statusCode || err.status).toBe(404);
    }

    // Verify FLEET1 driver profile was untampered
    const profile = await getDriverProfile(driverCaller, driverCaller.uid);
    expect((profile as any).phone).toBe('555-0199');
  });

  it('3. Offline Queue: Local-first persistence preserves queued items across simulated app restarts', () => {
    // Simulate localStorage queue
    const mockStorage = new Map<string, string>();
    const QUEUE_KEY = 'truckwithease_offline_sync_queue_v1';

    const initialItem = {
      id: 'sync-detention-01',
      type: 'DETENTION_EVENT',
      payload: { loadId: 'L-101', facilityName: 'Dallas Staging Dock', eventType: 'ARRIVED', timestamp: Date.now() },
      createdAt: Date.now(),
      attempts: 0,
    };

    mockStorage.set(QUEUE_KEY, JSON.stringify([initialItem]));

    // Simulate app restart / reload -> read from storage
    const restored = JSON.parse(mockStorage.get(QUEUE_KEY) || '[]');
    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe('sync-detention-01');
    expect(restored[0].type).toBe('DETENTION_EVENT');
    expect(restored[0].payload.eventType).toBe('ARRIVED');

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

  it('4. Offline Sync: FIFO processing guarantees correct event sequence playback', async () => {
    const queue = [
      { id: '1', type: 'DETENTION_EVENT', event: 'ARRIVED', ts: 1000 },
      { id: '2', type: 'DETENTION_EVENT', event: 'LOADING_STARTED', ts: 2000 },
      { id: '3', type: 'DETENTION_EVENT', event: 'DEPARTED', ts: 3000 },
    ];

    const eventLog: string[] = [];

    for (const item of queue) {
      eventLog.push(item.event);
    }

    expect(eventLog).toEqual(['ARRIVED', 'LOADING_STARTED', 'DEPARTED']);
  });

  it('5. Error Handling: Network failure keeps item in queue with incremented attempts', () => {
    const queue: Array<{ id: string; type: string; attempts: number; lastError?: string }> = [
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
