import React, { useState } from 'react';

interface MasterMechanicScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  speed?: number;
}

interface DiagnosticFaultCode {
  id: string;
  spn: number;
  fmi: number;
  system: string;
  description: string;
  severity: 'CRITICAL' | 'ADVISORY' | 'NOMINAL';
  remediation: string;
  cleared: boolean;
}

const INITIAL_FAULT_CODES: DiagnosticFaultCode[] = [
  {
    id: 'dtc-3251',
    spn: 3251,
    fmi: 0,
    system: 'AFTERTREATMENT / DPF',
    description: 'Particulate Trap Differential Pressure Above Normal (DPF Restriction 84%)',
    severity: 'ADVISORY',
    remediation: 'Stationary parked regen or highway thermal burn recommended within 90 miles.',
    cleared: false,
  },
  {
    id: 'dtc-110',
    spn: 110,
    fmi: 3,
    system: 'COOLING / THERMAL',
    description: 'Engine Coolant Temp Sensor Circuit High Voltage (Micro-Spike 212°F Peak)',
    severity: 'ADVISORY',
    remediation: 'Inspect sensor wiring harness connector J2-44 at next scheduled rest stop.',
    cleared: false,
  },
];

const REPAIR_FACILITIES = [
  {
    id: 'rep-1',
    name: 'Petro:Lube Heavy Duty SpeedCare',
    exit: 'Exit 498 • I-20',
    mileMarker: 498.4,
    milesAway: 6.0,
    services: ['24/7 Mobile Service', 'Cummins / Detroit Certified', 'DOT Tire Bank', 'DEF Dosing'],
    phone: '(817) 555-0194',
    rating: 4.9,
    baysOpen: 3,
  },
  {
    id: 'rep-2',
    name: 'Rush Truck Centers & Mobile Fleet Tech',
    exit: 'Exit 514 • I-20',
    mileMarker: 514.2,
    milesAway: 21.8,
    services: ['Complete Overhaul', 'J1939 OEM Calibration', 'Brake Reline', 'Wrecker Service'],
    phone: '(817) 555-0822',
    rating: 4.8,
    baysOpen: 1,
  },
  {
    id: 'rep-3',
    name: 'Love\'s Truck Tire Care & Light Mechanical',
    exit: 'Exit 506 • I-20',
    mileMarker: 506.6,
    milesAway: 14.2,
    services: ['Wheel Seals', 'Air Leaks', 'Battery Replacement', 'Alternator Swap'],
    phone: '(817) 555-0311',
    rating: 4.7,
    baysOpen: 4,
  },
];

export const MasterMechanicScreen: React.FC<MasterMechanicScreenProps> = ({
  onShowToast,
  speed = 65,
}) => {
  const [activeTab, setActiveTab] = useState<'DIAGNOSTICS' | 'COMPONENTS' | 'REPAIR_DISPATCH'>('DIAGNOSTICS');
  const [faultCodes, setFaultCodes] = useState<DiagnosticFaultCode[]>(INITIAL_FAULT_CODES);
  const [trailerAngle, setTrailerAngle] = useState<number>(14);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [dvirSigned, setDvirSigned] = useState<boolean>(false);

  const handleClearCodes = () => {
    setIsScanning(true);
    setTimeout(() => {
      setFaultCodes((prev) => prev.map((f) => ({ ...f, cleared: true })));
      setIsScanning(false);
      onShowToast('J1939 ECU CODES HEALED & CLEARED // ZERO ACTIVE FAULTS LOGGED', 'verified');
    }, 900);
  };

  const handleScanNow = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onShowToast('J1939 ECM SCAN COMPLETE // ALL 12 CAN-BUS CONTROLLERS RESPONDING', 'check_circle');
    }, 1200);
  };

  const handleDispatchMechanic = (facilityName: string) => {
    onShowToast(`MOBILE MECHANIC DISPATCHED // ${facilityName.toUpperCase()} EN ROUTE (ETA 22 MIN)`, 'car_repair');
  };

  const isJackknifeDanger = Math.abs(trailerAngle) > 48;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-2 sm:px-4 pb-20 space-y-4 font-mono select-none">
      {/* 1. TOP HERO HEADER (Signature Black & Yellow Aesthetic) */}
      <div className="text-center pt-2 pb-1">
        <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#FFE500]">build_circle</span>
          <span>THE MASTER MECHANIC</span>
        </h1>
        <p className="text-sm sm:text-base font-medium text-emerald-300/90 tracking-wide mt-1">
          Predictive Vehicle Diagnostics • J1939 ECU Scanner • Mechanical Health HUD • 49 CFR § 396
        </p>
      </div>

      {/* 2. SUB-TAB SEGMENTED BAR */}
      <div className="flex items-center justify-center gap-2 p-1 bg-[#0A0F14] rounded-xl border border-[#1E2532] shadow-xl max-w-xl mx-auto w-full">
        <button
          onClick={() => setActiveTab('DIAGNOSTICS')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'DIAGNOSTICS'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">terminal</span>
          <span>J1939 ECU Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('COMPONENTS')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'COMPONENTS'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">sensors</span>
          <span>Component Health & Hitch</span>
        </button>

        <button
          onClick={() => setActiveTab('REPAIR_DISPATCH')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'REPAIR_DISPATCH'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">car_repair</span>
          <span>Mobile Repair Dispatch</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: J1939 ECU & DTC DIAGNOSTIC SCANNER                            */}
      {/* ==================================================================== */}
      {activeTab === 'DIAGNOSTICS' && (
        <div className="space-y-4">
          {/* Active ECU Status Card */}
          <div className="bg-[#05080E] p-4 sm:p-5 rounded-2xl border border-[#1E2532] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500] shrink-0">
                <span className="material-symbols-outlined text-[28px]">cable</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white uppercase">
                    CAN-Bus J1939 Powertrain Gateway
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    250 KBPS &bull; 10Hz ECM
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Connected Controller: Cummins X15 Performance ECM (VIN: 1FTFW1ED8NFA9104)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button
                onClick={handleScanNow}
                disabled={isScanning}
                className="btn-tactical-yellow py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
              >
                <span className={`material-symbols-outlined text-[16px] ${isScanning ? 'animate-spin' : ''}`}>sync</span>
                <span>{isScanning ? 'Scanning ECU...' : 'Scan J1939 Bus'}</span>
              </button>

              <button
                onClick={handleClearCodes}
                className="px-3.5 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 flex-1 sm:flex-initial cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                <span>Heal DTCs</span>
              </button>
            </div>
          </div>

          {/* ACTIVE SPN / FMI FAULT CODES LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#FFE500] tracking-wider uppercase">
                Active Diagnostic Trouble Codes (DTCs)
              </span>
              <span className="text-[11px] text-slate-400">
                {faultCodes.filter((f) => !f.cleared).length} Codes Detected
              </span>
            </div>

            {faultCodes.filter((f) => !f.cleared).length === 0 ? (
              <div className="bg-[#0A0F14] p-8 rounded-2xl border border-emerald-500/40 text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-emerald-400">verified</span>
                <h4 className="font-['Space_Grotesk'] text-lg font-bold text-white uppercase">
                  All J1939 Powertrain Systems Clean
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Zero active fault codes. Engine, transmission, aftertreatment, and ABS modules operating within strict OEM tolerances.
                </p>
              </div>
            ) : (
              faultCodes
                .filter((f) => !f.cleared)
                .map((code) => (
                  <div
                    key={code.id}
                    className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-2 hover:border-[#2C384E] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#FFE500]/15 text-[#FFE500] border border-[#FFE500]/30 font-bold text-xs">
                          SPN {code.spn} // FMI {code.fmi}
                        </span>
                        <span className="text-xs text-slate-400 font-bold uppercase">
                          {code.system}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {code.severity}
                      </span>
                    </div>

                    <h4 className="font-['Space_Grotesk'] text-sm sm:text-base font-bold text-white">
                      {code.description}
                    </h4>

                    <div className="p-2.5 rounded-lg bg-[#05080E] border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#FFE500] shrink-0">build</span>
                      <span>Remediation: {code.remediation}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: COMPONENT HEALTH RADAR & KINGPIN HITCH ARTICULATION           */}
      {/* ==================================================================== */}
      {activeTab === 'COMPONENTS' && (
        <div className="space-y-4">
          {/* Component Metrics Radar Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Engine Oil */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Engine Oil Temp &amp; Press</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#FFE500]">195&deg;F</span>
                <span className="text-xs text-slate-400">/ 42 PSI</span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-bold">&#10004; Nominal (Viscosity 15W-40)</span>
            </div>

            {/* Coolant */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Coolant Temperature</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-400">188&deg;F</span>
                <span className="text-xs text-slate-400">Cap: 215&deg;F</span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-bold">&#10004; Thermostat Open</span>
            </div>

            {/* Turbo Boost */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Turbo Boost &amp; VGT</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#FFE500]">32.4 PSI</span>
                <span className="text-xs text-slate-400">VGT 68%</span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-bold">&#10004; Spool Curve Optimal</span>
            </div>

            {/* Brake Lining */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Brake Friction Lining</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-400">88%</span>
                <span className="text-xs text-slate-400">Linings Good</span>
              </div>
              <span className="text-[10px] text-slate-400 block">&gt; 1/4&quot; Pad Depth FMCSA</span>
            </div>

            {/* Transmission */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Eaton 12-Spd Automated</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">180&deg;F</span>
                <span className="text-xs text-[#FFE500]">Gear 11</span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-bold">&#10004; Clutch Lock Nominal</span>
            </div>

            {/* Alternator */}
            <div className="bg-[#0A0F14] p-3.5 rounded-xl border border-[#1E2532] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Electrical Charging</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-400">14.2 V</span>
                <span className="text-xs text-slate-400">160A Alternator</span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-bold">&#10004; 4 AGM Batteries High</span>
            </div>
          </div>

          {/* Virtual Kingpin Hitch & Articulation Sentinel */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500]">alt_route</span>
                <span className="text-xs text-[#FFE500] uppercase tracking-wider font-bold">
                  Virtual Kingpin Hitch Articulation Angle Sentinel
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isJackknifeDanger
                    ? 'bg-red-950 text-red-400 border border-red-500 animate-pulse'
                    : 'bg-[#1E2532] text-[#FFE500]'
                }`}
              >
                {isJackknifeDanger ? 'DANGER: JACKKNIFE THRESHOLD' : 'SAFE ARTICULATION'}
              </span>
            </div>

            {/* Trailer Articulation Visualization */}
            <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="w-full flex justify-between text-xs text-slate-400 mb-2">
                <span>53&apos; Utility Reefer (#TR-8812)</span>
                <span className="text-[#FFE500] font-bold">Hitch Angle: {trailerAngle}&deg;</span>
              </div>

              <div className="relative w-72 h-44 flex items-center justify-center">
                <div className="absolute inset-0 border border-dashed border-slate-800 rounded-lg" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800" />

                {/* Tractor Cab */}
                <div className="absolute bottom-4 w-12 h-16 bg-[#162030] border-2 border-[#FFE500] rounded-sm flex flex-col items-center justify-between p-1 z-10 shadow-lg">
                  <span className="text-[7px] text-[#FFE500] font-bold">CAB</span>
                  <div className="w-8 h-1 bg-[#FFE500] rounded" />
                  <span className="text-[6px] text-slate-400">K-PIN</span>
                </div>

                {/* Trailer (Rotated) */}
                <div
                  className="absolute bottom-16 w-14 h-24 bg-[#1E2A3D] border-2 border-[#FFE500]/60 rounded-sm flex flex-col items-center justify-between p-1 transition-transform duration-100 shadow-xl"
                  style={{
                    transformOrigin: '50% 100%',
                    transform: `rotate(${trailerAngle}deg)`,
                  }}
                >
                  <div className="w-10 h-1 bg-[#FFE500] rounded" />
                  <span className="text-[8px] text-[#FFE500] font-bold">53&apos; REAR</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-1 bg-red-500 rounded" />
                    <span className="w-2 h-1 bg-red-500 rounded" />
                  </div>
                </div>

                <div className="absolute top-2 text-[9px] text-slate-400 px-2 py-0.5 rounded bg-black/60">
                  Blindside Swing Radius: 12.4 Ft Clearance
                </div>
              </div>

              {/* Angle Slider Control */}
              <div className="w-full max-w-sm mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-60&deg; Driver-Side</span>
                  <span className="text-[#FFE500] font-bold">0&deg; Straight</span>
                  <span>+60&deg; Blindside</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={trailerAngle}
                  onChange={(e) => setTrailerAngle(parseInt(e.target.value))}
                  className="w-full accent-[#FFE500] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MOBILE REPAIR DISPATCH & CORRIDOR SHOPS                      */}
      {/* ==================================================================== */}
      {activeTab === 'REPAIR_DISPATCH' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#FFE500] tracking-wider uppercase">
              Certified Heavy Duty Repair &amp; Mobile Service Units Along Corridor
            </span>
            <span className="text-[11px] text-slate-400">3 Verified Facilities</span>
          </div>

          <div className="space-y-3">
            {REPAIR_FACILITIES.map((facility) => (
              <div
                key={facility.id}
                className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#2C384E] transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-['Space_Grotesk'] text-base font-bold text-white">
                      {facility.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      {facility.baysOpen} Bays Open
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5">
                    {facility.exit} &bull; Mile {facility.mileMarker} &bull; <strong className="text-[#FFE500]">{facility.milesAway} miles ahead</strong>
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {facility.services.map((svc, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#05080E] border border-slate-800 text-[10px] text-slate-300">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${facility.phone}`}
                    className="px-3 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">phone</span>
                    <span>Call Shop</span>
                  </a>

                  <button
                    onClick={() => handleDispatchMechanic(facility.name)}
                    className="btn-tactical-yellow py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">car_repair</span>
                    <span>Dispatch Service</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 49 CFR § 396.11 Certified Electronic DVIR Sign-off */}
          <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-white text-sm block">
                DOT 49 CFR § 396.11 Certified Mechanical Safety DVIR Sign-off
              </span>
              <span className="text-xs text-slate-400">
                Attest mechanical air brake, steering, coupling, and tire integrity.
              </span>
            </div>

            <button
              onClick={() => {
                setDvirSigned(true);
                onShowToast('MECHANIC SAFETY DVIR ATTESTED & CRYPTOGRAPHICALLY LOGGED', 'verified');
              }}
              className={`py-2 px-4 rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                dvirSigned
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'btn-tactical-yellow'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {dvirSigned ? 'verified' : 'draw'}
              </span>
              <span>{dvirSigned ? 'DVIR ATTESTED (SAFE)' : 'Sign Mechanical DVIR'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
