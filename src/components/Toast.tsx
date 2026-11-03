import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastTone } from '../hooks/useToast';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-gray-600 bg-gray-900 text-gray-100',
  success: 'border-emerald-500/60 bg-emerald-950/90 text-emerald-100',
  error: 'border-rose-500/60 bg-rose-950/90 text-rose-100',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++nextId.current;
    setItems(prev => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setItems(prev => prev.filter(item => item.id !== id));
    }, 3200);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map(item => (
          <div
            key={item.id}
            className={`pointer-events-auto max-w-md rounded-lg border px-3 py-2 text-sm shadow-lg shadow-black/40 ${TONE_CLASSES[item.tone]}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
