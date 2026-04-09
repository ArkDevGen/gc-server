import { useEffect, useState } from 'react';
import api from '../api/client';
import { BarChart3, AlertTriangle, DollarSign, Recycle, Hammer } from 'lucide-react';

type ReportTab = 'inventory-value' | 'low-stock' | 'build-variance' | 'surplus-aging';

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('inventory-value');

  const tabs: { key: ReportTab; label: string; icon: any }[] = [
    { key: 'inventory-value', label: 'Inventory Value', icon: DollarSign },
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

      {tab === 'inventory-value' && <InventoryValueReport />}
      {tab === 'low-stock' && <LowStockReport />}
      {tab === 'build-variance' && <BuildVarianceReport />}
      {tab === 'surplus-aging' && <SurplusAgingReport />}
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

  useEffect(() => {
    api.get('/reports/low-stock').then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

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
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-green-600">All items above reorder point</td></tr>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BuildVarianceReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/build-variance').then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}

function SurplusAgingReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/surplus-aging').then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;

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
            {!data?.items?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No surplus inventory</td></tr>
            ) : data.items.map((s: any) => (
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
      </div>
    </div>
  );
}
