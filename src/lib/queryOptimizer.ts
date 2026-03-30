import { supabase, fetchAllStockItems } from './supabase';
import { cache, CACHE_KEYS, CACHE_DURATIONS } from './cache';

interface StockCalculationResult {
  stok_awal: number;
  masuk: number;
  keluar: number;
  tersedia: number;
}

interface BatchCalculationResult {
  [key: string]: StockCalculationResult;
}


function createBatchKey(...parts: string[]): string {
  return parts.join('|');
}

export const queryOptimizer = {
  async getStockByProduct(productName: string, skipCache: boolean = false): Promise<any[]> {
    const cacheKey = `stock_by_product_${productName}`;

    if (skipCache) {
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .ilike('nama_produk', productName)
        .eq('status', 'Aktif');

      if (error) throw error;
      return data || [];
    }

    return cache.getOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await supabase
          .from('stock_items')
          .select('*')
          .ilike('nama_produk', productName)
          .eq('status', 'Aktif');

        if (error) throw error;
        return data || [];
      },
      CACHE_DURATIONS.SEARCH_RESULT
    );
  },

  async batchGetStockByProducts(productNames: string[], skipCache: boolean = false): Promise<any[]> {
    const results = await Promise.all(
      productNames.map(name => this.getStockByProduct(name, skipCache))
    );
    return results.flat();
  },

  async calculateStockForRack(
    productName: string,
    rack: string,
    skipCache: boolean = false
  ): Promise<StockCalculationResult> {
    const cacheKey = CACHE_KEYS.STOCK_CALCULATION(productName, rack);

    const fetchData = async () => {
      // Gunakan ilike (case-insensitive) agar mismatch kapitalisasi tidak menyebabkan 0 stok
      const stockItem = await supabase
        .from('stock_items')
        .select('stok_awal')
        .ilike('nama_produk', productName)
        .ilike('rak', rack)
        .maybeSingle();

      if (stockItem.error) {
        console.error('Error fetching stock item:', stockItem.error);
        return { stok_awal: 0, masuk: 0, keluar: 0, tersedia: 0 };
      }

      const stok_awal = stockItem.data?.stok_awal || 0;

      // Gunakan ilike (case-insensitive) pada sku dan rak agar konsisten
      const [masukResult, keluarResult] = await Promise.all([
        supabase
          .from('database_log')
          .select('jumlah')
          .ilike('sku', productName)
          .ilike('rak', rack)
          .eq('type', 'IN'),
        supabase
          .from('database_log')
          .select('jumlah')
          .ilike('sku', productName)
          .ilike('rak', rack)
          .eq('type', 'OUT'),
      ]);

      const masuk = (masukResult.data || []).reduce(
        (sum, log) => sum + (log.jumlah || 0),
        0
      );
      const keluar = (keluarResult.data || []).reduce(
        (sum, log) => sum + (log.jumlah || 0),
        0
      );

      const tersedia = stok_awal + masuk - keluar;

      console.log(`📊 Calc: ${productName} @ ${rack} = stok_awal:${stok_awal} + masuk:${masuk} - keluar:${keluar} = ${tersedia}`);

      return { stok_awal, masuk, keluar, tersedia };
    };

    if (skipCache) {
      return fetchData();
    }

    return cache.getOrFetch(cacheKey, fetchData, CACHE_DURATIONS.CALCULATION);
  },

  async batchCalculateStockForRacks(
    items: Array<{ productName: string; rack: string }>,
    skipCache: boolean = false
  ): Promise<BatchCalculationResult> {
    const results = await Promise.all(
      items.map(item =>
        this.calculateStockForRack(item.productName, item.rack, skipCache)
          .then(result => ({
            key: createBatchKey(item.productName, item.rack),
            result
          }))
      )
    );

    const batchResult: BatchCalculationResult = {};
    results.forEach(({ key, result }) => {
      batchResult[key] = result;
    });
    return batchResult;
  },

  async searchProducts(searchTerm: string, limit: number = 50): Promise<Array<{ nama: string }>> {
    if (!searchTerm || searchTerm.length < 1) {
      const cachedProducts = await cache.get<Array<{ nama: string }>>(CACHE_KEYS.PRODUCTS);
      if (cachedProducts) {
        return cachedProducts.slice(0, limit);
      }
    }

    return cache.getOrFetch(
      CACHE_KEYS.PRODUCTS,
      async () => {
        const { data } = await fetchAllStockItems();
        const uniqueNames = [...new Set((data || []).map((item: any) => String(item.nama_produk || '')))];
        return uniqueNames.sort().map((nama) => ({ nama: String(nama) }));
      },
      CACHE_DURATIONS.MASTER_DATA
    );
  },

  async getDashboardStats(): Promise<{
    total_products: number;
    empty_stock_items: number;
    low_stock_items: number;
  }> {
    const cacheKey = 'dashboard_stats';

    return cache.getOrFetch(
      cacheKey,
      async () => {
        const { data: stockItems } = await fetchAllStockItems();
        if (!stockItems || stockItems.length === 0) return { total_products: 0, empty_stock_items: 0, low_stock_items: 0 };

        const { data: logData, error: logError } = await supabase
          .from('database_log')
          .select('sku, rak, type, jumlah')
          .in('type', ['IN', 'OUT']);

        if (logError) {
          console.error('Error fetching logs for stats:', logError);
        }

        const logs = logData || [];
        const logMap = new Map<string, { masuk: number, keluar: number }>();

        logs.forEach(log => {
          const key = `${log.sku}|${log.rak}`;
          if (!logMap.has(key)) logMap.set(key, { masuk: 0, keluar: 0 });
          const stat = logMap.get(key)!;
          if (log.type === 'IN') stat.masuk += (log.jumlah || 0);
          if (log.type === 'OUT') stat.keluar += (log.jumlah || 0);
        });

        const uniqueProducts = new Set<string>();
        let emptyCount = 0;
        let lowCount = 0;

        for (const item of stockItems) {
          uniqueProducts.add(item.nama_produk);
          const key = `${item.nama_produk}|${item.rak}`;
          const stat = logMap.get(key) || { masuk: 0, keluar: 0 };

          const tersedia = (item.stok_awal || 0) + stat.masuk - stat.keluar;

          if (tersedia === 0) emptyCount++;
          else if (tersedia > 0 && tersedia < 10) lowCount++;
        }

        return {
          total_products: uniqueProducts.size,
          empty_stock_items: emptyCount,
          low_stock_items: lowCount,
        };
      },
      CACHE_DURATIONS.HOT_DATA
    );
  },

  invalidateProductCache(productName: string) {
    cache.invalidate(`stock_by_product_${productName}`);
    cache.invalidate(CACHE_KEYS.PRODUCTS);
    cache.invalidate('dashboard_stats');
  },

  invalidateStockCalculation(productName: string, rack: string) {
    cache.invalidate(CACHE_KEYS.STOCK_CALCULATION(productName, rack));
  },

  invalidateAllCache() {
    cache.invalidateAll();
  },

  async warmupCache() {
    console.log('🔥 Warming up cache...');
    try {
      await Promise.all([
        this.searchProducts('', 100),
        // getDashboardStats ditarik dari warmup karena sangat berat dan belum digunakan di UI utama
        // this.getDashboardStats(),
      ]);
      console.log('✓ Cache warmed up successfully');
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  },
};
