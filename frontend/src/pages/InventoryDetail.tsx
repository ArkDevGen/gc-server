import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, MapPin, History, Plus, Minus } from 'lucide-react';

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
  category_name: string;
  unit_of_measure: string;
  cost_price: string;
  sell_price: string;
  reorder_point: number;
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

  useEffect(() => {
    fetchItem();
  }, [id]);

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
                  'bg-gray-100 text-gray-700'}`}
              >
                {item.item_type.replace('_', ' ')}
              </span>
              <span>{item.unit_of_measure}</span>
            </div>
            {item.description && <p className="text-sm text-gray-600 mt-2">{item.description}</p>}
          </div>
          <button
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
          >
            Adjust Stock
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('locations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'locations' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          <MapPin size={14} /> Stock by Location
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === 'history' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
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
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No stock at any location
                  </td>
                </tr>
              ) : (
                item.locations.map((loc) => (
                  <tr key={loc.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{loc.location_name}</td>
                    <td className="px-4 py-3 text-right font-mono">{parseFloat(loc.qty_on_hand).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-600">
                      {parseFloat(loc.qty_reserved) > 0 ? parseFloat(loc.qty_reserved).toLocaleString() : '--'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-600">{parseFloat(loc.qty_available).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {loc.bin_label || '--'}
                    </td>
                  </tr>
                ))
              )}
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
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No adjustment history
                  </td>
                </tr>
              ) : (
                history.map((adj) => {
                  const change = parseFloat(adj.qty_change);
                  return (
                    <tr key={adj.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(adj.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{adj.location_name}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium
                        ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change > 0 ? '+' : ''}{change.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {parseFloat(adj.qty_after).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                          {adj.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{adj.adjusted_by_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                        {adj.notes || '--'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <AdjustStockModal
          itemId={item.id}
          itemName={item.name}
          locations={item.locations}
          onClose={() => setShowAdjust(false)}
          onAdjusted={() => { setShowAdjust(false); fetchItem(); }}
        />
      )}
    </div>
  );
}

function AdjustStockModal({
  itemId,
  itemName,
  locations,
  onClose,
  onAdjusted,
}: {
  itemId: string;
  itemName: string;
  locations: ItemLocation[];
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [allLocations, setAllLocations] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    location_id: locations[0]?.location_id || '',
    qty_change: 0,
    reason: 'physical_count',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/items/locations/list').then((res) => setAllLocations(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.qty_change === 0) {
      setError('Quantity change cannot be zero');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await api.post(`/items/${itemId}/adjust`, form);
      onAdjusted();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  const reasons = [
    'physical_count', 'damage', 'theft', 'correction', 'received',
    'returned', 'build_usage', 'sale', 'other',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Adjust Stock: {itemName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <select
              value={form.location_id}
              onChange={(e) => setForm({ ...form, location_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              required
            >
              <option value="">Select location</option>
              {allLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Change * (positive = add, negative = remove)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, qty_change: Math.abs(form.qty_change) })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${form.qty_change >= 0 ? 'bg-green-50 border-green-300 text-green-700' : 'hover:bg-gray-50'}`}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, qty_change: -Math.abs(form.qty_change || 1) })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${form.qty_change < 0 ? 'bg-red-50 border-red-300 text-red-700' : 'hover:bg-gray-50'}`}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                step="0.01"
                value={Math.abs(form.qty_change)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setForm({ ...form, qty_change: form.qty_change < 0 ? -val : val });
                }}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={2}
              placeholder="Optional notes about this adjustment"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
