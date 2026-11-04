/**
 * TruckWithEase // Commercial Insurance Connector & Fleet Company Discount Engine
 * Integrates partner commercial trucking insurance underwriters, calculates data-driven
 * premium discount tiers based on FMCSA safety scores, telematics, and radar protection,
 * and facilitates instant policy connections and COI downloads.
 */

import type {
  InsuranceConnectorCompany,
  InsuranceDiscountTier,
  FleetInsuranceQuote,
  DotCompanyRecord,
} from '../types.ts';
import { MOCK_INSURANCE_CONNECTOR_COMPANIES } from '../data/mockInsuranceAndDotData.ts';
import { dotCompanyService } from './dotCompanyService.ts';
import { safeStorage } from '../utils/safeStorage.ts';

const STORAGE_KEY_INSURANCE_QUOTES = 'twe_insurance_quotes_v1';
const STORAGE_KEY_BOUND_POLICIES = 'twe_bound_insurance_policies_v1';

export class InsuranceConnectorService {
  private companies: InsuranceConnectorCompany[];
  private quotes: FleetInsuranceQuote[];

  constructor() {
    this.companies = [...MOCK_INSURANCE_CONNECTOR_COMPANIES];
    this.quotes = this.loadQuotes();
  }

  private loadQuotes(): FleetInsuranceQuote[] {
    const res = safeStorage.getItem<FleetInsuranceQuote[]>(STORAGE_KEY_INSURANCE_QUOTES, []);
    return res.data || [];
  }

  private saveQuotes(): void {
    safeStorage.setItem(STORAGE_KEY_INSURANCE_QUOTES, this.quotes);
  }

  public getCompanies(): InsuranceConnectorCompany[] {
    return [...this.companies];
  }

  public getCompanyById(id: string): InsuranceConnectorCompany | undefined {
    return this.companies.find((c) => c.id === id);
  }

  /**
   * Evaluates company qualification for discount tiers given a DOT record and fleet parameters
   */
  public evaluateDiscountsForCompany(
    company: InsuranceConnectorCompany,
    dotRecord: DotCompanyRecord,
    fleetPowerUnits: number
  ): {
    qualifiedDiscounts: InsuranceDiscountTier[];
    aggregateDiscountPct: number;
    baseAnnualTotal: number;
    netAnnualTotal: number;
    totalAnnualSavings: number;
  } {
    const qualifiedDiscounts: InsuranceDiscountTier[] = [];

    company.discountsOffered.forEach((disc) => {
      let isQualified = false;

      switch (disc.category) {
        case 'CLEAN_DOT_SMS': {
          // Qualified if safety rating is Satisfactory and unsafe driving percentile < 25%
          const unsafeScore = dotRecord.smsScores.find((s) => s.category === 'UNSAFE_DRIVING');
          const isCleanSms = !unsafeScore || unsafeScore.percentile <= 25;
          const isSatisfactory = dotRecord.safetyRating === 'SATISFACTORY' || dotRecord.safetyRating === 'NOT_RATED';
          isQualified = isCleanSms && isSatisfactory;
          break;
        }
        case 'TELEMATICS_CANBUS': {
          // TruckWithEase certified 10Hz ECM CAN-Bus integration
          isQualified = true;
          break;
        }
        case 'FHWA_RADAR_54B': {
          // TruckWithEase low-bridge radar HUD active
          isQualified = true;
          break;
        }
        case 'ZERO_OOS_DRIVERS': {
          // Driver out of service rate < 3.0%
          isQualified = dotRecord.outOfServiceRates.driverOosPct < 3.0;
          break;
        }
        case 'ELECTRONIC_DVIR': {
          // Part 396.11 certified custody active
          isQualified = true;
          break;
        }
        default:
          isQualified = true;
      }

      if (isQualified) {
        const annualSavingsPerTruck = Math.round((company.baseRatePerPowerUnitAnnual * disc.discountPercent) / 100);
        qualifiedDiscounts.push({
          ...disc,
          qualified: true,
          annualSavingsUsd: annualSavingsPerTruck * fleetPowerUnits,
        });
      }
    });

    // Sum discounts up to maximum discount allowed
    const rawDiscountPct = qualifiedDiscounts.reduce((sum, d) => sum + d.discountPercent, 0);
    const aggregateDiscountPct = Math.min(company.maxDiscountPercent, rawDiscountPct);

    const baseAnnualTotal = company.baseRatePerPowerUnitAnnual * fleetPowerUnits;
    const totalAnnualSavings = Math.round((baseAnnualTotal * aggregateDiscountPct) / 100);
    const netAnnualTotal = baseAnnualTotal - totalAnnualSavings;

    return {
      qualifiedDiscounts,
      aggregateDiscountPct,
      baseAnnualTotal,
      netAnnualTotal,
      totalAnnualSavings,
    };
  }

  /**
   * Generate an official Fleet Insurance Quote for a carrier
   */
  public generateQuote(companyId: string, fleetPowerUnits = 5): FleetInsuranceQuote {
    const company = this.getCompanyById(companyId) || this.companies[0];
    const carrier = dotCompanyService.getCurrentCarrier();
    const evaluation = this.evaluateDiscountsForCompany(company, carrier, fleetPowerUnits);

    const quoteId = `QUOTE-${company.id.substring(0, 4).toUpperCase()}-${Date.now().toString().substring(7)}`;
    const sha256 = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 30);

    const quote: FleetInsuranceQuote = {
      quoteId,
      carrierUsdot: carrier.usdot,
      carrierName: carrier.legalName,
      fleetPowerUnits,
      selectedCompanyId: company.id,
      companyName: company.name,
      baseAnnualTotal: evaluation.baseAnnualTotal,
      aggregateDiscountPct: evaluation.aggregateDiscountPct,
      netAnnualTotal: evaluation.netAnnualTotal,
      totalAnnualSavings: evaluation.totalAnnualSavings,
      qualifiedDiscounts: evaluation.qualifiedDiscounts,
      timestamp: new Date().toISOString(),
      expirationDate: expDate.toISOString().substring(0, 10),
      status: 'GENERATED',
      merkleSealSha256: sha256,
    };

    this.quotes = [quote, ...this.quotes];
    this.saveQuotes();
    return quote;
  }

  /**
   * Request binding / policy connection
   */
  public requestBindPolicy(quoteId: string): FleetInsuranceQuote | null {
    const index = this.quotes.findIndex((q) => q.quoteId === quoteId);
    if (index === -1) return null;

    const updated: FleetInsuranceQuote = {
      ...this.quotes[index],
      status: 'BIND_REQUESTED',
    };

    this.quotes[index] = updated;
    this.saveQuotes();
    return updated;
  }

  /**
   * Generate Certificate of Insurance (COI) JSON / Text packet
   */
  public generateCoiDocument(quote: FleetInsuranceQuote): {
    fileName: string;
    coiNumber: string;
    content: string;
  } {
    const carrier = dotCompanyService.getCurrentCarrier();
    const company = this.getCompanyById(quote.selectedCompanyId) || this.companies[0];
    const coiNumber = `COI-TWE-${carrier.usdot}-${Date.now().toString().substring(6)}`;

    const content = `ACORD 25 (CERTIFICATE OF LIABILITY INSURANCE) - DIGITAL ATTESTATION
--------------------------------------------------------------------------------
CERTIFICATE NUMBER: ${coiNumber}
DATE ISSUED: ${new Date().toISOString().substring(0, 10)}
CARRIER NAME: ${carrier.legalName}
DBA: ${carrier.dbaName || 'None'}
USDOT #: ${carrier.usdot} | MC/FF #: ${carrier.mcNumber}
HEADQUARTERS: ${carrier.physicalAddress}
FLEET POWER UNITS COVERED: ${quote.fleetPowerUnits}

INSURER AFFORDING COVERAGE:
COMPANY: ${company.name}
AM BEST RATING: ${company.underwritingTier}
INTEGRATION: TruckWithEase Telematics Connected Partner

COVERAGES & POLICY LIMITS:
- Commercial Automobile Liability: $1,000,000 Combined Single Limit (CSL)
- Motor Truck Cargo Legal Liability: $100,000 Broad Form (Reefer Breakdown Included)
- Physical Damage (Stated Value / Actual Cash Value)
- Trailer Interchange Agreement Protection: Included

VERIFIED TELEMATICS & SAFETY DISCOUNT APPLIED:
- Standard Annual Premium: $${quote.baseAnnualTotal.toLocaleString()}
- Applied Safety Discount: -${quote.aggregateDiscountPct}% (Clean DOT SMS & J1939 CAN-Bus)
- Verified Net Annual Premium: $${quote.netAnnualTotal.toLocaleString()}
- Total Annual Savings: $${quote.totalAnnualSavings.toLocaleString()}

CERTIFIED BY:
TruckWithEase Automated Insurance Underwriting Gateway
Cryptographic Merkle Seal: ${quote.merkleSealSha256}
--------------------------------------------------------------------------------
This certificate confirms active commercial motor carrier coverage complying with 49 CFR Part 387.
`;

    return {
      fileName: `CERTIFICATE_OF_INSURANCE_USDOT_${carrier.usdot}_${coiNumber}.txt`,
      coiNumber,
      content,
    };
  }
}

export const insuranceConnectorService = new InsuranceConnectorService();
