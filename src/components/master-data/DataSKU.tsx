import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Toast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Upload,
  Download,
  PlusCircle,
  Save,
  RefreshCcw,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase, fetchAllProducts } from '../../lib/supabase';
import { queryOptimizer } from '../../lib/queryOptimizer';

interface SKU {
  id: string;
  id_barang: string;
  nama: string;
  satuan: string;
  status: 'Aktif' | 'Tidak Aktif';
  created_at: string;
  updated_at: string;
}

interface ImportProgress {
  isImporting: boolean;
  progress: number;
  total: number;
  current: number;
  message: string;
}

interface MassUpdateRow {
  id: number;
  old_sku: string;
  old_id_barang: string;
  new_sku: string;
}

interface AddSkuRow {
  id: number;
  id_barang: string;
  nama: string;
  satuan: string;
  status: 'Aktif' | 'Tidak Aktif';
}

export function DataSKU() {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    isImporting: false,
    progress: 0,
    total: 0,
    current: 0,
    message: ''
  });
  const [formData, setFormData] = useState({
    id_barang: '',
    nama: '',
    satuan: '',
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

  const [updateRows, setUpdateRows] = useState<MassUpdateRow[]>(
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      old_sku: '',
      old_id_barang: '',
      new_sku: '',
    }))
  );

  const [addSkuRows, setAddSkuRows] = useState<AddSkuRow[]>([]);
  const [lastId, setLastId] = useState<number>(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [skuNames, setSkuNames] = useState<SKU[]>([]);
  const [filteredSkuNames, setFilteredSkuNames] = useState<SKU[]>([]);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  };

  const extractIdNumber = (id_barang: string): number => {
    const match = id_barang.match(/\d+$/);
    return match ? parseInt(match[0]) : 0;
  };

  const determineLastId = (data: SKU[]) => {
    if (data && data.length > 0) {
      const sortedData = [...data].sort((a, b) => {
        const idA = extractIdNumber(a.id_barang);
        const idB = extractIdNumber(b.id_barang);
        return idA - idB;
      });
      const lastSku = sortedData.pop();
      return lastSku ? extractIdNumber(lastSku.id_barang) : 0;
    }
    return 0;
  };

  const fetchEntireProductsList = async (): Promise<SKU[]> => {
    const result = await fetchAllProducts();
    return (result.data || []) as SKU[];
  };

  const fetchAndStoreSKUs = async () => {
    try {
      setLoading(true);

      const result = await fetchAllProducts();
      let allSkus: SKU[] = (result.data || []) as SKU[];

      const count = allSkus.length;

      const skuData = allSkus.map(item => ({
        id: item.id,
        id_barang: item.id_barang,
        nama: item.nama,
        satuan: item.satuan,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      setSKUs(skuData);
      localStorage.setItem('sku_data', JSON.stringify(skuData));

      const allSkuNames = skuData.filter(sku => sku.status === 'Aktif');
      setSkuNames(allSkuNames);
      localStorage.setItem('sku_names_cache', JSON.stringify(allSkuNames));

      setLastId(determineLastId(skuData));

      if (!loading) {
        showToast(`Berhasil menyinkronkan ${count.toLocaleString()} SKU dari database`, 'success');
      }

    } catch (error) {
      console.error('Error loading all SKUs:', error);
      showToast('Terjadi kesalahan saat memuat seluruh data dari database', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedData = localStorage.getItem('sku_data');
    if (cachedData) {
      const parsedData: SKU[] = JSON.parse(cachedData);
      parsedData.sort((a, b) => b.id_barang.localeCompare(a.id_barang));
      setSKUs(parsedData);
      setLastId(determineLastId(parsedData));
      showToast('Data cache dimuat, menyinkronkan data terbaru...', 'info');
    }

    fetchAndStoreSKUs();

    const fetchFullSkuNames = async () => {
      try {
        const allProducts = await fetchEntireProductsList();
        setSkuNames(allProducts);
        localStorage.setItem('sku_names_cache', JSON.stringify(allProducts));
      } catch (error) {
        console.error('Error fetching full SKU list for dropdown:', error);
      }
    };
    fetchFullSkuNames();

    const channel = supabase.channel('sku-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
      console.log('Real-time update received:', payload);
      showToast('Data SKU diperbarui, menyinkronkan...', 'info');
      fetchAndStoreSKUs();
      fetchFullSkuNames();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isFormOpen) {
      const initialRows: AddSkuRow[] = Array.from({ length: 6 }, (_, i) => ({
        id: i,
        id_barang: String(lastId + i + 1),
        nama: '',
        satuan: 'PCS',
        status: 'Aktif'
      }));
      setAddSkuRows(initialRows);
    }
  }, [isFormOpen, lastId]);

  useEffect(() => {
    if (isUpdateModalOpen) {
      const filtered = skuNames.filter(sku => sku.status === 'Aktif');
      setFilteredSkuNames(filtered);
    }
  }, [isUpdateModalOpen, skuNames]);

  const filteredSKUs = skus.filter(sku =>
    sku.id_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sku.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sku.satuan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSKUs.length / itemsPerPage);
  const currentItems = filteredSKUs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const originalSku = skus.find(sku => sku.id === editingId);
        if (!originalSku) {
          showToast('Data SKU tidak ditemukan', 'error');
          return;
        }

        const { error: productsError } = await supabase
          .from('products')
          .update({
            nama: formData.nama,
            satuan: formData.satuan,
            status: formData.status
          })
          .eq('id', editingId);

        if (productsError) {
          console.error('Error updating SKU in products:', productsError);
          showToast('Gagal mengupdate SKU utama', 'error');
          return;
        }

        const { error: logError } = await supabase
          .from('database_log')
          .update({ sku: formData.nama })
          .eq('sku', originalSku.nama);

        if (logError) {
          console.error('Error updating SKU in database_log:', logError);
        }

        const { error: stockError } = await supabase
          .from('stock_items')
          .update({ nama_produk: formData.nama })
          .eq('nama_produk', originalSku.nama);

        if (stockError) {
          console.error('Error updating SKU in stock_items:', stockError);
        }

        showToast('SKU berhasil diupdate di semua tabel terkait!', 'success');
      }

      resetForm();
      fetchAndStoreSKUs();
    } catch (error) {
      console.error('Error submitting SKU:', error);
      showToast('Terjadi kesalahan saat menyimpan data', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      id_barang: '',
      nama: '',
      satuan: '',
      status: 'Aktif'
    });
    setIsFormOpen(false);
    setIsEditModalOpen(false);
    setEditingId(null);
  };

  const handleEdit = (sku: SKU) => {
    setFormData({
      id_barang: sku.id_barang,
      nama: sku.nama,
      satuan: sku.satuan,
      status: sku.status
    });
    setEditingId(sku.id);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus SKU "${nama}"?`)) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting SKU:', error);
          showToast('Gagal menghapus SKU', 'error');
          return;
        }

        showToast('SKU berhasil dihapus!', 'success');
        fetchAndStoreSKUs();
      } catch (error) {
        console.error('Error deleting SKU:', error);
        showToast('Terjadi kesalahan saat menghapus data', 'error');
      }
    }
  };

  const handleImport = () => {
    setIsImportModalOpen(true);
  };

  const handleFileSelect = (file: File) => {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      processCSVFile(file);
    } else {
      showToast('Silakan pilih file CSV yang valid', 'error');
    }
  };

  const processCSVFile = async (file: File) => {
    try {
      setImportProgress({
        isImporting: true,
        progress: 0,
        total: 0,
        current: 0,
        message: 'Membaca file CSV...'
      });

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      const dataLines = lines.length > 0 && (
        lines[0].toLowerCase().includes('id') ||
        lines[0].toLowerCase().includes('barang') ||
        lines[0].toLowerCase().includes('nama')
      ) ? lines.slice(1) : lines;

      const total = dataLines.length;

      setImportProgress(prev => ({
        ...prev,
        total,
        message: `Memproses ${total} baris data...`
      }));

      const importData: any[] = [];
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];

        let columns: string[];
        if (line.includes('\t')) {
          columns = line.split('\t');
        } else if (line.includes(';')) {
          columns = line.split(';');
        } else {
          columns = line.split(',');
        }

        columns = columns.map(col => col.trim().replace(/^["']|["']$/g, ''));

        if (columns.length >= 2 && columns[0]?.trim() && columns[1]?.trim()) {
          const id_barang = columns[0].toUpperCase();
          const nama = columns[1];

          importData.push({
            id_barang: id_barang,
            sku_code: id_barang,
            nama: nama,
            satuan: 'PCS',
            status: 'Aktif'
          });
        }

        const progress = Math.round(((i + 1) / total) * 50);
        setImportProgress(prev => ({
          ...prev,
          progress,
          current: i + 1,
          message: `Memproses baris ${i + 1} dari ${total}...`
        }));
      }

      setImportProgress(prev => ({
        ...prev,
        progress: 50,
        message: 'Menyimpan data ke database...'
      }));

      if (importData.length > 0) {
        const { error } = await supabase
          .from('products')
          .upsert(importData, { onConflict: 'id_barang' });

        if (error) {
          console.error('Error upserting data:', error);
          showToast(`Terjadi kesalahan saat impor: ${error.message}`, 'error');
          setImportProgress({ isImporting: false, progress: 0, total: 0, current: 0, message: '' });
          return;
        }

        setImportProgress(prev => ({
          ...prev,
          progress: 100,
          current: total,
          message: 'Impor selesai! Semua data berhasil diproses.'
        }));

        setTimeout(() => {
          setImportProgress({ isImporting: false, progress: 0, total: 0, current: 0, message: '' });
          setIsImportModalOpen(false);
          fetchAndStoreSKUs();
          showToast(`Impor berhasil! ${importData.length} SKU telah ditambahkan atau diperbarui.`, 'success');
        }, 2000);

      } else {
        setImportProgress({ isImporting: false, progress: 0, total: 0, current: 0, message: '' });
        showToast('Tidak ada data valid untuk diimpor.', 'warning');
      }

    } catch (error) {
      console.error('Error processing CSV:', error);
      setImportProgress({
        isImporting: false,
        progress: 0,
        total: 0,
        current: 0,
        message: ''
      });
      showToast('Terjadi kesalahan fatal saat memproses file CSV', 'error');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleExport = () => {
    try {
      const headers = ['ID Barang', 'Nama Produk', 'Satuan', 'Status', 'Tanggal Dibuat'];
      const csvContent = [
        headers.join(','),
        ...filteredSKUs.map(sku => [
          `"${sku.id_barang}"`,
          `"${sku.nama}"`,
          `"${sku.satuan}"`,
          `"${sku.status}"`,
          `"${new Date(sku.created_at).toLocaleDateString('id-ID')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `data-sku-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Export berhasil! ${filteredSKUs.length} data telah diunduh.`, 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Terjadi kesalahan saat export data', 'error');
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const handleAddRow = () => {
    const nextIdNumber = addSkuRows.length > 0
      ? (parseInt(addSkuRows[addSkuRows.length - 1].id_barang) || 0) + 1
      : lastId + 1;

    setAddSkuRows([...addSkuRows, {
      id: Date.now(),
      id_barang: String(nextIdNumber),
      nama: '',
      satuan: 'PCS',
      status: 'Aktif'
    }]);
  };

  const handleAddUpdateRow = () => {
    setUpdateRows([...updateRows, {
      id: Date.now(),
      old_sku: '',
      old_id_barang: '',
      new_sku: ''
    }]);
  };

  const handleRemoveUpdateRow = (idToRemove: number) => {
    if (updateRows.length > 1) {
      setUpdateRows(updateRows.filter(row => row.id !== idToRemove));
    }
  };

  const handleRemoveAddRow = (idToRemove: number) => {

    if (addSkuRows.length > 1) {
      setAddSkuRows(addSkuRows.filter(row => row.id !== idToRemove));
    }
  };

  const handleUpdateInputChange = (e: React.ChangeEvent<HTMLInputElement>, id: number, field: 'old_sku' | 'new_sku') => {
    const { value } = e.target;
    setUpdateRows(prevRows =>
      prevRows.map(row => {
        if (row.id === id) {
          if (field === 'old_sku') {
            const filteredNames = skuNames.filter(sku =>
              sku.nama.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredSkuNames(filteredNames);
            const foundSku = skuNames.find(sku => sku.nama === value);
            return { ...row, old_sku: value, old_id_barang: foundSku ? foundSku.id_barang : '' };
          }
          return { ...row, [field]: value };
        }
        return row;
      })
    );
    if (field === 'old_sku') {
      const filteredNames = skuNames.filter(sku =>
        sku.nama.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSkuNames(filteredNames);
      setFocusedRow(id);
    }
  };

  const handleSelectSuggestion = (sku: SKU, rowId: number) => {
    setUpdateRows(prevRows =>
      prevRows.map(row =>
        row.id === rowId ? { ...row, old_sku: sku.nama, old_id_barang: sku.id_barang } : row
      )
    );
    setFilteredSkuNames([]);
    setFocusedRow(null);
  };

  const handleMassUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates = updateRows.filter(row => row.old_id_barang && row.new_sku);

    if (updates.length === 0) {
      showToast('Tidak ada data valid untuk diperbarui.', 'warning');
      return;
    }

    let totalSuccess = 0;
    let totalErrors = 0;

    for (const update of updates) {
      const oldIdBarang = update.old_id_barang;
      const newNamaProduk = update.new_sku.trim();

      try {
        const { error: productsError } = await supabase
          .from('products')
          .update({ nama: newNamaProduk })
          .eq('id_barang', oldIdBarang);

        if (productsError) {
          console.error(`Gagal update tabel products untuk ID ${oldIdBarang}:`, productsError);
          totalErrors++;
          continue;
        }

        const { error: logError } = await supabase
          .from('database_log')
          .update({ sku: newNamaProduk })
          .eq('sku', update.old_sku);

        if (logError) {
          console.error(`Gagal update tabel database_log untuk SKU ${update.old_sku}:`, logError);
        }

        const { error: stockError } = await supabase
          .from('stock_items')
          .update({ nama_produk: newNamaProduk })
          .eq('nama_produk', update.old_sku);

        if (stockError) {
          console.error(`Gagal update tabel stock_items untuk SKU ${update.old_sku}:`, stockError);
        }

        totalSuccess++;
      } catch (error) {
        console.error('Terjadi kesalahan saat update massal:', error);
        totalErrors++;
      }
    }

    if (totalErrors > 0) {
      showToast(`Update massal selesai. Berhasil: ${totalSuccess}, Gagal: ${totalErrors}.`, 'warning');
    } else {
      showToast(`Update massal berhasil! ${totalSuccess} SKU diperbarui.`, 'success');
    }

    // Bersihkan semua cache agar Dashboard langsung menampilkan data terbaru
    queryOptimizer.invalidateAllCache();
    // Hapus juga localStorage cache Dashboard
    localStorage.removeItem('dashboard_products_cache');
    localStorage.removeItem('dashboard_stock_cache');
    localStorage.removeItem('dashboard_logs_cache');

    setIsUpdateModalOpen(false);
    setUpdateRows(Array.from({ length: 5 }, (_, i) => ({ id: i, old_sku: '', old_id_barang: '', new_sku: '' })));
    fetchAndStoreSKUs();
  };

  const handleAddSkuChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, id: number, field: keyof AddSkuRow) => {
    const { value } = e.target;
    setAddSkuRows(prevRows =>
      prevRows.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleAddSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSkus = addSkuRows.filter(row => row.id_barang && row.nama);

    if (newSkus.length === 0) {
      showToast('Tidak ada data valid untuk ditambahkan.', 'warning');
      return;
    }

    try {
      const formattedSkus = newSkus.map(sku => ({
        id_barang: sku.id_barang,
        sku_code: sku.id_barang,
        nama: sku.nama,
        satuan: sku.satuan,
        status: sku.status
      }));

      const { error } = await supabase
        .from('products')
        .insert(formattedSkus);

      if (error) {
        console.error('Error adding new SKUs:', error);
        showToast('Gagal menambah SKU baru', 'error');
        return;
      }

      showToast(`${newSkus.length} SKU berhasil ditambahkan!`, 'success');
      setIsFormOpen(false);
      setAddSkuRows(Array.from({ length: 6 }, (_, i) => ({
        id: i,
        id_barang: String(lastId + i + 1),
        nama: '',
        satuan: 'PCS',
        status: 'Aktif'
      })));
      fetchAndStoreSKUs();

    } catch (error) {
      console.error('Error submitting new SKUs:', error);
      showToast('Terjadi kesalahan saat menyimpan data', 'error');
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
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Tag className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">MASTER DATA SKU</h1>
              <p className="text-blue-100">Kelola data SKU dan informasi produk</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={() => setIsUpdateModalOpen(true)}
              className="h-11 px-6 bg-gradient-to-br from-indigo-500 to-violet-700 hover:from-indigo-600 hover:to-violet-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(99,102,241,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
              <RefreshCcw className="h-5 w-5 mr-2" />
              Update Massal
            </Button>
            <Button
              onClick={handleImport}
              className="h-11 px-6 bg-gradient-to-br from-orange-500 to-amber-700 hover:from-orange-600 hover:to-amber-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
              <Upload className="h-5 w-5 mr-2" />
              Import
            </Button>
            <Button
              onClick={handleExport}
              className="h-11 px-6 bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
              <Download className="h-5 w-5 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => setIsFormOpen(true)}
              className="h-11 px-6 bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
              <Plus className="h-5 w-5 mr-2" />
              Tambah SKU
            </Button>
          </div>
        </div>

        <div className="bg-blue-600 text-white p-3 rounded-lg flex items-center space-x-4">
          <div className="flex items-center space-x-2 flex-1">
            <span className="font-medium">Search</span>
            <div className="relative w-96">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1 pr-8 text-black rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Cari ID Barang, Nama Produk, atau Satuan..."
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                {searchTerm ? (
                  <button
                    onClick={clearSearch}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Search className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title="Tambah SKU Baru"
          size="xl"
        >
          <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
            <p className="text-sm text-gray-600 mb-4">
              Masukkan data untuk SKU baru. Anda dapat menambahkan beberapa SKU sekaligus.
            </p>
            <form onSubmit={handleAddSkuSubmit} className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="p-2 text-left w-[15%]">ID Barang</th>
                      <th className="p-2 text-left w-[35%]">Nama Produk</th>
                      <th className="p-2 text-left w-[15%]">Satuan</th>
                      <th className="p-2 text-left w-[15%]">Status</th>
                      <th className="p-2 text-center w-[10%]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addSkuRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-gray-200">
                        <td className="p-2">
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
                            placeholder="ID Barang"
                            value={row.id_barang}
                            readOnly
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nama Produk"
                            value={row.nama}
                            onChange={(e) => handleAddSkuChange(e, row.id, 'nama')}
                            required={index === 0}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.satuan}
                            onChange={(e) => handleAddSkuChange(e, row.id, 'satuan')}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            required={index === 0}
                          >
                            <option value="PCS">PCS</option>
                            <option value="BOX">BOX</option>
                            <option value="CTN">CTN</option>
                            <option value="PACK">PACK</option>
                            <option value="SET">SET</option>
                            <option value="UNIT">UNIT</option>
                            <option value="KG">KG</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.status}
                            onChange={(e) => handleAddSkuChange(e, row.id, 'status')}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            required={index === 0}
                          >
                            <option value="Aktif">Aktif</option>
                            <option value="Tidak Aktif">Tidak Aktif</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center">
                            {addSkuRows.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => handleRemoveAddRow(row.id)}
                                className="h-8 w-8 p-0 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-rose-500/20"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600 stroke-[2.5px]" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button
                  type="button"
                  onClick={handleAddRow}
                  className="px-6 h-10 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-bold rounded-xl border border-blue-500/20 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Tambah Baris
                </Button>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-6 h-10 bg-white/10 hover:bg-white/20 text-gray-700 font-bold rounded-xl border border-gray-300/50 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="px-8 h-10 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Simpan
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Modal>

        <Modal
          isOpen={isEditModalOpen}
          onClose={resetForm}
          title={`Edit SKU: ${formData.nama}`}
          size="lg"
        >
          <div className="p-6 bg-gray-50 rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3 rounded-md flex items-center text-sm mb-4">
                <Info className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>Setiap perubahan akan secara otomatis tersinkronisasi ke menu <strong>Database Log</strong> dan <strong>Data Gudang</strong>.</span>
              </div>
              <div>
                <label htmlFor="id_barang_edit" className="block text-sm font-medium text-gray-700 mb-1">
                  ID Barang
                </label>
                <input
                  id="id_barang_edit"
                  type="text"
                  value={formData.id_barang}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none bg-gray-100 cursor-not-allowed"
                  readOnly
                />
              </div>
              <div>
                <label htmlFor="nama_edit" className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Produk
                </label>
                <input
                  id="nama_edit"
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="satuan_edit" className="block text-sm font-medium text-gray-700 mb-1">
                  Satuan
                </label>
                <select
                  id="satuan_edit"
                  value={formData.satuan}
                  onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="PCS">PCS</option>
                  <option value="BOX">BOX</option>
                  <option value="CTN">CTN</option>
                  <option value="PACK">PACK</option>
                  <option value="SET">SET</option>
                  <option value="UNIT">UNIT</option>
                  <option value="KG">KG</option>
                </select>
              </div>
              <div>
                <label htmlFor="status_edit" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status_edit"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Aktif' | 'Tidak Aktif' })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  className="px-6 h-10 bg-white/10 hover:bg-white/20 text-gray-700 font-bold rounded-xl border border-gray-300/50 backdrop-blur-md transition-all active:scale-95"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="px-8 h-10 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg border border-white/20 backdrop-blur-md transition-all active:scale-95"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </Modal>

        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Import SKU dari CSV"
        >
          <div className="p-6">
            {importProgress.isImporting ? (
              <div className="text-center">
                <p className="font-medium text-lg mb-2">{importProgress.message}</p>
                <progress
                  className="w-full h-4 rounded-lg [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
                  value={importProgress.progress}
                  max="100"
                />
                <p className="text-sm text-gray-600 mt-2">
                  {importProgress.progress}% ({importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()})
                </p>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                  }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 font-medium text-gray-700">
                    Seret & lepas file CSV di sini
                  </p>
                  <p className="text-sm text-gray-500">atau</p>
                  <Button
                    type="button"
                    className="mt-2 px-8 h-10 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg border border-white/20 backdrop-blur-md transition-all active:scale-95"
                    onClick={() => inputRef.current?.click()}
                  >
                    Pilih File
                  </Button>
                  <p className="text-xs text-gray-500 mt-4">
                    Format: Kolom A untuk ID Barang, Kolom B untuk Nama Produk.
                  </p>
                </label>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          title="Update Massal SKU"
        >
          <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
            <p className="text-sm text-gray-600 mb-4">
              Ubah nama produk lama menjadi nama produk baru. Semua data yang terkait di tabel products (kolom nama), database_log (kolom sku), dan stock_items (kolom nama_produk) akan diperbarui secara otomatis.
            </p>
            <form onSubmit={handleMassUpdate} className="space-y-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="p-2 text-left w-[15%]">ID Barang</th>
                    <th className="p-2 text-left w-[35%]">Nama Produk Lama</th>
                    <th className="p-2 text-left w-[35%]">Nama Produk Baru</th>
                    <th className="p-2 text-center w-[15%]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {updateRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-200">
                      <td className="p-2 text-sm">
                        <input
                          type="text"
                          className="w-full px-2 py-1 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed focus:outline-none"
                          value={row.old_id_barang}
                          readOnly
                        />
                      </td>
                      <td className="p-2">
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ketik nama produk lama..."
                            value={row.old_sku}
                            onChange={(e) => handleUpdateInputChange(e, row.id, 'old_sku')}
                            onFocus={() => {
                              setFocusedRow(row.id);
                              setFilteredSkuNames(skuNames);
                            }}
                            onBlur={() => setTimeout(() => setFocusedRow(null), 200)}
                          />
                          {focusedRow === row.id && filteredSkuNames.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                              {filteredSkuNames.map((sku, skuIndex) => (
                                <li
                                  key={skuIndex}
                                  className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                  onMouseDown={() => handleSelectSuggestion(sku, row.id)}
                                >
                                  {sku.nama}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nama produk baru..."
                          value={row.new_sku}
                          onChange={(e) => handleUpdateInputChange(e, row.id, 'new_sku')}
                        />
                      </td>
                      <td className="p-2 text-center">
                        {updateRows.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => handleRemoveUpdateRow(row.id)}
                            className="h-8 w-8 p-0 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-rose-500/20"
                          >
                            <Trash2 className="h-4 w-4 text-rose-600 stroke-[2.5px]" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-4">
                <Button
                  type="button"
                  onClick={handleAddUpdateRow}
                  className="px-6 h-10 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 font-bold rounded-xl border border-indigo-500/20 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Tambah Baris
                </Button>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(false)}
                    className="px-6 h-10 bg-white/10 hover:bg-white/20 text-gray-700 font-bold rounded-xl border border-gray-300/50 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="px-8 h-10 bg-gradient-to-br from-indigo-500 to-violet-700 hover:from-indigo-600 hover:to-violet-800 text-white font-bold rounded-xl shadow-lg border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Modal>

        <Card>
          <CardContent className="p-0">
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="text-blue-600 font-medium">Memuat data...</div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">ID Barang</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Nama Produk</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Satuan</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Tanggal Dibuat</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((sku, index) => (
                    <tr key={sku.id} className={`${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} hover:bg-blue-100 border-b border-gray-200`}>
                      <td className="px-4 py-3 text-sm font-bold border-r border-gray-200">
                        {sku.id_barang}
                      </td>
                      <td className="px-4 py-3 text-sm border-r border-gray-200">
                        {sku.nama}
                      </td>
                      <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                          {sku.satuan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${sku.status === 'Aktif'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {sku.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                        {new Date(sku.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <Button
                            onClick={() => handleEdit(sku)}
                            className="h-8 w-8 p-0 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-blue-500/20"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(sku.id, sku.nama)}
                            className="h-8 w-8 p-0 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-rose-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Baris per halaman:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-9 px-4 bg-white/10 hover:bg-white/20 text-gray-700 font-bold rounded-lg border border-gray-300/50 backdrop-blur-md transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Sebelumnya
            </Button>
            <div className="text-sm text-gray-600 font-bold px-4 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
              Halaman {currentPage} dari {totalPages}
            </div>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-9 px-4 bg-white/10 hover:bg-white/20 text-gray-700 font-bold rounded-lg border border-gray-300/50 backdrop-blur-md transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              Berikutnya
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>Total SKU: {skus.length.toLocaleString()}</span>
            <div className="flex items-center space-x-4">
              <span>SKU aktif: {skus.filter(s => s.status === 'Aktif').length.toLocaleString()}</span>
              <span>Hasil pencarian: {filteredSKUs.length.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}