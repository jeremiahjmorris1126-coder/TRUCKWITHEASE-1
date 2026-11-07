import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/firebaseClientAuth';

interface Site {
  siteId: string;
  name: string;
  highway: string | null;
  exitId: string | null;
  available: number | null;
  availabilityLow: boolean;
  trend: string | null;
  updatedAt: string | null;
  distanceMi: number | null;
  driveMinutes: number | null;
  reachable: boolean | null;
  minutesToSpare: number | null;
}
interface Clock {
  minutesLeft: number;
  limitedBy: 'drive' | 'shift' | 'break' | 'cycle';
  provider: string;
}
interface Result {
  clock: Clock | null;
  clockUnavailableReason: string | null;
  parkingConfigured: boolean;
  sites: Site[];
  routingNote: string | null;
}

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.max(0, m % 60)).padStart(2, '0')}m`;
const CLOCK_NAME = { drive: 'drive clock', shift: 'shift clock', break: 'break clock', cycle: 'cycle clock' };

/**
 * Clock-Safe Parking: open truck parking the driver can legally reach before
 * their ELD hours run out, with one tap to tell dispatch.
 */
export const ClockSafeParkingPanel: React.FC<{ coords: { lat: number; lon: number } }> = ({ coords }) => {
  const [data, setData] = useState<Result | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    authenticatedFetch(`/api/parking/clock-safe?lat=${coords.lat}&lon=${coords.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !stop && setData(d))
      .catch(() => !stop && setError('Clock-safe parking is unavailable right now.'));
    return () => {
      stop = true;
    };
  }, [coords.lat, coords.lon]);

  const tellDispatch = async (s: Site) => {
    const parts = [
      `Stopping at ${s.name}${s.highway ? ` (${s.highway}${s.exitId ? ` exit ${s.exitId}` : ''})` : ''}.`,
      s.available !== null ? `${s.available} spaces open when I checked.` : '',
      s.driveMinutes !== null ? `About ${hm(s.driveMinutes)} away.` : '',
    ];
    const r = await authenticatedFetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: parts.filter(Boolean).join(' ') }),
    });
    if (r.ok) setSentTo(s.siteId);
    else setError('Could not message dispatch.');
  };

  if (error) return <p className="text-[#FFE500]/70 text-xs px-1">{error}</p>;
  if (!data || !data.parkingConfigured) return null;

  const reachable = data.sites.filter((s) => s.reachable !== false).slice(0, 3);

  return (
    <section className="border-2 border-[#FFE500] rounded-xl p-4 space-y-3 bg-black" aria-label="Clock-safe parking">
      <div>
        <h2 className="text-[#FFE500] font-black uppercase tracking-wider text-sm">Park before your clock runs out</h2>
        {data.clock ? (
          <p className="text-[#FFE500] text-sm mt-1">
            You can drive <strong>{hm(data.clock.minutesLeft)}</strong> more
            <span className="text-[#FFE500]/60"> · {CLOCK_NAME[data.clock.limitedBy]}, from your ELD</span>
          </p>
        ) : (
          <p className="text-[#FFE500]/70 text-xs mt-1">{data.clockUnavailableReason}</p>
        )}
        {data.routingNote && <p className="text-[#FFE500]/60 text-xs mt-1">{data.routingNote}</p>}
      </div>

      {reachable.length === 0 ? (
        <p className="text-[#FFE500] text-sm">
          {data.clock ? 'No open reported parking within reach. Look for a safe place to stop now.' : 'No open reported parking nearby.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {reachable.map((s) => (
            <li key={s.siteId} className="border border-[#FFE500]/30 rounded-lg p-3">
              <div className="flex justify-between gap-2">
                <span className="text-[#FFE500] font-bold text-sm truncate">{s.name}</span>
                <span className="text-[#FFE500] font-black text-sm shrink-0">
                  {s.availabilityLow ? 'LOW' : s.available !== null ? `${s.available} open` : '—'}
                </span>
              </div>
              <p className="text-[#FFE500]/70 text-xs mt-0.5">
                {s.driveMinutes !== null ? `${hm(s.driveMinutes)} drive` : s.distanceMi !== null ? `${s.distanceMi} mi straight-line` : ''}
                {s.minutesToSpare !== null && s.reachable ? ` · ${hm(s.minutesToSpare)} to spare` : ''}
                {s.reachable === null ? ' · reach not verified' : ''}
                {s.trend ? ` · ${s.trend.toLowerCase()}` : ''}
              </p>
              <button
                onClick={() => tellDispatch(s)}
                disabled={sentTo === s.siteId}
                className="mt-2 w-full py-2 rounded-lg bg-[#FFE500] text-black font-black uppercase text-xs tracking-wider disabled:opacity-60 cursor-pointer"
              >
                {sentTo === s.siteId ? 'Dispatch notified' : 'Tell Dispatch I’m Parking Here'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
