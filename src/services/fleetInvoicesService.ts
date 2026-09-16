import { FleetInvoiceRecord } from '../types';
import { INITIAL_FLEET_INVOICES } from '../data/mockInvoicesData';

const STORAGE_KEY = 'truck_with_ease_fleet_invoices_v1';

class FleetInvoicesService {
  private invoices: FleetInvoiceRecord[] = [];
  private listeners: ((invoices: FleetInvoiceRecord[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.invoices = JSON.parse(stored);
      } else {
        this.invoices = INITIAL_FLEET_INVOICES;
        this.saveToStorage();
      }
    } catch (e) {
      console.error('Failed to load fleet invoices from localStorage:', e);
      this.invoices = INITIAL_FLEET_INVOICES;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.invoices));
    } catch (e) {
      console.error('Failed to save fleet invoices to localStorage:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.invoices]));
  }

  public subscribe(listener: (invoices: FleetInvoiceRecord[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.invoices]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getInvoices(): FleetInvoiceRecord[] {
    return [...this.invoices];
  }

  public getInvoiceByOrderNumber(orderNumber: string): FleetInvoiceRecord | undefined {
    return this.invoices.find((i) => i.orderNumber === orderNumber);
  }

  public addInvoice(newInvoice: Omit<FleetInvoiceRecord, 'id'>): FleetInvoiceRecord {
    const record: FleetInvoiceRecord = {
      ...newInvoice,
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    this.invoices = [record, ...this.invoices];
    this.saveToStorage();
    return record;
  }

  public deleteInvoice(id: string): boolean {
    const initialLen = this.invoices.length;
    this.invoices = this.invoices.filter((inv) => inv.id !== id);
    if (this.invoices.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public resetToDefault(): FleetInvoiceRecord[] {
    this.invoices = INITIAL_FLEET_INVOICES;
    this.saveToStorage();
    return [...this.invoices];
  }

  public getSummaryStats() {
    const totalCount = this.invoices.length;
    const totalSpent = this.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const taxDeductibleTotal = this.invoices
      .filter((inv) => inv.taxDeductible)
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    
    const categoryTotals = {
      FLEET_MEMBERSHIPS_SUPPLIES: 0,
      FUEL_DIESEL: 0,
      MAINTENANCE_PARTS: 0,
      TOLLS_SCALES: 0,
      MEALS_CATERING: 0,
      LODGING_TRAVEL: 0,
    };

    this.invoices.forEach((inv) => {
      if (categoryTotals[inv.category] !== undefined) {
        categoryTotals[inv.category] += inv.totalAmount;
      }
    });

    return {
      totalCount,
      totalSpent,
      taxDeductibleTotal,
      categoryTotals,
    };
  }
}

export const fleetInvoicesService = new FleetInvoicesService();
