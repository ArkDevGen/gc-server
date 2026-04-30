import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { Plus, ArrowLeftRight, ArrowRight, Truck, PackageCheck } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';

const statusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Transfers() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchTransfers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (fromFilter) params.from_location_id = fromFilter;
      if (toFilter) params.to_location_id = toFilter;
      const res = await api.get('/transfers', { params });
      setTransfers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, fromFilter, toFilter, sortBy, sortDir]);
  useEffect(() => { fetchTransfers(); }, [statusFilter, fromFilter, toFilter, sortBy, sortDir]);

  useEffect(() => {
    api.get('/items/locations/list').then((res) => setLocations(res.data)).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || fromFilter || toFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setFromFilter(''); setToFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id + action);
    try {
      await api.post(`/transfers/${id}/${action}`);
      fetchTransfers();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setActionLoading(''); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> New Transfer
        </button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchTransfers(1)}
        searchPlaceholder="Search by transfer number or location..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={fromFilter} onChange={(e) => setFromFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All From Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={toFilter} onChange={(e) => setToFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All To Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="transfer_number" label="Transfer #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="from_location" label="From" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="to_location" label="To" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="requested_by" label="Requested By" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                <ArrowLeftRight size={32} className="mx-auto mb-2 text-gray-300" />
                No transfers found
              </td></tr>
            ) : transfers.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium font-mono">{t.transfer_number}</td>
                <td className="px-4 py-3">{t.from_location_name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <ArrowRight size={12} className="text-gray-400" /> {t.to_location_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{t.requested_by_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || ''}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {t.status === 'requested' && (
                      <button onClick={() => handleAction(t.id, 'approve')} disabled={!!actionLoading}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Approve</button>
                    )}
                    {(t.status === 'requested' || t.status === 'approved') && (
                      <button onClick={() => handleAction(t.id, 'ship')} disabled={!!actionLoading}
                        className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 flex items-center gap-1">
                        <Truck size={10} /> Ship
                      </button>
                    )}
                    {t.status === 'in_transit' && (
                      <button onClick={() => handleAction(t.id, 'receive')} disabled={!!actionLoading}
                        className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-1">
                        <PackageCheck size={10} /> Receive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchTransfers(p)} />
      </div>

      {showCreate && <CreateTransferModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchTransfers(); }} />}
    </div>
  );
}

function CreateTransferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<any[]>([{ item_id: '', qty_requested: 1 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/items/locations/list'), api.get('/items', { params: { limit: 200 } })])
      .then(([l, i]) => { setLocations(l.data); setItems(i.data.data); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/transfers', { from_location_id: fromLocation, to_location_id: toLocation, notes, lines });
      onCreated();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Transfer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
              <select value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} required
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
              <select value={toLocation} onChange={(e) => setToLocation(e.target.value)} required
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select</option>
                {locations.filter((l) => l.id !== fromLocation).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <button type="button" onClick={() => setLines([...lines, { item_id: '', qty_requested: 1 }])}
                className="text-sm text-primary-600 font-medium">+ Add</button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={line.item_id} onChange={(e) => {
                  const updated = [...lines]; updated[idx] = { ...updated[idx], item_id: e.target.value }; setLines(updated);
                }} className="flex-1 px-2 py-1.5 border rounded text-sm bg-white" required>
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" value={line.qty_requested} onChange={(e) => {
                  const updated = [...lines]; updated[idx] = { ...updated[idx], qty_requested: parseFloat(e.target.value) || 0 }; setLines(updated);
                }} className="w-24 px-2 py-1.5 border rounded text-sm" placeholder="Qty" />
                {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-600">&times;</button>}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
