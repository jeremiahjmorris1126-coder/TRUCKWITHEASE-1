import { CallerIdentity, fleetStore } from '../data/fleetStore';
import { DetentionStop, TelematicsEvent, StopTrackerSummary, EvidencePacket, DetentionInvoice, BillToParty } from './types';
import { createStopTracker, StopTracker } from './detentionEngine';
import { buildEvidencePacket, verifyEvidencePacket, buildDetentionInvoice } from './evidenceService';
import { detentionStore } from './detentionStore';
import { FreightLoad } from '../loadMatching/loadService';

export class DetentionService {
  private activeTrackers = new Map<string, { tracker: StopTracker; ctx: any; fleetId?: string | null }>();

  private async ensureTracker(vehicleId: string): Promise<boolean> {
    if (this.activeTrackers.has(vehicleId)) return true;

    const active = await detentionStore.getActiveStop(vehicleId);
    if (!active) return false;

    const tracker = createStopTracker(active.stop);
    const pastEvents = (await detentionStore.getEvents(vehicleId)).sort((a, b) => a.ts - b.ts);
    for (const ev of pastEvents) {
      tracker.onEvent(ev);
    }

    this.activeTrackers.set(vehicleId, { tracker, ctx: active.ctx, fleetId: active.fleetId });
    return true;
  }

  /**
   * Start tracking a stop for a vehicle.
   * Dynamically inherits rate confirmation terms from the load if not explicitly supplied.
   */
  async startStop(
    caller: CallerIdentity,
    vehicleId: string,
    rawStop: Partial<DetentionStop> & { stopId: string; loadId: string; kind: 'pickup' | 'delivery' },
    ctx: any = {}
  ): Promise<void> {
    let ratePerHour = rawStop.ratePerHour;
    let freeMinutes = rawStop.freeMinutes;
    let resolvedFence = rawStop.fence;
    let resolvedAppointmentTs = rawStop.appointmentTs;

    // Dynamically resolve terms or facility coordinates from the load if not explicitly supplied
    if (ratePerHour === undefined || freeMinutes === undefined || !resolvedFence || resolvedAppointmentTs === undefined) {
      const load = await fleetStore.getScopedDocument<FreightLoad>(caller, 'loads', rawStop.loadId);
      if (load) {
        if (ratePerHour === undefined && (load as any).detentionRatePerHour !== undefined) {
          ratePerHour = (load as any).detentionRatePerHour;
        }
        if (freeMinutes === undefined && (load as any).freeMinutes !== undefined) {
          freeMinutes = (load as any).freeMinutes;
        }
        if (!resolvedFence) {
          if ((load as any).deliveryFence?.center && typeof (load as any).deliveryFence.center.lat === 'number') {
            resolvedFence = (load as any).deliveryFence;
          } else if ((load as any).deliveryCoordinates && typeof (load as any).deliveryCoordinates.lat === 'number') {
            resolvedFence = {
              center: (load as any).deliveryCoordinates,
              radiusM: 300,
            };
          }
        }
        if (resolvedAppointmentTs === undefined && (load as any).appointmentTs !== undefined) {
          resolvedAppointmentTs = (load as any).appointmentTs;
        }
      }
    }

    if (ratePerHour === undefined || ratePerHour === null || ratePerHour <= 0) {
      const err = new Error(
        'Detention rate per hour must be explicitly provided from the load rate confirmation terms. Arbitrary default rates are strictly prohibited.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    if (freeMinutes === undefined || freeMinutes === null || freeMinutes < 0) {
      const err = new Error(
        'Free time minutes must be explicitly provided from the load rate confirmation terms. Fallback default free time is strictly prohibited.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      !resolvedFence ||
      !resolvedFence.center ||
      typeof resolvedFence.center.lat !== 'number' ||
      typeof resolvedFence.center.lng !== 'number' ||
      isNaN(resolvedFence.center.lat) ||
      isNaN(resolvedFence.center.lng)
    ) {
      const err = new Error(
        'Facility location coordinates (fence) are required. Default geofence coordinates are strictly prohibited.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const stop: DetentionStop = {
      stopId: rawStop.stopId,
      loadId: rawStop.loadId,
      kind: rawStop.kind,
      fence: resolvedFence,
      appointmentTs: resolvedAppointmentTs ?? null,
      ratePerHour,
      freeMinutes,
      facilityName: rawStop.facilityName,
      address: rawStop.address,
    };

    const tracker = createStopTracker(stop);
    this.activeTrackers.set(vehicleId, { tracker, ctx, fleetId: caller.fleetId });
    await detentionStore.saveActiveStop(vehicleId, { stop, ctx, fleetId: caller.fleetId });
  }

  /**
   * Ingest telematics or phone GPS events from recorded feeds.
   */
  async ingestEvents(
    vehicleId: string,
    events: TelematicsEvent[],
    meta?: { loadId?: string; stopId?: string }
  ): Promise<boolean> {
    const receivedAt = new Date().toISOString();
    const stampedEvents: TelematicsEvent[] = events.map((ev) => ({
      ...ev,
      source: (ev as any).source || 'telematics_provider',
      receivedAt: (ev as any).receivedAt || receivedAt,
    }));

    const hasTracker = await this.ensureTracker(vehicleId);
    if (hasTracker) {
      const entry = this.activeTrackers.get(vehicleId)!;
      for (const ev of stampedEvents) {
        entry.tracker.onEvent(ev);
      }
    }

    await detentionStore.appendEvents(vehicleId, stampedEvents, meta);
    return true;
  }

  /**
   * Get real-time status of active stop tracker.
   */
  async getStatus(vehicleId: string): Promise<StopTrackerSummary | null> {
    if (!(await this.ensureTracker(vehicleId))) return null;
    return this.activeTrackers.get(vehicleId)!.tracker.summary();
  }

  /**
   * Finalize a stop: package cryptographic evidence packet and generate detention invoice.
   */
  async finalize(
    caller: CallerIdentity,
    vehicleId: string,
    opts: { invoiceNumber?: string; billTo?: BillToParty; generatedTs?: number } = {}
  ): Promise<{ packet: EvidencePacket; invoice: DetentionInvoice | null }> {
    if (!(await this.ensureTracker(vehicleId))) {
      const err = new Error(`No active stop tracker found for vehicle ${vehicleId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    const entry = this.activeTrackers.get(vehicleId)!;

    // Cross-tenant protection
    if (caller.role !== 'owner' && entry.fleetId && caller.fleetId && entry.fleetId !== caller.fleetId) {
      const err = new Error('Not authorized to finalize stop for another fleet.');
      (err as any).statusCode = 404;
      throw err;
    }

    const packet = buildEvidencePacket({
      tracker: entry.tracker,
      fleetId: entry.fleetId || caller.fleetId,
      carrier: entry.ctx?.carrier,
      vehicle: entry.ctx?.vehicle,
      driver: entry.ctx?.driver,
      generatedTs: opts.generatedTs,
    });

    await detentionStore.savePacket(packet);

    let invoice: DetentionInvoice | null = null;
    if (packet.metrics.detentionMinutes > 0) {
      const invNum = opts.invoiceNumber || `INV-DET-${Date.now().toString().slice(-6)}`;
      const billTo: BillToParty = opts.billTo || {
        name: entry.ctx?.brokerName || 'Broker / Logistics Shipper',
        email: entry.ctx?.brokerEmail,
      };

      invoice = buildDetentionInvoice({
        packet,
        invoiceNumber: invNum,
        billTo,
        carrier: entry.ctx?.carrier,
      });

      await detentionStore.saveInvoice(invoice);
    }

    this.activeTrackers.delete(vehicleId);
    await detentionStore.deleteActive(vehicleId);

    return { packet, invoice };
  }

  /**
   * One-Tap Detention Invoice generator from an existing freight load.
   * Builds an invoice ONLY from events actually recorded for that load and stop.
   * Never invents or defaults dwell time, GPS pings, door events, facility coordinates, or appointment time.
   */
  async generateOneTapFromLoad(
    caller: CallerIdentity,
    loadId: string,
    opts: {
      vehicleId?: string;
      stopId?: string;
      billTo?: BillToParty;
      carrier?: { name: string; usdotNumber?: string; mcNumber?: string } | null;
      generatedTs?: number;
    } = {}
  ): Promise<{ packet: EvidencePacket; invoice: DetentionInvoice | null }> {
    // Reject any attempt to supply or override dwell time from client options
    if (opts && typeof opts === 'object') {
      for (const key of Object.keys(opts)) {
        if (key.toLowerCase().includes('dwell')) {
          const err = new Error('Client is not permitted to supply or override detention dwell time.');
          (err as any).statusCode = 400;
          throw err;
        }
      }
    }

    const load = await fleetStore.getScopedDocument<FreightLoad>(caller, 'loads', loadId);
    if (!load) {
      const err = new Error('Freight load not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const ratePerHour = (load as any).detentionRatePerHour;
    const freeMinutes = (load as any).freeMinutes;

    if (ratePerHour === undefined || ratePerHour === null || ratePerHour <= 0) {
      const err = new Error(
        `Load ${load.loadNumber} is missing detention rate per hour in its rate confirmation. Arbitrary default rates are strictly prohibited.`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    if (freeMinutes === undefined || freeMinutes === null || freeMinutes < 0) {
      const err = new Error(
        `Load ${load.loadNumber} is missing free time minutes in its rate confirmation. Fallback default free time is strictly prohibited.`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const rawFence = (load as any).deliveryFence;
    const rawCoords = (load as any).deliveryCoordinates;
    const facilityFence =
      rawFence &&
      rawFence.center &&
      typeof rawFence.center.lat === 'number' &&
      typeof rawFence.center.lng === 'number' &&
      !isNaN(rawFence.center.lat) &&
      !isNaN(rawFence.center.lng)
        ? rawFence
        : rawCoords &&
          typeof rawCoords.lat === 'number' &&
          typeof rawCoords.lng === 'number' &&
          !isNaN(rawCoords.lat) &&
          !isNaN(rawCoords.lng)
        ? { center: { lat: rawCoords.lat, lng: rawCoords.lng }, radiusM: 300 }
        : null;

    if (!facilityFence) {
      const err = new Error(
        `Load ${load.loadNumber} is missing facility location coordinates — detention invoice cannot be created.`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const appointmentTs = (load as any).appointmentTs;
    if (appointmentTs === undefined || appointmentTs === null || typeof appointmentTs !== 'number' || isNaN(appointmentTs)) {
      const err = new Error(
        `Load ${load.loadNumber} is missing appointment time — detention invoice cannot be created.`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const stopId = opts.stopId || `stop-${load.id}-delivery`;

    const stop: DetentionStop = {
      stopId,
      loadId: load.id,
      kind: 'delivery',
      fence: facilityFence,
      appointmentTs,
      ratePerHour,
      freeMinutes,
      facilityName: (load as any).deliveryFacilityName || load.destination,
      address: (load as any).deliveryAddress || load.destination,
    };

    const tracker = createStopTracker(stop);

    const effectiveVehicleId = opts.vehicleId || load.assignedUnitId;
    const recordedEvents = await detentionStore.getEventsForLoadAndStop(load.id, stopId, effectiveVehicleId);

    for (const ev of recordedEvents) {
      tracker.onEvent(ev);
    }

    const now = opts.generatedTs ?? Date.now();
    const summary = tracker.summary(now);

    if (summary.arrivalTs === null || summary.departureTs === null || summary.status !== 'departed') {
      const err = new Error(
        'No recorded arrival and departure at this facility — detention invoice cannot be created.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const packet = buildEvidencePacket({
      tracker,
      fleetId: load.fleetId || caller.fleetId,
      carrier: opts.carrier ?? null,
      vehicle: effectiveVehicleId
        ? {
            id: effectiveVehicleId,
            unitNumber: effectiveVehicleId,
          }
        : null,
      driver: {
        id: load.assignedDriverId || caller.uid,
        name: caller.email ? caller.email.split('@')[0] : caller.uid,
      },
      generatedTs: now,
    });

    await detentionStore.savePacket(packet);

    let invoice: DetentionInvoice | null = null;
    if (packet.metrics.detentionMinutes > 0) {
      const invNum = `INV-DET-${load.loadNumber}-${Date.now().toString().slice(-4)}`;
      const billTo: BillToParty = opts.billTo || {
        name: load.shipperBroker,
        email: (load as any).shipperBrokerEmail,
      };

      invoice = buildDetentionInvoice({
        packet,
        invoiceNumber: invNum,
        billTo,
        carrier: packet.carrier,
      });

      await detentionStore.saveInvoice(invoice);
    }

    return { packet, invoice };
  }

  /**
   * Lookup packet by hash. Enforces fleet isolation for authenticated users.
   */
  async getPacketByHash(hash: string, caller?: CallerIdentity): Promise<EvidencePacket | null> {
    const packet = await detentionStore.getPacketByHash(hash);
    if (!packet) return null;

    if (caller && caller.role !== 'owner') {
      if (packet.fleetId && caller.fleetId && packet.fleetId !== caller.fleetId) {
        return null; // Cross-tenant privacy
      }
    }

    return packet;
  }

  /**
   * Cryptographic verification of packet integrity or hash lookup.
   * Public-safe with zero data leakage.
   */
  async verifyPacketOrHash(input: {
    hash?: string;
    packet?: EvidencePacket;
  }): Promise<{
    valid: boolean;
    hash: string;
    matchFound: boolean;
    summary?: any;
    tamperDetected?: boolean;
  }> {
    if (input.packet) {
      const valid = verifyEvidencePacket(input.packet);
      const hash = input.packet.integrity?.hash || '';
      const stored = await detentionStore.getPacketByHash(hash);

      return {
        valid,
        hash,
        matchFound: stored !== null,
        tamperDetected: !valid,
        summary: valid
          ? {
              version: input.packet.version,
              generatedAt: input.packet.generatedAt,
              stopKind: input.packet.stop.kind,
              loadId: input.packet.stop.loadId,
              dwellMinutes: input.packet.metrics.dwellMinutes,
              detentionMinutes: input.packet.metrics.detentionMinutes,
              amount: input.packet.metrics.amount,
              arrival: input.packet.timeline.arrival,
              departure: input.packet.timeline.departure,
            }
          : undefined,
      };
    }

    if (input.hash) {
      const cleanHash = input.hash.toLowerCase().trim();
      const packet = await detentionStore.getPacketByHash(cleanHash);
      if (!packet) {
        return {
          valid: false,
          hash: cleanHash,
          matchFound: false,
        };
      }

      const valid = verifyEvidencePacket(packet);
      return {
        valid,
        hash: cleanHash,
        matchFound: true,
        summary: {
          version: packet.version,
          generatedAt: packet.generatedAt,
          stopKind: packet.stop.kind,
          loadId: packet.stop.loadId,
          dwellMinutes: packet.metrics.dwellMinutes,
          detentionMinutes: packet.metrics.detentionMinutes,
          amount: packet.metrics.amount,
          arrival: packet.timeline.arrival,
          departure: packet.timeline.departure,
        },
      };
    }

    return { valid: false, hash: '', matchFound: false };
  }
}

export const detentionService = new DetentionService();
