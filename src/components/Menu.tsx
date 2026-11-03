import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  tone?: 'primary' | 'neutral' | 'cyan';
  title?: string;
}

const TONES = {
  primary: 'bg-purple-600/20 border border-purple-600/30 text-purple-200 hover:bg-purple-600/30',
  neutral: 'bg-gray-800/80 border border-gray-700 text-gray-200 hover:bg-gray-700',
  cyan: 'bg-cyan-600/20 border border-cyan-600/30 text-cyan-200 hover:bg-cyan-600/30',
};

export function Menu({ label, items, align = 'right', tone = 'neutral', title }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        className={`flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors sm:h-9 ${TONES[tone]}`}
      >
        {label}
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute z-50 mt-1 w-64 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl shadow-black/50 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-[11px] text-gray-400">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
