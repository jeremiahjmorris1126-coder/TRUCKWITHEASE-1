import { authenticatedFetch, getSubscriberSession } from './firebaseClientAuth';
import {
  CheckrScreeningRecord,
  CreateCandidateRequest,
  CheckrScenario,
  CheckrAddress,
} from '../../server/checkr/types';

export function isPoBox(addressStreet: string): boolean {
  if (!addressStreet) return false;
  const poBoxRegex = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|box\s+\d+)\b/i;
  return poBoxRegex.test(addressStreet);
}

export function validateCheckrAddress(addr: CheckrAddress): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!addr.street || addr.street.trim().length < 3) {
    errors.push('Street address is required and must be at least 3 characters.');
  }
  if (isPoBox(addr.street)) {
    errors.push('PO Box addresses are prohibited for commercial Class A CDL background screening under 49 CFR § 391.21. A physical residential address is required.');
  }
  if (!addr.city || addr.city.trim().length < 2) {
    errors.push('City is required.');
  }
  if (!addr.state || !/^[A-Z]{2}$/i.test(addr.state.trim())) {
    errors.push('Valid 2-letter state postal code is required (e.g., TX, IL).');
  }
  if (!addr.zip || !/^\d{5}(-\d{4})?$/.test(addr.zip.trim())) {
    errors.push('Valid 5-digit or 9-digit US ZIP code is required.');
  }
  return { valid: errors.length === 0, errors };
}

export const CHECKR_STORAGE_KEY = 'TRUCK_CHECKR_SCREENINGS_CACHE';

export const INITIAL_CHECKR_RECORDS: CheckrScreeningRecord[] = [
  {
    id: 'chkr-scr-904-primary',
    fleetId: 'FLEET1',
    driverId: 'drv-jeremiah-904',
    candidateId: 'cand_904819028',
    packageType: 'class_a_full_mvr_clearinghouse',
    status: 'CLEAR',
    firstName: 'Jeremiah',
    lastName: 'Morris',
    middleName: 'J.',
    email: 'jeremiah@morrishive.com',
    phone: '+1-555-884-9102',
    dob: '1984-06-12',
    ssnLast4: '8821',
    cdlNumber: 'CDL-TX-8849201',
    cdlState: 'TX',
    cdlClass: 'A',
    currentAddress: {
      street: '1240 Industrial Blvd',
      unit: 'Ste 400',
      city: 'Dallas',
      state: 'TX',
      zip: '75207',
      country: 'US',
      isPhysicalResidential: true,
    },
    previousAddresses: [
      {
        street: '8810 Commerce Parkway',
        city: 'Fort Worth',
        state: 'TX',
        zip: '76102',
        country: 'US',
        isPhysicalResidential: true,
        startDate: '2021-01',
        endDate: '2023-12',
      },
    ],
    addressMismatchDetected: false,
    invitationUrl: 'https://invitations.checkr.com/candidates/cand_904819028',
    redirectUrl: 'https://truckwithease.com/vault?checkr_status=completed&screening_id=chkr-scr-904-primary',
    completedAt: '2026-10-15T14:32:00.000Z',
    expiresAt: '2027-10-15',
    mvrResult: {
      state: 'TX',
      licenseNumber: 'CDL-TX-8849201',
      licenseClass: 'A',
      licenseStatus: 'VALID',
      commercialPrivilegesValid: true,
      cdlisVerified: true,
      points: 0,
      violationsCount: 0,
      violations: [],
      expirationDate: '2028-11-15',
      lastMedicalCertDate: '2024-11-30',
    },
    clearinghouseResult: {
      queryType: 'PRE_EMPLOYMENT',
      result: 'NOT_PROHIBITED',
      queryDate: '2026-10-15',
      violationsRecorded: 0,
      returnToDutyStatus: 'NOT_APPLICABLE',
      cfrAuthority: '49 CFR § 382.701',
    },
    pspResult: {
      crashes5YearCount: 0,
      dotRecordableCrashesCount: 0,
      injuriesCount: 0,
      fatalitiesCount: 0,
      roadsideInspections3YearCount: 5,
      driverOutOfServiceViolations: 0,
      vehicleOutOfServiceViolations: 0,
      fmcsaPspScore: 100,
    },
    criminalResult: {
      countyCriminalClear: true,
      federalCriminalClear: true,
      nationalCriminalClear: true,
      sexOffenderClear: true,
      globalTerroristWatchlistClear: true,
      recordsFoundCount: 0,
    },
    merkleProofSha256: '9f83a2108bce340129a8e02847192301829e01923847a1029e81293847192038',
    notes: 'Checkr Commercial Class A Background Screening 100% CLEAR. Continuous MVR active.',
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T14:32:00.000Z',
  },
];

type Listener = (records: CheckrScreeningRecord[]) => void;

class CheckrClientService {
  private records: CheckrScreeningRecord[];
  private listeners: Set<Listener> = new Set();
  private isSyncing: boolean = false;

  constructor() {
    this.records = this.loadFromStorage();
  }

  private loadFromStorage(): CheckrScreeningRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(CHECKR_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (_) {}
    return [...INITIAL_CHECKR_RECORDS];
  }

  private saveToStorage(records: CheckrScreeningRecord[]) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CHECKR_STORAGE_KEY, JSON.stringify(records));
      }
    } catch (_) {}
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.records]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = [...this.records];
    this.listeners.forEach((l) => l(list));
  }

  public getScreenings(): CheckrScreeningRecord[] {
    return [...this.records];
  }

  public async syncWithBackend(): Promise<CheckrScreeningRecord[]> {
    if (this.isSyncing) return this.getScreenings();
    this.isSyncing = true;
    try {
      const res = await authenticatedFetch('/v1/checkr/screenings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.screenings) && data.screenings.length > 0) {
          const remoteScreenings: CheckrScreeningRecord[] = data.screenings;
          // Merge avoiding duplicates
          const remoteMap = new Map(remoteScreenings.map((r) => [r.id, r]));
          const merged = [...remoteScreenings];
          for (const local of this.records) {
            if (!remoteMap.has(local.id)) {
              merged.push(local);
            }
          }
          this.records = merged;
          this.saveToStorage(merged);
          this.notify();
        }
      }
    } catch (_) {
      // Retain offline memory cache seamlessly
    } finally {
      this.isSyncing = false;
    }
    return this.getScreenings();
  }

  public async createCandidateScreening(req: CreateCandidateRequest): Promise<CheckrScreeningRecord> {
    try {
      const res = await authenticatedFetch('/v1/checkr/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.screening) {
          this.records = [data.screening, ...this.records];
          this.saveToStorage(this.records);
          this.notify();
          return data.screening;
        }
      }
    } catch (_) {}

    // Fallback in-memory generator for offline or dev execution
    const screeningId = `chkr-offline-${Date.now()}`;
    const returnBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://truckwithease.com';
    const redirectUrl = `${returnBaseUrl}/vault?checkr_status=completed&screening_id=${screeningId}`;
    const invitationUrl = `https://invitations.checkr.com/candidates/cand_${Date.now()}?redirect_url=${encodeURIComponent(redirectUrl)}`;

    const normalizedCdl = req.cdlState.trim().toUpperCase();
    const normalizedAddr = req.currentAddress.state.trim().toUpperCase();
    const mismatch = normalizedCdl !== normalizedAddr;

    const mockRecord: CheckrScreeningRecord = {
      id: screeningId,
      fleetId: 'FLEET1',
      driverId: req.driverId,
      candidateId: `cand_${Date.now()}`,
      packageType: req.packageType || 'class_a_full_mvr_clearinghouse',
      status: 'INVITATION_SENT',
      firstName: req.firstName,
      lastName: req.lastName,
      middleName: req.middleName,
      email: req.email,
      phone: req.phone,
      dob: req.dob,
      ssnLast4: req.ssnLast4,
      cdlNumber: req.cdlNumber,
      cdlState: normalizedCdl,
      cdlClass: req.cdlClass || 'A',
      currentAddress: req.currentAddress,
      previousAddresses: req.previousAddresses || [],
      addressMismatchDetected: mismatch,
      addressMismatchDetails: mismatch
        ? `Residential address state (${normalizedAddr}) differs from CDL issuing jurisdiction (${normalizedCdl}).`
        : undefined,
      invitationUrl,
      redirectUrl,
      expiresAt: '2027-11-01',
      merkleProofSha256: `sha256-offline-${Date.now()}`,
      notes: 'Checkr Class A Candidate invitation created (in-memory mode).',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.records = [mockRecord, ...this.records];
    this.saveToStorage(this.records);
    this.notify();
    return mockRecord;
  }

  public async simulateScenario(screeningId: string, scenario: CheckrScenario): Promise<CheckrScreeningRecord> {
    try {
      const res = await authenticatedFetch(`/v1/checkr/screenings/${screeningId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.screening) {
          const idx = this.records.findIndex((r) => r.id === screeningId);
          if (idx >= 0) {
            this.records[idx] = data.screening;
          } else {
            this.records.unshift(data.screening);
          }
          this.saveToStorage(this.records);
          this.notify();
          return data.screening;
        }
      }
    } catch (_) {}

    // In-memory simulator
    const idx = this.records.findIndex((r) => r.id === screeningId);
    if (idx >= 0) {
      const current = this.records[idx];
      const now = new Date();
      let updated: CheckrScreeningRecord = { ...current, updatedAt: now.toISOString() };

      if (scenario === 'CLEAR') {
        updated.status = 'CLEAR';
        updated.completedAt = now.toISOString();
        updated.mvrResult = {
          state: current.cdlState,
          licenseNumber: current.cdlNumber,
          licenseClass: current.cdlClass,
          licenseStatus: 'VALID',
          commercialPrivilegesValid: true,
          cdlisVerified: true,
          points: 0,
          violationsCount: 0,
          violations: [],
          expirationDate: '2028-11-15',
        };
        updated.clearinghouseResult = {
          queryType: 'PRE_EMPLOYMENT',
          result: 'NOT_PROHIBITED',
          queryDate: now.toISOString().substring(0, 10),
          violationsRecorded: 0,
          cfrAuthority: '49 CFR § 382.701',
        };
        updated.notes = 'Checkr Background Check 100% CLEAR. Full commercial driving privileges verified.';
      } else if (scenario === 'CONSIDER') {
        updated.status = 'CONSIDER';
        updated.completedAt = now.toISOString();
        updated.mvrResult = {
          state: current.cdlState,
          licenseNumber: current.cdlNumber,
          licenseClass: current.cdlClass,
          licenseStatus: 'VALID',
          commercialPrivilegesValid: true,
          cdlisVerified: true,
          points: 4,
          violationsCount: 1,
          violations: [
            {
              date: '2025-06-14',
              description: 'Speeding 16-20 MPH over limit (CMV)',
              severity: 'SERIOUS',
              points: 4,
            },
          ],
          expirationDate: '2028-11-15',
        };
        updated.notes = 'Checkr status: CONSIDER. Serious speeding violation recorded on MVR.';
      } else if (scenario === 'SUSPENDED_DOCUMENT_REQUIRED') {
        updated.status = 'SUSPENDED';
        updated.notes = 'Checkr action required: Physical Commercial Driver License front/back photograph unreadable.';
      } else if (scenario === 'ERROR_ADDRESS_MISMATCH') {
        updated.addressMismatchDetected = true;
        updated.addressMismatchDetails = `Discrepancy detected between residential address (${current.currentAddress.state}) and CDL issuing state (${current.cdlState}).`;
      } else if (scenario === 'PRE_ADVERSE_ACTION') {
        updated.status = 'ADVERSE_ACTION_PENDING';
        updated.adverseAction = {
          preAdverseNoticeSentAt: now.toISOString(),
          disputeDeadline: '2026-11-10',
          reasons: ['Serious traffic violation recorded within 36 months'],
          summaryOfRightsProvided: true,
          reportCopyProvided: true,
        };
      } else if (scenario === 'DISPUTE_FILED') {
        updated.status = 'DISPUTED';
        updated.notes = 'Driver filed formal FCRA dispute regarding MVR record accuracy.';
      } else if (scenario === 'EXPIRED') {
        updated.status = 'EXPIRED';
        updated.expiresAt = '2025-10-01';
        updated.notes = '49 CFR § 391.25 Annual Review EXPIRED. Immediate re-screening required.';
      }

      this.records[idx] = updated;
      this.saveToStorage(this.records);
      this.notify();
      return updated;
    }
    throw new Error('Screening record not found in memory cache.');
  }
}

export const checkrClientService = new CheckrClientService();
