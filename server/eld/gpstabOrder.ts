import { resolveHttpsUrl } from '../config/externalLinks';

/**
 * GPSTab ordering: TruckWithEase does not sell or fulfil ELD hardware. Users are
 * sent to GPSTab's own store to order the device and service plan.
 *
 * GPSTAB_ORDER_URL overrides the destination (e.g. a partner/referral link from
 * GPSTab) without a code change. Only https URLs are accepted.
 */

export const GPSTAB_DEFAULT_ORDER_URL = 'https://gpstab.com/product-category/eld/';

export interface EldOrderOption {
  id: 'GPSTAB';
  name: string;
  orderUrl: string;
  /** True when a custom partner/referral URL is configured. */
  partnerLink: boolean;
  note: string;
}

export function resolveGpstabOrderUrl(raw = process.env.GPSTAB_ORDER_URL): { url: string; custom: boolean } {
  return resolveHttpsUrl(raw, GPSTAB_DEFAULT_ORDER_URL, 'GPSTAB_ORDER_URL');
}

export function getEldOrderOptions(): EldOrderOption[] {
  const { url, custom } = resolveGpstabOrderUrl();
  return [
    {
      id: 'GPSTAB',
      name: 'GPSTab',
      orderUrl: url,
      partnerLink: custom,
      note: 'Ordered and billed directly by GPSTab. Pricing and terms are set by GPSTab.',
    },
  ];
}
