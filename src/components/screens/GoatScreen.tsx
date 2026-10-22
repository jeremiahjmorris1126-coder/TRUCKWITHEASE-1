import React, { useState } from 'react';
import { PARKING_FACILITIES } from '../../data/mockData';

interface GoatScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
}

interface SyntheticLoad {
  id: string;
  revenuePerDutyHour: string;
  origin: string;
  destination: string;
  corridorDistance: string;
  netQuantumClock: string;
  hosCoherence: string;
  verified: boolean;
  fuelArbitrage?: string;
  cargoTag?: string;
  safetyTags?: string[];
  isDispatched?: boolean;
}

const SYNTHETIC_LOADS: SyntheticLoad[] = [
  {
    id: 'load-dal-atl',
    revenuePerDutyHour: '$232.10/Hr',
    origin: 'Dallas, TX',
    destination: 'Atlanta, GA',
    corridorDistance: '781 mi • Corridor',
    netQuantumClock: '$218.40 / Clock',
    hosCoherence: '0%',
    verified: true,
    fuelArbitrage: 'Save $74.40 at Shreveport Pilot ($3.38/gal)',
  },
  {
    id: 'load-chi-bna',
    revenuePerDutyHour: '$218.40/Hr',
    origin: 'Chicago, IL',
    destination: 'Nashville, TN',
    corridorDistance: '472 mi • 8.2h',
    netQuantumClock: '$232.10 / Clock',
    hosCoherence: 'QP 2%',
    verified: false,
    cargoTag: 'Pharma 34°F • Coyote (QP 2%)',
    safetyTags: ['Zero Sleeper On Road', 'I-65 Corridor Clear'],
  },
  {
    id: 'load-mem-ind',
    revenuePerDutyHour: '$204.80/Hr',
    origin: 'Memphis, TN',
    destination: 'Indianapolis, IN',
    corridorDistance: '485 mi • Corridor',
    netQuantumClock: '$198.50 / Clock',
    hosCoherence: '96%',
    verified: true,
    fuelArbitrage: 'Save $52.10 at Effingham Flying J ($3.41/gal)',
    safetyTags: ['Direct Crossdock D-12', 'Hazmat Endorsement N/A'],
  },
];

export const GoatScreen: React.FC<GoatScreenProps> = ({ onShowToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'QUANTUM_BOARD' | 'BACKING_PROTOCOL'>('QUANTUM_BOARD');
  const [loads, setLoads] = useState<SyntheticLoad[]>(SYNTHETIC_LOADS);
  const [trailerAngle, setTrailerAngle] = useState<number>(14);
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    walkAround: true,
    overhead: true,
    groundPavement: false,
    fourWaysOn: true,
    soundHorn: false,
    windowDown: true,
  });

  const toggleCheck = (key: string) => {
    setChecklist((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      const allDone = Object.values(updated).every(Boolean);
      if (allDone) {
        onShowToast('G.O.A.T. SAFETY AUDIT PASSED: CLEAR TO COMMENCE BACKING', 'verified');
      }
      return updated;
    });
  };

  const isJackknifeRisk = Math.abs(trailerAngle) > 48;

  const handleDispatchLoad = (loadId: string) => {
    setLoads((prev) =>
      prev.map((l) => (l.id === loadId ? { ...l, isDispatched: true } : l))
    );
    const targetLoad = loads.find((l) => l.id === loadId);
    onShowToast(
      `QUANTUM DISPATCH CONFIRMED // ${targetLoad?.revenuePerDutyHour} LOCKED FOR ${targetLoad?.origin} -> ${targetLoad?.destination}`,
      'bolt'
    );
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-2 sm:px-4 pb-20 space-y-4 font-mono select-none">
      {/* 1. TOP HERO TITLE (Exact Match from Image 2) */}
      <div className="text-center pt-2 pb-1">
        <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          DISPATCH ZERO: $/HR YIELD
        </h1>
        <p className="text-sm sm:text-base font-medium text-slate-300 tracking-wide mt-1">
          Loads Ranked by Remaining Legal Hours
        </p>
      </div>

      {/* 2. SUB-TAB SELECTOR (Quantum Board vs Backing Protocol) */}
      <div className="flex items-center justify-center gap-2 p-1 bg-[#0A0F14] rounded-xl border border-[#1E2532] shadow-lg max-w-md mx-auto">
        <button
          onClick={() => setActiveSubTab('QUANTUM_BOARD')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'QUANTUM_BOARD'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          <span>Quantum Load Board</span>
        </button>

        <button
          onClick={() => setActiveSubTab('BACKING_PROTOCOL')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'BACKING_PROTOCOL'
              ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">alt_route</span>
          <span>G.O.A.T. Backing Protocol</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: QUANTUM SYNTHETIC LOAD BOARD (Exact Match from Image 2)      */}
      {/* ==================================================================== */}
      {activeSubTab === 'QUANTUM_BOARD' && (
        <div className="space-y-4 max-w-xl mx-auto w-full">
          {/* Mock Phone Frame Header Bar (from Image 2) */}
          <div className="bg-[#05080E] p-3 rounded-2xl border border-[#1E2532] shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FFE500]/10 border border-[#FFE500]/30 flex items-center justify-center text-[#FFE500]">
                <span className="material-symbols-outlined text-[20px]">local_shipping</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 tracking-widest uppercase block font-bold">
                  TRUCKWITHEASE / THE G.O.A.T.
                </span>
                <span className="font-['Space_Grotesk'] text-sm font-bold text-white">
                  Mobile Quantum Synthetic Load Board
                </span>
              </div>
            </div>

            <div className="w-7 h-7 rounded-full bg-[#FFE500] text-black font-bold flex items-center justify-center text-xs">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>

          {/* SYNTHETIC LOAD CARDS LIST */}
          <div className="space-y-3">
            {loads.map((load) => (
              <div
                key={load.id}
                className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3 relative overflow-hidden transition hover:border-[#2A3547]"
              >
                {/* Top Row: Category Label & Verified Pill Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#F59E0B] tracking-wider uppercase">
                    REVENUE PER LEGAL DUTY HOUR
                  </span>

                  {load.verified && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                      <span>&#10004;</span>
                      <span>VERIFIED</span>
                    </span>
                  )}
                </div>

                {/* Second Row: Big Yellow Rate and Destination */}
                <div className="flex items-baseline flex-wrap gap-2">
                  <span className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-black text-[#FFE500] tracking-tight drop-shadow-[0_0_10px_rgba(255,229,0,0.35)]">
                    {load.revenuePerDutyHour}
                  </span>
                  <span className="text-slate-400 text-lg">&rarr;</span>
                  <span className="font-['Space_Grotesk'] text-lg sm:text-xl font-bold text-white">
                    {load.origin} <span className="text-slate-400 font-normal text-sm sm:text-base">to</span> {load.destination}
                  </span>
                </div>

                {/* Subtext: Mileage and Corridor */}
                <p className="text-[11px] text-slate-400 font-mono -mt-1">
                  {load.corridorDistance}
                </p>

                {/* Secondary Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1E2532] text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block">NET QUANTUM</span>
                    <span className="text-[#FFE500] font-bold text-sm">{load.netQuantumClock}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase block">
                      {load.cargoTag ? 'COLD-CHAIN CARGO' : 'HOS Coherence'}
                    </span>
                    <span className="text-white font-bold text-xs truncate block">
                      {load.cargoTag || load.hosCoherence}
                    </span>
                  </div>
                </div>

                {/* Fuel Arbitrage Callout Banner */}
                {load.fuelArbitrage && (
                  <div className="p-2 rounded-lg bg-[#05080E] border border-[#1E2532] flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="material-symbols-outlined text-[16px] text-amber-400">local_gas_station</span>
                    <span>Fuel Arb: {load.fuelArbitrage}</span>
                  </div>
                )}

                {/* Safety Tags */}
                {load.safetyTags && (
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    {load.safetyTags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#05080E] border border-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        <span className="text-[#FFE500]">&#9733;</span>
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Giant Full-Width Yellow CTA Button (Exact Match from Image 2) */}
                <button
                  onClick={() => handleDispatchLoad(load.id)}
                  disabled={load.isDispatched}
                  className={`w-full py-3.5 px-4 rounded-xl font-['Space_Grotesk'] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    load.isDispatched
                      ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                      : 'btn-tactical-yellow'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>{load.isDispatched ? 'DISPATCHED // ON MASTER SCHEDULE' : 'ONE-CLICK QUANTUM DISPATCH'}</span>
                </button>
              </div>
            ))}
          </div>

          {/* BOTTOM HOS BREACH GUARD WARNING BANNER (Exact Match from Image 2) */}
          <div className="banner-hos-breach p-3.5 sm:p-4 text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-red-400 font-bold">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>HOS Breach Guard: Driver Window 08h 10m remaining</span>
            </div>
            <p className="text-[11px] text-red-200/80 leading-relaxed pl-6">
              Transit demands 12h 15m. Net yield collapsed by Florida Turnpike tolls and empty outbound deadhead.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: G.O.A.T. BACKING GUIDANCE & JACKKNIFE SENTINEL               */}
      {/* ==================================================================== */}
      {activeSubTab === 'BACKING_PROTOCOL' && (
        <div className="space-y-4">
          {/* G.O.A.T. Banner */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFE500]/15 flex items-center justify-center text-[#FFE500]">
                <span className="material-symbols-outlined text-[24px]">alt_route</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#FFE500] uppercase tracking-wider block">
                  The G.O.A.T. Protocol
                </span>
                <span className="font-['Space_Grotesk'] text-white text-[17px] font-bold">
                  Get Out And Look &bull; Backing Guidance
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-[#FFE500]/15 text-[#FFE500] text-[10px] font-bold rounded border border-[#FFE500]/30">
              49 CFR &sect; 392.2 COMPLIANT
            </span>
          </div>

          {/* Trailer Articulation & Jackknife Sentinel */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#FFE500] uppercase tracking-wider font-bold">
                Virtual Kingpin Hitch Articulation Angle
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isJackknifeRisk
                    ? 'bg-red-950 text-red-400 border border-red-500 animate-pulse'
                    : 'bg-[#1E2532] text-[#FFE500]'
                }`}
              >
                {isJackknifeRisk ? 'DANGER: JACKKNIFE THRESHOLD' : 'SAFE ARTICULATION'}
              </span>
            </div>

            {/* Tactical Trailer Graphic */}
            <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="w-full flex justify-between text-xs text-slate-400 mb-2">
                <span>53&apos; Dry Van (#TR-5390)</span>
                <span className="text-[#FFE500] font-bold">Angle: {trailerAngle}&deg;</span>
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

          {/* Mandatory G.O.A.T. Walk-Around Checklist */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500] text-[20px]">
                  checklist
                </span>
                <span className="text-xs text-[#FFE500] uppercase tracking-wider font-bold">
                  G.O.A.T. Pre-Maneuver Inspection Checklist
                </span>
              </div>
              <button
                onClick={() => {
                  setChecklist({
                    walkAround: true,
                    overhead: true,
                    groundPavement: true,
                    fourWaysOn: true,
                    soundHorn: true,
                    windowDown: true,
                  });
                  onShowToast('ALL G.O.A.T. SAFETY ITEMS CONFIRMED', 'verified');
                }}
                className="text-[10px] text-[#FFE500] uppercase hover:underline cursor-pointer font-bold"
              >
                Check All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'walkAround', label: 'Complete 360° Walk-Around (Clear Blindside)' },
                { key: 'overhead', label: 'Check Overhead Clearances & Low Tree Branches' },
                { key: 'groundPavement', label: 'Inspect Pavement for Pallets, Chocks & Debris' },
                { key: 'fourWaysOn', label: 'Hazard 4-Way Flashers Engaged' },
                { key: 'soundHorn', label: 'Sound Air Horn (2 Light Taps Warning)' },
                { key: 'windowDown', label: 'Driver Window Rolled Down for Audio Cues' },
              ].map((item) => {
                const isChecked = checklist[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => toggleCheck(item.key)}
                    className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-[#FFE500]/10 border-[#FFE500]/40 text-white'
                        : 'bg-[#05080E] border-[#1E2532] text-slate-400 hover:bg-[#101622]'
                    }`}
                  >
                    <span className="text-[12px] font-medium leading-snug pr-2">
                      {item.label}
                    </span>
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        isChecked ? 'text-[#FFE500]' : 'text-slate-600'
                      }`}
                    >
                      {isChecked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Safe Truck Parking Availability */}
          <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500] text-[20px]">
                  local_parking
                </span>
                <span className="text-xs text-[#FFE500] uppercase tracking-wider font-bold">
                  Certified Truck Parking Along Corridor
                </span>
              </div>
              <span className="text-[10px] text-slate-400">LIVE TPIMS TELEMETRY</span>
            </div>

            <div className="space-y-2">
              {PARKING_FACILITIES.map((facility) => {
                const isFull = facility.availableSpots === 0;
                const isLow = facility.availableSpots > 0 && facility.availableSpots <= 5;
                return (
                  <div
                    key={facility.id}
                    className="p-3 bg-[#05080E] rounded-lg border border-[#1E2532] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{facility.name}</span>
                        <span className="text-[10px] text-slate-400">({facility.exit})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>Mile {facility.mileMarker} &bull; {facility.milesAway} miles ahead</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`font-bold text-sm block ${
                            isFull
                              ? 'text-red-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-[#FFE500]'
                          }`}
                        >
                          {facility.availableSpots} SPOTS
                        </span>
                        <span className="text-[9px] text-slate-500">of {facility.totalSpots}</span>
                      </div>

                      <button
                        onClick={() =>
                          onShowToast(`NAVIGATING TO ${facility.name.toUpperCase()} (EXIT ${facility.exit})`, 'directions')
                        }
                        className="p-2 rounded bg-[#0A0F14] hover:bg-[#FFE500] hover:text-black text-slate-300 transition cursor-pointer border border-[#1E2532]"
                        title="Route to parking"
                      >
                        <span className="material-symbols-outlined text-[18px]">directions</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
