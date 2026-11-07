import { apiClient } from './apiClient';

export interface FuelLogEntry {
  id: string;
  date: string;
  timestamp?: number;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
  previousOdometer?: number;
  currentOdometer: number;
  milesDriven?: number;
  fuelMpg?: number;
  mpg?: number;
  costPerMile?: number;
  fuelType?: 'DIESEL' | 'DEF' | 'SCALE' | 'MAINTENANCE';
  stationName?: string;
  city?: string;
  state?: string;
  unitNumber?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface MpgEfficiencyMetrics {
  milesDriven: number;
  mpg: number;
  totalCost: number;
  costPerMile: number;
  ratingLabel: string;
  ratingColor: 'emerald' | 'amber' | 'rose' | 'outline';
  ratingAdvice: string;
}

const STORAGE_KEY = 'truck_with_ease_fuel_logs_v2';

class FuelLogService {
  private logs: FuelLogEntry[] = [];
  private listeners: ((logs: FuelLogEntry[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      } else {
        this.logs = [];
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch {}
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.logs]));
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

  public async fetchServerLogs(): Promise<FuelLogEntry[]> {
    try {
      const res = await apiClient.get<{ success: boolean; fuelLogs: any[] }>(
        '/api/fuel-logs',
        { skipUnauthorizedRedirect: true }
      );
      if (res && Array.isArray(res.fuelLogs)) {
        const mapped: FuelLogEntry[] = res.fuelLogs.map((l) => ({
          id: l.id,
          date: l.date,
          timestamp: new Date(l.createdAt || l.date).getTime(),
          gallons: l.gallons,
          pricePerGallon: l.pricePerGallon,
          totalCost: l.totalCost,
          currentOdometer: l.currentOdometer,
          previousOdometer: l.previousOdometer,
          milesDriven: l.milesDriven,
          mpg: l.fuelMpg || (l.milesDriven && l.gallons ? parseFloat((l.milesDriven / l.gallons).toFixed(2)) : undefined),
          fuelMpg: l.fuelMpg,
          stationName: l.stationName,
          city: l.city,
          state: l.state,
          unitNumber: l.unitNumber,
          receiptUrl: l.receiptUrl,
        }));
        this.logs = mapped;
        this.saveToStorage();
        return mapped;
      }
    } catch (err) {
      console.warn('[FuelLogService] fetchServerLogs error:', err);
    }
    return [...this.logs];
  }

  public async addFuelLog(entry: {
    gallons: number;
    pricePerGallon: number;
    totalCost?: number;
    currentOdometer: number;
    previousOdometer?: number;
    fuelType?: FuelLogEntry['fuelType'] | 'REEFER';
    stationName?: string;
    city?: string;
    state?: string;
    unitNumber?: string;
    receiptUrl?: string;
    date?: string;
    notes?: string;
  }): Promise<FuelLogEntry> {
    const res = await apiClient.post<{ success: boolean; fuelLog: any }>(
      '/api/fuel-logs',
      entry
    );

    const saved = res.fuelLog;
    const newLog: FuelLogEntry = {
      id: saved.id,
      date: saved.date,
      timestamp: Date.now(),
      gallons: saved.gallons,
      pricePerGallon: saved.pricePerGallon,
      totalCost: saved.totalCost,
      currentOdometer: saved.currentOdometer,
      previousOdometer: saved.previousOdometer,
      milesDriven: saved.milesDriven,
      mpg: saved.fuelMpg,
      fuelMpg: saved.fuelMpg,
      stationName: saved.stationName,
      city: saved.city,
      state: saved.state,
      unitNumber: saved.unitNumber,
      receiptUrl: saved.receiptUrl,
      notes: entry.notes,
      fuelType: entry.fuelType === 'REEFER' ? 'DIESEL' : entry.fuelType,
      costPerMile:
        saved.milesDriven > 0 ? parseFloat((saved.totalCost / saved.milesDriven).toFixed(3)) : undefined,
    };

    this.logs = [newLog, ...this.logs];
    this.saveToStorage();
    return newLog;
  }

  /**
   * Removes an entry from the local cache only.
   * NOTE: server has no DELETE /api/fuel-logs/:id route yet, so the entry
   * will reappear on the next fetchServerLogs() call.
   */
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
    const valid = this.logs.filter((l) => (l.mpg ?? 0) > 0);
    if (valid.length === 0) return 0; // no fill-ups yet: no average (was a hardcoded 6.8)
    const sum = valid.reduce((acc, l) => acc + (l.mpg ?? 0), 0);
    return Number((sum / valid.length).toFixed(2));
  }

  /** Live, pre-save MPG preview used by the fuel entry form. */
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
    let ratingColor: MpgEfficiencyMetrics['ratingColor'] = 'outline';
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

    return { milesDriven, mpg, totalCost, costPerMile, ratingLabel, ratingColor, ratingAdvice };
  }

  public calculateMetrics(): MpgEfficiencyMetrics {
    if (this.logs.length === 0) {
      return {
        milesDriven: 0,
        mpg: 0,
        totalCost: 0,
        costPerMile: 0,
        ratingLabel: 'NO FUEL LOGS YET',
        ratingColor: 'outline',
        ratingAdvice: 'Record your first fuel stop to track MPG and cost per mile.',
      };
    }

    const totalGallons = this.logs.reduce((acc, l) => acc + l.gallons, 0);
    const totalCost = this.logs.reduce((acc, l) => acc + l.totalCost, 0);
    const totalMiles = this.logs.reduce((acc, l) => acc + (l.milesDriven || 0), 0);

    const mpg = totalGallons > 0 && totalMiles > 0 ? parseFloat((totalMiles / totalGallons).toFixed(2)) : 6.8;
    const costPerMile = totalMiles > 0 ? parseFloat((totalCost / totalMiles).toFixed(3)) : 0.55;

    let ratingLabel = 'FLEET AVERAGE (6.5 - 7.2 MPG)';
    let ratingColor: 'emerald' | 'amber' | 'rose' | 'outline' = 'emerald';
    let ratingAdvice = 'Standard fuel efficiency across commercial freight corridors.';

    if (mpg >= 7.5) {
      ratingLabel = 'OPTIMAL EFFICIENCY (> 7.5 MPG)';
      ratingColor = 'emerald';
      ratingAdvice = 'Aerodynamic cruising speed and minimal idle burn.';
    } else if (mpg < 6.0) {
      ratingLabel = 'HIGH CONSUMPTION (< 6.0 MPG)';
      ratingColor = 'amber';
      ratingAdvice = 'Heavy headwind or excessive idling detected.';
    }

    return {
      milesDriven: totalMiles,
      mpg,
      totalCost,
      costPerMile,
      ratingLabel,
      ratingColor,
      ratingAdvice,
    };
  }
}

export const fuelLogService = new FuelLogService();
