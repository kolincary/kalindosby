import { supabase, fetchAllStockItems, fetchAllDatabaseLogs } from '../lib/supabase';

interface StockSyncProgress {
  stage: 'loading_stock' | 'loading_logs' | 'calculating' | 'syncing' | 'complete';
  progress: number;
  message: string;
  current?: number;
  total?: number;
}

export const performStockSync = async (
  onProgress: (progress: StockSyncProgress) => void
): Promise<{ success: boolean; itemsUpdated: number; error?: string }> => {
  try {
    onProgress({
      stage: 'loading_stock',
      progress: 10,
      message: 'Memuat data stock items...'
    });

    const stockResult = await fetchAllStockItems();
    if (!stockResult.success) {
      throw new Error('Gagal memuat data stock items');
    }

    onProgress({
      stage: 'loading_logs',
      progress: 30,
      message: 'Memuat data database log...'
    });

    const logResult = await fetchAllDatabaseLogs();
    if (!logResult.success) {
      throw new Error('Gagal memuat data database log');
    }

    const allStockItems = stockResult.data;
    const allLogData = logResult.data;

    onProgress({
      stage: 'calculating',
      progress: 50,
      message: `Menghitung ulang ${allStockItems.length.toLocaleString()} item...`,
      current: 0,
      total: allStockItems.length
    });

    const updatesToMake: Array<{
      id: string;
      nama_produk: string;
      rak: string;
      masuk: number;
      keluar: number;
      tersedia: number;
    }> = [];

    for (let i = 0; i < allStockItems.length; i++) {
      const item = allStockItems[i];

      if (i % 100 === 0) {
        onProgress({
          stage: 'calculating',
          progress: 50 + Math.round((i / allStockItems.length) * 30),
          message: `Menghitung item ${i + 1} dari ${allStockItems.length.toLocaleString()}...`,
          current: i + 1,
          total: allStockItems.length
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const itemLogData = allLogData.filter(
        log => log.sku === item.nama_produk && log.rak === item.rak
      );

      const actualMasuk = itemLogData
        .filter(log => log.type === 'IN')
        .reduce((sum, log) => sum + (log.jumlah || 0), 0);

      const actualKeluar = itemLogData
        .filter(log => log.type === 'OUT')
        .reduce((sum, log) => sum + (log.jumlah || 0), 0);

      const actualTersedia = (item.stok_awal || 0) + actualMasuk - actualKeluar;

      if (
        item.masuk !== actualMasuk ||
        item.keluar !== actualKeluar ||
        item.tersedia !== actualTersedia
      ) {
        updatesToMake.push({
          id: item.id,
          nama_produk: item.nama_produk,
          rak: item.rak,
          masuk: actualMasuk,
          keluar: actualKeluar,
          tersedia: actualTersedia
        });
      }
    }

    if (updatesToMake.length === 0) {
      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Semua data sudah sinkron!'
      });
      return { success: true, itemsUpdated: 0 };
    }

    onProgress({
      stage: 'syncing',
      progress: 80,
      message: `Menyinkronkan ${updatesToMake.length.toLocaleString()} item...`,
      current: 0,
      total: updatesToMake.length
    });

    let successCount = 0;
    for (let i = 0; i < updatesToMake.length; i++) {
      const update = updatesToMake[i];

      try {
        const { error } = await supabase
          .from('stock_items')
          .update({
            masuk: update.masuk,
            keluar: update.keluar,
            tersedia: update.tersedia
          })
          .eq('id', update.id);

        if (!error) {
          successCount++;
        }

        if (i % 10 === 0 || i === updatesToMake.length - 1) {
          onProgress({
            stage: 'syncing',
            progress: 80 + Math.round((i / updatesToMake.length) * 20),
            message: `Menyinkronkan ${i + 1} dari ${updatesToMake.length.toLocaleString()}...`,
            current: i + 1,
            total: updatesToMake.length
          });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.error(`Error updating item ${update.nama_produk}:`, error);
      }
    }

    onProgress({
      stage: 'complete',
      progress: 100,
      message: `Sinkronisasi selesai! ${successCount.toLocaleString()} item berhasil diperbarui.`
    });

    return { success: true, itemsUpdated: successCount };
  } catch (error) {
    console.error('Error performing stock sync:', error);
    return {
      success: false,
      itemsUpdated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
