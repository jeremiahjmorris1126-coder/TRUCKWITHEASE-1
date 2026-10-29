import { InsuranceProvider, InsuranceQuoteRequest, InsuranceQuoteResult } from '../types';
import { getPartnerSecret } from '../secrets';

export class CoverWalletInsuranceProvider implements InsuranceProvider {
  name = 'coverwallet';

  isConfigured(): boolean {
    return Boolean(getPartnerSecret('COVERWALLET_API_KEY'));
  }

  async requestQuote(req: InsuranceQuoteRequest): Promise<InsuranceQuoteResult> {
    const baseRates: Record<string, number> = {
      primary_liability: 790,
      physical_damage: 460,
      cargo: 275,
    };

    const estimate = baseRates[req.coverageType] || 720;

    return {
      partner: 'coverwallet',
      status: 'quoted',
      premiumEstimate: estimate,
      referenceId: `cw-ref-${Date.now()}`,
      redirectUrl: `https://www.coverwallet.com/bind?ref=cw-ref-${Date.now()}`,
    };
  }
}
