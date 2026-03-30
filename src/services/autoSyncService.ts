import { supabase } from '../lib/supabase';

export type SyncInterval = 1 | 5 | 10 | 30 | 60;

interface SyncResult {
  success: boolean;
  timestamp: string;
  itemsUpdated: number;
  errors: number;
  message: string;
}

interface SyncStatus {
  isRunning: boolean;
  lastSync: string | null;
  nextSync: string | null;
  totalSyncs: number;
  totalItemsUpdated: number;
  totalErrors: number;
}

class AutoSyncService {
  private stockSyncInterval: NodeJS.Timeout | null = null;
  private packingSyncInterval: NodeJS.Timeout | null = null;
  private stockSyncEnabled: boolean = false;
  private packingSyncEnabled: boolean = false;
  private stockSyncIntervalMinutes: SyncInterval = 5;
  private packingSyncIntervalMinutes: SyncInterval = 5;

  private stockSyncStatus: SyncStatus = {
    isRunning: false,
    lastSync: null,
    nextSync: null,
    totalSyncs: 0,
    totalItemsUpdated: 0,
    totalErrors: 0
  };

  private packingSyncStatus: SyncStatus = {
    isRunning: false,
    lastSync: null,
    nextSync: null,
    totalSyncs: 0,
    totalItemsUpdated: 0,
    totalErrors: 0
  };

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const stockEnabled = localStorage.getItem('autoSyncStock_enabled');
      const stockInterval = localStorage.getItem('autoSyncStock_interval');
      const packingEnabled = localStorage.getItem('autoSyncPacking_enabled');
      const packingInterval = localStorage.getItem('autoSyncPacking_interval');

      if (stockEnabled === 'true') {
        this.stockSyncEnabled = true;
        this.stockSyncIntervalMinutes = parseInt(stockInterval || '5') as SyncInterval;
      }

      if (packingEnabled === 'true') {
        this.packingSyncEnabled = true;
        this.packingSyncIntervalMinutes = parseInt(packingInterval || '5') as SyncInterval;
      }
    } catch (error) {
      console.error('Error loading auto-sync settings:', error);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem('autoSyncStock_enabled', this.stockSyncEnabled.toString());
      localStorage.setItem('autoSyncStock_interval', this.stockSyncIntervalMinutes.toString());
      localStorage.setItem('autoSyncPacking_enabled', this.packingSyncEnabled.toString());
      localStorage.setItem('autoSyncPacking_interval', this.packingSyncIntervalMinutes.toString());
    } catch (error) {
      console.error('Error saving auto-sync settings:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  addListener(listener: () => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void) {
    this.listeners.delete(listener);
  }

  private async syncStockData(): Promise<SyncResult> {
    const startTime = Date.now();
    let itemsUpdated = 0;
    let errors = 0;

    try {
      console.log('[Auto-Sync Stock] Starting sync...');

      // Fetch stock items in smaller batches to prevent overwhelming the database
      const { data: stockItems, error: fetchError } = await supabase
        .from('stock_items')
        .select('id, nama_produk, rak, stok_awal')
        .eq('status', 'Aktif')
        .or('rak.ilike.%UTAMA%,sub_rak.ilike.%UTAMA%')
        .limit(100); // Reduced from 500 to 100 to minimize race condition window

      if (fetchError || !stockItems) {
        throw new Error('Failed to fetch stock items');
      }

      // Process items sequentially with a small delay to prevent race conditions
      for (const item of stockItems) {
        try {
          const { data: logData } = await supabase
            .from('database_log')
            .select('jumlah, type')
            .eq('sku', item.nama_produk)
            .ilike('rak', '%UTAMA%')
            .in('type', ['IN', 'OUT']);

          const masuk = (logData || [])
            .filter(log => log.type === 'IN')
            .reduce((sum, log) => sum + (log.jumlah || 0), 0);

          const keluar = (logData || [])
            .filter(log => log.type === 'OUT')
            .reduce((sum, log) => sum + (log.jumlah || 0), 0);

          const tersedia = (item.stok_awal || 0) + masuk - keluar;

          const { error: updateError } = await supabase
            .from('stock_items')
            .update({ masuk, keluar, tersedia })
            .eq('id', item.id);

          if (updateError) {
            errors++;
          } else {
            itemsUpdated++;
          }

          // Small delay to prevent overwhelming database
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          errors++;
          console.error(`Error syncing ${item.nama_produk}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const message = `Synced ${itemsUpdated} items in ${duration}s (${errors} errors)`;

      console.log(`[Auto-Sync Stock] ${message}`);

      this.stockSyncStatus.totalSyncs++;
      this.stockSyncStatus.totalItemsUpdated += itemsUpdated;
      this.stockSyncStatus.totalErrors += errors;
      this.stockSyncStatus.lastSync = new Date().toISOString();
      this.stockSyncStatus.nextSync = new Date(Date.now() + this.stockSyncIntervalMinutes * 60000).toISOString();

      this.notifyListeners();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        itemsUpdated,
        errors,
        message
      };
    } catch (error) {
      console.error('[Auto-Sync Stock] Error:', error);
      errors++;

      this.stockSyncStatus.totalErrors++;
      this.notifyListeners();

      return {
        success: false,
        timestamp: new Date().toISOString(),
        itemsUpdated,
        errors,
        message: `Sync failed: ${error}`
      };
    }
  }

  private async syncPackingData(): Promise<SyncResult> {
    const startTime = Date.now();
    let itemsUpdated = 0;
    let errors = 0;

    try {
      console.log('[Auto-Sync Packing] Starting sync...');

      const { data: stockItems, error: fetchError } = await supabase
        .from('stock_items')
        .select('id, nama_produk, packing')
        .eq('status', 'Aktif')
        .or('packing.is.null,packing.eq.CTN/')
        .limit(200);

      if (fetchError || !stockItems) {
        throw new Error('Failed to fetch stock items');
      }

      const productGroups = new Map<string, any[]>();

      for (const item of stockItems) {
        if (!productGroups.has(item.nama_produk)) {
          const { data: allItems } = await supabase
            .from('stock_items')
            .select('id, packing')
            .eq('nama_produk', item.nama_produk)
            .eq('status', 'Aktif');

          if (allItems) {
            productGroups.set(item.nama_produk, allItems);
          }
        }
      }

      for (const item of stockItems) {
        try {
          const items = productGroups.get(item.nama_produk) || [];
          let completePacking = items
            .map(i => i.packing || '')
            .filter(p => p && p !== 'CTN/' && p.length > 4)
            .sort((a, b) => b.length - a.length)[0];

          if (completePacking) {
            if (completePacking.startsWith('CTN/')) {
              completePacking = completePacking.substring(4);
            }

            const { error: updateError } = await supabase
              .from('stock_items')
              .update({ packing: completePacking })
              .eq('id', item.id);

            if (updateError) {
              errors++;
            } else {
              itemsUpdated++;
            }
          }
        } catch (error) {
          errors++;
          console.error(`Error updating packing for ${item.nama_produk}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const message = `Updated ${itemsUpdated} items in ${duration}s (${errors} errors)`;

      console.log(`[Auto-Sync Packing] ${message}`);

      this.packingSyncStatus.totalSyncs++;
      this.packingSyncStatus.totalItemsUpdated += itemsUpdated;
      this.packingSyncStatus.totalErrors += errors;
      this.packingSyncStatus.lastSync = new Date().toISOString();
      this.packingSyncStatus.nextSync = new Date(Date.now() + this.packingSyncIntervalMinutes * 60000).toISOString();

      this.notifyListeners();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        itemsUpdated,
        errors,
        message
      };
    } catch (error) {
      console.error('[Auto-Sync Packing] Error:', error);
      errors++;

      this.packingSyncStatus.totalErrors++;
      this.notifyListeners();

      return {
        success: false,
        timestamp: new Date().toISOString(),
        itemsUpdated,
        errors,
        message: `Sync failed: ${error}`
      };
    }
  }

  startStockSync(intervalMinutes: SyncInterval = 5) {
    this.stopStockSync();

    this.stockSyncEnabled = true;
    this.stockSyncIntervalMinutes = intervalMinutes;
    this.saveSettings();

    console.log(`[Auto-Sync Stock] Starting with ${intervalMinutes} minute interval`);

    this.syncStockData();

    this.stockSyncInterval = setInterval(() => {
      this.syncStockData();
    }, intervalMinutes * 60000);

    this.stockSyncStatus.isRunning = true;
    this.stockSyncStatus.nextSync = new Date(Date.now() + intervalMinutes * 60000).toISOString();
    this.notifyListeners();
  }

  stopStockSync() {
    if (this.stockSyncInterval) {
      clearInterval(this.stockSyncInterval);
      this.stockSyncInterval = null;
      console.log('[Auto-Sync Stock] Stopped');
    }

    this.stockSyncEnabled = false;
    this.stockSyncStatus.isRunning = false;
    this.stockSyncStatus.nextSync = null;
    this.saveSettings();
    this.notifyListeners();
  }

  startPackingSync(intervalMinutes: SyncInterval = 5) {
    this.stopPackingSync();

    this.packingSyncEnabled = true;
    this.packingSyncIntervalMinutes = intervalMinutes;
    this.saveSettings();

    console.log(`[Auto-Sync Packing] Starting with ${intervalMinutes} minute interval`);

    this.syncPackingData();

    this.packingSyncInterval = setInterval(() => {
      this.syncPackingData();
    }, intervalMinutes * 60000);

    this.packingSyncStatus.isRunning = true;
    this.packingSyncStatus.nextSync = new Date(Date.now() + intervalMinutes * 60000).toISOString();
    this.notifyListeners();
  }

  stopPackingSync() {
    if (this.packingSyncInterval) {
      clearInterval(this.packingSyncInterval);
      this.packingSyncInterval = null;
      console.log('[Auto-Sync Packing] Stopped');
    }

    this.packingSyncEnabled = false;
    this.packingSyncStatus.isRunning = false;
    this.packingSyncStatus.nextSync = null;
    this.saveSettings();
    this.notifyListeners();
  }

  getStockSyncStatus(): SyncStatus {
    return { ...this.stockSyncStatus };
  }

  getPackingSyncStatus(): SyncStatus {
    return { ...this.packingSyncStatus };
  }

  isStockSyncEnabled(): boolean {
    return this.stockSyncEnabled;
  }

  isPackingSyncEnabled(): boolean {
    return this.packingSyncEnabled;
  }

  getStockSyncInterval(): SyncInterval {
    return this.stockSyncIntervalMinutes;
  }

  getPackingSyncInterval(): SyncInterval {
    return this.packingSyncIntervalMinutes;
  }

  stopAll() {
    this.stopStockSync();
    this.stopPackingSync();
  }
}

export const autoSyncService = new AutoSyncService();
