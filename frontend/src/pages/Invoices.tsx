import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Receipt, Plus, X, Save } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';
import { useToast } from '../components/ui/Toast';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent_to_qbo: 'bg-purple-100 text-purple-700',
  emailed: 'bg-blue-100 text-blue-700',
  viewed: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-gray-100 text-gray-500',
};

export default function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Capture initial URL prefill values ONCE — clearing the URL must not
  // empty the props the modal relies on at submit time.
  const [createInitial] = useState(() => ({
    open: searchParams.get('new') === '1',
    customer_id: searchParams.get('customer_id') || '',
    build_id: searchParams.get('build_id') || '',
    quote_id: searchParams.get('quote_id') || '',
  }));
  const [showCreate, setShowCreate] = useState(createInitial.open);

  // Clear ?new=1 etc. after the modal mounts so a refresh doesn't re-open it
  useEffect(() => {
    if (createInitial.open) setSearchParams({}, { replace: true });
  }, []);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sort_by: sortBy, sort_dir: sortDir };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer_id = customerFilter;
      const res = await api.get('/invoices', { params });
      setInvoices(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter, customerFilter, sortBy, sortDir]);

  useEffect(() => { fetchInvoices(); }, [statusFilter, customerFilter, sortBy, sortDir]);

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const hasFilters = !!(statusFilter || customerFilter || search);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setCustomerFilter(''); };
  const onToggleSort = (col: string) => toggleSort(col, sortBy, sortDir, setSortBy, setSortDir);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <PageHelp storageKey="invoices">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Create an invoice</strong> from a closed-out build (button on the build detail page) or manually for one-off charges.</li>
          <li><strong>Status flow</strong>: Draft &rarr; Sent to QBO &rarr; Emailed &rarr; Viewed &rarr; Paid (or Overdue / Voided).</li>
          <li><strong>Email tracking</strong>: when QBO emails the invoice, the Email column on this list shows whether it was sent and when the customer opened it.</li>
        </ul>
      </PageHelp>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => fetchInvoices(1)}
        searchPlaceholder="Search by invoice number or customer name..."
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      >
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent_to_qbo">Sent to QBO</option>
          <option value="emailed">Emailed</option>
          <option value="viewed">Viewed</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="voided">Voided</option>
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
              <SortHeader col="invoice_number" label="Invoice #" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="customer" label="Customer" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="date" label="Date" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} />
              <SortHeader col="total" label="Total" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="right" />
              <SortHeader col="email_status" label="Email" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
              <SortHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={onToggleSort} align="center" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                No invoices found
              </td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/invoices/${inv.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{inv.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-mono">${parseFloat(inv.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${inv.email_status === 'viewed' ? 'text-green-600' :
                    inv.email_status === 'email_sent' ? 'text-blue-600' : 'text-gray-400'}`}>
                    {inv.email_status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || ''}`}>
                    {inv.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={(p) => fetchInvoices(p)} />
      </div>

      {showCreate && (
        <CreateInvoiceModal
          customers={customers}
          initialCustomerId={createInitial.customer_id}
          initialBuildId={createInitial.build_id}
          initialQuoteId={createInitial.quote_id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchInvoices(); }}
        />
      )}
    </div>
  );
}

function CreateInvoiceModal({ customers, initialCustomerId, initialBuildId, initialQuoteId, onClose, onCreated }: {
  customers: any[];
  initialCustomerId?: string;
  initialBuildId?: string;
  initialQuoteId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ customer_id: initialCustomerId || '', due_date: '', customer_email: '', notes: '' });
  const [lines, setLines] = useState<any[]>([{ item_id: '', description: '', qty: 1, unit_price: 0 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/items', { params: { limit: 200 } }).then((res) => setItems(res.data.data)).catch(() => {});
  }, []);

  // Pre-fill lines from the originating quote when launched from a build
  useEffect(() => {
    if (!initialQuoteId) return;
    api.get(`/quotes/${initialQuoteId}`).then((res) => {
      const ql = res.data.lines || [];
      if (ql.length === 0) return;
      setLines(ql.map((l: any) => ({
        item_id: l.item_id || '',
        description: l.description || l.item_name || '',
        qty: parseFloat(l.qty),
        unit_price: parseFloat(l.unit_price),
      })));
    }).catch(() => {});
  }, [initialQuoteId]);

  // Auto-fill customer email when customer changes
  useEffect(() => {
    if (form.customer_id) {
      const c = customers.find((c) => c.id === form.customer_id);
      if (c?.email && !form.customer_email) setForm((f) => ({ ...f, customer_email: c.email }));
    }
  }, [form.customer_id]);

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty: 1, unit_price: 0 }]);
  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'item_id' && value) {
      const item = items.find((i) => i.id === value);
      if (item) {
        updated[idx].description = item.name;
        updated[idx].unit_price = parseFloat(item.sell_price) || parseFloat(item.list_price) || 0;
      }
    }
    setLines(updated);
  };

  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const handleSubmit = async () => {
    setError('');
    if (!form.customer_id) return setError('Pick a customer.');
    const cleanLines = lines
      .filter((l) => (parseFloat(l.qty) || 0) > 0 && (l.item_id || (l.description || '').trim().length > 0))
      .map((l) => ({
        item_id: l.item_id || undefined,
        description: l.description || items.find((i) => i.id === l.item_id)?.name || '',
        qty: parseFloat(l.qty),
        unit_price: parseFloat(l.unit_price) || 0,
      }));
    if (cleanLines.length === 0) return setError('Add at least one line.');
    for (const cl of cleanLines) {
      if (!cl.description) return setError('Custom items need a description.');
    }
    setSaving(true);
    try {
      const res = await api.post('/invoices', {
        customer_id: form.customer_id,
        build_id: initialBuildId || undefined,
        due_date: form.due_date || undefined,
        customer_email: form.customer_email || undefined,
        notes: form.notes || undefined,
        lines: cleanLines,
      });
      toast.success(`Created ${res.data.invoice_number}.`);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">New Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
              <input type="email" value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                placeholder="customer@example.com"
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
              <div className="col-span-3 text-right">Unit Price</div>
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
                    <input type="number" step="0.01" min="0.01" value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" />
                    <input type="number" step="0.01" min="0" value={line.unit_price}
                      onChange={(e) => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
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
              placeholder="Notes shown on the invoice..." />
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
            <Save size={14} /> {saving ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
