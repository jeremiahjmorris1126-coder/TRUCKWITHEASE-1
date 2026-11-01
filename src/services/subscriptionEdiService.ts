/**
 * TruckWithEase // Frontend Subscription & EDI Client Service
 * Communicates with backend endpoints for Salesforce CRM synchronization
 * and ANSI ASC X12 EDI generation.
 */

import type {
  UserSubscriptionRecord,
  SalesforceSyncStatus,
  EdiTransactionRecord,
  SubscriptionTier,
} from '../types';

export interface EdiCostAlternative {
  optionNumber: number;
  title: string;
  industryStandard: string;
  transactionSets: string[];
  costComparison: string;
  mechanism: string;
}

export const subscriptionEdiService = {
  async getSubscriptions(): Promise<{ subscriptions: UserSubscriptionRecord[]; salesforceStatus: SalesforceSyncStatus }> {
    const res = await fetch('/api/subscriptions');
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching subscriptions`);
    return res.json();
  },

  async createSubscription(payload: {
    userId: string;
    driverName: string;
    email: string;
    phone?: string;
    cdlNumber: string;
    cdlState?: string;
    carrierName?: string;
    usdotNumber?: string;
    assignedUnit?: string;
    tier: SubscriptionTier;
    billingCycle?: 'MONTHLY' | 'ANNUAL';
    paymentMethod?: string;
  }): Promise<{ success: boolean; subscription: UserSubscriptionRecord; salesforceAttested: boolean }> {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `HTTP ${res.status} creating subscription`);
    }
    return res.json();
  },

  async getSalesforceStatus(): Promise<SalesforceSyncStatus> {
    const res = await fetch('/api/salesforce/status');
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching Salesforce status`);
    return res.json();
  },

  async syncSalesforceQueue(): Promise<{ success: boolean; flushed: { processed: number; remaining: number }; salesforceStatus: SalesforceSyncStatus }> {
    const res = await fetch('/api/salesforce/sync', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status} flushing Salesforce queue`);
    return res.json();
  },

  async getEdiTransactions(): Promise<{ transactions: EdiTransactionRecord[]; count: number }> {
    const res = await fetch('/api/edi/transactions');
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching EDI transactions`);
    return res.json();
  },

  async getEdiAlternatives(): Promise<{ alternatives: EdiCostAlternative[]; recommendation: string }> {
    const res = await fetch('/api/edi/alternatives');
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching EDI alternatives`);
    return res.json();
  },

  async generateEdi204(payload: {
    loadId: string;
    billOfLading?: string;
    shipperName?: string;
    shipperCity?: string;
    shipperState?: string;
    shipperZip?: string;
    consigneeName?: string;
    consigneeCity?: string;
    consigneeState?: string;
    consigneeZip?: string;
    commodityDescription?: string;
    grossWeightLbs?: number;
    contractRateUsd: number;
    carrierScac?: string;
  }): Promise<{ success: boolean; transaction: EdiTransactionRecord }> {
    const res = await fetch('/api/edi/generate-204', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} generating EDI 204`);
    return res.json();
  },

  async generateEdi214(payload: {
    loadId: string;
    statusCode: 'X6' | 'AF' | 'D1' | 'X1' | 'X4' | 'CD';
    statusDescription: string;
    cityName: string;
    stateCode: string;
    latitude: number;
    longitude: number;
    unitNumber: string;
    trailerNumber?: string;
  }): Promise<{ success: boolean; transaction: EdiTransactionRecord }> {
    const res = await fetch('/api/edi/generate-214', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} generating EDI 214`);
    return res.json();
  },

  async generateEdi210(payload: {
    invoiceNumber: string;
    loadId: string;
    billToName?: string;
    billToCity?: string;
    billToState?: string;
    billToZip?: string;
    linehaulAmountUsd?: number;
    fuelSurchargeUsd?: number;
    totalAmountUsd: number;
    mileage?: number;
  }): Promise<{ success: boolean; transaction: EdiTransactionRecord }> {
    const res = await fetch('/api/edi/generate-210', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} generating EDI 210`);
    return res.json();
  },
};
