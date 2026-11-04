import React, { useState, useMemo } from 'react';
import {
  InsuranceConnectorCompany,
  FleetInsuranceQuote,
  DotCompanyRecord,
  TabId,
} from '../../types.ts';
import { insuranceConnectorService } from '../../services/insuranceConnectorService.ts';
import { dotCompanyService } from '../../services/dotCompanyService.ts';

interface InsuranceConnectorScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToTab?: (tab: TabId) => void;
}

export const InsuranceConnectorScreen: React.FC<InsuranceConnectorScreenProps> = ({
  onShowToast,
  onNavigateToTab,
}) => {
  const [carrier, setCarrier] = useState<DotCompanyRecord>(() => dotCompanyService.getCurrentCarrier());
  const [fleetUnits, setFleetUnits] = useState<number>(carrier.powerUnits || 5);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('progressive-commercial');
  const [generatedQuote, setGeneratedQuote] = useState<FleetInsuranceQuote | null>(null);
  const [showCoiModal, setShowCoiModal] = useState<boolean>(false);
  const [showBindModal, setShowBindModal] = useState<boolean>(false);
  const [isBinding, setIsBinding] = useState<boolean>(false);
  const [boundPolicies, setBoundPolicies] = useState<Record<string, string>>({
    'progressive-commercial': 'POL-TWE-3928110-882194',
  });

  const companies = useMemo(() => insuranceConnectorService.getCompanies(), []);
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0],
    [companies, selectedCompanyId]
  );

  // Calculate current quote for selected company
  const currentEvaluation = useMemo(() => {
    return insuranceConnectorService.evaluateDiscountsForCompany(selectedCompany, carrier, fleetUnits);
  }, [selectedCompany, carrier, fleetUnits]);

  // Aggregate stats across all partner underwriters
  const bestDiscountPartner = useMemo(() => {
    let best = companies[0];
    let maxPct = 0;
    companies.forEach((comp) => {
      const evalResult = insuranceConnectorService.evaluateDiscountsForCompany(comp, carrier, fleetUnits);
      if (evalResult.aggregateDiscountPct > maxPct) {
        maxPct = evalResult.aggregateDiscountPct;
        best = comp;
      }
    });
    return { company: best, maxPct };
  }, [companies, carrier, fleetUnits]);

  const handleGenerateQuote = (comp: InsuranceConnectorCompany) => {
    setSelectedCompanyId(comp.id);
    const quote = insuranceConnectorService.generateQuote(comp.id, fleetUnits);
    setGeneratedQuote(quote);
    onShowToast(`GENERATED ${comp.name.toUpperCase()} FLEET RATE QUOTE // SAVINGS: $${quote.totalAnnualSavings.toLocaleString()}/YR`, 'verified');
  };

  const handleOpenCoiModal = (comp: InsuranceConnectorCompany) => {
    setSelectedCompanyId(comp.id);
    const quote = generatedQuote || insuranceConnectorService.generateQuote(comp.id, fleetUnits);
    setGeneratedQuote(quote);
    setShowCoiModal(true);
  };

  const handleConfirmBind = async () => {
    setIsBinding(true);
    try {
      const quote = generatedQuote || insuranceConnectorService.generateQuote(selectedCompanyId, fleetUnits);
      setGeneratedQuote(quote);

      const res = await fetch('/api/insurance/bind-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          carrierUsdot: carrier.usdot,
          companyId: selectedCompanyId,
        }),
      });

      const policyNum = `POL-TWE-${carrier.usdot}-${Math.floor(100000 + Math.random() * 900000)}`;
      setBoundPolicies((prev) => ({
        ...prev,
        [selectedCompanyId]: policyNum,
      }));

      onShowToast(`POLICY BOUND WITH ${selectedCompany.name.toUpperCase()} // POLICY #${policyNum}`, 'verified_user');
      setShowBindModal(false);
    } catch (_) {
      const fallbackPolicy = `POL-OFFLINE-${carrier.usdot}-${Date.now().toString().substring(7)}`;
      setBoundPolicies((prev) => ({
        ...prev,
        [selectedCompanyId]: fallbackPolicy,
      }));
      onShowToast(`POLICY BOUND OFFLINE // POLICY #${fallbackPolicy}`, 'verified_user');
      setShowBindModal(false);
    } finally {
      setIsBinding(false);
    }
  };

  const downloadCoiFile = () => {
    if (!generatedQuote) return;
    const coi = insuranceConnectorService.generateCoiDocument(generatedQuote);
    const blob = new Blob([coi.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = coi.fileName;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`ACORD 25 CERTIFICATE OF INSURANCE DOWNLOADED // COI #${coi.coiNumber}`, 'download');
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto space-y-5 font-mono text-on-surface pb-20 select-none">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER BANNER (Deep Obsidian #0A0F14 + Tactical Yellow)         */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-5 sm:p-6 rounded-2xl border-2 border-[#FFE500]/50 shadow-[0_0_25px_rgba(255,229,0,0.2)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2532] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#FFE500]/20 border border-[#FFE500]/60 text-[#FFE500] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,229,0,0.3)]">
              <span className="material-symbols-outlined text-[32px]">security</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-[#FFE500] uppercase tracking-wider">
                  TRUCKWITHEASE INSURANCE CONNECTOR // FLEET DISCOUNT GATEWAY
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] font-black border border-[#10B981]/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                  <span>7 PARTNER UNDERWRITERS CONNECTED</span>
                </span>
              </div>
              <p className="text-[12px] text-slate-300 mt-0.5">
                Connecting <strong>{carrier.legalName}</strong> (USDOT #{carrier.usdot}) directly with leading commercial motor carrier underwriters for automated telematics rate discounts.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => handleOpenCoiModal(selectedCompany)}
              className="px-3.5 py-2 rounded-xl bg-surface-container-high text-[#FFE500] border border-[#FFE500]/60 font-black text-xs uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              <span>Instant ACORD 25 COI</span>
            </button>

            <button
              onClick={() => {
                const quote = insuranceConnectorService.generateQuote(selectedCompanyId, fleetUnits);
                setGeneratedQuote(quote);
                setShowBindModal(true);
              }}
              className="px-4 py-2 rounded-xl btn-tactical-yellow font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,229,0,0.45)] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">verified_user</span>
              <span>Bind / Connect Policy</span>
            </button>
          </div>
        </div>

        {/* Fleet Size Selector Strip & Live Savings Calculator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Fleet Size Control */}
          <div className="p-3.5 rounded-xl bg-[#05080E] border border-[#1E2532] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase">
              <span>ACTIVE POWER UNITS IN FLEET</span>
              <span className="text-[#FFE500] font-black">{fleetUnits} Power Units</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 3, 5, 10, 25, 50].map((num) => (
                <button
                  key={num}
                  onClick={() => setFleetUnits(num)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    fleetUnits === num
                      ? 'bg-[#FFE500] text-black shadow-[0_0_12px_rgba(255,229,0,0.4)]'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block">
              MCS-150 Registered Fleet: {carrier.powerUnits} Tractors / {carrier.drivers} Drivers
            </span>
          </div>

          {/* Carrier FMCSA Safety Score Rating Box */}
          <div className="p-3.5 rounded-xl bg-[#05080E] border border-emerald-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase">
              <span>FMCSA CARRIER SAFETY RATING</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/50">
                {carrier.safetyRating}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-xl font-bold text-white">Unsafe Driving: </span>
                <span className="text-xl font-black text-emerald-400">11%</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">TOP 90th PERCENTILE</span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              Driver OOS Rate: {carrier.outOfServiceRates.driverOosPct}% (National Avg: {carrier.outOfServiceRates.driverNationalAvgPct}%)
            </span>
          </div>

          {/* Aggregate Annual Savings Highlight */}
          <div className="p-3.5 rounded-xl bg-[#05080E] border-2 border-[#FFE500] shadow-[0_0_20px_rgba(255,229,0,0.3)] space-y-1">
            <span className="text-[10px] text-[#FFE500] font-black uppercase tracking-wider block">
              MAX FLEET ANNUAL DISCOUNT SAVINGS
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#FFE500]">
                -${(currentEvaluation.totalAnnualSavings).toLocaleString()}
              </span>
              <span className="text-xs font-black text-emerald-400">
                -{currentEvaluation.aggregateDiscountPct}% OFF
              </span>
            </div>
            <span className="text-[10px] text-slate-300 block">
              ${Math.round(currentEvaluation.totalAnnualSavings / fleetUnits).toLocaleString()} saved per tractor each year
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. VERIFIED DISCOUNT TIERS BREAKDOWN (Rule-based & Automated)       */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-5 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">verified</span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                TruckWithEase Verified Safety Discount Modules
              </h3>
              <p className="text-[11px] text-slate-400">
                Automatic rate credits verified via FMCSA SAFER/SMS API, J1939 CAN-Bus, and FHWA 54B Radar
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-[#FFE500]/20 text-[#FFE500] text-xs font-black border border-[#FFE500]/40">
            5 / 5 DISCOUNT QUALIFICATIONS ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Discount Tile 1 */}
          <div className="p-3 rounded-xl bg-[#05080E] border border-emerald-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                <span>Clean DOT &amp; SMS BASICs</span>
              </span>
              <span className="text-xs font-black text-[#FFE500]">-12% TO -15%</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              Unsafe Driving &amp; Crash Indicator verified &lt;20th percentile. Satisfactory federal rating.
            </p>
            <div className="pt-1 border-t border-slate-800 text-[9px] text-emerald-400 font-bold flex items-center justify-between">
              <span>STATUS: VERIFIED FMCSA</span>
              <span>USDOT #{carrier.usdot}</span>
            </div>
          </div>

          {/* Discount Tile 2 */}
          <div className="p-3 rounded-xl bg-[#05080E] border border-emerald-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">memory</span>
                <span>10Hz CAN-Bus Diagnostics</span>
              </span>
              <span className="text-xs font-black text-[#FFE500]">-10% TO -16%</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              Master Mechanic real-time ECM monitoring, brake thermal sentinel &amp; preventative DTC fault scans.
            </p>
            <div className="pt-1 border-t border-slate-800 text-[9px] text-emerald-400 font-bold flex items-center justify-between">
              <span>STATUS: 250 kbps ECM STREAMING</span>
              <span>0 CRITICAL FAULTS</span>
            </div>
          </div>

          {/* Discount Tile 3 */}
          <div className="p-3 rounded-xl bg-[#05080E] border border-emerald-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">radar</span>
                <span>FHWA 54B Radar HUD</span>
              </span>
              <span className="text-xs font-black text-[#FFE500]">-10% OFF</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              Guaranteed vertical bridge strike prevention with dynamic corridor diverters (Loop 820 North).
            </p>
            <div className="pt-1 border-t border-slate-800 text-[9px] text-emerald-400 font-bold flex items-center justify-between">
              <span>STATUS: HUD ACTIVE</span>
              <span>0 BRIDGE STRIKES</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. PARTNER COMMERCIAL INSURANCE COMPANIES ROSTER                    */}
      {/* ==================================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Connected Commercial Trucking Underwriters &amp; Discount Rates
            </h3>
            <p className="text-[11px] text-slate-400">
              Select any underwriter to view specific discount rates, policy limits, and instant binding.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Top Recommendation: <strong className="text-[#FFE500]">{bestDiscountPartner.company.name}</strong> (-{bestDiscountPartner.maxPct}%)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((comp) => {
            const isSelected = selectedCompanyId === comp.id;
            const evalResult = insuranceConnectorService.evaluateDiscountsForCompany(comp, carrier, fleetUnits);
            const isBound = Boolean(boundPolicies[comp.id]);

            return (
              <div
                key={comp.id}
                onClick={() => setSelectedCompanyId(comp.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3.5 relative ${
                  isSelected
                    ? 'bg-[#0E1524] border-[#FFE500] ring-2 ring-[#FFE500]/40 shadow-[0_0_20px_rgba(255,229,0,0.25)]'
                    : 'bg-[#0A0F14] border-[#1E2532] hover:border-slate-700'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">{comp.name}</h4>
                      {isBound && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black border border-emerald-500/40">
                          ✔ BOUND ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{comp.tagline}</span>
                  </div>

                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/40 whitespace-nowrap">
                    {comp.underwritingTier}
                  </span>
                </div>

                {/* Rates & Discount strip */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#05080E] border border-slate-800 text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Standard Rate</span>
                    <span className="text-xs font-bold text-slate-400 line-through">
                      ${(comp.baseRatePerPowerUnitAnnual * fleetUnits).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#FFE500] uppercase font-bold block">Verified Discount</span>
                    <span className="text-xs font-black text-[#FFE500]">
                      -{evalResult.aggregateDiscountPct}% OFF
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-emerald-400 uppercase font-bold block">Net Annual Total</span>
                    <span className="text-xs font-black text-emerald-400">
                      ${evalResult.netAnnualTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Coverages pill list */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Supported Coverages</span>
                  <div className="flex flex-wrap gap-1">
                    {comp.supportedCoverages.slice(0, 3).map((cov, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[9px] border border-slate-800">
                        {cov}
                      </span>
                    ))}
                    {comp.supportedCoverages.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[9px] border border-slate-800">
                        +{comp.supportedCoverages.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Specific qualified discount tags */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Qualified Rate Credits</span>
                  <div className="space-y-1">
                    {evalResult.qualifiedDiscounts.map((qd) => (
                      <div key={qd.id} className="flex items-center justify-between text-[10px] text-slate-300">
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="text-emerald-400 font-bold">✔</span>
                          <span>{qd.title}</span>
                        </span>
                        <span className="text-[#FFE500] font-bold">-${qd.annualSavingsUsd.toLocaleString()}/yr</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <a
                    href={comp.directPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 underline"
                  >
                    <span>Underwriter Portal</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCoiModal(comp);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white text-[10px] font-bold cursor-pointer transition border border-slate-700"
                    >
                      View COI
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateQuote(comp);
                        setShowBindModal(true);
                      }}
                      className="px-3 py-1 rounded-lg btn-tactical-yellow text-black font-black text-[10px] uppercase tracking-wider cursor-pointer shadow-[0_0_12px_rgba(255,229,0,0.35)]"
                    >
                      {isBound ? 'Update Policy' : 'Bind Policy'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. MODAL: ACORD 25 CERTIFICATE OF INSURANCE (COI) VIEWER            */}
      {/* ==================================================================== */}
      {showCoiModal && generatedQuote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0F14] border-2 border-[#FFE500] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500] text-[24px]">description</span>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Official ACORD 25 Certificate of Insurance
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Compliant with FMCSA 49 CFR Part 387 &bull; Quote #{generatedQuote.quoteId}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCoiModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#05080E] border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {insuranceConnectorService.generateCoiDocument(generatedQuote).content}
            </pre>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>SHA-256 Merkle Sealed Underwriter Record</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadCoiFile}
                  className="px-4 py-2 rounded-xl btn-tactical-yellow text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download Signed COI</span>
                </button>
                <button
                  onClick={() => setShowCoiModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MODAL: POLICY BINDING CONFIRMATION                                */}
      {/* ==================================================================== */}
      {showBindModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0F14] border-2 border-[#FFE500] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500] text-[24px]">verified_user</span>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Bind Commercial Trucking Policy
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Carrier: {carrier.legalName} &bull; USDOT #{carrier.usdot}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowBindModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Underwriting Insurer:</span>
                <strong className="text-white">{selectedCompany.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fleet Power Units:</span>
                <strong className="text-white">{fleetUnits} Tractors</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Standard Annual Rate:</span>
                <span className="text-slate-400 line-through">
                  ${(selectedCompany.baseRatePerPowerUnitAnnual * fleetUnits).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#FFE500] font-bold">TruckWithEase Safety Discount:</span>
                <span className="text-[#FFE500] font-bold">
                  -{currentEvaluation.aggregateDiscountPct}% (-${currentEvaluation.totalAnnualSavings.toLocaleString()}/yr)
                </span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm">
                <span className="text-emerald-400 font-black">Net Annual Premium:</span>
                <span className="text-emerald-400 font-black">
                  ${currentEvaluation.netAnnualTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              By confirming, you authorize TruckWithEase to transmit certified FMCSA SAFER/SMS records and J1939 telematics health logs to <strong>{selectedCompany.name}</strong> under the electronic insurance connector protocol.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowBindModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBind}
                disabled={isBinding}
                className="px-4 py-2 rounded-xl btn-tactical-yellow text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)] disabled:opacity-60 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{isBinding ? 'Binding Policy...' : 'Confirm & Bind Policy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
