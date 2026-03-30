import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Toast } from '../ui/Toast';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Warehouse {
  id: string;
  nama: string;
  tampil_di_menu: 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA';
  status: 'Aktif' | 'Tidak Aktif';
  created_at: string;
  updated_at: string;
}

export function NamaGudang() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Load data from Supabase on component mount
  React.useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading warehouses:', error);
        showToast('Gagal memuat data gudang', 'error');
        return;
      }

      setWarehouses(data || []);
    } catch (error) {
      console.error('Error loading warehouses:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        // Update existing warehouse
        const { error } = await supabase
          .from('warehouses')
          .update({
            nama: formData.nama,
            tampil_di_menu: formData.tampil_di_menu,
            status: formData.status
          })
          .eq('id', editingId);

        if (error) {
          console.error('Error updating warehouse:', error);
          showToast('Gagal mengupdate gudang', 'error');
          return;
        }

        showToast('Gudang berhasil diupdate!', 'success');
      } else {
        // Add new warehouse
        const { error } = await supabase
          .from('warehouses')
          .insert([{
            nama: formData.nama,
            tampil_di_menu: formData.tampil_di_menu,
            status: formData.status
          }]);

        if (error) {
          console.error('Error adding warehouse:', error);
          showToast('Gagal menambah gudang', 'error');
          return;
        }

        showToast('Gudang berhasil ditambahkan!', 'success');
      }

      resetForm();
      loadWarehouses(); // Reload data
    } catch (error) {
      console.error('Error submitting warehouse:', error);
      showToast('Terjadi kesalahan saat menyimpan data', 'error');
    }
  };

  const resetForm = () => {
    setFormData({ nama: '', tampil_di_menu: 'KEDUANYA', status: 'Aktif' });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (warehouse: Warehouse) => {
    setFormData({
      nama: warehouse.nama,
      tampil_di_menu: warehouse.tampil_di_menu || 'KEDUANYA',
      status: warehouse.status
    });
    setEditingId(warehouse.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus gudang "${nama}"?`)) {
      try {
        const { error } = await supabase
          .from('warehouses')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting warehouse:', error);
          showToast('Gagal menghapus gudang', 'error');
          return;
        }

        showToast('Gudang berhasil dihapus!', 'success');
        loadWarehouses(); // Reload data
      } catch (error) {
        console.error('Error deleting warehouse:', error);
        showToast('Terjadi kesalahan saat menghapus data', 'error');
      }
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Building2 className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">MASTER DATA GUDANG</h1>
              <p className="text-blue-100">Kelola data gudang dan lokasi penyimpanan</p>
            </div>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="h-11 px-6 bg-gradient-to-br from-emerald-500 to-green-700 hover:from-green-600 hover:to-emerald-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tambah Gudang
          </Button>
        </div>

        {/* Add/Edit Form */}
        {isFormOpen && (
          <Card>
            <CardHeader>
              <div className="bg-blue-600 text-white p-3 -m-6 mb-4 rounded-t-lg">
                <h3 className="font-semibold">
                  {editingId ? 'Edit Gudang' : 'Tambah Gudang Baru'}
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Gudang
                  </label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama lengkap gudang"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tampil di Menu
                  </label>
                  <select
                    value={formData.tampil_di_menu}
                    onChange={(e) => setFormData({ ...formData, tampil_di_menu: e.target.value as 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="KEDUANYA">Input Masuk & Keluar</option>
                    <option value="INPUT_MASUK">Hanya Input Masuk</option>
                    <option value="INPUT_KELUAR">Hanya Input Keluar</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih di menu mana gudang ini akan muncul sebagai pilihan dropdown
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Aktif' | 'Tidak Aktif' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
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
                    {editingId ? 'Update' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Warehouses Table */}
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
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Nama</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Tampil di Menu</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Tanggal Dibuat</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse, index) => (
                    <tr key={warehouse.id} className={`${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} hover:bg-blue-100 border-b border-gray-200`}>
                      <td className="px-4 py-3 text-sm font-bold border-r border-gray-200">
                        {warehouse.nama}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${warehouse.tampil_di_menu === 'KEDUANYA'
                          ? 'bg-blue-100 text-blue-800'
                          : warehouse.tampil_di_menu === 'INPUT_MASUK'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                          }`}>
                          {warehouse.tampil_di_menu === 'KEDUANYA' ? 'Masuk & Keluar' :
                            warehouse.tampil_di_menu === 'INPUT_MASUK' ? 'Input Masuk' : 'Input Keluar'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${warehouse.status === 'Aktif'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {warehouse.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                        {new Date(warehouse.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <Button
                            onClick={() => handleEdit(warehouse)}
                            className="h-8 w-8 p-0 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-blue-500/20"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(warehouse.id, warehouse.nama)}
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

        {/* Summary */}
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>Total gudang: {warehouses.length}</span>
            <span>Gudang aktif: {warehouses.filter(w => w.status === 'Aktif').length}</span>
          </div>
        </div>
      </div>
    </>
  );
}