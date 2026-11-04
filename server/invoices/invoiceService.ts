import { CallerIdentity, fleetStore } from '../data/fleetStore';

export interface FuelLogRecord {
  id: string;
  fleetId: string;
  driverId: string;
  date: string;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
  currentOdometer: number;
  previousOdometer?: number;
  milesDriven?: number;
  fuelMpg?: number;
  stationName?: string;
  city?: string;
  state?: string;
  unitNumber?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  fleetId: string;
  driverId: string;
  date: string;
  category: 'FUEL' | 'MAINTENANCE' | 'TOLLS' | 'SCALES' | 'PARKING' | 'LODGING' | 'SUPPLIES' | 'OTHER';
  amount: number;
  vendor: string;
  description?: string;
  unitNumber?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface FreightInvoiceLineItem {
  description: string;
  amount: number;
  type?: 'FREIGHT' | 'DETENTION' | 'LUMPER' | 'LAYOVER' | 'FUEL_SURCHARGE';
}

export interface FreightInvoiceRecord {
  id: string;
  invoiceNumber: string;
  fleetId: string;
  driverId?: string;
  loadId?: string;
  brokerCarrierName: string;
  brokerEmail?: string;
  amountUsd: number;
  lineItems: FreightInvoiceLineItem[];
  status: 'PENDING' | 'ISSUED' | 'PAID' | 'DISPUTED';
  dueDate?: string;
  notes?: string;
  evidencePacketId?: string;
  createdAt: string;
}

export class InvoiceService {
  // ==========================================
  // FUEL LOGS
  // ==========================================
  async createFuelLog(caller: CallerIdentity, input: any): Promise<FuelLogRecord> {
    if (!caller || !caller.fleetId) {
      const err = new Error('Fleet authentication required to create fuel logs.');
      (err as any).statusCode = 401;
      throw err;
    }

    const gallons = Number(input?.gallons);
    if (!gallons || gallons <= 0 || isNaN(gallons)) {
      const err = new Error('Gallons pumped must be greater than zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const pricePerGallon = Number(input?.pricePerGallon);
    if (!pricePerGallon || pricePerGallon <= 0 || isNaN(pricePerGallon)) {
      const err = new Error('Price per gallon must be greater than zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const currentOdometer = Number(input?.currentOdometer);
    if (!currentOdometer || currentOdometer <= 0 || isNaN(currentOdometer)) {
      const err = new Error('Current odometer reading is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    const totalCost = input?.totalCost ? Number(input.totalCost) : parseFloat((gallons * pricePerGallon).toFixed(2));
    const previousOdometer = input?.previousOdometer ? Number(input.previousOdometer) : undefined;
    const milesDriven = previousOdometer && currentOdometer > previousOdometer ? currentOdometer - previousOdometer : undefined;
    const fuelMpg = milesDriven && gallons > 0 ? parseFloat((milesDriven / gallons).toFixed(2)) : undefined;

    const id = `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const driverId = caller.role === 'driver' ? caller.uid : (input?.driverId || caller.uid);

    const record: FuelLogRecord = {
      id,
      fleetId: caller.fleetId,
      driverId,
      date: input?.date || new Date().toISOString().slice(0, 10),
      gallons,
      pricePerGallon,
      totalCost,
      currentOdometer,
      previousOdometer,
      milesDriven,
      fuelMpg,
      stationName: input?.stationName ? String(input.stationName).trim() : 'Commercial Fuel Stop',
      city: input?.city ? String(input.city).trim() : undefined,
      state: input?.state ? String(input.state).trim().toUpperCase() : undefined,
      unitNumber: input?.unitNumber ? String(input.unitNumber).trim() : undefined,
      receiptUrl: input?.receiptUrl ? String(input.receiptUrl).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    return await fleetStore.createScopedDocument(caller, 'fuel_logs', id, record);
  }

  async listFuelLogs(caller: CallerIdentity): Promise<FuelLogRecord[]> {
    return await fleetStore.listScopedCollection<FuelLogRecord>(caller, 'fuel_logs');
  }

  // ==========================================
  // EXPENSES
  // ==========================================
  async createExpense(caller: CallerIdentity, input: any): Promise<ExpenseRecord> {
    if (!caller || !caller.fleetId) {
      const err = new Error('Fleet authentication required to create expenses.');
      (err as any).statusCode = 401;
      throw err;
    }

    const amount = Number(input?.amount);
    if (!amount || amount <= 0 || isNaN(amount)) {
      const err = new Error('Expense amount must be greater than zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const vendor = typeof input?.vendor === 'string' ? input.vendor.trim() : '';
    if (!vendor) {
      const err = new Error('Expense vendor / payee name is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    const validCategories = ['FUEL', 'MAINTENANCE', 'TOLLS', 'SCALES', 'PARKING', 'LODGING', 'SUPPLIES', 'OTHER'];
    const category = validCategories.includes(input?.category) ? input.category : 'OTHER';

    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const driverId = caller.role === 'driver' ? caller.uid : (input?.driverId || caller.uid);

    const record: ExpenseRecord = {
      id,
      fleetId: caller.fleetId,
      driverId,
      date: input?.date || new Date().toISOString().slice(0, 10),
      category,
      amount,
      vendor,
      description: input?.description ? String(input.description).trim() : undefined,
      unitNumber: input?.unitNumber ? String(input.unitNumber).trim() : undefined,
      receiptUrl: input?.receiptUrl ? String(input.receiptUrl).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    return await fleetStore.createScopedDocument(caller, 'expenses', id, record);
  }

  async listExpenses(caller: CallerIdentity): Promise<ExpenseRecord[]> {
    return await fleetStore.listScopedCollection<ExpenseRecord>(caller, 'expenses');
  }

  // ==========================================
  // INVOICES (Money owed to Driver / Carrier)
  // ==========================================
  async createInvoice(caller: CallerIdentity, input: any): Promise<FreightInvoiceRecord> {
    if (!caller || !caller.fleetId) {
      const err = new Error('Fleet authentication required to create invoices.');
      (err as any).statusCode = 401;
      throw err;
    }

    const amountUsd = Number(input?.amountUsd);
    if (!amountUsd || amountUsd <= 0 || isNaN(amountUsd)) {
      const err = new Error('Invoice amount must be greater than zero.');
      (err as any).statusCode = 400;
      throw err;
    }

    const brokerCarrierName = typeof input?.brokerCarrierName === 'string' ? input.brokerCarrierName.trim() : '';
    if (!brokerCarrierName) {
      const err = new Error('Broker or paying shipper name is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const invoiceNumber = input?.invoiceNumber ? String(input.invoiceNumber).trim() : `INV-${Date.now().toString().slice(-6)}`;

    const rawLineItems: any[] = Array.isArray(input?.lineItems) ? input.lineItems : [];
    const lineItems: FreightInvoiceLineItem[] = rawLineItems.length > 0
      ? rawLineItems.map((item) => ({
          description: String(item.description || 'Freight Haulage Services'),
          amount: Number(item.amount) || amountUsd,
          type: item.type || 'FREIGHT',
        }))
      : [{ description: 'Linehaul Freight Transit Services', amount: amountUsd, type: 'FREIGHT' }];

    const record: FreightInvoiceRecord = {
      id,
      invoiceNumber,
      fleetId: caller.fleetId,
      driverId: caller.role === 'driver' ? caller.uid : (input?.driverId || caller.uid),
      loadId: input?.loadId ? String(input.loadId) : undefined,
      brokerCarrierName,
      brokerEmail: input?.brokerEmail ? String(input.brokerEmail).trim() : undefined,
      amountUsd,
      lineItems,
      status: input?.status || 'PENDING',
      dueDate: input?.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: input?.notes ? String(input.notes).trim() : undefined,
      evidencePacketId: input?.evidencePacketId ? String(input.evidencePacketId) : undefined,
      createdAt: new Date().toISOString(),
    };

    return await fleetStore.createScopedDocument(caller, 'invoices', id, record);
  }

  async listInvoices(caller: CallerIdentity): Promise<FreightInvoiceRecord[]> {
    return await fleetStore.listScopedCollection<FreightInvoiceRecord>(caller, 'invoices');
  }

  async getInvoiceById(caller: CallerIdentity, id: string): Promise<FreightInvoiceRecord | null> {
    return await fleetStore.getScopedDocument<FreightInvoiceRecord>(caller, 'invoices', id);
  }
}

export const invoiceService = new InvoiceService();
