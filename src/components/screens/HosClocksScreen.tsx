import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface HosClocksScreenProps {
  onShowToast: (msg: string) => void;
  speed?: number;
  onRecordInspection?: (
    actionType: any,
    triggerSource: any,
    notes: string
  ) => void;
  onOpenEldModal?: () => void;
}

type EldChoice = 'SAMSARA' | 'MOTIVE' | 'GEOTAB' | 'OTHER' | 'DONT_KNOW';

export const HosClocksScreen: React.FC<HosClocksScreenProps> = ({
  onShowToast,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<EldChoice | ''>('');
  const [otherProviderName, setOtherProviderName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedProviderLabel, setSavedProviderLabel] = useState<string>('');

  // Load existing preference from driver profile
  useEffect(() => {
    let mounted = true;
    authenticatedFetch('/api/driver/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.profile) return;
        const profile = data.profile;
        if (profile.preferredEldProvider) {
          setSelectedProvider(profile.preferredEldProvider as EldChoice);
          if (profile.preferredEldOtherName) {
            setOtherProviderName(profile.preferredEldOtherName);
          }
          setIsSaved(true);
          const label = profile.preferredEldProvider === 'OTHER'
            ? `Other: ${profile.preferredEldOtherName || 'Unspecified'}`
            : profile.preferredEldProvider === 'DONT_KNOW'
            ? "Don't know"
            : profile.preferredEldProvider;
          setSavedProviderLabel(label);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSavePreference = async () => {
    if (!selectedProvider) {
      onShowToast('Please select your ELD provider option.');
      return;
    }

    if (selectedProvider === 'OTHER' && !otherProviderName.trim()) {
      onShowToast('Please type the name of your ELD provider.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await authenticatedFetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredEldProvider: selectedProvider,
          preferredEldOtherName: selectedProvider === 'OTHER' ? otherProviderName.trim() : null,
          eldPreferenceSavedAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setIsSaved(true);
        const label = selectedProvider === 'OTHER'
          ? `Other: ${otherProviderName.trim()}`
          : selectedProvider === 'DONT_KNOW'
          ? "Don't know"
          : selectedProvider;
        setSavedProviderLabel(label);
        onShowToast('ELD preference saved to your driver profile.');
      } else {
        onShowToast('Could not save preference. Please try again.');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Network error saving preference.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Cockpit Header */}
      <div className="bg-[#0A0F14] p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/50 flex items-center justify-center text-primary shrink-0 shadow-[0_0_16px_rgba(255,229,0,0.3)]">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div>
            <h1 className="font-headline-sm text-primary uppercase tracking-wider font-black text-[16px]">
              Hours of Service
            </h1>
            <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
              FMCSA 49 CFR Part 395 &bull; Telematics Integration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase bg-surface-container-highest text-on-surface-variant border border-surface-container-high">
            <span className="w-2 h-2 rounded-full bg-outline" />
            READ-ONLY VIEW
          </span>
        </div>
      </div>

      {/* Main Requirement & Coming Soon Notice */}
      <div className="bg-[#0A0F14] p-8 rounded-xl border border-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(255,229,0,0.25)]">
          <span className="material-symbols-outlined text-[36px]">sync_alt</span>
        </div>

        <div className="space-y-3 max-w-lg">
          <h2 className="text-xl sm:text-2xl font-black text-primary uppercase tracking-wide leading-tight">
            Hours of service come from your ELD. Connect your ELD to view them here.
          </h2>
          <p className="font-body-sm text-sm text-on-surface-variant leading-relaxed">
            TruckWithEase is not an ELD provider and never generates legal duty records. We display read-only copies directly from your registered telematics provider.
          </p>
        </div>

        {/* ELD Connections Coming Soon + Provider Survey Picker */}
        <div className="w-full max-w-md bg-[#05080E] p-5 rounded-xl border border-surface-container-highest/80 text-left space-y-4">
          <div className="border-b border-surface-container-highest pb-2">
            <span className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">cable</span>
              ELD Connections Coming Soon
            </span>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Which ELD provider does your fleet currently use? Your choice is saved to your driver profile:
            </p>
          </div>

          <div className="space-y-2 pt-1 font-mono text-xs">
            {[
              { id: 'SAMSARA', label: 'Samsara' },
              { id: 'MOTIVE', label: 'Motive (KeepTruckin)' },
              { id: 'GEOTAB', label: 'Geotab' },
              { id: 'OTHER', label: 'Other' },
              { id: 'DONT_KNOW', label: "Don't know" },
            ].map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedProvider === option.id
                    ? 'bg-primary/15 border-primary text-primary font-bold shadow-[0_0_10px_rgba(255,229,0,0.2)]'
                    : 'bg-surface-container-low border-surface-container-highest text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <input
                  type="radio"
                  name="eldProviderChoice"
                  value={option.id}
                  checked={selectedProvider === option.id}
                  onChange={() => setSelectedProvider(option.id as EldChoice)}
                  className="accent-[#FFE500] cursor-pointer"
                />
                <span>{option.label}</span>
              </label>
            ))}

            {selectedProvider === 'OTHER' && (
              <div className="pt-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Type ELD provider name..."
                  value={otherProviderName}
                  onChange={(e) => setOtherProviderName(e.target.value)}
                  className="w-full bg-[#0A0F14] border border-primary/50 text-on-surface font-sans px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={handleSavePreference}
              disabled={isSaving || !selectedProvider}
              className={`btn-primary-tactical px-5 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all text-black font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(255,229,0,0.4)] ${
                isSaving || !selectedProvider ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{isSaving ? 'Saving...' : 'Save to Profile'}</span>
            </button>

            {isSaved && (
              <span className="text-[11px] font-mono text-[#10B981] flex items-center gap-1 font-bold">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Saved: {savedProviderLabel}
              </span>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-surface-container-highest/60 w-full max-w-md text-center">
          <p className="font-mono text-[10px] text-outline">
            49 CFR § 395.8 &bull; 49 CFR § 395.20 &bull; Official Telematics Provider Required
          </p>
        </div>
      </div>
    </div>
  );
};
