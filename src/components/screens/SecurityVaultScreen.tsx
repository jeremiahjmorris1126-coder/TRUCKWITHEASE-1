import React, { useState, useEffect } from 'react';
import { InspectionLogEntry, InspectionActionType, InspectionTriggerSource } from '../../types';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface SecurityVaultProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPdfModal?: () => void;
  inspectionLogs?: InspectionLogEntry[];
  onGenerateNewPdf?: (triggerSource?: string, notes?: string) => void;
  onClearLogs?: () => void;
  onRecordInspectionEvent?: (type: InspectionActionType, source: InspectionTriggerSource) => void;
}

export const SecurityVaultScreen: React.FC<SecurityVaultProps> = ({
  onShowToast,
  inspectionLogs = [],
}) => {
  const [driverProfile, setDriverProfile] = useState<{
    name: string;
    cdlNumber: string;
    cdlState: string;
    assignedUnitId: string;
    carrierName?: string;
    usdotNumber?: string;
    mcNumber?: string;
  } | null>(null);
  const [documentsCount, setDocumentsCount] = useState<number>(0);

  useEffect(() => {
    authenticatedFetch('/api/driver/profile')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setDriverProfile(data.profile);
          }
        }
      })
      .catch(() => {});

    authenticatedFetch('/api/driver/documents')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.documents)) {
            setDocumentsCount(data.documents.length);
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary block">
            Document &amp; Profile Vault
          </span>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-white tracking-tight">
            Security &amp; Roadside Summary
          </h1>
        </div>
      </div>

      {/* Signed-In Driver Profile or Nothing Before Login */}
      {driverProfile ? (
        <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high shadow-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <span className="text-white font-bold uppercase tracking-wider">
              Signed-In Driver Profile (/api/driver/profile)
            </span>
            <span className="text-slate-400">{documentsCount} Stored Document(s)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-surface-container border border-slate-800 space-y-1">
              <span className="text-[10px] text-on-surface-variant uppercase block">DRIVER</span>
              <span className="text-white font-bold block">{driverProfile.name}</span>
              {driverProfile.cdlNumber && (
                <span className="text-slate-400 block">
                  CDL: {driverProfile.cdlState} {driverProfile.cdlNumber}
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface-container border border-slate-800 space-y-1">
              <span className="text-[10px] text-on-surface-variant uppercase block">CARRIER &amp; UNIT</span>
              {driverProfile.carrierName && (
                <span className="text-white font-bold block">{driverProfile.carrierName}</span>
              )}
              {driverProfile.usdotNumber && (
                <span className="text-slate-400 block">USDOT: {driverProfile.usdotNumber}</span>
              )}
              {driverProfile.assignedUnitId && (
                <span className="text-slate-400 block">Unit: {driverProfile.assignedUnitId}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-low p-6 rounded-xl border border-surface-container-high text-center font-mono text-xs text-slate-400">
          Sign in to view your driver profile from /api/driver/profile.
        </div>
      )}

      {/* ELD Read-Only Notice */}
      <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high text-center font-mono text-xs text-slate-300">
        Hours of service come from your ELD. Connect your ELD to view them here.
      </div>

      {/* Session Inspection Activity Log (only real session events, empty by default) */}
      {inspectionLogs.length > 0 && (
        <div className="bg-surface-container-low p-5 rounded-xl border border-surface-container-high space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
            <span className="text-white font-bold uppercase">Session Activity</span>
            <button
              onClick={() => onShowToast('Session activity refreshed', 'refresh')}
              className="text-primary text-[11px] cursor-pointer"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {inspectionLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-surface-container border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="text-white font-bold">{log.actionTitle}</div>
                  <div className="text-[10px] text-slate-400">{log.displayTime}</div>
                </div>
                <span className="text-[10px] text-slate-400">{log.recordNumber}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
