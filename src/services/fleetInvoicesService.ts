import { FleetInvoiceRecord, InvoiceCategory } from '../types';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'truck_with_ease_fleet_invoices_v2';

type ServerExpenseCategory =
  | 'FUEL' | 'MAINTENANCE' | 'TOLLS' | 'SCALES' | 'PARKING' | 'LODGING' | 'SUPPLIES' | 'OTHER';

const CLIENT_TO_SERVER_CATEGORY: Record<string, ServerExpenseCategory> = {
  FUEL_DIESEL: 'FUEL',
  MAINTENANCE_PARTS: 'MAINTENANCE',
  TOLLS_SCALES: 'TOLLS',
  LODGING_TRAVEL: 'LODGING',
  FLEET_MEMBERSHIPS_SUPPLIES: 'SUPPLIES',
  MEALS_CATERING: 'OTHER',
};

const serverToClientCategory = (c: string): InvoiceCategory => {
  switch (c) {
    case 'FUEL': return 'FUEL_DIESEL';
    case 'MAINTENANCE': return 'MAINTENANCE_PARTS';
    case 'TOLLS':
    case 'SCALES': return 'TOLLS_SCALES';
    case 'LODGING':
    case 'PARKING': return 'LODGING_TRAVEL';
    default: return 'FLEET_MEMBERSHIPS_SUPPLIES';
  }
};

export interface FreightInvoiceServerRecord {
  id: string;
  invoiceNumber: string;
  fleetId: string;
  brokerCarrierName: string;
  amountUsd: number;
  lineItems: Array<{ description: string; amount: number; type?: string }>;
  status: 'PENDING' | 'ISSUED' | 'PAID' | 'DISPUTED';
  dueDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ExpenseServerRecord {
  id: string;
  fleetId: string;
  driverId: string;
  date: string;
  category: string;
  amount: number;
  vendor: string;
  description?: string;
  unitNumber?: string;
  receiptUrl?: string;
  createdAt: string;
}

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
        this.invoices = [];
      }
    } catch (e) {
      this.invoices = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.invoices));
    } catch (e) {}
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

  public async fetchServerInvoices(): Promise<FleetInvoiceRecord[]> {
    try {
      // 1. Fetch Invoices (Money owed to carrier/driver)
      const invRes = await apiClient.get<{ success: boolean; invoices: FreightInvoiceServerRecord[] }>(
        '/api/invoices',
        { skipUnauthorizedRedirect: true }
      );

      // 2. Fetch Expenses (Money spent by fleet)
      const expRes = await apiClient.get<{ success: boolean; expenses: ExpenseServerRecord[] }>(
        '/api/expenses',
        { skipUnauthorizedRedirect: true }
      );

      const serverInvoices: FleetInvoiceRecord[] = [];

      if (invRes && Array.isArray(invRes.invoices)) {
        for (const inv of invRes.invoices) {
          serverInvoices.push({
            id: inv.id,
            orderNumber: inv.invoiceNumber,
            userId: inv.fleetId,
            dateOrdered: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'Recent',
            vendorName: inv.brokerCarrierName,
            vendorAddress: 'Commercial Logistics Broker Freight Office',
            vendorPhone: '800-555-FREIGHT',
            vendorContactEmail: 'billing@freightbroker.com',
            billToName: inv.brokerCarrierName,
            billToAddress: 'Accounts Payable Dept',
            shipToName: 'Carrier Freight Delivery',
            shipToAddress: 'Delivery Terminal Dock',
            shippingMethod: 'Direct Freight Transit',
            customerPhone: 'N/A',
            category: 'FREIGHT_HAUL_REVENUE',
            items: inv.lineItems?.map((li, idx) => ({
              itemNumber: `ITEM-${idx + 1}`,
              description: li.description,
              unitPrice: li.amount,
              qty: 1,
              estTax: 0,
              total: li.amount,
            })) || [{ itemNumber: 'LINEHAUL', description: 'Freight Haulage', unitPrice: inv.amountUsd, qty: 1, estTax: 0, total: inv.amountUsd }],
            subtotal: inv.amountUsd,
            shippingAndHandling: 0,
            estimatedTax: 0,
            totalAmount: inv.amountUsd,
            balanceDue: inv.status === 'PAID' ? 0 : inv.amountUsd,
            paymentMethod: inv.status === 'PAID' ? 'DIRECT_DEPOSIT_ACH' : 'BROKER_ACH_PENDING',
            notes: `${inv.notes || `Carrier Freight Invoice for ${inv.brokerCarrierName}`} // Terms: Net 30 QuickPay`,
            taxDeductible: false,
            status: inv.status === 'PAID' ? 'PAID' : 'PENDING',
          });
        }
      }

      if (expRes && Array.isArray(expRes.expenses)) {
        for (const exp of expRes.expenses) {
          serverInvoices.push({
            id: exp.id,
            orderNumber: `EXP-${exp.id.slice(-6).toUpperCase()}`,
            userId: exp.driverId,
            dateOrdered: exp.date,
            vendorName: exp.vendor,
            vendorAddress: 'Vendor Facility',
            vendorPhone: '',
            vendorContactEmail: '',
            billToName: 'Fleet Operating Account',
            billToAddress: 'Fleet Headquarters',
            shipToName: 'Fleet Unit',
            shipToAddress: '',
            shippingMethod: 'In-Person Expense',
            customerPhone: '',
            category: serverToClientCategory(exp.category),
            items: [
              {
                itemNumber: exp.category,
                description: exp.description || `${exp.category} Expense`,
                unitPrice: exp.amount,
                qty: 1,
                estTax: 0,
                total: exp.amount,
              },
            ],
            subtotal: exp.amount,
            shippingAndHandling: 0,
            estimatedTax: 0,
            totalAmount: exp.amount,
            balanceDue: 0,
            paymentMethod: 'FLEET_EXPENSE_CARD',
            notes: exp.description || 'Fleet operating expense',
            taxDeductible: true,
            status: 'PAID',
          });
        }
      }

      if (serverInvoices.length > 0 || (invRes && expRes)) {
        this.invoices = serverInvoices;
        this.saveToStorage();
        return serverInvoices;
      }
    } catch (err) {
      console.warn('[FleetInvoicesService] fetchServerInvoices error:', err);
    }
    return [...this.invoices];
  }

  public async createServerInvoice(input: {
    brokerCarrierName: string;
    brokerEmail?: string;
    amountUsd: number;
    invoiceNumber?: string;
    lineItems?: Array<{ description: string; amount: number; type?: string }>;
    notes?: string;
    dueDate?: string;
  }): Promise<FreightInvoiceServerRecord> {
    const res = await apiClient.post<{ success: boolean; invoice: FreightInvoiceServerRecord }>(
      '/api/invoices',
      input
    );
    await this.fetchServerInvoices();
    return res.invoice;
  }

  public async createServerExpense(input: {
    vendor: string;
    amount: number;
    category: string;
    description?: string;
    date?: string;
    receiptUrl?: string;
    unitNumber?: string;
  }): Promise<ExpenseServerRecord> {
    const res = await apiClient.post<{ success: boolean; expense: ExpenseServerRecord }>(
      '/api/expenses',
      input
    );
    await this.fetchServerInvoices();
    return res.expense;
  }

  /**
   * Records an expense locally (instant UI) and syncs it to POST /api/expenses.
   * On sync failure the local record is kept and a warning is logged.
   */
  public addInvoice(newInvoice: Omit<FleetInvoiceRecord, 'id'>): FleetInvoiceRecord {
    const record: FleetInvoiceRecord = {
      ...newInvoice,
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    this.invoices = [record, ...this.invoices];
    this.saveToStorage();

    if (record.category !== 'FREIGHT_HAUL_REVENUE') {
      this.createServerExpense({
        vendor: record.vendorName,
        amount: record.totalAmount,
        category: CLIENT_TO_SERVER_CATEGORY[record.category] ?? 'OTHER',
        description: record.notes || record.items[0]?.description,
      }).catch((err) => {
        console.warn('[FleetInvoicesService] expense sync failed; kept locally:', err);
      });
    }
    return record;
  }

  public getSummaryStats() {
    const totalCount = this.invoices.length;
    const totalSpent = this.invoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const pendingDue = this.invoices.reduce((acc, inv) => acc + (inv.balanceDue || 0), 0);
    const paidCount = this.invoices.filter((inv) => inv.status === 'PAID').length;
    const pendingCount = this.invoices.filter((inv) => inv.status !== 'PAID').length;
    const taxDeductibleTotal = this.invoices
      .filter((inv) => inv.taxDeductible)
      .reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

    const categoryTotals: Record<InvoiceCategory, number> = {
      FLEET_MEMBERSHIPS_SUPPLIES: 0,
      FUEL_DIESEL: 0,
      MAINTENANCE_PARTS: 0,
      TOLLS_SCALES: 0,
      MEALS_CATERING: 0,
      LODGING_TRAVEL: 0,
      FREIGHT_HAUL_REVENUE: 0,
    };
    this.invoices.forEach((inv) => {
      if (categoryTotals[inv.category] !== undefined) {
        categoryTotals[inv.category] += inv.totalAmount || 0;
      }
    });

    return {
      totalCount,
      totalSpent,
      pendingDue,
      paidCount,
      pendingCount,
      taxDeductibleTotal,
      categoryTotals,
    };
  }
}

export const fleetInvoicesService = new FleetInvoicesService();
