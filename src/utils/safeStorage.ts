/**
 * TruckWithEase // Resilient Storage Subsystem
 *
 * Replaces ad-hoc try/catch and silent storage failures with:
 * 1. Safe quota exceeded and permission error detection.
 * 2. Automatic fallback to an in-memory cache when localStorage is unavailable.
 * 3. Structured diagnostic logging.
 * 4. Explicit Result type { success, data, error } returned to callers.
 */

import { StoragePersistenceError, toAppError } from './errors.ts';
import { logger } from './logger.ts';

export interface StorageResult<T> {
  success: boolean;
  data: T | null;
  isFallback: boolean;
  error?: StoragePersistenceError;
}

class ResilientStorage {
  private memoryCache = new Map<string, string>();
  private isStorageAvailable: boolean | null = null;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability(): boolean {
    if (this.isStorageAvailable !== null) return this.isStorageAvailable;
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.isStorageAvailable = false;
        return false;
      }
      const testKey = '__twe_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      this.isStorageAvailable = true;
      return true;
    } catch (e) {
      this.isStorageAvailable = false;
      logger.warn(
        'STORAGE',
        'Local storage unavailable (incognito or quota restricted). Activating in-memory fallback cache.',
        undefined,
        e
      );
      return false;
    }
  }

  /**
   * Safe item retrieval
   */
  public getItem<T>(key: string, defaultValue: T): StorageResult<T> {
    if (!this.checkAvailability()) {
      const inMem = this.memoryCache.get(key);
      if (inMem !== undefined) {
        try {
          return { success: true, data: JSON.parse(inMem) as T, isFallback: true };
        } catch {
          return { success: true, data: inMem as unknown as T, isFallback: true };
        }
      }
      return { success: true, data: defaultValue, isFallback: true };
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return { success: true, data: defaultValue, isFallback: false };
      }
      return { success: true, data: JSON.parse(item) as T, isFallback: false };
    } catch (e) {
      const storageError = new StoragePersistenceError(key, 'READ', e);
      logger.warn('STORAGE', `Failed to read key "${key}" from localStorage`, { key }, storageError);
      return {
        success: false,
        data: defaultValue,
        isFallback: true,
        error: storageError,
      };
    }
  }

  /**
   * Safe item persistence
   */
  public setItem<T>(key: string, value: T): StorageResult<T> {
    const serialized = JSON.stringify(value);

    // Keep memory cache updated at all times
    this.memoryCache.set(key, serialized);

    if (!this.checkAvailability()) {
      return { success: true, data: value, isFallback: true };
    }

    try {
      window.localStorage.setItem(key, serialized);
      return { success: true, data: value, isFallback: false };
    } catch (e) {
      const storageError = new StoragePersistenceError(key, 'WRITE', e);
      logger.error('STORAGE', `Failed to persist key "${key}". Telemetry active in memory cache.`, storageError, { key });
      return {
        success: false,
        data: value,
        isFallback: true,
        error: storageError,
      };
    }
  }

  /**
   * Safe item removal
   */
  public removeItem(key: string): void {
    this.memoryCache.delete(key);
    if (this.checkAvailability()) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        logger.warn('STORAGE', `Failed removing key "${key}"`, { key }, e);
      }
    }
  }
}

export const safeStorage = new ResilientStorage();
