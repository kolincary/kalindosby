import { supabase } from '../lib/supabase';

interface MissingStockItem {
  sku: string;
  rak: string;
  sub_rak: string;
  packing: string;
  satuan: string;
  count_in_log: number;
  log_entries: any[];
}

interface BackfillResult {
  items_created: number;
  items_skipped: number;
  error_message: string | null;
}

interface TransferConsistency {
  total_transfer_in_entries: number;
  missing_stock_items: number;
  inconsistent_combinations: number;
  is_consistent: boolean;
}

export const transferAuditService = {
  async findMissingStockItems(): Promise<{
    success: boolean;
    data?: MissingStockItem[];
    error?: any;
  }> {
    try {
      console.log('Finding missing stock items for TRANSFER entries...');
      const { data, error } = await supabase.rpc(
        'find_missing_stock_items_for_transfer'
      );

      if (error) {
        console.error('Error finding missing stock items:', error);
        return { success: false, error };
      }

      const items = (data || []) as MissingStockItem[];
      console.log(`Found ${items.length} missing stock item combinations`);
      return { success: true, data: items };
    } catch (error) {
      console.error('Exception finding missing stock items:', error);
      return { success: false, error };
    }
  },

  async backfillMissingStockItems(): Promise<{
    success: boolean;
    result?: BackfillResult;
    error?: any;
  }> {
    try {
      console.log('Starting backfill of missing stock items...');
      const startTime = performance.now();

      const { data, error } = await supabase.rpc(
        'backfill_missing_stock_items'
      );

      if (error) {
        console.error('Error during backfill:', error);
        return { success: false, error };
      }

      const result = data?.[0] as BackfillResult;
      const duration = performance.now() - startTime;

      console.log(
        `Backfill completed in ${duration.toFixed(0)}ms: Created ${result.items_created}, Skipped ${result.items_skipped}`
      );

      return { success: true, result };
    } catch (error) {
      console.error('Exception during backfill:', error);
      return { success: false, error };
    }
  },

  async verifyTransferConsistency(): Promise<{
    success: boolean;
    consistency?: TransferConsistency;
    error?: any;
  }> {
    try {
      console.log('Verifying transfer data consistency...');
      const { data, error } = await supabase.rpc(
        'verify_transfer_consistency'
      );

      if (error) {
        console.error('Error verifying consistency:', error);
        return { success: false, error };
      }

      const consistency = data?.[0] as TransferConsistency;
      console.log('Transfer consistency check:', {
        total_transfer_in_entries: consistency.total_transfer_in_entries,
        missing_stock_items: consistency.missing_stock_items,
        is_consistent: consistency.is_consistent,
      });

      return { success: true, consistency };
    } catch (error) {
      console.error('Exception verifying consistency:', error);
      return { success: false, error };
    }
  },

  async getBackfillHistory(limit: number = 10): Promise<{
    success: boolean;
    data?: any[];
    error?: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('stock_item_backfill_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching backfill history:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception fetching backfill history:', error);
      return { success: false, error };
    }
  },

  async getTransferAuditSummary(): Promise<{
    success: boolean;
    data?: any[];
    error?: any;
  }> {
    try {
      const { data, error } = await supabase
        .from('v_transfer_audit_summary')
        .select('*');

      if (error) {
        console.error('Error fetching audit summary:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Exception fetching audit summary:', error);
      return { success: false, error };
    }
  },
};
