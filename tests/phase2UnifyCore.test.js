import { describe, it, expect, beforeEach } from 'bun:test';
import { computeSha256, generateSecureToken } from '../src/services/cryptoService';
import { fleetFederalVaultService } from '../src/services/fleetFederalVaultService';
import { dotDocumentsService } from '../src/services/dotDocumentsService';
import { saveSubscriberSession, clearSubscriberSession } from '../src/services/firebaseClientAuth';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

describe('Phase 2: Unify the Core - Integration Tests', () => {
  beforeEach(() => {
    clearSubscriberSession();
  });

  // =========================================================================
  // 1. CRYPTO SERVICE & 49 CFR § 390.31 INTEGRITY
  // =========================================================================
  it('1. CryptoService produces exact standards-compliant SHA-256 digests', async () => {
    const testVectors = [
      'TruckWithEase::ComplianceVault::49CFR390.31',
      'Driver::MarcusVance::CDL-TX-8849201',
      'Carrier::MorrishiveLogistics::USDOT-3928110',
    ];

    for (const vector of testVectors) {
      const serviceDigest = await computeSha256(vector);
      const expectedDigest = crypto.createHash('sha256').update(vector).digest('hex');
      expect(serviceDigest).toBe(expectedDigest);
      expect(serviceDigest).toHaveLength(64);
    }

    const token = generateSecureToken(32);
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  // =========================================================================
  // 2. FLEET FEDERAL VAULT SERVICE & LEGAL CUSTODY
  // =========================================================================
  it('2. FleetFederalVaultService binds dynamically to active subscriber session', () => {
    saveSubscriberSession({
      sessionToken: 'test-token',
      user: {
        uid: 'usr-dynamic-01',
        name: 'Alexander Sterling',
        email: 'alex@apexlogistics.com',
        role: 'fleet_admin',
        fleetId: 'FLEET-APEX',
        carrierName: 'Apex Transport Global LLC',
        usdotNumber: '9988776',
        mcNumber: 'MC-554433',
      },
    });

    const attestation = fleetFederalVaultService.getAttestation();
    expect(attestation.carrierLegalName).toBe('Apex Transport Global LLC');
    expect(attestation.usdotNumber).toBe('9988776');
    expect(attestation.mcNumber).toBe('MC-554433');
  });

  it('3. FleetFederalVaultService executes tamper-evident legal custody attestation', async () => {
    const custodian = 'Sarah Jenkins';
    const title = 'Chief Compliance Officer';
    const signed = fleetFederalVaultService.signLegalAttestation(custodian, title);

    expect(signed.certifiedCustodianName).toBe(custodian);
    expect(signed.custodianTitle).toBe(title);
    expect(signed.tamperEvidentSealVerified).toBe(true);
    expect(signed.legalCustodyResponsibilityAccepted).toBe(true);
    expect(signed.digitalSignatureSha256).toHaveLength(64);

    // Verify Roadside Audit Package JSON contains legal custody headers
    const auditPackageJson = fleetFederalVaultService.generateRoadsideAuditPackageJSON();
    const parsed = JSON.parse(auditPackageJson);

    expect(parsed.certificationHeader.statutoryAuthority).toContain('49 CFR § 390.31');
    expect(parsed.certificationHeader.custodianOfRecords).toBe(custodian);
    expect(parsed.driverQualificationFile.medicalExaminerCertificate.cfrAuthority).toBe('49 CFR § 391.43');
    expect(parsed.hoursOfServiceCustody.cfrAuthority).toBe('49 CFR § 395.8');
    expect(parsed.vehicleComplianceSummary.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 3. DOT DOCUMENTS SERVICE & MERKLE RECORD INTEGRITY
  // =========================================================================
  it('4. DotDocumentsService generates SHA-256 proofs and handles renewals', () => {
    saveSubscriberSession({
      sessionToken: 'test-token',
      user: {
        uid: 'usr-dyn-driver',
        name: 'David Vance',
        email: 'dvance@logistics.com',
        role: 'driver',
        fleetId: 'FLEET-PRO',
        carrierName: 'Vance Freightlines',
        usdotNumber: '8877665',
      },
    });

    const initialCount = dotDocumentsService.getDocuments().length;
    const newDoc = dotDocumentsService.addDocument({
      documentTitle: 'Annual Periodic Inspection MCS-64',
      category: 'VEHICLE_MAINTENANCE',
      cfrReference: '49 CFR § 396.17',
      documentNumber: 'INSP-2026-9921',
      issuingAuthority: 'Certified Fleet Inspection Center #44',
      issuedDate: '2026-03-01',
      expirationDate: '2027-03-01',
      status: 'VALID',
      notes: 'Passed all 13 FMCSA vehicle inspection checkpoints',
      certified: true,
    });

    expect(dotDocumentsService.getDocuments().length).toBe(initialCount + 1);
    expect(newDoc.merkleProofHash).toHaveLength(64);

    // Test renewal
    const renewed = dotDocumentsService.renewDocument(newDoc.id, '2028-03-01', 'Biennial re-inspection');
    expect(renewed).not.toBeNull();
    expect(renewed?.expirationDate).toBe('2028-03-01');
    expect(renewed?.notes).toContain('Biennial re-inspection');

    // Test full dossier export binds to session carrier
    const dossierJson = dotDocumentsService.exportFullAuditDossierJSON();
    const dossier = JSON.parse(dossierJson);
    expect(dossier.carrier).toContain('Vance Freightlines');
    expect(dossier.carrier).toContain('8877665');
    expect(dossier.assignedDriver).toContain('David Vance');
    expect(dossier.totalRecords).toBeGreaterThan(0);
  });

  // =========================================================================
  // 4. DIRECTIVE 2 COMPLIANCE
  // =========================================================================
  it('5. Invariant Directive 2: Zero occurrences of legacy string in src and server', () => {
    const forbidden = 'the' + '-g-o-a-t' + '-';
    const scanDir = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          scanDir(fullPath);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content.includes(forbidden)).toBe(false);
        }
      }
    };

    scanDir(path.resolve(process.cwd(), 'src'));
    scanDir(path.resolve(process.cwd(), 'server'));
  });
});
