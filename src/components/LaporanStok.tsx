import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { EntriDataModal } from './EntriDataModal';

export interface StockReport {
  id: string;
  nama_produk: string;
  packing: string;
  rak: string;
  satuan: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  tersedia: number;
}

const initialStockData: StockReport[] = [
  { id: '1', nama_produk: 'A5-MHKN-M510 GREEN', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 11, masuk: 11, keluar: 0, tersedia: 11 },
  { id: '2', nama_produk: 'A5-MHKN-M510 ORANGE', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 11, masuk: 11, keluar: 0, tersedia: 11 },
  { id: '3', nama_produk: 'A5-MHKN-M510 YELLOW', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 11, masuk: 11, keluar: 0, tersedia: 11 },
  { id: '4', nama_produk: 'A5-TSAC-M477', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 36, masuk: 0, keluar: 0, tersedia: 36 },
  { id: '5', nama_produk: 'A5-TSAF-F312', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '6', nama_produk: 'A5-TSBS-M376', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '7', nama_produk: 'A5-TSCL-M401', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '8', nama_produk: 'A5-TSCL-M491', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '9', nama_produk: 'A5-TSCS-M432', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '10', nama_produk: 'A5-TSDS-M440', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '11', nama_produk: 'A5-TSED-M503', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 35, masuk: 0, keluar: 0, tersedia: 35 },
  { id: '12', nama_produk: 'A5-TSFC-M480', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '13', nama_produk: 'A5-TSFS-514', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '14', nama_produk: 'A5-TSIM-M416', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '15', nama_produk: 'A5-TSIM-M478', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 36, masuk: 0, keluar: 0, tersedia: 36 },
  { id: '16', nama_produk: 'A5-TSSR-M498', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '17', nama_produk: 'A5-TSTP-513', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '18', nama_produk: 'A5-TSUN-M473', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 33, masuk: 0, keluar: 0, tersedia: 33 },
  { id: '19', nama_produk: 'B-005/BLUE', packing: 'CTN/2BXS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 0, masuk: 0, keluar: 0, tersedia: 0 },
  { id: '20', nama_produk: 'B5-TSAC-M129', packing: 'CTN/72PCS', rak: 'Rak A-B', satuan: 'PCS', stok_awal: 34, masuk: 0, keluar: 0, tersedia: 34 }
];

export function LaporanStok() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRack, setSelectedRack] = useState('Rak A-B');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEntriModalOpen, setIsEntriModalOpen] = useState(false);
  const [stockData, setStockData] = useState<StockReport[]>(initialStockData);
  const itemsPerPage = 20;

  const handleSaveNewItems = (newItems: StockReport[]) => {
    console.log('Received new items in LaporanStok:', newItems);
    setStockData(prevData => {
      const updatedData = [...prevData];
      
      newItems.forEach(newItem => {
        // Check if product already exists
        const existingIndex = updatedData.findIndex(item => 
          item.nama_produk.toLowerCase() === newItem.nama_produk.toLowerCase() &&
          item.rak.toLowerCase() === newItem.rak.toLowerCase()
        );
        
        if (existingIndex >= 0) {
          // Update existing item - add to existing stock
          const existing = updatedData[existingIndex];
          updatedData[existingIndex] = {
            ...existing,
            stok_awal: existing.stok_awal + newItem.stok_awal,
            masuk: existing.masuk + newItem.masuk,
            tersedia: existing.tersedia + newItem.tersedia
          };
        } else {
          // Add new item
          updatedData.push(newItem);
        }
      });
      
      return updatedData;
    });
  };

  const filteredData = stockData.filter(item =>
    (item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.rak.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedRack === '' || selectedRack === 'Semua Rak' || item.rak === selectedRack)
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">DATA GUDANG</h1>
          <Button 
            onClick={() => setIsEntriModalOpen(true)}
            variant="success" 
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Entri Data
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-blue-600 text-white p-3 rounded-lg flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="font-medium">Search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1 text-black rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Cari produk..."
          />
        </div>
        <select
          value={selectedRack}
          onChange={(e) => setSelectedRack(e.target.value)}
          className="px-3 py-1 text-black rounded border-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="Semua Rak">Semua Rak</option>
          <option value="Rak A-B">Rak A-B</option>
          <option value="UTAMA">UTAMA</option>
          <option value="LANTAI 4">LANTAI 4</option>
          <option value="CAMPURAN">CAMPURAN</option>
          <option value="LANTAI 2">LANTAI 2</option>
          <option value="ECER">ECER</option>
          <option value="BLOK I">BLOK I</option>
        </select>
        <button className="bg-blue-500 hover:bg-blue-400 p-2 rounded">
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Stock Report Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium border-r border-blue-500">Nama Produk</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Packing</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Rak</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Satuan</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Stok Awal</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Masuk</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Keluar</th>
                  <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Tersedia</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Rak</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item, index) => (
                  <tr key={item.id} className={`${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'} hover:bg-blue-100 border-b border-gray-200`}>
                    <td className="px-4 py-2 text-sm border-r border-gray-200">{item.nama_produk}</td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">
                      <span className="text-red-600 font-medium">{item.packing}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">{item.rak}</td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">{item.satuan}</td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">{item.stok_awal}</td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">
                      <span className={item.masuk > 0 ? 'text-green-600 font-medium' : ''}>{item.masuk}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">{item.keluar}</td>
                    <td className="px-4 py-2 text-sm text-center border-r border-gray-200">
                      <span className="bg-blue-500 text-white px-2 py-1 rounded font-medium">{item.tersedia}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-center">UTAMA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-700">
            Menampilkan {startIndex + 1} sampai {Math.min(startIndex + itemsPerPage, filteredData.length)} dari {filteredData.length} data
          </p>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              variant="secondary"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-3 py-1 bg-white rounded border">
              {currentPage} / {totalPages}
            </span>
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              variant="secondary"
              size="sm"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Entry Data Modal */}
      <EntriDataModal 
        isOpen={isEntriModalOpen} 
        onClose={() => setIsEntriModalOpen(false)}
        onSave={handleSaveNewItems}
      />
    </div>
  );
}