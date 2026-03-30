import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Toast } from '../ui/Toast';
import { Plus, Edit2, Trash2, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Unit {
  id: string;
  nama: string;
  status: 'Aktif' | 'Tidak Aktif';
  created_at: string;
  updated_at: string;
}

export function Satuan() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
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
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading units:', error);
        showToast('Gagal memuat data satuan', 'error');
        return;
      }

      setUnits(data || []);
    } catch (error) {
      console.error('Error loading units:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        // Update existing unit
        const { error } = await supabase
          .from('units')
          .update({
            nama: formData.nama,
            status: formData.status
          })
          .eq('id', editingId);

        if (error) {
          console.error('Error updating unit:', error);
          showToast('Gagal mengupdate satuan', 'error');
          return;
        }

        showToast('Satuan berhasil diupdate!', 'success');
      } else {
        // Add new unit
        const { error } = await supabase
          .from('units')
          .insert([{
            nama: formData.nama,
            status: formData.status
          }]);

        if (error) {
          console.error('Error adding unit:', error);
          showToast('Gagal menambah satuan', 'error');
          return;
        }

        showToast('Satuan berhasil ditambahkan!', 'success');
      }

      resetForm();
      loadUnits(); // Reload data
    } catch (error) {
      console.error('Error submitting unit:', error);
      showToast('Terjadi kesalahan saat menyimpan data', 'error');
    }
  };

  const resetForm = () => {
    setFormData({ nama: '', status: 'Aktif' });
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (unit: Unit) => {
    setFormData({
      nama: unit.nama,
      status: unit.status
    });
    setEditingId(unit.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus satuan "${nama}"?`)) {
      try {
        const { error } = await supabase
          .from('units')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting unit:', error);
          showToast('Gagal menghapus satuan', 'error');
          return;
        }

        showToast('Satuan berhasil dihapus!', 'success');
        loadUnits(); // Reload data
      } catch (error) {
        console.error('Error deleting unit:', error);
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
            <Scale className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">MASTER DATA SATUAN</h1>
              <p className="text-blue-100">Kelola satuan pengukuran barang</p>
            </div>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="h-11 px-6 bg-gradient-to-br from-emerald-500 to-green-700 hover:from-green-600 hover:to-emerald-800 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tambah Satuan
          </Button>
        </div>

        {/* Add/Edit Form */}
        {isFormOpen && (
          <Card>
            <CardHeader>
              <div className="bg-blue-600 text-white p-3 -m-6 mb-4 rounded-t-lg">
                <h3 className="font-semibold">
                  {editingId ? 'Edit Satuan' : 'Tambah Satuan Baru'}
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Satuan
                  </label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama lengkap satuan"
                    required
                  />
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

        {/* Units Table */}
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
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Satuan</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Tanggal Dibuat</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit, index) => (
                    <tr key={unit.id} className={`${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} hover:bg-blue-100 border-b border-gray-200`}>
                      <td className="px-4 py-3 text-sm font-bold border-r border-gray-200">
                        {unit.nama}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${unit.status === 'Aktif'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center border-r border-gray-200">
                        {new Date(unit.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <Button
                            onClick={() => handleEdit(unit)}
                            className="h-8 w-8 p-0 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-all duration-200 transform active:scale-90 border border-blue-500/20"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(unit.id, unit.nama)}
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
            <span>Total satuan: {units.length}</span>
            <span>Satuan aktif: {units.filter(u => u.status === 'Aktif').length}</span>
          </div>
        </div>
      </div>
    </>
  );
}