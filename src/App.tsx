/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { TabId, InspectionLogEntry, InspectionActionType, InspectionTriggerSource } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Toast } from './components/Toast';
import { PrivacyLockModal } from './components/PrivacyLockModal';
import { InspectionPdfModal } from './components/InspectionPdfModal';
import { DriverProfileModal } from './components/DriverProfileModal';
import { EmergencyModal } from './components/EmergencyModal';
import { VoiceCommandOverlay } from './components/VoiceCommandOverlay';
import { RestAreaAlertModal } from './components/RestAreaAlertModal';
import { EnterpriseSidebar } from './components/EnterpriseSidebar';
import { useVoiceControl } from './hooks/useVoiceControl';
import { useAlertnessTracker } from './hooks/useAlertnessTracker';

import { NightHudScreen } from './components/screens/NightHudScreen';
import { HosClocksScreen } from './components/screens/HosClocksScreen';
import { Radar54bScreen } from './components/screens/Radar54bScreen';
import { MasterMechanicScreen } from './components/screens/MasterMechanicScreen';
import { HapticsScreen } from './components/screens/HapticsScreen';
import { EcosystemTrustHubScreen } from './components/screens/EcosystemTrustHubScreen';
import { SecurityVaultScreen } from './components/screens/SecurityVaultScreen';
import { DispatchEtaScreen } from './components/screens/DispatchEtaScreen';
import { MasterSynchronizerScreen } from './components/screens/MasterSynchronizerScreen';
import { FleetExpensesInvoiceScreen } from './components/screens/FleetExpensesInvoiceScreen';
import { TripPlannerScreen } from './components/screens/TripPlannerScreen';
import { RouteDispatchHub } from './components/screens/RouteDispatchHub';
import { SignupScreen } from './components/screens/SignupScreen';
import { MessagesScreen } from './components/screens/MessagesScreen';
import { LandingScreen } from './components/entry/LandingScreen';
import { SignInScreen } from './components/entry/SignInScreen';
import { authenticatedFetch } from './services/firebaseClientAuth';
import { FleetOperationsHub } from './components/screens/FleetOperationsHub';
import { FleetModuleCustomizer } from './components/FleetModuleCustomizer';
// Deployment modals removed from driver app build
import { AuthLoginModal } from './components/AuthLoginModal';
import { clientAuth } from './services/firebaseClientAuth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { memoryPerformanceService } from './services/memoryPerformanceService';
import { FleetCustomizationSettings } from './types';
import {
  ENABLE_UNVERIFIED_HOS_CLOCKS,
  ENABLE_TELEMETRY_SCREEN,
  ENABLE_HAPTICS_SCREEN,
  ENABLE_MASTER_SYNC,
  ENABLE_RADAR_54B,
  FEATURE_FLAGS,
} from './config/featureFlags';
import { apiClient, registerApiAuthHandlers } from './services/apiClient';

const DEFAULT_FLEET_SETTINGS: FleetCustomizationSettings = {
  speedAlertToleranceMph: 5,
  brakeThermalWarningTempF: 450,
  vehicleHeightFt: 13.5,
  defaultStartTab: 'night-hud',
  autoStateBoundaryAlerts: true,
  voiceControlEnabled: true,
  enabledModules: {
    'master-sync': ENABLE_MASTER_SYNC,
    'night-hud': true,
    'dispatch-eta': true,
    'vault': true,
    'fleet-expenses': true,
    'hos-clocks': ENABLE_UNVERIFIED_HOS_CLOCKS,
    'radar-54b': ENABLE_RADAR_54B,
    'trip-planner': true,
    'master-mechanic': true,
    'haptics': ENABLE_HAPTICS_SCREEN,
    'ecosystem': FEATURE_FLAGS.ENABLE_THIRD_PARTY_PARTNERS,
    'telemetry': ENABLE_TELEMETRY_SCREEN,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const paramTab = urlParams.get('tab') as TabId;
      if (paramTab) return paramTab;
      const hashTab = window.location.hash.replace('#', '') as TabId;
      if (hashTab) return hashTab;
    }
    return 'night-hud';
  });
  const [speed, setSpeed] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('verified_user');
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  // Entry flow: landing -> sign in / sign up -> plan -> app.
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [accountGate, setAccountGate] = useState<'checking' | 'needs_plan' | 'ready' | 'offline'>('checking');
  const [entryView, setEntryView] = useState<'landing' | 'signin' | 'signup'>(() => {
    if (typeof window === 'undefined') return 'landing';
    const p = new URLSearchParams(window.location.search);
    return p.get('tab') === 'signup' || p.get('checkout') ? 'signup' : 'landing';
  });
  const [gateCheck, setGateCheck] = useState<number>(0);
  const [driverProfile, setDriverProfile] = useState<{ name?: string; cdlNumber?: string } | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ carrierName?: string; usdotNumber?: string; tenantId?: string } | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setDriverProfile(null);
      setTenantInfo(null);
      return;
    }
    apiClient.get('/api/driver/profile')
      .then((res) => {
        if (res?.profile) setDriverProfile(res.profile);
      })
      .catch(() => {});

    apiClient.get('/api/auth/tenant')
      .then((res) => {
        if (res?.tenant) setTenantInfo(res.tenant);
      })
      .catch(() => {});
  }, [firebaseUser]);

  // Register API Client 401 & 429 Handlers
  useEffect(() => {
    registerApiAuthHandlers({
      onUnauthorized: () => {
        setIsAuthModalOpen(true);
      },
      onRateLimited: (message) => {
        showToast(message, 'warning');
      },
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setAccountGate('checking');
      return;
    }
    let cancelled = false;
    setAccountGate('checking');
    authenticatedFetch('/api/billing/subscription')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setAccountGate(res.status === 401 || res.status === 403 ? 'needs_plan' : 'offline');
          return;
        }
        const d = await res.json();
        // Anyone attached to a fleet (paid, trial, or added by their fleet admin) goes into the app.
        setAccountGate(d?.user?.fleetId ? 'ready' : 'needs_plan');
      })
      .catch(() => !cancelled && setAccountGate('offline'));
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, gateCheck]);

  // Synchronize Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fleet Customization Settings
  const [fleetSettings, setFleetSettings] = useState<FleetCustomizationSettings>(() => {
    try {
      const saved = localStorage.getItem('truck_fleet_customizations');
      if (saved) return { ...DEFAULT_FLEET_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to load fleet customizations:', e);
    }
    return DEFAULT_FLEET_SETTINGS;
  });

  const handleUpdateFleetSettings = (newSettings: FleetCustomizationSettings) => {
    setFleetSettings(newSettings);
    try {
      localStorage.setItem('truck_fleet_customizations', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to persist fleet customizations:', e);
    }
  };

  // Background Global Memory & Performance Tracker
  useEffect(() => {
    const trackAppMemory = () => {
      memoryPerformanceService.trackSnapshot({ activeRoute: activeTab });
    };
    trackAppMemory();
    const interval = setInterval(trackAppMemory, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Inspection PDF Generation & Compliance Logs History
  const [inspectionLogs, setInspectionLogs] = useState<InspectionLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('truck_inspection_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved inspection logs:', e);
    }
    return [];
  });

  const handleRecordInspectionPdf = (
    actionType: InspectionActionType = 'PDF_GENERATED',
    triggerSource: InspectionTriggerSource = 'MANUAL_HUD',
    notes?: string
  ) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const displayTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} CDT`;
    const randomHex = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const recNum = `REC-${now.getFullYear()}-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;

    let title = 'FMCSA § 395.8 Driver Daily Log (8-Day Package)';
    if (actionType === 'PRINTED') {
      title = 'In-Cab Mobile Bluetooth Printer Dispatch';
    } else if (actionType === 'ROADSIDE_AUDIT') {
      title = 'Roadside Officer Inspection Export (DOT Level II)';
    } else if (actionType === 'VOICE_TRIGGERED') {
      title = 'Voice-Triggered Inspection Record (8-Day Package)';
    }

    const newEntry: InspectionLogEntry = {
      id: `insp-log-${Date.now()}`,
      timestamp: now.toISOString(),
      displayTime,
      relativeTime: 'Just now',
      actionTitle: title,
      actionType,
      triggerSource,
      cycle: '70-Hour / 8-Day',
      daysCovered: 8,
      documentHash: randomHex,
      recordNumber: recNum,
      verified: Boolean(false),
      notes:
        notes || (firebaseUser?.email ? `Attested by authenticated driver (${firebaseUser.email}) at ${displayTime}. Compliant under 49 CFR § 395.8.` : `Inspection record generated at ${displayTime}. Driver sign-in required for digital attestation.`),
    };

    setInspectionLogs((prev) => {
      const updated = [newEntry, ...prev];
      try {
        localStorage.setItem('truck_inspection_logs', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist inspection log:', e);
      }
      return updated;
    });

    return newEntry;
  };

  // Modals & Side Commands Drawer
  const [isPrivacyLocked, setIsPrivacyLocked] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const showToast = (message: string, icon = 'verified_user') => {
    setToastMessage(message);
    setToastIcon(icon);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3200);
  };

  // Global Voice Control Hook (Speech Recognition & Global Keyboard Listener)
  const voice = useVoiceControl({
    onTriggerInspection: () => {
      handleRecordInspectionPdf('VOICE_TRIGGERED', 'VOICE_CONTROL', 'Voice command "Show Inspection" processed in Night HUD.');
      setIsPdfModalOpen(true);
    },
    onTriggerEmergency: () => setIsEmergencyOpen(true),
    onTriggerPrivacyLock: () => setIsPrivacyLocked(true),
    onTriggerProfile: () => setIsProfileOpen(true),
    onSelectTab: (tab) => setActiveTab(tab),
    onShowToast: showToast,
  });

  // Driver Alertness Index & Interaction Latency Tracker Hook
  const alertness = useAlertnessTracker(showToast);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'night-hud':
        return (
          <NightHudScreen
            onShowToast={showToast}
            onOpenPrivacyLock={() => setIsPrivacyLocked(true)}
            onOpenPdfModal={() => {
              handleRecordInspectionPdf('PDF_GENERATED', 'MANUAL_HUD', 'Driver requested 8-Day FMCSA PDF package from Night HUD.');
              setIsPdfModalOpen(true);
            }}
            onOpenEmergency={() => setIsEmergencyOpen(true)}
            onToggleVoice={voice.toggleListening}
            isListening={voice.isListening}
            alertnessData={alertness.alertnessData}
            onOpenRestModal={() => alertness.setIsRestModalOpen(true)}
            onTriggerFatigue={alertness.triggerSimulatedFatigue}
            onResetAlertness={alertness.resetAlertness}
            onRecordInspectionLog={(actionType, triggerSource, notes) => {
              handleRecordInspectionPdf(actionType as InspectionActionType, triggerSource as InspectionTriggerSource, notes);
            }}
            onNavigateToTab={setActiveTab}
          />
        );
      case 'hos-clocks':
        return (
          <HosClocksScreen
            onShowToast={showToast}
            speed={speed}
            onRecordInspection={handleRecordInspectionPdf}
          />
        );
      case 'trip-planner':
      case 'truck-parking':
      case 'weigh-bypass':
      case 'radar-54b':
      case 'dispatch-eta':
      case 'master-mechanic':

        return (
          <RouteDispatchHub
            key={activeTab}
            initialSubTab={
              activeTab === 'truck-parking'
                ? 'parking'
                : activeTab === 'weigh-bypass'
                ? 'bypass'
                : activeTab === 'radar-54b'
                ? 'weigh-scales'
                : activeTab === 'dispatch-eta'
                ? 'dispatch'
                : activeTab === 'master-mechanic'
                ? 'clearance'
                : 'planner'
            }
            onShowToast={showToast}
            onNavigateToTab={setActiveTab}
            speed={speed}
          />
        );
      case 'fleet-expenses':
      case 'vault':
      case 'ecosystem':
      case 'master-sync':
        return (
          <FleetOperationsHub
            initialSubTab={
              activeTab === 'vault'
                ? 'vault'
                : activeTab === 'ecosystem'
                ? 'trust'
                : activeTab === 'master-sync'
                ? 'sync'
                : 'invoices'
            }
            onShowToast={showToast}
            onOpenPdfModal={() => setIsPdfModalOpen(true)}
            inspectionLogs={inspectionLogs}
            onGenerateNewPdf={(triggerSource, notes) => {
              handleRecordInspectionPdf('PDF_GENERATED', (triggerSource as InspectionTriggerSource) || 'MANUAL_HUD', notes);
              setIsPdfModalOpen(true);
              showToast('NEW INSPECTION PDF GENERATED // ATTESTED', 'picture_as_pdf');
            }}
            onClearLogs={() => {
              setInspectionLogs([]);
              try {
                localStorage.removeItem('truck_inspection_logs');
              } catch (e) {}
              showToast('INSPECTION AUDIT LOG ARCHIVE CLEARED', 'restart_alt');
            }}
          />
        );
      case 'signup':
        return <SignupScreen />;
      case 'messages':
        return <MessagesScreen />;
      case 'haptics':
        return <HapticsScreen onShowToast={showToast} />;
      default:
        return null;
    }
  };

  // ── Entry gate ──────────────────────────────────────────────
  if (!authReady || (firebaseUser && accountGate === 'checking')) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-[#FFE500] animate-pulse">local_shipping</span>
      </div>
    );
  }
  if (!firebaseUser) {
    if (entryView === 'signin') {
      return <SignInScreen onBack={() => setEntryView('landing')} onCreateAccount={() => setEntryView('signup')} />;
    }
    if (entryView === 'signup') {
      return (
        <div className="min-h-screen bg-black">
          <SignupScreen onBack={() => setEntryView('landing')} onSignIn={() => setEntryView('signin')} onComplete={() => setGateCheck((n) => n + 1)} />
        </div>
      );
    }
    return <LandingScreen onSignIn={() => setEntryView('signin')} onGetStarted={() => setEntryView('signup')} />;
  }
  if (accountGate === 'needs_plan') {
    return (
      <div className="min-h-screen bg-black">
        <SignupScreen onComplete={() => setGateCheck((n) => n + 1)} />
      </div>
    );
  }
  if (accountGate === 'offline') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[#FFE500] text-sm">Can&apos;t reach TruckWithEase right now. Check your connection.</p>
        <button
          onClick={() => setGateCheck((n) => n + 1)}
          className="px-6 py-3 rounded-lg bg-[#FFE500] text-black font-black uppercase tracking-wider cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface antialiased select-none font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* Toast Alert */}
      <Toast icon={toastIcon} message={toastMessage} />

      {/* Enterprise Side Navigation & Commands Console */}
      <EnterpriseSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        speed={speed}
        alertnessScore={alertness.alertnessData.score}
        isListening={voice.isListening}
        onToggleVoice={voice.toggleListening}
        onOpenEmergency={() => setIsEmergencyOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlertnessModal={() => alertness.setIsRestModalOpen(true)}
        onOpenPrivacyLock={() => setIsPrivacyLocked(true)}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        enabledModules={fleetSettings.enabledModules}
        onOpenCustomizer={() => setShowCustomizer(true)}
        currentUser={firebaseUser}
        driverName={driverProfile?.name}
        tenantCarrierName={tenantInfo?.carrierName}
        usdotNumber={tenantInfo?.usdotNumber}
      />

      {/* Cockpit Header */}
      <Header
        activeTab={activeTab}
        speed={speed}
        onOpenEmergency={() => setIsEmergencyOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onToggleVoice={voice.toggleListening}
        isListening={voice.isListening}
        alertnessScore={alertness.alertnessData.score}
        onOpenAlertnessModal={() => alertness.setIsRestModalOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        onOpenAuthLogin={() => setIsAuthModalOpen(true)}
        currentUser={firebaseUser}
        driverName={driverProfile?.name}
      />

      {/* Main Content Area (Adjusted for Side Commands Console) */}
      <main className="lg:pl-72 pt-20 pb-20 min-h-screen w-full transition-all">
        <div
          role="status"
          className="mx-4 mb-4 rounded-lg border border-amber-500/60 bg-[#0A0F14] px-4 py-3 text-sm font-semibold text-amber-300"
        >
          Demo data may be shown. Vehicle hardware connections and external regulatory feeds are not connected unless explicitly configured. Do not use this app as an official ELD or safety authority.
        </div>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center bg-[#05080E] font-mono text-sm font-bold uppercase tracking-widest text-[#FFE500]">
              Loading cockpit module…
            </div>
          }
        >
          {renderActiveScreen()}
        </Suspense>
      </main>

      {/* Voice Control HUD Overlay & Trigger */}
      <VoiceCommandOverlay voice={voice} />

      {/* Officer Privacy Shield Mode Modal */}
      <PrivacyLockModal
        isOpen={isPrivacyLocked}
        onUnlock={() => {
          setIsPrivacyLocked(false);
          showToast('OFFICER SHIELD DEACTIVATED // DRIVER TELEMETRY RESTORED', 'lock_open');
        }}
      />

      {/* Official 8-Day FMCSA Record PDF Modal */}
      <InspectionPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onPrinted={() => {
          handleRecordInspectionPdf(
            'PRINTED',
            'CAB_PRINTER',
            'Dispatched hardcopy to in-cab Zebra mobile printer for roadside officer review.'
          );
          showToast('ROADSIDE LOG PACKAGE DISPATCHED TO PRINTER / CLOUD EXPORT', 'print');
        }}
      />

      {/* Driver Profile & CDL Credentials Modal */}
      <DriverProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* 24/7 DOT Emergency & Dispatch Modal */}
      <EmergencyModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        onTriggerAction={(msg) => showToast(msg, 'e911_emergency')}
      />

      {/* Driver Alertness Index & Rest Area Advisory Modal */}
      <RestAreaAlertModal
        isOpen={alertness.isRestModalOpen}
        alertnessData={alertness.alertnessData}
        onClose={() => alertness.setIsRestModalOpen(false)}
        onResetAlertness={alertness.resetAlertness}
        onShowToast={showToast}
        onFindParking={() => setActiveTab('truck-parking')}
      />

      {/* Firebase Driver & Fleet Authenticator Modal */}
      <AuthLoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={firebaseUser}
        onLoginSuccess={(user) => showToast(`AUTHENTICATED AS ${user.email}`, 'verified_user')}
      />

      {/* Fleet & Driver Module Customizer Modal */}
      {showCustomizer && (
        <FleetModuleCustomizer
          settings={fleetSettings}
          onUpdateSettings={handleUpdateFleetSettings}
          onClose={() => setShowCustomizer(false)}
          onShowToast={showToast}
        />
      )}

      {/* Deployment modal removed */}
    </div>
  );
}
