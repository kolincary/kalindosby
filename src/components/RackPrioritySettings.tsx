import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { Toast } from './ui/Toast';
import { Search, X, RefreshCw, Save, Filter, CheckSquare, Square } from 'lucide-react';

interface ProductRackItem {
  id: string;
  nama_produk: string;
  rak: string;
  is_excluded: boolean;
}

interface StockItem {
  nama_produk: string;
  rak: string;
}

export function RackPrioritySettings() {
  const [productRacks, setProductRacks] = useState<ProductRackItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rackFilter, setRackFilter] = useState('');
  const [uniqueRacks, setUniqueRacks] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAllStockData = async () => {
    let allData: StockItem[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('stock_items')
        .select('nama_produk, rak')
        .eq('status', 'Aktif')
        .not('rak', 'is', null)
        .not('rak', 'eq', '')
        .order('nama_produk', { ascending: true })
        .order('rak', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  const fetchAllExclusionData = async () => {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('product_rack_exclusions')
        .select('*')
        .range(from, from + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  const fetchAllRackLocations = async () => {
    let allData: string[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('rack_locations')
        .select('nama')
        .order('nama', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data.map((item: any) => item.nama)];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [stockData, exclusionData, rackLocationsData] = await Promise.all([
        fetchAllStockData(),
        fetchAllExclusionData(),
        fetchAllRackLocations()
      ]);

      const uniqueProductRacks = new Map<string, StockItem>();
      stockData.forEach((item: StockItem) => {
        const key = `${item.nama_produk}|${item.rak}`;
        if (!uniqueProductRacks.has(key)) {
          uniqueProductRacks.set(key, item);
        }
      });

      setUniqueRacks(rackLocationsData);

      const exclusionMap = new Map<string, boolean>();
      exclusionData.forEach((item: any) => {
        const key = `${item.nama_produk}|${item.rak}`;
        exclusionMap.set(key, item.is_excluded);
      });

      const productRackItems: ProductRackItem[] = [];
      uniqueProductRacks.forEach((item, key) => {
        productRackItems.push({
          id: key,
          nama_produk: item.nama_produk,
          rak: item.rak,
          is_excluded: exclusionMap.get(key) || false
        });
      });

      setProductRacks(productRackItems);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return productRacks.filter(item => {
      const matchSearch = !searchTerm ||
        item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.rak.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRack = !rackFilter || item.rak === rackFilter;

      return matchSearch && matchRack;
    });
  }, [productRacks, searchTerm, rackFilter]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredData.map(item => item.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
    setSelectAll(newSelected.size === filteredData.length && filteredData.length > 0);
  };

  const handleToggleExclusion = async (enable: boolean) => {
    if (selectedItems.size === 0) {
      showToast('Pilih item terlebih dahulu', 'info');
      return;
    }

    try {
      setSaving(true);
      const updates: any[] = [];

      selectedItems.forEach(id => {
        const item = productRacks.find(p => p.id === id);
        if (item) {
          updates.push({
            nama_produk: item.nama_produk,
            rak: item.rak,
            is_excluded: enable
          });
        }
      });

      for (const update of updates) {
        const { error: upsertError } = await supabase
          .from('product_rack_exclusions')
          .upsert({
            nama_produk: update.nama_produk,
            rak: update.rak,
            is_excluded: update.is_excluded
          }, {
            onConflict: 'nama_produk,rak'
          });

        if (upsertError) throw upsertError;
      }

      showToast(
        `Berhasil ${enable ? 'menonaktifkan' : 'mengaktifkan'} ${selectedItems.size} item`,
        'success'
      );

      setSelectedItems(new Set());
      setSelectAll(false);
      await loadData();
    } catch (error) {
      console.error('Error updating exclusions:', error);
      showToast('Gagal menyimpan perubahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="bg-blue-600 text-white p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">PENGATURAN PRIORITAS RAK</h1>
            <p className="text-sm mt-1 opacity-90">
              Pilih produk dan rak yang ingin dinonaktifkan dari auto-select
            </p>
          </div>
          <Button
            onClick={loadData}
            variant="secondary"
            disabled={loading}
            className="bg-white text-blue-600 hover:bg-gray-100"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cari nama produk..."
              />
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              )}
            </div>

            <div className="relative">
              <select
                value={rackFilter}
                onChange={(e) => setRackFilter(e.target.value)}
                className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">Semua Rak</option>
                {uniqueRacks.map(rack => (
                  <option key={rack} value={rack}>{rack}</option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleToggleExclusion(true)}
              disabled={selectedItems.size === 0 || saving}
              variant="danger"
              size="sm"
            >
              Nonaktifkan ({selectedItems.size})
            </Button>
            <Button
              onClick={() => handleToggleExclusion(false)}
              disabled={selectedItems.size === 0 || saving}
              variant="success"
              size="sm"
            >
              Aktifkan ({selectedItems.size})
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Cara Menggunakan:</strong> Centang produk yang ingin diatur, lalu klik tombol "Nonaktifkan"
          untuk menghilangkan rak tersebut dari auto-select, atau "Aktifkan" untuk mengembalikannya.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-center w-16">
                    <button
                      onClick={handleSelectAll}
                      className="text-white hover:text-blue-200"
                    >
                      {selectAll ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Nama Produk</th>
                  <th className="px-4 py-3 text-center">Rak</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`${
                      index % 2 === 0 ? 'bg-white' : 'bg-blue-50'
                    } hover:bg-blue-100 border-b border-gray-200 ${
                      item.is_excluded ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleSelectItem(item.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedItems.has(item.id) ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.nama_produk}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        {item.rak}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_excluded ? (
                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          NONAKTIF
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          AKTIF
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm || rackFilter
                        ? 'Tidak ada data yang sesuai dengan filter'
                        : 'Tidak ada data'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Total Data:</span>
            <span className="ml-2 text-gray-900">{productRacks.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Ditampilkan:</span>
            <span className="ml-2 text-gray-900">{filteredData.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Dipilih:</span>
            <span className="ml-2 text-gray-900">{selectedItems.size}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
