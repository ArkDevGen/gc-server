import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, MapPin, History, Plus, Minus, Pencil, Save, X, ExternalLink } from 'lucide-react';
import HelpTip from '../components/ui/HelpTip';

interface ItemLocation {
  id: string;
  location_id: string;
  location_name: string;
  location_type: string;
  qty_on_hand: string;
  qty_reserved: string;
  qty_available: string;
  bin_aisle: string | null;
  bin_shelf: string | null;
  bin_position: string | null;
  bin_label: string | null;
}

interface Adjustment {
  id: string;
  location_name: string;
  qty_change: string;
  qty_before: string;
  qty_after: string;
  reason: string;
  notes: string;
  adjusted_by_name: string;
  created_at: string;
}

interface ItemDetail {
  id: string;
  sku: string;
  name: string;
  description: string;
  item_type: string;
  category_id: string;
  category_name: string;
  unit_of_measure: string;
  cost_price: string;
  sell_price: string;
  reorder_point: number;
  reorder_qty: number;
  preferred_vendor_id: string;
  vendor_name: string;
  vendor_website: string;
  lead_time_days: number | null;
  safety_stock_days: number | null;
  total_on_hand: number;
  total_available: number;
  locations: ItemLocation[];
}

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [history, setHistory] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState<'locations' | 'history'>('locations');

  const fetchItem = async () => {
    try {
      const [itemRes, histRes] = await Promise.all([
        api.get(`/items/${id}`),
        api.get(`/items/${id}/history`, { params: { limit: 50 } }),
      ]);
      setItem(itemRes.data);
      setHistory(histRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItem(); }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!item) return <div className="text-center py-12 text-gray-500">Item not found</div>;

  return (
    <div>
      <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Inventory
      </Link>

      {/* Item header */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
              {item.category_name && <span>{item.category_name}</span>}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                ${item.item_type === 'inventory' ? 'bg-blue-100 text-blue-700' :
                  item.item_type === 'surplus' ? 'bg-amber-100 text-amber-700' :
                  item.item_type === 'service' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'}`}
              >
                {item.item_type.replace('_', ' ')}
              </span>
              <span>{item.unit_of_measure}</span>
            </div>
            {item.description && <p className="text-sm text-gray-600 mt-2">{item.description}</p>}
            {item.vendor_name && (
              <p className="text-sm text-gray-500 mt-2">
                Preferred Vendor: <span className="font-medium">{item.vendor_name}</span>
                {item.vendor_website && (
                  <a href={item.vendor_website.startsWith('http') ? item.vendor_website : `https://${item.vendor_website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary-600 hover:text-primary-700">
                    <ExternalLink size={12} /> Visit
                  </a>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Pencil size={14} /> Edit Item
            </button>
            <button onClick={() => setShowAdjust(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap">
              Adjust Stock
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-500">Total On Hand</p>
            <p className="text-2xl font-bold">{item.total_on_hand.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Available</p>
            <p className="text-2xl font-bold text-green-600">{item.total_available.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Cost</p>
            <p className="text-2xl font-bold">${parseFloat(item.cost_price).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Sell Price</p>
            <p className="text-2xl font-bold">${parseFloat(item.sell_price).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Lead Time</p>
            <p className="text-2xl font-bold">{item.lead_time_days ?? '--'}<span className="text-sm text-gray-400 ml-1">days</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('locations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'locations' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          <MapPin size={14} /> Stock by Location
        </button>
        <button onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'history' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          <History size={14} /> Adjustment History
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {tab === 'locations' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">On Hand</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Reserved</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Available</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bin Location</th>
              </tr>
            </thead>
            <tbody>
              {item.locations.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No stock at any location</td></tr>
              ) : item.locations.map((loc) => (
                <tr key={loc.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{loc.location_name}</td>
                  <td className="px-4 py-3 text-right font-mono">{parseFloat(loc.qty_on_hand).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600">
                    {parseFloat(loc.qty_reserved) > 0 ? parseFloat(loc.qty_reserved).toLocaleString() : '--'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">{parseFloat(loc.qty_available).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{loc.bin_label || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Change</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">After</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No adjustment history</td></tr>
              ) : history.map((adj) => {
                const change = parseFloat(adj.qty_change);
                return (
                  <tr key={adj.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(adj.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{adj.location_name}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change > 0 ? '+' : ''}{change.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{parseFloat(adj.qty_after).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{adj.reason.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-gray-600">{adj.adjusted_by_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{adj.notes || '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdjust && (
        <AdjustStockModal itemId={item.id} itemName={item.name}
          onClose={() => setShowAdjust(false)} onAdjusted={() => { setShowAdjust(false); fetchItem(); }} />
      )}

      {showEdit && (
        <EditItemModal item={item}
          onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); fetchItem(); }} />
      )}
    </div>
  );
}

function AdjustStockModal({ itemId, itemName, onClose, onAdjusted }: {
  itemId: string; itemName: string; onClose: () => void; onAdjusted: () => void;
}) {
  const [allLocations, setAllLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState('');
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('physical_count');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/items/locations/list').then((res) => {
      setAllLocations(res.data);
      if (res.data.length > 0) setLocationId(res.data[0].id);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(amount);
    if (!qty || qty <= 0) { setError('Enter a quantity greater than 0'); return; }
    const qtyChange = direction === 'add' ? qty : -qty;

    setSaving(true); setError('');
    try {
      await api.post(`/items/${itemId}/adjust`, { location_id: locationId, qty_change: qtyChange, reason, notes });
      onAdjusted();
    } catch (err: any) { setError(err.response?.data?.error || 'Adjustment failed'); }
    finally { setSaving(false); }
  };

  const reasons = ['physical_count', 'damage', 'theft', 'correction', 'received', 'returned', 'build_usage', 'sale', 'other'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Adjust Stock: {itemName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white" required>
              <option value="">Select location</option>
              {allLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDirection('add')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border-2 transition-colors
                  ${direction === 'add' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Plus size={18} /> Add Stock
              </button>
              <button type="button" onClick={() => setDirection('remove')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border-2 transition-colors
                  ${direction === 'remove' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                <Minus size={18} /> Remove Stock
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter quantity"
              className="w-full px-3 py-2 border rounded-lg text-sm text-lg font-mono" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *{' '}
              <HelpTip side="bottom">
                <strong>physical count</strong>: matching system to a real-world count<br />
                <strong>damage</strong>: items broken or unusable<br />
                <strong>theft</strong>: items missing without explanation<br />
                <strong>correction</strong>: fixing a data entry mistake<br />
                <strong>received</strong>: stock came in (use a PO normally instead)<br />
                <strong>returned</strong>: stock returned by a customer<br />
                <strong>build_usage</strong>: consumed on a build (the build flow does this automatically)<br />
                <strong>sale</strong>: sold without going through an invoice<br />
                <strong>other</strong>: any reason that doesn't fit above &mdash; add a note
              </HelpTip>
            </label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
              {reasons.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50
                ${direction === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {saving ? 'Saving...' : direction === 'add' ? 'Add Stock' : 'Remove Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditItemModal({ item, onClose, onSaved }: {
  item: ItemDetail; onClose: () => void; onSaved: () => void;
}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [form, setForm] = useState({
    sku: item.sku || '',
    name: item.name || '',
    description: item.description || '',
    item_type: item.item_type || 'inventory',
    category_id: item.category_id || '',
    unit_of_measure: item.unit_of_measure || 'each',
    cost_price: parseFloat(item.cost_price) || 0,
    sell_price: parseFloat(item.sell_price) || 0,
    reorder_point: item.reorder_point || 0,
    reorder_qty: item.reorder_qty || 0,
    preferred_vendor_id: item.preferred_vendor_id || '',
    lead_time_days: item.lead_time_days ?? '',
    safety_stock_days: item.safety_stock_days ?? 7,
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/items/categories/list'), api.get('/vendors')])
      .then(([c, v]) => { setCategories(c.data); setVendors(v.data); });
  }, []);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await api.post('/items/categories/list', { name: newCategory.trim() });
      setCategories([...categories, res.data]);
      setForm({ ...form, category_id: res.data.id });
      setNewCategory('');
      setShowNewCategory(false);
    } catch (err: any) { setError('Failed to create category'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload: any = { ...form };
      if (!payload.category_id) payload.category_id = null;
      if (!payload.preferred_vendor_id) payload.preferred_vendor_id = null;
      if (payload.lead_time_days === '') delete payload.lead_time_days;
      else payload.lead_time_days = parseInt(payload.lead_time_days as string) || null;
      payload.safety_stock_days = parseInt(payload.safety_stock_days as string) || 7;
      delete payload.sku; // don't update SKU to avoid conflicts

      await api.patch(`/items/${item.id}`, payload);
      onSaved();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const units = ['each','ft','lft','sqft','cu_yd','ton','lb','gal','bag','box','pallet','roll','bundle','other'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Edit Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="inventory">Inventory</option>
                <option value="non_inventory">Non-Inventory</option>
                <option value="service">Service</option>
                <option value="surplus">Surplus</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select value={form.unit_of_measure} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {units.map((u) => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <div className="flex gap-2">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewCategory(!showNewCategory)}
                className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                <Plus size={14} />
              </button>
            </div>
            {showNewCategory && (
              <div className="flex gap-2 mt-2">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                <button type="button" onClick={handleAddCategory}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">Add</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
              <input type="number" step="0.01" min="0" value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
              <input type="number" step="0.01" min="0" value={form.sell_price}
                onChange={(e) => setForm({ ...form, sell_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
              <input type="number" min="0" value={form.reorder_point}
                onChange={(e) => setForm({ ...form, reorder_point: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Qty</label>
              <input type="number" min="0" value={form.reorder_qty}
                onChange={(e) => setForm({ ...form, reorder_qty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Vendor & Lead Times</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Vendor</label>
              <select value={form.preferred_vendor_id} onChange={(e) => setForm({ ...form, preferred_vendor_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">None</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                <input type="number" min="0" value={form.lead_time_days}
                  onChange={(e) => setForm({ ...form, lead_time_days: e.target.value as any })}
                  placeholder="Use vendor default"
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <p className="text-xs text-gray-400 mt-1">Leave blank to use vendor's default</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safety Stock (days)</label>
                <input type="number" min="0" value={form.safety_stock_days}
                  onChange={(e) => setForm({ ...form, safety_stock_days: parseInt(e.target.value) || 7 })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
