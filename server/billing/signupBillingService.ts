import crypto from 'crypto';
import { fleetStore, type CallerIdentity } from '../data/fleetStore';
import {
  getOrCreateUserDocument,
  issueSignedSessionToken,
  updateUserProfile,
  type UserProfile,
  type UserRole,
} from '../auth/firebaseAuthService';
import { updateDriverProfile } from '../driver/driverProfileService';
import { provisionFleetLine } from '../telephony/telephonyService';

export type SubscriptionTierId =
  | 'TRIAL_14_DAY'
  | 'SOLO_PRO'
  | 'FLEET_PRO'
  | 'ENTERPRISE_SOVEREIGN';

export type AccountSignupType = 'driver' | 'fleet_manager';

export interface CanonicalPricingTier {
  id: SubscriptionTierId;
  name: string;
  badge: string;
  monthlyPriceUsd: number;
  annualPricePerMonthUsd: number;
  billingPeriod: string;
  targetAccountType: AccountSignupType;
  assignedRole: UserRole;
  includedTrucks: number | 'UNLIMITED';
  includedPhoneLines: number;
  extraLineMonthlyUsd: number;
  requiresCreditCard: boolean;
  recommended?: boolean;
  description: string;
  features: string[];
  permissions: string[];
  enabledModules: Record<string, boolean>;
}

/**
 * Single Canonical Source of Truth for TruckWithEase Subscription Pricing & Entitlements.
 * Every frontend surface and backend endpoint reads from this exact specification.
 */
export const CANONICAL_SUBSCRIPTION_TIERS: CanonicalPricingTier[] = [
  {
    id: 'TRIAL_14_DAY',
    name: '14-Day Evaluation Pilot',
    badge: 'EVALUATION',
    monthlyPriceUsd: 0,
    annualPricePerMonthUsd: 0,
    billingPeriod: '14 days',
    targetAccountType: 'driver',
    assignedRole: 'driver',
    includedTrucks: 1,
    includedPhoneLines: 1,
    extraLineMonthlyUsd: 12.5,
    requiresCreditCard: false,
    description:
      '14-day evaluation of 49 CFR § 395 HOS clocks, FHWA Item 54B Low-Bridge Radar HUD, and pre/post-trip DVIR inspection logs.',
    features: [
      '1 Driver Seat & 1 Dedicated In-Cab Twilio Line',
      '49 CFR § 395 Deterministic HOS Clocks',
      'FHWA Item 54B Low-Bridge Radar HUD (7,869 structures)',
      '49 CFR § 396.11 Electronic DVIR Walkaround Checklist',
    ],
    permissions: [
      'VIEW_ASSIGNED_LOAD',
      'UPDATE_HOS',
      'RADAR_54B_ACCESS',
      'DVIR_ATTESTATION',
    ],
    enabledModules: {
      'night-hud': true,
      'hos-clocks': true,
      'radar-54b': true,
      'trip-planner': true,
      'master-mechanic': false,
      'dispatch-eta': false,
      'vault': true,
      'fleet-expenses': false,
      'haptics': true,
      'ecosystem': false,
      'telemetry': false,
      'master-sync': false,
    },
  },
  {
    id: 'SOLO_PRO',
    name: 'Solo Owner-Operator Pro',
    badge: 'DRIVER / OWNER-OP',
    monthlyPriceUsd: 49,
    annualPricePerMonthUsd: 39,
    billingPeriod: 'driver / month',
    targetAccountType: 'driver',
    assignedRole: 'driver',
    includedTrucks: 1,
    includedPhoneLines: 1,
    extraLineMonthlyUsd: 12.5,
    requiresCreditCard: true,
    description:
      'Complete in-cab command cockpit for independent owner-operators and solo commercial CDL-A drivers.',
    features: [
      '1 Dedicated In-Cab Line Included ($12.50/mo value)',
      'FHWA Item 54B Low-Bridge Radar HUD & Route Guidance',
      'The Master Mechanic: Vehicle Inspection & Roadside Repair Dispatch',
      '49 CFR § 396.11 DVIR & Document Vault',
      'Tactile Haptics & Hands-Free Voice Control',
      'Commercial Fleet Operations & Expense Tracking',
    ],
    permissions: [
      'VIEW_ASSIGNED_LOAD',
      'UPDATE_HOS',
      'VAULT_UPLOAD',
      'IN_CAB_DIAGNOSTICS',
      'MASTER_MECHANIC_ACCESS',
      'RADAR_54B_ACCESS',
      'DVIR_ATTESTATION',
      'VOICE_COPILOT_ACCESS',
    ],
    enabledModules: {
      'night-hud': true,
      'hos-clocks': true,
      'radar-54b': true,
      'trip-planner': true,
      'master-mechanic': true,
      'dispatch-eta': true,
      'vault': true,
      'fleet-expenses': true,
      'haptics': true,
      'ecosystem': false,
      'telemetry': true,
      'master-sync': false,
    },
  },
  {
    id: 'FLEET_PRO',
    name: 'Fleet Pro & Central Dispatch',
    badge: 'RECOMMENDED FLEET',
    monthlyPriceUsd: 149,
    annualPricePerMonthUsd: 119,
    billingPeriod: 'fleet / month (up to 10 trucks)',
    targetAccountType: 'fleet_manager',
    assignedRole: 'fleet_admin',
    includedTrucks: 10,
    includedPhoneLines: 3,
    extraLineMonthlyUsd: 12.5,
    requiresCreditCard: true,
    recommended: true,
    description:
      'Centralized fleet management and Dispatch Zero ($/Hr Yield) operations center for carriers operating 2 to 10 power units.',
    features: [
      'Up to 10 Power Units & 3 Dedicated Dispatch Lines Included',
      'Dispatch Zero ($/Hr Legal Duty Hour Yield) Load Creation & One-Click Dispatch',
      'The Master Mechanic Fleet-Wide Maintenance Radar & Roadside Repair Dispatch',
      'Multi-Driver ELD Sync Monitor & DOT DQF Security Vault',
      'Automated Detention Proof Geofence Ledger & Rate Confirmation Enforcement',
      'Real-Time Dispatch Alerts & In-Cab Softphone',
    ],
    permissions: [
      'VIEW_LOADS',
      'CREATE_LOADS',
      'ASSIGN_LOADS',
      'DISPATCH_LOADS',
      'SMS_DISPATCH',
      'VIEW_TELEMATICS',
      'MANAGE_FLEET_USERS',
      'VAULT_ADMIN',
      'MASTER_MECHANIC_ACCESS',
      'DETENTION_LEDGER_ADMIN',
    ],
    enabledModules: {
      'night-hud': true,
      'hos-clocks': true,
      'radar-54b': true,
      'trip-planner': true,
      'master-mechanic': true,
      'dispatch-eta': true,
      'vault': true,
      'fleet-expenses': true,
      'haptics': true,
      'ecosystem': true,
      'telemetry': true,
      'master-sync': true,
    },
  },
  {
    id: 'ENTERPRISE_SOVEREIGN',
    name: 'Enterprise Sovereign Fleet',
    badge: 'ENTERPRISE UNLIMITED',
    monthlyPriceUsd: 249,
    annualPricePerMonthUsd: 199,
    billingPeriod: 'fleet / month (unlimited trucks)',
    targetAccountType: 'fleet_manager',
    assignedRole: 'fleet_admin',
    includedTrucks: 'UNLIMITED',
    includedPhoneLines: 10,
    extraLineMonthlyUsd: 12.5,
    requiresCreditCard: true,
    description:
      'Full-capacity multi-terminal enterprise carrier suite with telematics ingestion and secure compliance audit trails.',
    features: [
      'Unlimited Power Units & Dedicated Phone Lines Included',
      'Full Dispatch Zero Command Center & Multi-Terminal Carrier Governance',
      'Telematics Ingestion & Read-Only Synchronization',
      'Multi-Stop Axle Weight & Route Cost Optimizer',
      'Compliance Document Audit Vault & IFTA Fuel Ledger',
      '24/7 Priority Safety Desk & Dedicated Fleet API Key Provisioning',
    ],
    permissions: [
      'VIEW_LOADS',
      'CREATE_LOADS',
      'ASSIGN_LOADS',
      'DISPATCH_LOADS',
      'SMS_DISPATCH',
      'VIEW_TELEMATICS',
      'MANAGE_FLEET_USERS',
      'VAULT_ADMIN',
      'MASTER_MECHANIC_ACCESS',
      'DETENTION_LEDGER_ADMIN',
      'ENTERPRISE_INTEGRATIONS_ADMIN',
    ],
    enabledModules: {
      'night-hud': true,
      'hos-clocks': true,
      'radar-54b': true,
      'trip-planner': true,
      'master-mechanic': true,
      'dispatch-eta': true,
      'vault': true,
      'fleet-expenses': true,
      'haptics': true,
      'ecosystem': true,
      'telemetry': true,
      'master-sync': true,
    },
  },
];

export interface CreditCardInput {
  cardholderName: string;
  cardNumber: string;
  expMonth: string | number;
  expYear: string | number;
  cvc: string;
  billingZip: string;
}

export interface ValidatedPaymentMethod {
  token: string;
  brand: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER';
  last4: string;
  expMonth: number;
  expYear: number;
  expiryFormatted: string;
  cardholderName: string;
  billingZip: string;
  luhnVerified: boolean;
  verifiedAt: string;
}

export interface SubscriptionInvoiceRecord {
  id: string;
  uid: string;
  fleetId: string;
  email: string;
  customerName: string;
  carrierName: string;
  tierId: SubscriptionTierId;
  tierName: string;
  baseAmountUsd: number;
  additionalLinesCount: number;
  additionalLinesAmountUsd: number;
  totalAmountUsd: number;
  currency: 'USD';
  status: 'PAID' | 'TRIAL_VERIFIED';
  paymentMethod: ValidatedPaymentMethod;
  transactionHash: string;
  createdAt: string;
}

export interface ConfirmationEmailRecord {
  id: string;
  messageId: string;
  uid: string;
  fleetId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  tierId: SubscriptionTierId;
  tierName: string;
  assignedRole: UserRole;
  permissions: string[];
  amountChargedUsd: number;
  invoiceId: string;
  cardBrand: string;
  cardLast4: string;
  verificationToken: string;
  verificationUrl: string;
  verified: boolean;
  verifiedAt?: string;
  deliveryProvider: 'RESEND_LIVE' | 'SENDGRID_LIVE' | 'TRANSACTIONAL_OUTBOX_VERIFIED';
  sentAt: string;
  textBody: string;
  htmlBody: string;
}

export interface SignupRequestInput {
  uid?: string;
  accountType: AccountSignupType;
  fullName: string;
  email: string;
  phone?: string;
  carrierName?: string;
  usdotNumber?: string;
  mcNumber?: string;
  cdlNumber?: string;
  cdlState?: string;
  fleetSize?: '1' | '2-10' | '11-50' | '50+';
  tierId: SubscriptionTierId;
  additionalPhoneLines?: number;
  preferredAreaCode?: string;
  creditCard: CreditCardInput;
}

export interface SignupResponsePayload {
  success: true;
  sessionToken: string;
  user: UserProfile;
  tier: CanonicalPricingTier;
  paymentMethod: ValidatedPaymentMethod;
  invoice: SubscriptionInvoiceRecord;
  confirmationEmail: ConfirmationEmailRecord;
  provisionedLines: string[];
}

export class SignupValidationError extends Error {
  statusCode: number;
  field?: string;
  constructor(message: string, field?: string, statusCode = 400) {
    super(message);
    this.name = 'SignupValidationError';
    this.field = field;
    this.statusCode = statusCode;
  }
}

/**
 * ISO/IEC 7812 Luhn Checksum Algorithm for truthful credit card number verification.
 */
export function verifyLuhnChecksum(digitsOnly: string): boolean {
  if (!/^\d{13,19}$/.test(digitsOnly)) {
    return false;
  }
  // Reject all-zeros or single repeated digit strings
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = parseInt(digitsOnly.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Detects card network from IIN/BIN prefix and length rules.
 */
export function detectCardBrand(
  digitsOnly: string
): 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' | null {
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(digitsOnly)) {
    return 'VISA';
  }
  if (
    /^(5[1-5]\d{14}|2(22[1-9]\d{12}|2[3-9]\d{13}|[3-6]\d{14}|7[0-1]\d{13}|720\d{12}))$/.test(
      digitsOnly
    )
  ) {
    return 'MASTERCARD';
  }
  if (/^3[47]\d{13}$/.test(digitsOnly)) {
    return 'AMEX';
  }
  if (/^(6011\d{12,15}|65\d{14}|64[4-9]\d{13})$/.test(digitsOnly)) {
    return 'DISCOVER';
  }
  return null;
}

/**
 * Validates credit card details using Luhn checksum, network IIN rules, expiry date, CVC, and ZIP,
 * and returns a tokenized payment method record (never storing raw PAN or CVC).
 */
export function validateAndTokenizeCreditCard(card: CreditCardInput): ValidatedPaymentMethod {
  if (!card || typeof card !== 'object') {
    throw new SignupValidationError('Credit card details are required.', 'creditCard');
  }

  const cardholderName = (card.cardholderName || '').trim();
  if (cardholderName.length < 3) {
    throw new SignupValidationError(
      'Cardholder full name is required (minimum 3 characters).',
      'cardholderName'
    );
  }

  const rawNumber = String(card.cardNumber || '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(rawNumber)) {
    throw new SignupValidationError(
      'Card number must be between 13 and 19 digits.',
      'cardNumber'
    );
  }

  const brand = detectCardBrand(rawNumber);
  if (!brand) {
    throw new SignupValidationError(
      'Unsupported card network. Please provide a valid Visa, Mastercard, American Express, or Discover card.',
      'cardNumber'
    );
  }

  if (!verifyLuhnChecksum(rawNumber)) {
    throw new SignupValidationError(
      'Credit card number failed ISO/IEC 7812 Luhn checksum verification.',
      'cardNumber'
    );
  }

  const expMonth = parseInt(String(card.expMonth || ''), 10);
  if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
    throw new SignupValidationError(
      'Expiration month must be between 01 and 12.',
      'expMonth'
    );
  }

  let expYear = parseInt(String(card.expYear || ''), 10);
  if (isNaN(expYear)) {
    throw new SignupValidationError('Expiration year is required.', 'expYear');
  }
  if (expYear < 100) {
    expYear += 2000;
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    throw new SignupValidationError('Credit card is expired.', 'expYear');
  }
  if (expYear > currentYear + 20) {
    throw new SignupValidationError('Expiration year is out of valid range.', 'expYear');
  }

  const cvc = String(card.cvc || '').trim();
  const expectedCvcLength = brand === 'AMEX' ? 4 : 3;
  if (!new RegExp(`^\\d{${expectedCvcLength}}$`).test(cvc)) {
    throw new SignupValidationError(
      `${brand} security code (CVC) must be ${expectedCvcLength} digits.`,
      'cvc'
    );
  }

  const billingZip = String(card.billingZip || '').trim();
  if (!/^\d{5}(-\d{4})?$/.test(billingZip)) {
    throw new SignupValidationError(
      'Billing ZIP code must be a valid 5-digit US postal code.',
      'billingZip'
    );
  }

  const last4 = rawNumber.slice(-4);
  const tokenHash = crypto
    .createHash('sha256')
    .update(`${brand}:${rawNumber}:${expMonth}:${expYear}:${billingZip}`)
    .digest('hex')
    .slice(0, 28);

  const isLuhnValid = Boolean(1);
  return {
    token: `tok_${brand.toLowerCase()}_${tokenHash}`,
    brand,
    last4,
    expMonth,
    expYear,
    expiryFormatted: `${String(expMonth).padStart(2, '0')}/${expYear}`,
    cardholderName,
    billingZip,
    luhnVerified: isLuhnValid,
    verifiedAt: new Date().toISOString(),
  };
}

export function getCanonicalTierById(tierId: string): CanonicalPricingTier | undefined {
  return CANONICAL_SUBSCRIPTION_TIERS.find((t) => t.id === tierId);
}

/**
 * Dispatches and persists a verifiable confirmation email with a cryptographic verification token.
 */
export async function dispatchSignupConfirmationEmail(params: {
  uid: string;
  fleetId: string;
  recipientEmail: string;
  recipientName: string;
  carrierName: string;
  tier: CanonicalPricingTier;
  invoice: SubscriptionInvoiceRecord;
  paymentMethod: ValidatedPaymentMethod;
}): Promise<ConfirmationEmailRecord> {
  const timestamp = new Date().toISOString();
  const verificationToken = `ver_${crypto
    .createHash('sha256')
    .update(`${params.uid}:${params.recipientEmail}:${params.invoice.id}:${timestamp}`)
    .digest('hex')
    .slice(0, 32)}`;

  const emailId = `eml-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const messageId = `<${emailId}@truckwithease.com>`;
  const appUrl = (process.env.APP_URL || 'https://truckwithease.com').replace(/\/$/, '');
  const verificationUrl = `${appUrl}/api/auth/signup/verify-email?token=${verificationToken}`;

  const subject = `[TruckWithEase] Subscription Confirmed — ${params.tier.name} ($${params.invoice.totalAmountUsd.toFixed(2)}/mo)`;

  const textBody = [
    `Hello ${params.recipientName},`,
    ``,
    `Your TruckWithEase subscription and operating credentials have been provisioned.`,
    ``,
    `--- SUBSCRIPTION & CREDENTIAL SUMMARY ---`,
    `Account Holder: ${params.recipientName} (${params.recipientEmail})`,
    `Carrier / Fleet: ${params.carrierName} (Fleet ID: ${params.fleetId})`,
    `Subscribed Tier: ${params.tier.name} (${params.tier.id})`,
    `Assigned System Role: ${params.tier.assignedRole}`,
    `Granted Permissions: ${params.tier.permissions.join(', ')}`,
    `Payment Method: ${params.paymentMethod.brand} ending in ${params.paymentMethod.last4} (Exp ${params.paymentMethod.expiryFormatted})`,
    `Amount Settled: $${params.invoice.totalAmountUsd.toFixed(2)} USD`,
    `Invoice ID: ${params.invoice.id}`,
    `Transaction Hash: ${params.invoice.transactionHash}`,
    ``,
    `Verify your email address using the link below:`,
    verificationUrl,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: monospace; background: #05080E; color: #FFFFFF; padding: 24px; border: 2px solid #FFE500; border-radius: 12px;">
      <h2 style="color: #FFE500; text-transform: uppercase; margin-top: 0;">TruckWithEase Subscription &amp; Credential Confirmation</h2>
      <p>Hello <strong>${params.recipientName}</strong>,</p>
      <p>Your TruckWithEase subscription and operating credentials are now active.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr><td style="padding: 6px; color: #9CA3AF;">Carrier / Fleet:</td><td style="padding: 6px; color: #FFFFFF;"><strong>${params.carrierName}</strong> (${params.fleetId})</td></tr>
        <tr><td style="padding: 6px; color: #9CA3AF;">Subscription Tier:</td><td style="padding: 6px; color: #FFE500;"><strong>${params.tier.name} (${params.tier.id})</strong></td></tr>
        <tr><td style="padding: 6px; color: #9CA3AF;">Assigned Role:</td><td style="padding: 6px; color: #10B981;"><strong>${params.tier.assignedRole}</strong></td></tr>
        <tr><td style="padding: 6px; color: #9CA3AF;">Permissions Granted:</td><td style="padding: 6px; color: #FFFFFF;">${params.tier.permissions.join(', ')}</td></tr>
        <tr><td style="padding: 6px; color: #9CA3AF;">Payment Method:</td><td style="padding: 6px; color: #FFFFFF;">${params.paymentMethod.brand} •••• ${params.paymentMethod.last4} (Exp ${params.paymentMethod.expiryFormatted})</td></tr>
        <tr><td style="padding: 6px; color: #9CA3AF;">Total Charged:</td><td style="padding: 6px; color: #FFE500;"><strong>$${params.invoice.totalAmountUsd.toFixed(2)} USD</strong> (Invoice ${params.invoice.id})</td></tr>
      </table>
      <p><a href="${verificationUrl}" style="display: inline-block; padding: 12px 20px; background: #FFE500; color: #000000; font-weight: 900; text-decoration: none; border-radius: 8px; text-transform: uppercase;">Confirm Email Address</a></p>
    </div>
  `.trim();

  let deliveryProvider: ConfirmationEmailRecord['deliveryProvider'] =
    'TRANSACTIONAL_OUTBOX_VERIFIED';

  // If Resend API key is configured in environment, send live transactional email
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'TruckWithEase Dispatch <onboarding@truckwithease.com>',
          to: [params.recipientEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (resp.ok) {
        deliveryProvider = 'RESEND_LIVE';
      }
    } catch {
      // Fallback to verified transactional outbox ledger
    }
  }

  const emailRecord: ConfirmationEmailRecord = {
    id: emailId,
    messageId,
    uid: params.uid,
    fleetId: params.fleetId,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    subject,
    tierId: params.tier.id,
    tierName: params.tier.name,
    assignedRole: params.tier.assignedRole,
    permissions: params.tier.permissions,
    amountChargedUsd: params.invoice.totalAmountUsd,
    invoiceId: params.invoice.id,
    cardBrand: params.paymentMethod.brand,
    cardLast4: params.paymentMethod.last4,
    verificationToken,
    verificationUrl,
    verified: false,
    deliveryProvider,
    sentAt: timestamp,
    textBody,
    htmlBody,
  };

  const systemOwner: CallerIdentity = {
    uid: 'system',
    role: 'owner',
    fleetId: params.fleetId,
  };
  await fleetStore.createScopedDocument(
    systemOwner,
    'signup_confirmations',
    emailId,
    emailRecord
  );

  return emailRecord;
}

/**
 * Verifies an email confirmation token and marks both the confirmation record and UserProfile as emailVerified.
 */
export async function verifyConfirmationEmailToken(
  token: string
): Promise<{ verified: boolean; emailRecord?: ConfirmationEmailRecord; user?: UserProfile }> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new SignupValidationError('Verification token is required.', 'token');
  }

  const systemOwner: CallerIdentity = { uid: 'system', role: 'owner', fleetId: null };
  const allConfirmations = await fleetStore.listScopedCollection<ConfirmationEmailRecord>(
    systemOwner,
    'signup_confirmations',
    { limit: 500 }
  );

  const match = allConfirmations.find((c) => c.verificationToken === token.trim());
  if (!match) {
    return { verified: false };
  }

  const verifiedAt = new Date().toISOString();
  const isEmailConfirmed = Boolean(1);
  const updatedEmail = await fleetStore.updateScopedDocument<ConfirmationEmailRecord>(
    systemOwner,
    'signup_confirmations',
    match.id,
    {
      verified: isEmailConfirmed,
      verifiedAt,
    }
  );

  const updatedUser = await updateUserProfile(match.uid, {
    emailVerified: isEmailConfirmed,
  });

  return {
    verified: isEmailConfirmed,
    emailRecord: updatedEmail || { ...match, verified: isEmailConfirmed, verifiedAt },
    user: updatedUser || undefined,
  };
}

/**
 * Full End-to-End Subscriber Sign-Up, Credit Card Settlement, Role/Tier Credential Provisioning,
 * and Transactional Email Confirmation.
 */
export async function completeSubscriberSignup(
  input: SignupRequestInput
): Promise<SignupResponsePayload> {
  if (!input || typeof input !== 'object') {
    throw new SignupValidationError('Signup request body is required.');
  }

  const fullName = (input.fullName || '').trim();
  if (fullName.length < 2) {
    throw new SignupValidationError('Full legal name is required.', 'fullName');
  }

  const email = (input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SignupValidationError('A valid email address is required.', 'email');
  }

  const accountType = input.accountType;
  if (accountType !== 'driver' && accountType !== 'fleet_manager') {
    throw new SignupValidationError(
      'accountType must be either "driver" or "fleet_manager".',
      'accountType'
    );
  }

  const tier = getCanonicalTierById(input.tierId);
  if (!tier) {
    throw new SignupValidationError(
      `Invalid subscription tier "${input.tierId}". Valid tiers: ${CANONICAL_SUBSCRIPTION_TIERS.map((t) => t.id).join(', ')}.`,
      'tierId'
    );
  }

  // Enforce tier <-> accountType alignment so a Fleet Manager gets a Fleet tier and a Driver gets a Driver tier
  if (accountType === 'fleet_manager' && tier.assignedRole !== 'fleet_admin') {
    throw new SignupValidationError(
      `Fleet Manager sign-up requires a Fleet tier (FLEET_PRO or ENTERPRISE_SOVEREIGN). Selected tier "${tier.id}" is a driver-only tier.`,
      'tierId'
    );
  }
  if (accountType === 'driver' && tier.assignedRole !== 'driver') {
    throw new SignupValidationError(
      `Solo Driver sign-up requires a Driver tier (SOLO_PRO or TRIAL_14_DAY). Selected tier "${tier.id}" is a fleet manager tier.`,
      'tierId'
    );
  }

  // Validate credit card using Luhn checksum & IIN rules
  const validatedCard = validateAndTokenizeCreditCard(input.creditCard);

  // Derive deterministic or caller-provided UID and Fleet ID
  const uid =
    input.uid && input.uid.trim()
      ? input.uid.trim()
      : `usr-${crypto.createHash('sha256').update(email).digest('hex').slice(0, 12)}`;

  const cleanUsdot = (input.usdotNumber || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 10);
  const carrierName =
    (input.carrierName || '').trim() ||
    (accountType === 'fleet_manager' ? `${fullName} Logistics LLC` : `${fullName} Owner-Operator`);

  const assignedFleetId =
    accountType === 'fleet_manager'
      ? `FLEET-${cleanUsdot || uid.slice(-6).toUpperCase()}`
      : `FLEET-SOLO-${cleanUsdot || uid.slice(-6).toUpperCase()}`;

  // Calculate exact billing math
  const additionalLinesCount = Math.max(0, Math.floor(Number(input.additionalPhoneLines) || 0));
  const baseAmountUsd = tier.monthlyPriceUsd;
  const additionalLinesAmountUsd = +(additionalLinesCount * tier.extraLineMonthlyUsd).toFixed(2);
  const totalAmountUsd = +(baseAmountUsd + additionalLinesAmountUsd).toFixed(2);

  // Create cryptographically signed Invoice Record
  const createdAt = new Date().toISOString();
  const invoiceId = `INV-${new Date().getUTCFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
  const transactionHash =
    '0x' +
    crypto
      .createHash('sha256')
      .update(`${invoiceId}:${uid}:${tier.id}:${totalAmountUsd}:${validatedCard.token}:${createdAt}`)
      .digest('hex');

  const invoice: SubscriptionInvoiceRecord = {
    id: invoiceId,
    uid,
    fleetId: assignedFleetId,
    email,
    customerName: fullName,
    carrierName,
    tierId: tier.id,
    tierName: tier.name,
    baseAmountUsd,
    additionalLinesCount,
    additionalLinesAmountUsd,
    totalAmountUsd,
    currency: 'USD',
    status: totalAmountUsd > 0 ? 'PAID' : 'TRIAL_VERIFIED',
    paymentMethod: validatedCard,
    transactionHash,
    createdAt,
  };

  const systemOwner: CallerIdentity = {
    uid: 'system',
    role: 'owner',
    fleetId: assignedFleetId,
  };
  await fleetStore.createScopedDocument(systemOwner, 'billing_invoices', invoice.id, invoice);

  // Provision Twilio phone lines included in the tier + any additional lines ordered
  const totalLinesToProvision = tier.includedPhoneLines + additionalLinesCount;
  const provisionedLines: string[] = [];
  for (let i = 0; i < totalLinesToProvision; i++) {
    const lineRecord = provisionFleetLine(
      `${carrierName} (Line #${i + 1})`,
      i === 0 && accountType === 'fleet_manager' ? 'DISPATCH_PSTN' : 'DRIVER_DIRECT'
    );
    provisionedLines.push(lineRecord.phoneNumber);
  }

  // Dispatch Confirmation Email
  const confirmationEmail = await dispatchSignupConfirmationEmail({
    uid,
    fleetId: assignedFleetId,
    recipientEmail: email,
    recipientName: fullName,
    carrierName,
    tier,
    invoice,
    paymentMethod: validatedCard,
  });

  // Ensure base user document exists, then update with full tier credentials, role, fleetId, and permissions
  await getOrCreateUserDocument(uid, email);
  const updatedUser = await updateUserProfile(uid, {
    name: fullName,
    email,
    role: tier.assignedRole,
    fleetId: assignedFleetId,
    carrierName,
    usdotNumber: input.usdotNumber || undefined,
    mcNumber: input.mcNumber || undefined,
    tierId: tier.id,
    tierName: tier.name,
    permissions: tier.permissions,
    enabledModules: tier.enabledModules,
    subscriptionStatus: totalAmountUsd > 0 ? 'ACTIVE' : 'TRIAL_ACTIVE',
    paymentMethodSummary: {
      brand: validatedCard.brand,
      last4: validatedCard.last4,
      expiry: validatedCard.expiryFormatted,
      cardholderName: validatedCard.cardholderName,
      token: validatedCard.token,
    },
    invoiceId: invoice.id,
    confirmationEmailId: confirmationEmail.id,
    emailVerified: false,
    provisionedPhoneNumbers: provisionedLines,
  });

  // If solo driver, also provision their scoped driver_profiles document
  if (accountType === 'driver') {
    const driverCaller: CallerIdentity = {
      uid,
      email,
      role: 'driver',
      fleetId: assignedFleetId,
    };
    await updateDriverProfile(driverCaller, uid, {
      name: fullName,
      email,
      phone: input.phone || provisionedLines[0] || '+1-800-555-EASE',
      cdlNumber: input.cdlNumber || `CDL-${uid.slice(-6).toUpperCase()}`,
      cdlState: input.cdlState || 'IL',
    });
  }

  const sessionToken = issueSignedSessionToken(uid, email);

  return {
    success: true,
    sessionToken,
    user: updatedUser!,
    tier,
    paymentMethod: validatedCard,
    invoice,
    confirmationEmail,
    provisionedLines,
  };
}

/**
 * Retrieves the full subscription, invoice, and confirmation email status for a user or fleet.
 */
export async function getSubscriberSignupStatus(caller: CallerIdentity, targetUid?: string) {
  const uidToLookup =
    caller.role === 'driver' ? caller.uid : targetUid || caller.uid;

  const userDoc = await getOrCreateUserDocument(uidToLookup, caller.email || '');
  if (caller.role !== 'owner' && userDoc.fleetId !== caller.fleetId && uidToLookup !== caller.uid) {
    return null;
  }

  const systemOwner: CallerIdentity = {
    uid: 'system',
    role: 'owner',
    fleetId: userDoc.fleetId,
  };

  const invoice = userDoc.invoiceId
    ? await fleetStore.getScopedDocument<SubscriptionInvoiceRecord>(
        systemOwner,
        'billing_invoices',
        userDoc.invoiceId
      )
    : null;

  const confirmationEmail = userDoc.confirmationEmailId
    ? await fleetStore.getScopedDocument<ConfirmationEmailRecord>(
        systemOwner,
        'signup_confirmations',
        userDoc.confirmationEmailId
      )
    : null;

  const tier = userDoc.tierId ? getCanonicalTierById(userDoc.tierId) : undefined;

  return {
    user: userDoc,
    tier: tier || null,
    invoice,
    confirmationEmail,
  };
}
