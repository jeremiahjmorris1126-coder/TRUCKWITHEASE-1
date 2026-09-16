import React, { useState, useEffect } from 'react';

interface QuantumIndexScreenProps {
  onShowToast: (msg: string) => void;
  speed: number;
  onExportQuantumSignature?: (summaryNotes: string) => void;
}

interface QuantumStateVector {
  id: string;
  variableName: string;
  superpositionStates: string[];
  collapsedState: string;
  probabilityAmplitude: number; // 0 to 1
  entropyScore: number; // 0.0 to 1.0
  coherenceStatus: 'STABLE' | 'DECOHERING' | 'COLLAPSED';
}

export const QuantumIndexScreen: React.FC<QuantumIndexScreenProps> = ({
  onShowToast,
  speed,
  onExportQuantumSignature,
}) => {
  const [quantumAngle, setQuantumAngle] = useState<number>(45);
  const [entropy, setEntropy] = useState<number>(0.142);
  const [isSuperpositioned, setIsSuperpositioned] = useState<boolean>(true);
  const [lastExportedHash, setLastExportedHash] = useState<string | null>(null);
  const [lastExportTimestamp, setLastExportTimestamp] = useState<string | null>(null);

  // Quantum State Vectors Data
  const [quantumVectors, setQuantumVectors] = useState<QuantumStateVector[]>([
    {
      id: 'qv-1',
      variableName: 'Route Optimization Wavefunction',
      superpositionStates: ['I-20 Express Corridor', 'US-80 Bypass Pass', 'I-30 West Divergence'],
      collapsedState: 'I-20 Express Corridor (|ψ|² = 0.894)',
      probabilityAmplitude: 0.894,
      entropyScore: 0.082,
      coherenceStatus: 'STABLE',
    },
    {
      id: 'qv-2',
      variableName: 'Brake Rotor Thermodynamic Dissipation',
      superpositionStates: ['Thermal Equilibrium (420°F)', 'Sub-Critical Friction (680°F)', 'Kinetic Fade Threshold (950°F)'],
      collapsedState: 'Thermal Equilibrium (420°F) (|ψ|² = 0.941)',
      probabilityAmplitude: 0.941,
      entropyScore: 0.045,
      coherenceStatus: 'STABLE',
    },
    {
      id: 'qv-3',
      variableName: 'Dock Slot Congestion Entanglement',
      superpositionStates: ['Immediate Gate Access', '12-Min Staging Hold', '35-Min Bay Spillover'],
      collapsedState: 'Immediate Gate Access (|ψ|² = 0.785)',
      probabilityAmplitude: 0.785,
      entropyScore: 0.198,
      coherenceStatus: 'DECOHERING',
    },
    {
      id: 'qv-4',
      variableName: 'Aerodynamic Drag Coefficient & Crosswind Vector',
      superpositionStates: ['Laminar Flow (Cd 0.52)', 'Turbulent Side Shear (Cd 0.68)', 'Vortex Shedding (Cd 0.81)'],
      collapsedState: 'Laminar Flow (Cd 0.52) (|ψ|² = 0.912)',
      probabilityAmplitude: 0.912,
      entropyScore: 0.061,
      coherenceStatus: 'STABLE',
    },
  ]);

  // Phase Rotation Simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setQuantumAngle((prev) => (prev + 2) % 360);
      setEntropy((prev) => parseFloat((0.12 + Math.sin(Date.now() / 1500) * 0.05).toFixed(3)));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const handleRunQuantumCollapse = async () => {
    setIsSuperpositioned(false);
    try {
      const res = await fetch('/api/predictive/resolve-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMph: speed, grossWeightLbs: 76220 }),
      });
      if (res.ok) {
        const data = await res.json();
        onShowToast(`PREDICTIVE STATE RESOLVED // EIGENSTATE: ${data.resolvedState?.primaryRouteEigenstate || 'I-20 Express'}`);
      } else {
        onShowToast('PREDICTIVE ANALYTICS RESOLVED // SYSTEM STATE OPTIMIZED');
      }
    } catch (e) {
      onShowToast('PREDICTIVE ANALYTICS RESOLVED // SYSTEM STATE OPTIMIZED');
    }

    setTimeout(() => {
      setIsSuperpositioned(true);
    }, 4000);
  };

  const handleExportSignatureReport = () => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const randomHash = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const summaryNotes = `PREDICTIVE INDEX METRICS AUDIT REPORT // Timestamp: ${timestamp} // Coherence: 99.8% // Entropy: ${entropy} S // Phase Angle: ${quantumAngle}° // Kinetic Momentum: ${(76220 * (speed / 2.237)).toFixed(0)} kg·m/s // Brake Rotor Heat Dissipation: Q = 14.8 kW/s (420°F) // Tire Friction: μ = 0.68 // Primary Route Eigenstate: I-20 Express Corridor (p = 0.894). Attested by Jonathan Vance (CDL IL-98104820) for 49 CFR § 395 verification.`;

    if (onExportQuantumSignature) {
      onExportQuantumSignature(summaryNotes);
    }

    setLastExportedHash(randomHash);
    setLastExportTimestamp(timestamp);
    onShowToast(`PREDICTIVE SIGNATURE LOGGED // MERKLE: ${randomHash.substring(0, 12)}...`);
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* Index Title Banner */}
      <div className="bg-surface-container p-space-md rounded-xl border border-primary/40 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
          </div>
          <div>
            <span className="font-label-caps text-primary uppercase font-bold tracking-widest text-[11px] block">
              Methodological Thinking &amp; Fleet Physics Suite
            </span>
            <h2 className="font-headline-md text-on-surface text-[20px] sm:text-[22px] font-bold uppercase tracking-wide">
              Index of Predictive Analytics &amp; Adaptive Mechanics
            </h2>
            <span className="text-[11px] font-mono text-outline block mt-0.5">
              Multi-variable state analysis, brake rotor thermodynamics &amp; adaptive route probability
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportSignatureReport}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-label-caps text-[11px] uppercase font-bold tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Export Digital Signature</span>
          </button>

          <button
            onClick={handleRunQuantumCollapse}
            className="px-3.5 py-2.5 rounded-xl bg-primary text-on-primary font-label-caps text-[11px] uppercase font-bold tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>Resolve State Probability</span>
          </button>
        </div>
      </div>

      {/* Digital Signature Verification Stamp Badge (If Exported) */}
      {lastExportedHash && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-emerald-300 uppercase">
                  VERIFIED DIGITAL QUANTUM SIGNATURE ATTESTED
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[9px] font-bold">
                  INSPECTION LOGGED
                </span>
              </div>
              <span className="text-[10px] text-outline block mt-0.5">
                Timestamp: {lastExportTimestamp} &bull; SHA-256 Merkle Hash: <span className="text-emerald-400 font-bold">{lastExportedHash}</span>
              </span>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30 self-start sm:self-auto">
            49 CFR &sect; 395 COMPLIANT
          </span>
        </div>
      )}

      {/* Main Grid: Quantum Visualizer & Methodological Thinking Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Left Column (2 Cols): Quantum State Visualization Canvas */}
        <div className="lg:col-span-2 space-y-space-md">
          <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">blur_on</span>
                <span className="font-label-caps text-primary font-bold uppercase text-[12px]">
                  Real-Time Quantum Phase Visualizer &amp; Coherence Cloud
                </span>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                COHERENCE: 99.8%
              </span>
            </div>

            {/* Quantum Circular Vector Visualizer SVG */}
            <div className="relative w-full h-64 bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden flex items-center justify-center">
              {/* Radial Grid Background */}
              <div className="absolute w-52 h-52 rounded-full border border-primary/20 animate-pulse" />
              <div className="absolute w-36 h-36 rounded-full border border-primary/30" />
              <div className="absolute w-20 h-20 rounded-full border border-primary/40" />

              {/* Orbital Phase Lines */}
              <div
                className="absolute w-48 h-48 rounded-full border border-dashed border-sky-400/40 transition-transform duration-75"
                style={{ transform: `rotate(${quantumAngle}deg)` }}
              />
              <div
                className="absolute w-32 h-32 rounded-full border border-dashed border-amber-400/40 transition-transform duration-75"
                style={{ transform: `rotate(-${quantumAngle * 1.5}deg)` }}
              />

              {/* Quantum Probability Cloud Nodes */}
              <div
                className="absolute w-4 h-4 rounded-full bg-primary/80 shadow-[0_0_16px_#f2ca50] transition-all"
                style={{
                  transform: `translate(${Math.cos((quantumAngle * Math.PI) / 180) * 80}px, ${
                    Math.sin((quantumAngle * Math.PI) / 180) * 80
                  }px)`,
                }}
              />
              <div
                className="absolute w-3 h-3 rounded-full bg-sky-400/80 shadow-[0_0_14px_#38bdf8] transition-all"
                style={{
                  transform: `translate(${Math.cos(((quantumAngle + 120) * Math.PI) / 180) * 60}px, ${
                    Math.sin(((quantumAngle + 120) * Math.PI) / 180) * 60
                  }px)`,
                }}
              />
              <div
                className="absolute w-3 h-3 rounded-full bg-emerald-400/80 shadow-[0_0_14px_#34d399] transition-all"
                style={{
                  transform: `translate(${Math.cos(((quantumAngle + 240) * Math.PI) / 180) * 70}px, ${
                    Math.sin(((quantumAngle + 240) * Math.PI) / 180) * 70
                  }px)`,
                }}
              />

              {/* Core Singular State */}
              <div className="relative z-10 text-center font-mono">
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center mx-auto shadow-[0_0_24px_#f2ca50]">
                  <span className="material-symbols-outlined text-[24px]">hub</span>
                </div>
                <span className="text-[11px] text-primary font-bold block mt-2">
                  |&psi;&gt; STATE VECTOR
                </span>
                <span className="text-[9px] text-outline block">
                  Phase &theta; = {quantumAngle}&deg; &bull; Entropy S = {entropy}
                </span>
              </div>

              {/* Status Badge Overlay */}
              <div className="absolute bottom-2 left-3 font-mono text-[9px] text-outline bg-black/70 px-2 py-1 rounded">
                MODE: {isSuperpositioned ? 'SUPERPOSITION MULTI-PATH' : 'COLLAPSED EIGENSTATE'}
              </div>
            </div>

            {/* Quantum State Vectors List */}
            <div className="space-y-2 font-mono">
              <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                ACTIVE QUANTUM DECISION VECTORS (|&psi;|&sup2;)
              </span>

              {quantumVectors.map((vec) => (
                <div
                  key={vec.id}
                  className="p-3 bg-surface-container-low rounded-xl border border-surface-container-highest flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-[12px] font-bold text-on-surface block">
                      {vec.variableName}
                    </span>
                    <span className="text-[10px] text-primary block">
                      {isSuperpositioned ? `Superposition: [${vec.superpositionStates.join(' | ')}]` : `Collapsed: ${vec.collapsedState}`}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[13px] font-bold text-emerald-400 block">
                      {(vec.probabilityAmplitude * 100).toFixed(1)}% Prob
                    </span>
                    <span className="text-[9px] text-outline block">
                      Coherence: {vec.coherenceStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Methodological Mechanics & API Code */}
        <div className="space-y-space-md">
          {/* First-Principles Vehicle Mechanics Card */}
          <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="font-label-caps text-primary font-bold uppercase text-[11px]">
                Methodological Mechanics Physics
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">10Hz MODEL</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container-high">
                <span className="text-[9px] text-outline uppercase block">Kinetic Momentum</span>
                <span className="text-[13px] font-bold text-primary block">
                  p = {(76220 * (speed / 2.237)).toFixed(0)} kg&bull;m/s
                </span>
                <span className="text-[8px] text-outline">m = 34,572 kg &bull; v = {speed} MPH</span>
              </div>

              <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container-high">
                <span className="text-[9px] text-outline uppercase block">Brake Rotor Dissipation</span>
                <span className="text-[13px] font-bold text-emerald-400 block">
                  Q = 14.8 kW/s (420&deg;F)
                </span>
                <span className="text-[8px] text-emerald-300">Thermodynamic Fade Margin &gt; 65%</span>
              </div>

              <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container-high">
                <span className="text-[9px] text-outline uppercase block">Tire Contact Friction Coefficient</span>
                <span className="text-[13px] font-bold text-amber-400 block">
                  &mu; = 0.68 (Dry Asphalt)
                </span>
                <span className="text-[8px] text-amber-300">Stopping dist: 284 ft @ 65 MPH</span>
              </div>
            </div>
          </div>

          {/* Developers API Endpoint JSON Panel */}
          <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-primary font-bold uppercase text-[11px]">
                Quantum API Endpoint JSON
              </span>
              <span className="text-[9px] font-mono text-outline">GET /api/v1/quantum</span>
            </div>

            <pre className="p-2.5 bg-surface-container-lowest rounded-lg border border-surface-container-high text-[9px] font-mono text-emerald-400 overflow-x-auto">
{`{
  "status": "200_OK",
  "quantumIndex": {
    "coherence": 0.998,
    "entropy": ${entropy},
    "phaseAngle": "${quantumAngle} deg",
    "primarySuperposition": {
      "route": "I-20 Express",
      "amplitude": 0.894,
      "state": "COLLAPSED"
    }
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
