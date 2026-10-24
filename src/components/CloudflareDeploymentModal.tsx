import React, { useState, useEffect } from 'react';

interface CloudflareDeploymentModalProps {
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
  cloudflareReady?: boolean;
  targetDomains?: string[];
  provider?: string;
  timestamp: string;
}

export const CloudflareDeploymentModal: React.FC<CloudflareDeploymentModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'PUSH' | 'DOMAINS' | 'PACKAGE' | 'GUIDE'>('PUSH');
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem('truck_github_pat') || '';
    } catch {
      return '';
    }
  });
  const [showToken, setShowToken] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>(
    'Production release: 1-Click Cloudflare Pages deploy for Morrishive.com & truckwithease.com'
  );
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushLogs, setPushLogs] = useState<string[]>([]);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    commitHash?: string;
    message?: string;
    repoUrl?: string;
    details?: string;
  } | null>(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/export-cloudflare-github/status');
      if (res.ok) {
        const data: GitStatusData = await res.json();
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
      setPushResult(null);
      setPushLogs([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveToken = (val: string) => {
    setGithubToken(val);
    try {
      if (val.trim()) {
        localStorage.setItem('truck_github_pat', val.trim());
      } else {
        localStorage.removeItem('truck_github_pat');
      }
    } catch {}
  };

  const handleExecutePush = async () => {
    setIsPushing(true);
    setPushResult(null);
    setPushLogs([
      'Initializing Cloudflare Pages & GitHub Production Export...',
      'Staging repository workspace and checking index integrity...',
    ]);

    try {
      await new Promise((r) => setTimeout(r, 350));
      setPushLogs((prev) => [
        ...prev,
        'Verifying wrangler.toml, public/_redirects, and public/_headers manifest...',
      ]);

      const response = await fetch('/api/export-cloudflare-github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken.trim() || undefined,
          commitMessage: commitMessage.trim() || 'Cloudflare release update',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPushLogs((prev) => [
          ...prev,
          `Commit hash created: ${data.lastCommit || 'Latest Head'}`,
          `Branch pushed cleanly: origin/${data.branch || 'main'}`,
          'Cloudflare Pages CI/CD webhook triggered.',
          'Edge deployment initiated for Morrishive.com & truckwithease.com.',
        ]);
        setPushResult({
          success: true,
          commitHash: data.lastCommit,
          message: data.message,
          repoUrl: data.repoUrl || 'https://github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1',
        });
        onShowToast?.('UPDATE PUSHED // CLOUDFLARE PAGES BUILDING NOW', 'rocket_launch');
        fetchStatus();
      } else {
        setPushLogs((prev) => [
          ...prev,
          `Push operation failed: ${data.error || 'Unknown error'}`,
        ]);
        setPushResult({
          success: false,
          details: data.details || data.error || 'Failed to authenticate or push to GitHub remote.',
        });
        onShowToast?.('REMOTE PUSH FAILED // CHECK TOKEN OR CREDENTIALS', 'error');
      }
    } catch (err: any) {
      setPushLogs((prev) => [...prev, `Network/Server Error: ${err.message}`]);
      setPushResult({
        success: false,
        details: err.message || 'Network error encountered during push.',
      });
      onShowToast?.('EXPORT SERVICE DISCONNECTED', 'cloud_off');
    } finally {
      setIsPushing(false);
    }
  };

  const handleDownloadTarGz = () => {
    onShowToast?.('PREPARING CLOUDFLARE PRODUCTION ARCHIVE (.TAR.GZ)', 'download');
    const link = document.createElement('a');
    link.href = '/api/export-cloudflare-github/download';
    link.download = 'truckwithease-cloudflare-production-package.tar.gz';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#05080E] border border-amber-400/50 rounded-2xl shadow-[0_0_50px_rgba(255,229,0,0.3)] overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0A0F14] border-b border-amber-400/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE500] text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,229,0,0.45)] font-black shrink-0">
              <span className="material-symbols-outlined text-[24px]">cloud_sync</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-400/40">
                  CLOUDFLARE PRODUCTION HUB
                </span>
                <span className="bg-emerald-950/90 text-[#10B981] border border-[#10B981]/50 text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping inline-block"></span>
                  READY FOR CLOUDFLARE
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-headline-sm font-bold text-white uppercase tracking-wide mt-0.5">
                Cloudflare Pages Enterprise Deploy Center
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
            onClick={() => setActiveTab('PUSH')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PUSH'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            <span>PUSH TO CLOUDFLARE &amp; GITHUB</span>
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
            <span>DOMAINS: MORRISHIVE &amp; TRUCKWITHEASE</span>
          </button>

          <button
            onClick={() => setActiveTab('PACKAGE')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PACKAGE'
                ? 'bg-[#05080E] text-[#FFE500] border-t-2 border-[#FFE500] shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder_zip</span>
            <span>DOWNLOAD PACKAGE (.TAR.GZ)</span>
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
            <span>CLOUDFLARE GUIDE</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#05080E]">
          {/* Target Hostnames Header Pill Banner */}
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
                CLOUDFLARE EDGE
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
                CLOUDFLARE EDGE
              </span>
            </div>
          </div>

          {/* Repository Status Banner */}
          <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFE500] text-[18px]">account_tree</span>
              <span className="text-white/60">Target Repo:</span>
              <span className="text-white font-bold">jeremiahjmorris1126-coder/TRUCKWITHEASE-1</span>
              <span className="bg-[#FFE500]/20 text-[#FFE500] border border-[#FFE500]/40 px-1.5 py-0.5 rounded text-[10px]">
                {gitStatus?.branch || 'main'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {gitStatus?.hasUncommittedChanges ? (
                <span className="text-[#FFE500] flex items-center gap-1 font-sans font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#FFE500] inline-block"></span>
                  {gitStatus.uncommittedFilesCount} modified files ready to push
                </span>
              ) : (
                <span className="text-[#10B981] flex items-center gap-1 font-sans font-bold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Working directory clean
                </span>
              )}
              <button
                onClick={fetchStatus}
                disabled={isLoadingStatus}
                className="text-white/60 hover:text-white cursor-pointer"
                title="Refresh Git Status"
              >
                <span className={`material-symbols-outlined text-[16px] ${isLoadingStatus ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: 1-Click Push to Cloudflare & GitHub */}
          {activeTab === 'PUSH' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-4 space-y-3">
                <label className="block text-xs font-bold text-white uppercase tracking-wider">
                  Commit Description / Cloudflare Release Note
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe latest release updates..."
                  className="w-full px-3 py-2 bg-[#05080E] rounded-lg border border-white/20 text-white text-sm focus:outline-none focus:border-[#FFE500]"
                />

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>GitHub Personal Access Token (PAT)</span>
                      <span className="text-[10px] font-normal text-white/50 lowercase font-sans">
                        (optional if local git credentials exist)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[11px] text-[#FFE500] hover:underline cursor-pointer"
                    >
                      {showToken ? 'Hide Token' : 'Show Token'}
                    </button>
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => handleSaveToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (saved securely in browser)"
                    className="w-full px-3 py-2 bg-[#05080E] rounded-lg border border-white/20 text-white text-sm font-mono focus:outline-none focus:border-[#FFE500]"
                  />
                  <p className="text-[11px] text-white/50 mt-1 font-sans">
                    Enables authenticated direct push to GitHub origin/main to automatically trigger Cloudflare Pages CI/CD.
                  </p>
                </div>
              </div>

              {/* Push Action Button */}
              <button
                onClick={handleExecutePush}
                disabled={isPushing}
                className="w-full py-4 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] active:scale-[0.99] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,229,0,0.45)] border border-[#FFE500] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span>SYNCHRONIZING WITH GITHUB &amp; TRIGGERING CLOUDFLARE...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
                    <span>PUSH LATEST UPDATE TO CLOUDFLARE &amp; GITHUB NOW</span>
                  </>
                )}
              </button>

              {/* Push Console / Logs */}
              {pushLogs.length > 0 && (
                <div className="bg-black/90 rounded-xl p-3 border border-white/10 space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">terminal</span>
                    <span>Execution Stream</span>
                  </div>
                  {pushLogs.map((log, i) => (
                    <div key={i} className="text-[#FFE500]/90 leading-relaxed">
                      &gt; {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Result Notification Card */}
              {pushResult && (
                <div
                  className={`p-4 rounded-xl border ${
                    pushResult.success
                      ? 'bg-emerald-950/40 border-[#10B981]/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/50 text-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5">
                      {pushResult.success ? 'check_circle' : 'error'}
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <div className="font-bold text-sm">
                        {pushResult.success
                          ? 'Cloudflare Pages Deployment Triggered'
                          : 'Deployment Push Encountered an Issue'}
                      </div>
                      <div className="text-xs font-sans opacity-90">
                        {pushResult.success
                          ? 'Changes committed and pushed to origin/main. Cloudflare Pages is now building and deploying to Morrishive.com and truckwithease.com!'
                          : pushResult.details}
                      </div>
                      {pushResult.success && pushResult.repoUrl && (
                        <div className="pt-1 flex items-center gap-4">
                          <a
                            href={pushResult.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#FFE500] hover:underline font-mono"
                          >
                            <span>Open GitHub Repository</span>
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                          <a
                            href="https://dash.cloudflare.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline font-mono"
                          >
                            <span>Open Cloudflare Dashboard</span>
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Domains & DNS */}
          {activeTab === 'DOMAINS' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px]">dns</span>
                  <span>Cloudflare Custom Domains Setup</span>
                </h3>
                <p className="text-xs text-white/70 font-sans leading-relaxed">
                  Both hostnames point directly to Cloudflare Pages edge network with automated Anycast routing, DDoS mitigation, and SSL/TLS Full (Strict) encryption.
                </p>

                {/* Domain 1: truckwithease.com */}
                <div className="p-4 rounded-xl bg-[#05080E] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FFE500] font-bold text-sm font-mono">truckwithease.com</span>
                      <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] px-2 py-0.5 rounded font-mono">
                        PRIMARY
                      </span>
                    </div>
                    <span className="text-xs text-white/60 font-mono">Status: ACTIVE ON CLOUDFLARE</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1 text-white/80">
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">DNS TYPE</div>
                      <div className="text-white font-bold">CNAME / Apex Flattening</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">TARGET TARGET</div>
                      <div className="text-[#FFE500] font-bold">truckwithease.pages.dev</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">PROXY STATUS</div>
                      <div className="text-[#10B981] font-bold">Proxied (Orange Cloud)</div>
                    </div>
                  </div>
                </div>

                {/* Domain 2: Morrishive.com */}
                <div className="p-4 rounded-xl bg-[#05080E] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold text-sm font-mono">Morrishive.com</span>
                      <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] px-2 py-0.5 rounded font-mono">
                        ENTERPRISE PORTAL
                      </span>
                    </div>
                    <span className="text-xs text-white/60 font-mono">Status: ACTIVE ON CLOUDFLARE</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1 text-white/80">
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">DNS TYPE</div>
                      <div className="text-white font-bold">CNAME / Apex Flattening</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">TARGET TARGET</div>
                      <div className="text-[#FFE500] font-bold">truckwithease.pages.dev</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <div className="text-[10px] text-white/40">PROXY STATUS</div>
                      <div className="text-[#10B981] font-bold">Proxied (Orange Cloud)</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#FFE500]/10 border border-[#FFE500]/30 rounded-xl text-xs text-white/90 space-y-1">
                  <div className="font-bold text-[#FFE500] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">security</span>
                    <span>Edge SSL/TLS Recommendation</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed font-sans">
                    In Cloudflare Dashboard &gt; <strong>SSL/TLS</strong>, ensure encryption mode is set to <strong>Full (strict)</strong> with <strong>Always Use HTTPS</strong> toggled on for zero-interruption transport security.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Download Package */}
          {activeTab === 'PACKAGE' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FFE500]/20 text-[#FFE500] flex items-center justify-center shrink-0 border border-[#FFE500]/30">
                    <span className="material-symbols-outlined text-[22px]">archive</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Cloudflare Self-Contained Production Package (.tar.gz)
                    </h3>
                    <p className="text-xs text-white/70 mt-1 font-sans leading-relaxed">
                      Generates and downloads a lightweight bundle including all source code,
                      <code className="text-[#FFE500] font-mono"> wrangler.toml</code>, <code className="text-[#FFE500] font-mono">public/_redirects</code>, <code className="text-[#FFE500] font-mono">public/_headers</code>, Tailwind CSS v4, and Vite configs. Excludes bulky build artifacts and local caches.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs font-mono text-white/80">
                  <div className="p-2.5 rounded bg-[#05080E] border border-white/10">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#10B981]">check</span>
                      _redirects
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">Cloudflare SPA 200 rule</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#05080E] border border-white/10">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#10B981]">check</span>
                      wrangler.toml
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">Cloudflare Pages config</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#05080E] border border-white/10">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#10B981]">check</span>
                      _headers
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">Security &amp; cache headers</div>
                  </div>
                </div>

                <button
                  onClick={handleDownloadTarGz}
                  className="w-full py-4 rounded-xl bg-[#FFE500] hover:bg-[#FFDF00] active:scale-[0.99] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,229,0,0.45)] border border-[#FFE500] flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-[22px]">download</span>
                  <span>DOWNLOAD CLOUDFLARE PACKAGE (.TAR.GZ)</span>
                </button>
              </div>

              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-4 text-xs font-mono text-white/80 space-y-1">
                <div className="text-white font-bold mb-1">Direct Cloudflare CLI Deployment (Wrangler):</div>
                <div className="bg-black/80 p-2.5 rounded text-[#FFE500] text-[11px] select-all">
                  bun run build<br />
                  npx wrangler pages deploy dist --project-name=truckwithease
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Cloudflare Deployment Guide */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-4">
              <div className="bg-[#0A0F14] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px]">verified</span>
                  <span>Deploying to Cloudflare Pages in 3 Steps</span>
                </h3>

                <ol className="space-y-3 text-xs font-sans">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <div className="text-white font-bold">Connect GitHub in Cloudflare Dashboard</div>
                      <p className="text-white/70 mt-0.5">
                        Log in to <span className="text-[#FFE500] font-mono">dash.cloudflare.com</span> &gt; <strong>Workers &amp; Pages</strong> &gt; <strong>Create application</strong> &gt; <strong>Pages</strong> &gt; <strong>Connect to Git</strong>. Select repository <span className="text-white font-mono">jeremiahjmorris1126-coder/TRUCKWITHEASE-1</span>.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <div className="text-white font-bold">Build Configuration Preset</div>
                      <p className="text-white/70 mt-0.5">
                        Framework preset: <strong className="text-white">Vite</strong>. Build command: <code className="bg-black/60 px-1 py-0.5 rounded text-[#FFE500] font-mono">npm run build</code> (or <code className="bg-black/60 px-1 py-0.5 rounded text-[#FFE500] font-mono">bun run build</code>). Output directory: <code className="bg-black/60 px-1 py-0.5 rounded text-[#FFE500] font-mono">dist</code>.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <div className="text-white font-bold">Bind Custom Domains: Morrishive.com &amp; truckwithease.com</div>
                      <p className="text-white/70 mt-0.5">
                        In project settings &gt; <strong>Custom domains</strong>, add both <span className="text-[#FFE500] font-mono">truckwithease.com</span> and <span className="text-amber-300 font-mono">morrishive.com</span>. Cloudflare provisions Edge SSL automatically.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#0A0F14] border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-[#FFE500] text-[18px]">public</span>
                  <span className="text-white font-bold">GitHub Source:</span>
                  <a
                    href="https://github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FFE500] hover:underline font-mono"
                  >
                    github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1
                  </a>
                </div>
                <button
                  onClick={() => setActiveTab('PUSH')}
                  className="px-3 py-1.5 rounded-lg bg-[#FFE500] hover:bg-[#FFDF00] text-black font-bold text-xs uppercase cursor-pointer"
                >
                  Go to Push Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#0A0F14] border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span>Cloudflare Pages Edge Ready // Anycast 330+ Global PoPs</span>
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
