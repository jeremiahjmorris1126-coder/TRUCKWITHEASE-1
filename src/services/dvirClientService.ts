import { apiClient } from './apiClient';
import { offlineSyncService } from './offlineSyncService';

export interface DvirDefectItem {
  component: string;
  hasDefect: boolean;
  severity?: 'MINOR' | 'MAJOR' | 'OUT_OF_SERVICE';
  notes?: string;
}

export interface DvirRecord {
  id: string;
  fleetId: string;
  driverId: string;
  driverName: string;
  unitNumber: string;
  trailerNumber?: string;
  odometer: number;
  type: 'PRE_TRIP' | 'POST_TRIP';
  timestamp: string;
  defects: DvirDefectItem[];
  hasDefects: boolean;
  defectNotes?: string;
  photos?: string[];
  safeToOperate: boolean;
  certifiedBy: string;
  certifiedAt: string;
  status: 'SUBMITTED' | 'REPAIRS_NEEDED' | 'REPAIRED' | 'CERTIFIED_SAFE';
  syncStatus?: 'SYNCED' | 'WAITING_TO_SYNC';
}

export const MANDATORY_DVIR_COMPONENTS = [
  'Service brakes including trailer brake connections',
  'Parking brake',
  'Steering mechanism',
  'Lighting devices and reflectors',
  'Tires',
  'Horn',
  'Windshield wipers',
  'Rear vision mirrors',
  'Coupling devices',
  'Wheels and rims',
  'Emergency equipment',
];

const LOCAL_STORAGE_KEY = 'TRUCK_LOCAL_DVIRS_CACHE';

class DvirClientService {
  private getLocalDvirs(): DvirRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return [];
  }

  private saveLocalDvir(record: DvirRecord) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = this.getLocalDvirs();
        const existingIdx = list.findIndex((d) => d.id === record.id);
        if (existingIdx >= 0) {
          list[existingIdx] = record;
        } else {
          list.unshift(record);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  async listDvirs(): Promise<DvirRecord[]> {
    const local = this.getLocalDvirs();
    try {
      const res = await apiClient.get<{ success: boolean; count: number; dvirs: DvirRecord[] }>(
        '/api/dvir',
        { skipUnauthorizedRedirect: true }
      );
      if (res && Array.isArray(res.dvirs)) {
        // Merge with local records that are still waiting to sync
        const serverIds = new Set(res.dvirs.map((d) => d.id));
        const pendingLocal = local.filter((d) => !serverIds.has(d.id));
        return [...pendingLocal, ...res.dvirs];
      }
    } catch (err) {
      console.warn('[DvirClientService] listDvirs server unreachable, returning local cache:', err);
    }
    return local;
  }

  async getDvirById(id: string): Promise<DvirRecord | null> {
    const local = this.getLocalDvirs().find((d) => d.id === id);
    try {
      const res = await apiClient.get<{ success: boolean; dvir: DvirRecord }>(
        `/api/dvir/${encodeURIComponent(id)}`,
        { skipUnauthorizedRedirect: true }
      );
      return res?.dvir || local || null;
    } catch (err) {
      return local || null;
    }
  }

  async createDvir(dvirData: {
    unitNumber: string;
    trailerNumber?: string;
    odometer: number;
    type: 'PRE_TRIP' | 'POST_TRIP';
    defects: DvirDefectItem[];
    safeToOperate: boolean;
    certifiedBy: string;
    defectNotes?: string;
    photos?: string[];
  }): Promise<DvirRecord> {
    const hasDefects = dvirData.defects.some((d) => d.hasDefect);
    const nowIso = new Date().toISOString();

    // 1. Create guaranteed local record first (Local-First Offline Guarantee)
    const localRecord: DvirRecord = {
      id: `dvir-local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fleetId: 'LOCAL_FLEET',
      driverId: 'LOCAL_DRIVER',
      driverName: dvirData.certifiedBy,
      unitNumber: dvirData.unitNumber,
      trailerNumber: dvirData.trailerNumber,
      odometer: dvirData.odometer,
      type: dvirData.type,
      timestamp: nowIso,
      defects: dvirData.defects,
      hasDefects,
      defectNotes: dvirData.defectNotes,
      photos: dvirData.photos,
      safeToOperate: dvirData.safeToOperate,
      certifiedBy: dvirData.certifiedBy,
      certifiedAt: nowIso,
      status: hasDefects ? 'REPAIRS_NEEDED' : 'SUBMITTED',
      syncStatus: 'WAITING_TO_SYNC',
    };

    this.saveLocalDvir(localRecord);

    // 2. Try to sync to server immediately
    try {
      const res = await apiClient.post<{ success: boolean; dvir: DvirRecord }>(
        '/api/dvir',
        dvirData,
        { skipUnauthorizedRedirect: true }
      );
      if (res && res.dvir) {
        const synced = { ...res.dvir, syncStatus: 'SYNCED' as const };
        this.saveLocalDvir(synced);
        return synced;
      }
    } catch (err: any) {
      // 3. Network or offline error -> Enqueue in offline sync queue
      console.warn('[DvirClientService] Network unavailable; enqueued for background sync.');
      await offlineSyncService.enqueue('DVIR', dvirData);
    }

    return localRecord;
  }
}

export const dvirClientService = new DvirClientService();
