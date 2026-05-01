import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Plus, FileText, Copy } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';
import { TemplatesManagerModal } from '../components/TemplatesManager';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
};

export default function Quotes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [showTemplates, setShowTemplates] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Clear the ?new=1 param after opening
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const fetchQuotes = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer_id = customerFilter;
      const res = await api.get('/quotes', { params });
      setQuotes(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, customerFilter, sortBy, sortDir]);

  useEffect(() => { fetchQuotes(); }, [statusFilter, customerFilter, sortBy, sortDir]);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || customerFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCustomerFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Copy size={16} /> Quote Templates
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus size={16} /> New Quote
          </button>
        </div>
      </div>

      <PageHelp storageKey="quotes" defaultOpen>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Create a quote</strong>: "+ New Quote" &rarr; pick customer, add line items (or "Load from Template" for common bundles), save.</li>
          <li><strong>Quote Templates</strong>: top-right button &mdash; manage reusable line-item bundles (also accessible from Settings).</li>
          <li><strong>Edit / send / accept</strong>: click a quote number to open it. Status flow is Draft &rarr; Sent &rarr; Accepted (or Rejected / Expired).</li>
          <li><strong>Convert to a build</strong>: open the quote &rarr; "Convert to Build" once accepted. Materials get allocated automatically.</li>
          <li><strong>Use surplus</strong>: when a line item has surplus available from a previous build, you'll see "Surplus available: N" with a toggle to consume from the pool at original cost.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchQuotes(1)}
        searchPlaceholder="Search by quote number or customer name..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <SortHeader col="quote_number" label="Quote #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="customer" label="Customer" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="total" label="Total" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="margin" label="Margin" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                No quotes yet
              </td></tr>
            ) : quotes.map((q) => (
              <tr key={q.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/quotes/${q.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {q.quote_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{q.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(q.quote_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(q.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono">{q.margin_pct ? `${parseFloat(q.margin_pct).toFixed(1)}%` : '--'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[q.status] || ''}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{q.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchQuotes(p)} />
      </div>

      {showCreate && <CreateQuoteModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchQuotes(); }} />}
      {showTemplates && <TemplatesManagerModal onClose={() => setShowTemplates(false)} />}
    </div>
  );
}

function CreateQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState({ customer_id: '', valid_until: '', notes: '' });
  const [lines, setLines] = useState<any[]>([{ item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0, is_surplus: false }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/items', { params: { limit: 100 } }),
      api.get('/templates'),
    ]).then(([c, i, t]) => { setCustomers(c.data); setItems(i.data.data); setTemplates(t.data); });
  }, []);

  // Load customer quote history when customer changes
  useEffect(() => {
    if (form.customer_id) {
      api.get(`/quotes/history/${form.customer_id}`).then((res) => setCustomerHistory(res.data)).catch(() => {});
    } else {
      setCustomerHistory([]);
    }
  }, [form.customer_id]);

  const loadTemplate = async (templateId: string) => {
    if (!templateId) return;
    try {
      const res = await api.post(`/templates/${templateId}/create-quote`);
      setLines(res.data.lines.map((l: any) => ({ ...l, item_id: l.item_id || '' })));
    } catch (err) { console.error(err); }
  };

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0, is_surplus: false }]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-fill from item
    if (field === 'item_id' && value) {
      const item = items.find((i) => i.id === value);
      if (item) {
        updated[idx].description = item.name;
        updated[idx].unit_cost = parseFloat(item.cost_price);
        updated[idx].unit_price = parseFloat(item.sell_price);
      }
    }
    setLines(updated);
  };

  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const total = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/quotes', { ...form, lines: lines.map((l) => ({ ...l, item_id: l.item_id || undefined })) });
      onCreated();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Quote</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          {/* Template Dropdown */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <label className="block text-sm font-medium text-blue-700 mb-1">Load from Template</label>
            <select onChange={(e) => loadTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white">
              <option value="">Start from scratch...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.line_count} items)</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white" required>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          {/* Customer Quote History */}
          {customerHistory.length > 0 && (
            <div className="bg-gray-50 border rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Previous quotes for this customer:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {customerHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-mono">{h.quote_number}</span>
                    <span>{new Date(h.quote_date).toLocaleDateString()}</span>
                    <span className="font-mono">${parseFloat(h.total).toFixed(2)}</span>
                    <span className="capitalize">{h.status}</span>
                    <span>{h.line_count} items</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <button type="button" onClick={addLine} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Line</button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-3 mb-1 text-xs font-medium text-gray-500">
              <div className="col-span-5">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Cost</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select value={line.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                      className="col-span-5 px-2 py-1.5 border rounded text-sm bg-white">
                      <option value="">Custom item</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ''}{i.name}</option>)}
                    </select>
                    <input type="number" step="0.01" min="0.01" value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                    <input type="number" step="0.01" min="0" value={line.unit_cost}
                      onChange={(e) => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                    <input type="number" step="0.01" min="0" value={line.unit_price}
                      onChange={(e) => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                    <button type="button" onClick={() => removeLine(idx)}
                      className="col-span-1 text-red-400 hover:text-red-600">&times;</button>
                  </div>
                  {!line.item_id && (
                    <input placeholder="Description (required for custom items)" value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm" required={!line.item_id} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-lg font-bold">Total: ${total.toFixed(2)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
