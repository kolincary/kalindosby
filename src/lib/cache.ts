interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class SmartCache {
  private cache: Map<string, CacheEntry<any>>;
  private dbName = 'gudang_cache_db';
  private storeName = 'cache_store';
  private db: IDBDatabase | null = null;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private invalidationQueue: Set<string> = new Set();
  private processQueueTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cache = new Map();
    this.initIndexedDB();
    this.startQueueProcessor();
  }

  private async initIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, using in-memory cache only');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('IndexedDB initialization failed');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✓ IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async set<T>(key: string, data: T, expiresInMs: number = 300000): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMs,
    };

    this.cache.set(key, entry);

    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.put({ key, ...entry });
      } catch (error) {
        console.error('Failed to write to IndexedDB:', error);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const memoryEntry = this.cache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.stats.hits++;
      return memoryEntry.data as T;
    }

    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        return new Promise((resolve) => {
          request.onsuccess = () => {
            const result = request.result;
            if (result && !this.isExpired(result)) {
              this.cache.set(key, result);
              this.stats.hits++;
              resolve(result.data as T);
            } else {
              this.stats.misses++;
              resolve(null);
            }
          };

          request.onerror = () => {
            this.stats.misses++;
            resolve(null);
          };
        });
      } catch (error) {
        console.error('Failed to read from IndexedDB:', error);
        this.stats.misses++;
      }
    }

    this.stats.misses++;
    return null;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.expiresIn;
  }

  async invalidate(key: string): Promise<void> {
    this.invalidationQueue.add(key);
  }

  private startQueueProcessor(): void {
    this.processQueueTimer = setInterval(() => {
      if (this.invalidationQueue.size > 0) {
        this.processInvalidationQueue();
      }
    }, 100) as unknown as NodeJS.Timeout;
  }

  private async processInvalidationQueue(): Promise<void> {
    const keysToInvalidate = Array.from(this.invalidationQueue);
    this.invalidationQueue.clear();

    for (const key of keysToInvalidate) {
      this.cache.delete(key);

      if (this.db) {
        try {
          const transaction = this.db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          store.delete(key);
        } catch (error) {
          console.error('Failed to delete from IndexedDB:', error);
        }
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();

    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();
      } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
      }
    }
  }

  invalidateAll(): void {
    console.log('🔥 Clearing ALL cache');
    this.cache.clear();

    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();
      } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
      }
    }
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    expiresInMs: number = 300000
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`✓ Cache hit: ${key}`);
      return cached;
    }

    console.log(`⚠ Cache miss: ${key} - fetching...`);
    const data = await fetchFn();
    await this.set(key, data, expiresInMs);
    return data;
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.cache.size };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  destroy(): void {
    if (this.processQueueTimer) {
      clearInterval(this.processQueueTimer);
    }
    this.cache.clear();
    this.invalidationQueue.clear();
  }
}

export const cache = new SmartCache();

export const CACHE_KEYS = {
  PRODUCTS: 'products_list',
  PRODUCTS_PAGE: (page: number, limit: number) => `products_page_${page}_${limit}`,
  STOCK_ITEM: (sku: string, rak: string) => `stock_${sku}_${rak}`,
  STOCK_CALCULATION: (sku: string, rak: string) => `calc_${sku}_${rak}`,
  DASHBOARD_DATA: 'dashboard_data',
  DASHBOARD_STATS: 'dashboard_stats',
  LOG_ENTRIES: (page: number, limit: number) => `logs_page_${page}_${limit}`,
};

export const CACHE_DURATIONS = {
  MASTER_DATA: 3600000,
  HOT_DATA: 300000,
  SEARCH_RESULT: 120000,
  CALCULATION: 60000,
  PAGINATION: 180000,
};
