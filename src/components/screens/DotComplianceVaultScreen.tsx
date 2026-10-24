import React, { useState, useEffect, useMemo } from 'react';
import { DotDocumentRecord, DotDocCategory, DotDocStatus, InspectionTriggerSource, FleetDriverFileRecord } from '../../types';
import { dotDocumentsService } from '../../services/dotDocumentsService';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO } from '../../data/mockData';
import { fleetFederalVaultService } from '../../services/fleetFederalVaultService';
import { FleetVehicleRecord } from '../../data/mockFleetDqfData';

interface DotComplianceVaultScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
}

type VaultSubModule = 'DRIVER_DQF' | 'VEHICLE_FLEET' | 'ELD_HOS_LOGS' | 'ALL_RECORDS' | 'FEDERAL_CUSTODY';

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
    fleetFederalVaultService.getDriverFiles()
  );
  const [vehicleFiles, setVehicleFiles] = useState<FleetVehicleRecord[]>(() =>
    fleetFederalVaultService.getVehicleFiles()
  );
  const [attestation, setAttestation] = useState(() => fleetFederalVaultService.getAttestation());
  const [selectedDriverId, setSelectedDriverId] = useState<string>('drv-jeremiah-904');

  // Modals state
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DotDocumentRecord | null>(null);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<DotDocumentRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCustodySignModal, setShowCustodySignModal] = useState<boolean>(false);

  // Sign custody form
  const [custodianNameInput, setCustodianNameInput] = useState<string>(DRIVER_INFO.name);
  const [custodianTitleInput, setCustodianTitleInput] = useState<string>('Director of Fleet Safety & Compliance Custodian');

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
      driverName: DRIVER_INFO.name,
      unitNumber: 'TRK-904',
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
    const jsonStr = fleetFederalVaultService.generateRoadsideAuditPackageJSON(selectedDriverId);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FMCSA_DOT_Certified_Audit_Dossier_USDOT_${CARRIER_INFO.usdot}_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onShowToast('EXPORTED OFFICIAL 49 CFR FLEET AUDIT DOSSIER & DQF RECORD (JSON/HASH-SEALED)', 'download');
    if (onGenerateNewPdf) {
      onGenerateNewPdf('OFFICER_REQUEST', 'Full 49 CFR Fleet Compliance Audit Dossier Package Generated.');
    }
  };

  const handleSignCustodySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = fleetFederalVaultService.signLegalAttestation(custodianNameInput, custodianTitleInput);
    setAttestation(updated);
    setShowCustodySignModal(false);
    onShowToast('OFFICIAL LEGAL CUSTODY ATTESTATION SIGNED UNDER 49 CFR § 390.31', 'verified');
    if (onRecordInspectionLog) {
      onRecordInspectionLog(
        'ROADSIDE_AUDIT',
        'QUANTUM_INDEX_AUDIT',
        `EXECUTED FORMAL FEDERAL CUSTODY ATTESTATION: ${custodianNameInput} (${custodianTitleInput}) // USDOT #${CARRIER_INFO.usdot} // Hash: ${updated.digitalSignatureSha256.substring(0, 16)}...`
      );
    }
  };

  return (
    <div className="space-y-space-md font-mono text-on-surface pb-space-2xl">
      {/* ==================================================================== */}
      {/* 1. FEDERAL CUSTODY RESPONSIBILITY & CERTIFICATION BANNER            */}
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
                  UNITED STATES DOT &amp; FMCSA CERTIFIED FLEET CUSTODY VAULT
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/40">
                  49 CFR § 390.31 COMPLIANT
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Full Legal Custody of Federal Motor Carrier Records: Driver Qualification Files (Part 391), ELD HOS Logs (Part 395) &amp; Vehicle Inspections (Part 396)
              </p>
            </div>
          </div>

          {/* Major One-Click Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowCustodySignModal(true)}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-primary border border-primary/40 font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">draw</span>
              <span>Sign Legal Custody</span>
            </button>

            <button
              onClick={handleExportFullDossier}
              className="px-3 py-2 rounded-xl btn-tactical-yellow font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Official DOT Officer Dossier</span>
            </button>
          </div>
        </div>

        {/* Legal Custody Attestation Statement Box */}
        <div className="p-3.5 rounded-xl bg-[#05080E] border border-emerald-500/40 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>FEDERALLY ATTESTED LEGAL CUSTODIAN OF RECORDS // CARRIER RESPONSIBILITY DECLARED</span>
            </span>
            <span>EXPIRY: {attestation.retentionExpiryDate}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Carrier <strong>{attestation.carrierLegalName}</strong> (USDOT #{attestation.usdotNumber} / {attestation.mcNumber}) accepts statutory custody of all electronic commercial vehicle files under <strong>49 CFR § 390.31</strong>. Electronic signatures, tamper-evident SHA-256 Merkle root hashes, and original document scans are maintained and retrievable within 48 hours for federal roadside and compliance audits.
          </p>
          <div className="text-[10px] text-slate-400 flex items-center gap-3 pt-1 border-t border-slate-800">
            <span>Custodian: <strong className="text-white">{attestation.certifiedCustodianName} ({attestation.custodianTitle})</strong></span>
            <span>&bull;</span>
            <span className="text-emerald-400 truncate">SHA-256 Seal: {attestation.digitalSignatureSha256.substring(0, 24)}...</span>
          </div>
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
            <span className="text-[10px] text-slate-500 block">49 CFR Part 396 Certified</span>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 text-xs">
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

          <button
            onClick={() => setActiveSubModule('FEDERAL_CUSTODY')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 col-span-2 md:col-span-1 ${
              activeSubModule === 'FEDERAL_CUSTODY'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">policy</span>
            <span>Custody Attestation</span>
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
                Certified ELD Hours of Service Records (8-Day FMCSA Packages)
              </h3>
              <p className="text-[11px] text-slate-400">
                Statutory 6-Month Retention Mandate under 49 CFR § 395.8 &bull; Cryptographically Verified Duty Grids
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white">
                CURRENT 8-DAY CYCLE LEDGER // {DRIVER_INFO.name} ({EQUIPMENT_INFO.powerUnit})
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                0 HOS VIOLATIONS DETECTED
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { date: 'Oct 24, 2026', drive: '08h 15m', onDuty: '10h 20m', off: '13h 40m', miles: 512, status: 'COMPLIANT' },
                { date: 'Oct 23, 2026', drive: '07h 45m', onDuty: '09h 50m', off: '14h 10m', miles: 488, status: 'COMPLIANT' },
                { date: 'Oct 22, 2026', drive: '08h 30m', onDuty: '10h 40m', off: '13h 20m', miles: 534, status: 'COMPLIANT' },
                { date: 'Oct 21, 2026', drive: '06h 10m', onDuty: '08h 15m', off: '15h 45m', miles: 382, status: 'COMPLIANT' },
                { date: 'Oct 20, 2026', drive: '09h 00m', onDuty: '11h 00m', off: '13h 00m', miles: 560, status: 'COMPLIANT' },
              ].map((day, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#05080E] border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <strong className="text-white block">{day.date}</strong>
                    <span className="text-[10px] text-slate-400">Total Miles: {day.miles} mi</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span>Drive: <strong className="text-primary">{day.drive}</strong></span>
                    <span>On-Duty: <strong className="text-slate-200">{day.onDuty}</strong></span>
                    <span>Off-Duty: <strong className="text-slate-400">{day.off}</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    {day.status}
                  </span>
                </div>
              ))}
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

      {/* ==================================================================== */}
      {/* MODULE 5: FEDERAL CUSTODY ATTESTATION & OFFICER PACKAGE              */}
      {/* ==================================================================== */}
      {activeSubModule === 'FEDERAL_CUSTODY' && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-5 rounded-2xl bg-[#0A0F14] border-2 border-primary/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <span className="material-symbols-outlined text-primary text-[28px]">policy</span>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  49 CFR § 390.31 Legal Custody &amp; Electronic Signature Declaration
                </h3>
                <p className="text-[11px] text-slate-400">
                  Carrier Responsibility and Electronic Records Integrity Attestation
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                Under Title 49, Code of Federal Regulations, § 390.31, commercial motor carriers are authorized to generate, sign, and maintain records in electronic formats, provided that the electronic storage system ensures:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                <li>Accurate representation of the original information and signatures</li>
                <li>Tamper-evident preservation against unauthorized alteration, deletion, or loss</li>
                <li>Immediate availability for inspection by authorized FMCSA safety investigators and state law enforcement personnel within 48 hours</li>
                <li>Cryptographic integrity and audit trails for all renewals, attestations, and certified inspections</li>
              </ul>
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800 space-y-1">
                <div className="text-[10px] text-primary font-bold uppercase">ACTIVE LEGAL CUSTODIAN OF RECORD:</div>
                <div className="text-sm font-bold text-white">{attestation.certifiedCustodianName}</div>
                <div className="text-[11px] text-slate-400">{attestation.custodianTitle} &bull; {attestation.carrierLegalName}</div>
                <div className="text-[10px] text-emerald-400 pt-1">
                  Digital Signature Hash: {attestation.digitalSignatureSha256}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCustodySignModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-primary font-bold text-xs uppercase cursor-pointer"
              >
                Re-Attest / Update Custodian
              </button>
              <button
                onClick={handleExportFullDossier}
                className="px-4 py-2 rounded-xl btn-tactical-yellow font-black text-xs uppercase cursor-pointer shadow-lg"
              >
                Export Complete Audit Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custody Signature Modal */}
      {showCustodySignModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
          <div className="bg-[#0A0F14] p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">draw</span>
                <span>Sign Federal Custody Attestation</span>
              </h3>
              <button
                onClick={() => setShowCustodySignModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSignCustodySubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Designated Custodian of Records Name:
                </label>
                <input
                  type="text"
                  value={custodianNameInput}
                  onChange={(e) => setCustodianNameInput(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Official Title:
                </label>
                <input
                  type="text"
                  value={custodianTitleInput}
                  onChange={(e) => setCustodianTitleInput(e.target.value)}
                  className="w-full bg-[#05080E] border border-slate-800 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-[#05080E] border border-slate-800 text-[10px] text-slate-400">
                By clicking &quot;Cryptographically Sign &amp; Accept Legal Responsibility&quot;, you attest under penalty of 49 U.S.C. § 521 that this motor carrier maintains genuine, tamper-evident custody of all commercial vehicle and driver files in compliance with 49 CFR § 390.31.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustodySignModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold uppercase text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-tactical-yellow font-black uppercase text-xs cursor-pointer"
                >
                  Cryptographically Sign &amp; Accept Legal Responsibility
                </button>
              </div>
            </form>
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
