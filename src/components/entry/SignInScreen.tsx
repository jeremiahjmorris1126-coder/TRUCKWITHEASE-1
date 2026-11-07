import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { clientAuth, signInWithEmailAndPassword } from '../../services/firebaseClientAuth';

interface SignInScreenProps {
  onBack: () => void;
  onCreateAccount: () => void;
}

const input =
  'w-full bg-black border border-[#FFE500]/40 text-[#FFE500] placeholder-[#FFE500]/40 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#FFE500]';

export const SignInScreen: React.FC<SignInScreenProps> = ({ onBack, onCreateAccount }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setMessage('Enter your email and password.');
    setBusy(true);
    setMessage(null);
    try {
      await signInWithEmailAndPassword(clientAuth, email.trim(), password);
      // The app's auth listener moves on to plans or the app.
    } catch (err: any) {
      const code = err?.code || '';
      setMessage(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Wrong email or password.'
          : code === 'auth/user-disabled'
          ? 'This account is disabled. Contact your fleet.'
          : code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again in a few minutes.'
          : 'Could not sign in. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMessage('Enter your email first, then tap "Forgot password".');
    try {
      await sendPasswordResetEmail(clientAuth, email.trim());
    } catch {
      /* Same message either way, so account existence isn't revealed. */
    }
    setMessage('If that email has an account, a reset link is on its way.');
  };

  return (
    <div className="min-h-screen bg-black text-[#FFE500] flex flex-col">
      <form onSubmit={submit} className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-6 py-12 space-y-5">
        <button type="button" onClick={onBack} className="self-start text-[#FFE500]/70 text-sm flex items-center gap-1 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
        </button>
        <h1 className="text-2xl font-black uppercase tracking-wider">Sign In</h1>

        <div className="space-y-3">
          <input aria-label="Email" type="email" placeholder="Email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input aria-label="Password" type="password" placeholder="Password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        {message && <p className="border border-[#FFE500] rounded-lg p-3 text-sm" role="alert">{message}</p>}

        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-lg bg-[#FFE500] text-black font-black uppercase tracking-wider cursor-pointer hover:brightness-110 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="flex justify-between text-sm text-[#FFE500]/75">
          <button type="button" onClick={reset} className="cursor-pointer hover:text-[#FFE500]">Forgot password</button>
          <button type="button" onClick={onCreateAccount} className="cursor-pointer hover:text-[#FFE500]">Create account</button>
        </div>
      </form>
    </div>
  );
};
