import React from 'react';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO, HISTORICAL_LOGS, ACTIVE_HASH } from '../data/mockData';

interface InspectionPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinted: () => void;
}

export const InspectionPdfModal: React.FC<InspectionPdfModalProps> = ({
  isOpen,
  onClose,
  onPrinted,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container w-full max-w-2xl rounded-xl border border-surface-container-high shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-surface-container-high flex items-center justify-between border-b border-surface-container-highest">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              picture_as_pdf
            </span>
            <span className="font-headline-sm text-[16px] text-on-surface uppercase font-bold">
              FMCSA 49 CFR § 395.8 Driver's Daily Log (8-Day Package)
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Paper Document Preview (Printable Area) */}
        <div className="p-6 overflow-y-auto bg-[#181920] text-on-surface font-body-sm space-y-4">
          <div id="dvir-print-area" className="printable-report border border-outline/30 rounded p-4 bg-surface-container-lowest space-y-3">
            <div className="flex justify-between items-start border-b border-outline/20 pb-3">
              <div>
                <h3 className="font-headline-sm text-primary font-bold">
                  {CARRIER_INFO.name}
                </h3>
                <p className="text-[11px] text-outline">
                  USDOT #{CARRIER_INFO.usdot} | MC #{CARRIER_INFO.mc}
                </p>
                <p className="text-[11px] text-outline">
                  Terminal: {CARRIER_INFO.terminal}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold">
                  FMCSA § 396.11 DVIR & § 395.8 LOG REPORT
                </span>
                <p className="text-[10px] text-outline mt-1 font-mono">
                  Daily Export Requirement: MET
                </p>
              </div>
            </div>

            {/* Driver & Equipment Grid */}
            <div className="grid grid-cols-2 gap-3 text-[11px] border-b border-outline/20 pb-3">
              <div>
                <span className="text-outline uppercase text-[10px] block">Driver:</span>
                <span className="font-bold text-on-surface">{DRIVER_INFO.name} ({DRIVER_INFO.cdlNumber})</span>
                <span className="text-outline block">Medical Cert Exp: {DRIVER_INFO.medicalCertExp}</span>
              </div>
              <div>
                <span className="text-outline uppercase text-[10px] block">Tractor & Trailer:</span>
                <span className="font-bold text-on-surface">{EQUIPMENT_INFO.powerUnit}</span>
                <span className="text-outline block">{EQUIPMENT_INFO.trailingUnit} | Gross: {EQUIPMENT_INFO.grossCombinedWeight}</span>
              </div>
            </div>

            {/* Daily Vehicle Inspection Report (DVIR 49 CFR § 396.11) Section */}
            <div className="border border-outline/20 p-2.5 rounded bg-surface-container-low/50 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono text-primary font-bold uppercase">
                <span>FMCSA § 396.11 DAILY VEHICLE INSPECTION CHECKLIST (DVIR)</span>
                <span>STATUS: NO DEFECTS FOUND</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-outline">
                <div>[✓] Air Brakes & Parking Brake</div>
                <div>[✓] Steering Mechanism</div>
                <div>[✓] Lighting Devices & Reflectors</div>
                <div>[✓] Tires, Wheels & Rims</div>
                <div>[✓] Rear Vision Mirrors</div>
                <div>[✓] Windshield Wipers & Fluid</div>
                <div>[✓] Fifth Wheel Coupling Pins</div>
                <div>[✓] Emergency Equipment (Triangles/Extinguisher)</div>
                <div>[✓] Axle Air Suspension</div>
              </div>
              <div className="text-[9px] font-mono text-emerald-400">
                Condition of the above vehicle is Satisfactory. No safety-affecting defects identified.
              </div>
            </div>

            {/* 8-Day Table */}
            <div>
              <span className="font-label-caps text-primary text-[10px] uppercase tracking-wider block mb-2">
                Certified 8-Day Duty Cycle Summary
              </span>
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-outline/30 text-outline">
                    <th className="py-1">Date</th>
                    <th className="py-1">Driving</th>
                    <th className="py-1">On-Duty</th>
                    <th className="py-1">Sleeper</th>
                    <th className="py-1">Off-Duty</th>
                    <th className="py-1">Miles</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10 text-on-surface-variant">
                  {HISTORICAL_LOGS.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container/40">
                      <td className="py-1 font-bold text-on-surface">{log.shortDate}</td>
                      <td className="py-1 text-primary">{log.driveHours}</td>
                      <td className="py-1">{log.onDutyHours}</td>
                      <td className="py-1">{log.sleeperHours}</td>
                      <td className="py-1">{log.offDutyHours}</td>
                      <td className="py-1">{log.milesTraveled}</td>
                      <td className="py-1 text-primary font-bold">PASS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cryptographic Ledger Proof Footer */}
            <div className="pt-2 border-t border-outline/20 text-[10px] space-y-1">
              <div className="flex justify-between items-center text-outline">
                <span>Merkle Record: #4,133</span>
                <span>Algorithm: SHA-256 (FIPS 180-4)</span>
              </div>
              <p className="font-mono text-[9px] text-primary break-all bg-surface-container-low p-1.5 rounded">
                {ACTIVE_HASH}
              </p>
              <div className="flex justify-between items-end pt-1">
                <div>
                  <span className="text-outline block text-[9px]">DRIVER ELECTRONIC SIGNATURE:</span>
                  <span className="font-headline-sm text-primary italic text-[14px]">Jonathan Vance</span>
                </div>
                <div className="text-right text-[9px] text-outline">
                  <span>ATTESTATION TIMESTAMP: 2025-03-13 15:00:00 CST</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-container-high border-t border-surface-container-highest flex items-center justify-end gap-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-label-caps text-[11px] uppercase cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onPrinted();
              window.print();
            }}
            className="px-5 py-2 rounded-lg bg-primary text-on-primary font-label-caps text-[11px] font-bold uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Daily DVIR & Log Report (FMCSA § 396.11)
          </button>
        </div>
      </div>
    </div>
  );
};
