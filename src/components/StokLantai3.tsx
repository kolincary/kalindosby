import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Building, Download, Upload, FileSpreadsheet, History, Package, TrendingDown, Search, Calendar, X, RefreshCw, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Toast } from './ui/Toast';
import { Modal } from './ui/Modal';

interface StokLantai3Item {
  id: string;
  nama_produk: string;
  qty: number;
  satuan: string;
  packing: string;
  rak: string;
  sub_rak: string;
  created_at: string;
  updated_at: string;
}

interface TransaksiLantai3 {
  id: string;
  nama_produk: string;
  qty: number;
  tipe: 'transfer_masuk' | 'pembelian_customer' | 'adjustment';
  gudang: string;
  rak: string;
  sub_rak: string;
  keterangan: string;
  tanggal: string;
  waktu: string;
  user_name: string;
  created_at: string;
}

export function StokLantai3() {
  const [stokData, setStokData] = useState<StokLantai3Item[]>([]);
  const [filteredStok, setFilteredStok] = useState<StokLantai3Item[]>([]);
  const [paginatedStok, setPaginatedStok] = useState<StokLantai3Item[]>([]);
  const [transaksiData, setTransaksiData] = useState<TransaksiLantai3[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showItemHistoryModal, setShowItemHistoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StokLantai3Item | null>(null);
  const [itemHistory, setItemHistory] = useState<TransaksiLantai3[]>([]);
  const [importText, setImportText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; details?: string[] } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState<'ORDER' | 'OUTBOUND' | 'RETUR' | ''>('');
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [activeProducts, setActiveProducts] = useState<Map<string, string>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePackingData, setActivePackingData] = useState<Map<string, string>>(new Map());
  const [filters, setFilters] = useState({
    nama_produk: [] as string[],
    qty: [] as number[],
    satuan: [] as string[],
    packing: [] as string[],
    rak: [] as string[],
    sub_rak: [] as string[],
    status: [] as string[]
  });
  const [showFilterPopup, setShowFilterPopup] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [tempSelectedFilters, setTempSelectedFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  useEffect(() => {
    loadActiveProducts();
    loadActivePackingData();
    loadStokData();
    loadTransaksiData();

    const stokSubscription = supabase
      .channel('stok_lantai3_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stok_lantai3' }, () => {
        if (!isImporting) {
          loadStokData(false);
        }
      })
      .subscribe();

    const transaksiSubscription = supabase
      .channel('transaksi_lantai3_monthly_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi_lantai3_monthly' }, () => {
        if (!isImporting) {
          loadTransaksiData();
        }
      })
      .subscribe();

    return () => {
      stokSubscription.unsubscribe();
      transaksiSubscription.unsubscribe();
    };
  }, [isImporting]);

  useEffect(() => {
    filterStokData();
  }, [searchQuery, stokData, filters]);

  useEffect(() => {
    paginateData();
  }, [filteredStok, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, itemsPerPage]);

  const loadActiveProducts = async () => {
    try {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('sku_code, nama')
          .eq('status', 'Aktif')
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Loaded ${allData.length} active products`);
      const productMap = new Map<string, string>();
      allData.forEach(product => {
        if (product.sku_code && product.nama) {
          productMap.set(product.sku_code, product.nama);
        }
      });
      setActiveProducts(productMap);
    } catch (error) {
      console.error('Error loading active products:', error);
    }
  };

  const loadActivePackingData = async () => {
    try {
      const allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('stock_items')
          .select('nama_produk, packing')
          .not('packing', 'is', null)
          .neq('packing', '')
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Loaded ${allData.length} packing entries from stock_items`);

      const packingMap = new Map<string, string>();
      allData.forEach(item => {
        if (item.nama_produk && item.packing) {
          const currentValue = packingMap.get(item.nama_produk);
          if (!currentValue || item.packing.length > currentValue.length) {
            packingMap.set(item.nama_produk, item.packing);
          }
        }
      });

      console.log(`✅ Deduplicated to ${packingMap.size} unique products with packing data`);
      setActivePackingData(packingMap);
    } catch (error) {
      console.error('Error loading packing data:', error);
    }
  };

  const loadStokData = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      }

      let allData: StokLantai3Item[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await supabase
          .from('stok_lantai3')
          .select('*', { count: 'exact' })
          .order('nama_produk', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;

          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      setStokData(allData);
    } catch (error) {
      console.error('Error loading stok data:', error);
      showToast('Gagal memuat data stok', 'error');
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  const loadTransaksiData = async () => {
    try {
      const { data, error } = await supabase
        .from('transaksi_lantai3_monthly')
        .select('*')
        .order('tahun', { ascending: false })
        .order('bulan', { ascending: false })
        .limit(500);

      if (error) throw error;

      const formattedData = (data || []).map(item => ({
        id: item.id,
        nama_produk: item.nama_produk,
        qty: item.qty_total,
        tipe: item.tipe,
        gudang: item.gudang_list?.join(', ') || '',
        rak: '',
        sub_rak: '',
        keterangan: `${item.keterangan} (${item.transaksi_count} transaksi)`,
        tanggal: item.last_date,
        waktu: '',
        user_name: '',
        created_at: item.created_at
      }));

      setTransaksiData(formattedData);
    } catch (error) {
      console.error('Error loading transaksi data:', error);
    }
  };

  const getStatus = (qty: number): string => {
    if (qty < 0) return 'minus';
    if (qty === 0) return 'habis';
    if (qty < 10) return 'low';
    return 'tersedia';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'minus': 'Minus',
      'habis': 'Habis',
      'low': 'Low',
      'tersedia': 'Tersedia'
    };
    return labels[status] || status;
  };

  const filterStokData = () => {
    let filtered = [...stokData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const namaProduk = (item.nama_produk || '').toLowerCase();
        const rak = (item.rak || '').toLowerCase();
        const subRak = (item.sub_rak || '').toLowerCase();
        return namaProduk.includes(query) || rak.includes(query) || subRak.includes(query);
      });
    }

    if (filters.nama_produk.length > 0) {
      filtered = filtered.filter(item =>
        filters.nama_produk.includes(activeProducts.get(item.nama_produk) || item.nama_produk)
      );
    }

    if (filters.qty.length > 0) {
      filtered = filtered.filter(item => filters.qty.includes(item.qty));
    }

    if (filters.satuan.length > 0) {
      filtered = filtered.filter(item => filters.satuan.includes(item.satuan || ''));
    }

    if (filters.packing.length > 0) {
      filtered = filtered.filter(item => filters.packing.includes(item.packing || ''));
    }

    if (filters.rak.length > 0) {
      filtered = filtered.filter(item => filters.rak.includes(item.rak || ''));
    }

    if (filters.sub_rak.length > 0) {
      filtered = filtered.filter(item => filters.sub_rak.includes(item.sub_rak || ''));
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(item => filters.status.includes(getStatus(item.qty)));
    }

    setFilteredStok(filtered);
  };

  const paginateData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedStok(filteredStok.slice(startIndex, endIndex));
  };

  const totalPages = Math.ceil(filteredStok.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredStok.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const showToast = (message: string, type: 'success' | 'error', details?: string[]) => {
    setToast({ message, type, details });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadActiveProducts(),
      loadActivePackingData(),
      loadStokData(false),
      loadTransaksiData()
    ]);
    setIsRefreshing(false);
    showToast('Data berhasil direfresh', 'success');
  };

  const handleResetFilters = () => {
    setFilters({
      nama_produk: [],
      qty: [],
      satuan: [],
      packing: [],
      rak: [],
      sub_rak: [],
      status: []
    });
    setSearchQuery('');
    showToast('Filter berhasil direset', 'success');
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value.length > 0) || searchQuery !== '';
  };

  const getUniqueValues = (column: string): string[] => {
    const values = new Set<string>();

    if (column === 'nama_produk') {
      const activeProductNames = Array.from(activeProducts.values()).filter(Boolean);
      return activeProductNames.sort();
    }

    if (column === 'packing') {
      const packingFromMap = Array.from(activePackingData.values()).filter(Boolean);
      stokData.forEach(item => {
        if (item.packing) {
          values.add(item.packing);
        }
      });
      packingFromMap.forEach(packing => values.add(packing));
      return Array.from(values).sort();
    }

    stokData.forEach(item => {
      if (column === 'qty') {
        values.add(item.qty.toString());
      } else if (column === 'status') {
        values.add(getStatus(item.qty));
      } else {
        values.add(item[column as keyof StokLantai3Item] as string);
      }
    });

    return Array.from(values).sort();
  };

  const openFilterPopup = (column: string) => {
    setShowFilterPopup(column);
    setFilterSearch('');

    if (column === 'qty') {
      setTempSelectedFilters(filters.qty.map(q => q.toString()));
    } else if (column === 'status') {
      setTempSelectedFilters(filters.status);
    } else {
      setTempSelectedFilters(filters[column as keyof typeof filters] as string[]);
    }
  };

  const closeFilterPopup = () => {
    setShowFilterPopup(null);
    setFilterSearch('');
    setTempSelectedFilters([]);
  };

  const applyFilter = () => {
    if (showFilterPopup) {
      if (showFilterPopup === 'qty') {
        setFilters(prev => ({
          ...prev,
          qty: tempSelectedFilters.map(v => parseInt(v))
        }));
      } else {
        setFilters(prev => ({
          ...prev,
          [showFilterPopup]: tempSelectedFilters
        }));
      }
    }
    closeFilterPopup();
  };

  const toggleFilterValue = (value: string) => {
    setTempSelectedFilters(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const getFilteredOptions = () => {
    if (!showFilterPopup) return [];

    const uniqueValues = getUniqueValues(showFilterPopup);

    if (!filterSearch.trim()) return uniqueValues;

    const query = filterSearch.toLowerCase();
    return uniqueValues.filter(value => {
      if (showFilterPopup === 'status') {
        return getStatusLabel(value).toLowerCase().includes(query);
      }
      return value.toLowerCase().includes(query);
    });
  };

  const getActiveFilterCount = (column: string): number => {
    return filters[column as keyof typeof filters].length;
  };

  const handleShowItemHistory = async (item: StokLantai3Item) => {
    setSelectedItem(item);

    const { data, error } = await supabase
      .from('transaksi_lantai3_monthly')
      .select('*')
      .eq('nama_produk', item.nama_produk)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false });

    if (error) {
      console.error('Error loading item history:', error);
      showToast('Gagal memuat riwayat item', 'error');
      return;
    }

    const formattedData = (data || []).map(monthItem => ({
      id: monthItem.id,
      nama_produk: monthItem.nama_produk,
      qty: monthItem.qty_total,
      tipe: monthItem.tipe,
      gudang: monthItem.gudang_list?.join(', ') || '',
      rak: '',
      sub_rak: '',
      keterangan: `${monthItem.tahun}-${String(monthItem.bulan).padStart(2, '0')} | ${monthItem.keterangan} (${monthItem.transaksi_count} transaksi)`,
      tanggal: monthItem.last_date,
      waktu: '',
      user_name: '',
      created_at: monthItem.created_at
    }));

    setItemHistory(formattedData);
    setShowItemHistoryModal(true);
  };

  const handleImportData = async () => {
    if (!importText.trim()) {
      showToast('Harap masukkan data untuk diimport', 'error');
      return;
    }

    if (!transactionType) {
      showToast('Harap pilih jenis transaksi', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const lines = importText.trim().split('\n');
      const items: { nama_produk: string; qty: number }[] = [];
      const errors: string[] = [];

      lines.forEach((line, index) => {
        const parts = line.split('\t').map(p => p.trim());

        if (parts.length >= 2) {
          let nama_produk = parts[0];
          const qty = parseInt(parts[1]);

          if (!nama_produk) {
            errors.push(`Baris ${index + 1}: Nama produk kosong`);
            return;
          }

          if (isNaN(qty) || qty <= 0) {
            errors.push(`Baris ${index + 1}: Qty tidak valid (${parts[1]})`);
            return;
          }

          items.push({ nama_produk, qty });
        } else {
          errors.push(`Baris ${index + 1}: Format tidak valid`);
        }
      });

      if (errors.length > 0) {
        showToast(`Import gagal: ${errors.length} error ditemukan. Cek console untuk detail.`, 'error');
        console.error('Import errors:', errors);
        setIsImporting(false);
        return;
      }

      if (items.length === 0) {
        showToast('Tidak ada data valid untuk diimport', 'error');
        setIsImporting(false);
        return;
      }

      const typeConfig = {
        'ORDER': { multiplier: -1, tipe: 'pembelian_customer', label: 'Pembelian Customer' },
        'OUTBOUND': { multiplier: -1, tipe: 'pembelian_customer', label: 'Stok Keluar Manual' },
        'RETUR': { multiplier: 1, tipe: 'pembelian_customer', label: 'Retur Customer' }
      };

      const config = typeConfig[transactionType];

      let successCount = 0;
      let errorCount = 0;
      const skippedItems: string[] = [];
      const updatePromises: Promise<any>[] = [];
      const monthlyAggregates: Map<string, { nama_produk: string; qty: number; count: number }> = new Map();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const progress = Math.round(((i + 1) / items.length) * 50);
        setImportProgress(progress);

        const stokItem = stokData.find(s => s.nama_produk === item.nama_produk);

        if (!stokItem) {
          skippedItems.push(item.nama_produk);
          errorCount++;
          continue;
        }

        const newQty = stokItem.qty + (item.qty * config.multiplier);

        updatePromises.push(
          supabase
            .from('stok_lantai3')
            .update({ qty: newQty })
            .eq('id', stokItem.id)
        );

        const key = item.nama_produk;
        const existing = monthlyAggregates.get(key);
        if (existing) {
          existing.qty += item.qty * config.multiplier;
          existing.count += 1;
        } else {
          monthlyAggregates.set(key, {
            nama_produk: item.nama_produk,
            qty: item.qty * config.multiplier,
            count: 1
          });
        }

        successCount++;
      }

      setImportProgress(60);
      await Promise.all(updatePromises);

      setImportProgress(80);
      if (monthlyAggregates.size > 0) {
        const monthlyPromises: Promise<any>[] = [];

        for (const [_, aggregate] of monthlyAggregates) {
          monthlyPromises.push(
            supabase.rpc('add_to_monthly_aggregate', {
              p_nama_produk: aggregate.nama_produk,
              p_tanggal: selectedDate,
              p_tipe: config.tipe,
              p_qty: aggregate.qty,
              p_gudang: 'Lantai 3',
              p_keterangan: `${config.label} (Import Excel) - ${transactionType} - ${aggregate.count} items`
            })
          );
        }

        await Promise.all(monthlyPromises);
      }

      setImportProgress(100);

      if (skippedItems.length > 0) {
        showToast(
          `Import selesai!\n\n✓ ${successCount} produk berhasil diimport\n✗ ${skippedItems.length} produk tidak ditemukan\n\nProduk yang tidak ditemukan mungkin belum ditambahkan ke sistem atau belum disinkronisasi.`,
          successCount > 0 ? 'success' : 'error',
          skippedItems
        );
      } else {
        showToast(`Import berhasil: ${successCount} item diproses`, 'success');
      }

      if (successCount > 0) {
        setImportText('');
        setTransactionType('');
        setShowImportModal(false);
        await loadStokData();
        await loadTransaksiData();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      showToast('Terjadi kesalahan saat import data', 'error');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Nama Produk', 'Qty', 'Satuan', 'Packing', 'Rak', 'Sub Rak'];
    const csvContent = [
      headers.join(','),
      ...filteredStok.map(item => {
        const displayName = activeProducts.get(item.nama_produk) || item.nama_produk;
        const displayPacking = activePackingData.get(item.nama_produk) || item.packing;
        return [displayName, item.qty, item.satuan, displayPacking, item.rak, item.sub_rak]
          .map(val => `"${val}"`)
          .join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stok_lantai3_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalStok = stokData.reduce((sum, item) => sum + item.qty, 0);
  const totalProduk = stokData.length;
  const stokMinus = stokData.filter(item => item.qty < 0).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">STOK LANTAI 3</h1>
              <p className="text-blue-100 mt-2">Manajemen stok transfer dari Lantai 5 dan pembelian customer</p>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Stok</p>
                <p className="text-3xl font-bold text-gray-800">{totalStok.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Produk</p>
                <p className="text-3xl font-bold text-gray-800">{totalProduk.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Stok Minus</p>
                <p className="text-3xl font-bold text-red-600">{stokMinus.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produk, rak, atau lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {hasActiveFilters() && (
                <Button
                  onClick={handleResetFilters}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reset Filter
                </Button>
              )}
              <Button
                onClick={() => setShowImportModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Pembelian
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => setShowHistoryModal(true)}
                variant="secondary"
              >
                <History className="h-4 w-4 mr-2" />
                Riwayat Transaksi
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Memuat data...</p>
            </div>
          ) : filteredStok.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery ? 'Tidak ada data yang sesuai dengan pencarian' : 'Belum ada data stok lantai 3'}
              </p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-between">
                        <span>Nama Produk (Status: Aktif)</span>
                        <button
                          onClick={() => openFilterPopup('nama_produk')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('nama_produk') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('nama_produk') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('nama_produk')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Qty</span>
                        <button
                          onClick={() => openFilterPopup('qty')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('qty') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('qty') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('qty')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Satuan</span>
                        <button
                          onClick={() => openFilterPopup('satuan')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('satuan') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('satuan') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('satuan')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Packing</span>
                        <button
                          onClick={() => openFilterPopup('packing')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('packing') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('packing') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('packing')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Rak</span>
                        <button
                          onClick={() => openFilterPopup('rak')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('rak') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('rak') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('rak')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Sub Rak</span>
                        <button
                          onClick={() => openFilterPopup('sub_rak')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('sub_rak') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('sub_rak') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('sub_rak')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center">
                        <span>Status</span>
                        <button
                          onClick={() => openFilterPopup('status')}
                          className={`ml-2 p-1 rounded hover:bg-gray-200 relative ${
                            getActiveFilterCount('status') > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        >
                          <Filter className="h-4 w-4" />
                          {getActiveFilterCount('status') > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {getActiveFilterCount('status')}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedStok.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {activeProducts.get(item.nama_produk) || item.nama_produk}
                      </td>
                      <td className={`px-4 py-3 text-sm text-center font-semibold ${item.qty < 0 ? 'text-red-600' : item.qty === 0 ? 'text-gray-500' : 'text-green-600'}`}>
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.satuan}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{activePackingData.get(item.nama_produk) || item.packing}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.rak}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.sub_rak}</td>
                      <td className="px-4 py-3 text-center">
                        {item.qty < 0 ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Minus</span>
                        ) : item.qty === 0 ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Habis</span>
                        ) : item.qty < 10 ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Low</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Tersedia</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          onClick={() => handleShowItemHistory(item)}
                          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <History className="h-3 w-3 mr-1 inline" />
                          Riwayat
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStok.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-600">
                    Menampilkan <span className="font-semibold">{startItem}</span> - <span className="font-semibold">{endItem}</span> dari <span className="font-semibold">{filteredStok.length}</span> data
                  </p>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                    <option value={filteredStok.length}>Tampilkan Semua</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="secondary"
                      className="px-3 py-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers().map((page, index) => (
                      typeof page === 'number' ? (
                        <Button
                          key={index}
                          onClick={() => handlePageChange(page)}
                          variant={currentPage === page ? 'default' : 'secondary'}
                          className={`px-4 py-2 ${
                            currentPage === page
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : ''
                          }`}
                        >
                          {page}
                        </Button>
                      ) : (
                        <span key={index} className="px-2 text-gray-500">...</span>
                      )
                    ))}

                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="secondary"
                      className="px-3 py-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Pembelian Customer"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Cara Import:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Pilih jenis transaksi terlebih dahulu</li>
              <li>Copy data dari Excel dengan format: Kolom A (Nama Produk), Kolom B (Qty)</li>
              <li>Paste data ke textarea di bawah</li>
              <li>Pastikan nama produk sama persis dengan nama di tabel Stok Lantai 3</li>
              <li>Semua produk aktif sudah tersedia di Stok Lantai 3 meskipun belum pernah ditransfer</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jenis Transaksi <span className="text-red-500">*</span>
            </label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as 'ORDER' | 'OUTBOUND' | 'RETUR' | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Pilih Jenis Transaksi --</option>
              <option value="ORDER">ORDER - Pembelian Customer (Stok Keluar)</option>
              <option value="OUTBOUND">OUTBOUND - Keluar Manual / Sample / Non-Bon (Stok Keluar)</option>
              <option value="RETUR">RETUR - Retur dari Customer (Stok Masuk)</option>
            </select>
            {transactionType && (
              <p className="mt-2 text-sm text-gray-600">
                {transactionType === 'ORDER' && '📦 Stok akan berkurang (pembelian customer dari marketplace)'}
                {transactionType === 'OUTBOUND' && '📤 Stok akan berkurang (sample kantor / non-bon / keperluan lain)'}
                {transactionType === 'RETUR' && '📥 Stok akan bertambah (retur dari customer yang ditolak/dikembalikan)'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Excel (Paste di sini)
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste data dari Excel di sini...&#10;Contoh:&#10;Produk A&#9;100&#10;Produk B&#9;50"
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
          </div>

          {isImporting && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Memproses Import...</span>
                  <span className="text-sm font-semibold text-blue-900">{importProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 ease-out flex items-center justify-end"
                    style={{ width: `${importProgress}%` }}
                  >
                    <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">Mohon tunggu, sedang menyimpan data ke database...</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowImportModal(false)}
              variant="secondary"
              disabled={isImporting}
            >
              Batal
            </Button>
            <Button
              onClick={handleImportData}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showItemHistoryModal}
        onClose={() => setShowItemHistoryModal(false)}
        title={`Riwayat Transaksi: ${selectedItem?.nama_produk || ''}`}
      >
        <div className="space-y-4">
          {selectedItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Nama Produk</p>
                  <p className="text-sm font-bold text-blue-900">
                    {activeProducts.get(selectedItem.nama_produk) || selectedItem.nama_produk}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Stok Saat Ini</p>
                  <p className={`text-sm font-bold ${selectedItem.qty < 0 ? 'text-red-600' : selectedItem.qty === 0 ? 'text-gray-600' : 'text-green-600'}`}>
                    {selectedItem.qty.toLocaleString()} {selectedItem.satuan}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Lokasi</p>
                  <p className="text-sm font-bold text-blue-900">{selectedItem.rak} - {selectedItem.sub_rak}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Packing</p>
                  <p className="text-sm font-bold text-blue-900">{activePackingData.get(selectedItem.nama_produk) || selectedItem.packing}</p>
                </div>
              </div>
            </div>
          )}

          {itemHistory.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada riwayat transaksi untuk item ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {itemHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-900">
                        {new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}
                      </td>
                      <td className={`px-3 py-2 text-center font-bold text-sm ${item.qty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {item.tipe === 'transfer_masuk' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Transfer Masuk</span>
                        )}
                        {item.tipe === 'pembelian_customer' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Pembelian</span>
                        )}
                        {item.tipe === 'adjustment' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Adjustment</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{item.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-500">Total {itemHistory.length} transaksi</p>
            <Button
              onClick={() => setShowItemHistoryModal(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Riwayat Transaksi Lantai 3"
      >
        <div className="space-y-4">
          {transaksiData.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Belum ada riwayat transaksi</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transaksiData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">
                        {new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-3 py-2 text-gray-900">{item.nama_produk}</td>
                      <td className={`px-3 py-2 text-center font-semibold ${item.qty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {item.tipe === 'transfer_masuk' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Transfer Masuk</span>
                        )}
                        {item.tipe === 'pembelian_customer' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Pembelian</span>
                        )}
                        {item.tipe === 'adjustment' && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Adjustment</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{item.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {showFilterPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeFilterPopup}>
          <div className="bg-white rounded-lg shadow-xl w-96 max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Filter {showFilterPopup === 'nama_produk' ? 'Nama Produk' :
                         showFilterPopup === 'qty' ? 'Qty' :
                         showFilterPopup === 'satuan' ? 'Satuan' :
                         showFilterPopup === 'packing' ? 'Packing' :
                         showFilterPopup === 'rak' ? 'Rak' :
                         showFilterPopup === 'sub_rak' ? 'Sub Rak' : 'Status'}
                </h3>
                <button onClick={closeFilterPopup} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {getFilteredOptions().length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Tidak ada data</p>
                ) : (
                  getFilteredOptions().map((value) => (
                    <label
                      key={value}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={tempSelectedFilters.includes(value)}
                        onChange={() => toggleFilterValue(value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {showFilterPopup === 'status' ? getStatusLabel(value) : value}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setTempSelectedFilters([])}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <div className="flex space-x-2">
                <Button onClick={closeFilterPopup} variant="secondary">
                  Batal
                </Button>
                <Button onClick={applyFilter} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Terapkan ({tempSelectedFilters.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          details={toast.details}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
