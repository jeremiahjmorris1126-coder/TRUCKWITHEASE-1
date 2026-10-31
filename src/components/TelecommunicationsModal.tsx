/**
 * TruckWithEase // Telecommunications In-Cab Voice Calling & Toll Console
 *
 * Provides real-time call management, Twilio carrier status tracking,
 * and server toll accounting ("paying the server").
 * Adheres to TruckWithEase Directives: Deep Obsidian surface (#05080E),
 * Safety Yellow actions (#FFE500), and Emerald status verification.
 */

import React, { useEffect, useState } from 'react';
import { telecomService, ActiveCallSession, TelecomLedgerSummary } from '../services/telecomService.ts';

interface TelecommunicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, icon?: string, variant?: any) => void;
}

export const TelecommunicationsModal: React.FC<TelecommunicationsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [activeSession, setActiveSession] = useState<ActiveCallSession | null>(() => telecomService.getActiveSession());
  const [summary, setSummary] = useState<TelecomLedgerSummary | null>(null);
  const [speechDirective, setSpeechDirective] = useState<string>('');

  useEffect(() => {
    return telecomService.subscribeActiveCall((session) => {
      setActiveSession(session);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      telecomService.fetchLedgerSummary().then(setSummary);
    }
  }, [isOpen]);

  if (!isOpen && !activeSession) return null;

  const formatHMS = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleHangup = async () => {
    const finished = await telecomService.hangupCall();
    if (finished) {
      onShowToast(
        `CALL COMPLETED (${finished.durationSeconds}s) // TOLL: $${finished.costUsd.toFixed(2)} LOGGED ON SERVER`,
        'call_end',
        'success'
      );
    }
    telecomService.fetchLedgerSummary().then(setSummary);
  };

  const statusColor =
    activeSession?.status === 'CONNECTED'
      ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/50'
      : activeSession?.status === 'RINGING'
      ? 'text-cyan-400 border-cyan-500/50 bg-cyan-950/50 animate-pulse'
      : activeSession?.status === 'DIALING'
      ? 'text-amber-400 border-amber-500/50 bg-amber-950/50 animate-pulse'
      : 'text-gray-400 border-gray-700 bg-gray-900/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-[#0A0F14] border-2 border-amber-400/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(255,229,0,0.25)] relative overflow-hidden font-sans text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-2xl">
              phone_in_talk
            </span>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                In-Cab Telecommunications Gateway
              </h2>
              <span className="text-[11px] font-mono text-gray-400">
                TWILIO VOICE &bull; 49 CFR AUDITED CALL LEDGER
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* ACTIVE CALL CARD */}
        {activeSession ? (
          <div className="bg-[#05080E] border-2 border-emerald-500/60 rounded-xl p-5 mb-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">
                  Active Dispatch Recipient
                </span>
                <span className="text-lg font-black text-white">
                  {activeSession.driverName}
                </span>
                <span className="text-xs text-amber-400 font-mono ml-2">
                  [{activeSession.truckUnit}]
                </span>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${statusColor}`}>
                {activeSession.status}
              </div>
            </div>

            {/* Phone & Timer Display */}
            <div className="grid grid-cols-2 gap-3 bg-[#0A0F14] border border-gray-800 p-3 rounded-lg">
              <div>
                <span className="text-[10px] text-gray-500 font-mono block">E.164 LINE</span>
                <span className="text-sm font-mono text-gray-200 font-bold">{activeSession.to}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 font-mono block">CALL DURATION</span>
                <span className="text-lg font-mono text-amber-400 font-black">
                  {formatHMS(activeSession.durationSeconds)}
                </span>
              </div>
            </div>

            {/* Carrier Toll Accounting ("Paying the Server") */}
            <div className="bg-[#121820] border border-amber-500/30 rounded p-3 text-xs font-mono">
              <div className="flex justify-between items-center mb-1 text-gray-400">
                <span>CARRIER VOICE RATE</span>
                <span className="text-gray-200">$0.014 / MINUTE</span>
              </div>
              <div className="flex justify-between items-center mb-1 text-gray-400">
                <span>SERVER TOLL CHARGED</span>
                <span className="text-emerald-400 font-bold">${activeSession.costUsd.toFixed(4)} USD</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1 border-t border-gray-800">
                <span>TWILIO CALL SID</span>
                <span className="text-gray-400">{activeSession.callSid}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleHangup}
                className="flex-1 bg-[#EF4444] hover:bg-red-600 text-white font-black uppercase tracking-wider py-3 px-4 rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">call_end</span>
                <span>END CALL &amp; COMMIT TO SERVER</span>
              </button>

              <a
                href={`tel:${activeSession.to}`}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase px-3 py-3 rounded-lg border border-gray-700 flex items-center gap-1"
                title="Cellular Handset Fallback"
              >
                <span className="material-symbols-outlined text-sm">phone_iphone</span>
                <span>CELLULAR</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-[#05080E] border border-gray-800 rounded-xl p-5 mb-5 text-center space-y-2">
            <span className="material-symbols-outlined text-gray-600 text-4xl block mb-1">
              phone_paused
            </span>
            <p className="text-sm font-bold text-gray-300 uppercase">
              No Active In-Cab Voice Transmission
            </p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Select any driver in the Live Dispatch Monitor and tap <strong>DIRECT CALL</strong> to initiate an audited two-way voice call through the server.
            </p>
          </div>
        )}

        {/* SERVER TELECOMMUNICATIONS ACCOUNTING SUMMARY ("PAYING THE SERVER") */}
        {summary && (
          <div className="bg-[#05080E] border border-gray-800 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-2">
              <span className="uppercase font-bold text-amber-400">Carrier Telecom Ledger</span>
              <span className="text-[10px] text-emerald-400">SERVER VERIFIED</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0A0F14] p-2.5 rounded border border-gray-800/80">
                <span className="text-[10px] text-gray-500 block">TOTAL CALLS</span>
                <span className="text-sm font-bold text-white">{summary.totalCalls}</span>
              </div>
              <div className="bg-[#0A0F14] p-2.5 rounded border border-gray-800/80">
                <span className="text-[10px] text-gray-500 block">CALL MINUTES</span>
                <span className="text-sm font-bold text-white">{summary.totalCallMinutes}m</span>
              </div>
              <div className="bg-[#0A0F14] p-2.5 rounded border border-gray-800/80">
                <span className="text-[10px] text-gray-500 block">TELECOM COST</span>
                <span className="text-sm font-bold text-emerald-400">
                  ${summary.totalTelecomCostUsd.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-gray-500 flex justify-between pt-1">
              <span>VOICE: $0.014/min &bull; SMS: $0.0079/msg</span>
              <span>AUDIT READY UNDER 49 CFR</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
