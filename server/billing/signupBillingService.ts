import crypto from 'crypto';
import { fleetStore, type CallerIdentity } from '../data/fleetStore';
import {
  getOrCreateUserDocument,
  updateUserProfile,
  type UserProfile,
  type UserRole,
} from '../auth/firebaseAuthService';
import { updateDriverProfile } from '../driver/driverProfileService';
import {
  StripeError,
  createBillingPortalSession,
  createCheckoutSession,
  getStripePriceId,
  isStripeConfigured,
} from './stripeClient';


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

export function getCanonicalTierById(tierId: string): CanonicalPricingTier | undefined {
  return CANONICAL_SUBSCRIPTION_TIERS.find((t) => t.id === tierId);
}

/**
 * ─── Sign-up & subscription lifecycle ────────────────────────────────────────
 *
 * 1. The user creates a Firebase account in the app and is signed in.
 * 2. POST /api/auth/signup (authenticated). The uid comes ONLY from the verified
 *    token, never from the request body.
 *      - Free trial tier: activated immediately.
 *      - Paid tier: a pending sign-up is stored and a Stripe Checkout URL is
 *        returned. Card entry happens on Stripe's page.
 * 3. Stripe calls POST /api/webhooks/stripe (signature verified). Only then is
 *    the paid account activated with its role, fleet and permissions.
 *
 * Every new account gets a fresh random fleet ID, so nobody can join an
 * existing fleet by typing its USDOT number.
 */

export type SubscriptionStatus = 'PENDING_PAYMENT' | 'TRIAL_ACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface SignupRequestInput {
  accountType: AccountSignupType;
  tierId: SubscriptionTierId;
  fullName: string;
  phone?: string;
  carrierName?: string;
  usdotNumber?: string;
  mcNumber?: string;
  cdlNumber?: string;
  cdlState?: string;
}

export interface PendingSignupRecord {
  id: string; // = uid
  uid: string;
  email: string;
  fleetId: string; // reserved random fleet ID, applied on activation
  accountType: AccountSignupType;
  tierId: SubscriptionTierId;
  fullName: string;
  phone: string | null;
  carrierName: string;
  usdotNumber: string | null;
  mcNumber: string | null;
  cdlNumber: string | null;
  cdlState: string | null;
  checkoutSessionId: string | null;
  createdAt: string;
}

export type SignupStartResult =
  | { status: 'TRIAL_ACTIVE'; user: UserProfile; tier: CanonicalPricingTier }
  | { status: 'CHECKOUT_REQUIRED'; checkoutUrl: string; tier: CanonicalPricingTier };

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

const SYSTEM: CallerIdentity = { uid: 'system', role: 'owner', fleetId: null };
/** System writes must carry the record's own fleetId (fleetStore invariant). */
const systemFor = (fleetId: string): CallerIdentity => ({ uid: 'system', role: 'owner', fleetId });
const clean = (v: unknown, max = 120): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s ? s : null;
};

function newFleetId(accountType: AccountSignupType): string {
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return accountType === 'fleet_manager' ? `FLEET-${rand}` : `FLEET-SOLO-${rand}`;
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://truckwithease.com').replace(/\/$/, '');
}

export function validateSignupInput(input: any): {
  accountType: AccountSignupType;
  tier: CanonicalPricingTier;
  fullName: string;
} {
  if (!input || typeof input !== 'object') throw new SignupValidationError('Signup request body is required.');

  const fullName = clean(input.fullName, 100);
  if (!fullName || fullName.length < 2) throw new SignupValidationError('Full name is required.', 'fullName');

  const accountType = input.accountType;
  if (accountType !== 'driver' && accountType !== 'fleet_manager') {
    throw new SignupValidationError('Choose Driver or Fleet Manager.', 'accountType');
  }

  const tier = getCanonicalTierById(input.tierId);
  if (!tier) throw new SignupValidationError('Choose a plan.', 'tierId');
  if (tier.targetAccountType !== accountType) {
    throw new SignupValidationError(
      accountType === 'driver' ? 'That plan is for fleet managers. Pick a driver plan.' : 'That plan is for drivers. Pick a fleet plan.',
      'tierId'
    );
  }
  if (input.usdotNumber !== undefined && input.usdotNumber !== '' && !/^\d{1,8}$/.test(String(input.usdotNumber).trim())) {
    throw new SignupValidationError('USDOT number must be digits only (up to 8).', 'usdotNumber');
  }
  return { accountType, tier, fullName };
}

/** Grants the tier's role, fleet and permissions. Called for trials, and for paid tiers only from the verified Stripe webhook. */
async function activateAccount(
  pending: PendingSignupRecord,
  status: SubscriptionStatus,
  stripe?: { customerId?: string | null; subscriptionId?: string | null }
): Promise<UserProfile> {
  const tier = getCanonicalTierById(pending.tierId)!;
  const user = await updateUserProfile(pending.uid, {
    name: pending.fullName,
    email: pending.email,
    role: tier.assignedRole as UserRole,
    fleetId: pending.fleetId,
    carrierName: pending.carrierName,
    usdotNumber: pending.usdotNumber || undefined,
    mcNumber: pending.mcNumber || undefined,
    tierId: tier.id,
    tierName: tier.name,
    permissions: tier.permissions,
    enabledModules: tier.enabledModules,
    subscriptionStatus: status,
    stripeCustomerId: stripe?.customerId || undefined,
    stripeSubscriptionId: stripe?.subscriptionId || undefined,
    trialEndsAt: status === 'TRIAL_ACTIVE' ? new Date(Date.now() + 14 * 86400_000).toISOString() : undefined,
  } as Partial<UserProfile>);

  if (pending.accountType === 'driver') {
    await updateDriverProfile({ uid: pending.uid, email: pending.email, role: 'driver', fleetId: pending.fleetId }, pending.uid, {
      name: pending.fullName,
      email: pending.email,
      phone: pending.phone || '',
      cdlNumber: pending.cdlNumber || '',
      cdlState: pending.cdlState || '',
    });
  }

  if (stripe?.subscriptionId) {
    await fleetStore.createScopedDocument(systemFor(pending.fleetId), 'stripe_subscriptions', stripe.subscriptionId, {
      id: stripe.subscriptionId,
      fleetId: pending.fleetId,
      uid: pending.uid,
      customerId: stripe.customerId || null,
    });
  }
  return user!;
}

/**
 * Starts sign-up for the signed-in caller. `caller.uid`/`caller.email` come from
 * the verified login token.
 */
export async function startSignup(
  caller: { uid: string; email?: string | null },
  input: SignupRequestInput
): Promise<SignupStartResult> {
  const { accountType, tier, fullName } = validateSignupInput(input);

  const email = (caller.email || '').trim().toLowerCase();
  if (!email) throw new SignupValidationError('Your account has no email address. Sign in with email to subscribe.', 'email');

  const existing = await getOrCreateUserDocument(caller.uid, email);
  if (existing.fleetId) {
    const status = (existing as any).subscriptionStatus as SubscriptionStatus | undefined;
    throw new SignupValidationError(
      status === 'ACTIVE' || status === 'TRIAL_ACTIVE'
        ? 'This account already has an active plan.'
        : 'This account already belongs to a fleet. Ask your fleet admin about your plan.',
      undefined,
      409
    );
  }

  // Reuse the reserved fleet ID if the user retries checkout.
  const prior = await fleetStore.getScopedDocument<PendingSignupRecord>(SYSTEM, 'pending_signups', caller.uid);
  const pending: PendingSignupRecord = {
    id: caller.uid,
    uid: caller.uid,
    email,
    fleetId: prior?.accountType === accountType ? prior.fleetId : newFleetId(accountType),
    accountType,
    tierId: tier.id,
    fullName,
    phone: clean(input.phone, 30),
    carrierName: clean(input.carrierName, 120) || (accountType === 'fleet_manager' ? `${fullName} Fleet` : fullName),
    usdotNumber: clean(input.usdotNumber, 8),
    mcNumber: clean(input.mcNumber, 12),
    cdlNumber: clean(input.cdlNumber, 30),
    cdlState: clean(input.cdlState, 2)?.toUpperCase() || null,
    checkoutSessionId: null,
    createdAt: new Date().toISOString(),
  };

  const isFree = tier.monthlyPriceUsd === 0 && !tier.requiresCreditCard;
  if (isFree) {
    await fleetStore.createScopedDocument(systemFor(pending.fleetId), 'pending_signups', pending.id, pending);
    const user = await activateAccount(pending, 'TRIAL_ACTIVE');
    return { status: 'TRIAL_ACTIVE', user, tier };
  }

  if (!isStripeConfigured()) {
    throw new SignupValidationError('Online payments are not set up yet. Please try again later.', undefined, 503);
  }
  const priceId = getStripePriceId(tier.id);
  if (!priceId) {
    throw new SignupValidationError(`The ${tier.name} plan is not available for online checkout yet.`, 'tierId', 503);
  }

  let session: { id: string; url: string };
  try {
    session = await createCheckoutSession({
      priceId,
      uid: caller.uid,
      email,
      tierId: tier.id,
      successUrl: `${appUrl()}/?tab=signup&checkout=success`,
      cancelUrl: `${appUrl()}/?tab=signup&checkout=cancelled`,
    });
  } catch (err) {
    const e = err as StripeError;
    throw new SignupValidationError(`Could not start checkout: ${e.message}`, undefined, e.httpStatus && e.httpStatus < 500 ? 502 : 503);
  }
  pending.checkoutSessionId = session.id;
  await fleetStore.createScopedDocument(systemFor(pending.fleetId), 'pending_signups', pending.id, pending);
  await updateUserProfile(caller.uid, { subscriptionStatus: 'PENDING_PAYMENT', tierId: tier.id, tierName: tier.name } as Partial<UserProfile>);
  return { status: 'CHECKOUT_REQUIRED', checkoutUrl: session.url, tier };
}

/** Handles a Stripe webhook event whose signature has already been verified. */
export async function handleStripeEvent(event: any): Promise<{ handled: boolean; note: string }> {
  if (!event?.id || !event?.type) return { handled: false, note: 'malformed event' };

  // Idempotency: Stripe may deliver the same event more than once.
  const seen = await fleetStore.getScopedDocument(SYSTEM, 'stripe_events', event.id);
  if (seen) return { handled: true, note: 'duplicate' };

  const obj = event.data?.object || {};
  let note = 'ignored';

  if (event.type === 'checkout.session.completed') {
    const uid = obj.client_reference_id || obj.metadata?.uid;
    const pending = uid ? await fleetStore.getScopedDocument<PendingSignupRecord>(SYSTEM, 'pending_signups', uid) : null;
    if (!pending) {
      note = 'no pending signup';
    } else if (pending.checkoutSessionId && pending.checkoutSessionId !== obj.id) {
      note = 'stale checkout session';
    } else if (obj.payment_status !== 'paid' && obj.payment_status !== 'no_payment_required') {
      note = `payment_status ${obj.payment_status}`;
    } else {
      await activateAccount(pending, 'ACTIVE', { customerId: obj.customer, subscriptionId: obj.subscription });
      note = 'activated';
    }
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const link = obj.id ? await fleetStore.getScopedDocument<any>(SYSTEM, 'stripe_subscriptions', obj.id) : null;
    if (link?.uid) {
      const status: SubscriptionStatus =
        event.type === 'customer.subscription.deleted' || obj.status === 'canceled' || obj.status === 'unpaid'
          ? 'CANCELED'
          : obj.status === 'past_due'
          ? 'PAST_DUE'
          : obj.status === 'active' || obj.status === 'trialing'
          ? 'ACTIVE'
          : 'PAST_DUE';
      await updateUserProfile(link.uid, { subscriptionStatus: status } as Partial<UserProfile>);
      note = `status ${status}`;
    } else {
      note = 'unknown subscription';
    }
  } else if (event.type === 'invoice.payment_failed') {
    const link = obj.subscription ? await fleetStore.getScopedDocument<any>(SYSTEM, 'stripe_subscriptions', obj.subscription) : null;
    if (link?.uid) {
      await updateUserProfile(link.uid, { subscriptionStatus: 'PAST_DUE' } as Partial<UserProfile>);
      note = 'status PAST_DUE';
    }
  }

  await fleetStore.createScopedDocument(systemFor('SYSTEM'), 'stripe_events', event.id, { id: event.id, fleetId: 'SYSTEM', type: event.type, note, at: new Date().toISOString() });
  return { handled: true, note };
}

export async function getSubscriberSignupStatus(caller: CallerIdentity, targetUid?: string) {
  const uidToLookup = caller.role === 'driver' ? caller.uid : targetUid || caller.uid;
  const userDoc = await getOrCreateUserDocument(uidToLookup, caller.email || '');
  if (caller.role !== 'owner' && uidToLookup !== caller.uid && userDoc.fleetId !== caller.fleetId) {
    return null;
  }
  const tier = userDoc.tierId ? getCanonicalTierById(userDoc.tierId) : undefined;
  return {
    user: userDoc,
    tier: tier || null,
    subscriptionStatus: (userDoc as any).subscriptionStatus || null,
    canManageBilling: Boolean((userDoc as any).stripeCustomerId),
  };
}

/** Stripe-hosted page for updating the card or cancelling. */
export async function getBillingPortalUrl(caller: CallerIdentity): Promise<string> {
  const userDoc = await getOrCreateUserDocument(caller.uid, caller.email || '');
  const customerId = (userDoc as any).stripeCustomerId;
  if (!customerId) throw new SignupValidationError('No billing account found for this user.', undefined, 404);
  return createBillingPortalSession(customerId, `${appUrl()}/?tab=signup`);
}
