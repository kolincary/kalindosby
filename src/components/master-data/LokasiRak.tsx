import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Toast } from '../ui/Toast';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  MapPin, 
  Search, 
  X, 
  CheckSquare, 
  Square, 
  AlertTriangle,
  RefreshCw,
  Filter,
  Layers,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDatabaseConfig } from '../../lib/DatabaseContext';
import { DatabaseService } from '../../lib/DatabaseService';
import { cn } from '../../lib/utils';

interface RackLocation {
  id: string;
  nama: string;
  warehouse_id?: string;
  tampil_di_menu: 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA';
  status: 'Aktif' | 'Tidak Aktif';
  created_at: string;
  updated_at: string;
  auto_fill_scanner?: boolean;
}

export function LokasiRak() {
  const { writeMode } = useDatabaseConfig();
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuFilter, setMenuFilter] = useState<'ALL' | 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Aktif' | 'Tidak Aktif'>('ALL');
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    tampil_di_menu: 'KEDUANYA' as 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA',
    status: 'Aktif' as 'Aktif' | 'Tidak Aktif'
  });

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  };

  useEffect(() => {
    loadRackLocations();
  }, []);

  const loadRackLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rack_locations')
        .select('*')
        .order('nama', { ascending: true });

      if (error) {
        console.error('Error loading rack locations:', error);
        showToast('Gagal memuat data lokasi rak', 'error');
        return;
      }

      setRackLocations(data || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error loading rack locations:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultMenuDisplay = (namaRak: string): 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA' => {
    const upperName = namaRak.toUpperCase();
    const inputMasukKeluar = ['UTAMA', 'ECER-M', 'ECER-N', 'ECER-O', 'BLOK-I', 'LANTAI 4', 'LANTAI 2'];

    if (inputMasukKeluar.includes(upperName)) {
      return 'KEDUANYA';
    }

    return 'INPUT_KELUAR';
  };

  const handleNamaChange = (nama: string) => {
    if (!editingId) {
      const defaultMenuDisplay = getDefaultMenuDisplay(nama);
      setFormData({
        ...formData,
        nama,
        tampil_di_menu: defaultMenuDisplay
      });
    } else {
      setFormData({
        ...formData,
        nama
      });
    }
  };

  const resetForm = () => {
    setFormData({ nama: '', tampil_di_menu: 'KEDUANYA', status: 'Aktif' });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (location: RackLocation) => {
    setFormData({
      nama: location.nama,
      tampil_di_menu: location.tampil_di_menu || 'KEDUANYA',
      status: location.status
    });
    setEditingId(location.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await DatabaseService.updateMasterData('rack_locations', editingId, {
          nama: formData.nama.trim().toUpperCase(),
          tampil_di_menu: formData.tampil_di_menu,
          status: formData.status
        }, writeMode);

        if (error) {
          console.error('Error updating rack location:', error);
          showToast('Gagal mengupdate lokasi rak', 'error');
          return;
        }

        showToast('Lokasi rak berhasil diupdate!', 'success');
      } else {
        const { error } = await DatabaseService.insertMasterData('rack_locations', [{
          nama: formData.nama.trim().toUpperCase(),
          tampil_di_menu: formData.tampil_di_menu,
          status: formData.status
        }], writeMode);

        if (error) {
          console.error('Error adding rack location:', error);
          showToast('Gagal menambah lokasi rak', 'error');
          return;
        }

        showToast('Lokasi rak berhasil ditambahkan!', 'success');
      }

      resetForm();
      loadRackLocations();
    } catch (error) {
      console.error('Error submitting rack location:', error);
      showToast('Terjadi kesalahan saat menyimpan data', 'error');
    }
  };

  // Single delete
  const handleDelete = async (id: string, nama: string) => {
    if (nama.toUpperCase() === 'UTAMA') {
      if (!confirm(`Rak "UTAMA" adalah rak master default. Apakah Anda benar-benar yakin ingin menghapusnya?`)) {
        return;
      }
    } else {
      if (!confirm(`Apakah Anda yakin ingin menghapus lokasi rak "${nama}"?`)) {
        return;
      }
    }

    try {
      const { error } = await DatabaseService.deleteMasterData('rack_locations', id, writeMode);

      if (error) {
        console.error('Error deleting rack location:', error);
        showToast('Gagal menghapus lokasi rak', 'error');
        return;
      }

      showToast(`Lokasi rak "${nama}" berhasil dihapus!`, 'success');
      setSelectedIds(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      loadRackLocations();
    } catch (error) {
      console.error('Error deleting rack location:', error);
      showToast('Terjadi kesalahan saat menghapus data', 'error');
    }
  };

  // Filtered data
  const filteredRacks = useMemo(() => {
    return rackLocations.filter(loc => {
      const matchSearch = !searchTerm || 
        loc.nama.toLowerCase().includes(searchTerm.toLowerCase().trim());
      
      const matchMenu = menuFilter === 'ALL' || loc.tampil_di_menu === menuFilter;
      const matchStatus = statusFilter === 'ALL' || loc.status === statusFilter;

      return matchSearch && matchMenu && matchStatus;
    });
  }, [rackLocations, searchTerm, menuFilter, statusFilter]);

  // Selection handlers
  const isAllSelected = filteredRacks.length > 0 && filteredRacks.every(loc => selectedIds.has(loc.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRacks.map(loc => loc.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  // Bulk Delete Selected
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      showToast('Pilih lokasi rak yang ingin dihapus terlebih dahulu', 'warning');
      return;
    }

    const count = selectedIds.size;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${count} lokasi rak yang dipilih?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const idsToDelete = Array.from(selectedIds);
      const { error } = await DatabaseService.deleteBatchMasterData('rack_locations', idsToDelete, writeMode);

      if (error) {
        console.error('Bulk delete error:', error);
        showToast('Gagal menghapus beberapa data lokasi rak', 'error');
        return;
      }

      showToast(`Berhasil menghapus ${count} lokasi rak terpilih!`, 'success');
      setSelectedIds(new Set());
      loadRackLocations();
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast('Terjadi kesalahan saat menghapus massal', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete All Except UTAMA
  const handleDeleteAllExceptUtama = async () => {
    const nonUtamaRacks = rackLocations.filter(loc => loc.nama.trim().toUpperCase() !== 'UTAMA');
    if (nonUtamaRacks.length === 0) {
      showToast('Hanya ada rak UTAMA di database. Tidak ada rak lain yang perlu dibersihkan.', 'info');
      return;
    }

    if (!confirm(`⚠️ PERINGATAN: Tindakan ini akan menghapus ${nonUtamaRacks.length} lokasi rak dan HANYA MENYISAKAN rak "UTAMA". Lanjutkan?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const idsToDelete = nonUtamaRacks.map(loc => loc.id);
      const { error } = await DatabaseService.deleteBatchMasterData('rack_locations', idsToDelete, writeMode);

      if (error) {
        console.error('Error deleting non-utama racks:', error);
        showToast('Gagal membersihkan lokasi rak', 'error');
        return;
      }

      showToast(`Berhasil membersihkan ${nonUtamaRacks.length} lokasi rak! Hanya rak UTAMA yang tersisa.`, 'success');
      setSelectedIds(new Set());
      loadRackLocations();
    } catch (err) {
      console.error('Error cleaning racks:', err);
      showToast('Terjadi kesalahan saat membersihkan lokasi rak', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
      />

      <div className="space-y-6">
        {/* PREMIUM IMMERSIVE HEADER */}
        <div className="flex flex-col mb-8 lg:mb-12 uppercase">
          <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 pt-[90px] lg:pt-0 lg:h-[310px] pb-[75px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-blue-900/40 relative overflow-hidden transition-all duration-500 flex flex-col justify-center">
            <div className="absolute -top-12 -right-12 text-white opacity-5">
              <MapPin className="w-72 h-72 lg:w-[480px] lg:h-[480px]" />
            </div>
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-indigo-500/10 rounded-3xl rotate-45 blur-2xl"></div>
            
            <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 uppercase text-left">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3 lg:mb-4 opacity-90">
                  <div className="w-10 h-[2px] bg-blue-400 rounded-full"></div>
                  <span className="text-[10px] lg:text-[12px] font-black tracking-[0.4em] text-blue-100">Master Data Management</span>
                </div>
                <h1 className="text-[34px] lg:text-[54px] font-black text-white tracking-tighter leading-[0.9] mb-3 uppercase">
                  Lokasi <span className="text-blue-400">Rak</span>
                </h1>
                <div className="text-blue-100/80 font-medium text-[14px] lg:text-[18px] leading-relaxed max-w-[90%] normal-case flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-bold tracking-widest uppercase">{rackLocations.length} Lokasi Rak</span>
                  </div>
                  <span className="text-[13px] lg:text-[16px]">Kelola dan atur master lokasi rak gudang</span>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="relative z-10 flex flex-wrap gap-2 lg:gap-3 lg:mb-2 items-center">
                <Button
                  onClick={loadRackLocations}
                  disabled={loading}
                  className="h-11 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  <span className="text-xs uppercase tracking-wider">Sync Data</span>
                </Button>

                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="h-11 px-5 bg-white hover:bg-blue-50 text-blue-700 font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 border-none"
                >
                  <Plus className="h-4 w-4" />
                  <span className="uppercase text-xs font-black">Tambah Lokasi Rak</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN BODY CONTAINER */}
        <div className="px-4 sm:px-6 lg:px-12 space-y-6">

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Lokasi</p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{rackLocations.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Rak Aktif</p>
                <p className="text-2xl font-black text-emerald-600 mt-0.5">{rackLocations.filter(l => l.status === 'Aktif').length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Nonaktif</p>
                <p className="text-2xl font-black text-rose-600 mt-0.5">{rackLocations.filter(l => l.status === 'Tidak Aktif').length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Item Terpilih</p>
                <p className="text-2xl font-black text-indigo-600 mt-0.5">{selectedIds.size}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CheckSquare className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Add/Edit Form Card */}
          {isFormOpen && (
            <Card className="border-blue-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base">
                    {editingId ? 'Edit Lokasi Rak' : 'Tambah Lokasi Rak Baru'}
                  </h3>
                  <button onClick={resetForm} className="text-white/80 hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Lokasi Rak
                    </label>
                    <input
                      type="text"
                      value={formData.nama}
                      onChange={(e) => handleNamaChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      placeholder="Contoh: UTAMA, A1, ECER-M"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tampil di Menu
                    </label>
                    <select
                      value={formData.tampil_di_menu}
                      onChange={(e) => setFormData({ ...formData, tampil_di_menu: e.target.value as 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA' })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="KEDUANYA">Input Masuk & Keluar</option>
                      <option value="INPUT_MASUK">Hanya Input Masuk</option>
                      <option value="INPUT_KELUAR">Hanya Input Keluar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Status Rak
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Aktif' | 'Tidak Aktif' })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      onClick={resetForm}
                      className="px-5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      className="px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                    >
                      {editingId ? 'Update Lokasi Rak' : 'Simpan Lokasi Rak'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Search, Filter, and Bulk Action Toolbar */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm space-y-4">
            
            {/* Top Row: Search & Filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  placeholder="Cari nama lokasi rak..."
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

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="Aktif">Aktif Saja</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>

                <select
                  value={menuFilter}
                  onChange={(e) => setMenuFilter(e.target.value as any)}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ALL">Semua Menu</option>
                  <option value="KEDUANYA">Masuk & Keluar</option>
                  <option value="INPUT_MASUK">Hanya Masuk</option>
                  <option value="INPUT_KELUAR">Hanya Keluar</option>
                </select>
              </div>
            </div>

            {/* Bottom Row: Selection Actions & Bulk Delete */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  {isAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                  <span>{isAllSelected ? 'Batalkan Semua' : `Pilih Semua (${filteredRacks.length})`}</span>
                </button>

                {selectedIds.size > 0 && (
                  <span className="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg">
                    {selectedIds.size} dipilih
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Bulk Delete Button */}
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>HAPUS TERPILIH ({selectedIds.size})</span>
                  </Button>
                )}

                {/* Clean All Non-UTAMA */}
                {rackLocations.some(l => l.nama.toUpperCase() !== 'UTAMA') && (
                  <Button
                    onClick={handleDeleteAllExceptUtama}
                    disabled={isDeleting}
                    className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>SISAKAN HANYA RAK UTAMA</span>
                  </Button>
                )}
              </div>
            </div>

          </div>

          {/* Table Card */}
          <Card className="border border-slate-200/80 shadow-sm overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-slate-400 gap-3 font-semibold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Memuat data lokasi rak...</span>
                </div>
              ) : filteredRacks.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-slate-600 text-base">Tidak ada lokasi rak ditemukan</p>
                  <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter Anda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="w-12 py-3.5 px-4 text-center">
                          <button
                            onClick={handleSelectAll}
                            className="text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center justify-center"
                          >
                            {isAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                          </button>
                        </th>
                        <th className="py-3.5 px-4">Nama Lokasi Rak</th>
                        <th className="py-3.5 px-4 text-center">Tampil di Menu</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-center">Tanggal Dibuat</th>
                        <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredRacks.map((location) => {
                        const isSelected = selectedIds.has(location.id);
                        const isUtama = location.nama.trim().toUpperCase() === 'UTAMA';

                        return (
                          <tr 
                            key={location.id} 
                            className={cn(
                              "hover:bg-blue-50/50 transition-colors",
                              isSelected && "bg-blue-50/70"
                            )}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleToggleSelect(location.id)}
                                className="text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center justify-center"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300" />
                                )}
                              </button>
                            </td>

                            {/* Nama Rak */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-black tracking-tight text-slate-800",
                                  isUtama && "text-blue-700 font-black text-base"
                                )}>
                                  {location.nama}
                                </span>
                                {isUtama && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase">
                                    Master Default
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Tampil di Menu */}
                            <td className="py-3 px-4 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold",
                                location.tampil_di_menu === 'KEDUANYA' 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                  : location.tampil_di_menu === 'INPUT_MASUK'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              )}>
                                {location.tampil_di_menu === 'KEDUANYA' ? 'Masuk & Keluar' :
                                  location.tampil_di_menu === 'INPUT_MASUK' ? 'Input Masuk' : 'Input Keluar'}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider",
                                location.status === 'Aktif'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              )}>
                                {location.status}
                              </span>
                            </td>

                            {/* Tanggal */}
                            <td className="py-3 px-4 text-center text-xs text-slate-500 font-medium">
                              {location.created_at ? new Date(location.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : '-'}
                            </td>

                            {/* Aksi */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEdit(location)}
                                  className="h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors border border-blue-200/50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(location.id, location.nama)}
                                  className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors border border-rose-200/50"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}