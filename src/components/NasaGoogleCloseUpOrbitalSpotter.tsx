import React, { useMemo, useState } from 'react';
import { DispatchMonitorDriver } from '../types';
import { calculateNasaTelemetry } from '../services/nasaOrbitalSpotterService';

interface NasaGoogleCloseUpOrbitalSpotterProps {
  selectedDriver?: DispatchMonitorDriver;
  allDrivers?: DispatchMonitorDriver[];
  onSelectDriver?: (driverId: string) => void;
  initialNasaEnabled?: boolean;
  initialMapType?: 'roadmap' | 'hybrid';
  isInlineSplit?: boolean;
  onClose?: () => void;
}

export const NasaGoogleCloseUpOrbitalSpotter: React.FC<NasaGoogleCloseUpOrbitalSpotterProps> = ({
  selectedDriver,
  allDrivers = [],
  onSelectDriver,
  initialNasaEnabled = true,
  initialMapType = 'hybrid',
  isInlineSplit = false,
  onClose,
}) => {
  const [nasaEnabled, setNasaEnabled] = useState(initialNasaEnabled);
  const [mapType, setMapType] = useState(initialMapType);
  const telemetry = useMemo(
    () => selectedDriver
      ? calculateNasaTelemetry(selectedDriver.lat, selectedDriver.lng)
      : null,
    [selectedDriver?.lat, selectedDriver?.lng]
  );

  return (
    <section className={`flex h-full min-h-64 flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#05080E] text-white ${isInlineSplit ? 'text-xs' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 p-3">
        <div>
          <h2 className="font-black uppercase tracking-wide text-amber-300">Route &amp; Satellite Spotter</h2>
          <p className="text-[10px] font-mono text-amber-200">SIMULATED TELEMETRY · NOT A LIVE SATELLITE FEED</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMapType((current) => current === 'roadmap' ? 'hybrid' : 'roadmap')}
            className="rounded border border-slate-600 px-2 py-1 text-xs uppercase"
          >
            {mapType}
          </button>
          <button
            onClick={() => setNasaEnabled((enabled) => !enabled)}
            className={`rounded border px-2 py-1 text-xs font-bold uppercase ${nasaEnabled ? 'border-emerald-500 text-emerald-300' : 'border-slate-600 text-slate-400'}`}
          >
            Estimate {nasaEnabled ? 'On' : 'Off'}
          </button>
          {onClose && <button onClick={onClose} className="rounded border border-slate-600 px-2 py-1 text-xs">Close</button>}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[1fr_15rem]">
        <div className={`relative min-h-56 overflow-hidden rounded-lg border border-slate-800 ${mapType === 'hybrid' ? 'bg-[linear-gradient(135deg,#172b26,#111b2a_45%,#292519)]' : 'bg-[#101821]'}`}>
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#64748b33 1px, transparent 1px), linear-gradient(90deg, #64748b33 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          {selectedDriver && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#FFE500] bg-black/80 px-3 py-2 text-center shadow-[0_0_20px_rgba(255,229,0,0.35)]">
              <div className="text-xs font-black text-[#FFE500]">{selectedDriver.truckUnit}</div>
              <div className="text-[10px] text-white">{selectedDriver.lat.toFixed(3)}, {selectedDriver.lng.toFixed(3)}</div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-slate-300">
            {selectedDriver?.currentLocationName || 'Select a fleet unit'}
          </div>
        </div>
        <aside className="space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <h3 className="text-xs font-bold uppercase text-slate-300">Atmospheric estimate</h3>
            {nasaEnabled && telemetry ? (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <dt className="text-slate-400">Surface</dt><dd>{telemetry.surfaceTempF}°F</dd>
                <dt className="text-slate-400">Crosswind</dt><dd>{telemetry.crosswindVelocityMph} MPH</dd>
                <dt className="text-slate-400">Visibility</dt><dd>{telemetry.visibilityMiles} MI</dd>
                <dt className="text-slate-400">Road</dt><dd className="break-words">{telemetry.roadSurfaceCondition.replaceAll('_', ' ')}</dd>
              </dl>
            ) : <p className="mt-2 text-xs text-slate-400">Select a driver and enable the local estimate.</p>}
          </div>
          <div className="space-y-1">
            {allDrivers.map((driver) => (
              <button
                key={driver.id}
                onClick={() => onSelectDriver && onSelectDriver(driver.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${selectedDriver?.id === driver.id ? 'border-[#FFE500] text-[#FFE500]' : 'border-slate-700 text-slate-300'}`}
              >
                <span className="font-bold">{driver.truckUnit}</span> · {driver.name}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default NasaGoogleCloseUpOrbitalSpotter;
