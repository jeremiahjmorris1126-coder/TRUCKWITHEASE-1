import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { clientAuth } from '../services/firebaseClientAuth';
import { Lock, Mail, ShieldCheck, LogOut, AlertCircle, Truck } from 'lucide-react';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess?: (user: User) => void;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email.trim(), password);
      if (onLoginSuccess) {
        onLoginSuccess(credential.user);
      }
      onClose();
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/user-disabled') {
        setError('Your driver/carrier account has been disabled. Contact fleet dispatch.');
      } else {
        setError(err.message || 'Login failed. Please check network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(clientAuth);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Logout failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0A0F14] border border-[#FFE500]/30 p-6 text-white shadow-[0_0_50px_rgba(255,229,0,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFE500] text-black">
              <Truck className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide uppercase text-[#FFE500]">
                Fleet Authenticator
              </h2>
              <p className="text-xs text-gray-400">Firebase Driver & Fleet Admin Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>

        {currentUser ? (
          /* Active Session View */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4">
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
                  Authenticated Fleet Session
                </p>
                <p className="text-sm font-mono text-white">{currentUser.email}</p>
                <p className="text-[10px] text-gray-400 font-mono">UID: {currentUser.uid}</p>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Your Firebase ID token is automatically attached to all API dispatch, load matching, and vault requests.
            </p>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 font-bold hover:bg-rose-600/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out from Cockpit
            </button>
          </div>
        ) : (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-950/60 border border-rose-500/50 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Driver / Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@truckwithease.com"
                  required
                  className="w-full rounded-xl bg-[#05080E] border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#FFE500] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl bg-[#05080E] border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#FFE500] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FFE500] text-black font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,229,0,0.35)] hover:bg-[#FFDF00] transition-colors disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Cockpit'}
              </button>
            </div>

            <p className="text-[11px] text-gray-500 text-center">
              New drivers default to role <span className="text-[#FFE500]">driver</span> with unassigned fleet until authorized by a fleet administrator.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
