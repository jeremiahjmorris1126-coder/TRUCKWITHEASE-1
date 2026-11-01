import test from 'node:test';
import assert from 'node:assert/strict';
import { hardwareOrderService, HARDWARE_CATALOG, HARDWARE_ADDONS } from '../server/hardwareOrderService.ts';

test('Commercial Fleet Hardware & Telematics Store Suite', async (t) => {
  await t.test('Catalog correctly designates GPSTab as the #1 Best Bet with high sales margins', () => {
    const catalog = hardwareOrderService.getCatalog();
    assert.strictEqual(catalog.length, 3);

    const gpstab = catalog.find((p) => p.id === 'gpstab');
    assert.ok(gpstab, 'GPSTab exists in catalog');
    assert.strictEqual(gpstab.isBestBet, true);
    assert.strictEqual(gpstab.retailPriceUsd, 299.0);
    assert.strictEqual(gpstab.wholesaleCostUsd, 169.0);
    assert.strictEqual(gpstab.markupUsd, 130.0);
    assert.strictEqual(gpstab.monthlySaasUsd, 28.0);
    assert.strictEqual(gpstab.fmcsaCertificationId, 'GPSTAB-001-US');
    assert.match(gpstab.badge, /BEST BET/);

    const geotab = catalog.find((p) => p.id === 'geotab');
    assert.ok(geotab, 'Geotab exists in catalog');
    assert.strictEqual(geotab.retailPriceUsd, 399.0);
    assert.strictEqual(geotab.wholesaleCostUsd, 249.0);
    assert.strictEqual(geotab.markupUsd, 150.0);

    const azuga = catalog.find((p) => p.id === 'azuga');
    assert.ok(azuga, 'Azuga exists in catalog');
    assert.strictEqual(azuga.retailPriceUsd, 349.0);
    assert.strictEqual(azuga.wholesaleCostUsd, 199.0);
    assert.strictEqual(azuga.markupUsd, 150.0);
  });

  await t.test('High-margin add-ons catalog calculates profit margins accurately', () => {
    const addons = hardwareOrderService.getAddons();
    assert.ok(addons.length >= 5);

    const ycable = addons.find((a) => a.id === 'addon-ycable');
    assert.ok(ycable);
    assert.strictEqual(ycable.retailPriceUsd, 49.99);
    assert.strictEqual(ycable.wholesaleCostUsd, 12.0);
    assert.strictEqual(ycable.markupMarginPercent, 76.0);

    const lock = addons.find((a) => a.id === 'addon-lock');
    assert.ok(lock);
    assert.strictEqual(lock.retailPriceUsd, 29.99);
    assert.strictEqual(lock.wholesaleCostUsd, 6.0);
    assert.strictEqual(lock.markupMarginPercent, 80.0);
  });

  await t.test('Pricing engine applies volume discounts based on fleet size', () => {
    // 1 truck: 0% discount
    const p1 = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 1,
      deliveryMode: 'DIRECT_SHIP',
    });
    assert.strictEqual(p1.discountPercent, 0);
    assert.strictEqual(p1.discountUsd, 0);
    assert.strictEqual(p1.grandTotalUsd, 299.0);
    assert.strictEqual(p1.whiteGloveFeeUsd, 0);

    // 5 trucks: 10% discount on hardware
    const p5 = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 5,
      deliveryMode: 'DIRECT_SHIP',
    });
    assert.strictEqual(p5.discountPercent, 10);
    // Subtotal 299 * 5 = 1495, discount = 149.50, net = 1345.50
    assert.strictEqual(p5.hardwareSubtotalUsd, 1495.0);
    assert.strictEqual(p5.discountUsd, 149.5);
    assert.strictEqual(p5.discountedHardwareUsd, 1345.5);
    assert.strictEqual(p5.grandTotalUsd, 1345.5);

    // 12 trucks: 20% discount on hardware
    const p12 = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 12,
      deliveryMode: 'DIRECT_SHIP',
    });
    assert.strictEqual(p12.discountPercent, 20);
    // Subtotal 299 * 12 = 3588, discount = 717.60, net = 2870.40
    assert.strictEqual(p12.discountUsd, 717.6);
    assert.strictEqual(p12.discountedHardwareUsd, 2870.4);
  });

  await t.test('White Glove concierge fee scales with volume tiers', () => {
    // Solo truck: $199
    const solo = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 1,
      deliveryMode: 'WHITE_GLOVE',
    });
    assert.strictEqual(solo.whiteGloveFeeUsd, 199.0);
    assert.strictEqual(solo.grandTotalUsd, 299.0 + 199.0);

    // 3 trucks: $149/truck = $447
    const fleet3 = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 3,
      deliveryMode: 'WHITE_GLOVE',
    });
    assert.strictEqual(fleet3.whiteGloveFeeUsd, 447.0);

    // 6 trucks: $99/truck = $594
    const fleet6 = hardwareOrderService.calculatePricing({
      vendorId: 'gpstab',
      quantity: 6,
      deliveryMode: 'WHITE_GLOVE',
    });
    assert.strictEqual(fleet6.whiteGloveFeeUsd, 594.0);
  });

  await t.test('Order provisioning generates tracking number and cryptographic Merkle seal', () => {
    const order = hardwareOrderService.createOrder({
      vendorId: 'gpstab',
      quantity: 2,
      deliveryMode: 'WHITE_GLOVE',
      selectedAddonIds: ['addon-ycable'],
      recipientName: 'Jeremiah J. Morris',
      shippingAddress: "Love's Travel Stop #412, 10200 I-20 W",
      city: 'Weatherford',
      state: 'TX',
      zip: '76087',
      phone: '+1 (312) 555-8821',
      destinationType: 'TRUCK_STOP',
      truckStopBrand: "Love's Travel Stop #412",
      vin: '1FUJA6CK8GL981042',
      usdot: '3948210',
      connectorType: '9-Pin Deutsch Green',
    });

    assert.ok(order.id.startsWith('hw-ord-'));
    assert.ok(order.orderNumber.startsWith('TWE-HW-'));
    assert.strictEqual(order.vendorId, 'gpstab');
    assert.strictEqual(order.quantity, 2);
    assert.strictEqual(order.deliveryMode, 'WHITE_GLOVE');
    assert.strictEqual(order.status, 'PENDING_PROVISION');
    assert.ok(order.shipping.trackingNumber.startsWith('79'));
    assert.strictEqual(order.shipping.carrier, 'FedEx Express 2-Day');
    assert.strictEqual(order.merkleSeal.length, 64);
    assert.ok(order.profitMarkupUsd > 0);
  });

  await t.test('Quote generator locks price for 30 days and assigns sales representative', () => {
    const quoteData = hardwareOrderService.generateQuote({
      companyName: 'Morris Hive Freight Logistics LLC',
      contactName: 'Jeremiah J. Morris',
      email: 'jeremiah.morris@morrishive.com',
      phone: '+1 (312) 555-8821',
      fleetSize: 10,
      preferredVendor: 'gpstab',
      deliveryMode: 'WHITE_GLOVE',
    });

    assert.ok(quoteData.quoteId.startsWith('QTE-'));
    assert.strictEqual(quoteData.salesRep.name, 'Jeremiah J. Morris');
    assert.strictEqual(quoteData.pricingSummary.quantity, 10);
    assert.strictEqual(quoteData.pricingSummary.discountPercent, 20);
    assert.match(quoteData.guarantee, /30-Day Guaranteed Price Lock/);
  });
});
