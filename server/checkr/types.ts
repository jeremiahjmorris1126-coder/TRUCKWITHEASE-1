/**
 * Checkr Driver Background Check & Continuous MVR Types for Class A CDL Drivers
 * Implements FMCSA 49 CFR Part 382 (Drug & Alcohol Clearinghouse), 383 (CDL Standards),
 * 391 (Driver Qualifications), and FCRA (Fair Credit Reporting Act) compliance.
 */

export interface CheckrAddress {
  street: string;
  unit?: string;
  city: string;
  state: string; // 2-letter postal code (e.g., 'TX', 'IL')
  zip: string;   // 5-digit or 9-digit format
  country: 'US';
  isPhysicalResidential: boolean; // Must be true; commercial driver screening rejects PO boxes
}

export interface CheckrPreviousAddress extends CheckrAddress {
  startDate: string; // YYYY-MM
  endDate: string;   // YYYY-MM
}

export type CheckrPackageType =
  | 'class_a_full_mvr_clearinghouse'
  | 'class_a_annual_continuous_mvr'
  | 'class_a_drug_alcohol_only'
  | 'class_a_expedited_audit';

export type CheckrScreeningStatus =
  | 'INVITATION_CREATED'
  | 'INVITATION_SENT'
  | 'DRIVER_ACCESSED'
  | 'CONSENT_SIGNED'
  | 'IN_PROGRESS'
  | 'CLEAR'
  | 'CONSIDER'
  | 'SUSPENDED'
  | 'DISPUTED'
  | 'ADVERSE_ACTION_PENDING'
  | 'EXPIRED';

export type CheckrScenario =
  | 'CLEAR'
  | 'CONSIDER'
  | 'SUSPENDED_DOCUMENT_REQUIRED'
  | 'ERROR_ADDRESS_MISMATCH'
  | 'PRE_ADVERSE_ACTION'
  | 'DISPUTE_FILED'
  | 'EXPIRED';

export interface CheckrMvrCheckResult {
  state: string;
  licenseNumber: string;
  licenseClass: 'A' | 'B' | 'C';
  licenseStatus: 'VALID' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  commercialPrivilegesValid: boolean;
  cdlisVerified: boolean;
  points: number;
  violationsCount: number;
  violations: Array<{
    date: string;
    description: string;
    severity: 'MAJOR' | 'SERIOUS' | 'MINOR';
    points: number;
  }>;
  expirationDate: string;
  lastMedicalCertDate?: string;
}

export interface CheckrClearinghouseResult {
  queryType: 'PRE_EMPLOYMENT' | 'ANNUAL';
  result: 'NOT_PROHIBITED' | 'PROHIBITED';
  queryDate: string;
  violationsRecorded: number;
  returnToDutyStatus?: 'NOT_APPLICABLE' | 'FOLLOW_UP_TESTING_REQUIRED' | 'RESOLVED';
  cfrAuthority: '49 CFR § 382.701';
}

export interface CheckrPspResult {
  crashes5YearCount: number;
  dotRecordableCrashesCount: number;
  injuriesCount: number;
  fatalitiesCount: number;
  roadsideInspections3YearCount: number;
  driverOutOfServiceViolations: number;
  vehicleOutOfServiceViolations: number;
  fmcsaPspScore: number;
}

export interface CheckrCriminalResult {
  countyCriminalClear: boolean;
  federalCriminalClear: boolean;
  nationalCriminalClear: boolean;
  sexOffenderClear: boolean;
  globalTerroristWatchlistClear: boolean;
  recordsFoundCount: number;
}

export interface CheckrAdverseActionDetails {
  preAdverseNoticeSentAt?: string;
  disputeDeadline?: string; // Mandated 5 business days FCRA dispute window
  finalAdverseNoticeSentAt?: string;
  reasons: string[];
  summaryOfRightsProvided: boolean;
  reportCopyProvided: boolean;
}

export interface CheckrScreeningRecord {
  id: string; // e.g. chkr-scr-90482
  fleetId: string;
  driverId: string;
  candidateId: string;
  packageType: CheckrPackageType;
  status: CheckrScreeningStatus;
  
  // Driver identification details
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  dob: string;
  ssnLast4: string;
  cdlNumber: string;
  cdlState: string;
  cdlClass: 'A' | 'B' | 'C';
  
  // Address verification
  currentAddress: CheckrAddress;
  previousAddresses: CheckrPreviousAddress[];
  addressMismatchDetected: boolean;
  addressMismatchDetails?: string;

  // Checkr candidate hosted portal redirect
  invitationUrl: string;
  redirectUrl: string;
  completedAt?: string;
  expiresAt: string; // Statutory annual renewal deadline

  // Specific screening findings
  mvrResult?: CheckrMvrCheckResult;
  clearinghouseResult?: CheckrClearinghouseResult;
  pspResult?: CheckrPspResult;
  criminalResult?: CheckrCriminalResult;

  // Adverse action lifecycle
  adverseAction?: CheckrAdverseActionDetails;

  // Cryptographic audit chain (FIPS 180 SHA-256 Merkle root)
  merkleProofSha256: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateRequest {
  driverId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone: string;
  dob: string;
  ssnLast4: string;
  cdlNumber: string;
  cdlState: string;
  cdlClass?: 'A' | 'B' | 'C';
  currentAddress: CheckrAddress;
  previousAddresses?: CheckrPreviousAddress[];
  packageType?: CheckrPackageType;
  copyRequested?: boolean;
}

export interface WebhookEventPayload {
  id: string;
  type:
    | 'candidate.created'
    | 'invitation.completed'
    | 'report.created'
    | 'report.completed'
    | 'report.updated'
    | 'report.suspended'
    | 'report.disputed';
  data: {
    candidate_id?: string;
    report_id?: string;
    status?: string;
    result?: string;
    invitation_url?: string;
    completed_at?: string;
    package?: string;
  };
}
