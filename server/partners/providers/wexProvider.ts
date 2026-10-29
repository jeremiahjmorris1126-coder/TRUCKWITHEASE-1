import { DiscountProvider, FuelOffer } from '../types';
import { getPartnerSecret } from '../secrets';

export class WexDiscountProvider implements DiscountProvider {
  name = 'wex';

  isConfigured(): boolean {
    return Boolean(getPartnerSecret('WEX_API_KEY'));
  }

  async getFuelOffers(lat: number, lng: number, radiusMiles = 50): Promise<FuelOffer[]> {
    // Mock implementation conforming strictly to FuelOffer spec
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return [
      {
        partner: 'wex',
        stationName: "Love's Travel Stop #420",
        brand: "Love's",
        lat: lat + 0.03,
        lng: lng - 0.02,
        discountPerGallon: 0.58,
        retailPrice: 3.89,
        expiresAt,
        deepLink: 'https://wex.com/fleet/activate?station=loves-420',
      },
      {
        partner: 'wex',
        stationName: 'Speedway Commercial Diesel #881',
        brand: 'Speedway',
        lat: lat - 0.04,
        lng: lng + 0.03,
        discountPerGallon: 0.45,
        retailPrice: 3.82,
        expiresAt,
        deepLink: 'https://wex.com/fleet/activate?station=speedway-881',
      },
    ];
  }
}
