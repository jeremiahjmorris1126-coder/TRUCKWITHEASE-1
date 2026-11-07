import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from '../services/firebaseClientAuth';
import { clientAuth } from '../services/firebaseClientAuth';
import { apiClient } from '../services/apiClient';
import { Lock, Mail, ShieldCheck, LogOut, AlertCircle, Truck, UserPlus, LogIn } from 'lucide-react';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess?: (user: User) => void;
}

interface TenantInfo {
  tenantId: string;
  carrierName: string;
  role: string;
  authenticated: boolean;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  // Load verified tenant info from server whenever user is logged in
  useEffect(() => {
    if (currentUser) {
      apiClient
        .get<{ tenant: TenantInfo }>('/api/auth/tenant', { skipUnauthorizedRedirect: true })
        .then((res) => {
          if (res?.tenant) setTenantInfo(res.tenant);
        })
        .catch(() => {
          setTenantInfo(null);
        });
    } else {
      setTenantInfo(null);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let credential;
      if (mode === 'signup') {
        credential = await createUserWithEmailAndPassword(clientAuth, email.trim(), password);
      } else {
        credential = await signInWithEmailAndPassword(clientAuth, email.trim(), password);
      }

      if (onLoginSuccess && credential.user) {
        onLoginSuccess(credential.user);
      }
      onClose();
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (code === 'auth/user-disabled') {
        setError('Your driver/carrier account has been disabled. Contact fleet dispatch.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please check network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(clientAuth);
      setTenantInfo(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Logout failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <div className="relative w-full max-w-[360px] sm:max-w-md rounded-2xl bg-black border border-[#FFE500]/30 p-4 sm:p-6 text-white shadow-[0_0_50px_rgba(255,229,0,0.15)] font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFE500] text-black shrink-0">
              <Truck className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-[#FFE500]">
                Fleet Authenticator
              </h2>
              <p className="text-[10px] text-gray-400">Driver &amp; Fleet Carrier Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-white text-base font-bold p-1 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {currentUser ? (
          /* Active Session View */
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3.5">
              <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                  Authenticated Fleet Session
                </p>
                <p className="text-xs font-mono text-white truncate">{currentUser.email}</p>
                {tenantInfo && (
                  <div className="mt-1 pt-1 border-t border-emerald-500/20 text-[10px] text-gray-300 space-y-0.5">
                    <p>
                      Role: <strong className="text-emerald-400">{tenantInfo.role}</strong>
                    </p>
                    <p>
                      Carrier: <span className="text-white">{tenantInfo.carrierName}</span>
                    </p>
                    <p className="text-gray-400">Tenant: {tenantInfo.tenantId}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Your session attaches verified Firebase ID credentials to dispatch, profile, alerts, and vault requests.
            </p>

            <button
              onClick={handleLogout}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider hover:bg-rose-600/30 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out from Cockpit
            </button>
          </div>
        ) : (
          /* Login / Sign Up Tabs and Form */
          <div>
            <div className="flex rounded-xl bg-black p-1 border border-gray-800 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#FFE500] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#FFE500] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-950/60 border border-rose-500/50 p-2.5 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Driver / Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="driver@truckwithease.com"
                    required
                    className="w-full min-h-[42px] rounded-xl bg-black border border-gray-800 pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#FFE500] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full min-h-[42px] rounded-xl bg-black border border-gray-800 pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#FFE500] focus:outline-none"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full min-h-[42px] rounded-xl bg-black border border-gray-800 pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFE500] text-black font-black uppercase text-xs tracking-wider shadow-[0_0_20px_rgba(255,229,0,0.35)] hover:bg-[#FFE500] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading
                    ? mode === 'signup'
                      ? 'Creating Account...'
                      : 'Authenticating...'
                    : mode === 'signup'
                    ? 'Create Driver Account'
                    : 'Sign In to Cockpit'}
                </button>
              </div>

              <p className="text-[10px] text-gray-500 text-center leading-tight">
                {mode === 'signup'
                  ? 'New sign-ups start as driver with an unassigned fleet until authorized.'
                  : 'Requires verified Firebase email/password credentials.'}
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
