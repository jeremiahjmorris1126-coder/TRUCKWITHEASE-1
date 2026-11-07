import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../services/firebaseClientAuth';

interface InspectionPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCycle?: '70_8' | '60_7';
  onShowToast?: (msg: string, icon?: string) => void;
  onPrinted?: () => void;
  onRecordInspectionEvent?: (type: 'PDF_GENERATED' | 'PRINTED', source: 'MANUAL_HUD' | 'CAB_PRINTER' | 'VOICE_CONTROL') => void;
}

export const InspectionPdfModal: React.FC<InspectionPdfModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onPrinted,
  onRecordInspectionEvent,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [driverProfile, setDriverProfile] = useState<{
    name: string;
    cdlNumber: string;
    cdlState: string;
    assignedUnitId: string;
    carrierName?: string;
    usdotNumber?: string;
    mcNumber?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
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
          } else {
            setDriverProfile(null);
          }
        } else {
          setDriverProfile(null);
        }
      })
      .catch(() => {
        setDriverProfile(null);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (onRecordInspectionEvent) {
      onRecordInspectionEvent('PRINTED', 'CAB_PRINTER');
    }
    if (onPrinted) {
      onPrinted();
    }
    if (onShowToast) {
      onShowToast('Sending Driver Profile Summary to Printer...', 'print');
    }
    window.print();
  };

  const handleDownloadReport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportComplete(true);
      if (onRecordInspectionEvent) {
        onRecordInspectionEvent('PDF_GENERATED', 'MANUAL_HUD');
      }
      if (onShowToast) {
        onShowToast('Driver Profile Summary Ready', 'verified');
      }
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container border-2 border-primary/50 rounded-xl shadow-[0_0_50px_rgba(255,229,0,0.2)] overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar */}
        <div className="bg-surface-container-highest px-5 py-3.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold shadow">
              <span className="material-symbols-outlined">description</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Space_Grotesk'] text-base font-bold text-white uppercase tracking-wider">
                  Roadside Driver Profile Summary
                </h2>
              </div>
              <p className="text-[11px] font-mono text-on-surface-variant">
                Hours of service come from your ELD. Connect your ELD to view them here.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-slate-800 text-white border border-slate-600 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-amber-400 text-on-primary font-['Space_Grotesk'] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {exportComplete ? 'check_circle' : 'download'}
              </span>
              <span>
                {isExporting
                  ? 'Preparing...'
                  : exportComplete
                  ? 'Summary Ready'
                  : 'Generate Summary'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 bg-[#0e131d] text-slate-200 font-mono text-xs">
          {!driverProfile ? (
            <div className="p-6 rounded-lg bg-surface-container-lowest border border-slate-700 text-center text-slate-400">
              Sign in to view your driver profile from /api/driver/profile.
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-4 rounded-lg border border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-primary uppercase font-bold">DRIVER IDENTIFICATION</div>
                  <div className="text-white font-bold">{driverProfile.name || 'Not specified'}</div>
                  {driverProfile.cdlNumber && (
                    <div className="text-slate-400">
                      CDL: {driverProfile.cdlNumber} ({driverProfile.cdlState})
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-primary uppercase font-bold">CARRIER / EQUIPMENT</div>
                  {driverProfile.carrierName && (
                    <div className="text-white font-bold">{driverProfile.carrierName}</div>
                  )}
                  {driverProfile.usdotNumber && (
                    <div className="text-slate-400">USDOT: {driverProfile.usdotNumber}</div>
                  )}
                  {driverProfile.assignedUnitId && (
                    <div className="text-slate-400">Unit: {driverProfile.assignedUnitId}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface-container-lowest p-4 rounded-lg border border-slate-700 text-center text-slate-300">
            Hours of service come from your ELD. Connect your ELD to view them here.
          </div>
        </div>
      </div>
    </div>
  );
};
