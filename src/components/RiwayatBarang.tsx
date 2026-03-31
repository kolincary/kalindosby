import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { Download, X, RefreshCw, QrCode, ChevronDown, Filter, Calendar, Package, Building, Layers, ArrowRightLeft, List, Tag } from 'lucide-react';
import { supabase, fetchAllProducts } from '../lib/supabase';
import { runDateMigration } from '../lib/dateMigration';

// --- Konstanta Cache ---
const CACHE_KEY_PRODUCTS = 'riwayat_barang_products_cache';
const CACHE_KEY_WAREHOUSES = 'riwayat_barang_warehouses_cache';
const CACHE_KEY_RACKS = 'riwayat_barang_racks_cache';
const CACHE_KEY_TIMESTAMP = 'riwayat_barang_metadata_timestamp';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam (Too old, must block and refresh)

// --- Interface dan Tipe Data ---
interface HistoryItem {
  id: string;
  tgl: string;
  waktu: string;
  sku: string;
  jumlah: number;
  type: 'IN' | 'OUT' | 'MOVE';
  gudang: string;
  rak: string;
  tgl_scan: string;
  user_name: string;
  is_adjustment?: boolean;
}

interface Warehouse {
  id: string;
  nama: string;
  status: string;
}

interface RackLocation {
  id: string;
  nama: string;
  status: string;
}

interface Product {
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

// --- Custom Dropdown Component ---
interface CustomDropdownProps {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  isInTable?: boolean;
  loading?: boolean;
  showClearButton?: boolean;
}

function CustomDropdown({ value, onChange, options, placeholder, className, isInTable = false, loading = false, showClearButton = false }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const filteredOptions = React.useMemo(() => {
    if (!value) return options.slice(0, 50);
    const lowerValue = value.toLowerCase();
    return options.filter(option =>
      option.toLowerCase().includes(lowerValue)
    ).slice(0, 50);
  }, [value, options]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  useEffect(() => {
    if (isOpen && optionRefs.current[highlightedIndex] && filteredOptions.length > 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        behavior: 'instant',
        block: 'nearest'
      });
    }
  }, [highlightedIndex, isOpen]);

  const calculatePosition = () => {
    if (dropdownRef.current && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(200, filteredOptions.length * 36);

      if (isInTable) {
        const style: React.CSSProperties = {
          position: 'fixed',
          left: rect.left,
          top: rect.bottom + 4,
          width: rect.width,
          zIndex: 9999,
          maxHeight: '200px'
        };

        if (spaceBelow < dropdownHeight + 10 && spaceAbove > dropdownHeight + 10) {
          style.top = 'unset';
          style.bottom = window.innerHeight - rect.top + 4;
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }

        setDropdownStyle(style);
      } else {
        setDropdownStyle({});
        if (spaceBelow < 150 && spaceAbove > 150) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }
  };

  const handleFocus = () => {
    if (loading) return;
    setIsOpen(true);
    setHighlightedIndex(0);
    calculatePosition();
  };

  const handleOptionSelect = (option: string) => {
    onChange({ target: { value: option } });
    setIsOpen(false);
  };

  const handleClearClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onChange({ target: { value: '' } });
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ target: { value: e.target.value } });
    if (!isOpen && !loading) {
      setIsOpen(true);
      setHighlightedIndex(0);
      calculatePosition();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (loading) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
        calculatePosition();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const nextIndex = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          return nextIndex;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          return nextIndex;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        }
        break;

      case 'Tab':
        if (filteredOptions[highlightedIndex]) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleResizeOrScroll = () => {
      if (isOpen) {
        calculatePosition();
      }
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen]);

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, filteredOptions.length);
  }, [filteredOptions.length]);

  const showButton = showClearButton && value.trim() !== '';

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={`w-full px-4 py-2.5 pr-${showButton ? '14' : '10'} border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${className} ${loading ? 'opacity-50 cursor-wait' : ''}`}
          placeholder={loading ? 'Memuat data...' : placeholder}
          autoComplete="off"
          disabled={loading}
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
          {showButton && (
            <button
              onClick={handleClearClick}
              className="p-1 px-1.5 bg-gray-100/50 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-md transition-all backdrop-blur-sm border border-gray-200 pointer-events-auto"
              aria-label="Hapus input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {loading ? (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full ml-1"></div>
          ) : (
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''} pointer-events-auto`} />
          )}
        </div>
      </div>

      {isOpen && !loading && filteredOptions.length > 0 && (
        <div
          className={`bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent ${isInTable
            ? ''
            : `absolute left-0 right-0 z-50 max-h-60 ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`
            }`}
          style={isInTable ? { ...dropdownStyle, maxHeight: '240px', overflowY: 'scroll' } : { zIndex: 9999 }}
        >
          {filteredOptions.map((option, index) => (
            <div
              ref={el => optionRefs.current[index] = el}
              key={index}
              onClick={() => handleOptionSelect(option)}
              className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${index === highlightedIndex
                ? 'bg-blue-500 text-white font-medium'
                : 'hover:bg-blue-50 hover:text-blue-700'
                }`}
            >
              {option}
            </div>
          ))}
          {options.length > 50 && (
            <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
              Menampilkan 50 dari {options.length.toLocaleString()} opsi
            </div>
          )}
        </div>
      )}

      {isOpen && !loading && filteredOptions.length === 0 && value && (
        <div
          className={`bg-white border border-gray-300 rounded-md shadow-xl ${isInTable
            ? ''
            : `absolute left-0 right-0 z-50 ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`
            }`}
          style={isInTable ? dropdownStyle : { zIndex: 9999 }}
        >
          <div className="px-3 py-2 text-sm text-gray-500">
            Tidak ada data yang cocok dengan "{value}"
          </div>
        </div>
      )}
    </div>
  );
}

// --- Komponen Utama ---
export function RiwayatBarang() {
  // --- State Komponen ---
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(500);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isUpdatingInBackground, setIsUpdatingInBackground] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ sku: string; tgl: string; tgl_scan: string } | null>(null);
  const [filters, setFilters] = useState({
    barang: '',
    tanggal_awal: '',
    tanggal_akhir: '',
    type: '',
    inisial_gudang: '',
    rak: '',
    tanggal_scan: '',
    hanya_penyesuaian: false
  });
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [showGudangDropdown, setShowGudangDropdown] = useState(false);
  const [barangSearchTerm, setBarangSearchTerm] = useState('');
  const [gudangSearchTerm, setGudangSearchTerm] = useState('');
  const [rakSearchTerm, setRakSearchTerm] = useState('');
  const gudangInputRef = useRef<HTMLInputElement>(null);
  const gudangDropdownRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });
  const [isDevMode, setIsDevMode] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const handleRunMigration = async () => {
    if (!window.confirm('PERINGATAN: Memperbaiki format tanggal akan mengubah data di database. Pastikan Anda tahu apa yang Anda lakukan. Lanjutkan?')) {
      return;
    }

    setIsMigrating(true);
    showToast('Memulai perbaikan format tanggal...', 'info');

    try {
      const updatedCount = await runDateMigration((current) => {
        if (current % 100 === 0) {
          // Optional: update toast or UI with progress if needed
        }
      });
      showToast(`Berhasil memperbaiki ${updatedCount} data tanggal!`, 'success');
      loadHistoryData(); // Refresh data
    } catch (error) {
      console.error('Migration failed:', error);
      showToast('Gagal memperbaiki data tanggal', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  // --- Fungsi dan Hooks ---
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setToast({ isOpen: true, message, type });
    setTimeout(() => {
      setToast({ isOpen: false, message: '', type: 'info' });
    }, 4000);
  }, []);

  // --- PERUBAHAN LOGIKA TOGGLE ADA DI SINI ---
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('devModeEnabled') === 'true') {
      setIsDevMode(true);
    }
    let keySequence = '';
    const targetSequence = 'DEVMODE';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      keySequence += event.key.toUpperCase();
      if (keySequence.length > targetSequence.length) {
        keySequence = keySequence.slice(-targetSequence.length);
      }
      if (keySequence === targetSequence) {
        // Logika Toggle
        setIsDevMode(prevIsDevMode => {
          const newIsDevMode = !prevIsDevMode;
          if (newIsDevMode) {
            localStorage.setItem('devmode', 'true');
            showToast('Developer mode diaktifkan!', 'success');
          } else {
            localStorage.removeItem('devmode');
            showToast('Developer mode dinonaktifkan.', 'warning');
          }
          return newIsDevMode;
        });
        keySequence = '';
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [showToast]);

  useEffect(() => {
    loadInitialMetadata();
  }, []);



  useEffect(() => {
    setBarangSearchTerm(filters.barang);
  }, [filters.barang]);

  useEffect(() => {
    setGudangSearchTerm(filters.inisial_gudang);
  }, [filters.inisial_gudang]);

  useEffect(() => {
    setRakSearchTerm(filters.rak);
  }, [filters.rak]);

  const loadInitialMetadata = async (forceRefresh = false) => {
    try {
      // 1. Cek Cacahe terlebih dahulu
      const cachedTimestamp = localStorage.getItem(CACHE_KEY_TIMESTAMP);
      const cachedProducts = localStorage.getItem(CACHE_KEY_PRODUCTS);
      const cachedWarehouses = localStorage.getItem(CACHE_KEY_WAREHOUSES);
      const cachedRacks = localStorage.getItem(CACHE_KEY_RACKS);

      const now = Date.now();
      const isExpired = !cachedTimestamp || (now - parseInt(cachedTimestamp)) > CACHE_EXPIRY_MS;

      // Jika ada cache dan tidak expired (dan tidak force refresh), gunakan dulu agar UI instan
      if (!forceRefresh && !isExpired && cachedProducts && cachedWarehouses && cachedRacks) {
        setProducts(JSON.parse(cachedProducts));
        setWarehouses(JSON.parse(cachedWarehouses));
        setRackLocations(JSON.parse(cachedRacks));
        setDataLoaded(true);
        setInitialLoading(false);

        // Langsung sync di background agar pilihan dropdown selalu update
        updateMetadataInBackground();
        return;
      }

      // 2. Jika tidak ada cache, expired, atau force refresh: Lakukan fetch penuh dengan loader
      setInitialLoading(true);
      setLoadingProgress(0);
      setLoadingMessage('Mempersiapkan data...');

      await performFullMetadataFetch();

    } catch (error) {
      console.error('Error loading metadata:', error);
      showToast('Gagal memuat metadata', 'error');
    } finally {
      setInitialLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
    }
  };

  const performFullMetadataFetch = async () => {
    setLoadingMessage('Mengambil data produk...');

    // Fetch Products with progress
    const productsResult = await fetchAllProducts((current, total) => {
      const percent = Math.round((current / total) * 100);
      setLoadingProgress(percent);
      setLoadingMessage(`Mengambil data produk... (${percent}%)`);
    });

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

    setLoadingMessage('Mengambil data gudang & rak...');
    const [warehouseData, rackData] = await Promise.all([
      fetchWarehouses(),
      fetchRackLocations()
    ]);

    // Update States
    setProducts(productsData);
    setWarehouses(warehouseData);
    setRackLocations(rackData);
    setDataLoaded(true);

    // Save to Cache
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(productsData));
    localStorage.setItem(CACHE_KEY_WAREHOUSES, JSON.stringify(warehouseData));
    localStorage.setItem(CACHE_KEY_RACKS, JSON.stringify(rackData));
    localStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
  };

  const updateMetadataInBackground = async () => {
    if (isUpdatingInBackground) return;
    setIsUpdatingInBackground(true);

    try {
      console.log('🔄 Syncing metadata in background...');
      const productsResult = await fetchAllProducts();

      if (productsResult.success) {
        const productsData = productsResult.data
          .filter(item => item.status === 'Aktif')
          .map(item => ({
            id: item.id,
            nama: item.nama,
            status: item.status
          }))
          .sort((a, b) => a.nama.localeCompare(b.nama));

        const [warehouseData, rackData] = await Promise.all([
          fetchWarehouses(),
          fetchRackLocations()
        ]);

        // Silent update to state and cache
        setProducts(productsData);
        setWarehouses(warehouseData);
        setRackLocations(rackData);

        localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(productsData));
        localStorage.setItem(CACHE_KEY_WAREHOUSES, JSON.stringify(warehouseData));
        localStorage.setItem(CACHE_KEY_RACKS, JSON.stringify(rackData));
        localStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
        console.log('✅ Background sync complete.');
      }
    } catch (err) {
      console.error('Background sync failed:', err);
    } finally {
      setIsUpdatingInBackground(false);
    }
  };

  const fetchWarehouses = async (): Promise<Warehouse[]> => {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, nama, status')
      .eq('status', 'Aktif')
      .order('nama', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const fetchRackLocations = async (): Promise<RackLocation[]> => {
    const { data, error } = await supabase
      .from('rack_locations')
      .select('id, nama, status')
      .eq('status', 'Aktif')
      .order('nama', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  // Re-define loadWarehouses and loadRackLocations to use the new fetchers
  const handleManualRefresh = () => {
    loadInitialMetadata(true);
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
        let day = 0, month = 0, year = 0;
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
        const date = new Date(year, month, day);
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date;
        }
      }
    }
    return null;
  };

  const formatDateToIndonesian = (dateStr: string): string => {
    const parsedDateVal = parseDateFlexible(dateStr);
    if (!parsedDateVal) return dateStr;
    const day = String(parsedDateVal.getDate()).padStart(2, '0');
    const month = String(parsedDateVal.getMonth() + 1).padStart(2, '0');
    const year = parsedDateVal.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateToISO = (dateStr: string): string => {
    const parsedDateVal = parseDateFlexible(dateStr);
    if (!parsedDateVal) return dateStr;
    const year = parsedDateVal.getFullYear();
    const month = String(parsedDateVal.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const getDatesInRange = (startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(12, 0, 0, 0); // Avoid timezone issues

    const end = new Date(endDate);
    end.setHours(12, 0, 0, 0);

    while (currentDate <= end) {
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();

      // Push ALL potential formats that might constitute "this date" in the DB
      dates.push(`${day}/${month}/${year}`); // Legacy format
      dates.push(`${year}-${month}-${day}`); // New format (InputBarangMasuk)

      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const loadHistoryData = useCallback(async () => {
    if (!filters.tanggal_awal || !filters.tanggal_akhir) {
      return;
    }
    try {
      setLoading(true);
      const startDate = parseDateFlexible(filters.tanggal_awal);
      const endDate = parseDateFlexible(filters.tanggal_akhir);
      if (!startDate || !endDate) {
        showToast('Format tanggal tidak valid. Gunakan format DD/MM/YYYY, DD-MM-YYYY, atau YYYY-MM-DD', 'error');
        return;
      }
      // Generate list of dates to filter by 'tgl' column
      const dateList = getDatesInRange(startDate, endDate);

      // Calculate range for pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('database_log')
        .select('*', { count: 'exact' })
        .in('tgl', dateList); // Base filter

      // Apply conditional filters BEFORE sorting/pagination
      if (filters.barang) {
        query = query.eq('sku', filters.barang);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.inisial_gudang) {
        query = query.eq('gudang', filters.inisial_gudang);
      }
      if (filters.rak) {
        query = query.eq('rak', filters.rak);
      }
      if (filters.tanggal_scan) {
        const scanDate = parseDateFlexible(filters.tanggal_scan);
        if (scanDate) {
          const scanFormats = formatDateForSearch(scanDate);
          query = query.or(scanFormats.map(format => `tgl_scan.like.%${format}%`).join(','));
        }
      }
      if (filters.hanya_penyesuaian) {
        query = query.eq('is_adjustment', true);
      }

      // Apply sorting and pagination AFTER all filters
      query = query
        .order('tgl', { ascending: false })
        .order('waktu', { ascending: false })
        .order('id', { ascending: false }) // Tie-breaker for stability
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error loading history data:', error);
        showToast('Gagal memuat data riwayat', 'error');
        return;
      }

      const historyItems: HistoryItem[] = (data || []).map(item => ({
        id: item.id,
        tgl: item.tgl,
        waktu: item.waktu,
        sku: item.sku,
        jumlah: item.jumlah,
        type: item.type as 'IN' | 'OUT' | 'MOVE',
        gudang: item.gudang,
        rak: item.rak,
        tgl_scan: item.tgl_scan || '',
        user_name: item.user_name || ''
      }));

      setHistoryData(historyItems);
      setPaginationInfo({
        currentPage: currentPage,
        totalPages: Math.ceil((count || 0) / itemsPerPage),
        totalCount: count || 0,
        hasNextPage: (count || 0) > to + 1,
        hasPrevPage: currentPage > 1
      });

    } catch (error) {
      console.error('Error loading history data:', error);
      showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, itemsPerPage]);

  const fetchAllHistoryData = useCallback(async () => {
    if (!filters.tanggal_awal || !filters.tanggal_akhir) {
      return [];
    }

    // Show toast for transparency
    showToast('Sedang menyiapkan data export...', 'info');

    const startDate = parseDateFlexible(filters.tanggal_awal);
    const endDate = parseDateFlexible(filters.tanggal_akhir);
    if (!startDate || !endDate) return [];

    const dateList = getDatesInRange(startDate, endDate);

    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('database_log')
        .select('*')
        .in('tgl', dateList); // Base filter

      // Apply conditional filters BEFORE sorting/pagination
      if (filters.barang) query = query.eq('sku', filters.barang);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.inisial_gudang) query = query.eq('gudang', filters.inisial_gudang);
      if (filters.rak) query = query.eq('rak', filters.rak);
      if (filters.tanggal_scan) {
        const scanDate = parseDateFlexible(filters.tanggal_scan);
        if (scanDate) {
          const scanFormats = formatDateForSearch(scanDate);
          query = query.or(scanFormats.map(format => `tgl_scan.like.%${format}%`).join(','));
        }
      }
      if (filters.hanya_penyesuaian) query = query.eq('is_adjustment', true);

      // Apply sorting and pagination AFTER all filters
      query = query
        .order('tgl', { ascending: false })
        .order('waktu', { ascending: false })
        .order('id', { ascending: false }) // Tie-breaker
        .range(from, from + pageSize - 1);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        if (data.length < pageSize) hasMore = false;

        // Update toast occasionally
        if (allData.length % 5000 === 0) {
          showToast(`Mengambil ${allData.length} data...`, 'info');
        }
      } else {
        hasMore = false;
      }
    }

    return allData.map(item => ({
      id: item.id,
      tgl: item.tgl,
      waktu: item.waktu,
      sku: item.sku,
      jumlah: item.jumlah,
      type: item.type as 'IN' | 'OUT' | 'MOVE',
      gudang: item.gudang,
      rak: item.rak,
      tgl_scan: item.tgl_scan || '',
      user_name: item.user_name || ''
    }));
  }, [filters]);

  const refreshData = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadHistoryData();
    }
  }, [currentPage, loadHistoryData]);

  useEffect(() => {
    if (filters.tanggal_awal && filters.tanggal_akhir) {
      loadHistoryData();
    } else {
      setHistoryData([]);
      setPaginationInfo({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
    }
  }, [loadHistoryData, filters.tanggal_awal, filters.tanggal_akhir]);

  const exportDataDev = async () => {
    try {
      const dataToExport = await fetchAllHistoryData();

      if (dataToExport.length === 0) {
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
      }
      const headers = ['Tanggal', 'Waktu', 'SKU/Nama Barang', 'Jumlah', 'Type', 'Gudang', 'Rak', 'Tgl Scan', 'User'];
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(item => [
          `"${item.tgl}"`,
          `"${item.waktu}"`,
          `"${item.sku}"`,
          item.jumlah,
          `"${item.type}"`,
          `"${item.gudang}"`,
          `"${item.rak}"`,
          `"${item.tgl_scan}"`,
          `"${item.user_name}"`
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `riwayat-barang-dev-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Export (DEV) berhasil! ${dataToExport.length} data telah diunduh.`, 'success');
    } catch (error) {
      console.error('Error exporting dev data:', error);
      showToast('Terjadi kesalahan saat export data (DEV)', 'error');
    }
  };

  const exportDataStandard = async () => {
    try {
      const fullData = await fetchAllHistoryData();
      const filteredData = fullData.filter(item => item.gudang !== 'TRANSFER');

      if (filteredData.length === 0) {
        showToast('Tidak ada data yang valid untuk diekspor (setelah filter TRANSFER)', 'warning');
        return;
      }

      // Dynamic import to avoid build issues if types are missing initially or strict checks
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Riwayat Barang');

      // Define columns with widths
      worksheet.columns = [
        { header: 'Tanggal', key: 'tgl', width: 15 },
        { header: 'Waktu', key: 'waktu', width: 10 },
        { header: 'SKU/Nama Barang', key: 'sku', width: 40 },
        { header: 'Jumlah', key: 'jumlah', width: 10 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Gudang', key: 'gudang', width: 25 },
        { header: 'Rak', key: 'rak', width: 15 },
        { header: 'Tgl Scan', key: 'tgl_scan', width: 15 },
        { header: 'User', key: 'user_name', width: 20 },
        { header: 'Rak (Extra)', key: 'rak_extra', width: 15 } // Match existing CSV logic if needed
      ];

      // Styling Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        // Optional: Add background color to header
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      const isUtamaPattern = (rakValue: string) => {
        if (!rakValue) return false;
        const match = rakValue.match(/^([A-L])(\d{1,2})$/i);
        if (!match) return false;
        const num = parseInt(match[2], 10);
        return num >= 1 && num <= 50;
      };

      const forbiddenRakValues = new Set(['BLOK-I', 'ECER-M', 'ECER-N', 'ECER-O', 'LANTAI 2', 'LANTAI 4', 'UTAMA']);

      filteredData.forEach(item => {
        const rakColumn1 = isUtamaPattern(item.rak) ? 'UTAMA' : item.rak;
        const rakColumn2 = forbiddenRakValues.has(item.rak) ? '' : item.rak;

        // Parse date for proper Excel formatting
        // item.tgl is likely string YYYY-MM-DD or similar from DB. 
        // We use our existing parser to be safe, then convert to JS Date.
        const dateObj = parseDateFlexible(item.tgl);

        // FIX: Set time to noon to avoid timezone rollover issues (e.g. 00:00 -> Previous Day 17:00 UTC)
        if (dateObj) {
          dateObj.setHours(12, 0, 0, 0);
        }

        const row = worksheet.addRow({
          tgl: dateObj || item.tgl,
          waktu: item.waktu,
          sku: item.sku,
          jumlah: item.jumlah,
          type: item.type,
          gudang: item.gudang,
          rak: rakColumn1,
          tgl_scan: item.tgl_scan,
          user_name: item.user_name,
          rak_extra: rakColumn2
        });

        // Apply specific format to Date column (Column A / 1)
        if (dateObj) {
          const dateCell = row.getCell(1);
          dateCell.numFmt = 'dd/mm/yyyy'; // Forces display like 25/12/2025
        }

        // Center align most columns for neatness
        [1, 2, 4, 5, 6, 7, 8, 9, 10].forEach(colIdx => {
          const cell = row.getCell(colIdx);
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Left align SKU but keep border
        const skuCell = row.getCell(3);
        skuCell.alignment = { vertical: 'middle', horizontal: 'left' };
        skuCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Save file
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `riwayat-barang-${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast(`Export Excel berhasil! ${filteredData.length} data telah diunduh.`, 'success');
    } catch (error) {
      console.error('Error exporting standard data:', error);
      showToast('Terjadi kesalahan saat export data Excel', 'error');
    }
  };

  const clearAll = () => {
    setFilters({
      barang: '',
      tanggal_awal: '',
      tanggal_akhir: '',
      type: '',
      inisial_gudang: '',
      rak: '',
      tanggal_scan: '',
      hanya_penyesuaian: false
    });
    setBarangSearchTerm('');
    setGudangSearchTerm('');
    setRakSearchTerm('');
    setCurrentPage(1);
  };

  const handleBarangInputChange = useCallback((value: string) => {
    // Menghapus spasi hanya di akhir string saat pengguna mengetik atau paste.
    const trimmedValue = value.trimEnd();

    setBarangSearchTerm(trimmedValue); // Gunakan nilai yang sudah di-trim
    setFilters(prev => ({ ...prev, barang: trimmedValue })); // Gunakan juga di sini
    setCurrentPage(1);
  }, []);



  const handleGudangInputChange = useCallback((value: string) => {
    setGudangSearchTerm(value);
    setFilters(prev => ({ ...prev, inisial_gudang: value }));
    setShowGudangDropdown(true);
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
  }, []);

  const handleRakInputChange = useCallback((value: string) => {
    const trimmedValue = value.trimEnd();
    setRakSearchTerm(trimmedValue);
    setFilters(prev => ({ ...prev, rak: trimmedValue }));
    setCurrentPage(1);
  }, []);



  const filteredWarehouses = gudangSearchTerm
    ? warehouses.filter(warehouse =>
      warehouse.nama.toLowerCase() === gudangSearchTerm.toLowerCase()
    )
    : warehouses.slice(0, 50);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (gudangDropdownRef.current && !gudangDropdownRef.current.contains(target) &&
        gudangInputRef.current && !gudangInputRef.current.contains(target)) {
        setShowGudangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {/* PREMIUM IMMERSIVE HEADER (310px) */}
      <div className="flex flex-col mb-8 lg:mb-12 uppercase">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 -mx-3 lg:-mx-8 pt-[90px] lg:pt-0 lg:h-[310px] pb-[75px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-blue-900/20 relative overflow-hidden transition-all duration-500 flex flex-col justify-center">

          {/* Decorative Background Icon */}
          <div className="absolute -top-6 -right-6 text-white opacity-5">
            <RefreshCw className="w-64 h-64 lg:w-96 lg:h-96" />
          </div>

          {/* Decorative Floating Shapes */}
          <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-24 left-1/4 w-16 h-16 bg-white/5 border border-white/10 rounded-2xl rotate-[35deg] backdrop-blur-sm hidden lg:block"></div>

          {/* Text Content */}
          <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 uppercase">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2 lg:mb-3 opacity-90">
                <div className="w-8 h-[2px] bg-white rounded-full"></div>
                <span className="text-[10px] lg:text-[12px] font-black tracking-[0.3em] text-white">Activity Log v2</span>
              </div>
              <h1 className="text-[34px] lg:text-[54px] font-black text-white tracking-tight leading-[1.1] mb-2 uppercase">
                Riwayat <span className="text-blue-200">Barang</span>
              </h1>
              <div className="text-blue-100/90 font-medium text-[14px] lg:text-[18px] leading-relaxed max-w-[90%] normal-case flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  <span>Menampilkan alur logistik barang secara real-time</span>
                </div>
              </div>
            </div>

            {/* Sync Status / Dev Actions */}
            <div className="relative z-10 flex flex-wrap gap-2 animate-in zoom-in duration-500">
              {(isUpdatingInBackground || initialLoading) && (
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  <span className="text-[10px] font-black text-white tracking-widest uppercase">SYNCING</span>
                </div>
              )}
              {isDevMode && (
                <button
                  onClick={handleRunMigration}
                  disabled={isMigrating}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-xl shadow-lg transition-all border border-amber-400/50 flex items-center gap-2 tracking-widest disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isMigrating ? 'animate-spin' : ''}`} />
                  FIX DATE FORMAT
                </button>
              )}
              <button
                onClick={exportDataStandard}
                className="px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 text-[10px] font-black rounded-xl shadow-lg transition-all border-none flex items-center gap-2 tracking-widest active:scale-95"
              >
                <Download className="w-4 h-4" />
                EXPORT
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
      />

      <div className="space-y-6 lg:px-10 pb-12">
        {(!filters.tanggal_awal || !filters.tanggal_akhir) && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg p-5 shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 text-yellow-700 normal-case">
                <p className="font-semibold mb-1 uppercase tracking-wider text-xs">Perhatian</p>
                <p className="text-sm">Silakan pilih Tanggal Awal dan Tanggal Akhir untuk menampilkan data riwayat barang.</p>
                <p className="text-[10px] mt-1 italic opacity-75 font-medium">Format: DD/MM/YYYY, DD-MM-YYYY, atau YYYY-MM-DD</p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Header - COMPACT (ONLY ON MOBILE) */}
        <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 -mx-4 -mt-6 mb-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div>
            <h1 className="text-lg font-black tracking-tighter text-blue-700 uppercase leading-none">Riwayat</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                Activity Log
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={refreshData}
              variant="secondary"
              size="sm"
              className="h-9 w-9 p-0 rounded-lg bg-blue-50 text-blue-600 border-none shadow-none"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                {loading && (
                  <div className="flex items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-white">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                      <div className="text-blue-600 font-semibold text-lg">Memuat data...</div>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-blue-600 border-b border-blue-700">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Waktu</th>
                        <th className="px-6 py-3 text-left text-xs font-extrabold text-white uppercase tracking-wider">SKU/Nama Barang</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Jumlah</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Gudang</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Rak</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">Tgl Scan</th>
                        <th className="px-6 py-3 text-center text-xs font-extrabold text-white uppercase tracking-wider">User</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historyData.map((item) => (
                        <tr key={item.id} className={`${item.is_adjustment ? 'bg-amber-50' : 'hover:bg-gray-50'} border-b border-gray-200 last:border-b-0 transition-colors duration-200`}>
                          <td className="px-6 py-4 text-sm text-gray-600 text-center whitespace-nowrap font-medium">{formatDateToISO(item.tgl)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center whitespace-nowrap">{item.waktu}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className={item.is_adjustment ? 'font-bold text-amber-800' : ''}>{item.sku}</span>
                                {item.is_adjustment && (
                                  <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-2 shadow-sm border border-amber-200 shrink-0">
                                    <Tag className="h-2.5 w-2.5" />
                                    ADJUSTMENT
                                  </span>
                                )}
                              </div>
                              {item.type === 'IN' && (
                                <Button
                                  onClick={() => setQrModalData({ sku: item.sku, tgl: item.tgl, tgl_scan: item.tgl_scan })}
                                  className="h-8 w-8 p-0 bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold rounded-lg shadow-[0_4px_10px_rgba(37,99,235,0.3)] hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-110 active:scale-90 flex items-center justify-center border border-white/20 backdrop-blur-md ml-2"
                                  title="Tampilkan QR Code"
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-center font-bold">{item.jumlah}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.type === 'OUT' ? 'bg-red-50 text-red-700 border-red-100' :
                              item.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                'bg-purple-50 text-purple-700 border-purple-100'
                              }`}>
                              {item.type === 'IN' ? 'MASUK' : item.type === 'OUT' ? 'KELUAR' : 'TRANSFER'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.gudang}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.rak}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center font-mono text-xs">{item.tgl_scan ? formatDateToISO(item.tgl_scan) : '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.user_name}</td>
                        </tr>
                      ))}
                      {historyData.length === 0 && !loading && (filters.tanggal_awal && filters.tanggal_akhir) && (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-500">
                              <svg className="h-16 w-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              <p className="text-lg font-medium">Tidak ada data yang sesuai dengan filter</p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {(!filters.tanggal_awal || !filters.tanggal_akhir) && (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-500">
                              <svg className="h-16 w-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-lg font-medium">Pilih tanggal awal dan tanggal akhir untuk menampilkan data</p>
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
                  onClick={handleManualRefresh}
                  disabled={loading || isUpdatingInBackground}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all duration-300 transform hover:scale-110 active:scale-90 border border-white/20 backdrop-blur-sm shadow-sm disabled:opacity-50"
                  title="Perbarui Data Metadata"
                >
                  <RefreshCw className={`h-4 w-4 ${(loading || isUpdatingInBackground) ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <CardContent className="p-6 space-y-5">
                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <Package className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Barang ({products.length.toLocaleString()})
                  </label>
                  <div className="relative group">
                    <CustomDropdown
                      value={barangSearchTerm}
                      onChange={(e) => handleBarangInputChange(e.target.value)}
                      options={products.map(p => p.nama)}
                      placeholder="Cari nama barang..."
                      showClearButton={true}
                      loading={initialLoading}
                      className="bg-white border-gray-300 hover:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-lg py-2.5 text-gray-700"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      Rentang Waktu
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setFilters({
                            ...filters,
                            tanggal_awal: today,
                            tanggal_akhir: today
                          });
                          setCurrentPage(1);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-all backdrop-blur-sm shadow-sm"
                      >
                        HARI INI
                      </button>
                      {[
                        { label: '1 Bln', months: 1 },
                        { label: '6 Bln', months: 6 },
                        { label: '1 Thn', months: 12 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            const end = new Date();
                            const start = new Date();
                            start.setMonth(start.getMonth() - preset.months);
                            setFilters({
                              ...filters,
                              tanggal_awal: start.toISOString().split('T')[0],
                              tanggal_akhir: end.toISOString().split('T')[0]
                            });
                            setCurrentPage(1);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-blue-50/50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100/50 transition-all backdrop-blur-sm shadow-sm"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="date"
                        value={filters.tanggal_awal}
                        onChange={(e) => {
                          setFilters({ ...filters, tanggal_awal: e.target.value });
                          setCurrentPage(1);
                        }}
                        onClick={(e) => {
                          try {
                            (e.target as HTMLInputElement).showPicker();
                          } catch (err) {
                            // Fallback for browsers that don't support showPicker
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                        placeholder="Dari Tanggal"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={filters.tanggal_akhir}
                        onChange={(e) => {
                          setFilters({ ...filters, tanggal_akhir: e.target.value });
                          setCurrentPage(1);
                        }}
                        onClick={(e) => {
                          try {
                            (e.target as HTMLInputElement).showPicker();
                          } catch (err) {
                            // Fallback
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                        placeholder="Sampai Tanggal"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Jenis Transaksi
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => {
                      setFilters({ ...filters, type: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Semua Jenis</option>
                    <option value="IN">Masuk (IN)</option>
                    <option value="OUT">Keluar (OUT)</option>
                    <option value="MOVE">Transfer (TRANSFER)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <Building className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Gudang ({warehouses.length})
                  </label>
                  <div className="relative">
                    <input
                      ref={gudangInputRef}
                      type="text"
                      value={gudangSearchTerm}
                      onChange={(e) => handleGudangInputChange(e.target.value)}
                      onFocus={() => setShowGudangDropdown(true)}
                      className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-gray-400"
                      placeholder="Cari gudang..."
                    />
                    {gudangSearchTerm && (
                      <button
                        onClick={clearGudang}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {showGudangDropdown && (
                      <div
                        ref={gudangDropdownRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                      >
                        {filteredWarehouses.length > 0 ? (
                          filteredWarehouses.map((warehouse) => (
                            <div
                              key={warehouse.id}
                              onClick={() => handleGudangSelect(warehouse.nama)}
                              className="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-gray-700 hover:text-blue-700 transition-colors"
                            >
                              {warehouse.nama}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-sm text-gray-400 text-center italic">
                            Tidak ada gudang yang cocok
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Rak ({rackLocations.length})
                  </label>
                  <div className="relative">
                    <CustomDropdown
                      value={rakSearchTerm}
                      onChange={(e) => handleRakInputChange(e.target.value)}
                      options={rackLocations.map(r => r.nama)}
                      placeholder="Cari rak..."
                      showClearButton={true}
                      className="bg-white border-gray-300 hover:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-lg py-2.5 text-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Tanggal Scan
                  </label>
                  <input
                    type="date"
                    value={filters.tanggal_scan}
                    onChange={(e) => {
                      setFilters({ ...filters, tanggal_scan: e.target.value });
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    <List className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Jumlah Data
                  </label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 shadow-sm transition-all duration-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="500">500 baris</option>
                    <option value="800">800 baris</option>
                    <option value="1000">1000 baris</option>
                    <option value="2000">2000 baris</option>
                  </select>
                </div>

                {/* ⭐ FILTER PENYESUAIAN - SPECIAL AMBER */}
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none" htmlFor="filter-penyesuaian">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-amber-800">Penyesuaian</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-400 text-white text-[9px] font-black rounded-full tracking-widest uppercase">SPECIAL</span>
                    </label>
                    <button
                      id="filter-penyesuaian"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, hanya_penyesuaian: !prev.hanya_penyesuaian }));
                        setCurrentPage(1);
                      }}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${filters.hanya_penyesuaian
                        ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                        : 'bg-gray-200'
                        }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${filters.hanya_penyesuaian ? 'left-6' : 'left-0.5'
                        }`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-2 font-medium leading-snug">
                    Tampilkan hanya data yang ditandai sebagai <strong>Penyesuaian Stok</strong> (is_adjustment)
                  </p>
                  {filters.hanya_penyesuaian && (
                    <div className="mt-2 flex items-center gap-1.5 text-amber-800 bg-amber-100 rounded-lg px-2 py-1">
                      <Tag className="w-3 h-3 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Filter Aktif</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100">
                  <Button
                    onClick={clearAll}
                    className="w-full h-10 bg-white/10 hover:bg-white/20 text-rose-600 font-bold rounded-xl shadow-sm transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border border-rose-200 backdrop-blur-xl"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="tracking-wide uppercase text-xs">Reset Filter</span>
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl shadow-md border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Total Data</span>
              <span className="text-2xl font-bold text-blue-600">{paginationInfo.totalCount.toLocaleString()}</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Data Ditampilkan</span>
              <span className="text-2xl font-bold text-green-600">{historyData.length.toLocaleString()}</span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Total Qty</span>
              <span className="text-2xl font-bold text-orange-600">
                {/* Note: Summing quantity on client side only works for current page. For total qty of all pages, we would need an aggregate query. For now, showing sum of visible items. */
                  historyData.reduce((sum, item) => sum + (item.jumlah || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Halaman</span>
              <span className="text-2xl font-bold text-purple-600">{currentPage} / {paginationInfo.totalPages || 1}</span>
            </div>
          </div>

          {paginationInfo.totalCount > itemsPerPage && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, paginationInfo.totalCount)} dari {paginationInfo.totalCount.toLocaleString()} data
              </div>

              <div className="flex flex-wrap justify-center sm:justify-end items-center gap-1 sm:gap-2 order-1 sm:order-2">
                <Button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-9 px-3 bg-white/10 hover:bg-white/20 text-slate-700 font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-slate-200 backdrop-blur-xl disabled:opacity-30 disabled:scale-100"
                >
                  <span className="hidden sm:inline tracking-wide uppercase text-xs">Awal</span>
                  <span className="sm:hidden">&laquo;</span>
                </Button>

                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3 bg-white/10 hover:bg-white/20 text-slate-700 font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-slate-200 backdrop-blur-xl disabled:opacity-30 disabled:scale-100"
                >
                  <span className="hidden sm:inline tracking-wide uppercase text-xs">Prev</span>
                  <span className="sm:hidden">&lsaquo;</span>
                </Button>

                <div className="flex gap-1 flex-wrap justify-center">
                  {(() => {
                    const totalPages = paginationInfo.totalPages;
                    const pages = [];

                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`px-3 py-2 min-w-[36px] sm:min-w-[44px] text-xs sm:text-sm font-bold rounded-xl border transition-all duration-300 transform hover:scale-105 active:scale-95 ${currentPage === i
                              ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600 text-white shadow-md'
                              : 'bg-white/50 hover:bg-white/80 border-slate-200 text-slate-700 backdrop-blur-sm'
                              }`}
                          >
                            {i}
                          </button>
                        );
                      }
                    } else {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => setCurrentPage(1)}
                          className={`px-3 py-2 min-w-[36px] sm:min-w-[44px] text-xs sm:text-sm font-bold rounded-xl border transition-all duration-300 transform hover:scale-105 active:scale-95 ${currentPage === 1
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600 text-white shadow-md'
                            : 'bg-white/50 hover:bg-white/80 border-slate-200 text-slate-700 backdrop-blur-sm'
                            }`}
                        >
                          1
                        </button>
                      );

                      if (currentPage > 3) {
                        pages.push(
                          <span key="dots1" className="px-1 sm:px-2 py-2 text-gray-500 text-xs sm:text-sm">...</span>
                        );
                      }

                      let startPage = Math.max(2, currentPage - 1);
                      let endPage = Math.min(totalPages - 1, currentPage + 1);

                      if (currentPage <= 3) {
                        startPage = 2;
                        endPage = Math.min(4, totalPages - 1);
                      } else if (currentPage >= totalPages - 2) {
                        startPage = Math.max(2, totalPages - 3);
                        endPage = totalPages - 1;
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`px-3 py-2 min-w-[36px] sm:min-w-[44px] text-xs sm:text-sm font-bold rounded-xl border transition-all duration-300 transform hover:scale-105 active:scale-95 ${currentPage === i
                              ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600 text-white shadow-md'
                              : 'bg-white/50 hover:bg-white/80 border-slate-200 text-slate-700 backdrop-blur-sm'
                              }`}
                          >
                            {i}
                          </button>
                        );
                      }

                      if (currentPage < totalPages - 2) {
                        pages.push(
                          <span key="dots2" className="px-1 sm:px-2 py-2 text-gray-500 text-xs sm:text-sm">...</span>
                        );
                      }

                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className={`px-3 py-2 min-w-[36px] sm:min-w-[44px] text-xs sm:text-sm font-bold rounded-xl border transition-all duration-300 transform hover:scale-105 active:scale-95 ${currentPage === totalPages
                            ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-600 text-white shadow-md'
                            : 'bg-white/50 hover:bg-white/80 border-slate-200 text-slate-700 backdrop-blur-sm'
                            }`}
                        >
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                </div>

                <Button
                  onClick={() => setCurrentPage(prev => Math.min(paginationInfo.totalPages, prev + 1))}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="h-9 px-3 bg-white/10 hover:bg-white/20 text-slate-700 font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-slate-200 backdrop-blur-xl disabled:opacity-30 disabled:scale-100"
                >
                  <span className="hidden sm:inline tracking-wide uppercase text-xs">Next</span>
                  <span className="sm:hidden">&rsaquo;</span>
                </Button>

                <Button
                  onClick={() => setCurrentPage(paginationInfo.totalPages)}
                  disabled={currentPage === paginationInfo.totalPages}
                  className="h-9 px-3 bg-white/10 hover:bg-white/20 text-slate-700 font-bold rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-slate-200 backdrop-blur-xl disabled:opacity-30 disabled:scale-100"
                >
                  <span className="hidden sm:inline tracking-wide uppercase text-xs">Akhir</span>
                  <span className="sm:hidden">&raquo;</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div >

      {
        qrModalData && (() => {
          // Gunakan tgl_scan jika ada, jika tidak fallback ke tgl (atau kosongkan sesuai kebutuhan)
          // User request: "Tanggal bukan berdasarkan kolom Tanggal tapi berdasarkan kolom Tgl Scan"
          const finalDate = qrModalData.tgl_scan || qrModalData.tgl;
          const modalFormattedDate = formatDateToIndonesian(finalDate);
          const dateForQr = modalFormattedDate.replace(/\//g, '-');
          const qrDataForScan = `${dateForQr}\t${qrModalData.sku}`;
          const encodedQrData = encodeURIComponent(qrDataForScan);
          const qrCodeUrl = `https://dazzling-halva-7e617b.netlify.app/api/qr?data=${encodedQrData}&size=250&margin=2`;

          return (
            <div
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
              onClick={() => setQrModalData(null)}
            >
              <div
                className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full relative transform transition-all duration-300 scale-95 animate-in fade-in-0 zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setQrModalData(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>

                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Informasi & QR Code</h2>

                <div className="space-y-3 text-gray-700">
                  <div>
                    <label className="font-semibold text-sm">Tanggal:</label>
                    <p className="text-lg bg-gray-100 p-2 rounded">{modalFormattedDate}</p>
                  </div>
                  <div>
                    <label className="font-semibold text-sm">SKU/Nama Barang:</label>
                    <p className="text-lg bg-gray-100 p-2 rounded break-words">{qrModalData.sku}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code untuk ${qrModalData.sku}`}
                    className="mx-auto w-[250px] h-[250px] rounded-md"
                  />
                  <p className="text-center text-xs text-gray-500 mt-2">
                    Pindai QR Code untuk input data
                  </p>
                </div>
              </div>
            </div>
          );
        })()
      }

      {/* Mobile Sticky Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl p-4 border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex gap-2 animate-in slide-in-from-bottom-5">
        <Button
          onClick={refreshData}
          className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all border-none"
          disabled={loading}
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-[10px] uppercase tracking-tighter">Refresh</span>
        </Button>
        <Button
          onClick={exportDataStandard}
          className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all border-none"
        >
          <Download className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-tighter">Export</span>
        </Button>
        <Button
          onClick={() => {
            // Quick reset filters for mobile
            const today = new Date().toISOString().split('T')[0];
            setFilters({
              barang: '',
              tanggal_awal: today,
              tanggal_akhir: today,
              type: '',
              inisial_gudang: '',
              rak: '',
              tanggal_scan: '',
              hanya_penyesuaian: false
            });
            setBarangSearchTerm('');
            setGudangSearchTerm('');
            setRakSearchTerm('');
          }}
          className="h-14 w-14 bg-gray-100 text-gray-600 font-black rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all border-none"
        >
          <Filter className="h-5 w-5" />
          <span className="text-[8px] uppercase tracking-tighter">Reset</span>
        </Button>
      </div>

      {/* Bottom Spacer for Mobile Sticky Bar */}
      <div className="h-24 lg:hidden"></div>
    </div>
  );
}