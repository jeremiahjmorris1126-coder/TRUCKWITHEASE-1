import React, { useState, useEffect } from 'react';

interface FirebaseDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, icon?: string) => void;
}

interface GitStatusData {
  status: string;
  branch: string;
  lastCommit: string;
  remoteUrl: string;
  hasUncommittedChanges: boolean;
  uncommittedFilesCount: number;
  targetDomains?: string[];
  provider?: string;
  timestamp: string;
}

export const FirebaseDeploymentModal: React.FC<FirebaseDeploymentModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'DEPLOY' | 'DOMAINS' | 'DNS_FIX' | 'GUIDE'>('DEPLOY');
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/export-cloudflare-github/status');
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch (e) {
      console.warn('Failed to retrieve git status:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCommand(label);
    onShowToast?.(`COPIED COMMAND: ${label}`, 'content_copy');
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#05080E] border border-amber-400/50 rounded-2xl shadow-[0_0_50px_rgba(255,229,0,0.3)] overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0A0F14] border-b border-amber-400/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE500] text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,229,0,0.45)] font-black shrink-0">
              <span className="material-symbols-outlined text-[24px]">cloud_done</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-400/40">
                  GOOGLE CLOUD PLATFORM
                </span>
                <span className="bg-emerald-950/90 text-[#10B981] border border-[#10B981]/50 text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping inline-block"></span>
                  FIREBASE HOSTING READY
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-headline-sm font-bold text-white uppercase tracking-wide mt-0.5">
                Google Cloud / Firebase Enterprise Deploy Center
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Close Center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-[#0A0F14] px-4 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('DEPLOY')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'DEPLOY'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
            <span>DEPLOY TO FIREBASE</span>
          </button>

          <button
            onClick={() => setActiveTab('DOMAINS')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'DOMAINS'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">language</span>
            <span>CUSTOM DOMAINS</span>
          </button>

          <button
            onClick={() => setActiveTab('DNS_FIX')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'DNS_FIX'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">sync_problem</span>
            <span>PREVENT REDIRECT LOOPS</span>
          </button>

          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'GUIDE'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>FIREBASE RUNBOOK</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#05080E]">
          {/* Target Hostnames Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0A0F14] border border-[#FFE500]/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#FFE500] text-[20px]">local_shipping</span>
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wider font-mono">Primary Driver HUD</div>
                  <div className="text-sm font-bold text-white font-mono">truckwithease.com</div>
                </div>
              </div>
              <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                GOOGLE CDN
              </span>
            </div>

            <div className="bg-[#0A0F14] border border-amber-400/30 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">hub</span>
                <div>
                  <div className="text-[10px] text-white/50 uppercase tracking-wider font-mono">Enterprise Portal</div>
                  <div className="text-sm font-bold text-white font-mono">Morrishive.com</div>
                </div>
              </div>
              <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                GOOGLE CDN
              </span>
            </div>
          </div>

          {/* TAB 1: 1-Click Deploy */}
          {activeTab === 'DEPLOY' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFE500]/20 text-[#FFE500] flex items-center justify-center shrink-0 border border-[#FFE500]/30 font-bold">
                    <span className="material-symbols-outlined text-[22px]">terminal</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Automated 1-Click Firebase Deployment
                    </h3>
                    <p className="text-xs text-white/70 mt-1 font-sans leading-relaxed">
                      Deploy directly from your terminal using the automated PowerShell script or the local Firebase CLI. Assets are built and uploaded to Google's worldwide hosting infrastructure.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="bg-black/80 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-white/50 font-mono uppercase">Automated Script (Recommended)</div>
                      <code className="text-sm font-mono text-[#FFE500] font-bold">.\deploy_to_firebase.ps1</code>
                    </div>
                    <button
                      onClick={() => handleCopy('.\\deploy_to_firebase.ps1', 'PowerShell Script')}
                      className="px-3 py-1.5 rounded-lg bg-[#FFE500] hover:bg-[#FFDF00] text-black font-bold text-xs uppercase cursor-pointer"
                    >
                      {copiedCommand === 'PowerShell Script' ? 'COPIED!' : 'COPY'}
                    </button>
                  </div>

                  <div className="bg-black/80 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-white/50 font-mono uppercase">Direct NPM / Bun Command</div>
                      <code className="text-sm font-mono text-[#FFE500] font-bold">bun run deploy:firebase</code>
                    </div>
                    <button
                      onClick={() => handleCopy('bun run deploy:firebase', 'Bun Deploy')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      {copiedCommand === 'Bun Deploy' ? 'COPIED!' : 'COPY'}
                    </button>
                  </div>

                  <div className="bg-black/80 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-white/50 font-mono uppercase">Google Cloud Authentication</div>
                      <code className="text-sm font-mono text-[#FFE500] font-bold">bun run firebase:login</code>
                    </div>
                    <button
                      onClick={() => handleCopy('bun run firebase:login', 'Firebase Login')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      {copiedCommand === 'Firebase Login' ? 'COPIED!' : 'COPY'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status info */}
              <div className="p-4 rounded-xl bg-[#0A0F14] border border-white/10 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#10B981] text-[18px]">verified</span>
                  <span className="text-white font-bold">firebase.json configuration:</span>
                  <span className="text-[#FFE500]">ACTIVE &amp; VERIFIED</span>
                </div>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1 font-sans"
                >
                  <span>Firebase Console</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: Custom Domains */}
          {activeTab === 'DOMAINS' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px]">dns</span>
                  <span>Google Cloud Custom Domains Setup</span>
                </h3>
                <p className="text-xs text-white/70 font-sans leading-relaxed">
                  Google Cloud / Firebase Hosting provisions dedicated global Anycast IP addresses and automatically issues free, managed Google Trust Services SSL certificates for both domains.
                </p>

                {/* Domain 1 */}
                <div className="p-4 rounded-xl bg-[#05080E] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FFE500] font-bold text-sm font-mono">truckwithease.com</span>
                      <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] px-2 py-0.5 rounded font-mono">
                        PRIMARY HUD
                      </span>
                    </div>
                    <span className="text-xs text-[#10B981] font-mono font-bold">SSL: GOOGLE MANAGED</span>
                  </div>
                  <div className="text-xs text-white/70 font-sans">
                    Also includes <span className="text-white font-mono">www.truckwithease.com</span> with zero-latency canonical routing.
                  </div>
                </div>

                {/* Domain 2 */}
                <div className="p-4 rounded-xl bg-[#05080E] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-sm font-mono">Morrishive.com</span>
                      <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] px-2 py-0.5 rounded font-mono">
                        ENTERPRISE PORTAL
                      </span>
                    </div>
                    <span className="text-xs text-[#10B981] font-mono font-bold">SSL: GOOGLE MANAGED</span>
                  </div>
                  <div className="text-xs text-white/70 font-sans">
                    Also includes <span className="text-white font-mono">www.morrishive.com</span> pointing to the identical Firebase Hosting deployment.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Prevent Redirect Loops */}
          {activeTab === 'DNS_FIX' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="material-symbols-outlined text-[24px]">warning</span>
                  <h3 className="text-base font-bold text-white uppercase tracking-wide">
                    How Google Cloud Solves the "Too Many Redirects" Loop
                  </h3>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-white/80 space-y-2 font-sans leading-relaxed">
                  <p className="font-bold text-amber-300">
                    Why Cloudflare was failing on www.morrishive.com:
                  </p>
                  <p>
                    Cloudflare had a broken forwarding rule returning <code className="bg-black/60 px-1 py-0.5 rounded text-amber-300 font-mono">Location: www.morrishive.com</code> without <code className="text-amber-300 font-mono">https://</code>, causing your browser to loop forever.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    2-Step Permanent Fix with Firebase:
                  </div>

                  <div className="p-3 rounded-lg bg-[#05080E] border border-white/10 flex gap-3 text-xs font-sans">
                    <span className="w-5 h-5 rounded-full bg-[#FFE500] text-black font-bold flex items-center justify-center shrink-0">1</span>
                    <div>
                      <div className="text-white font-bold">Add Domains in Firebase Console</div>
                      <div className="text-white/60 mt-0.5">
                        Firebase will display 2 Google A-records (e.g. <span className="text-[#FFE500] font-mono">199.36.158.100</span>).
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#05080E] border border-white/10 flex gap-3 text-xs font-sans">
                    <span className="w-5 h-5 rounded-full bg-[#FFE500] text-black font-bold flex items-center justify-center shrink-0">2</span>
                    <div>
                      <div className="text-white font-bold">In Cloudflare DNS: Set to "DNS Only" (Gray Cloud)</div>
                      <div className="text-white/60 mt-0.5">
                        Toggle the proxy status icon from Orange Cloud to <strong className="text-white">DNS Only (Gray Cloud)</strong>. This stops Cloudflare from proxying or redirecting. Google Cloud takes over 100% of SSL and traffic cleanly with zero loops!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Runbook */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px]">verified</span>
                  <span>Google Cloud / Firebase Hosting 3-Step Runbook</span>
                </h3>

                <ol className="space-y-3 text-xs font-sans">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">1</div>
                    <div>
                      <div className="text-white font-bold">Login to Google Account</div>
                      <p className="text-white/70 mt-0.5">
                        Run <code className="bg-black/60 px-1 py-0.5 rounded text-[#FFE500] font-mono">bun run firebase:login</code> and approve in your browser.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">2</div>
                    <div>
                      <div className="text-white font-bold">Run Deployment Script</div>
                      <p className="text-white/70 mt-0.5">
                        Execute <code className="bg-black/60 px-1 py-0.5 rounded text-[#FFE500] font-mono">.\deploy_to_firebase.ps1</code>. Your React 19 + Vite app compiles and uploads to Google Cloud CDN in seconds.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">3</div>
                    <div>
                      <div className="text-white font-bold">Bind Morrishive.com &amp; truckwithease.com</div>
                      <p className="text-white/70 mt-0.5">
                        In Firebase Console &gt; Hosting, click <strong>Add custom domain</strong> and add both hostnames.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#0A0F14] border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span>Google Cloud CDN // Global Anycast Edge Infrastructure</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-sans text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
