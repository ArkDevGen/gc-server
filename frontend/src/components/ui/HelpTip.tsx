import { useState, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  children: ReactNode;
  /** Placement of the tooltip relative to the icon. Defaults to "top". */
  side?: 'top' | 'bottom' | 'right' | 'left';
  /** Optional aria-label override. */
  label?: string;
}

/**
 * Small (i) icon that reveals an explanatory tooltip on hover/focus.
 * Used inline next to form labels to clarify what a field means without
 * cluttering the layout.
 *
 * Usage:
 *   <label>
 *     Cost Price <HelpTip>What you pay the vendor per unit. Used to calculate margin.</HelpTip>
 *   </label>
 */
export default function HelpTip({ children, side = 'top', label = 'More info' }: HelpTipProps) {
  const [open, setOpen] = useState(false);

  // Tailwind position classes per side
  const positions: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center text-gray-400 hover:text-primary-600 focus:text-primary-600 focus:outline-none"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 ${positions[side]} w-64 px-3 py-2 bg-gray-900 text-white text-xs leading-relaxed rounded-lg shadow-lg pointer-events-none`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
