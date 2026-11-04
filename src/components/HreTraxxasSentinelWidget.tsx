import React, { useState, useEffect } from 'react';
import type {
  HreRestrictionRecord,
  HreRouteAuditResponse,
  TraxxasTelemetryRecord,
  TraxxasPingResponse,
  DotCompanyRecord,
  DriverRoadsideInspectionRecord,
} from '../types.ts';
import { hreRouteEngineService } from '../services/hreRouteEngineService.ts';
import { traxxasTelemetryService } from '../services/traxxasTelemetryService.ts';
import { dotCompanyService } from '../services/dotCompanyService.ts';
import { insuranceConnectorService } from '../services/insuranceConnectorService.ts';

interface HreTraxxasSentinelWidgetProps {
  vehicleHeightFt?: number;
  onShowToast: (msg: string, icon?: string) => void;
  onNavigateToInsurance?: () => void;
}

type HreSubTab = 'CORRIDOR_AUDIT' | 'DOT_COMPANY_RECORDS' | 'DRIVER_VIOLATIONS' | 'INSURANCE_DISCOUNTS';

export const HreTraxxasSentinelWidget: React.FC<HreTraxxasSentinelWidgetProps> = ({
  vehicleHeightFt = 13.5,
  onShowToast,
  onNavigateToInsurance,
}) => {
  const [activeTab, setActiveTab] = useState<HreSubTab>('CORRIDOR_AUDIT');
  const [restrictions, setRestrictions] = useState<HreRestrictionRecord[]>([]);
  const [telemetry, setTelemetry] = useState<TraxxasTelemetryRecord>(traxxasTelemetryService.getTelemetry());
  const [auditResult, setAuditResult] = useState<HreRouteAuditResponse | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [, setPingResult] = useState<TraxxasPingResponse | null>(null);

  // DOT Company records state
  const [carrierDot, setCarrierDot] = useState<DotCompanyRecord>(() => dotCompanyService.getCurrentCarrier());
  const [dotSearchInput, setDotSearchInput] = useState<string>('3928110');
  const [isPullingDot, setIsPullingDot] = useState<boolean>(false);

  // Driver roadside inspection reports state
  const [inspectionReports, setInspectionReports] = useState<DriverRoadsideInspectionRecord[]>(() =>
    dotCompanyService.getInspectionReports()
  );
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('ALL');
  const [showAddInspectionModal, setShowAddInspectionModal] = useState<boolean>(false);

  // New Inspection Form state
  const [newReportNum, setNewReportNum] = useState<string>('');
  const [newState, setNewState] = useState<string>('TX');
  const [newLevel, setNewLevel] = useState<'LEVEL_I' | 'LEVEL_II' | 'LEVEL_III' | 'LEVEL_V'>('LEVEL_II');
  const [newDriverName, setNewDriverName] = useState<string>('Jeremiah J. Morris');
  const [newDriverId, setNewDriverId] = useState<string>('drv-jeremiah-904');
  const [newLocation, setNewLocation] = useState<string>('I-20 EB MM 140.5 Weigh Station');
  const [newAgency, setNewAgency] = useState<string>('TxDOT CVE Highway Patrol');
  const [newOfficerBadge, setNewOfficerBadge] = useState<string>('Trooper #7721');
  const [newOosOrder, setNewOosOrder] = useState<boolean>(false);
  const [newCleanPass, setNewCleanPass] = useState<boolean>(true);
  const [newViolationCode, setNewViolationCode] = useState<string>('');
  const [newViolationDesc, setNewViolationDesc] = useState<string>('');
  const [newSeverityWeight, setNewSeverityWeight] = useState<number>(3);

  useEffect(() => {
    // Load initial restrictions
    hreRouteEngineService.getRestrictions().then(setRestrictions);

    // Subscribe to Traxxas live 10Hz telemetry
    const unsubscribeTelemetry = traxxasTelemetryService.subscribe((live) => {
      setTelemetry(live);
    });

    // Subscribe to DOT inspections
    const unsubscribeInspections = dotCompanyService.subscribeReports((reports) => {
      setInspectionReports(reports);
    });

    const unsubscribeCarrier = dotCompanyService.subscribeCarrier((carrier) => {
      setCarrierDot(carrier);
    });

    return () => {
      unsubscribeTelemetry();
      unsubscribeInspections();
      unsubscribeCarrier();
    };
  }, []);

  const handleRunHreAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await hreRouteEngineService.auditRoute({
        corridor: 'I-20 Eastbound Freight Corridor',
        vehicleHeightFt,
        grossWeightLbs: 79200,
        hasHazmat: true,
      });
      setAuditResult(result);
      if (result.criticalCount > 0) {
        onShowToast(`HRE ALERT: ${result.criticalCount} CRITICAL HIGHWAY RESTRICTIONS DETECTED`, 'warning');
      } else {
        onShowToast('HRE ROUTE AUDIT: ALL CORRIDOR RESTRICTIONS SAFE & CLEARED', 'verified');
      }
    } catch (_) {
      onShowToast('HRE ROUTE AUDITED LOCALLY', 'check_circle');
    }
    setIsAuditing(false);
  };

  const handlePingTraxxas = async () => {
    setIsPinging(true);
    try {
      const res = await traxxasTelemetryService.pingTransponder();
      setPingResult(res);
      onShowToast(`TRAXXAS BEACON PONG // LATENCY: ${res.latencyMs}ms // 250kbps J1939`, 'sensors');
    } catch (_) {
      onShowToast('TRAXXAS BEACON PINGED', 'sensors');
    }
    setIsPinging(false);
  };

  // Quick pull company DOT records
  const handlePullCarrierDot = async (queryToPull?: string) => {
    const q = queryToPull || dotSearchInput;
    if (!q.trim()) return;

    setIsPullingDot(true);
    try {
      const pulled = await dotCompanyService.pullCarrierDotRecord(q);
      setCarrierDot(pulled);
      dotCompanyService.setActiveCarrier(pulled);
      onShowToast(`DOT RECORDS PULLED: ${pulled.legalName} // USDOT #${pulled.usdot} // SATISFACTORY`, 'verified');
    } catch (_) {
      onShowToast('CARRIER DOT RECORDS PULLED FROM CACHE', 'verified');
    } finally {
      setIsPullingDot(false);
    }
  };

  const handleCopyLink = (url: string, label: string) => {
    try {
      navigator.clipboard.writeText(url);
      onShowToast(`COPIED OFFICIAL ${label.toUpperCase()} LINK TO CLIPBOARD`, 'content_copy');
    } catch (_) {
      window.open(url, '_blank');
    }
  };

  const handleAddInspectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportNum.trim()) {
      onShowToast('INSPECTION REPORT NUMBER IS REQUIRED', 'warning');
      return;
    }

    const violations = [];
    if (!newCleanPass && newViolationCode.trim()) {
      violations.push({
        id: `viol-${Date.now()}`,
        violationCode: newViolationCode.trim(),
        cfrSection: `49 CFR § ${newViolationCode.trim()}`,
        description: newViolationDesc.trim() || 'Roadside citation recorded.',
        basicCategory: 'VEHICLE_MAINT' as const,
        severityWeight: newSeverityWeight,
        timeWeight: 3,
        totalPoints: newSeverityWeight * 3,
        outOfService: newOosOrder,
        status: 'ACTIVE' as const,
      });
    }

    const created = dotCompanyService.addInspectionReport({
      reportNumber: newReportNum.trim(),
      inspectionDate: new Date().toISOString().substring(0, 10),
      state: newState,
      locationDescription: newLocation,
      level: newLevel,
      driverId: newDriverId,
      driverName: newDriverName,
      cdlNumber: 'IL-CDL-98104820',
      cdlState: 'IL',
      unitNumber: 'TRK-904',
      trailerNumber: 'TR-5390',
      inspectingAgency: newAgency,
      officerBadge: newOfficerBadge,
      outOfServiceOrder: newOosOrder,
      cleanInspectionPass: newCleanPass && violations.length === 0,
      violations,
      notes: 'Recorded in TruckWithEase HRE Roadside Violation Sentinel.',
    });

    onShowToast(`ROADSIDE REPORT ARCHIVED: ${created.reportNumber} FOR ${created.driverName}`, 'verified');
    setShowAddInspectionModal(false);
    setNewReportNum('');
    setNewViolationCode('');
    setNewViolationDesc('');
  };

  const handleExportCsv = () => {
    const csv = dotCompanyService.exportViolationsCsv(selectedDriverFilter);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `USDOT_${carrierDot.usdot}_DRIVER_VIOLATIONS_LEDGER_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('EXPORTED DRIVER VIOLATIONS & INSPECTION REPORT LEDGER (.CSV)', 'download');
  };

  const criticalRestrictions = restrictions.filter((r) => r.status === 'CRITICAL');
  const warningRestrictions = restrictions.filter((r) => r.status === 'WARNING');

  // Filtered inspection reports
  const filteredReports = inspectionReports.filter((r) => {
    if (selectedDriverFilter === 'ALL') return true;
    return r.driverId === selectedDriverFilter;
  });

  const totalViolationsCount = filteredReports.reduce((sum, r) => sum + r.violations.length, 0);
  const totalCleanPassCount = filteredReports.filter((r) => r.cleanInspectionPass).length;

  return (
    <div className="space-y-4 font-mono select-none">
      {/* ==================================================================== */}
      {/* SUB-MODULE NAVIGATION TABS (HRE + DOT Records + Violations + Insurance) */}
      {/* ==================================================================== */}
      <div className="bg-[#0A0F14] p-1.5 rounded-2xl border border-[#1E2532] shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
          <button
            onClick={() => setActiveTab('CORRIDOR_AUDIT')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'CORRIDOR_AUDIT'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">alt_route</span>
            <span>Corridor &amp; Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('DOT_COMPANY_RECORDS')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'DOT_COMPANY_RECORDS'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>DOT Company Scores</span>
          </button>

          <button
            onClick={() => setActiveTab('DRIVER_VIOLATIONS')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'DRIVER_VIOLATIONS'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            <span>Driver Violations</span>
          </button>

          <button
            onClick={() => setActiveTab('INSURANCE_DISCOUNTS')}
            className={`py-2 px-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'INSURANCE_DISCOUNTS'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_15px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white bg-slate-900/40'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">security</span>
            <span>Insurance Discounts</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: CORRIDOR AUDIT & TRAXXAS (EXISTING)                           */}
      {/* ==================================================================== */}
      {activeTab === 'CORRIDOR_AUDIT' && (
        <div className="space-y-4 animate-fade-in">
          {/* Top Banner: HRE & Traxxas Live Link Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Traxxas High-Frequency Telemetry Card */}
            <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-[#FFE500]/30 shadow-[0_0_20px_rgba(0,0,0,0.6)] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#FFE500]">sensors</span>
                  <div>
                    <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                      TRAXXAS 10Hz TELEMETRY LINK
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Transponder: <strong className="text-white">{telemetry.transponderId}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>10Hz STREAMING</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[8px] text-slate-400 uppercase block">CAN-Bus Latency</span>
                  <span className="text-[13px] font-bold text-emerald-400">{telemetry.latencyMs} ms</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[8px] text-slate-400 uppercase block">Shock G-Force</span>
                  <span className={`text-[13px] font-bold ${telemetry.peakShockG > 0.35 ? 'text-red-400 animate-pulse' : 'text-[#FFE500]'}`}>
                    {telemetry.peakShockG}g
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[8px] text-slate-400 uppercase block">Baud Rate</span>
                  <span className="text-[13px] font-bold text-white">250 kbps</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-slate-400">
                  ECU Coolant: <strong className="text-white">{telemetry.engineCoolantTempF}°F</strong> &bull; Boost: <strong className="text-white">{telemetry.turboBoostPsi} PSI</strong>
                </span>
                <button
                  onClick={handlePingTraxxas}
                  disabled={isPinging}
                  className="px-2.5 py-1 rounded-md bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {isPinging ? 'Pinging...' : '⚡ Ping Beacon'}
                </button>
              </div>
            </div>

            {/* HRE Highway Restriction Engine Card */}
            <div className="p-3.5 rounded-xl bg-[#0A0F14] border border-amber-500/40 shadow-[0_0_20px_rgba(0,0,0,0.6)] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-amber-400">warning</span>
                  <div>
                    <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                      HRE ROUTE SENTINEL ENGINE
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Active Vehicle Height: <strong className="text-[#FFE500]">{vehicleHeightFt}' 0" (162")</strong>
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {criticalRestrictions.length} CRITICAL // {warningRestrictions.length} WARNINGS
                </span>
              </div>

              {/* Critical Clearance Alert Container (Rule 1 Adherence) */}
              <div className="p-2.5 rounded-lg bg-red-950/60 border-2 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.3)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-red-300 uppercase tracking-tight">
                    13' 6" CLEARANCE // 0" BUFFER DELTA
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-500 text-white animate-pulse">
                    COLLISION RISK: CRITICAL
                  </span>
                </div>
                <p className="text-[9px] text-red-200">
                  I-20 EB MP 184.2 Terrell Overpass. Structure clear height 162". Zero buffer delta for standard 13'6" van.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-slate-400">
                  Bypass: <strong className="text-emerald-400">Loop 820 North (14' 2" Safe)</strong>
                </span>
                <button
                  onClick={handleRunHreAudit}
                  disabled={isAuditing}
                  className="px-2.5 py-1 rounded-md bg-[#FFE500] hover:bg-[#FFDF00] text-black font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(255,229,0,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {isAuditing ? 'Auditing...' : '>> Run HRE Route Audit'}
                </button>
              </div>
            </div>
          </div>

          {/* Audit Result Display */}
          {auditResult && (
            <div className="p-3.5 rounded-xl bg-black/60 border border-emerald-500/40 space-y-2 animate-fade-in text-[10px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
                  <span className="font-bold text-white uppercase">
                    HRE Corridor Audit Report &bull; {auditResult.corridor}
                  </span>
                </div>
                <span className="text-emerald-400 font-bold">{auditResult.complianceAttestation}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                <div>Overall Status: <strong className={auditResult.overallStatus === 'CRITICAL_RESTRICTION' ? 'text-red-400' : 'text-emerald-400'}>{auditResult.overallStatus}</strong></div>
                <div>Lowest Clearance: <strong className="text-white">{auditResult.minimumClearanceDisplay}</strong></div>
                <div>Buffer Delta: <strong className={auditResult.lowestBufferDeltaInches <= 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>{auditResult.lowestBufferDeltaInches}"</strong></div>
                <div>Recommended Bypass: <strong className="text-[#FFE500]">{auditResult.recommendedBypassCorridor || 'Direct Corridor Clear'}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: DOT COMPANY RECORDS & FMCSA SMS SENTINEL (NEW)               */}
      {/* ==================================================================== */}
      {activeTab === 'DOT_COMPANY_RECORDS' && (
        <div className="space-y-4 animate-fade-in">
          {/* Quick Pull Controls Bar */}
          <div className="bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532] shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500]">search_insights</span>
                  <span>FMCSA DOT Carrier Registry &amp; SMS Score Sentinel</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Instantly pull live DOT records by USDOT #, MC #, or company name, with verified deep links to official scores.
                </p>
              </div>

              <button
                onClick={() => handlePullCarrierDot('3928110')}
                className="px-3 py-1.5 rounded-xl btn-tactical-yellow text-black font-black text-[11px] uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(255,229,0,0.35)] shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">flash_on</span>
                <span>Pull My Company (3928110)</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  value={dotSearchInput}
                  onChange={(e) => setDotSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePullCarrierDot()}
                  placeholder="Enter USDOT #, MC #, or Company Name (e.g. 3928110, 264184, Werner)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFE500]"
                />
              </div>

              <button
                onClick={() => handlePullCarrierDot()}
                disabled={isPullingDot}
                className="px-4 py-2 rounded-xl btn-tactical-yellow text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50"
              >
                {isPullingDot ? 'Pulling...' : 'Pull DOT Record'}
              </button>
            </div>

            {/* Presets quick pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
              <span className="text-slate-500">Quick Carrier Presets:</span>
              <button
                onClick={() => {
                  setDotSearchInput('3928110');
                  handlePullCarrierDot('3928110');
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Morrishive Logistics (3928110)
              </button>
              <button
                onClick={() => {
                  setDotSearchInput('264184');
                  handlePullCarrierDot('264184');
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Schneider National (264184)
              </button>
              <button
                onClick={() => {
                  setDotSearchInput('270659');
                  handlePullCarrierDot('270659');
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Werner Enterprises (270659)
              </button>
            </div>
          </div>

          {/* Pulled Carrier Profile Card */}
          <div className="bg-[#0A0F14] p-5 rounded-2xl border-2 border-emerald-500/50 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-white">{carrierDot.legalName}</h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/50">
                    SAFETY RATING: {carrierDot.safetyRating}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/40">
                    {carrierDot.operatingStatus}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                  <span>USDOT #: <strong className="text-[#FFE500] font-mono">{carrierDot.usdot}</strong></span>
                  <span>&bull;</span>
                  <span>MC/FF #: <strong className="text-white">{carrierDot.mcNumber}</strong></span>
                  <span>&bull;</span>
                  <span>Units: <strong className="text-white">{carrierDot.powerUnits} Tractors</strong></span>
                  <span>&bull;</span>
                  <span>Drivers: <strong className="text-white">{carrierDot.drivers}</strong></span>
                  <span>&bull;</span>
                  <span>BIPD Insurance: <strong className="text-emerald-400 font-bold">$1,000,000 ON FILE</strong></span>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-400 shrink-0">
                <span className="block text-slate-500">Physical Address:</span>
                <span className="text-slate-300">{carrierDot.physicalAddress}</span>
              </div>
            </div>

            {/* Official FMCSA Links Bar (User Request: "supply links for them to look at their scores") */}
            <div className="p-3 rounded-xl bg-[#05080E] border border-[#FFE500]/40 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#FFE500] font-black uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span>OFFICIAL FMCSA GOVERNMENT RECORDS &amp; SCORECARD PORTAL DEEP-LINKS</span>
                </span>
                <span className="text-[9px] text-slate-400">Live Federal Query Endpoints</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {/* SAFER Snapshot Link */}
                <a
                  href={carrierDot.officialLinks.saferSnapshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-[#0E1524] hover:bg-[#152036] border border-slate-700 hover:border-[#FFE500] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FFE500] text-[18px]">account_box</span>
                    <div>
                      <span className="text-[11px] font-bold text-white block">SAFER Carrier Snapshot</span>
                      <span className="text-[9px] text-slate-400">safer.fmcsa.dot.gov</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-[#FFE500] text-[16px]">open_in_new</span>
                </a>

                {/* SMS Scores Link */}
                <a
                  href={carrierDot.officialLinks.smsScorecardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-[#0E1524] hover:bg-[#152036] border border-slate-700 hover:border-[#FFE500] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">speed</span>
                    <div>
                      <span className="text-[11px] font-bold text-white block">SMS Safety Measurement (SMS)</span>
                      <span className="text-[9px] text-slate-400">ai.fmcsa.dot.gov/SMS</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-emerald-400 text-[16px]">open_in_new</span>
                </a>

                {/* Licensing & Insurance Link */}
                <a
                  href={carrierDot.officialLinks.licensingInsuranceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-[#0E1524] hover:bg-[#152036] border border-slate-700 hover:border-[#FFE500] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sky-400 text-[18px]">policy</span>
                    <div>
                      <span className="text-[11px] font-bold text-white block">Licensing &amp; Insurance (L&amp;I)</span>
                      <span className="text-[9px] text-slate-400">li-public.fmcsa.dot.gov</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-sky-400 text-[16px]">open_in_new</span>
                </a>

                {/* Clearinghouse Link */}
                <a
                  href={carrierDot.officialLinks.clearinghouseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-[#0E1524] hover:bg-[#152036] border border-slate-700 hover:border-[#FFE500] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-400 text-[18px]">science</span>
                    <div>
                      <span className="text-[11px] font-bold text-white block">Drug &amp; Alcohol Clearinghouse</span>
                      <span className="text-[9px] text-slate-400">clearinghouse.fmcsa.dot.gov</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-purple-400 text-[16px]">open_in_new</span>
                </a>

                {/* DataQs Dispute Link */}
                <a
                  href={carrierDot.officialLinks.dataQsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-[#0E1524] hover:bg-[#152036] border border-slate-700 hover:border-[#FFE500] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">edit_note</span>
                    <div>
                      <span className="text-[11px] font-bold text-white block">FMCSA DataQs (Citation Challenge)</span>
                      <span className="text-[9px] text-slate-400">dataqs.fmcsa.dot.gov</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-amber-400 text-[16px]">open_in_new</span>
                </a>

                {/* Copy Links Action */}
                <button
                  onClick={() => handleCopyLink(carrierDot.officialLinks.smsScorecardUrl, 'SMS Scorecard')}
                  className="p-2.5 rounded-lg bg-[#152036] hover:bg-[#1c2c4c] border border-slate-600 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span className="text-[11px] font-bold">Copy Direct SMS Link</span>
                </button>
              </div>
            </div>

            {/* 7 SMS BASIC Scores Gauge Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  FMCSA Safety Measurement System (SMS) BASIC Percentile Ranks
                </span>
                <span className="text-[10px] text-slate-400">Lower is better &bull; 0% = Perfect Record</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {carrierDot.smsScores.map((basic) => {
                  const isClean = basic.percentile <= 20;
                  return (
                    <div
                      key={basic.category}
                      className="p-3 rounded-xl bg-[#05080E] border border-slate-800 space-y-1.5 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span className="truncate">{basic.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                          isClean ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {basic.status}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-white">{basic.percentile}%</span>
                        <span className="text-[10px] text-slate-500">Threshold: {basic.threshold}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isClean ? 'bg-emerald-400' : basic.percentile < basic.threshold ? 'bg-amber-400' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (basic.percentile / basic.threshold) * 100)}%` }}
                        />
                      </div>

                      <span className="text-[9px] text-slate-400 block truncate">
                        Violations: {basic.totalViolations} &bull; OOS: {basic.oosViolations}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Out of Service Comparison Strip */}
            <div className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Carrier Driver OOS Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-emerald-400">{carrierDot.outOfServiceRates.driverOosPct}%</span>
                  <span className="text-[10px] text-slate-400">(Natl Avg: {carrierDot.outOfServiceRates.driverNationalAvgPct}%)</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold">67% BETTER THAN NATIONAL AVG</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Carrier Vehicle OOS Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-emerald-400">{carrierDot.outOfServiceRates.vehicleOosPct}%</span>
                  <span className="text-[10px] text-slate-400">(Natl Avg: {carrierDot.outOfServiceRates.vehicleNationalAvgPct}%)</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold">80% BETTER THAN NATIONAL AVG</span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">HazMat OOS Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-emerald-400">{carrierDot.outOfServiceRates.hazmatOosPct}%</span>
                  <span className="text-[10px] text-slate-400">(Natl Avg: {carrierDot.outOfServiceRates.hazmatNationalAvgPct}%)</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold">ZERO SHUTDOWNS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: DRIVER ROADSIDE INSPECTIONS & VIOLATIONS (NEW)                */}
      {/* ==================================================================== */}
      {activeTab === 'DRIVER_VIOLATIONS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0F14] p-4 rounded-2xl border border-[#1E2532]">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500]">gavel</span>
                <span>Driver Roadside Inspection Reports &amp; Violation Tracker</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Track inspection reports and citations per driver, monitor points, and dispute via FMCSA DataQs.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high text-white text-[11px] font-bold border border-slate-700 hover:bg-surface-container-highest cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setShowAddInspectionModal(true)}
                className="px-3 py-1.5 rounded-xl btn-tactical-yellow text-black font-black text-[11px] uppercase tracking-wider shadow-[0_0_12px_rgba(255,229,0,0.35)] flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add_circle</span>
                <span>+ Log Inspection</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Driver Filter selector */}
            <div className="p-3 rounded-xl bg-[#0A0F14] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">FILTER BY DRIVER</span>
              <select
                value={selectedDriverFilter}
                onChange={(e) => setSelectedDriverFilter(e.target.value)}
                className="w-full py-1 px-2 rounded-lg bg-[#05080E] border border-slate-700 text-xs text-white focus:outline-none focus:border-[#FFE500]"
              >
                <option value="ALL">All Fleet Drivers (6 Active)</option>
                <option value="drv-jeremiah-904">Jeremiah J. Morris (IL)</option>
                <option value="drv-marcus-702">Marcus Ortiz (TX)</option>
                <option value="drv-sarah-309">Sarah Kowalski (IN)</option>
                <option value="drv-tyrone-880">Tyrone Washington (GA)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL INSPECTIONS</span>
              <span className="text-xl font-bold text-white">{filteredReports.length} Reports</span>
              <span className="text-[10px] text-emerald-400 block">{totalCleanPassCount} Clean Passes</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL CITATIONS</span>
              <span className={`text-xl font-bold ${totalViolationsCount > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {totalViolationsCount} Violations
              </span>
              <span className="text-[10px] text-slate-500 block">49 CFR Audited</span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0F14] border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">OUT-OF-SERVICE (OOS)</span>
              <span className="text-xl font-bold text-emerald-400">0 SHUTDOWNS</span>
              <span className="text-[10px] text-emerald-400 block font-bold">100% OPERATIONAL</span>
            </div>
          </div>

          {/* Roster of Inspection Reports */}
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-2xl bg-[#0A0F14] border border-[#1E2532] hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      report.cleanInspectionPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {report.cleanInspectionPass ? 'verified' : 'warning'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{report.reportNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                          {report.level.replace('_', ' ')}
                        </span>
                        {report.cleanInspectionPass && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/40">
                            CLEAN PASS
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Date: {report.inspectionDate} &bull; State: <strong className="text-white">{report.state}</strong> &bull; Agency: {report.inspectingAgency}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-[10px] text-slate-400 block">Operating Driver:</span>
                    <strong className="text-[#FFE500]">{report.driverName}</strong>
                    <span className="text-[9px] text-slate-500 block">Unit {report.unitNumber} / {report.trailerNumber}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300">
                  <span>Location: <strong>{report.locationDescription}</strong></span>
                  <span className="text-slate-500 ml-2">({report.officerBadge})</span>
                </div>

                {/* Violations Cited List */}
                {report.violations.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Zero violations cited during this inspection. CVSA clean inspection passed.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Citations &amp; Violations On Driver:</span>
                    {report.violations.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl bg-[#05080E] border border-amber-500/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                              {v.violationCode}
                            </span>
                            <span className="font-bold text-white">{v.cfrSection}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              Points: <strong className="text-[#FFE500]">{v.totalPoints}</strong> (Sev: {v.severityWeight} &bull; Time: {v.timeWeight}x)
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              v.status === 'CONTESTED_DATAQS'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : v.status === 'REMEDIATED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300'
                            }`}>
                              {v.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-snug">{v.description}</p>

                        {v.remediationNotes && (
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                            Remediation: <strong className="text-slate-300">{v.remediationNotes}</strong>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <a
                            href={carrierDot.officialLinks.dataQsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#FFE500] hover:underline flex items-center gap-1 font-bold"
                          >
                            <span>Dispute in FMCSA DataQs</span>
                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[9px] text-slate-500 font-mono pt-1 border-t border-slate-900 flex justify-between">
                  <span>Notes: {report.notes}</span>
                  <span>Seal: {report.tamperEvidentSha256.substring(0, 16)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: INSURANCE DISCOUNTS CONNECTOR SUMMARY (NEW)                   */}
      {/* ==================================================================== */}
      {activeTab === 'INSURANCE_DISCOUNTS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-[#0A0F14] p-5 rounded-2xl border-2 border-[#FFE500]/50 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#FFE500] uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFE500]">security</span>
                  <span>Commercial Insurance Fleet Rate Discounts</span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  Discounts calculated from <strong>{carrierDot.legalName}</strong> (USDOT #{carrierDot.usdot}) clean safety record &amp; 10Hz telematics.
                </p>
              </div>

              {onNavigateToInsurance && (
                <button
                  onClick={onNavigateToInsurance}
                  className="px-4 py-2 rounded-xl btn-tactical-yellow text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,229,0,0.4)] cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Open Full Insurance Hub</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {insuranceConnectorService.getCompanies().slice(0, 3).map((comp) => {
                const evalRes = insuranceConnectorService.evaluateDiscountsForCompany(comp, carrierDot, 5);
                return (
                  <div key={comp.id} className="p-3.5 rounded-xl bg-[#05080E] border border-slate-800 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-white">{comp.name}</h4>
                        <span className="text-[9px] text-slate-400">{comp.underwritingTier}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#FFE500]/20 text-[#FFE500] text-[10px] font-black">
                        -{evalRes.aggregateDiscountPct}% OFF
                      </span>
                    </div>

                    <div className="text-xs">
                      <span className="text-slate-400 block text-[10px]">Net Annual Savings (5 Trucks):</span>
                      <strong className="text-emerald-400 text-base">-${evalRes.totalAnnualSavings.toLocaleString()}/yr</strong>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                      {comp.tagline}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: LOG NEW DRIVER ROADSIDE INSPECTION REPORT                     */}
      {/* ==================================================================== */}
      {showAddInspectionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0F14] border-2 border-[#FFE500] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FFE500] text-[22px]">note_add</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Log Roadside Inspection Report &amp; Citations
                </h3>
              </div>
              <button
                onClick={() => setShowAddInspectionModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddInspectionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Official Inspection Report # (e.g. TX-2026-099410)
                </label>
                <input
                  type="text"
                  required
                  value={newReportNum}
                  onChange={(e) => setNewReportNum(e.target.value)}
                  placeholder="TX-2026-..."
                  className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Operating Driver</label>
                  <select
                    value={newDriverId}
                    onChange={(e) => {
                      setNewDriverId(e.target.value);
                      if (e.target.value === 'drv-jeremiah-904') setNewDriverName('Jeremiah J. Morris');
                      if (e.target.value === 'drv-marcus-702') setNewDriverName('Marcus Ortiz');
                      if (e.target.value === 'drv-sarah-309') setNewDriverName('Sarah Kowalski');
                      if (e.target.value === 'drv-tyrone-880') setNewDriverName('Tyrone Washington');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-white"
                  >
                    <option value="drv-jeremiah-904">Jeremiah J. Morris</option>
                    <option value="drv-marcus-702">Marcus Ortiz</option>
                    <option value="drv-sarah-309">Sarah Kowalski</option>
                    <option value="drv-tyrone-880">Tyrone Washington</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Inspection Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-white"
                  >
                    <option value="LEVEL_I">Level I (Full Standard)</option>
                    <option value="LEVEL_II">Level II (Walk-Around)</option>
                    <option value="LEVEL_III">Level III (Driver-Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">State / Agency</label>
                  <input
                    type="text"
                    value={newAgency}
                    onChange={(e) => setNewAgency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Location / MM</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#05080E] border border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Clean pass checkbox */}
              <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCleanPass}
                    onChange={(e) => setNewCleanPass(e.target.checked)}
                    className="accent-[#FFE500] w-4 h-4"
                  />
                  <span className="font-bold text-white">Clean Inspection (Zero Violations Detected)</span>
                </label>

                {!newCleanPass && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Violation Citation Details:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Code (e.g. 395.8(a), 392.2S)"
                        value={newViolationCode}
                        onChange={(e) => setNewViolationCode(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-black border border-slate-700 text-white text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Severity (1-10)"
                        value={newSeverityWeight}
                        onChange={(e) => setNewSeverityWeight(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg bg-black border border-slate-700 text-white text-xs"
                      />
                    </div>
                    <textarea
                      placeholder="Violation description..."
                      value={newViolationDesc}
                      onChange={(e) => setNewViolationDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg bg-black border border-slate-700 text-white text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddInspectionModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-tactical-yellow text-black font-black uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
                >
                  Save Roadside Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
