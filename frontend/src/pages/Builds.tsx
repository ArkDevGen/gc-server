import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Hammer } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-700',
  complete: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Builds() {
  const [builds, setBuilds] = useState<any[]>([]);
  const [foremen, setForemen] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [foremanFilter, setForemanFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchBuilds = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (foremanFilter) params.foreman_id = foremanFilter;
      if (locationFilter) params.location_id = locationFilter;
      const res = await api.get('/builds', { params });
      setBuilds(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, foremanFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => { fetchBuilds(); }, [statusFilter, foremanFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => {
    Promise.all([
      api.get('/auth/users/list', { params: { role: 'foreman' } }),
      api.get('/items/locations/list'),
    ]).then(([f, l]) => { setForemen(f.data); setLocations(l.data); }).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || foremanFilter || locationFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setForemanFilter(''); setLocationFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Builds</h1>
      </div>

      <PageHelp storageKey="builds" defaultOpen>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Builds are created from quotes</strong> &mdash; open an accepted quote and click "Convert to Build". Materials get allocated automatically from the quote lines.</li>
          <li><strong>Record material usage</strong>: open a build &rarr; "Record Usage" to log what was actually consumed. Stock decrements from the source location.</li>
          <li><strong>Track variance</strong>: the build dashboard shows planned vs actual cost so you can see margin in real time.</li>
          <li><strong>Close out</strong>: when finished, click "Close Out". Leftover materials are automatically captured into the surplus pool with their original cost basis &mdash; reusable on future quotes.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchBuilds(1)}
        searchPlaceholder="Search by build number, name, or customer..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="complete">Complete</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={foremanFilter} onChange={(e) => setForemanFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Foremen</option>
          {foremen.map((f) => <option key={f.id} value={f.id}>{f.display_name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="build_number" label="Build #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="name" label="Name" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="customer" label="Customer" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="location" label="Location" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="foreman" label="Foreman" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="budget" label="Budget" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="actual" label="Actual" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : builds.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <Hammer size={32} className="mx-auto mb-2 text-gray-300" />
                No builds found
              </td></tr>
            ) : builds.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/builds/${b.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {b.build_number}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">{b.customer_name || '--'}</td>
                <td className="px-4 py-3">{b.location_name}</td>
                <td className="px-4 py-3">{b.foreman_name || '--'}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(b.budget_total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {parseFloat(b.actual_total) > 0 ? `$${parseFloat(b.actual_total).toFixed(2)}` : '--'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status] || ''}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchBuilds(p)} />
      </div>
    </div>
  );
}
