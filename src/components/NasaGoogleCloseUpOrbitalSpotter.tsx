import React, { useState } from 'react';
import { DispatchMonitorDriver } from '../types';
import { Satellite, Crosshair, MapPin, X, Navigation, Eye } from 'lucide-react';

interface NasaGoogleCloseUpOrbitalSpotterProps {
  selectedDriver?: DispatchMonitorDriver;
  allDrivers?: DispatchMonitorDriver[];
  onSelectDriver?: (driverId: string) => void;
  initialNasaEnabled?: boolean;
  initialMapType?: string;
  onClose?: () => void;
  isInlineSplit?: boolean;
}

export const NasaGoogleCloseUpOrbitalSpotter: React.FC<NasaGoogleCloseUpOrbitalSpotterProps> = ({
  selectedDriver,
  allDrivers = [],
  onSelectDriver,
  initialNasaEnabled = true,
  onClose,
  isInlineSplit = false,
}) => {
  const [isNasaLayerActive, setIsNasaLayerActive] = useState<boolean>(initialNasaEnabled);
  const [zoomLevel, setZoomLevel] = useState<number>(14);

  return (
    <div className={`relative w-full h-full bg-[#03060B] rounded-xl overflow-hidden border border-cyan-500/30 flex flex-col justify-between p-3 font-mono ${isInlineSplit ? 'border-2' : ''}`}>
      {/* Top HUD Overlay */}
      <div className="relative z-10 flex items-center justify-between gap-2 bg-[#0A101C]/90 p-2 rounded-xl border border-cyan-500/40 backdrop-blur shadow-xl">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div>
            <span className="text-[11px] font-bold text-cyan-300 block">
              NASA GIBS / GOES-East &bull; Orbital Spotter 250m Resolution
            </span>
            <span className="text-[9px] text-slate-400">
              Active Lock: <strong className="text-white">{selectedDriver?.truckUnit || 'TR-904'} ({selectedDriver?.name || 'Vance Reynolds'})</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNasaLayerActive(!isNasaLayerActive)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
              isNasaLayerActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isNasaLayerActive ? 'NASA Layer ON' : 'Vector Only'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              title="Close Orbital View"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Simulated Satellite Stage Canvas */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 rounded-full border-2 border-cyan-500/20 animate-ping opacity-25" />
        <div className="w-32 h-32 rounded-full border border-cyan-400/40 flex items-center justify-center">
          <Crosshair className="w-8 h-8 text-cyan-400/70" />
        </div>
      </div>

      {/* Target Coordinates Overlay */}
      <div className="relative z-10 flex items-center justify-between text-[10px] text-cyan-300 bg-[#0A101C]/90 p-2 rounded-xl border border-cyan-500/40 backdrop-blur">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            LAT: {selectedDriver?.lat || 41.521}° N &bull; LNG: {selectedDriver?.lng || -86.812}° W
          </span>
        </div>
        <div className="text-right">
          <span>ALT: 22,236 MI GEOSYNCHRONOUS ORBIT</span>
        </div>
      </div>
    </div>
  );
};

export default NasaGoogleCloseUpOrbitalSpotter;
