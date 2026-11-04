/**
 * Detention & Tamper-Evident Evidence Chain Types
 * Hardware-agnostic telematics events & evidence packets.
 */

export interface Geofence {
  center: {
    lat: number;
    lng: number;
  };
  radiusM: number;
}

export interface DetentionStop {
  stopId: string;
  loadId: string;
  kind: 'pickup' | 'delivery';
  fence: Geofence;
  appointmentTs?: number | null; // Epoch ms
  ratePerHour: number; // Strictly extracted from load rate confirmation terms ($/hr)
  freeMinutes: number; // Strictly extracted from load rate confirmation terms (mins)
  facilityName?: string;
  address?: string;
}

export interface GpsEvent {
  type: 'gps';
  ts: number; // Epoch ms strictly from telematics/ECM device clock
  lat: number;
  lng: number;
  speedMph?: number | null;
  source?: 'ecm' | 'eld' | 'phone_gps';
}

export interface DoorEvent {
  type: 'door';
  ts: number; // Epoch ms strictly from telematics/sensor device clock
  state: 'open' | 'closed';
}

export interface TelephonyCallEvent {
  type: 'call';
  ts: number; // Epoch ms
  durationSec: number;
  direction: 'inbound' | 'outbound';
  number: string;
}

export type TelematicsEvent = GpsEvent | DoorEvent | TelephonyCallEvent;

export interface CarrierIdentityInfo {
  name: string;
  usdotNumber?: string;
  mcNumber?: string;
  billingEmail?: string;
  phone?: string;
}

export interface VehicleIdentityInfo {
  id: string;
  vin?: string;
  makeModel?: string;
  unitNumber?: string;
}

export interface DriverIdentityInfo {
  id: string;
  name: string;
  phone?: string;
}

export interface BillToParty {
  name: string;
  email?: string;
  billingReference?: string;
  address?: string;
}

export interface StopTrackerSummary {
  stopId: string;
  loadId: string;
  kind: 'pickup' | 'delivery';
  status: 'enroute' | 'on_site' | 'departed';
  arrivalTs: number | null;
  departureTs: number | null;
  appointmentTs: number | null;
  clockStartTs: number | null;
  freeMinutes: number;
  ratePerHour: number;
  dwellMinutes: number;
  detentionMinutes: number;
  amount: number;
  firstDoorOpenTs: number | null;
  lastDoorCloseTs: number | null;
  waitBeforeDoorMinutes: number | null;
  dockWorkMinutes: number | null;
}

export interface EvidencePacket {
  version: 1;
  generatedAt: string; // ISO string
  fleetId?: string | null;
  carrier: CarrierIdentityInfo | null;
  vehicle: VehicleIdentityInfo | null;
  driver: DriverIdentityInfo | null;
  stop: {
    stopId: string;
    loadId: string;
    kind: 'pickup' | 'delivery';
    fence: Geofence;
    facilityName?: string;
    address?: string;
  };
  timeline: {
    appointment: string | null;
    arrival: string | null;
    firstDoorOpen: string | null;
    lastDoorClose: string | null;
    departure: string | null;
  };
  metrics: {
    dwellMinutes: number;
    freeMinutes: number;
    detentionMinutes: number;
    ratePerHour: number;
    amount: number;
    waitBeforeDoorMinutes: number | null;
    dockWorkMinutes: number | null;
  };
  doorEvents: Array<{ at: string; state: 'open' | 'closed' }>;
  gpsTrail: Array<{ at: string; lat: number; lng: number; speedMph: number | null; source?: string }>;
  callLog: Array<{ at: string; direction: string; durationSec: number; number: string }>;
  legalNotice: string;
  integrity: {
    algorithm: 'sha256';
    hash: string;
  };
}

export interface DetentionInvoiceLineItem {
  description: string;
  detentionMinutes: number;
  freeMinutes: number;
  hours: number;
  ratePerHour: number;
  amount: number;
}

export interface DetentionInvoice {
  invoiceNumber: string;
  generatedAt: string;
  loadId: string;
  stopId: string;
  fleetId?: string | null;
  carrier: CarrierIdentityInfo | null;
  billTo: BillToParty;
  lineItem: DetentionInvoiceLineItem;
  amount: number;
  evidenceHash: string;
  verificationUrl: string;
  summaryText: string;
  status: 'ISSUED' | 'PAID' | 'DISPUTED';
}
