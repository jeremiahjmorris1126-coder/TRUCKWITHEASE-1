import type { BrokeredLoadMemory } from '../types.ts';
import { INITIAL_BROKERED_LOADS_MEMORY } from '../data/mockBrokeredLoadsMemory.ts';
import { safeStorage } from '../utils/safeStorage.ts';

const STORAGE_KEY = 'twe_brokered_loads_memory_v1';

class BrokeredLoadsMemoryService {
  private memories: BrokeredLoadMemory[];

  constructor() {
    this.memories = this.loadFromStorage();
  }

  private loadFromStorage(): BrokeredLoadMemory[] {
    const res = safeStorage.getItem<BrokeredLoadMemory[]>(STORAGE_KEY, INITIAL_BROKERED_LOADS_MEMORY);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
    return [...INITIAL_BROKERED_LOADS_MEMORY];
  }

  private saveToStorage(): void {
    safeStorage.setItem(STORAGE_KEY, this.memories);
  }

  public getAll(): BrokeredLoadMemory[] {
    return [...this.memories];
  }

  public getById(id: string): BrokeredLoadMemory | undefined {
    return this.memories.find((m) => m.id === id);
  }

  public recordNewCycle(
    memoryId: string,
    actualDwellMinutes: number,
    actualUnloadMinutes: number,
    actualTransitHours: number,
    rateAgreed?: number
  ): BrokeredLoadMemory | null {
    const idx = this.memories.findIndex((m) => m.id === memoryId);
    if (idx === -1) return null;

    const current = this.memories[idx];
    const prevVisits = current.shipperFacility.repeatedVisitsCount;
    const newVisits = prevVisits + 1;

    // Rolling weighted average calculation
    const newAvgDwell = Math.round(
      (current.shipperFacility.avgDwellMinutes * prevVisits + actualDwellMinutes) / newVisits
    );
    const newAvgUnload = Math.round(
      (current.receiverFacility.avgUnloadMinutes * prevVisits + actualUnloadMinutes) / newVisits
    );
    const newAvgTransit = +(
      (current.lane.avgHistoricalTransitHours * prevVisits + actualTransitHours) /
      newVisits
    ).toFixed(2);

    const updated: BrokeredLoadMemory = {
      ...current,
      shipperFacility: {
        ...current.shipperFacility,
        avgDwellMinutes: newAvgDwell,
        historicalLoadTimesCount: newVisits,
        repeatedVisitsCount: newVisits,
      },
      receiverFacility: {
        ...current.receiverFacility,
        avgUnloadMinutes: newAvgUnload,
        historicalUnloadTimesCount: newVisits,
        repeatedVisitsCount: newVisits,
      },
      lane: {
        ...current.lane,
        avgHistoricalTransitHours: newAvgTransit,
        repeatCyclesCount: newVisits,
      },
      financialMemory: {
        ...current.financialMemory,
        lastContractedRate: rateAgreed || current.financialMemory.lastContractedRate,
      },
      lastDispatchedDate: new Date().toISOString().substring(0, 10),
    };

    this.memories[idx] = updated;
    this.saveToStorage();
    return updated;
  }

  public addMemoryEntry(entry: Omit<BrokeredLoadMemory, 'id'>): BrokeredLoadMemory {
    const newEntry: BrokeredLoadMemory = {
      ...entry,
      id: `mem-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    };
    this.memories.unshift(newEntry);
    this.saveToStorage();
    return newEntry;
  }

  public resetToBaseline(): BrokeredLoadMemory[] {
    this.memories = [...INITIAL_BROKERED_LOADS_MEMORY];
    this.saveToStorage();
    return this.memories;
  }
}

export const brokeredLoadsMemoryService = new BrokeredLoadsMemoryService();
