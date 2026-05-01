import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { Search, AlertTriangle, DollarSign, Recycle, Hammer, ArrowDownToLine, ArrowUpFromLine, TrendingUp, MapPin } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

type ReportTab = 'accounts-receivable' | 'accounts-payable' | 'reorder-suggestions' | 'inventory-value' | 'inventory-by-location' | 'low-stock' | 'build-variance' | 'surplus-aging';

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('accounts-receivable');

  const tabs: { key: ReportTab; label: string; icon: any }[] = [
    { key: 'accounts-receivable', label: 'Accounts Receivable', icon: ArrowDownToLine },
    { key: 'accounts-payable', label: 'Accounts Payable', icon: ArrowUpFromLine },
    { key: 'reorder-suggestions', label: 'Reorder Suggestions', icon: TrendingUp },
    { key: 'inventory-value', label: 'Inventory Value', icon: DollarSign },
    { key: 'inventory-by-location', label: 'Inventory by Location', icon: MapPin },
    { key: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
    { key: 'build-variance', label: 'Build Variance', icon: Hammer },
    { key: 'surplus-aging', label: 'Surplus Aging', icon: Recycle },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="flex flex-wrap gap-1 mb-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'accounts-receivable' && <AccountsReceivableReport />}
      {tab === 'accounts-payable' && <AccountsPayableReport />}
      {tab === 'reorder-suggestions' && <ReorderSuggestionsReport />}
      {tab === 'inventory-value' && <InventoryValueReport />}
      {tab === 'inventory-by-location' && <InventoryByLocationReport />}
      {tab === 'low-stock' && <LowStockReport />}
      {tab === 'build-variance' && <BuildVarianceReport />}
      {tab === 'surplus-aging' && <SurplusAgingReport />}
    </div>
  );
}

function InventoryByLocationReport() {
  const [data, setData] = useState<any[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (search) params.search = search;
      if (categoryFilter) params.category_id = categoryFilter;
      const res = await api.get('/reports/inventory-by-location', { params });
      setLocations(res.data.locations);
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, categoryFilter]);

  useEffect(() => { fetchData(); }, [categoryFilter]);

  useEffect(() => {
    api.get('/items/categories/list').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border p-4">
        <form onSubmit={(e) => { e.preventDefault(); fetchData(1); }} className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[240px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by item name or SKU..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium">Search</button>
        </form>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                {locations.map((l) => (
                  <th key={l.id} className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{l.name}</th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-gray-600 bg-gray-100">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={locations.length + 3} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={locations.length + 3} className="px-4 py-8 text-center text-gray-500">No items found</td></tr>
              ) : data.map((item) => {
                const totalOnHand = parseFloat(item.total_on_hand);
                const isLow = totalOnHand <= item.reorder_point && item.reorder_point > 0;
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium sticky left-0 bg-white hover:bg-gray-50">
                      {item.name}
                      {item.sku && <span className="text-xs text-gray-400 ml-2 font-mono">{item.sku}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{item.category_name || '--'}</td>
                    {locations.map((l) => {
                      const stock = item.stock_by_location?.[l.id];
                      const qty = stock ? parseFloat(stock.qty_on_hand) : 0;
                      return (
                        <td key={l.id} className={`px-4 py-3 text-right font-mono ${qty === 0 ? 'text-gray-300' : ''}`}>
                          {qty.toLocaleString()}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-3 text-right font-mono font-bold bg-gray-50 ${isLow ? 'text-amber-600' : ''}`}>
                      {totalOnHand.toLocaleString()}
                      {isLow && <span className="block text-[10px] text-amber-600 font-normal">Low</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
      </div>
    </div>
  );
}

function InventoryValueReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/inventory-value').then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {data?.totals && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-2xl font-bold">{parseInt(data.totals.total_items).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Cost Value</p>
            <p className="text-2xl font-bold text-primary-600">${parseFloat(data.totals.total_cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Sell Value</p>
            <p className="text-2xl font-bold text-blue-600">${parseFloat(data.totals.total_sell_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cost Value</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Sell Value</th>
            </tr>
          </thead>
          <tbody>
            {data?.locations?.map((l: any) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{l.location_name}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{l.location_type.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right">{parseInt(l.item_count).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{parseFloat(l.total_qty).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(l.cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(l.sell_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LowStockReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/reports/low-stock', { params: { page, limit: 25 } });
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">On Hand</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Reorder At</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Reorder Qty</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Level</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Order</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-green-600">All items above reorder point</td></tr>
          ) : data.map((item) => {
            const pct = item.reorder_point > 0 ? (parseFloat(item.total_on_hand) / item.reorder_point) * 100 : 100;
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || '--'}</td>
                <td className="px-4 py-3 text-gray-600">{item.category_name || '--'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{parseFloat(item.total_on_hand).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{item.reorder_point}</td>
                <td className="px-4 py-3 text-right font-mono">{item.reorder_qty}</td>
                <td className="px-4 py-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct <= 25 ? 'bg-red-500' : pct <= 75 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {item.vendor_website ? (
                    <a href={item.vendor_website.startsWith('http') ? item.vendor_website : `https://${item.vendor_website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded hover:bg-primary-100 transition-colors">
                      Order from {item.vendor_name}
                    </a>
                  ) : item.vendor_name ? (
                    <span className="text-xs text-gray-400">{item.vendor_name}</span>
                  ) : (
                    <span className="text-xs text-gray-300">--</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
    </div>
  );
}

function BuildVarianceReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/reports/build-variance', { params: { page, limit: 25 } });
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Build</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Budget</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Actual</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Variance</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Variance %</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Surplus Value</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No completed builds yet</td></tr>
          ) : data.map((b) => {
            const variance = parseFloat(b.variance);
            return (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{b.build_number}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{b.customer_name || '--'}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(b.budget_total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(b.actual_total).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${variance.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${parseFloat(b.variance_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {b.variance_pct}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">${parseFloat(b.surplus_value).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
    </div>
  );
}

function SurplusAgingReport() {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/reports/surplus-aging', { params: { page, limit: 25 } });
      setData(res.data);
      setItems(res.data.items?.data || []);
      if (res.data.items?.pagination) {
        setPagination(res.data.items.pagination);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Entries</p>
            <p className="text-2xl font-bold">{parseInt(data.summary.total_entries)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-amber-600">${parseFloat(data.summary.total_value).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Avg Age</p>
            <p className="text-2xl font-bold">{Math.round(parseFloat(data.summary.avg_age_days))} days</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source Build</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Value</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Days Aged</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No surplus inventory</td></tr>
            ) : items.map((s: any) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.item_name}</td>
                <td className="px-4 py-3">{s.location_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.build_number || '--'}</td>
                <td className="px-4 py-3 text-right font-mono">{parseFloat(s.qty_available).toLocaleString()} {s.unit_of_measure}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(s.total_value).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono ${parseInt(s.days_aged) > 90 ? 'text-red-600' : parseInt(s.days_aged) > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                    {Math.round(parseFloat(s.days_aged))}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
      </div>
    </div>
  );
}

const bucketLabels: Record<string, string> = {
  current: 'Current', '1_30': '1-30 Days', '31_60': '31-60 Days', '61_90': '61-90 Days', '90_plus': '90+ Days',
};
const bucketColors: Record<string, string> = {
  current: 'text-green-600', '1_30': 'text-amber-600', '31_60': 'text-orange-600', '61_90': 'text-red-500', '90_plus': 'text-red-700',
};

function AgingTable({ data, type, onPageChange }: { data: any; type: 'ar' | 'ap'; onPageChange: (page: number, view: 'summary' | 'detail') => void }) {
  const isAR = type === 'ar';
  const summaryData = isAR ? data?.by_customer : data?.by_vendor;
  const detailData = isAR ? data?.invoices : data?.purchase_orders;
  const rows = summaryData?.data || summaryData || [];
  const details = detailData?.data || detailData || [];
  const summaryPagination = summaryData?.pagination;
  const detailPagination = detailData?.pagination;
  const [view, setView] = useState<'summary' | 'detail'>('summary');

  return (
    <div className="space-y-4">
      {data?.totals && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total {isAR ? 'AR' : 'AP'}</p>
            <p className={`text-2xl font-bold ${isAR ? 'text-emerald-600' : 'text-rose-600'}`}>
              ${parseFloat(isAR ? data.totals.total_ar : data.totals.total_ap).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Open {isAR ? 'Invoices' : 'POs'}</p>
            <p className="text-2xl font-bold">{parseInt(isAR ? data.totals.total_invoices : data.totals.total_pos)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-2xl font-bold text-red-600">
              ${parseFloat(data.totals.total_overdue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
      <div className="flex gap-1">
        <button onClick={() => setView('summary')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'summary' ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600'}`}>
          By {isAR ? 'Customer' : 'Vendor'}
        </button>
        <button onClick={() => setView('detail')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'detail' ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600'}`}>
          All {isAR ? 'Invoices' : 'POs'}
        </button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        {view === 'summary' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{isAR ? 'Customer' : 'Vendor'}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Current</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">1-30</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">31-60</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">61-90</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">90+</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {!rows?.length ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No outstanding {isAR ? 'receivables' : 'payables'}</td></tr>
              ) : rows.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right">{r.invoice_count || r.po_count}</td>
                  {['current_amount', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'].map((col, i) => {
                    const val = parseFloat(r[col]);
                    const colors = ['text-green-600', 'text-amber-600', 'text-orange-600', 'text-red-500', 'text-red-700'];
                    return <td key={col} className={`px-4 py-3 text-right font-mono ${colors[i]} ${i === 4 && val > 0 ? 'font-bold' : ''}`}>{val > 0 ? `$${val.toFixed(2)}` : '--'}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-mono font-bold">${parseFloat(r.total_owed).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{isAR ? 'Invoice' : 'PO'} #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{isAR ? 'Customer' : 'Vendor'}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{isAR ? 'Due' : 'Expected'}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aging</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {!details?.length ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No records</td></tr>
              ) : details.map((d: any) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono font-medium">{d.invoice_number || d.po_number}</td>
                  <td className="px-4 py-3">{d.customer_name || d.vendor_name}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(d.invoice_date || d.order_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{(d.due_date || d.expected_date) ? new Date(d.due_date || d.expected_date).toLocaleDateString() : '--'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">${parseFloat(d.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs font-medium ${bucketColors[d.aging_bucket] || ''}`}>{bucketLabels[d.aging_bucket] || ''}</span></td>
                  <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 capitalize">{d.status.replace(/_/g, ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view === 'summary' && summaryPagination && (
          <Pagination page={summaryPagination.page} totalPages={summaryPagination.totalPages} total={summaryPagination.total} limit={summaryPagination.limit} onPageChange={(p) => onPageChange(p, 'summary')} />
        )}
        {view === 'detail' && detailPagination && (
          <Pagination page={detailPagination.page} totalPages={detailPagination.totalPages} total={detailPagination.total} limit={detailPagination.limit} onPageChange={(p) => onPageChange(p, 'detail')} />
        )}
      </div>
    </div>
  );
}

function AccountsReceivableReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (page = 1, view: 'summary' | 'detail' = 'summary') => {
    setLoading(true);
    try {
      const res = await api.get('/reports/accounts-receivable', { params: { page, limit: 25, view } });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;
  return <AgingTable data={data} type="ar" onPageChange={(p, v) => fetchData(p, v)} />;
}

function AccountsPayableReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (page = 1, view: 'summary' | 'detail' = 'summary') => {
    setLoading(true);
    try {
      const res = await api.get('/reports/accounts-payable', { params: { page, limit: 25, view } });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;
  return <AgingTable data={data} type="ap" onPageChange={(p, v) => fetchData(p, v)} />;
}

function ReorderSuggestionsReport() {
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/reports/reorder-suggestions', { params: { page, limit: 25 } });
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const withUsage = data.filter((d) => d.has_usage_data);
  const withDifference = withUsage.filter((d) => d.difference !== 0);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAllDiffs = () => {
    if (selected.size === withDifference.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withDifference.map((d) => d.id)));
    }
  };

  const applySelected = async () => {
    const items = data
      .filter((d) => selected.has(d.id))
      .map((d) => ({ id: d.id, reorder_point: d.suggested_reorder_point }));
    if (items.length === 0) return;

    setApplying(true);
    try {
      const res = await api.post('/reports/reorder-suggestions/apply', { items });
      toast.success(`Updated ${res.data.updated} item${res.data.updated === 1 ? '' : 's'} with suggested reorder points.`);
      setSelected(new Set());
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to apply suggestions');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-medium mb-1">How this works</p>
        <p className="text-xs text-blue-700">
          Reorder points are calculated from actual usage over the last 90 days:
          <span className="font-mono ml-1">(Avg Daily Usage x Lead Time) + (Avg Daily Usage x Safety Stock Days)</span>.
          Lead time defaults from the vendor but can be overridden per item. Safety stock defaults to 7 days.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Items with Usage Data</p>
          <p className="text-2xl font-bold">{withUsage.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Needing Adjustment</p>
          <p className="text-2xl font-bold text-amber-600">{withDifference.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">No Usage Data</p>
          <p className="text-2xl font-bold text-gray-400">{data.length - withUsage.length}</p>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg p-3">
          <span className="text-sm font-medium text-primary-700">{selected.size} items selected</span>
          <button onClick={applySelected} disabled={applying}
            className="px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {applying ? 'Applying...' : 'Apply Selected'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-center px-3 py-3 w-10">
                <input type="checkbox" checked={selected.size === withDifference.length && withDifference.length > 0}
                  onChange={selectAllDiffs} className="rounded" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Avg Daily Use</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Lead Time</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">On Hand</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Current RP</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Suggested RP</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Change</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No items found. Usage data is needed to generate suggestions.</td></tr>
            ) : data.map((item) => {
              const diff = item.difference;
              return (
                <tr key={item.id} className={`border-b last:border-0 ${!item.has_usage_data ? 'opacity-50' : ''}`}>
                  <td className="text-center px-3 py-3">
                    {item.has_usage_data && diff !== 0 && (
                      <input type="checkbox" checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)} className="rounded" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.name}</span>
                    {item.sku && <span className="text-xs text-gray-400 ml-2">{item.sku}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{item.vendor_name || '--'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {item.has_usage_data ? `${item.avg_daily_usage}/day` : <span className="text-gray-400">No data</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{item.effective_lead_time}d</td>
                  <td className="px-4 py-3 text-right font-mono">{parseFloat(item.total_on_hand).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">{item.current_reorder_point}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {item.has_usage_data ? item.suggested_reorder_point : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.has_usage_data && diff !== 0 ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold
                        ${diff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    ) : item.has_usage_data ? (
                      <span className="text-xs text-green-600">OK</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchData(p)} />
      </div>
    </div>
  );
}
