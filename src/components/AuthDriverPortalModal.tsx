import React, { useState, useEffect } from 'react';
import {
  DriverAuthRecord,
  DriverSignUpPayload,
  DriverRole,
  AppFunctionDefinition,
  FleetCustomizationSettings,
  UserSubscriptionRecord,
  SalesforceSyncStatus,
  SubscriptionTier,
} from '../types';
import { authDriverService } from '../services/authDriverService';
import { fleetFunctionsService } from '../services/fleetFunctionsService';
import { subscriptionEdiService, EdiCostAlternative } from '../services/subscriptionEdiService';
import { ToastVariant } from './Toast';

interface AuthDriverPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string, variant?: ToastVariant) => void;
  activeDriver: DriverAuthRecord;
  onDriverChanged: (driver: DriverAuthRecord) => void;
  fleetSettings: FleetCustomizationSettings;
  onUpdateFleetSettings: (newSettings: FleetCustomizationSettings) => void;
  initialTab?: 'signin' | 'signup' | 'roster' | 'functions' | 'subscriptions';
}

type PortalTab = 'signin' | 'signup' | 'roster' | 'functions' | 'subscriptions';

export const AuthDriverPortalModal: React.FC<AuthDriverPortalModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  activeDriver,
  onDriverChanged,
  fleetSettings,
  onUpdateFleetSettings,
  initialTab = 'roster',
}) => {
  const [currentTab, setCurrentTab] = useState<PortalTab>(initialTab);
  const [driversRoster, setDriversRoster] = useState<DriverAuthRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingFunctions, setIsSavingFunctions] = useState<boolean>(false);

  // Sign In Form State
  const [signInIdentifier, setSignInIdentifier] = useState<string>('');
  const [signInPin, setSignInPin] = useState<string>('');
  const [signInError, setSignInError] = useState<string | null>(null);

  // Sign Up Form State
  const [signUpForm, setSignUpForm] = useState<DriverSignUpPayload>({
    name: '',
    email: '',
    phone: '',
    role: 'FLEET_DRIVER',
    cdlNumber: '',
    cdlState: 'IL',
    cdlExpirationDate: '2028-06-30',
    medicalCertExp: '2027-06-30',
    assignedUnit: 'TRK-904',
    assignedTrailer: 'TRL-5321',
    carrierName: 'Morris Hive Freight LLC',
    usdotNumber: '3948210',
    fmcsaPin: '8821',
    traxxasTransponderId: 'TRAXXAS-BEACON-TX904',
    selectedFunctions: [],
  });
  const [signUpError, setSignUpError] = useState<string | null>(null);

  // Functions Matrix State
  const [functionsCatalog, setFunctionsCatalog] = useState<AppFunctionDefinition[]>([]);
  const [localFunctionToggles, setLocalFunctionToggles] = useState<Record<string, boolean>>({});

  // Subscription & Salesforce State
  const [subscriptionsList, setSubscriptionsList] = useState<UserSubscriptionRecord[]>([]);
  const [salesforceStatus, setSalesforceStatus] = useState<SalesforceSyncStatus | null>(null);
  const [selectedSubTier, setSelectedSubTier] = useState<SubscriptionTier>('FLEET_PRO');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [subPaymentMethod, setSubPaymentMethod] = useState<string>('Corporate ACH Direct •••• 4962');
  const [subWhoDriverName, setSubWhoDriverName] = useState<string>(activeDriver.name);
  const [subWhoCdl, setSubWhoCdl] = useState<string>(activeDriver.cdlNumber);
  const [subWhoCarrier, setSubWhoCarrier] = useState<string>(activeDriver.carrierName);
  const [subWhoUnit, setSubWhoUnit] = useState<string>(activeDriver.assignedUnit);
  const [subWhoEmail, setSubWhoEmail] = useState<string>(activeDriver.email);
  const [isSubmittingSub, setIsSubmittingSub] = useState<boolean>(false);
  const [isSyncingSalesforce, setIsSyncingSalesforce] = useState<boolean>(false);
  const [ediAlternatives, setEdiAlternatives] = useState<EdiCostAlternative[]>([]);
  const [showAlternativesModal, setShowAlternativesModal] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentTab(initialTab);
      loadRoster();
      loadFunctions();
      loadSubscriptions();
      loadEdiAlternatives();
      setSubWhoDriverName(activeDriver.name);
      setSubWhoCdl(activeDriver.cdlNumber);
      setSubWhoCarrier(activeDriver.carrierName);
      setSubWhoUnit(activeDriver.assignedUnit);
      setSubWhoEmail(activeDriver.email);
    }
  }, [isOpen, initialTab, activeDriver]);

  const loadSubscriptions = async () => {
    try {
      const data = await subscriptionEdiService.getSubscriptions();
      setSubscriptionsList(data.subscriptions || []);
      setSalesforceStatus(data.salesforceStatus || null);
    } catch (e) {
      console.warn('Failed loading subscriptions:', e);
    }
  };

  const loadEdiAlternatives = async () => {
    try {
      const data = await subscriptionEdiService.getEdiAlternatives();
      setEdiAlternatives(data.alternatives || []);
    } catch (e) {
      console.warn('Failed loading EDI alternatives:', e);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSub(true);
    try {
      const res = await subscriptionEdiService.createSubscription({
        userId: activeDriver.driverId || `drv-${Date.now()}`,
        driverName: subWhoDriverName || activeDriver.name,
        email: subWhoEmail || activeDriver.email,
        phone: activeDriver.phone,
        cdlNumber: subWhoCdl || activeDriver.cdlNumber,
        cdlState: activeDriver.cdlState,
        carrierName: subWhoCarrier || activeDriver.carrierName,
        usdotNumber: activeDriver.usdotNumber,
        assignedUnit: subWhoUnit || activeDriver.assignedUnit,
        tier: selectedSubTier,
        billingCycle: selectedBillingCycle,
        paymentMethod: subPaymentMethod,
      });

      await loadSubscriptions();
      onShowToast(
        `SUBSCRIPTION ATTESTED TO SALESFORCE // WHO: ${res.subscription.who.driverName} | HOW MUCH: $${res.subscription.howMuch.amountUsd} (${selectedBillingCycle})`,
        'verified',
        'success'
      );
    } catch (err: any) {
      onShowToast(err.message || 'Subscription enrollment failed.', 'error', 'error');
    }
    setIsSubmittingSub(false);
  };

  const handleSyncSalesforce = async () => {
    setIsSyncingSalesforce(true);
    try {
      const result = await subscriptionEdiService.syncSalesforceQueue();
      setSalesforceStatus(result.salesforceStatus);
      await loadSubscriptions();
      onShowToast(
        `SALESFORCE QUEUE FLUSHED: ${result.flushed.processed} SOBJECTS ATTESTED`,
        'cloud_sync',
        'success'
      );
    } catch (err: any) {
      onShowToast(err.message || 'Salesforce flush failed.', 'error', 'error');
    }
    setIsSyncingSalesforce(false);
  };

  const loadRoster = async () => {
    setIsLoading(true);
    try {
      const roster = await authDriverService.getAllDrivers();
      setDriversRoster(roster);
    } catch (e) {
      console.warn('Failed loading drivers:', e);
    }
    setIsLoading(false);
  };

  const loadFunctions = async () => {
    try {
      const catalog = await fleetFunctionsService.fetchCatalog();
      setFunctionsCatalog(catalog);
      const initialMap: Record<string, boolean> = {};
      catalog.forEach((fn) => {
        initialMap[fn.id] = fn.id === 'the-g-o-a-t-' ? false : fn.enabled;
      });
      // also overlay with current fleetSettings if present
      if (fleetSettings.enabledModules) {
        Object.entries(fleetSettings.enabledModules).forEach(([k, v]) => {
          if (k !== 'the-g-o-a-t-') {
            initialMap[k] = Boolean(v);
          }
        });
      }
      setLocalFunctionToggles(initialMap);
    } catch (e) {
      console.warn('Failed loading functions catalog:', e);
    }
  };

  if (!isOpen) return null;

  // Handle Driver Sign-In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setIsLoading(true);
    try {
      const result = await authDriverService.signin({
        identifier: signInIdentifier || activeDriver.cdlNumber,
        fmcsaPin: signInPin || undefined,
      });
      onDriverChanged(result.driver);
      onShowToast(`SIGNED IN AS ${result.driver.name.toUpperCase()} (CDL ${result.driver.cdlNumber})`, 'verified', 'success');
      onClose();
    } catch (err: any) {
      const displayMsg = err.userMessage || err.message || 'Driver Sign-In failed.';
      setSignInError(displayMsg);
      onShowToast(displayMsg, 'warning', 'warning');
    }
    setIsLoading(false);
  };

  // Handle Driver Sign-Up Sheet Submit
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError(null);
    if (!signUpForm.name.trim()) {
      setSignUpError('Full driver name is required.');
      return;
    }
    if (!signUpForm.cdlNumber.trim()) {
      setSignUpError('Commercial Driver License (CDL) number is required.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authDriverService.signup({
        ...signUpForm,
        selectedFunctions: Object.entries(localFunctionToggles)
          .filter(([_, v]) => v)
          .map(([k]) => k),
      });

      onDriverChanged(result.driver);
      await loadRoster();
      onShowToast(`NEW DRIVER REGISTERED & SIGNED IN: ${result.driver.name}`, 'person_add', 'success');
      onClose();
    } catch (err: any) {
      const displayMsg = err.userMessage || err.message || 'Registration failed.';
      setSignUpError(displayMsg);
      onShowToast(displayMsg, 'warning', 'warning');
    }
    setIsLoading(false);
  };

  // Select driver from roster
  const handleSelectDriver = async (driverId: string) => {
    setIsLoading(true);
    try {
      const selected = await authDriverService.selectDriver(driverId);
      onDriverChanged(selected);
      onShowToast(`ACTIVE DRIVER SWITCHED TO: ${selected.name.toUpperCase()}`, 'badge');
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Could not select driver.', 'error');
    }
    setIsLoading(false);
  };

  // Toggle Function In / Out
  const handleToggleFunction = (id: string) => {
    if (id === 'the-g-o-a-t-') return; // permanently disabled
    setLocalFunctionToggles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Save Function Toggles to Backend
  const handleSaveFunctions = async () => {
    setIsSavingFunctions(true);
    try {
      // Close out in the backend
      const result = await fleetFunctionsService.updateToggles(localFunctionToggles);

      // Update fleet settings in parent
      const updatedEnabledModules: Partial<Record<string, boolean>> = {
        ...fleetSettings.enabledModules,
        ...localFunctionToggles,
        'the-g-o-a-t-': false,
      };
      onUpdateFleetSettings({
        ...fleetSettings,
        enabledModules: updatedEnabledModules as any,
      });

      onShowToast(
        `FUNCTIONS PERSISTED TO BACKEND: ${result.activeFunctions.length} ACTIVE // ${result.disabledFunctions.length} EXCLUDED`,
        'tune'
      );
      onClose();
    } catch (err) {
      onShowToast('FUNCTIONS UPDATED LOCALLY', 'check_circle');
      onClose();
    }
    setIsSavingFunctions(false);
  };

  const activeFunctionsCount = Object.values(localFunctionToggles).filter(Boolean).length;
  const disabledFunctionsCount = functionsCatalog.length - activeFunctionsCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in font-mono">
      <div className="bg-[#0A0F14] border-2 border-[#FFE500]/40 rounded-2xl w-full max-w-3xl my-auto shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 bg-[#05080E] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE500] text-black flex items-center justify-center font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-[#FFE500] uppercase tracking-wider">
                  TRUCKWITHEASE ENTERPRISE
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  ✔ VERIFIED SUITE
                </span>
              </div>
              <h2 className="text-[16px] sm:text-[18px] font-black text-white uppercase tracking-tight">
                Driver Authentication, Roster &amp; Function Manager
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 bg-[#070B10] border-b border-white/10 text-[11px] font-bold uppercase">
          <button
            onClick={() => setCurrentTab('roster')}
            className={`py-3 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              currentTab === 'roster'
                ? 'border-[#FFE500] text-[#FFE500] bg-[#FFE500]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            <span>Roster ({driversRoster.length})</span>
          </button>

          <button
            onClick={() => setCurrentTab('functions')}
            className={`py-3 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              currentTab === 'functions'
                ? 'border-[#FFE500] text-[#FFE500] bg-[#FFE500]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Functions ({activeFunctionsCount})</span>
          </button>

          <button
            onClick={() => setCurrentTab('subscriptions')}
            className={`py-3 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              currentTab === 'subscriptions'
                ? 'border-[#FFE500] text-[#FFE500] bg-[#FFE500]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
            <span>Subscriptions &amp; Salesforce</span>
          </button>

          <button
            onClick={() => setCurrentTab('signup')}
            className={`py-3 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              currentTab === 'signup'
                ? 'border-[#FFE500] text-[#FFE500] bg-[#FFE500]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>Sign-Up Sheet</span>
          </button>

          <button
            onClick={() => setCurrentTab('signin')}
            className={`py-3 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              currentTab === 'signin'
                ? 'border-[#FFE500] text-[#FFE500] bg-[#FFE500]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">login</span>
            <span>Driver Sign In</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: SELECT ALL DRIVERS (FLEET ROSTER) */}
          {currentTab === 'roster' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">
                    Commercial Driver Fleet Roster
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Select active driver profile for cockpit HUD, HOS duty clocks, Traxxas telemetry &amp; DVIR sign-offs.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('signup')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FFE500]/20 text-[#FFE500] border border-[#FFE500]/40 text-[10px] font-bold uppercase hover:bg-[#FFE500]/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  <span>Add Driver</span>
                </button>
              </div>

              {/* Active Driver Callout */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-[#0F1720] to-[#0A0F14] border border-[#FFE500]/50 flex items-center justify-between shadow-[0_0_20px_rgba(255,229,0,0.1)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center text-[13px]">
                    {activeDriver.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-[#FFE500] uppercase">ACTIVE IN-CAB COCKPIT</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <span className="text-[14px] font-bold text-white block leading-tight">{activeDriver.name}</span>
                    <span className="text-[10px] text-slate-400">
                      CDL: <strong className="text-white">{activeDriver.cdlNumber}</strong> ({activeDriver.cdlState}) &bull; Unit: {activeDriver.assignedUnit} &bull; Traxxas: {activeDriver.traxxasTransponderId || 'TX904'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    {activeDriver.activeDutyStatus === 'D' ? 'DRIVING (D)' : activeDriver.activeDutyStatus}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-1">DQF: {activeDriver.dqfStatus}</span>
                </div>
              </div>

              {/* Roster Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  ALL REGISTERED FLEET DRIVERS ({driversRoster.length})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {driversRoster.map((driver) => {
                    const isCurrent = driver.driverId === activeDriver.driverId;
                    return (
                      <div
                        key={driver.driverId}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                          isCurrent
                            ? 'bg-[#FFE500]/10 border-[#FFE500] shadow-[0_0_15px_rgba(255,229,0,0.2)]'
                            : 'bg-[#070B10] border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                              isCurrent ? 'bg-[#FFE500] text-black font-black' : 'bg-white/10 text-slate-300'
                            }`}>
                              {driver.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <span className="text-[12px] font-bold text-white block leading-tight">{driver.name}</span>
                              <span className="text-[9px] text-slate-400 block">{driver.role.replace('_', ' ')} &bull; {driver.assignedUnit}</span>
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                            driver.dqfStatus === 'FULLY_COMPLIANT'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {driver.dqfStatus === 'FULLY_COMPLIANT' ? 'DQF OK' : 'EXPIRING'}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 space-y-0.5 border-t border-white/5 pt-1.5">
                          <div className="flex justify-between">
                            <span>CDL Number:</span>
                            <span className="text-white font-bold">{driver.cdlNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Traxxas Beacon:</span>
                            <span className="text-emerald-400">{driver.traxxasTransponderId || 'TX904'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Medical Exp:</span>
                            <span className="text-slate-300">{driver.medicalCertExp || '2026-11-30'}</span>
                          </div>
                        </div>

                        {isCurrent ? (
                          <div className="py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold text-center uppercase">
                            ✔ Active Cockpit Profile
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSelectDriver(driver.driverId)}
                            disabled={isLoading}
                            className="w-full py-1.5 px-3 rounded-lg bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            Select as Active Driver
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHOOSE FUNCTIONS (WHAT YOU WANT / WHAT YOU DON'T WANT) */}
          {currentTab === 'functions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">
                    Choose What Functions You Want &amp; What You Don't Want
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Toggle individual modules to customize cockpit HUD, telematics, HRE route sentinels &amp; compliance suites.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE500]/20 text-[#FFE500] border border-[#FFE500]/40">
                    {activeFunctionsCount} ACTIVE
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-400 border border-white/10">
                    {disabledFunctionsCount} DISABLED
                  </span>
                </div>
              </div>

              {/* Quick Batch Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allOn: Record<string, boolean> = {};
                    functionsCatalog.forEach((f) => {
                      allOn[f.id] = f.id !== 'the-g-o-a-t-';
                    });
                    setLocalFunctionToggles(allOn);
                  }}
                  className="px-2.5 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold uppercase hover:bg-white/20 transition-all cursor-pointer"
                >
                  Enable All Functions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec: Record<string, boolean> = {
                      'night-hud': true,
                      'hos-clocks': true,
                      'radar-54b': true,
                      'master-mechanic': true,
                      'hre': true,
                      'traxxas': true,
                      'dispatch-eta': true,
                    };
                    functionsCatalog.forEach((f) => {
                      if (!rec[f.id]) rec[f.id] = false;
                    });
                    setLocalFunctionToggles(rec);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#FFE500]/20 text-[#FFE500] border border-[#FFE500]/40 text-[10px] font-bold uppercase hover:bg-[#FFE500]/30 transition-all cursor-pointer"
                >
                  Recommended Trucking Suite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allOff: Record<string, boolean> = {};
                    functionsCatalog.forEach((f) => {
                      allOff[f.id] = f.isCore;
                    });
                    setLocalFunctionToggles(allOff);
                  }}
                  className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-[10px] font-bold uppercase hover:bg-white/10 transition-all cursor-pointer"
                >
                  Core Only (Disable Non-Essential)
                </button>
              </div>

              {/* Function Cards Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {functionsCatalog.map((fn) => {
                  const isEnabled = Boolean(localFunctionToggles[fn.id]);
                  const isGoat = fn.id === 'the-g-o-a-t-';
                  return (
                    <div
                      key={fn.id}
                      onClick={() => !isGoat && handleToggleFunction(fn.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isGoat
                          ? 'opacity-40 bg-black border-red-500/20 cursor-not-allowed'
                          : isEnabled
                          ? 'bg-[#FFE500]/10 border-[#FFE500]/60 text-white shadow-[0_0_15px_rgba(255,229,0,0.15)]'
                          : 'bg-[#070B10] border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isEnabled ? 'bg-[#FFE500] text-black' : 'bg-white/10 text-slate-400'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{fn.icon}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-bold text-white block leading-tight">{fn.name}</span>
                            {fn.badge && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-white/10 text-slate-300">
                                {fn.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 block mt-0.5 leading-snug">{fn.description}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mt-1">
                            CATEGORY: {fn.category.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          isGoat
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isEnabled
                            ? 'bg-[#FFE500] text-black shadow-[0_0_10px_rgba(255,229,0,0.4)]'
                            : 'bg-white/10 text-slate-400'
                        }`}>
                          {isGoat ? 'PERMANENTLY OFF' : isEnabled ? 'WANT (ACTIVE)' : 'DON\'T WANT (OFF)'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Close Out Backend CTA */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleSaveFunctions}
                  disabled={isSavingFunctions}
                  className="w-full py-3 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[12px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>
                    {isSavingFunctions ? 'Closing Out In Backend...' : 'Apply & Close Out In Backend'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: SUBSCRIPTIONS & SALESFORCE ENTERPRISE CRM */}
          {currentTab === 'subscriptions' && (
            <div className="space-y-4">
              {/* Top Banner: Salesforce CRM Connection State */}
              <div className="p-3 bg-[#05080E] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${salesforceStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-white uppercase tracking-wider">
                        {salesforceStatus?.connected ? 'Salesforce Enterprise CRM Connected' : 'Certified Local Audit Ledger (Zero-Loss)'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {salesforceStatus?.environment || 'FALLBACK_LOCAL_LEDGER'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Instance: <span className="text-slate-300">{salesforceStatus?.instanceUrl || 'https://morrishive.my.salesforce.com'}</span> &bull; Synced: <span className="text-[#FFE500] font-bold">{salesforceStatus?.totalSynced || subscriptionsList.length} SObjects</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAlternativesModal(!showAlternativesModal)}
                    className="py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">alt_route</span>
                    <span>Cost Alternatives</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncSalesforce}
                    disabled={isSyncingSalesforce}
                    className="py-1.5 px-3 rounded-lg bg-[#FFE500] hover:bg-[#FFDF00] text-black text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-[0_0_12px_rgba(255,229,0,0.3)] disabled:opacity-50 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">cloud_sync</span>
                    <span>{isSyncingSalesforce ? 'Syncing...' : 'Sync Salesforce'}</span>
                  </button>
                </div>
              </div>

              {/* 4 Cost Alternatives Drawer if toggled */}
              {showAlternativesModal && (
                <div className="p-4 rounded-xl bg-[#0F1722] border border-[#FFE500]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#FFE500]">savings</span>
                      <h4 className="text-[12px] font-bold text-[#FFE500] uppercase tracking-wider">
                        4 Zero-Cost API Alternatives (Minimizing App Overhead)
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowAlternativesModal(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    {ediAlternatives.map((alt) => (
                      <div key={alt.optionNumber} className="p-3 rounded-lg bg-[#070B10] border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#FFE500]/20 text-[#FFE500] font-black">
                            OPTION {alt.optionNumber}
                          </span>
                          <span className="text-[9px] text-emerald-400 font-bold">{alt.industryStandard}</span>
                        </div>
                        <h5 className="font-bold text-white text-[12px]">{alt.title}</h5>
                        <p className="text-slate-300 text-[10px]">{alt.mechanism}</p>
                        <div className="text-[10px] text-amber-300 font-medium">
                          ✔ Cost Impact: {alt.costComparison}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Driver Who / Time / How Much Summary */}
              <div className="p-3 rounded-xl bg-[#05080E] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Active Commercial Driver (Who)</div>
                  <div className="font-bold text-white">{activeDriver.name} &bull; {activeDriver.cdlNumber}</div>
                  <div className="text-[10px] text-slate-400">{activeDriver.carrierName} (Unit {activeDriver.assignedUnit})</div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Current Subscription Tier (How Much)</div>
                  <div className="text-[#FFE500] font-bold">Fleet Master Commander ($99.00/mo)</div>
                  <div className="text-[10px] text-slate-400">Attested SObject Opp: 0068b000015ZmorrisAA</div>
                </div>

                <div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Enrollment Cycle (Time)</div>
                  <div className="text-emerald-400 font-bold">Active &bull; Renews 2026-11-18</div>
                  <div className="text-[10px] text-slate-400">Payment: Corporate ACH Direct</div>
                </div>
              </div>

              {/* Subscription Enrollment Form: WHO, TIME, HOW MUCH */}
              <form onSubmit={handleCreateSubscription} className="p-4 rounded-xl bg-[#070B10] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FFE500]">card_membership</span>
                    <h4 className="text-[12px] font-bold text-white uppercase tracking-wider">
                      Commercial Driver Subscription &amp; Salesforce Attestation
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    SObject: Opportunity // Stage: Closed Won
                  </span>
                </div>

                {/* Tier Selection (HOW MUCH) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">
                      Select Subscription Tier (How Much)
                    </label>
                    {/* Billing Cycle Toggle */}
                    <div className="flex items-center gap-1 bg-[#05080E] p-0.5 rounded-lg border border-white/10 text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => setSelectedBillingCycle('MONTHLY')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition ${selectedBillingCycle === 'MONTHLY' ? 'bg-[#FFE500] text-black font-black' : 'text-slate-400 hover:text-white'}`}
                      >
                        MONTHLY
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBillingCycle('ANNUAL')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition ${selectedBillingCycle === 'ANNUAL' ? 'bg-[#FFE500] text-black font-black' : 'text-slate-400 hover:text-white'}`}
                      >
                        ANNUAL (2 MO FREE)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Tier 1: SOLO OWNER OPERATOR */}
                    <div
                      onClick={() => setSelectedSubTier('SOLO_OWNER_OPERATOR')}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        selectedSubTier === 'SOLO_OWNER_OPERATOR'
                          ? 'border-[#FFE500] bg-[#FFE500]/10 shadow-[0_0_15px_rgba(255,229,0,0.2)]'
                          : 'border-white/10 bg-[#0A0F14] hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Tier 1</span>
                          <span className="material-symbols-outlined text-[16px] text-[#FFE500]">local_shipping</span>
                        </div>
                        <div className="text-[12px] font-bold text-white uppercase">Solo Owner-Op</div>
                        <div className="text-[18px] font-black text-[#FFE500] mt-1">
                          {selectedBillingCycle === 'ANNUAL' ? '$490' : '$49'}
                          <span className="text-[10px] text-slate-400 font-normal">/{selectedBillingCycle === 'ANNUAL' ? 'yr' : 'mo'}</span>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-2 space-y-0.5">
                        <div>✔ Single Cab Cockpit</div>
                        <div>✔ FHWA 54B Bridge Radar</div>
                        <div>✔ J1939 Master Mechanic</div>
                      </div>
                    </div>

                    {/* Tier 2: FLEET PRO (RECOMMENDED) */}
                    <div
                      onClick={() => setSelectedSubTier('FLEET_PRO')}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between relative overflow-hidden ${
                        selectedSubTier === 'FLEET_PRO'
                          ? 'border-[#FFE500] bg-[#FFE500]/15 shadow-[0_0_20px_rgba(255,229,0,0.3)]'
                          : 'border-white/10 bg-[#0A0F14] hover:border-white/25'
                      }`}
                    >
                      <div className="absolute top-0 right-0 bg-[#FFE500] text-black text-[8px] font-black px-1.5 py-0.5 uppercase tracking-wider rounded-bl">
                        POPULAR
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Tier 2</span>
                          <span className="material-symbols-outlined text-[16px] text-[#FFE500]">shield</span>
                        </div>
                        <div className="text-[12px] font-bold text-white uppercase">Fleet Commander</div>
                        <div className="text-[18px] font-black text-[#FFE500] mt-1">
                          {selectedBillingCycle === 'ANNUAL' ? '$990' : '$99'}
                          <span className="text-[10px] text-slate-400 font-normal">/{selectedBillingCycle === 'ANNUAL' ? 'yr' : 'mo'}</span>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-2 space-y-0.5">
                        <div>✔ All Tier 1 Capabilities</div>
                        <div>✔ Dispatch Zero $/Hr Yield</div>
                        <div>✔ Live Salesforce Sync</div>
                        <div>✔ EDI 204/214/210 Mailbox</div>
                      </div>
                    </div>

                    {/* Tier 3: ENTERPRISE COMMAND */}
                    <div
                      onClick={() => setSelectedSubTier('ENTERPRISE_COMMAND')}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        selectedSubTier === 'ENTERPRISE_COMMAND'
                          ? 'border-[#FFE500] bg-[#FFE500]/10 shadow-[0_0_15px_rgba(255,229,0,0.2)]'
                          : 'border-white/10 bg-[#0A0F14] hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Tier 3</span>
                          <span className="material-symbols-outlined text-[16px] text-[#FFE500]">domain</span>
                        </div>
                        <div className="text-[12px] font-bold text-white uppercase">Carrier Unlimited</div>
                        <div className="text-[18px] font-black text-[#FFE500] mt-1">
                          {selectedBillingCycle === 'ANNUAL' ? '$2,490' : '$249'}
                          <span className="text-[10px] text-slate-400 font-normal">/{selectedBillingCycle === 'ANNUAL' ? 'yr' : 'mo'}</span>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-2 space-y-0.5">
                        <div>✔ Unlimited Fleet Drivers</div>
                        <div>✔ Custom Webhook Streaming</div>
                        <div>✔ Dedicated AS2 / SFTP Tunnel</div>
                        <div>✔ 49 CFR § 396.11 Audit Defense</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* WHO & TIME Input Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Who: Driver Name
                    </label>
                    <input
                      type="text"
                      required
                      value={subWhoDriverName}
                      onChange={(e) => setSubWhoDriverName(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Who: CDL Number
                    </label>
                    <input
                      type="text"
                      required
                      value={subWhoCdl}
                      onChange={(e) => setSubWhoCdl(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Who: Carrier USDOT
                    </label>
                    <input
                      type="text"
                      value={subWhoCarrier}
                      onChange={(e) => setSubWhoCarrier(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Who: Email (Salesforce SObject Contact)
                    </label>
                    <input
                      type="email"
                      required
                      value={subWhoEmail}
                      onChange={(e) => setSubWhoEmail(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Who: Assigned Unit
                    </label>
                    <input
                      type="text"
                      value={subWhoUnit}
                      onChange={(e) => setSubWhoUnit(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      How Much: Payment Method
                    </label>
                    <input
                      type="text"
                      value={subPaymentMethod}
                      onChange={(e) => setSubPaymentMethod(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[#05080E] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmittingSub}
                  className="w-full py-3 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[12px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{isSubmittingSub ? 'Attesting to Salesforce...' : 'Enroll & Attest Subscription to Salesforce'}</span>
                </button>
              </form>

              {/* Subscriptions Table / Ledger (WHO, TIME, HOW MUCH) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#FFE500] text-[16px]">receipt_long</span>
                    <span>Salesforce Tamper-Evident Subscription Ledger ({subscriptionsList.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    SHA-256 Merkle Certified
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#070B10]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#05080E] border-b border-white/10 text-slate-400 uppercase text-[9px] font-bold">
                      <tr>
                        <th className="p-2.5">WHO (Driver / CDL)</th>
                        <th className="p-2.5">TIME (Enrolled / Cycle)</th>
                        <th className="p-2.5">HOW MUCH (Rate / Tier)</th>
                        <th className="p-2.5">SALESFORCE STATUS</th>
                        <th className="p-2.5">SOBJECT &amp; AUDIT HASH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {subscriptionsList.map((sub) => (
                        <tr key={sub.id} className="hover:bg-white/5 transition">
                          <td className="p-2.5">
                            <div className="font-bold text-white">{sub.who.driverName}</div>
                            <div className="text-[10px] text-slate-400">{sub.who.cdlNumber} &bull; {sub.who.assignedUnit}</div>
                            <div className="text-[9px] text-slate-500">{sub.who.carrierName}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="text-slate-200">{sub.time.formattedTime}</div>
                            <div className="text-[9px] text-emerald-400 font-bold">{sub.time.billingCycle}</div>
                            <div className="text-[9px] text-slate-500">Exp: {sub.time.expiresAt.split('T')[0]}</div>
                          </td>
                          <td className="p-2.5">
                            <div className="text-[13px] font-black text-[#FFE500]">${sub.howMuch.amountUsd.toFixed(2)}</div>
                            <div className="text-[9px] text-slate-300 font-sans">{sub.howMuch.tierName}</div>
                            <div className="text-[8px] text-slate-500">{sub.howMuch.paymentMethod}</div>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              sub.salesforce.status === 'SYNCED'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}>
                              {sub.salesforce.status === 'SYNCED' ? '✔ SALESFORCE SYNCED' : 'QUEUED / FALLBACK'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="text-[10px] text-slate-300">
                              Opp: {sub.salesforce.salesforceOpportunityId || 'Pending'}
                            </div>
                            <div className="text-[8px] text-slate-500 truncate max-w-[120px]" title={sub.salesforce.auditLedgerHash}>
                              Hash: {sub.salesforce.auditLedgerHash.slice(0, 12)}...
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIGN-UP SHEET (REGISTER NEW DRIVER) */}
          {currentTab === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div>
                <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">
                  Driver Sign-Up Sheet &amp; Fleet Registration
                </h3>
                <p className="text-[10px] text-slate-400">
                  Enroll a new commercial driver into the fleet roster, bind Traxxas telemetry &amp; assign functions.
                </p>
              </div>

              {signUpError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-500 text-red-200 text-[11px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-red-400">error</span>
                  <span>{signUpError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Full Driver Name *</label>
                  <input
                    type="text"
                    required
                    value={signUpForm.name}
                    onChange={(e) => setSignUpForm({ ...signUpForm, name: e.target.value })}
                    placeholder="e.g. Vance Reynolds"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Driver Role</label>
                  <select
                    value={signUpForm.role}
                    onChange={(e) => setSignUpForm({ ...signUpForm, role: e.target.value as DriverRole })}
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  >
                    <option value="OWNER_OPERATOR">Owner-Operator</option>
                    <option value="FLEET_DRIVER">Fleet Driver</option>
                    <option value="SAFETY_DISPATCHER">Safety Dispatcher</option>
                    <option value="MASTER_MECHANIC">The Master Mechanic</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">CDL License Number *</label>
                  <input
                    type="text"
                    required
                    value={signUpForm.cdlNumber}
                    onChange={(e) => setSignUpForm({ ...signUpForm, cdlNumber: e.target.value })}
                    placeholder="e.g. IL-CDL-4910291"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">CDL Licensing State</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={signUpForm.cdlState}
                    onChange={(e) => setSignUpForm({ ...signUpForm, cdlState: e.target.value.toUpperCase() })}
                    placeholder="IL"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    placeholder="driver@morrishive.com"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={signUpForm.phone}
                    onChange={(e) => setSignUpForm({ ...signUpForm, phone: e.target.value })}
                    placeholder="(555) 234-5678"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Assigned Power Unit (Tractor)</label>
                  <input
                    type="text"
                    value={signUpForm.assignedUnit}
                    onChange={(e) => setSignUpForm({ ...signUpForm, assignedUnit: e.target.value })}
                    placeholder="TRK-904"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Traxxas Beacon ID (10Hz)</label>
                  <input
                    type="text"
                    value={signUpForm.traxxasTransponderId}
                    onChange={(e) => setSignUpForm({ ...signUpForm, traxxasTransponderId: e.target.value })}
                    placeholder="TRAXXAS-BEACON-TX904"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">FMCSA Roadside PIN (4-digit)</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={signUpForm.fmcsaPin}
                    onChange={(e) => setSignUpForm({ ...signUpForm, fmcsaPin: e.target.value })}
                    placeholder="8821"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Medical Card Expiry</label>
                  <input
                    type="date"
                    value={signUpForm.medicalCertExp}
                    onChange={(e) => setSignUpForm({ ...signUpForm, medicalCertExp: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[12px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Registering Driver...' : 'Complete Sign-Up Sheet & Sign In Driver'}
              </button>
            </form>
          )}

          {/* TAB 4: DRIVER SIGN IN */}
          {currentTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4 max-w-md mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-xl bg-[#FFE500] text-black font-black mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(255,229,0,0.4)]">
                  <span className="material-symbols-outlined text-[28px]">lock_open</span>
                </div>
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">
                  Driver Sign-In Portal
                </h3>
                <p className="text-[10px] text-slate-400">
                  Authenticate your commercial driver profile with Name, CDL, or 4-digit Roadside PIN.
                </p>
              </div>

              {signInError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-500 text-red-200 text-[11px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-red-400">error</span>
                  <span>{signInError}</span>
                </div>
              )}

              <div className="space-y-3 text-[11px]">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Driver Name, CDL, or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    placeholder="e.g. Jeremiah J. Morris or IL-CDL-98104820"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    FMCSA Roadside PIN (Optional)
                  </label>
                  <input
                    type="password"
                    value={signInPin}
                    onChange={(e) => setSignInPin(e.target.value)}
                    placeholder="e.g. 8821"
                    className="w-full p-2.5 rounded-lg bg-[#070B10] border border-white/15 text-white focus:border-[#FFE500] outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[12px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Authenticating...' : 'Sign In Commercial Driver'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentTab('signup')}
                  className="text-[10px] text-[#FFE500] hover:underline cursor-pointer"
                >
                  Need to enroll? Open the Sign-Up Sheet &rarr;
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 bg-[#05080E] border-t border-white/10 flex flex-wrap items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">HRE &amp; Traxxas Linked</span>
            <span>&bull;</span>
            <span>Carrier: {activeDriver.carrierName}</span>
            <span>&bull;</span>
            <span>USDOT #{activeDriver.usdotNumber}</span>
          </div>
          <div>
            <span>49 CFR § 395.8 &amp; § 390.31 Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
