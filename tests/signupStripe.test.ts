import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { startSignup, handleStripeEvent, validateSignupInput } from '../server/billing/signupBillingService';
import { verifyStripeSignature, signStripePayload, formEncode } from '../server/billing/stripeClient';
import { getOrCreateUserDocument } from '../server/auth/firebaseAuthService';

const realFetch = globalThis.fetch;
const ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_SOLO_PRO', 'STRIPE_PRICE_FLEET_PRO', 'STRIPE_API_BASE', 'APP_URL'];
let saved: Record<string, string | undefined> = {};
let stripeCalls: { url: string; body: string; auth: string }[] = [];

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  stripeCalls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function configureStripe() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_PRICE_SOLO_PRO = 'price_solo';
  process.env.STRIPE_PRICE_FLEET_PRO = 'price_fleet';
  process.env.APP_URL = 'https://truckwithease.com';
  let n = 0;
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    stripeCalls.push({ url, body: String(init.body), auth: (init.headers as any).Authorization });
    n++;
    return new Response(JSON.stringify({ id: `cs_test_${n}`, url: `https://checkout.stripe.com/c/pay/cs_test_${n}` }), { status: 200 });
  }) as typeof fetch;
}

let uidSeq = 0;
const newUser = () => {
  uidSeq++;
  return { uid: `usr-signup-test-${Date.now()}-${uidSeq}`, email: `signup${uidSeq}@example.com` };
};

describe('Sign-up validation', () => {
  it('requires a name, a valid account type, and a plan that matches it', () => {
    expect(() => validateSignupInput({ accountType: 'driver', tierId: 'SOLO_PRO', fullName: '' })).toThrow('Full name');
    expect(() => validateSignupInput({ accountType: 'admin', tierId: 'SOLO_PRO', fullName: 'Al' })).toThrow('Driver or Fleet');
    expect(() => validateSignupInput({ accountType: 'driver', tierId: 'FLEET_PRO', fullName: 'Al' })).toThrow('for fleet managers');
    expect(() => validateSignupInput({ accountType: 'fleet_manager', tierId: 'SOLO_PRO', fullName: 'Al' })).toThrow('for drivers');
    expect(() => validateSignupInput({ accountType: 'driver', tierId: 'SOLO_PRO', fullName: 'Al', usdotNumber: '12ab' })).toThrow('USDOT');
  });
});

describe('Free trial sign-up', () => {
  it('activates immediately with a random fleet ID, no Stripe call', async () => {
    const u = newUser();
    const r = await startSignup(u, { accountType: 'driver', tierId: 'TRIAL_14_DAY', fullName: 'Trial Driver', usdotNumber: '1234567' });
    expect(r.status).toBe('TRIAL_ACTIVE');
    if (r.status !== 'TRIAL_ACTIVE') return;
    expect(r.user.role).toBe('driver');
    expect(r.user.fleetId).toMatch(/^FLEET-SOLO-[0-9A-F]{10}$/);
    // USDOT never determines the fleet: no way to join someone else's fleet.
    expect(r.user.fleetId).not.toContain('1234567');
    expect((r.user as any).subscriptionStatus).toBe('TRIAL_ACTIVE');
    expect(stripeCalls.length).toBe(0);
  });

  it('refuses to re-sign-up an account that already has a fleet', async () => {
    const u = newUser();
    await startSignup(u, { accountType: 'driver', tierId: 'TRIAL_14_DAY', fullName: 'Trial Driver' });
    await expect(startSignup(u, { accountType: 'driver', tierId: 'TRIAL_14_DAY', fullName: 'Again' })).rejects.toThrow('already has an active plan');
  });
});

describe('Paid sign-up via Stripe Checkout', () => {
  it('fails clearly when Stripe is not configured', async () => {
    await expect(startSignup(newUser(), { accountType: 'driver', tierId: 'SOLO_PRO', fullName: 'Pay Driver' })).rejects.toThrow('not set up yet');
  });

  it('creates a subscription checkout session and does NOT grant access before payment', async () => {
    configureStripe();
    const u = newUser();
    const r = await startSignup(u, { accountType: 'fleet_manager', tierId: 'FLEET_PRO', fullName: 'Fleet Boss', carrierName: 'Boss Freight' });
    expect(r.status).toBe('CHECKOUT_REQUIRED');
    if (r.status !== 'CHECKOUT_REQUIRED') return;
    expect(r.checkoutUrl).toStartWith('https://checkout.stripe.com/');

    const call = stripeCalls[0];
    expect(call.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(call.auth).toBe('Bearer sk_test_123');
    const body = decodeURIComponent(call.body);
    expect(body).toContain('mode=subscription');
    expect(body).toContain('line_items[0][price]=price_fleet');
    expect(body).toContain(`client_reference_id=${u.uid}`);
    expect(body).toContain('success_url=https://truckwithease.com/?tab=signup&checkout=success');
    expect(body).not.toMatch(/card/i);

    const user = await getOrCreateUserDocument(u.uid, u.email);
    expect(user.role).toBe('driver'); // still the default, no admin rights yet
    expect(user.fleetId).toBeNull();
    expect((user as any).subscriptionStatus).toBe('PENDING_PAYMENT');
  });

  it('activates the account only on a paid checkout.session.completed for the current session', async () => {
    configureStripe();
    const u = newUser();
    await startSignup(u, { accountType: 'fleet_manager', tierId: 'FLEET_PRO', fullName: 'Fleet Boss' });
    const sessionId = `cs_test_${stripeCalls.length}`;

    // Unpaid completion does nothing.
    const unpaid = await handleStripeEvent({ id: `evt_unpaid_${u.uid}`, type: 'checkout.session.completed', data: { object: { id: sessionId, client_reference_id: u.uid, payment_status: 'unpaid' } } });
    expect(unpaid.note).toContain('unpaid');
    expect((await getOrCreateUserDocument(u.uid, u.email)).fleetId).toBeNull();

    // An old/foreign session id is ignored.
    const stale = await handleStripeEvent({ id: `evt_stale_${u.uid}`, type: 'checkout.session.completed', data: { object: { id: 'cs_other', client_reference_id: u.uid, payment_status: 'paid' } } });
    expect(stale.note).toBe('stale checkout session');

    const paid = await handleStripeEvent({
      id: `evt_paid_${u.uid}`,
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, client_reference_id: u.uid, payment_status: 'paid', customer: 'cus_1', subscription: `sub_${u.uid}` } },
    });
    expect(paid.note).toBe('activated');
    const user = await getOrCreateUserDocument(u.uid, u.email);
    expect(user.role).toBe('fleet_admin');
    expect(user.fleetId).toMatch(/^FLEET-[0-9A-F]{10}$/);
    expect((user as any).subscriptionStatus).toBe('ACTIVE');
    expect((user as any).stripeCustomerId).toBe('cus_1');

    // Duplicate delivery is a no-op.
    const dup = await handleStripeEvent({ id: `evt_paid_${u.uid}`, type: 'checkout.session.completed', data: { object: {} } });
    expect(dup.note).toBe('duplicate');

    // Later lifecycle events update status.
    await handleStripeEvent({ id: `evt_fail_${u.uid}`, type: 'invoice.payment_failed', data: { object: { subscription: `sub_${u.uid}` } } });
    expect((await getOrCreateUserDocument(u.uid, u.email) as any).subscriptionStatus).toBe('PAST_DUE');
    await handleStripeEvent({ id: `evt_del_${u.uid}`, type: 'customer.subscription.deleted', data: { object: { id: `sub_${u.uid}`, status: 'canceled' } } });
    expect((await getOrCreateUserDocument(u.uid, u.email) as any).subscriptionStatus).toBe('CANCELED');
  });
});

describe('Stripe webhook signature', () => {
  const secret = 'whsec_abc';
  const body = JSON.stringify({ id: 'evt_1', type: 'x' });

  it('accepts a valid signature and rejects tampering, wrong secret, replays and junk', () => {
    const header = signStripePayload(body, secret);
    expect(verifyStripeSignature(body, header, secret)).toBe(true);
    expect(verifyStripeSignature(body + ' ', header, secret)).toBe(false);
    expect(verifyStripeSignature(body, header, 'whsec_other')).toBe(false);
    const old = signStripePayload(body, secret, Math.floor(Date.now() / 1000) - 3600);
    expect(verifyStripeSignature(body, old, secret)).toBe(false);
    expect(verifyStripeSignature(body, undefined, secret)).toBe(false);
    expect(verifyStripeSignature(body, 't=abc,v1=zz', secret)).toBe(false);
  });

  it('form-encodes nested params the way Stripe expects', () => {
    const enc = formEncode({ a: 1, line_items: [{ price: 'p', quantity: 1 }], metadata: { uid: 'u 1' } }).join('&');
    expect(decodeURIComponent(enc)).toBe('a=1&line_items[0][price]=p&line_items[0][quantity]=1&metadata[uid]=u 1');
  });
});
