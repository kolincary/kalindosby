import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, RefreshCw } from 'lucide-react';

interface BarcodeScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string>('');
    const [errorDetail, setErrorDetail] = useState<string>('');
    const [scanLineY, setScanLineY] = useState(0);
    const [isRetrying, setIsRetrying] = useState(false);
    const mountedRef = useRef(true);
    const startAttemptedRef = useRef(false);

    // Animated scan line
    useEffect(() => {
        const interval = setInterval(() => {
            setScanLineY(prev => (prev >= 100 ? 0 : prev + 0.5));
        }, 20);
        return () => clearInterval(interval);
    }, []);

    const stopAndCleanScanner = async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                // State 2 = SCANNING, State 3 = PAUSED
                if (state === 2 || state === 3) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (err) {
                console.warn('Scanner cleanup warning:', err);
            }
            scannerRef.current = null;
        }
    };

    const startScanner = async () => {
        if (!mountedRef.current) return;

        // Prevent concurrent start attempts
        if (startAttemptedRef.current) return;
        startAttemptedRef.current = true;

        setError('');
        setErrorDetail('');

        try {
            await stopAndCleanScanner();
            if (!mountedRef.current) return;

            const scanner = new Html5Qrcode('reader-fullscreen', {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODABAR
                ]
            });
            scannerRef.current = scanner;

            const scanConfig: any = {
                fps: 10,
                qrbox: function (viewfinderWidth: number, viewfinderHeight: number) {
                    // Make qrbox adaptive to screen size to prevent Overconstrained errors on small screens
                    const minEdgePercentage = 0.7; // 70% of min dimension
                    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                    return {
                        width: Math.max(200, qrboxSize),
                        height: Math.max(200, qrboxSize)
                    };
                },
                disableFlip: false,
                aspectRatio: undefined // Remove forced ratio to prevent crashing on odd screen sizes
            };

            let started = false;
            let cameras: any[] = [];

            // Step 1: Use native method to get cameras. This automatically triggers permissions.
            try {
                cameras = await Html5Qrcode.getCameras();
                console.log("[BarcodeScanner] Found cameras:", cameras);
            } catch (camErr: any) {
                console.warn("[BarcodeScanner] getCameras failed or permission denied:", camErr);
            }

            if (!mountedRef.current) return;

            // Step 2: If we successfully mapped cameras with specific IDs
            if (cameras && cameras.length > 0) {
                // Determine target camera by labels
                const backCamera = cameras.find(c =>
                    c.label.toLowerCase().includes('back') ||
                    c.label.toLowerCase().includes('rear') ||
                    c.label.toLowerCase().includes('environment') ||
                    c.label.toLowerCase().includes('belakang')
                );

                const targetCameras = [];
                if (backCamera) targetCameras.push(backCamera);

                // Add the last camera (often back camera on phones if label is missing) 
                // and the first camera (often front or default)
                if (cameras.length > 1) {
                    if (!backCamera) targetCameras.push(cameras[cameras.length - 1]);
                    targetCameras.push(cameras[0]);
                } else if (!backCamera) {
                    targetCameras.push(cameras[0]);
                }

                // Deduplicate Array
                const uniqueCameras = Array.from(new Set(targetCameras.map(c => c.id)))
                    .map(id => targetCameras.find(c => c.id === id)!);

                // Try starting with explicit IDs
                for (const cam of uniqueCameras) {
                    if (!mountedRef.current) return;
                    try {
                        console.log(`[BarcodeScanner] Attempting explicit ID: ${cam.label || cam.id}`);
                        await scanner.start(cam.id, scanConfig, (text) => onScan(text), () => { });
                        console.log("[BarcodeScanner] Success with explicit ID!");
                        started = true;
                        break;
                    } catch (e) {
                        console.warn(`[BarcodeScanner] Failed explicit ID ${cam.id}:`, e);
                        await stopAndCleanScanner();
                    }
                }
            }

            // Step 3: Fallback using facingMode object if exact ID attempts failed or getCameras failed
            if (!started && mountedRef.current) {
                const fallbackStrategies = [
                    { facingMode: 'environment' },
                    { facingMode: 'user' }
                ];

                for (const strategy of fallbackStrategies) {
                    if (!mountedRef.current) return;
                    try {
                        // Re-initialize a fresh scanner since errors can corrupt the instance state
                        await stopAndCleanScanner();
                        const fallbackScanner = new Html5Qrcode('reader-fullscreen');
                        scannerRef.current = fallbackScanner;

                        console.log(`[BarcodeScanner] Attempting fallback strategy: ${JSON.stringify(strategy)}`);
                        await fallbackScanner.start(strategy, scanConfig, (text) => onScan(text), () => { });
                        console.log("[BarcodeScanner] Success with fallback strategy!");
                        started = true;
                        break;
                    } catch (err: any) {
                        console.warn(`[BarcodeScanner] Failed fallback strategy ${JSON.stringify(strategy)}:`, err?.message || err);
                    }
                }
            }

            if (!started) {
                throw new Error('Tidak ada strategi kamera yang berhasil.');
            }

        } catch (err: any) {
            console.error('[BarcodeScanner] Fatal Init Error:', err);
            if (mountedRef.current) {
                const message = err?.message || err?.name || '';

                if (message.includes('NotAllowedError') || message.includes('Permission')) {
                    setError('Izin akses kamera ditolak.');
                    setErrorDetail('Harap izinkan akses kamera pada pengaturan browser/perangkat Anda, lalu coba lagi.');
                } else if (message.includes('NotReadableError') || message.includes('TrackStartError')) {
                    setError('Kamera sedang digunakan.');
                    setErrorDetail('Aplikasi lain sepertinya sedang menggunakan kamera.\nHarap tutup aplikasi/tab kamera lain dan coba lagi.');
                } else {
                    setError('Kamera tidak dapat dimulai.');
                    setErrorDetail(`Detail: ${message}\n\nPeriksa apakah browser Anda memiliki izin penuh, atau coba refresh halaman.`);
                }
            }
        } finally {
            startAttemptedRef.current = false;
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        // Give the DOM a tiny fraction of a second to render the div container
        setTimeout(() => {
            startScanner();
        }, 150);

        return () => {
            mountedRef.current = false;
            stopAndCleanScanner();
        };
    }, []);

    const handleRetry = async () => {
        setIsRetrying(true);
        setError('');
        setErrorDetail('');
        await stopAndCleanScanner();

        // Small delay to ensure complete cleanup of hardware lock
        setTimeout(async () => {
            await startScanner();
            setIsRetrying(false);
        }, 600);
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black">
            {/* Camera feed - fills entire screen */}
            <div id="reader-fullscreen" className="absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

            {/* Top bar - translucent */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 safe-area-top" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
                <p className="text-white/70 text-sm font-medium tracking-wide">
                    Arahkan QR code atau barcode ke bingkai tengah
                </p>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90 shadow-lg border border-white/10"
                >
                    <X className="h-6 w-6" />
                </button>
            </div>

            {/* Scan Region Overlay */}
            <div className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center">
                {/* Darkened edges */}
                <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />

                {/* Clear center box */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
                    {/* Cut out the center - using box-shadow trick */}
                    <div
                        className="absolute inset-0"
                        style={{
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                            borderRadius: '24px'
                        }}
                    />

                    {/* Corner brackets - More modern looking */}
                    <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-white/90 rounded-tl-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-white/90 rounded-tr-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-white/90 rounded-bl-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-white/90 rounded-br-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]" />

                    {/* Animated scan line with glowing effect */}
                    <div
                        className="absolute left-2 right-2 h-[3px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent transition-none"
                        style={{
                            top: `${scanLineY}%`,
                            opacity: scanLineY > 5 && scanLineY < 95 ? 1 : 0,
                            boxShadow: '0 0 16px 4px rgba(34, 211, 238, 0.5)'
                        }}
                    />
                </div>
            </div>

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm">
                    <div className="text-center w-full max-w-sm">
                        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                            <X className="h-10 w-10 text-red-400" />
                        </div>
                        <h3 className="text-red-400 font-black text-xl mb-3 tracking-tight">{error}</h3>
                        {errorDetail && (
                            <p className="text-white/70 text-sm mb-8 whitespace-pre-line text-left bg-white/5 rounded-2xl p-5 border border-white/10 leading-relaxed">
                                {errorDetail}
                            </p>
                        )}
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={handleRetry}
                                disabled={isRetrying}
                                className="px-6 py-4 flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl text-white font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/30"
                            >
                                <RefreshCw className={`h-5 w-5 ${isRetrying ? 'animate-spin' : ''}`} />
                                {isRetrying ? 'Mencoba...' : 'Coba Lagi'}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-4 flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white font-bold active:scale-95 transition-all shadow-lg"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
