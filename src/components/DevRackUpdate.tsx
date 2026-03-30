import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { MapPin, RefreshCw, CreditCard as Edit2, Save, Calendar, Filter, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DatabaseLogEntry {
  id: string;
  tgl: string;
  waktu: string;
  sku: string;
  jumlah: number;
  type: 'IN' | 'OUT' | 'MOVE';
  gudang: string;
  rak: string;
  sub_rak: string;
  tgl_scan: string;
  user_name: string;
  log_update_user: string;
  created_at: string;
}

interface RackLocation {
  id: string;
  nama: string;
  status: string;
}

export function DevRackUpdate() {
  const [logEntries, setLogEntries] = useState<DatabaseLogEntry[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<DatabaseLogEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  }, []);

  // Target dates for filtering
  const targetDates = [
    '26/08/2025',
    '29/08/2025', 
    '31/08/2025',
    '03/09/2025',
    '24/09/2025',
    '25/09/2025',
    '27/09/2025'
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const isValidRackPattern = (rak: string): boolean => {
    if (!rak) return false;
    
    const upperRak = rak.toUpperCase();
    
    // Check for UTAMA
    if (upperRak === 'UTAMA') return true;
    
    // Check for pattern A1, A2, A3 ... Z1000 or more
    const pattern = /^[A-Z](\d+)$/;
    const match = upperRak.match(pattern);
    
    if (match) {
      const number = parseInt(match[1]);
      return number >= 1 && number <= 1000; // Allow up to Z1000 or more
    }
    
    return false;
  };

  // Smart date validation function
  const isValidDateFormat = (tgl: string, tglScan: string): boolean => {
    if (!tgl || !tglScan) return true; // Skip validation if either is empty
    
    try {
      // Parse tgl (format: dd-mm-yyyy or similar)
      const tglParts = tgl.split(/[-\/]/);
      if (tglParts.length !== 3) return true;
      
      const tglDay = parseInt(tglParts[0]);
      const tglMonth = parseInt(tglParts[1]);
      const tglYear = parseInt(tglParts[2]);
      
      // Parse tgl_scan (format: dd/mm/yyyy)
      const scanParts = tglScan.split(/[-\/]/);
      if (scanParts.length !== 3) return true;
      
      const scanDay = parseInt(scanParts[0]);
      const scanMonth = parseInt(scanParts[1]);
      const scanYear = parseInt(scanParts[2]);
      
      // Create date objects for comparison
      const tglDate = new Date(tglYear, tglMonth - 1, tglDay);
      const scanDate = new Date(scanYear, scanMonth - 1, scanDay);
      
      // tgl_scan should be <= tgl (scan date should be before or same as transaction date)
      // If scan date is significantly after transaction date, it's likely wrong format
      const daysDifference = (scanDate.getTime() - tglDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Allow some flexibility but flag obvious format issues
      return daysDifference <= 30; // Allow up to 30 days difference
      
    } catch (error) {
      return true; // If parsing fails, don't filter out
    }
  };

  const isTargetDateOrLater = (dateStr: string): boolean => {
    if (!dateStr) return false;
    
    try {
      // Parse the date (assuming dd/mm/yyyy format)
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) return false;
      
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const year = parseInt(dateParts[2]);
      
      const checkDate = new Date(year, month - 1, day);
      
      // Find the earliest target date
      let earliestTargetDate: Date | null = null;
      
      for (const targetDateStr of targetDates) {
        const targetParts = targetDateStr.split('/');
        const targetDay = parseInt(targetParts[0]);
        const targetMonth = parseInt(targetParts[1]);
        const targetYear = parseInt(targetParts[2]);
        const targetDate = new Date(targetYear, targetMonth - 1, targetDay);
        
        if (!earliestTargetDate || targetDate < earliestTargetDate) {
          earliestTargetDate = targetDate;
        }
      }
      
      return earliestTargetDate ? checkDate >= earliestTargetDate : false;
      
    } catch (error) {
      console.error('Error parsing date:', error);
      return false;
    }
  };

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      showToast('Memuat data...', 'info');

      // Load rack locations first
      const { data: rackData, error: rackError } = await supabase
        .from('rack_locations')
        .select('id, nama, status')
        .eq('status', 'Aktif')
        .order('nama', { ascending: true });

      if (rackError) {
        console.error('Error loading rack locations:', rackError);
        showToast('Gagal memuat data lokasi rak', 'warning');
      } else {
        setRackLocations(rackData || []);
      }

      await loadFilteredData();

    } catch (error) {
      console.error('Error loading initial data:', error);
      showToast('Gagal memuat data awal', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      showToast('Memuat data dengan kriteria khusus...', 'info');

      // Use more efficient query with targeted filtering
      let query = supabase
        .from('database_log')
        .select('*', { count: 'exact' })
        .in('type', ['IN', 'OUT'])
        .order('created_at', { ascending: false });

      // Get all data in batches for better performance
      let allData: DatabaseLogEntry[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await query.range(from, from + batchSize - 1);

        if (error) {
          console.error(`Error loading batch ${from}-${from + batchSize - 1}:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          totalProcessed += data.length;
          
          // Show progress every 2000 records
          if (totalProcessed % 2000 === 0) {
            showToast(`Memproses ${totalProcessed.toLocaleString()} data...`, 'info');
          }
          
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        } else {
          hasMore = false;
        }
        
        // Small delay to prevent overwhelming
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      showToast(`Menganalisis ${allData.length.toLocaleString()} data...`, 'info');

      // Apply client-side filtering for better performance
      const filteredData = allData.filter(entry => {
        // Check if rak or sub_rak matches the pattern
        const rakMatches = isValidRackPattern(entry.rak) || isValidRackPattern(entry.sub_rak);
        
        // Check date based on type
        let dateMatches = false;
        if (entry.type === 'OUT') {
          // For OUT: check tgl_scan with smart validation
          dateMatches = isTargetDateOrLater(entry.tgl_scan) && isValidDateFormat(entry.tgl, entry.tgl_scan);
        } else if (entry.type === 'IN') {
          // For IN: check tgl
          dateMatches = isTargetDateOrLater(entry.tgl);
        }
        
        return rakMatches && dateMatches;
      });

      setLogEntries(filteredData);
      setTotalCount(allData.length);

      showToast(`✅ Berhasil memuat ${filteredData.length.toLocaleString()} data yang sesuai kriteria dari ${allData.length.toLocaleString()} total data IN/OUT`, 'success');

    } catch (error) {
      console.error('Error loading filtered data:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = useCallback(() => {
    loadFilteredData();
  }, []);

  const handleEdit = (entry: DatabaseLogEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;
    
    try {
      const { error } = await supabase
        .from('database_log')
        .update({
          rak: editingEntry.rak,
          sub_rak: editingEntry.sub_rak
        })
        .eq('id', editingEntry.id);

      if (error) {
        console.error('Error updating log entry:', error);
        showToast('Gagal mengupdate data log', 'error');
        return;
      }

      showToast('Data rak berhasil diupdate!', 'success');
      setIsEditModalOpen(false);
      
      // Update local state instead of reloading all data
      setLogEntries(prevEntries => 
        prevEntries.map(entry => 
          entry.id === editingEntry.id 
            ? { ...entry, rak: editingEntry.rak, sub_rak: editingEntry.sub_rak }
            : entry
        )
      );
    } catch (error) {
      console.error('Error updating log entry:', error);
      showToast('Terjadi kesalahan saat mengupdate data', 'error');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <div className="text-orange-600 font-medium">Memuat data dev rack update...</div>
          <div className="text-sm text-gray-500 mt-2">Mengoptimalkan query untuk performa terbaik</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <MapPin className="h-8 w-8" />
              <div>
                <h1 className="text-3xl font-bold">DEV: UPDATE RAK KHUSUS</h1>
                <p className="text-orange-100 mt-2">Update rak dan sub_rak untuk data IN/OUT dengan kriteria khusus</p>
                <div className="text-xs text-orange-200 mt-1 bg-orange-700 px-2 py-1 rounded">
                  DEV MODE ONLY - Menu Tersembunyi
                </div>
              </div>
            </div>
            <Button
              onClick={refreshData}
              variant="secondary"
              size="lg"
              className="bg-gray-600 hover:bg-gray-700"
              disabled={loading}
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Criteria Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800">
              <h3 className="font-semibold mb-2">Kriteria Filter Data</h3>
              <div className="text-sm space-y-1">
                <div><strong>Type:</strong> IN dan OUT</div>
                <div><strong>Rak/Sub Rak:</strong> UTAMA atau pola A1-Z1000+</div>
                <div><strong>Tanggal:</strong> 26/08/2025, 29/08/2025, 31/08/2025, 03/09/2025, 24/09/2025, 25/09/2025, 27/09/2025 atau setelahnya</div>
                <div className="text-xs text-yellow-600 mt-2">
                  * Type OUT: berdasarkan kolom tgl_scan (dengan validasi logika tanggal)<br/>
                  * Type IN: berdasarkan kolom tgl<br/>
                  * Format tanggal: dd/mm/yyyy (validasi otomatis untuk mencegah format salah)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="bg-orange-600 text-white p-3 -m-6 mb-4 rounded-t-lg">
              <h3 className="font-semibold">Data Database Log - Type IN/OUT (Kriteria Khusus)</h3>
              <p className="text-orange-100 text-sm mt-1">
                Menampilkan SEMUA {logEntries.length.toLocaleString()} data yang sesuai kriteria
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mr-3"></div>
                <div className="text-orange-600 font-medium">Memuat data...</div>
              </div>
            )}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-orange-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Tgl</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Waktu</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">SKU</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-orange-500">Jumlah</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-orange-500">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Gudang</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Rak</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Sub Rak</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">Tgl Scan</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-orange-500">User</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((entry, index) => {
                    const isDateValid = isValidDateFormat(entry.tgl, entry.tgl_scan);
                    return (
                      <tr key={entry.id} className={`${index % 2 === 0 ? 'bg-orange-50' : 'bg-white'} hover:bg-orange-100 border-b border-gray-200`}>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">{entry.tgl}</td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">{entry.waktu}</td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">{entry.sku}</td>
                        <td className="px-4 py-2 text-sm text-center border-r border-gray-200">{entry.jumlah}</td>
                        <td className="px-4 py-2 text-center border-r border-gray-200">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            entry.type === 'OUT' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">{entry.gudang}</td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isValidRackPattern(entry.rak) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.rak}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isValidRackPattern(entry.sub_rak) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.sub_rak}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            !isDateValid ? 'bg-red-100 text-red-800' :
                            targetDates.includes(entry.tgl_scan) ? 'bg-blue-100 text-blue-800' : 
                            isTargetDateOrLater(entry.tgl_scan) ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.tgl_scan}
                            {!isDateValid && <span className="ml-1 text-xs">⚠️</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm border-r border-gray-200">{entry.user_name}</td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            onClick={() => handleEdit(entry)}
                            size="sm"
                            variant="primary"
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {logEntries.length === 0 && !loading && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        Tidak ada data yang sesuai dengan kriteria filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Data Sesuai Kriteria:</span>
              <span className="ml-1 text-orange-600">{logEntries.length.toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Total Data IN/OUT:</span>
              <span className="ml-1 text-blue-600">{totalCount.toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Lokasi Rak:</span>
              <span className="ml-1 text-green-600">{rackLocations.length} aktif</span>
            </div>
            <div>
              <span className="font-medium">Mode:</span>
              <span className="ml-1 text-purple-600">ALL Data (No Pagination)</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-3">Keterangan Warna:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">UTAMA/A1-Z1000</span>
              <span className="text-gray-600">Rak sesuai pola</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">OUT</span>
              <span className="text-gray-600">Type OUT</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">IN</span>
              <span className="text-gray-600">Type IN</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">Target Date</span>
              <span className="text-gray-600">Tanggal target</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">⚠️</span>
              <span className="text-gray-600">Format tanggal bermasalah</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">Later Date</span>
              <span className="text-gray-600">Tanggal setelah target</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Rak dan Sub Rak" size="lg">
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-800 mb-2">Data Entry:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>SKU:</strong> {editingEntry.sku}</div>
                <div><strong>Tanggal:</strong> {editingEntry.tgl}</div>
                <div><strong>Type:</strong> {editingEntry.type}</div>
                <div><strong>Jumlah:</strong> {editingEntry.jumlah}</div>
                <div><strong>Tgl Scan:</strong> {editingEntry.tgl_scan}</div>
                <div><strong>User:</strong> {editingEntry.user_name}</div>
              </div>
              {!isValidDateFormat(editingEntry.tgl, editingEntry.tgl_scan) && (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-xs">
                  ⚠️ <strong>Peringatan:</strong> Format tanggal mungkin bermasalah. Tgl_scan ({editingEntry.tgl_scan}) tampak tidak logis dibanding tgl ({editingEntry.tgl}).
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rak</label>
                <select
                  value={editingEntry.rak}
                  onChange={(e) => setEditingEntry({
                    ...editingEntry, 
                    rak: e.target.value,
                    sub_rak: e.target.value // Auto-fill sub_rak with same value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="">Pilih Rak...</option>
                  {rackLocations.map((rack) => (
                    <option key={rack.id} value={rack.nama}>
                      {rack.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sub Rak</label>
                <input
                  type="text"
                  value={editingEntry.sub_rak}
                  onChange={(e) => setEditingEntry({...editingEntry, sub_rak: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Sub lokasi rak..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Otomatis terisi saat memilih Rak, dapat diubah manual
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button onClick={() => setIsEditModalOpen(false)} variant="secondary">
                Batal
              </Button>
              <Button onClick={handleUpdateEntry} variant="primary" className="bg-orange-600 hover:bg-orange-700">
                <Save className="h-4 w-4 mr-2" />
                Update
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}