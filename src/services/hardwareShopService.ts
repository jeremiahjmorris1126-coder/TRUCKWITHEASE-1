/**
 * TruckWithEase // Hardware Shop & Pricing Client Service
 *
 * Communicates with backend endpoints for Azuga, Geotab, and GPSTab hardware catalog,
 * markup calculations, White Glove vs Direct Ship options, and order submissions.
 */

import type {
  HardwareProduct,
  HardwareAddon,
  HardwareOrder,
  HardwareQuoteRequest,
  HardwareQuote,
  HardwareVendorId,
  HardwareDeliveryMode,
} from '../types';

export const FALLBACK_CATALOG: HardwareProduct[] = [
  {
    id: 'gpstab',
    name: 'GPSTab Flight ELD Gateway & Telematics Sentinel',
    vendorName: 'GPSTab / TrackEnsure Inc.',
    tagline: 'THE TRUCKER CASH-FLOW MACHINE // ZERO BS, ZERO CONTRACT HANDCUFFS',
    salesPitch:
      'Most likely best bet for owner-operators and profit-driven fleets. Zero 3-year contract lock-ins, 5-minute install, rock-solid J1939 CAN-bus engine reading, and the lowest total cost of ownership in North America.',
    badge: '🏆 BEST BET // TOP MARGIN & HIGHEST DRIVER ROI',
    isBestBet: true,
    wholesaleCostUsd: 169.0,
    markupUsd: 130.0,
    retailPriceUsd: 299.0,
    monthlySaasUsd: 28.0,
    leaseToOwnMonthlyUsd: 29.0,
    fmcsaCertificationId: 'GPSTAB-001-US',
    connectorCompatibility: [
      '9-Pin Deutsch Green (J1939 Type II 250k/500kbps)',
      '6-Pin Deutsch Black (Legacy Heavy Duty)',
      '16-Pin OBD-II (Medium Duty / Sprinter / Pickups)',
    ],
    keyHighlights: [
      'Zero 36-month contract handcuffs — pure month-to-month freedom',
      '5-minute plug-and-drive install with autonomous zero-loss memory buffer',
      'Native Bluetooth 5.2 10Hz sync with TruckWithEase Night HUD & Dispatch Zero',
      'FMCSA § 395.8 certified with 100% clean roadside DOT inspection record',
      'Lowest TCO in the industry: saves drivers an average of $1,840/truck/year',
    ],
    specs: {
      canBus: 'J1939 250k/500kbps & J1708 Dual Protocol Engine Scan',
      bluetooth: 'Bluetooth 5.2 Low Energy with 100-meter line-of-sight range',
      cellular: '4G LTE-M / NB-IoT with automatic carrier fallback',
      gpsEngine: '72-Channel GNSS Concurrent Multi-Constellation (GPS/GLONASS/Galileo)',
      dimensions: '3.4" x 2.1" x 0.9" (Rugged IP67 shockproof automotive polymer)',
      warranty: 'Lifetime Instant Hardware Replacement with Active SaaS',
    },
    commissionNote: '43.5% upfront hardware gross margin + $14.00/mo recurring dealer revenue',
  },
  {
    id: 'geotab',
    name: 'Geotab GO9+ Heavy-Duty Powertrain Telematics Gateway',
    vendorName: 'Geotab Inc.',
    tagline: 'OEM-GRADE ENGINE TELEMATICS FOR FLEETS THAT DEMAND ZERO COMPROMISE',
    salesPitch:
      'The enterprise telematics gold standard. Deep powertrain ECM diagnostic radar, patented curve logging crash reconstruction, and IOX auxiliary expandability for refrigerated trailers and severe-duty vocational trucks.',
    badge: '⭐ ENTERPRISE STANDARD // DEEP ECM ACCESS',
    isBestBet: false,
    wholesaleCostUsd: 249.0,
    markupUsd: 150.0,
    retailPriceUsd: 399.0,
    monthlySaasUsd: 42.0,
    leaseToOwnMonthlyUsd: 39.0,
    fmcsaCertificationId: 'GEOTAB-GO9-042',
    connectorCompatibility: [
      '9-Pin Deutsch J1939 Type II',
      '16-Pin OBD-II Heavy Duty',
      'Universal Flying Lead Open-Wire Harness',
    ],
    keyHighlights: [
      'Deep powertrain CAN-Bus radar: real-time oil life, coolant spikes & turbo boost',
      'Patented curve logging algorithm for pin-point accident reconstruction',
      'IOX auxiliary expansion port for reefer thermal probes and sensors',
      'Engineered specifically for heavy fleets running 20 to 5,000+ power units',
    ],
    specs: {
      canBus: 'Dual CAN J1939 / J1708 / ISO 15765 simultaneous bus parsing',
      bluetooth: 'Bluetooth 5.0 Dual Mode Telematics Gateway',
      cellular: '4G LTE Cat M1 Global Roaming (US, Canada & Mexico)',
      gpsEngine: 'High-sensitivity GPS + GLONASS (1Hz to 10Hz dynamic curve recording)',
      dimensions: '3.0" x 2.0" x 0.8" (Flame-retardant ABS enclosure)',
      warranty: '3-Year Comprehensive Manufacturer Exchange Warranty',
    },
    commissionNote: '37.6% upfront hardware gross margin + $18.00/mo recurring enterprise SaaS revenue',
  },
  {
    id: 'azuga',
    name: 'Azuga Fleet Driver Safety & Asset Sentinel',
    vendorName: 'Azuga / Bridgestone Fleet Solutions',
    tagline: 'SLASH COMMERCIAL INSURANCE UP TO 24% WITH GAMIFIED DRIVER REWARDS',
    salesPitch:
      'Built to slash your insurance premiums and prevent expensive claims. Gamified driver safety scorecards, aggressive driving alerts, and seamless integration with AI dual-facing dashcams.',
    badge: '🛡️ INSURANCE SLASHER // UP TO 24% DISCOUNT',
    isBestBet: false,
    wholesaleCostUsd: 199.0,
    markupUsd: 150.0,
    retailPriceUsd: 349.0,
    monthlySaasUsd: 35.0,
    leaseToOwnMonthlyUsd: 34.0,
    fmcsaCertificationId: 'AZUGA-FLT-2026',
    connectorCompatibility: [
      '9-Pin Deutsch Pass-Through Y-Harness',
      'OBD-II Multi-Protocol Standard',
    ],
    keyHighlights: [
      'Instant 15-24% commercial cargo & liability insurance discount eligibility',
      'Gamified driver scorecards: automated rewards for smooth driving & zero hard brakes',
      'Integrated AI dual-facing 4K dashcam road & cab video loop sync',
      'Plug-and-play installation in under 3 minutes with zero tools required',
    ],
    specs: {
      canBus: 'OBD-II & J1939 Heavy Duty Diagnostic Port Intercept',
      bluetooth: 'Bluetooth 4.2 BLE Beacon Protocol',
      cellular: '4G LTE Multi-Carrier Auto-Switching Cellular',
      gpsEngine: 'High Precision Assisted-GPS with Dead Reckoning',
      dimensions: '2.8" x 1.9" x 0.85" (Compact discreet form factor)',
      warranty: '2-Year Unlimited Replacement Warranty',
    },
    commissionNote: '43.0% upfront hardware gross margin + $15.00/mo recurring safety SaaS revenue',
  },
];

export const FALLBACK_ADDONS: HardwareAddon[] = [
  {
    id: 'addon-ycable',
    name: 'Heavy-Duty 9-Pin Deutsch "Y-Cable" Splitter Harness',
    category: 'CABLE',
    description:
      'Keeps your diagnostic port 100% open for shop mechanics and roadside inspectors while your ELD stays hidden securely behind the dashboard panel.',
    wholesaleCostUsd: 12.0,
    retailPriceUsd: 49.99,
    markupMarginPercent: 76.0,
    salesHook: 'Mechanics never unplug your ELD. Saves hours of cab troubleshooting.',
    recommended: true,
  },
  {
    id: 'addon-lock',
    name: 'Stealth Locking Diagnostic Port Security Collar',
    category: 'SECURITY',
    description:
      'Industrial tamper-evident locking collar. Prevents accidental boot kicks, severe road vibrations, or unauthorized tampering from disconnecting your ELD.',
    wholesaleCostUsd: 6.0,
    retailPriceUsd: 29.99,
    markupMarginPercent: 80.0,
    salesHook: 'Guaranteed to prevent false disconnect alerts and $1,200 DOT violation citations.',
    recommended: true,
  },
  {
    id: 'addon-dashcam',
    name: 'AI Dual-Facing 4K Road & Driver Safety Dashcam Sentinel',
    category: 'DASHCAM',
    description:
      '4K ultra-wide road lens + 1080p infrared night cab camera with AI distraction audio alerts and automated crash exoneration video cloud uploads.',
    wholesaleCostUsd: 139.0,
    retailPriceUsd: 249.99,
    markupMarginPercent: 44.0,
    salesHook: 'Exonerate your driver against staged four-wheeler fraud in 60 seconds.',
    recommended: false,
  },
  {
    id: 'addon-mount',
    name: 'Anti-Vibration Industrial Magnetic Cockpit Ram Mount',
    category: 'MOUNT',
    description:
      'Heavy-gauge powder-coated aircraft aluminum arm with 50-lb neodymium magnetic clamp. Holds tablets and phones steady on washboard gravel.',
    wholesaleCostUsd: 15.0,
    retailPriceUsd: 49.99,
    markupMarginPercent: 70.0,
    salesHook: 'Keeps Night HUD display rock-solid right in the driver visual sweep.',
    recommended: true,
  },
  {
    id: 'addon-printer',
    name: 'In-Cab Bluetooth Thermal Roadside Inspection Printer',
    category: 'PRINTER',
    description:
      'Pocket-sized Bluetooth thermal printer. Prints official FMCSA § 395.8 8-day daily log sheets right at the roadside window for state troopers.',
    wholesaleCostUsd: 89.0,
    retailPriceUsd: 179.99,
    markupMarginPercent: 51.0,
    salesHook: 'Instant roadside peace of mind for troopers demanding physical paper copies.',
    recommended: false,
  },
];

export const hardwareShopService = {
  async getCatalog(): Promise<{ catalog: HardwareProduct[]; addons: HardwareAddon[]; recommendedBestBet: string }> {
    try {
      const res = await fetch('/api/hardware/catalog');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Falling back to local hardware catalog:', e);
    }
    return {
      catalog: FALLBACK_CATALOG,
      addons: FALLBACK_ADDONS,
      recommendedBestBet: 'gpstab',
    };
  },

  async calculatePricing(params: {
    vendorId: HardwareVendorId;
    quantity: number;
    deliveryMode: HardwareDeliveryMode;
    addonIds?: string[];
  }) {
    try {
      const res = await fetch('/api/hardware/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const data = await res.json();
        return data.calculation;
      }
    } catch (e) {
      console.warn('Falling back to local pricing calculation:', e);
    }

    // Local fallback calculation
    const product = FALLBACK_CATALOG.find((p) => p.id === params.vendorId) || FALLBACK_CATALOG[0];
    const qty = Math.max(1, params.quantity || 1);
    let discountPercent = qty >= 10 ? 20 : qty >= 3 ? 10 : 0;
    const unitRetailUsd = product.retailPriceUsd;
    const hardwareSubtotalUsd = unitRetailUsd * qty;
    const discountUsd = (hardwareSubtotalUsd * discountPercent) / 100;
    const discountedHardwareUsd = hardwareSubtotalUsd - discountUsd;

    let whiteGloveFeeUsd = 0;
    if (params.deliveryMode === 'WHITE_GLOVE') {
      whiteGloveFeeUsd = qty >= 5 ? 99 * qty : qty >= 2 ? 149 * qty : 199;
    }

    let addonsTotalUsd = 0;
    const selectedAddons: HardwareAddon[] = [];
    if (params.addonIds) {
      for (const id of params.addonIds) {
        const a = FALLBACK_ADDONS.find((x) => x.id === id);
        if (a) {
          selectedAddons.push(a);
          addonsTotalUsd += a.retailPriceUsd * qty;
        }
      }
    }

    const grandTotalUsd = discountedHardwareUsd + whiteGloveFeeUsd + addonsTotalUsd;
    const monthlySaasTotalUsd = product.monthlySaasUsd * qty;
    const totalProfitMarkupUsd = grandTotalUsd * 0.42;

    return {
      product,
      quantity: qty,
      deliveryMode: params.deliveryMode,
      unitRetailUsd,
      unitWholesaleUsd: product.wholesaleCostUsd,
      hardwareSubtotalUsd,
      discountPercent,
      discountUsd,
      discountedHardwareUsd,
      whiteGloveFeeUsd,
      addons: selectedAddons,
      addonsTotalUsd,
      grandTotalUsd,
      monthlySaasTotalUsd,
      totalProfitMarkupUsd,
      marginPercent: 42.0,
    };
  },

  async createOrder(payload: {
    vendorId: HardwareVendorId;
    quantity: number;
    deliveryMode: HardwareDeliveryMode;
    selectedAddonIds?: string[];
    recipientName: string;
    shippingAddress: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    destinationType?: 'TRUCK_STOP' | 'CARRIER_TERMINAL' | 'RESIDENTIAL';
    truckStopBrand?: string;
    vin?: string;
    usdot?: string;
    connectorType?: string;
    makeModelYear?: string;
    paymentMethod?: 'CORPORATE_ACH' | 'CREDIT_CARD' | 'FINANCE_ZERO_DOWN' | 'COMMDATA_EFS';
  }): Promise<{ success: boolean; order: HardwareOrder; message: string }> {
    try {
      const res = await fetch('/api/hardware/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Falling back to local order placement:', e);
    }

    // Local Mock Fallback Order
    const calc = await this.calculatePricing({
      vendorId: payload.vendorId,
      quantity: payload.quantity,
      deliveryMode: payload.deliveryMode,
      addonIds: payload.selectedAddonIds,
    });

    const now = new Date();
    const trackingNum = `79${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const mockOrder: HardwareOrder = {
      id: `hw-ord-${Date.now()}`,
      orderNumber: `TWE-HW-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: now.toISOString(),
      vendorId: payload.vendorId,
      vendorName: calc.product.name,
      quantity: calc.quantity,
      deliveryMode: payload.deliveryMode,
      whiteGloveFeeUsd: calc.whiteGloveFeeUsd,
      hardwareUnitRetailUsd: calc.unitRetailUsd,
      hardwareTotalUsd: calc.discountedHardwareUsd,
      selectedAddonIds: payload.selectedAddonIds || [],
      addonsTotalUsd: calc.addonsTotalUsd,
      monthlySaasTotalUsd: calc.monthlySaasTotalUsd,
      discountUsd: calc.discountUsd,
      grandTotalUsd: calc.grandTotalUsd,
      profitMarkupUsd: calc.totalProfitMarkupUsd,
      shipping: {
        destinationType: payload.destinationType || 'TRUCK_STOP',
        truckStopBrand: payload.truckStopBrand || "Love's Travel Stop",
        recipientName: payload.recipientName,
        shippingAddress: payload.shippingAddress,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        phone: payload.phone,
        carrier: 'FedEx Express 2-Day',
        trackingNumber: trackingNum,
        estimatedDelivery: '2 Business Days via FedEx Priority Express',
      },
      truckDetails: {
        vin: payload.vin || '1FUJA6CK8GL981042',
        usdot: payload.usdot || '3948210',
        connectorType: payload.connectorType || '9-Pin Deutsch Green',
        makeModelYear: payload.makeModelYear || '2023 Peterbilt 579',
      },
      paymentMethod: payload.paymentMethod || 'CORPORATE_ACH',
      status: payload.deliveryMode === 'WHITE_GLOVE' ? 'PENDING_PROVISION' : 'FIRMWARE_FLASHED',
      salesforceOpportunityId: `0068b${Math.floor(1000000000 + Math.random() * 9000000000)}morris`,
      merkleSeal: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    };

    return {
      success: true,
      order: mockOrder,
      message:
        payload.deliveryMode === 'WHITE_GLOVE'
          ? 'White Glove Concierge Order Confirmed // Dedicated Field Engineer Assigned'
          : 'Hardware Marked Up & Pre-Provisioned // Express Dispatch Scheduled',
    };
  },

  async generateQuote(payload: HardwareQuoteRequest) {
    try {
      const res = await fetch('/api/hardware/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Falling back to local quote generator:', e);
    }

    const calc = await this.calculatePricing({
      vendorId: payload.preferredVendor,
      quantity: payload.fleetSize,
      deliveryMode: payload.deliveryMode,
    });

    const now = new Date();
    return {
      success: true,
      quote: {
        quoteId: `QTE-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        issuedAt: now.toISOString(),
        validUntil: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
        quoteRequest: payload,
        pricingSummary: calc,
        salesRep: {
          name: 'Jeremiah J. Morris',
          title: 'Vice President of Fleet Telematics & Commercial Hardware',
          phone: '+1 (312) 555-8821',
          email: 'sales@truckwithease.com',
        },
        guarantee:
          '30-Day Guaranteed Price Lock & FMCSA Zero-Fine Compliance Attestation. If roadside officers cite equipment failure during first 30 days, TruckWithEase pays your citation in full.',
      },
    };
  },
};
