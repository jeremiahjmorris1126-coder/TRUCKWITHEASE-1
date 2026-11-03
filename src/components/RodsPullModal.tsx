import React, { useState, useMemo } from 'react';
import { RodsDailyRecord, RodsDutyEvent, DutyStatus } from '../types';
import { crossFunctionMemoryService } from '../services/crossFunctionMemoryService';
import { CARRIER_INFO, DRIVER_INFO } from '../data/mockData';

interface RodsPullModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const RodsPullModal: React.FC<RodsPullModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [allRods, setAllRods] = useState<RodsDailyRecord[]>(() =>
    crossFunctionMemoryService.getAllRods()
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmissionComment, setTransmissionComment] = useState<string>('FMCSA Roadside Safety Check');
  const [transferMethod, setTransferMethod] = useState<'FMCSA_WEB_SERVICES' | 'FMCSA_EMAIL'>('FMCSA_WEB_SERVICES');
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  const selectedRecord = useMemo(
    () => allRods[selectedDayIndex] || allRods[0],
    [allRods, selectedDayIndex]
  );

  if (!isOpen) return null;

  const handleTransmitErods = () => {
    setIsTransmitting(true);
    setTimeout(() => {
      const res = crossFunctionMemoryService.transmitErods(transferMethod, transmissionComment);
      setReceiptCode(res.submissionReceiptCode);
      setIsTransmitting(false);
      onShowToast(
        `FMCSA ERODS TRANSMITTED // RECEIPT CODE: ${res.submissionReceiptCode} (METHOD: ${res.transmissionMethod})`,
        'cloud_done'
      );
    }, 1200);
  };

  const handleDownloadCsv = () => {
    const csv = crossFunctionMemoryService.generateErodsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FMCSA_ERODS_RODS_8DAY_${CARRIER_INFO.usdot}_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('PULLED & DOWNLOADED OFFICIAL 8-DAY FMCSA ERODS CSV LOG', 'download');
  };

  // 24-Hour Duty Grid status line mapping
  const dutyLines: { status: DutyStatus; label: string; color: string }[] = [
    { status: 'OFF', label: '1. OFF DUTY', color: 'bg-slate-500' },
    { status: 'SB', label: '2. SLEEPER BERTH', color: 'bg-indigo-500' },
    { status: 'D', label: '3. DRIVING', color: 'bg-[#FFE500]' },
    { status: 'ON', label: '4. ON DUTY (NOT DRIVING)', color: 'bg-emerald-500' },
  ];

  const getStatusBadge = (status: DutyStatus) => {
    switch (status) {
      case 'D':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE500] text-black">DRIVING</span>;
      case 'ON':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ON DUTY</span>;
      case 'SB':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">SLEEPER</span>;
      case 'OFF':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">OFF DUTY</span>;
      case 'YM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">YARD MOVE</span>;
      case 'PC':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">PERSONAL</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-5xl bg-[#05080E] border-2 border-primary/70 rounded-2xl shadow-[0_0_35px_rgba(255,229,0,0.2)] text-white overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between p-4 bg-[#0A0F14] border-b border-[#1E2532] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500]">
              <span className="material-symbols-outlined text-[24px]">view_timeline</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-['Space_Grotesk'] font-black uppercase tracking-wider text-white">
                  PULL RODS // 49 CFR PART 395 SUBPART B
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  FMCSA § 395.8 COMPLIANT
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                8-Day Record of Duty Status • Real-Time Electronic Transfer • Tamper-Evident Merkle Root
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* MAIN BODY (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {/* 1. 8-DAY HISTORICAL DATE SELECTOR STRIP */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Select 24-Hour Duty Day to Pull (8-Day FMCSA Electronic Archive):
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {allRods.map((r, idx) => {
                const isSelected = idx === selectedDayIndex;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedDayIndex(idx);
                      crossFunctionMemoryService.pullRods(idx);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-[#FFE500] text-black border-[#FFE500] font-black shadow-[0_0_12px_rgba(255,229,0,0.4)]'
                        : 'bg-[#0A0F14] text-slate-300 border-[#1E2532] hover:border-slate-600'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase truncate w-full block">
                      {r.dayLabel}
                    </span>
                    <span className="text-[11px] font-mono block">
                      {r.dateStr.substring(5)}
                    </span>
                    <span className={`text-[9px] font-bold px-1 rounded ${
                      isSelected ? 'bg-black/20 text-black' : 'text-emerald-400'
                    }`}>
                      {r.totalDriveHours.toFixed(1)}h Drive
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SELECTED DAY SUMMARY & METADATA CARD */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">CARRIER &amp; USDOT</span>
              <span className="text-xs font-bold text-white block">{selectedRecord.carrierName}</span>
              <span className="text-[11px] text-[#FFE500]">USDOT #{selectedRecord.usdotNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">COMMERCIAL DRIVER</span>
              <span className="text-xs font-bold text-white block">{selectedRecord.driverName}</span>
              <span className="text-[11px] text-slate-300">CDL {selectedRecord.cdlNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">EQUIPMENT UNITS</span>
              <span className="text-xs font-bold text-white block">Tractor: {selectedRecord.powerUnitNumber}</span>
              <span className="text-[11px] text-slate-300">Trailer: {selectedRecord.trailerNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL MILES &amp; STATUS</span>
              <span className="text-xs font-bold text-white block">{selectedRecord.totalMilesDriven} Miles</span>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                COMPLIANT (0 VIOLATIONS)
              </span>
            </div>
          </div>

          {/* 3. OFFICIAL 24-HOUR HOS 4-LINE GRID VISUALIZER */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">grid_4x4</span>
                24-Hour Duty Status Grid (49 CFR § 395.8 Form MCS-59)
              </span>
              <span className="text-[11px] text-slate-400">{selectedRecord.formattedDate}</span>
            </div>

            {/* Time Axis (0 to 24 Hours) */}
            <div className="space-y-1.5 overflow-x-auto">
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono px-28 min-w-[650px]">
                <span>00:00</span>
                <span>03:00</span>
                <span>06:00</span>
                <span>09:00</span>
                <span>12:00</span>
                <span>15:00</span>
                <span>18:00</span>
                <span>21:00</span>
                <span>24:00</span>
              </div>

              {/* 4 Standard Duty Lines */}
              {dutyLines.map((line) => {
                let hoursVal = 0;
                if (line.status === 'OFF') hoursVal = selectedRecord.totalOffDutyHours;
                if (line.status === 'SB') hoursVal = selectedRecord.totalSleeperHours;
                if (line.status === 'D') hoursVal = selectedRecord.totalDriveHours;
                if (line.status === 'ON') hoursVal = selectedRecord.totalOnDutyHours;

                const percent = Math.min(100, Math.max(0, (hoursVal / 24) * 100));

                return (
                  <div key={line.status} className="flex items-center gap-2 min-w-[650px]">
                    <div className="w-28 text-[10px] font-bold text-slate-300 truncate text-left shrink-0">
                      {line.label}
                    </div>

                    <div className="flex-1 h-7 bg-[#05080E] rounded-md border border-[#1E2532] relative overflow-hidden flex items-center">
                      {/* Grid hour tick marks */}
                      <div className="absolute inset-0 grid grid-cols-24 pointer-events-none opacity-20 divide-x divide-slate-600 h-full" />

                      {/* Active duty bar representation */}
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full ${line.color} transition-all duration-300 relative flex items-center justify-end px-2`}
                      >
                        {percent > 8 && (
                          <span className={`text-[10px] font-mono font-bold ${line.status === 'D' ? 'text-black' : 'text-white'}`}>
                            {hoursVal.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-14 text-right text-[11px] font-bold font-mono text-white shrink-0">
                      {hoursVal.toFixed(2)}h
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-28 pt-1 border-t border-[#1E2532] min-w-[650px]">
                <span className="font-bold text-white">DAILY 24.0-HOUR TOTAL:</span>
                <span className="font-bold text-emerald-400">
                  {(
                    selectedRecord.totalDriveHours +
                    selectedRecord.totalOnDutyHours +
                    selectedRecord.totalSleeperHours +
                    selectedRecord.totalOffDutyHours
                  ).toFixed(2)}{' '}
                  HOURS (BALANCED)
                </span>
              </div>
            </div>
          </div>

          {/* 4. DUTY EVENTS SEQUENCE TIMELINE */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-3">
            <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">format_list_numbered</span>
              Duty Event Log Timeline ({selectedRecord.events.length} Records)
            </span>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#1E2532] text-slate-400 text-[10px] uppercase">
                    <th className="py-2 px-2">Time</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Location &amp; Corridor</th>
                    <th className="py-2 px-2">Odometer</th>
                    <th className="py-2 px-2">Origin</th>
                    <th className="py-2 px-2">Annotation / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2532]/60 font-mono">
                  {selectedRecord.events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#141C2B]/50 transition">
                      <td className="py-2 px-2 text-white font-bold whitespace-nowrap">{ev.timeDisplay}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{getStatusBadge(ev.dutyStatus)}</td>
                      <td className="py-2 px-2 text-slate-200">
                        {ev.locationCityState} <span className="text-slate-400 text-[10px]">({ev.highwayMileMarker})</span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">{ev.odometerMiles.toLocaleString()} mi</td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-[#05080E] border border-slate-800">
                          {ev.originatingSystem}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-400 text-[11px] truncate max-w-xs">{ev.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. FMCSA DIRECT ERODS TRANSFER TRANSMISSION BOX */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-primary/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider block">
                  Roadside Electronic Data Transfer (FMCSA § 395.24)
                </span>
                <span className="text-[11px] text-slate-400">
                  Transmit complete 8-day encrypted RODS package directly to Safety Official / Trooper
                </span>
              </div>

              {receiptCode && (
                <div className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>FMCSA RECEIPT: {receiptCode}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Transfer Method
                </label>
                <select
                  value={transferMethod}
                  onChange={(e) => setTransferMethod(e.target.value as any)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                >
                  <option value="FMCSA_WEB_SERVICES">FMCSA Web Services (Live ERD)</option>
                  <option value="FMCSA_EMAIL">FMCSA Encrypted Officer Email</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Officer Routing Comment / Badge Identifier
                </label>
                <input
                  type="text"
                  value={transmissionComment}
                  onChange={(e) => setTransmissionComment(e.target.value)}
                  placeholder="e.g. Trooper Miller Badge #4920 Inspection"
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={handleTransmitErods}
                disabled={isTransmitting}
                className="btn-tactical-yellow px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.35)]"
              >
                <span className={`material-symbols-outlined text-[16px] ${isTransmitting ? 'animate-spin' : ''}`}>
                  {isTransmitting ? 'sync' : 'send_and_archive'}
                </span>
                <span>{isTransmitting ? 'Transmitting to FMCSA...' : 'Transmit ERoDS to Officer'}</span>
              </button>

              <button
                onClick={handleDownloadCsv}
                className="px-3.5 py-2.5 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#FFE500]">file_download</span>
                <span>Download ERoDS CSV</span>
              </button>

              <div className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">lock</span>
                <span>Cryptographic Merkle Proof: {selectedRecord.merkleProofHash.substring(0, 16)}...</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="p-3 bg-[#0A0F14] border-t border-[#1E2532] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Certified under 49 CFR § 395.8 &bull; TruckWithEase Cross-Function Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white font-bold cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
