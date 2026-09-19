import React, { useState } from 'react';
import { fleetInvoicesService } from '../services/fleetInvoicesService';

interface OwnerOperatorQuickDeckProps {
  onShowToast: (msg: string, icon?: string) => void;
  onOpenPdfModal: () => void;
  onRecordInspectionLog?: (actionType: string, triggerSource: string, notes: string) => void;
  onNavigateToTab?: (tabId: string) => void;
  speed?: number;
}

export const OwnerOperatorQuickDeck: React.FC<OwnerOperatorQuickDeckProps> = ({
  onShowToast,
  onOpenPdfModal,
  onRecordInspectionLog,
  onNavigateToTab,
  speed = 64,
}) => {
  // Modal states for 1-tap actions
  const [activeModal, setActiveModal] = useState<
    'FUEL' | 'DISPATCH' | 'SCALE' | 'PARKING' | 'DVIR' | null
  >(null);

  // Quick Fuel State
  const [fuelGallons, setFuelGallons] = useState<number>(100);
  const [fuelPricePerGal, setFuelPricePerGal] = useState<number>(3.89);
  const [fuelLocation, setFuelLocation] = useState<string>("Love's Travel Stop #402 (I-44 MM 184)");
  const [fuelType, setFuelType] = useState<'DIESEL' | 'DEF' | 'SCALE' | 'MAINTENANCE'>('DIESEL');

  // Quick DVIR State
  const [dvirType, setDvirType] = useState<'PRE_TRIP' | 'POST_TRIP'>('PRE_TRIP');
  const [dvirNotes, setDvirNotes] = useState<string>('Pre-trip completed. All systems normal. No safety defects detected.');
  const [dvirSigned, setDvirSigned] = useState<boolean>(false);

  // Dispatch ETA Message
  const now = new Date();
  const etaHour = (now.getHours() + 1) % 24;
  const etaMinute = (now.getMinutes() + 20) % 60;
  const etaFormatted = `${etaHour.toString().padStart(2, '0')}:${etaMinute.toString().padStart(2, '0')} CDT`;

  const dispatchUpdateText = `[TRUCK #1042 UPDATE] En route I-44 E @ MM 184 // Speed: ${speed} MPH // Weather: Clear & Dry // ETA to Dock Door 14: ${etaFormatted} // Driver: Jonathan Vance // Status: ON TIME & COMPLIANT`;

  // 1-Tap Fuel Submission
  const handleLogFuelDirect = (gallons: number, pricePerGal: number, itemDesc: string, totalAmount: number) => {
    try {
      fleetInvoicesService.addInvoice({
        orderNumber: `FUEL-${Date.now().toString().slice(-6)}`,
        dateOrdered: new Date().toLocaleDateString('en-US') + ' at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'PAID',
        paymentMethod: 'Fleet One Comdata Fuel Card - XXXX9102',
        vendorName: fuelLocation,
        vendorAddress: 'I-44 Exit 184, Rolla, MO 65401',
        vendorPhone: '800-555-4921',
        vendorContactEmail: 'receipts@loves.com',
        category: 'FUEL_DIESEL',
        billToName: 'Jonathan Vance (Owner-Operator)',
        billToCompany: 'Vance Freight Logistics LLC',
        billToAddress: '1042 Highway Transport Way, St. Louis, MO 63101',
        shipToName: 'Truck #1042 Tractor (Freightliner Cascadia)',
        shipToCompany: 'Terminal Direct Refuel',
        shipToAddress: fuelLocation,
        shippingMethod: 'On-Site Terminal Pump',
        customerPhone: '312-555-0142',
        subtotal: totalAmount,
        shippingAndHandling: 0,
        estimatedTax: Math.round(totalAmount * 0.05 * 100) / 100,
        totalAmount: Math.round(totalAmount * 1.05 * 100) / 100,
        balanceDue: 0,
        taxDeductible: true,
        capturedViaCamera: true,
        notes: `1-Tap Driver Refuel // ${gallons} Gallons @ $${pricePerGal.toFixed(2)}/gal // ${itemDesc}`,
        items: [
          {
            itemNumber: 'DSL-ULTRA-01',
            description: itemDesc,
            qty: gallons,
            unitPrice: pricePerGal,
            estTax: Math.round(totalAmount * 0.05 * 100) / 100,
            total: totalAmount,
          },
        ],
      });

      onShowToast(`FUEL LOGGED: $${Math.round(totalAmount * 1.05)} RECORDED TO EXPENSE LEDGER`, 'receipt_long');
      setActiveModal(null);
    } catch (err) {
      onShowToast('Error saving fuel entry', 'error');
    }
  };

  // 1-Tap Dispatch Broadcast
  const handleSendDispatch = () => {
    navigator.clipboard?.writeText(dispatchUpdateText).catch(() => {});
    onShowToast('ETA PING COPIED & BROADCAST TO DISPATCH DOCK 14', 'send');
    setActiveModal(null);
  };

  // 1-Tap DVIR Sign
  const handleSignDvir = () => {
    const timestamp = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const logNotes = `DVIR ${dvirType} SIGNED // Unit #1042 + Trailer #5309 // 11 Critical Points Inspected (Brakes, Steering, Coupling, Tires, Lights, Suspension) // Result: DEFECT-FREE & SAFE // Signed by Jonathan Vance at ${timestamp}`;
    
    if (onRecordInspectionLog) {
      onRecordInspectionLog('DVIR_SIGNOFF', 'ONE_TAP_COCKPIT', logNotes);
    }
    
    setDvirSigned(true);
    onShowToast(`DVIR ${dvirType} CERTIFIED & ATTESTED TO VAULT`, 'verified');
    setTimeout(() => {
      setDvirSigned(false);
      setActiveModal(null);
    }, 900);
  };

  return (
    <div className="w-full bg-surface-container-low rounded-2xl border border-primary/40 shadow-2xl p-3 sm:p-4 space-y-3 font-mono">
      {/* HEADER WITH 1-TAP PROMISE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                OWNER-OPERATOR 1-TOUCH COMMAND DECK
              </span>
              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DIRECT EXECUTION
              </span>
            </div>
            <span className="text-[10px] text-outline block">
              Core truck actions with zero menus, zero setup, and pre-filled defaults
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-[10px] text-outline hidden md:inline">Current Status:</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-highest text-white border border-surface-container-high flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ALL SYSTEMS READY
          </span>
        </div>
      </div>

      {/* 6 ONE-TOUCH ACTION TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* TILE 1: ROADSIDE INSPECTION MODE */}
        <button
          onClick={onOpenPdfModal}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-primary/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="Open FMCSA 8-Day roadside officer inspection certificate with QR code"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 group-hover:bg-primary/25 border border-primary/30 flex items-center justify-center text-primary mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">policy</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-primary uppercase tracking-tight">
            Roadside Mode
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            Officer Slip & QR
          </span>
        </button>

        {/* TILE 2: 1-TAP FUEL & EXPENSE */}
        <button
          onClick={() => setActiveModal('FUEL')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-emerald-500/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="Quick log fuel gallons and expense receipts directly to ledger"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 group-hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">local_gas_station</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-emerald-400 uppercase tracking-tight">
            Log Fuel
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            1-Click Receipts
          </span>
        </button>

        {/* TILE 3: 1-TAP DISPATCH ETA */}
        <button
          onClick={() => setActiveModal('DISPATCH')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-sky-500/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="Broadcast GPS and arrival ETA to dispatch broker"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 group-hover:bg-sky-500/25 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">send</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-sky-400 uppercase tracking-tight">
            Ping Dispatch
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            Live ETA Broadcast
          </span>
        </button>

        {/* TILE 4: 1-TAP SCALE CHECK */}
        <button
          onClick={() => setActiveModal('SCALE')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-amber-500/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="Inspect next weigh station and bypass clearance"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">scale</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-amber-400 uppercase tracking-tight">
            Next Scale
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            Bypass & Rules
          </span>
        </button>

        {/* TILE 5: 1-TAP TRUCK PARKING */}
        <button
          onClick={() => setActiveModal('PARKING')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-purple-500/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="Find nearest safe truck rest stops and open parking spots"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 group-hover:bg-purple-500/25 border border-purple-500/30 flex items-center justify-center text-purple-300 mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">local_parking</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-purple-300 uppercase tracking-tight">
            Find Parking
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            Rest Spots Ahead
          </span>
        </button>

        {/* TILE 6: 1-TAP DVIR SIGN-OFF */}
        <button
          onClick={() => setActiveModal('DVIR')}
          className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-emerald-400/60 transition-all cursor-pointer text-center group shadow-md active:scale-95"
          title="1-click FMCSA Pre/Post trip vehicle inspection sign-off"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-400/15 group-hover:bg-emerald-400/25 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-1.5 transition-all">
            <span className="material-symbols-outlined text-[22px]">checklist</span>
          </div>
          <span className="text-[11px] font-bold text-white group-hover:text-emerald-400 uppercase tracking-tight">
            DVIR Sign-Off
          </span>
          <span className="text-[9px] text-outline group-hover:text-outline/90 mt-0.5">
            Pre / Post Trip
          </span>
        </button>
      </div>

      {/* =========================================================================
          1-TAP ACTION MODALS (SMART DEFAULTS, DIRECT EXECUTION)
         ========================================================================= */}

      {/* 1. QUICK FUEL & EXPENSE MODAL */}
      {activeModal === 'FUEL' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-emerald-500/60 shadow-2xl max-w-lg w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">local_gas_station</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white uppercase">1-Tap Fuel &amp; Expense Logger</h3>
                  <span className="text-[10px] text-outline">Direct ledger posting with 1-click presets</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg bg-surface-container-high text-outline hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              {/* Location Pre-fill */}
              <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between text-[11px]">
                <span className="text-outline">Station Location:</span>
                <span className="text-white font-bold truncate max-w-[260px]">{fuelLocation}</span>
              </div>

              {/* Instant 1-Click Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">1-Tap Fast Presets:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleLogFuelDirect(100, 3.89, '100 Gallons Ultra-Low Sulfur #2 Diesel', 389.0)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-emerald-500/20 border border-emerald-500/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">100 Gal Diesel</span>
                    <span className="text-[13px] font-bold text-emerald-400 block">$389.00</span>
                    <span className="text-[9px] text-outline block">$3.89/gal &bull; Comdata</span>
                  </button>

                  <button
                    onClick={() => handleLogFuelDirect(50, 3.89, '50 Gallons Ultra-Low Sulfur #2 Diesel', 194.5)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-emerald-500/20 border border-emerald-500/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">50 Gal Diesel</span>
                    <span className="text-[13px] font-bold text-emerald-400 block">$194.50</span>
                    <span className="text-[9px] text-outline block">$3.89/gal &bull; Comdata</span>
                  </button>

                  <button
                    onClick={() => handleLogFuelDirect(15, 3.50, '15 Gallons Bulk Diesel Exhaust Fluid (DEF)', 52.5)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-sky-500/20 border border-sky-500/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">15 Gal DEF</span>
                    <span className="text-[13px] font-bold text-sky-400 block">$52.50</span>
                    <span className="text-[9px] text-outline block">$3.50/gal &bull; BlueDEF</span>
                  </button>

                  <button
                    onClick={() => handleLogFuelDirect(1, 13.50, 'Certified CAT Scale Axle Weigh Slip', 13.5)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-amber-500/20 border border-amber-500/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">CAT Scale Weigh</span>
                    <span className="text-[13px] font-bold text-amber-400 block">$13.50</span>
                    <span className="text-[9px] text-outline block">Certified Scale Ticket</span>
                  </button>

                  <button
                    onClick={() => handleLogFuelDirect(1, 45.0, 'Tractor + 53ft Trailer Full Blue Beacon Wash', 45.0)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-purple-500/20 border border-purple-500/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">Truck Wash</span>
                    <span className="text-[13px] font-bold text-purple-300 block">$45.00</span>
                    <span className="text-[9px] text-outline block">Blue Beacon Fleet Wash</span>
                  </button>

                  <button
                    onClick={() => handleLogFuelDirect(1, 24.50, 'State Highway Commercial Toll Charge', 24.5)}
                    className="p-2.5 rounded-xl bg-surface-container-high hover:bg-primary/20 border border-primary/40 text-left cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span className="text-[11px] font-bold text-white block">Highway Toll</span>
                    <span className="text-[13px] font-bold text-primary block">$24.50</span>
                    <span className="text-[9px] text-outline block">PrePass / Bestpass</span>
                  </button>
                </div>
              </div>

              {/* Custom Entry Option */}
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                <span className="text-[10px] text-outline uppercase font-bold block">Or Enter Custom Gallons:</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-surface-container-high rounded-lg px-2.5 py-1.5 border border-surface-container-highest">
                    <span className="text-[11px] text-outline mr-2">Gallons:</span>
                    <input
                      type="number"
                      value={fuelGallons}
                      onChange={(e) => setFuelGallons(parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-white font-bold text-[13px] w-full outline-none"
                    />
                  </div>
                  <div className="flex-1 flex items-center bg-surface-container-high rounded-lg px-2.5 py-1.5 border border-surface-container-highest">
                    <span className="text-[11px] text-outline mr-2">$/Gal:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={fuelPricePerGal}
                      onChange={(e) => setFuelPricePerGal(parseFloat(e.target.value) || 0)}
                      className="bg-transparent text-white font-bold text-[13px] w-full outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-outline">Estimated Total:</span>
                  <span className="text-[14px] font-bold text-emerald-400">
                    ${(fuelGallons * fuelPricePerGal * 1.05).toFixed(2)} (incl. tax)
                  </span>
                </div>

                <button
                  onClick={() =>
                    handleLogFuelDirect(
                      fuelGallons,
                      fuelPricePerGal,
                      `${fuelGallons} Gallons Custom Refuel`,
                      fuelGallons * fuelPricePerGal
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-md transition-all"
                >
                  Save Custom Fuel Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DISPATCH & ETA BROADCAST MODAL */}
      {activeModal === 'DISPATCH' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-sky-500/60 shadow-2xl max-w-lg w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">schedule_send</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white uppercase">1-Tap Dispatch &amp; Broker Ping</h3>
                  <span className="text-[10px] text-outline">Pre-composed live telemetry status message</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg bg-surface-container-high text-outline hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline uppercase">Target Load:</span>
                  <span className="text-sky-400 font-bold">LOAD-8910-X (Medical Supplies)</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline uppercase">Receiver Dock:</span>
                  <span className="text-white font-bold">St. Louis Regional Hub &bull; Door 14</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline uppercase">Calculated Arrival:</span>
                  <span className="text-emerald-400 font-bold">{etaFormatted} (On Schedule)</span>
                </div>
              </div>

              {/* Message Preview */}
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1">
                <span className="text-[9px] text-outline uppercase block">Automated Message Text:</span>
                <p className="text-[11px] text-white leading-relaxed select-all bg-black/40 p-2 rounded-lg border border-white/5">
                  {dispatchUpdateText}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendDispatch}
                  className="flex-1 py-3 rounded-xl bg-sky-500 text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Broadcast &amp; Copy Text</span>
                </button>
                {onNavigateToTab && (
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      onNavigateToTab('trip-planner');
                    }}
                    className="px-3 py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-white text-[11px] font-bold uppercase transition-all cursor-pointer"
                  >
                    View Dispatch Hub
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SCALE & BYPASS MODAL */}
      {activeModal === 'SCALE' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-amber-500/60 shadow-2xl max-w-lg w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">scale</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white uppercase">Upcoming Scale &amp; Bypass Radar</h3>
                  <span className="text-[10px] text-outline">Real-time station status and scale limits</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg bg-surface-container-high text-outline hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    PREPASS / DRIVEWYZE: GREEN LIGHT
                  </span>
                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-emerald-500/30">
                    BYPASS GRANTED
                  </span>
                </div>
                <p className="text-[10px] text-emerald-300">
                  Pre-cleared through electronic WIM screening. Maintain lane speed and follow overhead signage.
                </p>
              </div>

              {/* Station Details */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-[11px]">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-1.5">
                  <span className="text-outline">Scale Station:</span>
                  <span className="text-white font-bold">Effingham Eastbound DOT Inspection Station</span>
                </div>
                <div className="flex items-center justify-between border-b border-surface-container-high pb-1.5">
                  <span className="text-outline">Distance:</span>
                  <span className="text-primary font-bold">18.4 Miles (Approx. 16 Mins @ 64 MPH)</span>
                </div>
                <div className="flex items-center justify-between border-b border-surface-container-high pb-1.5">
                  <span className="text-outline">State Limit:</span>
                  <span className="text-white font-bold">80,000 LBS GVW (+400 LBS Certified APU Credit)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-outline">Station Status:</span>
                  <span className="text-emerald-400 font-bold">OPEN &bull; RAMPS NORMAL FLOW</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onShowToast('SCALE BYPASS ACKNOWLEDGED // AUDIT VERIFIED', 'check_circle');
                  setActiveModal(null);
                }}
                className="w-full py-3 rounded-xl bg-amber-500 text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-md transition-all"
              >
                Acknowledge Scale Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SAFE HAVEN PARKING MODAL */}
      {activeModal === 'PARKING' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-purple-500/60 shadow-2xl max-w-lg w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">local_parking</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white uppercase">Upcoming Truck Rest &amp; Parking</h3>
                  <span className="text-[10px] text-outline">Real-time space availability along corridor</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg bg-surface-container-high text-outline hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              {/* Option 1 */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-white font-bold block">Love&apos;s Travel Stop #402</span>
                  <span className="text-outline text-[10px] block">I-44 MM 184 &bull; 14 Miles Ahead</span>
                  <span className="text-emerald-400 text-[10px] font-bold">42 Open Truck Spaces &bull; Showers, CAT Scale</span>
                </div>
                <button
                  onClick={() => {
                    onShowToast("WAYPOINT SET: LOVE'S #402 (14 MILES AHEAD)", 'navigation');
                    setActiveModal(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[10px] uppercase hover:brightness-110 cursor-pointer shrink-0"
                >
                  Set Waypoint
                </button>
              </div>

              {/* Option 2 */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-white font-bold block">Pilot Travel Center #118</span>
                  <span className="text-outline text-[10px] block">I-44 Exit 208 &bull; 28 Miles Ahead</span>
                  <span className="text-amber-300 text-[10px] font-bold">19 Open Truck Spaces &bull; DEF, Denny&apos;s Diner</span>
                </div>
                <button
                  onClick={() => {
                    onShowToast('WAYPOINT SET: PILOT #118 (28 MILES AHEAD)', 'navigation');
                    setActiveModal(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white font-bold text-[10px] uppercase cursor-pointer shrink-0"
                >
                  Set Waypoint
                </button>
              </div>

              {/* Option 3 */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-white font-bold block">Missouri DOT Eastbound Rest Area</span>
                  <span className="text-outline text-[10px] block">I-44 MP 221 &bull; 39 Miles Ahead</span>
                  <span className="text-emerald-400 text-[10px] font-bold">12 Open Truck Spaces &bull; 24h Vending, Security</span>
                </div>
                <button
                  onClick={() => {
                    onShowToast('WAYPOINT SET: STATE REST AREA (39 MILES AHEAD)', 'navigation');
                    setActiveModal(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white font-bold text-[10px] uppercase cursor-pointer shrink-0"
                >
                  Set Waypoint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 1-TAP DVIR PRE/POST TRIP SIGN-OFF MODAL */}
      {activeModal === 'DVIR' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-emerald-400/60 shadow-2xl max-w-lg w-full space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/20 text-emerald-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">checklist</span>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-white uppercase">1-Tap Vehicle DVIR Inspection</h3>
                  <span className="text-[10px] text-outline">FMCSA Title 49 § 396.11 Driver Vehicle Inspection</span>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-lg bg-surface-container-high text-outline hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-container-lowest border border-surface-container-high">
                <button
                  onClick={() => setDvirType('PRE_TRIP')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    dvirType === 'PRE_TRIP'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-outline hover:text-white'
                  }`}
                >
                  Pre-Trip Inspection
                </button>
                <button
                  onClick={() => setDvirType('POST_TRIP')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    dvirType === 'POST_TRIP'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-outline hover:text-white'
                  }`}
                >
                  Post-Trip Inspection
                </button>
              </div>

              {/* 11 Critical FMCSA Points Checked */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">11/11 Safety Items Inspected:</span>
                  <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    PASS &bull; NO DEFECTS
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-on-surface">
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Service Brakes &amp; Air Lines</div>
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Steering Mechanism</div>
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Coupling / 5th Wheel</div>
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Tires &amp; Wheels</div>
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Lights &amp; Reflectors</div>
                  <div className="flex items-center gap-1"><span className="text-emerald-400">✓</span> Horn &amp; Windshield Wipers</div>
                </div>
              </div>

              {/* Notes */}
              <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1">
                <span className="text-[9px] text-outline uppercase block">Attestation Note:</span>
                <input
                  type="text"
                  value={dvirNotes}
                  onChange={(e) => setDvirNotes(e.target.value)}
                  className="w-full bg-transparent text-white text-[11px] outline-none"
                />
              </div>

              {/* Direct Sign Button */}
              <button
                onClick={handleSignDvir}
                disabled={dvirSigned}
                className="w-full py-3 rounded-xl bg-emerald-500 text-on-primary font-bold text-[12px] uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{dvirSigned ? 'Signing to Vault...' : `Certify & Sign ${dvirType}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
