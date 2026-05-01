import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { ShoppingCart, Plus, X, Save } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';
import { useToast } from '../components/ui/Toast';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-blue-100 text-blue-700',
  sent_to_qbo: 'bg-purple-100 text-purple-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrders() {
  const [pos, setPOs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchPOs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (vendorFilter) params.vendor_id = vendorFilter;
      if (locationFilter) params.location_id = locationFilter;
      const res = await api.get('/purchase-orders', { params });
      setPOs(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, vendorFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => { fetchPOs(); }, [statusFilter, vendorFilter, locationFilter, sortBy, sortDir]);

  useEffect(() => {
    Promise.all([
      api.get('/vendors'),
      api.get('/items/locations/list'),
    ]).then(([v, l]) => { setVendors(v.data); setLocations(l.data); }).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || vendorFilter || locationFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setVendorFilter(''); setLocationFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> New PO
        </button>
      </div>

      <PageHelp storageKey="purchase-orders" defaultOpen>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Create a PO</strong>: pick vendor + receiving location, add line items, save as Draft.</li>
          <li><strong>Send to vendor</strong>: change status to Pending. (When QBO sync ships, this will push to QuickBooks too.)</li>
          <li><strong>Receive stock</strong>: open the PO &rarr; "Receive". Enter quantities received per line &mdash; partial receives are supported. Inventory updates automatically at the chosen location.</li>
          <li><strong>Auto-generate from low stock</strong>: <em>Reports &rarr; Reorder Suggestions</em> can build POs for everything below reorder point.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchPOs(1)}
        searchPlaceholder="Search by PO number or vendor name..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="sent_to_qbo">Sent to QBO</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="po_number" label="PO #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="vendor" label="Vendor" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="location" label="Location" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="total" label="Total" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                No purchase orders found
              </td></tr>
            ) : pos.map((po) => (
              <tr key={po.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/purchase-orders/${po.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {po.po_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{po.vendor_name}</td>
                <td className="px-4 py-3">{po.location_name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(po.order_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(po.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || ''}`}>
                    {po.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchPOs(p)} />
      </div>

      {showCreate && (
        <CreatePOModal
          vendors={vendors}
          locations={locations}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchPOs(); }}
        />
      )}
    </div>
  );
}

function CreatePOModal({ vendors, locations, onClose, onCreated }: {
  vendors: any[]; locations: any[]; onClose: () => void; onCreated: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ vendor_id: '', location_id: '', expected_date: '', notes: '' });
  const [lines, setLines] = useState<any[]>([{ item_id: '', description: '', qty_ordered: 1, unit_cost: 0 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/items', { params: { limit: 200 } }).then((res) => setItems(res.data.data)).catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty_ordered: 1, unit_cost: 0 }]);
  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'item_id' && value) {
      const item = items.find((i) => i.id === value);
      if (item) {
        updated[idx].description = item.name;
        updated[idx].unit_cost = parseFloat(item.cost_price) || 0;
      }
    }
    setLines(updated);
  };

  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_cost) || 0), 0);

  const handleSubmit = async () => {
    setError('');
    if (!form.vendor_id) return setError('Pick a vendor.');
    if (!form.location_id) return setError('Pick a receiving location.');
    const cleanLines = lines
      .filter((l) => (parseFloat(l.qty_ordered) || 0) > 0 && (l.item_id || (l.description || '').trim().length > 0))
      .map((l) => ({
        item_id: l.item_id || undefined,
        description: l.description || items.find((i) => i.id === l.item_id)?.name || '',
        qty_ordered: parseFloat(l.qty_ordered),
        unit_cost: parseFloat(l.unit_cost) || 0,
      }));
    if (cleanLines.length === 0) return setError('Add at least one line.');
    for (const cl of cleanLines) {
      if (!cl.description) return setError('Custom items need a description.');
    }
    setSaving(true);
    try {
      const res = await api.post('/purchase-orders', {
        vendor_id: form.vendor_id,
        location_id: form.location_id,
        expected_date: form.expected_date || undefined,
        notes: form.notes || undefined,
        lines: cleanLines,
      });
      toast.success(`Created ${res.data.po_number}.`);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create PO.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">New Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
              <select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select vendor...</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receiving Location *</label>
              <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select location...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
              <input type="date" value={form.expected_date}
                onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <button type="button" onClick={addLine}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Line</button>
            </div>

            <div className="grid grid-cols-12 gap-2 px-3 mb-1 text-xs font-medium text-gray-500">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-3 text-right">Unit Cost</div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select value={line.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                      className="col-span-6 px-2 py-1.5 border rounded text-sm bg-white">
                      <option value="">Custom item</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ''}{i.name}</option>)}
                    </select>
                    <input type="number" step="0.01" min="0.01" value={line.qty_ordered}
                      onChange={(e) => updateLine(idx, 'qty_ordered', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                    <input type="number" step="0.01" min="0" value={line.unit_cost}
                      onChange={(e) => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-2 py-1.5 border rounded text-sm text-right" />
                    <button type="button" onClick={() => removeLine(idx)}
                      className="col-span-1 text-red-400 hover:text-red-600">&times;</button>
                  </div>
                  {!line.item_id && (
                    <input placeholder="Description (required for custom items)" value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Internal notes for this PO..." />
          </div>

          <div className="flex justify-end text-sm">
            <div className="flex gap-3">
              <span className="text-gray-500">Total</span>
              <span className="font-mono w-28 text-right text-lg font-bold">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-white text-sm font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            <Save size={14} /> {saving ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}
