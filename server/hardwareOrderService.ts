/**
 * TruckWithEase // Commercial Fleet Hardware & Telematics Store Engine
 *
 * Implements catalog pricing, wholesale vs retail markup calculations,
 * volume fleet discounts, White Glove concierge deployment, and
 * turnkey order provisioning with tracking number generation.
 */

import crypto from 'crypto';
import type {
  HardwareProduct,
  HardwareAddon,
  HardwareOrder,
  HardwareQuoteRequest,
  HardwareVendorId,
  HardwareDeliveryMode,
} from '../src/types.ts';
import { logger } from '../src/utils/logger.ts';

export const HARDWARE_CATALOG: HardwareProduct[] = [
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

export const HARDWARE_ADDONS: HardwareAddon[] = [
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
      'Heavy-gauge powder-coated aircraft aluminum arm with 50-lb neodymium magnetic clamp. Holds tablets and phones steady on washboard wash gravel.',
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

// In-Memory Hardware Orders Ledger with Seed Data
const ORDERS_STORE: HardwareOrder[] = [
  {
    id: 'hw-ord-88101',
    orderNumber: 'TWE-HW-2026-9041',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    vendorId: 'gpstab',
    vendorName: 'GPSTab Flight ELD Gateway & Telematics Sentinel',
    quantity: 1,
    deliveryMode: 'DIRECT_SHIP',
    whiteGloveFeeUsd: 0,
    hardwareUnitRetailUsd: 299.0,
    hardwareTotalUsd: 299.0,
    selectedAddonIds: ['addon-ycable', 'addon-lock'],
    addonsTotalUsd: 79.98,
    monthlySaasTotalUsd: 28.0,
    discountUsd: 0,
    grandTotalUsd: 378.98,
    profitMarkupUsd: 191.98,
    shipping: {
      destinationType: 'TRUCK_STOP',
      truckStopBrand: "Love's Travel Stop #412",
      recipientName: 'Jeremiah J. Morris',
      shippingAddress: 'Love\'s Travel Stop #412, 10200 I-20 W',
      city: 'Weatherford',
      state: 'TX',
      zip: '76087',
      phone: '+1 (312) 555-8821',
      carrier: 'FedEx Express 2-Day',
      trackingNumber: '794692810482',
      estimatedDelivery: 'Delivered // Signed by Driver in Cab',
    },
    truckDetails: {
      vin: '1FUJA6CK8GL981042',
      usdot: '3948210',
      connectorType: '9-Pin Deutsch Green',
      makeModelYear: '2022 Freightliner Cascadia 126',
    },
    paymentMethod: 'CORPORATE_ACH',
    status: 'DELIVERED',
    salesforceOpportunityId: '0068b000015ZmorrisAA',
    merkleSeal: '8f7a9c1e2b4d5a6f7e8d9c0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
  },
];

export class HardwareOrderService {
  getCatalog(): HardwareProduct[] {
    return HARDWARE_CATALOG;
  }

  getProductById(vendorId: HardwareVendorId): HardwareProduct | undefined {
    return HARDWARE_CATALOG.find((p) => p.id === vendorId);
  }

  getAddons(): HardwareAddon[] {
    return HARDWARE_ADDONS;
  }

  getAllOrders(): HardwareOrder[] {
    return [...ORDERS_STORE];
  }

  calculatePricing(params: {
    vendorId: HardwareVendorId;
    quantity: number;
    deliveryMode: HardwareDeliveryMode;
    addonIds?: string[];
  }): {
    product: HardwareProduct;
    quantity: number;
    deliveryMode: HardwareDeliveryMode;
    unitRetailUsd: number;
    unitWholesaleUsd: number;
    hardwareSubtotalUsd: number;
    discountPercent: number;
    discountUsd: number;
    discountedHardwareUsd: number;
    whiteGloveFeeUsd: number;
    addons: HardwareAddon[];
    addonsTotalUsd: number;
    grandTotalUsd: number;
    monthlySaasTotalUsd: number;
    totalProfitMarkupUsd: number;
    marginPercent: number;
  } {
    const product = this.getProductById(params.vendorId) || HARDWARE_CATALOG[0];
    const qty = Math.max(1, params.quantity || 1);

    // Fleet Volume Discounts
    let discountPercent = 0;
    if (qty >= 10) {
      discountPercent = 20; // 20% off hardware for 10+ trucks
    } else if (qty >= 3) {
      discountPercent = 10; // 10% off hardware for 3-9 trucks
    }

    const unitRetailUsd = product.retailPriceUsd;
    const unitWholesaleUsd = product.wholesaleCostUsd;
    const hardwareSubtotalUsd = unitRetailUsd * qty;
    const discountUsd = parseFloat(((hardwareSubtotalUsd * discountPercent) / 100).toFixed(2));
    const discountedHardwareUsd = parseFloat((hardwareSubtotalUsd - discountUsd).toFixed(2));

    // White Glove Fee Calculation
    let whiteGloveFeeUsd = 0;
    if (params.deliveryMode === 'WHITE_GLOVE') {
      if (qty >= 5) {
        whiteGloveFeeUsd = 99.0 * qty; // $99/truck for 5+
      } else if (qty >= 2) {
        whiteGloveFeeUsd = 149.0 * qty; // $149/truck for 2-4
      } else {
        whiteGloveFeeUsd = 199.0; // $199 for solo truck
      }
    }

    // Addons Calculation
    const selectedAddons: HardwareAddon[] = [];
    let addonsTotalUsd = 0;
    let addonsWholesaleUsd = 0;

    if (params.addonIds && params.addonIds.length > 0) {
      for (const id of params.addonIds) {
        const addon = HARDWARE_ADDONS.find((a) => a.id === id);
        if (addon) {
          selectedAddons.push(addon);
          addonsTotalUsd += addon.retailPriceUsd;
          addonsWholesaleUsd += addon.wholesaleCostUsd;
        }
      }
    }
    addonsTotalUsd = parseFloat((addonsTotalUsd * qty).toFixed(2));
    addonsWholesaleUsd = parseFloat((addonsWholesaleUsd * qty).toFixed(2));

    const grandTotalUsd = parseFloat((discountedHardwareUsd + whiteGloveFeeUsd + addonsTotalUsd).toFixed(2));
    const monthlySaasTotalUsd = parseFloat((product.monthlySaasUsd * qty).toFixed(2));

    // Total Profit Markup
    const totalWholesaleUsd = unitWholesaleUsd * qty + addonsWholesaleUsd;
    // White glove cost is estimated at 30% of fee, 70% is pure margin
    const whiteGloveCost = whiteGloveFeeUsd * 0.3;
    const totalCostUsd = totalWholesaleUsd + whiteGloveCost;
    const totalProfitMarkupUsd = parseFloat((grandTotalUsd - totalCostUsd).toFixed(2));
    const marginPercent = grandTotalUsd > 0 ? parseFloat(((totalProfitMarkupUsd / grandTotalUsd) * 100).toFixed(1)) : 0;

    return {
      product,
      quantity: qty,
      deliveryMode: params.deliveryMode,
      unitRetailUsd,
      unitWholesaleUsd,
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
      marginPercent,
    };
  }

  createOrder(payload: {
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
  }): HardwareOrder {
    const calc = this.calculatePricing({
      vendorId: payload.vendorId,
      quantity: payload.quantity,
      deliveryMode: payload.deliveryMode,
      addonIds: payload.selectedAddonIds,
    });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const orderNum = `TWE-HW-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomHex = crypto.randomBytes(32).toString('hex');
    const trackingNum = `79${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const deliveryDays = payload.deliveryMode === 'WHITE_GLOVE' ? 3 : 2;
    const estDate = new Date(now.getTime() + deliveryDays * 24 * 3600 * 1000);
    const estString = `${estDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} via FedEx Express 2-Day`;

    const newOrder: HardwareOrder = {
      id: `hw-ord-${Date.now()}`,
      orderNumber: orderNum,
      createdAt: now.toISOString(),
      vendorId: calc.product.id,
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
        recipientName: payload.recipientName || 'Commercial Driver',
        shippingAddress: payload.shippingAddress || '10200 I-20 Corridor Delivery Bay',
        city: payload.city || 'Dallas',
        state: payload.state || 'TX',
        zip: payload.zip || '75201',
        phone: payload.phone || '+1 (555) 019-9042',
        carrier: 'FedEx Express 2-Day',
        trackingNumber: trackingNum,
        estimatedDelivery: estString,
      },
      truckDetails: {
        vin: payload.vin || '1FUJA6CK8GL981042',
        usdot: payload.usdot || '3948210',
        connectorType: payload.connectorType || '9-Pin Deutsch Green (J1939)',
        makeModelYear: payload.makeModelYear || '2023 Peterbilt 579 UltraLoft',
      },
      paymentMethod: payload.paymentMethod || 'CORPORATE_ACH',
      status: payload.deliveryMode === 'WHITE_GLOVE' ? 'PENDING_PROVISION' : 'FIRMWARE_FLASHED',
      salesforceOpportunityId: `0068b${Math.floor(1000000000 + Math.random() * 9000000000)}morris`,
      merkleSeal: randomHex,
    };

    ORDERS_STORE.unshift(newOrder);

    logger.info('HARDWARE_STORE', `New Hardware Order ${newOrder.orderNumber} placed for ${calc.product.name}`, {
      orderId: newOrder.id,
      vendorId: newOrder.vendorId,
      quantity: newOrder.quantity,
      deliveryMode: newOrder.deliveryMode,
      grandTotalUsd: newOrder.grandTotalUsd,
      profitMarkupUsd: newOrder.profitMarkupUsd,
      trackingNumber: trackingNum,
    });

    return newOrder;
  }

  generateQuote(req: HardwareQuoteRequest): {
    quoteId: string;
    issuedAt: string;
    validUntil: string;
    quoteRequest: HardwareQuoteRequest;
    pricingSummary: ReturnType<HardwareOrderService['calculatePricing']>;
    salesRep: {
      name: string;
      title: string;
      phone: string;
      email: string;
    };
    guarantee: string;
  } {
    const pricing = this.calculatePricing({
      vendorId: req.preferredVendor,
      quantity: req.fleetSize,
      deliveryMode: req.deliveryMode,
    });

    const now = new Date();
    const validUntil = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();

    return {
      quoteId: `QTE-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      issuedAt: now.toISOString(),
      validUntil,
      quoteRequest: req,
      pricingSummary: pricing,
      salesRep: {
        name: 'Jeremiah J. Morris',
        title: 'Vice President of Fleet Telematics & Commercial Hardware',
        phone: '+1 (312) 555-8821',
        email: 'sales@truckwithease.com',
      },
      guarantee:
        '30-Day Guaranteed Price Lock & FMCSA Zero-Fine Compliance Attestation. If roadside officers cite equipment failure during first 30 days, TruckWithEase pays your citation in full.',
    };
  }
}

export const hardwareOrderService = new HardwareOrderService();
