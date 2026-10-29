import {
  DiscountProvider,
  FuelOffer,
  InsuranceProvider,
  InsuranceQuoteRequest,
  InsuranceQuoteResult,
} from './types';
import { WexDiscountProvider } from './providers/wexProvider';
import { TruckSmarterDiscountProvider } from './providers/truckSmarterProvider';
import { ProgressiveInsuranceProvider } from './providers/progressiveProvider';
import { CoverWalletInsuranceProvider } from './providers/coverWalletProvider';
import { encodeGeohash } from './geohash';
import { getCachedFuelOffers, setCachedFuelOffers } from './cache';

const PROVIDER_TIMEOUT_MS = 3000;

export class PartnersRegistry {
  private discountProviders: DiscountProvider[] = [];
  private insuranceProviders: InsuranceProvider[] = [];

  constructor() {
    this.loadEnabledProviders();
  }

  private loadEnabledProviders(): void {
    // Enabled providers can be toggled via environment or enabled by default in mock mode
    this.discountProviders = [
      new WexDiscountProvider(),
      new TruckSmarterDiscountProvider(),
    ];

    this.insuranceProviders = [
      new ProgressiveInsuranceProvider(),
      new CoverWalletInsuranceProvider(),
    ];
  }

  // Executes a promise with a strict per-provider timeout (3s)
  private async withTimeout<T>(promise: Promise<T>, providerName: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Partner provider [${providerName}] timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer!);
      return res;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  /**
   * Aggregates fuel offers across all enabled discount providers.
   * Checks Firestore cache (key = provider + "_" + geohash, TTL 15 min).
   * Isolates provider failures: if one fails or times out, returns results from the others.
   */
  async getAggregatedFuelOffers(lat: number, lng: number, radiusMiles = 50): Promise<FuelOffer[]> {
    const geohash = encodeGeohash(lat, lng, 5);
    const aggregatedOffers: FuelOffer[] = [];

    await Promise.all(
      this.discountProviders.map(async (provider) => {
        try {
          // 1. Check cache first
          const cached = await getCachedFuelOffers(provider.name, geohash);
          if (cached) {
            aggregatedOffers.push(...cached);
            return;
          }

          // 2. Execute with 3s timeout
          const offers = await this.withTimeout(
            provider.getFuelOffers(lat, lng, radiusMiles),
            provider.name
          );

          // 3. Cache results in Firestore
          await setCachedFuelOffers(provider.name, geohash, offers);
          aggregatedOffers.push(...offers);
        } catch (err) {
          // Log error without leaking sensitive telemetry; return results from others
          console.error(`[PartnersRegistry] Provider [${provider.name}] failed/timed out:`, (err as Error).message);
        }
      })
    );

    return aggregatedOffers;
  }

  /**
   * Requests insurance quotes across all enabled insurance providers.
   * Rejects request if consentGivenAt is missing.
   * Never logs MC or DOT numbers or personal driver data.
   */
  async getAggregatedInsuranceQuotes(req: InsuranceQuoteRequest): Promise<{ quotes: InsuranceQuoteResult[]; errorsCount: number }> {
    // Consent verification requirement
    if (!req.consentGivenAt || typeof req.consentGivenAt !== 'string' || req.consentGivenAt.trim().length === 0) {
      throw new Error('Consent is required to request insurance quotes (missing consentGivenAt).');
    }

    // Sanitize log: log only driverId and coverageType, NEVER log mcNumber or dotNumber
    console.log(`[PartnersRegistry] Processing quote request for driver [${req.driverId}] - coverage: [${req.coverageType}]`);

    const results: InsuranceQuoteResult[] = [];
    let errorsCount = 0;

    await Promise.all(
      this.insuranceProviders.map(async (provider) => {
        try {
          const quote = await this.withTimeout(
            provider.requestQuote(req),
            provider.name
          );
          results.push(quote);
        } catch (err) {
          errorsCount++;
          console.error(`[PartnersRegistry] Insurance provider [${provider.name}] quote failed:`, (err as Error).message);
          results.push({
            partner: provider.name,
            status: 'error',
          });
        }
      })
    );

    return { quotes: results, errorsCount };
  }
}

export const partnersRegistry = new PartnersRegistry();
