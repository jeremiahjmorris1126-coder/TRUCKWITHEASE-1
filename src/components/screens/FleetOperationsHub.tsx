import React, { useState } from 'react';
import { InspectionLogEntry } from '../../types';
import { FleetExpensesInvoiceScreen } from './FleetExpensesInvoiceScreen';
import { SecurityVaultScreen } from './SecurityVaultScreen';
import { EcosystemTrustHubScreen } from './EcosystemTrustHubScreen';
import { MasterSynchronizerScreen } from './MasterSynchronizerScreen';

interface FleetOperationsHubProps {
  initialSubTab?: 'invoices' | 'vault' | 'trust' | 'sync';
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPdfModal?: () => void;
  inspectionLogs: InspectionLogEntry[];
  onGenerateNewPdf: (triggerSource?: string, notes?: string) => void;
  onClearLogs?: () => void;
}

export const FleetOperationsHub: React.FC<FleetOperationsHubProps> = ({
  initialSubTab = 'invoices',
  onShowToast,
  onOpenPdfModal,
  inspectionLogs,
  onGenerateNewPdf,
  onClearLogs,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'vault' | 'trust' | 'sync'>(
    initialSubTab
  );

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto space-y-4">
      {/* UNIFIED SEGMENTED CONTROL BAR */}
      <div className="sticky top-16 z-30 bg-surface-container-lowest/95 backdrop-blur-md p-2 rounded-2xl border border-surface-container-high/60 shadow-xl">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-2 flex-1">
            <button
              onClick={() => setActiveSubTab('invoices')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'invoices'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>Invoices & Fuel</span>
            </button>

            <button
              onClick={() => setActiveSubTab('vault')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'vault'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span>Compliance Vault</span>
            </button>

            <button
              onClick={() => setActiveSubTab('trust')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'trust'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">hub</span>
              <span>Trust Network</span>
            </button>

            <button
              onClick={() => setActiveSubTab('sync')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap flex-1 ${
                activeSubTab === 'sync'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container/60 hover:bg-surface-container text-outline hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
              <span>System & Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE MODULE */}
      <div className="w-full">
        {activeSubTab === 'invoices' && (
          <FleetExpensesInvoiceScreen onShowToast={onShowToast} />
        )}
        {activeSubTab === 'vault' && (
          <SecurityVaultScreen
            onShowToast={onShowToast}
            onOpenPdfModal={onOpenPdfModal || (() => {})}
            inspectionLogs={inspectionLogs}
            onGenerateNewPdf={onGenerateNewPdf}
            onClearLogs={onClearLogs || (() => {})}
          />
        )}
        {activeSubTab === 'trust' && (
          <EcosystemTrustHubScreen onShowToast={onShowToast} />
        )}
        {activeSubTab === 'sync' && (
          <MasterSynchronizerScreen onShowToast={onShowToast} />
        )}
      </div>
    </div>
  );
};
