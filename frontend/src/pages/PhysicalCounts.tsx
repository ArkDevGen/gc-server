import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Plus, ClipboardList } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  applied: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PhysicalCounts() {
  const [counts, setCounts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchCounts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (locationFilter) params.location_id = locationFilter;
      if (assignedFilter) params.assigned_to = assignedFilter;
      const res = await api.get('/counts', { params });
      setCounts(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, locationFilter, assignedFilter, sortBy, sortDir]);
  useEffect(() => { fetchCounts(); }, [statusFilter, locationFilter, assignedFilter, sortBy, sortDir]);

  useEffect(() => {
    Promise.all([
      api.get('/items/locations/list'),
      api.get('/auth/users/list'),
    ]).then(([l, u]) => { setLocations(l.data); setUsers(u.data); }).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || locationFilter || assignedFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setLocationFilter(''); setAssignedFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Physical Counts</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> New Count
        </button>
      </div>

      <PageHelp storageKey="physical-counts">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Create a count</strong>: pick a location and optionally narrow by category or aisle. The system pre-loads every item at that location with its expected qty.</li>
          <li><strong>Record counts</strong>: open the count, walk the floor, enter the actual qty for each line. Variances are highlighted in real time.</li>
          <li><strong>Apply</strong>: when you're done, click Apply &mdash; inventory adjusts to match what you counted, with an audit row per change.</li>
          <li><strong>Cycle counts</strong>: do these regularly to keep numbers honest. Once a quarter for everything, or rotate aisles weekly.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchCounts(1)}
        searchPlaceholder="Search by count number, description, or location..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="count_number" label="Count #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="location" label="Location" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="assigned_to" label="Assigned To" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="total_items" label="Items" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="items_counted" label="Counted" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="items_variance" label="Variances" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : counts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
                No physical counts found
              </td></tr>
            ) : counts.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/counts/${c.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {c.count_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.location_name}</td>
                <td className="px-4 py-3 text-gray-600">{c.assigned_to_name || '--'}</td>
                <td className="px-4 py-3 text-right">{c.total_items}</td>
                <td className="px-4 py-3 text-right">{c.items_counted}</td>
                <td className="px-4 py-3 text-right">
                  {c.items_variance > 0 ? <span className="text-amber-600 font-medium">{c.items_variance}</span> : '--'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] || ''}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchCounts(p)} />
      </div>

      {showCreate && <CreateCountModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchCounts(); }} />}
    </div>
  );
}

function CreateCountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [locations, setLocations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ location_id: '', description: '', assigned_to: '', filter_category_id: '', filter_aisle: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/items/locations/list'),
      api.get('/items/categories/list'),
      api.get('/auth/users/list').catch(() => ({ data: [] })),
    ]).then(([l, c, u]) => { setLocations(l.data); setCategories(c.data); setUsers(u.data); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload: any = { location_id: form.location_id };
      if (form.description) payload.description = form.description;
      if (form.assigned_to) payload.assigned_to = form.assigned_to;
      if (form.filter_category_id) payload.filter_category_id = form.filter_category_id;
      if (form.filter_aisle) payload.filter_aisle = form.filter_aisle;

      await api.post('/counts', payload);
      onCreated();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Physical Count</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} required
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">Select location to count</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Q2 Full Warehouse Count" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
            <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter: Category</label>
              <select value={form.filter_category_id} onChange={(e) => setForm({ ...form, filter_category_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter: Aisle</label>
              <input value={form.filter_aisle} onChange={(e) => setForm({ ...form, filter_aisle: e.target.value })}
                placeholder="e.g. A" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Items from the selected location will be automatically loaded. Use filters to narrow down to specific categories or aisles.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Count'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
