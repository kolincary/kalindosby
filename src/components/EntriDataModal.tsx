import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { StockReport } from './DataGudang';

interface EntriDataRow {
  id: string;
  nama_produk: string;
  packing: string;
  rak: string;
  sub_rak: string;
  satuan: string;
}

interface RackLocation {
  id: string;
  nama: string;
  status: string;
}

interface EntriDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItems: StockReport[]) => void;
  editData?: StockReport;
}

export function EntriDataModal({ isOpen, onClose, onSave, editData }: EntriDataModalProps) {
  const [rows, setRows] = useState<EntriDataRow[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    rowId: string;
    productName: string;
  }>({
    isOpen: false,
    rowId: '',
    productName: ''
  });

  // Load rack locations on component mount
  useEffect(() => {
    if (isOpen) {
      loadRackLocations();
      resetRows();
    }
  }, [isOpen]);

  const resetRows = () => {
    if (editData) {
      setRows([{
        id: '1',
        nama_produk: editData.nama_produk,
        packing: editData.packing,
        rak: editData.rak,
        sub_rak: editData.sub_rak || editData.rak,
        satuan: editData.satuan
      }]);
    } else {
      setRows(Array.from({ length: 10 }, (_, index) => ({
        id: (index + 1).toString(),
        nama_produk: '',
        packing: 'CTN/',
        rak: '',
        sub_rak: '',
        satuan: ''
      })));
    }
  };

  const loadRackLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('rack_locations')
        .select('id, nama, status')
        .eq('status', 'Aktif')
        .order('nama', { ascending: true });

      if (error) {
        console.error('Error loading rack locations:', error);
        return;
      }

      setRackLocations(data || []);
    } catch (error) {
      console.error('Error loading rack locations:', error);
    }
  };

  const addRow = () => {
    if (editData) return;

    const newRow: EntriDataRow = {
      id: Date.now().toString(),
      nama_produk: '',
      packing: 'CTN/',
      rak: '',
      sub_rak: '',
      satuan: ''
    };
    setRows([...rows, newRow]);
  };

  const handleDeleteClick = (id: string) => {
    if (editData && rows.length === 1) return;

    const row = rows.find(r => r.id === id);
    if (row && rows.length > 1) {
      setConfirmDialog({
        isOpen: true,
        rowId: id,
        productName: row.nama_produk || 'baris kosong'
      });
    }
  };

  const confirmDelete = () => {
    setRows(rows.filter(row => row.id !== confirmDialog.rowId));
    setConfirmDialog({ isOpen: false, rowId: '', productName: '' });
  };

  const updateRow = (id: string, field: keyof EntriDataRow, value: string) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        let updatedValue = value;

        if (field === 'packing') {
          if (!value.startsWith('CTN/')) {
            updatedValue = 'CTN/' + value.replace(/^CTN\/?/, '');
          }
        }

        const updatedRow = { ...row, [field]: updatedValue };

        // Logic for auto-filling sub_rak
        if (field === 'rak') {
          updatedRow.sub_rak = updatedValue;
        }

        return updatedRow;
      }
      return row;
    }));
  };

  const handleSubmit = () => {
    const validRows = rows.filter(row =>
      row.nama_produk.trim() !== '' && row.nama_produk.trim().length > 0
    );

    if (validRows.length === 0) {
      alert('Tidak ada data yang valid untuk disimpan. Pastikan minimal satu baris memiliki Nama Produk yang diisi.');
      return;
    }

    const processedRows = validRows.map(row => ({
      ...row,
      nama_produk: row.nama_produk.trim().toUpperCase(),
      packing: row.packing.trim().toUpperCase(),
      rak: row.rak.trim().toUpperCase(),
      sub_rak: row.sub_rak.trim().toUpperCase(),
      satuan: row.satuan.trim().toUpperCase()
    }));

    if (editData) {
      const updatedItem: StockReport = {
        ...editData,
        id: editData.id,
        nama_produk: processedRows[0].nama_produk,
        packing: processedRows[0].packing,
        rak: processedRows[0].rak,
        sub_rak: processedRows[0].sub_rak,
        satuan: processedRows[0].satuan
      };

      onSave([updatedItem]);
    } else {
      const newStockItems: StockReport[] = processedRows.map((row, index) => ({
        id: `stock_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        nama_produk: row.nama_produk,
        packing: row.packing,
        rak: row.rak,
        sub_rak: row.sub_rak,
        satuan: row.satuan,
        stok_awal: 0,
        masuk: 0,
        keluar: 0,
        tersedia: 0
      }));

      onSave(newStockItems);
    }

    if (!editData) {
      resetRows();
    }

    onClose();
  };

  const clearAll = () => {
    if (editData) return;
    resetRows();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={editData ? "EDIT DATA BARANG" : "ENTRI DATA BARANG"} size="full">
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-3">
              <Button onClick={addRow} variant="primary" disabled={!!editData}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Baris
              </Button>
              <Button onClick={clearAll} variant="danger" disabled={!!editData}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
            <div className="flex space-x-3">
              <Button onClick={handleSubmit} variant="success">
                <Save className="h-4 w-4 mr-2" />
                {editData ? 'Update Data' : 'Simpan Data'}
              </Button>
            </div>
          </div>

          {/* Data Entry Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-blue-600 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500 w-8">No</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Nama Produk</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Packing</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">
                      Rak
                      <div className="text-xs text-red-300 mt-1">bisa diketik</div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Sub Rak</th>
                    <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Satuan</th>
                    <th className="px-4 py-3 text-left text-sm font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {rows.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 border-b border-gray-200`}>
                      <td className="px-4 py-3 text-sm text-center border-r border-gray-200 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={row.nama_produk}
                          onChange={(e) => updateRow(row.id, 'nama_produk', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Masukkan nama produk..."
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <div className="flex items-center">
                          <span className="text-gray-500 text-sm mr-1">CTN/</span>
                          <input
                            type="text"
                            value={row.packing.replace('CTN/', '')}
                            onChange={(e) => updateRow(row.id, 'packing', 'CTN/' + e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="24PCS, 12BOX..."
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <select
                          value={row.rak}
                          onChange={(e) => updateRow(row.id, 'rak', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {!row.rak && <option value="">Pilih Rak...</option>}
                          {row.rak && !rackLocations.some(rack => rack.nama === row.rak) && (
                            <option value={row.rak}>{row.rak} (Custom)</option>
                          )}
                          {rackLocations.map((rack) => (
                            <option key={rack.id} value={rack.nama}>
                              {rack.nama}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <input
                          type="text"
                          value={row.sub_rak}
                          onChange={(e) => updateRow(row.id, 'sub_rak', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Sub lokasi rak..."
                        />
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <select
                          value={row.satuan}
                          onChange={(e) => updateRow(row.id, 'satuan', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Pilih Satuan...</option>
                          <option value="PCS">PCS</option>
                          <option value="BOX">BOX</option>
                          <option value="CTN">CTN</option>
                          <option value="PACK">PACK</option>
                          <option value="SET">SET</option>
                          <option value="UNIT">UNIT</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          onClick={() => handleDeleteClick(row.id)}
                          size="sm"
                          variant="danger"
                          disabled={rows.length <= 1 || (editData && rows.length === 1)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
            <div className="flex justify-between items-center">
              <span>Total baris: {rows.length}</span>
              <span>Baris terisi: {rows.filter(row => row.nama_produk.trim()).length}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, rowId: '', productName: '' })}
        onConfirm={confirmDelete}
        title="Konfirmasi Hapus"
        message={`Apakah Anda yakin ingin menghapus data "${confirmDialog.productName}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </>
  );
}