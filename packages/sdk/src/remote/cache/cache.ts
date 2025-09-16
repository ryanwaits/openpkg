export interface RemoteCacheEntry<T = unknown> {
  value: T;
  timestamp: number;
}

export interface RemoteCache {
  get<T = unknown>(key: string): RemoteCacheEntry<T> | undefined;
  set<T = unknown>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

export class InMemoryRemoteCache implements RemoteCache {
  private readonly store = new Map<string, RemoteCacheEntry>();
  private readonly ttlMs?: number;

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): RemoteCacheEntry<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (this.ttlMs !== undefined && Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }

    return entry as RemoteCacheEntry<T>;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
