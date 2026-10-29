export interface FuelOffer {
  id?: string;
  partner: string;          // "wex", "trucksmarter", etc.
  stationName: string;
  brand: string;
  lat: number;
  lng: number;
  discountPerGallon: number | null;
  retailPrice: number | null;
  expiresAt: string;        // ISO timestamp
  deepLink: string | null;  // partner app or activation link
  distanceMiles?: number;
}

export type CoverageType = 'primary_liability' | 'physical_damage' | 'cargo';

export interface InsuranceQuoteRequest {
  driverId: string;
  consentGivenAt: string;   // required, reject if missing
  mcNumber?: string;
  dotNumber?: string;
  coverageType: CoverageType;
  yearsInBusiness?: number;
  vehicleVin?: string;
}

export interface InsuranceQuoteResult {
  partner: string;
  status: 'quoted' | 'pending' | 'declined' | 'error';
  premiumEstimate?: number;
  referenceId?: string;
  redirectUrl?: string;     // if the partner finishes the quote on their site
}

// Backward compatibility aliases for legacy adapters and UI screens
export type InsuranceQuote = InsuranceQuoteResult;

export interface PartnerDriverProfile {
  id?: string;
  driverId?: string;
  name?: string;
  mcNumber?: string;
  dotNumber?: string;
  yearsInBusiness?: number;
  coverageType?: CoverageType;
}

export interface DiscountProvider {
  name: string;
  getFuelOffers(lat: number, lng: number, radiusMiles?: number): Promise<FuelOffer[]>;
}

export interface InsuranceProvider {
  name: string;
  requestQuote(req: InsuranceQuoteRequest): Promise<InsuranceQuoteResult>;
}

export type PartnerAdapter = DiscountProvider | InsuranceProvider;
