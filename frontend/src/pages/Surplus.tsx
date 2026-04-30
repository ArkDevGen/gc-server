import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { Recycle } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';

export default function Surplus() {
  const [surplus, setSurplus] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'detail' | 'summary'>('summary');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('captured_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (locationFilter) params.location_id = locationFilter;
      const [detailRes, summaryRes] = await Promise.all([
        api.get('/surplus', { params }),
        api.get('/surplus/summary'),
      ]);
      setSurplus(detailRes.data.data);
      setPagination(detailRes.data.pagination);
      setSummary(summaryRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, locationFilter, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [locationFilter, sortBy, sortDir]);

  useEffect(() => {
    api.get('/items/locations/list').then((res) => setLocations(res.data)).catch(() => {});
  }, []);

  const hasFilters = !!(locationFilter || search);
  const clearFilters = () => { setSearch(''); setLocationFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Surplus Inventory</h1>
      </div>

      <PageHelp storageKey="surplus">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Where surplus comes from</strong>: when a build closes out with leftover material, the system automatically captures it into the surplus pool with the original cost basis.</li>
          <li><strong>Summary tab</strong>: aggregated totals per item (e.g., "47 fence posts available across 3 builds").</li>
          <li><strong>Detail tab</strong>: every individual surplus pool entry with source build, location, and capture date.</li>
          <li><strong>Reuse on quotes</strong>: when you add a line item to a quote that has surplus available, you'll see "Surplus available: N" with a toggle to consume from the pool at original cost.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchData(1)}
        searchPlaceholder="Search surplus items by name or SKU..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </FilterBar>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('summary')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'summary' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Summary
        </button>
        <button onClick={() => setTab('detail')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'detail' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Detail
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {tab === 'summary' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Available</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Cost</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sources</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : summary.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <Recycle size={32} className="mx-auto mb-2 text-gray-300" />
                  No surplus inventory. Surplus is captured when builds are closed out.
                </td></tr>
              ) : summary.map((s) => (
                <tr key={s.item_id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.item_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.sku || '--'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-600">
                    {parseFloat(s.total_available).toLocaleString()} {s.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${parseFloat(s.avg_cost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{s.pool_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <SortHeader col="item" label="Item" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
                <SortHeader col="location" label="Location" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source Build</th>
                <SortHeader col="qty" label="Qty" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
                <SortHeader col="cost" label="Cost" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
                <SortHeader col="captured_at" label="Captured" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Condition</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : surplus.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No surplus items found</td></tr>
              ) : surplus.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.item_name}</td>
                  <td className="px-4 py-3">{s.location_name}</td>
                  <td className="px-4 py-3">{s.build_number ? `${s.build_number} - ${s.build_name}` : '--'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-600">
                    {parseFloat(s.qty_available).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${s.original_cost ? parseFloat(s.original_cost).toFixed(2) : '--'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.captured_at ? new Date(s.captured_at).toLocaleDateString() : '--'}
                    {s.captured_by_name && ` by ${s.captured_by_name}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.condition_notes || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'detail' && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
        )}
      </div>
    </div>
  );
}
