import crypto from 'crypto';

/**
 * Minimal Stripe REST client (no SDK dependency).
 *
 * Card details never touch TruckWithEase servers: customers pay on Stripe's
 * hosted Checkout page, and Stripe tells us the result through a signed webhook.
 *
 * Env:
 *   STRIPE_SECRET_KEY        sk_live_... / sk_test_...
 *   STRIPE_WEBHOOK_SECRET    whsec_... (from the webhook endpoint in the Stripe dashboard)
 *   STRIPE_PRICE_<TIER_ID>   price_... for each paid tier, e.g. STRIPE_PRICE_SOLO_PRO
 *   STRIPE_API_BASE          optional override (tests)
 */

export class StripeError extends Error {
  constructor(message: string, public httpStatus?: number) {
    super(message);
    this.name = 'StripeError';
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getStripePriceId(tierId: string): string | null {
  const v = process.env[`STRIPE_PRICE_${tierId}`]?.trim();
  return v ? v : null;
}

/** Encodes nested objects the way Stripe expects: a[b][0][c]=v */
export function formEncode(obj: Record<string, any>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') parts.push(...formEncode(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === 'object') {
      parts.push(...formEncode(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts;
}

async function stripePost<T = any>(path: string, params: Record<string, any>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeError('Stripe is not configured.', 503);
  const base = (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode(params).join('&'),
      signal: controller.signal,
    });
  } catch (err) {
    throw new StripeError(`Could not reach Stripe: ${(err as Error).name === 'AbortError' ? 'timeout' : 'network error'}`, 502);
  } finally {
    clearTimeout(timer);
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Stripe error messages never contain the secret key.
    throw new StripeError(body?.error?.message || `Stripe HTTP ${res.status}`, res.status);
  }
  return body as T;
}

export interface CheckoutSessionParams {
  priceId: string;
  uid: string;
  email: string;
  tierId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(p: CheckoutSessionParams): Promise<{ id: string; url: string }> {
  const session = await stripePost<any>('/v1/checkout/sessions', {
    mode: 'subscription',
    line_items: [{ price: p.priceId, quantity: 1 }],
    customer_email: p.email,
    client_reference_id: p.uid,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    allow_promotion_codes: 'true',
    metadata: { uid: p.uid, tierId: p.tierId },
    subscription_data: { metadata: { uid: p.uid, tierId: p.tierId } },
  });
  if (!session?.id || !session?.url) throw new StripeError('Stripe did not return a checkout URL.', 502);
  return { id: session.id, url: session.url };
}

/** Stripe-hosted page where a customer updates their card or cancels. */
export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const s = await stripePost<any>('/v1/billing_portal/sessions', { customer: customerId, return_url: returnUrl });
  if (!s?.url) throw new StripeError('Stripe did not return a billing portal URL.', 502);
  return s.url;
}

/**
 * Verifies a Stripe-Signature header (t=timestamp,v1=hex HMAC-SHA256 of `${t}.${rawBody}`).
 * Rejects signatures older than toleranceSec to stop replays.
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false;
  const pairs = header.split(',').map((p) => p.split('=') as [string, string]);
  const t = pairs.find(([k]) => k === 't')?.[1];
  const sigs = pairs.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')}`)
    .digest('hex');
  const exp = Buffer.from(expected, 'hex');
  return sigs.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

/** Test helper: produces a valid Stripe-Signature header for a payload. */
export function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${sig}`;
}
