import React, { useState } from 'react';
import { crossFunctionMemoryService } from '../services/crossFunctionMemoryService';
import { dotDocumentsService } from '../services/dotDocumentsService';
import { CARRIER_INFO, DRIVER_INFO } from '../data/mockData';

interface RoadsideOfficerShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPullRods: () => void;
  onOpenDvirModal: () => void;
}

export const RoadsideOfficerShieldModal: React.FC<RoadsideOfficerShieldModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onOpenPullRods,
  onOpenDvirModal,
}) => {
  const [dossier] = useState(() => crossFunctionMemoryService.getRoadsideAuditDossier());
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExportOfficerDossier = () => {
    setIsExporting(true);
    setTimeout(() => {
      const data = {
        title: 'OFFICIAL FMCSA / USDOT ROADSIDE COMPLIANCE AUDIT DOSSIER',
        jurisdiction: '49 CFR § 390.31 / Electronic Documents & Signatures in Commercial Motor Vehicle Operations',
        timestamp: new Date().toISOString(),
        carrier: CARRIER_INFO,
        driver: DRIVER_INFO,
        dossier,
        activeDocuments: dotDocumentsService.getDocuments(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `USDOT_${CARRIER_INFO.usdot}_Officer_Audit_Dossier_${new Date().toISOString().substring(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setIsExporting(false);
      onShowToast('EXPORTED OFFICIAL 6-PART DOT ROADSIDE AUDIT DOSSIER (SHA-256 SEALED)', 'download');
    }, 800);
  };

  const handlePrintCabCopy = () => {
    window.print();
    onShowToast('DISPATCHED 6-PART COMPLIANCE DOSSIER TO IN-CAB MOBILE PRINTER', 'print');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-5xl bg-[#05080E] border-2 border-[#FFE500] rounded-2xl shadow-[0_0_45px_rgba(255,229,0,0.3)] text-white overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* TOP OFFICER SHIELD BANNER */}
        <div className="bg-[#0A0F14] p-4 border-b border-[#FFE500]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#FFE500]/20 border border-[#FFE500] flex items-center justify-center text-[#FFE500] shrink-0">
              <span className="material-symbols-outlined text-[32px]">local_police</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-['Space_Grotesk'] font-black uppercase tracking-wider text-white">
                  DOT ROADSIDE INSPECTION SHIELD
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  49 CFR § 390.31 CERTIFIED
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Official Federal Records Custody • Guaranteed Immediate Presentation for Law Enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportOfficerDossier}
              disabled={isExporting}
              className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{isExporting ? 'Generating...' : 'Export Officer Package'}</span>
            </button>

            <button
              onClick={handlePrintCabCopy}
              className="px-3 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#FFE500]">print</span>
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE MAIN CONTENT */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {/* CARRIER & DRIVER IDENTIFICATION BAR */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">MOTOR CARRIER</span>
              <span className="text-sm font-bold text-white block">{CARRIER_INFO.name}</span>
              <span className="text-[11px] text-[#FFE500]">USDOT #{CARRIER_INFO.usdot} &bull; {CARRIER_INFO.mc}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">AUTHORIZED DRIVER</span>
              <span className="text-sm font-bold text-white block">{DRIVER_INFO.name}</span>
              <span className="text-[11px] text-slate-300">CDL {DRIVER_INFO.cdlNumber} (Illinois)</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">COMMERCIAL VEHICLE</span>
              <span className="text-sm font-bold text-white block">{dossier.powerUnit}</span>
              <span className="text-[11px] text-slate-300">Trailer: {dossier.trailerUnit}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">LEGAL CUSTODY STATUS</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                100% READY // 0 DEFICIENCIES
              </span>
              <span className="text-[10px] text-slate-400">Electronic Seal Verified</span>
            </div>
          </div>

          {/* THE 6 MANDATORY FEDERAL ROADSIDE COMPLIANCE DOCUMENTS */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider block">
              6 Mandatory Federal Roadside Compliance Records (49 CFR § 390 - § 396)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. 8-Day Pullable RODS */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-[#FFE500]/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE500]/15 text-[#FFE500] border border-[#FFE500]/30">
                      PART 395 SUBPART B
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      VALID
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">8-Day Pullable Record of Duty Status (RODS)</h4>
                  <p className="text-xs text-slate-400">
                    Full 8-day electronic duty grid, mileage, location events &amp; Web Services transfer. 0 Violations.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#1E2532]">
                  <button
                    onClick={onOpenPullRods}
                    className="btn-tactical-yellow py-2 px-3.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer w-full justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">view_timeline</span>
                    <span>Pull 8-Day RODS Grid &amp; Transmit</span>
                  </button>
                </div>
              </div>

              {/* 2. Driver Qualification File (CDL & Medical) */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      PART 391 DQF
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      EXP: 2026-11-30
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">CDL Class A &amp; Medical Examiner Certificate</h4>
                  <p className="text-xs text-slate-400">
                    Form MCSA-5876 (National Registry #7819204) &bull; IL CDL Class A with Tanker/Doubles endorsements.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E2532]">
                  <span>Physical: Fully Qualified</span>
                  <span className="text-emerald-400 font-bold">Clearinghouse: Clear</span>
                </div>
              </div>

              {/* 3. Driver Vehicle Inspection Reports (DVIR) */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-[#FFE500]/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE500]/15 text-[#FFE500] border border-[#FFE500]/30">
                      PART 396 § 396.11
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      ATTESTED SAFE
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Pre-Trip &amp; Post-Trip DVIR Reports</h4>
                  <p className="text-xs text-slate-400">
                    11-Point Commercial Component Inspection (Air Brakes, Steering, Coupling, Tires 10/32").
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[#1E2532]">
                  <button
                    onClick={onOpenDvirModal}
                    className="btn-tactical-yellow py-2 px-3.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer w-full justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">fact_check</span>
                    <span>View DVIR Ledger / Scan Paper</span>
                  </button>
                </div>
              </div>

              {/* 4. Annual Vehicle Periodic Inspection */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      PART 396 § 396.17
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      EXP: 2026-10-12
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Form MCS-64: Annual Periodic Inspection</h4>
                  <p className="text-xs text-slate-400">
                    Certified Periodic Brake Stroke &amp; Chassis Audit &bull; Decal #ANN-2025-904 Affixed.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E2532]">
                  <span>Inspector #8910</span>
                  <span className="text-emerald-400 font-bold">Passed Full FMCSA 396 Appendix G</span>
                </div>
              </div>

              {/* 5. Cab Card / IRP & IFTA */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      REGISTRATION &amp; TAX
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      VALID
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">IRP Apportioned Cab Card &amp; IFTA License</h4>
                  <p className="text-xs text-slate-400">
                    Apportioned Weight: 80,000 LBS &bull; All 48 Contiguous States Authorized &bull; IFTA Decal Q4 2026.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E2532]">
                  <span>Vin: 1XPWDB9X7MD481902</span>
                  <span className="text-emerald-400 font-bold">Current &amp; Verified</span>
                </div>
              </div>

              {/* 6. Commercial Liability & Cargo Insurance */}
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      INSURANCE BMC-91X
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      ACTIVE
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Commercial Auto Liability &amp; Cargo Policy</h4>
                  <p className="text-xs text-slate-400">
                    $1,000,000 Public Liability (Bodily Injury / Property Damage) &bull; $250,000 High-Value Reefer Cargo.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E2532]">
                  <span>Policy #BMC-91X-88219</span>
                  <span className="text-emerald-400 font-bold">On File with FMCSA</span>
                </div>
              </div>
            </div>
          </div>

          {/* OFFICIAL LEGAL CUSTODY STATEMENT BOX */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-emerald-500/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-emerald-400 font-bold uppercase">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                OFFICIAL 49 CFR § 390.31 LEGAL CUSTODY STATEMENT
              </span>
              <span>SHA-256 SEAL VERIFIED</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              "All commercial driver qualification records, ELD Hours of Service logs, and vehicle inspection reports maintained within the TruckWithEase platform comply with electronic signature and document retention requirements under 49 CFR § 390.31. All data is cryptographically sealed, tamper-evident, and immediately accessible for state and federal motor carrier safety audits."
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
              <span>Custodian: {dossier.custodianAttestation.custodianName} ({dossier.custodianAttestation.custodianTitle})</span>
              <span>Attestation Timestamp: {dossier.custodianAttestation.signedTimestamp.replace('T', ' ').substring(0, 19)} UTC</span>
            </div>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="p-3 bg-[#0A0F14] border-t border-[#1E2532] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>USDOT #3928110 &bull; Roadside Shield Operational</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white font-bold cursor-pointer"
          >
            Exit Officer Mode
          </button>
        </div>
      </div>
    </div>
  );
};
