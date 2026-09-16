import React, { useState, useEffect, useMemo } from 'react';
import { DotDocumentRecord, DotDocCategory, DotDocStatus, InspectionTriggerSource } from '../../types';
import { dotDocumentsService } from '../../services/dotDocumentsService';
import { CARRIER_INFO, DRIVER_INFO } from '../../data/mockData';

interface DotComplianceVaultScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
}

export const DotComplianceVaultScreen: React.FC<DotComplianceVaultScreenProps> = ({
  onShowToast,
  onRecordInspectionLog,
  onGenerateNewPdf,
}) => {
  const [documents, setDocuments] = useState<DotDocumentRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<DotDocCategory | 'ALL'>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<DotDocStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

    // Reset form
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
    a.download = `DOT_Fleet_Audit_Dossier_${DRIVER_INFO.name.replace(' ', '_')}_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onShowToast('EXPORTED COMPLETE DOT FLEET COMPLIANCE AUDIT DOSSIER (JSON)', 'download');
    if (onGenerateNewPdf) {
      onGenerateNewPdf('OFFICER_REQUEST', 'Full 49 CFR Fleet Compliance Audit Dossier Package Generated.');
    }
  };

  const handleAttestAllToVault = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const notes = `ATTESTED FULL DOT FLEET RECORDS LEDGER (${documents.length} Records) // Score: ${stats.score}% // Carrier: ${CARRIER_INFO.name} (USDOT #${CARRIER_INFO.usdot}) // Driver: ${DRIVER_INFO.name} (${DRIVER_INFO.cdlNumber}) // Attested at ${timestamp}.`;

    if (onRecordInspectionLog) {
      onRecordInspectionLog('ROADSIDE_AUDIT', 'QUANTUM_INDEX_AUDIT', notes);
    }
    onShowToast('ALL DOT RECORDS & DQF FILES SIGNED & ATTESTED TO HSM VAULT LEDGER', 'lock');
  };

  return (
    <div className="space-y-space-md font-mono text-on-surface pb-space-2xl">
      {/* Vault Screen Header */}
      <div className="bg-surface-container p-space-md rounded-xl border border-primary/50 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">folder_special</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
                  TRUCKWITHEASE DOT FLEET COMPLIANCE &amp; DQF VAULT
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                  TITLE 49 CFR VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-outline mt-0.5">
                Centralized Driver Qualification Files (DQF), Daily Logs, Medical Cards, Physicals, Drug &amp; Alcohol CCFs &amp; DVIR Records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>New DOT Record</span>
            </button>

            <button
              onClick={handleExportFullDossier}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-primary border border-primary/40 font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Dossier</span>
            </button>

            <button
              onClick={handleAttestAllToVault}
              className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>Attest to Vault</span>
            </button>
          </div>
        </div>

        {/* Audit Readiness Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm text-[11px]">
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">FLEET AUDIT READINESS SCORE</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[22px] font-bold text-emerald-400">{stats.score}%</span>
              <span className="text-[9px] text-emerald-400 font-bold">PASSING</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">TOTAL VERIFIED RECORDS</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[22px] font-bold text-primary">{stats.total}</span>
              <span className="text-[9px] text-outline">FIPS 180-4 Sealed</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">EXPIRING REVIEWS (30 DAYS)</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-[22px] font-bold ${stats.expiring > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.expiring}
              </span>
              <span className="text-[9px] text-outline">Renewal Alerts</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">CRITICAL EXPIRED RECORDS</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-[22px] font-bold ${stats.expired > 0 ? 'text-error' : 'text-emerald-400'}`}>
                {stats.expired}
              </span>
              <span className="text-[9px] text-outline">Action Required</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-surface-container p-3 rounded-xl border border-surface-container-high/60 space-y-3">
        {/* Category Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
          {[
            { id: 'ALL', label: 'ALL RECORDS', icon: 'grid_view' },
            { id: 'DAILY_LOGS', label: 'DAILY LOGS & ELD (395)', icon: 'edit_calendar' },
            { id: 'DRIVER_DQF', label: 'DRIVER DQF & MEDICAL (391)', icon: 'medical_information' },
            { id: 'DRUG_ALCOHOL', label: 'DRUG & ALCOHOL (382)', icon: 'science' },
            { id: 'VEHICLE_DVIR', label: 'DVIR & INSPECTIONS (396)', icon: 'minor_crash' },
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
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'bg-surface-container-low text-outline hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Pills & Search Box */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-surface-container-high pt-2">
          <div className="flex items-center gap-2 text-[10px] w-full sm:w-auto">
            <span className="text-outline uppercase font-bold shrink-0">STATUS:</span>
            {(['ALL', 'VALID', 'EXPIRING_SOON', 'EXPIRED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setActiveStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                  activeStatusFilter === st
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-surface-container-low text-outline hover:text-on-surface'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 text-[11px]">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search title, CFR, doc #, hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg pl-8 pr-3 py-1.5 text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="bg-surface-container p-8 rounded-xl border border-surface-container-high text-center space-y-2">
            <span className="material-symbols-outlined text-outline text-[36px]">folder_open</span>
            <p className="text-[12px] text-outline font-bold">NO DOT RECORDS MATCH THE SELECTED FILTER</p>
            <p className="text-[10px] text-outline">Try adjusting your category search or add a new record.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-surface-container p-4 rounded-xl border border-surface-container-high/80 hover:border-primary/50 transition-all shadow-md space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-2">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                    doc.status === 'VALID'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : doc.status === 'EXPIRING_SOON'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-error/20 text-error border-error/40'
                  }`}>
                    {doc.status.replace('_', ' ')}
                  </span>

                  <span className="text-[10px] text-primary font-bold uppercase">{doc.cfrReference}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-outline">ISSUED: {doc.issuedDate}</span>
                  <span className="text-outline">•</span>
                  <span className={`font-bold ${
                    doc.status === 'EXPIRING_SOON' ? 'text-amber-400' : 'text-on-surface'
                  }`}>
                    EXP: {doc.expirationDate}
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[14px] font-bold text-on-surface leading-tight">{doc.documentTitle}</h4>
                  <p className="text-[11px] text-outline leading-snug">{doc.notes}</p>
                  <div className="flex items-center gap-3 text-[10px] text-outline pt-0.5">
                    <span>Authority: <strong className="text-on-surface">{doc.issuingAuthority}</strong></span>
                    <span>•</span>
                    <span>Doc #: <strong className="text-primary">{doc.documentNumber}</strong></span>
                    <span>•</span>
                    <span>Assigned: <strong className="text-on-surface">{doc.driverName} ({doc.unitNumber})</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  <button
                    onClick={() => setSelectedDocForDetail(doc)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                    <span>View Record</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedDocForRenew(doc);
                      setRenewDate('2028-09-15');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                    <span>Renew</span>
                  </button>

                  <button
                    onClick={() => handleCopyHash(doc)}
                    className="p-1.5 rounded-lg bg-surface-container-high text-outline hover:text-on-surface text-[10px] cursor-pointer"
                    title="Copy Cryptographic SHA-256 Hash"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>

              {/* SHA-256 Merkle Proof Footer */}
              <div className="p-2 rounded-lg bg-surface-container-lowest border border-surface-container-high/50 flex items-center justify-between gap-2 text-[9px] font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-emerald-400 text-[12px]">verified_user</span>
                  <span className="text-outline">SHA-256 PROOF:</span>
                  <span className="text-emerald-400 font-bold truncate">{doc.merkleProofHash}</span>
                </div>
                <span className="text-outline shrink-0">{doc.fileFormat} ({(doc.fileSizeBytes / 1024).toFixed(0)} KB)</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL INSPECTION MODAL */}
      {selectedDocForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-2xl w-full space-y-4 relative font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase block">
                    FMCSA OFFICIAL DOCUMENT VERIFICATION SEAL
                  </span>
                  <h3 className="text-[16px] font-bold text-on-surface">{selectedDocForDetail.documentTitle}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForDetail(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div>
                  <span className="text-[9px] text-outline uppercase block">CFR REGULATION</span>
                  <span className="font-bold text-primary">{selectedDocForDetail.cfrReference}</span>
                </div>
                <div>
                  <span className="text-[9px] text-outline uppercase block">DOCUMENT NUMBER</span>
                  <span className="font-bold text-on-surface">{selectedDocForDetail.documentNumber}</span>
                </div>
                <div>
                  <span className="text-[9px] text-outline uppercase block">ISSUED DATE</span>
                  <span className="font-bold text-on-surface">{selectedDocForDetail.issuedDate}</span>
                </div>
                <div>
                  <span className="text-[9px] text-outline uppercase block">EXPIRATION DATE</span>
                  <span className="font-bold text-emerald-400">{selectedDocForDetail.expirationDate}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <span className="text-[9px] text-outline uppercase block font-bold">ISSUING AUTHORITY &amp; MEDICAL CLINIC</span>
                <span className="text-[12px] font-bold text-on-surface block">{selectedDocForDetail.issuingAuthority}</span>
                <p className="text-[10px] text-outline">{selectedDocForDetail.notes}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1 font-mono">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">CRYPTOGRAPHIC FIPS 180-4 MERKLE SEAL</span>
                <p className="text-[9px] text-emerald-300 break-all">{selectedDocForDetail.merkleProofHash}</p>
                <span className="text-[9px] text-outline block">Digital Format: {selectedDocForDetail.fileFormat}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleCopyHash(selectedDocForDetail);
                  setSelectedDocForDetail(null);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase cursor-pointer"
              >
                Copy Cryptographic Seal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENEWAL MODAL */}
      {selectedDocForRenew && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleRenewSubmit}
            className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4 font-mono text-[11px]"
          >
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <span className="text-[12px] font-bold text-primary uppercase">
                RENEW DOT COMPLIANCE RECORD
              </span>
              <button
                type="button"
                onClick={() => setSelectedDocForRenew(null)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <p className="text-on-surface font-bold">{selectedDocForRenew.documentTitle}</p>

            <div className="space-y-1">
              <label className="text-[10px] text-outline uppercase font-bold block">New Expiration Date</label>
              <input
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-outline uppercase font-bold block">Renewal Audit Notes</label>
              <textarea
                value={renewNotes}
                onChange={(e) => setRenewNotes(e.target.value)}
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary h-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDocForRenew(null)}
                className="px-3 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold uppercase cursor-pointer"
              >
                Save Renewal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NEW RECORD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleAddRecordSubmit}
            className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-xl w-full space-y-3 font-mono text-[11px]"
          >
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="text-[12px] font-bold text-primary uppercase">
                UPLOAD / CREATE NEW DOT RECORD
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. DOT Physical Medical Card (Form MCSA-5876)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as DotDocCategory)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                >
                  <option value="DRIVER_DQF">Driver DQF &amp; Medical (391)</option>
                  <option value="DAILY_LOGS">Daily Logs &amp; ELD (395)</option>
                  <option value="DRUG_ALCOHOL">Drug &amp; Alcohol (382)</option>
                  <option value="VEHICLE_DVIR">DVIR &amp; Inspections (396)</option>
                  <option value="FLEET_INSURANCE">Insurance &amp; Cab Cards</option>
                  <option value="HAZMAT_SAFETY">Hazmat &amp; Security</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">CFR Reference</label>
                <input
                  type="text"
                  placeholder="e.g. 49 CFR § 391.43"
                  value={newCfr}
                  onChange={(e) => setNewCfr(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Document Number</label>
                <input
                  type="text"
                  placeholder="e.g. MED-2026-904"
                  value={newDocNum}
                  onChange={(e) => setNewDocNum(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Issuing Authority</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Aris Thorne, MD (National Registry #7819)"
                  value={newAuthority}
                  onChange={(e) => setNewAuthority(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Issued Date</label>
                <input
                  type="date"
                  value={newIssuedDate}
                  onChange={(e) => setNewIssuedDate(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Expiration Date</label>
                <input
                  type="date"
                  value={newExpDate}
                  onChange={(e) => setNewExpDate(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold block">Notes &amp; Verification Certifications</label>
                <textarea
                  placeholder="Enter medical evaluation notes, physical results, or chain of custody confirmation..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary h-16"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold uppercase cursor-pointer"
              >
                Upload &amp; Seal Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
