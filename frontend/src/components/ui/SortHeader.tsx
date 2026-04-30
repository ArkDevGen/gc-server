import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  col: string;
  label: string;
  sortBy: string;
  sortDir: SortDir;
  onToggle: (col: string) => void;
  align?: 'left' | 'right' | 'center';
}

export default function SortHeader({
  col,
  label,
  sortBy,
  sortDir,
  onToggle,
  align = 'left',
}: SortHeaderProps) {
  const Icon =
    sortBy !== col ? (
      <ArrowUpDown size={12} className="text-gray-300" />
    ) : sortDir === 'asc' ? (
      <ArrowUp size={12} className="text-primary-600" />
    ) : (
      <ArrowDown size={12} className="text-primary-600" />
    );

  return (
    <th
      className={`text-${align} px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none`}
      onClick={() => onToggle(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
        {label} {Icon}
      </span>
    </th>
  );
}

/** Helper hook-like utility for managing sort state. */
export function toggleSort(
  col: string,
  sortBy: string,
  sortDir: SortDir,
  setSortBy: (s: string) => void,
  setSortDir: (d: SortDir) => void,
) {
  if (sortBy === col) {
    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
  } else {
    setSortBy(col);
    setSortDir('asc');
  }
}
