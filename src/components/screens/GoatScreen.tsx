import React, { useState } from 'react';
import { PARKING_FACILITIES } from '../../data/mockData';

interface GoatScreenProps {
  onShowToast: (msg: string) => void;
}

export const GoatScreen: React.FC<GoatScreenProps> = ({ onShowToast }) => {
  const [trailerAngle, setTrailerAngle] = useState<number>(14); // 14 degrees articulation
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
        onShowToast('G.O.A.T. SAFETY AUDIT PASSED: CLEAR TO COMMENCE BACKING');
      }
      return updated;
    });
  };

  const isJackknifeRisk = Math.abs(trailerAngle) > 48;

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-gutter-mobile pb-space-2xl space-y-space-md">
      {/* G.O.A.T. Banner */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">alt_route</span>
          </div>
          <div>
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider block">
              The G.O.A.T. Protocol
            </span>
            <span className="font-headline-sm text-on-surface text-[17px] font-bold">
              Get Out And Look &bull; Backing Guidance
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 bg-primary/20 text-primary font-telemetry-label text-[10px] font-bold rounded">
          49 CFR § 392.2 COMPLIANT
        </span>
      </div>

      {/* Trailer Articulation & Jackknife Sentinel */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
            Virtual Kingpin Hitch Articulation Angle
          </span>
          <span
            className={`font-telemetry-label text-[10px] font-bold px-2 py-0.5 rounded ${
              isJackknifeRisk
                ? 'bg-error-container text-error animate-pulse'
                : 'bg-surface-container-highest text-primary'
            }`}
          >
            {isJackknifeRisk ? 'DANGER: JACKKNIFE THRESHOLD' : 'SAFE ARTICULATION'}
          </span>
        </div>

        {/* Tactical Trailer Graphic */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high flex flex-col items-center justify-center relative overflow-hidden">
          {/* Top Info */}
          <div className="w-full flex justify-between text-mono text-[11px] text-outline mb-2">
            <span>53' Dry Van (#TR-5390)</span>
            <span className="text-primary font-bold">Angle: {trailerAngle}&deg;</span>
          </div>

          {/* Canvas-like Visual Representation */}
          <div className="relative w-72 h-44 flex items-center justify-center">
            {/* Guide Grid Lines */}
            <div className="absolute inset-0 border border-dashed border-outline/20 rounded-lg" />
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-outline/20" />

            {/* Tractor representation (Fixed at bottom) */}
            <div className="absolute bottom-4 w-12 h-16 bg-surface-container-highest border-2 border-primary rounded-sm flex flex-col items-center justify-between p-1 z-10 shadow-lg">
              <span className="font-mono text-[7px] text-primary font-bold">CAB</span>
              <div className="w-8 h-1 bg-primary rounded" />
              <span className="font-mono text-[6px] text-outline">K-PIN</span>
            </div>

            {/* Trailer representation (Rotated by trailerAngle) */}
            <div
              className="absolute bottom-16 w-14 h-24 bg-surface-container-high border-2 border-primary-container rounded-sm flex flex-col items-center justify-between p-1 transition-transform duration-100 shadow-xl"
              style={{
                transformOrigin: '50% 100%',
                transform: `rotate(${trailerAngle}deg)`,
              }}
            >
              <div className="w-10 h-1 bg-primary-container rounded" />
              <span className="font-mono text-[8px] text-primary-fixed font-bold">53' REAR</span>
              <div className="flex gap-1">
                <span className="w-2 h-1 bg-error rounded" />
                <span className="w-2 h-1 bg-error rounded" />
              </div>
            </div>

            {/* Swing Arc Guidelines */}
            <div
              className="absolute top-2 text-[9px] font-mono text-outline px-2 py-0.5 rounded bg-black/60"
            >
              Blindside Swing Radius: 12.4 Ft Clearance
            </div>
          </div>

          {/* Angle Slider Control */}
          <div className="w-full max-w-sm mt-3 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-outline">
              <span>-60&deg; Driver-Side</span>
              <span className="text-primary font-bold">0&deg; Straight</span>
              <span>+60&deg; Blindside</span>
            </div>
            <input
              type="range"
              min="-60"
              max="60"
              value={trailerAngle}
              onChange={(e) => setTrailerAngle(parseInt(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Mandatory G.O.A.T. Walk-Around Safety Checklist */}
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              checklist
            </span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
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
              onShowToast('ALL G.O.A.T. SAFETY ITEMS CONFIRMED');
            }}
            className="text-[10px] font-label-caps text-primary uppercase hover:underline cursor-pointer font-bold"
          >
            Check All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-body-sm">
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
                    ? 'bg-primary/10 border-primary/40 text-on-surface'
                    : 'bg-surface-container-low border-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="text-[12px] font-medium leading-snug pr-2">
                  {item.label}
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isChecked ? 'text-primary' : 'text-outline'
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
      <div className="bg-surface-container p-space-md rounded-xl border border-surface-container-high/60 shadow-xl space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              local_parking
            </span>
            <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider font-bold">
              Certified Truck Parking Along I-20 Corridor
            </span>
          </div>
          <span className="font-telemetry-label text-[10px] text-outline">
            LIVE TPIMS TELEMETRY
          </span>
        </div>

        <div className="space-y-2">
          {PARKING_FACILITIES.map((facility) => {
            const isFull = facility.availableSpots === 0;
            const isLow = facility.availableSpots > 0 && facility.availableSpots <= 5;
            return (
              <div
                key={facility.id}
                className="p-3 bg-surface-container-low rounded-lg border border-surface-container-highest flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-body-md font-bold text-on-surface">
                      {facility.name}
                    </span>
                    <span className="text-[10px] text-outline">({facility.exit})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-outline font-mono">
                      Mile {facility.mileMarker} &bull; {facility.milesAway} miles ahead
                    </span>
                    <span className="text-[11px] text-outline-variant">
                      &bull; {facility.amenities.slice(0, 2).join(', ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span
                      className={`font-telemetry-metric text-[16px] font-bold block ${
                        isFull
                          ? 'text-error'
                          : isLow
                          ? 'text-amber-400'
                          : 'text-primary'
                      }`}
                    >
                      {facility.availableSpots} SPOTS
                    </span>
                    <span className="text-[9px] text-outline font-mono">
                      of {facility.totalSpots} total
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      onShowToast(`NAVIGATING TO ${facility.name.toUpperCase()} (EXIT ${facility.exit})`)
                    }
                    className="p-2 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-outline hover:text-on-primary transition-colors cursor-pointer border border-surface-container-high"
                    title="Route to parking"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      directions
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
