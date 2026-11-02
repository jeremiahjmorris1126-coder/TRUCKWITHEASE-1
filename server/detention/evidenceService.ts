import { createHash } from 'node:crypto';
import {
  StopTracker,
  EvidencePacket,
  DetentionInvoice,
  CarrierIdentityInfo,
  VehicleIdentityInfo,
  DriverIdentityInfo,
  BillToParty,
} from './types';

/**
 * Deterministic JSON stringifier ensuring identical object hashing across systems.
 */
export function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

const iso = (ts: number | null | undefined): string | null => (ts ? new Date(ts).toISOString() : null);
const money = (n: number): string => `$${n.toFixed(2)}`;

export const STATUTORY_LEGAL_NOTICE =
  'Notice: Timestamps and GPS coordinates originate directly from vehicle ECM/telematics hardware. Tamper-evident cryptographic verification via SHA-256 digest. Payment terms governed by carrier rate confirmation. Legal or statutory applicability UNVERIFIED, attorney to confirm.';

export interface BuildEvidencePacketOptions {
  tracker: StopTracker;
  fleetId?: string | null;
  carrier?: CarrierIdentityInfo | null;
  vehicle?: VehicleIdentityInfo | null;
  driver?: DriverIdentityInfo | null;
  generatedTs?: number;
}

/**
 * Builds an immutable, tamper-evident evidence packet with SHA-256 checksum.
 */
export function buildEvidencePacket(opts: BuildEvidencePacketOptions): EvidencePacket {
  const generatedTs = opts.generatedTs ?? Date.now();
  const s = opts.tracker.summary(generatedTs);
  const snap = opts.tracker.snapshot();

  const body: Omit<EvidencePacket, 'integrity'> = {
    version: 1,
    generatedAt: new Date(generatedTs).toISOString(),
    fleetId: opts.fleetId ?? null,
    carrier: opts.carrier ?? null,
    vehicle: opts.vehicle ?? null,
    driver: opts.driver ?? null,
    stop: {
      stopId: s.stopId,
      loadId: s.loadId,
      kind: s.kind,
      fence: snap.stop.fence,
      facilityName: snap.stop.facilityName,
      address: snap.stop.address,
    },
    timeline: {
      appointment: iso(s.appointmentTs),
      arrival: iso(s.arrivalTs),
      firstDoorOpen: iso(s.firstDoorOpenTs),
      lastDoorClose: iso(s.lastDoorCloseTs),
      departure: iso(s.departureTs),
    },
    metrics: {
      dwellMinutes: s.dwellMinutes,
      freeMinutes: s.freeMinutes,
      detentionMinutes: s.detentionMinutes,
      ratePerHour: s.ratePerHour,
      amount: s.amount,
      waitBeforeDoorMinutes: s.waitBeforeDoorMinutes,
      dockWorkMinutes: s.dockWorkMinutes,
    },
    doorEvents: snap.doorEvents.map((d) => ({ at: iso(d.ts)!, state: d.state })),
    gpsTrail: snap.gpsTrail.map((g) => ({
      at: iso(g.ts)!,
      lat: g.lat,
      lng: g.lng,
      speedMph: g.speedMph ?? null,
    })),
    callLog: snap.calls.map((c) => ({
      at: iso(c.ts)!,
      direction: c.direction,
      durationSec: c.durationSec,
      number: c.number,
    })),
    legalNotice: STATUTORY_LEGAL_NOTICE,
  };

  const hash = createHash('sha256').update(stableStringify(body)).digest('hex');

  return {
    ...body,
    integrity: {
      algorithm: 'sha256',
      hash,
    },
  };
}

/**
 * Validates the SHA-256 integrity hash of an evidence packet.
 * If any byte has been tampered with or altered, verification fails immediately.
 */
export function verifyEvidencePacket(packet: EvidencePacket): boolean {
  if (!packet || !packet.integrity || packet.integrity.algorithm !== 'sha256' || !packet.integrity.hash) {
    return false;
  }
  const { integrity, ...body } = packet;
  const computedHash = createHash('sha256').update(stableStringify(body)).digest('hex');
  return computedHash.toLowerCase() === integrity.hash.toLowerCase();
}

export interface BuildDetentionInvoiceOptions {
  packet: EvidencePacket;
  invoiceNumber: string;
  billTo: BillToParty;
  carrier?: CarrierIdentityInfo | null;
  baseUrl?: string;
}

/**
 * Generates a clean, factual detention invoice referencing the SHA-256 evidence packet.
 *
 * NOTE: Strict compliance with anti-misrepresentation rules:
 * - NO "certified" wording.
 * - NO guarantees of payment.
 * - Factual line item breakdown backed by hardware-derived telematics events.
 */
export function buildDetentionInvoice(opts: BuildDetentionInvoiceOptions): DetentionInvoice {
  const { packet, invoiceNumber, billTo } = opts;
  const m = packet.metrics;
  const t = packet.timeline;
  const carrier = opts.carrier || packet.carrier;
  const hours = Math.round((m.detentionMinutes / 60) * 100) / 100;
  const baseUrl = opts.baseUrl || 'https://truckwithease.com';
  const verificationUrl = `${baseUrl}/verify?h=${packet.integrity.hash}`;

  const lineItem = {
    description: `Detention at ${packet.stop.kind.toUpperCase()} (${packet.stop.facilityName || 'Facility'}, Load ${packet.stop.loadId}, Stop ${packet.stop.stopId})`,
    detentionMinutes: m.detentionMinutes,
    freeMinutes: m.freeMinutes,
    hours,
    ratePerHour: m.ratePerHour,
    amount: m.amount,
  };

  const lines = [
    '================================================================================',
    `DETENTION INVOICE & TELEMATICS EVIDENCE SUMMARY — ${invoiceNumber}`,
    '================================================================================',
    `Date Generated:  ${packet.generatedAt}`,
    `Carrier:         ${carrier?.name || 'N/A'}${carrier?.usdotNumber ? ` (USDOT: ${carrier.usdotNumber})` : ''}`,
    `Bill To:         ${billTo.name}${billTo.email ? ` <${billTo.email}>` : ''}`,
    `Load Reference:  ${packet.stop.loadId} (Stop: ${packet.stop.stopId} - ${packet.stop.kind.toUpperCase()})`,
    ...(packet.vehicle?.unitNumber ? [`Power Unit:      ${packet.vehicle.unitNumber}`] : []),
    ...(packet.driver?.name ? [`Driver:          ${packet.driver.name}`] : []),
    '--------------------------------------------------------------------------------',
    'TELEMATICS CHRONOLOGY (ECM & AUX SENSORS)',
    '--------------------------------------------------------------------------------',
    `Agreed Appointment:   ${t.appointment ?? 'Unscheduled / Open Window'}`,
    `Confirmed Arrival:    ${t.arrival ?? 'Pending'}`,
    `First Door Open:      ${t.firstDoorOpen ?? 'N/A (No auxiliary sensor trip)'}`,
    `Last Door Close:      ${t.lastDoorClose ?? 'N/A (No auxiliary sensor trip)'}`,
    `Confirmed Departure:  ${t.departure ?? 'On-Site / Active'}`,
    '--------------------------------------------------------------------------------',
    'DWELL & RATE CONFIRMATION METRICS',
    '--------------------------------------------------------------------------------',
    `Total Facility Dwell: ${m.dwellMinutes} minutes`,
    `Agreed Free Time:     ${m.freeMinutes} minutes (per load rate confirmation)`,
    `Billable Detention:   ${m.detentionMinutes} minutes (${hours} hours) @ ${money(m.ratePerHour)}/hr`,
    ...(m.waitBeforeDoorMinutes != null
      ? [`Pre-Dock Delay:       ${m.waitBeforeDoorMinutes} minutes before dock work began`]
      : []),
    ...(m.dockWorkMinutes != null ? [`Dock Work Duration:   ${m.dockWorkMinutes} minutes`] : []),
    '--------------------------------------------------------------------------------',
    `TOTAL DETENTION AMOUNT DUE: ${money(m.amount)}`,
    '--------------------------------------------------------------------------------',
    'CRYPTOGRAPHIC EVIDENCE INTEGRITY',
    '--------------------------------------------------------------------------------',
    `SHA-256 Evidence Digest: ${packet.integrity.hash}`,
    `Durable Verification Link: ${verificationUrl}`,
    '',
    STATUTORY_LEGAL_NOTICE,
    '================================================================================',
  ];

  return {
    invoiceNumber,
    generatedAt: packet.generatedAt,
    loadId: packet.stop.loadId,
    stopId: packet.stop.stopId,
    fleetId: packet.fleetId ?? null,
    carrier: carrier ?? null,
    billTo,
    lineItem,
    amount: m.amount,
    evidenceHash: packet.integrity.hash,
    verificationUrl,
    summaryText: lines.join('\n'),
    status: 'ISSUED',
  };
}
