import React, { useState, useEffect } from 'react';
import {
  erodsTagAlongService,
  ScannedRoadsideInspection,
  ErodsTagAlongBundle,
  DEFAULT_SAMPLE_INSPECTIONS,
  InspectionLevel,
} from '../services/erodsTagAlongService';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO } from '../data/mockData';
import { dotDocumentsService } from '../services/dotDocumentsService';

interface ErodsTagAlongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
}

type ModalViewMode = 'SCAN_AND_TAG' | 'LIVE_PREVIEW' | 'TRANSMISSION_RECEIPT' | 'AUDIT_LEDGER';

export const ErodsTagAlongModal: React.FC<ErodsTagAlongModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onRecordInspectionLog,
}) => {
  const [viewMode, setViewMode] = useState<ModalViewMode>('SCAN_AND_TAG');
  const [bundles, setBundles] = useState<ErodsTagAlongBundle[]>(() => erodsTagAlongService.getBundles());
  
  // Scanning & Form State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeInspection, setActiveInspection] = useState<ScannedRoadsideInspection>(DEFAULT_SAMPLE_INSPECTIONS[0]);
  const [routingKeyComment, setRoutingKeyComment] = useState<string>('TX-DPS-INSP-4920');
  const [transmissionMethod, setTransmissionMethod] = useState<'FMCSA_WEB_SERVICES' | 'FMCSA_EMAIL'>('FMCSA_WEB_SERVICES');
  const [isAttested, setIsAttested] = useState<boolean>(true);
  
  // Transmit Progress State
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [latestReceiptBundle, setLatestReceiptBundle] = useState<ErodsTagAlongBundle | null>(null);

  useEffect(() => {
    return erodsTagAlongService.subscribe((updated) => {
      setBundles(updated);
    });
  }, []);

  if (!isOpen) return null;

  // Simulate scanning a roadside inspection sheet
  const handleTriggerScan = async (presetIndex: number = 0) => {
    setIsScanning(true);
    onShowToast('AI SCANNER INITIALIZED // RECOGNIZING FORM MCSA-5884...', 'document_scanner');
    try {
      const preset = DEFAULT_SAMPLE_INSPECTIONS[presetIndex] || DEFAULT_SAMPLE_INSPECTIONS[0];
      const scanned = await erodsTagAlongService.scanAndParseInspectionSheet(
        preset.scannedDocumentName,
        preset.ocrExtractedText
      );
      setActiveInspection(scanned);
      setRoutingKeyComment(`${scanned.jurisdictionState}-DPS-INSP-${scanned.officerBadgeNumber.replace(/[^0-9]/g, '') || '904'}`);
      onShowToast('ROADSIDE INSPECTION REPORT PARSED & TAGGED SUCCESSFULLY', 'check_circle');
    } finally {
      setIsScanning(false);
    }
  };

  // Transmit the combined Tag-a-Long bundle to FMCSA
  const handleTransmitTagAlongErods = async () => {
    if (!routingKeyComment.trim()) {
      onShowToast('FMCSA Inspector Routing Key / File Comment is required.', 'warning');
      return;
    }
    if (!isAttested) {
      onShowToast('Driver attestation signature required before FMCSA transmission.', 'error');
      return;
    }

    setIsTransmitting(true);
    onShowToast('TRANSMITTING TAG-A-LONG ERODS BUNDLE TO FMCSA GATEWAY...', 'cloud_upload');

    try {
      // Artificial regulatory gateway latency
      await new Promise((resolve) => setTimeout(resolve, 1400));
      const bundle = await erodsTagAlongService.createTagAlongBundle(
        activeInspection,
        routingKeyComment,
        transmissionMethod
      );
      setLatestReceiptBundle(bundle);
      setViewMode('TRANSMISSION_RECEIPT');
      onShowToast(`FMCSA ERoDS ACCEPTED // RECEIPT: ${bundle.fmcsaSubmissionReceiptCode}`, 'verified');

      try {
        dotDocumentsService.addDocument({
          documentTitle: `FMCSA ERoDS Tag-a-Long Audit Package (${bundle.scannedInspection.reportNumber})`,
          category: 'VEHICLE_DVIR',
          cfrReference: '49 CFR § 395.24 / § 395.34 (Roadside ERoDS Mandate)',
          documentNumber: bundle.scannedInspection.reportNumber,
          issuingAuthority: bundle.scannedInspection.enforcementAgency,
          issuedDate: bundle.scannedInspection.inspectionDate.slice(0, 10),
          expirationDate: new Date(Date.now() + 180 * 86400 * 1000).toISOString().slice(0, 10),
          status: bundle.complianceStatus === 'FULLY_COMPLIANT' ? 'VALID' : 'PENDING_AUDIT',
          driverName: bundle.driverName,
          unitNumber: bundle.scannedInspection.powerUnitNumber,
          fileSizeBytes: 24576,
          fileFormat: 'PDF / ELD CSV Export Compliant',
          notes: `Tag-a-Long inspection session: ${bundle.routingKeyComment}. Officer: ${bundle.scannedInspection.officerName} (${bundle.scannedInspection.officerBadgeNumber}). FMCSA Receipt: ${bundle.fmcsaSubmissionReceiptCode}. CVSA Decal: ${bundle.scannedInspection.cvsaDecalIssued ? 'YES' : 'NO'}.`,
          certified: true,
        });
      } catch (err) {
        console.warn('Vault registration notice:', err);
      }

      if (onRecordInspectionLog) {
        onRecordInspectionLog(
          'FMCSA_PORTAL_SYNC',
          'OFFICER_REQUEST',
          `Tag-a-Long ERoDS transmitted to FMCSA Web Services for Roadside Inspection #${activeInspection.reportNumber}. Receipt: ${bundle.fmcsaSubmissionReceiptCode}.`
        );
      }
    } catch {
      onShowToast('Transmission error: Check FMCSA gateway connectivity.', 'error');
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleDownloadCsv = (bundle: ErodsTagAlongBundle) => {
    const csvContent = erodsTagAlongService.exportTagAlongAuditCsv(bundle);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FMCSA_ERODS_TAGALONG_${bundle.bundleId}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('TAG-A-LONG AUDIT REPORT EXPORTED TO CSV', 'download');
  };

  const handlePrintBundle = () => {
    window.print();
    onShowToast('ROADSIDE TAG-A-LONG PACKAGE DISPATCHED TO PRINTER', 'print');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0A0F14] border-2 border-[#1E2532] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] text-slate-100 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ================================================================== */}
        {/* 1. TOP HEADER & MANDATE BADGE                                      */}
        {/* ================================================================== */}
        <div className="p-4 sm:p-6 border-b border-[#1E2532] bg-gradient-to-r from-[#05080E] via-[#0A0F14] to-[#05080E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-[#FFE500] shadow-[0_0_20px_rgba(255,229,0,0.3)] shrink-0">
              <span className="material-symbols-outlined text-[28px] animate-pulse">document_scanner</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-['Space_Grotesk'] text-lg sm:text-xl font-black text-white tracking-wider uppercase">
                  FMCSA ERODS TAG-A-LONG &amp; ROADSIDE INSPECTION
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)] font-mono">
                  <span>&#10004;</span>
                  <span>49 CFR § 395.24 MANDATE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Official ERoDS Companion System • Scan Paper Driver Vehicle Examination Sheets &amp; Transmit to FMCSA Web Services
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => handleTriggerScan(0)}
              disabled={isScanning}
              className="btn-tactical-yellow px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)] whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isScanning ? 'sync' : 'document_scanner'}
              </span>
              <span>{isScanning ? 'SCANNING...' : 'SCAN INSPECTION SHEET'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition flex items-center justify-center"
              title="Close Modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 2. SUBTAB NAVIGATION BAR                                           */}
        {/* ================================================================== */}
        <div className="px-4 sm:px-6 pt-3 bg-[#0A0F14] border-b border-[#1E2532] shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3">
            <button
              onClick={() => setViewMode('SCAN_AND_TAG')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                viewMode === 'SCAN_AND_TAG'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">document_scanner</span>
              <span>1. Scan &amp; Tag Inspection</span>
            </button>

            <button
              onClick={() => setViewMode('LIVE_PREVIEW')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                viewMode === 'LIVE_PREVIEW'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>2. Live ERoDS &amp; Paper Preview</span>
            </button>

            <button
              onClick={() => setViewMode('AUDIT_LEDGER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                viewMode === 'AUDIT_LEDGER'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>3. Tag-a-Long Audit Ledger ({bundles.length})</span>
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 3. TAB CONTENT VIEWS                                               */}
        {/* ================================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: SCAN & TAG INSPECTION FORM                                */}
          {/* ---------------------------------------------------------------- */}
          {viewMode === 'SCAN_AND_TAG' && (
            <div className="space-y-6 animate-fade-in">
              {/* FMCSA Mandate Notice */}
              <div className="p-4 rounded-2xl bg-[#05080E] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-md">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-400 text-[24px]">policy</span>
                  <div>
                    <span className="text-white font-bold block uppercase tracking-wider">
                      FMCSA 49 CFR § 395.24 ROADSIDE AUDIT PROTOCOL
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      At roadside inspection, pair your 8-Day electronic logs with the officer's inspection sheet using this Tag-a-Long system.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTriggerScan(0)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold text-[11px] hover:bg-emerald-900 transition cursor-pointer"
                  >
                    Load Clean Decal Sample
                  </button>
                  <button
                    onClick={() => handleTriggerScan(1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-bold text-[11px] hover:bg-slate-800 transition cursor-pointer"
                  >
                    Load Level III Sample
                  </button>
                </div>
              </div>

              {/* Optical Document Scanner Dropzone */}
              <div className="p-6 rounded-3xl bg-[#05080E] border-2 border-dashed border-[#1E2532] hover:border-amber-500/50 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group">
                {isScanning && (
                  <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-1 bg-[#FFE500] absolute animate-pulse top-1/2 shadow-[0_0_20px_#FFE500]" />
                  </div>
                )}

                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#FFE500] mb-3 shadow-[0_0_25px_rgba(255,229,0,0.25)]">
                  <span className="material-symbols-outlined text-[36px]">document_scanner</span>
                </div>

                <h3 className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                  SCAN OR DROP DRIVER VEHICLE EXAMINATION REPORT (FORM MCSA-5884)
                </h3>
                <p className="text-xs text-slate-400 font-mono max-w-lg mt-1">
                  Position paper inspection report under cab camera or upload PDF / image file. Optical OCR automatically captures report #, agency, violations, and decal stamp.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => handleTriggerScan(0)}
                    disabled={isScanning}
                    className="btn-tactical-yellow px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    <span>{isScanning ? 'SCANNING DOCUMENT...' : 'CAPTURE VIA CAMERA / OCR'}</span>
                  </button>
                  <label className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span>BROWSE INSPECTION PDF / IMG</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleTriggerScan(0);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Scanned Document Metadata & Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel A: Officer & Inspection Details */}
                <div className="bg-[#05080E] p-5 rounded-2xl border border-[#1E2532] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E2532]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#FFE500] text-[20px]">badge</span>
                      <span className="font-bold text-sm text-white uppercase tracking-wider">
                        ROADSIDE INSPECTION METADATA
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                      OCR: {activeInspection.ocrConfidenceScore}% ACCURACY
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">
                        INSPECTION REPORT NUMBER (FORM MCSA-5884)
                      </label>
                      <input
                        type="text"
                        value={activeInspection.reportNumber}
                        onChange={(e) => setActiveInspection({ ...activeInspection, reportNumber: e.target.value })}
                        className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-[#FFE500] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">INSPECTION LEVEL</label>
                        <select
                          value={activeInspection.inspectionLevel}
                          onChange={(e) => setActiveInspection({ ...activeInspection, inspectionLevel: e.target.value as InspectionLevel })}
                          className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-[#FFE500] outline-none text-xs"
                        >
                          <option value="LEVEL_1_FULL">Level I (Full 37-Step Inspection)</option>
                          <option value="LEVEL_2_WALK_AROUND">Level II (Walk-Around &amp; Driver)</option>
                          <option value="LEVEL_3_DRIVER_ONLY">Level III (Driver / Credentials / HOS)</option>
                          <option value="LEVEL_4_SPECIAL">Level IV (Special Investigation)</option>
                          <option value="LEVEL_5_TERMINAL">Level V (Terminal Audit)</option>
                          <option value="LEVEL_6_RADIOACTIVE">Level VI (Radioactive Materials)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">STATE JURISDICTION</label>
                        <input
                          type="text"
                          value={activeInspection.jurisdictionState}
                          onChange={(e) => setActiveInspection({ ...activeInspection, jurisdictionState: e.target.value.toUpperCase() })}
                          className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-[#FFE500] outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">ENFORCEMENT AGENCY</label>
                      <input
                        type="text"
                        value={activeInspection.enforcementAgency}
                        onChange={(e) => setActiveInspection({ ...activeInspection, enforcementAgency: e.target.value })}
                        className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-[#FFE500] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">OFFICER / TROOPER NAME</label>
                        <input
                          type="text"
                          value={activeInspection.officerName}
                          onChange={(e) => setActiveInspection({ ...activeInspection, officerName: e.target.value })}
                          className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-[#FFE500] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">OFFICER BADGE / STAR #</label>
                        <input
                          type="text"
                          value={activeInspection.officerBadgeNumber}
                          onChange={(e) => setActiveInspection({ ...activeInspection, officerBadgeNumber: e.target.value })}
                          className="w-full bg-[#0A0F14] border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-[#FFE500] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel B: Tagging, Routing Key & FMCSA Web Services */}
                <div className="bg-[#05080E] p-5 rounded-2xl border border-[#1E2532] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E2532]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#FFE500] text-[20px]">cloud_upload</span>
                      <span className="font-bold text-sm text-white uppercase tracking-wider">
                        FMCSA ERODS ROUTING &amp; PAIRING
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-black uppercase font-mono">
                      GATEWAY: READY
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <label className="text-[10px] text-[#FFE500] font-bold uppercase block mb-1">
                        OFFICER ROUTING KEY / FILE COMMENT (REQUIRED BY FMCSA)
                      </label>
                      <input
                        type="text"
                        value={routingKeyComment}
                        onChange={(e) => setRoutingKeyComment(e.target.value)}
                        placeholder="e.g. TX-DPS-INSP-4920"
                        className="w-full bg-[#0A0F14] border-2 border-amber-500/60 rounded-xl px-3 py-2 text-[#FFE500] font-black tracking-wider text-sm focus:border-[#FFE500] outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Provided directly by the roadside safety official during data transfer request.
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">TRANSMISSION METHOD</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTransmissionMethod('FMCSA_WEB_SERVICES')}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            transmissionMethod === 'FMCSA_WEB_SERVICES'
                              ? 'bg-amber-500/10 border-[#FFE500] text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="font-bold text-xs block text-[#FFE500]">FMCSA Web Services</span>
                          <span className="text-[10px] text-slate-400">Primary Instant SOAP / REST</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTransmissionMethod('FMCSA_EMAIL')}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            transmissionMethod === 'FMCSA_EMAIL'
                              ? 'bg-amber-500/10 border-[#FFE500] text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="font-bold text-xs block text-slate-200">FMCSA Encrypted Email</span>
                          <span className="text-[10px] text-slate-400">fmcsa-eld@dot.gov</span>
                        </button>
                      </div>
                    </div>

                    {/* CVSA Decal & Clean Inspection Indicator */}
                    <div className="p-3 bg-[#0A0F14] rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold block text-xs">CVSA SAFETY DECAL ISSUED?</span>
                        <span className="text-[10px] text-slate-400">Awarded for zero critical defects</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeInspection.cvsaDecalIssued}
                        onChange={(e) => setActiveInspection({
                          ...activeInspection,
                          cvsaDecalIssued: e.target.checked,
                          cleanInspection: e.target.checked,
                        })}
                        className="w-5 h-5 accent-[#FFE500] cursor-pointer"
                      />
                    </div>

                    {/* Driver Certification Attestation */}
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/40 rounded-xl space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id="attest-box"
                          checked={isAttested}
                          onChange={(e) => setIsAttested(e.target.checked)}
                          className="w-4 h-4 accent-emerald-500 cursor-pointer mt-0.5"
                        />
                        <label htmlFor="attest-box" className="text-[11px] text-slate-300 leading-snug cursor-pointer">
                          I certify under 49 CFR § 395.8(e) that this Tag-a-Long electronic record and scanned roadside inspection document are true and accurate.
                        </label>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block pl-6">
                        Digitally signed: {DRIVER_INFO.name} ({DRIVER_INFO.cdlNumber})
                      </span>
                    </div>

                    {/* Primary Submit Action */}
                    <button
                      onClick={handleTransmitTagAlongErods}
                      disabled={isTransmitting}
                      className="w-full btn-tactical-yellow py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isTransmitting ? 'sync' : 'cloud_upload'}
                      </span>
                      <span>
                        {isTransmitting
                          ? 'TRANSMITTING TO FMCSA WEB SERVICES...'
                          : '⚡ TRANSMIT TAG-A-LONG ERODS TO FMCSA'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: LIVE ERoDS & SCANNED PAPER PREVIEW                         */}
          {/* ---------------------------------------------------------------- */}
          {viewMode === 'LIVE_PREVIEW' && (
            <div className="space-y-6 animate-fade-in font-mono text-xs">
              <div className="p-4 rounded-2xl bg-[#05080E] border border-[#1E2532] flex items-center justify-between">
                <div>
                  <h3 className="font-['Space_Grotesk'] text-base font-bold text-white uppercase tracking-wider">
                    SIDE-BY-SIDE TAG-A-LONG COMPARISON
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live J1939 Electronic Records (Left) Tagged With Scanned Officer Paper Exam Report (Right)
                  </p>
                </div>

                <button
                  onClick={handlePrintBundle}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-700 text-slate-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>PRINT BUNDLE</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ERoDS Output Stream */}
                <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E2532]">
                    <span className="text-[#FFE500] font-bold uppercase">
                      49 CFR § 395 APPENDIX A ELD OUTPUT STREAM
                    </span>
                    <span className="text-emerald-400 font-bold">10Hz ECM SYNCED</span>
                  </div>
                  <pre className="p-3 bg-black/80 rounded-xl text-[11px] text-slate-300 overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                    {erodsTagAlongService.generateCompliantErodsFile(routingKeyComment)}
                  </pre>
                </div>

                {/* Scanned Inspection Optical OCR */}
                <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E2532]">
                    <span className="text-emerald-400 font-bold uppercase">
                      SCANNED FORM MCSA-5884 OCR TRANSCRIPTION
                    </span>
                    <span className="text-slate-400">Confidence: {activeInspection.ocrConfidenceScore}%</span>
                  </div>
                  <pre className="p-3 bg-black/80 rounded-xl text-[11px] text-emerald-300/90 overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                    {activeInspection.ocrExtractedText}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 3: TRANSMISSION SUCCESS RECEIPT                              */}
          {/* ---------------------------------------------------------------- */}
          {viewMode === 'TRANSMISSION_RECEIPT' && latestReceiptBundle && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#05080E] to-emerald-950/40 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.25)] space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] shrink-0">
                    <span className="material-symbols-outlined text-[36px]">verified</span>
                  </div>
                  <div>
                    <span className="text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider block">
                      OFFICIAL FMCSA VERIFICATION CONFIRMATION
                    </span>
                    <h2 className="font-['Space_Grotesk'] text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                      ERODS TAG-A-LONG SUBMISSION ACCEPTED
                    </h2>
                    <span className="text-xs text-slate-300 font-mono">
                      Gateway Confirmation Code:{' '}
                      <strong className="text-[#FFE500] font-black text-sm">
                        {latestReceiptBundle.fmcsaSubmissionReceiptCode}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-2">
                  <div className="bg-[#05080E] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">INSPECTION REPORT #</span>
                    <span className="text-white font-bold">{latestReceiptBundle.scannedInspection.reportNumber}</span>
                  </div>
                  <div className="bg-[#05080E] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">ROUTING KEY COMMENT</span>
                    <span className="text-[#FFE500] font-bold">{latestReceiptBundle.routingKeyComment}</span>
                  </div>
                  <div className="bg-[#05080E] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">CRYPTOGRAPHIC INTEGRITY</span>
                    <span className="text-emerald-400 font-bold truncate block">
                      {latestReceiptBundle.cryptographicHashSha256.slice(0, 20)}...
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-black/60 rounded-xl border border-emerald-500/30 font-mono text-xs text-slate-300 space-y-1">
                  <p>✔ FMCSA ERoDS 49 CFR Part 395 Web Services protocol: 200 OK Accepted</p>
                  <p>✔ Tag-a-Long Companion document: Form MCSA-5884 attached with zero schema violations</p>
                  <p>✔ Automatically archived to Federal Custody Compliance Vault as Certified Vehicle Record</p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handleDownloadCsv(latestReceiptBundle)}
                    className="btn-tactical-yellow px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>DOWNLOAD TAG-A-LONG AUDIT REPORT (.CSV)</span>
                  </button>

                  <button
                    onClick={handlePrintBundle}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-200 hover:text-white transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                    <span>PRINT VERIFICATION CERTIFICATE</span>
                  </button>

                  <button
                    onClick={() => setViewMode('AUDIT_LEDGER')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-200 hover:text-white transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span>VIEW AUDIT LEDGER</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 4: AUDIT LEDGER & HISTORICAL BUNDLES                         */}
          {/* ---------------------------------------------------------------- */}
          {viewMode === 'AUDIT_LEDGER' && (
            <div className="space-y-4 animate-fade-in font-mono text-xs">
              <div className="p-4 rounded-2xl bg-[#05080E] border border-[#1E2532] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-['Space_Grotesk'] text-base font-bold text-white uppercase tracking-wider">
                    TAG-A-LONG ROADSIDE INSPECTION AUDIT LEDGER
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Permanent Federal Record of All Scanned Roadside Inspections &amp; ERoDS Submissions
                  </p>
                </div>

                <button
                  onClick={() => setViewMode('SCAN_AND_TAG')}
                  className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)] whitespace-nowrap self-stretch sm:self-auto justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>NEW TAG-A-LONG INSPECTION</span>
                </button>
              </div>

              <div className="space-y-3">
                {bundles.map((bundle) => {
                  const insp = bundle.scannedInspection;
                  return (
                    <div
                      key={bundle.bundleId}
                      className="p-4 sm:p-5 rounded-2xl bg-[#05080E] border border-[#1E2532] hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#FFE500] shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[20px]">
                            {insp.cleanInspection ? 'verified' : 'fact_check'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{insp.reportNumber}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[#FFE500] border border-amber-500/30 text-[10px] font-bold">
                              {insp.inspectionLevel.replace(/_/g, ' ')}
                            </span>
                            {insp.cvsaDecalIssued && (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-bold">
                                CVSA DECAL
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Agency: {insp.enforcementAgency} • Officer: {insp.officerName} ({insp.officerBadgeNumber})
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            FMCSA Receipt: {bundle.fmcsaSubmissionReceiptCode} • Comment: {bundle.routingKeyComment}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleDownloadCsv(bundle)}
                          className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-[#FFE500] text-black hover:brightness-110 transition flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)]"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          <span>CSV Report</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* 4. FOOTER                                                          */}
        {/* ================================================================== */}
        <div className="p-4 border-t border-[#1E2532] bg-[#05080E] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#FFE500]">verified_user</span>
            <span>49 CFR § 395.24 &amp; § 395.34 Electronic Records of Duty Status Certified Engine</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl btn-tactical-yellow text-xs font-black uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
          >
            RETURN TO COCKPIT HUD
          </button>
        </div>

      </div>
    </div>
  );
};
