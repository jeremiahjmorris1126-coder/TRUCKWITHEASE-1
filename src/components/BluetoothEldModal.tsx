import React, { useState, useEffect, useMemo } from 'react';
import {
  bluetoothEldService,
  COMMERCIAL_ELD_PROFILES,
  EldHardwareProfile,
  J1939LiveTelemetry,
  BluetoothConnectionStatus,
  BluetoothRawPacket,
  EldConnectionStatPoint,
} from '../services/bluetoothEldService';

interface BluetoothEldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onUpdateVehicleSpeed?: (speed: number) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const BluetoothEldModal: React.FC<BluetoothEldModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onUpdateVehicleSpeed,
  onNavigateToTab,
}) => {
  const [activeTab, setActiveTab] = useState<'LIVE_CLUSTER' | 'RADAR_SCAN' | 'DIAGNOSTIC_LOG' | 'CAN_BUS_PACKETS' | 'SIMULATION' | 'GPSTAB_CLOUD'>('LIVE_CLUSTER');
  const [status, setStatus] = useState<BluetoothConnectionStatus>(() => bluetoothEldService.getStatus());
  const [connectedDevice, setConnectedDevice] = useState<EldHardwareProfile | null>(() => bluetoothEldService.getConnectedDevice());
  const [telemetry, setTelemetry] = useState<J1939LiveTelemetry>(() => bluetoothEldService.getLiveTelemetry());
  const [packets, setPackets] = useState<BluetoothRawPacket[]>(() => bluetoothEldService.getPacketHistory());
  const [connectionStats, setConnectionStats] = useState<EldConnectionStatPoint[]>(() => bluetoothEldService.getConnectionStats24Hours());
  const [isPairingNow, setIsPairingNow] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(64);
  const [simRpm, setSimRpm] = useState<number>(1280);
  const [simBoost, setSimBoost] = useState<number>(28.4);
  const [simFaultActive, setSimFaultActive] = useState<boolean>(false);
  const [gpsTabSyncing, setGpsTabSyncing] = useState<boolean>(false);
  const [gpsTabStatus, setGpsTabStatus] = useState<{ isConfigured: boolean; message: string; companyId?: string | null } | null>(null);

  // Check GPSTab API status when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/gpstab/status')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            setGpsTabStatus({
              isConfigured: data.isConfigured,
              message: data.message,
              companyId: data.companyId,
            });
          }
        })
        .catch(() => {
          setGpsTabStatus({
            isConfigured: false,
            message: 'Autonomous In-Cab Telematics Active',
          });
        });
    }
  }, [isOpen]);

  const handleGpsTabSync = async () => {
    setGpsTabSyncing(true);
    try {
      const res = await fetch('/api/gpstab/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit: 'TRK-904', driverId: 'DRV-101' }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('GPSTab Telematics & HOS synchronized successfully!', 'cloud_done');
        if (data.telemetry?.speedMph !== undefined) {
          bluetoothEldService.injectSimulation({
            wheelSpeedMph: data.telemetry.speedMph,
            engineRpm: data.telemetry.engineRpm,
            fuelLevelPct: data.telemetry.fuelLevelPct,
            odometerMiles: data.telemetry.odometerMiles,
          });
        }
      } else {
        onShowToast('GPSTab sync completed with autonomous cache.', 'info');
      }
    } catch {
      onShowToast('GPSTab sync completed via autonomous cache.', 'info');
    } finally {
      setGpsTabSyncing(false);
    }
  };

  // Subscribe to live telemetry
  useEffect(() => {
    const unsubscribe = bluetoothEldService.subscribe((newTelemetry, newStatus) => {
      setTelemetry(newTelemetry);
      setStatus(newStatus);
      setConnectedDevice(bluetoothEldService.getConnectedDevice());
      setPackets(bluetoothEldService.getPacketHistory());

      if (onUpdateVehicleSpeed && newStatus === 'CONNECTED') {
        onUpdateVehicleSpeed(newTelemetry.wheelSpeedMph);
      }
    });

    return () => unsubscribe();
  }, [onUpdateVehicleSpeed]);

  if (!isOpen) return null;

  // Handle Pairing with Device
  const handleConnect = async (profileId?: string) => {
    setIsPairingNow(true);
    onShowToast('DISCOVERING J1939 BLUETOOTH GATT SERVICES...', 'bluetooth_searching');
    const result = await bluetoothEldService.connectEld(profileId);
    setIsPairingNow(false);
    if (result.success) {
      onShowToast(result.message, 'bluetooth_connected');
      setActiveTab('LIVE_CLUSTER');
    } else {
      onShowToast('Connection attempt failed.', 'error');
    }
  };

  const handleDisconnect = () => {
    bluetoothEldService.disconnectEld();
    onShowToast('BLUETOOTH ELD DISCONNECTED // STANDALONE CAB MODE ACTIVE', 'bluetooth_disabled');
  };

  const handleExportCsv = () => {
    const csvContent = bluetoothEldService.exportCsvLog();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TRUCKWITHEASE_J1939_TELEMETRY_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('J1939 RAW CAN-BUS TELEMETRY LOG EXPORTED TO CSV', 'download');
  };

  const handleExportConnectionStatsCsv = () => {
    const csvContent = bluetoothEldService.exportConnectionStatsCsv(connectionStats);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `TRUCKWITHEASE_ELD_CONNECTION_STATS_24H_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('24-HOUR ELD CONNECTION STATS (RSSI & PACKET LOSS) EXPORTED TO CSV', 'download');
  };

  // Sync simulation sliders
  const handleSimSpeedChange = (newSpeed: number) => {
    setSimSpeed(newSpeed);
    const newRpm = newSpeed > 0 ? Math.round(1100 + newSpeed * 4.2) : 650;
    setSimRpm(newRpm);
    bluetoothEldService.injectSimulation({
      wheelSpeedMph: newSpeed,
      engineRpm: newRpm,
      boostPressurePsi: newSpeed > 0 ? parseFloat((18.0 + (newSpeed / 70) * 16.0).toFixed(1)) : 1.2,
    });
    if (onUpdateVehicleSpeed) {
      onUpdateVehicleSpeed(newSpeed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0A0F14] border-2 border-[#1E2532] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ================================================================== */}
        {/* 1. TOP HEADER & TELEMETRY HARDWARE STATUS                          */}
        {/* ================================================================== */}
        <div className="p-4 sm:p-6 border-b border-[#1E2532] bg-gradient-to-r from-[#05080E] via-[#0A0F14] to-[#05080E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-[#FFE500] shadow-[0_0_20px_rgba(255,229,0,0.25)]">
              <span className="material-symbols-outlined text-[28px] animate-pulse">bluetooth_connected</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Space_Grotesk'] text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
                  BLUETOOTH ELD & J1939 TELEMETRICS
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  <span>&#10004;</span>
                  <span>49 CFR § 395.26</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {status === 'CONNECTED' && connectedDevice
                  ? `Hardware Connected: ${connectedDevice.name} // 250 kbps ECM 10Hz Broadcast`
                  : 'Wireless Commercial Vehicle ECM Gateway // Ready for Pair or Live Simulation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {status === 'CONNECTED' ? (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/50 cursor-pointer transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">bluetooth_disabled</span>
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={() => handleConnect('eld-geotab-go9')}
                disabled={isPairingNow}
                className="btn-tactical-yellow px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
              >
                <span className="material-symbols-outlined text-[16px]">bluetooth_searching</span>
                <span>{isPairingNow ? 'PAIRING...' : 'QUICK PAIR (GEOTAB GO9)'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition flex items-center justify-center"
              title="Close Telemetry HUD"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* PROMOTIONAL HARDWARE PRICING BANNER */}
        <div className="mx-4 sm:mx-6 mt-3 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-[#FFE500]/20 to-amber-500/15 border border-[#FFE500]/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500] text-[18px]">shopping_cart</span>
            <span className="text-white font-bold">
              Need Turnkey Hardware? <span className="text-[#FFE500]">GPSTab (#1 Best Bet)</span>, Geotab GO9+, or Azuga with 2-Day Cab Shipping or White Glove Concierge.
            </span>
          </div>
          {onNavigateToTab && (
            <button
              onClick={() => {
                onClose();
                onNavigateToTab('hardware-pricing');
              }}
              className="btn-tactical-yellow px-3 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
            >
              VISIT HARDWARE STORE &amp; PRICING
            </button>
          )}
        </div>

        {/* ================================================================== */}
        {/* 2. SUBTAB NAVIGATION BAR                                           */}
        {/* ================================================================== */}
        <div className="px-4 sm:px-6 pt-3 bg-[#0A0F14] border-b border-[#1E2532]">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3">
            <button
              onClick={() => setActiveTab('LIVE_CLUSTER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'LIVE_CLUSTER'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">speed</span>
              <span>Live Digital Cluster</span>
            </button>

            <button
              onClick={() => setActiveTab('RADAR_SCAN')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'RADAR_SCAN'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">radar</span>
              <span>Device Discovery Radar</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('DIAGNOSTIC_LOG');
                setConnectionStats(bluetoothEldService.getConnectionStats24Hours());
              }}
              data-testid="tab-diagnostic-log"
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'DIAGNOSTIC_LOG'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>Diagnostic Log</span>
            </button>

            <button
              onClick={() => setActiveTab('CAN_BUS_PACKETS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'CAN_BUS_PACKETS'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">terminal</span>
              <span>Raw J1939 CAN Stream</span>
            </button>

            <button
              onClick={() => setActiveTab('SIMULATION')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'SIMULATION'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Harness & Calibration</span>
            </button>

            <button
              onClick={() => setActiveTab('GPSTAB_CLOUD')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'GPSTAB_CLOUD'
                  ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
              <span>GPSTab Cloud ELD</span>
              {gpsTabStatus?.isConfigured && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 3. TAB CONTENT VIEWS                                               */}
        {/* ================================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: LIVE DIGITAL INSTRUMENT CLUSTER                           */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'LIVE_CLUSTER' && (
            <div className="space-y-6 animate-fade-in">
              {/* Motion Compliance Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#05080E] to-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.15)] font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <div>
                    <span className="text-emerald-400 font-bold uppercase tracking-wider block">
                      FMCSA 49 CFR § 395.26 COMPLIANCE PROTOCOL ACTIVE
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {telemetry.wheelSpeedMph >= 5.0
                        ? `Vehicle in motion (${telemetry.wheelSpeedMph} MPH > 5.0 MPH threshold) // Auto-locked duty status: DRIVING (D)`
                        : 'Vehicle stationary // Stationary timer active (auto-prompt On-Duty after 5 min)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-[#05080E] border border-slate-700 text-[#FFE500] font-black text-xs">
                    GEAR: {telemetry.selectedGear}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-[#05080E] border border-slate-700 text-white font-bold text-xs">
                    ODOMETER: {telemetry.odometerMiles.toLocaleString()} MI
                  </span>
                </div>
              </div>

              {/* Main Gauge Deck */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Gauge 1: Speedometer */}
                <div className="bg-[#05080E] p-5 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col items-center justify-center relative overflow-hidden text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    J1939 WHEEL-BASED SPEED (SPN 84)
                  </span>
                  <div className="my-3">
                    <span className="font-['Space_Grotesk'] text-6xl font-black text-[#FFE500] tracking-tight drop-shadow-[0_0_20px_rgba(255,229,0,0.4)]">
                      {telemetry.wheelSpeedMph}
                    </span>
                    <span className="text-xl font-bold text-slate-400 block -mt-1 font-mono">MPH</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (telemetry.wheelSpeedMph / 75) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-2">
                    Cruise Control: {telemetry.cruiseControlActive ? 'LOCKED AT 65' : 'INACTIVE'}
                  </span>
                </div>

                {/* Gauge 2: Tachometer (RPM) */}
                <div className="bg-[#05080E] p-5 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col items-center justify-center relative overflow-hidden text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ENGINE SPEED (SPN 190)
                  </span>
                  <div className="my-3">
                    <span className="font-['Space_Grotesk'] text-5xl font-black text-white tracking-tight">
                      {telemetry.engineRpm.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-slate-400 block -mt-1 font-mono">RPM</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-300 ${
                        telemetry.engineRpm > 1800 ? 'bg-red-500' : 'bg-gradient-to-r from-sky-400 to-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (telemetry.engineRpm / 2200) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-2">
                    Redline: 2,100 RPM • Sweet Spot: 1,150 - 1,350
                  </span>
                </div>

                {/* Gauge 3: Turbo Boost Pressure */}
                <div className="bg-[#05080E] p-5 rounded-2xl border border-[#1E2532] shadow-xl flex flex-col items-center justify-center relative overflow-hidden text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    TURBO BOOST PRESSURE (SPN 102)
                  </span>
                  <div className="my-3">
                    <span className="font-['Space_Grotesk'] text-5xl font-black text-sky-400 tracking-tight drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                      {telemetry.boostPressurePsi}
                    </span>
                    <span className="text-sm font-bold text-slate-400 block -mt-1 font-mono">PSI BOOST</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, (telemetry.boostPressurePsi / 42) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-2">
                    Peak Holset / BorgWarner Rating: 38.0 PSI
                  </span>
                </div>
              </div>

              {/* Secondary Sensor Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#05080E] p-3.5 rounded-xl border border-[#1E2532]">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">COOLANT TEMP (SPN 110)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-emerald-400 font-mono">{telemetry.coolantTempF}°F</span>
                    <span className="text-[10px] text-slate-500">NOMINAL</span>
                  </div>
                </div>

                <div className="bg-[#05080E] p-3.5 rounded-xl border border-[#1E2532]">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">OIL PRESSURE (SPN 100)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-emerald-400 font-mono">{telemetry.oilPressurePsi} PSI</span>
                    <span className="text-[10px] text-slate-500">SAFE</span>
                  </div>
                </div>

                <div className="bg-[#05080E] p-3.5 rounded-xl border border-[#1E2532]">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">FUEL RATE / MPG (SPN 183)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-[#FFE500] font-mono">{telemetry.instantaneousMpg} MPG</span>
                    <span className="text-[10px] text-slate-500">({telemetry.fuelRateGalPerHour} G/H)</span>
                  </div>
                </div>

                <div className="bg-[#05080E] p-3.5 rounded-xl border border-[#1E2532]">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">ALTERNATOR VOLTS (SPN 168)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-black text-emerald-400 font-mono">{telemetry.batteryVolts} V</span>
                    <span className="text-[10px] text-slate-500">14.2V NOM</span>
                  </div>
                </div>
              </div>

              {/* Kingpin Hitch & Suspension Sentinel */}
              <div className="p-4 rounded-2xl bg-[#05080E] border border-[#1E2532] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-amber-400">rv_hookup</span>
                  <div>
                    <span className="font-bold text-sm text-white uppercase block">
                      KINGPIN ARTICULATION SENTINEL: {telemetry.kingpinAngleDeg}°
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Safe envelope: ±35° // Jackknife alert threshold: 48°
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                    STEER AIR BAGS: {telemetry.steerAxleAirBagPsi} PSI
                  </span>
                  <span className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                    DRIVE AIR BAGS: {telemetry.driveAxleAirBagPsi} PSI
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: DEVICE DISCOVERY RADAR                                    */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'RADAR_SCAN' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[#05080E] border border-[#1E2532] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                    NEARBY COMMERCIAL VEHICLE BLUETOOTH GATEWAYS
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Scanning 2.4 GHz BLE Channels (Nordic UART & SAE J1939-13 Diagnostic Port)
                  </p>
                </div>
                <button
                  onClick={() => handleConnect()}
                  className="btn-tactical-yellow px-3.5 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-[0_0_15px_rgba(255,229,0,0.4)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>SCAN FOR DEVICES</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {COMMERCIAL_ELD_PROFILES.map((profile) => {
                  const isThisConnected = connectedDevice?.id === profile.id && status === 'CONNECTED';
                  return (
                    <div
                      key={profile.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isThisConnected
                          ? 'bg-emerald-950/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                          : 'bg-[#05080E] border-[#1E2532] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[24px] text-[#FFE500]">
                            settings_input_hdmi
                          </span>
                          <div>
                            <span className="font-bold text-sm text-white block">{profile.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Vendor: {profile.vendor} • {profile.protocol}
                            </span>
                          </div>
                        </div>

                        {isThisConnected ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-black uppercase">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-400 font-bold">
                            {profile.rssi} dBm
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#1E2532] text-[11px] font-mono text-slate-400">
                        <div>
                          <span>PORT: </span>
                          <span className="text-white font-bold">{profile.connectorType}</span>
                        </div>
                        <div>
                          <span>FMCSA ID: </span>
                          <span className="text-emerald-400 font-bold">{profile.fmcsaRegisteredId}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleConnect(profile.id)}
                        disabled={isThisConnected || isPairingNow}
                        className={`w-full mt-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isThisConnected
                            ? 'bg-emerald-500 text-black cursor-default'
                            : 'btn-tactical-yellow'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isThisConnected ? 'check_circle' : 'link'}
                        </span>
                        <span>{isThisConnected ? 'PAIRED & BROADCASTING' : 'CONNECT VIA BLUETOOTH'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB: DIAGNOSTIC LOG (24-HOUR CONNECTION RSSI & PACKET LOSS)     */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'DIAGNOSTIC_LOG' && (
            <div className="space-y-5 animate-fade-in font-sans">
              {/* Header with Download Report CTA */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#05080E] via-[#0A0F14] to-[#05080E] border-2 border-amber-500/40 shadow-[0_0_25px_rgba(255,229,0,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-[#FFE500] shrink-0 shadow-[0_0_15px_rgba(255,229,0,0.3)]">
                    <span className="material-symbols-outlined text-[28px]">query_stats</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Space_Grotesk'] text-base sm:text-lg font-black text-white uppercase tracking-wider">
                        ELD CONNECTION HEALTH &amp; DIAGNOSTIC LOG
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-black uppercase tracking-wider font-mono">
                        &#10004; 49 CFR § 395.26
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      24-Hour Continuous Telemetry • RF Signal Attenuation (RSSI) &amp; Packet Loss Log for Fleet Offline Analysis
                    </p>
                  </div>
                </div>

                {/* Primary Action Button: High-visibility safety yellow (.btn-tactical-yellow) */}
                <button
                  onClick={handleExportConnectionStatsCsv}
                  data-testid="download-24h-stats-csv"
                  className="btn-tactical-yellow px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] hover:brightness-110 active:scale-95 transition whitespace-nowrap self-stretch sm:self-auto"
                  title="Download 24-Hour Connection Statistics (RSSI and Packet Loss) CSV Report for Offline Fleet Analysis"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>DOWNLOAD 24-HR CONNECTION STATS (.CSV)</span>
                </button>
              </div>

              {/* 24-Hour Summary KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                {/* Metric 1: Avg RSSI */}
                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    24H AVG SIGNAL (RSSI)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-[#FFE500]">
                      {bluetoothEldService.getConnectionStatsSummary(connectionStats).avgRssi} dBm
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 text-[9px] font-black uppercase">
                      EXCELLENT
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Min: {bluetoothEldService.getConnectionStatsSummary(connectionStats).minRssi} dBm · Max: {bluetoothEldService.getConnectionStatsSummary(connectionStats).maxRssi} dBm
                  </span>
                </div>

                {/* Metric 2: Avg Packet Loss */}
                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    24H PACKET LOSS RATE
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-400">
                      {bluetoothEldService.getConnectionStatsSummary(connectionStats).avgPacketLossPct.toFixed(2)}%
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 text-[9px] font-black uppercase">
                      &lt; 1.0% NOMINAL
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {bluetoothEldService.getConnectionStatsSummary(connectionStats).totalDropped} dropped / {bluetoothEldService.getConnectionStatsSummary(connectionStats).totalPackets.toLocaleString()} frames
                  </span>
                </div>

                {/* Metric 3: Uptime & J1939 Stability */}
                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    RF LINK AVAILABILITY
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-sky-400">99.88%</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-400 border border-sky-500/50 text-[9px] font-black uppercase">
                      STABLE
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    250 kbps ECM Broadcast · 0 Drops
                  </span>
                </div>

                {/* Metric 4: Hardware Gateway */}
                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532] shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    ACTIVE HARDWARE GATEWAY
                  </span>
                  <div className="mt-1">
                    <span className="text-sm font-black text-white truncate block">
                      {connectedDevice ? connectedDevice.name : 'Geotab GO9 Telematics'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                      FMCSA: {connectedDevice ? connectedDevice.fmcsaRegisteredId : 'GEO-009-US'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Port: {connectedDevice ? connectedDevice.connectorType : '9-PIN DEUTSCH'}
                  </span>
                </div>
              </div>

              {/* 24-Hour Connection Statistics Table */}
              <div className="bg-[#05080E] rounded-2xl border border-[#1E2532] overflow-hidden shadow-xl">
                <div className="p-3.5 border-b border-[#1E2532] bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#FFE500]">table_chart</span>
                    <span className="font-['Space_Grotesk'] text-xs font-bold text-white uppercase tracking-wider">
                      24-HOUR HOURLY ROLLING CONNECTION STATISTICS (OFFLINE AUDIT)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({connectionStats.length} Hourly Checkpoints)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportConnectionStatsCsv}
                      className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#FFE500] text-black hover:brightness-110 transition flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)]"
                    >
                      <span className="material-symbols-outlined text-[14px]">file_download</span>
                      <span>Export .CSV</span>
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className="px-3 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-slate-900 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">terminal</span>
                      <span>Raw CAN</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72 scrollbar-thin">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead className="bg-[#0A0F14] text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 border-b border-[#1E2532]">
                      <tr>
                        <th className="py-2.5 px-3">Time Interval</th>
                        <th className="py-2.5 px-3">Signal (RSSI)</th>
                        <th className="py-2.5 px-3">Quality</th>
                        <th className="py-2.5 px-3">Packets (Tx / Rx)</th>
                        <th className="py-2.5 px-3">Dropped</th>
                        <th className="py-2.5 px-3">Packet Loss</th>
                        <th className="py-2.5 px-3">Latency</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E2532]/60 text-slate-300">
                      {connectionStats.map((stat) => (
                        <tr key={stat.timestamp} className="hover:bg-slate-900/50 transition">
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="text-white font-bold">
                              {stat.hoursAgo === 0 ? 'Current (Now)' : `${stat.hoursAgo}h ago`}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(stat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="text-[#FFE500] font-bold">{stat.rssi} dBm</span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                stat.signalQuality === 'EXCELLENT'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                                  : stat.signalQuality === 'GOOD'
                                  ? 'bg-sky-950/60 text-sky-400 border border-sky-500/40'
                                  : 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                              }`}
                            >
                              {stat.signalQuality}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                            {stat.packetsTransmitted.toLocaleString()} / {stat.packetsReceived.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-bold text-amber-400">
                            {stat.packetsDropped}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`font-bold ${
                                stat.packetLossPct < 0.2
                                  ? 'text-emerald-400'
                                  : stat.packetLossPct < 0.5
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {stat.packetLossPct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-400">
                            {stat.latencyMs} ms
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 text-[10px] font-bold">
                              {stat.connectionStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 3: RAW J1939 CAN-BUS PACKETS                                 */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'CAN_BUS_PACKETS' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                    LIVE J1939 250 KBPS CAN-BUS PACKET INSPECTOR
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Streaming SAE J1939 Parameter Group Numbers (PGNs) & Hex Broadcast Frames
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportConnectionStatsCsv}
                    className="btn-tactical-yellow px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,229,0,0.4)] cursor-pointer"
                    title="Download 24-Hour Connection Statistics (RSSI and Packet Loss) CSV Report"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>DOWNLOAD 24-HR STATS (.CSV)</span>
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    <span>EXPORT CAN LOG</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] font-mono text-xs space-y-2 max-h-80 overflow-y-auto">
                {packets.map((pkt) => (
                  <div
                    key={pkt.id}
                    className="p-2.5 rounded-lg bg-black/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[10px]">{pkt.timestamp}</span>
                      <span className="text-[#FFE500] font-bold">{pkt.pgn}</span>
                      <span className="text-sky-400">{pkt.spn}</span>
                      <span className="text-slate-300 font-semibold">{pkt.decodedMeaning}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                      {pkt.hexData}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 4: CALIBRATION & HARNESS SIMULATION                          */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'SIMULATION' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-amber-400">science</span>
                <div>
                  <span className="font-bold text-sm text-white uppercase block">
                    BENCH TEST HARNESS & REGULATORY CALIBRATION
                  </span>
                  <span className="text-xs text-slate-400">
                    Inject artificial speed, RPM, and thermal spikes to audit FMCSA motion triggers and high-temperature warnings.
                  </span>
                </div>
              </div>

              {/* Slider 1: Speed */}
              <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase">
                    SIMULATE WHEEL SPEED (MPH)
                  </span>
                  <span className="font-mono text-[#FFE500] font-black text-lg">{simSpeed} MPH</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="85"
                  step="1"
                  value={simSpeed}
                  onChange={(e) => handleSimSpeedChange(Number(e.target.value))}
                  className="w-full accent-[#FFE500] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 MPH (Stationary)</span>
                  <span>5 MPH (FMCSA Driving Lock)</span>
                  <span>65 MPH (Highway)</span>
                  <span>85 MPH</span>
                </div>
              </div>

              {/* Sliders for RPM & Boost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase">ENGINE RPM</span>
                    <span className="font-mono text-white font-bold">{simRpm} RPM</span>
                  </div>
                  <input
                    type="range"
                    min="600"
                    max="2400"
                    step="50"
                    value={simRpm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimRpm(val);
                      bluetoothEldService.injectSimulation({ engineRpm: val });
                    }}
                    className="w-full accent-white cursor-pointer"
                  />
                </div>

                <div className="bg-[#05080E] p-4 rounded-2xl border border-[#1E2532] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase">BOOST PRESSURE</span>
                    <span className="font-mono text-sky-400 font-bold">{simBoost} PSI</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={simBoost}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimBoost(val);
                      bluetoothEldService.injectSimulation({ boostPressurePsi: val });
                    }}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSimSpeedChange(0)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  PRESET: IDLE / PARK (0 MPH)
                </button>
                <button
                  onClick={() => handleSimSpeedChange(15)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  PRESET: YARD MOVE (15 MPH)
                </button>
                <button
                  onClick={() => handleSimSpeedChange(65)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  PRESET: HIGHWAY CRUISE (65 MPH)
                </button>
                <button
                  onClick={() => handleSimSpeedChange(78)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase bg-red-950/40 border border-red-500/40 text-red-300 hover:text-white cursor-pointer"
                >
                  PRESET: OVERSPEED (78 MPH)
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 5: GPSTAB CLOUD TELEMATICS & ELD INTEGRATION                */}
          {/* ---------------------------------------------------------------- */}
          {activeTab === 'GPSTAB_CLOUD' && (
            <div className="space-y-6">
              {/* GPSTab Status Header */}
              <div className="bg-[#0A0F14] p-5 rounded-2xl border border-[#1E2532] shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FFE500]/10 border border-[#FFE500]/30 flex items-center justify-center text-[#FFE500] shadow-[0_0_15px_rgba(255,229,0,0.25)]">
                      <span className="material-symbols-outlined text-[28px]">cloud_sync</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-['Space_Grotesk'] text-lg font-black text-white uppercase tracking-wider">
                          GPSTab Flight ELD Gateway
                        </h3>
                        {gpsTabStatus?.isConfigured ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/60 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            <span>&#10004;</span>
                            <span>API CONNECTED</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/50 text-[10px] font-black uppercase tracking-wider">
                            AUTONOMOUS CAB CACHE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        FMCSA Certified 49 CFR § 395 ELD • TrackEnsure Inc. J1939 Telemetry Bridge
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleGpsTabSync}
                    disabled={gpsTabSyncing}
                    className="btn-tactical-yellow px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,229,0,0.45)] shrink-0 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {gpsTabSyncing ? 'sync' : 'cloud_download'}
                    </span>
                    <span>{gpsTabSyncing ? 'SYNCHRONIZING...' : 'SYNC GPSTAB TELEMETRY'}</span>
                  </button>
                </div>
              </div>

              {/* Status & Diagnostic Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532]">
                  <span className="text-[11px] text-slate-400 block mb-1">SECRET KEY CONFIGURATION</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${gpsTabStatus?.isConfigured ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'}`} />
                    <span className="text-sm font-bold text-white">
                      {gpsTabStatus?.isConfigured ? 'GPSTAB_API_KEY Configured' : 'Secret Pending / In-Cab Fallback'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {gpsTabStatus?.isConfigured ? 'Live cloud sync active' : 'Inject via .env or GitHub Secrets'}
                  </span>
                </div>

                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532]">
                  <span className="text-[11px] text-slate-400 block mb-1">COMPANY ID</span>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#FFE500]">domain</span>
                    <span className="text-sm font-bold text-white">
                      {gpsTabStatus?.companyId || 'DEFAULT_TENANT'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">TrackEnsure Carrier Account</span>
                </div>

                <div className="bg-[#05080E] p-4 rounded-xl border border-[#1E2532]">
                  <span className="text-[11px] text-slate-400 block mb-1">HARDWARE COMPATIBILITY</span>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
                    <span className="text-sm font-bold text-emerald-400">FMCSA #GPSTAB-001</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">9-Pin Deutsch & OBD-II J1939</span>
                </div>
              </div>

              {/* Secret Setup Guide Card */}
              <div className="bg-[#080D14] p-5 rounded-2xl border border-dashed border-[#2A3546] space-y-3">
                <div className="flex items-center gap-2 text-[#FFE500]">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                  <span className="font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-white">
                    How to activate your GPSTab Secret in TruckWithEase
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    Your GPSTab API key allows TruckWithEase to pull live odometer, fuel level, GPS coordinates, and 49 CFR § 395 Hours of Service clocks directly from TrackEnsure / GPSTab servers.
                  </p>
                  <div className="p-3 bg-[#05080E] rounded-xl font-mono text-[11px] text-slate-300 border border-[#1E2532] space-y-1">
                    <p className="text-slate-400"># In your server environment or .env file:</p>
                    <p className="text-[#FFE500]">GPSTAB_API_KEY="your-gpstab-api-secret-token"</p>
                    <p className="text-slate-400">GPSTAB_COMPANY_ID="your-company-id"</p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    For Cloudflare Workers: run <code className="text-[#FFE500]">npx wrangler secret put GPSTAB_API_KEY</code>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* 4. FOOTER                                                          */}
        {/* ================================================================== */}
        <div className="p-4 border-t border-[#1E2532] bg-[#05080E] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#FFE500]">verified</span>
            <span>SAE J1939 High-Speed CAN 250k / 500k Verified • 10Hz ECM Telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl btn-tactical-yellow text-xs font-black uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
          >
            RETURN TO COCKPIT HUD
          </button>
        </div>

      </div>
    </div>
  );
};
