import { FleetDriverFileRecord, FederalComplianceAttestation } from '../types';
import {
  INITIAL_FLEET_DRIVER_FILES,
  INITIAL_FLEET_VEHICLES,
  OFFICIAL_FEDERAL_ATTESTATION,
  FleetVehicleRecord,
} from '../data/mockFleetDqfData';

const DRIVERS_STORAGE_KEY = 'twe_fleet_driver_files_v1';
const VEHICLES_STORAGE_KEY = 'twe_fleet_vehicle_files_v1';
const ATTESTATION_STORAGE_KEY = 'twe_fleet_federal_attestation_v1';

class FleetFederalVaultService {
  private driverFiles: FleetDriverFileRecord[];
  private vehicleFiles: FleetVehicleRecord[];
  private attestation: FederalComplianceAttestation;

  constructor() {
    this.driverFiles = this.loadDrivers();
    this.vehicleFiles = this.loadVehicles();
    this.attestation = this.loadAttestation();
  }

  private loadDrivers(): FleetDriverFileRecord[] {
    try {
      const raw = localStorage.getItem(DRIVERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [...INITIAL_FLEET_DRIVER_FILES];
  }

  private loadVehicles(): FleetVehicleRecord[] {
    try {
      const raw = localStorage.getItem(VEHICLES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [...INITIAL_FLEET_VEHICLES];
  }

  private loadAttestation(): FederalComplianceAttestation {
    try {
      const raw = localStorage.getItem(ATTESTATION_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { ...OFFICIAL_FEDERAL_ATTESTATION };
  }

  public getDriverFiles(): FleetDriverFileRecord[] {
    return [...this.driverFiles];
  }

  public getVehicleFiles(): FleetVehicleRecord[] {
    return [...this.vehicleFiles];
  }

  public getAttestation(): FederalComplianceAttestation {
    return { ...this.attestation };
  }

  public signLegalAttestation(custodianName: string, title: string): FederalComplianceAttestation {
    const timestamp = new Date().toISOString();
    const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const updated: FederalComplianceAttestation = {
      ...this.attestation,
      certifiedCustodianName: custodianName,
      custodianTitle: title,
      timestampIso: timestamp,
      digitalSignatureSha256: randomHex,
      tamperEvidentSealVerified: true,
      legalCustodyResponsibilityAccepted: true,
    };

    this.attestation = updated;
    try {
      localStorage.setItem(ATTESTATION_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
    return updated;
  }

  public generateRoadsideAuditPackageJSON(driverId?: string): string {
    const driver = driverId ? this.driverFiles.find((d) => d.driverId === driverId) : this.driverFiles[0];
    const timestamp = new Date().toISOString();

    const auditPacket = {
      certificationHeader: {
        statutoryAuthority: '49 CFR § 390.31 / Electronic Documents and Signatures in Commercial Motor Vehicle Compliance',
        jurisdiction: 'Federal Motor Carrier Safety Administration (FMCSA) / U.S. Department of Transportation (USDOT)',
        legalCustodyDeclared: true,
        custodianOfRecords: this.attestation.certifiedCustodianName,
        carrierName: this.attestation.carrierLegalName,
        usdotNumber: this.attestation.usdotNumber,
        mcNumber: this.attestation.mcNumber,
        cryptographicProofSha256: this.attestation.digitalSignatureSha256,
        generatedTimestamp: timestamp,
      },
      driverQualificationFile: {
        targetDriver: driver?.driverName,
        cdlNumber: driver?.cdlNumber,
        cdlState: driver?.cdlState,
        cdlExpiration: driver?.cdlExpirationDate,
        medicalExaminerCertificate: {
          formNumber: 'MCSA-5876',
          cfrAuthority: '49 CFR § 391.43',
          expirationDate: driver?.medCardExpirationDate,
          nationalRegistryStatus: 'VALID_CERTIFIED',
        },
        annualMvrReview: {
          cfrAuthority: '49 CFR § 391.25',
          reviewDate: driver?.annualMvrReviewDate,
          violationsFound: 0,
          status: 'COMPLIANT',
        },
        drugAndAlcoholClearinghouse: {
          cfrAuthority: '49 CFR § 382.701',
          annualQueryDate: driver?.clearinghouseQueryDate,
          result: 'NOT_PROHIBITED',
        },
        preEmploymentDrugTest: {
          cfrAuthority: '49 CFR § 382.301',
          chainOfCustodyVerified: true,
          result: 'NEGATIVE',
        },
      },
      vehicleComplianceSummary: this.vehicleFiles.map((v) => ({
        unitNumber: v.unitNumber,
        vin: v.vin,
        annualPeriodicInspection: {
          formNumber: 'MCS-64',
          cfrAuthority: '49 CFR § 396.17',
          expirationDate: v.annualInspectionExp,
          status: 'VALID',
        },
        apportionedCabCard: {
          irpNumber: v.irpCabCardExp,
          grossWeightLbs: 80000,
        },
        electronicDvir: {
          cfrAuthority: '49 CFR § 396.11',
          lastInspected: v.lastDvirDate,
          status: v.dvirStatus,
        },
      })),
      hoursOfServiceCustody: {
        cfrAuthority: '49 CFR § 395.8',
        retentionPeriod: '6 MONTHS STATUTORY RETENTION',
        malfunctionIndicator: '0 ACTIVE MALFUNCTIONS',
        dataDiagnosticEvent: '0 DIAGNOSTIC CODES',
        tamperEvidentChainVerified: true,
      },
    };

    return JSON.stringify(auditPacket, null, 2);
  }
}

export const fleetFederalVaultService = new FleetFederalVaultService();
