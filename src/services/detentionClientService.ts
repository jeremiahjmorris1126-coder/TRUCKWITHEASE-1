import { apiClient } from './apiClient';
import { offlineSyncService } from './offlineSyncService';

export interface DetentionStatusSummary {
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

export interface DetentionFinalizeResult {
  packet: any;
  invoice: any | null;
}

class DetentionClientService {
  async startStop(payload: {
    vehicleId: string;
    stopId: string;
    loadId: string;
    kind?: 'pickup' | 'delivery';
    ratePerHour?: number;
    freeMinutes?: number;
    fence?: { center: { lat: number; lng: number }; radiusM: number };
    appointmentTs?: number;
    facilityName?: string;
    address?: string;
  }): Promise<boolean> {
    const res = await apiClient.post('/api/detention/stops', payload);
    return Boolean(res?.success);
  }

  async sendPhoneGpsEvent(
    vehicleId: string,
    coords: { lat: number; lng: number; speedMph?: number }
  ): Promise<boolean> {
    const events = [
      {
        type: 'gps',
        ts: Date.now(),
        lat: coords.lat,
        lng: coords.lng,
        speedMph: coords.speedMph ?? 0,
        source: 'phone_gps',
      },
    ];
    try {
      const res = await apiClient.post('/api/detention/events', { vehicleId, events }, {
        skipUnauthorizedRedirect: true,
      });
      return Boolean(res?.success);
    } catch (err: any) {
      await offlineSyncService.enqueue('DETENTION_EVENT', { vehicleId, events });
      return true;
    }
  }

  async getStatus(vehicleId: string): Promise<DetentionStatusSummary | null> {
    try {
      const res = await apiClient.get<{ success: boolean; summary: DetentionStatusSummary }>(
        `/api/detention/stops/${encodeURIComponent(vehicleId)}`,
        { skipUnauthorizedRedirect: true }
      );
      return res?.summary || null;
    } catch (err) {
      return null;
    }
  }

  async finalizeStop(
    vehicleId: string,
    opts?: { invoiceNumber?: string; billTo?: { name: string; email?: string } }
  ): Promise<DetentionFinalizeResult> {
    return await apiClient.post<DetentionFinalizeResult>(
      `/api/detention/stops/${encodeURIComponent(vehicleId)}/finalize`,
      opts || {}
    );
  }

  async generateOneTap(loadId: string, vehicleId?: string): Promise<DetentionFinalizeResult> {
    return await apiClient.post<DetentionFinalizeResult>(
      '/api/detention/one-tap',
      { loadId, vehicleId }
    );
  }
}

export const detentionClientService = new DetentionClientService();
