
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal"
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4" style={{ zIndex: 10000 }}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto" style={{ zIndex: 10001 }}>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-600">{message}</p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                onClick={onClose}
                className="h-10 px-6 bg-white/10 hover:bg-white/20 text-slate-600 font-bold rounded-xl shadow-sm transition-all border border-slate-200 backdrop-blur-xl"
              >
                {cancelText}
              </Button>
              <Button
                onClick={onConfirm}
                className="h-10 px-6 bg-gradient-to-br from-rose-400 to-red-600 hover:from-red-500 hover:to-rose-700 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(225,29,72,0.3)] hover:shadow-red-500/40 transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md"
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}