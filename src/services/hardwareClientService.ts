import { apiClient } from './apiClient';
import {
  HardwareCatalogItem,
  HardwareOrderRequest,
  HardwareOrderRecord,
} from '../../server/hardware/hardwareOrderService';

export type { HardwareCatalogItem, HardwareOrderRequest, HardwareOrderRecord };

export class HardwareClientService {
  async getCatalog(): Promise<HardwareCatalogItem[]> {
    try {
      const res = await apiClient.get<{ success: boolean; catalog: HardwareCatalogItem[] }>('/api/hardware/catalog');
      return res.catalog || [];
    } catch (err) {
      console.warn('[HardwareClientService] getCatalog error:', (err as Error).message);
      return [];
    }
  }

  async submitOrder(orderReq: HardwareOrderRequest): Promise<HardwareOrderRecord> {
    try {
      const res = await apiClient.post<{ success: boolean; order: HardwareOrderRecord }>(
        '/api/hardware/orders',
        orderReq
      );
      return res.order;
    } catch (err) {
      console.warn('[HardwareClientService] submitOrder error:', (err as Error).message);
      throw err;
    }
  }

  async listOrders(): Promise<HardwareOrderRecord[]> {
    try {
      const res = await apiClient.get<{ success: boolean; orders: HardwareOrderRecord[] }>('/api/hardware/orders');
      return res.orders || [];
    } catch (err) {
      console.warn('[HardwareClientService] listOrders error:', (err as Error).message);
      return [];
    }
  }
}

export const hardwareClientService = new HardwareClientService();
