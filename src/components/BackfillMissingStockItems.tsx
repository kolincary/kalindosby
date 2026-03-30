import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { AlertCircle, CheckCircle, Loader, RefreshCw, Play, Pause } from 'lucide-react';
import { transferAuditService } from '../services/transferAuditService';

interface BackfillState {
  status: 'idle' | 'checking' | 'backfilling' | 'verifying' | 'completed' | 'error';
  message: string;
  details: {
    total_missing: number;
    items_created: number;
    items_skipped: number;
    duration_ms: number;
  };
}

export function BackfillMissingStockItems() {
  const [state, setState] = useState<BackfillState>({
    status: 'idle',
    message: '',
    details: {
      total_missing: 0,
      items_created: 0,
      items_skipped: 0,
      duration_ms: 0,
    },
  });

  const [missingItems, setMissingItems] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  };

  const handleCheckMissing = async () => {
    try {
      setState({
        status: 'checking',
        message: 'Memeriksa missing stock items...',
        details: { total_missing: 0, items_created: 0, items_skipped: 0, duration_ms: 0 },
      });

      const result = await transferAuditService.findMissingStockItems();

      if (!result.success) {
        setState({
          status: 'error',
          message: `Error: ${result.error?.message || 'Unknown error'}`,
          details: { total_missing: 0, items_created: 0, items_skipped: 0, duration_ms: 0 },
        });
        showToast('Gagal memeriksa missing stock items', 'error');
        return;
      }

      const items = result.data || [];
      setMissingItems(items);

      setState({
        status: 'idle',
        message: `Ditemukan ${items.length} kombinasi SKU+RAK yang hilang di stock_items`,
        details: {
          total_missing: items.length,
          items_created: 0,
          items_skipped: 0,
          duration_ms: 0,
        },
      });

      showToast(`Ditemukan ${items.length} missing stock items`, 'info');
    } catch (error) {
      console.error('Error checking missing items:', error);
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { total_missing: 0, items_created: 0, items_skipped: 0, duration_ms: 0 },
      });
      showToast('Terjadi error saat memeriksa', 'error');
    }
  };

  const handleBackfill = async () => {
    if (missingItems.length === 0) {
      showToast('Tidak ada missing stock items untuk di-backfill', 'warning');
      return;
    }

    try {
      setState({
        status: 'backfilling',
        message: `Membuat ${missingItems.length} stock items yang hilang...`,
        details: { total_missing: missingItems.length, items_created: 0, items_skipped: 0, duration_ms: 0 },
      });

      const startTime = performance.now();
      const result = await transferAuditService.backfillMissingStockItems();
      const duration = performance.now() - startTime;

      if (!result.success) {
        setState({
          status: 'error',
          message: `Error: ${result.error?.message || 'Unknown error'}`,
          details: { total_missing: missingItems.length, items_created: 0, items_skipped: 0, duration_ms: Math.round(duration) },
        });
        showToast('Gagal melakukan backfill', 'error');
        return;
      }

      const backfillResult = result.result!;

      setState({
        status: 'verifying',
        message: 'Memverifikasi konsistensi data...',
        details: {
          total_missing: missingItems.length,
          items_created: backfillResult.items_created,
          items_skipped: backfillResult.items_skipped,
          duration_ms: Math.round(duration),
        },
      });

      const verifyResult = await transferAuditService.verifyTransferConsistency();

      if (!verifyResult.success) {
        setState({
          status: 'error',
          message: 'Error saat verifikasi',
          details: {
            total_missing: missingItems.length,
            items_created: backfillResult.items_created,
            items_skipped: backfillResult.items_skipped,
            duration_ms: Math.round(duration),
          },
        });
        showToast('Gagal memverifikasi hasil backfill', 'error');
        return;
      }

      setState({
        status: 'completed',
        message: verifyResult.consistency?.is_consistent
          ? 'Backfill berhasil! Semua data konsisten.'
          : 'Backfill selesai dengan warning: masih ada inconsistency.',
        details: {
          total_missing: missingItems.length,
          items_created: backfillResult.items_created,
          items_skipped: backfillResult.items_skipped,
          duration_ms: Math.round(duration),
        },
      });

      showToast(
        `Backfill selesai! ${backfillResult.items_created} items dibuat, ${backfillResult.items_skipped} skipped`,
        verifyResult.consistency?.is_consistent ? 'success' : 'warning'
      );

      setMissingItems([]);
    } catch (error) {
      console.error('Error during backfill:', error);
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { total_missing: missingItems.length, items_created: 0, items_skipped: 0, duration_ms: 0 },
      });
      showToast('Terjadi error saat backfill', 'error');
    }
  };

  const handleReset = () => {
    setState({
      status: 'idle',
      message: '',
      details: { total_missing: 0, items_created: 0, items_skipped: 0, duration_ms: 0 },
    });
    setMissingItems([]);
  };

  return (
    <>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
      />

      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-3 mb-2">
                <RefreshCw className="h-8 w-8 text-blue-600" />
                <span>Backfill Missing Stock Items</span>
              </h2>
              <p className="text-gray-600 text-sm">
                Utility untuk menemukan dan membuat stock items yang hilang dari data TRANSFER di database_log
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex space-x-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>Penjelasan:</strong> Alat ini akan mengidentifikasi semua entry TRANSFER di database_log yang tidak memiliki pasangan stock_items, kemudian membuat stock_items yang hilang tersebut secara otomatis.
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Status Saat Ini</h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  {state.status === 'idle' && <div className="h-3 w-3 rounded-full bg-gray-400" />}
                  {state.status === 'checking' && <Loader className="h-5 w-5 animate-spin text-blue-600" />}
                  {state.status === 'backfilling' && <Loader className="h-5 w-5 animate-spin text-amber-600" />}
                  {state.status === 'verifying' && <Loader className="h-5 w-5 animate-spin text-purple-600" />}
                  {state.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {state.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}

                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">{state.status}</p>
                    <p className="text-sm text-gray-600">{state.message}</p>
                  </div>
                </div>

                {state.details.total_missing > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-gray-600">Total Missing</div>
                      <div className="text-2xl font-bold text-gray-800">{state.details.total_missing}</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-gray-600">Items Created</div>
                      <div className="text-2xl font-bold text-green-600">{state.details.items_created}</div>
                    </div>
                    {state.details.items_skipped > 0 && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="text-gray-600">Skipped</div>
                        <div className="text-2xl font-bold text-yellow-600">{state.details.items_skipped}</div>
                      </div>
                    )}
                    {state.details.duration_ms > 0 && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="text-gray-600">Duration</div>
                        <div className="text-2xl font-bold text-blue-600">{state.details.duration_ms}ms</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {missingItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-800">Missing Stock Items yang Ditemukan</h4>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {showDetails ? 'Sembunyikan' : 'Tampilkan'} Detail
                    </button>
                  </div>

                  {showDetails && (
                    <div className="border rounded-lg overflow-y-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">SKU</th>
                            <th className="px-4 py-2 text-left text-gray-700 font-medium">Rak</th>
                            <th className="px-4 py-2 text-center text-gray-700 font-medium">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {missingItems.map((item, idx) => (
                            <tr key={idx} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-800">{item.sku}</td>
                              <td className="px-4 py-2 text-gray-800">{item.rak}</td>
                              <td className="px-4 py-2 text-center text-gray-600">{item.count_in_log}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleCheckMissing}
                variant="primary"
                className="flex-1"
                disabled={state.status !== 'idle' && state.status !== 'completed' && state.status !== 'error'}
              >
                <Play className="h-4 w-4 mr-2" />
                Periksa Missing Items
              </Button>

              <Button
                onClick={handleBackfill}
                variant="success"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={missingItems.length === 0 || state.status !== 'idle'}
              >
                <Pause className="h-4 w-4 mr-2" />
                Jalankan Backfill
              </Button>

              <Button
                onClick={handleReset}
                variant="secondary"
                className="flex-1"
                disabled={state.status === 'idle' && missingItems.length === 0}
              >
                Reset
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Catatan Penting:</strong> Pastikan Anda telah backup database sebelum menjalankan backfill. Proses ini akan membuat stock_items baru berdasarkan data yang ada di database_log.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
