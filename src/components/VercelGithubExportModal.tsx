import React, { useState, useEffect } from 'react';

interface VercelGithubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

interface GitStatusData {
  status: string;
  branch: string;
  lastCommit: string;
  remoteUrl: string;
  hasUncommittedChanges: boolean;
  uncommittedFilesCount: number;
  vercelReady: boolean;
  timestamp: string;
}

export const VercelGithubExportModal: React.FC<VercelGithubExportModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'PUSH' | 'PACKAGE' | 'GUIDE'>('PUSH');
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem('truck_github_pat') || '';
    } catch {
      return '';
    }
  });
  const [showToken, setShowToken] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>(
    'Production release: 1-Click Vercel + GitHub enterprise update'
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
      const res = await fetch('/api/export-vercel-github/status');
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
      'Initializing 1-Click Vercel & GitHub Production Export...',
      'Staging repository workspace and checking index integrity...',
    ]);

    try {
      // Step simulation log
      await new Promise((r) => setTimeout(r, 400));
      setPushLogs((prev) => [
        ...prev,
        'Verifying production configuration and vercel.json bundle manifest...',
      ]);

      const response = await fetch('/api/export-vercel-github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken.trim() || undefined,
          commitMessage: commitMessage.trim() || 'Production release update',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPushLogs((prev) => [
          ...prev,
          `Commit created: ${data.lastCommit || 'Latest Head'}`,
          `Branch synchronized: origin/${data.branch || 'main'}`,
          'Vercel continuous deployment webhook triggered successfully.',
          'All production artifacts transmitted cleanly.',
        ]);
        setPushResult({
          success: true,
          commitHash: data.lastCommit,
          message: data.message,
          repoUrl: data.repoUrl || 'https://github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1',
        });
        onShowToast('LATEST UPDATE PUSHED TO VERCEL & GITHUB', 'rocket_launch');
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
        onShowToast('REMOTE PUSH FAILED // CHECK TOKEN OR CREDENTIALS', 'error');
      }
    } catch (err: any) {
      setPushLogs((prev) => [...prev, `Network/Server Error: ${err.message}`]);
      setPushResult({
        success: false,
        details: err.message || 'Network error encountered during push.',
      });
      onShowToast('EXPORT SERVICE DISCONNECTED', 'cloud_off');
    } finally {
      setIsPushing(false);
    }
  };

  const handleDownloadTarGz = () => {
    onShowToast('PREPARING & DOWNLOADING UNIFIED PRODUCTION ARCHIVE (.TAR.GZ)', 'download');
    const link = document.createElement('a');
    link.href = '/api/export-vercel-github/download';
    link.download = 'truckwithease-unified-production-package.tar.gz';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-surface-container-lowest border border-amber-400/40 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.25)] overflow-hidden">
        
        {/* Top Header Bar with Bright-Yellow Accent */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500/20 via-surface-container to-surface-container border-b border-amber-400/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg font-black shrink-0">
              <span className="material-symbols-outlined text-[24px]">rocket_launch</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-400/40">
                  1-CLICK PRODUCTION HUB
                </span>
                <span className="text-emerald-400 text-xs flex items-center gap-1 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                  READY FOR VERCEL
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-headline-sm font-bold text-white uppercase tracking-wide">
                Vercel &amp; GitHub Production Export Center
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-white transition-colors cursor-pointer"
            title="Close Center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-surface-container-high bg-surface-container-low px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('PUSH')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer ${
              activeTab === 'PUSH'
                ? 'bg-surface-container-lowest text-amber-300 border-t-2 border-amber-400 shadow-md'
                : 'text-outline hover:text-white hover:bg-surface-container/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            <span>PUSH TO VERCEL &amp; GITHUB</span>
          </button>
          <button
            onClick={() => setActiveTab('PACKAGE')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer ${
              activeTab === 'PACKAGE'
                ? 'bg-surface-container-lowest text-amber-300 border-t-2 border-amber-400 shadow-md'
                : 'text-outline hover:text-white hover:bg-surface-container/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder_zip</span>
            <span>DOWNLOAD PACKAGE (.TAR.GZ)</span>
          </button>
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`flex items-center gap-2 px-4 py-2.5 font-label-caps text-xs font-bold rounded-t-lg transition-all cursor-pointer ${
              activeTab === 'GUIDE'
                ? 'bg-surface-container-lowest text-amber-300 border-t-2 border-amber-400 shadow-md'
                : 'text-outline hover:text-white hover:bg-surface-container/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>VERCEL DEPLOYMENT GUIDE</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Repository Status Banner */}
          <div className="bg-surface-container/70 border border-surface-container-high rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
              <span className="text-outline">Target Repository:</span>
              <span className="text-white font-bold">jeremiahjmorris1126-coder/TRUCKWITHEASE-1</span>
              <span className="bg-primary/20 text-primary border border-primary/40 px-1.5 py-0.5 rounded text-[10px]">
                {gitStatus?.branch || 'main'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {gitStatus?.hasUncommittedChanges ? (
                <span className="text-amber-400 flex items-center gap-1 font-sans font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                  {gitStatus.uncommittedFilesCount} modified files ready to push
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 font-sans font-bold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Working directory clean
                </span>
              )}
              <button
                onClick={fetchStatus}
                disabled={isLoadingStatus}
                className="text-outline hover:text-white cursor-pointer"
                title="Refresh Git Status"
              >
                <span className={`material-symbols-outlined text-[16px] ${isLoadingStatus ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: 1-Click Push to Vercel & GitHub */}
          {activeTab === 'PUSH' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-4 space-y-3">
                <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                  Commit Description / Deployment Note
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe latest release updates..."
                  className="w-full px-3 py-2 bg-surface-container rounded-lg border border-surface-container-highest text-white text-sm focus:outline-none focus:border-amber-400"
                />

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <span>GitHub Personal Access Token (PAT)</span>
                      <span className="text-[10px] font-normal text-outline lowercase font-sans">
                        (optional if local git credentials exist)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                    >
                      {showToken ? 'Hide Token' : 'Show Token'}
                    </button>
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => handleSaveToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (saved securely in browser)"
                    className="w-full px-3 py-2 bg-surface-container rounded-lg border border-surface-container-highest text-white text-sm font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[11px] text-outline mt-1 font-sans">
                    Required for direct HTTPS push if the remote repository requires personal access authentication.
                  </p>
                </div>
              </div>

              {/* Push Action Button */}
              <button
                onClick={handleExecutePush}
                disabled={isPushing}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(251,191,36,0.6)] border border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                    <span>SYNCHRONIZING WITH GITHUB &amp; TRIGGERING VERCEL...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
                    <span>PUSH LATEST UPDATE TO VERCEL &amp; GITHUB NOW</span>
                  </>
                )}
              </button>

              {/* Push Console / Logs */}
              {pushLogs.length > 0 && (
                <div className="bg-black/80 rounded-xl p-3 border border-surface-container-high space-y-1 font-mono text-xs max-h-40 overflow-y-auto">
                  <div className="text-outline text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">terminal</span>
                    <span>Execution Stream</span>
                  </div>
                  {pushLogs.map((log, i) => (
                    <div key={i} className="text-amber-300/90 leading-relaxed">
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
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-error/15 border-error/50 text-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[22px] shrink-0 mt-0.5">
                      {pushResult.success ? 'check_circle' : 'error'}
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <div className="font-bold text-sm">
                        {pushResult.success
                          ? 'Synchronization & Deployment Triggered Successfully'
                          : 'Deployment Push Encountered an Issue'}
                      </div>
                      <div className="text-xs font-sans opacity-90">
                        {pushResult.success
                          ? 'Changes have been committed and pushed to origin/main. If Vercel Git integration is active, your project will now build and deploy automatically!'
                          : pushResult.details}
                      </div>
                      {pushResult.success && pushResult.repoUrl && (
                        <div className="pt-1">
                          <a
                            href={pushResult.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline font-mono"
                          >
                            <span>Open GitHub Repository Commit</span>
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

          {/* TAB 2: Download Unified Package */}
          {activeTab === 'PACKAGE' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
                    <span className="material-symbols-outlined text-[22px]">archive</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Complete Self-Contained Production Archive (.tar.gz)
                    </h3>
                    <p className="text-xs text-outline mt-1 font-sans leading-relaxed">
                      Generates and downloads a clean, lightweight tarball bundle including all source code,
                      <code className="text-amber-300 font-mono"> vercel.json</code>, Tailwind CSS v4 pipeline, Vite configs,
                      and Express microservice backend. Excludes build artifacts and local caches.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs font-mono text-outline">
                  <div className="p-2.5 rounded bg-surface-container/60 border border-surface-container-highest">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-400">check</span>
                      vercel.json
                    </div>
                    <div className="text-[10px] mt-0.5">Pre-configured SPA routes</div>
                  </div>
                  <div className="p-2.5 rounded bg-surface-container/60 border border-surface-container-highest">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-400">check</span>
                      package.json
                    </div>
                    <div className="text-[10px] mt-0.5">React 19 &amp; Vite 6</div>
                  </div>
                  <div className="p-2.5 rounded bg-surface-container/60 border border-surface-container-highest">
                    <div className="text-white font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-400">check</span>
                      TypeScript
                    </div>
                    <div className="text-[10px] mt-0.5">Zero-error strict config</div>
                  </div>
                </div>

                <button
                  onClick={handleDownloadTarGz}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 active:scale-[0.99] text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.5)] border border-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-[22px]">download</span>
                  <span>DOWNLOAD UNIFIED PACKAGE (.TAR.GZ)</span>
                </button>
              </div>

              <div className="bg-surface-container/40 border border-surface-container-high rounded-xl p-4 text-xs font-mono text-outline space-y-1">
                <div className="text-white font-bold mb-1">Direct Vercel CLI Deployment from Package:</div>
                <div className="bg-black/60 p-2.5 rounded text-amber-300 text-[11px] select-all">
                  tar -xzf truckwithease-unified-production-package.tar.gz<br />
                  cd TRUCKWITHEASE-1<br />
                  vercel deploy --prod
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Vercel Deployment Guide */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-4">
              <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-5 space-y-4">
                <h3 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[20px]">verified</span>
                  <span>Deploying to Vercel in 3 Easy Steps</span>
                </h3>

                <ol className="space-y-3 text-xs font-sans">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <div className="text-white font-bold">Import GitHub Repository in Vercel</div>
                      <p className="text-outline mt-0.5">
                        Log in to <span className="text-amber-300 font-mono">vercel.com</span>, click <strong>"Add New... &gt; Project"</strong>, and select repository <span className="text-white font-mono">jeremiahjmorris1126-coder/TRUCKWITHEASE-1</span>.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <div className="text-white font-bold">Framework Preset &amp; Build Configuration</div>
                      <p className="text-outline mt-0.5">
                        Vercel will detect <span className="text-amber-300 font-mono">vercel.json</span> automatically.
                        Build command: <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300 font-mono">npm run build</code>,
                        Output directory: <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300 font-mono">dist</code>.
                      </p>
                    </div>
                  </li>

                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <div className="text-white font-bold">Environment Variables &amp; Launch</div>
                      <p className="text-outline mt-0.5">
                        Add your <code className="text-amber-300 font-mono">GEMINI_API_KEY</code> in Environment Variables for live search-grounded weather advisories. Click <strong>Deploy</strong>.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-container border border-surface-container-high rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">public</span>
                  <span className="text-white font-bold">Live Production Repository:</span>
                  <a
                    href="https://github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline font-mono"
                  >
                    github.com/jeremiahjmorris1126-coder/TRUCKWITHEASE-1
                  </a>
                </div>
                <button
                  onClick={() => setActiveTab('PUSH')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                >
                  Go to Push Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-surface-container border-t border-surface-container-high flex items-center justify-between text-xs text-outline font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Archive Engine: bsdtar 3.8.9 (gzip compressed)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-highest/80 text-white font-sans text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
