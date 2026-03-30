import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Database, Download, AlertTriangle, CheckCircle, XCircle, Loader2, Calendar, Package, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Toast } from './ui/Toast';

interface ImportStats {
  total_records: number;
  total_unique_skus: number;
  min_date: string;
  max_date: string;
  gudang_breakdown: Record<string, number>;
}

interface PreviewData {
  nama_produk: string;
  total_qty: number;
  gudang_list: string[];
  record_count: number;
  min_date: string;
  max_date: string;
}

interface ImportResult {
  status: string;
  message: string;
  skus_imported: number;
  total_qty_imported: number;
  transactions_created: number;
  errors: string[];
}

export function HistoricalImportLantai3() {
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const { data, error } = await supabase.rpc('get_lantai3_import_stats');

      if (error) throw error;

      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      showToast('Gagal memuat statistik import', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      const { data, error } = await supabase.rpc('preview_historical_lantai3_import');

      if (error) throw error;

      setPreviewData(data || []);
      setShowPreview(true);
    } catch (error) {
      console.error('Error loading preview:', error);
      showToast('Gagal memuat preview data', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const executeImport = async () => {
    if (!confirm('Apakah Anda yakin ingin mengimport data historis?\n\nIMPORTANT: Data akan diagregasi per BULAN untuk efisiensi storage.\n1.5 juta transaksi akan menjadi ~3000-5000 summary bulanan.\n\nProses ini hanya perlu dilakukan sekali.')) {
      return;
    }

    try {
      setImporting(true);
      const { data, error } = await supabase.rpc('execute_historical_lantai3_import_optimized');

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        setImportResult({
          status: result.status,
          message: result.message,
          skus_imported: result.skus_imported,
          total_qty_imported: result.total_qty_imported,
          transactions_created: result.monthly_records_created,
          errors: result.errors
        });

        if (result.status === 'success') {
          showToast(`Import berhasil! ${result.skus_imported} SKU diimport dengan ${result.monthly_records_created} monthly records (total ${result.total_qty_imported} unit)`, 'success');
        } else if (result.status === 'warning') {
          showToast(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error executing import:', error);
      showToast('Gagal mengeksekusi import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const exportPreviewCSV = () => {
    const headers = ['Nama Produk', 'Total Qty', 'Gudang', 'Jumlah Record', 'Tanggal Awal', 'Tanggal Akhir'];
    const csvContent = [
      headers.join(','),
      ...previewData.map(item =>
        [
          `"${item.nama_produk}"`,
          item.total_qty,
          `"${item.gudang_list.join(', ')}"`,
          item.record_count,
          item.min_date,
          item.max_date
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `preview_import_lantai3_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3">
          <Database className="h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold">Historical Import Data</h2>
            <p className="text-purple-100 mt-1">Import data historis dari database_log ke Stok Lantai 3</p>
          </div>
        </div>
      </div>

      {loadingStats ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-600">Memuat statistik...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Records</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.total_records?.toLocaleString() || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Database className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Unique SKUs</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.total_unique_skus?.toLocaleString() || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Periode Data</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {stats.min_date ? new Date(stats.min_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}
                        </p>
                        <p className="text-xs text-gray-500">s/d</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {stats.max_date ? new Date(stats.max_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Gudang</p>
                        <p className="text-3xl font-bold text-gray-800">
                          {stats.gudang_breakdown ? Object.keys(stats.gudang_breakdown).length : 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {stats.gudang_breakdown && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Breakdown per Gudang</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {Object.entries(stats.gudang_breakdown).map(([gudang, count]) => (
                        <div key={gudang} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">Gudang {gudang}</p>
                          <p className="text-2xl font-bold text-gray-800">{count.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1">records</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardContent className="p-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800 mb-1">Perhatian!</h4>
                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                      <li>Import ini hanya perlu dilakukan SEKALI untuk data historis</li>
                      <li>Data yang diimport adalah semua transaksi type='OUT' dengan gudang SELAIN 'TRANSFER'</li>
                      <li><strong>Data akan diagregasi PER BULAN</strong> untuk efisiensi storage (1.5 juta row menjadi 3000-5000 row)</li>
                      <li>Menghemat storage dari ~750 MB menjadi ~50 MB</li>
                      <li>Riwayat tetap dapat dilihat per bulan dengan detail jumlah transaksi</li>
                      <li>Setelah import, sistem akan otomatis mencatat transaksi baru secara monthly aggregate</li>
                      <li>Proses ini tidak bisa di-undo, pastikan backup database sudah dilakukan</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={loadPreview}
                  disabled={loadingPreview || importing}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loadingPreview ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading Preview...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Preview Data Import
                    </>
                  )}
                </Button>

                {showPreview && previewData.length > 0 && (
                  <>
                    <Button
                      onClick={exportPreviewCSV}
                      variant="secondary"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Preview CSV
                    </Button>

                    <Button
                      onClick={executeImport}
                      disabled={importing}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Execute Import
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {showPreview && previewData.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Preview Data ({previewData.length} SKUs)</h3>
                  <p className="text-sm text-gray-600">
                    Total Qty: <span className="font-bold text-gray-800">
                      {previewData.reduce((sum, item) => sum + item.total_qty, 0).toLocaleString()}
                    </span>
                  </p>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Produk</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gudang</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Records</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Periode</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.nama_produk}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">
                            {item.total_qty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex flex-wrap gap-1">
                              {item.gudang_list.map(gudang => (
                                <span key={gudang} className="px-2 py-1 text-xs bg-gray-100 rounded">
                                  {gudang}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {item.record_count}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            <div className="text-xs">
                              {new Date(item.min_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                              {' - '}
                              {new Date(item.max_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <Card>
              <CardContent className="p-6">
                <div className={`border-l-4 p-4 rounded ${
                  importResult.status === 'success'
                    ? 'bg-green-50 border-green-400'
                    : 'bg-red-50 border-red-400'
                }`}>
                  <div className="flex">
                    {importResult.status === 'success' ? (
                      <CheckCircle className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-400 mr-3 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h4 className={`text-lg font-semibold mb-2 ${
                        importResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {importResult.message}
                      </h4>
                      {importResult.status === 'success' && (
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-600">SKUs Imported</p>
                            <p className="text-2xl font-bold text-green-600">{importResult.skus_imported}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Qty</p>
                            <p className="text-2xl font-bold text-green-600">{importResult.total_qty_imported.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Monthly Records</p>
                            <p className="text-2xl font-bold text-green-600">{importResult.transactions_created}</p>
                          </div>
                        </div>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-red-800 mb-2">Errors:</p>
                          <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                            {importResult.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
