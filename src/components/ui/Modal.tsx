import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: string;
}

export function Modal({ isOpen, onClose, title, children, size = 'lg', padding = 'p-6' }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-7xl'
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-0 md:p-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={cn(
          'relative inline-block align-bottom bg-white rounded-t-2xl md:rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-4 sm:align-middle w-full',
          sizeClasses[size]
        )}>
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 px-6 border-b border-gray-100 bg-blue-600 text-white">
            <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-all"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className={cn("max-h-[90vh] md:max-h-[85vh] overflow-y-auto", padding)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}