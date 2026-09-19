import { FuelLogEntry } from '../types';
import { fleetInvoicesService } from './fleetInvoicesService';

const FUEL_LOG_STORAGE_KEY = 'truck_with_ease_fuel_logs_v1';

export interface MpgEfficiencyMetrics {
  milesDriven: number;
  mpg: number;
  totalCost: number;
  costPerMile: number;
  ratingLabel: string;
  ratingColor: 'emerald' | 'amber' | 'rose' | 'outline';
  ratingAdvice: string;
}

const INITIAL_FUEL_LOGS: FuelLogEntry[] = [
  {
    id: 'fuel-log-01',
    date: '2026-09-14',
    timestamp: Date.now() - 3 * 86400000,
    gallons: 95.0,
    pricePerGallon: 3.89,
    totalCost: 369.55,
    previousOdometer: 141850,
    currentOdometer: 142500,
    milesDriven: 650,
    mpg: 6.84,
    costPerMile: 0.569,
    fuelType: 'DIESEL',
    stationName: "Love's Travel Stop #402 (I-44 MM 184)",
    notes: 'Full tank refuel before Missouri state line crossing.',
  },
  {
    id: 'fuel-log-02',
    date: '2026-09-16',
    timestamp: Date.now() - 1 * 86400000,
    gallons: 98.0,
    pricePerGallon: 3.85,
    totalCost: 377.30,
    previousOdometer: 142500,
    currentOdometer: 143180,
    milesDriven: 680,
    mpg: 6.94,
    costPerMile: 0.555,
    fuelType: 'DIESEL',
    stationName: 'Pilot Travel Center #118 (I-44 Exit 208)',
    notes: 'Interstate cruising, dry conditions, 64 MPH governed speed.',
  },
];

class FuelLogService {
  private logs: FuelLogEntry[] = [];
  private listeners: ((logs: FuelLogEntry[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(FUEL_LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      } else {
        this.logs = INITIAL_FUEL_LOGS;
        this.saveToStorage();
      }
    } catch (e) {
      console.error('Failed to load fuel logs from localStorage:', e);
      this.logs = INITIAL_FUEL_LOGS;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(FUEL_LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save fuel logs to localStorage:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  public subscribe(listener: (logs: FuelLogEntry[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getLogs(): FuelLogEntry[] {
    return [...this.logs];
  }

  public getLastOdometer(): number {
    if (this.logs.length === 0) return 143180;
    // Top-most log has the highest/most recent currentOdometer
    return this.logs[0].currentOdometer;
  }

  public calculateRealTimeMpg(
    gallons: number,
    pricePerGallon: number,
    currentOdometer: number,
    previousOdometer: number
  ): MpgEfficiencyMetrics {
    const milesDriven = Math.max(0, currentOdometer - previousOdometer);
    const totalCost = Number((Math.max(0, gallons) * Math.max(0, pricePerGallon)).toFixed(2));
    const mpg = gallons > 0 && milesDriven > 0 ? Number((milesDriven / gallons).toFixed(2)) : 0;
    const costPerMile = milesDriven > 0 ? Number((totalCost / milesDriven).toFixed(3)) : 0;

    let ratingLabel = 'AWAITING METRICS';
    let ratingColor: 'emerald' | 'amber' | 'rose' | 'outline' = 'outline';
    let ratingAdvice = 'Enter gallons, price, and current odometer to calculate live MPG.';

    if (mpg > 0) {
      if (mpg >= 7.2) {
        ratingLabel = 'OPTIMAL FLEET ECONOMY';
        ratingColor = 'emerald';
        ratingAdvice = 'Excellent fuel economy. Engine load & aerodynamics in peak efficiency band.';
      } else if (mpg >= 6.5) {
        ratingLabel = 'HEALTHY CRUISE MPG';
        ratingColor = 'emerald';
        ratingAdvice = 'Solid efficiency for loaded 80,000 lbs commercial tractor-trailer.';
      } else if (mpg >= 5.8) {
        ratingLabel = 'MODERATE CONSUMPTION';
        ratingColor = 'amber';
        ratingAdvice = 'Slightly elevated fuel burn. High payload, headwind, or elevation grade.';
      } else {
        ratingLabel = 'HIGH CONSUMPTION ALERT';
        ratingColor = 'rose';
        ratingAdvice = 'Excessive fuel consumption. Check tire pressure, APU runtime, or excessive idle.';
      }
    }

    return {
      milesDriven,
      mpg,
      totalCost,
      costPerMile,
      ratingLabel,
      ratingColor,
      ratingAdvice,
    };
  }

  public addFuelLog(params: {
    gallons: number;
    pricePerGallon: number;
    currentOdometer: number;
    previousOdometer: number;
    fuelType?: 'DIESEL' | 'DEF' | 'REEFER';
    stationName?: string;
    notes?: string;
  }): FuelLogEntry {
    const metrics = this.calculateRealTimeMpg(
      params.gallons,
      params.pricePerGallon,
      params.currentOdometer,
      params.previousOdometer
    );

    const now = new Date();
    const entry: FuelLogEntry = {
      id: `fuel-log-${Date.now()}`,
      date: now.toISOString().slice(0, 10),
      timestamp: Date.now(),
      gallons: params.gallons,
      pricePerGallon: params.pricePerGallon,
      totalCost: metrics.totalCost,
      previousOdometer: params.previousOdometer,
      currentOdometer: params.currentOdometer,
      milesDriven: metrics.milesDriven,
      mpg: metrics.mpg,
      costPerMile: metrics.costPerMile,
      fuelType: params.fuelType || 'DIESEL',
      stationName: params.stationName || "Love's Travel Stop #402",
      notes: params.notes || `Fuel fill-up at odometer ${params.currentOdometer} mi (${metrics.mpg} MPG)`,
    };

    // Prepend to logs
    this.logs = [entry, ...this.logs];
    this.saveToStorage();

    // Automatically record corresponding fleet invoice record for unified expense ledger
    try {
      fleetInvoicesService.addInvoice({
        orderNumber: `FUEL-${Date.now().toString().slice(-6)}`,
        dateOrdered: now.toLocaleDateString('en-US') + ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'PAID',
        paymentMethod: 'Fleet One Comdata Fuel Card - XXXX9102',
        vendorName: entry.stationName || 'Commercial Fuel Terminal',
        vendorAddress: 'Interstate Highway Corridor Travel Plaza',
        vendorPhone: '800-555-4921',
        vendorContactEmail: 'receipts@fleetnetwork.com',
        category: 'FUEL_DIESEL',
        billToName: 'Jonathan Vance (Owner-Operator)',
        billToCompany: 'Vance Freight Logistics LLC',
        billToAddress: '1042 Highway Transport Way, St. Louis, MO 63101',
        shipToName: 'Truck #1042 Tractor (Freightliner Cascadia)',
        shipToCompany: 'Direct In-Frame Fuel Tank',
        shipToAddress: entry.stationName || 'Terminal Pump Island',
        shippingMethod: 'On-Site Terminal Pump',
        customerPhone: '312-555-0142',
        subtotal: entry.totalCost,
        shippingAndHandling: 0,
        estimatedTax: Number((entry.totalCost * 0.05).toFixed(2)),
        totalAmount: Number((entry.totalCost * 1.05).toFixed(2)),
        balanceDue: 0,
        taxDeductible: true,
        capturedViaCamera: false,
        notes: `Driver Fuel Log // Odo: ${entry.currentOdometer} mi (+${entry.milesDriven} mi) // ${entry.gallons} Gal @ $${entry.pricePerGallon.toFixed(2)}/gal // Calculated ${entry.mpg} MPG ($${entry.costPerMile}/mi)`,
        items: [
          {
            itemNumber: 'DSL-BULK-ULTRA',
            description: `${entry.gallons} Gal ${entry.fuelType} (Odometer: ${entry.currentOdometer} mi, ${entry.mpg} MPG)`,
            qty: entry.gallons,
            unitPrice: entry.pricePerGallon,
            estTax: Number((entry.totalCost * 0.05).toFixed(2)),
            total: entry.totalCost,
          },
        ],
      });
    } catch (e) {
      console.warn('Could not auto-create fleet invoice record:', e);
    }

    return entry;
  }

  public deleteFuelLog(id: string): boolean {
    const prevLen = this.logs.length;
    this.logs = this.logs.filter((l) => l.id !== id);
    if (this.logs.length !== prevLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public getAverageFleetMpg(): number {
    const validLogs = this.logs.filter((l) => l.mpg > 0);
    if (validLogs.length === 0) return 6.8;
    const sum = validLogs.reduce((acc, curr) => acc + curr.mpg, 0);
    return Number((sum / validLogs.length).toFixed(2));
  }
}

export const fuelLogService = new FuelLogService();
