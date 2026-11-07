import React, { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../services/firebaseClientAuth';
import { ClockSafeParkingPanel } from '../ClockSafeParkingPanel';

interface ParkingSite {
  siteId: string;
  state: string;
  name: string;
  highway: string | null;
  direction: string | null;
  exitId: string | null;
  capacity: number | null;
  available: number | null;
  availabilityLow: boolean;
  trend: string | null;
  open: boolean | null;
  trustData: boolean | null;
  updatedAt: string | null;
  stale: boolean;
  distanceMi: number | null;
}

interface FeedStatus {
  state: string;
  ok: boolean;
  error: string | null;
}

type LoadState = 'loading' | 'ready' | 'error';

function minutesAgo(iso: string | null): string {
  if (!iso) return 'time unknown';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'time unknown';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function availabilityBadge(s: ParkingSite): { text: string; cls: string } {
  if (s.open === false) return { text: 'CLOSED', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50' };
  if (s.trustData === false) return { text: 'COUNT UNAVAILABLE', cls: 'bg-surface-container-high text-on-surface-variant border-surface-container-highest' };
  if (s.availabilityLow) return { text: 'LOW', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/50' };
  if (s.available === null) return { text: 'NO COUNT', cls: 'bg-surface-container-high text-on-surface-variant border-surface-container-highest' };
  const cls =
    s.available === 0
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
      : s.available <= 5
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
  return { text: `${s.available}${s.capacity !== null ? ` / ${s.capacity}` : ''} OPEN`, cls };
}

export const TruckParkingScreen: React.FC = () => {
  const [state, setState] = useState<LoadState>('loading');
  const [configured, setConfigured] = useState<boolean>(true);
  const [sites, setSites] = useState<ParkingSite[]>([]);
  const [feeds, setFeeds] = useState<FeedStatus[]>([]);
  const [usingLocation, setUsingLocation] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const load = useCallback(async (coords?: { lat: number; lon: number }) => {
    setState('loading');
    try {
      const qs = coords ? `?lat=${coords.lat}&lon=${coords.lon}&limit=50` : '?limit=50';
      const res = await authenticatedFetch(`/api/parking/sites${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setSites(Array.isArray(data.sites) ? data.sites : []);
      setFeeds(Array.isArray(data.feeds) ? data.feeds : []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  const loadWithLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUsingLocation(true);
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        load({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setUsingLocation(false);
        load();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    );
  }, [load]);

  useEffect(() => {
    loadWithLocation();
  }, [loadWithLocation]);

  const failedFeeds = feeds.filter((f) => !f.ok && f.error);

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto px-gutter-mobile pb-space-2xl space-y-4">
      <div className="bg-black p-5 rounded-xl border border-surface-container-high/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/50 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[28px]">local_parking</span>
          </div>
          <div>
            <h1 className="text-primary uppercase tracking-wider font-black text-[16px]">Truck Parking</h1>
            <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
              Live counts from state DOT parking systems{usingLocation ? ' • nearest first' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={loadWithLocation}
          disabled={state === 'loading'}
          className="shrink-0 px-3 py-2 rounded-lg border border-primary/50 text-primary font-mono text-[11px] font-bold uppercase hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] align-middle">refresh</span>
        </button>
      </div>

      {coords && <ClockSafeParkingPanel coords={coords} />}

      {state === 'loading' && (
        <p className="text-center font-mono text-[12px] text-on-surface-variant py-8">Loading parking availability…</p>
      )}

      {state === 'error' && (
        <div className="bg-rose-950/40 border border-rose-500/60 rounded-xl p-4 text-[12px] text-rose-100">
          Couldn&apos;t load parking data. Check your connection and try again.
        </div>
      )}

      {state === 'ready' && !configured && (
        <div className="bg-black border border-surface-container-highest rounded-xl p-5 text-[12px] text-on-surface-variant leading-relaxed">
          Real-time truck parking isn&apos;t connected yet. When it is, open-space counts appear here for rest areas
          in states that publish them.
        </div>
      )}

      {state === 'ready' && configured && failedFeeds.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-3 text-[11px] text-amber-100">
          Not updating right now: {failedFeeds.map((f) => f.state).join(', ')}. Sites from those states are missing.
        </div>
      )}

      {state === 'ready' && configured && sites.length === 0 && failedFeeds.length === 0 && (
        <p className="text-center font-mono text-[12px] text-on-surface-variant py-6">No parking sites reported.</p>
      )}

      <div className="space-y-2">
        {sites.map((s) => {
          const badge = availabilityBadge(s);
          return (
            <div key={s.siteId} className="bg-black p-4 rounded-xl border border-surface-container-highest flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[13px] font-bold text-on-surface truncate">{s.name}</span>
                <span className="block text-[11px] font-mono text-on-surface-variant">
                  {[s.highway, s.direction, s.exitId ? `Exit ${s.exitId}` : null, s.state].filter(Boolean).join(' • ')}
                </span>
                <span className="block text-[10px] font-mono text-on-surface-variant mt-1">
                  {s.distanceMi !== null ? `${s.distanceMi} mi away • ` : ''}
                  Updated {minutesAgo(s.updatedAt)}
                  {s.trend ? ` • ${s.trend.toLowerCase()}` : ''}
                </span>
                {s.stale && (
                  <span className="block text-[10px] font-mono text-amber-300 mt-0.5">Reading may be out of date</span>
                )}
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded border font-mono text-[11px] font-bold ${badge.cls}`}>{badge.text}</span>
            </div>
          );
        })}
      </div>

      {configured && (
        <p className="text-[10px] font-mono text-on-surface-variant text-center">
          Counts come from roadside sensors and can be wrong. Spaces are not reserved. Coverage is limited to
          participating states.
        </p>
      )}
    </div>
  );
};
