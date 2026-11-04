import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastAction, type ToastTone } from '../hooks/useToast';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-gray-600 bg-gray-900 text-gray-100',
  success: 'border-emerald-500/60 bg-emerald-950/90 text-emerald-100',
  error: 'border-rose-500/60 bg-rose-950/90 text-rose-100',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'info', action?: ToastAction) => {
    const id = ++nextId.current;
    setItems(prev => [...prev.slice(-2), { id, message, tone, action }]);
    window.setTimeout(() => {
      setItems(prev => prev.filter(item => item.id !== id));
    }, action ? 7000 : 3200);
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
            <div className="flex items-center gap-3">
              <span>{item.message}</span>
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.onClick();
                    setItems(prev => prev.filter(entry => entry.id !== item.id));
                  }}
                  className="shrink-0 rounded border border-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/10"
                >
                  {item.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
