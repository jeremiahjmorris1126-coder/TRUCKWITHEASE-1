import { CallerIdentity, fleetStore } from '../data/fleetStore';

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

export class DvirService {
  async createDvir(caller: CallerIdentity, input: any): Promise<DvirRecord> {
    if (!caller || !caller.fleetId) {
      const err = new Error('Fleet authentication required to submit DVIR.');
      (err as any).statusCode = 401;
      throw err;
    }

    if (!input) {
      const err = new Error('DVIR payload is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Mandatory driver certification signature (cannot be blank)
    const certifiedBy = typeof input.certifiedBy === 'string' ? input.certifiedBy.trim() : '';
    if (!certifiedBy) {
      const err = new Error('Driver certification signature is required by 49 CFR § 396.11. A DVIR cannot be submitted uncertified.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Unit number & Odometer
    const unitNumber = typeof input.unitNumber === 'string' ? input.unitNumber.trim() : '';
    if (!unitNumber) {
      const err = new Error('Vehicle unit number is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    const odometer = Number(input.odometer);
    if (!odometer || odometer <= 0 || isNaN(odometer)) {
      const err = new Error('Valid vehicle odometer reading is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 3. Inspection Type
    const type = input.type === 'POST_TRIP' ? 'POST_TRIP' : 'PRE_TRIP';

    // 4. Defects checklist verification
    // CRITICAL: A DVIR can NEVER default to "no defects" without active checklist evaluation
    const rawDefects: any[] = Array.isArray(input.defects) ? input.defects : [];
    if (rawDefects.length === 0) {
      const err = new Error(
        'DVIR requires active component evaluation across commercial vehicle safety systems. A DVIR can never default to "no defects" without active component checklist review.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const defects: DvirDefectItem[] = rawDefects.map((d: any) => ({
      component: String(d.component || 'General Vehicle Component'),
      hasDefect: Boolean(d.hasDefect),
      severity: d.severity || (d.hasDefect ? 'MINOR' : undefined),
      notes: d.notes ? String(d.notes) : undefined,
    }));

    const hasDefects = defects.some((d) => d.hasDefect);

    // 5. Safe to Operate declaration
    // Must be explicitly declared as a boolean, never defaulted
    if (typeof input.safeToOperate !== 'boolean') {
      const err = new Error('Driver must explicitly declare whether the vehicle is safe to operate (safeToOperate: true/false).');
      (err as any).statusCode = 400;
      throw err;
    }

    const safeToOperate = Boolean(input.safeToOperate);

    // If out-of-service defect is reported, it cannot be certified safe
    const hasOosDefect = defects.some((d) => d.hasDefect && d.severity === 'OUT_OF_SERVICE');
    if (hasOosDefect && safeToOperate) {
      const err = new Error('Vehicle cannot be declared safe to operate while OUT_OF_SERVICE defects are present.');
      (err as any).statusCode = 400;
      throw err;
    }

    const id = `dvir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const driverId = caller.role === 'driver' ? caller.uid : (input.driverId || caller.uid);
    const driverName = input.driverName || certifiedBy;

    const record: DvirRecord = {
      id,
      fleetId: caller.fleetId,
      driverId,
      driverName,
      unitNumber,
      trailerNumber: input.trailerNumber ? String(input.trailerNumber).trim() : undefined,
      odometer,
      type,
      timestamp: new Date().toISOString(),
      defects,
      hasDefects,
      defectNotes: input.defectNotes ? String(input.defectNotes).trim() : undefined,
      photos: Array.isArray(input.photos) ? input.photos : [],
      safeToOperate,
      certifiedBy,
      certifiedAt: new Date().toISOString(),
      status: hasDefects ? (safeToOperate ? 'CERTIFIED_SAFE' : 'REPAIRS_NEEDED') : 'CERTIFIED_SAFE',
    };

    return await fleetStore.createScopedDocument(caller, 'dvir', id, record);
  }

  async listDvir(caller: CallerIdentity, options?: { driverId?: string; limit?: number }): Promise<DvirRecord[]> {
    return await fleetStore.listScopedCollection<DvirRecord>(caller, 'dvir', options);
  }

  async getDvirById(caller: CallerIdentity, id: string): Promise<DvirRecord | null> {
    return await fleetStore.getScopedDocument<DvirRecord>(caller, 'dvir', id);
  }
}

export const dvirService = new DvirService();
