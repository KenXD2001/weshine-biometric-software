import React from 'react';
import { X } from 'lucide-react';
import Button from './ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <button
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          onClick={onCancel}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="p-5 pt-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-4">
          <Button variant="gray" size="sm" onClick={onCancel}>{cancelText}</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
