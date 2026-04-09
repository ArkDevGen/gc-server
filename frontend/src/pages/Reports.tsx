import { useEffect, useState } from 'react';
import api from '../api/client';
import { BarChart3, AlertTriangle, DollarSign, Recycle, Hammer, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

type ReportTab = 'accounts-receivable' | 'accounts-payable' | 'inventory-value' | 'low-stock' | 'build-variance' | 'surplus-aging';

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('accounts-receivable');

  const tabs: { key: ReportTab; label: string; icon: any }[] = [
    { key: 'accounts-receivable', label: 'Accounts Receivable', icon: ArrowDownToLine },
    { key: 'accounts-payable', label: 'Accounts Payable', icon: ArrowUpFromLine },
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

      {tab === 'accounts-receivable' && <AccountsReceivableReport />}
      {tab === 'accounts-payable' && <AccountsPayableReport />}
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

const bucketLabels: Record<string, string> = {
  current: 'Current', '1_30': '1-30 Days', '31_60': '31-60 Days', '61_90': '61-90 Days', '90_plus': '90+ Days',
};
const bucketColors: Record<string, string> = {
  current: 'text-green-600', '1_30': 'text-amber-600', '31_60': 'text-orange-600', '61_90': 'text-red-500', '90_plus': 'text-red-700',
};

function AgingTable({ data, type }: { data: any; type: 'ar' | 'ap' }) {
  const isAR = type === 'ar';
  const rows = isAR ? data?.by_customer : data?.by_vendor;
  const details = isAR ? data?.invoices : data?.purchase_orders;
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
      </div>
    </div>
  );
}

function AccountsReceivableReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/reports/accounts-receivable').then((res) => setData(res.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;
  return <AgingTable data={data} type="ar" />;
}

function AccountsPayableReport() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/reports/accounts-payable').then((res) => setData(res.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Loading...</div>;
  return <AgingTable data={data} type="ap" />;
}
