import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { Toast } from './ui/Toast';
import { 
  Search, 
  X, 
  RefreshCw, 
  Filter, 
  CheckSquare, 
  Square, 
  SlidersHorizontal, 
  Ban, 
  CheckCircle2, 
  Layers, 
  Package, 
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useDatabaseConfig } from '../lib/DatabaseContext';
import { DatabaseService } from '../lib/DatabaseService';

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
  const { readMode, writeMode } = useDatabaseConfig();
  const [productRacks, setProductRacks] = useState<ProductRackItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rackFilter, setRackFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'excluded'>('all');
  const [uniqueRacks, setUniqueRacks] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [stockResult, exclusionData, rackLocationsData] = await Promise.all([
        DatabaseService.fetchAllStockItems(readMode).catch(() => ({ data: [], count: 0 })),
        DatabaseService.fetchProductRackExclusions(readMode).catch(() => []),
        DatabaseService.fetchActiveRacks(readMode).catch(() => [])
      ]);

      const stockData = stockResult?.data || [];
      const uniqueProductRacks = new Map<string, StockItem>();
      stockData.forEach((item: any) => {
        if (!item.nama_produk || !item.rak) return;
        const key = `${item.nama_produk.trim()}|${item.rak.trim()}`;
        if (!uniqueProductRacks.has(key)) {
          uniqueProductRacks.set(key, {
            nama_produk: item.nama_produk.trim(),
            rak: item.rak.trim()
          });
        }
      });

      // Extract unique racks
      const rackSet = new Set<string>();
      (rackLocationsData || []).forEach((r: any) => {
        if (r.nama && r.nama.trim()) rackSet.add(r.nama.trim());
      });
      stockData.forEach((item: any) => {
        if (item.rak && item.rak.trim()) {
          rackSet.add(item.rak.trim());
        }
      });
      setUniqueRacks(Array.from(rackSet).sort());

      const exclusionMap = new Map<string, boolean>();
      (exclusionData || []).forEach((item: any) => {
        if (!item.nama_produk || !item.rak) return;
        const key = `${item.nama_produk.trim()}|${item.rak.trim()}`;
        exclusionMap.set(key, item.is_excluded === true);
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
      showToast('Gagal memuat data prioritas rak', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [readMode]);

  const filteredData = useMemo(() => {
    return productRacks.filter(item => {
      const matchSearch = !searchTerm ||
        item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.rak.toLowerCase().includes(searchTerm.toLowerCase().trim());

      const matchRack = !rackFilter || item.rak.toLowerCase() === rackFilter.toLowerCase();

      const matchStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? !item.is_excluded :
        item.is_excluded;

      return matchSearch && matchRack && matchStatus;
    });
  }, [productRacks, searchTerm, rackFilter, statusFilter]);

  // Pagination slice
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    if (itemsPerPage === -1) return filteredData;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages]);

  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedData.length === 0) return false;
    return paginatedData.every(item => selectedItems.has(item.id));
  }, [paginatedData, selectedItems]);

  const handleSelectAllCurrentPage = () => {
    const newSelected = new Set(selectedItems);
    if (isAllCurrentPageSelected) {
      paginatedData.forEach(item => newSelected.delete(item.id));
    } else {
      paginatedData.forEach(item => newSelected.add(item.id));
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAllFiltered = () => {
    if (selectedItems.size === filteredData.length && filteredData.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredData.map(item => item.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  // Toggle single item exclusion inline
  const handleSingleToggle = async (item: ProductRackItem) => {
    try {
      setTogglingId(item.id);
      const newStatus = !item.is_excluded;

      await DatabaseService.upsertProductRackExclusions([{
        nama_produk: item.nama_produk,
        rak: item.rak,
        is_excluded: newStatus
      }], writeMode);

      setProductRacks(prev => prev.map(p => 
        p.id === item.id ? { ...p, is_excluded: newStatus } : p
      ));

      showToast(
        `${item.nama_produk} @ ${item.rak} berhasil ${newStatus ? 'dinonaktifkan' : 'diaktifkan'}`,
        'success'
      );
    } catch (err) {
      console.error('Error toggling exclusion:', err);
      showToast('Gagal mengubah status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleExclusion = async (exclude: boolean) => {
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
            is_excluded: exclude
          });
        }
      });

      await DatabaseService.upsertProductRackExclusions(updates, writeMode);

      showToast(
        `Berhasil ${exclude ? 'menonaktifkan' : 'mengaktifkan'} ${selectedItems.size} item`,
        'success'
      );

      // Update local state directly for instantaneous UI feedback
      const updatedSet = new Set(selectedItems);
      setProductRacks(prev => prev.map(p => 
        updatedSet.has(p.id) ? { ...p, is_excluded: exclude } : p
      ));

      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error updating exclusions:', error);
      showToast('Gagal menyimpan perubahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Stats calculation
  const totalCount = productRacks.length;
  const activeCount = useMemo(() => productRacks.filter(p => !p.is_excluded).length, [productRacks]);
  const excludedCount = useMemo(() => productRacks.filter(p => p.is_excluded).length, [productRacks]);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ======================================================== */}
      {/* PREMIUM RESPONSIVE HEADER (Identical to Input Barang Keluar) */}
      {/* ======================================================== */}
      <div className="flex flex-col mb-8 lg:mb-12">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 pt-[80px] lg:pt-0 lg:h-[310px] pb-[40px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-blue-900/20 relative overflow-hidden transition-all duration-500 flex flex-col justify-center">

          {/* Decorative Background Icon */}
          <div className="absolute -top-6 -right-6 text-white opacity-5 pointer-events-none">
            <SlidersHorizontal className="w-64 h-64 lg:w-96 lg:h-96" />
          </div>

          {/* Decorative Floating Shapes */}
          <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-24 left-1/4 w-16 h-16 bg-white/5 border border-white/10 rounded-2xl rotate-[35deg] backdrop-blur-sm hidden lg:block"></div>
          <div className="absolute bottom-10 right-1/3 w-12 h-12 bg-white/10 rounded-full border border-white/20 hidden lg:block"></div>
          <div className="absolute top-1/2 right-20 w-16 h-16 bg-blue-400/20 rounded-3xl -rotate-12 blur-xl hidden lg:block"></div>

          {/* Text Content */}
          <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 uppercase">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2 lg:mb-3 opacity-90">
                <div className="w-8 h-[2px] bg-white rounded-full"></div>
                <span className="text-[10px] lg:text-[12px] font-black tracking-[0.3em] text-white">Logistics V5</span>
              </div>
              <h1 className="text-[30px] lg:text-[50px] font-black text-white tracking-tight leading-[1.1] mb-2 uppercase">
                Prioritas <span className="text-blue-200">Rak</span>
              </h1>
              <div className="text-blue-100/90 font-medium text-[13px] lg:text-[16px] leading-relaxed max-w-[95%] normal-case">
                {loading ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memuat konfigurasi prioritas rak...
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="font-black text-white">Digital System</span> - Konfigurasi Pengecualian Auto-Select Rak
                  </div>
                )}
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
              <Button
                onClick={loadData}
                disabled={loading}
                className="h-11 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 font-bold shadow-lg"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="text-[11px] uppercase tracking-wider">SYNC DATA</span>
              </Button>

              <Button
                onClick={() => handleToggleExclusion(true)}
                disabled={selectedItems.size === 0 || saving}
                className="h-11 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 border-0 disabled:opacity-40"
              >
                <Ban className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                  NONAKTIFKAN ({selectedItems.size})
                </span>
              </Button>

              <Button
                onClick={() => handleToggleExclusion(false)}
                disabled={selectedItems.size === 0 || saving}
                className="h-11 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 border-0 disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                  AKTIFKAN ({selectedItems.size})
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <div className="space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-12 pb-16">

        {/* 1. Quick Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Item</p>
                <p className="text-2xl lg:text-3xl font-black text-slate-800 mt-1">{totalCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Kombinasi SKU & Rak di Gudang</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Rak Aktif</p>
                <p className="text-2xl lg:text-3xl font-black text-emerald-600 mt-1">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Masuk dalam pemilihan otomatis</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Dinonaktifkan</p>
                <p className="text-2xl lg:text-3xl font-black text-rose-600 mt-1">{excludedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Dikecualikan dari auto-select</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Item Terpilih</p>
                <p className="text-2xl lg:text-3xl font-black text-indigo-600 mt-1">{selectedItems.size}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <CheckSquare className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Siap untuk aksi massal</p>
          </div>
        </div>

        {/* 2. Info Guide Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-100 rounded-2xl p-4 lg:p-5 flex items-start gap-3.5 shadow-sm">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">Petunjuk Penggunaan Prioritas Rak:</p>
            <p className="text-slate-600 leading-relaxed">
              Centang item yang ingin diatur lalu gunakan tombol <span className="font-bold text-rose-600">"Nonaktifkan"</span> untuk mengecualikan rak tersebut dari rekomendasi auto-select, atau <span className="font-bold text-emerald-600">"Aktifkan"</span> untuk mengikutsertakan kembali. Anda juga dapat mengklik tombol status di setiap baris tabel secara langsung.
            </p>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="Cari nama produk / kode SKU / nama rak..."
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Rack Filter Dropdown */}
            <div className="relative min-w-[180px]">
              <select
                value={rackFilter}
                onChange={(e) => {
                  setRackFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none focus:bg-white cursor-pointer transition-all"
              >
                <option value="">Semua Lokasi Rak ({uniqueRacks.length})</option>
                {uniqueRacks.map(rack => (
                  <option key={rack} value={rack}>{rack}</option>
                ))}
              </select>
              <Filter className="absolute right-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                className={cn(
                  "px-3.5 py-2 text-xs font-bold rounded-lg transition-all",
                  statusFilter === 'all' 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Semua ({productRacks.length})
              </button>
              <button
                onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
                className={cn(
                  "px-3.5 py-2 text-xs font-bold rounded-lg transition-all",
                  statusFilter === 'active' 
                    ? "bg-emerald-500 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Aktif ({activeCount})
              </button>
              <button
                onClick={() => { setStatusFilter('excluded'); setCurrentPage(1); }}
                className={cn(
                  "px-3.5 py-2 text-xs font-bold rounded-lg transition-all",
                  statusFilter === 'excluded' 
                    ? "bg-rose-500 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Nonaktif ({excludedCount})
              </button>
            </div>
          </div>

          {/* Quick Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAllCurrentPage}
                className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
              >
                {isAllCurrentPageSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span>{isAllCurrentPageSelected ? 'Batal Pilih Halaman Ini' : 'Pilih Semua di Halaman Ini'}</span>
              </button>

              <span className="text-slate-300">|</span>

              <button
                onClick={handleSelectAllFiltered}
                className="font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                {selectedItems.size === filteredData.length && filteredData.length > 0
                  ? 'Batal Pilih Semua Filter'
                  : `Pilih Semua Hasil Filter (${filteredData.length})`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>Tampilkan:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
                <option value={200}>200 baris</option>
                <option value={-1}>Semua Data</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Main Table Card */}
        <Card className="rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white text-[12px] uppercase tracking-wider font-extrabold select-none">
                    <th className="py-4 px-4 sm:px-6 w-14 text-center">
                      <button
                        onClick={handleSelectAllCurrentPage}
                        className="text-white hover:text-blue-200 transition-colors"
                        title="Pilih Semua Halaman Ini"
                      >
                        {isAllCurrentPageSelected ? (
                          <CheckSquare className="h-5 w-5 mx-auto" />
                        ) : (
                          <Square className="h-5 w-5 mx-auto text-white/70" />
                        )}
                      </button>
                    </th>
                    <th className="py-4 px-4 text-left">Nama Produk (SKU)</th>
                    <th className="py-4 px-4 text-center w-36">Lokasi Rak</th>
                    <th className="py-4 px-4 text-center w-36">Status Auto-Select</th>
                    <th className="py-4 px-4 text-center w-36">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-600">Memuat data prioritas rak...</p>
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Package className="w-8 h-8" />
                        </div>
                        <p className="text-base font-bold text-slate-700">Tidak ada data yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter yang dipilih</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => {
                      const isSelected = selectedItems.has(item.id);
                      const isToggling = togglingId === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "transition-all hover:bg-blue-50/60 duration-150",
                            isSelected && "bg-blue-50/80",
                            item.is_excluded && "bg-slate-50/70 opacity-80"
                          )}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-4 sm:px-6 text-center">
                            <button
                              onClick={() => handleSelectItem(item.id)}
                              className={cn(
                                "p-1 rounded-lg transition-colors",
                                isSelected ? "text-blue-600" : "text-slate-300 hover:text-slate-500"
                              )}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                          </td>

                          {/* Product Name */}
                          <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                item.is_excluded ? "bg-rose-400" : "bg-emerald-400"
                              )} />
                              <span className="select-all">{item.nama_produk}</span>
                            </div>
                          </td>

                          {/* Rak Location Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full font-bold text-xs shadow-sm">
                              {item.rak}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            {item.is_excluded ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-bold tracking-wide">
                                <Ban className="w-3.5 h-3.5 text-rose-500" />
                                NONAKTIF
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold tracking-wide">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                AKTIF
                              </span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleSingleToggle(item)}
                              disabled={isToggling}
                              className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm border",
                                item.is_excluded
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20"
                                  : "bg-white hover:bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-300"
                              )}
                            >
                              {isToggling ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" />
                              ) : item.is_excluded ? (
                                'Aktifkan'
                              ) : (
                                'Nonaktifkan'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {itemsPerPage !== -1 && filteredData.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
                <div>
                  Menampilkan <span className="font-bold text-slate-800">{Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}</span> - <span className="font-bold text-slate-800">{Math.min(filteredData.length, currentPage * itemsPerPage)}</span> dari <span className="font-bold text-slate-800">{filteredData.length}</span> data
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Sebelumnya
                  </Button>

                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-3 text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40"
                  >
                    Selanjutnya
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
export default RackPrioritySettings;
