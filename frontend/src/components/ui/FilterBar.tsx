import { ReactNode, FormEvent } from 'react';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  children?: ReactNode; // dropdown / extra controls
}

export default function FilterBar({
  search,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search...',
  hasFilters,
  onClearFilters,
  children,
}: FilterBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.();
  };

  const showSearch = search !== undefined && onSearchChange;

  return (
    <div className="bg-white rounded-xl border p-4 mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {showSearch && (
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
            >
              Search
            </button>
          </div>
        )}
        {(children || hasFilters) && (
          <div className="flex flex-wrap gap-3 items-center">
            {children}
            {hasFilters && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
