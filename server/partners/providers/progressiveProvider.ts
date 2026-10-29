import { InsuranceProvider, InsuranceQuoteRequest, InsuranceQuoteResult } from '../types';
import { getPartnerSecret } from '../secrets';

export class ProgressiveInsuranceProvider implements InsuranceProvider {
  name = 'progressive';

  isConfigured(): boolean {
    return Boolean(getPartnerSecret('PROGRESSIVE_API_KEY'));
  }

  async requestQuote(req: InsuranceQuoteRequest): Promise<InsuranceQuoteResult> {
    // Underwriting mock estimate based on coverage type
    const baseRates: Record<string, number> = {
      primary_liability: 820,
      physical_damage: 480,
      cargo: 290,
    };

    const estimate = baseRates[req.coverageType] || 750;

    return {
      partner: 'progressive',
      status: 'quoted',
      premiumEstimate: estimate,
      referenceId: `prog-ref-${Date.now()}`,
      redirectUrl: `https://www.progressivecommercial.com/finish-quote?ref=prog-ref-${Date.now()}`,
    };
  }
}
