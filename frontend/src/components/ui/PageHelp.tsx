import { useState, useEffect, ReactNode } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface PageHelpProps {
  /** Stable key used to remember dismiss/collapse state in localStorage. */
  storageKey: string;
  title?: string;
  children: ReactNode;
  /** If true, the panel is open by default the first time it's seen. */
  defaultOpen?: boolean;
}

/**
 * Collapsible "How this page works" banner anchored at the top of a page.
 * Remembers open/closed state per user via localStorage so power users
 * don't have to dismiss it on every visit.
 *
 * Usage:
 *   <PageHelp storageKey="quotes-page-help" title="How this page works">
 *     <ol className="list-decimal pl-5 space-y-1">
 *       <li>Click "+ New Quote" to start...</li>
 *       <li>...</li>
 *     </ol>
 *   </PageHelp>
 */
export default function PageHelp({ storageKey, title = 'How this page works', children, defaultOpen = false }: PageHelpProps) {
  const fullKey = `pagehelp:${storageKey}`;
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen;
    const saved = localStorage.getItem(fullKey);
    if (saved === 'open') return true;
    if (saved === 'closed') return false;
    return defaultOpen;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(fullKey, open ? 'open' : 'closed');
    }
  }, [open, fullKey]);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-blue-100/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <Info size={15} /> {title}
        </span>
        {open ? <ChevronUp size={16} className="text-blue-700" /> : <ChevronDown size={16} className="text-blue-700" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-blue-900 border-t border-blue-200">
          {children}
        </div>
      )}
    </div>
  );
}
