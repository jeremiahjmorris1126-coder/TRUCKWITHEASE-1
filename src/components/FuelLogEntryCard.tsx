import React, { useState, useEffect, useMemo } from 'react';
import { fuelLogService } from '../services/fuelLogService';
import { FuelLogEntry } from '../types';

interface FuelLogEntryCardProps {
  onShowToast: (msg: string, icon?: string) => void;
  className?: string;
}

export const FuelLogEntryCard: React.FC<FuelLogEntryCardProps> = ({ onShowToast, className = '' }) => {
  const [logs, setLogs] = useState<FuelLogEntry[]>([]);
  const [gallons, setGallons] = useState<number>(95);
  const [pricePerGallon, setPricePerGallon] = useState<number>(3.89);
  const [currentOdometer, setCurrentOdometer] = useState<number>(143840);
  const [previousOdometer, setPreviousOdometer] = useState<number>(143180);
  const [isEditingPrevOdo, setIsEditingPrevOdo] = useState<boolean>(false);
  const [stationName, setStationName] = useState<string>("Love's Travel Stop #402 (I-44 MM 184)");
  const [fuelType, setFuelType] = useState<'DIESEL' | 'DEF' | 'REEFER'>('DIESEL');
  const [showRecentLogs, setShowRecentLogs] = useState<boolean>(false);

  // Subscribe to fuel logs
  useEffect(() => {
    const unsubscribe = fuelLogService.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
      if (updatedLogs.length > 0) {
        const latest = updatedLogs[0];
        setPreviousOdometer(latest.currentOdometer);
        // Default current odometer to previous + standard single-shift distance (~650 miles)
        setCurrentOdometer((prev) => (prev <= latest.currentOdometer ? latest.currentOdometer + 660 : prev));
      }
    });
    return () => unsubscribe();
  }, []);

  // Calculate real-time MPG in real-time as driver types
  const metrics = useMemo(() => {
    return fuelLogService.calculateRealTimeMpg(gallons, pricePerGallon, currentOdometer, previousOdometer);
  }, [gallons, pricePerGallon, currentOdometer, previousOdometer]);

  const avgFleetMpg = useMemo(() => {
    return fuelLogService.getAverageFleetMpg();
  }, [logs]);

  const handleSaveFuelLog = (e: React.FormEvent) => {
    e.preventDefault();

    if (gallons <= 0) {
      onShowToast('PLEASE ENTER A VALID FUEL QUANTITY (GALLONS)', 'warning');
      return;
    }

    if (currentOdometer <= previousOdometer) {
      onShowToast('CURRENT ODOMETER MUST BE GREATER THAN PREVIOUS ODOMETER', 'warning');
      return;
    }

    try {
      const entry = fuelLogService.addFuelLog({
        gallons,
        pricePerGallon,
        currentOdometer,
        previousOdometer,
        fuelType,
        stationName,
        notes: `Driver Odo ${currentOdometer} mi // ${gallons} Gal // Calculated ${metrics.mpg} MPG`,
      });

      onShowToast(`FUEL LOGGED: ${entry.mpg} MPG • $${entry.totalCost.toFixed(2)} RECORDED`, 'local_gas_station');

      // Update baseline for next fill-up
      setPreviousOdometer(entry.currentOdometer);
      setCurrentOdometer(entry.currentOdometer + 650);
      setIsEditingPrevOdo(false);
    } catch (err) {
      onShowToast('FAILED TO RECORD FUEL LOG', 'error');
    }
  };

  const handlePresetGallons = (amount: number) => {
    setGallons(amount);
  };

  return (
    <div className={`bg-surface-container rounded-2xl border border-amber-500/40 shadow-2xl p-4 sm:p-5 font-mono space-y-4 ${className}`}>
      {/* CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[24px]">local_gas_station</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">
                COMMERCIAL FUEL LOG &amp; REAL-TIME MPG
              </h3>
              <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                1-STEP CALCULATION
              </span>
            </div>
            <p className="text-[10px] text-outline">
              Enter fuel quantity, price, and current odometer to instantly compute live fuel economy and sync to expense ledger.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low border border-surface-container-high text-[10px]">
            <span className="text-outline">Fleet Average:</span>
            <span className="text-emerald-400 font-bold">{avgFleetMpg} MPG</span>
          </div>
          <button
            type="button"
            onClick={() => setShowRecentLogs(!showRecentLogs)}
            className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-white border border-surface-container-highest text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">history</span>
            <span>{showRecentLogs ? 'Hide History' : `History (${logs.length})`}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: FORM INPUTS + SUMMARY CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: 3 INPUTS (QUANTITY, PRICE, ODOMETER) */}
        <form onSubmit={handleSaveFuelLog} className="lg:col-span-7 space-y-3.5">
          {/* 1. FUEL QUANTITY (GALLONS) */}
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">oil_barrel</span>
                <span>Fuel Quantity (Gallons)</span>
              </label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handlePresetGallons(50)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    gallons === 50
                      ? 'bg-amber-500 text-on-primary font-bold'
                      : 'bg-surface-container-high text-outline hover:text-white'
                  }`}
                >
                  50 Gal
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetGallons(95)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    gallons === 95
                      ? 'bg-amber-500 text-on-primary font-bold'
                      : 'bg-surface-container-high text-outline hover:text-white'
                  }`}
                >
                  95 Gal
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetGallons(120)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    gallons === 120
                      ? 'bg-amber-500 text-on-primary font-bold'
                      : 'bg-surface-container-high text-outline hover:text-white'
                  }`}
                >
                  120 Gal
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetGallons(150)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    gallons === 150
                      ? 'bg-amber-500 text-on-primary font-bold'
                      : 'bg-surface-container-high text-outline hover:text-white'
                  }`}
                >
                  150 Gal
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="400"
                  value={gallons || ''}
                  onChange={(e) => setGallons(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 100"
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-[14px] text-white font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-outline uppercase">
                  U.S. GAL
                </span>
              </div>

              {/* Fuel Grade Switcher */}
              <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-xl border border-surface-container-high text-[10px]">
                {(['DIESEL', 'DEF', 'REEFER'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFuelType(type)}
                    className={`px-2 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                      fuelType === type
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'text-outline hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. PRICE PER GALLON & TOTAL ESTIMATE */}
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">attach_money</span>
                <span>Fuel Price ($ / Gallon)</span>
              </label>
              <span className="text-[10px] text-outline">
                Total at Pump: <span className="text-white font-bold">${metrics.totalCost.toFixed(2)}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-outline text-[12px] font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.50"
                  max="10.00"
                  value={pricePerGallon || ''}
                  onChange={(e) => setPricePerGallon(parseFloat(e.target.value) || 0)}
                  placeholder="3.89"
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-7 pr-3 py-2 text-[14px] text-white font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-container-high text-[11px]">
                <span className="text-outline">Calculated Total:</span>
                <span className="text-[14px] font-bold text-emerald-400">${metrics.totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 3. CURRENT ODOMETER READING */}
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">speed</span>
                <span>Current Odometer Reading</span>
              </label>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-outline">Trip Leg:</span>
                <span className="text-sky-400 font-bold">
                  +{metrics.milesDriven > 0 ? metrics.milesDriven.toLocaleString() : 0} Miles
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="1"
                  min={previousOdometer}
                  value={currentOdometer || ''}
                  onChange={(e) => setCurrentOdometer(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 143840"
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-[14px] text-white font-bold focus:outline-none focus:border-amber-500"
                  required
                />
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-outline uppercase">
                  MILES
                </span>
              </div>

              {/* Quick +500 / +650 Odometer Increment Helpers */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentOdometer(previousOdometer + 550)}
                  className="px-2 py-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-surface-container-high text-[10px] font-bold text-outline hover:text-white cursor-pointer transition-all"
                  title="Set to Previous + 550 miles"
                >
                  +550 mi
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentOdometer(previousOdometer + 650)}
                  className="px-2 py-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-surface-container-high text-[10px] font-bold text-outline hover:text-white cursor-pointer transition-all"
                  title="Set to Previous + 650 miles"
                >
                  +650 mi
                </button>
              </div>
            </div>

            {/* Previous Odometer Info & Edit Option */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-outline">
              <div className="flex items-center gap-1.5">
                <span>Last Recorded Odometer:</span>
                {isEditingPrevOdo ? (
                  <input
                    type="number"
                    value={previousOdometer}
                    onChange={(e) => setPreviousOdometer(parseInt(e.target.value, 10) || 0)}
                    className="w-24 bg-black/60 border border-primary text-white px-1.5 py-0.5 rounded text-[10px] font-bold"
                  />
                ) : (
                  <span className="text-white font-bold">{previousOdometer.toLocaleString()} mi</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPrevOdo(!isEditingPrevOdo)}
                className="text-primary hover:underline cursor-pointer"
              >
                {isEditingPrevOdo ? 'Done' : 'Edit Previous'}
              </button>
            </div>
          </div>

          {/* STATION LOCATION PRESET (OPTIONAL QUICK SELECTION) */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-outline uppercase shrink-0">Station:</span>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-2 py-1 text-white text-[11px]"
              placeholder="e.g. Love's #402, Pilot #118, TA Express"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-on-primary font-bold text-[12px] uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Record Fuel Fill-Up &amp; Sync Ledger</span>
          </button>
        </form>

        {/* RIGHT COLUMN: SMALL SUMMARY CARD (REAL-TIME MPG & EFFICIENCY) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border-2 border-amber-500/60 shadow-xl space-y-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Summary Card Header */}
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">analytics</span>
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  REAL-TIME MPG SUMMARY
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                  metrics.ratingColor === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : metrics.ratingColor === 'amber'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : metrics.ratingColor === 'rose'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-surface-container-high text-outline'
                }`}
              >
                {metrics.ratingLabel}
              </span>
            </div>

            {/* HERO METRIC: CALCULATED REAL-TIME MPG */}
            <div className="text-center py-2 bg-surface-container-low/60 rounded-xl border border-surface-container-high">
              <span className="text-[9px] text-outline uppercase block font-bold tracking-wider">
                Calculated Fuel Economy
              </span>
              <div className="flex items-baseline justify-center gap-1.5 my-1">
                <span className="text-[36px] sm:text-[40px] font-extrabold text-white tracking-tight">
                  {metrics.mpg > 0 ? metrics.mpg.toFixed(2) : '--.--'}
                </span>
                <span className="text-[14px] font-bold text-amber-400">MPG</span>
              </div>
              <p className="text-[10px] text-outline px-3 leading-relaxed">
                {metrics.ratingAdvice}
              </p>
            </div>

            {/* 3 COMPACT SUB-METRICS */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container-high">
                <span className="text-outline uppercase block text-[8px]">Miles Driven</span>
                <span className="text-[13px] font-bold text-white block mt-0.5">
                  {metrics.milesDriven > 0 ? `${metrics.milesDriven.toLocaleString()} mi` : '0 mi'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container-high">
                <span className="text-outline uppercase block text-[8px]">Cost / Mile</span>
                <span className="text-[13px] font-bold text-emerald-400 block mt-0.5">
                  {metrics.costPerMile > 0 ? `$${metrics.costPerMile.toFixed(3)}` : '$0.00'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container-high">
                <span className="text-outline uppercase block text-[8px]">Total Cost</span>
                <span className="text-[13px] font-bold text-amber-400 block mt-0.5">
                  ${metrics.totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* FORMULA AUDIT BANNER */}
            <div className="p-2.5 rounded-xl bg-surface-container-low/80 border border-white/5 space-y-1 text-[9px] text-outline">
              <div className="flex items-center justify-between">
                <span>Calculation Formula:</span>
                <span className="font-mono text-white">Miles ÷ Gallons</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>{metrics.milesDriven} mi ÷ {gallons} gal =</span>
                <span className="text-amber-400 font-bold">{metrics.mpg.toFixed(2)} MPG</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span>Auto-Export Status:</span>
                <span className="text-emerald-400 font-bold">Auto-posts to IFTA &amp; Fleet Invoices</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT FUEL LOGS HISTORY ACCORDION */}
      {showRecentLogs && (
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2.5 animate-fade-in text-[11px]">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
            <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-400">history_edu</span>
              <span>Recent Fuel Log History &amp; Odometer Record</span>
            </span>
            <span className="text-[10px] text-outline">{logs.length} Entries Recorded</span>
          </div>

          <div className="divide-y divide-surface-container-high max-h-56 overflow-y-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{log.stationName || 'Commercial Fuel'}</span>
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-400">
                      {log.fuelType}
                    </span>
                    <span className="text-outline text-[10px]">{log.date}</span>
                  </div>
                  <div className="text-[10px] text-outline flex items-center gap-3">
                    <span>Odo: <strong className="text-white">{log.currentOdometer.toLocaleString()} mi</strong></span>
                    <span>Driven: <strong className="text-sky-300">+{log.milesDriven} mi</strong></span>
                    <span>Fuel: <strong className="text-white">{log.gallons} Gal @ ${log.pricePerGallon.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[14px] font-bold text-emerald-400 block">{log.mpg.toFixed(2)} MPG</span>
                    <span className="text-[9px] text-outline block">${log.totalCost.toFixed(2)} (${log.costPerMile}/mi)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fuelLogService.deleteFuelLog(log.id);
                      onShowToast('DELETED FUEL ENTRY', 'delete');
                    }}
                    className="text-outline hover:text-rose-400 p-1 rounded hover:bg-surface-container cursor-pointer transition-all"
                    title="Remove fuel log"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
