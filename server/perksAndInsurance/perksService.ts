export interface FuelDiscountPerk {
  id: string;
  chainName: string;
  retailPriceUsd: number;
  truckWithEaseDiscountUsd: number;
  netPriceUsd: number;
  eligibleLocations: string;
  cardNetwork: string;
}

export interface InsuranceProviderQuote {
  id: string;
  provider: string;
  coverageType: string;
  liabilityLimitUsd: number;
  cargoLimitUsd: number;
  monthlyPremiumEstUsd: number;
  instantBindingAvailable: boolean;
  externalPortalUrl: string;
}

export function getFleetFuelDiscounts(): FuelDiscountPerk[] {
  return [
    {
      id: 'perk-loves-01',
      chainName: "Love's Travel Stops",
      retailPriceUsd: 3.92,
      truckWithEaseDiscountUsd: 0.58,
      netPriceUsd: 3.34,
      eligibleLocations: 'Nationwide (640+ locations)',
      cardNetwork: 'TruckWithEase Fleet Fuel MasterCard',
    },
    {
      id: 'perk-pilot-02',
      chainName: 'Pilot Flying J',
      retailPriceUsd: 3.89,
      truckWithEaseDiscountUsd: 0.52,
      netPriceUsd: 3.37,
      eligibleLocations: 'Nationwide (750+ locations)',
      cardNetwork: 'Direct Fleet RFID / EFS / Comdata',
    },
    {
      id: 'perk-ta-03',
      chainName: 'TA Petro Travel Centers',
      retailPriceUsd: 3.95,
      truckWithEaseDiscountUsd: 0.62,
      netPriceUsd: 3.33,
      eligibleLocations: 'Nationwide (280+ locations)',
      cardNetwork: 'TruckWithEase Fleet Diesel Key',
    },
  ];
}

export function getInsuranceQuotes(dotNumber = '1234567'): InsuranceProviderQuote[] {
  return [
    {
      id: 'ins-greatwest-01',
      provider: 'Great West Casualty Company',
      coverageType: 'Primary Auto Liability & Cargo 100k',
      liabilityLimitUsd: 1000000,
      cargoLimitUsd: 100000,
      monthlyPremiumEstUsd: 840,
      instantBindingAvailable: true,
      externalPortalUrl: `https://www.gwccnet.com/quote?dot=${dotNumber}`,
    },
    {
      id: 'ins-progressive-02',
      provider: 'Progressive Commercial Trucking',
      coverageType: 'Comprehensive Motor Carrier Liability',
      liabilityLimitUsd: 1000000,
      cargoLimitUsd: 150000,
      monthlyPremiumEstUsd: 910,
      instantBindingAvailable: true,
      externalPortalUrl: `https://www.progressivecommercial.com/truck-insurance/?dot=${dotNumber}`,
    },
    {
      id: 'ins-coverwallet-03',
      provider: 'CoverWallet / Aon Freight Direct',
      coverageType: 'Physical Damage + General Liability',
      liabilityLimitUsd: 1000000,
      cargoLimitUsd: 250000,
      monthlyPremiumEstUsd: 795,
      instantBindingAvailable: false,
      externalPortalUrl: 'https://www.coverwallet.com/industries/commercial-trucking',
    },
  ];
}
