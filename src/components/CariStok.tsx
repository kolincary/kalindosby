import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { X } from 'lucide-react';

interface StockSearchResult {
  no: number;
  kode_barang: string;
  nama_produk: string;
  packing: string;
  rak: string;
  stok_tersedia: number;
  utama: number;
  ecer: number;
  blok_i: number;
  lantai_4: number;
  lantai_2: number;
}

const mockSearchResult: StockSearchResult = {
  no: 1,
  kode_barang: '1342',
  nama_produk: 'GLUE-GL-0510/1PC',
  packing: 'CTN/24BXS/12PCS',
  rak: 'CAMPURAN',
  stok_tersedia: 0,
  utama: 0,
  ecer: 0,
  blok_i: 0,
  lantai_4: 0,
  lantai_2: 0
};

export function CariStok() {
  const [searchCode, setSearchCode] = useState('GL-0510');
  const [searchResult, setSearchResult] = useState<StockSearchResult | null>(mockSearchResult);

  const handleSearch = () => {
    if (searchCode.trim()) {
      if (searchCode.toLowerCase().includes('gl-0510')) {
        setSearchResult(mockSearchResult);
      } else {
        setSearchResult(null);
      }
    }
  };

  const clearSearch = () => {
    setSearchCode('');
    setSearchResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-lg">
        <h1 className="text-2xl font-bold">CARI STOK BARANG</h1>
      </div>

      {/* Search Section */}
      <div className="bg-blue-600 text-white p-3 rounded-lg">
        <div className="flex items-center">
          <div className="bg-blue-700 px-4 py-2 rounded-l-md">
            <span className="font-medium text-sm">SEARCH</span>
          </div>
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className="flex-1 px-4 py-2 text-black focus:outline-none"
            placeholder="Masukkan kode barang..."
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={clearSearch}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-r-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResult && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">No</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Kode Barang</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Nama Produk</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Packing</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Rak</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Stok Tersedia</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Utama</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Ecer</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Blok I</th>
                    <th className="px-4 py-3 text-center text-sm font-medium border-r border-blue-500">Lantai 4</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">Lantai 2</th>
                  </tr>
                </thead>
                <tbody className="bg-blue-50">
                  <tr className="border-b border-blue-200">
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.no}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium border-r border-gray-200">{searchResult.kode_barang}</td>
                    <td className="px-4 py-3 text-sm border-r border-gray-200">{searchResult.nama_produk}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.packing}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.rak}</td>
                    <td className="px-4 py-3 text-sm text-center font-bold border-r border-gray-200">{searchResult.stok_tersedia}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.utama}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.ecer}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.blok_i}</td>
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200">{searchResult.lantai_4}</td>
                    <td className="px-4 py-3 text-sm text-center">{searchResult.lantai_2}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}