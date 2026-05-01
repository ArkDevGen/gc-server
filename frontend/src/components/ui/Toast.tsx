import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    // Auto-dismiss after 5 seconds (errors stay a bit longer at 8s)
    const ttl = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const value: ToastContextValue = {
    show,
    success: (msg) => show('success', msg),
    error: (msg) => show('error', msg),
    warning: (msg) => show('warning', msg),
    info: (msg) => show('info', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />,
    error: <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />,
    info: <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />,
  };
  const borders = {
    success: 'border-l-green-600',
    error: 'border-l-red-600',
    warning: 'border-l-amber-600',
    info: 'border-l-blue-600',
  };

  return (
    <div
      role="alert"
      className={`bg-white shadow-lg rounded-lg border border-gray-200 border-l-4 ${borders[toast.type]} px-4 py-3 flex items-start gap-3 pointer-events-auto animate-in slide-in-from-right`}
    >
      {icons[toast.type]}
      <div className="flex-1 text-sm text-gray-800 leading-relaxed">{toast.message}</div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
