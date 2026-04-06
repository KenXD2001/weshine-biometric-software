import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, type, title, message, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600" />, 
    error: <AlertCircle className="w-5 h-5 text-rose-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    info: <Info className="w-5 h-5 text-sky-600" />,
  };

  const colorClasses: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (!isHovered) {
      const timeout = setTimeout(() => onClose(id), duration);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimer(timeout);
      return () => clearTimeout(timeout);
    }
  }, [id, duration, isHovered, onClose]);

  useEffect(() => {
    if (isHovered && timer) {
      clearTimeout(timer);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimer(null);
    } else if (!isHovered && !timer) {
      const timeout = setTimeout(() => onClose(id), duration);
      setTimer(timeout);
      return () => clearTimeout(timeout);
    }
  }, [isHovered, timer, id, duration, onClose]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto w-96 max-w-full border shadow-lg rounded-lg p-3 mb-2 transition-all duration-300 ${colorClasses[type]} ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <div>{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {message && <p className="text-xs mt-1">{message}</p>}
        </div>
        <button
          onClick={() => onClose(id)}
          className="p-1 rounded-md hover:bg-white/40 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
