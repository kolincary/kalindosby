import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { format } from 'date-fns';

interface UpdateNotification {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'update_notification_read';

export const UpdateNotificationPopup: React.FC = () => {
  const [notification, setNotification] = useState<UpdateNotification | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    loadActiveNotification();
  }, []);

  const loadActiveNotification = async () => {
    try {
      const { data, error } = await supabase
        .from('update_notifications')
        .select('id, title, content, is_active, created_at, updated_at')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const readNotificationId = localStorage.getItem(STORAGE_KEY);

        if (readNotificationId !== data.id) {
          setNotification(data);
          setShowPopup(true);
        }
      }
    } catch (error) {
      console.error('Error loading notification:', error);
    }
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  const handleMarkAsRead = () => {
    if (notification) {
      localStorage.setItem(STORAGE_KEY, notification.id);
      setShowPopup(false);
    }
  };

  if (!showPopup || !notification) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[calc(100vh-4rem)] flex flex-col animate-in fade-in zoom-in duration-300 pointer-events-auto">
          <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white p-6 sm:p-8 flex-shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

            <div className="relative flex items-start justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />
                  <span className="text-xs sm:text-sm font-semibold text-blue-100 uppercase tracking-wide">Pembaruan</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{notification.title}</h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-2">
                  {format(new Date(notification.updated_at), 'dd/MM/yyyy HH:mm')} WIB
                </p>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-200 hover:rotate-90"
                title="Tutup"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8 overflow-y-auto flex-1">
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-100">
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {notification.content}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 border-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-all duration-200 py-2.5 sm:py-3 font-semibold text-sm sm:text-base"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Tutup
              </Button>
              <Button
                onClick={handleMarkAsRead}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all duration-200 py-2.5 sm:py-3 font-semibold shadow-lg shadow-green-200 text-sm sm:text-base"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Saya Sudah Membaca
              </Button>
            </div>

            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-start gap-3 text-xs sm:text-sm">
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                <p className="text-gray-600 leading-relaxed">
                  <span className="font-semibold text-gray-700">Tips:</span> Klik <span className="font-semibold text-red-600">"Tutup"</span> untuk melihat notifikasi ini lagi nanti, atau klik <span className="font-semibold text-green-600">"Saya Sudah Membaca"</span> untuk tidak menampilkannya lagi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};