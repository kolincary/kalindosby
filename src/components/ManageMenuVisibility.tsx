import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Toast } from './ui/Toast';
import { 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  SlidersHorizontal,
  FolderLock,
  RotateCcw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useMenuVisibility } from '../lib/menuVisibilityContext';
import { allMenuCategories } from '../lib/menuConfig';
import { cn } from '../lib/utils';

export function ManageMenuVisibility() {
  const { 
    hiddenMenus, 
    hiddenCategories, 
    isMenuHidden, 
    isCategoryHidden, 
    toggleMenuVisibility, 
    toggleCategoryVisibility, 
    unhideAll, 
    refreshVisibility,
    loading 
  } = useMenuVisibility();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Counts
  const totalItems = allMenuCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  const hiddenMenuCount = hiddenMenus.length;
  const visibleMenuCount = Math.max(0, totalItems - hiddenMenuCount);
  const hiddenCategoryCount = hiddenCategories.length;

  const handleToggleMenu = async (href: string, currentHidden: boolean, menuName: string) => {
    try {
      setTogglingKey(href);
      const success = await toggleMenuVisibility(href, !currentHidden);
      if (success) {
        showToast(
          `Menu "${menuName}" berhasil ${!currentHidden ? 'disembunyikan dari semua user' : 'ditampilkan kembali'}!`,
          'success'
        );
      } else {
        showToast('Gagal mengubah visibilitas menu', 'error');
      }
    } catch (err) {
      console.error('Toggle menu visibility error:', err);
      showToast('Terjadi kesalahan saat menyimpan pengaturan', 'error');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleToggleCategory = async (categoryKey: string, currentHidden: boolean, categoryName: string) => {
    try {
      setTogglingKey(categoryKey);
      const success = await toggleCategoryVisibility(categoryKey, !currentHidden);
      if (success) {
        showToast(
          `Kategori "${categoryName}" berhasil ${!currentHidden ? 'disembunyikan dari sidebar' : 'ditampilkan kembali'}!`,
          'success'
        );
      } else {
        showToast('Gagal mengubah visibilitas kategori', 'error');
      }
    } catch (err) {
      console.error('Toggle category visibility error:', err);
      showToast('Terjadi kesalahan saat menyimpan pengaturan', 'error');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleUnhideAll = async () => {
    if (!confirm('Apakah Anda yakin ingin MENAMPILKAN SEMUA menu dan kategori di sidebar untuk semua user?')) {
      return;
    }

    try {
      setTogglingKey('unhide_all');
      const success = await unhideAll();
      if (success) {
        showToast('Semua menu dan kategori sekarang ditampilkan untuk semua user!', 'success');
      } else {
        showToast('Gagal mereset visibilitas menu', 'error');
      }
    } catch (err) {
      console.error('Unhide all error:', err);
      showToast('Terjadi kesalahan saat mereset pengaturan', 'error');
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ======================================================== */}
      {/* IMMERSIVE GRADIENT HEADER BANNER */}
      {/* ======================================================== */}
      <div className="flex flex-col mb-4 uppercase">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 pt-[80px] lg:pt-0 lg:h-[310px] pb-[40px] lg:pb-0 px-6 lg:px-12 rounded-b-[40px] lg:rounded-b-[55px] shadow-2xl shadow-blue-900/30 relative overflow-hidden flex flex-col justify-center">
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute top-20 -left-10 w-36 h-36 bg-blue-400/20 rounded-full blur-xl"></div>
          <div className="absolute bottom-4 right-1/4 w-32 h-32 bg-indigo-500/10 rounded-3xl rotate-45 blur-2xl"></div>

          <div className="relative z-10 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 uppercase text-left">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2 lg:mb-3 opacity-90">
                <div className="w-8 h-[2px] bg-white rounded-full"></div>
                <span className="text-[10px] lg:text-[12px] font-black tracking-[0.3em] text-white">DevMode Management</span>
              </div>
              <h1 className="text-[30px] lg:text-[48px] font-black text-white tracking-tight leading-[1.1] mb-2 uppercase">
                Visibilitas <span className="text-blue-200">Menu</span>
              </h1>
              <div className="text-blue-100/90 font-medium text-[13px] lg:text-[16px] leading-relaxed max-w-[95%] normal-case">
                {loading ? (
                  <span className="animate-pulse flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Memuat konfigurasi realtime...
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="font-black text-white">Realtime Sync Active</span> — Kontrol menu & kategori side menu di semua user
                  </div>
                )}
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
              <Button
                onClick={() => refreshVisibility()}
                disabled={loading}
                className="h-11 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl backdrop-blur-md transition-all active:scale-95 flex items-center gap-2 font-bold shadow-lg"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="text-[11px] uppercase tracking-wider">SYNC REALTIME</span>
              </Button>

              <Button
                onClick={handleUnhideAll}
                disabled={togglingKey !== null}
                className="h-11 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 border-0"
              >
                <Eye className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                  TAMPILKAN SEMUA
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ======================================================== */}
      <div className="space-y-6 lg:space-y-8 px-4 sm:px-6 lg:px-12">

        {/* 1. Quick Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Menu</p>
                <p className="text-2xl lg:text-3xl font-black text-slate-800 mt-1">{totalItems}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Layers className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Daftar menu di sistem</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Menu Tampil</p>
                <p className="text-2xl lg:text-3xl font-black text-emerald-600 mt-1">{visibleMenuCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Eye className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Aktif terlihat di sidebar</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Disembunyikan</p>
                <p className="text-2xl lg:text-3xl font-black text-rose-600 mt-1">{hiddenMenuCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <EyeOff className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Tersembunyi dari sidebar user</p>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Kategori Sembunyi</p>
                <p className="text-2xl lg:text-3xl font-black text-amber-600 mt-1">{hiddenCategoryCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <FolderLock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Kategori grup yang di-hide</p>
          </div>
        </div>

        {/* 2. Info Guide Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-100 rounded-2xl p-4 lg:p-5 flex items-start gap-3.5 shadow-sm">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">Cara Kerja Kontrol Visibilitas Realtime:</p>
            <p className="text-slate-600 leading-relaxed">
              Saat Anda mematikan saklar (toggle) menu atau kategori di bawah, perubahan akan <strong>langsung tersimpan dan berlaku realtime di layar seluruh pengguna</strong> tanpa perlu reload aplikasi.
            </p>
          </div>
        </div>

        {/* 3. Categorized Menu Sections */}
        <div className="space-y-6">
          {allMenuCategories.map((category) => {
            const categoryHidden = isCategoryHidden(category.key);
            const hiddenItemsInCat = category.items.filter(i => isMenuHidden(i.href)).length;

            return (
              <Card key={category.key} className="border border-slate-200/80 shadow-sm overflow-hidden rounded-2xl">
                {/* Category Header */}
                <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      categoryHidden ? "bg-rose-500" : "bg-emerald-500"
                    )}></div>
                    <div>
                      <h3 className="font-black text-slate-800 text-base tracking-tight flex items-center gap-2">
                        {category.name}
                        {categoryHidden && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded-full uppercase">
                            Kategori Disembunyikan
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {category.items.length} Menu • {hiddenItemsInCat > 0 ? `${hiddenItemsInCat} disembunyikan` : 'Semua ditampilkan'}
                      </p>
                    </div>
                  </div>

                  {/* Category Master Switch */}
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200/70 shadow-sm">
                    <span className="text-xs font-bold text-slate-600">
                      {categoryHidden ? 'Sembunyi' : 'Tampil'}
                    </span>
                    <button
                      onClick={() => handleToggleCategory(category.key, categoryHidden, category.name)}
                      disabled={togglingKey === category.key}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        !categoryHidden ? "bg-emerald-500" : "bg-slate-300"
                      )}
                      title={`Klik untuk ${categoryHidden ? 'menampilkan' : 'menyembunyikan'} kategori ${category.name}`}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md",
                          !categoryHidden ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Menu Items List in Category */}
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isHidden = isMenuHidden(item.href);
                      const isEffectivelyHidden = categoryHidden || isHidden;

                      return (
                        <div
                          key={item.href}
                          className={cn(
                            "p-4 rounded-xl border transition-all flex items-center justify-between gap-3",
                            isEffectivelyHidden
                              ? "bg-slate-50/80 border-slate-200/60 opacity-75"
                              : "bg-white border-slate-200/90 shadow-sm hover:border-blue-300 hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                              isEffectivelyHidden 
                                ? "bg-slate-200 text-slate-500" 
                                : "bg-blue-50 text-blue-600"
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className={cn(
                                "text-sm font-bold truncate",
                                isEffectivelyHidden ? "text-slate-500 line-through" : "text-slate-800"
                              )}>
                                {item.name}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono truncate">
                                {item.href}
                              </p>
                            </div>
                          </div>

                          {/* Individual Menu Item Toggle */}
                          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                            <button
                              onClick={() => handleToggleMenu(item.href, isHidden, item.name)}
                              disabled={togglingKey === item.href || categoryHidden}
                              className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                !isHidden && !categoryHidden ? "bg-emerald-500" : "bg-slate-300",
                                categoryHidden && "cursor-not-allowed opacity-50"
                              )}
                              title={categoryHidden ? "Kategori induk sedang disembunyikan" : `Klik untuk ${isHidden ? 'menampilkan' : 'menyembunyikan'} ${item.name}`}
                            >
                              <span
                                className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md",
                                  !isHidden && !categoryHidden ? "translate-x-6" : "translate-x-1"
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}
