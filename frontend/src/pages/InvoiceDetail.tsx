import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Send, Eye, DollarSign, Ban } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent_to_qbo: 'bg-purple-100 text-purple-700',
  emailed: 'bg-blue-100 text-blue-700',
  viewed: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-gray-100 text-gray-500',
};

interface InvoiceLine {
  id: string;
  line_number: number;
  item_id: string | null;
  item_name: string | null;
  item_sku: string | null;
  description: string;
  qty: string;
  unit_price: string;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInv(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInvoice(); }, [id]);

  const changeStatus = async (newStatus: string, label: string, requireConfirm = false) => {
    if (requireConfirm) {
      const ok = await confirm({ title: label, message: `Mark ${inv.invoice_number} as ${label.toLowerCase()}?`, confirmText: label });
      if (!ok) return;
    }
    setActionLoading(newStatus);
    try {
      await api.patch(`/invoices/${id}/status`, { status: newStatus });
      toast.success(`${inv.invoice_number} marked ${label.toLowerCase()}.`);
      fetchInvoice();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Status update failed.');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }
  if (!inv) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Invoice not found.</p>
        <Link to="/invoices" className="text-primary-600 hover:text-primary-700">Back to Invoices</Link>
      </div>
    );
  }

  const subtotal = parseFloat(inv.subtotal);
  const total = parseFloat(inv.total);
  const isVoided = inv.status === 'voided';
  const isPaid = inv.status === 'paid';
  // Status transition affordances:
  // - "Mark Sent" before any send/view/paid event
  // - "Mark Viewed" once it's been emailed/sent (for QBO sync follow-up)
  // - "Mark Paid" any time it isn't already paid/voided
  // - "Void" any time it isn't already voided/paid
  const canMarkSent = !isVoided && !isPaid && (inv.status === 'draft' || inv.status === 'sent_to_qbo');
  const canMarkViewed = !isVoided && !isPaid && (inv.status === 'emailed' || inv.status === 'sent_to_qbo');
  const canMarkPaid = !isVoided && !isPaid;
  const canVoid = !isVoided && !isPaid;

  return (
    <div>
      <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{inv.invoice_number}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span>{inv.customer_name}</span>
              <span>{new Date(inv.invoice_date).toLocaleDateString()}</span>
              {inv.due_date && <span>Due: {new Date(inv.due_date).toLocaleDateString()}</span>}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || ''}`}>
                {inv.status.replace(/_/g, ' ')}
              </span>
              {inv.email_status && inv.email_status !== 'not_set' && (
                <span className="text-xs text-gray-400">email: {inv.email_status.replace(/_/g, ' ')}</span>
              )}
            </div>
            {inv.customer_email && <p className="text-xs text-gray-500 mt-1">{inv.customer_email}</p>}
            {inv.notes && <p className="text-sm text-gray-600 mt-2">{inv.notes}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {canMarkSent && (
              <button onClick={() => changeStatus('emailed', 'Sent')} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                <Send size={14} /> {actionLoading === 'emailed' ? 'Saving...' : 'Mark Sent'}
              </button>
            )}
            {canMarkViewed && (
              <button onClick={() => changeStatus('viewed', 'Viewed')} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50">
                <Eye size={14} /> {actionLoading === 'viewed' ? 'Saving...' : 'Mark Viewed'}
              </button>
            )}
            {canMarkPaid && (
              <button onClick={() => changeStatus('paid', 'Paid', true)} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
                <DollarSign size={14} /> {actionLoading === 'paid' ? 'Saving...' : 'Mark Paid'}
              </button>
            )}
            {canVoid && (
              <button onClick={() => changeStatus('voided', 'Voided', true)} disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50">
                <Ban size={14} /> {actionLoading === 'voided' ? 'Saving...' : 'Void'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">${total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Subtotal</p>
            <p className="text-2xl font-bold">${subtotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Line Items</p>
            <p className="text-2xl font-bold">{inv.lines?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created By</p>
            <p className="text-lg font-medium">{inv.created_by_name}</p>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <h2 className="text-base font-semibold text-gray-900 px-6 py-4 border-b">Line Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Price</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l: InvoiceLine) => {
              const qty = parseFloat(l.qty);
              const price = parseFloat(l.unit_price);
              const lineTotal = qty * price;
              return (
                <tr key={l.id} className="border-b">
                  <td className="px-4 py-3 text-gray-500">{l.line_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{l.item_name || l.description}</div>
                    {l.item_sku && <div className="text-xs text-gray-500 font-mono">{l.item_sku}</div>}
                    {l.item_name && l.description && l.description !== l.item_name && (
                      <div className="text-xs text-gray-500">{l.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{qty.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">${price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">${lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t">
              <td colSpan={4} className="px-4 py-3 text-right font-medium">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
