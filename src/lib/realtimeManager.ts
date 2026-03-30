import { supabase } from './supabase';
import { cache } from './cache';

type ChangeCallback = (change: any) => void;

interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onchange: ChangeCallback;
}

class RealtimeManager {
  private channel: any = null;
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceDelay = 500;
  private pendingChanges: Set<string> = new Set();
  private isConnected = false;

  async initialize(): Promise<void> {
    if (this.channel) {
      return;
    }

    this.channel = supabase.channel('app-realtime', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
        postgres_changes: { self: false },
      },
    });

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stock_items' },
      (payload: any) => this.handleChange('stock_items', payload)
    );

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'database_log' },
      (payload: any) => this.handleChange('database_log', payload)
    );

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      (payload: any) => this.handleChange('products', payload)
    );

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings' },
      (payload: any) => this.handleChange('app_settings', payload)
    );

    this.channel.subscribe((status: string) => {
      this.isConnected = status === 'SUBSCRIBED';
      if (this.isConnected) {
        console.log('✓ Realtime manager connected');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime channel error');
      }
    });
  }

  private handleChange(table: string, payload: any): void {
    const key = `${table}_${payload.new?.id || payload.old?.id}`;
    this.pendingChanges.add(key);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.debounceDelay) as unknown as NodeJS.Timeout;

    this.subscriptions.forEach((config) => {
      if (config.table === table && (config.event === '*' || config.event === payload.eventType)) {
        config.onchange(payload);
      }
    });
  }

  private processPendingChanges(): void {
    const tables = new Set<string>();
    this.pendingChanges.forEach((key) => {
      const table = key.split('_')[0];
      tables.add(table);
    });

    tables.forEach((table) => {
      this.invalidateCacheForTable(table);
    });

    this.pendingChanges.clear();
  }

  private invalidateCacheForTable(table: string): void {
    console.log(`🔄 Invalidating cache for table: ${table}`);

    if (table === 'stock_items') {
      cache.invalidate('stock_by_product_*');
      cache.invalidate('dashboard_stats');
    } else if (table === 'database_log') {
      cache.invalidate('calc_*');
      cache.invalidate('dashboard_stats');
    } else if (table === 'products') {
      cache.invalidate('products_list');
    }
  }

  subscribe(table: string, callback: ChangeCallback, event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'): string {
    const id = `${table}_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(id, { table, event, onchange: callback });
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  async disconnect(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.subscriptions.clear();
    this.pendingChanges.clear();
    this.isConnected = false;
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export const realtimeManager = new RealtimeManager();
