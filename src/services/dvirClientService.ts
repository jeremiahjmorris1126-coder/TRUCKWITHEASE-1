import { apiClient } from './apiClient';

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
}

export const MANDATORY_DVIR_COMPONENTS = [
  'Service Brakes & Air Lines',
  'Parking / Emergency Brake',
  'Steering Mechanism',
  'Lighting Devices & Reflectors',
  'Tires, Wheels & Rims',
  'Windshield & Wipers',
  'Rear Vision Mirrors',
  'Coupling Devices & Fifth Wheel',
  'Emergency Equipment (Fire Extinguisher, Triangles)',
  'Fluid Levels & Leak Check',
  'Horn & Audio Warning Devices',
];

class DvirClientService {
  async listDvirs(): Promise<DvirRecord[]> {
    try {
      const res = await apiClient.get<{ success: boolean; count: number; dvirs: DvirRecord[] }>(
        '/api/dvir',
        { skipUnauthorizedRedirect: true }
      );
      return res?.dvirs || [];
    } catch (err) {
      console.warn('[DvirClientService] listDvirs error:', err);
      return [];
    }
  }

  async getDvirById(id: string): Promise<DvirRecord | null> {
    try {
      const res = await apiClient.get<{ success: boolean; dvir: DvirRecord }>(
        `/api/dvir/${encodeURIComponent(id)}`,
        { skipUnauthorizedRedirect: true }
      );
      return res?.dvir || null;
    } catch (err) {
      console.warn('[DvirClientService] getDvirById error:', err);
      return null;
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
    const res = await apiClient.post<{ success: boolean; dvir: DvirRecord }>(
      '/api/dvir',
      dvirData
    );
    return res.dvir;
  }
}

export const dvirClientService = new DvirClientService();
