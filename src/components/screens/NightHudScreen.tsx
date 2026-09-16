import React, { useState } from 'react';
import {
  CARRIER_INFO,
  DRIVER_INFO,
  EQUIPMENT_INFO,
  ACTIVE_HASH,
  HISTORICAL_LOGS,
} from '../../data/mockData';
import { DayLog, DriverAlertnessData } from '../../types';
import { WeatherAlert } from '../WeatherAlert';
import { DriverAlertnessWidget } from '../DriverAlertnessWidget';
import { HudStateComplianceWidget } from '../HudStateComplianceWidget';

interface NightHudScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPrivacyLock: () => void;
  onOpenPdfModal: () => void;
  onOpenEmergency: () => void;
  onToggleVoice?: () => void;
  isListening?: boolean;
  alertnessData?: DriverAlertnessData;
  onOpenRestModal?: () => void;
  onTriggerFatigue?: () => void;
  onResetAlertness?: () => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

export const NightHudScreen: React.FC<NightHudScreenProps> = ({
  onShowToast,
  onOpenPrivacyLock,
  onOpenPdfModal,
  onOpenEmergency,
  onToggleVoice,
  isListening = false,
  alertnessData,
  onOpenRestModal,
  onTriggerFatigue,
  onResetAlertness,
  onRecordInspectionLog,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmitSuccess, setTransmitSuccess] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [isBleBroadcasting, setIsBleBroadcasting] = useState<boolean>(false);

  const activeDay: DayLog = HISTORICAL_LOGS[selectedDayIndex] || HISTORICAL_LOGS[0];

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(ACTIVE_HASH).catch(() => {});
    setCopiedHash(true);
    onShowToast('SHA-256 DIGEST COPIED TO CLIPBOARD');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyOfficerUrl = () => {
    navigator.clipboard?.writeText('https://audit.truckwithease.gov/ver/3928110').catch(() => {});
    onShowToast('OFFICER DIRECT PORTAL LINK COPIED');
  };

  const handleTransmitFmcsa = () => {
    if (isTransmitting) return;
    setIsTransmitting(true);
    setTransmitSuccess(false);

    setTimeout(() => {
      setIsTransmitting(false);
      setTransmitSuccess(true);
      onShowToast('FMCSA ERDS TRANSFER COMPLETED: RECORD ACCEPTED // HTTP 200');

      setTimeout(() => {
        setTransmitSuccess(false);
      }, 3500);
    }, 1400);
  };

  const handleBluetoothSend = () => {
    setIsBleBroadcasting(true);
    onShowToast('BROADCASTING DOT BLE PASSIVE AUDIT PACKET (UUID 0x180D)...');
    setTimeout(() => setIsBleBroadcasting(false), 3000);
  };

  const handleSelectDay = (index: number) => {
    setSelectedDayIndex(index);
    const day = HISTORICAL_LOGS[index];
    onShowToast(`LOADED AUDIT CERTIFICATE: ${day.dayLabel}`);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-space-md px-gutter-mobile pb-space-2xl">
        <WeatherAlert onShowToast={onShowToast} />

        {/* AUTOMATED GEOLOCATION HUD STATE COMPLIANCE & SPEED LIMIT SERVICE */}
        <HudStateComplianceWidget
          onShowToast={onShowToast}
          onRecordInspectionLog={onRecordInspectionLog}
        />

        {alertnessData && onOpenRestModal && onTriggerFatigue && onResetAlertness && (
          <DriverAlertnessWidget
            alertnessData={alertnessData}
            onOpenRestModal={onOpenRestModal}
            onTriggerFatigue={onTriggerFatigue}
            onResetAlertness={onResetAlertness}
          />
        )}

        {/* VOICE COMMAND HUD STATUS & SHORTCUT BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-xs p-space-sm bg-surface-container-low/90 rounded-xl border border-surface-container-high/80 shadow-md">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${
              isListening ? 'bg-error text-on-error border-white animate-pulse' : 'bg-surface-container-highest text-primary border-primary/40'
            }`}>
              <span className="material-symbols-outlined text-[16px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-label-caps text-[10px] text-primary uppercase font-bold tracking-wider">
                  VOICE COCKPIT READY
                </span>
                <span className="font-mono text-[9px] text-outline">
                  SAY &quot;SHOW INSPECTION&quot; OR &quot;EMERGENCY&quot;
                </span>
              </div>
              <span className="font-mono text-[9px] text-outline/80">
                KEYBOARD SHORTCUTS: [I] INSPECTION PDF • [E] E911 • [V] TOGGLE MIC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            <button
              onClick={onOpenPdfModal}
              className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest text-[10px] font-mono text-primary flex items-center gap-1 hover:border-primary/50 transition-all cursor-pointer"
              title="Speak or click: 'Show Inspection' [I]"
            >
              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
              <span>&quot;Show Inspection&quot; [I]</span>
            </button>
            <button
              onClick={onOpenEmergency}
              className="px-2 py-1 rounded bg-error-container/30 hover:bg-error-container/50 border border-error/40 text-[10px] font-mono text-error flex items-center gap-1 transition-all cursor-pointer"
              title="Speak or click: 'Emergency' [E]"
            >
              <span className="material-symbols-outlined text-[14px]">e911_emergency</span>
              <span>&quot;Emergency&quot; [E]</span>
            </button>
            {onToggleVoice && (
              <button
                onClick={onToggleVoice}
                className={`p-1 rounded border text-[10px] font-mono transition-all cursor-pointer ${
                  isListening
                    ? 'bg-error text-white border-white animate-pulse'
                    : 'bg-surface-container hover:bg-surface-container-highest text-outline hover:text-white border-surface-container-highest'
                }`}
                title="Toggle Mic Listening [V]"
              >
                <span className="material-symbols-outlined text-[16px] block">
                  {isListening ? 'mic' : 'mic_none'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* TOP STATUTORY AUDIT BANNER & LOCK SWITCH */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-sm shadow-xl border border-surface-container-high/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest">
                FMCSA ROADSIDE INSPECTION MODE
              </span>
            </div>
            <span className="bg-primary-container/20 text-primary font-telemetry-label text-[10px] px-space-xs py-0.5 rounded border border-primary/30">
              49 CFR § 395.15
            </span>
          </div>

          <div className="flex items-center justify-between gap-space-sm pt-space-2xs">
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface uppercase font-bold">
                Statutory Audit Slip
              </span>
              <span className="font-telemetry-label text-telemetry-label text-on-surface-variant">
                MERKLE RECORD #4,133 // BLOCK VERIFIED
              </span>
            </div>
            <button
              id="btn-toggle-lock"
              onClick={onOpenPrivacyLock}
              className="flex items-center gap-space-xs bg-primary-container hover:bg-primary-fixed px-space-sm py-space-xs rounded-lg active:scale-95 transition-transform text-on-primary-container shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                screen_lock_portrait
              </span>
              <span className="font-label-caps text-[10px] tracking-wider uppercase font-bold">
                CABIN LOCK
              </span>
            </button>
          </div>

          {/* Quick Trust Indicators Strip */}
          <div className="grid grid-cols-3 gap-space-xs pt-space-xs">
            <div className="flex flex-col items-center justify-center p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Audit Status
              </span>
              <span className="font-label-caps text-label-caps text-primary uppercase">
                COMPLIANT
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                FMCSA Web Relay
              </span>
              <span className="font-label-caps text-label-caps text-primary uppercase">
                200 READY
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Split Sleeper
              </span>
              <span className="font-label-caps text-label-caps text-primary-fixed uppercase">
                § 395.1(g) EXCL
              </span>
            </div>
          </div>
        </div>

        {/* OFFICER VERIFICATION QR & QUICK PIN DISPATCH */}
        <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl space-y-space-md border border-surface-container-high/40 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">
                qr_code_scanner
              </span>
              <span className="font-label-caps text-label-caps text-on-surface tracking-wider uppercase font-bold">
                Officer Quick-Verify Seal
              </span>
            </div>
            <span className="font-telemetry-label text-telemetry-label text-outline">
              PIN:{' '}
              <strong className="text-primary tracking-widest text-[13px] font-bold">
                {DRIVER_INFO.fmcsaPin}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-space-md bg-surface-container p-space-sm rounded-lg border border-surface-container-highest">
            {/* Generative Tactical QR Representation */}
            <div
              onClick={handleCopyOfficerUrl}
              className="w-24 h-24 bg-surface-container-lowest p-1.5 rounded flex items-center justify-center shrink-0 border border-primary/20 cursor-pointer hover:border-primary transition-colors"
              title="Click to copy officer public URL"
            >
              <svg
                className="w-full h-full text-primary"
                fill="currentColor"
                viewBox="0 0 100 100"
              >
                {/* QR Position Boxes */}
                <rect fill="currentColor" height="30" rx="2" width="30" x="0" y="0" />
                <rect fill="#0d0e13" height="18" width="18" x="6" y="6" />
                <rect fill="currentColor" height="10" width="10" x="10" y="10" />

                <rect fill="currentColor" height="30" rx="2" width="30" x="70" y="0" />
                <rect fill="#0d0e13" height="18" width="18" x="76" y="6" />
                <rect fill="currentColor" height="10" width="10" x="80" y="10" />

                <rect fill="currentColor" height="30" rx="2" width="30" x="0" y="70" />
                <rect fill="#0d0e13" height="18" width="18" x="6" y="76" />
                <rect fill="currentColor" height="10" width="10" x="10" y="80" />

                {/* Pattern Blocks */}
                <rect fill="currentColor" height="8" width="8" x="36" y="8" />
                <rect fill="currentColor" height="6" width="14" x="48" y="4" />
                <rect fill="currentColor" height="14" width="6" x="36" y="22" />
                <rect fill="currentColor" height="10" width="10" x="52" y="20" />
                <rect fill="currentColor" height="6" width="12" x="4" y="38" />
                <rect fill="currentColor" height="8" width="8" x="22" y="40" />
                <rect fill="currentColor" height="6" width="18" x="36" y="38" />
                <rect fill="currentColor" height="18" width="6" x="60" y="36" />
                <rect fill="currentColor" height="6" width="22" x="74" y="38" />
                <rect fill="currentColor" height="12" width="12" x="80" y="50" />
                <rect fill="currentColor" height="18" width="8" x="38" y="52" />
                <rect fill="currentColor" height="8" width="12" x="52" y="60" />
                <rect fill="currentColor" height="8" width="14" x="4" y="52" />
                <rect fill="currentColor" height="6" width="6" x="22" y="60" />
                <rect fill="currentColor" height="18" width="10" x="70" y="72" />
                <rect fill="currentColor" height="12" width="10" x="86" y="78" />
                <rect fill="currentColor" height="14" width="14" x="48" y="78" />
                <rect fill="currentColor" height="8" width="8" x="36" y="84" />
              </svg>
            </div>

            <div className="flex flex-col justify-between flex-1 min-w-0">
              <div className="flex flex-col">
                <span className="font-telemetry-label text-[10px] text-outline uppercase tracking-wider">
                  Public Officer Portal
                </span>
                <span className="font-body-sm text-body-sm text-on-surface truncate font-semibold">
                  audit.truckwithease.gov/ver/{CARRIER_INFO.usdot}
                </span>
              </div>
              <p className="font-body-sm text-[11px] text-on-surface-variant leading-tight mt-1">
                Scan directly from cruiser MDT or smartphone camera to view instantaneous cloud-certified telemetrics.
              </p>
              <div className="flex items-center gap-space-xs mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-telemetry-label text-[10px] text-primary">
                  TLS 1.3 SECURE DOCK
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* STATUTORY CARRIER & VEHICLE IDENTITY MATRIX */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-sm shadow-md border border-surface-container-high/50">
          <div className="flex items-center justify-between pb-space-2xs">
            <span className="font-label-caps text-label-caps text-primary tracking-wider uppercase font-bold">
              Carrier &amp; Equipment Identity
            </span>
            <span className="font-telemetry-label text-telemetry-label text-outline">
              § 395.8(d) FORM
            </span>
          </div>

          <div className="grid grid-cols-2 gap-space-xs">
            {/* Col 1 */}
            <div className="flex flex-col p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Authorized Carrier
              </span>
              <span className="font-body-sm text-body-sm text-on-surface font-semibold truncate">
                {CARRIER_INFO.name}
              </span>
              <span className="font-telemetry-label text-[10px] text-primary truncate">
                {CARRIER_INFO.partner}
              </span>
            </div>
            {/* Col 2 */}
            <div className="flex flex-col p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Statutory Authorities
              </span>
              <span className="font-telemetry-label text-telemetry-label text-on-surface font-semibold truncate">
                USDOT: {CARRIER_INFO.usdot}
              </span>
              <span className="font-telemetry-label text-telemetry-label text-primary truncate">
                MC: {CARRIER_INFO.mc}
              </span>
            </div>
          </div>

          <div className="flex flex-col p-space-xs bg-surface-container-low rounded space-y-space-2xs border border-surface-container-highest">
            <div className="flex items-center justify-between">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Assigned Commercial Driver
              </span>
              <span className="font-telemetry-label text-[10px] text-primary">
                {DRIVER_INFO.cdlClass}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-body-md text-body-md text-on-surface font-bold">
                {DRIVER_INFO.name}
              </span>
              <span className="font-telemetry-label text-telemetry-label text-on-surface-variant font-mono">
                {DRIVER_INFO.cdlNumber}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-body-sm text-[11px] text-outline">
                Medical Certificate: Exp {DRIVER_INFO.medicalCertExp}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                Co-Driver: <em className="text-outline not-italic">{DRIVER_INFO.coDriver}</em>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-space-xs">
            <div className="flex flex-col p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Power Unit
              </span>
              <span className="font-body-sm text-body-sm text-on-surface font-bold truncate">
                {EQUIPMENT_INFO.powerUnit}
              </span>
              <span className="font-telemetry-label text-[9px] text-outline truncate font-mono">
                VIN: {EQUIPMENT_INFO.vin}
              </span>
            </div>
            <div className="flex flex-col p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Trailing Unit
              </span>
              <span className="font-body-sm text-body-sm text-on-surface font-bold truncate">
                {EQUIPMENT_INFO.trailingUnit}
              </span>
              <span className="font-telemetry-label text-[9px] text-primary truncate">
                Height: {EQUIPMENT_INFO.trailerHeight}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
            <div className="flex items-center gap-space-xs truncate">
              <span className="material-symbols-outlined text-outline text-[16px]">
                description
              </span>
              <span className="font-telemetry-label text-[11px] text-on-surface truncate">
                Manifest {EQUIPMENT_INFO.manifestId}: {EQUIPMENT_INFO.route}
              </span>
            </div>
            <span className="font-telemetry-label text-[10px] text-primary shrink-0 font-bold px-1.5 py-0.5 rounded bg-primary/10">
              {EQUIPMENT_INFO.freightType}
            </span>
          </div>
        </div>

        {/* SHA-256 CRYPTOGRAPHIC INTEGRITY CARD */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-sm shadow-xl border border-surface-container-high/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">
                enhanced_encryption
              </span>
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
                SHA-256 Ledger Proof
              </span>
            </div>
            <span className="font-telemetry-label text-[10px] bg-primary/10 text-primary px-space-xs py-0.5 rounded border border-primary/20">
              TAMPER-EVIDENT
            </span>
          </div>

          <div className="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col space-y-space-xs border border-surface-container-high">
            <div className="flex items-center justify-between">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Active Record SHA-256 Checksum
              </span>
              <button
                id="btn-copy-hash"
                onClick={handleCopyHash}
                className="flex items-center gap-1 text-primary hover:text-primary-fixed active:scale-95 transition-transform cursor-pointer"
                title="Copy Checksum"
              >
                <span className="font-telemetry-label text-[10px] uppercase font-bold">
                  {copiedHash ? 'COPIED' : 'COPY'}
                </span>
                <span className="material-symbols-outlined text-[14px]">
                  {copiedHash ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
            <p
              id="hash-string"
              className="font-telemetry-metric text-[11px] text-primary break-all leading-tight font-mono selection:bg-primary-container p-1 rounded bg-surface-container-low"
            >
              {ACTIVE_HASH}
            </p>
            <div className="flex items-center justify-between pt-space-xs text-outline font-telemetry-label text-[10px]">
              <span>Merkle #4,132 ➔ #4,133</span>
              <span className="text-on-surface-variant">2025-03-13 05:14:22 CST</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-space-xs bg-surface-container-low rounded border border-surface-container-highest">
            <div className="flex flex-col">
              <span className="font-telemetry-label text-[10px] text-outline uppercase">
                Certified Electronic Signature
              </span>
              <span className="font-headline-sm text-headline-sm text-primary tracking-wide italic font-serif">
                J. Vance
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-telemetry-label text-[9px] text-outline">
                ATTESTATION COMPLIANT
              </span>
              <span className="font-telemetry-label text-[10px] text-primary font-bold">
                49 CFR § 390.37 CERTIFIED
              </span>
            </div>
          </div>
        </div>

        {/* 49 CFR § 395 STATUTORY CLOCKS */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-md shadow-lg border border-surface-container-high/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
                Real-Time HOS Clocks
              </span>
              <span className="font-telemetry-label text-[10px] text-outline">
                CURRENT DAY CYCLE: THURSDAY 03/13
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">
              timer
            </span>
          </div>

          {/* Clock Modules Grid */}
          <div className="grid grid-cols-2 gap-space-sm">
            {/* 11-Hour Drive */}
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between space-y-space-xs border border-surface-container-highest">
              <div className="flex items-center justify-between">
                <span className="font-telemetry-label text-[10px] text-outline uppercase truncate">
                  11h Driving Cap
                </span>
                <span className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <span className="font-telemetry-metric text-telemetry-metric text-primary">
                06:44
              </span>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '61%' }} />
              </div>
              <span className="font-telemetry-label text-[9px] text-on-surface-variant">
                0 Violations • 04h 16m Driven
              </span>
            </div>

            {/* 14-Hour Duty Window */}
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between space-y-space-xs border border-surface-container-highest">
              <div className="flex items-center justify-between">
                <span className="font-telemetry-label text-[10px] text-outline uppercase truncate">
                  14h Duty Window
                </span>
                <span className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <span className="font-telemetry-metric text-telemetry-metric text-primary">
                09:18
              </span>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '66%' }} />
              </div>
              <span className="font-telemetry-label text-[9px] text-primary truncate font-bold">
                Split-Reset § 395.1(g)
              </span>
            </div>

            {/* 30-Min Rest Break */}
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between space-y-space-xs border border-surface-container-highest">
              <div className="flex items-center justify-between">
                <span className="font-telemetry-label text-[10px] text-outline uppercase truncate">
                  30-Min Break
                </span>
                <span className="material-symbols-outlined text-primary text-[14px]">
                  check_circle
                </span>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                SATISFIED
              </span>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="font-telemetry-label text-[9px] text-on-surface-variant">
                Via Berth Rest @ 01:20
              </span>
            </div>

            {/* 70-Hour / 8-Day Cap */}
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col justify-between space-y-space-xs border border-surface-container-highest">
              <div className="flex items-center justify-between">
                <span className="font-telemetry-label text-[10px] text-outline uppercase truncate">
                  70h / 8-Day Roll
                </span>
                <span className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <span className="font-telemetry-metric text-telemetry-metric text-primary">
                32:15
              </span>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '46%' }} />
              </div>
              <span className="font-telemetry-label text-[9px] text-on-surface-variant">
                37h 45m Used of 70h Cap
              </span>
            </div>
          </div>

          {/* Statutory Split-Sleeper Clause Legal Box */}
          <div className="bg-surface-container-lowest p-space-sm rounded-lg space-y-space-2xs border border-surface-container-highest">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[16px]">
                gavel
              </span>
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold">
                Statutory Split Berth Affirmation
              </span>
            </div>
            <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
              Pursuant to <strong className="text-on-surface">49 CFR § 395.1(g)(1)(ii)(A)</strong>, Qualifying Period 1 (07h 12m Sleeper Berth continuous duration) completed at 05:12 CST is legally excluded from calculation against the 14-hour on-duty operating window limit.
            </p>
          </div>
        </div>

        {/* 24-HOUR STATUTORY DUTY CYCLE GRAPHIC GRID */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-sm shadow-xl border border-surface-container-high/60">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest font-bold">
                24-Hour Duty Grid
              </span>
              <span className="font-telemetry-label text-[10px] text-outline">
                MIDNIGHT TO MIDNIGHT CYCLE (CST)
              </span>
            </div>
            <span className="font-telemetry-label text-[11px] text-primary font-bold">
              15h 00m Total Today
            </span>
          </div>

          {/* Tactical SVG Grid HUD */}
          <div className="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col space-y-2 overflow-x-auto border border-surface-container-high">
            <div className="flex justify-between text-outline font-telemetry-label text-[9px] px-8">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>24:00</span>
            </div>

            <svg
              className="w-full h-32"
              preserveAspectRatio="none"
              viewBox="0 0 400 120"
            >
              {/* Background Grid Lines */}
              <g stroke="#1e1f25" strokeWidth="1">
                <line x1="40" x2="390" y1="15" y2="15" />
                <line x1="40" x2="390" y1="45" y2="45" />
                <line x1="40" x2="390" y1="75" y2="75" />
                <line x1="40" x2="390" y1="105" y2="105" />

                {/* Hourly vertical ticks */}
                <line x1="40" x2="40" y1="0" y2="120" />
                <line strokeDasharray="2 2" x1="98" x2="98" y1="0" y2="120" />
                <line strokeDasharray="2 2" x1="156" x2="156" y1="0" y2="120" />
                <line strokeDasharray="2 2" x1="215" x2="215" y1="0" y2="120" />
                <line strokeDasharray="2 2" x1="273" x2="273" y1="0" y2="120" />
                <line strokeDasharray="2 2" x1="331" x2="331" y1="0" y2="120" />
                <line x1="390" x2="390" y1="0" y2="120" />
              </g>

              {/* Row Labels */}
              <text fill="#99907c" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" x="5" y="19">
                OFF
              </text>
              <text fill="#f2ca50" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" x="5" y="49">
                SB
              </text>
              <text fill="#f2ca50" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" x="5" y="79">
                D
              </text>
              <text fill="#99907c" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" x="5" y="109">
                ON
              </text>

              {/* Active Duty Path Line */}
              <polyline
                fill="none"
                points="40,15 73,15 73,45 178,45 178,105 196,105 196,75 258,75"
                stroke="#d4af37"
                strokeWidth="2.5"
              />

              {/* Shaded Area Under Current Status (Driving) */}
              <polygon
                fill="#d4af37"
                fillOpacity="0.15"
                points="196,75 258,75 258,120 196,120"
              />

              {/* Berth Exclusion Marker highlight */}
              <rect
                fill="#f2ca50"
                fillOpacity="0.2"
                height="14"
                rx="2"
                width="105"
                x="73"
                y="38"
              />
              <text
                fill="#ffe088"
                fontFamily="Space Grotesk"
                fontSize="8"
                fontWeight="700"
                x="80"
                y="48"
              >
                QUALIFYING SPLIT 07h 12m
              </text>

              {/* Current Time Cursor Pin (15:00 CST) */}
              <line
                stroke="#f2ca50"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                x1="258"
                x2="258"
                y1="0"
                y2="120"
              />
              <circle cx="258" cy="75" fill="#f2ca50" r="4" className="animate-ping" opacity="0.4" />
              <circle cx="258" cy="75" fill="#f2ca50" r="4" />
            </svg>

            {/* Total Hours Breakdown Bar */}
            <div className="grid grid-cols-4 gap-space-2xs pt-space-xs text-center">
              <div className="bg-surface-container-low p-1 rounded border border-surface-container-highest">
                <span className="font-telemetry-label text-[9px] text-outline block">
                  1. OFF
                </span>
                <span className="font-telemetry-metric text-[12px] text-on-surface">
                  02h 15m
                </span>
              </div>
              <div className="bg-surface-container-low p-1 rounded border border-surface-container-highest">
                <span className="font-telemetry-label text-[9px] text-primary block">
                  2. SLEEPER
                </span>
                <span className="font-telemetry-metric text-[12px] text-primary font-bold">
                  07h 12m
                </span>
              </div>
              <div className="bg-surface-container-low p-1 rounded border border-surface-container-highest">
                <span className="font-telemetry-label text-[9px] text-primary block">
                  3. DRIVE
                </span>
                <span className="font-telemetry-metric text-[12px] text-primary font-bold">
                  04h 16m
                </span>
              </div>
              <div className="bg-surface-container-low p-1 rounded border border-surface-container-highest">
                <span className="font-telemetry-label text-[9px] text-outline block">
                  4. ON-DUTY
                </span>
                <span className="font-telemetry-metric text-[12px] text-on-surface">
                  01h 17m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 8-DAY HISTORICAL LOG AUDIT STRIP */}
        <div className="flex flex-col bg-surface-container p-space-md rounded-xl space-y-space-sm shadow-md border border-surface-container-high/60">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
              8-Day Prior Log Chain
            </span>
            <span className="font-telemetry-label text-[10px] text-primary font-bold">
              8/8 AUDITED &amp; SIGNED
            </span>
          </div>

          {/* Day Pills Scroll Row */}
          <div className="flex items-center gap-space-xs overflow-x-auto pb-space-2xs">
            {HISTORICAL_LOGS.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              return (
                <button
                  key={day.id}
                  onClick={() => handleSelectDay(idx)}
                  className={`day-tab px-space-sm py-1.5 rounded font-telemetry-label text-[11px] shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold shadow-md'
                      : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {day.shortDate}
                </button>
              );
            })}
          </div>

          {/* Active Selected Day Log Snapshot Card */}
          <div
            id="day-log-snapshot"
            className="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between border border-surface-container-highest"
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[22px]">
                verified
              </span>
              <div className="flex flex-col">
                <span
                  id="active-day-title"
                  className="font-body-md text-body-md font-bold text-on-surface"
                >
                  {activeDay.dateStr}
                </span>
                <span className="font-telemetry-label text-[10px] text-outline">
                  DRIVE: {activeDay.driveHours} • ON-DUTY: {activeDay.onDutyHours} • {activeDay.deficiencies} DEFICIENCIES
                </span>
              </div>
            </div>
            <span className="font-label-caps text-[9px] bg-primary-container/20 text-primary px-space-xs py-1 rounded border border-primary/30">
              MATCH
            </span>
          </div>

          {/* Transmission Triggers for DOT Officer Transfer */}
          <div className="flex flex-col gap-space-xs pt-space-xs">
            <button
              id="btn-transmit-fmcsa"
              disabled={isTransmitting}
              onClick={handleTransmitFmcsa}
              className="w-full py-space-sm px-space-md bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold uppercase rounded-lg shadow-xl flex items-center justify-center gap-space-xs active:scale-[0.98] transition-all cursor-pointer hover:brightness-105 disabled:opacity-80"
            >
              {isTransmitting ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">
                    autorenew
                  </span>
                  <span>TRANSMITTING TO FMCSA ROUTING ENGINE...</span>
                </>
              ) : transmitSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    check_circle
                  </span>
                  <span>TRANSFER CONFIRMED // HTTP 200 OK</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    send
                  </span>
                  <span>TRANSMIT LOGS TO FMCSA (WEB SERVICES)</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-space-xs">
              <button
                id="btn-bluetooth-send"
                onClick={handleBluetoothSend}
                className={`py-space-xs bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-caps text-[11px] uppercase rounded flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer border border-surface-container-highest ${
                  isBleBroadcasting ? 'border-primary text-primary animate-pulse' : ''
                }`}
              >
                <span className="material-symbols-outlined text-primary text-[16px]">
                  bluetooth_searching
                </span>
                <span>DOT BLUETOOTH SYNC</span>
              </button>

              <button
                id="btn-export-pdf"
                onClick={onOpenPdfModal}
                className="py-space-xs bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-caps text-[11px] uppercase rounded flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer border border-surface-container-highest"
              >
                <span className="material-symbols-outlined text-primary text-[16px]">
                  picture_as_pdf
                </span>
                <span>PRINT / 8-DAY PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* OFFICER STATUTORY DISCLOSURE & HOTLINE FOOTER */}
        <div className="flex flex-col bg-surface-container-lowest p-space-md rounded-xl space-y-space-sm text-center border border-surface-container-high/40">
          <div className="flex items-center justify-center gap-space-xs text-primary">
            <span className="material-symbols-outlined text-[16px]">
              policy
            </span>
            <span className="font-label-caps text-label-caps uppercase tracking-wider font-bold">
              Formal Notice To Law Enforcement Official
            </span>
          </div>

          <p className="font-body-sm text-[11px] text-outline leading-relaxed text-left">
            This document constitutes a certified statutory record of duty status under <strong className="text-on-surface-variant">49 CFR Part 395</strong>. TruckWithEase &amp; Morrishive maintain a continuous, immutable SHA-256 hash sequence verified against engine ECM telematics (J1939 CAN-bus at 10Hz). Any officer verification inquiry may be confirmed via FMCSA Web Services or direct dispatch hotlink.
          </p>

          <div className="flex items-center justify-between pt-space-xs bg-surface-container-low p-space-xs rounded text-left border border-surface-container-highest">
            <div className="flex flex-col">
              <span className="font-telemetry-label text-[9px] text-outline uppercase">
                24/7 DOT Compliance Dispatch Hotline
              </span>
              <span className="font-telemetry-metric text-[14px] text-primary font-bold">
                {CARRIER_INFO.phone}
              </span>
            </div>
            <button
              onClick={onOpenEmergency}
              className="px-space-sm py-1 bg-primary text-on-primary rounded font-label-caps text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow"
            >
              <span className="material-symbols-outlined text-[14px]">
                call
              </span>
              DISPATCH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
