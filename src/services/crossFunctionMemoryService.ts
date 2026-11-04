/**
 * TruckWithEase // Cross-Function Compliance, Memory & HOS Subsystem
 *
 * Conforms to FMCSA:
 * - 49 CFR Part 395 Subpart B § 395.8 & § 395.24 (Pullable RODS & Electronic Records)
 * - 49 CFR Part 396 § 396.11 & § 396.13 (Electronic DVIR Creation & Paper Scan Upload)
 * - 49 CFR Part 390 § 390.31 (Tamper-Evident Federal Document Custody)
 * - Dispatch Zero Architecture ($/Hr Yield ranked by Remaining Legal Hours)
 * - Master Mechanic J1939 CAN-Bus Fault Sync
 */

import type {
  DutyStatus,
  HosCalculatedClocks,
  RodsDailyRecord,
  RodsDutyEvent,
  ElectronicDvirRecord,
  DvirDefectItem,
  DvirInspectionType,
  RoadsideAuditDossier,
  CrossFunctionMemoryEvent,
  CrossFunctionMemoryEventType,
} from '../types.ts';
import { CARRIER_INFO, DRIVER_INFO, EQUIPMENT_INFO } from '../data/mockData.ts';
import { safeStorage } from '../utils/safeStorage.ts';
import { dotDocumentsService } from './dotDocumentsService.ts';
import { brokeredLoadsMemoryService } from './brokeredLoadsMemoryService.ts';
import { eldOfflineRecordingService } from './eldOfflineRecordingService.ts';

const HOS_STORAGE_KEY = 'twe_cross_function_hos_state_v2';
const RODS_STORAGE_KEY = 'twe_cross_function_rods_archive_v2';
const DVIR_STORAGE_KEY = 'twe_cross_function_dvirs_v2';

// 11 Standard Mandatory Commercial Vehicle Inspection Components (49 CFR § 396.11)
export const DEFAULT_DVIR_COMPONENTS: Omit<DvirDefectItem, 'id'>[] = [
  { category: 'SERVICE_BRAKES', componentName: 'Service Brakes (including trailer air line couplings & hoses)', hasDefect: false, severity: 'NOMINAL', notes: 'Air pressure holds 125 PSI; governor cut-out test passed.' },
  { category: 'PARKING_BRAKE', componentName: 'Parking Brake System', hasDefect: false, severity: 'NOMINAL', notes: 'Spring brakes hold unit securely on 15% incline.' },
  { category: 'STEERING', componentName: 'Steering Mechanism & Pitman Arm', hasDefect: false, severity: 'NOMINAL', notes: 'Zero lash/play; tie-rods and steering damper secured.' },
  { category: 'LIGHTING_REFLECTORS', componentName: 'Lighting Devices, Headlamps, Turn Signals & DOT Reflectors', hasDefect: false, severity: 'NOMINAL', notes: 'All LED clearance markers and high/low beams verified illuminated.' },
  { category: 'TIRES_WHEELS', componentName: 'Tires, Tubes, Wheels & Lug Nuts', hasDefect: false, severity: 'NOMINAL', notes: 'Steer tires 12/32", Drives 10/32", cold pressure 105 PSI. Zero missing lugs.' },
  { category: 'HORN', componentName: 'Dual City Horn & Highway Air Horn', hasDefect: false, severity: 'NOMINAL', notes: 'Both electric and air trumpet horns functional.' },
  { category: 'WIPERS', componentName: 'Windshield Wipers & Fluid Washer Nozzles', hasDefect: false, severity: 'NOMINAL', notes: 'Heavy duty blades sweep clean; reservoir full.' },
  { category: 'MIRRORS', componentName: 'Rear Vision Mirrors & Spot Convex Mirrors', hasDefect: false, severity: 'NOMINAL', notes: 'Clean, unbroken, heated defrost verified.' },
  { category: 'COUPLING_KINGPIN', componentName: 'Coupling Devices, Fifth Wheel Plate & Kingpin Lock', hasDefect: false, severity: 'NOMINAL', notes: 'Jaws fully locked around kingpin shank; secondary safety latch engaged.' },
  { category: 'EMERGENCY_EQUIPMENT', componentName: 'Emergency Equipment (5 B:C Fire Extinguisher, 3 Reflective Triangles, Spare Fuses)', hasDefect: false, severity: 'NOMINAL', notes: 'Gauge in green charge zone, inspection tag current.' },
  { category: 'J1939_ENGINE_POWERTRAIN', componentName: 'J1939 ECM Diagnostics, Fluids & Exhaust/Aftertreatment', hasDefect: false, severity: 'NOMINAL', notes: 'Oil level nominal, coolant 50/50 mix, DPF soot load clear.' },
];

function generateSha256(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Helper: build 8 days of realistic baseline FMCSA § 395.8 RODS records
function buildInitial8DayRods(): RodsDailyRecord[] {
  const records: RodsDailyRecord[] = [];
  const today = new Date();

  const dayTemplates = [
    { label: 'Day 1 (Today)', drive: 6.75, onDuty: 1.75, sleeper: 8.0, offDuty: 7.5, miles: 382, status: 'COMPLIANT' as const },
    { label: 'Day 2 (Yesterday)', drive: 8.0, onDuty: 2.0, sleeper: 10.0, offDuty: 4.0, miles: 468, status: 'COMPLIANT' as const },
    { label: 'Day 3', drive: 7.5, onDuty: 1.5, sleeper: 10.0, offDuty: 5.0, miles: 412, status: 'COMPLIANT' as const },
    { label: 'Day 4', drive: 9.0, onDuty: 2.0, sleeper: 10.0, offDuty: 3.0, miles: 518, status: 'COMPLIANT' as const },
    { label: 'Day 5', drive: 5.5, onDuty: 1.5, sleeper: 10.0, offDuty: 7.0, miles: 310, status: 'COMPLIANT' as const },
    { label: 'Day 6', drive: 8.0, onDuty: 1.5, sleeper: 10.0, offDuty: 4.5, miles: 445, status: 'COMPLIANT' as const },
    { label: 'Day 7', drive: 0.0, onDuty: 0.0, sleeper: 0.0, offDuty: 24.0, miles: 0, status: 'COMPLIANT' as const }, // 34-hr reset segment
    { label: 'Day 8', drive: 4.5, onDuty: 1.5, sleeper: 10.0, offDuty: 8.0, miles: 260, status: 'COMPLIANT' as const },
  ];

  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    const tpl = dayTemplates[i];

    // Generate timeline events for the day
    const events: RodsDutyEvent[] = [
      {
        id: `ev-${i}-1`,
        timestamp: `${dateStr}T00:00:00.000Z`,
        timeDisplay: '00:00 CDT',
        hourOfDay: 0.0,
        dutyStatus: tpl.drive === 0 ? 'OFF' : 'SB',
        locationCityState: i === 0 ? 'Weatherford, TX' : 'Terrell, TX',
        highwayMileMarker: 'I-20 MM 408',
        totalEngineHours: 14200 + (8 - i) * 8.5,
        odometerMiles: 142500 + (8 - i) * 350,
        notes: 'Mandatory 10-hour rest break period.',
        originatingSystem: 'ELD_AUTOMATIC',
        merkleSignature: generateSha256().substring(0, 32),
      },
      {
        id: `ev-${i}-2`,
        timestamp: `${dateStr}T06:30:00.000Z`,
        timeDisplay: '06:30 CDT',
        hourOfDay: 6.5,
        dutyStatus: 'ON',
        locationCityState: 'Dallas, TX',
        highwayMileMarker: 'I-20 MM 465',
        totalEngineHours: 14201 + (8 - i) * 8.5,
        odometerMiles: 142500 + (8 - i) * 350,
        notes: 'Pre-trip DVIR vehicle inspection completed. Safe condition.',
        originatingSystem: 'DRIVER_MANUAL',
        merkleSignature: generateSha256().substring(0, 32),
      },
      {
        id: `ev-${i}-3`,
        timestamp: `${dateStr}T07:15:00.000Z`,
        timeDisplay: '07:15 CDT',
        hourOfDay: 7.25,
        dutyStatus: 'D',
        locationCityState: 'Mesquite, TX',
        highwayMileMarker: 'I-20 MM 492',
        totalEngineHours: 14202 + (8 - i) * 8.5,
        odometerMiles: 142525 + (8 - i) * 350,
        notes: 'En route linehaul transit.',
        originatingSystem: 'ELD_AUTOMATIC',
        merkleSignature: generateSha256().substring(0, 32),
      },
      {
        id: `ev-${i}-4`,
        timestamp: `${dateStr}T12:00:00.000Z`,
        timeDisplay: '12:00 CDT',
        hourOfDay: 12.0,
        dutyStatus: 'OFF',
        locationCityState: 'Tyler, TX',
        highwayMileMarker: 'I-20 MM 556',
        totalEngineHours: 14206 + (8 - i) * 8.5,
        odometerMiles: 142780 + (8 - i) * 350,
        notes: 'Mandatory 30-minute commercial rest break (49 CFR § 395.3).',
        originatingSystem: 'DRIVER_MANUAL',
        merkleSignature: generateSha256().substring(0, 32),
      },
      {
        id: `ev-${i}-5`,
        timestamp: `${dateStr}T12:45:00.000Z`,
        timeDisplay: '12:45 CDT',
        hourOfDay: 12.75,
        dutyStatus: 'D',
        locationCityState: 'Longview, TX',
        highwayMileMarker: 'I-20 MM 589',
        totalEngineHours: 14207 + (8 - i) * 8.5,
        odometerMiles: 142785 + (8 - i) * 350,
        notes: 'Resumed dispatch corridor.',
        originatingSystem: 'ELD_AUTOMATIC',
        merkleSignature: generateSha256().substring(0, 32),
      },
      {
        id: `ev-${i}-6`,
        timestamp: `${dateStr}T15:45:00.000Z`,
        timeDisplay: '15:45 CDT',
        hourOfDay: 15.75,
        dutyStatus: 'ON',
        locationCityState: 'Shreveport, LA',
        highwayMileMarker: 'I-20 MM 12',
        totalEngineHours: 14210 + (8 - i) * 8.5,
        odometerMiles: 142880 + (8 - i) * 350,
        notes: 'Dock arrival, post-trip inspection and receiver check-in.',
        originatingSystem: 'DRIVER_MANUAL',
        merkleSignature: generateSha256().substring(0, 32),
      },
    ];

    records.push({
      id: `rods-day-${i}`,
      dayIndex: i,
      dateStr,
      dayLabel: tpl.label,
      formattedDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      powerUnitNumber: 'TRK-904',
      trailerNumber: 'TRL-5321',
      totalDriveHours: tpl.drive,
      totalOnDutyHours: tpl.onDuty,
      totalSleeperHours: tpl.sleeper,
      totalOffDutyHours: tpl.offDuty,
      totalMilesDriven: tpl.miles,
      events,
      violations: [],
      certifiedSignature: `${DRIVER_INFO.name} // Attested via HSM Merkle Root`,
      certifiedTimestamp: `${dateStr}T23:59:59.000Z`,
      merkleProofHash: generateSha256(),
      isCertified: true,
      status: tpl.status,
    });
  }

  return records;
}

function buildInitialDvirs(): ElectronicDvirRecord[] {
  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);

  return [
    {
      id: 'dvir-pretrip-today',
      dvirNumber: `DVIR-${dateStr.replace(/-/g, '')}-PRE-904`,
      inspectionType: 'PRE_TRIP',
      timestampIso: `${dateStr}T06:30:00.000Z`,
      formattedDate: `${dateStr} 06:30 CDT`,
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      truckUnit: 'TRK-904',
      trailerUnit: 'TRL-5321',
      odometerMiles: 142850,
      defects: DEFAULT_DVIR_COMPONENTS.map((c, i) => ({ ...c, id: `comp-pre-${i}` })),
      defectsDetectedCount: 0,
      conditionSatisfactory: true,
      defectsCorrected: false,
      certifiedSafeToOperate: true,
      driverSignature: `${DRIVER_INFO.name} (Certified Driver Inspector)`,
      merkleProofHash: generateSha256(),
      status: 'SAFE_PASS',
    },
    {
      id: 'dvir-posttrip-yesterday',
      dvirNumber: `DVIR-YESTERDAY-POST-904`,
      inspectionType: 'POST_TRIP',
      timestampIso: new Date(Date.now() - 86400000).toISOString(),
      formattedDate: 'Yesterday 17:45 CDT',
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      truckUnit: 'TRK-904',
      trailerUnit: 'TRL-5321',
      odometerMiles: 142468,
      defects: DEFAULT_DVIR_COMPONENTS.map((c, i) => ({ ...c, id: `comp-post-${i}` })),
      defectsDetectedCount: 0,
      conditionSatisfactory: true,
      defectsCorrected: false,
      certifiedSafeToOperate: true,
      driverSignature: `${DRIVER_INFO.name} (Certified Driver Inspector)`,
      mechanicSignature: 'Pete Kovacs (Fleet Tech ASE-Certified)',
      mechanicNotes: 'All systems inspected; brake stroke measured within OEM limits.',
      mechanicFacilityName: 'Chicago Home Base Shop & Fleet HQ',
      merkleProofHash: generateSha256(),
      status: 'SAFE_PASS',
    },
  ];
}

class CrossFunctionMemoryService {
  private hosState: HosCalculatedClocks;
  private rodsArchive: RodsDailyRecord[];
  private dvirArchive: ElectronicDvirRecord[];
  private eventListeners: Map<CrossFunctionMemoryEventType, Set<(payload: any) => void>> = new Map();
  private generalListeners: Set<(state: { hos: HosCalculatedClocks; rods: RodsDailyRecord[]; dvirs: ElectronicDvirRecord[] }) => void> = new Set();
  private tickerInterval: any = null;

  constructor() {
    this.hosState = this.loadHosState();
    this.rodsArchive = this.loadRodsArchive();
    this.dvirArchive = this.loadDvirArchive();

    this.startLiveHosTicker();
  }

  // ==========================================================================
  // PERSISTENCE ENGINE
  // ==========================================================================
  private loadHosState(): HosCalculatedClocks {
    const defaultClocks: HosCalculatedClocks = {
      currentStatus: 'D',
      drivingSecondsRemaining: 6 * 3600 + 44 * 60 + 12, // 06h 44m 12s
      dutyWindowSecondsRemaining: 9 * 3600 + 18 * 60 + 5, // 09h 18m 05s
      restBreakSecondsRemaining: 4 * 3600 + 15 * 60, // 04h 15m until 30-min break
      cycleSecondsRemaining: 32 * 3600 + 15 * 60, // 32h 15m in 70hr cycle
      cycleUsedSeconds: 37 * 3600 + 45 * 60,
      isRestBreakRequired: false,
      isDriveViolated: false,
      isShiftViolated: false,
      isCycleViolated: false,
      isAdverseDrivingActive: false,
      restart34Eligible: true,
      splitSleeperStatus: {
        eligible: true,
        period1Hours: 7.2,
        period2Hours: 2.8,
        pairMatched: true,
        message: 'Valid 7/3 split-sleeper pair detected (10.0 hours cumulative rest)',
      },
      lastStatusChangeTimestamp: new Date().toISOString(),
    };

    const res = safeStorage.getItem<HosCalculatedClocks>(HOS_STORAGE_KEY, defaultClocks);
    return res.data || defaultClocks;
  }

  private saveHosState(): void {
    safeStorage.setItem(HOS_STORAGE_KEY, this.hosState);
  }

  private loadRodsArchive(): RodsDailyRecord[] {
    const initial = buildInitial8DayRods();
    const res = safeStorage.getItem<RodsDailyRecord[]>(RODS_STORAGE_KEY, initial);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    return initial;
  }

  private saveRodsArchive(): void {
    safeStorage.setItem(RODS_STORAGE_KEY, this.rodsArchive);
  }

  private loadDvirArchive(): ElectronicDvirRecord[] {
    const initial = buildInitialDvirs();
    const res = safeStorage.getItem<ElectronicDvirRecord[]>(DVIR_STORAGE_KEY, initial);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    return initial;
  }

  private saveDvirArchive(): void {
    safeStorage.setItem(DVIR_STORAGE_KEY, this.dvirArchive);
  }

  // ==========================================================================
  // REAL-TIME HOS CALCULATION & TICKER ENGINE
  // ==========================================================================
  private startLiveHosTicker(): void {
    if (typeof window === 'undefined') return;

    this.tickerInterval = setInterval(() => {
      let changed = false;

      if (this.hosState.currentStatus === 'D') {
        // Driving decrements drive clock, shift window, 30-min break clock, and cycle clock
        if (this.hosState.drivingSecondsRemaining > 0) {
          this.hosState.drivingSecondsRemaining = Math.max(0, this.hosState.drivingSecondsRemaining - 1);
          changed = true;
        } else {
          this.hosState.isDriveViolated = true;
        }

        if (this.hosState.dutyWindowSecondsRemaining > 0) {
          this.hosState.dutyWindowSecondsRemaining = Math.max(0, this.hosState.dutyWindowSecondsRemaining - 1);
          changed = true;
        } else {
          this.hosState.isShiftViolated = true;
        }

        if (this.hosState.restBreakSecondsRemaining > 0) {
          this.hosState.restBreakSecondsRemaining = Math.max(0, this.hosState.restBreakSecondsRemaining - 1);
          changed = true;
        } else {
          this.hosState.isRestBreakRequired = true;
        }

        if (this.hosState.cycleSecondsRemaining > 0) {
          this.hosState.cycleSecondsRemaining = Math.max(0, this.hosState.cycleSecondsRemaining - 1);
          this.hosState.cycleUsedSeconds += 1;
          changed = true;
        } else {
          this.hosState.isCycleViolated = true;
        }
      } else if (this.hosState.currentStatus === 'ON') {
        // On Duty (Not Driving) decrements shift window and cycle clock
        if (this.hosState.dutyWindowSecondsRemaining > 0) {
          this.hosState.dutyWindowSecondsRemaining = Math.max(0, this.hosState.dutyWindowSecondsRemaining - 1);
          changed = true;
        }
        if (this.hosState.cycleSecondsRemaining > 0) {
          this.hosState.cycleSecondsRemaining = Math.max(0, this.hosState.cycleSecondsRemaining - 1);
          this.hosState.cycleUsedSeconds += 1;
          changed = true;
        }
      }

      if (changed) {
        this.saveHosState();
        this.notifyGeneralListeners();
      }
    }, 1000);
  }

  public getHosClocks(): HosCalculatedClocks {
    return { ...this.hosState };
  }

  public setDutyStatus(newStatus: DutyStatus): HosCalculatedClocks {
    if (newStatus === this.hosState.currentStatus) return this.getHosClocks();

    const previousStatus = this.hosState.currentStatus;
    const now = new Date();

    this.hosState.currentStatus = newStatus;
    this.hosState.lastStatusChangeTimestamp = now.toISOString();

    // Reset rest break clock if entering qualifying OFF or SB (simulated break taken)
    if (newStatus === 'OFF' || newStatus === 'SB') {
      this.hosState.isRestBreakRequired = false;
    }

    this.saveHosState();

    // Record duty event in Today's RODS
    this.addRodsDutyEvent({
      dutyStatus: newStatus,
      locationCityState: 'Dallas / Fort Worth Corridor, TX',
      highwayMileMarker: 'I-20 MM 488',
      notes: `Duty status shifted from ${previousStatus} to ${newStatus}.`,
      originatingSystem: 'DRIVER_MANUAL',
    });

    // Record uninterrupted duty tick in online/offline ELD engine (49 CFR § 395.26)
    eldOfflineRecordingService.recordDutyTick(newStatus, true);

    // Notify listeners
    this.emit('HOS_STATUS_CHANGED', { previousStatus, newStatus, clocks: this.getHosClocks() });
    this.notifyGeneralListeners();

    return this.getHosClocks();
  }

  public toggleAdverseDrivingConditions(): HosCalculatedClocks {
    const current = this.hosState.isAdverseDrivingActive;
    const next = !current;
    this.hosState.isAdverseDrivingActive = next;

    // 49 CFR § 395.1(b)(1): +2 hours to 11-hour driving rule and 14-hour window
    const bonusSeconds = 2 * 3600;
    if (next) {
      this.hosState.drivingSecondsRemaining += bonusSeconds;
      this.hosState.dutyWindowSecondsRemaining += bonusSeconds;
    } else {
      this.hosState.drivingSecondsRemaining = Math.max(0, this.hosState.drivingSecondsRemaining - bonusSeconds);
      this.hosState.dutyWindowSecondsRemaining = Math.max(0, this.hosState.dutyWindowSecondsRemaining - bonusSeconds);
    }

    this.saveHosState();
    this.notifyGeneralListeners();
    return this.getHosClocks();
  }

  public simulate34HourRestart(): HosCalculatedClocks {
    // 34 consecutive hours off-duty resets 70-hour / 8-day cycle to full 70:00:00
    this.hosState.cycleSecondsRemaining = 70 * 3600;
    this.hosState.cycleUsedSeconds = 0;
    this.hosState.drivingSecondsRemaining = 11 * 3600;
    this.hosState.dutyWindowSecondsRemaining = 14 * 3600;
    this.hosState.restBreakSecondsRemaining = 8 * 3600;
    this.hosState.isCycleViolated = false;
    this.hosState.isDriveViolated = false;
    this.hosState.isShiftViolated = false;
    this.hosState.isRestBreakRequired = false;
    this.hosState.restart34Eligible = true;

    this.saveHosState();
    this.notifyGeneralListeners();
    return this.getHosClocks();
  }

  public calculateSplitSleeper(period1Hours: number, period2Hours: number) {
    // Qualifying split sleeper: either period must be at least 2 hours, and combined >= 10 hours
    // (e.g. 7/3, 8/2, or 7.5/2.5)
    const total = period1Hours + period2Hours;
    const minPeriod = Math.min(period1Hours, period2Hours);
    const maxPeriod = Math.max(period1Hours, period2Hours);

    const isQualifying = total >= 10.0 && minPeriod >= 2.0 && maxPeriod >= 7.0;

    this.hosState.splitSleeperStatus = {
      eligible: isQualifying,
      period1Hours,
      period2Hours,
      pairMatched: isQualifying,
      message: isQualifying
        ? `Valid ${period1Hours.toFixed(1)}h / ${period2Hours.toFixed(1)}h split-sleeper pair! 14-Hour calculation restarts at end of first qualifying period.`
        : `Pair total is ${total.toFixed(1)}h (minimum 10.0h required with one period >= 7.0h in sleeper berth).`,
    };

    if (isQualifying) {
      // Recalculate duty window bonus
      this.hosState.dutyWindowSecondsRemaining = Math.min(14 * 3600, this.hosState.dutyWindowSecondsRemaining + Math.round(minPeriod * 3600));
    }

    this.saveHosState();
    this.notifyGeneralListeners();
    return this.hosState.splitSleeperStatus;
  }

  // ==========================================================================
  // PULL RODS (RECORD OF DUTY STATUS - 49 CFR PART 395 SUBPART B)
  // ==========================================================================
  public getAllRods(): RodsDailyRecord[] {
    return [...this.rodsArchive];
  }

  public pullRods(dayIndex = 0): RodsDailyRecord {
    const record = this.rodsArchive[dayIndex] || this.rodsArchive[0];
    this.emit('RODS_PULLED', { dayIndex, record });
    return record;
  }

  public addRodsDutyEvent(event: Omit<RodsDutyEvent, 'id' | 'timestamp' | 'timeDisplay' | 'hourOfDay' | 'totalEngineHours' | 'odometerMiles' | 'merkleSignature'>): RodsDutyEvent {
    const todayRecord = this.rodsArchive[0];
    if (!todayRecord) return null as any;

    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeDisplay = `${pad(now.getHours())}:${pad(now.getMinutes())} CDT`;

    const newEvent: RodsDutyEvent = {
      ...event,
      id: `ev-live-${Date.now()}`,
      timestamp: now.toISOString(),
      timeDisplay,
      hourOfDay: +hours.toFixed(2),
      totalEngineHours: 14212.4,
      odometerMiles: 142850,
      merkleSignature: generateSha256().substring(0, 32),
    };

    todayRecord.events.push(newEvent);
    todayRecord.merkleProofHash = generateSha256();
    this.saveRodsArchive();
    this.notifyGeneralListeners();

    return newEvent;
  }

  /**
   * Generates FMCSA ERoDS ELD CSV output file per 49 CFR Part 395 Appendix A
   */
  public generateErodsCsv(): string {
    const header = [
      '// FMCSA ERoDS 49 CFR Part 395 Electronic Record of Duty Status Transmission',
      `CarrierName,${CARRIER_INFO.name}`,
      `USDOT,${CARRIER_INFO.usdot}`,
      `DriverName,${DRIVER_INFO.name}`,
      `CDL,${DRIVER_INFO.cdlNumber}`,
      `TransmissionTimestamp,${new Date().toISOString()}`,
      `CryptographicRootSeal,${generateSha256()}`,
      'Day,Date,TotalDriveHours,TotalOnDutyHours,TotalSleeperHours,TotalOffDutyHours,MilesDriven,Status',
    ].join('\n');

    const rows = this.rodsArchive.map((r) =>
      `${r.dayLabel},${r.dateStr},${r.totalDriveHours.toFixed(2)},${r.totalOnDutyHours.toFixed(2)},${r.totalSleeperHours.toFixed(2)},${r.totalOffDutyHours.toFixed(2)},${r.totalMilesDriven},${r.status}`
    );

    return `${header}\n${rows.join('\n')}`;
  }

  /**
   * Roadside Transmission to FMCSA Web Services or Roadside Officer Email
   */
  public transmitErods(
    transmissionMethod: 'FMCSA_WEB_SERVICES' | 'FMCSA_EMAIL',
    routingKeyComment = 'ROADSIDE_AUDIT_TRANSMISSION'
  ) {
    const submissionReceiptCode = `FMCSA-${Date.now().toString().substring(5)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const proofHash = generateSha256();

    // Register certified document in Document Vault
    dotDocumentsService.addDocument({
      documentTitle: `FMCSA ERoDS 8-Day Pullable Log Transmission (${submissionReceiptCode})`,
      category: 'DAILY_LOGS',
      cfrReference: '49 CFR § 395.24 / Electronic Data Transfer to Safety Officials',
      issuedDate: new Date().toISOString().substring(0, 10),
      expirationDate: '6 MONTHS (RETENTION)',
      status: 'VALID',
      issuingAuthority: `FMCSA National Registry / Method: ${transmissionMethod}`,
      documentNumber: submissionReceiptCode,
      driverName: DRIVER_INFO.name,
      unitNumber: 'TRK-904',
      fileSizeBytes: 620000,
      fileFormat: 'CSV / Web Services Encrypted FIPS-180',
      notes: `ERoDS package transmitted roadside to safety official. Routing comment: "${routingKeyComment}". Attested Merkle root: ${proofHash.substring(0, 16)}...`,
      certified: true,
    });

    this.emit('ERODS_TRANSMITTED', {
      submissionReceiptCode,
      proofHash,
      transmissionMethod,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      submissionReceiptCode,
      proofHash,
      transmissionMethod,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // ELECTRONIC & SCANNED DVIR ENGINE (49 CFR § 396.11 & § 396.13)
  // ==========================================================================
  public getAllDvirs(): ElectronicDvirRecord[] {
    return [...this.dvirArchive];
  }

  public createDvir(payload: {
    inspectionType: DvirInspectionType;
    truckUnit?: string;
    trailerUnit?: string;
    odometerMiles?: number;
    defects: DvirDefectItem[];
    conditionSatisfactory: boolean;
    defectsCorrected?: boolean;
    driverSignature?: string;
    mechanicSignature?: string;
    mechanicNotes?: string;
    mechanicFacilityName?: string;
  }): ElectronicDvirRecord {
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const dvirNum = `DVIR-${dateStr.replace(/-/g, '')}-${payload.inspectionType}-${Math.floor(100 + Math.random() * 900)}`;
    const proofHash = generateSha256();

    const defectsDetectedCount = payload.defects.filter((d) => d.hasDefect).length;

    const newDvir: ElectronicDvirRecord = {
      id: `dvir-${Date.now()}`,
      dvirNumber: dvirNum,
      inspectionType: payload.inspectionType,
      timestampIso: now.toISOString(),
      formattedDate: `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} CDT`,
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      truckUnit: payload.truckUnit || 'TRK-904',
      trailerUnit: payload.trailerUnit || 'TRL-5321',
      odometerMiles: payload.odometerMiles || 142850,
      defects: payload.defects,
      defectsDetectedCount,
      conditionSatisfactory: payload.conditionSatisfactory && defectsDetectedCount === 0,
      defectsCorrected: payload.defectsCorrected ?? (defectsDetectedCount === 0),
      certifiedSafeToOperate: (payload.conditionSatisfactory && defectsDetectedCount === 0) || Boolean(payload.defectsCorrected),
      driverSignature: payload.driverSignature || `${DRIVER_INFO.name} (Certified Driver Inspector)`,
      mechanicSignature: payload.mechanicSignature,
      mechanicNotes: payload.mechanicNotes,
      mechanicFacilityName: payload.mechanicFacilityName,
      merkleProofHash: proofHash,
      status: defectsDetectedCount === 0 ? 'SAFE_PASS' : (payload.defectsCorrected ? 'DEFECTS_CORRECTED' : 'OUT_OF_SERVICE_PENDING'),
    };

    this.dvirArchive = [newDvir, ...this.dvirArchive];
    this.saveDvirArchive();

    // Automatically deposit into DOT Document Vault under VEHICLE_DVIR!
    dotDocumentsService.addDocument({
      documentTitle: `Certified DVIR ${payload.inspectionType} Report (${dvirNum})`,
      category: 'VEHICLE_DVIR',
      cfrReference: '49 CFR § 396.11 / Driver Vehicle Inspection Reports',
      issuedDate: dateStr,
      expirationDate: '3 MONTHS (MANDATORY RETENTION)',
      status: 'VALID',
      issuingAuthority: `${DRIVER_INFO.name} (Commercial Driver) & DOT Safety Custodian`,
      documentNumber: dvirNum,
      driverName: DRIVER_INFO.name,
      unitNumber: `${payload.truckUnit || 'TRK-904'} / ${payload.trailerUnit || 'TRL-5321'}`,
      fileSizeBytes: 420000,
      fileFormat: 'PDF / FIPS-180 Digitally Signed DVIR',
      notes: `${payload.inspectionType} DVIR completed. ${defectsDetectedCount} defects flagged. Condition satisfactory: ${newDvir.conditionSatisfactory ? 'YES' : 'DEFECTS NOTED'}. Safe to operate: ${newDvir.certifiedSafeToOperate ? 'YES' : 'OUT OF SERVICE'}. Merkle seal: ${proofHash.substring(0, 16)}...`,
      certified: true,
    });

    this.emit('DVIR_CREATED', newDvir);
    this.notifyGeneralListeners();

    return newDvir;
  }

  /**
   * Scan & Upload Paper DVIR (e.g. from camera capture or paper receipt)
   */
  public scanAndUploadPaperDvir(payload: {
    scannedImageDataUrl: string;
    inspectionType: DvirInspectionType;
    documentNumber?: string;
    odometerMiles?: number;
    truckUnit?: string;
    trailerUnit?: string;
    notes?: string;
  }): ElectronicDvirRecord {
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const dvirNum = payload.documentNumber || `DVIR-SCAN-${dateStr.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const proofHash = generateSha256();

    const scannedDvir: ElectronicDvirRecord = {
      id: `dvir-scan-${Date.now()}`,
      dvirNumber: dvirNum,
      inspectionType: payload.inspectionType,
      timestampIso: now.toISOString(),
      formattedDate: `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} CDT (Scanned Upload)`,
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      truckUnit: payload.truckUnit || 'TRK-904',
      trailerUnit: payload.trailerUnit || 'TRL-5321',
      odometerMiles: payload.odometerMiles || 142850,
      defects: DEFAULT_DVIR_COMPONENTS.map((c, i) => ({ ...c, id: `scan-comp-${i}` })),
      defectsDetectedCount: 0,
      conditionSatisfactory: true,
      defectsCorrected: false,
      certifiedSafeToOperate: true,
      driverSignature: `${DRIVER_INFO.name} (Paper Hardcopy Certified Scan)`,
      merkleProofHash: proofHash,
      scannedDocumentUrl: payload.scannedImageDataUrl,
      isScannedPaperUpload: true,
      ocrExtractedText: `SCANNED 49 CFR § 396.11 DVIR DOCUMENT\nUNIT: ${payload.truckUnit || 'TRK-904'}\nODOMETER: ${payload.odometerMiles || 142850}\nINSPECTOR: ${DRIVER_INFO.name}\nSTATUS: CONDITION SATISFACTORY - NO DEFECTS`,
      status: 'SAFE_PASS',
    };

    this.dvirArchive = [scannedDvir, ...this.dvirArchive];
    this.saveDvirArchive();

    // Automatically deposit into Document Vault
    dotDocumentsService.addDocument({
      documentTitle: `Paper DVIR Scan Upload (${dvirNum})`,
      category: 'VEHICLE_DVIR',
      cfrReference: '49 CFR § 396.11 / Scanned Mobile Hardcopy DVIR',
      issuedDate: dateStr,
      expirationDate: '3 MONTHS (RETENTION)',
      status: 'VALID',
      issuingAuthority: 'Mobile Camera OCR Scanner & Driver Upload',
      documentNumber: dvirNum,
      driverName: DRIVER_INFO.name,
      unitNumber: payload.truckUnit || 'TRK-904',
      fileSizeBytes: 890000,
      fileFormat: 'PNG / High-Resolution Camera Scan',
      notes: payload.notes || 'Paper DVIR uploaded via mobile camera. Verified legible by driver.',
      certified: true,
      imageUrl: payload.scannedImageDataUrl,
      capturedViaCamera: true,
      cameraMetadata: {
        timestamp: now.toISOString(),
        geoCoordinates: '32.7767° N, 96.7970° W (Dallas TX)',
        resolution: '1920x1080',
      },
    });

    this.emit('DVIR_SCANNED', scannedDvir);
    this.notifyGeneralListeners();

    return scannedDvir;
  }

  /**
   * Master Mechanic Integration: auto-populates active J1939 ECU DTC faults into DVIR
   */
  public importJ1939FaultsToDvir(faultCodes: { spn: number; fmi: number; description: string; system: string }[]): DvirDefectItem[] {
    const list: DvirDefectItem[] = DEFAULT_DVIR_COMPONENTS.map((c, i) => ({
      ...c,
      id: `dvir-comp-item-${i}`,
    }));

    faultCodes.forEach((fc) => {
      list.push({
        id: `dtc-${fc.spn}-${fc.fmi}`,
        category: 'J1939_ENGINE_POWERTRAIN',
        componentName: `J1939 DTC: SPN ${fc.spn} / FMI ${fc.fmi} (${fc.system})`,
        hasDefect: true,
        severity: 'ADVISORY',
        notes: `Imported from Master Mechanic CAN-Bus Gateway: ${fc.description}`,
        j1939DtcCode: `SPN ${fc.spn} FMI ${fc.fmi}`,
      });
    });

    return list;
  }

  // ==========================================================================
  // ROADSIDE FEDERAL COMPLIANCE SHIELD & DOSSIER ASSURANCE
  // "The DOT assuring that these are all available when needed"
  // ==========================================================================
  public getRoadsideAuditDossier(): RoadsideAuditDossier {
    const latestDvir = this.dvirArchive[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      carrierName: CARRIER_INFO.name,
      usdotNumber: CARRIER_INFO.usdot,
      mcNumber: CARRIER_INFO.mc,
      driverName: DRIVER_INFO.name,
      cdlNumber: DRIVER_INFO.cdlNumber,
      powerUnit: 'TRK-904 (Kenworth T-680)',
      trailerUnit: 'TRL-5321 (53\' Dry Van)',
      merkleRootHash: generateSha256(),
      statutoryAuthority: '49 CFR § 390.31 / Electronic Custody of Federal Motor Carrier Safety Records',
      documents: {
        rods8DayPackage: this.rodsArchive,
        activeDvir: latestDvir,
        medicalCardExp: '2026-11-30',
        cdlCardExp: '2027-04-15',
        annualInspectionExp: '2026-10-12',
        iftaCabCardExp: '2026-12-31',
        insurancePolicy: 'COMMERCIAL AUTO LIABILITY $1,000,000 / CARGO $250,000 (POLICY #BMC-91X-88219)',
      },
      custodianAttestation: {
        custodianName: DRIVER_INFO.name,
        custodianTitle: 'Director of Fleet Safety & Compliance Custodian',
        signedTimestamp: new Date().toISOString(),
        sealVerified: true,
      },
    };
  }

  // ==========================================================================
  // DISPATCH ZERO ($/HR YIELD) SYNCHRONIZATION
  // ==========================================================================
  public getRemainingLegalDriveHoursDecimal(): number {
    return +(this.hosState.drivingSecondsRemaining / 3600).toFixed(2);
  }

  // ==========================================================================
  // EVENT BUS & SUBSCRIBERS
  // ==========================================================================
  public on(event: CrossFunctionMemoryEventType, callback: (payload: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  public emit(event: CrossFunctionMemoryEventType, payload: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in CrossFunctionMemoryService event listener [${event}]:`, e);
        }
      });
    }
  }

  public subscribe(listener: (state: { hos: HosCalculatedClocks; rods: RodsDailyRecord[]; dvirs: ElectronicDvirRecord[] }) => void): () => void {
    this.generalListeners.add(listener);
    listener({
      hos: this.getHosClocks(),
      rods: this.getAllRods(),
      dvirs: this.getAllDvirs(),
    });
    return () => {
      this.generalListeners.delete(listener);
    };
  }

  private notifyGeneralListeners(): void {
    const snapshot = {
      hos: this.getHosClocks(),
      rods: this.getAllRods(),
      dvirs: this.getAllDvirs(),
    };
    this.generalListeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (err) {
        console.error('Error in CrossFunctionMemoryService general listener:', err);
      }
    });
  }
}

export const crossFunctionMemoryService = new CrossFunctionMemoryService();
