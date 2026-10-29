import { DiscountProvider, FuelOffer } from '../types';
import { getPartnerSecret } from '../secrets';

export class TruckSmarterDiscountProvider implements DiscountProvider {
  name = 'trucksmarter';

  isConfigured(): boolean {
    return Boolean(getPartnerSecret('TRUCKSMARTER_API_KEY'));
  }

  async getFuelOffers(lat: number, lng: number, radiusMiles = 50): Promise<FuelOffer[]> {
    // Mock implementation conforming strictly to FuelOffer spec
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return [
      {
        partner: 'trucksmarter',
        stationName: 'Pilot Flying J Travel Plaza #102',
        brand: 'Pilot',
        lat: lat - 0.05,
        lng: lng + 0.04,
        discountPerGallon: 0.52,
        retailPrice: 3.85,
        expiresAt,
        deepLink: 'https://trucksmarter.com/fuel?station=pilot-102',
      },
      {
        partner: 'trucksmarter',
        stationName: 'TA Travel Center #67',
        brand: 'TA Petro',
        lat: lat + 0.07,
        lng: lng - 0.06,
        discountPerGallon: 0.62,
        retailPrice: 3.94,
        expiresAt,
        deepLink: 'https://trucksmarter.com/fuel?station=ta-67',
      },
    ];
  }
}
