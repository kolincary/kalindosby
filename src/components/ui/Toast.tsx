import React from 'react';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';

interface ToastProps {
  isOpen: boolean;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  onClose: () => void;
  details?: string[];
}

export function Toast({ isOpen, message, type, onClose, details }: ToastProps) {
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-white drop-shadow-sm" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-white drop-shadow-sm" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-white drop-shadow-sm" />;
      default:
        return <Info className="h-6 w-6 text-white drop-shadow-sm" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-600 border-none text-white shadow-2xl';
      case 'warning':
        return 'bg-amber-500 border-none text-white shadow-2xl';
      case 'error':
        return 'bg-rose-600 border-none text-white shadow-2xl';
      default:
        return 'bg-blue-600 border-none text-white shadow-2xl';
    }
  };

  return (
    <div className="fixed top-6 md:top-20 inset-x-4 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-top duration-500">
      <div className={`rounded-xl shadow-2xl overflow-hidden mx-auto w-full md:max-w-2xl ${getStyles()}`}>
        <div className="flex items-start space-x-4 px-6 py-5">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold mb-1 whitespace-pre-line tracking-wide drop-shadow-sm">{message}</p>
            {details && details.length > 0 && (
              <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="space-y-1.5">
                  {details.map((detail, index) => (
                    <div key={index} className="text-sm text-white flex items-start">
                      <span className="font-bold mr-2 text-white/80">{index + 1}.</span>
                      <span className="font-medium leading-relaxed drop-shadow-sm">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full"
          >
            <X className="h-5 w-5 drop-shadow-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}