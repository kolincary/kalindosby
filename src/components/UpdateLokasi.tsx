import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { ValidationAlert } from './ui/ValidationAlert';
import { X, Send, RefreshCw, ChevronLeft, ChevronRight, Filter, Calendar, Package, Building, Layers, ArrowRightLeft, List } from 'lucide-react';
import { supabase, fetchAllProducts } from '../lib/supabase';

interface TransactionItem {
  id: string;
  tgl: string;
  waktu: string;
  sku: string;
  jumlah: number;
  type: 'IN' | 'OUT' | 'MOVE';
  gudang: string;
  rak: string;
  tgl_scan: string;
  lokasi_penyimpanan: string;
  update_lokasi_rak: string;
  isValid?: boolean;
  isLocked?: boolean;
  lockReason?: string;
}

interface Warehouse {
  id: string;
  nama: string;
  status: string;
}

interface Product {
  id: string;
  nama: string;
  status: string;
}

interface RackLocation {
  id: string;
  nama: string;
  status: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Debounce hook untuk search


// ---
// Komponen Search Dropdown yang dioptimalkan, dipindahkan ke luar untuk menghindari re-render yang tidak perlu.
// ---

const OptimizedSearchDropdown = ({
  options,
  value,
  onChange,
  onSelect,
  onKeyDown,
  onFocus,
  placeholder,
  loading,
  highlightedIndex,
  showDropdown,
  setShowDropdown, // Prop baru untuk mengelola state dari parent
  clearSearch,
  inputRef,
  maxDisplayItems = 50
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  placeholder: string;
  loading: boolean;
  highlightedIndex: number;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  clearSearch: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  maxDisplayItems?: number;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const filtered = options.filter(option =>
      option.toLowerCase().includes(value.toLowerCase())
    );
    return filtered.slice(0, maxDisplayItems);
  }, [options, value, maxDisplayItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef, setShowDropdown]);

  useEffect(() => {
    if (dropdownRef.current && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, filteredOptions.length]);

  return (
    <div className="relative dropdown-container">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          onKeyDown={onKeyDown}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          placeholder={loading ? 'Memuat data...' : placeholder}
          disabled={loading}
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
          {value && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearSearch();
              }}
              className="p-1 px-1.5 bg-gray-100/50 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-md transition-all backdrop-blur-sm border border-gray-200 pointer-events-auto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronLeft className={`h-4 w-4 text-gray-400 rotate-[-90deg] transition-transform ${showDropdown ? 'rotate-[90deg]' : ''} pointer-events-auto`} />
        </div>
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
        >
          {filteredOptions.length > 0 ? (
            <>
              {filteredOptions.map((option, index) => (
                <div
                  key={option}
                  onMouseDown={() => onSelect(option)}
                  className={`px-4 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${index === highlightedIndex
                    ? 'bg-blue-500 text-white font-medium'
                    : 'hover:bg-blue-50 hover:text-blue-700'
                    }`}
                >
                  {option}
                </div>
              ))}
              {options.length > maxDisplayItems && (
                <div className="px-4 py-2 text-[10px] text-gray-500 bg-gray-50 border-t font-bold uppercase tracking-widest">
                  Menampilkan {Math.min(filteredOptions.length, maxDisplayItems)} dari {options.length.toLocaleString()} item
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
              {value ? `Tidak ada item yang cocok dengan "${value}"` : 'Ketik untuk mencari...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---
// Komponen UpdateLokasiRakDropdown, dipindahkan ke luar untuk perbaikan fokus input
// ---

const UpdateLokasiRakDropdown = ({
  item,
  updateLocation,
  rackLocations,
  isDisabled,
}: {
  item: TransactionItem;
  updateLocation: (id: string, field: 'update_lokasi_rak', value: string) => void;
  rackLocations: RackLocation[];
  isDisabled?: boolean;
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.update_lokasi_rak);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState({});

  const filteredRacks = useMemo(() => {
    const filtered = rackLocations.filter(rack =>
      rack.nama.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  }, [rackLocations, searchTerm]);

  const calculateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = Math.min(200, filteredRacks.length * 32);

      const style: React.CSSProperties = {
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: '200px',
      };

      if (spaceBelow < dropdownHeight + 10 && rect.top > dropdownHeight + 10) {
        style.top = 'unset';
        style.bottom = window.innerHeight - rect.top;
      } else {
        style.top = rect.bottom;
      }
      setDropdownPosition(style);
    }
  };

  const handleInputChange = (value: string) => {
    const upperCaseValue = value.toUpperCase();
    setSearchTerm(upperCaseValue);
    updateLocation(item.id, 'update_lokasi_rak', upperCaseValue);
    setShowDropdown(true);
    setHighlightedIndex(0);
  };

  const handleSelect = (rackName: string) => {
    const upperCaseName = rackName.toUpperCase().trimEnd();
    setSearchTerm(upperCaseName);
    updateLocation(item.id, 'update_lokasi_rak', upperCaseName);
    setShowDropdown(false);
  };

  const clearInput = () => {
    setSearchTerm('');
    updateLocation(item.id, 'update_lokasi_rak', '');
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && showDropdown && filteredRacks.length > 0) {
      e.preventDefault();
      setHighlightedIndex(prev => prev >= filteredRacks.length - 1 ? 0 : prev + 1);
    } else if (e.key === 'ArrowUp' && showDropdown && filteredRacks.length > 0) {
      e.preventDefault();
      setHighlightedIndex(prev => prev <= 0 ? filteredRacks.length - 1 : prev - 1);
    } else if (e.key === 'Enter') {
      if (showDropdown && highlightedIndex >= 0 && highlightedIndex < filteredRacks.length) {
        e.preventDefault();
        handleSelect(filteredRacks[highlightedIndex].nama);
      } else {
        setShowDropdown(false);
        e.preventDefault();
      }
    } else if (e.key === 'Tab' && showDropdown && highlightedIndex >= 0 && highlightedIndex < filteredRacks.length) {
      e.preventDefault();
      handleSelect(filteredRacks[highlightedIndex].nama);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightedIndex(0);
    }
  };

  useEffect(() => {
    // Sync internal state with prop value when parent state changes.
    // This is crucial for keeping the input value consistent.
    setSearchTerm(item.update_lokasi_rak);
  }, [item.update_lokasi_rak]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) &&
        inputRef.current && !inputRef.current.contains(target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, inputRef]);

  useEffect(() => {
    if (showDropdown) {
      calculateDropdownPosition();
    }
    optionRefs.current = optionRefs.current.slice(0, filteredRacks.length);
  }, [showDropdown, filteredRacks.length]);

  useEffect(() => {
    if (showDropdown && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [highlightedIndex, showDropdown]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (!isDisabled) {
              setShowDropdown(true);
              setHighlightedIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isDisabled}
          className={`w-full px-3 py-1.5 pr-8 border rounded-lg text-xs shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 ${isDisabled
            ? 'bg-red-100 text-red-700 border-red-300 cursor-not-allowed font-bold'
            : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400 focus:ring-emerald-500/20 focus:border-emerald-500 text-emerald-900'
            } ${item.isValid === false && !isDisabled ? 'border-red-500 bg-red-50' : ''}`}
          placeholder={isDisabled ? "🔒 TERKUNCI" : "Cari lokasi..."}
          autoComplete="off"
        />
        {searchTerm && !isDisabled && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearInput();
            }}
            className="absolute right-1.5 top-1/2 transform -translate-y-1/2 p-0.5 bg-gray-100/50 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded transition-all border border-gray-200"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
          style={dropdownPosition}
        >
          {filteredRacks.length > 0 ? (
            filteredRacks.map((rack, idx) => (
              <div
                key={rack.id}
                ref={el => optionRefs.current[idx] = el}
                onMouseDown={() => handleSelect(rack.nama)}
                className={`px-3 py-2 text-xs cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${highlightedIndex === idx ? 'bg-blue-500 text-white font-medium' : 'hover:bg-blue-50 hover:text-blue-700'
                  }`}
              >
                {rack.nama}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              {searchTerm ? `Tidak ada lokasi yang cocok` : 'Tidak ada lokasi tersedia'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---
// Komponen utama UpdateLokasi
// ---

export function UpdateLokasi() {
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(500);

  const [filters, setFilters] = useState({
    tanggal_masuk: '',
    barang: '',
    inisial_gudang: ''
  });

  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [showBarangDropdown, setShowBarangDropdown] = useState(false);
  const [barangSearchTerm, setBarangSearchTerm] = useState('');
  const [barangHighlightedIndex, setBarangHighlightedIndex] = useState(0);

  const [showGudangDropdown, setShowGudangDropdown] = useState(false);
  const [gudangSearchTerm, setGudangSearchTerm] = useState('');
  const [gudangHighlightedIndex, setGudangHighlightedIndex] = useState(0);

  const barangInputRef = useRef<HTMLInputElement>(null);
  const gudangInputRef = useRef<HTMLInputElement>(null);



  const [validationAlert, setValidationAlert] = useState({
    isOpen: false,
    invalidCount: 0,
    errors: [] as string[]
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

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  }, []);

  useEffect(() => {
    loadInitialMetadata();
  }, []);

  useEffect(() => {
    if (filters.tanggal_masuk) {
      loadFilteredTransactions();
    } else {
      setFilteredTransactions([]);
      setPaginationInfo({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
    }
  }, [filters, currentPage, itemsPerPage]);

  useEffect(() => {
    setBarangSearchTerm(filters.barang);
  }, [filters.barang]);

  useEffect(() => {
    setGudangSearchTerm(filters.inisial_gudang);
  }, [filters.inisial_gudang]);

  const loadInitialMetadata = async () => {
    try {
      setInitialLoading(true);
      showToast('Memuat metadata...', 'info');

      const [productsResult] = await Promise.all([
        fetchAllProducts()
      ]);

      if (!productsResult.success) {
        throw new Error('Failed to load products');
      }

      const productsData = productsResult.data
        .filter(item => item.status === 'Aktif')
        .map(item => ({
          id: item.id,
          nama: item.nama,
          status: item.status
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama));

      setProducts(productsData);

      await Promise.all([
        loadWarehouses(),
        loadRackLocations()
      ]);

      setDataLoaded(true);
      showToast(`Metadata dimuat: ${productsData.length.toLocaleString()} produk, ${warehouses.length} gudang`, 'success');

    } catch (error) {
      console.error('Error loading metadata:', error);
      showToast('Gagal memuat metadata', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const parseDateFlexible = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    const cleanStr = dateStr.trim();

    const formats = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
      /^(\d{1,2})[\/\-](\d{1,2})$/
    ];

    for (let i = 0; i < formats.length; i++) {
      const match = cleanStr.match(formats[i]);
      if (match) {
        let day: number = 0, month: number = 0, year: number = 0;

        if (i === 0 || i === 1) {
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]);

          if (i === 1 && year < 100) {
            year += 2000;
          }
        } else if (i === 2) {
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else if (i === 3) {
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = new Date().getFullYear();
        }

        const date: Date = new Date(year, month, day);

        if (date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === day) {
          return date;
        }
      }
    }

    return null;
  };

  const formatDateForSearch = (date: Date): string[] => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const year2 = year.toString().slice(-2);

    return [
      `${day}/${month}/${year}`,
      `${day}/${month}/${year2}`,
      `${day}-${month}-${year}`,
      `${day}-${month}-${year2}`,
      `${year}-${month}-${day}`,
      `${day}/${month}`,
      `${day}-${month}`
    ];
  };

  const loadFilteredTransactions = async () => {
    if (!filters.tanggal_masuk) {
      setFilteredTransactions([]);
      setPaginationInfo({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
      return;
    }

    try {
      setLoading(true);

      let selectedDate: Date;

      if (filters.tanggal_masuk.match(/^\d{4}-\d{2}-\d{2}$/)) {
        selectedDate = new Date(filters.tanggal_masuk);
      } else {
        const parsedDate = parseDateFlexible(filters.tanggal_masuk);
        if (!parsedDate) {
          showToast('Format tanggal tidak valid. Gunakan format DD/MM/YYYY, DD-MM-YYYY, atau YYYY-MM-DD', 'error');
          return;
        }
        selectedDate = parsedDate;
      }

      const possibleFormats = formatDateForSearch(selectedDate);

      let query = supabase
        .from('database_log')
        .select('*', { count: 'exact' })
        .eq('type', 'IN')
        .in('tgl', possibleFormats)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (filters.barang) {
        query = query.ilike('sku', `%${filters.barang}%`);
      }
      if (filters.inisial_gudang) {
        query = query.ilike('gudang', `%${filters.inisial_gudang}%`);
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error loading filtered transactions:', error);
        showToast('Gagal memuat data transaksi', 'error');
        return;
      }

      const transactionItems: TransactionItem[] = (data || []).map(item => {
        const thresholdDate = "2026-03-01";
        const tglScan = item.tgl_scan || '';

        let isLocked = false;
        let lockReason = '';

        // Aturan 1: Jika rak sudah bukan UTAMA (sudah pernah diupdate sekali)
        if (item.rak && item.rak.toUpperCase() !== 'UTAMA') {
          isLocked = true;
          lockReason = 'Sudah pernah diupdate (Telah dipindah dari UTAMA)';
        }
        // Aturan Baru: Jika tgl_scan sebelum 01 Maret 2026
        else if (tglScan && tglScan < thresholdDate) {
          isLocked = true;
          lockReason = 'Data terkunci (Sebelum 01 Maret 2026)';
        }
        // Logika ganti hari dihapus sesuai permintaan: selama >= 01 Maret dan lokasi UTAMA, tetap bisa update.

        return {
          id: item.id,
          tgl: item.tgl,
          waktu: item.waktu,
          sku: item.sku,
          jumlah: item.jumlah,
          type: item.type as 'IN' | 'OUT' | 'MOVE',
          gudang: item.gudang,
          rak: item.rak,
          tgl_scan: tglScan,
          user_name: item.user_name || '',
          lokasi_penyimpanan: item.rak,
          update_lokasi_rak: '',
          isLocked,
          lockReason
        };
      });

      // Aturan 3: Cek apakah ada data OUT (pemotongan) yang sudah terjadi
      // Optimasi: Gunakan satu batch query untuk mengecek semua item sekaligus
      const itemsToCheck = transactionItems.filter(item => !item.isLocked);

      if (itemsToCheck.length > 0) {
        // Buat filter OR untuk SKU, Rak, dan Tgl Scan yang spesifik
        // Format: (and(sku.eq.XXX,rak.eq.YYY,tgl_scan.eq.ZZZ),and(...))
        const filterStrings = itemsToCheck.map(item =>
          `and(sku.eq."${item.sku}",rak.eq."${item.rak}",tgl_scan.eq."${item.tgl_scan}")`
        );

        // Kita bagi menjadi beberapa batch (misal per 50 item) agar query tidak terlalu panjang
        const batchQuerySize = 50;
        for (let i = 0; i < filterStrings.length; i += batchQuerySize) {
          const currentBatchFilters = filterStrings.slice(i, i + batchQuerySize);
          const { data: outRecords, error: outError } = await supabase
            .from('database_log')
            .select('sku, rak, tgl_scan')
            .eq('type', 'OUT')
            .or(currentBatchFilters.join(','));

          if (!outError && outRecords && outRecords.length > 0) {
            // Tandai item yang cocok dengan data OUT yang ditemukan
            outRecords.forEach(out => {
              transactionItems.forEach(item => {
                if (item.sku === out.sku && item.rak === out.rak && item.tgl_scan === out.tgl_scan) {
                  item.isLocked = true;
                  item.lockReason = 'Data sudah terkunci karena ada pemotongan (OUT)';
                }
              });
            });
          }
        }
      }

      setFilteredTransactions(transactionItems);

      const totalPages = Math.ceil((count || 0) / itemsPerPage);
      setPaginationInfo({
        currentPage,
        totalPages,
        totalCount: count || 0,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      });

      if (transactionItems.length > 0) {
        showToast(`Berhasil memuat ${transactionItems.length} dari ${(count || 0).toLocaleString()} transaksi untuk tanggal ${filters.tanggal_masuk}`, 'success');
      } else {
        showToast(`Tidak ada transaksi IN untuk tanggal ${filters.tanggal_masuk}`, 'warning');
      }

    } catch (error) {
      console.error('Error loading filtered transactions:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, nama, status')
        .eq('status', 'Aktif')
        .order('nama', { ascending: true });

      if (error) {
        console.error('Error loading warehouses:', error);
        return;
      }

      setWarehouses(data || []);
      return data || [];
    } catch (error) {
      console.error('Error loading warehouses:', error);
      return [];
    }
  };

  const loadRackLocations = async () => {
    try {
      const excludedRacks = [
        'BLOK-I',
        'ECER-M',
        'ECER-N',
        'ECER-O',
        'LANTAI 2',
        'LANTAI 4',
        'UTAMA'
      ];

      const { data, error } = await supabase
        .from('rack_locations')
        .select('id, nama, status')
        .eq('status', 'Aktif')
        .not('nama', 'in', `(${excludedRacks.join(',')})`)
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

  const updateLocation = (id: string, field: 'update_lokasi_rak', value: string) => {
    setFilteredTransactions(filteredTransactions.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const refreshData = useCallback(() => {
    setDataLoaded(false);
    loadInitialMetadata();
    setFilters({
      tanggal_masuk: '',
      barang: '',
      inisial_gudang: ''
    });
    setBarangSearchTerm('');
    setGudangSearchTerm('');
  }, []);

  const clearAll = () => {
    setFilters({
      tanggal_masuk: '',
      barang: '',
      inisial_gudang: ''
    });
    setBarangSearchTerm('');
    setGudangSearchTerm('');
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const validateTransactions = (): { isValid: boolean; invalidCount: number; errors: string[] } => {
    const updatedTransactions = filteredTransactions.map(item => ({
      ...item,
      isValid: true
    }));

    setFilteredTransactions(updatedTransactions);

    return {
      isValid: true,
      invalidCount: 0,
      errors: []
    };
  };

  const handleSubmit = async () => {
    try {
      validateTransactions();

      setSubmitting(true);

      const itemsToUpdate = filteredTransactions.filter(item =>
        item.update_lokasi_rak.trim() !== ''
      );

      if (itemsToUpdate.length === 0) {
        showToast('Tidak ada data yang akan diupdate. Silakan isi kolom Update Lokasi Rak terlebih dahulu.', 'warning');
        setSubmitting(false); // Pastikan state submitting di-reset
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let newStockItemsCount = 0;
      const updatedItemIds: string[] = [];

      for (const item of itemsToUpdate) {
        if (item.isLocked) {
          errorCount++;
          console.warn(`Attempted to update locked item: ${item.sku}`);
          continue;
        }

        try {
          const { data: existingStockItems, error: checkError } = await supabase
            .from('stock_items')
            .select('id')
            .eq('nama_produk', item.sku)
            .eq('rak', item.update_lokasi_rak)
            .limit(1);

          if (checkError) {
            console.error('Error checking existing stock items:', checkError);
          }

          if (!existingStockItems || existingStockItems.length === 0) {
            const { error: insertError } = await supabase
              .from('stock_items')
              .insert([{
                nama_produk: item.sku,
                packing: 'CTN/',
                rak: item.update_lokasi_rak,
                sub_rak: item.update_lokasi_rak,
                satuan: 'PCS',
                stok_awal: 0,
                status: 'Aktif'
              }]);

            if (insertError) {
              console.error('Error creating new stock item:', insertError);
            } else {
              newStockItemsCount++;
            }
          }

          const { error } = await supabase
            .from('database_log')
            .update({
              rak: item.update_lokasi_rak
            })
            .eq('id', item.id);

          if (error) {
            console.error('Error updating item:', error);
            errorCount++;
          } else {
            successCount++;
            updatedItemIds.push(item.id);
          }
        } catch (error) {
          console.error('Error updating item:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        const message = newStockItemsCount > 0
          ? `Berhasil mengupdate ${successCount} lokasi rak dan membuat ${newStockItemsCount} data stock_items baru!`
          : `Berhasil mengupdate ${successCount} lokasi rak!`;
        showToast(message, 'success');

        // --- Perbaikan di sini: Update state lokal secara langsung
        setFilteredTransactions(prevTransactions =>
          prevTransactions.map(item => {
            if (updatedItemIds.includes(item.id)) {
              // Temukan item yang berhasil diupdate dan perbarui propertinya
              const updatedItem = itemsToUpdate.find(i => i.id === item.id);
              const newRak = updatedItem?.update_lokasi_rak || item.rak;

              // Tentukan apakah harus langsung dikunci
              const shouldLock = newRak.toUpperCase() !== 'UTAMA';

              return {
                ...item,
                rak: newRak,
                lokasi_penyimpanan: newRak,
                update_lokasi_rak: '', // Kosongkan input
                isValid: true,
                isLocked: shouldLock,
                lockReason: shouldLock ? 'Sudah diupdate (telah dipindah dari UTAMA)' : item.lockReason
              };
            }
            return item;
          })
        );
      }

      if (errorCount > 0) {
        const message = newStockItemsCount > 0
          ? `${successCount} berhasil diupdate (${newStockItemsCount} stock_items baru dibuat), ${errorCount} gagal. Silakan coba lagi untuk yang gagal.`
          : `${successCount} berhasil diupdate, ${errorCount} gagal. Silakan coba lagi untuk yang gagal.`;
        showToast(message, 'warning');
      }

    } catch (error) {
      console.error('Error submitting updates:', error);
      showToast('Terjadi kesalahan saat mengupdate data', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarangInputChange = useCallback((value: string) => {
    setBarangSearchTerm(value);
    setFilters(prev => ({ ...prev, barang: value }));
    setShowBarangDropdown(true);
    setCurrentPage(1);
  }, []);

  const handleBarangSelect = useCallback((productName: string) => {
    setBarangSearchTerm(productName);
    setFilters(prev => ({ ...prev, barang: productName }));
    setShowBarangDropdown(false);
    setCurrentPage(1);
  }, []);

  const clearBarang = useCallback(() => {
    setBarangSearchTerm('');
    setFilters(prev => ({ ...prev, barang: '' }));
    setShowBarangDropdown(false);
    if (barangInputRef.current) {
      barangInputRef.current.focus();
    }
  }, []);

  const handleBarangKeyDown = useCallback((e: React.KeyboardEvent) => {
    const filtered = products.filter(product =>
      product.nama.toLowerCase().includes(barangSearchTerm.toLowerCase())
    ).slice(0, 50);

    if (e.key === 'ArrowDown' && showBarangDropdown && filtered.length > 0) {
      e.preventDefault();
      setBarangHighlightedIndex(prev => prev >= filtered.length - 1 ? 0 : prev + 1);
    } else if (e.key === 'ArrowUp' && showBarangDropdown && filtered.length > 0) {
      e.preventDefault();
      setBarangHighlightedIndex(prev => prev <= 0 ? filtered.length - 1 : prev - 1);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && showBarangDropdown && barangHighlightedIndex >= 0 && barangHighlightedIndex < filtered.length) {
      e.preventDefault();
      handleBarangSelect(filtered[barangHighlightedIndex].nama);
    } else if (e.key === 'Escape') {
      setShowBarangDropdown(false);
      setBarangHighlightedIndex(0);
    }
  }, [products, barangSearchTerm, showBarangDropdown, barangHighlightedIndex, handleBarangSelect]);

  const handleGudangInputChange = useCallback((value: string) => {
    setGudangSearchTerm(value);
    setFilters(prev => ({ ...prev, inisial_gudang: value }));
    setShowGudangDropdown(true);
    setGudangHighlightedIndex(0);
    setCurrentPage(1);
  }, []);

  const handleGudangSelect = useCallback((nama: string) => {
    setGudangSearchTerm(nama);
    setFilters(prev => ({ ...prev, inisial_gudang: nama }));
    setShowGudangDropdown(false);
    setCurrentPage(1);
  }, []);

  const clearGudang = useCallback(() => {
    setGudangSearchTerm('');
    setFilters(prev => ({ ...prev, inisial_gudang: '' }));
    setShowGudangDropdown(false);
    setCurrentPage(1);
    if (gudangInputRef.current) {
      gudangInputRef.current.focus();
    }
  }, []);

  const handleGudangKeyDown = useCallback((e: React.KeyboardEvent) => {
    const filtered = warehouses.filter(warehouse =>
      warehouse.nama.toLowerCase().includes(gudangSearchTerm.toLowerCase())
    ).slice(0, 50);

    if (e.key === 'ArrowDown' && showGudangDropdown && filtered.length > 0) {
      e.preventDefault();
      setGudangHighlightedIndex(prev => prev >= filtered.length - 1 ? 0 : prev + 1);
    } else if (e.key === 'ArrowUp' && showGudangDropdown && filtered.length > 0) {
      e.preventDefault();
      setGudangHighlightedIndex(prev => prev <= 0 ? filtered.length - 1 : prev - 1);
    } else if (e.key === 'Enter' && showGudangDropdown && gudangHighlightedIndex >= 0 && gudangHighlightedIndex < filtered.length) {
      e.preventDefault();
      handleGudangSelect(filtered[gudangHighlightedIndex].nama);
    } else if (e.key === 'Escape') {
      setShowGudangDropdown(false);
      setGudangHighlightedIndex(0);
    }
  }, [warehouses, gudangSearchTerm, showGudangDropdown, gudangHighlightedIndex, handleGudangSelect]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (barangInputRef.current && !barangInputRef.current.contains(target) && !target.closest('.dropdown-container')) {
        setShowBarangDropdown(false);
      }

      if (gudangInputRef.current && !gudangInputRef.current.contains(target) && !target.closest('.dropdown-container')) {
        setShowGudangDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  return (
    <>
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
      />

      <ValidationAlert
        isOpen={validationAlert.isOpen}
        onClose={() => setValidationAlert({ isOpen: false, invalidCount: 0, errors: [] })}
        invalidCount={validationAlert.invalidCount}
        errors={validationAlert.errors}
      />

      <div className="space-y-6">
        {/* PREMIUM IMMERSIVE HEADER (310px) */}
        <div className="flex flex-col mb-8 lg:mb-12 uppercase">
          <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 -mx-3 lg:-mx-8 pt-[90px] lg:pt-0 lg:h-[310px] pb-[75px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-indigo-900/40 relative overflow-hidden transition-all duration-500 flex flex-col justify-center">

            {/* Decorative Background Icon */}
            <div className="absolute -top-12 -right-12 text-white opacity-5">
              <Layers className="w-72 h-72 lg:w-[480px] lg:h-[480px]" />
            </div>

            {/* Decorative Floating Elements */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-500/10 rounded-3xl rotate-45 blur-2xl"></div>

            {/* Text Content */}
            <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 uppercase text-left">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3 lg:mb-4 opacity-90">
                  <div className="w-10 h-[2px] bg-indigo-400 rounded-full"></div>
                  <span className="text-[10px] lg:text-[12px] font-black tracking-[0.4em] text-indigo-100">Warehouse Optimization</span>
                </div>
                <h1 className="text-[34px] lg:text-[58px] font-black text-white tracking-tighter leading-[1] mb-3 uppercase">
                  Update Lokasi <span className="text-indigo-400">Rak</span>
                </h1>
                <div className="text-indigo-100/80 font-medium text-[14px] lg:text-[18px] leading-relaxed max-w-[90%] normal-case flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-bold tracking-widest uppercase">System Active</span>
                  </div>
                  <span className="opacity-60 hidden sm:inline">|</span>
                  <span className="text-[13px] lg:text-[16px]">
                    {dataLoaded ? `${products.length.toLocaleString()} produk aktif & ${warehouses.length} gudang terdeteksi` : 'Menghubungkan ke database...'}
                  </span>
                </div>
              </div>

              {/* Global Actions Container - Desktop */}
              <div className="relative z-10 flex flex-wrap gap-2 lg:gap-3 lg:mb-2 items-center">
                {(loading || submitting) && (
                  <div className="px-5 py-2.5 bg-indigo-500/20 backdrop-blur-md border border-white/20 rounded-2xl flex items-center gap-3 mr-2">
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    <span className="text-[11px] font-black text-white tracking-[0.2em] uppercase">Syncing</span>
                  </div>
                )}

                <button
                  onClick={refreshData}
                  disabled={loading}
                  className="h-12 px-6 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2.5 border border-white/30 backdrop-blur-xl disabled:opacity-50"
                  title="Perbarui Data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="uppercase text-xs font-black">Refresh Data</span>
                </button>

                {filteredTransactions.length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-[0_8px_25px_rgba(16,185,129,0.35)] transition-all active:scale-95 flex items-center justify-center gap-2.5 border border-emerald-400/50"
                  >
                    <Send className="h-4 w-4" />
                    <span className="uppercase text-sm font-black tracking-wider">
                      {submitting ? 'UPDATING...' : 'UPDATE LOKASI'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:px-10 pb-12 -mt-6 lg:-mt-8">
          {/* Data Status & Notice */}
          {initialLoading && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-5 shadow-sm animate-pulse">
              <div className="flex items-center">
                <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mr-3" />
                <div className="text-blue-700">
                  <p className="font-bold uppercase tracking-wider text-xs mb-1">Status</p>
                  <p className="text-sm font-medium">Sedang memuat metadata (SKU, Gudang)...</p>
                </div>
              </div>
            </div>
          )}

          {!filters.tanggal_masuk && !initialLoading && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg p-5 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 text-yellow-700">
                  <p className="font-semibold mb-1 uppercase tracking-wider text-xs">Perhatian</p>
                  <p className="text-sm">Silakan pilih tanggal masuk untuk menampilkan data transaksi yang perlu diupdate lokasinya.</p>
                  <p className="text-xs mt-1 font-medium italic opacity-75">Format yang didukung: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Transaction Table */}
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-0">
                  {loading && dataLoaded && (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-blue-600 font-medium">Memuat data...</div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-600 border-b border-blue-700">
                        <tr>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Tanggal Transaksi</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Waktu Transaksi</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold text-white uppercase tracking-wider">Nama Barang</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Jumlah</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Gudang</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider">Lokasi Lama</th>
                          <th className="px-4 py-3 text-center text-[10px] font-extrabold text-white uppercase tracking-wider bg-blue-700/50">Update Lokasi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTransactions.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-b border-gray-200 last:border-b-0 transition-colors duration-200 ${item.isLocked ? 'bg-gray-50/80 opacity-90' : 'hover:bg-blue-50/30'
                              }`}
                          >
                            <td className="px-4 py-3 text-xs text-center whitespace-nowrap font-medium text-gray-600">{item.tgl}</td>
                            <td className="px-4 py-3 text-xs text-center whitespace-nowrap text-gray-500">{item.waktu}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-900">
                              {item.sku}
                              {item.isLocked && (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 border border-red-200 shadow-sm uppercase tracking-tighter">
                                    LOCKED
                                  </span>
                                  <span className="text-[9px] font-medium text-gray-400 italic">
                                    {item.lockReason}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-center font-bold text-gray-900">{item.jumlah}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.type === 'OUT' ? 'bg-red-50 text-red-700 border-red-100' :
                                item.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  'bg-purple-50 text-purple-700 border-purple-100'
                                }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 text-center">{item.gudang}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 text-center font-mono">{item.lokasi_penyimpanan}</td>
                            <td className={`px-4 py-3 ${item.isLocked ? 'bg-gray-100/50' : 'bg-blue-50/30'}`}>
                              <UpdateLokasiRakDropdown
                                item={item}
                                updateLocation={updateLocation}
                                rackLocations={rackLocations}
                                isDisabled={item.isLocked}
                              />
                            </td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && dataLoaded && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              {!filters.tanggal_masuk
                                ? 'Pilih tanggal masuk untuk menampilkan data transaksi'
                                : 'Tidak ada data transaksi untuk tanggal dan filter yang dipilih'}
                            </td>
                          </tr>
                        )}
                        {loading && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                                Memuat data transaksi...
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Panel */}
            <div className="lg:col-span-1">
              <Card className="rounded-xl shadow-md border border-gray-200 bg-white overflow-hidden">
                <div className="bg-blue-600 p-5 border-b border-blue-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg text-white">
                      <Filter className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Filter Pencarian</h3>
                  </div>
                  <button
                    onClick={refreshData}
                    disabled={loading}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all duration-300 transform hover:scale-110 active:scale-90 border border-white/20 backdrop-blur-sm shadow-sm disabled:opacity-50"
                    title="Perbarui Data"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <CardContent className="p-6 space-y-5">
                  <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                      <Package className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Barang ({products.length.toLocaleString()})
                    </label>
                    <OptimizedSearchDropdown
                      options={products.map(p => p.nama)}
                      value={barangSearchTerm}
                      onChange={handleBarangInputChange}
                      onSelect={handleBarangSelect}
                      onKeyDown={handleBarangKeyDown}
                      onFocus={() => setShowBarangDropdown(true)}
                      placeholder="Cari nama barang..."
                      loading={initialLoading}
                      highlightedIndex={barangHighlightedIndex}
                      showDropdown={showBarangDropdown}
                      setShowDropdown={setShowBarangDropdown}
                      clearSearch={clearBarang}
                      inputRef={barangInputRef}
                      maxDisplayItems={50}
                    />
                  </div>

                  <div
                    className="cursor-pointer"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input[type="date"]') as any;
                      if (input) input.showPicker?.();
                    }}
                  >
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1 cursor-pointer">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Tanggal Masuk
                    </label>
                    <input
                      type="date"
                      value={filters.tanggal_masuk}
                      onChange={(e) => {
                        setFilters({ ...filters, tanggal_masuk: e.target.value });
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer"
                    />
                  </div>

                  <div className="hidden">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                      <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Type
                    </label>
                    <input
                      type="text"
                      value="IN"
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-500 bg-gray-50 shadow-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                      <Building className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Gudang ({warehouses.length})
                    </label>
                    <OptimizedSearchDropdown
                      options={warehouses.map(w => w.nama)}
                      value={gudangSearchTerm}
                      onChange={handleGudangInputChange}
                      onSelect={handleGudangSelect}
                      onKeyDown={handleGudangKeyDown}
                      onFocus={() => setShowGudangDropdown(true)}
                      placeholder="Cari nama gudang..."
                      loading={initialLoading}
                      highlightedIndex={gudangHighlightedIndex}
                      showDropdown={showGudangDropdown}
                      setShowDropdown={setShowGudangDropdown}
                      clearSearch={clearGudang}
                      inputRef={gudangInputRef}
                      maxDisplayItems={50}
                    />
                  </div>

                  <div>
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                      <List className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Per Halaman
                    </label>
                    <div className="relative">
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 appearance-none bg-white font-medium"
                      >
                        <option value={20}>20 baris</option>
                        <option value={50}>50 baris</option>
                        <option value={100}>100 baris</option>
                        <option value={200}>200 baris</option>
                        <option value={500}>500 baris</option>
                        <option value={1000}>1000 baris</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronLeft className="h-4 w-4 text-gray-400 rotate-[-90deg]" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={clearAll}
                      className="w-full h-11 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-md transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 border border-gray-200 group"
                    >
                      <RefreshCw className="h-4 w-4 text-gray-400 group-hover:rotate-180 transition-transform duration-500" />
                      <span className="tracking-wide uppercase text-xs">Reset All Filters</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pagination matched to Riwayat Barang style */}
          {paginationInfo.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-md border border-gray-200">
              <div className="text-sm font-medium text-gray-500 order-2 sm:order-1">
                Menampilkan <span className="text-blue-600 font-bold">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="text-blue-600 font-bold">{Math.min(currentPage * itemsPerPage, paginationInfo.totalCount)}</span> dari <span className="text-gray-900 font-extrabold">{paginationInfo.totalCount.toLocaleString()}</span> data
              </div>
              <div className="flex items-center space-x-2 order-1 sm:order-2">
                <Button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-10 w-10 p-0 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-300 flex items-center justify-center border border-gray-200 disabled:opacity-30 disabled:hover:bg-gray-50 disabled:hover:text-gray-600"
                >
                  <span className="text-xs font-black">««</span>
                </Button>
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!paginationInfo.hasPrevPage}
                  className="h-10 w-10 p-0 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-300 flex items-center justify-center border border-gray-200 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="h-10 px-4 flex items-center justify-center bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 border border-blue-500 text-white font-bold text-sm min-w-[100px]">
                  {currentPage.toLocaleString()} / {paginationInfo.totalPages.toLocaleString()}
                </div>

                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!paginationInfo.hasNextPage}
                  className="h-10 w-10 p-0 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-300 flex items-center justify-center border border-gray-200 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => handlePageChange(paginationInfo.totalPages)}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="h-10 w-10 p-0 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-300 flex items-center justify-center border border-gray-200 disabled:opacity-30"
                >
                  <span className="text-xs font-black">»»</span>
                </Button>
              </div>
            </div>
          )}

          {/* Summary Details */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Layers className="h-24 w-24 text-blue-900" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                  <Package className="w-3 h-3 mr-1 text-blue-500" /> Produk Aktif
                </p>
                <p className="text-xl font-extrabold text-blue-900">{products.length.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                  <List className="w-3 h-3 mr-1 text-blue-500" /> Total Record
                </p>
                <p className="text-xl font-extrabold text-blue-900">{paginationInfo.totalCount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                  <ArrowRightLeft className="w-3 h-3 mr-1 text-emerald-500" /> Data Dimuat
                </p>
                <p className="text-xl font-extrabold text-emerald-600">{filteredTransactions.length.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                  <Layers className="w-3 h-3 mr-1 text-blue-500" /> Halaman
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-blue-900">{currentPage}</span>
                  <span className="text-xs font-bold text-gray-400">/ {paginationInfo.totalPages}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}