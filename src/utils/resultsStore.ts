import type { StoreData } from "@/types";

// In-memory store for test results. No serialization needed — data lives in JS memory.
const store: Partial<StoreData> = {};

export const resultsStore = {
  getItem<K extends keyof StoreData>(key: K): StoreData[K] | null {
    return (key in store ? store[key] : null) as StoreData[K] | null;
  },
  setItem<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    store[key] = value;
  },
  hasItem(key: keyof StoreData): boolean {
    return key in store;
  },
  removeItem(key: keyof StoreData): void {
    delete store[key];
  },
  clearAll(): void {
    (Object.keys(store) as (keyof StoreData)[]).forEach((k) => delete store[k]);
  },
  // Serialize all results to base64 JSON for sharing via URL
  encode(): string {
    return btoa(JSON.stringify(store));
  },
  // Load results decoded from a shared URL
  loadEncoded(encoded: string): boolean {
    try {
      const data = JSON.parse(atob(encoded)) as Partial<StoreData>;
      let loaded = false;
      for (const k of Object.keys(data) as (keyof StoreData)[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store[k] = data[k] as any;
        if (k !== "selfReport") loaded = true;
      }
      return loaded;
    } catch {
      return false;
    }
  },
};
