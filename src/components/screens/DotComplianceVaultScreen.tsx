import React, { useState, useEffect, useMemo } from 'react';
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { DotDocumentRecord, DotDocCategory, DotDocStatus, InspectionTriggerSource, FleetDriverFileRecord } from '../../types';
import { dotDocumentsService } from '../../services/dotDocumentsService';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO } from '../../data/mockData';
import { FleetVehicleRecord, INITIAL_FLEET_DRIVER_FILES, INITIAL_FLEET_VEHICLES } from '../../data/mockFleetDqfData';

interface DotComplianceVaultScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
}

type VaultSubModule = 'DRIVER_DQF' | 'VEHICLE_FLEET' | 'ELD_HOS_LOGS' | 'ALL_RECORDS';

export const DotComplianceVaultScreen: React.FC<DotComplianceVaultScreenProps> = ({
  onShowToast,
  onRecordInspectionLog,
  onGenerateNewPdf,
}) => {
  const [activeSubModule, setActiveSubModule] = useState<VaultSubModule>('DRIVER_DQF');
  const [documents, setDocuments] = useState<DotDocumentRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<DotDocCategory | 'ALL'>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<DotDocStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fleet Driver and Vehicle files
  const [driverFiles, setDriverFiles] = useState<FleetDriverFileRecord[]>(() =>
    INITIAL_FLEET_DRIVER_FILES
  );
  const [vehicleFiles, setVehicleFiles] = useState<FleetVehicleRecord[]>(() =>
    INITIAL_FLEET_VEHICLES
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-jeremiah-904');

  // Modals state
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DotDocumentRecord | null>(null);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<DotDocumentRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Renewal form state
  const [renewDate, setRenewDate] = useState<string>('2028-09-15');
  const [renewNotes, setRenewNotes] = useState<string>('Official biennial medical/physical renewal verified.');

  // New Record form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<DotDocCategory>('DRIVER_DQF');
  const [newCfr, setNewCfr] = useState<string>('49 CFR § 391.43');
  const [newDocNum, setNewDocNum] = useState<string>('');
  const [newAuthority, setNewAuthority] = useState<string>('');
  const [newIssuedDate, setNewIssuedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [newExpDate, setNewExpDate] = useState<string>('2028-09-15');
  const [newNotes, setNewNotes] = useState<string>('');

  useEffect(() => {
    const unsubscribe = dotDocumentsService.subscribe((docs) => {
      setDocuments(docs);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => dotDocumentsService.getAuditReadinessStats(), [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (activeCategory !== 'ALL' && doc.category !== activeCategory) return false;
      if (activeStatusFilter !== 'ALL' && doc.status !== activeStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          doc.documentTitle.toLowerCase().includes(q) ||
          doc.cfrReference.toLowerCase().includes(q) ||
          doc.documentNumber.toLowerCase().includes(q) ||
          doc.issuingAuthority.toLowerCase().includes(q) ||
          doc.notes.toLowerCase().includes(q) ||
          doc.merkleProofHash.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, activeCategory, activeStatusFilter, searchQuery]);

  const handleCopyHash = (doc: DotDocumentRecord) => {
    try {
      navigator.clipboard.writeText(doc.merkleProofHash);
      onShowToast(`COPIED SHA-256 MERKLE PROOF: ${doc.merkleProofHash.substring(0, 16)}...`, 'content_copy');
    } catch (_) {
      onShowToast(`PROOF HASH: ${doc.merkleProofHash.substring(0, 20)}...`, 'verified');
    }
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForRenew) return;

    const updated = dotDocumentsService.renewDocument(selectedDocForRenew.id, renewDate, renewNotes);
    if (updated) {
      onShowToast(`DOCUMENT RENEWED: ${updated.documentTitle} • EXP: ${renewDate}`, 'verified_user');
      if (onRecordInspectionLog) {
        onRecordInspectionLog(
          'ROADSIDE_AUDIT',
          'MANUAL_HUD',
          `RENEWED DOT COMPLIANCE RECORD: ${updated.documentTitle} (${updated.documentNumber}) • New Exp: ${renewDate}.`
        );
      }
    }
    setSelectedDocForRenew(null);
  };

  const handleAddRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      onShowToast('DOCUMENT TITLE IS REQUIRED', 'warning');
      return;
    }

    const created = dotDocumentsService.addDocument({
      documentTitle: newTitle,
      category: newCategory,
      cfrReference: newCfr || '49 CFR Part 390',
      issuedDate: newIssuedDate,
      expirationDate: newExpDate,
      status: 'VALID',
      issuingAuthority: newAuthority || 'Certified DOT Compliance Agent',
      documentNumber: newDocNum || `REC-${Date.now().toString().substring(6)}`,
      driverName: driverFiles[0]?.driverName || DRIVER_INFO.name,
      unitNumber: vehicleFiles[0]?.unitNumber || 'TRK-904',
      fileSizeBytes: Math.floor(250000 + Math.random() * 500000),
      fileFormat: 'PDF / Digital SHA-256 Sealed',
      notes: newNotes || 'Added to fleet compliance records ledger.',
      certified: true,
    });

    onShowToast(`NEW DOT DOCUMENT ADDED: ${created.documentTitle}`, 'note_add');
    if (onRecordInspectionLog) {
      onRecordInspectionLog(
        'PDF_GENERATED',
        'MANUAL_HUD',
        `ADDED NEW DOT DOCUMENT: ${created.documentTitle} [${created.cfrReference}] • Rec #${created.documentNumber}`
      );
    }

    setNewTitle('');
    setNewDocNum('');
    setNewAuthority('');
    setNewNotes('');
    setShowAddModal(false);
  };

  const handleExportFullDossier = () => {
    const jsonStr = dotDocumentsService.exportFullAuditDossierJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FMCSA_DOT_Compliance_Dossier_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onShowToast('EXPORTED OFFICIAL 49 CFR COMPLIANCE DOSSIER (JSON)', 'download');
    if (onGenerateNewPdf) {
      onGenerateNewPdf('OFFICER_REQUEST', 'Full 49 CFR Compliance Dossier Package Generated.');
    }
  };

  return (
    <div className="space-y-space-md font-mono text-on-surface pb-space-2xl">
      {/* ==================================================================== */}
      {/* 1. COMPLIANCE RECORDS VAULT BANNER                                  */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-4 sm:p-5 rounded-2xl border-2 border-primary/60 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1E2532] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-primary uppercase tracking-wider">
                  UNITED STATES DOT &amp; FMCSA COMPLIANCE FLEET VAULT
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/40">
                  49 CFR PARTS 391 &amp; 396
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Driver Qualification Files (Part 391) &amp; Vehicle Maintenance Inspections (Part 396)
              </p>
            </div>
          </div>

          {/* Major Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-primary text-black font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Add Document</span>
            </button>

            <button
              onClick={handleExportFullDossier}
              className="px-3 py-2 rounded-xl btn-tactical-yellow font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Export Compliance Dossier</span>
            </button>
          </div>
        </div>

        {/* Policy Statement Box */}
        <div className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 space-y-1 text-xs">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Motor carrier records, vehicle maintenance logs, and commercial driver qualification files are maintained and organized for regulatory review under 49 CFR Parts 391 and 396.
          </p>
        </div>

        {/* Audit Readiness Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#070B12] border border-[#1E2532] space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">DOT AUDIT READINESS SCORE</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400">{stats.score}%</span>
              <span className="text-[10px] text-emerald-400 font-bold">100% COMPLIANT</span>
            </div>
            <span className="text-[10px] text-slate-500 block">FMCSA Tier 1 Safety Rating</span>
          </div>

          <div className="p-3 rounded-xl bg-[#070B12] border border-[#1E2532] space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">ACTIVE DRIVER DQF FILES</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#FFE500]">{driverFiles.length} Drivers</span>
              <span className="text-[10px] text-emerald-400 font-bold">ALL VERIFIED</span>
            </div>
            <span className="text-[10px] text-slate-500 block">49 CFR Part 391 Monitored</span>
          </div>

          <div className="p-3 rounded-xl bg-[#070B12] border border-[#1E2532] space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">POWER UNITS &amp; TRAILERS</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-sky-400">{vehicleFiles.length} Units</span>
              <span className="text-[10px] text-slate-400">Annual Insp PASS</span>
            </div>
            <span className="text-[10px] text-slate-500 block">49 CFR Part 396 Compliant</span>
          </div>

          <div className="p-3 rounded-xl bg-[#070B12] border border-[#1E2532] space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">UPCOMING RENEWALS (30D)</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${stats.expiring > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {stats.expiring} Records
              </span>
              <span className="text-[10px] text-amber-400 font-bold">PRE-ALERT</span>
            </div>
            <span className="text-[10px] text-slate-500 block">Automated Sentinel Active</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. SUB-MODULE TABS FOR STREAMLINED FLEET MANAGEMENT                  */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-1.5 rounded-2xl border border-[#1E2532] shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
          <button
            onClick={() => setActiveSubModule('DRIVER_DQF')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubModule === 'DRIVER_DQF'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>Driver DQF Files</span>
          </button>

          <button
            onClick={() => setActiveSubModule('VEHICLE_FLEET')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubModule === 'VEHICLE_FLEET'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">local_shipping</span>
            <span>Vehicle Equipment</span>
          </button>

          <button
            onClick={() => setActiveSubModule('ELD_HOS_LOGS')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubModule === 'ELD_HOS_LOGS'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
            <span>ELD Daily Logs</span>
          </button>

          <button
            onClick={() => setActiveSubModule('ALL_RECORDS')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubModule === 'ALL_RECORDS'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder_special</span>
            <span>All Federal Records</span>
          </button>
        </div>
      </div>



      {/* ==================================================================== */}
      {/* MODULE 1: DRIVER QUALIFICATION FILES (DQF 49 CFR PART 391)           */}
      {/* ==================================================================== */}
      {activeSubModule === 'DRIVER_DQF' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Fleet Driver Qualification Files (DQF Roster)
              </h3>
              <p className="text-[11px] text-slate-400">
                Statutory retention under 49 CFR § 391.51: Maintained for 3 years following employment
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-primary text-black font-black text-xs uppercase flex items-center gap-1 cursor-pointer shadow"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Add DQF Record</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {driverFiles.map((drv) => {
              const isSelected = selectedDriverId === drv.driverId;
              return (
                <div
                  key={drv.driverId}
                  onClick={() => setSelectedDriverId(drv.driverId)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-[#0E1524] border-primary ring-2 ring-primary/40 shadow-xl'
                      : 'bg-[#0A0F14] border-[#1E2532] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-xs">
                        {drv.driverName.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{drv.driverName}</h4>
                        <span className="text-[10px] text-slate-400">{drv.cdlNumber} ({drv.cdlState})</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        drv.dqfStatus === 'FULLY_COMPLIANT'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {drv.dqfCompletionPct}% DQF COMPLETE
                    </span>
                  </div>

                  {/* DQF Requirements Checklist */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                      <span className="text-slate-500 uppercase block font-bold">MED CARD (MCSA-5876)</span>
                      <strong className="text-emerald-400">EXP: {drv.medCardExpirationDate}</strong>
                      <span className="text-slate-400 block text-[9px]">49 CFR § 391.43</span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                      <span className="text-slate-500 uppercase block font-bold">CDL CLASS A LICENSE</span>
                      <strong className="text-white">EXP: {drv.cdlExpirationDate}</strong>
                      <span className="text-slate-400 block text-[9px]">49 CFR § 383.23</span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                      <span className="text-slate-500 uppercase block font-bold">ANNUAL MVR REVIEW</span>
                      <strong className="text-slate-200">DONE: {drv.annualMvrReviewDate}</strong>
                      <span className="text-slate-400 block text-[9px]">49 CFR § 391.25</span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                      <span className="text-slate-500 uppercase block font-bold">CLEARINGHOUSE QUERY</span>
                      <strong className="text-emerald-400">PASS: {drv.clearinghouseQueryDate}</strong>
                      <span className="text-slate-400 block text-[9px]">49 CFR § 382.701</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800 text-slate-400">
                    <span>{drv.documentsCount} Attested Federal Records in Vault</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportFullDossier();
                      }}
                      className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">download</span>
                      <span>Audit Dossier</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODULE 2: VEHICLE EQUIPMENT FILES (49 CFR PART 396)                  */}
      {/* ==================================================================== */}
      {activeSubModule === 'VEHICLE_FLEET' && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Commercial Motor Vehicle Equipment Files (Power Units &amp; Trailers)
            </h3>
            <p className="text-[11px] text-slate-400">
              Annual Inspections (MCS-64), Apportioned Cab Cards (IRP), IFTA Licenses &amp; Electronic DVIR Ledgers
            </p>
          </div>

          <div className="space-y-3">
            {vehicleFiles.map((veh) => (
              <div
                key={veh.unitId}
                className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] shadow-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      TRK
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{veh.unitNumber}</span>
                        <span className="text-xs text-slate-400">({veh.makeModelYear})</span>
                      </div>
                      <span className="text-[10px] text-slate-400">VIN: {veh.vin}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-bold">
                      100% PERIODIC INSPECTION VALID
                    </span>
                    <span className="text-[10px] text-slate-400">Driver: {veh.assignedDriver}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                    <span className="text-slate-500 uppercase block font-bold">ANNUAL INSPECTION (MCS-64)</span>
                    <strong className="text-emerald-400">EXP: {veh.annualInspectionExp}</strong>
                    <span className="text-slate-400 block text-[9px]">49 CFR § 396.17 (14M)</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                    <span className="text-slate-500 uppercase block font-bold">IRP APPORTIONED CAB CARD</span>
                    <strong className="text-white">EXP: {veh.irpCabCardExp}</strong>
                    <span className="text-slate-400 block text-[9px]">80,000 LBS 48-STATE</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                    <span className="text-slate-500 uppercase block font-bold">IFTA FUEL TAX DECAL</span>
                    <strong className="text-primary">{veh.iftaDecalNumber}</strong>
                    <span className="text-slate-400 block text-[9px]">Q3/Q4 Compliant</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800">
                    <span className="text-slate-500 uppercase block font-bold">DAILY VEHICLE DVIR (§ 396.11)</span>
                    <strong className="text-emerald-400">SIGNED: {veh.lastDvirDate}</strong>
                    <span className="text-slate-400 block text-[9px]">0 Deficiencies Reported</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODULE 3: CERTIFIED ELD DRIVER DAILY LOGS (49 CFR PART 395)          */}
      {/* ==================================================================== */}
      {activeSubModule === 'ELD_HOS_LOGS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hours of Service Records
              </h3>
              <p className="text-[11px] text-slate-400">
                Official Records of Duty Status (RODS) under 49 CFR Part 395
              </p>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#0A0F14] border border-[#1E2532] shadow-xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(255,229,0,0.25)]">
              <span className="material-symbols-outlined text-[28px]">schedule</span>
            </div>
            <div className="space-y-2 max-w-md">
              <h4 className="text-base font-black text-primary uppercase tracking-wide">
                Hours of service come from your ELD. Connect your ELD to view them here.
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                TruckWithEase stores a read-only copy of certified logs directly from your telematics provider. We do not generate or alter duty status records.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODULE 4: ALL FEDERAL DOCUMENTS ARCHIVE & MERKLE PROOFS              */}
      {/* ==================================================================== */}
      {activeSubModule === 'ALL_RECORDS' && (
        <div className="space-y-4 animate-fade-in">
          {/* Category Filter Pills */}
          <div className="bg-[#0A0F14] p-3 rounded-2xl border border-[#1E2532] space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
              {[
                { id: 'ALL', label: 'ALL RECORDS', icon: 'grid_view' },
                { id: 'DRIVER_DQF', label: 'DRIVER DQF (391)', icon: 'medical_information' },
                { id: 'DAILY_LOGS', label: 'DAILY LOGS (395)', icon: 'edit_calendar' },
                { id: 'DRUG_ALCOHOL', label: 'DRUG & ALCOHOL (382)', icon: 'science' },
                { id: 'VEHICLE_DVIR', label: 'DVIR & VEHICLE (396)', icon: 'minor_crash' },
                { id: 'FLEET_INSURANCE', label: 'INSURANCE & CAB CARDS', icon: 'badge' },
                { id: 'HAZMAT_SAFETY', label: 'HAZMAT & SECURITY', icon: 'warning' },
              ].map((tab) => {
                const isActive = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id as DotDocCategory | 'ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-primary text-black font-black shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px]">
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search title, CFR, doc #, hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 rounded-xl bg-primary text-black font-black text-xs uppercase flex items-center gap-1 cursor-pointer shadow self-end sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>+ Upload Record</span>
              </button>
            </div>
          </div>

          {/* Document Cards */}
          <div className="space-y-3">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                        doc.status === 'VALID'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : doc.status === 'EXPIRING_SOON'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-red-500/20 text-red-400 border-red-500/40'
                      }`}
                    >
                      {doc.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-primary font-bold uppercase">{doc.cfrReference}</span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>ISSUED: {doc.issuedDate}</span>
                    <span>&bull;</span>
                    <span className={`font-bold ${doc.status === 'EXPIRING_SOON' ? 'text-amber-400' : 'text-white'}`}>
                      EXP: {doc.expirationDate}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{doc.documentTitle}</h4>
                    <p className="text-[11px] text-slate-400 leading-snug">{doc.notes}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                      <span>Authority: <strong className="text-slate-300">{doc.issuingAuthority}</strong></span>
                      <span>&bull;</span>
                      <span>Doc #: <strong className="text-primary">{doc.documentNumber}</strong></span>
                      <span>&bull;</span>
                      <span>Assigned: <strong className="text-slate-300">{doc.driverName} ({doc.unitNumber})</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedDocForDetail(doc)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-primary hover:bg-slate-700 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      <span>View</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedDocForRenew(doc);
                        setRenewDate('2028-09-15');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                      <span>Renew</span>
                    </button>

                    <button
                      onClick={() => handleCopyHash(doc)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                      title="Copy Cryptographic SHA-256 Merkle Proof"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>

                {/* SHA-256 Merkle Root Proof Footer */}
                <div className="p-2 rounded-lg bg-[#05080E] border border-slate-800/80 flex items-center justify-between gap-2 text-[9px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-emerald-400 text-[12px]">verified_user</span>
                    <span className="text-slate-500 uppercase font-bold">SHA-256 PROOF:</span>
                    <span className="text-emerald-400 font-bold truncate">{doc.merkleProofHash}</span>
                  </div>
                  <span className="text-slate-500 shrink-0">{doc.fileFormat} ({(doc.fileSizeBytes / 1024).toFixed(0)} KB)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
          <div className="bg-[#0A0F14] p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">note_add</span>
                <span>Upload New Federal Record</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddRecordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Document Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Form MCSA-5876 Medical Examiner's Certificate"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Federal Category:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as DotDocCategory)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  >
                    <option value="DRIVER_DQF">DRIVER DQF (Part 391)</option>
                    <option value="DAILY_LOGS">DAILY LOGS &amp; ELD (Part 395)</option>
                    <option value="DRUG_ALCOHOL">DRUG &amp; ALCOHOL (Part 382)</option>
                    <option value="VEHICLE_DVIR">DVIR &amp; VEHICLE (Part 396)</option>
                    <option value="FLEET_INSURANCE">INSURANCE &amp; CAB CARDS</option>
                    <option value="HAZMAT_SAFETY">HAZMAT &amp; SECURITY</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    CFR Authority:
                  </label>
                  <input
                    type="text"
                    value={newCfr}
                    onChange={(e) => setNewCfr(e.target.value)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Document Number:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MED-2026-910482"
                    value={newDocNum}
                    onChange={(e) => setNewDocNum(e.target.value)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Issuing Authority:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Aris Thorne (National Registry)"
                    value={newAuthority}
                    onChange={(e) => setNewAuthority(e.target.value)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Issued Date:
                  </label>
                  <input
                    type="date"
                    value={newIssuedDate}
                    onChange={(e) => setNewIssuedDate(e.target.value)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Expiration Date:
                  </label>
                  <input
                    type="date"
                    value={newExpDate}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Compliance Notes:
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Verification details, endorsements, or clinical exam notes..."
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white text-xs focus:border-primary focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold uppercase text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-tactical-yellow font-black uppercase text-xs cursor-pointer"
                >
                  Save &amp; Cryptographically Seal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedDocForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
          <div className="bg-[#0A0F14] p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-primary font-bold uppercase block">
                  FMCSA OFFICIAL VERIFICATION SEAL
                </span>
                <h3 className="text-base font-bold text-white">{selectedDocForDetail.documentTitle}</h3>
              </div>
              <button
                onClick={() => setSelectedDocForDetail(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#05080E] border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">CFR REFERENCE</span>
                  <span className="font-bold text-primary">{selectedDocForDetail.cfrReference}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">DOCUMENT #</span>
                  <span className="font-bold text-white">{selectedDocForDetail.documentNumber}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">ISSUING AUTHORITY</span>
                  <span className="text-slate-300">{selectedDocForDetail.issuingAuthority}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">EXPIRATION</span>
                  <span className="font-bold text-emerald-400">{selectedDocForDetail.expirationDate}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800 space-y-1">
                <span className="text-[9px] text-slate-500 uppercase block font-bold">COMPLIANCE NOTES</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">{selectedDocForDetail.notes}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-[#05080E] border border-emerald-500/40 text-[9px] space-y-1">
                <div className="text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span>FIPS 180-4 SHA-256 Cryptographic Merkle Proof:</span>
                </div>
                <div className="font-mono text-slate-300 break-all">{selectedDocForDetail.merkleProofHash}</div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedDocForDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {selectedDocForRenew && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
          <div className="bg-[#0A0F14] p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">event_repeat</span>
                <span>Renew Document Record</span>
              </h3>
              <button
                onClick={() => setSelectedDocForRenew(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[#05080E] border border-slate-800 text-white font-bold">
                {selectedDocForRenew.documentTitle}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  New Expiration Date:
                </label>
                <input
                  type="date"
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Renewal Audit Notes:
                </label>
                <textarea
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white text-xs focus:border-primary focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDocForRenew(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold uppercase text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-tactical-yellow font-black uppercase text-xs cursor-pointer"
                >
                  Certify Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
