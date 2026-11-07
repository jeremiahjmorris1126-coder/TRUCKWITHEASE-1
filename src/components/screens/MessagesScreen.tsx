import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../services/firebaseClientAuth';

interface Message {
  id: string;
  senderRole: 'driver' | 'dispatch';
  text: string;
  createdAt: string;
  sms?: { status: 'SENT' | 'FAILED'; error?: string } | null;
}
interface Thread {
  driverId: string;
  driverName: string;
  lastText: string;
  lastAt: string;
  lastSenderRole: 'driver' | 'dispatch';
}
interface FleetDriver {
  driverId: string;
  name: string;
  phone: string | null;
}

const POLL_MS = 4000;

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
};

async function getJson(url: string) {
  const r = await authenticatedFetch(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

/** One conversation. `driverId` is omitted when the signed-in user is the driver. */
const Conversation: React.FC<{
  driverId?: string;
  title: string;
  callNumber: string | null;
  callLabel: string;
  canSms: boolean;
  smsLabel: string;
  isDispatch: boolean;
  onBack?: () => void;
}> = ({ driverId, title, callNumber, callLabel, canSms, smsLabel, isDispatch, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [alsoSms, setAlsoSms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastAt = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const q = driverId ? `driverId=${encodeURIComponent(driverId)}` : '';

  const merge = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastAt.current = next[next.length - 1]?.createdAt || lastAt.current;
      return next;
    });
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    lastAt.current = null;
    setMessages([]);
    const tick = async () => {
      try {
        const since = lastAt.current ? `&since=${encodeURIComponent(lastAt.current)}` : '';
        const d = await getJson(`/api/messages?${q}${since}`);
        if (!stop) {
          merge(d.messages || []);
          setError(null);
        }
      } catch (e: any) {
        if (!stop) setError(e.message || 'Could not load messages.');
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [q, merge]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const r = await authenticatedFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, text: text.trim(), alsoSms }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Message not sent.');
      merge([d.message]);
      setText('');
      setError(d.message?.sms?.status === 'FAILED' ? `Sent in app. Text not sent: ${d.message.sms.error}` : null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const mine = (m: Message) => (isDispatch ? m.senderRole === 'dispatch' : m.senderRole === 'driver');

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] max-w-2xl mx-auto w-full px-4">
      <div className="flex items-center justify-between gap-2 py-3 border-b border-[#FFE500]/20">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="text-[#FFE500] cursor-pointer">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <span className="text-[#FFE500] font-bold truncate">{title}</span>
        </div>
        {callNumber && (
          <a href={`tel:${callNumber}`} className="shrink-0 px-3 py-1.5 rounded-lg border border-[#FFE500] text-[#FFE500] text-xs font-bold uppercase flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">call</span>
            {callLabel}
          </a>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {messages.length === 0 && !error && <p className="text-center text-[#FFE500]/50 text-sm pt-8">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${mine(m) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine(m) ? 'bg-[#FFE500] text-black' : 'border border-[#FFE500]/40 text-[#FFE500]'}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <p className={`text-[10px] mt-0.5 ${mine(m) ? 'text-black/60' : 'text-[#FFE500]/50'}`}>
                {timeLabel(m.createdAt)}
                {m.sms?.status === 'SENT' ? ' · also texted' : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error && <p className="text-[#FFE500] text-xs border border-[#FFE500]/60 rounded-lg p-2 mb-2" role="alert">{error}</p>}

      <form onSubmit={send} className="pb-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Message"
            aria-label="Message"
            className="flex-1 bg-black border border-[#FFE500]/40 text-[#FFE500] placeholder-[#FFE500]/40 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-[#FFE500]"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="px-4 rounded-lg bg-[#FFE500] text-black disabled:opacity-40 cursor-pointer">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        {canSms && (
          <label className="flex items-center gap-2 text-xs text-[#FFE500]/70 cursor-pointer">
            <input type="checkbox" checked={alsoSms} onChange={(e) => setAlsoSms(e.target.checked)} className="accent-[#FFE500]" />
            {smsLabel}
          </label>
        )}
      </form>
    </div>
  );
};

export const MessagesScreen: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);
  const [telephony, setTelephony] = useState<{ smsConfigured: boolean; dispatchNumber: string | null } | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [open, setOpen] = useState<FleetDriver | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson('/api/auth/tenant')
      .then((d) => setRole(String(d?.tenant?.role || d?.role || '').toLowerCase()))
      .catch(() => setError('Sign in to use messaging.'));
    getJson('/api/telephony/status')
      .then((d) => setTelephony(d.telephony || null))
      .catch(() => setTelephony(null));
  }, []);

  const isDispatch = role === 'fleet_admin' || role === 'owner';

  useEffect(() => {
    if (!isDispatch || open) return;
    let stop = false;
    const load = () =>
      Promise.all([getJson('/api/messages/threads'), getJson('/api/messages/drivers')])
        .then(([t, d]) => {
          if (stop) return;
          setThreads(t.threads || []);
          setDrivers(d.drivers || []);
          setError(null);
        })
        .catch((e) => !stop && setError(e.message));
    load();
    const id = setInterval(load, POLL_MS * 2);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [isDispatch, open]);

  if (error && !role) return <p className="text-center text-[#FFE500] text-sm py-10 px-4">{error}</p>;
  if (!role) return <p className="text-center text-[#FFE500]/60 text-sm py-10">Loading…</p>;

  if (!isDispatch) {
    return (
      <Conversation
        title="Dispatch"
        callNumber={telephony?.dispatchNumber || null}
        callLabel="Call"
        canSms={Boolean(telephony?.smsConfigured && telephony?.dispatchNumber)}
        smsLabel="Also text dispatch"
        isDispatch={false}
      />
    );
  }

  if (open) {
    return (
      <Conversation
        driverId={open.driverId}
        title={open.name}
        callNumber={open.phone}
        callLabel="Call"
        canSms={Boolean(telephony?.smsConfigured && open.phone)}
        smsLabel="Also text driver's phone"
        isDispatch
        onBack={() => setOpen(null)}
      />
    );
  }

  const lastBy = new Map(threads.map((t) => [t.driverId, t]));
  const ordered = [...drivers].sort((a, b) => (lastBy.get(b.driverId)?.lastAt || '').localeCompare(lastBy.get(a.driverId)?.lastAt || '') || a.name.localeCompare(b.name));

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-3 space-y-2">
      <h1 className="text-[#FFE500] text-lg font-black uppercase tracking-wider pb-1">Drivers</h1>
      {error && <p className="text-[#FFE500] text-xs border border-[#FFE500]/60 rounded-lg p-2">{error}</p>}
      {ordered.length === 0 && !error && <p className="text-[#FFE500]/60 text-sm">No drivers in your fleet yet.</p>}
      {ordered.map((d) => {
        const t = lastBy.get(d.driverId);
        return (
          <button
            key={d.driverId}
            onClick={() => setOpen(d)}
            className="w-full text-left border border-[#FFE500]/25 hover:border-[#FFE500] rounded-lg px-3.5 py-3 cursor-pointer"
          >
            <span className="flex justify-between gap-2">
              <span className="text-[#FFE500] font-bold truncate">{d.name}</span>
              {t && <span className="text-[#FFE500]/50 text-[11px] shrink-0">{timeLabel(t.lastAt)}</span>}
            </span>
            <span className="block text-[#FFE500]/60 text-xs truncate mt-0.5">
              {t ? `${t.lastSenderRole === 'dispatch' ? 'You: ' : ''}${t.lastText}` : 'No messages yet'}
            </span>
          </button>
        );
      })}
    </div>
  );
};
