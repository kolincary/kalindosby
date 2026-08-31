import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useDatabaseConfig } from './DatabaseContext';

export interface MenuVisibilityConfig {
  hiddenMenus: string[]; // e.g. ['/input-masuk', '/data-gudang']
  hiddenCategories: string[]; // e.g. ['master_data', 'monitoring']
  updatedAt?: string;
  updatedBy?: string;
}

interface MenuVisibilityContextType {
  hiddenMenus: string[];
  hiddenCategories: string[];
  isMenuHidden: (href: string) => boolean;
  isCategoryHidden: (categoryKey: string) => boolean;
  toggleMenuVisibility: (href: string, hide: boolean) => Promise<boolean>;
  toggleCategoryVisibility: (categoryKey: string, hide: boolean) => Promise<boolean>;
  unhideAll: () => Promise<boolean>;
  refreshVisibility: () => Promise<void>;
  loading: boolean;
}

const SETTING_KEY = 'menu_visibility_config';
const LOCAL_STORAGE_KEY = 'cached_menu_visibility_config';

const MenuVisibilityContext = createContext<MenuVisibilityContextType | undefined>(undefined);

export function MenuVisibilityProvider({ children }: { children: React.ReactNode }) {
  const { writeMode, readMode } = useDatabaseConfig();

  const [hiddenMenus, setHiddenMenus] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.hiddenMenus) ? parsed.hiddenMenus : [];
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [hiddenCategories, setHiddenCategories] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.hiddenCategories) ? parsed.hiddenCategories : [];
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Apply state and cache
  const updateLocalState = useCallback((config: { hiddenMenus: string[]; hiddenCategories: string[] }) => {
    const cleanMenus = Array.isArray(config.hiddenMenus) ? config.hiddenMenus : [];
    const cleanCategories = Array.isArray(config.hiddenCategories) ? config.hiddenCategories : [];
    
    setHiddenMenus(cleanMenus);
    setHiddenCategories(cleanCategories);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        hiddenMenus: cleanMenus,
        hiddenCategories: cleanCategories
      }));
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch from backend
  const fetchVisibilityConfig = useCallback(async () => {
    try {
      setLoading(true);

      if (readMode === 'supabase') {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', SETTING_KEY)
          .maybeSingle();

        if (!error && data?.value) {
          try {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            updateLocalState(parsed);
            return;
          } catch (e) {
            console.error('Error parsing menu visibility config:', e);
          }
        }
      } else {
        // Firebase mode
        try {
          const docRef = doc(db, 'app_settings', 'menu_visibility');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            updateLocalState({
              hiddenMenus: data.hiddenMenus || [],
              hiddenCategories: data.hiddenCategories || []
            });
            return;
          }
        } catch (fbErr) {
          console.warn('Firebase menu visibility fetch error:', fbErr);
        }
      }
    } catch (err) {
      console.error('Error in fetchVisibilityConfig:', err);
    } finally {
      setLoading(false);
    }
  }, [readMode, updateLocalState]);

  // Initial load
  useEffect(() => {
    fetchVisibilityConfig();
  }, [fetchVisibilityConfig]);

  // Realtime subscription
  useEffect(() => {
    // 1. Supabase Realtime Subscription
    const channel = supabase
      .channel('realtime_menu_visibility')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: `key=eq.${SETTING_KEY}`
        },
        (payload: any) => {
          if (payload.new && payload.new.value) {
            try {
              const parsed = typeof payload.new.value === 'string' 
                ? JSON.parse(payload.new.value) 
                : payload.new.value;
              updateLocalState(parsed);
            } catch (err) {
              console.error('Error processing realtime menu visibility update:', err);
            }
          }
        }
      )
      .subscribe();

    // 2. Firebase Firestore Realtime Snapshot
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const docRef = doc(db, 'app_settings', 'menu_visibility');
      unsubscribeFirestore = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          updateLocalState({
            hiddenMenus: data.hiddenMenus || [],
            hiddenCategories: data.hiddenCategories || []
          });
        }
      }, (err) => {
        // Silently handle if collection not initialized
      });
    } catch (e) {
      // ignore
    }

    return () => {
      supabase.removeChannel(channel);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [updateLocalState]);

  // Save config to database
  const saveVisibilityConfig = async (newHiddenMenus: string[], newHiddenCategories: string[]): Promise<boolean> => {
    const configToSave = {
      hiddenMenus: newHiddenMenus,
      hiddenCategories: newHiddenCategories,
      updatedAt: new Date().toISOString()
    };

    updateLocalState(configToSave);

    let isSuccess = false;

    // Save to Supabase
    if (writeMode === 'supabase' || writeMode === 'both') {
      try {
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            key: SETTING_KEY,
            value: JSON.stringify(configToSave),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (!error) isSuccess = true;
        else console.error('Error saving menu visibility to Supabase:', error);
      } catch (err) {
        console.error('Supabase save error:', err);
      }
    }

    // Save to Firebase
    if (writeMode === 'firebase' || writeMode === 'both') {
      try {
        const docRef = doc(db, 'app_settings', 'menu_visibility');
        await setDoc(docRef, configToSave, { merge: true });
        isSuccess = true;
      } catch (err) {
        console.error('Firebase save error:', err);
      }
    }

    return isSuccess;
  };

  const isMenuHidden = useCallback((href: string) => {
    return hiddenMenus.includes(href);
  }, [hiddenMenus]);

  const isCategoryHidden = useCallback((categoryKey: string) => {
    return hiddenCategories.includes(categoryKey);
  }, [hiddenCategories]);

  const toggleMenuVisibility = async (href: string, hide: boolean): Promise<boolean> => {
    const currentSet = new Set(hiddenMenus);
    if (hide) {
      currentSet.add(href);
    } else {
      currentSet.delete(href);
    }
    return saveVisibilityConfig(Array.from(currentSet), hiddenCategories);
  };

  const toggleCategoryVisibility = async (categoryKey: string, hide: boolean): Promise<boolean> => {
    const currentSet = new Set(hiddenCategories);
    if (hide) {
      currentSet.add(categoryKey);
    } else {
      currentSet.delete(categoryKey);
    }
    return saveVisibilityConfig(hiddenMenus, Array.from(currentSet));
  };

  const unhideAll = async (): Promise<boolean> => {
    return saveVisibilityConfig([], []);
  };

  return (
    <MenuVisibilityContext.Provider
      value={{
        hiddenMenus,
        hiddenCategories,
        isMenuHidden,
        isCategoryHidden,
        toggleMenuVisibility,
        toggleCategoryVisibility,
        unhideAll,
        refreshVisibility: fetchVisibilityConfig,
        loading
      }}
    >
      {children}
    </MenuVisibilityContext.Provider>
  );
}

export function useMenuVisibility() {
  const context = useContext(MenuVisibilityContext);
  if (context === undefined) {
    throw new Error('useMenuVisibility must be used within a MenuVisibilityProvider');
  }
  return context;
}
