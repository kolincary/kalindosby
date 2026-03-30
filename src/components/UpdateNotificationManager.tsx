import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Plus, Save, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';
import { format } from 'date-fns';

interface UpdateNotification {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const UpdateNotificationManager: React.FC = () => {
  const [notifications, setNotifications] = useState<UpdateNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<UpdateNotification | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_active: false
  });

  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const templates = [
    {
      title: '🎉 Fitur Baru Tersedia',
      content: 'Kami telah menambahkan fitur baru yang akan memudahkan pekerjaan Anda:\n\n✓ [Sebutkan fitur 1]\n✓ [Sebutkan fitur 2]\n✓ [Sebutkan fitur 3]\n\nSilakan coba dan berikan masukan Anda!'
    },
    {
      title: '🔧 Pembaruan Sistem',
      content: 'Sistem telah diperbarui dengan perbaikan dan peningkatan berikut:\n\n• Peningkatan kecepatan loading\n• Perbaikan bug pada [sebutkan fitur]\n• Optimasi performa database\n\nTerima kasih atas kesabaran Anda.'
    },
    {
      title: '⚠️ Pemberitahuan Penting',
      content: 'Perhatian!\n\n[Isi pemberitahuan penting di sini]\n\nHarap segera ditindaklanjuti. Untuk informasi lebih lanjut, hubungi tim support.'
    },
    {
      title: '📢 Pengumuman',
      content: 'Pengumuman untuk seluruh pengguna:\n\n[Isi pengumuman di sini]\n\nTerima kasih atas perhatian Anda.'
    },
    {
      title: '🛠️ Maintenance Terjadwal',
      content: 'Sistem akan menjalani maintenance pada:\n\n📅 Tanggal: [Tanggal]\n⏰ Waktu: [Waktu mulai] - [Waktu selesai]\n\nSelama periode ini, sistem mungkin tidak dapat diakses. Mohon maaf atas ketidaknyamanannya.'
    },
    {
      title: '✨ Peningkatan Performa',
      content: 'Kami telah melakukan optimasi untuk meningkatkan performa aplikasi:\n\n⚡ Loading lebih cepat\n💾 Penggunaan memori lebih efisien\n🔒 Keamanan yang ditingkatkan\n\nNikmati pengalaman yang lebih baik!'
    },
    {
      title: '🎓 Tips & Trik',
      content: 'Tahukah Anda?\n\n[Bagikan tips atau trik berguna untuk pengguna]\n\nGunakan fitur ini untuk memaksimalkan produktivitas Anda!'
    },
    {
      title: '🆕 Buat Template Sendiri',
      content: ''
    }
  ];

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('update_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      setToast({ message: `Error loading notifications: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (notification?: UpdateNotification) => {
    if (notification) {
      setEditingNotification(notification);
      setFormData({
        title: notification.title,
        content: notification.content,
        is_active: notification.is_active
      });
    } else {
      setEditingNotification(null);
      setFormData({
        title: '',
        content: '',
        is_active: false
      });
    }
    setShowTemplateDropdown(false);
    setShowModal(true);
  };

  const handleTemplateSelect = (template: { title: string; content: string }) => {
    setFormData({
      ...formData,
      title: template.title,
      content: template.content
    });
    setShowTemplateDropdown(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNotification(null);
    setFormData({
      title: '',
      content: '',
      is_active: false
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setToast({ message: 'Please fill in all fields', type: 'error' });
      return;
    }

    try {
      setIsLoading(true);

      // If we are activating this notification, deactivate others first
      if (formData.is_active) {
        let deactivateQuery = supabase
          .from('update_notifications')
          .update({ is_active: false });

        if (editingNotification) {
          deactivateQuery = deactivateQuery.neq('id', editingNotification.id);
        } else {
          // Add a dummy filter to satisfy the "WHERE clause required" safety check
          deactivateQuery = deactivateQuery.neq('id', '00000000-0000-0000-0000-000000000000');
        }

        const { error: deactivateError } = await deactivateQuery;
        if (deactivateError) {
          console.error('Error deactivating other notifications:', deactivateError);
          throw deactivateError;
        }
      }

      if (editingNotification) {
        const { error } = await supabase
          .from('update_notifications')
          .update({
            title: formData.title.trim(),
            content: formData.content.trim(),
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
            version: '1.0.0' // Added to satisfy db constraint
          })
          .eq('id', editingNotification.id);

        if (error) {
          console.error('Error updating notification:', error);
          throw error;
        }
        setToast({ message: 'Notification updated successfully', type: 'success' });
      } else {
        const { error } = await supabase
          .from('update_notifications')
          .insert([{
            title: formData.title.trim(),
            content: formData.content.trim(),
            is_active: formData.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: '1.0.0' // Added to satisfy db constraint
          }]);

        if (error) {
          console.error('Error creating notification:', error);
          throw error;
        }
        setToast({ message: 'Notification created successfully', type: 'success' });
      }

      handleCloseModal();
      await loadNotifications();
    } catch (error: any) {
      console.error('Full error in handleSubmit:', error);
      setToast({ message: `Error saving notification: ${error.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (notification: UpdateNotification) => {
    try {
      if (!notification.is_active) {
        const { error: deactivateError } = await supabase
          .from('update_notifications')
          .update({ is_active: false })
          .neq('id', notification.id);

        if (deactivateError) throw deactivateError;
      }

      const { error } = await supabase
        .from('update_notifications')
        .update({ is_active: !notification.is_active })
        .eq('id', notification.id);

      if (error) throw error;

      setToast({
        message: `Notification ${!notification.is_active ? 'activated' : 'deactivated'} successfully`,
        type: 'success'
      });
      loadNotifications();
    } catch (error: any) {
      setToast({ message: `Error toggling notification: ${error.message}`, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const { error } = await supabase
        .from('update_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setToast({ message: 'Notification deleted successfully', type: 'success' });
      loadNotifications();
    } catch (error: any) {
      setToast({ message: `Error deleting notification: ${error.message}`, type: 'error' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Manage Update Notifications</h1>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          New Notification
        </Button>
      </div>

      <div className="grid gap-4">
        {notifications.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No notifications yet. Create your first update notification.
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{notification.title}</h3>
                    {notification.is_active && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap">{notification.content}</p>
                  <div className="text-sm text-gray-500 mt-3 space-y-1">
                    <p>📅 Dibuat: {notification.created_at ? format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm') : '-'} WIB</p>
                    <p>🔄 Diperbarui: {notification.updated_at ? format(new Date(notification.updated_at), 'dd/MM/yyyy HH:mm') : '-'} WIB</p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(notification)}
                    title={notification.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {notification.is_active ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(notification)}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(notification.id)}
                    className="hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingNotification ? 'Edit Notifikasi' : 'Buat Notifikasi Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium mb-2">Judul Notifikasi</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Pilih template atau ketik sendiri"
              />
              <button
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                title="Pilih Template"
              >
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showTemplateDropdown && (
              <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {templates.map((template, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{template.title}</div>
                    {template.content && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {template.content.replace(/\n/g, ' ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Isi Notifikasi</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Tulis isi notifikasi di sini...\n\nGunakan \n untuk membuat baris baru"
            />
            <p className="text-xs text-gray-500 mt-1">Tip: Gunakan emoji untuk membuat notifikasi lebih menarik! 🎉 ✨ 📢</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="is_active" className="text-sm font-semibold text-blue-900 cursor-pointer">
                  Aktifkan notifikasi ini
                </label>
                <p className="text-xs text-blue-700 mt-1">
                  Notifikasi aktif akan ditampilkan kepada semua pengguna. Mengaktifkan ini akan menonaktifkan notifikasi lainnya.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal} className="px-6">
              Batal
            </Button>
            <Button type="submit" className="px-6 bg-blue-600 hover:bg-blue-700">
              {editingNotification ? 'Perbarui' : 'Buat Notifikasi'}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && (
        <Toast
          isOpen={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};