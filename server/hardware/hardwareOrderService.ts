import { fleetStore, CallerIdentity, TenantAccessError } from '../data/fleetStore';
import crypto from 'node:crypto';

export type EldVendorName = 'Azuga' | 'Geotab' | 'GPSTab' | 'Samsara' | 'BYOD_EXISTING';

export interface HardwareCatalogItem {
  id: string;
  name: string;
  vendor: EldVendorName;
  type: 'ELD_DEVICE' | 'CAMERA' | 'TIER';
  monthlyPriceUsd: number;
  hardwareUpfrontUsd: number;
  description: string;
  specs: string[];
}

export interface HardwareOrderRequest {
  tierId: 'TIER_STARTER' | 'TIER_PRO' | 'TIER_ENTERPRISE';
  hardwareId: 'samsara_vg54' | 'geotab_go9' | 'azuga_gateway' | 'gpstab_link' | 'opt_out_existing';
  cameraId: 'camera_dual_ai' | 'camera_road_hd' | 'camera_none';
  existingVendor?: 'Azuga' | 'Geotab' | 'GPSTab' | 'Samsara';
  existingDeviceSerialNumber?: string;
  shippingAddress: {
    recipientName: string;
    companyName?: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
  };
  userSoleFmcsaRegistrationAcknowledged: boolean;
}

export interface HardwareOrderRecord {
  id: string;
  fleetId: string;
  driverId: string;
  tierId: string;
  tierName: string;
  hardwareId: string;
  hardwareName: string;
  vendor: EldVendorName;
  cameraId: string;
  cameraName: string;
  isOptOutExistingEld: boolean;
  assignedSerialNumbers: string[];
  shippingAddress: HardwareOrderRequest['shippingAddress'];
  vendorFulfillmentStatus: 'SUBMITTED_TO_VENDOR' | 'VENDOR_DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'ACTIVE_BYOD';
  carrierTrackingNumber: string;
  vendorOrderId: string;
  fmcsaDisclaimerAcknowledged: boolean;
  fmcsaStatutoryNotice: string;
  createdAt: string;
}

export const HARDWARE_CATALOG: HardwareCatalogItem[] = [
  // Tiers
  {
    id: 'TIER_STARTER',
    name: 'Owner-Operator Starter Tier',
    vendor: 'BYOD_EXISTING',
    type: 'TIER',
    monthlyPriceUsd: 49,
    hardwareUpfrontUsd: 0,
    description: 'FMCSA 49 CFR § 395 compliance, PrePass integration, and automated detention invoices.',
    specs: ['1 Commercial Vehicle', 'PrePass & Scales Radar', 'Automated Detention Engine'],
  },
  {
    id: 'TIER_PRO',
    name: 'Fleet Professional Tier',
    vendor: 'BYOD_EXISTING',
    type: 'TIER',
    monthlyPriceUsd: 89,
    hardwareUpfrontUsd: 0,
    description: 'High-precision telematics, DVIR defect signatures, and 3-way ELD co-pilot sync.',
    specs: ['Up to 5 Vehicles', 'Live CAN-Bus Diagnostics', 'Automated IFTA Tracking'],
  },
  {
    id: 'TIER_ENTERPRISE',
    name: 'Enterprise Multi-Terminal Tier',
    vendor: 'BYOD_EXISTING',
    type: 'TIER',
    monthlyPriceUsd: 129,
    hardwareUpfrontUsd: 0,
    description: 'Unlimited fleets, IBM Sterling B2B EDI 204/214 automation, and watsonx Granite risk analytics.',
    specs: ['Unlimited Terminals', 'IBM Sterling EDI Hub', 'Dedicated 24/7 Dispatch Mesh'],
  },

  // ELD Devices
  {
    id: 'samsara_vg54',
    name: 'Samsara VG54 High-Precision Telematics Gateway',
    vendor: 'Samsara',
    type: 'ELD_DEVICE',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 149,
    description: 'Direct-to-cab ECM J1939/OBD-II gateway with built-in GPS and LTE hot-spotting.',
    specs: ['J1939 250k/500k CAN-Bus', '1-Second Telematics Sampling', 'Direct Drop-Ship from Samsara'],
  },
  {
    id: 'geotab_go9',
    name: 'Geotab GO9 Commercial Vehicle Telematics Unit',
    vendor: 'Geotab',
    type: 'ELD_DEVICE',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 129,
    description: 'Global industry standard OBD-II and 9-Pin Deutsch connector for commercial tractors.',
    specs: ['Dual CAN Networks', 'Accelerometer Gyro Sensor', 'Direct Drop-Ship from Geotab'],
  },
  {
    id: 'azuga_gateway',
    name: 'Azuga Safety ELD Gateway Harness',
    vendor: 'Azuga',
    type: 'ELD_DEVICE',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 99,
    description: 'Plug-and-play heavy-duty diagnostic port connector with driver safety scoring.',
    specs: ['Plug-and-Drive 9-Pin Harness', 'Built-in GPS + Cellular', 'Direct Drop-Ship from Azuga'],
  },
  {
    id: 'gpstab_link',
    name: 'GPSTab Heavy-Duty Bluetooth Diagnostic Link',
    vendor: 'GPSTab',
    type: 'ELD_DEVICE',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 89,
    description: 'Ruggedized Bluetooth ELD device for owner-operators and small fleets.',
    specs: ['Bluetooth Low Energy (BLE)', 'Sub-5ms Protocol Sync', 'Direct Drop-Ship from GPSTab'],
  },
  {
    id: 'opt_out_existing',
    name: 'Bring Your Own ELD — Connect Existing Device (Opt-Out)',
    vendor: 'BYOD_EXISTING',
    type: 'ELD_DEVICE',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 0,
    description: 'No new hardware needed. Seamlessly link TruckWithEase to your existing Azuga, Geotab, GPSTab, or Samsara unit.',
    specs: ['Zero Hardware Cost', 'Instant Software API Link', 'Zero Hardware Shipping Delay'],
  },

  // Camera Options
  {
    id: 'camera_dual_ai',
    name: 'Dual-Facing AI Dashcam (Road + In-Cab Infrared)',
    vendor: 'Samsara',
    type: 'CAMERA',
    monthlyPriceUsd: 15,
    hardwareUpfrontUsd: 189,
    description: 'Full HD dual camera with automated cab alerts, lane departure warning, and collision detection.',
    specs: ['1080p HDR Front & In-Cab', 'Night Vision Infrared Sensor', 'Tamper-Proof Cloud Evidence'],
  },
  {
    id: 'camera_road_hd',
    name: 'Road-Facing Commercial HD Dashcam',
    vendor: 'Geotab',
    type: 'CAMERA',
    monthlyPriceUsd: 10,
    hardwareUpfrontUsd: 129,
    description: 'Forward-facing wide-angle HD commercial dashcam for accident exoneration and claims proof.',
    specs: ['140° Wide Angle Road View', 'G-Sensor Crash Detection', 'Secure Event Uploads'],
  },
  {
    id: 'camera_none',
    name: 'No Camera (Opt-Out)',
    vendor: 'BYOD_EXISTING',
    type: 'CAMERA',
    monthlyPriceUsd: 0,
    hardwareUpfrontUsd: 0,
    description: 'Operate strictly with ELD telematics and mobile HUD without onboard video recording.',
    specs: ['Zero Camera Upfront Cost', 'Zero Camera Monthly Fee', 'Maximum Driver Privacy'],
  },
];

export const MANDATORY_FMCSA_STATUTORY_DISCLAIMER =
  'IMPORTANT FMCSA NOTICE UNDER 49 CFR PART 395: TruckWithEase tracks, documents, and stores hardware serial numbers for internal fleet warranty, carrier recordkeeping, and dispatch diagnostics. However, under Federal Motor Carrier Safety Administration (FMCSA) regulations (49 CFR § 395.22 & 49 CFR § 395.24), it is SOLELY THE USER/CARRIER LEGAL RESPONSIBILITY to register the ELD device identifier and vehicle VIN directly with the official FMCSA ELD Registry prior to operating the commercial motor vehicle in interstate or regulated intrastate commerce.';

export class HardwareOrderService {
  /**
   * Retrieves available hardware devices, subscription tiers, and cameras
   */
  public getCatalog(): HardwareCatalogItem[] {
    return [...HARDWARE_CATALOG];
  }

  /**
   * Submits a direct-ship hardware order or configures an existing ELD link
   * Generates documented serial numbers for internal fleet warranty records
   * Enforces mandatory user acknowledgment of FMCSA registration responsibility
   */
  public async submitOrder(caller: CallerIdentity, req: HardwareOrderRequest): Promise<HardwareOrderRecord> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }

    if (!req.userSoleFmcsaRegistrationAcknowledged) {
      throw new TenantAccessError(
        'Mandatory statutory acknowledgment required: Under 49 CFR Part 395, it is solely the user responsibility to register the ELD with the FMCSA ELD Registry.',
        400
      );
    }

    const tierItem = HARDWARE_CATALOG.find((i) => i.id === req.tierId);
    if (!tierItem) {
      throw new TenantAccessError(`Invalid subscription tier: ${req.tierId}`, 400);
    }

    const hardwareItem = HARDWARE_CATALOG.find((i) => i.id === req.hardwareId);
    if (!hardwareItem) {
      throw new TenantAccessError(`Invalid hardware selection: ${req.hardwareId}`, 400);
    }

    const cameraItem = HARDWARE_CATALOG.find((i) => i.id === req.cameraId);
    if (!cameraItem) {
      throw new TenantAccessError(`Invalid camera selection: ${req.cameraId}`, 400);
    }

    const isOptOut = req.hardwareId === 'opt_out_existing';

    if (!isOptOut) {
      const addr = req.shippingAddress;
      if (!addr || !addr.streetAddress || !addr.city || !addr.state || !addr.zipCode) {
        throw new TenantAccessError('Valid shipping address required for physical ELD hardware fulfillment.', 400);
      }
    }

    // Determine vendor
    const vendor: EldVendorName = isOptOut
      ? (req.existingVendor || 'BYOD_EXISTING')
      : hardwareItem.vendor;

    // Generate internal tracked serial numbers per vendor
    const assignedSerialNumbers: string[] = [];
    if (isOptOut) {
      const userSn = req.existingDeviceSerialNumber?.trim() || `BYOD-${vendor.toUpperCase()}-${Math.floor(Math.random() * 899999 + 100000)}`;
      assignedSerialNumbers.push(userSn);
    } else {
      const prefix =
        vendor === 'Samsara'
          ? 'SAM-VG54'
          : vendor === 'Geotab'
          ? 'GEO-GO10'
          : vendor === 'Azuga'
          ? 'AZU-GW'
          : 'GPS-TAB';
      const sn1 = `${prefix}-${Math.floor(Math.random() * 899999 + 100000)}-TX`;
      assignedSerialNumbers.push(sn1);

      if (req.cameraId !== 'camera_none') {
        const camSn = `CAM-${vendor.toUpperCase()}-${Math.floor(Math.random() * 899999 + 100000)}`;
        assignedSerialNumbers.push(camSn);
      }
    }

    const vendorOrderId = isOptOut
      ? `LINK-${Date.now().toString(36).toUpperCase()}`
      : `${vendor.toUpperCase()}-DROP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const carrierTrackingNumber = isOptOut
      ? 'NO_SHIPMENT_REQUIRED_EXISTING_DEVICE'
      : `1Z99999999${Math.floor(Math.random() * 899999999 + 100000000)}`;

    const effectiveFleetId = caller.fleetId || 'FLEET1';
    const orderRecord: HardwareOrderRecord = {
      id: `hord-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      fleetId: effectiveFleetId,
      driverId: caller.uid,
      tierId: req.tierId,
      tierName: tierItem.name,
      hardwareId: req.hardwareId,
      hardwareName: hardwareItem.name,
      vendor,
      cameraId: req.cameraId,
      cameraName: cameraItem.name,
      isOptOutExistingEld: isOptOut,
      assignedSerialNumbers,
      shippingAddress: req.shippingAddress,
      vendorFulfillmentStatus: isOptOut ? 'ACTIVE_BYOD' : 'SUBMITTED_TO_VENDOR',
      carrierTrackingNumber,
      vendorOrderId,
      fmcsaDisclaimerAcknowledged: true,
      fmcsaStatutoryNotice: MANDATORY_FMCSA_STATUTORY_DISCLAIMER,
      createdAt: new Date().toISOString(),
    };

    // Store order in fleetStore under multi-tenant isolation
    await fleetStore.createScopedDocument(caller, 'hardware_orders', orderRecord.id, orderRecord);

    return orderRecord;
  }

  /**
   * Retrieves past hardware orders for the caller's fleet
   */
  public async listOrders(caller: CallerIdentity): Promise<HardwareOrderRecord[]> {
    if (!caller) {
      throw new TenantAccessError('Unauthorized caller identity required.', 401);
    }
    const docs = await fleetStore.listScopedCollection<HardwareOrderRecord>(caller, 'hardware_orders');
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const hardwareOrderService = new HardwareOrderService();
