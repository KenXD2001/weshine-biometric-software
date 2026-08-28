import React from 'react';
import Button from './ui/Button';

interface UploadModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: () => void;
  onMerge: () => void;
}

const UploadModeModal: React.FC<UploadModeModalProps> = ({isOpen, onClose, onReplace, onMerge}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900">Candidate data already exists</h2>
        <p className="mt-2 text-sm text-gray-600">Choose how to combine new candidate upload with existing data.</p>

        <div className="mt-5 grid grid-cols-1 gap-3">
          <Button variant="danger" fullWidth onClick={onReplace}>
            Replace Existing
          </Button>
          <Button variant="secondary" fullWidth onClick={onMerge}>
            Merge with Existing
          </Button>
          <Button variant="gray" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UploadModeModal;
