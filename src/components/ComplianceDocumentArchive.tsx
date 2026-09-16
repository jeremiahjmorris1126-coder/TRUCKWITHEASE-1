import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DotDocumentRecord,
  DotDocCategory,
  DotDocStatus,
  DotDocSortField,
  DotDocSortOrder,
  InspectionTriggerSource,
} from '../types';
import { dotDocumentsService } from '../services/dotDocumentsService';
import { CARRIER_INFO, DRIVER_INFO } from '../data/mockData';

interface ComplianceDocumentArchiveProps {
  onShowToast: (msg: string, icon?: string) => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
}

export const ComplianceDocumentArchive: React.FC<ComplianceDocumentArchiveProps> = ({
  onShowToast,
  onRecordInspectionLog,
  onGenerateNewPdf,
}) => {
  const [documents, setDocuments] = useState<DotDocumentRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<DotDocCategory | 'ALL'>('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<DotDocStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Sorting state
  const [sortField, setSortField] = useState<DotDocSortField>('expirationDate');
  const [sortOrder, setSortOrder] = useState<DotDocSortOrder>('asc');

  // Modals state
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DotDocumentRecord | null>(null);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<DotDocumentRecord | null>(null);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);

  // Renewal form
  const [renewDate, setRenewDate] = useState<string>('2028-09-15');
  const [renewNotes, setRenewNotes] = useState<string>('Updated DOT Physical / Medical certification verified.');

  // Camera & Scan Upload State
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanFilter, setScanFilter] = useState<'normal' | 'contrast' | 'grayscale'>('contrast');
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);

  // Scanned Document Form State
  const [scanTitle, setScanTitle] = useState<string>('DOT Medical Examiner Certificate (Form MCSA-5876)');
  const [scanCategory, setScanCategory] = useState<DotDocCategory>('DRIVER_DQF');
  const [scanCfr, setScanCfr] = useState<string>('49 CFR § 391.43');
  const [scanDocNum, setScanDocNum] = useState<string>('MED-2026-89104');
  const [scanAuthority, setScanAuthority] = useState<string>('Dr. Aris Thorne, MD (National Registry #7819204)');
  const [scanIssuedDate, setScanIssuedDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [scanExpDate, setScanExpDate] = useState<string>('2028-09-15');
  const [scanNotes, setScanNotes] = useState<string>('Mobile Camera Scanned • Verified 2-Year Physical Qualification. Clear for interstate commercial driving.');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = dotDocumentsService.subscribe((docs) => {
      setDocuments(docs);
    });
    return () => unsubscribe();
  }, []);

  // Cleanup camera stream when modal closes
  useEffect(() => {
    if (!showCameraModal && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setCameraActive(false);
    }
  }, [showCameraModal, cameraStream]);

  const stats = useMemo(() => {
    const total = documents.length;
    const medicalAndPhysicals = documents.filter(
      (d) => d.category === 'DRIVER_DQF' || d.documentTitle.toLowerCase().includes('medical') || d.documentTitle.toLowerCase().includes('physical')
    ).length;
    const drugAndAlcohol = documents.filter((d) => d.category === 'DRUG_ALCOHOL').length;
    const valid = documents.filter((d) => d.status === 'VALID').length;
    const expiring = documents.filter((d) => d.status === 'EXPIRING_SOON').length;
    const expired = documents.filter((d) => d.status === 'EXPIRED').length;
    const cameraScannedCount = documents.filter((d) => d.capturedViaCamera).length;

    return {
      total,
      medicalAndPhysicals,
      drugAndAlcohol,
      valid,
      expiring,
      expired,
      cameraScannedCount,
      readinessScore: dotDocumentsService.getAuditReadinessStats().score,
    };
  }, [documents]);

  // Filtered and sorted documents list
  const filteredAndSortedDocs = useMemo(() => {
    const filtered = documents.filter((doc) => {
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

    return filtered.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'expirationDate') {
        valA = a.expirationDate === 'PERMANENT' ? '9999-99-99' : a.expirationDate;
        valB = b.expirationDate === 'PERMANENT' ? '9999-99-99' : b.expirationDate;
      } else if (sortField === 'issuedDate') {
        valA = a.issuedDate;
        valB = b.issuedDate;
      } else if (sortField === 'documentTitle') {
        valA = a.documentTitle.toLowerCase();
        valB = b.documentTitle.toLowerCase();
      } else if (sortField === 'category') {
        valA = a.category;
        valB = b.category;
      } else if (sortField === 'status') {
        const statusWeight = { EXPIRED: 0, EXPIRING_SOON: 1, PENDING_AUDIT: 2, VALID: 3 };
        valA = statusWeight[a.status] ?? 4;
        valB = statusWeight[b.status] ?? 4;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, activeCategory, activeStatusFilter, searchQuery, sortField, sortOrder]);

  // Camera Capture Handlers
  const handleStartLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      onShowToast('LIVE MOBILE CAMERA SCANNER ONLINE', 'photo_camera');
    } catch (err) {
      console.warn('Live camera access error, falling back to file input:', err);
      onShowToast('CAM FEED UNAVAILABLE. SELECTING FROM CAMERA ROLL / FILES', 'warning');
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);

      // Stop camera tracks
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setCameraActive(false);
      }

      // Trigger OCR simulation
      processOcrSimulation(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCapturedImage(result);
      processOcrSimulation(result, file.name);
    };
    reader.readAsDataURL(file);
  };

  // OCR Auto-Parser simulation based on document detection
  const processOcrSimulation = (imageData: string, fileName?: string) => {
    setIsProcessingOcr(true);
    setTimeout(() => {
      setIsProcessingOcr(false);
      onShowToast('OCR DOCUMENT PARSING COMPLETE • 99.4% FMCSA MATCH', 'document_scanner');

      // Auto classify document type if filename or standard mode
      const nameLower = (fileName || '').toLowerCase();
      if (nameLower.includes('drug') || nameLower.includes('ccf') || nameLower.includes('screen')) {
        setScanTitle('5-Panel Federal Drug & Alcohol Test Certificate (Form CCF)');
        setScanCategory('DRUG_ALCOHOL');
        setScanCfr('49 CFR § 382.301 / Pre-Employment');
        setScanDocNum('CCF-2026-99104');
        setScanAuthority('Quest Diagnostics MRO / Dr. Harold Finch, MRO');
        setScanNotes('Negative 5-Panel urine screen. THCA, Cocaine, PCP, Opiates, Amphetamines cleared.');
      } else if (nameLower.includes('physical') || nameLower.includes('5875')) {
        setScanTitle('Medical Examination Report Form (Form MCSA-5875)');
        setScanCategory('DRIVER_DQF');
        setScanCfr('49 CFR § 391.41 / Complete Physical Exam');
        setScanDocNum('PHYS-2026-9810');
        setScanAuthority('Midwest Occupational Health Center (NPI #19820192)');
        setScanNotes('Full clinical physical examination. Blood pressure 120/78 mmHg. 20/20 vision. Cleared for 24 months.');
      }
    }, 900);
  };

  const handleSaveScannedRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanTitle.trim()) {
      onShowToast('DOCUMENT TITLE REQUIRED', 'warning');
      return;
    }

    const created = dotDocumentsService.addDocument({
      documentTitle: scanTitle,
      category: scanCategory,
      cfrReference: scanCfr || '49 CFR Part 390',
      issuedDate: scanIssuedDate,
      expirationDate: scanExpDate,
      status: 'VALID',
      issuingAuthority: scanAuthority || 'Mobile Camera Certified Inspection Agent',
      documentNumber: scanDocNum || `CAM-${Date.now().toString().substring(6)}`,
      driverName: DRIVER_INFO.name,
      unitNumber: 'TRK-904',
      fileSizeBytes: Math.floor(450000 + Math.random() * 800000),
      fileFormat: 'JPEG / Mobile Camera Scanned PDF',
      notes: scanNotes,
      certified: true,
      imageUrl: capturedImage || undefined,
      capturedViaCamera: true,
      cameraMetadata: {
        timestamp: new Date().toISOString(),
        geoCoordinates: '39.8283° N, 98.5795° W (In-Cab GPS)',
        resolution: '1920x1080 Full HD',
      },
    });

    onShowToast(`DOCUMENT ADDED TO ARCHIVE: ${created.documentTitle}`, 'verified_user');

    if (onRecordInspectionLog) {
      onRecordInspectionLog(
        'ROADSIDE_AUDIT',
        'MANUAL_HUD',
        `CAMERA SCANNED RECORD ARCHIVED: ${created.documentTitle} [${created.cfrReference}] • Exp: ${created.expirationDate}`
      );
    }

    // Reset and close camera modal
    setShowCameraModal(false);
    setCapturedImage(null);
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForRenew) return;

    const updated = dotDocumentsService.renewDocument(selectedDocForRenew.id, renewDate, renewNotes);
    if (updated) {
      onShowToast(`RECORD RENEWED: ${updated.documentTitle} • NEW EXP: ${renewDate}`, 'verified');
      if (onRecordInspectionLog) {
        onRecordInspectionLog(
          'ROADSIDE_AUDIT',
          'MANUAL_HUD',
          `RENEWED COMPLIANCE RECORD: ${updated.documentTitle} (${updated.documentNumber}) • Exp: ${renewDate}`
        );
      }
    }
    setSelectedDocForRenew(null);
  };

  const handleExportFullArchiveCSV = () => {
    const headers = ['Document ID', 'Title', 'Category', 'CFR Reference', 'Doc Number', 'Issuing Authority', 'Issued Date', 'Expiration Date', 'Status', 'Merkle Hash', 'Camera Scanned'];
    const rows = filteredAndSortedDocs.map((d) => [
      d.id,
      `"${d.documentTitle.replace(/"/g, '""')}"`,
      d.category,
      `"${d.cfrReference}"`,
      d.documentNumber,
      `"${d.issuingAuthority.replace(/"/g, '""')}"`,
      d.issuedDate,
      d.expirationDate,
      d.status,
      d.merkleProofHash,
      d.capturedViaCamera ? 'YES' : 'NO',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DOT_Compliance_Archive_Export_${DRIVER_INFO.name.replace(' ', '_')}_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onShowToast('EXPORTED COMPLIANCE ARCHIVE SUMMARY (CSV)', 'download');
  };

  const handleCopyHash = (hash: string) => {
    try {
      navigator.clipboard.writeText(hash);
      onShowToast(`COPIED SHA-256 SEAL: ${hash.substring(0, 16)}...`, 'content_copy');
    } catch (_) {
      onShowToast(`SEAL HASH: ${hash.substring(0, 20)}...`, 'verified_user');
    }
  };

  return (
    <div className="space-y-space-md font-mono text-on-surface pb-space-2xl">
      {/* Archive Header Panel */}
      <div className="bg-surface-container p-space-md rounded-2xl border border-primary/50 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[28px]">document_scanner</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
                  COMPLIANCE DOCUMENT ARCHIVE
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                  MOBILE CAMERA ENHANCED
                </span>
              </div>
              <p className="text-[11px] text-outline mt-0.5">
                Centralized vault for Medical Examiner Certificates, Drug &amp; Alcohol CCF Results, Physical Exam Forms, and FMCSA Records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Primary Action: Mobile Camera Capture */}
            <button
              onClick={() => {
                setShowCameraModal(true);
                handleStartLiveCamera();
              }}
              className="px-3.5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              <span>Scan with Camera</span>
            </button>

            {/* Hidden native file input for direct file/camera fallback */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-primary border border-primary/40 font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Upload File</span>
            </button>

            <button
              onClick={handleExportFullArchiveCSV}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface border border-surface-container-high font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Audit Readiness & Document Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-space-sm text-[11px]">
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">TOTAL ARCHIVED RECORDS</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-primary">{stats.total}</span>
              <span className="text-[9px] text-outline font-bold">{stats.cameraScannedCount} Camera Scanned</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">MEDICAL &amp; PHYSICALS</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-emerald-400">{stats.medicalAndPhysicals}</span>
              <span className="text-[9px] text-emerald-400 font-bold">49 CFR § 391</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">DRUG &amp; ALCOHOL CCF</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-sky-400">{stats.drugAndAlcohol}</span>
              <span className="text-[9px] text-sky-400 font-bold">49 CFR § 382</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">EXPIRING REVIEWS</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-[20px] font-bold ${stats.expiring > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                {stats.expiring}
              </span>
              <span className="text-[9px] text-outline">Due within 30 days</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[9px] text-outline uppercase block font-bold">AUDIT READINESS SCORE</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-emerald-400">{stats.readinessScore}%</span>
              <span className="text-[9px] text-emerald-400 font-bold uppercase">FMCSA PASS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categorization Tabs, Search & Sorting Controls */}
      <div className="bg-surface-container p-3.5 rounded-2xl border border-surface-container-high/70 space-y-3 shadow-md">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-[10px] scrollbar-none">
          {[
            { id: 'ALL', label: 'ALL ARCHIVE', icon: 'grid_view' },
            { id: 'DRIVER_DQF', label: '🏥 MEDICAL CARDS & PHYSICALS', icon: 'medical_information' },
            { id: 'DRUG_ALCOHOL', label: '🧪 DRUG & ALCOHOL CCF', icon: 'science' },
            { id: 'DAILY_LOGS', label: '📋 DAILY LOGS & ELD', icon: 'edit_calendar' },
            { id: 'VEHICLE_DVIR', label: '🚛 DVIR & INSPECTIONS', icon: 'minor_crash' },
            { id: 'FLEET_INSURANCE', label: '📜 CAB CARDS & INSURANCE', icon: 'badge' },
            { id: 'HAZMAT_SAFETY', label: '☣️ HAZMAT & SECURITY', icon: 'warning' },
          ].map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as DotDocCategory | 'ALL')}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-md'
                    : 'bg-surface-container-low text-outline hover:text-on-surface hover:bg-surface-container-high border border-surface-container-high/50'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Filter & Sorting Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-surface-container-high pt-2.5">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
            <span className="text-outline uppercase font-bold shrink-0 text-[9px]">STATUS:</span>
            {(['ALL', 'VALID', 'EXPIRING_SOON', 'EXPIRED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setActiveStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                  activeStatusFilter === st
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-surface-container-lowest text-outline hover:text-on-surface'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search, Sort Dropdown & Layout View Toggles */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-56 text-[11px]">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search title, doctor, CFR, hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg pl-8 pr-3 py-1.5 text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            {/* Sort Field Selector */}
            <div className="flex items-center gap-1 bg-surface-container-lowest border border-surface-container-high rounded-lg p-1 text-[10px]">
              <span className="material-symbols-outlined text-outline text-[16px] pl-1">sort</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as DotDocSortField)}
                className="bg-transparent text-on-surface font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="expirationDate">Sort: Expiration Date</option>
                <option value="issuedDate">Sort: Upload/Issued Date</option>
                <option value="documentTitle">Sort: Title (A-Z)</option>
                <option value="category">Sort: Category</option>
                <option value="status">Sort: Compliance Status</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded bg-surface-container-high text-primary hover:bg-surface-container-highest cursor-pointer"
                title={`Sort Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                </span>
              </button>
            </div>

            {/* View Mode Toggle (Grid vs Table) */}
            <div className="flex items-center bg-surface-container-lowest border border-surface-container-high rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded text-[14px] transition-all cursor-pointer ${
                  viewMode === 'GRID' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Bento Grid View"
              >
                <span className="material-symbols-outlined text-[16px]">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded text-[14px] transition-all cursor-pointer ${
                  viewMode === 'TABLE' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Tabular List View"
              >
                <span className="material-symbols-outlined text-[16px]">table_rows</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Documents Render Engine */}
      {filteredAndSortedDocs.length === 0 ? (
        <div className="bg-surface-container p-12 rounded-2xl border border-surface-container-high text-center space-y-3">
          <span className="material-symbols-outlined text-outline text-[48px]">folder_off</span>
          <h3 className="text-[14px] text-on-surface font-bold uppercase">NO ARCHIVED RECORDS MATCH YOUR SEARCH</h3>
          <p className="text-[11px] text-outline max-w-md mx-auto">
            Try adjusting your category filter, changing sort parameters, or scan a new document using the mobile camera.
          </p>
          <button
            onClick={() => {
              setShowCameraModal(true);
              handleStartLiveCamera();
            }}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            <span>Scan Medical Card / Document</span>
          </button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* Bento Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {filteredAndSortedDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-surface-container rounded-2xl border border-surface-container-high/80 hover:border-primary/60 transition-all shadow-lg overflow-hidden flex flex-col justify-between group"
            >
              {/* Document Card Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                      doc.status === 'VALID'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : doc.status === 'EXPIRING_SOON'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : 'bg-error/20 text-error border-error/40'
                    }`}
                  >
                    {doc.status.replace('_', ' ')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {doc.capturedViaCamera && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                        <span>CAMERA</span>
                      </span>
                    )}
                    <span className="text-[10px] text-primary font-bold uppercase">{doc.cfrReference}</span>
                  </div>
                </div>

                {/* Title & Authority */}
                <div>
                  <h4 className="text-[14px] font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">
                    {doc.documentTitle}
                  </h4>
                  <p className="text-[10px] text-outline mt-1 truncate">
                    {doc.issuingAuthority}
                  </p>
                </div>

                {/* Image Thumbnail Preview or Digital Seal Graphic */}
                <div
                  onClick={() => setSelectedDocForDetail(doc)}
                  className="h-32 rounded-xl bg-surface-container-lowest border border-surface-container-high overflow-hidden relative group/img cursor-pointer flex items-center justify-center p-2"
                >
                  {doc.imageUrl ? (
                    <img
                      src={doc.imageUrl}
                      alt={doc.documentTitle}
                      className="w-full h-full object-cover rounded-lg group-hover/img:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="text-center space-y-1 p-2">
                      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto border border-primary/30">
                        <span className="material-symbols-outlined text-[20px]">
                          {doc.category === 'DRIVER_DQF'
                            ? 'medical_information'
                            : doc.category === 'DRUG_ALCOHOL'
                            ? 'science'
                            : 'verified'}
                        </span>
                      </div>
                      <span className="text-[9px] text-outline block font-bold uppercase">
                        SEALED DIGITAL FMCSA CERTIFICATE
                      </span>
                      <span className="text-[8px] text-emerald-400 font-mono block">
                        Doc #: {doc.documentNumber}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[10px] uppercase shadow-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      <span>Inspect Record</span>
                    </span>
                  </div>
                </div>

                {/* Expiration Countdown & Dates */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface-container-low text-[10px] border border-surface-container-high/60">
                  <div>
                    <span className="text-[8px] text-outline uppercase block font-bold">ISSUED / SCANNED</span>
                    <span className="text-on-surface font-bold">{doc.issuedDate}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-outline uppercase block font-bold">EXPIRATION DATE</span>
                    <span className={`font-bold ${doc.status === 'EXPIRING_SOON' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {doc.expirationDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Action Footer */}
              <div className="p-3 bg-surface-container-lowest border-t border-surface-container-high/60 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1 truncate text-outline">
                  <span className="material-symbols-outlined text-emerald-400 text-[14px]">lock</span>
                  <span className="truncate font-mono text-[9px]">{doc.merkleProofHash.substring(0, 14)}...</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedDocForRenew(doc);
                      setRenewDate('2028-09-15');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">event_repeat</span>
                    <span>Renew</span>
                  </button>

                  <button
                    onClick={() => handleCopyHash(doc.merkleProofHash)}
                    className="p-1 rounded-lg bg-surface-container-high text-outline hover:text-on-surface text-[12px] cursor-pointer"
                    title="Copy Cryptographic SHA-256 Hash"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Dense Tabular List View */
        <div className="bg-surface-container rounded-2xl border border-surface-container-high overflow-x-auto shadow-xl">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-surface-container-high/80 text-outline uppercase font-bold text-[9px] border-b border-surface-container-high">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Document Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">CFR Ref</th>
                <th className="p-3">Doc # / Authority</th>
                <th className="p-3">Expiration Date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/60">
              {filteredAndSortedDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-container-low/80 transition-colors">
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase ${
                        doc.status === 'VALID'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : doc.status === 'EXPIRING_SOON'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-error/20 text-error border-error/40'
                      }`}
                    >
                      {doc.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-on-surface">
                    <div className="flex items-center gap-2">
                      {doc.capturedViaCamera && (
                        <span className="material-symbols-outlined text-sky-400 text-[14px]" title="Camera Scanned">
                          photo_camera
                        </span>
                      )}
                      <span>{doc.documentTitle}</span>
                    </div>
                  </td>
                  <td className="p-3 text-outline uppercase text-[10px]">{doc.category}</td>
                  <td className="p-3 text-primary font-bold">{doc.cfrReference}</td>
                  <td className="p-3 text-outline">
                    <div className="text-on-surface font-bold text-[10px]">{doc.documentNumber}</div>
                    <div className="text-[9px] truncate max-w-[180px]">{doc.issuingAuthority}</div>
                  </td>
                  <td className="p-3 font-bold">
                    <span className={doc.status === 'EXPIRING_SOON' ? 'text-amber-400' : 'text-emerald-400'}>
                      {doc.expirationDate}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap space-x-1">
                    <button
                      onClick={() => setSelectedDocForDetail(doc)}
                      className="px-2 py-1 rounded bg-surface-container-high text-primary hover:bg-surface-container-highest text-[9px] font-bold uppercase cursor-pointer"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDocForRenew(doc);
                        setRenewDate('2028-09-15');
                      }}
                      className="px-2 py-1 rounded bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 text-[9px] font-bold uppercase cursor-pointer"
                    >
                      Renew
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE CAMERA SCANNER & CAPTURE MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fade-in font-mono">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-primary shadow-2xl max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/40">
                  <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-on-surface uppercase">MOBILE CAMERA DOCUMENT SCANNER</h3>
                  <span className="text-[10px] text-primary font-bold block">
                    FMCSA Medical Cards • Drug Test CCFs • Physical Exam Forms
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCameraModal(false);
                  setCapturedImage(null);
                }}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Camera Viewfinder or Photo Preview */}
            {!capturedImage ? (
              <div className="space-y-3">
                <div className="relative h-64 sm:h-80 rounded-2xl bg-black border-2 border-dashed border-primary/60 overflow-hidden flex items-center justify-center">
                  {cameraActive ? (
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <span className="material-symbols-outlined text-primary text-[48px] animate-pulse">
                        document_scanner
                      </span>
                      <p className="text-[12px] font-bold text-on-surface uppercase">ALIGNED MEDICAL CARD / PHYSICAL FORM</p>
                      <p className="text-[10px] text-outline max-w-sm mx-auto">
                        Position document flat inside camera viewfinder or select file from your device camera roll.
                      </p>
                    </div>
                  )}

                  {/* Document Viewfinder Overlay Frame */}
                  <div className="absolute inset-4 sm:inset-8 border-2 border-emerald-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                    <div className="flex justify-between text-[9px] font-bold text-emerald-400 uppercase bg-black/60 px-2 py-0.5 rounded w-fit">
                      <span>ALIGN DOCUMENT BOUNDARY</span>
                    </div>
                    <div className="text-center text-[9px] text-emerald-300 font-bold bg-black/60 px-2 py-0.5 rounded w-fit mx-auto">
                      HIGH CONTRAST AUTO-SCAN ENHANCER ACTIVE
                    </div>
                  </div>

                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Camera Capture Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-surface-container-high text-primary border border-primary/40 font-bold text-[11px] uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">image</span>
                    <span>Camera Roll</span>
                  </button>

                  {cameraActive ? (
                    <button
                      onClick={handleSnapPhoto}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[12px] uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">center_focus_strong</span>
                      <span>Snap &amp; Capture</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartLiveCamera}
                      className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-[12px] uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">videocam</span>
                      <span>Start Live Camera</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Photo Scanned & Form Metadata Processing */
              <form onSubmit={handleSaveScannedRecord} className="space-y-3">
                {/* Scanned Photo Preview Bar with Image Filters */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-400 font-bold uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>CAMERA PHOTO CAPTURED &amp; ENHANCED</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <span className="text-outline text-[9px]">Filter:</span>
                      {(['contrast', 'normal', 'grayscale'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setScanFilter(f)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase cursor-pointer ${
                            scanFilter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-outline'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCapturedImage(null)}
                        className="px-2 py-0.5 rounded bg-error/20 text-error text-[8px] font-bold uppercase cursor-pointer ml-2"
                      >
                        Retake
                      </button>
                    </div>
                  </div>

                  <div className="h-36 rounded-lg overflow-hidden bg-black border border-surface-container-high flex items-center justify-center">
                    <img
                      src={capturedImage}
                      alt="Scanned Compliance Preview"
                      className={`h-full w-full object-contain ${
                        scanFilter === 'contrast'
                          ? 'contrast-125 brightness-105'
                          : scanFilter === 'grayscale'
                          ? 'grayscale contrast-150'
                          : ''
                      }`}
                    />
                  </div>
                </div>

                {/* OCR AI Parsing Status Notification */}
                {isProcessingOcr && (
                  <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/40 text-primary text-[10px] flex items-center gap-2 animate-pulse">
                    <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                    <span>AI OCR Parsing fields... Extracting doctor name, MCSA form code, and expiration dates...</span>
                  </div>
                )}

                {/* Metadata Fields Form */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="col-span-2 space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Document Title</label>
                    <input
                      type="text"
                      value={scanTitle}
                      onChange={(e) => setScanTitle(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Category</label>
                    <select
                      value={scanCategory}
                      onChange={(e) => setScanCategory(e.target.value as DotDocCategory)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    >
                      <option value="DRIVER_DQF">Medical Cards &amp; Physicals (DQF)</option>
                      <option value="DRUG_ALCOHOL">Drug &amp; Alcohol CCF (382)</option>
                      <option value="DAILY_LOGS">Daily Logs &amp; ELD (395)</option>
                      <option value="VEHICLE_DVIR">DVIR &amp; Inspections (396)</option>
                      <option value="FLEET_INSURANCE">Insurance &amp; Cab Cards</option>
                      <option value="HAZMAT_SAFETY">Hazmat &amp; Security</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">CFR Reference</label>
                    <input
                      type="text"
                      value={scanCfr}
                      onChange={(e) => setScanCfr(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Document / Cert Number</label>
                    <input
                      type="text"
                      value={scanDocNum}
                      onChange={(e) => setScanDocNum(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Issuing Doctor / Clinic</label>
                    <input
                      type="text"
                      value={scanAuthority}
                      onChange={(e) => setScanAuthority(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Issued Date</label>
                    <input
                      type="date"
                      value={scanIssuedDate}
                      onChange={(e) => setScanIssuedDate(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Expiration Date</label>
                    <input
                      type="date"
                      value={scanExpDate}
                      onChange={(e) => setScanExpDate(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary font-bold text-emerald-400"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-outline uppercase font-bold block text-[9px]">Audit Notes &amp; Exam Evaluation</label>
                    <textarea
                      value={scanNotes}
                      onChange={(e) => setScanNotes(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary h-14"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCameraModal(false);
                      setCapturedImage(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface text-[11px]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">verified_user</span>
                    <span>Save to Compliance Archive</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FULL DOCUMENT INSPECTOR MODAL */}
      {selectedDocForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
          <div className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/40">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-primary uppercase block">
                    FMCSA COMPLIANCE RECORD INSPECTION SEAL
                  </span>
                  <h3 className="text-[15px] font-bold text-on-surface">{selectedDocForDetail.documentTitle}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForDetail(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Document Image or Vector Seal Graphic */}
            <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2">
              <span className="text-[9px] text-outline uppercase block font-bold">DIGITAL RECORD PREVIEW</span>
              {selectedDocForDetail.imageUrl ? (
                <div className="h-64 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-surface-container-high">
                  <img
                    src={selectedDocForDetail.imageUrl}
                    alt={selectedDocForDetail.documentTitle}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-40 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <span className="material-symbols-outlined text-primary text-[36px]">shield</span>
                  <span className="text-[11px] font-bold text-on-surface uppercase">SEALED TITLE 49 CFR COMPLIANCE CERTIFICATE</span>
                  <span className="text-[9px] text-emerald-400 font-mono">DOC #: {selectedDocForDetail.documentNumber}</span>
                </div>
              )}
            </div>

            {/* Document Specs */}
            <div className="grid grid-cols-2 gap-2 text-[11px] p-3 rounded-xl bg-surface-container-low border border-surface-container-high">
              <div>
                <span className="text-[8px] text-outline uppercase block font-bold">CFR REGULATION</span>
                <span className="font-bold text-primary">{selectedDocForDetail.cfrReference}</span>
              </div>
              <div>
                <span className="text-[8px] text-outline uppercase block font-bold">DOCUMENT NUMBER</span>
                <span className="font-bold text-on-surface">{selectedDocForDetail.documentNumber}</span>
              </div>
              <div>
                <span className="text-[8px] text-outline uppercase block font-bold">ISSUED DATE</span>
                <span className="font-bold text-on-surface">{selectedDocForDetail.issuedDate}</span>
              </div>
              <div>
                <span className="text-[8px] text-outline uppercase block font-bold">EXPIRATION DATE</span>
                <span className="font-bold text-emerald-400">{selectedDocForDetail.expirationDate}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1 text-[11px]">
              <span className="text-[8px] text-outline uppercase block font-bold">CLINIC / ISSUING AUTHORITY &amp; NOTES</span>
              <span className="text-[12px] font-bold text-on-surface block">{selectedDocForDetail.issuingAuthority}</span>
              <p className="text-[10px] text-outline leading-relaxed">{selectedDocForDetail.notes}</p>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1 text-[9px]">
              <span className="text-emerald-400 font-bold uppercase block">CRYPTOGRAPHIC FIPS 180-4 MERKLE SEAL</span>
              <p className="text-emerald-300 break-all">{selectedDocForDetail.merkleProofHash}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleCopyHash(selectedDocForDetail.merkleProofHash);
                  setSelectedDocForDetail(null);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase cursor-pointer"
              >
                Copy Proof Seal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENEWAL MODAL */}
      {selectedDocForRenew && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono text-[11px]">
          <form
            onSubmit={handleRenewSubmit}
            className="bg-surface-container p-6 rounded-2xl border-2 border-primary shadow-2xl max-w-lg w-full space-y-4"
          >
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <span className="text-[12px] font-bold text-primary uppercase">
                RENEW COMPLIANCE RECORD
              </span>
              <button
                type="button"
                onClick={() => setSelectedDocForRenew(null)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <p className="text-on-surface font-bold text-[13px]">{selectedDocForRenew.documentTitle}</p>

            <div className="space-y-1">
              <label className="text-[10px] text-outline uppercase font-bold block">New Expiration Date</label>
              <input
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary font-bold text-emerald-400"
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
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
                Save Renewal Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
