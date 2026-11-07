import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { clientAuth } from '../services/firebaseClientAuth';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface ProfileData {
  name: string;
  cdlNumber: string;
  cdlState?: string;
  medicalCardExpiration: string;
  phone?: string;
  unitNumber?: string;
  fleetId?: string;
  carrierName?: string;
  usdotNumber?: string;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    cdlNumber: '',
    cdlState: '',
    medicalCardExpiration: '',
    phone: '',
    unitNumber: '',
    fleetId: '',
    carrierName: '',
    usdotNumber: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const user = clientAuth.currentUser;
    if (!user) {
      setErrorMessage('You must be signed in to view or update your driver profile.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    Promise.all([
      apiClient.get('/api/driver/profile').catch(() => null),
      apiClient.get('/api/auth/tenant').catch(() => null),
    ])
      .then(([profRes, tenantRes]) => {
        const prof = profRes?.profile || {};
        const tenant = tenantRes?.tenant || {};
        setProfile({
          name: prof.name || user.displayName || user.email?.split('@')[0] || '',
          cdlNumber: prof.cdlNumber || '',
          cdlState: prof.cdlState || 'IL',
          medicalCardExpiration: prof.medicalCardExpiration || '',
          phone: prof.phone || '',
          unitNumber: prof.unitNumber || '',
          fleetId: tenant.tenantId || prof.fleetId || 'Unassigned Fleet',
          carrierName: tenant.carrierName || 'Independent Fleet',
          usdotNumber: tenant.usdotNumber || '',
        });
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to load driver profile from server.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiClient.put('/api/driver/profile', {
        name: profile.name,
        cdlNumber: profile.cdlNumber,
        cdlState: profile.cdlState,
        medicalCardExpiration: profile.medicalCardExpiration,
        phone: profile.phone,
        unitNumber: profile.unitNumber,
      });

      setSuccessMessage('Driver profile updated on server.');
      setIsEditing(false);
      if (onSaved) onSaved();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save driver profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const user = clientAuth.currentUser;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface-container w-full max-w-md rounded-xl border border-surface-container-high shadow-2xl p-space-md space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[28px]">badge</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-on-surface font-bold">
                {profile.name || (user ? 'Driver Profile' : 'Not Signed In')}
              </h3>
              <span className="font-telemetry-label text-[10px] text-primary block">
                {user ? (profile.fleetId ? `Fleet: ${profile.fleetId}` : 'Commercial Driver') : 'Guest Mode'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-error text-xs font-mono">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            {successMessage}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary text-[32px] animate-spin">
              progress_activity
            </span>
            <span className="text-xs font-mono text-outline uppercase tracking-wider">
              Loading driver records from server...
            </span>
          </div>
        ) : !user ? (
          /* Not Logged In State */
          <div className="py-6 text-center space-y-3 font-mono">
            <span className="material-symbols-outlined text-outline text-[40px]">lock</span>
            <p className="text-sm text-on-surface-variant">
              No authenticated driver found. Sign in to view your real CDL credentials and carrier records.
            </p>
          </div>
        ) : (
          /* Profile Content */
          <form onSubmit={handleSave} className="space-y-3 text-body-sm font-mono">
            {/* Name */}
            <div className="bg-surface-container-low p-3 rounded-lg">
              <label className="text-[10px] text-outline uppercase block mb-1">Driver Legal Name</label>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded px-2.5 py-1.5 text-on-surface text-xs focus:border-primary outline-none"
                  placeholder="Full Legal Name"
                />
              ) : (
                <span className="font-bold text-on-surface text-sm">{profile.name || 'Not on file'}</span>
              )}
            </div>

            {/* CDL Information */}
            <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
              <div className="flex-1 mr-2">
                <label className="text-[10px] text-outline uppercase block mb-1">Commercial Driver License (CDL)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.cdlNumber}
                    onChange={(e) => setProfile({ ...profile, cdlNumber: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded px-2.5 py-1.5 text-on-surface text-xs focus:border-primary outline-none"
                    placeholder="e.g. CDL-TX-8849201"
                  />
                ) : (
                  <span className="font-bold text-on-surface text-sm">{profile.cdlNumber || 'No CDL entered'}</span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold shrink-0">
                CLASS A
              </span>
            </div>

            {/* Medical Card */}
            <div className="bg-surface-container-low p-3 rounded-lg">
              <label className="text-[10px] text-outline uppercase block mb-1">DOT Medical Card (MCSA-5876) Expiration</label>
              {isEditing ? (
                <input
                  type="date"
                  value={profile.medicalCardExpiration}
                  onChange={(e) => setProfile({ ...profile, medicalCardExpiration: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded px-2.5 py-1.5 text-on-surface text-xs focus:border-primary outline-none"
                />
              ) : (
                <span className="font-bold text-on-surface text-sm">
                  {profile.medicalCardExpiration ? `Valid through ${profile.medicalCardExpiration}` : 'No date on record'}
                </span>
              )}
            </div>

            {/* Assigned Unit */}
            <div className="bg-surface-container-low p-3 rounded-lg flex justify-between items-center">
              <div className="flex-1 mr-2">
                <label className="text-[10px] text-outline uppercase block mb-1">Assigned Power Unit</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.unitNumber}
                    onChange={(e) => setProfile({ ...profile, unitNumber: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded px-2.5 py-1.5 text-on-surface text-xs focus:border-primary outline-none"
                    placeholder="Unit / Tractor Number"
                  />
                ) : (
                  <span className="font-bold text-on-surface text-sm">{profile.unitNumber || 'Unassigned'}</span>
                )}
              </div>
              <span className="material-symbols-outlined text-outline text-[20px]">
                local_shipping
              </span>
            </div>

            {/* Operating Carrier */}
            <div className="bg-surface-container-low p-3 rounded-lg">
              <span className="text-[10px] text-outline uppercase block">Operating Fleet Tenant</span>
              <span className="font-bold text-on-surface text-sm block">{profile.carrierName}</span>
              <span className="text-[11px] text-primary block">
                Fleet ID: {profile.fleetId} {profile.usdotNumber ? `// USDOT #${profile.usdotNumber}` : ''}
              </span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2.5 bg-surface-container-high text-on-surface font-label-caps text-[11px] uppercase font-bold rounded-lg cursor-pointer hover:bg-surface-container-highest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-primary text-on-primary font-label-caps text-[11px] uppercase font-bold rounded-lg cursor-pointer hover:brightness-110 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-caps text-[11px] uppercase font-bold rounded-lg cursor-pointer"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </form>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-caps text-[11px] uppercase font-bold rounded-lg cursor-pointer transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};
