import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DotDocumentRecord, DotDocCategory, DotDocStatus, InspectionTriggerSource } from '../types';
import { dotDocumentsService } from '../services/dotDocumentsService';
import { authenticatedFetch } from '../services/firebaseClientAuth';

interface ComplianceDocumentArchiveProps {
  onShowToast?: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
}

const CATEGORY_TABS: { id: DotDocCategory | 'ALL'; label: string; icon: string }[] = [
  { id: 'ALL', label: 'All Records', icon: 'folder_copy' },
  { id: 'DAILY_LOGS', label: 'Daily Logs (RODS)', icon: 'history_edu' },
  { id: 'DRIVER_DQF', label: 'Driver DQF & CDL', icon: 'badge' },
  { id: 'DRUG_ALCOHOL', label: 'Clearinghouse & D&A', icon: 'science' },
  { id: 'VEHICLE_DVIR', label: 'Vehicle DVIR & Annual', icon: 'local_shipping' },
  { id: 'FLEET_INSURANCE', label: 'Authority & Insurance', icon: 'policy' },
  { id: 'HAZMAT_SAFETY', label: 'Hazmat & Safety', icon: 'warning' },
];

export const ComplianceDocumentArchive: React.FC<ComplianceDocumentArchiveProps> = ({
  onShowToast,
}) => {
  const [documents, setDocuments] = useState<DotDocumentRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DotDocCategory | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<DotDocStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DotDocumentRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Driver profile from /api/driver/profile (empty before login)
  const [driverProfile, setDriverProfile] = useState<{
    name: string;
    cdlNumber: string;
    cdlState: string;
    assignedUnitId: string;
    carrierName: string;
    usdotNumber: string;
    mcNumber: string;
  } | null>(null);

  // Form states for uploading a new document record
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<DotDocCategory>('DRIVER_DQF');
  const [newCfr, setNewCfr] = useState('49 CFR § 391.51');
  const [newDocNum, setNewDocNum] = useState('');
  const [newAuthority, setNewAuthority] = useState('FMCSA / State DOT');
  const [newIssuedDate, setNewIssuedDate] = useState(new Date().toISOString().substring(0, 10));
  const [newExpDate, setNewExpDate] = useState('2027-12-31');
  const [newNotes, setNewNotes] = useState('');
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | undefined>(undefined);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(248000);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = dotDocumentsService.subscribe((docs) => {
      setDocuments(docs);
    });
    dotDocumentsService.syncWithBackend().catch(() => {});

    authenticatedFetch('/api/driver/profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setDriverProfile({
              name: data.profile.name || '',
              cdlNumber: data.profile.cdlNumber || '',
              cdlState: data.profile.cdlState || '',
              assignedUnitId: data.profile.assignedUnitId || '',
              carrierName: data.profile.carrierName || '',
              usdotNumber: data.profile.usdotNumber || '',
              mcNumber: data.profile.mcNumber || '',
            });
          }
        }
      })
      .catch(() => {});

    return unsubscribe;
  }, []);

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    if (!newTitle.trim()) {
      setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setUploadedPreviewUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const stats = useMemo(() => dotDocumentsService.getAuditReadinessStats(), [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && doc.status !== selectedStatus) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.documentTitle.toLowerCase().includes(q);
        const matchCfr = doc.cfrReference.toLowerCase().includes(q);
        const matchNum = doc.documentNumber.toLowerCase().includes(q);
        const matchAuthority = doc.issuingAuthority.toLowerCase().includes(q);
        return matchTitle || matchCfr || matchNum || matchAuthority;
      }
      return true;
    });
  }, [documents, selectedCategory, selectedStatus, searchQuery]);

  const handleRenewDoc = (doc: DotDocumentRecord) => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const expStr = nextYear.toISOString().substring(0, 10);
    const updated = dotDocumentsService.renewDocument(
      doc.id,
      expStr,
      'Recertified via Compliance Vault'
    );
    if (updated) {
      setSelectedDoc(updated);
      if (onShowToast) {
        onShowToast(`RENEWED & RECERTIFIED: ${updated.documentTitle} (Valid thru ${expStr})`, 'verified');
      }
    }
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const added = dotDocumentsService.addDocument({
      documentTitle: newTitle.trim(),
      category: newCategory,
      cfrReference: newCfr.trim() || '49 CFR § 390.31',
      issuedDate: newIssuedDate,
      expirationDate: newExpDate,
      status: 'VALID',
      issuingAuthority: newAuthority.trim() || 'Motor Carrier Compliance Officer',
      documentNumber: newDocNum.trim() || `DOT-${Math.floor(100000 + Math.random() * 900000)}`,
      driverName: driverProfile?.name || '',
      unitNumber: driverProfile?.assignedUnitId || '',
      fileSizeBytes: uploadedFileSize,
      fileFormat: uploadedPreviewUrl
        ? uploadedFileName.toLowerCase().endsWith('.pdf')
          ? 'PDF Document'
          : 'Scanned Image'
        : 'PDF',
      notes: newNotes.trim() || 'Uploaded and indexed via DOT Compliance Archive.',
      certified: false,
      imageUrl: uploadedPreviewUrl,
    });

    setIsAddModalOpen(false);
    setNewTitle('');
    setNewDocNum('');
    setNewNotes('');
    setUploadedPreviewUrl(undefined);
    setUploadedFileName('');
    setSelectedDoc(added);

    if (onShowToast) {
      onShowToast(`DOT RECORD ARCHIVED: ${added.documentTitle}`, 'cloud_done');
    }
  };

  const handleExportDossier = () => {
    const jsonStr = dotDocumentsService.exportFullAuditDossierJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DOT-Compliance-Archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onShowToast) {
      onShowToast('FULL DOT COMPLIANCE DOSSIER EXPORTED (JSON)', 'download_done');
    }
  };

  const getStatusBadge = (status: DotDocStatus) => {
    switch (status) {
      case 'VALID':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            VALID
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            EXPIRING SOON
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2 py-0.5 rounded bg-error/20 text-error border border-error/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
            EXPIRED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-bold uppercase">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high shadow-2xl space-y-4">
      {/* Header & Readiness Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                DOT / FMCSA Compliance Document Vault
              </h3>
              <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase border border-primary/30">
                49 CFR § 390.31
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {driverProfile?.name
                ? `Driver: ${driverProfile.name}${driverProfile.cdlNumber ? ` (CDL ${driverProfile.cdlState} ${driverProfile.cdlNumber})` : ''}`
                : 'Sign in to view driver profile and compliance documents'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>+ Archive Document</span>
          </button>
          <button
            onClick={handleExportDossier}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white border border-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Dossier</span>
          </button>
        </div>
      </div>

      {/* Audit Readiness KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className="p-3 rounded-lg bg-surface-container border border-surface-container-high">
          <span className="text-[10px] text-on-surface-variant uppercase block">AUDIT READINESS</span>
          <span className="text-lg font-bold text-emerald-400">{stats.score}%</span>
          <span className="text-[10px] text-slate-400 block">{stats.total} Indexed Files</span>
        </div>
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'VALID' ? 'ALL' : 'VALID')}
          className={`p-3 rounded-lg border cursor-pointer transition ${
            selectedStatus === 'VALID'
              ? 'bg-emerald-950/40 border-emerald-500/50'
              : 'bg-surface-container border-surface-container-high hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] text-on-surface-variant uppercase block">VALID &amp; ACTIVE</span>
          <span className="text-lg font-bold text-emerald-400">{stats.valid}</span>
          <span className="text-[10px] text-emerald-300/80 block">Click to filter</span>
        </div>
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON')}
          className={`p-3 rounded-lg border cursor-pointer transition ${
            selectedStatus === 'EXPIRING_SOON'
              ? 'bg-amber-950/40 border-amber-500/50'
              : 'bg-surface-container border-surface-container-high hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] text-on-surface-variant uppercase block">EXPIRING SOON</span>
          <span className="text-lg font-bold text-amber-300">{stats.expiring}</span>
          <span className="text-[10px] text-amber-300/80 block">Action advised</span>
        </div>
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`p-3 rounded-lg border cursor-pointer transition ${
            selectedStatus === 'EXPIRED'
              ? 'bg-error/20 border-error/50'
              : 'bg-surface-container border-surface-container-high hover:border-slate-700'
          }`}
        >
          <span className="text-[10px] text-on-surface-variant uppercase block">EXPIRED / CRITICAL</span>
          <span className="text-lg font-bold text-error">{stats.expired}</span>
          <span className="text-[10px] text-slate-400 block">Zero violations</span>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:text-white border border-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Document Title, 49 CFR section, Document #, or Authority..."
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-surface-container border border-surface-container-high text-xs text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="
                absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white cursor-pointer
              "
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredDocuments.length === 0 ? (
          <div className="p-6 text-center rounded-lg bg-surface-container border border-surface-container-high text-xs text-on-surface-variant">
            No DOT compliance records match your current filter criteria.
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isSelected = selectedDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(isSelected ? null : doc)}
                className={`p-3 rounded-lg border transition cursor-pointer ${
                  isSelected
                    ? 'bg-surface-container-high border-primary/50 shadow-md'
                    : 'bg-surface-container border-surface-container-high hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">{doc.documentTitle}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px] font-mono">
                        {doc.cfrReference}
                      </span>
                      {doc.capturedViaCamera && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                          <span>CAMERA SCAN</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-on-surface-variant font-mono flex items-center gap-3 flex-wrap">
                      <span>Doc #: {doc.documentNumber}</span>
                      <span>•</span>
                      <span>Issued: {doc.issuedDate}</span>
                      <span>•</span>
                      <span>Expires: {doc.expirationDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {getStatusBadge(doc.status)}
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      {isSelected ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* Expanded Inspector View */}
                {isSelected && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-slate-700/80 text-xs space-y-2.5 font-mono"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-on-surface-variant block">ISSUING AUTHORITY:</span>
                        <span className="text-white font-semibold">{doc.issuingAuthority}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">DRIVER / UNIT:</span>
                        <span className="text-white font-semibold">
                          {doc.driverName || driverProfile?.name || 'N/A'} {doc.unitNumber ? `(${doc.unitNumber})` : ''}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-on-surface-variant block">SHA-256 DOCUMENT DIGEST:</span>
                        <span className="text-emerald-400 break-all text-[10px]">{doc.documentHash}</span>
                      </div>
                    </div>

                    {doc.imageUrl && (
                      <div className="p-2 rounded bg-black/50 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-amber-300">
                          <span className="font-bold uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">image</span>
                            Captured Document Scan Preview
                          </span>
                          {doc.cameraMetadata && (
                            <span className="text-slate-400">
                              {doc.cameraMetadata.resolution} • {doc.cameraMetadata.geoCoordinates}
                            </span>
                          )}
                        </div>
                        <img
                          src={doc.imageUrl}
                          alt={doc.documentTitle}
                          className="w-full max-h-60 object-contain rounded border border-slate-800 bg-black"
                        />
                      </div>
                    )}

                    <div className="p-2 rounded bg-surface-container-low border border-slate-800 text-[11px] text-slate-300">
                      <span className="text-on-surface-variant font-bold block mb-0.5">COMPLIANCE NOTES:</span>
                      {doc.notes}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400">
                        Format: {doc.fileFormat} ({(doc.fileSizeBytes / 1024).toFixed(0)} KB)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRenewDoc(doc)}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">autorenew</span>
                          <span>Recertify / Renew</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Document Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-surface-container-low border border-surface-container-high rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Archive New DOT Compliance Record
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-on-surface-variant hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                  Attach Local File or Photo (Optional PDF / JPG / PNG)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUploadChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">attach_file</span>
                    <span>Choose Local File...</span>
                  </button>
                  {uploadedFileName && (
                    <span className="text-[11px] text-emerald-400 font-mono truncate">
                      {uploadedFileName} ({(uploadedFileSize / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Annual Vehicle Inspection Report (2026)"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    DOT Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as DotDocCategory)}
                    className="w-full px-2.5 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white focus:outline-none focus:border-primary"
                  >
                    <option value="DRIVER_DQF">Driver DQF &amp; CDL</option>
                    <option value="DAILY_LOGS">Daily Logs (RODS)</option>
                    <option value="DRUG_ALCOHOL">Clearinghouse &amp; D&amp;A</option>
                    <option value="VEHICLE_DVIR">Vehicle DVIR &amp; Annual</option>
                    <option value="FLEET_INSURANCE">Authority &amp; Insurance</option>
                    <option value="HAZMAT_SAFETY">Hazmat &amp; Safety</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    49 CFR Citation
                  </label>
                  <input
                    type="text"
                    value={newCfr}
                    onChange={(e) => setNewCfr(e.target.value)}
                    placeholder="49 CFR § 391.51"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    Certificate / Doc #
                  </label>
                  <input
                    type="text"
                    value={newDocNum}
                    onChange={(e) => setNewDocNum(e.target.value)}
                    placeholder="DOT-884120"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    Issuing Authority
                  </label>
                  <input
                    type="text"
                    value={newAuthority}
                    onChange={(e) => setNewAuthority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    Issued Date
                  </label>
                  <input
                    type="date"
                    value={newIssuedDate}
                    onChange={(e) => setNewIssuedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={newExpDate}
                    onChange={(e) => setNewExpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-on-surface-variant mb-1">
                  Compliance Notes
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional inspection notes or custody remarks..."
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border border-surface-container-high text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Index &amp; Seal Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
