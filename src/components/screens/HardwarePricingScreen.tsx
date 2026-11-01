/**
 * TruckWithEase // Commercial Fleet Hardware & Telematics Pricing Page
 *
 * Designed from a high-converting, profit-driven telematics salesman perspective.
 * Features:
 * - Azuga, Geotab, and GPSTab (Highlighted as the #1 Best Bet / Highest ROI)
 * - Direct Site Purchase (pre-provisioned & marked up with 2-day cab shipping)
 *   vs White Glove Concierge Deployment (+ $199/truck high-margin service)
 * - High-margin accessories & add-ons (locking collars, Y-cables, AI dashcams)
 * - Interactive fleet volume & ROI payback calculator
 * - Side-by-side competitor comparison smackdown table
 * - Instant checkout / truck stop delivery picker modal & sales quote generator
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  HardwareProduct,
  HardwareAddon,
  HardwareOrder,
  HardwareVendorId,
  HardwareDeliveryMode,
  TabId,
} from '../../types';
import {
  hardwareShopService,
  FALLBACK_CATALOG,
  FALLBACK_ADDONS,
} from '../../services/hardwareShopService';

interface HardwarePricingScreenProps {
  onShowToast: (msg: string, icon?: string, variant?: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateToTab?: (tabId: TabId) => void;
}

export const HardwarePricingScreen: React.FC<HardwarePricingScreenProps> = ({
  onShowToast,
  onNavigateToTab,
}) => {
  // State
  const [catalog, setCatalog] = useState<HardwareProduct[]>(FALLBACK_CATALOG);
  const [addons, setAddons] = useState<HardwareAddon[]>(FALLBACK_ADDONS);
  const [selectedVendorId, setSelectedVendorId] = useState<HardwareVendorId>('gpstab');
  const [deliveryMode, setDeliveryMode] = useState<HardwareDeliveryMode>('DIRECT_SHIP');
  const [fleetQuantity, setFleetQuantity] = useState<number>(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(['addon-ycable', 'addon-lock']);
  const [pricingPlanType, setPricingPlanType] = useState<'UPFRONT' | 'LEASE_TO_OWN'>('UPFRONT');

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [isSalesCallModalOpen, setIsSalesCallModalOpen] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<HardwareOrder | null>(null);

  // Order Form State
  const [orderForm, setOrderForm] = useState({
    recipientName: 'Jeremiah J. Morris',
    phone: '+1 (312) 555-8821',
    destinationType: 'TRUCK_STOP' as 'TRUCK_STOP' | 'CARRIER_TERMINAL' | 'RESIDENTIAL',
    truckStopBrand: "Love's Travel Stop #412",
    shippingAddress: "Love's Travel Stop #412, 10200 I-20 W",
    city: 'Weatherford',
    state: 'TX',
    zip: '76087',
    vin: '1FUJA6CK8GL981042',
    usdot: '3948210',
    connectorType: '9-Pin Deutsch Green (J1939)',
    makeModelYear: '2023 Freightliner Cascadia 126',
    paymentMethod: 'CORPORATE_ACH' as 'CORPORATE_ACH' | 'CREDIT_CARD' | 'FINANCE_ZERO_DOWN' | 'COMMDATA_EFS',
  });

  // Quote Form State
  const [quoteForm, setQuoteForm] = useState({
    companyName: 'Morris Hive Freight Logistics LLC',
    contactName: 'Jeremiah J. Morris',
    email: 'jeremiah.morris@morrishive.com',
    phone: '+1 (312) 555-8821',
    fleetSize: 5,
    notes: 'Need pre-flashed GPSTab units with 9-pin Y-cables for immediate I-20 deployment.',
  });

  // Sales Call State
  const [callbackPhone, setCallbackPhone] = useState('+1 (312) 555-8821');
  const [callTopic, setCallTopic] = useState('GPSTab Fleet Volume Pricing & White Glove Guarantee');

  // Load catalog data from backend on mount
  useEffect(() => {
    let isMounted = true;
    hardwareShopService.getCatalog().then((res) => {
      if (isMounted && res.catalog?.length) {
        setCatalog(res.catalog);
        setAddons(res.addons || FALLBACK_ADDONS);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Selected Product
  const selectedProduct = useMemo(() => {
    return catalog.find((p) => p.id === selectedVendorId) || catalog[0];
  }, [catalog, selectedVendorId]);

  // Pricing Math Calculations
  const calculations = useMemo(() => {
    const qty = Math.max(1, fleetQuantity);
    let discountPercent = qty >= 10 ? 20 : qty >= 3 ? 10 : 0;

    const unitBasePrice =
      pricingPlanType === 'UPFRONT'
        ? selectedProduct.retailPriceUsd
        : selectedProduct.leaseToOwnMonthlyUsd;

    const hardwareSubtotal = unitBasePrice * qty;
    const discountUsd = (hardwareSubtotal * discountPercent) / 100;
    const discountedHardware = hardwareSubtotal - discountUsd;

    let whiteGloveFee = 0;
    if (deliveryMode === 'WHITE_GLOVE') {
      whiteGloveFee = qty >= 5 ? 99 * qty : qty >= 2 ? 149 * qty : 199;
    }

    let addonsTotal = 0;
    for (const id of selectedAddonIds) {
      const a = addons.find((item) => item.id === id);
      if (a) {
        addonsTotal += a.retailPriceUsd * qty;
      }
    }

    const grandTotal = discountedHardware + whiteGloveFee + addonsTotal;
    const monthlySaas = selectedProduct.monthlySaasUsd * qty;

    // Wholesale markup margins (Salesman profit estimation)
    const wholesaleHardware = selectedProduct.wholesaleCostUsd * qty;
    const profitMarkupHardware =
      pricingPlanType === 'UPFRONT' ? discountedHardware - wholesaleHardware : discountedHardware * 0.45;
    const whiteGloveMargin = whiteGloveFee * 0.7; // 70% gross margin on service
    const totalProfitMargin = profitMarkupHardware + whiteGloveMargin + addonsTotal * 0.6;

    // Projected Annual Fleet Savings vs Competitor Rip-off Contracts ($85/mo + $1,500 setup)
    const competitorAnnualPerTruck = 85 * 12 + 250; // ~$1,270/yr
    const tweAnnualPerTruck = selectedProduct.monthlySaasUsd * 12; // ~$336 - $504/yr
    const saasAnnualSavings = (competitorAnnualPerTruck - tweAnnualPerTruck) * qty;
    const finePreventionSavings = 1200 * Math.min(qty, 4); // Avoided DOT OOS citations
    const netAnnualSavings = saasAnnualSavings + finePreventionSavings;

    // Break-even Payback Days
    const paybackDays = Math.max(8, Math.round((grandTotal / (netAnnualSavings / 365)) || 14));

    return {
      qty,
      discountPercent,
      unitBasePrice,
      hardwareSubtotal,
      discountUsd,
      discountedHardware,
      whiteGloveFee,
      addonsTotal,
      grandTotal,
      monthlySaas,
      totalProfitMargin,
      netAnnualSavings,
      paybackDays,
    };
  }, [selectedProduct, fleetQuantity, pricingPlanType, deliveryMode, selectedAddonIds, addons]);

  // Addon Toggle Handler
  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  // Place Order Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await hardwareShopService.createOrder({
        vendorId: selectedVendorId,
        quantity: fleetQuantity,
        deliveryMode,
        selectedAddonIds,
        recipientName: orderForm.recipientName,
        shippingAddress: orderForm.shippingAddress,
        city: orderForm.city,
        state: orderForm.state,
        zip: orderForm.zip,
        phone: orderForm.phone,
        destinationType: orderForm.destinationType,
        truckStopBrand: orderForm.truckStopBrand,
        vin: orderForm.vin,
        usdot: orderForm.usdot,
        connectorType: orderForm.connectorType,
        makeModelYear: orderForm.makeModelYear,
        paymentMethod: orderForm.paymentMethod,
      });

      if (res.success && res.order) {
        setCompletedOrder(res.order);
        onShowToast(
          `ORDER CONFIRMED: ${res.order.orderNumber} // FEDEX #${res.order.shipping.trackingNumber}`,
          'local_shipping',
          'success'
        );
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to submit order', 'error', 'error');
    }
  };

  // Generate Quote Handler
  const handleGenerateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await hardwareShopService.generateQuote({
        companyName: quoteForm.companyName,
        contactName: quoteForm.contactName,
        email: quoteForm.email,
        phone: quoteForm.phone,
        fleetSize: quoteForm.fleetSize,
        preferredVendor: selectedVendorId,
        deliveryMode,
        notes: quoteForm.notes,
      });

      if (res.success && res.quote) {
        setIsQuoteModalOpen(false);
        onShowToast(
          `OFFICIAL SALES QUOTE #${res.quote.quoteId} GENERATED // 30-DAY PRICE LOCK`,
          'receipt_long',
          'success'
        );
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to generate quote', 'error', 'error');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-6 pb-24 text-white">
      {/* 1. URGENT SCARCITY TOP BANNER */}
      <div className="bg-gradient-to-r from-amber-500/20 via-[#FFE500]/25 to-amber-500/20 border border-[#FFE500]/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-[0_0_25px_rgba(255,229,0,0.2)]">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-[#FFE500] text-black font-black flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black text-[#FFE500] tracking-wider uppercase">
                Q4 FLEET HARDWARE INCENTIVE
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase">
                Free 2-Day Cab Dispatch
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Only <strong className="text-white">14 pre-provisioned GPSTab units</strong> remaining in today's 4:00 PM CT batch. Includes free truck stop express delivery &amp; $100 activation credit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedVendorId('gpstab');
              setIsOrderModalOpen(true);
            }}
            className="btn-tactical-yellow px-4 py-2 text-[11px] cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
            <span>CLAIM GPSTAB UNIT NOW</span>
          </button>
          <button
            onClick={() => setIsSalesCallModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-surface-container border border-white/20 text-slate-300 hover:text-white hover:border-[#FFE500] text-[11px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">phone_in_talk</span>
            <span>TALK TO SALES</span>
          </button>
        </div>
      </div>

      {/* 2. SALES HERO HEADLINE */}
      <div className="bg-[#05080E] border border-white/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFE500]/5 blur-3xl pointer-events-none rounded-full" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] text-[11px] font-black uppercase tracking-widest">
            <span className="material-symbols-outlined text-[15px]">verified</span>
            <span>FMCSA § 395.8 CERTIFIED HARDWARE // ZERO CONTRACT TRAPS</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
            Stop Getting Fleeced by <span className="text-[#FFE500]">3-Year Lock-In Contracts</span>. Own Your Hardware.
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-body">
            Legacy providers lock you into $85/month 36-month contracts with $2,000 termination penalties. 
            With <strong className="text-white">TruckWithEase</strong>, buy turnkey hardware marked up fairly with zero handcuffs. 
            Choose our <span className="text-[#FFE500] font-bold">#1 Top Pick GPSTab</span>, enterprise <strong className="text-white">Geotab</strong>, or safety-focused <strong className="text-white">Azuga</strong>. 
            We flash your custom firmware, match your VIN, and express ship directly to your cab or terminal.
          </p>

          {/* Quick Value Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
            <div className="p-2.5 rounded-xl bg-[#0A0F14] border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Install Time</div>
              <div className="text-base font-black text-emerald-400">90 Seconds</div>
              <div className="text-[9px] text-slate-500">Plug &amp; Drive J1939</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0A0F14] border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Contract Term</div>
              <div className="text-base font-black text-[#FFE500]">0 Months</div>
              <div className="text-[9px] text-slate-500">Cancel Anytime Freedom</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0A0F14] border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">DOT Audit Record</div>
              <div className="text-base font-black text-emerald-400">100% Pass</div>
              <div className="text-[9px] text-slate-500">49 CFR § 395 Compliant</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0A0F14] border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Avg Annual Savings</div>
              <div className="text-base font-black text-[#FFE500]">${calculations.netAnnualSavings.toLocaleString()}</div>
              <div className="text-[9px] text-slate-500">Per Fleet Deployment</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HARDWARE CARD DECK (GPSTab, Geotab, Azuga) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFE500]">router</span>
              <span>Select Telematics Hardware Platform</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              All units are pre-provisioned, VIN-matched, and tested on J1939 250 kbps ECM test harnesses prior to shipping.
            </p>
          </div>

          {/* Pricing Toggle: Upfront Purchase vs Lease-to-Own */}
          <div className="flex items-center gap-1 bg-[#05080E] p-1 rounded-xl border border-white/10 text-[10px] font-black">
            <button
              onClick={() => setPricingPlanType('UPFRONT')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition uppercase ${
                pricingPlanType === 'UPFRONT'
                  ? 'bg-[#FFE500] text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              UPFRONT PURCHASE (BEST MARGIN)
            </button>
            <button
              onClick={() => setPricingPlanType('LEASE_TO_OWN')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition uppercase ${
                pricingPlanType === 'LEASE_TO_OWN'
                  ? 'bg-[#FFE500] text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LEASE-TO-OWN ($0 DOWN)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {catalog.map((product) => {
            const isSelected = selectedVendorId === product.id;
            const isGPSTab = product.id === 'gpstab';

            return (
              <div
                key={product.id}
                onClick={() => setSelectedVendorId(product.id)}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? isGPSTab
                      ? 'border-[#FFE500] bg-[#0A0F14] shadow-[0_0_30px_rgba(255,229,0,0.35)] ring-2 ring-[#FFE500]/50'
                      : 'border-[#FFE500] bg-[#0A0F14] shadow-[0_0_20px_rgba(255,229,0,0.2)]'
                    : 'border-white/10 bg-[#070B10] hover:border-white/25 hover:bg-[#0A0F14]'
                }`}
              >
                {/* Glow Accent for Best Bet */}
                {isGPSTab && (
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FFE500]/15 blur-2xl rounded-full pointer-events-none" />
                )}

                <div>
                  {/* Top Header Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        isGPSTab
                          ? 'bg-[#FFE500] text-black font-black shadow-md'
                          : 'bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      {product.badge}
                    </span>

                    {/* Radio Select Check */}
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-[#FFE500] border-[#FFE500] text-black'
                          : 'border-white/30 text-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px] font-black">check</span>
                    </div>
                  </div>

                  <h3 className="text-base font-black uppercase text-white tracking-wide">
                    {product.name}
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.vendorName}</div>

                  {/* Pricing Display */}
                  <div className="my-4 p-3 rounded-xl bg-[#05080E] border border-white/10">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">
                          {pricingPlanType === 'UPFRONT' ? 'Hardware One-Time' : 'Monthly Lease-to-Own'}
                        </span>
                        <div className="text-2xl font-black text-[#FFE500] font-mono">
                          ${pricingPlanType === 'UPFRONT' ? product.retailPriceUsd : product.leaseToOwnMonthlyUsd}
                          <span className="text-xs text-slate-400 font-normal">
                            {pricingPlanType === 'UPFRONT' ? ' /unit' : ' /mo'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Telematics SaaS</span>
                        <div className="text-sm font-bold text-white font-mono">
                          ${product.monthlySaasUsd}
                          <span className="text-[10px] text-slate-400 font-normal"> /mo</span>
                        </div>
                      </div>
                    </div>

                    {/* Wholesale Markup Callout for Sales Angle */}
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[9px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        <span>Pre-Provisioned &amp; Ready</span>
                      </span>
                      <span className="text-slate-400 font-mono">MSRP ${product.retailPriceUsd + 100}</span>
                    </div>
                  </div>

                  {/* Sales Pitch & Value Statement */}
                  <p className="text-[11px] text-slate-300 leading-relaxed italic mb-3">
                    "{product.salesPitch}"
                  </p>

                  {/* Bullet Highlights */}
                  <div className="space-y-1.5 text-[10px] text-slate-300">
                    {product.keyHighlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-emerald-400 shrink-0 mt-0.5">
                          done
                        </span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>

                  {/* Specs Pill List */}
                  <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 uppercase block">CAN-Bus:</span>
                      <span className="text-slate-200">{product.specs.canBus.split('&')[0]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">FMCSA ID:</span>
                      <span className="text-emerald-400 font-bold">{product.fmcsaCertificationId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">Cellular:</span>
                      <span className="text-slate-200">{product.specs.cellular.split(' ')[0]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">Warranty:</span>
                      <span className="text-slate-200 truncate">{product.specs.warranty.split(' ')[0]} Replace</span>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA Button */}
                <div className="mt-5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVendorId(product.id);
                      setIsOrderModalOpen(true);
                    }}
                    className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'btn-tactical-yellow'
                        : 'bg-surface-container hover:bg-surface-container-high border border-white/20 text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isSelected ? 'shopping_bag' : 'touch_app'}
                    </span>
                    <span>{isSelected ? `ORDER ${product.name.split(' ')[0]} NOW` : `SELECT ${product.name.split(' ')[0]}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. FULFILLMENT / DELIVERY MODEL SWITCHER (Direct Ship vs White Glove Concierge) */}
      <div className="bg-[#05080E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500]">local_shipping</span>
            <h3 className="text-base font-black uppercase tracking-wider text-white">
              Choose Deployment &amp; Fulfillment Experience
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Select between fast self-installation with pre-provisioned firmware or our premium zero-downtime White Glove Concierge.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option A: Direct Ship */}
          <div
            onClick={() => setDeliveryMode('DIRECT_SHIP')}
            className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              deliveryMode === 'DIRECT_SHIP'
                ? 'border-[#FFE500] bg-[#FFE500]/5 ring-1 ring-[#FFE500]'
                : 'border-white/10 bg-[#0A0F14] hover:border-white/25'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/10 text-slate-300 uppercase">
                  Option 1: Plug &amp; Play
                </span>
                <span className="text-xs font-black text-emerald-400 uppercase font-mono">FREE 2-DAY CAB SHIPPING</span>
              </div>

              <h4 className="text-sm font-black uppercase text-white">
                Direct Site Purchase &amp; Express Delivery
              </h4>
              <p className="text-[11px] text-slate-300 mt-1">
                We pre-flash your device with your truck VIN and carrier USDOT. Boxed and shipped express within 24 hours to your home, terminal, or any Love's/Pilot truck stop.
              </p>

              <div className="mt-3 space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">check</span>
                  <span>Pre-configured firmware matching your vehicle engine year</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">check</span>
                  <span>Heavy-duty travel shock case &amp; laminated cab card included</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">check</span>
                  <span>Self-install in under 5 minutes with our step-by-step video guide</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Concierge Setup Fee:</span>
              <span className="font-black text-emerald-400">$0.00 (INCLUDED)</span>
            </div>
          </div>

          {/* Option B: White Glove Deployment (The High-Ticket Upsell) */}
          <div
            onClick={() => setDeliveryMode('WHITE_GLOVE')}
            className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              deliveryMode === 'WHITE_GLOVE'
                ? 'border-[#FFE500] bg-[#FFE500]/10 ring-2 ring-[#FFE500] shadow-[0_0_25px_rgba(255,229,0,0.25)]'
                : 'border-white/10 bg-[#0A0F14] hover:border-white/25'
            }`}
          >
            <div className="absolute top-2 right-2">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[#FFE500] text-black uppercase tracking-wider">
                👑 VIP HIGH-TICKET UPSELL
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#FFE500]/20 text-[#FFE500] uppercase">
                  Option 2: 100% Turnkey
                </span>
              </div>

              <h4 className="text-sm font-black uppercase text-white">
                White Glove Concierge Deployment
              </h4>
              <p className="text-[11px] text-slate-300 mt-1">
                Zero finger lifting. Dedicated telematics field engineer assigned to your account. We handle FMCSA portal registration, CAN-bus baud calibration, and live video cab setup.
              </p>

              <div className="mt-3 space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-[#FFE500]">star</span>
                  <span className="text-white font-bold">Dedicated 1-on-1 Field Telematics Engineer</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">verified</span>
                  <span>FMCSA National Registry attestation &amp; DOT portal binding</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">shield</span>
                  <span className="text-emerald-400 font-bold">$2,500 Zero-Fine Roadside Guarantee</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">swap_horizontal_circle</span>
                  <span>VIP 12-Hour Priority Emergency Cab Unit Swap</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Concierge Setup Fee:</span>
              <span className="font-black text-[#FFE500] font-mono">
                +${calculations.whiteGloveFee > 0 ? calculations.whiteGloveFee : 199} (TOTAL)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. HIGH-MARGIN HARDWARE ADD-ONS & PROFIT BOOSTERS */}
      <div className="bg-[#05080E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFE500]">extension</span>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                Commercial Driver Cab Accessories &amp; Hardware Add-Ons
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Essential hardware accessories recommended by commercial mechanics and fleet safety managers.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            {selectedAddonIds.length} of {addons.length} SELECTED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {addons.map((addon) => {
            const isChecked = selectedAddonIds.includes(addon.id);
            return (
              <div
                key={addon.id}
                onClick={() => toggleAddon(addon.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isChecked
                    ? 'border-[#FFE500] bg-[#FFE500]/5 ring-1 ring-[#FFE500]/40'
                    : 'border-white/10 bg-[#0A0F14] hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                      {addon.category}
                    </span>
                    <span className="text-xs font-black text-[#FFE500] font-mono">
                      +${addon.retailPriceUsd}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-white uppercase">{addon.name}</div>
                  <p className="text-[10px] text-slate-300 mt-1 leading-snug">{addon.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[9px] text-emerald-400 italic">✔ {addon.salesHook}</span>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                      isChecked
                        ? 'bg-[#FFE500] border-[#FFE500] text-black font-black'
                        : 'border-white/30 text-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">check</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. INTERACTIVE FLEET VOLUME & ROI PROFIT CALCULATOR */}
      <div className="bg-[#05080E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFE500]">calculate</span>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                Fleet Volume &amp; Instant Cash-Flow ROI Calculator
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Calculate volume hardware discounts and projected 12-month net profit increase.
            </p>
          </div>

          {calculations.discountPercent > 0 && (
            <span className="text-[11px] font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase animate-pulse">
              🎉 {calculations.discountPercent}% FLEET VOLUME DISCOUNT APPLIED
            </span>
          )}
        </div>

        {/* Quantity Slider */}
        <div className="p-4 rounded-xl bg-[#0A0F14] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-300 font-mono">
              Fleet Size: <strong className="text-white text-base">{fleetQuantity} Trucks</strong>
            </span>
            <div className="flex items-center gap-2">
              {[1, 3, 5, 10, 25].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setFleetQuantity(preset)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    fleetQuantity === preset
                      ? 'bg-[#FFE500] text-black font-black'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {preset} {preset === 1 ? 'Cab' : 'Cabs'}
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={50}
            value={fleetQuantity}
            onChange={(e) => setFleetQuantity(parseInt(e.target.value) || 1)}
            className="w-full accent-[#FFE500] cursor-pointer"
          />

          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>1 Truck (Solo Op)</span>
            <span>3 Trucks (10% Off)</span>
            <span>10+ Trucks (20% Off)</span>
            <span>50 Trucks (Enterprise)</span>
          </div>
        </div>

        {/* Real-Time Price & ROI Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Order Summary Column */}
          <div className="p-4 rounded-xl bg-[#070B10] border border-white/10 space-y-2 text-xs">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider pb-1 border-b border-white/10">
              Live Order Configuration Summary
            </div>

            <div className="flex justify-between py-1 border-b border-white/5">
              <span className="text-slate-300">
                {selectedProduct.name} ({fleetQuantity}x)
              </span>
              <span className="font-mono font-bold text-white">
                ${calculations.hardwareSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {calculations.discountUsd > 0 && (
              <div className="flex justify-between py-1 border-b border-white/5 text-emerald-400">
                <span>Fleet Volume Discount ({calculations.discountPercent}%)</span>
                <span className="font-mono font-bold">
                  -${calculations.discountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {calculations.whiteGloveFee > 0 && (
              <div className="flex justify-between py-1 border-b border-white/5 text-[#FFE500]">
                <span>White Glove Deployment Concierge</span>
                <span className="font-mono font-bold">
                  +${calculations.whiteGloveFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {calculations.addonsTotal > 0 && (
              <div className="flex justify-between py-1 border-b border-white/5 text-slate-300">
                <span>Hardware Accessories ({selectedAddonIds.length} items x {fleetQuantity})</span>
                <span className="font-mono font-bold">
                  +${calculations.addonsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-white/5 text-slate-400">
              <span>Standard 2-Day Priority Cab Shipping</span>
              <span className="font-mono font-bold text-emerald-400 uppercase">FREE</span>
            </div>

            <div className="pt-2 flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Grand Total Upfront</span>
                <span className="text-xl font-black text-[#FFE500] font-mono">
                  ${calculations.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Recurring Monthly SaaS</span>
                <span className="text-sm font-bold text-white font-mono">
                  ${calculations.monthlySaas.toLocaleString(undefined, { minimumFractionDigits: 2 })} /mo
                </span>
              </div>
            </div>
          </div>

          {/* Sales Profit / Fleet ROI Column */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0A0F14] to-[#121820] border border-white/10 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                  Your Net Fleet Profit Impact
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Payback: ~{calculations.paybackDays} Days
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Saved vs $85/mo Locked Contracts:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    +${((85 - selectedProduct.monthlySaasUsd) * 12 * fleetQuantity).toLocaleString()} /yr
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">DOT Roadside Out-of-Service Avoidance:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    +${(1200 * Math.min(fleetQuantity, 4)).toLocaleString()} /yr
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Fuel Waste Saved Throttling ECM Idle:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    +${(980 * fleetQuantity).toLocaleString()} /yr
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#05080E] border border-emerald-500/30 flex items-center justify-between">
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-mono">Projected Net Fleet Savings</div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  +${calculations.netAnnualSavings.toLocaleString()} /year
                </div>
              </div>

              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="btn-tactical-yellow px-3.5 py-2 text-[10px] cursor-pointer flex items-center gap-1"
              >
                <span>LOCK IN SAVINGS</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. COMPETITOR SMACKDOWN MATRIX (GPSTab vs Geotab vs Azuga vs Legacy Fleecers) */}
      <div className="bg-[#05080E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFE500]">compare_arrows</span>
            <h3 className="text-base font-black uppercase tracking-wider text-white">
              Why We Win: Telematics Provider Smackdown
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Compare our pre-provisioned hardware options directly against 36-month lock-in legacy competitors.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0A0F14] text-[10px] font-mono uppercase text-slate-400">
                <th className="py-2.5 px-3">Feature / Guarantee</th>
                <th className="py-2.5 px-3 text-[#FFE500] font-black bg-[#FFE500]/10 border-x border-[#FFE500]/30">
                  GPSTab (Best Bet)
                </th>
                <th className="py-2.5 px-3">Geotab GO9+</th>
                <th className="py-2.5 px-3">Azuga Safety</th>
                <th className="py-2.5 px-3 text-red-400">Motive / Samsara</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">Contract Lock-In</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400 bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  0 Months (Cancel Anytime)
                </td>
                <td className="py-2.5 px-3">0 Months with TWE</td>
                <td className="py-2.5 px-3">0 Months with TWE</td>
                <td className="py-2.5 px-3 text-red-400 font-bold">36 Months Mandatory</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">Hardware Ownership</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400 bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  You Own It 100%
                </td>
                <td className="py-2.5 px-3">You Own It 100%</td>
                <td className="py-2.5 px-3">You Own It 100%</td>
                <td className="py-2.5 px-3 text-red-400">Lease Handcuffs Forever</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">Installation Speed</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400 bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  90 Seconds Plug &amp; Drive
                </td>
                <td className="py-2.5 px-3">3 Minutes</td>
                <td className="py-2.5 px-3">2 Minutes</td>
                <td className="py-2.5 px-3 text-red-400">2-4 Hours Shop Wait</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">TruckWithEase Night HUD Sync</td>
                <td className="py-2.5 px-3 font-bold text-[#FFE500] bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  Native 10Hz Bluetooth 5.2
                </td>
                <td className="py-2.5 px-3">10Hz CAN-Bus Stream</td>
                <td className="py-2.5 px-3">Cloud API Feed</td>
                <td className="py-2.5 px-3 text-red-400">Unsupported / Proprietary</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">Roadside Audit Guarantee</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400 bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  $2,500 Zero-Fine Promise
                </td>
                <td className="py-2.5 px-3">FMCSA § 395 Verified</td>
                <td className="py-2.5 px-3">FMCSA § 395 Verified</td>
                <td className="py-2.5 px-3 text-red-400">Zero Fine Protection</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-white">Monthly SaaS Pricing</td>
                <td className="py-2.5 px-3 font-bold text-[#FFE500] bg-[#FFE500]/5 border-x border-[#FFE500]/20">
                  $28.00 / month
                </td>
                <td className="py-2.5 px-3">$42.00 / month</td>
                <td className="py-2.5 px-3">$35.00 / month</td>
                <td className="py-2.5 px-3 text-red-400 font-bold">$75 - $95 / month</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. MASTER ACTION TRIGGER BAR */}
      <div className="bg-[#05080E] border-2 border-[#FFE500] rounded-2xl p-6 shadow-[0_0_35px_rgba(255,229,0,0.3)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black uppercase text-white">
              Ready to Equip <span className="text-[#FFE500]">{fleetQuantity} {fleetQuantity === 1 ? 'Power Unit' : 'Power Units'}</span> with {selectedProduct.name.split(' ')[0]}?
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Total Investment: <strong className="text-[#FFE500] text-sm">${calculations.grandTotal.toLocaleString()}</strong> upfront &bull; ${calculations.monthlySaas}/mo &bull; Free 2-Day Cab Express Shipping
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsQuoteModalOpen(true)}
            className="px-4 py-3 rounded-xl bg-surface-container border border-white/20 text-slate-300 hover:text-white hover:border-[#FFE500] text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>GET OFFICIAL PDF QUOTE</span>
          </button>

          <button
            onClick={() => setIsSalesCallModalOpen(true)}
            className="px-4 py-3 rounded-xl bg-surface-container border border-white/20 text-slate-300 hover:text-white hover:border-[#FFE500] text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            <span>TALK TO A SALES SPECIALIST</span>
          </button>

          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="btn-tactical-yellow px-6 py-3 text-xs font-black cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
            <span>PROCEED TO EXPRESS CHECKOUT</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EXPRESS ORDER & DISPATCH CHECKOUT                               */}
      {/* ========================================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#05080E] border border-[#FFE500]/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-[0_0_50px_rgba(255,229,0,0.3)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500]">shopping_cart</span>
                <h3 className="text-base font-black uppercase text-white">
                  Express Hardware Order &amp; Pre-Provisioning Dispatch
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOrderModalOpen(false);
                  setCompletedOrder(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {completedOrder ? (
              /* ORDER CONFIRMATION VIEW */
              <div className="space-y-4 py-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[36px]">check_circle</span>
                </div>

                <div>
                  <h4 className="text-xl font-black text-white uppercase">Order Confirmed &amp; Dispatched!</h4>
                  <p className="text-xs text-slate-300 font-mono mt-1">
                    Order ID: <strong className="text-[#FFE500]">{completedOrder.orderNumber}</strong> &bull; FedEx Express: <strong className="text-emerald-400">#{completedOrder.shipping.trackingNumber}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#0A0F14] border border-white/10 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="text-white font-bold">{completedOrder.shipping.shippingAddress} ({completedOrder.shipping.city}, {completedOrder.shipping.state})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hardware Unit:</span>
                    <span className="text-[#FFE500] font-bold">{completedOrder.vendorName} ({completedOrder.quantity}x)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivery Model:</span>
                    <span className="text-white font-bold">{completedOrder.deliveryMode === 'WHITE_GLOVE' ? '👑 White Glove Concierge' : '⚡ Plug & Play Pre-Provisioned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Truck VIN:</span>
                    <span className="font-mono text-emerald-400">{completedOrder.truckDetails.vin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grand Total Charged:</span>
                    <span className="text-[#FFE500] font-bold font-mono">${completedOrder.grandTotalUsd.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cryptographic Merkle Seal:</span>
                    <span className="font-mono text-[9px] text-slate-500 truncate max-w-[200px]">{completedOrder.merkleSeal}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsOrderModalOpen(false);
                      setCompletedOrder(null);
                      if (onNavigateToTab) onNavigateToTab('night-hud');
                    }}
                    className="btn-tactical-yellow px-5 py-2.5 text-xs cursor-pointer"
                  >
                    RETURN TO NIGHT HUD
                  </button>
                </div>
              </div>
            ) : (
              /* ORDER SUBMISSION FORM */
              <form onSubmit={handlePlaceOrder} className="space-y-4">
                {/* Config Summary Pill */}
                <div className="p-3 rounded-xl bg-[#0A0F14] border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Selected Unit:</span>
                    <span className="text-white font-bold">{selectedProduct.name} ({fleetQuantity}x)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Fulfillment:</span>
                    <span className="text-[#FFE500] font-bold">{deliveryMode === 'WHITE_GLOVE' ? 'White Glove Concierge' : 'Direct Pre-Provisioned'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Order Total:</span>
                    <span className="text-[#FFE500] font-black font-mono">${calculations.grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Delivery Location Type Picker */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Select Delivery Destination Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'TRUCK_STOP', label: "Love's / Pilot / TA", icon: 'local_gas_station' },
                      { id: 'CARRIER_TERMINAL', label: 'Fleet Terminal / Yard', icon: 'warehouse' },
                      { id: 'RESIDENTIAL', label: 'Driver Residence', icon: 'home' },
                    ].map((dest) => (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => setOrderForm({ ...orderForm, destinationType: dest.id as any })}
                        className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          orderForm.destinationType === dest.id
                            ? 'border-[#FFE500] bg-[#FFE500]/10 text-white'
                            : 'border-white/10 bg-[#0A0F14] text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">{dest.icon}</span>
                        <span>{dest.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shipping Form Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Recipient Driver / Fleet Manager Name
                    </label>
                    <input
                      type="text"
                      required
                      value={orderForm.recipientName}
                      onChange={(e) => setOrderForm({ ...orderForm, recipientName: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      Contact Mobile Phone (For FedEx SMS Updates)
                    </label>
                    <input
                      type="text"
                      required
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                      {orderForm.destinationType === 'TRUCK_STOP'
                        ? 'Truck Stop Name & Location Address (Along Your Route)'
                        : 'Street Shipping Address'}
                    </label>
                    <input
                      type="text"
                      required
                      value={orderForm.shippingAddress}
                      onChange={(e) => setOrderForm({ ...orderForm, shippingAddress: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={orderForm.city}
                      onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                      className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={orderForm.state}
                        onChange={(e) => setOrderForm({ ...orderForm, state: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">ZIP</label>
                      <input
                        type="text"
                        required
                        value={orderForm.zip}
                        onChange={(e) => setOrderForm({ ...orderForm, zip: e.target.value })}
                        className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Pre-Provisioning Truck Specifications */}
                <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-white/10 space-y-3">
                  <div className="text-[10px] text-[#FFE500] uppercase font-black tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">settings_input_composite</span>
                    <span>Pre-Provisioning Engine Calibration Profile</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Truck VIN</label>
                      <input
                        type="text"
                        value={orderForm.vin}
                        onChange={(e) => setOrderForm({ ...orderForm, vin: e.target.value })}
                        className="w-full p-2 rounded bg-[#05080E] border border-white/20 text-white font-mono text-xs focus:border-[#FFE500] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Carrier USDOT #</label>
                      <input
                        type="text"
                        value={orderForm.usdot}
                        onChange={(e) => setOrderForm({ ...orderForm, usdot: e.target.value })}
                        className="w-full p-2 rounded bg-[#05080E] border border-white/20 text-white font-mono text-xs focus:border-[#FFE500] outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Vehicle Diagnostic Port</label>
                      <select
                        value={orderForm.connectorType}
                        onChange={(e) => setOrderForm({ ...orderForm, connectorType: e.target.value })}
                        className="w-full p-2 rounded bg-[#05080E] border border-white/20 text-white text-xs focus:border-[#FFE500] outline-none"
                      >
                        <option value="9-Pin Deutsch Green (J1939)">9-Pin Deutsch Green (Type II 250k/500k)</option>
                        <option value="6-Pin Deutsch Black">6-Pin Deutsch Black (Legacy Heavy)</option>
                        <option value="16-Pin OBD-II">16-Pin OBD-II (Medium Duty / Sprinter)</option>
                        <option value="Universal Flying Lead">Universal Flying Lead Open Wire</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Make / Model / Year</label>
                      <input
                        type="text"
                        value={orderForm.makeModelYear}
                        onChange={(e) => setOrderForm({ ...orderForm, makeModelYear: e.target.value })}
                        className="w-full p-2 rounded bg-[#05080E] border border-white/20 text-white text-xs focus:border-[#FFE500] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Select Commercial Payment Authorization
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold">
                    {[
                      { id: 'CORPORATE_ACH', label: 'Corporate ACH' },
                      { id: 'CREDIT_CARD', label: 'Card / Fleet Card' },
                      { id: 'FINANCE_ZERO_DOWN', label: '$0 Down 90 Days' },
                      { id: 'COMMDATA_EFS', label: 'Comdata / EFS' },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setOrderForm({ ...orderForm, paymentMethod: pm.id as any })}
                        className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                          orderForm.paymentMethod === pm.id
                            ? 'border-[#FFE500] bg-[#FFE500] text-black font-black'
                            : 'border-white/10 bg-[#0A0F14] text-slate-300 hover:text-white'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Order Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full btn-tactical-yellow py-3.5 text-xs font-black cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    <span>AUTHORIZE &amp; DISPATCH HARDWARE (${calculations.grandTotal.toLocaleString()})</span>
                  </button>
                  <p className="text-[9px] text-center text-slate-400 mt-2 font-mono">
                    Protected by 256-bit cryptographic Merkle hashing &bull; 30-Day Money-Back Guarantee
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FORMAL SALES QUOTE GENERATOR (PDF / INVOICE)                     */}
      {/* ========================================================================= */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#05080E] border border-white/20 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500]">description</span>
                <h3 className="text-base font-black uppercase text-white">Generate Formal Carrier Quote</h3>
              </div>
              <button onClick={() => setIsQuoteModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleGenerateQuote} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Company / Carrier Name</label>
                <input
                  type="text"
                  required
                  value={quoteForm.companyName}
                  onChange={(e) => setQuoteForm({ ...quoteForm, companyName: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Contact Name</label>
                  <input
                    type="text"
                    required
                    value={quoteForm.contactName}
                    onChange={(e) => setQuoteForm({ ...quoteForm, contactName: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={quoteForm.email}
                    onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Special Logistics Notes / Delivery Corridor</label>
                <textarea
                  rows={2}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full btn-tactical-yellow py-3 text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>GENERATE 30-DAY PRICE LOCK QUOTE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TALK TO SALES SPECIALIST (JEREMIAH MORRIS)                       */}
      {/* ========================================================================= */}
      {isSalesCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#05080E] border border-[#FFE500]/50 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-[0_0_35px_rgba(255,229,0,0.25)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500]">support_agent</span>
                <h3 className="text-base font-black uppercase text-white">Commercial Fleet Telematics Hotline</h3>
              </div>
              <button onClick={() => setIsSalesCallModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-white/10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FFE500] text-black font-black flex items-center justify-center text-base">
                JM
              </div>
              <div>
                <div className="text-xs font-bold text-white">Jeremiah J. Morris</div>
                <div className="text-[10px] text-slate-400">VP of Commercial Hardware &amp; Telematics</div>
                <div className="text-[10px] text-[#FFE500] font-mono mt-0.5">Direct: +1 (312) 555-8821</div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Your Call-Back Phone Number</label>
                <input
                  type="text"
                  value={callbackPhone}
                  onChange={(e) => setCallbackPhone(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Discussion Topic</label>
                <input
                  type="text"
                  value={callTopic}
                  onChange={(e) => setCallTopic(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#0A0F14] border border-white/20 text-white focus:border-[#FFE500] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSalesCallModalOpen(false);
                    onShowToast(
                      `CALL SCHEDULED WITH JEREMIAH MORRIS // CONNECTING TO ${callbackPhone}`,
                      'phone_in_talk',
                      'success'
                    );
                  }}
                  className="w-full btn-tactical-yellow py-3 text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  <span>REQUEST INSTANT 5-MINUTE CALLBACK</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
