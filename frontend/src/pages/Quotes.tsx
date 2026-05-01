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
                <td className="px-4 py-3 text-right font-mono">
                  {q.margin_pct == null || q.margin_pct === '' ? (
                    '--'
                  ) : (() => {
                    const m = parseFloat(q.margin_pct);
                    const cls = m > 0 ? 'text-green-600 font-medium' : m < 0 ? 'text-red-600 font-medium' : 'text-gray-500';
                    return <span className={cls}>{m.toFixed(1)}%</span>;
                  })()}
                </td>
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

interface SurplusEntry {
  id: string;
  item_id: string;
  location_id: string;
  location_name: string;
  qty_available: string;
  original_cost: string;
  build_number: string | null;
}

function CreateQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [surplus, setSurplus] = useState<SurplusEntry[]>([]);
  const [form, setForm] = useState({ customer_id: '', valid_until: '', notes: '' });
  const [lines, setLines] = useState<any[]>([{ item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0, is_surplus: false, surplus_location_id: undefined }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/items', { params: { limit: 100 } }),
      api.get('/templates'),
      api.get('/surplus', { params: { limit: 500 } }),
    ]).then(([c, i, t, s]) => {
      setCustomers(c.data);
      setItems(i.data.data);
      setTemplates(t.data);
      setSurplus(s.data.data);
    });
  }, []);

  // Get surplus entries for a specific item, sorted by oldest capture first (FIFO)
  const surplusForItem = (itemId: string): SurplusEntry[] =>
    surplus.filter((s) => s.item_id === itemId);

  // Total qty across all surplus pool entries for an item
  const surplusTotalQty = (itemId: string): number =>
    surplusForItem(itemId).reduce((sum, s) => sum + parseFloat(s.qty_available), 0);

  // How much surplus is left after accounting for other lines that have
  // already turned on "use surplus" for the same item. Excludes the line at
  // currentIdx so a line can see its own remaining headroom.
  const remainingSurplusForItem = (itemId: string, currentIdx: number, currentLines = lines): number => {
    const total = surplusTotalQty(itemId);
    const claimed = currentLines.reduce((sum, l, i) => {
      if (i === currentIdx) return sum;
      if (l.item_id === itemId && l.is_surplus) return sum + (parseFloat(l.qty) || 0);
      return sum;
    }, 0);
    return Math.max(0, total - claimed);
  };

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

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0, is_surplus: false, surplus_location_id: undefined }]);

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
      // Reset surplus flag when item changes
      updated[idx].is_surplus = false;
      updated[idx].surplus_location_id = undefined;
    }
    setLines(updated);
  };

  // Pick a sensible "fresh" cost for a line: prefer the catalog cost, then
  // fall back to whatever the line was sitting at (e.g., a value typed in
  // manually or carried in from a template). Avoids forcing $0 just because
  // the catalog price is missing.
  const freshCostFor = (itemId: string | undefined, fallback: number): number => {
    if (!itemId) return fallback;
    const item = items.find((i) => i.id === itemId);
    const catalog = item ? parseFloat(item.cost_price) : 0;
    if (catalog > 0) return catalog;
    return fallback > 0 ? fallback : 0;
  };

  // Toggle "use surplus" for a line.
  //
  // Turning ON:
  //   - If the line's qty fits in the REMAINING surplus (pool total minus
  //     what other lines have already claimed), just convert the line.
  //   - If the qty exceeds remaining, split: this line becomes a surplus
  //     line at the remaining qty, and a NEW fresh line for the leftover
  //     is inserted right after.
  //   - If 0 surplus is left (other lines have it all), nothing happens.
  // Turning OFF: restore a fresh cost (catalog or fallback).
  const toggleSurplus = (idx: number) => {
    const updated = [...lines];
    const line = updated[idx];
    if (!line.item_id) return;
    const pool = surplusForItem(line.item_id);

    if (line.is_surplus) {
      // Turning OFF — restore a fresh cost
      const fallback = parseFloat(line.unit_cost) || 0;
      updated[idx] = {
        ...line,
        is_surplus: false,
        surplus_location_id: undefined,
        unit_cost: freshCostFor(line.item_id, fallback),
      };
      setLines(updated);
      return;
    }

    // Turning ON — use the first (oldest) surplus pool entry, but cap at
    // remaining (after other lines have taken their share)
    if (pool.length === 0) return;
    const remaining = remainingSurplusForItem(line.item_id, idx);
    if (remaining <= 0) return; // nothing left, no-op
    const sp = pool[0];
    const requestedQty = parseFloat(line.qty) || 1;
    const preToggleCost = parseFloat(line.unit_cost) || 0;

    if (requestedQty <= remaining) {
      // Fits — just convert
      updated[idx] = {
        ...line,
        is_surplus: true,
        surplus_location_id: sp.location_id,
        unit_cost: parseFloat(sp.original_cost),
      };
      setLines(updated);
      return;
    }

    // Need more than what's available — split into two lines
    const leftover = requestedQty - remaining;
    updated[idx] = {
      ...line,
      is_surplus: true,
      surplus_location_id: sp.location_id,
      unit_cost: parseFloat(sp.original_cost),
      qty: remaining,
    };
    updated.splice(idx + 1, 0, {
      item_id: line.item_id,
      description: line.description,
      qty: leftover,
      unit_cost: freshCostFor(line.item_id, preToggleCost),
      unit_price: line.unit_price,
      is_surplus: false,
      surplus_location_id: undefined,
    });
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
              {lines.map((line, idx) => {
                const surplusPool = line.item_id ? surplusForItem(line.item_id) : [];
                const remainingSurplus = line.item_id ? remainingSurplusForItem(line.item_id, idx) : 0;
                const hasSurplus = surplusPool.length > 0;
                const showSurplusToggle = hasSurplus && (line.is_surplus || remainingSurplus > 0);
                const activePoolEntry = line.is_surplus
                  ? surplusPool.find((s) => s.location_id === line.surplus_location_id) || surplusPool[0]
                  : null;
                return (
                  <div key={idx} className={`p-3 rounded-lg space-y-2 ${line.is_surplus ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <select value={line.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                        className="col-span-5 px-2 py-1.5 border rounded text-sm bg-white">
                        <option value="">Custom item</option>
                        {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ''}{i.name}</option>)}
                      </select>
                      <input type="number" step="0.01" min="0.01" value={line.qty}
                        max={line.is_surplus ? (parseFloat(line.qty) || 0) + remainingSurplus : undefined}
                        onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                      <input type="number" step="0.01" min="0" value={line.unit_cost}
                        onChange={(e) => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        disabled={line.is_surplus}
                        title={line.is_surplus ? 'Cost is fixed by the surplus pool entry' : ''}
                        className={`col-span-2 px-2 py-1.5 border rounded text-sm text-right ${line.is_surplus ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
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
                    {line.item_id && showSurplusToggle && (() => {
                      const requestedQty = parseFloat(line.qty) || 0;
                      const firstPool = surplusPool[0];
                      const willSplit = !line.is_surplus && requestedQty > remainingSurplus;
                      const splitSurplus = remainingSurplus;
                      const splitFresh = Math.max(0, requestedQty - splitSurplus);
                      return (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <label className="flex items-center gap-2 text-amber-800 cursor-pointer">
                            <input type="checkbox" checked={line.is_surplus}
                              onChange={() => toggleSurplus(idx)}
                              className="rounded" />
                            <span className="font-medium">
                              Use surplus
                              {!line.is_surplus && firstPool && !willSplit && (
                                <> &mdash; {remainingSurplus} available @ ${parseFloat(firstPool.original_cost).toFixed(2)}
                                  {firstPool.build_number && <> from build {firstPool.build_number}</>}
                                </>
                              )}
                              {!line.is_surplus && willSplit && firstPool && (
                                <> &mdash; will split: <strong>{splitSurplus} surplus</strong> @ ${parseFloat(firstPool.original_cost).toFixed(2)} + <strong>{splitFresh} fresh</strong> on a new line
                                </>
                              )}
                              {line.is_surplus && activePoolEntry && (
                                <> &mdash; consuming from {activePoolEntry.location_name}
                                </>
                              )}
                            </span>
                          </label>
                          {line.is_surplus && (
                            <span className="text-amber-700 font-medium">SURPLUS</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
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
