import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Search, Plus, AlertTriangle, Package, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import Pagination from '../components/ui/Pagination';

interface Item {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  category_name: string;
  vendor_name: string;
  unit_of_measure: string;
  cost_price: string;
  sell_price: string;
  total_on_hand: string;
  total_available: string;
  reorder_point: number;
}

interface Category { id: string; name: string; }
interface Location { id: string; name: string; }
interface Vendor { id: string; name: string; }

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [stockFilter, setStockFilter] = useState(''); // '' | 'low' | 'in_stock' | 'no_stock'
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (categoryFilter) params.category_id = categoryFilter;
      if (typeFilter) params.item_type = typeFilter;
      if (vendorFilter) params.vendor_id = vendorFilter;
      if (stockFilter === 'low') params.low_stock = true;
      if (stockFilter === 'in_stock') params.has_stock = 'true';
      if (stockFilter === 'no_stock') params.has_stock = 'false';

      const res = await api.get('/items', { params });
      setItems(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, typeFilter, vendorFilter, stockFilter, sortBy, sortDir]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    Promise.all([
      api.get('/items/categories/list'),
      api.get('/items/locations/list'),
      api.get('/vendors'),
    ]).then(([catRes, locRes, venRes]) => {
      setCategories(catRes.data);
      setLocations(locRes.data);
      setVendors(venRes.data);
    }).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchItems(1); };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-primary-600" /> : <ArrowDown size={12} className="text-primary-600" />;
  };

  const SortHeader = ({ col, label, align = 'left' }: { col: string; label: string; align?: string }) => (
    <th className={`text-${align} px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none`}
      onClick={() => toggleSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label} <SortIcon col={col} />
      </span>
    </th>
  );

  const hasFilters = categoryFilter || typeFilter || vendorFilter || stockFilter;
  const clearFilters = () => { setCategoryFilter(''); setTypeFilter(''); setVendorFilter(''); setStockFilter(''); };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by name, SKU, or description..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors">Search</button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="">All Types</option>
              <option value="inventory">Inventory</option>
              <option value="non_inventory">Non-Inventory</option>
              <option value="surplus">Surplus</option>
              <option value="service">Service</option>
            </select>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="">All Vendors</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="">All Stock Levels</option>
              <option value="low">Low Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="no_stock">No Stock</option>
            </select>
            {hasFilters && (
              <button type="button" onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <SortHeader col="sku" label="SKU" />
                <SortHeader col="name" label="Name" />
                <SortHeader col="category" label="Category" />
                <SortHeader col="type" label="Type" />
                <SortHeader col="on_hand" label="On Hand" align="right" />
                <SortHeader col="available" label="Available" align="right" />
                <SortHeader col="cost" label="Cost" align="right" />
                <SortHeader col="price" label="Price" align="right" />
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <Package size={32} className="mx-auto mb-2 text-gray-300" />
                    No items found
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const onHand = parseFloat(item.total_on_hand);
                  const isLow = onHand <= item.reorder_point && item.reorder_point > 0;
                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {item.sku || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/inventory/${item.id}`}
                          className="font-medium text-primary-600 hover:text-primary-700"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.category_name || '--'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                          ${item.item_type === 'inventory' ? 'bg-blue-100 text-blue-700' :
                            item.item_type === 'surplus' ? 'bg-amber-100 text-amber-700' :
                            item.item_type === 'non_inventory' ? 'bg-gray-100 text-gray-700' :
                            'bg-purple-100 text-purple-700'}`}
                        >
                          {item.item_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {onHand.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {parseFloat(item.total_available).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        ${parseFloat(item.cost_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${parseFloat(item.sell_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <AlertTriangle size={12} /> Low
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs font-medium">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total}
          limit={pagination.limit} onPageChange={(p) => fetchItems(p)} />
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); fetchItems(); }}
        />
      )}
    </div>
  );
}

function AddItemModal({
  categories,
  onClose,
  onAdded,
}: {
  categories: Category[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    item_type: 'inventory',
    category_id: '',
    unit_of_measure: 'each',
    cost_price: 0,
    sell_price: 0,
    reorder_point: 0,
    reorder_qty: 0,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.post('/items', {
        ...form,
        category_id: form.category_id || undefined,
        sku: form.sku || undefined,
      });
      onAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add New Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.item_type}
                onChange={(e) => setForm({ ...form, item_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="inventory">Inventory</option>
                <option value="non_inventory">Non-Inventory</option>
                <option value="service">Service</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={form.unit_of_measure}
                onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                {['each','ft','lft','sqft','cu_yd','ton','lb','gal','bag','box','pallet','roll','bundle','other'].map((u) => (
                  <option key={u} value={u}>{u.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.sell_price}
                onChange={(e) => setForm({ ...form, sell_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                value={form.reorder_point}
                onChange={(e) => setForm({ ...form, reorder_point: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Qty</label>
              <input
                type="number"
                min="0"
                value={form.reorder_qty}
                onChange={(e) => setForm({ ...form, reorder_qty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
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
              {saving ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
