/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TabId, InspectionLogEntry, InspectionActionType, InspectionTriggerSource } from './types';
import { INITIAL_INSPECTION_LOGS } from './data/mockData';
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
import { GoatScreen } from './components/screens/GoatScreen';
import { HapticsScreen } from './components/screens/HapticsScreen';
import { EcosystemTrustHubScreen } from './components/screens/EcosystemTrustHubScreen';
import { SecurityVaultScreen } from './components/screens/SecurityVaultScreen';
import { TelemetryScreen } from './components/screens/TelemetryScreen';
import { DispatchEtaScreen } from './components/screens/DispatchEtaScreen';
import { MasterSynchronizerScreen } from './components/screens/MasterSynchronizerScreen';
import { QuantumIndexScreen } from './components/screens/QuantumIndexScreen';
import { FleetExpensesInvoiceScreen } from './components/screens/FleetExpensesInvoiceScreen';
import { FleetModuleCustomizer } from './components/FleetModuleCustomizer';
import { memoryPerformanceService } from './services/memoryPerformanceService';
import { FleetCustomizationSettings } from './types';

const DEFAULT_FLEET_SETTINGS: FleetCustomizationSettings = {
  speedAlertToleranceMph: 5,
  brakeThermalWarningTempF: 450,
  vehicleHeightFt: 13.5,
  defaultStartTab: 'night-hud',
  autoStateBoundaryAlerts: true,
  voiceControlEnabled: true,
  enabledModules: {
    'master-sync': true,
    'night-hud': true,
    'dispatch-eta': true,
    'vault': true,
    'fleet-expenses': true,
    'hos-clocks': true,
    'radar-54b': true,
    'the-g-o-a-t-': true,
    'haptics': true,
    'ecosystem': true,
    'telemetry': true,
    'quantum-index': true,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('night-hud');
  const [speed, setSpeed] = useState<number>(65);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('verified_user');
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);

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
    const interval = setInterval(trackAppMemory, 10000);
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
    return INITIAL_INSPECTION_LOGS;
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
      merkleHash: randomHex,
      recordNumber: recNum,
      fileSize: `${Math.floor(340 + Math.random() * 25)} KB`,
      verified: true,
      notes:
        notes ||
        `Attested by Jonathan Vance (CDL IL-98104820) at ${displayTime}. Verified compliant under 49 CFR § 395.8.`,
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

  // Speed simulation (subtle variance around 65 mph while moving)
  useEffect(() => {
    if (speed > 0) {
      const interval = setInterval(() => {
        setSpeed((prev) => {
          const delta = (Math.random() - 0.5) * 2;
          const next = Math.round(prev + delta);
          return Math.min(68, Math.max(62, next));
        });
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [speed]);

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
              handleRecordInspectionPdf(actionType, triggerSource, notes);
            }}
          />
        );
      case 'hos-clocks':
        return <HosClocksScreen onShowToast={showToast} speed={speed} />;
      case 'radar-54b':
        return <Radar54bScreen onShowToast={showToast} speed={speed} />;
      case 'the-g-o-a-t-':
        return <GoatScreen onShowToast={showToast} />;
      case 'haptics':
        return <HapticsScreen onShowToast={showToast} />;
      case 'ecosystem':
        return <EcosystemTrustHubScreen onShowToast={showToast} />;
      case 'vault':
        return (
          <SecurityVaultScreen
            onShowToast={showToast}
            onOpenPdfModal={() => setIsPdfModalOpen(true)}
            inspectionLogs={inspectionLogs}
            onGenerateNewPdf={(triggerSource, notes) => {
              handleRecordInspectionPdf('PDF_GENERATED', triggerSource || 'MANUAL_HUD', notes);
              setIsPdfModalOpen(true);
              showToast('NEW INSPECTION PDF GENERATED // CRYPTOGRAPHICALLY ATTESTED', 'picture_as_pdf');
            }}
            onClearLogs={() => {
              setInspectionLogs(INITIAL_INSPECTION_LOGS);
              try {
                localStorage.removeItem('truck_inspection_logs');
              } catch (e) {}
              showToast('INSPECTION AUDIT LOG ARCHIVE RESET TO BASELINE', 'restart_alt');
            }}
          />
        );
      case 'fleet-expenses':
        return <FleetExpensesInvoiceScreen onShowToast={showToast} />;
      case 'telemetry':
        return (
          <TelemetryScreen
            onShowToast={showToast}
            speed={speed}
            onRecordInspectionLog={(actionType, triggerSource, notes) => {
              handleRecordInspectionPdf(actionType as any, triggerSource as any, notes);
            }}
          />
        );
      case 'dispatch-eta':
        return <DispatchEtaScreen onShowToast={showToast} />;
      case 'master-sync':
        return (
          <MasterSynchronizerScreen
            onShowToast={showToast}
            onOpenPdfModal={() => setIsPdfModalOpen(true)}
            alertnessData={alertness.alertnessData}
            onOpenRestModal={() => alertness.setIsRestModalOpen(true)}
            onTriggerFatigue={alertness.triggerSimulatedFatigue}
            onResetAlertness={alertness.resetAlertness}
          />
        );
      case 'quantum-index':
        return (
          <QuantumIndexScreen
            onShowToast={showToast}
            speed={speed}
            onExportQuantumSignature={(notes) => {
              const log = handleRecordInspectionPdf('PDF_GENERATED', 'QUANTUM_INDEX_AUDIT', notes);
              showToast(`QUANTUM SIGNATURE LOGGED TO VAULT (#${log.recordNumber})`);
            }}
          />
        );
      default:
        return null;
    }
  };

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
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Content Area (Adjusted for Side Commands Console) */}
      <main className="lg:pl-72 pt-20 pb-20 min-h-screen w-full transition-all">
        {renderActiveScreen()}
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
    </div>
  );
}

