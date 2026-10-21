import React, { useState } from 'react';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO, ACTIVE_HASH } from '../data/mockData';

interface HosDailyLogPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloaded?: () => void;
}

export const HosDailyLogPdfModal: React.FC<HosDailyLogPdfModalProps> = ({
  isOpen,
  onClose,
  onDownloaded,
}) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitSuccess, setTransmitSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (onDownloaded) onDownloaded();
    window.print();
  };

  const handleDownloadDirect = () => {
    if (onDownloaded) onDownloaded();
    // Trigger browser print-to-PDF as primary standard method
    window.print();
  };

  const handleTransmitErods = () => {
    setIsTransmitting(true);
    setTimeout(() => {
      setIsTransmitting(false);
      setTransmitSuccess(true);
      setTimeout(() => setTransmitSuccess(false), 5000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-surface-container w-full max-w-4xl rounded-2xl border border-surface-container-high/80 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* Modal Top Control Bar */}
        <div className="p-4 bg-surface-container-high flex items-center justify-between border-b border-surface-container-highest shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]">
              picture_as_pdf
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-[16px] text-on-surface uppercase font-bold tracking-wide">
                  Official FMCSA 49 CFR § 395.8 Driver's Daily Log
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/40 shadow-[0_0_8px_rgba(0,230,118,0.3)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
                  24-Hour Cycle Compliant
                </span>
              </div>
              <p className="font-mono text-[11px] text-on-surface-variant">
                Midnight-to-Midnight Standard • Attested Digital Record of Duty Status (RODS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-headline-sm text-[11px] font-bold uppercase cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-[0_0_12px_rgba(229,169,30,0.3)]"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest cursor-pointer transition-all"
              title="Close Log View"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-[#0a0c10] text-on-surface font-body-sm space-y-4">
          {transmitSuccess && (
            <div className="p-3 rounded-lg bg-[#00e676]/15 border border-[#00e676]/50 text-[#00e676] font-mono text-[11px] flex items-center justify-between no-print animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>FMCSA eRODS Submission Accepted // Confirmation Code: <strong>RODS-TX-2025-948291</strong></span>
              </div>
              <span className="text-[10px] opacity-80">Encrypted TLS 1.3 • SHA-256 Validated</span>
            </div>
          )}

          {/* Printable Report Canvas */}
          <div
            id="dvir-print-area"
            className="printable-report border border-surface-container-highest/60 rounded-xl p-5 bg-[#050709] space-y-4 text-on-surface shadow-inner"
          >
            {/* Header: Carrier & Inspection Meta */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-surface-container-highest/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-md text-primary font-bold text-[18px] uppercase tracking-wide">
                    {CARRIER_INFO.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] font-bold">
                    ELD CERTIFIED #49-395
                  </span>
                </div>
                <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
                  USDOT #{CARRIER_INFO.usdot} • MC #{CARRIER_INFO.mc} • Main Terminal: {CARRIER_INFO.terminal}
                </p>
                <p className="font-mono text-[11px] text-on-surface-variant">
                  24/7 Safety Dispatch: {CARRIER_INFO.phone} • Safety Director: {CARRIER_INFO.safetyOfficer}
                </p>
              </div>

              <div className="sm:text-right font-mono text-[11px] space-y-0.5">
                <div className="text-primary font-bold text-[13px] uppercase">
                  Driver's Daily Log (24-Hour Cycle)
                </div>
                <div className="text-on-surface">
                  Date: <strong>Thursday, March 13, 2025</strong>
                </div>
                <div className="text-on-surface-variant text-[10px]">
                  Cycle Period: 00:00:00 - 23:59:59 Central Standard Time (CST)
                </div>
                <div className="text-[#00e676] text-[10px] font-bold">
                  ? 24H STATUS BALANCE: 24.00 HOURS MET
                </div>
              </div>
            </div>

            {/* Driver & Equipment Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px] border-b border-surface-container-highest/60 pb-4">
              <div className="space-y-1 bg-surface-container/40 p-2.5 rounded border border-surface-container-highest/40">
                <span className="text-primary uppercase text-[10px] font-bold block">1. Driver Identification</span>
                <div>Name: <strong className="text-on-surface">{DRIVER_INFO.name}</strong></div>
                <div>CDL: <strong className="text-on-surface">{DRIVER_INFO.cdlNumber}</strong> (IL Class A)</div>
                <div>Medical Cert Exp: <span className="text-on-surface-variant">{DRIVER_INFO.medicalCertExp}</span></div>
                <div>Co-Driver: <span className="text-on-surface-variant">{DRIVER_INFO.coDriver}</span></div>
              </div>

              <div className="space-y-1 bg-surface-container/40 p-2.5 rounded border border-surface-container-highest/40">
                <span className="text-primary uppercase text-[10px] font-bold block">2. Commercial Motor Vehicle</span>
                <div>Power Unit: <strong className="text-on-surface">{EQUIPMENT_INFO.powerUnit}</strong></div>
                <div>VIN: <span className="text-on-surface-variant">{EQUIPMENT_INFO.vin}</span></div>
                <div>Trailing Unit: <strong className="text-on-surface">{EQUIPMENT_INFO.trailingUnit}</strong></div>
                <div>Trailer Height: <span className="text-on-surface-variant">{EQUIPMENT_INFO.trailerHeight}</span></div>
              </div>

              <div className="space-y-1 bg-surface-container/40 p-2.5 rounded border border-surface-container-highest/40">
                <span className="text-primary uppercase text-[10px] font-bold block">3. Mileage & Shipping Route</span>
                <div>Start Odometer: <span className="text-on-surface">142,890 mi</span></div>
                <div>End Odometer: <span className="text-on-surface">143,132 mi</span></div>
                <div>Miles Driven Today: <strong className="text-primary">242.0 mi</strong></div>
                <div>Shipping Manifest: <span className="text-on-surface-variant">{EQUIPMENT_INFO.manifestId}</span></div>
              </div>
            </div>

            {/* Official 24-Hour Duty Status Graph Grid (4 Standard FMCSA Lines) */}
            <div className="space-y-2 border-b border-surface-container-highest/60 pb-4">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-primary text-[11px] uppercase tracking-wider font-bold">
                  24-Hour Record of Duty Status Graph (FMCSA 49 CFR § 395.8)
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant">
                  Midnight-to-Midnight (1hr increments)
                </span>
              </div>

              {/* Graphic Grid Box */}
              <div className="bg-[#080a0e] p-3 rounded-lg border border-surface-container-highest font-mono text-[10px]">
                {/* Hours scale header */}
                <div className="flex items-center text-outline text-[9px] pb-1 border-b border-surface-container-highest/40">
                  <div className="w-20 shrink-0 uppercase font-bold text-on-surface-variant">Duty Status</div>
                  <div className="flex-1 grid grid-cols-24 text-center">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span key={i} className={i % 6 === 0 ? 'text-primary font-bold' : ''}>
                        {i === 0 ? 'M' : i === 12 ? 'N' : i}
                      </span>
                    ))}
                  </div>
                  <div className="w-16 shrink-0 text-right uppercase font-bold text-primary">Total</div>
                </div>

                {/* Row 1: Off Duty */}
                <div className="flex items-center py-2 border-b border-surface-container-highest/30">
                  <div className="w-20 shrink-0 font-bold text-on-surface-variant uppercase text-[10px]">1. OFF</div>
                  <div className="flex-1 h-5 bg-[#050709] rounded relative border border-surface-container-highest/30 overflow-hidden">
                    {/* 00:00 to 02:15 = 2.25h (approx 9.3%) */}
                    <div className="absolute left-0 top-0 bottom-0 bg-slate-500/40 border-r-2 border-slate-400" style={{ width: '9.375%' }} />
                    {/* 21:00 to 24:00 = 3h (12.5%) */}
                    <div className="absolute left-[87.5%] top-0 bottom-0 bg-slate-500/40 border-l-2 border-slate-400" style={{ width: '12.5%' }} />
                  </div>
                  <div className="w-16 shrink-0 text-right font-bold text-on-surface">05h 15m</div>
                </div>

                {/* Row 2: Sleeper Berth */}
                <div className="flex items-center py-2 border-b border-surface-container-highest/30">
                  <div className="w-20 shrink-0 font-bold text-sky-400 uppercase text-[10px]">2. SB</div>
                  <div className="flex-1 h-5 bg-[#050709] rounded relative border border-surface-container-highest/30 overflow-hidden">
                    {/* 02:15 to 09:27 = 7h 12m (30%) */}
                    <div className="absolute left-[9.375%] top-0 bottom-0 bg-sky-500/30 border-l-2 border-r-2 border-sky-400" style={{ width: '30%' }} />
                  </div>
                  <div className="w-16 shrink-0 text-right font-bold text-sky-400">07h 12m</div>
                </div>

                {/* Row 3: Driving */}
                <div className="flex items-center py-2 border-b border-surface-container-highest/30">
                  <div className="w-20 shrink-0 font-bold text-primary uppercase text-[10px]">3. D</div>
                  <div className="flex-1 h-5 bg-[#050709] rounded relative border border-surface-container-highest/30 overflow-hidden">
                    {/* 10:15 to 14:31 = 4h 16m (17.7%) */}
                    <div className="absolute left-[42.7%] top-0 bottom-0 bg-primary/40 border-l-2 border-r-2 border-primary" style={{ width: '17.7%' }} />
                  </div>
                  <div className="w-16 shrink-0 text-right font-bold text-primary">04h 16m</div>
                </div>

                {/* Row 4: On Duty (Not Driving) */}
                <div className="flex items-center py-2">
                  <div className="w-20 shrink-0 font-bold text-amber-400 uppercase text-[10px]">4. ON</div>
                  <div className="flex-1 h-5 bg-[#050709] rounded relative border border-surface-container-highest/30 overflow-hidden">
                    {/* 09:27 to 10:15 = 0h 48m (3.3%) */}
                    <div className="absolute left-[39.375%] top-0 bottom-0 bg-amber-500/30 border-l-2 border-r-2 border-amber-400" style={{ width: '3.33%' }} />
                    {/* 14:31 to 21:00 = 6h 29m (27%) */}
                    <div className="absolute left-[60.4%] top-0 bottom-0 bg-amber-500/30 border-l-2 border-r-2 border-amber-400" style={{ width: '27.1%' }} />
                  </div>
                  <div className="w-16 shrink-0 text-right font-bold text-amber-400">07h 17m</div>
                </div>

                {/* Total Line */}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-surface-container-highest font-bold text-[11px]">
                  <span className="text-on-surface-variant">TOTAL 24-HOUR BALANCE VERIFIED:</span>
                  <span className="text-[#00e676]">24.00 HOURS (100.0%)</span>
                </div>
              </div>
            </div>

            {/* Chronological Duty Status Change Table */}
            <div className="space-y-2 border-b border-surface-container-highest/60 pb-4">
              <span className="font-label-caps text-primary text-[11px] uppercase tracking-wider font-bold block">
                Detailed Duty Status Log & Highway Location Remarks
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-surface-container-highest/60 text-outline">
                      <th className="py-1 px-1.5">Seq</th>
                      <th className="py-1 px-1.5">Time</th>
                      <th className="py-1 px-1.5">Status</th>
                      <th className="py-1 px-1.5">Duration</th>
                      <th className="py-1 px-1.5">Location / Geo-Tag</th>
                      <th className="py-1 px-1.5">Odometer</th>
                      <th className="py-1 px-1.5">Eng. Hrs</th>
                      <th className="py-1 px-1.5">Remarks / Compliance Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-highest/30 text-on-surface-variant">
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-on-surface">#1</td>
                      <td className="py-1 px-1.5 font-bold">00:00 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-bold">OFF</span></td>
                      <td className="py-1 px-1.5">02h 15m</td>
                      <td className="py-1 px-1.5 text-on-surface">Dallas, TX Terminal</td>
                      <td className="py-1 px-1.5">142,890</td>
                      <td className="py-1 px-1.5">4,120.2</td>
                      <td className="py-1 px-1.5 text-outline">Off-duty terminal rest</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-on-surface">#2</td>
                      <td className="py-1 px-1.5 font-bold">02:15 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">SB</span></td>
                      <td className="py-1 px-1.5">07h 12m</td>
                      <td className="py-1 px-1.5 text-on-surface">Dallas, TX Lot 4B</td>
                      <td className="py-1 px-1.5">142,890</td>
                      <td className="py-1 px-1.5">4,120.2</td>
                      <td className="py-1 px-1.5 text-primary">Split Sleeper Period 1 (§ 395.1(g) paused 14h window)</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-on-surface">#3</td>
                      <td className="py-1 px-1.5 font-bold">09:27 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">ON</span></td>
                      <td className="py-1 px-1.5">00h 48m</td>
                      <td className="py-1 px-1.5 text-on-surface">Dallas, TX Bay 12</td>
                      <td className="py-1 px-1.5">142,890</td>
                      <td className="py-1 px-1.5">4,120.8</td>
                      <td className="py-1 px-1.5">Pre-trip DVIR & Cargo securement verified clean</td>
                    </tr>
                    <tr className="bg-primary/5">
                      <td className="py-1 px-1.5 font-bold text-primary">#4</td>
                      <td className="py-1 px-1.5 font-bold text-primary">10:15 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">D</span></td>
                      <td className="py-1 px-1.5 font-bold text-primary">04h 16m</td>
                      <td className="py-1 px-1.5 text-on-surface">Terrell, TX ? Shreveport, LA (I-20 EB)</td>
                      <td className="py-1 px-1.5 font-bold text-on-surface">143,132</td>
                      <td className="py-1 px-1.5">4,125.1</td>
                      <td className="py-1 px-1.5 text-on-surface">Interstate freight transit (242 mi, 0 violations)</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-on-surface">#5</td>
                      <td className="py-1 px-1.5 font-bold">14:31 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">ON</span></td>
                      <td className="py-1 px-1.5">06h 29m</td>
                      <td className="py-1 px-1.5 text-on-surface">Shreveport, LA DC #4</td>
                      <td className="py-1 px-1.5">143,132</td>
                      <td className="py-1 px-1.5">4,131.5</td>
                      <td className="py-1 px-1.5">Dock staging, pallet unload, post-trip DVIR signed</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1.5 font-bold text-on-surface">#6</td>
                      <td className="py-1 px-1.5 font-bold">21:00 CST</td>
                      <td className="py-1 px-1.5"><span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-bold">OFF</span></td>
                      <td className="py-1 px-1.5">03h 00m</td>
                      <td className="py-1 px-1.5 text-on-surface">Shreveport, LA Travel Plaza</td>
                      <td className="py-1 px-1.5">143,132</td>
                      <td className="py-1 px-1.5">4,131.5</td>
                      <td className="py-1 px-1.5 text-outline">Off-duty mandated overnight rest cycle</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compliance Calculations & Recapitulation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px] border-b border-surface-container-highest/60 pb-3">
              <div className="p-2 rounded bg-surface-container/30 border border-surface-container-highest/40">
                <span className="text-outline uppercase text-[9px] block">11-Hour Drive Left</span>
                <span className="text-primary font-bold text-[13px]">06h 44m 12s</span>
                <span className="text-[9px] text-on-surface-variant block">4.27h Used / 11.0h Max</span>
              </div>
              <div className="p-2 rounded bg-surface-container/30 border border-surface-container-highest/40">
                <span className="text-outline uppercase text-[9px] block">14-Hour Shift Left</span>
                <span className="text-primary font-bold text-[13px]">09h 18m 05s</span>
                <span className="text-[9px] text-on-surface-variant block">Split Berth Paused 7.2h</span>
              </div>
              <div className="p-2 rounded bg-surface-container/30 border border-surface-container-highest/40">
                <span className="text-outline uppercase text-[9px] block">70-Hour Cycle Used</span>
                <span className="text-on-surface font-bold text-[13px]">37h 45m</span>
                <span className="text-[9px] text-[#00e676] block">32h 15m Available</span>
              </div>
              <div className="p-2 rounded bg-surface-container/30 border border-surface-container-highest/40">
                <span className="text-outline uppercase text-[9px] block">Midnight Recap Gain</span>
                <span className="text-[#00e676] font-bold text-[13px]">+08h 55m</span>
                <span className="text-[9px] text-on-surface-variant block">Day 8 Roll at 00:00</span>
              </div>
            </div>

            {/* Cryptographic Attestation & Driver Signature */}
            <div className="pt-2 text-[10px] space-y-2">
              <div className="p-2 rounded bg-surface-container-high/40 border border-surface-container-highest text-on-surface-variant text-[10px] leading-relaxed">
                <strong className="text-primary uppercase">Driver Certification Statement (49 CFR § 395.8(a)(2)):</strong>
                <p className="italic mt-0.5">
                  "I hereby certify that my data entries and my record of duty status for this 24-hour period are true and correct, and that all off-duty, sleeper berth, driving, and on-duty hours reflect my actual commercial motor vehicle operations."
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-1">
                <div>
                  <span className="text-outline block text-[9px] uppercase font-mono">Driver Electronic Signature & Attestation:</span>
                  <span className="font-headline-sm text-primary italic text-[16px] tracking-wide font-bold">
                    Jeremiah J. Morris
                  </span>
                  <span className="font-mono text-[9px] text-on-surface-variant block">
                    Certified via Biometric PIN • IL-98104820
                  </span>
                </div>

                <div className="sm:text-right font-mono text-[9px] space-y-0.5">
                  <div className="text-on-surface-variant">Attestation Timestamp: <strong>2025-03-13 15:00:00 CST</strong></div>
                  <div className="text-on-surface-variant">Device Serial: <strong>TWE-AVIONICS-CAN-904B</strong></div>
                  <div className="text-primary break-all max-w-sm">
                    SHA-256: {ACTIVE_HASH}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Footer */}
        <div className="p-4 bg-surface-container-high border-t border-surface-container-highest flex flex-col sm:flex-row items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-[#00e676]" />
            <span>Cryptographic integrity verified // Ready for State Trooper inspection</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleTransmitErods}
              disabled={isTransmitting}
              className="px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container border border-surface-container-highest font-headline-sm text-[11px] uppercase font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">
                {isTransmitting ? 'sync' : 'cell_tower'}
              </span>
              {isTransmitting ? 'Transmitting...' : 'Transmit eRODS'}
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-lg bg-primary text-on-primary font-headline-sm text-[12px] font-bold uppercase shadow-[0_0_16px_rgba(229,169,30,0.35)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print / Save PDF (49 CFR § 395.8)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
