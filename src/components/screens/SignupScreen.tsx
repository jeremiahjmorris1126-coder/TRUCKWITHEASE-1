import React, { useEffect, useMemo, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import {
  authenticatedFetch,
  clientAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  type User,
} from '../../services/firebaseClientAuth';

interface SignupScreenProps {
  /** Called once the account has an active plan (trial started or payment confirmed). */
  onComplete?: () => void;
  onBack?: () => void;
  onSignIn?: () => void;
}

type AccountType = 'driver' | 'fleet_manager';

interface Tier {
  id: string;
  name: string;
  monthlyPriceUsd: number;
  targetAccountType: AccountType;
  description: string;
  features: string[];
  recommended?: boolean;
}

const input =
  'w-full bg-black border border-[#FFE500]/40 text-[#FFE500] placeholder-[#FFE500]/40 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#FFE500]';
const label = 'block text-[11px] uppercase tracking-wider text-[#FFE500]/70 mb-1';
const primaryBtn =
  'w-full py-3 rounded-lg bg-[#FFE500] text-black font-black uppercase tracking-wider text-sm hover:brightness-110 active:scale-[0.99] disabled:opacity-50 cursor-pointer';

function readCheckoutParam(): 'success' | 'cancelled' | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('checkout');
  return v === 'success' || v === 'cancelled' ? v : null;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ onComplete, onBack, onSignIn }) => {
  const [user, setUser] = useState<User | null>(clientAuth.currentUser);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [accountType, setAccountType] = useState<AccountType>('driver');
  const [tierId, setTierId] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [usdotNumber, setUsdotNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const checkout = useMemo(readCheckoutParam, []);

  useEffect(() => onAuthStateChanged(clientAuth, setUser), []);

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTiers(Array.isArray(d?.tiers) ? d.tiers : []))
      .catch(() => setTiers([]));
  }, []);

  // Returning from Stripe: wait for the webhook to activate the account.
  useEffect(() => {
    if (checkout !== 'success' || !user) return;
    let tries = 0;
    let stopped = false;
    const poll = async () => {
      tries++;
      try {
        const r = await authenticatedFetch('/api/billing/subscription');
        const d = r.ok ? await r.json() : null;
        if (d?.subscriptionStatus === 'ACTIVE') {
          setDone(`Payment received. Your ${d.tier?.name || ''} plan is active.`);
          if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      } catch {
        /* retry */
      }
      if (!stopped && tries < 15) setTimeout(poll, 2000);
      else if (!stopped) setDone('Payment received. Activation can take a minute; refresh this page shortly.');
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [checkout, user]);

  const plans = tiers.filter((t) => t.targetAccountType === accountType);
  useEffect(() => {
    if (!plans.some((p) => p.id === tierId)) {
      setTierId((plans.find((p) => p.recommended) || plans[0])?.id || '');
    }
  }, [accountType, tiers]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError('Enter your full name.');
    if (!tierId) return setError('Choose a plan.');
    if (usdotNumber && !/^\d{1,8}$/.test(usdotNumber)) return setError('USDOT number must be digits only.');

    setBusy(true);
    try {
      let current = user;
      if (!current) {
        if (!email.trim() || password.length < 6) {
          setBusy(false);
          return setError('Enter your email and a password of at least 6 characters.');
        }
        const cred = await createUserWithEmailAndPassword(clientAuth, email.trim(), password);
        current = cred.user;
        sendEmailVerification(current).catch(() => {});
      }

      const res = await authenticatedFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType, tierId, fullName: fullName.trim(), carrierName: carrierName.trim(), usdotNumber: usdotNumber.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sign-up failed. Please try again.');

      if (data.status === 'CHECKOUT_REQUIRED' && typeof data.checkoutUrl === 'string' && data.checkoutUrl.startsWith('https://')) {
        window.location.href = data.checkoutUrl; // Stripe's secure payment page
        return;
      }
      setDone('Your free trial is active. Check your email to verify your address.');
    } catch (err: any) {
      const code = err?.code || '';
      setError(
        code === 'auth/email-already-in-use'
          ? 'That email already has an account. Sign in first, then choose a plan.'
          : code === 'auth/invalid-email'
          ? 'Enter a valid email address.'
          : err?.message || 'Sign-up failed. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center space-y-4">
        <span className="material-symbols-outlined text-[48px] text-[#FFE500]">check_circle</span>
        <p className="text-[#FFE500] text-lg font-black uppercase tracking-wide">You&apos;re all set</p>
        <p className="text-[#FFE500]/80 text-sm">{done}</p>
        {onComplete && (
          <button onClick={onComplete} className={primaryBtn}>
            Open the App
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto px-6 pt-8 pb-16 space-y-5">
      {onBack && !user && (
        <button type="button" onClick={onBack} className="text-[#FFE500]/70 text-sm flex items-center gap-1 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
        </button>
      )}
      <div>
        <h1 className="text-[#FFE500] text-xl font-black uppercase tracking-wider">Sign Up</h1>
        <p className="text-[#FFE500]/70 text-sm mt-1">Pick your plan. Paid plans are billed securely by Stripe.</p>
      </div>

      {checkout === 'success' && (
        <p className="border border-[#FFE500] text-[#FFE500] rounded-lg p-3 text-sm">Confirming your payment…</p>
      )}
      {checkout === 'cancelled' && (
        <p className="border border-[#FFE500]/50 text-[#FFE500]/80 rounded-lg p-3 text-sm">Checkout was cancelled. You weren&apos;t charged.</p>
      )}

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
        {(['driver', 'fleet_manager'] as AccountType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={accountType === t}
            onClick={() => setAccountType(t)}
            className={`py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border cursor-pointer ${
              accountType === t ? 'bg-[#FFE500] text-black border-[#FFE500]' : 'bg-black text-[#FFE500] border-[#FFE500]/40'
            }`}
          >
            {t === 'driver' ? 'Driver' : 'Fleet'}
          </button>
        ))}
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Plan">
        {plans.length === 0 && <p className="text-[#FFE500]/60 text-sm">Loading plans…</p>}
        {plans.map((p) => (
          <label
            key={p.id}
            className={`block rounded-lg border p-3 cursor-pointer ${tierId === p.id ? 'border-[#FFE500] bg-[#FFE500]/10' : 'border-[#FFE500]/30'}`}
          >
            <input type="radio" name="plan" value={p.id} checked={tierId === p.id} onChange={() => setTierId(p.id)} className="sr-only" />
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[#FFE500] font-bold">{p.name}</span>
              <span className="text-[#FFE500] font-black whitespace-nowrap">
                {p.monthlyPriceUsd === 0 ? 'Free' : `$${p.monthlyPriceUsd}/mo`}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="su-name">Full name</label>
          <input id="su-name" className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </div>
        {!user && (
          <>
            <div>
              <label className={label} htmlFor="su-email">Email</label>
              <input id="su-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className={label} htmlFor="su-pass">Password</label>
              <input id="su-pass" type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
          </>
        )}
        {user && <p className="text-[#FFE500]/70 text-xs">Signed in as {user.email}</p>}
        <div>
          <label className={label} htmlFor="su-carrier">{accountType === 'fleet_manager' ? 'Company name' : 'Company name (optional)'}</label>
          <input id="su-carrier" className={input} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} autoComplete="organization" />
        </div>
        <div>
          <label className={label} htmlFor="su-usdot">USDOT number (optional)</label>
          <input id="su-usdot" inputMode="numeric" className={input} value={usdotNumber} onChange={(e) => setUsdotNumber(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </div>
      </div>

      {error && <p className="border border-[#FFE500] text-[#FFE500] rounded-lg p-3 text-sm" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? 'Working…' : plans.find((p) => p.id === tierId)?.monthlyPriceUsd === 0 ? 'Start Free Trial' : 'Continue to Payment'}
      </button>
      <p className="text-[#FFE500]/60 text-[11px] text-center">Card details are entered on Stripe&apos;s page, never stored by TruckWithEase.</p>
      <div className="text-center text-sm text-[#FFE500]/75">
        {!user && onSignIn && (
          <button type="button" onClick={onSignIn} className="cursor-pointer hover:text-[#FFE500]">
            Already have an account? Sign in
          </button>
        )}
        {user && (
          <button type="button" onClick={() => signOut(clientAuth)} className="cursor-pointer hover:text-[#FFE500]">
            Sign out
          </button>
        )}
      </div>
    </form>
  );
};
