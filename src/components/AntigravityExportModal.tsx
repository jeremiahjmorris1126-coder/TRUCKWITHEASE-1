import React, { useState } from 'react';
import { FirebaseDeploymentModal } from './FirebaseDeploymentModal';
import { loadMonitorDrivers } from '../services/liveDispatchMonitorService';

interface AntigravityExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
}

export const AntigravityExportModal: React.FC<AntigravityExportModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'DEPLOY' | 'SNAPSHOT'>('DEPLOY');

  if (!isOpen) return null;

  const downloadFleetSnapshot = () => {
    try {
      const content = JSON.stringify(
        { exportedAt: new Date().toISOString(), drivers: loadMonitorDrivers() },
        null,
        2
      );
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'truckwithease-fleet-snapshot.json';
      link.click();
      URL.revokeObjectURL(url);
      if (onShowToast) onShowToast('Fleet snapshot downloaded successfully', 'check_circle');
    } catch {
      if (onShowToast) onShowToast('Failed to export snapshot', 'error');
    }
  };

  if (activeTab === 'DEPLOY') {
    return (
      <FirebaseDeploymentModal
        isOpen={isOpen}
        onClose={onClose}
        onShowToast={onShowToast}
        onSwitchToSnapshot={() => setActiveTab('SNAPSHOT')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <section className="w-full max-w-md rounded-xl border border-amber-500/50 bg-[#0A0F14] p-5 text-white shadow-2xl">
        <h2 className="text-lg font-black uppercase tracking-wide text-amber-300">Fleet Snapshot Export</h2>
        <p className="mt-2 text-sm text-slate-300">
          Download the locally stored fleet monitor data as JSON. No external cloud service is contacted.
        </p>
        <div className="mt-5 flex justify-between gap-3">
          <button
            onClick={() => setActiveTab('DEPLOY')}
            className="rounded-lg border border-amber-500/50 text-amber-400 px-3 py-2 text-xs font-bold"
          >
            ← Cloud Deployment
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={downloadFleetSnapshot}
              className="rounded-lg bg-[#FFE500] px-4 py-2 text-sm font-black uppercase text-black"
            >
              Download JSON
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AntigravityExportModal;
