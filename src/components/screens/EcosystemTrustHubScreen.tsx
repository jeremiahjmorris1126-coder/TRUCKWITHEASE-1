import React from 'react';

interface EcosystemProps {
  onShowToast: (msg: string) => void;
}

export const EcosystemTrustHubScreen: React.FC<EcosystemProps> = ({ onShowToast }) => {
  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider block">
              Ecosystem Trust Hub
            </span>
            <span className="font-headline-sm text-on-surface text-[17px] font-bold">
              Integration Health & Compliance
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-primary/20 text-primary font-telemetry-label text-[10px] font-bold rounded">
          ALL SYSTEMS NOMINAL
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        {/* Placeholder integration blocks */}
        {[
          { name: 'FMCSA Webhooks', status: 'Active', latency: '12ms', icon: 'webhook' },
          { name: 'Samsara Telematics', status: 'Syncing', latency: '45ms', icon: 'satellite_alt' },
          { name: 'DAT Freight', status: 'Connected', latency: '8ms', icon: 'swap_horiz' },
          { name: 'Stripe Treasury', status: 'Active', latency: '22ms', icon: 'payments' },
        ].map(integration => (
          <div key={integration.name} className="bg-surface-container p-space-md rounded-xl border border-surface-container-high shadow-xl space-y-3">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">{integration.icon}</span>
                  <span className="font-label-caps text-primary font-bold uppercase">{integration.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-surface-container-highest text-primary font-mono text-[9px] rounded">
                   {integration.latency}
                </span>
             </div>
             <div className="flex justify-between items-center mt-2 border-t border-surface-container-high pt-2">
                <span className="text-[12px] text-outline">Connection State</span>
                <span className="text-[12px] text-primary font-bold">{integration.status}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
