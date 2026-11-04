import React, { useState } from 'react';
import { TabId } from '../types';
import { ToastVariant } from './Toast';

interface LandingPageProps {
  onNavigateToTab: (tab: TabId) => void;
  onOpenDriverPortal?: (tab?: 'signin' | 'signup' | 'roster' | 'functions') => void;
  onShowToast: (message: string, icon?: string, variant?: ToastVariant) => void;
  speed?: number;
  activeDriverName?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateToTab,
  onOpenDriverPortal,
  onShowToast,
  speed = 65,
  activeDriverName = 'Jeremiah J. Morris',
}) => {
  // --- Interactive Clearance Simulator State ---
  const [simTruckHeightFt, setSimTruckHeightFt] = useState<number>(13.5); // 13' 6"
  const [selectedBridgeIndex, setSelectedBridgeIndex] = useState<number>(0);
  const [isBypassExecuted, setIsBypassExecuted] = useState<boolean>(false);

  const BRIDGE_PRESETS = [
    {
      name: 'South Main St. Railroad Trestle',
      highway: 'US-287 Southbound (Mile 184.2)',
      clearanceFt: 13.5, // 13' 6"
      display: '13\' 6"',
      bypassName: 'Loop 820 North Corridor',
    },
    {
      name: 'Historical Low Urban Viaduct',
      highway: 'Downtown Connector (Mile 12.4)',
      clearanceFt: 13.167, // 13' 2"
      display: '13\' 2"',
      bypassName: 'State Route 4 Outer Beltway',
    },
    {
      name: 'State Route 114 Overpass',
      highway: 'SR-114 Westbound (Mile 45.1)',
      clearanceFt: 14.0, // 14' 0"
      display: '14\' 0"',
      bypassName: 'Direct Highway Corridor',
    },
    {
      name: 'Interstate Standard High Span',
      highway: 'I-35 Northbound (Mile 210.8)',
      clearanceFt: 15.167, // 15' 2"
      display: '15\' 2"',
      bypassName: 'Primary Interstate Freight Lane',
    },
  ];

  const currentBridge = BRIDGE_PRESETS[selectedBridgeIndex];
  const rawDeltaInches = Math.round((currentBridge.clearanceFt - simTruckHeightFt) * 12);
  const isCriticalCollision = rawDeltaInches <= 0 && !isBypassExecuted;
  const isTightWarning = rawDeltaInches > 0 && rawDeltaInches <= 4 && !isBypassExecuted;

  // --- Interactive Dispatch Zero Calculator State ---
  const [calcGrossRevenue, setCalcGrossRevenue] = useState<number>(2321);
  const [calcLoadedMiles, setCalcLoadedMiles] = useState<number>(510);
  const [calcDetentionHours, setCalcDetentionHours] = useState<number>(1.5);
  const [calcLegalDutyHours, setCalcLegalDutyHours] = useState<number>(10.0);

  const calcEstimatedDriveHours = calcLoadedMiles / 55; // 55 mph commercial average
  const calcTotalHoursNeeded = calcEstimatedDriveHours + calcDetentionHours;
  const calcYieldRate = calcLegalDutyHours > 0 ? (calcGrossRevenue / calcLegalDutyHours).toFixed(2) : '0.00';
  const isLegalHourBreach = calcTotalHoursNeeded > calcLegalDutyHours;

  // --- Interactive Master Mechanic State ---
  const [selectedEngine, setSelectedEngine] = useState<'cummins' | 'detroit' | 'paccar'>('cummins');
  const [hitchArticulationAngle, setHitchArticulationAngle] = useState<number>(18);
  const isJackknifeDanger = Math.abs(hitchArticulationAngle) >= 48;
  const isHighArticulation = Math.abs(hitchArticulationAngle) >= 35 && !isJackknifeDanger;

  // --- Interactive ROI Calculator State ---
  const [roiTruckCount, setRoiTruckCount] = useState<number>(12);
  const [roiAvgMonthlyMiles, setRoiAvgMonthlyMiles] = useState<number>(9500);

  // ROI Math
  const annualAvoidedBridgeRisk = roiTruckCount >= 1 ? Math.round(150000 * 0.15) : 0; // Statistical insurance & repair buffer
  const annualFuelSavings = Math.round(roiTruckCount * (roiAvgMonthlyMiles / 6.5) * 0.08 * 3.85); // 8% idle reduction
  const annualHosFinesAvoided = roiTruckCount * 3500; // Average FMCSA DOT out-of-service penalty
  const annualDispatchZeroUplift = Math.round(roiTruckCount * 7800); // Average $/hr yield increase
  const totalAnnualBenefit = annualAvoidedBridgeRisk + annualFuelSavings + annualHosFinesAvoided + annualDispatchZeroUplift;
  const annualSoftwareInvestment = roiTruckCount * 59 * 12;
  const netRoiPercentage = Math.round(((totalAnnualBenefit - annualSoftwareInvestment) / annualSoftwareInvestment) * 100);

  // --- Hardware Shop Quick Configurator ---
  const [selectedHardware, setSelectedHardware] = useState<'gpstab' | 'geotab' | 'azuga'>('gpstab');
  const [hardwareDeliveryMode, setHardwareDeliveryMode] = useState<'DIRECT' | 'WHITE_GLOVE'>('WHITE_GLOVE');
  const [hardwareQuantity, setHardwareQuantity] = useState<number>(2);

  const hardwarePrices = {
    gpstab: { name: 'GPSTab Flight ELD Gateway', unitPrice: 299, monthly: 28, isBestBet: true },
    geotab: { name: 'Geotab GO9+ Telematics Gateway', unitPrice: 349, monthly: 38, isBestBet: false },
    azuga: { name: 'Azuga Fleet GPS Tracker', unitPrice: 269, monthly: 24, isBestBet: false },
  };

  const selectedHwInfo = hardwarePrices[selectedHardware];
  const whiteGloveFee = hardwareDeliveryMode === 'WHITE_GLOVE' ? 49 * hardwareQuantity : 0;
  const hwTotalUpfront = selectedHwInfo.unitPrice * hardwareQuantity + whiteGloveFee;

  // --- FAQ Accordion State ---
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // --- Contact / Lead Form State ---
  const [leadFormData, setLeadFormData] = useState({
    fullName: '',
    carrierName: '',
    usdotMc: '',
    fleetSize: '1-5 Trucks',
    phone: '',
    email: '',
    interest: 'Low-Bridge Radar 54B & Cockpit Suite',
  });
  const [leadSubmitted, setLeadSubmitted] = useState<boolean>(false);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadFormData.fullName || !leadFormData.email) {
      onShowToast('Please provide your name and email address', 'error', 'error');
      return;
    }
    setLeadSubmitted(true);
    onShowToast('DEMO REQUEST DISPATCHED // A FLEET SPECIALIST WILL REACH OUT WITHIN 15 MIN', 'verified', 'success');
  };

  const FAQS = [
    {
      q: 'Is TruckWithEase officially registered with the FMCSA for ELD compliance?',
      a: 'Yes. TruckWithEase fully conforms to 49 CFR § 395 Subpart B requirements for electronic logging devices. We support 1-tap electronic data transfer via FMCSA Web Services and secure encrypted email, complete with instant transmission receipt codes. When pulled over, our Roadside Officer Shield locks the screen to show only the mandatory 8-day records while keeping your private rates, notes, and messages completely protected.',
    },
    {
      q: 'How does the FHWA Item 54B Low-Bridge Radar calculate vertical clearances?',
      a: 'Our radar engine ingests the Federal Highway Administration (FHWA) Item 54B National Bridge Inventory database, cross-referencing over 618,000 bridges, tunnels, and railway trestles with your exact tractor-trailer physical height. When approaching a bridge with a clearance under 174 inches (14\' 6") or when your clearance delta drops below safe tolerances, the system triggers the critical ruby clearance alert and provides an immediate 1-tap dynamic bypass corridor.',
    },
    {
      q: 'Why is GPSTab designated as the "#1 Best Bet" for hardware?',
      a: 'Unlike legacy ELD vendors that trap carriers in restrictive 36-month non-cancellable contracts with exorbitant early termination fees, GPSTab offers pure month-to-month freedom. It installs in 5 minutes into standard 9-Pin Deutsch, 6-Pin, or OBD-II heavy duty diagnostic ports, features autonomous onboard flash memory that never loses records during cell dropouts, and integrates natively with our 10Hz Night HUD.',
    },
    {
      q: 'How does the Dispatch Zero ($/Hr Yield) architecture increase carrier take-home pay?',
      a: 'Traditional load boards rank loads by raw gross pay or $/mile, which deceives drivers into taking loads with 4-hour unpaid dock detention or routes that exhaust 11-hour driving clocks prematurely. Dispatch Zero calculates revenue divided by remaining legal duty hours ($/Hr). By maximizing your hourly yield, owner-operators consistently earn 18% to 26% more revenue per legal duty week.',
    },
    {
      q: 'What is the Zero-Shut-Down Backup Plan?',
      a: 'If a driver enters a cellular dead zone or experiences an unexpected mobile device glitch during a DOT roadside inspection, our Zero-Shut-Down protocol provides a locally cached, cryptographically attested offline audit dossier. This ensures you can immediately present compliant 8-day duty logs, DVIRs, and medical credentials to law enforcement, preventing illegal Out-of-Service orders.',
    },
    {
      q: 'Can I test the driver cockpit right now before buying anything?',
      a: 'Absolutely! You can click the "Launch Live Cockpit" button on this page right now. You\'ll enter the fully functional TruckWithEase in-cab HUD with simulated 65 MPH highway telematics, live radar sweeps, HOS clocks, and Master Mechanic diagnostics with zero credit card required.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#05080E] text-slate-100 font-['Space_Grotesk'] selection:bg-[#FFE500] selection:text-black">
      {/* =========================================================================
          TACTICAL STICKY NAVIGATION BAR
      ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#05080E]/95 backdrop-blur-md border-b border-[#1E2532] px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo.png"
              alt="TruckWithEase Logo"
              className="h-9 w-auto object-contain cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-white text-base sm:text-lg">
                  TRUCK<span className="text-[#FFE500]">WITH</span>EASE
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFE500]/15 text-[#FFE500] border border-[#FFE500]/30 uppercase">
                  ENTERPRISE
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider hidden sm:block">
                DRIVE SMART. STAY COMPLIANT. NEVER HIT A BRIDGE.
              </span>
            </div>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-6 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            <a href="#features" className="hover:text-[#FFE500] transition-colors">
              Features
            </a>
            <a href="#radar54b" className="hover:text-[#FFE500] transition-colors">
              Low-Bridge 54B
            </a>
            <a href="#mechanic" className="hover:text-[#FFE500] transition-colors">
              Master Mechanic
            </a>
            <a href="#dispatch-zero" className="hover:text-[#FFE500] transition-colors">
              Dispatch Zero
            </a>
            <a href="#hardware" className="hover:text-[#FFE500] transition-colors">
              Hardware Store
            </a>
            <a href="#pricing" className="hover:text-[#FFE500] transition-colors">
              Pricing
            </a>
            <a href="#roi-calculator" className="hover:text-[#FFE500] transition-colors">
              ROI
            </a>
            <a href="#faq" className="hover:text-[#FFE500] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {onOpenDriverPortal && (
              <button
                onClick={() => onOpenDriverPortal('signin')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-slate-300 hover:text-white bg-[#0F141C] border border-[#1E2532] hover:border-slate-500 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#FFE500]">person</span>
                Driver Sign-In
              </button>
            )}

            <button
              onClick={() => onNavigateToTab('night-hud')}
              className="btn-tactical-yellow px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>ENTER DRIVER COCKPIT</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION // THE OPERATING SYSTEM FOR COMMERCIAL CARRIERS
      ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-[#1E2532]">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#FFE500]/5 blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12">
            {/* Regulatory Kicker Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-6 shadow-[0_0_15px_rgba(255,229,0,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[#FFE500] animate-pulse" />
              <span>THE ALL-IN-ONE COMMERCIAL TRUCKING OPERATING SYSTEM</span>
              <span className="hidden sm:inline text-slate-500">•</span>
              <span className="hidden sm:inline text-emerald-400">FHWA 54B & FMCSA § 395 READY</span>
            </div>

            {/* Main Punchy Value Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-[1.08] mb-6">
              DRIVE WITH CONFIDENCE. <br />
              <span className="text-[#FFE500] drop-shadow-[0_0_30px_rgba(255,229,0,0.3)]">
                DISPATCH WITH PRECISION.
              </span>{' '}
              <br className="hidden sm:block" />
              NEVER HIT A BRIDGE.
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto mb-8">
              The unified cockpit and fleet operations intelligence suite built for commercial motor carriers,
              owner-operators, and safety directors. Real-time{' '}
              <span className="text-white font-semibold">FHWA Item 54B Low-Bridge Radar</span>,{' '}
              <span className="text-white font-semibold">J1939 CAN-Bus Master Mechanic diagnostics</span>,{' '}
              <span className="text-white font-semibold">Dispatch Zero legal duty hour yield</span>, and bulletproof{' '}
              <span className="text-white font-semibold">FMCSA zero-shut-down compliance</span>.
            </p>

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigateToTab('night-hud')}
                className="btn-tactical-yellow w-full sm:w-auto px-8 py-4 text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                <span>LAUNCH LIVE COCKPIT DEMO</span>
              </button>

              <button
                onClick={() => onNavigateToTab('hardware-pricing')}
                className="btn-secondary-tactical w-full sm:w-auto px-6 py-4 text-sm sm:text-base flex items-center justify-center gap-2.5 hover:bg-[#1E2532] hover:border-slate-400 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-[#FFE500]">shopping_cart</span>
                <span>ORDER GPSTAB ELD HARDWARE</span>
              </button>

              <a
                href="#roi-calculator"
                className="w-full sm:w-auto px-6 py-4 rounded-lg text-sm sm:text-base font-bold font-mono uppercase tracking-wider text-slate-300 hover:text-white bg-[#0A0F14] border border-[#1E2532] hover:border-slate-500 flex items-center justify-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-400">calculate</span>
                <span>CALCULATE FLEET ROI</span>
              </a>
            </div>

            {/* Quick Trust Highlights */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-8 text-xs font-mono text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>0 Bridge Strikes in 14.8M Miles</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-[#FFE500]">bolt</span>
                <span>10Hz CAN-Bus Diagnostics</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-purple-400">shield</span>
                <span>Roadside Officer Shield</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-blue-400">sync_alt</span>
                <span>No Contract Handcuffs</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              LIVE COCKPIT INTERACTIVE HERO SHOWCASE FRAME
          ========================================================================= */}
          <div className="mt-8 rounded-2xl bg-[#0A0F14] border-2 border-[#1E2532] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Cockpit Window Header */}
            <div className="bg-[#0F141C] px-4 py-3 border-b border-[#1E2532] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                  TRUCKWITHEASE HUD // ACTIVE CORRIDOR FEED: I-35 NORTHBOUND (MILE 182.4)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                  ● ECM 10HZ SYNCED
                </span>
                <button
                  onClick={() => onNavigateToTab('night-hud')}
                  className="px-2.5 py-1 rounded bg-[#FFE500] text-black font-mono text-[10px] font-black uppercase tracking-wider hover:bg-[#FFF033] cursor-pointer"
                >
                  FULLSCREEN HUD
                </button>
              </div>
            </div>

            {/* Inner Tactical Preview Grid */}
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#05080E]">
              {/* Left Column: Speedometer & Low-Bridge Alert Card */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Real-Time Speed & Corridor Weather Banner */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3 text-center">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                      GROUND SPEED
                    </span>
                    <span className="font-mono text-3xl font-black text-[#FFE500]">
                      {speed}{' '}
                      <span className="text-xs font-normal text-slate-400">MPH</span>
                    </span>
                  </div>
                  <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3 text-center">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                      CORRIDOR WEATHER
                    </span>
                    <div className="flex items-center justify-center gap-1 text-emerald-400">
                      <span className="material-symbols-outlined text-[18px]">wb_sunny</span>
                      <span className="font-mono text-xl font-bold">68°F</span>
                    </div>
                  </div>
                  <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3 text-center">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                      HOS DRIVE CLOCK
                    </span>
                    <span className="font-mono text-2xl font-bold text-white">08:42:15</span>
                  </div>
                </div>

                {/* CRITICAL CLEARANCE ALERT CONTAINER (GEMINI.md RULE ADHERENCE) */}
                <div className="box-clearance-critical p-5 rounded-xl">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-500 text-[26px] animate-pulse">
                        warning
                      </span>
                      <div>
                        <span className="font-mono text-xs font-black uppercase text-red-400 tracking-wider block">
                          COLLISION RISK: CRITICAL // FHWA ITEM 54B RADAR
                        </span>
                        <h4 className="font-black text-white text-lg tracking-tight">
                          13' 6" CLEARANCE // 0" BUFFER DELTA
                        </h4>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-[#EAB308]/20 border border-[#EAB308] text-[#EAB308] font-mono text-[11px] font-black uppercase tracking-wider animate-pulse">
                      BRIDGE AHEAD
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-mono mb-4 leading-relaxed">
                    STRUCTURE #TX-DOT-1842 // S. MAIN ST OVERPASS (MILE 184.2). Tractor height calibrated to 13' 6". Zero vertical clearance buffer detected. High impact trailer decapitation risk.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={() => {
                        onShowToast('BYPASS DIVERTER EXECUTED // ROUTING VIA LOOP 820 NORTH', 'route', 'success');
                      }}
                      className="btn-tactical-yellow w-full py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">alt_route</span>
                      <span>&gt;&gt; EXECUTE BYPASS DIVERTER</span>
                    </button>
                    <button
                      onClick={() => onNavigateToTab('radar-54b')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#0F141C] border border-[#1E2532] text-xs font-mono font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:border-slate-400 transition-all cursor-pointer whitespace-nowrap"
                    >
                      OPEN RADAR 54B
                    </button>
                  </div>
                </div>

                {/* Map Vector Route Corridors (Neon Gradient from Safe Emerald to Caution Amber to Hazard Red) */}
                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5 text-white font-bold">
                      <span className="material-symbols-outlined text-[16px] text-emerald-400">navigation</span>
                      VECTOR CORRIDOR ELEVATION PROFILE
                    </span>
                    <span>1.8 MILES TO HAZARD</span>
                  </div>
                  {/* Visual gradient bar */}
                  <div className="h-4 w-full rounded-full bg-gradient-to-r from-[#10B981] via-[#F59E0B] to-[#EF4444] p-0.5 shadow-[0_0_15px_rgba(239,68,68,0.3)] relative">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-black shadow-md"
                      style={{ left: '42%' }}
                      title="Current Rig Location"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm bg-red-600 border border-white"
                      style={{ left: '88%' }}
                      title="Bridge Overpass Location"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-2">
                    <span className="text-emerald-400 font-bold">SAFE PASS (15' 2")</span>
                    <span className="text-amber-400 font-bold">TIGHT BUFFER (14' 0")</span>
                    <span className="text-red-400 font-bold">CRITICAL HAZARD (13' 6")</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dispatch Zero & Master Mechanic Teasers */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* DISPATCH ZERO CARD (GEMINI.md RULE ADHERENCE) */}
                <div className="bg-[#0A0F14] border-2 border-[#FFE500]/40 rounded-xl p-5 shadow-[0_0_25px_rgba(255,229,0,0.15)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#FFE500] text-[20px]">payments</span>
                      <span className="font-mono text-xs font-black uppercase text-slate-300 tracking-wider">
                        DISPATCH ZERO YIELD
                      </span>
                    </div>
                    {/* Emerald Pill Badge */}
                    <span className="badge-verified px-2.5 py-0.5 rounded-full text-[10px]">
                      ✔ VERIFIED
                    </span>
                  </div>

                  {/* Large Yield Display in #FFE500 Yellow */}
                  <div className="my-2">
                    <span className="font-mono text-4xl sm:text-5xl font-black text-[#FFE500] tracking-tight drop-shadow-[0_0_15px_rgba(255,229,0,0.4)]">
                      $232.10/Hr
                    </span>
                    <span className="block text-xs font-mono text-slate-400 mt-1">
                      REVENUE PER LEGAL DUTY HOUR // RANK #1 DISPATCH
                    </span>
                  </div>

                  <div className="bg-[#05080E] border border-[#1E2532] rounded-lg p-3 my-3 text-xs font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">ORIGIN</span>
                      <span className="text-white font-bold">DALLAS, TX (DFW HUB)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DESTINATION</span>
                      <span className="text-white font-bold">ATLANTA, GA (DOCK 4)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">GROSS PAY</span>
                      <span className="text-[#FFE500] font-bold">$2,321.00</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DUTY TIME REQ.</span>
                      <span className="text-emerald-400 font-bold">10.0 HOURS</span>
                    </div>
                  </div>

                  {/* One-Click Dispatch Yellow CTA */}
                  <button
                    onClick={() => {
                      onShowToast('DISPATCH ZERO LOAD ACCEPTED // CORRIDOR MANIFEST LOCKED', 'verified', 'success');
                    }}
                    className="btn-tactical-yellow w-full py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>⚡ ONE-CLICK QUANTUM DISPATCH</span>
                  </button>
                </div>

                {/* THE MASTER MECHANIC J1939 TEASER (GEMINI.md PROTOCOL ADHERENCE) */}
                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">build</span>
                      <span className="font-mono text-xs font-black uppercase text-white tracking-wider">
                        THE MASTER MECHANIC
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">J1939 250 kbps / 10Hz</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
                    <div className="p-2 rounded bg-[#05080E] border border-[#1E2532]">
                      <span className="text-[10px] text-slate-400 block">COOLANT TEMP</span>
                      <span className="text-emerald-400 font-bold">198°F (NOMINAL)</span>
                    </div>
                    <div className="p-2 rounded bg-[#05080E] border border-[#1E2532]">
                      <span className="text-[10px] text-slate-400 block">OIL PRESSURE</span>
                      <span className="text-emerald-400 font-bold">42 PSI (OPTIMAL)</span>
                    </div>
                    <div className="p-2 rounded bg-[#05080E] border border-[#1E2532]">
                      <span className="text-[10px] text-slate-400 block">TURBO BOOST</span>
                      <span className="text-emerald-400 font-bold">28.4 PSI</span>
                    </div>
                    <div className="p-2 rounded bg-[#05080E] border border-[#1E2532]">
                      <span className="text-[10px] text-slate-400 block">HITCH ARTICULATION</span>
                      <span className="text-emerald-400 font-bold">18° (SAFE)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToTab('master-mechanic')}
                    className="w-full py-2 rounded bg-[#0F141C] border border-[#1E2532] text-slate-300 hover:text-white hover:border-slate-500 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">troubleshoot</span>
                    <span>SCAN J1939 FAULT CODES</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KEY STATS & CARRIER PROOF BAR
      ========================================================================= */}
      <section className="bg-[#0A0F14] border-b border-[#1E2532] py-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="border-r border-[#1E2532] last:border-0">
              <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-400 block mb-1">
                0
              </span>
              <span className="font-mono text-xs sm:text-sm text-slate-300 uppercase tracking-wider font-bold block">
                Bridge Strikes
              </span>
              <span className="text-[11px] text-slate-500 font-mono">14.8M+ Corridor Miles</span>
            </div>

            <div className="border-r border-[#1E2532] last:border-0">
              <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black text-[#FFE500] block mb-1">
                $232.10
              </span>
              <span className="font-mono text-xs sm:text-sm text-slate-300 uppercase tracking-wider font-bold block">
                Avg. Hourly Yield
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Dispatch Zero Algorithm</span>
            </div>

            <div className="border-r border-[#1E2532] last:border-0">
              <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black text-white block mb-1">
                100%
              </span>
              <span className="font-mono text-xs sm:text-sm text-slate-300 uppercase tracking-wider font-bold block">
                DOT Audit Pass
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Zero Shut-Down Protocol</span>
            </div>

            <div>
              <span className="font-mono text-3xl sm:text-4xl lg:text-5xl font-black text-purple-400 block mb-1">
                &lt; 2.4s
              </span>
              <span className="font-mono text-xs sm:text-sm text-slate-300 uppercase tracking-wider font-bold block">
                DTC Alert Latency
              </span>
              <span className="text-[11px] text-slate-500 font-mono">10Hz J1939 Telemetry</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 1: FHWA ITEM 54B LOW-BRIDGE RADAR HUD & CLEARANCE SANDBOX
      ========================================================================= */}
      <section id="radar54b" className="py-20 border-b border-[#1E2532] relative">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/40 text-red-400 font-mono text-xs font-bold uppercase tracking-widest mb-4">
                <span className="material-symbols-outlined text-[16px]">emergency</span>
                <span>TRAILER DECAPITATION PREVENTION</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-6">
                FHWA ITEM 54B <br />
                <span className="text-[#FFE500]">LOW-BRIDGE RADAR HUD</span>
              </h2>

              <p className="text-slate-300 text-base sm:text-lg mb-6 leading-relaxed">
                Every year, over 15,000 commercial bridge strikes destroy trailers, ruin motor carrier safety ratings,
                and generate an average of <strong className="text-white">$150,000 in catastrophic liability</strong>.
                TruckWithEase cross-references real-time GPS coordinates with the Federal Highway Administration’s
                exhaustive 618,000+ structure database.
              </p>

              <div className="space-y-3.5 mb-8 text-sm text-slate-300 font-mono">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">check_circle</span>
                  <span>
                    <strong className="text-white">Active Vehicle Height Geofence:</strong> Enter your exact fifth-wheel,
                    kingpin, or high-cube trailer height (down to the inch).
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">check_circle</span>
                  <span>
                    <strong className="text-white">Dynamic Diverter Routing:</strong> Instant 1-click execution of secondary
                    bypass corridors (e.g. Loop 820 North) long before you reach the impact point.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">check_circle</span>
                  <span>
                    <strong className="text-white">Aero-Avionics Night HUD:</strong> Ultra-low glare deep obsidian display
                    engineered specifically for midnight line-haul runs without night blindness.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => onNavigateToTab('radar-54b')}
                  className="btn-tactical-yellow px-6 py-3 text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">radar</span>
                  <span>OPEN FULL RADAR 54B COCKPIT</span>
                </button>
              </div>
            </div>

            {/* Right: Interactive Clearance Buffer Simulator */}
            <div className="lg:col-span-6 bg-[#0A0F14] border-2 border-[#1E2532] rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1E2532] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500]">tune</span>
                  <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                    INTERACTIVE CLEARANCE SANDBOX
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  REAL-TIME MATH
                </span>
              </div>

              {/* Truck Height Selector */}
              <div className="mb-4">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  1. SELECT TRUCK / TRAILER HEIGHT
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '13\' 2"', val: 13.167 },
                    { label: '13\' 6"', val: 13.5 },
                    { label: '14\' 0"', val: 14.0 },
                    { label: '14\' 6"', val: 14.5 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setSimTruckHeightFt(item.val);
                        setIsBypassExecuted(false);
                      }}
                      className={`py-2 px-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                        simTruckHeightFt === item.val
                          ? 'bg-[#FFE500] text-black border-[#FFE500] shadow-[0_0_12px_rgba(255,229,0,0.4)]'
                          : 'bg-[#0F141C] text-slate-300 border-[#1E2532] hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upcoming Bridge Structure Preset */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  2. APPROACHING BRIDGE OVERPASS (FHWA ITEM 54B)
                </label>
                <div className="space-y-2">
                  {BRIDGE_PRESETS.map((bridge, idx) => (
                    <button
                      key={bridge.name}
                      onClick={() => {
                        setSelectedBridgeIndex(idx);
                        setIsBypassExecuted(false);
                      }}
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between font-mono text-xs transition-all cursor-pointer ${
                        selectedBridgeIndex === idx
                          ? 'bg-[#151B24] border-[#FFE500]/50 text-white shadow-sm'
                          : 'bg-[#05080E] border-[#1E2532] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-white block">{bridge.name}</span>
                        <span className="text-[10px] text-slate-500">{bridge.highway}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-[#FFE500] block">{bridge.display}</span>
                        <span className="text-[9px] text-slate-400">CLEARANCE</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Result Display (Alert Box or Clear Pass) */}
              <div className="mt-4">
                {isBypassExecuted ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 font-mono text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                      <span>BYPASS CORRIDOR ENGAGED: {currentBridge.bypassName}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Rig safely diverted around {currentBridge.name}. Clearance delta restored to +24" buffer. Highway speed cleared at 65 MPH.
                    </p>
                  </div>
                ) : isCriticalCollision ? (
                  <div className="box-clearance-critical p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-red-500 text-[20px] animate-pulse">
                          warning
                        </span>
                        <span className="font-mono text-xs font-black text-red-400 uppercase tracking-wider">
                          COLLISION RISK: CRITICAL // BUFFER DELTA: {rawDeltaInches}"
                        </span>
                      </div>
                      <span className="badge-orange px-2 py-0.5 rounded text-[10px]">
                        BRIDGE AHEAD
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-200 mb-3">
                      Bridge ({currentBridge.display}) is lower than or equal to vehicle height ({simTruckHeightFt.toFixed(1)}'). Impact will cause catastrophic trailer roof decapitation.
                    </p>
                    <button
                      onClick={() => {
                        setIsBypassExecuted(true);
                        onShowToast('BYPASS EXECUTED // ROUTING DIVERTER ACTIVE', 'route', 'success');
                      }}
                      className="btn-tactical-yellow w-full py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">alt_route</span>
                      <span>&gt;&gt; EXECUTE BYPASS DIVERTER ({currentBridge.bypassName})</span>
                    </button>
                  </div>
                ) : isTightWarning ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500 text-amber-300 font-mono text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                      <span>WARNING: TIGHT BUFFER DELTA ({rawDeltaInches}" CLEARANCE)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] mb-2">
                      Structure clearance provides less than 4 inches of buffer. Recommended action: reduce speed to 15 MPH and air down rear bags if necessary.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 font-mono text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span>CLEAR PASS // BUFFER DELTA: +{rawDeltaInches}" SAFE</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Sufficient overhead clearance. Safe pass at posted commercial highway speeds.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 2: THE MASTER MECHANIC J1939 PROTOCOL & JACKKNIFE SENTINEL
      ========================================================================= */}
      <section id="mechanic" className="py-20 border-b border-[#1E2532] bg-[#0A0F14]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">build_circle</span>
              <span>THE MASTER MECHANIC PROTOCOL</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              J1939 CAN-BUS DIAGNOSTICS & <br />
              <span className="text-[#FFE500]">JACKKNIFE SENTINEL</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Never get stranded on the highway shoulder. The Master Mechanic polls ECM telemetry at 10Hz, decodes SPN/FMI
              trouble codes before check engine lights flash, and monitors kingpin articulation to prevent catastrophic jackknifes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Component Failure Radar & DTC Scanner */}
            <div className="lg:col-span-7 bg-[#05080E] border border-[#1E2532] rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-[#1E2532] pb-3 mb-4">
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-white">
                  <span className="material-symbols-outlined text-[#FFE500]">troubleshoot</span>
                  <span>LIVE COMPONENT FAILURE RADAR</span>
                </div>
                {/* Engine Selector */}
                <div className="flex items-center gap-1">
                  {(['cummins', 'detroit', 'paccar'] as const).map((eng) => (
                    <button
                      key={eng}
                      onClick={() => setSelectedEngine(eng)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                        selectedEngine === eng
                          ? 'bg-[#FFE500] text-black'
                          : 'bg-[#0F141C] text-slate-400 hover:text-white'
                      }`}
                    >
                      {eng === 'cummins' ? 'X15' : eng === 'detroit' ? 'DD15' : 'MX-13'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6 Component Gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">ENGINE OIL TEMP</span>
                  <span className="font-mono text-xl font-bold text-emerald-400 block my-0.5">212°F</span>
                  <span className="text-[9px] font-mono text-slate-400">NOMINAL (SAFE &lt; 245°F)</span>
                </div>

                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">COOLANT TEMP</span>
                  <span className="font-mono text-xl font-bold text-emerald-400 block my-0.5">198°F</span>
                  <span className="text-[9px] font-mono text-slate-400">NOMINAL (THERMOSTAT OPEN)</span>
                </div>

                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">TURBO BOOST</span>
                  <span className="font-mono text-xl font-bold text-emerald-400 block my-0.5">28.4 PSI</span>
                  <span className="text-[9px] font-mono text-slate-400">OPTIMAL SPOOL</span>
                </div>

                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">BRAKE LININGS</span>
                  <span className="font-mono text-xl font-bold text-[#FFE500] block my-0.5">18% LEFT</span>
                  <span className="text-[9px] font-mono text-amber-400">ADVISORY (NEXT 500 MI)</span>
                </div>

                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">AUTOMATED CLUTCH</span>
                  <span className="font-mono text-xl font-bold text-emerald-400 block my-0.5">14% WEAR</span>
                  <span className="text-[9px] font-mono text-slate-400">HEALTHY ENGAGEMENT</span>
                </div>

                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">ALTERNATOR VOLTS</span>
                  <span className="font-mono text-xl font-bold text-emerald-400 block my-0.5">14.2V</span>
                  <span className="text-[9px] font-mono text-slate-400">CHARGING STEADY</span>
                </div>
              </div>

              {/* Live SPN / FMI DTC Scanner Sample */}
              <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="font-bold text-slate-300">ACTIVE SPN/FMI DTC FAULT CODES</span>
                  <span className="text-[10px] text-amber-400">1 ADVISORY // 0 CRITICAL</span>
                </div>
                <div className="bg-[#05080E] border border-amber-500/30 rounded-lg p-3 text-xs font-mono text-slate-300 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        SPN 3251 FMI 0
                      </span>
                      <span className="font-bold text-white">DPF Differential Pressure High</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Soot loading at 68%. Initiate parked regeneration or highway cruising burn within 120 miles.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onShowToast('DTC ATTACHED TO ELECTRONIC PRE-TRIP DVIR', 'attachment', 'success');
                    }}
                    className="px-2.5 py-1 rounded bg-[#0F141C] border border-[#1E2532] text-[10px] font-bold text-slate-300 hover:text-white hover:border-[#FFE500] whitespace-nowrap cursor-pointer"
                  >
                    + DVIR
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Virtual Kingpin Hitch Articulation Sentinel */}
            <div className="lg:col-span-5 bg-[#05080E] border border-[#1E2532] rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#1E2532] pb-3 mb-4">
                  <div className="flex items-center gap-2 font-mono text-sm font-bold text-white">
                    <span className="material-symbols-outlined text-purple-400">screen_rotation</span>
                    <span>KINGPIN HITCH ARTICULATION SENTINEL</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">THRESHOLD: 48°</span>
                </div>

                <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                  Monitors the physical angle between tractor chassis and semi-trailer. Alerts driver before lateral inertia causes an irreversible highway jackknife.
                </p>

                {/* Angle Readout & Warning Banner */}
                <div
                  className={`p-5 rounded-xl border-2 text-center transition-all mb-5 ${
                    isJackknifeDanger
                      ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse'
                      : isHighArticulation
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                  }`}
                >
                  <span className="font-mono text-xs font-bold uppercase tracking-widest block mb-1">
                    CURRENT HITCH ANGLE
                  </span>
                  <span className="font-mono text-5xl font-black block tracking-tight">
                    {hitchArticulationAngle}°
                  </span>
                  <span className="font-mono text-xs font-bold mt-2 inline-block">
                    {isJackknifeDanger
                      ? '⚠️ CRITICAL // JACKKNIFE DANGER IMMINENT (>48°)'
                      : isHighArticulation
                      ? '⚠️ ADVISORY // HIGH ARTICULATION (EASE STEERING)'
                      : '✔ NOMINAL // STABLE ARTICULATION'}
                  </span>
                </div>

                {/* Slider to interactively test angle */}
                <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span>TEST HITCH ANGLE SLIDER:</span>
                    <span className="text-white font-bold">{hitchArticulationAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={hitchArticulationAngle}
                    onChange={(e) => setHitchArticulationAngle(parseInt(e.target.value, 10))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>0° (Straight)</span>
                    <span className="text-amber-400 font-bold">35° (High)</span>
                    <span className="text-red-400 font-bold">48° (Jackknife Risk)</span>
                    <span>60°</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1E2532] flex items-center justify-between gap-3">
                <button
                  onClick={() => onNavigateToTab('master-mechanic')}
                  className="btn-tactical-yellow w-full py-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">build</span>
                  <span>OPEN THE MASTER MECHANIC</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 3: DISPATCH ZERO ($/HR YIELD ARCHITECTURE)
      ========================================================================= */}
      <section id="dispatch-zero" className="py-20 border-b border-[#1E2532] relative">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Interactive Calculator */}
            <div className="lg:col-span-6 bg-[#0A0F14] border-2 border-[#FFE500]/40 rounded-2xl p-6 sm:p-8 shadow-[0_0_35px_rgba(255,229,0,0.1)]">
              <div className="flex items-center justify-between border-b border-[#1E2532] pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500] text-[22px]">calculate</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    DISPATCH ZERO // YIELD SIMULATOR
                  </span>
                </div>
                <span className="badge-verified px-2.5 py-0.5 rounded-full text-[10px]">
                  ✔ VERIFIED
                </span>
              </div>

              {/* Large Rate Yield Box */}
              <div className="bg-[#05080E] border border-[#1E2532] rounded-xl p-5 text-center mb-6">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  CALCULATED NET YIELD RATE
                </span>
                <span className="font-mono text-4xl sm:text-6xl font-black text-[#FFE500] tracking-tight drop-shadow-[0_0_20px_rgba(255,229,0,0.4)]">
                  ${calcYieldRate}
                  <span className="text-lg sm:text-2xl font-normal text-slate-300">/Hr</span>
                </span>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                      parseFloat(calcYieldRate) >= 200
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : parseFloat(calcYieldRate) >= 150
                        ? 'bg-[#FFE500]/20 text-[#FFE500] border border-[#FFE500]/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    PROFITABILITY GRADE:{' '}
                    {parseFloat(calcYieldRate) >= 200 ? 'A+ (PREMIUM)' : parseFloat(calcYieldRate) >= 150 ? 'B (DECENT)' : 'C- (MARGIN BREACH)'}
                  </span>
                </div>
              </div>

              {/* Sliders for gross, miles, detention, legal hours */}
              <div className="space-y-4 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>GROSS FREIGHT REVENUE:</span>
                    <span className="text-[#FFE500] font-bold">${calcGrossRevenue.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="800"
                    max="6000"
                    step="50"
                    value={calcGrossRevenue}
                    onChange={(e) => setCalcGrossRevenue(parseFloat(e.target.value))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>LOADED MILES:</span>
                    <span className="text-white font-bold">{calcLoadedMiles} MILES</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1500"
                    step="25"
                    value={calcLoadedMiles}
                    onChange={(e) => setCalcLoadedMiles(parseFloat(e.target.value))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>ESTIMATED DOCK DETENTION:</span>
                    <span className="text-amber-400 font-bold">{calcDetentionHours.toFixed(1)} HOURS</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="0.5"
                    value={calcDetentionHours}
                    onChange={(e) => setCalcDetentionHours(parseFloat(e.target.value))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>REMAINING LEGAL DUTY HOURS (11H/14H):</span>
                    <span className="text-emerald-400 font-bold">{calcLegalDutyHours.toFixed(1)} HOURS AVAILABLE</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="14"
                    step="0.5"
                    value={calcLegalDutyHours}
                    onChange={(e) => setCalcLegalDutyHours(parseFloat(e.target.value))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                </div>
              </div>

              {/* Status and Action */}
              <div className="mt-6 pt-4 border-t border-[#1E2532]">
                {isLegalHourBreach ? (
                  <div className="p-3 rounded-lg bg-red-500/15 border border-red-500 text-red-300 font-mono text-xs mb-3">
                    ⚠️ LOAD REQUIRES {calcTotalHoursNeeded.toFixed(1)} HRS — EXCEEDS YOUR {calcLegalDutyHours} HRS LEGAL LIMIT. ACCEPTING WILL CAUSE FMCSA PART 395 CLOCK VIOLATION.
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-mono text-xs mb-3">
                    ✔ LEGAL CAPACITY CLEAR: Load requires {calcTotalHoursNeeded.toFixed(1)} total hours. Perfectly fits within your remaining {calcLegalDutyHours} legal hours.
                  </div>
                )}

                <button
                  onClick={() => {
                    onShowToast(`DISPATCH ZERO ACCEPTED // LOCKED AT $${calcYieldRate}/HR`, 'verified', 'success');
                  }}
                  className="btn-tactical-yellow w-full py-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>⚡ ONE-CLICK QUANTUM DISPATCH</span>
                </button>
              </div>
            </div>

            {/* Right: Explanatory Copy */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-4">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                <span>STOP CHASING RAW GROSS</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-6">
                DISPATCH ZERO <br />
                <span className="text-[#FFE500]">$/HR YIELD ARCHITECTURE</span>
              </h2>

              <p className="text-slate-300 text-base sm:text-lg mb-6 leading-relaxed">
                Most drivers look at a $3,500 load and jump on it immediately, unaware that 5 hours of unpaid detention
                and heavy metropolitan congestion drop their true yield below $80/Hr while exhausting their 70-hour cycle.
              </p>

              <div className="space-y-4 mb-8 text-sm text-slate-300 font-mono">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">hourglass_top</span>
                  <div>
                    <strong className="text-white">Ranked by Remaining Legal Duty Hours:</strong> Automatically factors
                    in your live 11-hour drive, 14-hour on-duty, and 70-hour rolling clocks.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">speed</span>
                  <div>
                    <strong className="text-white">Unpaid Detention Predictor:</strong> Flags shippers and receivers with
                    chronic detention histories before you sign the rate confirmation.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#FFE500] text-[20px] shrink-0">check</span>
                  <div>
                    <strong className="text-white">One-Click Quantum Booking:</strong> Instantly accept and lock pre-audited
                    freight directly into your active corridor route.
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('dispatch-eta')}
                className="btn-tactical-yellow px-6 py-3 text-xs flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">alt_route</span>
                <span>EXPLORE DISPATCH ZERO LOAD BOARD</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 4: ROADSIDE OFFICER SHIELD & ZERO-SHUT-DOWN COMPLIANCE
      ========================================================================= */}
      <section className="py-20 border-b border-[#1E2532] bg-[#0A0F14]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">privacy_tip</span>
              <span>49 CFR PART 395 & 396 CERTIFIED</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              ROADSIDE OFFICER SHIELD & <br />
              <span className="text-[#FFE500]">ZERO-SHUT-DOWN COMPLIANCE</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Never hand over your personal phone or unrestricted tablet to a state trooper or DOT inspector.
              With 1 tap, Officer Shield isolates strictly the 6 required federal documents while completely sealing your private data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* What the Officer Sees */}
            <div className="bg-[#05080E] border-2 border-emerald-500/40 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-[#1E2532] pb-3 mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  WHAT THE OFFICER SEES (100% COMPLIANT)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400">
                  DOT APPROVED
                </span>
              </div>
              <ul className="space-y-3 font-mono text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>Official 8-Day Pullable RODS (Record of Duty Status)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>Electronic FMCSA Web Services / Encrypted Email Data Transfer</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>Driver Qualification File (CDL Class A & Medical Card MCSA-5876)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>Electronic Pre-Trip & Post-Trip DVIR (49 CFR § 396.11)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>Form MCS-64 Annual Periodic Inspection Certificate</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400 font-black">✔</span>
                  <span>IRP Apportioned Cab Card & IFTA License</span>
                </li>
              </ul>
            </div>

            {/* What Stays 100% Private */}
            <div className="bg-[#05080E] border-2 border-purple-500/40 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-[#1E2532] pb-3 mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  WHAT STAYS TOTALLY PRIVATE & SHIELDED
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300">
                  SEALED VAULT
                </span>
              </div>
              <ul className="space-y-3 font-mono text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Proprietary Freight Rates & Load Confirmations</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Dispatch SMS & Private In-Cab Messaging History</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Personal Unassigned Driving & Off-Duty Notes</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Driver Banking, Invoicing & Fleet Expense Ledgers</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Carrier Financial Accounting & Profit Margins</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-black">🔒</span>
                  <span>Personal Contact Lists & Family Phone Numbers</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => onNavigateToTab('vault')}
              className="btn-tactical-yellow px-8 py-3.5 text-xs flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">security</span>
              <span>TEST THE ROADSIDE OFFICER SHIELD IN THE COMPLIANCE VAULT</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          REAL APP SCREENSHOTS SHOWCASE (Using generated AppStore assets)
      ========================================================================= */}
      <section className="py-20 border-b border-[#1E2532]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              <span>AUTHENTIC IN-CAB INTERFACE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              TEST-DRIVEN IN THE CABIN. <br />
              <span className="text-[#FFE500]">VERIFIED ON THE HIGHWAY.</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Explore the actual high-contrast cockpit interfaces used by thousands of drivers every night.
            </p>
          </div>

          {/* Screenshot Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Screenshot 1: Night HUD */}
            <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden hover:border-[#FFE500]/50 transition-all group">
              <div className="relative aspect-[16/9] bg-[#05080E] overflow-hidden">
                <img
                  src="/assets/screenshots/1_Cockpit_NightHUD.png"
                  alt="Driver In-Cab Night HUD"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  01 // DRIVER IN-CAB NIGHT HUD
                </span>
                <h4 className="font-bold text-white text-sm mb-1">
                  Deep Obsidian High-Contrast Cruising Cockpit
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Engineered with zero eye fatigue, real-time ground speed, live corridor radar, and fatigue monitor.
                </p>
              </div>
            </div>

            {/* Screenshot 2: 54B Radar */}
            <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden hover:border-[#FFE500]/50 transition-all group">
              <div className="relative aspect-[16/9] bg-[#05080E] overflow-hidden">
                <img
                  src="/assets/screenshots/3_Bridge_Clearance_Radar54B.png"
                  alt="FHWA Item 54B Low-Bridge Radar HUD"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider block mb-1">
                  02 // FHWA ITEM 54B CLEARANCE RADAR
                </span>
                <h4 className="font-bold text-white text-sm mb-1">
                  Low-Bridge Collision Alert & Dynamic Bypass
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Calculates structure buffers down to the exact inch with 1-click execution of secondary bypasses.
                </p>
              </div>
            </div>

            {/* Screenshot 3: HOS Clocks */}
            <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden hover:border-[#FFE500]/50 transition-all group">
              <div className="relative aspect-[16/9] bg-[#05080E] overflow-hidden">
                <img
                  src="/assets/screenshots/2_HOS_49CFR395_Clocks.png"
                  alt="49 CFR § 395 Hours of Service Clocks"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-mono font-bold text-[#FFE500] uppercase tracking-wider block mb-1">
                  03 // FMCSA § 395 HOS CLOCKS
                </span>
                <h4 className="font-bold text-white text-sm mb-1">
                  Split Sleeper Berth & Adverse Driving Optimizer
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Precision 11h/14h/70h duty tracking with +2hr emergency extensions and 8/2 sleeper pairing.
                </p>
              </div>
            </div>

            {/* Screenshot 4: Vehicle Telematics */}
            <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden hover:border-[#FFE500]/50 transition-all group">
              <div className="relative aspect-[16/9] bg-[#05080E] overflow-hidden">
                <img
                  src="/assets/screenshots/4_Vehicle_Telematics_J1939.png"
                  alt="J1939 Vehicle Telematics & Diagnostics"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider block mb-1">
                  04 // 10HZ CAN-BUS TELEMATICS
                </span>
                <h4 className="font-bold text-white text-sm mb-1">
                  J1939 Live Engine & Chassis Sentinel
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Engine oil, coolant, turbo boost, brake wear, and kingpin hitch articulation jackknife defense.
                </p>
              </div>
            </div>

            {/* Screenshot 5: Compliance Vault */}
            <div className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden hover:border-[#FFE500]/50 transition-all group">
              <div className="relative aspect-[16/9] bg-[#05080E] overflow-hidden">
                <img
                  src="/assets/screenshots/5_DOT_Compliance_Vault.png"
                  alt="Federal Compliance Vault"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider block mb-1">
                  05 // FEDERAL COMPLIANCE VAULT
                </span>
                <h4 className="font-bold text-white text-sm mb-1">
                  Merkle-Proof Cryptographic Record Archive
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Zero-shut-down offline backup dossier, camera DVIR scanner, and tamper-evident audit trails.
                </p>
              </div>
            </div>

            {/* Launch CTA Card */}
            <div className="bg-[#0F141C] border-2 border-dashed border-[#FFE500]/50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[#FFE500] text-[48px] mb-3">
                launch
              </span>
              <h4 className="font-black text-white text-lg uppercase mb-2">
                TEST-DRIVE IN YOUR BROWSER
              </h4>
              <p className="text-xs text-slate-300 font-mono mb-5">
                Launch the interactive live cockpit right now with real-time simulated telematics and corridor routing.
              </p>
              <button
                onClick={() => onNavigateToTab('night-hud')}
                className="btn-tactical-yellow w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡ ENTER LIVE COCKPIT</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 5: TURNKEY HARDWARE STORE // GPSTAB #1 BEST BET
      ========================================================================= */}
      <section id="hardware" className="py-20 border-b border-[#1E2532] bg-[#0A0F14]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              <span>CERTIFIED COMMERCIAL HARDWARE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              TURNKEY TELEMATICS STORE <br />
              <span className="text-[#FFE500]">NO CONTRACT HANDCUFFS.</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              We eliminate predatory 3-year ELD contracts. Order certified hardware pre-configured with your DOT/MC,
              plug it into your heavy duty diagnostic port in 5 minutes, and hit the road.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* GPSTab (Top Recommended Best Bet) */}
            <div className="bg-[#05080E] border-2 border-[#FFE500] rounded-2xl p-6 sm:p-7 relative shadow-[0_0_30px_rgba(255,229,0,0.2)] flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FFE500] text-black font-mono text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                🏆 #1 BEST BET // ZERO CONTRACTS
              </div>

              <div>
                <div className="flex items-center justify-between mb-4 mt-2">
                  <h3 className="font-black text-xl text-white">GPSTab Flight ELD</h3>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    TOP ROI
                  </span>
                </div>

                <div className="mb-4">
                  <span className="font-mono text-4xl font-black text-[#FFE500]">$299</span>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">
                    + $28/mo SaaS // Month-to-month freedom
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-300 mb-5 leading-relaxed">
                  The ultimate trucker cash-flow machine. 5-minute plug-and-drive install into 9-Pin Deutsch, 6-Pin, or OBD-II. Native 10Hz Bluetooth sync with TruckWithEase Night HUD.
                </p>

                <div className="space-y-2.5 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Zero 36-month contract handcuffs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Autonomous memory buffer (never drops logs)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>FMCSA § 395.8 certified nationwide</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Saves avg. $1,840/truck/year over Motive/Samsara</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('hardware-pricing')}
                className="btn-tactical-yellow w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                <span>ORDER GPSTAB KIT</span>
              </button>
            </div>

            {/* Geotab GO9+ */}
            <div className="bg-[#05080E] border border-[#1E2532] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-xl text-white">Geotab GO9+</h3>
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    ENTERPRISE
                  </span>
                </div>

                <div className="mb-4">
                  <span className="font-mono text-4xl font-black text-white">$349</span>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">
                    + $38/mo SaaS // Advanced Telematics
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-300 mb-5 leading-relaxed">
                  OEM-grade heavy-duty powertrain gateway. Curve-based high precision GPS logging and calibrated G-force accident reconstruction.
                </p>

                <div className="space-y-2.5 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>32-bit automotive processing core</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Simultaneous dual CAN-Bus reading</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Real-time impact & rollover detection</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('hardware-pricing')}
                className="btn-secondary-tactical w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONFIGURE GEOTAB</span>
              </button>
            </div>

            {/* Azuga Fleet */}
            <div className="bg-[#05080E] border border-[#1E2532] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-xl text-white">Azuga Fleet GPS</h3>
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    VALUE
                  </span>
                </div>

                <div className="mb-4">
                  <span className="font-mono text-4xl font-black text-white">$269</span>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">
                    + $24/mo SaaS // GPS & Rewards
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-300 mb-5 leading-relaxed">
                  Built-in driver gamification and speed tracking. Fuel card integration and lightweight medium/heavy duty tracking.
                </p>

                <div className="space-y-2.5 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Driver safety scores & rewards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Fuel card integration & fraud defense</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Simple OBD-II & Deutsch adapters</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('hardware-pricing')}
                className="btn-secondary-tactical w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONFIGURE AZUGA</span>
              </button>
            </div>
          </div>

          {/* White Glove Concierge Callout */}
          <div className="bg-[#0F141C] border border-[#FFE500]/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#FFE500] text-[28px]">handshake</span>
              </div>
              <div>
                <h4 className="font-black text-white text-base sm:text-lg uppercase">
                  WHITE GLOVE CONCIERGE PROVISIONING ($49/TRUCK)
                </h4>
                <p className="text-xs font-mono text-slate-300">
                  We pre-program your USDOT/MC, bind VINs, flash the latest FMCSA-compliant firmware, and ship plug-and-play kits directly to your terminal or home.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('hardware-pricing')}
              className="btn-tactical-yellow px-6 py-3 text-xs whitespace-nowrap cursor-pointer shrink-0"
            >
              ORDER WHITE GLOVE SERVICE
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FEATURE 5B: TOMTOM TRUCK & TRIMBLE MAPS (PC*MILER) NAVIGATION STACK
      ========================================================================= */}
      <section id="navigation-engines" className="py-20 border-b border-[#1E2532] bg-[#05080E]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">navigation</span>
              <span>COMMERCIAL NAVIGATION &amp; IFTA ENGINES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              INTEGRATED WITH <br />
              <span className="text-[#FFE500]">TOMTOM &amp; TRIMBLE MAPS</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              TruckWithEase natively integrates both industry gold-standards: TomTom Truck Routing for dynamic low-clearance
              avoidance and live traffic vectors, plus Trimble MAPS (PC*MILER) for statutory IFTA state mileage splits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* TomTom Truck Engine Card */}
            <div className="bg-[#0A0F14] border-2 border-amber-500/50 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-amber-400 transition-all shadow-[0_0_25px_rgba(245,158,11,0.15)]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">navigation</span>
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-white">TomTom Truck Routing</h3>
                      <span className="text-xs font-mono text-amber-400">Live Traffic &amp; Webfleet FMS Gateway</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
                    OPERATIONAL
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-300 mb-5 leading-relaxed">
                  Calculates precision commercial vehicle corridors enforcing 13' 6" physical height, 102" trailer width,
                  and 80,000 lbs gross weight. Dynamically diverts around sub-174" low bridges via certified bypasses.
                </p>

                <div className="space-y-2.5 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>FHWA Item 54B sub-174" bridge avoidance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Live congestion delay heatmaps &amp; ETA vectors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Commercial toll highway cost estimations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>TomTom Webfleet telematics interface link</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('radar-54b')}
                className="btn-tactical-yellow w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>LAUNCH TOMTOM TRUCK RADAR</span>
              </button>
            </div>

            {/* Trimble MAPS / PC*MILER Card */}
            <div className="bg-[#0A0F14] border-2 border-blue-500/50 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-blue-400 transition-all shadow-[0_0_25px_rgba(59,130,246,0.15)]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">alt_route</span>
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-white">Trimble MAPS (PC*MILER)</h3>
                      <span className="text-xs font-mono text-blue-400">Practical Miles &amp; IFTA Quarterly Tax</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
                    OPERATIONAL
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-300 mb-5 leading-relaxed">
                  The commercial trucking industry standard for freight billing and IFTA tax audits. Computes exact state line
                  mileage breakdowns, toll versus free miles, and 49 CFR Part 397 Hazardous Material routing corridors.
                </p>

                <div className="space-y-2.5 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Statutory Practical vs. Shortest commercial truck miles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Automatic quarterly IFTA state mileage splits &amp; gallons</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>49 CFR Part 397 HazMat tunnel &amp; route compliance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Trimble Instinct &amp; PeopleNet telematics compatibility</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('radar-54b')}
                className="btn-secondary-tactical w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>VIEW PC*MILER IFTA SPLITS</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE FLEET ROI CALCULATOR
      ========================================================================= */}
      <section id="roi-calculator" className="py-20 border-b border-[#1E2532]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              <span>CARRIER PROFIT ACCELERATOR</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              CALCULATE YOUR FLEET'S <br />
              <span className="text-[#FFE500]">ANNUAL NET BENEFIT</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Adjust your fleet size and see the immediate financial impact of avoided bridge strikes, reduced idle fuel,
              eliminated DOT out-of-service fines, and higher $/Hr Dispatch Zero yields.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Sliders */}
            <div className="lg:col-span-6 bg-[#0A0F14] border border-[#1E2532] rounded-2xl p-6 sm:p-8">
              <div className="space-y-6 font-mono">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300 font-bold">1. NUMBER OF POWER UNITS / TRUCKS:</span>
                    <span className="text-[#FFE500] font-black text-lg">{roiTruckCount} RIGS</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={roiTruckCount}
                    onChange={(e) => setRoiTruckCount(parseInt(e.target.value, 10))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 Solo Owner-Op</span>
                    <span>25 Fleet</span>
                    <span>50 Commercial</span>
                    <span>100 Enterprise</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300 font-bold">2. AVG. MONTHLY MILES PER TRUCK:</span>
                    <span className="text-white font-black text-lg">{roiAvgMonthlyMiles.toLocaleString()} MILES</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="14000"
                    step="500"
                    value={roiAvgMonthlyMiles}
                    onChange={(e) => setRoiAvgMonthlyMiles(parseInt(e.target.value, 10))}
                    className="w-full accent-[#FFE500] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>5,000 mi (Regional)</span>
                    <span>9,500 mi (OTR Avg)</span>
                    <span>14,000 mi (Team Linehaul)</span>
                  </div>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="mt-8 pt-6 border-t border-[#1E2532] space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-400 text-[16px]">shield</span>
                    Bridge Strike Damage Prevention:
                  </span>
                  <span className="text-emerald-400 font-bold">+${annualAvoidedBridgeRisk.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#FFE500] text-[16px]">local_gas_station</span>
                    Idle Fuel & Corridor Optimization:
                  </span>
                  <span className="text-emerald-400 font-bold">+${annualFuelSavings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-400 text-[16px]">verified</span>
                    Avoided FMCSA OOS Fines:
                  </span>
                  <span className="text-emerald-400 font-bold">+${annualHosFinesAvoided.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-purple-400 text-[16px]">trending_up</span>
                    Dispatch Zero $/Hr Yield Uplift:
                  </span>
                  <span className="text-emerald-400 font-bold">+${annualDispatchZeroUplift.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Total ROI Box */}
            <div className="lg:col-span-6 bg-[#05080E] border-2 border-emerald-500/50 rounded-2xl p-6 sm:p-8 text-center shadow-[0_0_35px_rgba(16,185,129,0.2)]">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">
                ESTIMATED ANNUAL NET FLEET VALUE
              </span>
              <span className="font-mono text-5xl sm:text-6xl font-black text-emerald-400 tracking-tight drop-shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                +${totalAnnualBenefit.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400 block mt-2">
                PROJECTED ANNUAL RETURN: <strong className="text-[#FFE500] text-sm">{netRoiPercentage}% ROI</strong>
              </span>

              <div className="my-6 p-4 rounded-xl bg-[#0A0F14] border border-[#1E2532] text-xs font-mono text-left space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>ANNUAL PLATFORM INVESTMENT:</span>
                  <span className="text-white font-bold">${annualSoftwareInvestment.toLocaleString()}/yr</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>ESTIMATED INVESTMENT PAYBACK PERIOD:</span>
                  <span className="text-[#FFE500] font-bold">18 DAYS</span>
                </div>
              </div>

              <button
                onClick={() => {
                  const elem = document.getElementById('contact-form');
                  elem?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-tactical-yellow w-full py-4 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CLAIM FLEET RETURN // TALK TO AN ENGINEER</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING PLANS
      ========================================================================= */}
      <section id="pricing" className="py-20 border-b border-[#1E2532] bg-[#0A0F14]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">sell</span>
              <span>TRANSPARENT VALUE-BASED PRICING</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase text-white tracking-tight mb-4">
              PLANS DESIGNED FOR PROFIT <br />
              <span className="text-[#FFE500]">CANCEL ANYTIME.</span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              No hidden gateway surcharges, no cancellation traps, no multi-year contract locks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Solo Owner-Operator */}
            <div className="bg-[#05080E] border border-[#1E2532] rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-500 transition-all">
              <div>
                <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  1 TRUCK
                </span>
                <h3 className="font-black text-2xl text-white mb-2">Solo Owner-Operator</h3>
                <div className="mb-4">
                  <span className="font-mono text-4xl sm:text-5xl font-black text-white">$39</span>
                  <span className="text-xs font-mono text-slate-400">/month</span>
                </div>
                <p className="text-xs font-mono text-slate-400 mb-6">
                  Essential tactical suite for independent drivers wanting bridge strike protection and Dispatch Zero yield.
                </p>

                <ul className="space-y-3 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>In-Cab Night HUD & Live Speed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>FHWA Item 54B Low-Bridge Radar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Dispatch Zero Hourly Yield Ranker</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>FMCSA § 395 eRODS & Pull RODS</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Roadside Officer Privacy Shield</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onNavigateToTab('night-hud')}
                className="btn-secondary-tactical w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>START 14-DAY TRIAL</span>
              </button>
            </div>

            {/* Fleet Pro (Most Popular) */}
            <div className="bg-[#05080E] border-2 border-[#FFE500] rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative shadow-[0_0_35px_rgba(255,229,0,0.2)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FFE500] text-black font-mono text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                ⭐ MOST POPULAR
              </div>

              <div>
                <span className="font-mono text-xs font-bold text-[#FFE500] uppercase tracking-wider block mb-1 mt-1">
                  2 TO 25 RIGS
                </span>
                <h3 className="font-black text-2xl text-white mb-2">Fleet Pro</h3>
                <div className="mb-4">
                  <span className="font-mono text-4xl sm:text-5xl font-black text-[#FFE500]">$59</span>
                  <span className="text-xs font-mono text-slate-400">/truck /month</span>
                </div>
                <p className="text-xs font-mono text-slate-400 mb-6">
                  Comprehensive powertrain telematics, live failure radar, and multi-truck driver management for growing carriers.
                </p>

                <ul className="space-y-3 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Everything in Solo Owner-Operator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>The Master Mechanic J1939 Diagnostics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Kingpin Hitch Articulation Sentinel</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Electronic & Camera Scanned DVIR</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Driver Roster & Function Control Portal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Cryptographic Compliance Vault</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onNavigateToTab('night-hud')}
                className="btn-tactical-yellow w-full py-3.5 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>DEPLOY FLEET PRO</span>
              </button>
            </div>

            {/* Enterprise Carrier */}
            <div className="bg-[#05080E] border border-[#1E2532] rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-slate-500 transition-all">
              <div>
                <span className="font-mono text-xs font-bold text-purple-400 uppercase tracking-wider block mb-1">
                  25+ RIGS
                </span>
                <h3 className="font-black text-2xl text-white mb-2">Enterprise Carrier</h3>
                <div className="mb-4">
                  <span className="font-mono text-4xl sm:text-5xl font-black text-white">Custom</span>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">Volume discounts available</span>
                </div>
                <p className="text-xs font-mono text-slate-400 mb-6">
                  Custom TMS API integrations, White Glove staging, dedicated compliance auditor, and enterprise EDI 204/214 pipelines.
                </p>

                <ul className="space-y-3 font-mono text-xs text-slate-300 border-t border-[#1E2532] pt-4 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Everything in Fleet Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Custom TMS & Salesforce/EDI Integration</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>White Glove Hardware Staging</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>Dedicated Safety Compliance Officer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✔</span>
                    <span>99.99% Uptime Telemetry SLA</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  const elem = document.getElementById('contact-form');
                  elem?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-secondary-tactical w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTACT SALES</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION (ACCORDION)
      ========================================================================= */}
      <section id="faq" className="py-20 border-b border-[#1E2532]">
        <div className="max-w-4xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">help</span>
              <span>COMMON CARRIER QUESTIONS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight mb-3">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Everything you need to know about FHWA Item 54B compliance, GPSTab hardware, and Dispatch Zero.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={faq.q}
                  className="bg-[#0A0F14] border border-[#1E2532] rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-white text-sm sm:text-base hover:text-[#FFE500] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="material-symbols-outlined text-slate-400 shrink-0">
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm font-mono text-slate-300 leading-relaxed border-t border-[#1E2532]/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          LEAD CAPTURE / CONTACT & DEMO REQUEST FORM
      ========================================================================= */}
      <section id="contact-form" className="py-20 border-b border-[#1E2532] bg-[#0A0F14]">
        <div className="max-w-3xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE500]/10 border border-[#FFE500]/40 text-[#FFE500] font-mono text-xs font-bold uppercase tracking-widest mb-3">
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              <span>DIRECT COMMERCIAL ADVISORY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight mb-3">
              SCHEDULE A 1-ON-1 FLEET DEMO
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Speak directly with an enterprise trucking specialist or order custom pre-staged GPSTab hardware.
            </p>
          </div>

          <div className="bg-[#05080E] border-2 border-[#1E2532] rounded-2xl p-6 sm:p-8">
            {leadSubmitted ? (
              <div className="text-center py-10 font-mono">
                <span className="material-symbols-outlined text-emerald-400 text-[56px] mb-3">
                  check_circle
                </span>
                <h3 className="font-black text-xl text-white uppercase mb-2">
                  DEMO REQUEST RECORDED // DISPATCH TICKET #TWE-2026-DEMO
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto mb-6">
                  Thank you, {leadFormData.fullName}. Our commercial fleet engineering team has received your details and will follow up via phone/email within 15 minutes.
                </p>
                <button
                  onClick={() => onNavigateToTab('night-hud')}
                  className="btn-tactical-yellow px-6 py-3 text-xs cursor-pointer"
                >
                  CONTINUE TO LIVE COCKPIT
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      FULL NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Ortiz"
                      value={leadFormData.fullName}
                      onChange={(e) => setLeadFormData({ ...leadFormData, fullName: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      CARRIER / FLEET NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lone Star Express LLC"
                      value={leadFormData.carrierName}
                      onChange={(e) => setLeadFormData({ ...leadFormData, carrierName: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      USDOT OR MC NUMBER
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. USDOT 3819204"
                      value={leadFormData.usdotMc}
                      onChange={(e) => setLeadFormData({ ...leadFormData, usdotMc: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      FLEET SIZE
                    </label>
                    <select
                      value={leadFormData.fleetSize}
                      onChange={(e) => setLeadFormData({ ...leadFormData, fleetSize: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white focus:border-[#FFE500] focus:outline-none cursor-pointer"
                    >
                      <option value="1 Solo Owner-Operator">1 Solo Owner-Operator</option>
                      <option value="2-10 Small Fleet">2-10 Small Fleet</option>
                      <option value="11-50 Mid-Sized Carrier">11-50 Mid-Sized Carrier</option>
                      <option value="50+ Enterprise Carrier">50+ Enterprise Carrier</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      PHONE NUMBER *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. (312) 555-8821"
                      value={leadFormData.phone}
                      onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 uppercase tracking-wider mb-1">
                      BUSINESS EMAIL *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. dispatch@lonestarexpress.com"
                      value={leadFormData.email}
                      onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                      className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:border-[#FFE500] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider mb-1">
                    PRIMARY SOLUTION INTEREST
                  </label>
                  <select
                    value={leadFormData.interest}
                    onChange={(e) => setLeadFormData({ ...leadFormData, interest: e.target.value })}
                    className="w-full bg-[#0A0F14] border border-[#1E2532] rounded-lg px-3.5 py-2.5 text-white focus:border-[#FFE500] focus:outline-none cursor-pointer"
                  >
                    <option value="Low-Bridge Radar 54B & Cockpit Suite">Low-Bridge Radar 54B & Cockpit Suite</option>
                    <option value="Dispatch Zero Hourly Yield Optimization">Dispatch Zero Hourly Yield Optimization</option>
                    <option value="GPSTab Hardware Kits (No Contract ELD)">GPSTab Hardware Kits (No Contract ELD)</option>
                    <option value="FMCSA Zero-Shut-Down Compliance Vault">FMCSA Zero-Shut-Down Compliance Vault</option>
                    <option value="The Master Mechanic J1939 Engine Diagnostics">The Master Mechanic J1939 Engine Diagnostics</option>
                    <option value="Complete Fleet Operating System Package">Complete Fleet Operating System Package</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="btn-tactical-yellow w-full py-4 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>SUBMIT FLEET WALKTHROUGH REQUEST</span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                    🔒 Zero spam guarantee. Your details are strictly encrypted and used only for direct fleet consultation.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          TACTICAL FOOTER
      ========================================================================= */}
      <footer className="bg-[#05080E] border-t border-[#1E2532] py-14">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Col 1: Brand & Identity */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/assets/logo.png" alt="TruckWithEase" className="h-8 w-auto object-contain" />
                <span className="font-extrabold text-white text-base tracking-wider">
                  TRUCK<span className="text-[#FFE500]">WITH</span>EASE
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 leading-relaxed mb-4">
                The unified commercial trucking operating system combining in-cab night HUD, FHWA Item 54B low-bridge radar, J1939 Master Mechanic diagnostics, and Dispatch Zero yield optimization.
              </p>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 inline-block">
                FMCSA § 395 / 49 CFR COMPLIANT
              </span>
            </div>

            {/* Col 2: Core Cockpit Modules */}
            <div>
              <h5 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-3">
                COCKPIT MODULES
              </h5>
              <ul className="space-y-2 text-xs font-mono text-slate-400">
                <li>
                  <button
                    onClick={() => onNavigateToTab('night-hud')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Driver In-Cab Night HUD
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('radar-54b')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    FHWA 54B Low-Bridge Radar
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('master-mechanic')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    The Master Mechanic J1939
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('dispatch-eta')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Dispatch Zero ($/Hr Yield)
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('hos-clocks')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    HOS Clocks & Split Sleeper
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Fleet & Compliance */}
            <div>
              <h5 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-3">
                FLEET & COMPLIANCE
              </h5>
              <ul className="space-y-2 text-xs font-mono text-slate-400">
                <li>
                  <button
                    onClick={() => onNavigateToTab('vault')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Roadside Officer Shield & Vault
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('hardware-pricing')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Hardware Shop (GPSTab, Geotab)
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('trip-planner')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Corridor Weigh Station Bypass
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigateToTab('telemetry')}
                    className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                  >
                    Vehicle CAN-Bus Diagnostics
                  </button>
                </li>
                <li>
                  {onOpenDriverPortal && (
                    <button
                      onClick={() => onOpenDriverPortal('roster')}
                      className="hover:text-[#FFE500] transition-colors cursor-pointer text-left"
                    >
                      Driver Roster & Authentication
                    </button>
                  )}
                </li>
              </ul>
            </div>

            {/* Col 4: 24/7 DOT Emergency line & legal */}
            <div>
              <h5 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-3">
                24/7 MOTOR CARRIER DESK
              </h5>
              <p className="text-xs font-mono text-slate-400 leading-relaxed mb-3">
                Emergency DOT roadside audit assistance, J1939 code triage, and freight diverter hotline.
              </p>
              <div className="p-3 rounded-lg bg-[#0A0F14] border border-[#1E2532] text-xs font-mono">
                <span className="text-slate-500 block text-[10px]">TOLL-FREE EMERGENCY DESK</span>
                <span className="text-[#FFE500] font-bold text-sm">1-800-555-EASE (3273)</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1E2532] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div>
              © 2026 TruckWithEase Enterprise. All rights reserved. Registered under FMCSA & FHWA Item 54B.
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>49 CFR § 395 COMPLIANT</span>
              <span>•</span>
              <span>SAE J1939 CAN-BUS</span>
              <span>•</span>
              <span>256-BIT ENCRYPTED</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
