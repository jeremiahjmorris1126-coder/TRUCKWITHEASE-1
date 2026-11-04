import React, { useState } from 'react';
import {
  CheckrScreeningRecord,
  CheckrScenario,
  CheckrPackageType,
} from '../../server/checkr/types';
import { checkrClientService, isPoBox, validateCheckrAddress } from '../services/checkrClientService';

interface CheckrBackgroundCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  initialDriverId?: string;
  initialCdl?: string;
  initialState?: string;
}

export const CheckrBackgroundCheckModal: React.FC<CheckrBackgroundCheckModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  initialDriverId = 'drv-jeremiah-904',
  initialCdl = 'CDL-TX-8849201',
  initialState = 'TX',
}) => {
  const [screenings, setScreenings] = useState<CheckrScreeningRecord[]>(() =>
    checkrClientService.getScreenings()
  );
  const [selectedScreeningId, setSelectedScreeningId] = useState<string>(
    () => checkrClientService.getScreenings()[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'VIEW_RADAR' | 'NEW_INVITE' | 'SCENARIO_SIMULATOR'>('VIEW_RADAR');

  // Form State
  const [firstName, setFirstName] = useState<string>('Jeremiah');
  const [lastName, setLastName] = useState<string>('Morris');
  const [email, setEmail] = useState<string>('jeremiah@morrishive.com');
  const [phone, setPhone] = useState<string>('+1-555-884-9102');
  const [dob, setDob] = useState<string>('1984-06-12');
  const [ssnLast4, setSsnLast4] = useState<string>('8821');
  const [cdlNumber, setCdlNumber] = useState<string>(initialCdl);
  const [cdlState, setCdlState] = useState<string>(initialState);
  const [street, setStreet] = useState<string>('1240 Industrial Blvd');
  const [unit, setUnit] = useState<string>('Ste 400');
  const [city, setCity] = useState<string>('Dallas');
  const [addressState, setAddressState] = useState<string>('TX');
  const [zip, setZip] = useState<string>('75207');
  const [packageType, setPackageType] = useState<CheckrPackageType>('class_a_full_mvr_clearinghouse');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    const unsub = checkrClientService.subscribe((list) => {
      setScreenings(list);
      if (!selectedScreeningId && list.length > 0) {
        setSelectedScreeningId(list[0].id);
      }
    });
    return () => unsub();
  }, [selectedScreeningId]);

  if (!isOpen) return null;

  const currentSelected = screenings.find((s) => s.id === selectedScreeningId) || screenings[0];

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const addr = {
      street,
      unit,
      city,
      state: addressState.toUpperCase(),
      zip,
      country: 'US' as const,
      isPhysicalResidential: true,
    };

    const val = validateCheckrAddress(addr);
    if (!val.valid) {
      setFormError(val.errors.join(' '));
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await checkrClientService.createCandidateScreening({
        driverId: initialDriverId,
        firstName,
        lastName,
        email,
        phone,
        dob,
        ssnLast4,
        cdlNumber,
        cdlState: cdlState.toUpperCase(),
        cdlClass: 'A',
        currentAddress: addr,
        packageType,
      });

      setSelectedScreeningId(record.id);
      setActiveTab('VIEW_RADAR');
      onShowToast(`CHECKR INVITATION DISPATCHED // ${record.candidateId}`, 'mark_email_read');
    } catch (err: any) {
      setFormError(err.message || 'Failed to dispatch Checkr invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulate = async (scenario: CheckrScenario) => {
    if (!currentSelected) return;
    try {
      const updated = await checkrClientService.simulateScenario(currentSelected.id, scenario);
      onShowToast(`SCENARIO APPLIED: ${scenario} (${updated.status})`, 'science');
    } catch (err: any) {
      onShowToast(`Simulation error: ${err.message}`, 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CLEAR':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">100% CLEAR // COMPLIANT</span>;
      case 'CONSIDER':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">CONSIDER // CARRIER REVIEW</span>;
      case 'SUSPENDED':
        return <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black uppercase tracking-wider">SUSPENDED // ACTION REQUIRED</span>;
      case 'ADVERSE_ACTION_PENDING':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider">FCRA PRE-ADVERSE ACTION</span>;
      case 'DISPUTED':
        return <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-wider">FCRA DISPUTE FILED</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-black uppercase tracking-wider">ANNUAL REVIEW EXPIRED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] font-black uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#05080E] border-2 border-primary/60 rounded-3xl shadow-[0_0_50px_rgba(255,229,0,0.25)] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-[#1E2532] bg-[#0A0F14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(255,229,0,0.3)]">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-primary text-black font-black text-[9px] uppercase tracking-wider">
                  TOP PRIORITY #1
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  CHECKR CLASS A BACKGROUND &amp; CONTINUOUS MVR
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                DOT Clearinghouse &bull; FMCSA PSP Crash History &bull; AAMVA CDLIS Verification &bull; 49 CFR Part 391
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* SUBNAV TAB SWITCHER */}
        <div className="px-4 py-2 bg-[#0A0F14]/60 border-b border-[#1E2532] flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('VIEW_RADAR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'VIEW_RADAR'
                ? 'bg-primary text-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">radar</span>
            <span>Screening Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('NEW_INVITE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'NEW_INVITE'
                ? 'bg-primary text-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">person_add</span>
            <span>New Driver Invitation</span>
          </button>

          <button
            onClick={() => setActiveTab('SCENARIO_SIMULATOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'SCENARIO_SIMULATOR'
                ? 'bg-primary text-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">science</span>
            <span>Scenario Testing Matrix</span>
          </button>

          <div className="ml-auto text-[10px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Memory Cache Active</span>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* TAB 1: VIEW RADAR */}
          {activeTab === 'VIEW_RADAR' && currentSelected && (
            <div className="space-y-6">
              
              {/* STATUS BANNER */}
              <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-white text-base">
                      {currentSelected.firstName} {currentSelected.lastName}
                    </strong>
                    <span className="text-xs text-slate-400">({currentSelected.cdlClass} CDL: {currentSelected.cdlNumber} - {currentSelected.cdlState})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{currentSelected.notes}</p>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(currentSelected.status)}
                </div>
              </div>

              {/* ADDRESS & REDIRECT CALLOUTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Physical Address Verification Box */}
                <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-primary">home_pin</span>
                      Physical Domicile Address
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                      PO BOX STRICTLY EXCLUDED
                    </span>
                  </div>
                  <p className="text-white font-medium">
                    {currentSelected.currentAddress.street} {currentSelected.currentAddress.unit || ''}
                    <br />
                    {currentSelected.currentAddress.city}, {currentSelected.currentAddress.state} {currentSelected.currentAddress.zip}
                  </p>

                  {currentSelected.addressMismatchDetected ? (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] leading-snug">
                      <strong className="block font-bold">⚠️ JURISDICTIONAL DIVERGENCE DETECTED</strong>
                      {currentSelected.addressMismatchDetails}
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      <span>Address matches CDL licensing state ({currentSelected.cdlState})</span>
                    </div>
                  )}
                </div>

                {/* Candidate Portal Redirect URL */}
                <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-sky-400">link</span>
                      Candidate Portal Redirect
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">Hosted FCRA Flow</span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug">
                    Driver completes electronic consent, MVR release, and Clearinghouse query via Checkr:
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={currentSelected.invitationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider flex items-center gap-1 hover:brightness-110 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.35)]"
                    >
                      <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                      <span>Open Candidate Portal</span>
                    </a>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentSelected.invitationUrl);
                        onShowToast('CHECKR INVITATION LINK COPIED', 'content_copy');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                      <span>Copy Link</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* THREE-WAY STATUTORY RADAR (MVR + CLEARINGHOUSE + PSP) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. MVR */}
                <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary text-[16px]">minor_crash</span>
                      AAMVA MVR
                    </span>
                    <span className="text-[9px] text-slate-400">49 CFR § 391.25</span>
                  </div>
                  {currentSelected.mvrResult ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">License Status:</span>
                        <strong className={currentSelected.mvrResult.licenseStatus === 'VALID' ? 'text-emerald-400' : 'text-red-400'}>
                          {currentSelected.mvrResult.licenseStatus}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Active Points:</span>
                        <strong className="text-white">{currentSelected.mvrResult.points} pts</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Moving Violations:</span>
                        <strong className="text-white">{currentSelected.mvrResult.violationsCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">CDLIS Verified:</span>
                        <strong className="text-emerald-400">{currentSelected.mvrResult.cdlisVerified ? 'CONFIRMED' : 'PENDING'}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">Awaiting driver portal submission</p>
                  )}
                </div>

                {/* 2. Drug & Alcohol Clearinghouse */}
                <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1">
                      <span className="material-symbols-outlined text-emerald-400 text-[16px]">science</span>
                      CLEARINGHOUSE
                    </span>
                    <span className="text-[9px] text-slate-400">49 CFR § 382.701</span>
                  </div>
                  {currentSelected.clearinghouseResult ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Query Result:</span>
                        <strong className={currentSelected.clearinghouseResult.result === 'NOT_PROHIBITED' ? 'text-emerald-400' : 'text-rose-400'}>
                          {currentSelected.clearinghouseResult.result}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Query Date:</span>
                        <strong className="text-white">{currentSelected.clearinghouseResult.queryDate}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Violations:</span>
                        <strong className="text-emerald-400">{currentSelected.clearinghouseResult.violationsRecorded} Reported</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">Awaiting driver electronic consent</p>
                  )}
                </div>

                {/* 3. FMCSA PSP Crash History */}
                <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1">
                      <span className="material-symbols-outlined text-sky-400 text-[16px]">local_police</span>
                      FMCSA PSP
                    </span>
                    <span className="text-[9px] text-slate-400">5-Yr Crash Record</span>
                  </div>
                  {currentSelected.pspResult ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">5-Year Crashes:</span>
                        <strong className="text-white">{currentSelected.pspResult.crashes5YearCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">3-Year Inspections:</span>
                        <strong className="text-white">{currentSelected.pspResult.roadsideInspections3YearCount}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Driver OOS Orders:</span>
                        <strong className={currentSelected.pspResult.driverOutOfServiceViolations === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {currentSelected.pspResult.driverOutOfServiceViolations}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">Awaiting PSP release authorization</p>
                  )}
                </div>
              </div>

              {/* CRYPTOGRAPHIC INTEGRITY FOOTER */}
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-emerald-400 text-[14px]">shield_locked</span>
                  <span className="text-slate-500 font-bold uppercase">SHA-256 VAULT SEAL:</span>
                  <span className="text-emerald-400 font-mono font-bold truncate">{currentSelected.merkleProofSha256}</span>
                </div>
                <span className="text-slate-500 shrink-0">Annual Renewal: {currentSelected.expiresAt}</span>
              </div>
            </div>
          )}

          {/* TAB 2: NEW INVITATION FORM */}
          {activeTab === 'NEW_INVITE' && (
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-bold">
                Commercial Driver Qualification File Screening &bull; Continuous MVR Activation
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Mobile Phone (SMS Invite)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Date of Birth (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Last 4 SSN</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={ssnLast4}
                    onChange={(e) => setSsnLast4(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Class A CDL Number</label>
                  <input
                    type="text"
                    required
                    value={cdlNumber}
                    onChange={(e) => setCdlNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">CDL Issuing State</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={cdlState}
                    onChange={(e) => setCdlState(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-white focus:border-primary outline-none"
                  />
                </div>
              </div>

              {/* Physical Residential Address (Explicit PO Box prohibition) */}
              <div className="p-3.5 rounded-2xl bg-[#0A0F14] border border-[#1E2532] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-white">Physical Residential Address</span>
                  <span className="text-[10px] text-amber-400 font-bold">NO P.O. BOX ALLOWED</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1240 Industrial Blvd"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-800 text-white focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Apt / Ste</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-800 text-white focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-800 text-white focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">State</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-800 text-white focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">ZIP Code</label>
                    <input
                      type="text"
                      required
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-800 text-white focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {addressState && cdlState && addressState.toUpperCase() !== cdlState.toUpperCase() && (
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px]">
                    ⚠️ Note: Address state ({addressState.toUpperCase()}) differs from CDL state ({cdlState.toUpperCase()}). Checkr will flag this for AAMVA CDLIS address cross-reference.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('VIEW_RADAR')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.4)] disabled:opacity-50"
                >
                  {isSubmitting ? 'DISPATCHING INVITATION...' : 'DISPATCH CHECKR INVITATION'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SCENARIOS SIMULATION MATRIX */}
          {activeTab === 'SCENARIO_SIMULATOR' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-300">
                <strong>Checkr Edge Case &amp; Statutory Scenario Simulator:</strong>
                <br />
                Work through every possible screening scenario confronted by Class A motor carriers, test address verification, portal redirect, and in-memory cache resilience.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSimulate('CLEAR')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-emerald-500/40 hover:bg-emerald-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-emerald-400 text-xs font-black">1. 100% CLEAR // FULL CDL PRIVILEGES</strong>
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Zero moving violations, clean 3-year PSP, NOT_PROHIBITED Clearinghouse status. DQF approved.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('CONSIDER')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-amber-500/40 hover:bg-amber-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-400 text-xs font-black">2. CONSIDER // SERIOUS MOVING VIOLATION</strong>
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    MVR reveals major speeding violation (&gt;15 mph) and 4 points. Triggers carrier compliance review.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('SUSPENDED_DOCUMENT_REQUIRED')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-red-500/40 hover:bg-red-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-red-400 text-xs font-black">3. SUSPENDED // DOCUMENT REQUIRED</strong>
                    <span className="material-symbols-outlined text-red-400 text-[18px]">document_scanner</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    CDL image front/back unreadable or proof of residential domicile required by Checkr.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('ERROR_ADDRESS_MISMATCH')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-orange-500/40 hover:bg-orange-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-orange-400 text-xs font-black">4. ADDRESS MISMATCH (49 CFR § 383.23)</strong>
                    <span className="material-symbols-outlined text-orange-400 text-[18px]">wrong_location</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Driver domicile address state differs from CDLIS state of record. Requires proof of relocation.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('PRE_ADVERSE_ACTION')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-rose-500/40 hover:bg-rose-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-rose-400 text-xs font-black">5. FCRA PRE-ADVERSE ACTION</strong>
                    <span className="material-symbols-outlined text-rose-400 text-[18px]">gavel</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Carrier issues statutory FCRA Pre-Adverse Notice with 5-day dispute window &amp; Summary of Rights.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('DISPUTE_FILED')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-indigo-500/40 hover:bg-indigo-500/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-indigo-400 text-xs font-black">6. FCRA DISPUTE FILED BY DRIVER</strong>
                    <span className="material-symbols-outlined text-indigo-400 text-[18px]">balance</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Driver contests MVR accuracy with Checkr. Adverse action frozen during 30-day reinvestigation.
                  </p>
                </button>

                <button
                  onClick={() => handleSimulate('EXPIRED')}
                  className="p-3 rounded-xl bg-[#0A0F14] border border-amber-600/40 hover:bg-amber-600/10 text-left cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-500 text-xs font-black">7. ANNUAL 49 CFR § 391.25 EXPIRED</strong>
                    <span className="material-symbols-outlined text-amber-500 text-[18px]">event_busy</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    12-month statutory review elapsed. Triggers prompt for annual continuous MVR refresh.
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 sm:p-4 border-t border-[#1E2532] bg-[#0A0F14] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="material-symbols-outlined text-emerald-400 text-[15px]">verified_user</span>
            <span>Checkr Partner Integration // FCRA &amp; FMCSA Accredited</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
