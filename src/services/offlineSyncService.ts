import { apiClient, ApiClientError } from './apiClient';

export type QueuedSyncType =
  | 'DUTY_STATUS'
  | 'DVIR'
  | 'DOCUMENT'
  | 'DETENTION_EVENT'
  | 'FUEL_LOG'
  | 'EXPENSE';

export interface QueuedSyncItem {
  id: string;
  type: QueuedSyncType;
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  items: QueuedSyncItem[];
}

const STORAGE_KEY = 'truckwithease_offline_sync_queue_v1';
const LAST_SYNC_KEY = 'truckwithease_last_synced_at_v1';

class OfflineSyncService {
  private queue: QueuedSyncItem[] = [];
  private listeners: Set<(state: SyncState) => void> = new Set();
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncedAt: number | null = null;
  private timerHandle: any = null;

  constructor() {
    this.loadQueue();
    this.setupListeners();
    this.startHeartbeat();
  }

  private loadQueue() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.queue = JSON.parse(stored);
        }
        const lastSync = localStorage.getItem(LAST_SYNC_KEY);
        if (lastSync) {
          this.lastSyncedAt = Number(lastSync);
        }
      }
    } catch (e) {
      console.warn('[OfflineSyncService] Failed to load queue from storage:', e);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch (e) {
      console.warn('[OfflineSyncService] Failed to save queue to storage:', e);
    }
    this.notify();
  }

  private setupListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });
    }
  }

  private startHeartbeat() {
    if (typeof window !== 'undefined') {
      this.timerHandle = setInterval(() => {
        if (this.isOnline && this.queue.length > 0 && !this.isSyncing) {
          this.processQueue();
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  public getState(): SyncState {
    return {
      isOnline: this.isOnline,
      pendingCount: this.queue.length,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      items: [...this.queue],
    };
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Enqueues an item for guaranteed delivery.
   * Immediately attempts to send if online; otherwise preserves in local storage.
   */
  public async enqueue(type: QueuedSyncType, payload: any): Promise<QueuedSyncItem> {
    const item: QueuedSyncItem = {
      id: `sync-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };

    this.queue.push(item);
    this.saveQueue();

    if (this.isOnline && !this.isSyncing) {
      // Trigger background sync without blocking caller
      this.processQueue().catch(() => {});
    }

    return item;
  }

  /**
   * Processes the queued items in FIFO order.
   */
  public async processQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
    if (this.isSyncing) {
      return { syncedCount: 0, remainingCount: this.queue.length };
    }

    if (!this.isOnline || this.queue.length === 0) {
      return { syncedCount: 0, remainingCount: this.queue.length };
    }

    this.isSyncing = true;
    this.notify();

    let syncedCount = 0;

    try {
      while (this.queue.length > 0 && this.isOnline) {
        const item = this.queue[0];
        item.attempts += 1;
        item.lastAttemptAt = Date.now();

        try {
          await this.dispatchItem(item);
          // Successfully synced -> remove from queue
          this.queue.shift();
          this.saveQueue();
          syncedCount++;
        } catch (err: any) {
          const isNetworkError =
            err?.code === 'NETWORK_ERROR' ||
            err?.status === 0 ||
            !this.isOnline ||
            err?.message?.includes('Network connection unavailable') ||
            err?.message?.includes('Failed to fetch');

          if (isNetworkError) {
            this.isOnline = false;
            item.lastError = 'Network connection unavailable';
            this.saveQueue();
            break; // Stop queue processing until online event
          }

          // Non-network error (e.g. 400 validation error or duplicate)
          item.lastError = err?.message || 'Server rejection';
          if (item.attempts >= 3) {
            console.warn(`[OfflineSyncService] Item ${item.id} (${item.type}) failed after 3 attempts. Dropping.`, item.lastError);
            this.queue.shift();
          }
          this.saveQueue();
          break;
        }
      }

      this.lastSyncedAt = Date.now();
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LAST_SYNC_KEY, String(this.lastSyncedAt));
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return { syncedCount, remainingCount: this.queue.length };
  }

  private async dispatchItem(item: QueuedSyncItem): Promise<any> {
    switch (item.type) {
      case 'DUTY_STATUS':
        return await apiClient.post('/api/driver/duty-status', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      case 'DVIR':
        return await apiClient.post('/api/dvir', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      case 'DOCUMENT':
        return await apiClient.post('/api/driver/documents', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      case 'DETENTION_EVENT':
        return await apiClient.post('/api/detention/events', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      case 'FUEL_LOG':
        return await apiClient.post('/api/fuel-logs', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      case 'EXPENSE':
        return await apiClient.post('/api/expenses', item.payload, {
          skipUnauthorizedRedirect: true,
        });

      default:
        throw new Error(`Unknown sync item type: ${(item as any).type}`);
    }
  }

  public clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  public setOnlineForTesting(online: boolean): void {
    this.isOnline = online;
    this.notify();
  }
}

export const offlineSyncService = new OfflineSyncService();
