import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface BypassProgram {
  id: 'PREPASS' | 'DRIVEWYZE';
  name: string;
  enrollUrl: string;
  summary: string;
  howToUse: string;
}

// Shown if the server request fails; the server's configured links take priority.
const FALLBACK_PROGRAMS: BypassProgram[] = [
  {
    id: 'PREPASS',
    name: 'PrePass',
    enrollUrl: 'https://prepass.com/',
    summary: 'Bypass at PrePass-equipped weigh stations, ports of entry and inspection sites, using a transponder, the PrePass app, or both.',
    howToUse: 'Your carrier enrolls with PrePass. Bypass decisions come from the PrePass transponder or app.',
  },
  {
    id: 'DRIVEWYZE',
    name: 'Drivewyze PreClear',
    enrollUrl: 'https://drivewyze.com/preclear/',
    summary: 'App-based bypass at participating weigh stations, with no transponder. Also available through many ELD and telematics providers.',
    howToUse: 'Your carrier signs up with Drivewyze. Bypass decisions come from the Drivewyze app or your ELD integration.',
  },
];

export const WeighBypassScreen: React.FC = () => {
  const [programs, setPrograms] = useState<BypassProgram[]>(FALLBACK_PROGRAMS);

  useEffect(() => {
    let mounted = true;
    authenticatedFetch('/api/weigh-bypass/programs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.programs) ? data.programs : null;
        if (mounted && list && list.every((p: any) => typeof p.enrollUrl === 'string' && p.enrollUrl.startsWith('https://'))) {
          setPrograms(list);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto px-gutter-mobile pb-space-2xl space-y-4">
      <div className="bg-black p-5 rounded-xl border border-surface-container-high/60 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/50 flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[28px]">scale</span>
        </div>
        <div>
          <h1 className="text-primary uppercase tracking-wider font-black text-[16px]">Weigh Station Bypass</h1>
          <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">Enroll with a bypass program</p>
        </div>
      </div>

      <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-amber-400 text-[22px] shrink-0">warning</span>
        <p className="text-[12px] text-amber-100 leading-relaxed">
          TruckWithEase does not give bypass signals. Only your enrolled bypass program&apos;s transponder or app
          can clear you past a scale. With no bypass signal, follow the posted signs and pull in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((p) => (
          <div key={p.id} className="bg-black p-5 rounded-xl border border-primary/40 flex flex-col gap-3">
            <span className="text-sm font-black uppercase text-primary tracking-wider">{p.name}</span>
            <p className="text-[12px] text-on-surface leading-relaxed">{p.summary}</p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">{p.howToUse}</p>
            <a
              href={p.enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto btn-primary-tactical inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-black font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(255,229,0,0.4)] hover:brightness-110 active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>Enroll with {p.name}</span>
            </a>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-mono text-on-surface-variant text-center">
        Opens the program&apos;s own site. Eligibility, pricing and coverage are set by each program.
      </p>
    </div>
  );
};
