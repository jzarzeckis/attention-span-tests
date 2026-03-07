// In-memory store for test results. No serialization needed — data lives in JS memory.
const store: Record<string, unknown> = {};

export const resultsStore = {
  getItem(key: string): unknown {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  setItem(key: string, value: unknown): void {
    store[key] = value;
  },
  hasItem(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(store, key);
  },
  removeItem(key: string): void {
    delete store[key];
  },
  clearAll(): void {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  // Serialize all results to base64 JSON for sharing via URL
  encode(): string {
    return btoa(JSON.stringify(store));
  },
  // Load results decoded from a shared URL
  loadEncoded(encoded: string): boolean {
    try {
      const data = JSON.parse(atob(encoded)) as Record<string, unknown>;
      let loaded = false;
      for (const [key, value] of Object.entries(data)) {
        store[key] = value;
        if (key !== "selfReport") loaded = true;
      }
      return loaded;
    } catch {
      return false;
    }
  },
};
