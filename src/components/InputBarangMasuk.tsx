import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Warehouse, RefreshCw, X, ChevronDown, Send, Trash, Settings, Layers, Trash2, Calendar, Clock, Edit3, Box, LayoutGrid, Package } from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ValidationAlert } from './ui/ValidationAlert';
import { Toast } from './ui/Toast';
import { Modal } from './ui/Modal';
import { supabase, fetchAllProducts, fetchAllStockItems } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// Local storage keys
const STORAGE_KEY = 'input_barang_masuk_data';
const LAST_CLEAR_DATE_KEY = 'input_barang_masuk_last_clear_date';
const PRODUCTS_CACHE_KEY = 'input_barang_masuk_products_cache';
const WAREHOUSES_CACHE_KEY = 'input_barang_masuk_warehouses_cache';
const RACKS_CACHE_KEY = 'input_barang_masuk_racks_cache';

const PAGE_SIZE = 1000;

interface TransactionRow {
    id: string;
    tanggal: string;
    waktu: string;
    nama_produk: string;
    jumlah: number;
    type: string;
    gudang: string;
    rak: string;
    tgl_scan?: string;
    stok_tersedia: number;
    total_stok: number;
    validationErrors?: string[];
}

interface AnalyzedItem {
    nama_produk: string;
    jumlah: number;
    rak?: string;
    isValid: boolean;
}

interface RackLocation {
    id: string;
    nama: string;
    tampil_di_menu: 'INPUT_MASUK' | 'INPUT_KELUAR' | 'KEDUANYA';
    status: string;
}

interface StockItem {
    id: string;
    nama_produk: string;
    rak: string;
    tersedia: number;
}


// Load data from localStorage
const loadFromStorage = (): TransactionRow[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
    return [];
};

// Save data to localStorage
const saveToStorage = (data: TransactionRow[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

// Load dropdown data from localStorage
const loadDropdownCache = (key: string): string[] => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (error) {
        console.error('Error loading dropdown cache:', error);
    }
    return [];
};

// Save dropdown data to localStorage
const saveDropdownCache = (key: string, data: string[]) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving dropdown cache:', error);
    }
};

export function InputBarangMasuk() {
    const { userEmail } = useAuth();
    // Format date as dd/mm/yyyy
    const formatDateDDMMYYYY = (date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Format time with seconds
    const formatTimeWithSeconds = (date: Date): string => {
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const convertToInputDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    };

    const convertFromInputDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const [currentTime, setCurrentTime] = useState(formatTimeWithSeconds(new Date()));
    const [currentDate, setCurrentDate] = useState(formatDateDDMMYYYY(new Date()));

    // Dropdown data states
    const [validProducts, setValidProducts] = useState<string[]>([]);
    const [validWarehouses, setValidWarehouses] = useState<string[]>([]);
    const [validRacks, setValidRacks] = useState<string[]>([]);
    const [dropdownLoading, setDropdownLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvancedButtons, setShowAdvancedButtons] = useState(false);

    const [rackLocations, setRackLocations] = useState<RackLocation[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);

    const filteredRackOptions = React.useMemo(() => {
        return rackLocations
            .filter(rack =>
                rack.tampil_di_menu === 'KEDUANYA' || rack.tampil_di_menu === 'INPUT_MASUK'
            )
            .map((rack) => rack.nama);
    }, [rackLocations]);

    // Load rack locations on component mount
    React.useEffect(() => {
        loadRackLocations();
    }, []);

    const loadRackLocations = async () => {
        try {
            const { data, error } = await supabase
                .from('rack_locations')
                .select('id, nama, tampil_di_menu, status')
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

    // Function to execute the clear all logic after confirmation
    const confirmClearAll = (isAutoClear = false) => {
        const firstRowGudang = rows.length > 0 ? rows[0].gudang : '';
        localStorage.removeItem(STORAGE_KEY);
        setClearAllConfirm(false); // Close the confirmation modal

        setRows([{
            id: 'id-' + Date.now().toString() + '_' + Math.random(),
            tanggal: formatDateDDMMYYYY(new Date()),
            waktu: formatTimeWithSeconds(new Date()),
            nama_produk: '',
            jumlah: 0,
            type: 'IN',
            gudang: firstRowGudang,
            rak: '',
            stok_tersedia: 0,
            total_stok: 0,
            validationErrors: undefined
        }]);

        if (!isAutoClear) {
            showToast('Semua data berhasil dihapus dari tabel!', 'success');
        } else {
            console.log("Data input kemarin dibersihkan secara otomatis.");
            showToast('Data input kemarin telah dibersihkan secara otomatis.', 'info');
        }
    };

    // *** NEW EFFECT: Automatic Daily Cleanup ***
    useEffect(() => {
        const checkAndClearDaily = () => {
            const todayStr = new Date().toLocaleDateString('id-ID');
            const lastClearDate = localStorage.getItem(LAST_CLEAR_DATE_KEY);

            if (lastClearDate !== todayStr) {
                // Check if there is actual data in storage before clearing
                const storedData = loadFromStorage();
                const hasDataToClear = storedData.length > 1 || (storedData.length === 1 && (storedData[0].nama_produk || storedData[0].jumlah > 0));

                if (hasDataToClear) {
                    console.log(`New day detected(${todayStr}).Clearing previous day's input data.`);
                    confirmClearAll(true); // 'true' indicates an auto-clear
                }
                localStorage.setItem(LAST_CLEAR_DATE_KEY, todayStr);
            }
        };

        checkAndClearDaily(); // Run once on component mount
        const intervalId = setInterval(checkAndClearDaily, 60000); // Check every minute
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);


    // Filter rack locations for INPUT MASUK

    // Initialize rows from localStorage or default
    const initializeRows = (): TransactionRow[] => {
        const savedRows = loadFromStorage();
        if (savedRows.length > 0) {
            const today = formatDateDDMMYYYY(new Date());
            const now = formatTimeWithSeconds(new Date());

            // --- FIX: Overwrite date and time on load ---
            // This keeps user's product and quantity data but ensures the date is always current.
            return savedRows.map(row => ({
                ...row,           // Keep all old data from local storage
                tanggal: today, // Overwrite the saved date with today's date
                waktu: now,     // Overwrite the saved time with the current time
            }));
        }
        // This part runs only if localStorage is empty (first time use)
        return [{
            id: '1',
            tanggal: currentDate,
            waktu: currentTime,
            nama_produk: '',
            jumlah: 0,
            type: 'IN',
            gudang: '',
            rak: '',
            stok_tersedia: 0,
            total_stok: 0,
            validationErrors: undefined
        }];
    };

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(formatTimeWithSeconds(new Date()));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const updateDate = () => {
            const now = new Date();
            const todayFormatted = formatDateDDMMYYYY(now);
            if (currentDate !== todayFormatted) {
                setCurrentDate(todayFormatted);
                console.log("Tanggal diperbarui secara otomatis:", todayFormatted);
            }
        };

        const intervalId = setInterval(updateDate, 60 * 60 * 1000); // Check every hour
        updateDate(); // Run on initial component load

        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, [currentDate]);

    const [rows, setRows] = useState<TransactionRow[]>(initializeRows);

    // Save to localStorage whenever rows change
    useEffect(() => {
        saveToStorage(rows);
    }, [rows]);

    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        itemId: string;
        itemName: string;
    }>({
        isOpen: false,
        itemId: '',
        itemName: ''
    });

    // New state for "Clear All" confirmation
    const [clearAllConfirm, setClearAllConfirm] = useState(false);

    const [toast, setToast] = useState<{
        isOpen: boolean;
        message: string;
        type: 'success' | 'info' | 'warning' | 'error';
    }>({
        isOpen: false,
        message: '',
        type: 'info'
    });

    // Column visibility state
    const [visibleColumns, setVisibleColumns] = useState({
        no: true,
        tanggal: true,
        waktu: true,
        nama_produk: true,
        jumlah: true,
        type: true,
        gudang: true,
        rak: true,
        stok_tersedia: true,
        total_stok: true,
        aksi: true
    });

    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const columnToggleRef = useRef<HTMLDivElement>(null);

    // --- RESTORED MISSING STATES with correct types ---
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkInputText, setBulkInputText] = useState('');
    const [analyzedData, setAnalyzedData] = useState<AnalyzedItem[]>([]);
    const [bulkAnalysisResult, setBulkAnalysisResult] = useState({ berhasil: 0, gagal: 0 });

    const [isBulkModal2Open, setIsBulkModal2Open] = useState(false);
    const [bulkInputText2, setBulkInputText2] = useState('');
    const [analyzedData2, setAnalyzedData2] = useState<AnalyzedItem[]>([]);
    const [bulkAnalysisResult2, setBulkAnalysisResult2] = useState({ berhasil: 0, gagal: 0 });

    const [validationAlert, setValidationAlert] = useState<{
        isOpen: boolean;
        invalidCount: number;
        errors: string[];
    }>({
        isOpen: false,
        invalidCount: 0,
        errors: []
    });
    // --- END RESTORED STATES ---

    const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
        setToast({ isOpen: true, message, type });
        setTimeout(() => {
            setToast({ isOpen: false, message: '', type: 'info' });
        }, 4000);
    };

    // A new helper function to fetch all paginated data from a Supabase table
    const fetchPaginatedData = async (tableName: string, columnName: string, sortColumn: string, filterColumn?: string, filterValue?: string, additionalFilter?: { column: string, value: string }) => {
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase.from(tableName).select(columnName);

            if (filterColumn && filterValue) {
                query = query.eq(filterColumn, filterValue);
            }

            if (additionalFilter) {
                query = query.eq(additionalFilter.column, additionalFilter.value);
            }

            const { data, error } = await query
                .order(sortColumn, { ascending: true })
                .range(from, to);

            if (error) {
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                page++;
            } else {
                hasMore = false;
            }
        }

        return allData;
    };


    const syncDropdownData = async () => {
        try {
            setDropdownLoading(true);

            const [productsResult, warehousesData, racksData] = await Promise.all([
                fetchAllProducts(undefined, true),
                fetchPaginatedData('warehouses', 'nama, tampil_di_menu', 'nama', 'status', 'Aktif'),
                fetchPaginatedData('rack_locations', 'nama, tampil_di_menu', 'nama', 'status', 'Aktif')
            ]);

            const productsData = Array.isArray(productsResult.data) ? productsResult.data : [];
            const fetchedProducts = productsData.map((item: any) => item.nama).filter(Boolean);
            const uniqueProducts = [...new Set(fetchedProducts)].sort();

            const filteredWarehouses = warehousesData.filter(item =>
                item.tampil_di_menu === 'KEDUANYA' || item.tampil_di_menu === 'INPUT_MASUK'
            );
            const warehouseNames = filteredWarehouses.map((item: any) => item.nama).filter((name: any) => name && name.trim() !== '');

            const filteredRacks = racksData.filter((item: any) =>
                item.tampil_di_menu === 'KEDUANYA' || item.tampil_di_menu === 'INPUT_MASUK'
            );
            const rackNames = filteredRacks.map((item: any) => item.nama).filter((name: any) => name && name.trim() !== '');

            setValidProducts(uniqueProducts);
            setValidWarehouses(warehouseNames);
            setValidRacks(rackNames);
            saveDropdownCache(PRODUCTS_CACHE_KEY, uniqueProducts);
            saveDropdownCache(WAREHOUSES_CACHE_KEY, warehouseNames);
            saveDropdownCache(RACKS_CACHE_KEY, rackNames);

            console.log("🔄 Fetching fresh stock data from database...");
            const stockResult = await fetchAllStockItems();
            const newStockItems = stockResult.data || [];
            setStockItems(newStockItems);

            // Create a Map for O(1) lookup
            const stockMap = new Map<string, number>();
            newStockItems.forEach((item: any) => {
                if (item.nama_produk && item.rak) {
                    const key = `${item.nama_produk.toLowerCase().trim()}|${item.rak.toLowerCase().trim()}`;
                    stockMap.set(key, item.tersedia || 0);
                }
            });

            console.log("✅ Stock data refreshed, force updating all rows with fresh stock...");
            setRows(prevRows => prevRows.map(row => {
                if (row.nama_produk && row.rak) {
                    const key = `${row.nama_produk.toLowerCase().trim()}|${row.rak.toLowerCase().trim()}`;
                    const stokTersedia = stockMap.get(key) || 0;

                    return {
                        ...row,
                        stok_tersedia: stokTersedia,
                        total_stok: calculateTotalStock(stokTersedia, row.jumlah)
                    };
                }
                return row;
            }));

        } catch (error) {
            console.error('Error syncing all data from Supabase:', error);
            showToast('Gagal sinkronisasi data dari database', 'error');
        } finally {
            setDropdownLoading(false);
        }
    };

    // Load dropdown data from Supabase or cache and setup real-time listeners
    useEffect(() => {
        const loadAndSyncData = async () => {
            try {
                setDropdownLoading(true);
                // Load from cache first
                const cachedProducts = loadDropdownCache(PRODUCTS_CACHE_KEY);
                const cachedWarehouses = loadDropdownCache(WAREHOUSES_CACHE_KEY);
                const cachedRacks = loadDropdownCache(RACKS_CACHE_KEY);

                if (cachedProducts.length > 0 && cachedWarehouses.length > 0 && cachedRacks.length > 0) {
                    console.log('✓ Dropdown data loaded from cache');
                    setValidProducts(cachedProducts);
                    setValidWarehouses(cachedWarehouses);
                    setValidRacks(cachedRacks);
                    // showToast(`Data produk, gudang, dan rak siap!`, 'info'); // Commented out to reduce initial toast
                } else {
                    console.log('No cache found, loading from Supabase...');
                    showToast('Memuat data dari database...', 'info');
                }

                await syncDropdownData();

            } catch (error) {
                console.error('Error during initial load and sync:', error);
                showToast('Gagal memuat data awal!', 'error');
            } finally {
                setDropdownLoading(false);
            }
        };

        const setupRealtimeSubscriptions = () => {
            const channel = supabase.channel('realtime-tables-input-masuk');
            let syncTimer: NodeJS.Timeout | null = null;
            let isUpdating = false;

            const debouncedUpdate = async () => {
                if (isUpdating) {
                    console.log('⏳ Update already in progress, skipping...');
                    return;
                }

                isUpdating = true;
                console.log('⚡ Realtime: Syncing stock data...');

                try {
                    const stockResult = await fetchAllStockItems();
                    const freshStock = stockResult.data || [];
                    setStockItems(freshStock);

                    // Create a Map for O(1) lookup
                    const stockMap = new Map<string, number>();
                    freshStock.forEach((item: any) => {
                        if (item.nama_produk && item.rak) {
                            const key = `${item.nama_produk.toLowerCase().trim()}|${item.rak.toLowerCase().trim()}`;
                            stockMap.set(key, item.tersedia || 0);
                        }
                    });

                    setRows(prevRows => {
                        return prevRows.map(row => {
                            if (row.nama_produk && row.rak) {
                                const key = `${row.nama_produk.toLowerCase().trim()}|${row.rak.toLowerCase().trim()}`;
                                const stokTersedia = stockMap.get(key) || 0;

                                return {
                                    ...row,
                                    stok_tersedia: stokTersedia,
                                    total_stok: calculateTotalStock(stokTersedia, row.jumlah)
                                };
                            }
                            return row;
                        });
                    });

                    console.log('✅ All rows stock updated via realtime');
                    isUpdating = false;
                } catch (err) {
                    console.error('❌ Error updating stock:', err);
                    isUpdating = false;
                }
            };

            channel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, (payload) => {
                    console.log('🔔 Real-time stock_items change detected:', payload.eventType);
                    if (syncTimer) clearTimeout(syncTimer);
                    syncTimer = setTimeout(debouncedUpdate, 1500);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'database_log' }, (payload) => {
                    console.log('🔔 Real-time database_log change detected:', payload.eventType);
                    if (syncTimer) clearTimeout(syncTimer);
                    syncTimer = setTimeout(debouncedUpdate, 1500);
                })
                .subscribe();

            return () => {
                if (syncTimer) clearTimeout(syncTimer);
                supabase.removeChannel(channel);
            };
        };

        loadAndSyncData();
        const unsubscribe = setupRealtimeSubscriptions();

        return () => {
            unsubscribe();
        };
    }, []);


    const addRow = () => {
        // Get gudang value from first row to apply to new rows
        const firstRowGudang = rows.length > 0 ? rows[0].gudang : '';
        const firstRowTanggal = rows.length > 0 ? rows[0].tanggal : currentDate;

        const newRow: TransactionRow = {
            id: 'id-' + Date.now().toString() + '_' + Math.random(),
            tanggal: firstRowTanggal,
            waktu: formatTimeWithSeconds(new Date()),
            nama_produk: '',
            jumlah: 0,
            type: 'IN',
            gudang: firstRowGudang, // Use gudang from first row
            rak: '',
            stok_tersedia: 0,
            total_stok: 0,
            validationErrors: undefined
        };
        setRows([...rows, newRow]);
    };

    const add50Rows = () => {
        // Get gudang value from first row to apply to all new rows
        const firstRowGudang = rows.length > 0 ? rows[0].gudang : '';
        const firstRowTanggal = rows.length > 0 ? rows[0].tanggal : currentDate;

        const newRows: TransactionRow[] = [];
        for (let i = 0; i < 50; i++) {
            newRows.push({
                id: `id-${Date.now()}_${i}-${Math.random()}`,
                tanggal: firstRowTanggal,
                waktu: formatTimeWithSeconds(new Date()),
                nama_produk: '',
                jumlah: 0,
                type: 'IN',
                gudang: firstRowGudang, // Use gudang from first row
                rak: '',
                stok_tersedia: 0,
                total_stok: 0,
                validationErrors: undefined
            });
        }
        setRows([...rows, ...newRows]);
    };

    const handleDeleteClick = (item: TransactionRow) => {
        setDeleteConfirm({
            isOpen: true,
            itemId: item.id,
            itemName: item.nama_produk || 'baris kosong'
        });
    };

    const confirmDelete = () => {
        setRows(rows.filter(row => row.id !== deleteConfirm.itemId));
        setDeleteConfirm({ isOpen: false, itemId: '', itemName: '' });
    };

    // Function to calculate available stock from real-time Supabase data
    const calculateAvailableStock = async (namaProduk: string, rak: string): Promise<number> => {
        try {
            // First check if we have it in our current state (fastest)
            const cachedItem = stockItems.find(s =>
                s.nama_produk?.toLowerCase().trim() === namaProduk.toLowerCase().trim() &&
                s.rak?.toLowerCase().trim() === rak.toLowerCase().trim()
            );

            if (cachedItem) return cachedItem.tersedia;

            // If not in cache, fetch fresh from DB
            const { data, error } = await supabase
                .from('stock_items')
                .select('tersedia')
                .eq('nama_produk', namaProduk)
                .eq('rak', rak)
                .maybeSingle();

            if (error) {
                console.error('Error fetching accurate stock:', error);
                return 0;
            }

            return data?.tersedia || 0;
        } catch (err) {
            console.error('Unexpected error calculating stock:', err);
            return 0;
        }
    };

    // NEW FUNCTION: Calculate total stock
    const calculateTotalStock = (stokTersedia: number, jumlahMasuk: number): number => {
        // Ensure inputs are valid numbers
        const available = typeof stokTersedia === 'number' ? stokTersedia : 0;
        const incoming = typeof jumlahMasuk === 'number' ? jumlahMasuk : 0;
        return available + incoming;
    };


    const updateRow = async (id: string, field: keyof TransactionRow, value: any) => {
        setRows(prevRows => prevRows.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [field]: value };

                if (field === 'nama_produk' || field === 'rak') {
                    updatedRow.stok_tersedia = 0;
                }

                if (field === 'jumlah' || field === 'stok_tersedia') {
                    const stokTersedia = field === 'stok_tersedia' ? value : updatedRow.stok_tersedia;
                    const jumlahMasuk = field === 'jumlah' ? value : updatedRow.jumlah;
                    updatedRow.total_stok = calculateTotalStock(stokTersedia, jumlahMasuk);
                }

                return updatedRow;
            }
            return row;
        }));

        if (field === 'nama_produk' || field === 'rak') {
            const currentRow = rows.find(row => row.id === id);
            if (!currentRow) return;

            const namaProduk = field === 'nama_produk' ? value : currentRow.nama_produk;
            const rak = field === 'rak' ? value : currentRow.rak;

            if (namaProduk && rak) {
                const stokTersedia = await calculateAvailableStock(namaProduk, rak);
                console.log(`📊 Real-time stok tersedia updated: ${namaProduk} @ ${rak} = ${stokTersedia}`);

                setRows(prevRows => prevRows.map(row => {
                    if (row.id === id) {
                        const updatedRow = { ...row, stok_tersedia: stokTersedia };
                        updatedRow.total_stok = calculateTotalStock(stokTersedia, updatedRow.jumlah);
                        return updatedRow;
                    }
                    return row;
                }));
            }
        }
    };

    // Validate dropdown values
    const validateDropdownValue = (field: 'nama_produk' | 'gudang' | 'rak', value: string): boolean => {
        if (!value.trim()) return false;

        switch (field) {
            case 'nama_produk':
                return validProducts.includes(value);
            case 'gudang':
                return validWarehouses.includes(value);
            case 'rak':
                return validRacks.includes(value);
            default:
                return true;
        }
    };

    const handleSubmit = () => {
        handleSubmitToSupabase();
    };

    const handleSubmitToSupabase = async () => {
        setIsSubmitting(true); // Start submission process, disable button
        setRows(rows.map(row => ({ ...row, validationErrors: undefined })));

        // Check if gudang in the first row is empty
        if (rows[0]?.gudang.trim() === '') {
            showToast('Kolom "Gudang" pada baris pertama harus diisi!', 'error');
            const updatedRows = rows.map((row, index) => {
                if (index === 0) {
                    return { ...row, validationErrors: ['gudang'] };
                }
                return row;
            });
            setRows(updatedRows);
            setIsSubmitting(false);
            return;
        }

        const validRows = rows.filter(row =>
            row.nama_produk.trim() !== '' &&
            row.jumlah > 0 &&
            row.rak.trim() !== ''
        );

        const updatedRows = rows.map(row => {
            const hasAnyData = row.nama_produk.trim() !== '' ||
                row.jumlah > 0 ||
                row.gudang.trim() !== '' ||
                row.rak.trim() !== '';

            if (!hasAnyData) {
                return row; // Skip empty rows
            }

            const errors: string[] = [];
            if (row.nama_produk.trim() === '') errors.push('nama_produk');
            else if (!validateDropdownValue('nama_produk', row.nama_produk)) errors.push('nama_produk_invalid');
            if (row.jumlah <= 0) errors.push('jumlah');
            if (row.rak.trim() === '') errors.push('rak');
            else if (!validateDropdownValue('rak', row.rak)) errors.push('rak_invalid');
            if (row.gudang.trim() === '') errors.push('gudang');
            else if (!validateDropdownValue('gudang', row.gudang)) errors.push('gudang_invalid');

            return {
                ...row,
                validationErrors: errors.length > 0 ? errors : undefined
            };
        });

        setRows(updatedRows);

        const invalidRows = updatedRows.filter(row =>
            row.nama_produk.trim() !== '' ||
            row.jumlah > 0 ||
            row.gudang.trim() !== '' ||
            row.rak.trim() !== ''
        ).filter(row =>
            row.nama_produk.trim() === '' ||
            row.jumlah <= 0 ||
            row.rak.trim() === '' ||
            row.gudang.trim() === '' ||
            !validateDropdownValue('nama_produk', row.nama_produk) ||
            !validateDropdownValue('rak', row.rak) ||
            (row.gudang.trim() !== '' && !validateDropdownValue('gudang', row.gudang))
        );

        if (invalidRows.length > 0) {
            const firstInvalidIndex = updatedRows.findIndex(row => row.validationErrors && row.validationErrors.length > 0);
            if (firstInvalidIndex >= 0) {
                const tableContainer = document.querySelector('.table-container');
                const invalidRow = document.querySelector(`[data-row-id="${updatedRows[firstInvalidIndex].id}"]`);
                if (tableContainer && invalidRow) {
                    invalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            setValidationAlert({
                isOpen: true,
                invalidCount: invalidRows.length,
                errors: ['nama_produk', 'jumlah', 'rak', 'gudang']
            });
            setIsSubmitting(false); // Re-enable button on validation failure
            return;
        }

        if (validRows.length === 0) {
            showToast('Tidak ada data yang valid untuk dikirim!', 'error');
            setIsSubmitting(false); // Re-enable button if no valid data
            return;
        }

        try {
            const today = new Date();
            const todayFormatted = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

            const supabaseEntries = validRows.map(row => {
                // Konversi tanggal dari DD/MM/YYYY ke YYYY-MM-DD untuk database
                const [day, month, year] = row.tanggal.split('/');
                const formattedDate = `${year}-${month}-${day}`;

                // Logika tgl_scan: selalu isi dengan tanggal saat ini jika type adalah 'IN'
                const tglScanAuto = (row.type === 'IN') ? todayFormatted : (row.tgl_scan || '');

                return {
                    tgl: formattedDate,
                    waktu: row.waktu,
                    sku: row.nama_produk,
                    jumlah: row.jumlah,
                    type: row.type,
                    gudang: row.gudang,
                    rak: row.rak,
                    sub_rak: '',
                    tgl_scan: tglScanAuto,
                    user_name: userEmail
                };
            });

            const { error } = await supabase
                .from('database_log')
                .insert(supabaseEntries);

            if (error) {
                console.error('Error inserting to Supabase:', error);
                showToast(`Gagal menyimpan data: ${error.message}`, 'error');
                return;
            }

            console.log('Data berhasil disimpan ke Supabase:', validRows.length);

            setRows(rows.map(row => ({ ...row, validationErrors: undefined })));
            confirmClearAll(false); // Call the function to reset data, not an auto clear
            showToast(`Berhasil menyimpan ${validRows.length} transaksi!`, 'success');

        } catch (error) {
            console.error('Error submitting to Supabase:', error);
            showToast('Terjadi kesalahan saat menyimpan data!', 'error');
        } finally {
            setIsSubmitting(false); // Always re-enable button after process finishes
        }
    };

    // Function to trigger the "Clear All" confirmation modal
    const handleClearAllClick = () => {
        setClearAllConfirm(true);
    };

    const toggleColumn = (column: keyof typeof visibleColumns) => {
        setVisibleColumns(prev => ({
            ...prev,
            [column]: !prev[column]
        }));
    };

    const getVisibleColumnsCount = () => {
        const visibleCount = Object.values(visibleColumns).filter(Boolean).length;
        const totalColumns = Object.keys(visibleColumns).length;
        return `${visibleCount}/${totalColumns}`;
    };

    const resetColumns = () => {
        setVisibleColumns({
            no: true,
            tanggal: true,
            waktu: true,
            nama_produk: true,
            jumlah: true,
            type: true,
            gudang: true,
            rak: true,
            stok_tersedia: true,
            total_stok: true,
            aksi: true
        });
    };

    const penyesuaian = () => {
        const initialRowCount = rows.length;
        const filteredRows = rows.filter(row => {
            return row.nama_produk.trim() !== '' || row.jumlah > 0;
        });

        let finalRows;
        if (filteredRows.length === 0) {
            finalRows = [{
                id: 'id-' + Date.now().toString() + '_' + Math.random(),
                tanggal: currentDate,
                waktu: currentTime,
                nama_produk: '',
                jumlah: 0,
                type: 'IN',
                gudang: '',
                rak: '',
                stok_tersedia: 0,
                total_stok: 0
            }];
        } else {
            finalRows = filteredRows;
        }

        const removedCount = initialRowCount - finalRows.length;

        setRows(finalRows);

        if (removedCount > 0) {
            showToast(`Penyesuaian berhasil! ${removedCount} baris kosong telah dihapus.`, 'success');
        } else {
            showToast('Tabel sudah dalam kondisi optimal, tidak ada baris kosong.', 'info');
        }
    };

    // --- BULK INPUT MODAL 1 LOGIC (default) ---

    const openBulkModal = () => {
        setIsBulkModalOpen(true);
    };

    const resetBulkModal = () => {
        setBulkInputText('');
        setAnalyzedData([]);
        setBulkAnalysisResult({ berhasil: 0, gagal: 0 });
    };

    const handleBulkAnalyze = () => {
        if (!bulkInputText.trim()) {
            showToast('Tidak ada data untuk dianalisa.', 'warning');
            return;
        }

        const lines = bulkInputText.split('\n');
        const newAnalyzedData: AnalyzedItem[] = [];
        let successCount = 0;
        let failCount = 0;

        lines.forEach(line => {
            const parts = line.trim().split(/\t| {2,}/); // Split by tab or multiple spaces
            if (parts.length >= 2) {
                const nama_produk = parts[0].trim();
                const jumlah = parseInt(parts[1].trim());

                if (nama_produk && !isNaN(jumlah) && jumlah > 0) {
                    newAnalyzedData.push({ nama_produk, jumlah, isValid: true });
                    successCount++;
                } else {
                    newAnalyzedData.push({ nama_produk: parts[0] || 'Tidak Valid', jumlah: isNaN(jumlah) ? 0 : jumlah, isValid: false });
                    failCount++;
                }
            } else if (line.trim() !== '') {
                failCount++;
            }
        });

        setAnalyzedData(newAnalyzedData.filter(item => item.isValid));
        setBulkAnalysisResult({ berhasil: successCount, gagal: failCount });
    };

    const handleBulkAdd = () => {
        if (analyzedData.length === 0) {
            showToast('Tidak ada data valid untuk ditambahkan.', 'warning');
            return;
        }

        const firstRowGudang = rows.length > 0 ? rows[0].gudang : '';
        const firstRowTanggal = rows.length > 0 ? rows[0].tanggal : currentDate;

        const newRowsFromBulk: TransactionRow[] = analyzedData.map(item => {
            const stokTersedia = 0; // Set available stock to 0

            return {
                id: 'id-' + Date.now().toString() + '_' + Math.random(),
                tanggal: firstRowTanggal,
                waktu: formatTimeWithSeconds(new Date()),
                nama_produk: item.nama_produk,
                jumlah: item.jumlah,
                type: 'IN',
                gudang: firstRowGudang,
                rak: '', // EMPTY THE RACK COLUMN
                stok_tersedia: stokTersedia,
                total_stok: calculateTotalStock(stokTersedia, item.jumlah),
                validationErrors: undefined
            };
        });

        if (rows.length === 1 && rows[0].nama_produk === '' && rows[0].jumlah === 0) {
            setRows(newRowsFromBulk);
        } else {
            setRows(prevRows => [...prevRows, ...newRowsFromBulk]);
        }

        showToast(`${analyzedData.length} baris berhasil ditambahkan!`, 'success');
        setIsBulkModalOpen(false);
        resetBulkModal();
    };
    // --- END OF BULK INPUT MODAL 1 LOGIC ---

    // --- BULK INPUT MODAL 2 LOGIC ---

    const openBulkModal2 = () => {
        setIsBulkModal2Open(true);
    };

    const resetBulkModal2 = () => {
        setBulkInputText2('');
        setAnalyzedData2([]);
        setBulkAnalysisResult2({ berhasil: 0, gagal: 0 });
    };

    const handleBulkAnalyze2 = () => {
        if (!bulkInputText2.trim()) {
            showToast('Tidak ada data untuk dianalisa.', 'warning');
            return;
        }

        const lines = bulkInputText2.split('\n');
        const newAnalyzedData: AnalyzedItem[] = [];
        let successCount = 0;
        let failCount = 0;

        lines.forEach(line => {
            const parts = line.trim().split(/\t| {2,}/); // Split by tab or multiple spaces
            if (parts.length >= 3) { // Check for 3 parts
                const nama_produk = parts[0].trim();
                const jumlah = parseInt(parts[1].trim());
                const rak = parts[2].trim();

                if (nama_produk && !isNaN(jumlah) && jumlah > 0 && rak) {
                    newAnalyzedData.push({ nama_produk, jumlah, rak, isValid: true });
                    successCount++;
                } else {
                    newAnalyzedData.push({ nama_produk: parts[0] || 'Tidak Valid', jumlah: isNaN(jumlah) ? 0 : jumlah, rak: parts[2] || 'Tidak Valid', isValid: false });
                    failCount++;
                }
            } else if (line.trim() !== '') {
                failCount++;
            }
        });

        setAnalyzedData2(newAnalyzedData.filter(item => item.isValid));
        setBulkAnalysisResult2({ berhasil: successCount, gagal: failCount });
    };

    const handleBulkAdd2 = async () => {
        if (analyzedData2.length === 0) {
            showToast('Tidak ada data valid untuk ditambahkan.', 'warning');
            return;
        }

        const firstRowGudang = rows.length > 0 ? rows[0].gudang : '';
        const firstRowTanggal = rows.length > 0 ? rows[0].tanggal : currentDate;

        const newRowsFromBulk: TransactionRow[] = await Promise.all(analyzedData2.map(async (item) => {
            const stokTersedia = await calculateAvailableStock(item.nama_produk, item.rak || '');
            return {
                id: 'id-' + Date.now().toString() + '_' + Math.random(),
                tanggal: firstRowTanggal,
                waktu: formatTimeWithSeconds(new Date()),
                nama_produk: item.nama_produk,
                jumlah: item.jumlah,
                type: 'IN',
                gudang: firstRowGudang,
                rak: item.rak || '',
                stok_tersedia: stokTersedia,
                total_stok: calculateTotalStock(stokTersedia, item.jumlah),
                validationErrors: undefined
            };
        }));

        if (rows.length === 1 && rows[0].nama_produk === '' && rows[0].jumlah === 0) {
            setRows(newRowsFromBulk);
        } else {
            setRows(prevRows => [...prevRows, ...newRowsFromBulk]);
        }

        showToast(`${analyzedData2.length} baris berhasil ditambahkan!`, 'success');
        setIsBulkModal2Open(false);
        resetBulkModal2();
    };
    const analyzePaste2 = () => {
        // We let the paste happen, then analyze after a short delay
        setTimeout(() => {
            handleBulkAnalyze2();
        }, 100);
    };

    // --- NEW FUNCTION: AUTO RACK ---
    const fetchAllStockItemsUnlimited = async () => {
        let allItems: any[] = [];
        let from = 0;
        const size = 1000;
        let hasMore = true;

        console.log('🔄 Fetching unlimited stock items...');

        while (hasMore) {
            const { data, error } = await supabase
                .from('stock_items')
                .select('nama_produk, rak, tersedia')
                // Removed .eq('status', 'Aktif') to find ALL historical locations, even if currently empty/inactive
                .range(from, from + size - 1);

            if (error) {
                console.error('Error fetching stock batch:', error);
                break; // Stop on error, but return what we have? Or throw?
            }

            if (data && data.length > 0) {
                allItems = [...allItems, ...data];
                console.log(`   Fetched batch ${from}-${from + data.length}. Total: ${allItems.length}`);
                if (data.length < size) {
                    hasMore = false;
                } else {
                    from += size;
                }
            } else {
                hasMore = false;
            }
        }

        console.log(`✅ Finished fetching. Total items: ${allItems.length}`);
        return allItems;
    };

    // --- NEW FUNCTION: AUTO RACK ---
    const handleOtomatisRak = async () => {
        showToast('Mencari rak otomatis... (Memuat data terbaru)', 'info');

        try {
            // 1. Fetch Fresh Data directly (UNLIMITED)
            console.log('🚀 Starting Auto Rack process...');
            const freshStockItems = await fetchAllStockItemsUnlimited();
            console.log(`📦 Fetched ${freshStockItems?.length || 0} stock items.`);

            if (!freshStockItems || freshStockItems.length === 0) {
                console.error('❌ Failed to fetch stock items or empty result.');
                showToast('Gagal memuat data stok untuk otomatisasi.', 'error');
                return;
            }

            const rackPriorityOrder = ['LANTAI 4', 'LANTAI 2', 'UTAMA', 'ECER-M', 'ECER-N', 'ECER-O'];

            // 2. Fetch ALL Rack Exclusions/Priorities (Paginated)
            console.log('🔄 Fetching all rack exclusions/priorities...');
            let allExclusions: any[] = [];
            let excFrom = 0;
            const excSize = 1000;
            let hasMoreExc = true;

            while (hasMoreExc) {
                const { data, error } = await supabase
                    .from('product_rack_exclusions')
                    .select('nama_produk, rak, is_excluded')
                    .range(excFrom, excFrom + excSize - 1);

                if (error) {
                    console.error('❌ Error fetching exclusions:', error);
                    break;
                }

                if (data && data.length > 0) {
                    allExclusions = [...allExclusions, ...data];
                    excFrom += excSize;
                    hasMoreExc = data.length === excSize;
                } else {
                    hasMoreExc = false;
                }
            }
            console.log(`✅ Fetched ${allExclusions.length} exclusions.`);

            const exclusionMap = new Map<string, Set<string>>();
            const explicitActiveMap = new Map<string, Set<string>>();

            allExclusions.forEach(exc => {
                // Normalize: lowercase, trim, single spaces
                const key = exc.nama_produk.toLowerCase().trim().replace(/\s+/g, ' ');
                const rak = exc.rak.toLowerCase().trim().replace(/\s+/g, ' ');

                if (exc.is_excluded) {
                    if (!exclusionMap.has(key)) exclusionMap.set(key, new Set());
                    exclusionMap.get(key)?.add(rak);
                } else {
                    if (!explicitActiveMap.has(key)) explicitActiveMap.set(key, new Set());
                    explicitActiveMap.get(key)?.add(rak);
                }
            });

            const updatedRows = [...rows];
            let rowsUpdatedCount = 0;

            for (let i = 0; i < updatedRows.length; i++) {
                const row = updatedRows[i];
                // Only process if Rak is empty AND Nama Produk is not empty
                if (row.rak.trim() !== '' || row.nama_produk.trim() === '') {
                    continue;
                }

                const productKey = row.nama_produk.toLowerCase().trim().replace(/\s+/g, ' ');
                const excludedRacks = exclusionMap.get(productKey) || new Set();
                const explicits = explicitActiveMap.get(productKey) || new Set();

                let bestMatch: any = undefined;

                // --- TIER 0: FORCED SKU MAPPINGS ---
                const forcedECERN = ['PAINT-ACC-30ML', 'PAINT-ACC-75ML', 'PAINT-ACC-B30', 'PAINT-ACC-B75'];
                const forcedECERM = ['PAINT-POC-10ML', 'WHITEBOARD-WB-120'];

                if (forcedECERN.some(k => productKey.includes(k.toLowerCase()))) {
                    bestMatch = { rak: 'ECER-N', tersedia: 0 };
                    console.log(`⚡ Forced Match (ECER-N): ${productKey}`);
                } else if (forcedECERM.some(k => productKey.includes(k.toLowerCase()))) {
                    bestMatch = { rak: 'ECER-M', tersedia: 0 };
                    console.log(`⚡ Forced Match (ECER-M): ${productKey}`);
                }

                if (!bestMatch) {
                    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
                    const shelfRegex = /^[A-Z]{1,3}\s*-?\s*\d+$/i;
                    const safeKeywords = ['LANTAI', 'UTAMA', 'ECER', 'GUDANG', 'STORE', 'TOKO', 'OFFICE', 'KANTOR', 'AREA', 'DEPAN', 'BELAKANG', 'TENGAH'];

                    // 1. Build Initial Candidates from Stock
                    let candidates = freshStockItems
                        .filter(item => normalize(item.nama_produk || '') === productKey)
                        .map(item => ({
                            ...item,
                            isExplicit: explicits.has(normalize(item.rak || ''))
                        }));

                    // 2. Augment with Explicitly AKTIF racks (add as virtual if not already there)
                    explicits.forEach(expRak => {
                        const normExp = normalize(expRak);
                        if (!candidates.some(c => normalize(c.rak || '') === normExp)) {
                            candidates.push({
                                id: 'virtual-' + Math.random(),
                                nama_produk: row.nama_produk,
                                rak: expRak.toUpperCase(), // Presentation casing
                                tersedia: 0,
                                isExplicit: true
                            });
                        }
                    });

                    // 3. Filter Candidates
                    candidates = candidates.filter(item => {
                        const rakName = item.rak || '';
                        const normRak = normalize(rakName);

                        // Rule: Not NONAKTIF
                        if (excludedRacks.has(normRak)) return false;

                        // Rule: Allowed if AKTIF in settings
                        if (item.isExplicit) return true;

                        // Rule: Allowed if safe keyword
                        if (safeKeywords.some(kw => normRak.includes(kw.toLowerCase()))) return true;

                        // Rule: Allowed if not a generic shelf code
                        return !shelfRegex.test(rakName);
                    });

                    console.log(`🔎 Item: ${productKey}`, {
                        candidates: candidates.map(c => `${c.rak} (Stock:${c.tersedia}, Explicit:${c.isExplicit})`)
                    });

                    // 4. Selection based on Hierarchy first
                    for (const priorityRak of rackPriorityOrder) {
                        const normPriority = normalize(priorityRak);
                        const match = candidates.find(c => normalize(c.rak || '') === normPriority);
                        if (match) {
                            bestMatch = match;
                            console.log(`⭐ Found Hierarchy Match: ${bestMatch.rak}`);
                            break;
                        }
                    }

                    // 5. Stock fallback for non-hierarchy candidates
                    if (!bestMatch && candidates.length > 0) {
                        candidates.sort((a, b) => (b.tersedia || 0) - (a.tersedia || 0));
                        bestMatch = candidates[0];
                        console.log(`📦 Found Stock Fallback: ${bestMatch.rak}`);
                    }
                }

                if (bestMatch) {
                    updatedRows[i] = {
                        ...row,
                        rak: bestMatch.rak,
                        stok_tersedia: bestMatch.tersedia || 0,
                        total_stok: calculateTotalStock(bestMatch.tersedia || 0, row.jumlah)
                    };
                    rowsUpdatedCount++;
                }
            }

            setRows(updatedRows);

            if (rowsUpdatedCount > 0) {
                showToast(`Otomatisasi rak berhasil! ${rowsUpdatedCount} baris telah diperbarui.`, 'success');
            } else {
                showToast('Tidak ada data yang cocok untuk diotomatisasi.', 'warning');
            }
        } catch (error) {
            console.error('Error in handleOtomatisRak:', error);
            showToast('Terjadi kesalahan saat mencari rak otomatis', 'error');
        }
    };
    // --- END NEW FUNCTION: AUTO RACK ---

    return (
        <>
            {/* Toast Notification */}
            <Toast
                isOpen={toast.isOpen}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ isOpen: false, message: '', type: 'info' })}
            />

            {/* ======================================================== */}
            {/* PREMIUM RESPONSIVE HEADER & ACTIONS (Mobile & Desktop) */}
            {/* ======================================================== */}
            <div className="flex flex-col mb-8 lg:mb-12">
                {/* Full Immersive Background Banner with Floating Shapes */}
                <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 -mx-3 lg:-mx-8 pt-[90px] lg:pt-0 lg:h-[310px] pb-[75px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-blue-900/20 relative overflow-hidden transition-all duration-500 flex flex-col justify-center">

                    {/* Decorative Background Icon */}
                    <div className="absolute -top-6 -right-6 text-white opacity-5">
                        <Package className="w-64 h-64 lg:w-96 lg:h-96" />
                    </div>

                    {/* Decorative Floating Shapes */}
                    <div className="absolute top-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute top-24 left-1/4 w-16 h-16 bg-white/5 border border-white/10 rounded-2xl rotate-[35deg] backdrop-blur-sm hidden lg:block"></div>
                    <div className="absolute bottom-10 right-1/3 w-12 h-12 bg-white/10 rounded-full border border-white/20 hidden lg:block"></div>
                    <div className="absolute top-1/2 right-20 w-16 h-16 bg-blue-400/20 rounded-3xl -rotate-12 blur-xl hidden lg:block"></div>

                    {/* Text Content */}
                    <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 uppercase">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-2 mb-2 lg:mb-3 opacity-90">
                                <div className="w-8 h-[2px] bg-white rounded-full"></div>
                                <span className="text-[10px] lg:text-[12px] font-black tracking-[0.3em] text-white">Logistics V5</span>
                            </div>
                            <h1 className="text-[34px] lg:text-[54px] font-black text-white tracking-tight leading-[1.1] mb-2 uppercase">
                                Barang <span className="text-blue-200">Masuk</span>
                            </h1>
                            <div className="text-blue-100/90 font-medium text-[14px] lg:text-[18px] leading-relaxed max-w-[90%] normal-case">
                                {dropdownLoading ? (
                                    <span className="animate-pulse flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" /> Sinkronisasi data...
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </span>
                                        <span className="font-black text-white">Digital System</span> - Input Berbasis Barcode
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Desktop Action Buttons */}
                        <div className="hidden lg:flex flex-wrap gap-4">
                            <Button
                                onClick={handleSubmit}
                                className="h-14 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-3 border border-emerald-400/20"
                                disabled={isSubmitting}
                            >
                                <Send className={`h-5 w-5 ${isSubmitting ? 'animate-pulse' : ''}`} />
                                KIRIM DATA
                            </Button>

                            <Button
                                onClick={syncDropdownData}
                                className="h-14 px-8 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-3 border border-white/20 backdrop-blur-md"
                                disabled={isSubmitting || dropdownLoading}
                            >
                                <RefreshCw className={`h-5 w-5 ${dropdownLoading ? 'animate-spin' : ''}`} />
                                SYNC
                            </Button>

                            <Button
                                onClick={handleClearAllClick}
                                className="h-14 px-8 bg-rose-500/80 hover:bg-rose-600 text-white font-black rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-3 border border-rose-400/20 backdrop-blur-md"
                                disabled={isSubmitting}
                            >
                                <Trash className="h-5 w-5" />
                                RESET
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6 lg:space-y-10 lg:px-10 pb-12">


                {/* Grid Stats - Hidden on Mobile */}
                <div className="hidden lg:block bg-white/50 backdrop-blur-sm p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="grid grid-cols-3 lg:grid-cols-3 gap-2 md:gap-4 text-sm">
                        <div className="flex flex-col lg:flex-row lg:items-center p-2 bg-white rounded-lg border border-gray-50 items-center text-center lg:text-left transition-all hover:border-blue-100 group">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg lg:mr-3 group-hover:bg-blue-600 group-hover:text-white transition-colors mb-1 lg:mb-0">
                                <Box className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[8px] lg:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Produk</p>
                                <p className={`text-[10px] lg:text-sm font-black ${validProducts.length > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                    {validProducts.length.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row lg:items-center p-2 bg-white rounded-lg border border-gray-50 items-center text-center lg:text-left transition-all hover:border-emerald-100 group">
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg lg:mr-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-1 lg:mb-0">
                                <Warehouse className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[8px] lg:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Gudang</p>
                                <p className={`text-[10px] lg:text-sm font-black ${validWarehouses.length > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                    {validWarehouses.length}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row lg:items-center p-2 bg-white rounded-lg border border-gray-50 items-center text-center lg:text-left transition-all hover:border-purple-100 group">
                            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg lg:mr-3 group-hover:bg-purple-600 group-hover:text-white transition-colors mb-1 lg:mb-0">
                                <LayoutGrid className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[8px] lg:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rak</p>
                                <p className={`text-[10px] lg:text-sm font-black ${validRacks.length > 0 ? 'text-purple-600' : 'text-orange-600'}`}>
                                    {validRacks.length.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile: Action Grid - Hidden (buttons now in bottom dock) */}
                <div className="hidden grid grid-cols-3 gap-2 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                    <Button
                        onClick={addRow}
                        className="bg-blue-600 text-white font-bold rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm border-none"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">Baris</span>
                    </Button>

                    <Button
                        onClick={handleOtomatisRak}
                        className="bg-emerald-600 text-white font-bold rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm border-none"
                    >
                        <Warehouse className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">Auto Rak</span>
                    </Button>

                    <Button
                        onClick={add50Rows}
                        variant="secondary"
                        className="bg-white text-blue-600 border border-blue-100 rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">+50</span>
                    </Button>

                    <Button
                        onClick={penyesuaian}
                        variant="secondary"
                        className="bg-white text-gray-600 border border-gray-200 rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm"
                    >
                        <Settings className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">Atur</span>
                    </Button>

                    <Button
                        onClick={() => setShowColumnToggle(!showColumnToggle)}
                        variant="secondary"
                        className="bg-white text-amber-600 border border-amber-100 rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm"
                    >
                        <LayoutGrid className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">Kolom</span>
                    </Button>

                    <Button
                        onClick={() => setShowAdvancedButtons(!showAdvancedButtons)}
                        variant="secondary"
                        className={`rounded-xl h-10 px-0 flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-sm border ${showAdvancedButtons ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-gray-600 border-gray-100'}`}
                    >
                        <Layers className="h-4 w-4" />
                        <span className="text-[9px] uppercase tracking-tighter">Massal</span>
                    </Button>

                    {showAdvancedButtons && (
                        <div className="col-span-3 grid grid-cols-2 gap-2 mt-1 animate-in slide-in-from-top-2 duration-200">
                            <Button
                                onClick={openBulkModal}
                                className="bg-purple-50 text-purple-700 border border-purple-100 h-9 rounded-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Layers className="h-4 w-4" />
                                <span className="text-[10px] font-bold uppercase">Massal 1</span>
                            </Button>
                            <Button
                                onClick={openBulkModal2}
                                className="bg-violet-50 text-violet-700 border border-violet-100 h-9 rounded-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Layers className="h-4 w-4" />
                                <span className="text-[10px] font-bold uppercase">Massal 2</span>
                            </Button>
                        </div>
                    )}

                    {showColumnToggle && (
                        <div
                            ref={columnToggleRef}
                            className="fixed inset-x-4 top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                        >
                            <div className="p-4 border-b border-gray-100 bg-blue-600 text-white flex justify-between items-center sticky top-0 transition-all">
                                <h3 className="font-black text-sm uppercase tracking-wider">Tampilkan Kolom</h3>
                                <button onClick={() => setShowColumnToggle(false)} className="p-1 hover:bg-white/10 rounded-full">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-4 grid grid-cols-1 gap-1">
                                {[
                                    { key: 'no', label: 'Nomor Urut' },
                                    { key: 'tanggal', label: 'Tanggal' },
                                    { key: 'waktu', label: 'Waktu' },
                                    { key: 'nama_produk', label: 'Nama Produk' },
                                    { key: 'jumlah', label: 'Jumlah' },
                                    { key: 'type', label: 'Type' },
                                    { key: 'gudang', label: 'Gudang' },
                                    { key: 'rak', label: 'Rak' },
                                    { key: 'stok_tersedia', label: 'Tersedia' },
                                    { key: 'total_stok', label: 'Total' },
                                    { key: 'aksi', label: 'Aksi' }
                                ].map(({ key, label }) => (
                                    <label key={key} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns[key as keyof typeof visibleColumns]}
                                            onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                                            className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                        />
                                        <span className="text-sm font-bold text-gray-700">{label}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50">
                                <Button onClick={resetColumns} className="w-full h-11 bg-white text-gray-600 border border-gray-200 font-bold rounded-xl active:scale-95 shadow-sm">
                                    Reset Pengaturan Kolom
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop: Action Toolbar - Hidden on Mobile */}
                <div className="hidden lg:block bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={addRow}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white border-blue-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-blue-200"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Baris</span>
                        </Button>

                        <Button
                            onClick={add50Rows}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white border-sky-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-sky-200"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">+50</span>
                        </Button>

                        <Button
                            onClick={handleOtomatisRak}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-emerald-200"
                        >
                            <Warehouse className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Auto Rak</span>
                        </Button>

                        <Button
                            onClick={penyesuaian}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white border-gray-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-gray-200"
                        >
                            <Settings className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Atur</span>
                        </Button>

                        <Button
                            onClick={openBulkModal}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-indigo-200"
                        >
                            <Layers className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Massal 1</span>
                        </Button>

                        <Button
                            onClick={openBulkModal2}
                            variant="outline"
                            className="h-10 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white border-violet-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-violet-200"
                        >
                            <Layers className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Massal 2</span>
                        </Button>

                        <div className="relative">
                            <Button
                                onClick={() => setShowColumnToggle(!showColumnToggle)}
                                variant="outline"
                                className="h-10 px-4 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white border-amber-500 rounded-xl transition-all active:scale-95 shadow-sm shadow-amber-200"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">Kolom ({getVisibleColumnsCount()})</span>
                            </Button>

                            {showColumnToggle && (
                                <div
                                    ref={columnToggleRef}
                                    className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 min-w-[280px] max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2"
                                >
                                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 backdrop-blur-md flex justify-between items-center">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-gray-500">Kolom</h3>
                                        <button onClick={() => setShowColumnToggle(false)} className="p-1 hover:bg-gray-200 rounded-full"><X className="h-4 w-4" /></button>
                                    </div>
                                    <div className="p-2 grid grid-cols-1 gap-1">
                                        {[
                                            { key: 'no', label: 'No' },
                                            { key: 'tanggal', label: 'Tanggal' },
                                            { key: 'nama_produk', label: 'Nama Produk' },
                                            { key: 'jumlah', label: 'Jumlah' },
                                            { key: 'gudang', label: 'Gudang' },
                                            { key: 'rak', label: 'Rak' },
                                            { key: 'aksi', label: 'Aksi' }
                                        ].map(({ key, label }) => (
                                            <label key={key} className="flex items-center space-x-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer">
                                                <input type="checkbox" checked={visibleColumns[key as keyof typeof visibleColumns]} onChange={() => toggleColumn(key as keyof typeof visibleColumns)} className="w-4 h-4 rounded border-gray-300" />
                                                <span className="text-sm font-bold text-gray-600 uppercase tracking-tight">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transaction Table & Cards */}
                <Card className="overflow-hidden border-none shadow-xl">
                    <CardContent className="p-0">
                        {/* Desktop View: Table */}
                        <div className="hidden lg:block">
                            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                    <span>Gunakan shortcut keyboard untuk navigasi cepat</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Desktop View Optimized</span>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-sm">
                                    <thead className="bg-blue-600 text-white sticky top-0 z-20 shadow-md">
                                        <tr>
                                            {visibleColumns.no && <th className="px-4 py-4 text-center font-bold border-r border-blue-500 w-16 whitespace-nowrap uppercase tracking-wider">No</th>}
                                            {visibleColumns.tanggal && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-32 whitespace-nowrap uppercase tracking-wider">Tanggal</th>}
                                            {visibleColumns.waktu && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-24 whitespace-nowrap uppercase tracking-wider">Waktu</th>}
                                            {visibleColumns.nama_produk && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-72 whitespace-nowrap uppercase tracking-wider">Nama Produk</th>}
                                            {visibleColumns.jumlah && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-24 whitespace-nowrap uppercase tracking-wider">Jumlah</th>}
                                            {visibleColumns.type && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-20 whitespace-nowrap uppercase tracking-wider">Type</th>}
                                            {visibleColumns.gudang && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-32 whitespace-nowrap uppercase tracking-wider">Gudang</th>}
                                            {visibleColumns.rak && <th className="px-4 py-4 text-left font-bold border-r border-blue-500 w-32 whitespace-nowrap uppercase tracking-wider">Rak</th>}
                                            {visibleColumns.stok_tersedia && <th className="px-4 py-4 text-center font-bold border-r border-blue-500 w-24 whitespace-nowrap uppercase tracking-wider text-xs">Tersedia</th>}
                                            {visibleColumns.total_stok && <th className="px-4 py-4 text-center font-bold border-r border-blue-500 w-24 whitespace-nowrap uppercase tracking-wider text-xs">Total</th>}
                                            {visibleColumns.aksi && <th className="px-4 py-4 text-center font-bold w-20 whitespace-nowrap uppercase tracking-wider">Aksi</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {rows.map((row, index) => (
                                            <tr
                                                key={row.id}
                                                data-row-id={row.id}
                                                className={`hover:bg-blue-50/50 transition-colors ${row.validationErrors && row.validationErrors.length > 0 ? 'bg-red-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                                    }`}
                                            >
                                                {visibleColumns.no && <td className="px-4 py-3 text-center border-r border-gray-100 text-sm font-bold text-gray-400">{index + 1}</td>}
                                                {visibleColumns.tanggal && <td className="px-4 py-3 border-r border-gray-100">
                                                    {index === 0 ? (
                                                        <div className="relative group">
                                                            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-500 pointer-events-none group-focus-within:text-blue-600" />
                                                            <input
                                                                type="date"
                                                                value={convertToInputDate(row.tanggal)}
                                                                onChange={(e) => {
                                                                    const newDate = convertFromInputDate(e.target.value);
                                                                    setRows(rows.map(r => ({ ...r, tanggal: newDate })));
                                                                }}
                                                                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-gray-700 hover:border-blue-300"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="px-3 py-1.5 text-sm text-gray-500 bg-gray-50/50 rounded-lg font-medium flex items-center gap-2 border border-gray-100">
                                                            <Calendar className="h-3.5 w-3.5 text-gray-300" />
                                                            {row.tanggal}
                                                        </div>
                                                    )}
                                                </td>}
                                                {visibleColumns.waktu && <td className="px-4 py-3 border-r border-gray-100">
                                                    <div className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50/50 rounded-lg font-mono font-bold flex items-center gap-2 border border-blue-100">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {row.waktu}
                                                    </div>
                                                </td>}
                                                {visibleColumns.nama_produk && <td className="px-4 py-3 border-r border-gray-100">
                                                    <div className="relative group min-w-[300px]">
                                                        <CustomDropdown
                                                            value={row.nama_produk}
                                                            onChange={(e) => updateRow(row.id, 'nama_produk', e.target.value)}
                                                            options={validProducts}
                                                            placeholder="Pilih atau ketik nama produk..."
                                                            className={`text-sm font-medium ${row.validationErrors?.includes('nama_produk') || row.validationErrors?.includes('nama_produk_invalid')
                                                                ? 'border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500'
                                                                : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 group-hover:border-blue-300'
                                                                }`}
                                                            isInTable={true}
                                                            loading={dropdownLoading}
                                                        />
                                                    </div>
                                                    {(row.validationErrors?.includes('nama_produk') || row.validationErrors?.includes('nama_produk_invalid')) && (
                                                        <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-tight pl-1">
                                                            {row.validationErrors?.includes('nama_produk') ? 'Wajib diisi' : 'Produk tidak valid'}
                                                        </p>
                                                    )}
                                                </td>}
                                                {visibleColumns.jumlah && <td className="px-4 py-3 border-r border-gray-100">
                                                    <div className="relative group">
                                                        <Edit3 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none group-focus-within:text-blue-500" />
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={row.jumlah === 0 ? '' : row.jumlah}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                                updateRow(row.id, 'jumlah', parseInt(val) || 0);
                                                            }}
                                                            className={`w-full pl-8 pr-2 py-1.5 border rounded-lg text-sm text-center font-black focus:ring-2 outline-none transition-all ${row.validationErrors?.includes('jumlah')
                                                                ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                                                : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 group-hover:border-blue-300'
                                                                }`}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </td>}
                                                {visibleColumns.type && <td className="px-4 py-3 border-r border-gray-100">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                                                        {row.type}
                                                    </span>
                                                </td>}
                                                {visibleColumns.gudang && <td className="px-4 py-3 border-r border-gray-100">
                                                    {index === 0 ? (
                                                        <div className="relative min-w-[120px]">
                                                            <CustomDropdown
                                                                value={row.gudang}
                                                                onChange={(e) => {
                                                                    const newGudang = e.target.value;
                                                                    setRows(rows.map(r => ({ ...r, gudang: newGudang })));
                                                                }}
                                                                options={validWarehouses}
                                                                placeholder="Gudang..."
                                                                className={`text-sm font-medium ${row.validationErrors?.includes('gudang') || row.validationErrors?.includes('gudang_invalid')
                                                                    ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                                                    : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                                                                    }`}
                                                                isInTable={true}
                                                                loading={dropdownLoading}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className={`px-3 py-1.5 text-sm rounded-lg font-bold border ${row.validationErrors?.includes('gudang') || row.validationErrors?.includes('gudang_invalid')
                                                            ? 'text-red-600 bg-red-50 border-red-200 uppercase tracking-tight'
                                                            : 'text-gray-600 bg-gray-50 border-gray-100'
                                                            }`}>
                                                            {row.gudang || '-'}
                                                        </div>
                                                    )}
                                                </td>}
                                                {visibleColumns.rak && <td className="px-4 py-3 border-r border-gray-100">
                                                    <div className="relative min-w-[120px]">
                                                        <CustomDropdown
                                                            value={row.rak}
                                                            onChange={(e) => updateRow(row.id, 'rak', e.target.value)}
                                                            options={filteredRackOptions}
                                                            placeholder="Rak..."
                                                            className={`text-sm font-bold ${row.validationErrors?.includes('rak') || row.validationErrors?.includes('rak_invalid')
                                                                ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                                                : 'border-gray-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                                                                }`}
                                                            isInTable={true}
                                                            loading={dropdownLoading}
                                                            showClearButton={true}
                                                        />
                                                    </div>
                                                </td>}
                                                {visibleColumns.stok_tersedia && <td className="px-4 py-3 text-center border-r border-gray-100">
                                                    <div className={`inline-block px-4 py-1.5 rounded-lg text-xs font-black ring-1 ${row.stok_tersedia > 0 ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-red-50 text-red-700 ring-red-200'
                                                        }`}>
                                                        {row.stok_tersedia}
                                                    </div>
                                                </td>}
                                                {visibleColumns.total_stok && <td className="px-4 py-3 text-center border-r border-gray-100">
                                                    <div className={`inline-block px-4 py-1.5 rounded-lg text-xs font-black ring-1 ${row.total_stok > 0 ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-gray-50 text-gray-500 ring-gray-200'
                                                        }`}>
                                                        {row.total_stok}
                                                    </div>
                                                </td>}
                                                {visibleColumns.aksi && <td className="px-4 py-3 text-center">
                                                    <Button
                                                        onClick={() => handleDeleteClick(row)}
                                                        className="h-8 w-8 p-0 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 rounded-lg transition-all border border-rose-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile View: Row Cards */}
                        <div className="lg:hidden flex flex-col gap-4 px-1 py-3 -mx-2">
                            {rows.length === 0 ? (
                                <div className="p-10 text-center space-y-3">
                                    <div className="flex justify-center">
                                        <div className="p-4 bg-gray-50 rounded-full border border-gray-100">
                                            <Trash className="h-8 w-8 text-gray-300" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tidak ada data transaksi</p>
                                    <Button onClick={addRow} variant="ghost" className="text-blue-600 font-bold uppercase text-[10px] tracking-widest">Tambah Baris Baru</Button>
                                </div>
                            ) : (
                                rows.map((row, index) => (
                                    <div key={row.id} className={`relative p-5 space-y-4 tracking-tight rounded-[20px] transition-all duration-300 group overflow-hidden ${row.validationErrors?.length ? 'bg-red-50/10 border border-red-200 ring-2 ring-red-100 shadow-sm' : index === 0 ? 'bg-white border-blue-200 ring-2 ring-blue-100 shadow-[0_8px_30px_-6px_rgba(59,130,246,0.15)] hover:shadow-[0_12px_35px_-6px_rgba(59,130,246,0.2)]' : 'bg-white border border-gray-200/70 hover:border-blue-200 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.10)] hover:shadow-[0_12px_35px_-6px_rgba(0,0,0,0.15)]'}`}>
                                        {/* Decorative Line border on Left */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-[5px] rounded-l-[20px] opacity-90 transition-all ${row.validationErrors?.length ? 'bg-red-500' : index === 0 ? 'bg-gradient-to-b from-blue-500 to-indigo-500 w-[6px]' : 'bg-gradient-to-b from-gray-300 to-gray-200 group-hover:bg-emerald-400 group-hover:w-[6px]'}`}></div>

                                        <div className={`flex justify-between items-center -mx-5 -mt-5 p-3.5 px-5 mb-3 border-b ${index === 0 ? 'bg-gradient-to-r from-blue-50/80 to-transparent border-blue-100/60' : 'bg-gray-50/50 border-gray-100'}`}>
                                            <div className={`flex items-center gap-2 border px-2.5 py-1.5 rounded-[12px] ${index === 0 ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]'}`}>
                                                <span className={`flex items-center justify-center h-6 w-6 rounded-[8px] text-[11px] font-black shadow-sm ${index === 0 ? 'bg-blue-600 text-white shadow-blue-300' : 'bg-gray-100 text-gray-600'}`}>
                                                    {index + 1}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${index === 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                                                    {index === 0 ? 'MASTER ROW' : `SUB BARIS`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-emerald-600/90 text-[10px] sm:text-xs text-white px-2 py-1 rounded font-black shadow-sm uppercase tracking-wider">
                                                    {row.type}
                                                </span>
                                                <Button
                                                    onClick={() => handleDeleteClick(row)}
                                                    className="h-8 w-8 p-0 bg-red-50 text-red-600 border border-red-100 rounded-lg active:scale-90 transition-transform flex items-center justify-center hover:bg-red-100"
                                                >
                                                    <Trash2 className="h-4.5 w-4.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Nama Produk */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">
                                                    <span>Pilih Produk</span>
                                                    {row.validationErrors?.includes('nama_produk_invalid') && (
                                                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">Input Tidak Valid</span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <CustomDropdown
                                                        value={row.nama_produk}
                                                        onChange={(e) => updateRow(row.id, 'nama_produk', e.target.value)}
                                                        options={validProducts}
                                                        placeholder="Cari atau tempel SKU..."
                                                        className={`${row.validationErrors?.includes('nama_produk') || row.validationErrors?.includes('nama_produk_invalid') ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'} h-12 rounded-xl text-sm shadow-sm font-semibold`}
                                                        loading={dropdownLoading}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Jumlah */}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Jumlah</label>
                                                    <input
                                                        type="text"
                                                        pattern="[0-9]*"
                                                        inputMode="numeric"
                                                        value={row.jumlah === 0 ? '' : row.jumlah}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                                            updateRow(row.id, 'jumlah', parseInt(val) || 0);
                                                        }}
                                                        className={`w-full h-12 px-3 border rounded-xl font-black text-lg text-center shadow-sm ${row.validationErrors?.includes('jumlah') ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-800'}`}
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Tanggal Input */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Tgl Nota</label>
                                                    {index === 0 ? (
                                                        <input
                                                            type="date"
                                                            value={convertToInputDate(row.tanggal)}
                                                            onChange={(e) => {
                                                                const newDate = convertFromInputDate(e.target.value);
                                                                setRows(rows.map(r => ({ ...r, tanggal: newDate })));
                                                            }}
                                                            className={`w-full h-12 px-2 border rounded-xl text-sm font-bold shadow-sm bg-white border-blue-200 text-blue-700 ring-2 ring-blue-50`}
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-full px-4 flex items-center border border-gray-200/80 rounded-xl bg-gray-50/80 text-sm font-bold text-gray-500 shadow-sm opacity-90 cursor-not-allowed">
                                                            {row.tanggal || '-'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Gudang */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Gudang</label>
                                                    {index === 0 ? (
                                                        <CustomDropdown
                                                            value={row.gudang}
                                                            onChange={(e) => setRows(rows.map(r => ({ ...r, gudang: e.target.value })))}
                                                            options={validWarehouses}
                                                            className={`h-12 rounded-xl text-sm font-bold shadow-sm border-blue-200 ring-2 ring-blue-50 bg-white`}
                                                            showClearButton={true}
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-full px-4 flex items-center border border-gray-200/80 rounded-xl bg-gray-50/80 text-sm font-bold text-gray-600 shadow-sm cursor-not-allowed">
                                                            {row.gudang || '-'}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Rak */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Lokasi Rak</label>
                                                    <CustomDropdown
                                                        value={row.rak}
                                                        onChange={(e) => updateRow(row.id, 'rak', e.target.value)}
                                                        options={filteredRackOptions}
                                                        className="h-12 rounded-xl text-sm font-bold bg-white border-gray-200 shadow-sm"
                                                        showClearButton={true}
                                                    />
                                                </div>
                                            </div>

                                            {/* Meta Info */}
                                            {(row.waktu || row.nama_produk || row.total_stok !== undefined) && (
                                                <div className="bg-blue-600 rounded-xl p-3 flex justify-between items-center text-white shadow-md shadow-blue-100">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] uppercase opacity-70 font-bold">Total Stok</span>
                                                        <span className="text-sm font-black tracking-tight">{row.total_stok !== undefined ? row.total_stok : '-'}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[8px] uppercase opacity-70 font-bold">Tersedia / Waktu</span>
                                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{row.stok_tersedia} • {row.waktu || '-'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Mobile Bottom Floating Action Dock (Matching InputBarangKeluar) */}
                <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-[88px] pointer-events-none bg-gradient-to-t from-white via-white/95 to-transparent"></div>
                <div className="lg:hidden fixed bottom-2.5 inset-x-2 z-40 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-150 fill-mode-both">
                    <div className="bg-gray-900/95 backdrop-blur-2xl rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.3)] p-2 border border-gray-700/50">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-emerald-500 active:bg-emerald-600 text-white active:scale-95 transition-all disabled:opacity-50 focus:outline-none"
                            >
                                <Send className={`h-5 w-5 ${isSubmitting ? 'animate-pulse' : ''}`} />
                                <span className="text-[12px] font-bold uppercase tracking-wider">{isSubmitting ? '...' : 'Kirim'}</span>
                            </button>

                            <button
                                onClick={addRow}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-gray-700/80 active:bg-gray-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <Plus className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Baris</span>
                            </button>

                            <button
                                onClick={add50Rows}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-gray-700/80 active:bg-gray-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <Layers className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">+50</span>
                            </button>

                            <button
                                onClick={handleOtomatisRak}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-blue-500 active:bg-blue-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <Warehouse className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Auto</span>
                            </button>

                            <button
                                onClick={penyesuaian}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-amber-500 active:bg-amber-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <Settings className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Atur</span>
                            </button>

                            <button
                                onClick={openBulkModal}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-purple-500 active:bg-purple-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <Layers className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Massal</span>
                            </button>

                            <button
                                onClick={() => setShowColumnToggle(!showColumnToggle)}
                                className="flex items-center justify-center gap-1.5 w-[calc(33.333vw-16px)] h-[58px] px-1 flex-shrink-0 rounded-xl bg-gray-700/80 active:bg-gray-600 text-white active:scale-95 transition-all focus:outline-none"
                            >
                                <LayoutGrid className="h-5 w-5" />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Kolom</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Spacer for Mobile Sticky Bar */}
                <div className="h-24 lg:hidden"></div>

                {/* Delete Confirmation */}
                <ConfirmDialog
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ isOpen: false, itemId: '', itemName: '' })}
                    onConfirm={confirmDelete}
                    title="Konfirmasi Hapus"
                    message={`Apakah Anda yakin ingin menghapus transaksi "${deleteConfirm.itemName}"? Tindakan ini tidak dapat dibatalkan.`}
                />

                {/* Confirm All Clear Dialog */}
                <ConfirmDialog
                    isOpen={clearAllConfirm}
                    onClose={() => setClearAllConfirm(false)}
                    onConfirm={() => confirmClearAll(false)}
                    title="Konfirmasi Hapus Semua Data"
                    message="Apakah Anda yakin ingin menghapus semua data transaksi? Tindakan ini tidak dapat dibatalkan dan akan menghapus semua baris dari tabel."
                    confirmText="Hapus Semua"
                />

                {/* Validation Alert */}
                <ValidationAlert
                    isOpen={validationAlert.isOpen}
                    onClose={() => setValidationAlert({ isOpen: false, invalidCount: 0, errors: [] })}
                    invalidCount={validationAlert.invalidCount}
                    errors={validationAlert.errors}
                />

                {/* Bulk Input Modal 1 (Premium Redesign) */}
                <Modal
                    isOpen={isBulkModalOpen}
                    onClose={() => {
                        setIsBulkModalOpen(false);
                        resetBulkModal();
                    }}
                    title="Tambah Massal (Produk & Jumlah)"
                    size="full"
                    padding="p-0"
                >
                    <div className="flex flex-col h-auto lg:h-[70vh] min-h-[500px] p-6">
                        {/* Information Banner */}
                        <div className="mb-6 p-4 bg-blue-600 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Box className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg uppercase leading-tight tracking-tight">Input Mode 2 Kolom</h3>
                                    <p className="text-blue-100 text-[10px] md:text-sm font-medium opacity-90">Format: Nama Produk [TAB] Jumlah. Lokasi rak akan dibiarkan kosong.</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">Produk</div>
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">Jumlah</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                            {/* Input Column */}
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex-1 relative group">
                                    <textarea
                                        value={bulkInputText}
                                        onChange={(e) => setBulkInputText(e.target.value)}
                                        className="w-full h-full p-8 bg-gray-50 border-2 border-gray-100 rounded-[2.5rem] focus:outline-none focus:border-blue-400 focus:bg-white transition-all font-mono text-sm leading-relaxed shadow-inner resize-none group-hover:border-gray-200"
                                        placeholder="Paste di sini...&#10;&#10;SENTER-LED-001	20&#10;KABEL-USB-002	100"
                                    />
                                    <div className="absolute top-6 right-6 pointer-events-none">
                                        <div className="bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest">Input Area</div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleBulkAnalyze}
                                        className="flex-1 h-16 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                                    >
                                        <RefreshCw className="h-5 w-5" /> Analisa Data
                                    </Button>
                                    <Button
                                        onClick={resetBulkModal}
                                        variant="outline"
                                        className="h-16 px-8 border-2 border-gray-100 text-gray-400 hover:bg-gray-50 rounded-2xl transition-all active:scale-95"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Preview Column */}
                            <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">Preview Daftar</h4>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase">Siap Ditambahkan</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-black border border-emerald-100">
                                            {bulkAnalysisResult.berhasil} ✓
                                        </div>
                                        <div className="px-4 py-2 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black border border-rose-100">
                                            {bulkAnalysisResult.gagal} ✗
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
                                    {analyzedData.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-200 gap-6 grayscale opacity-60">
                                            <LayoutGrid className="h-24 w-24 stroke-[1]" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Menunggu Data...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {analyzedData.map((item, idx) => (
                                                <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-50 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all duration-300">
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-12 w-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-700 leading-tight group-hover:text-blue-900 transition-colors uppercase tracking-tight">{item.nama_produk}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Status: Valid</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right bg-gray-50 px-5 py-2.5 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                                                        <p className="text-[8px] font-black text-gray-300 uppercase leading-none mb-1 group-hover:text-emerald-300">QTY</p>
                                                        <p className="text-lg font-black text-blue-600 group-hover:text-emerald-700">{item.jumlah}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-white border-t border-gray-50">
                                    <Button
                                        onClick={handleBulkAdd}
                                        disabled={analyzedData.length === 0}
                                        className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl shadow-2xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-40 disabled:grayscale uppercase tracking-[0.2em] text-sm"
                                    >
                                        <Plus className="h-6 w-6" /> Tambah ke Daftar Inbound
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>

                {/* Bulk Input Modal 2 (Premium Redesign) */}
                <Modal
                    isOpen={isBulkModal2Open}
                    onClose={() => {
                        setIsBulkModal2Open(false);
                        resetBulkModal2();
                    }}
                    title="Tambah Massal (3 Kolom)"
                    size="full"
                    padding="p-0"
                >
                    <div className="flex flex-col h-auto lg:h-[70vh] min-h-[500px] p-6">
                        {/* Information Banner */}
                        <div className="mb-6 p-4 bg-blue-600 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg uppercase leading-tight tracking-tight">Input Mode 3 Kolom</h3>
                                    <p className="text-blue-100 text-[10px] md:text-sm font-medium opacity-90">Produk, Jumlah, dan Lokasi Rak akan langsung terisi.</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">Produk</div>
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">Jumlah</div>
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm">Lokasi</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                            {/* Input Column */}
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex-1 relative group">
                                    <textarea
                                        value={bulkInputText2}
                                        onChange={(e) => setBulkInputText2(e.target.value)}
                                        onPaste={analyzePaste2}
                                        className="w-full h-full p-8 bg-gray-50 border-2 border-gray-100 rounded-[2.5rem] focus:outline-none focus:border-blue-400 focus:bg-white transition-all font-mono text-sm leading-relaxed shadow-inner resize-none group-hover:border-gray-200"
                                        placeholder="Paste di sini...&#10;&#10;BARANG-A	10	RAK-1&#10;BARANG-B	50	RAK-X"
                                    />
                                    <div className="absolute top-6 right-6 pointer-events-none">
                                        <div className="bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest animate-pulse">Ready to Paste</div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button
                                        onClick={handleBulkAnalyze2}
                                        className="flex-1 h-16 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                                    >
                                        <RefreshCw className="h-5 w-5" /> Analisa Sekarang
                                    </Button>
                                    <Button
                                        onClick={resetBulkModal2}
                                        variant="outline"
                                        className="h-16 px-8 border-2 border-gray-100 text-gray-400 hover:bg-gray-50 rounded-2xl transition-all active:scale-95"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Preview Column */}
                            <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">Preview Analisis</h4>
                                        <p className="text-[10px] font-black text-blue-500 uppercase mt-1.5 tracking-tighter">Lokasi rak akan disesuaikan otomatis</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black border border-blue-100">
                                            {bulkAnalysisResult2.berhasil} ✓
                                        </div>
                                        <div className="px-4 py-2 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black border border-rose-100">
                                            {bulkAnalysisResult2.gagal} ✗
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
                                    {analyzedData2.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-200 gap-6 grayscale opacity-60">
                                            <Edit3 className="h-24 w-24 stroke-[1]" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Menunggu Input Data...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {analyzedData2.map((item, idx) => (
                                                <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-50 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all duration-300">
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-12 w-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center font-black group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-700 leading-tight group-hover:text-emerald-900 transition-colors uppercase tracking-tight">{item.nama_produk}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <LayoutGrid className="h-3 w-3 text-blue-500" />
                                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{item.rak}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right bg-gray-50 px-5 py-2.5 rounded-2xl group-hover:bg-blue-50 transition-colors">
                                                        <p className="text-[8px] font-black text-gray-300 uppercase leading-none mb-1 group-hover:text-blue-300">QUANTITY</p>
                                                        <p className="text-lg font-black text-emerald-600 group-hover:text-blue-700">{item.jumlah}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-white border-t border-gray-50">
                                    <Button
                                        onClick={handleBulkAdd2}
                                        disabled={analyzedData2.length === 0}
                                        className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white font-black rounded-3xl shadow-2xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-40 disabled:grayscale uppercase tracking-[0.2em] text-sm"
                                    >
                                        <Send className="h-6 w-6" /> Masukkan ke Antrean
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal >
            </div >
        </>
    );
}

// Custom Dropdown Component
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
        if (!value) return options;
        const lowerValue = value.toLowerCase();
        return options.filter(option =>
            option.toLowerCase().includes(lowerValue)
        );
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

    const handleOptionSelect = (option: string, moveToNextRow = false) => {
        onChange({ target: { value: option } });
        setIsOpen(false);

        if (moveToNextRow) {
            setTimeout(() => {
                const currentInput = inputRef.current;
                if (currentInput) {
                    const currentRow = currentInput.closest('tr');
                    const nextRow = currentRow?.nextElementSibling as HTMLTableRowElement;
                    if (nextRow) {
                        const currentCell = currentInput.closest('td');
                        const currentCellIndex = Array.from(currentRow?.children || []).indexOf(currentCell as HTMLTableCellElement);
                        const nextRowCells = Array.from(nextRow.children);
                        const nextCell = nextRowCells[currentCellIndex] as HTMLTableCellElement;
                        const sameColumnInput = nextCell?.querySelector('input') as HTMLInputElement;
                        if (sameColumnInput) {
                            sameColumnInput.focus();
                            if (sameColumnInput.type === 'text') {
                                sameColumnInput.select();
                            }
                        }
                    }
                }
            }, 50);
        }
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
                    handleOptionSelect(filteredOptions[highlightedIndex], true);
                }
                else if (value.trim() !== '') {
                    setIsOpen(false);
                    setTimeout(() => {
                        const currentInput = inputRef.current;
                        if (currentInput) {
                            const currentRow = currentInput.closest('tr');
                            const nextRow = currentRow?.nextElementSibling as HTMLTableRowElement;
                            if (nextRow) {
                                const currentCell = currentInput.closest('td');
                                const currentCellIndex = Array.from(currentRow?.children || []).indexOf(currentCell as HTMLTableCellElement);
                                const nextRowCells = Array.from(nextRow.children);
                                const nextCell = nextRowCells[currentCellIndex] as HTMLTableCellElement;
                                const sameColumnInput = nextCell?.querySelector('input') as HTMLInputElement;
                                if (sameColumnInput) {
                                    sameColumnInput.focus();
                                    if (sameColumnInput.type === 'text') {
                                        sameColumnInput.select();
                                    }
                                }
                            }
                        }
                    }, 50);
                }
                break;

            case 'Tab':
                if (filteredOptions[highlightedIndex]) {
                    handleOptionSelect(filteredOptions[highlightedIndex], false);
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
                    className={`w-full px-2 py-1 pr-${showButton ? '14' : '8'} border rounded text-sm bg-white focus:outline-none focus:ring-2 ${className} ${loading ? 'opacity-50 cursor-wait' : ''}`}
                    placeholder={loading ? 'Memuat data...' : placeholder}
                    autoComplete="off"
                    disabled={loading}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                    {showButton && (
                        <button
                            onClick={handleClearClick}
                            className="text-gray-500 hover:text-gray-700 pointer-events-auto p-1"
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
                    className={`bg-white border border-gray-300 rounded-md shadow-xl overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${isInTable
                        ? ''
                        : `absolute left-0 right-0 z-50 max-h-60 ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`
                        }`}
                    style={isInTable ? { ...dropdownStyle, maxHeight: '240px', overflowY: 'scroll' } : { zIndex: 9999 }}
                >
                    {filteredOptions.map((option, index) => (
                        <div
                            ref={el => optionRefs.current[index] = el}
                            key={index}
                            onClick={() => handleOptionSelect(option, false)}
                            className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${index === highlightedIndex
                                ? 'bg-blue-500 text-white font-medium'
                                : 'hover:bg-blue-50 hover:text-blue-700'
                                }`}
                        >
                            {option}
                        </div>
                    ))}
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