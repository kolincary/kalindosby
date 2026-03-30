import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Search, Package, AlertTriangle, RefreshCw, QrCode, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Toast } from './ui/Toast';
import { CustomDropdown } from './ui/CustomDropdown';
import { BarcodeScanner } from './ui/BarcodeScanner';

interface StockItem {
    id: string;
    nama_produk: string;
    sku?: string; // Optional if not available directly
    rak: string;
    tersedia: number;
    satuan: string;
    packing: string;
}

export function CekRak() {
    const [rackId, setRackId] = useState('');
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [rackOptions, setRackOptions] = useState<string[]>([]);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'info' | 'error' }>({
        isOpen: false,
        message: '',
        type: 'info'
    });



    // Fetch rack options on mount
    useEffect(() => {
        fetchRackOptions();
    }, []);

    const fetchRackOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('rack_locations')
                .select('nama')
                .order('nama', { ascending: true });

            if (error) throw error;
            if (data) {
                const uniqueOptions = Array.from(new Set(data.map(r => r.nama)));
                setRackOptions(uniqueOptions);
            }
        } catch (error) {
            console.error('Error fetching rack options:', error);
        }
    };

    // Real-time subscription
    useEffect(() => {
        if (!lastScanned) return;

        const subscription = supabase
            .channel('cek-rak-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'stock_items'
                },
                (payload) => {
                    // Simple strategy: reload data if any change happens, 
                    // filtering on client side or just refetching is safer for consistency.
                    // To be efficient, we only refetch if the changed row's rak matches current view.
                    const newRow = payload.new as StockItem;
                    const oldRow = payload.old as StockItem;

                    if ((newRow && newRow.rak === lastScanned) || (oldRow && oldRow.rak === lastScanned)) {
                        fetchItems(lastScanned, true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [lastScanned]);

    const showToast = (message: string, type: 'success' | 'info' | 'error') => {
        setToast({ isOpen: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, isOpen: false })), 3000);
    };

    const fetchItems = async (rak: string, isUpdate = false) => {
        if (!rak) return;

        if (!isUpdate) {
            setLoading(true);
            setLastScanned(rak);
        }

        try {
            // Trim whitespace from rack ID to avoid mismatches
            const cleanRak = rak.trim();

            const { data, error } = await supabase
                .from('stock_items')
                .select('*')
                .ilike('rak', cleanRak) // Case insensitive match
                .eq('status', 'Aktif')
                .gt('tersedia', 0) // Only show items with stock > 0
                .order('nama_produk', { ascending: true });

            if (error) throw error;

            setItems(data || []);

            if (!isUpdate) {
                if (data && data.length > 0) {
                    showToast(`Ditemukan ${data.length} barang di Rak ${cleanRak}`, 'success');
                } else {
                    showToast(`Rak ${cleanRak} kosong atau tidak ditemukan`, 'info');
                }
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            showToast('Gagal memuat data rak', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchItems(rackId);
    };

    const handleScanResult = (decodedText: string) => {
        setRackId(decodedText);
        setShowScanner(false);
        fetchItems(decodedText);
    };

    const handlePrintBarcode = () => {
        if (!lastScanned) return;
        const url = `https://dazzling-halva-7e617b.netlify.app/api/qr?data=${encodeURIComponent(lastScanned)}&size=300&label=${encodeURIComponent(lastScanned)}`;
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
            <html>
                <head>
                    <title>Print Rak ${lastScanned}</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        img { max-width: 100%; height: auto; }
                        h1 { font-family: sans-serif; font-size: 48px; margin-bottom: 20px; }
                        @media print {
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Rak: ${lastScanned}</h1>
                    <img src="${url}" onload="window.print();" />
                    <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; font-size: 20px;">Print Lagi</button>
                </body>
            </html>
          `);
            win.document.close();
        }
    };

    const submitButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <Card className="rounded-xl shadow-md border border-blue-100/50 bg-gradient-to-br from-white to-blue-50/30">
                <CardContent className="p-6 overflow-visible">
                    <div className="flex flex-col md:flex-row gap-4 items-end relative z-50">
                        <div className="flex-1 w-full relative z-50">
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                                Scan Barcode / Ketik Lokasi Rak / Pilih dari List
                            </label>
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <CustomDropdown
                                        value={rackId}
                                        onChange={(e) => setRackId(e.target.value)}
                                        options={rackOptions}
                                        placeholder="Contoh: A.1.1 atau C11"
                                        className="pl-10 h-12 text-lg shadow-sm w-full"
                                        showClearButton={true}
                                        forceUppercase={true}
                                        onOptionSelect={() => {
                                            setTimeout(() => {
                                                submitButtonRef.current?.click();
                                            }, 100);
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowScanner(true)}
                                    className="px-3 md:px-4 py-2 text-white bg-gray-800 rounded-lg hover:bg-gray-900 focus:outline-none shadow-sm transition-all h-12 flex items-center justify-center"
                                    title="Scan Barcode Kamera"
                                >
                                    <Camera className="h-5 w-5 md:mr-2" />
                                    <span className="hidden md:inline">Scan</span>
                                </button>
                                <button
                                    ref={submitButtonRef}
                                    type="submit"
                                    className="px-4 md:px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-all h-12"
                                >
                                    CARI
                                </button>
                            </form>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content Area */}
            {lastScanned && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Package className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Rak {lastScanned}</h2>
                                <p className="text-sm text-gray-500">{items.length} Item ditemukan</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => fetchItems(lastScanned, true)}
                                className="bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 h-10 px-3 md:px-4"
                            >
                                <RefreshCw className={`h-4 w-4 md:mr-2 ${loading ? 'animate-spin' : ''}`} />
                                <span className="hidden md:inline">Refresh</span>
                            </Button>
                            <Button
                                onClick={handlePrintBarcode}
                                className="bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-black hover:to-black shadow-lg hidden md:inline-flex"
                            >
                                <QrCode className="h-4 w-4 mr-2" />
                                Print Label Rak
                            </Button>
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <Card className="border-dashed border-2 border-gray-300 bg-gray-50/50">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Rak Kosong</h3>
                                <p className="text-gray-500 max-w-sm mt-1">
                                    Tidak ada barang yang terdaftar di lokasi rak <strong>{lastScanned}</strong> pada database saat ini.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((item) => (
                                <Card key={item.id} className="hover:shadow-md transition-shadow duration-200 border border-gray-200 overflow-hidden group">
                                    <div className="h-2 bg-blue-500 w-full" />
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-lg text-gray-800 line-clamp-2 leading-tight min-h-[3rem]">
                                                {item.nama_produk}
                                            </h3>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100">
                                                <span className="text-gray-500">Packing</span>
                                                <span className="font-medium text-gray-900">{item.packing || '-'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100">
                                                <span className="text-gray-500">Satuan</span>
                                                <span className="font-medium text-gray-900">{item.satuan}</span>
                                            </div>

                                            <div className="pt-2 flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sisa Stok</span>
                                                <div className={`text-2xl font-bold ${item.tersedia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                    {item.tersedia.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {toast.isOpen && (
                <Toast isOpen={toast.isOpen} message={toast.message} type={toast.type} onClose={() => setToast(prev => ({ ...prev, isOpen: false }))} />
            )}

            {showScanner && (
                <BarcodeScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
}
