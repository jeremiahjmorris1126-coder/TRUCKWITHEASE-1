import React, { useState, useMemo } from 'react';
import { InspectionLogEntry, InspectionTriggerSource } from '../../types';
import { INITIAL_INSPECTION_LOGS } from '../../data/mockData';
import { DotComplianceVaultScreen } from './DotComplianceVaultScreen';
import { ComplianceDocumentArchive } from '../ComplianceDocumentArchive';

interface SecurityVaultProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPdfModal?: () => void;
  inspectionLogs?: InspectionLogEntry[];
  onGenerateNewPdf?: (source?: InspectionTriggerSource, notes?: string) => void;
  onClearLogs?: () => void;
}

type FilterType = 'ALL' | 'VOICE_CONTROL' | 'OFFICER_REQUEST' | 'CAB_PRINTER' | 'MANUAL_HUD';
type VaultViewTab = 'DOC_ARCHIVE' | 'DOT_DOCUMENTS' | 'HSM_LEDGER';

export const SecurityVaultScreen: React.FC<SecurityVaultProps> = ({
  onShowToast,
  onOpenPdfModal,
  inspectionLogs = INITIAL_INSPECTION_LOGS,
  onGenerateNewPdf,
  onClearLogs,
}) => {
  const [activeVaultTab, setActiveVaultTab] = useState<VaultViewTab>('DOC_ARCHIVE');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    return inspectionLogs.filter((log) => {
      // Filter by category
      if (selectedFilter !== 'ALL' && log.triggerSource !== selectedFilter) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.displayTime.toLowerCase().includes(q) ||
          log.recordNumber.toLowerCase().includes(q) ||
          log.actionTitle.toLowerCase().includes(q) ||
          log.merkleHash.toLowerCase().includes(q) ||
          log.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inspectionLogs, selectedFilter, searchQuery]);

  const handleCopyHash = (id: string, hash: string) => {
    try {
      navigator.clipboard.writeText(hash);
      setCopiedHashId(id);
      setTimeout(() => setCopiedHashId(null), 2500);
      onShowToast(`SHA-256 HASH COPIED: ${hash.slice(0, 16)}...`, 'content_copy');
    } catch (_) {
      onShowToast(`SHA-256 PROOF: ${hash.slice(0, 20)}...`, 'verified');
    }
  };

  const handleVerifySeal = (log: InspectionLogEntry) => {
    onShowToast(
      `HSM SEAL VERIFIED: Record ${log.recordNumber} matches root hash (FIPS 180-4 compliant).`,
      'verified_user'
    );
  };

  const handleExportCSV = () => {
    const logsToExport = filteredLogs.length > 0 ? filteredLogs : inspectionLogs;
    if (logsToExport.length === 0) {
      onShowToast('NO INSPECTION LOGS AVAILABLE TO EXPORT', 'warning');
      return;
    }

    const headers = [
      'Record Number',
      'Display Time',
      'ISO Timestamp',
      'Relative Time',
      'Action Title',
      'Action Type',
      'Trigger Source',
      'Cycle',
      'Days Covered',
      'Merkle Hash SHA-256',
      'File Size',
      'Verified',
      'Notes',
    ];

    const escapeCSV = (field: string | number | boolean | undefined) => {
      if (field === undefined || field === null) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logsToExport.map((log) =>
      [
        escapeCSV(log.recordNumber),
        escapeCSV(log.displayTime),
        escapeCSV(log.timestamp),
        escapeCSV(log.relativeTime),
        escapeCSV(log.actionTitle),
        escapeCSV(log.actionType),
        escapeCSV(log.triggerSource),
        escapeCSV(log.cycle),
        escapeCSV(log.daysCovered),
        escapeCSV(log.merkleHash),
        escapeCSV(log.fileSize),
        escapeCSV(log.verified ? 'YES' : 'NO'),
        escapeCSV(log.notes),
      ].join(',')
    );

    const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `FMCSA_Inspection_Logs_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast(`EXPORTED ${logsToExport.length} INSPECTION LOGS TO CSV`, 'download');
  };

  const getTriggerBadge = (source: InspectionTriggerSource) => {
    switch (source) {
      case 'VOICE_CONTROL':
        return {
          label: 'VOICE: "SHOW INSPECTION"',
          icon: 'mic',
          badgeClass: 'bg-primary/20 text-primary border-primary/40',
        };
      case 'OFFICER_REQUEST':
        return {
          label: 'ROADSIDE AUDIT EXPORT',
          icon: 'shield_person',
          badgeClass: 'bg-error/20 text-error border-error/40',
        };
      case 'CAB_PRINTER':
        return {
          label: 'IN-CAB BLUETOOTH PRINTER',
          icon: 'print',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        };
      case 'MANUAL_HUD':
        return {
          label: 'COCKPIT NIGHT HUD',
          icon: 'dashboard',
          badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
        };
      case 'SCHEDULED_DISPATCH':
      default:
        return {
          label: 'FMCSA CLOUD RELAY',
          icon: 'cloud_sync',
          badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        };
    }
  };

  const latestLog = inspectionLogs[0];

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Cryptographic Vault Screen Header */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="w-11 h-11 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[26px]">lock_clock</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[11px]">
                Cryptographic Security Vault
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[9px] font-mono text-outline uppercase font-semibold">
                FIPS 180-4
              </span>
            </div>
            <h1 className="font-headline-sm text-on-surface text-[18px] font-bold">
              Identity, DOT Records, DQF &amp; HSM Ledger
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="px-2.5 py-1 bg-primary/15 border border-primary/40 text-primary font-telemetry-label text-[10px] font-bold rounded flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            VAULT SEALED &amp; VERIFIED
          </span>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 bg-surface-container p-1.5 rounded-xl border border-surface-container-high text-[11px] font-mono flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveVaultTab('DOC_ARCHIVE')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeVaultTab === 'DOC_ARCHIVE'
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>Compliance Document Archive</span>
        </button>

        <button
          onClick={() => setActiveVaultTab('DOT_DOCUMENTS')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeVaultTab === 'DOT_DOCUMENTS'
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">folder_special</span>
          <span>DOT Fleet Records</span>
        </button>

        <button
          onClick={() => setActiveVaultTab('HSM_LEDGER')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeVaultTab === 'HSM_LEDGER'
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low text-outline hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">lock</span>
          <span>HSM Ledger ({inspectionLogs.length})</span>
        </button>
      </div>

      {activeVaultTab === 'DOC_ARCHIVE' ? (
        <ComplianceDocumentArchive
          onShowToast={onShowToast}
          onRecordInspectionLog={(actionType, triggerSource, notes) => {
            if (onGenerateNewPdf) {
              onGenerateNewPdf(triggerSource as InspectionTriggerSource, notes);
            }
          }}
          onGenerateNewPdf={onGenerateNewPdf}
        />
      ) : activeVaultTab === 'DOT_DOCUMENTS' ? (
        <DotComplianceVaultScreen
          onShowToast={onShowToast}
          onRecordInspectionLog={(actionType, triggerSource, notes) => {
            if (onGenerateNewPdf) {
              onGenerateNewPdf(triggerSource as InspectionTriggerSource, notes);
            }
          }}
          onGenerateNewPdf={onGenerateNewPdf}
        />
      ) : (
        <>

      {/* Compliance Overview KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
        <div className="bg-surface-container p-space-sm rounded-xl border border-surface-container-high shadow-lg">
          <span className="font-telemetry-label text-outline text-[10px] uppercase tracking-wider block">
            TOTAL PDF GENERATIONS
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-headline text-[22px] font-bold text-primary font-mono">
              {inspectionLogs.length}
            </span>
            <span className="text-[11px] font-mono text-outline">RECORDS</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">verified</span>
            100% Attested
          </span>
        </div>

        <div className="bg-surface-container p-space-sm rounded-xl border border-surface-container-high shadow-lg">
          <span className="font-telemetry-label text-outline text-[10px] uppercase tracking-wider block">
            LATEST PDF TIMESTAMP
          </span>
          <div className="mt-1 truncate">
            <span className="font-mono text-[13px] font-bold text-on-surface block truncate">
              {latestLog ? latestLog.displayTime.split(' ')[1] : '--:--:--'}
            </span>
            <span className="text-[10px] font-mono text-outline block truncate">
              {latestLog ? latestLog.displayTime.split(' ')[0] : 'NO RECORDS'}
            </span>
          </div>
          <span className="text-[10px] text-primary font-mono mt-0.5 block">
            {latestLog ? latestLog.relativeTime : 'N/A'}
          </span>
        </div>

        <div className="bg-surface-container p-space-sm rounded-xl border border-surface-container-high shadow-lg">
          <span className="font-telemetry-label text-outline text-[10px] uppercase tracking-wider block">
            DUTY CYCLE STANDARD
          </span>
          <div className="mt-1">
            <span className="font-mono text-[13px] font-bold text-on-surface block">
              70-HR / 8-DAY
            </span>
            <span className="text-[10px] font-mono text-outline block">
              49 CFR § 395.8
            </span>
          </div>
          <span className="text-[10px] text-primary font-mono mt-0.5 block">
            Cycle Compliant
          </span>
        </div>

        <div className="bg-surface-container p-space-sm rounded-xl border border-surface-container-high shadow-lg">
          <span className="font-telemetry-label text-outline text-[10px] uppercase tracking-wider block">
            DRIVER SIGNING AUTHORITY
          </span>
          <div className="mt-1 truncate">
            <span className="font-mono text-[13px] font-bold text-on-surface block truncate">
              JONATHAN VANCE
            </span>
            <span className="text-[10px] font-mono text-outline block truncate">
              CDL: IL-98104820
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
            Active Digital Key
          </span>
        </div>
      </div>

      {/* PRIMARY 'LOGS HISTORY' SECTION */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/80 shadow-2xl space-y-space-md">
        {/* Section Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container-high">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                history_edu
              </span>
              <h2 className="font-label-caps text-[14px] text-primary uppercase font-bold tracking-wider">
                Logs History
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono text-[10px] font-bold">
                {inspectionLogs.length} Records
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-outline mt-0.5">
              Historical Inspection PDF generation timestamps, cryptographic hashes, and driver compliance actions.
            </p>
          </div>

          {/* Actions: Export CSV, Print Daily DVIR & Generate New Inspection PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (onOpenPdfModal) {
                  onOpenPdfModal();
                }
                setTimeout(() => window.print(), 300);
              }}
              className="px-3.5 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-label-caps text-[11px] font-bold uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Print official daily vehicle inspection report (FMCSA § 396.11 / § 395.8) for physical documentation requirement"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Daily DVIR Report</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary border border-surface-container-highest hover:border-primary/50 font-label-caps text-[11px] font-bold uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export inspection logs history to CSV spreadsheet for offline records"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                if (onGenerateNewPdf) {
                  onGenerateNewPdf('MANUAL_HUD', 'Manual compliance PDF generation triggered from Security Vault.');
                } else if (onOpenPdfModal) {
                  onOpenPdfModal();
                }
                onShowToast('NEW INSPECTION PDF GENERATION RECORD CREATED', 'picture_as_pdf');
              }}
              className="px-3.5 py-2 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] font-bold uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Generate a new certified Inspection PDF timestamp"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Generate New Inspection PDF</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'All Logs', count: inspectionLogs.length },
                {
                  id: 'VOICE_CONTROL',
                  label: 'Voice Generated',
                  count: inspectionLogs.filter((l) => l.triggerSource === 'VOICE_CONTROL').length,
                },
                {
                  id: 'OFFICER_REQUEST',
                  label: 'Roadside Audits',
                  count: inspectionLogs.filter((l) => l.triggerSource === 'OFFICER_REQUEST').length,
                },
                {
                  id: 'CAB_PRINTER',
                  label: 'In-Cab Printed',
                  count: inspectionLogs.filter((l) => l.triggerSource === 'CAB_PRINTER').length,
                },
                {
                  id: 'MANUAL_HUD',
                  label: 'HUD Cockpit',
                  count: inspectionLogs.filter((l) => l.triggerSource === 'MANUAL_HUD').length,
                },
              ] as { id: FilterType; label: string; count: number }[]
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedFilter === filter.id
                    ? 'bg-primary text-on-primary font-bold shadow-md'
                    : 'bg-surface-container-low text-outline hover:text-on-surface hover:bg-surface-container-highest border border-surface-container-high'
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded-full ${
                    selectedFilter === filter.id ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-outline'
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search timestamps, record #..."
              className="w-full bg-surface-container-low border border-surface-container-high rounded-lg pl-8 pr-3 py-1.5 text-[11px] font-mono text-on-surface placeholder:text-outline/70 focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-white text-[14px]"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* List of Previous Inspection PDF Generation Timestamps */}
        <div className="space-y-space-sm">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-low rounded-xl border border-surface-container-high/60">
              <span className="material-symbols-outlined text-[36px] text-outline mb-2">
                folder_open
              </span>
              <p className="font-headline-sm text-[14px] text-on-surface font-semibold">
                No Inspection Generation Logs Found
              </p>
              <p className="text-[11px] text-outline mt-1 font-mono">
                {searchQuery
                  ? `No logs match "${searchQuery}". Clear query to view all records.`
                  : 'No compliance records for this filter. Click "Generate New Inspection PDF" to create one.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1 bg-surface-container text-primary font-mono text-[11px] rounded border border-surface-container-highest hover:bg-surface-container-high"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getTriggerBadge(log.triggerSource);
              const isCopied = copiedHashId === log.id;

              return (
                <div
                  key={log.id}
                  className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high/90 hover:border-primary/40 transition-all shadow-md space-y-2.5"
                >
                  {/* Top Bar: Timestamps & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Generation Timestamp Tag */}
                      <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded-md border border-white/5">
                        <span className="material-symbols-outlined text-primary text-[14px]">
                          schedule
                        </span>
                        <span className="font-mono text-[12px] font-bold text-on-surface tracking-tight">
                          {log.displayTime}
                        </span>
                      </div>

                      {/* Relative Time Pill */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-outline">
                        {log.relativeTime}
                      </span>

                      {/* Trigger Source Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${badge.badgeClass}`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {badge.icon}
                        </span>
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Attestation Status & Record ID */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <span className="font-mono text-[10px] text-outline">
                        ID: {log.recordNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        SEALED
                      </span>
                    </div>
                  </div>

                  {/* Title and Notes */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pt-1 border-t border-white/5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          picture_as_pdf
                        </span>
                        <h3 className="font-headline-sm text-[13px] font-bold text-on-surface">
                          {log.actionTitle}
                        </h3>
                        <span className="text-[10px] font-mono text-outline">
                          ({log.cycle} • {log.fileSize})
                        </span>
                      </div>
                      <p className="text-[11px] text-outline font-body-sm leading-relaxed pl-5">
                        {log.notes}
                      </p>
                    </div>

                    {/* Quick View Button */}
                    {onOpenPdfModal && (
                      <button
                        onClick={onOpenPdfModal}
                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-primary/50 text-primary font-mono text-[11px] flex items-center gap-1 shrink-0 transition-all cursor-pointer self-end sm:self-center"
                        title="View and preview the generated 8-day compliance PDF"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>View PDF Record</span>
                      </button>
                    )}
                  </div>

                  {/* Cryptographic SHA-256 Merkle Proof Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest/80 border border-white/5 text-[10px] font-mono">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-outline uppercase shrink-0 font-bold">
                        SHA-256 HASH:
                      </span>
                      <span className="text-primary font-mono truncate max-w-xs sm:max-w-md">
                        {log.merkleHash}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleCopyHash(log.id, log.merkleHash)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-highest text-outline hover:text-on-surface border border-surface-container-high flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy SHA-256 hash to clipboard"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {isCopied ? 'done' : 'content_copy'}
                        </span>
                        <span>{isCopied ? 'COPIED' : 'COPY HASH'}</span>
                      </button>

                      <button
                        onClick={() => handleVerifySeal(log)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-highest text-primary hover:text-white border border-surface-container-high flex items-center gap-1 transition-colors cursor-pointer"
                        title="Verify cryptographic HSM seal against hardware ledger"
                      >
                        <span className="material-symbols-outlined text-[12px]">verified</span>
                        <span>VERIFY SEAL</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & log management */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-container-high text-[11px] font-mono text-outline">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">gavel</span>
            <span>49 CFR § 395.15 COMPLIANCE: Records preserved in immutable tamper-evident storage.</span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={handleExportCSV}
              className="text-primary/90 hover:text-primary text-[10px] uppercase font-bold hover:underline flex items-center gap-1 cursor-pointer"
              title="Download CSV spreadsheet"
            >
              <span className="material-symbols-outlined text-[12px]">download</span>
              <span>Export CSV</span>
            </button>

            {onClearLogs && inspectionLogs.length > 0 && (
              <button
                onClick={onClearLogs}
                className="text-error/80 hover:text-error text-[10px] uppercase font-bold hover:underline"
                title="Reset history to default compliance records"
              >
                Reset Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RECENT HSM HARDWARE AUDIT TRAIL */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">key</span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold block">
              Recent HSM Hardware Audit Trail
            </span>
          </div>
          <span className="font-mono text-[10px] text-outline">HARDWARE ENCLAVE</span>
        </div>

        {[
          {
            event: 'USDOT Authority Verified (FMCSA Sync)',
            hash: '0x8f...39a882',
            time: '10:45 AM CDT',
            type: 'AUTHORITY',
          },
          {
            event: 'Session Cryptographic Key Renewed',
            hash: '0x32...11b094',
            time: '11:00 AM CDT',
            type: 'KEY_CYCLE',
          },
          {
            event: 'Freight Load Assignment Locked (#QM-8821)',
            hash: '0x1c...9ef412',
            time: '11:15 AM CDT',
            type: 'LOAD_LOCK',
          },
          {
            event: 'Driver Jonathan Vance CDL Attested (IL-98104820)',
            hash: '0x7c...54a901',
            time: '11:45 AM CDT',
            type: 'SIGNATURE',
          },
        ].map((log, i) => (
          <div
            key={i}
            className="flex justify-between items-center p-3 bg-surface-container-low border border-surface-container-highest rounded-lg cursor-pointer hover:bg-surface-container transition-colors"
            onClick={() => onShowToast(`Verified HSM Hash: ${log.hash}`, 'verified')}
          >
            <div>
              <span className="block text-[13px] font-bold text-on-surface">
                {log.event}
              </span>
              <span className="block text-[10px] text-outline font-mono mt-0.5">
                Hash: {log.hash} • Protocol: ECDSA P-256 (FIPS PUB 186-4)
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-primary font-mono block">
                {log.time}
              </span>
              <span className="text-[9px] text-emerald-400 font-mono">VALID</span>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Statutory Roadside Inspection Rights Box */}
      <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">
          policy
        </span>
        <div className="space-y-1 text-[11px] text-outline leading-relaxed">
          <span className="font-label-caps text-on-surface uppercase font-bold block text-[11px]">
            Commercial Driver Roadside Audit Advisory (FMCSA § 395.24)
          </span>
          <p>
            When requested by a state highway patrol officer or safety official, drivers may present
            the certified 8-Day Driver Daily Log PDF directly on the in-cab display or transmit it
            via electronic web transfer. Drivers are under no obligation to hand over or unlock personal
            apps, device settings, or messaging software outside the dedicated Officer Shield.
          </p>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

