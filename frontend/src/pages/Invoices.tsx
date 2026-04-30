import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { Receipt } from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import FilterBar from '../components/ui/FilterBar';
import SortHeader, { SortDir, toggleSort } from '../components/ui/SortHeader';
import PageHelp from '../components/ui/PageHelp';

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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
                <td className="px-4 py-3 font-medium text-primary-600">{inv.invoice_number}</td>
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
    </div>
  );
}
