import { supabase } from '../lib/supabase';

export interface MissingTransferItem {
  sku: string;
  rak: string;
  product_name: string;
  satuan: string;
  count_in_log: number;
}

export interface ProcessResult {
  total_processed: number;
  items_created: number;
  items_skipped: number;
  duration_ms: number;
}

export interface SyncLogEntry {
  id: string;
  operation_type: string;
  total_processed: number;
  items_created: number;
  items_skipped: number;
  details: Record<string, any>;
  created_at: string;
  created_by: string;
}

class TransferSyncService {
  async findMissingTransferItems(): Promise<{
    success: boolean;
    data?: MissingTransferItem[];
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase.rpc('find_missing_transfer_stock_items');

      if (error) {
        console.error('Error finding missing transfer items:', error);
        return { success: false, error };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in findMissingTransferItems:', error);
      return { success: false, error: error as Error };
    }
  }

  async processPendingTransfers(): Promise<{
    success: boolean;
    result?: ProcessResult;
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase.rpc('process_pending_transfers');

      if (error) {
        console.error('Error processing pending transfers:', error);
        return { success: false, error };
      }

      if (data && data.length > 0) {
        const result = data[0] as ProcessResult;
        console.log(
          `Transfer sync completed: ${result.items_created} created, ${result.items_skipped} skipped in ${result.duration_ms}ms`
        );
        return { success: true, result };
      }

      return { success: true, result: { total_processed: 0, items_created: 0, items_skipped: 0, duration_ms: 0 } };
    } catch (error) {
      console.error('Error in processPendingTransfers:', error);
      return { success: false, error: error as Error };
    }
  }

  async getSyncLogs(limit: number = 50): Promise<{
    success: boolean;
    data?: SyncLogEntry[];
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('transfer_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching sync logs:', error);
        return { success: false, error };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in getSyncLogs:', error);
      return { success: false, error: error as Error };
    }
  }

  async getRecentSyncStats(): Promise<{
    success: boolean;
    stats?: {
      last_sync_at: string | null;
      total_created: number;
      total_skipped: number;
      last_operation_type: string | null;
    };
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('transfer_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sync stats:', error);
        return { success: false, error };
      }

      if (!data) {
        return {
          success: true,
          stats: {
            last_sync_at: null,
            total_created: 0,
            total_skipped: 0,
            last_operation_type: null,
          },
        };
      }

      return {
        success: true,
        stats: {
          last_sync_at: data.created_at,
          total_created: data.items_created,
          total_skipped: data.items_skipped,
          last_operation_type: data.operation_type,
        },
      };
    } catch (error) {
      console.error('Error in getRecentSyncStats:', error);
      return { success: false, error: error as Error };
    }
  }

  async getTransferEntriesCount(): Promise<{
    success: boolean;
    total?: number;
    with_stock_items?: number;
    without_stock_items?: number;
    error?: Error;
  }> {
    try {
      const { count: totalCount, error: totalError } = await supabase
        .from('database_log')
        .select('*', { count: 'exact', head: true })
        .eq('gudang', 'TRANSFER');

      if (totalError) {
        console.error('Error counting total transfer entries:', totalError);
        return { success: false, error: totalError };
      }

      const missingResult = await this.findMissingTransferItems();
      let missingCount = 0;
      if (missingResult.success && missingResult.data) {
        missingCount = missingResult.data.length;
      }

      return {
        success: true,
        total: totalCount || 0,
        without_stock_items: missingCount,
        with_stock_items: (totalCount || 0) - missingCount,
      };
    } catch (error) {
      console.error('Error in getTransferEntriesCount:', error);
      return { success: false, error: error as Error };
    }
  }
}

export const transferSyncService = new TransferSyncService();
