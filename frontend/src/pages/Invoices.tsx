import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { Receipt } from 'lucide-react';
import Pagination from '../components/ui/Pagination';

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
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { page, limit: 25 } });
      setInvoices(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                No invoices yet
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
