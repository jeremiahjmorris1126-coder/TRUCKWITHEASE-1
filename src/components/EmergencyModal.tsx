import React from 'react';
import { CARRIER_INFO } from '../data/mockData';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerAction: (msg: string) => void;
}

interface EmergencyContact {
  id: string;
  category: 'DISPATCH' | 'ROADSIDE' | 'LEGAL' | '911';
  title: string;
  phone: string;
  description: string;
  icon: string;
  colorClass: string;
  btnClass: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'contact-dispatch',
    category: 'DISPATCH',
    title: 'Fleet Dispatch & Operations',
    phone: CARRIER_INFO.phone || '1-800-TRK-EASE',
    description: '24/7 Dispatch desk, load rerouting & carrier operations',
    icon: 'headset_mic',
    colorClass: 'text-primary bg-primary/10 border-primary/30',
    btnClass: 'bg-primary text-on-primary hover:brightness-110',
  },
  {
    id: 'contact-roadside',
    category: 'ROADSIDE',
    title: '24/7 Heavy Roadside & Towing',
    phone: '1-888-555-TOWS',
    description: 'Heavy wrecker, tire blowout, mobile mechanic & DEF lockouts',
    icon: 'construction',
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    btnClass: 'bg-amber-500 text-slate-950 font-bold hover:brightness-110',
  },
  {
    id: 'contact-legal',
    category: 'LEGAL',
    title: 'CDL Legal Aid & DOT Shield',
    phone: '1-800-555-3220',
    description: 'Roadside inspection defense, ticket assistance & FMCSA legal advice',
    icon: 'gavel',
    colorClass: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
    btnClass: 'bg-purple-500 text-on-primary hover:brightness-110',
  },
  {
    id: 'contact-911',
    category: '911',
    title: 'State Highway Patrol / 911',
    phone: '911',
    description: 'Severe collisions, life-safety emergencies & Highway Patrol dispatch',
    icon: 'local_police',
    colorClass: 'text-error bg-error/10 border-error/40',
    btnClass: 'bg-error text-on-error hover:brightness-110',
  },
];

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  onTriggerAction,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface-container w-full max-w-lg rounded-2xl border border-error-container/60 shadow-2xl p-space-md space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-error/20 border border-error/40 text-error flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-[26px]">
                e911_emergency
              </span>
            </div>
            <div>
              <h3 className="font-headline-sm text-error font-bold uppercase tracking-wider text-[18px]">
                Emergency Contacts Console
              </h3>
              <span className="font-telemetry-label text-[10px] text-outline block">
                24/7 Quick-Dial Support Lines &amp; GPS Telemetry Hotline
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-container-low border border-surface-container-high flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* GPS Location Telemetry Badge */}
        <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-between font-mono text-[10px]">
          <div className="flex items-center gap-2 text-outline">
            <span className="material-symbols-outlined text-primary text-[16px] animate-pulse">my_location</span>
            <span>I-20 EB &bull; Mile Marker 492.4 &bull; GPS: 32.7767, -96.7970</span>
          </div>
          <span className="text-emerald-400 font-bold">10Hz CAN-BUS ACTIVE</span>
        </div>

        {/* Quick-Dial Emergency Contacts List */}
        <div className="space-y-2.5">
          <div className="px-1 text-[10px] font-mono font-bold text-outline uppercase tracking-wider flex items-center justify-between">
            <span>QUICK-DIAL SUPPORT DIRECTORY</span>
            <span className="text-primary font-bold">1-TAP CONNECT</span>
          </div>

          {EMERGENCY_CONTACTS.map((contact) => (
            <div
              key={contact.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${contact.colorClass}`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-surface-container-lowest/80 border border-white/10 shrink-0">
                  <span className="material-symbols-outlined text-[22px]">
                    {contact.icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface text-[14px]">
                      {contact.title}
                    </span>
                    <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-surface-container-lowest/90 border border-white/10">
                      {contact.category}
                    </span>
                  </div>
                  <span className="font-telemetry-metric text-[12px] text-primary font-bold block mt-0.5">
                    {contact.phone}
                  </span>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {contact.description}
                  </p>
                </div>
              </div>

              <a
                href={`tel:${contact.phone.replace(/[^0-9]/g, '')}`}
                onClick={() => {
                  onTriggerAction(`DIALING ${contact.title.toUpperCase()} (${contact.phone})...`);
                }}
                className={`px-3.5 py-2 rounded-xl font-label-caps text-[11px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-md ${contact.btnClass}`}
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                <span>DIAL NOW</span>
              </a>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high border border-surface-container-high text-outline hover:text-on-surface font-label-caps text-[11px] uppercase tracking-wider rounded-xl cursor-pointer transition-all"
        >
          Dismiss Console
        </button>
      </div>
    </div>
  );
};
