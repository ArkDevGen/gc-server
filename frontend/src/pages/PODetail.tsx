import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, PackageCheck, X, Save } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-blue-100 text-blue-700',
  sent_to_qbo: 'bg-purple-100 text-purple-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface POLine {
  id: string;
  line_number: number;
  item_id: string | null;
  item_name: string | null;
  item_sku: string | null;
  description: string;
  qty_ordered: string;
  qty_received: string;
  unit_cost: string;
}

export default function PODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [po, setPO] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);

  const fetchPO = async () => {
    try {
      const res = await api.get(`/purchase-orders/${id}`);
      setPO(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPO(); }, [id]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }
  if (!po) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Purchase order not found.</p>
        <Link to="/purchase-orders" className="text-primary-600 hover:text-primary-700">Back to Purchase Orders</Link>
      </div>
    );
  }

  const subtotal = parseFloat(po.subtotal);
  const total = parseFloat(po.total);
  const linesTotal = (po.lines || []).reduce((sum: number, l: POLine) => {
    return sum + parseFloat(l.qty_ordered) * parseFloat(l.unit_cost);
  }, 0);
  const allReceived = (po.lines || []).every((l: POLine) => parseFloat(l.qty_received) >= parseFloat(l.qty_ordered));
  const canReceive = po.status !== 'cancelled' && !allReceived;

  return (
    <div>
      <Link to="/purchase-orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Purchase Orders
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{po.po_number}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span>{po.vendor_name}</span>
              <span>{po.location_name}</span>
              <span>{new Date(po.order_date).toLocaleDateString()}</span>
              {po.expected_date && <span>Expected: {new Date(po.expected_date).toLocaleDateString()}</span>}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || ''}`}>
                {po.status.replace(/_/g, ' ')}
              </span>
            </div>
            {po.notes && <p className="text-sm text-gray-600 mt-2">{po.notes}</p>}
          </div>
          <div className="flex gap-2">
            {canReceive && (
              <button onClick={() => setShowReceive(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                <PackageCheck size={14} /> Receive
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
            <p className="text-2xl font-bold">{po.lines?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created By</p>
            <p className="text-lg font-medium">{po.created_by_name}</p>
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
              <th className="text-right px-4 py-3 font-medium text-gray-600">Ordered</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Received</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines || []).map((l: POLine) => {
              const ordered = parseFloat(l.qty_ordered);
              const received = parseFloat(l.qty_received);
              const balance = Math.max(0, ordered - received);
              const cost = parseFloat(l.unit_cost);
              const lineTotal = ordered * cost;
              const fullyReceived = balance === 0;
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
                  <td className="px-4 py-3 text-right font-mono">{ordered.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${received > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                    {received.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${fullyReceived ? 'text-gray-400' : 'text-amber-700 font-medium'}`}>
                    {balance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">${lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t">
              <td colSpan={6} className="px-4 py-3 text-right font-medium">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-lg">${linesTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showReceive && (
        <ReceivePOModal
          po={po}
          onClose={() => setShowReceive(false)}
          onReceived={() => { setShowReceive(false); fetchPO(); toast.success('Inventory received.'); }}
        />
      )}
    </div>
  );
}

function ReceivePOModal({ po, onClose, onReceived }: { po: any; onClose: () => void; onReceived: () => void }) {
  const [locations, setLocations] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Per-line: qty + receiving location, defaulted to balance + PO location
  const [receiveLines, setReceiveLines] = useState(() =>
    (po.lines || []).map((l: POLine) => {
      const balance = Math.max(0, parseFloat(l.qty_ordered) - parseFloat(l.qty_received));
      return {
        po_line_id: l.id,
        item_id: l.item_id,
        qty_received: balance,
        location_id: po.location_id,
        balance,
        line_number: l.line_number,
        item_label: l.item_name || l.description,
      };
    })
  );

  useEffect(() => {
    api.get('/items/locations/list').then((res) => setLocations(res.data)).catch(() => {});
  }, []);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...receiveLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setReceiveLines(updated);
  };

  const handleSubmit = async () => {
    setError('');
    const linesToSend = receiveLines
      .filter((l: any) => parseFloat(l.qty_received) > 0)
      .map((l: any) => ({
        po_line_id: l.po_line_id,
        item_id: l.item_id || undefined,
        qty_received: parseFloat(l.qty_received),
        location_id: l.location_id,
      }));
    if (linesToSend.length === 0) {
      setError('Enter a received quantity on at least one line.');
      return;
    }
    // Validate qty <= balance
    for (const l of receiveLines as any[]) {
      const q = parseFloat(l.qty_received);
      if (q > 0 && q > l.balance) {
        setError(`Line ${l.line_number}: cannot receive more than balance (${l.balance}).`);
        return;
      }
    }
    setSaving(true);
    try {
      await api.post(`/purchase-orders/${po.id}/receive`, {
        notes: notes || undefined,
        lines: linesToSend,
      });
      onReceived();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to receive.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Receive {po.po_number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <p className="text-sm text-gray-600">
            Enter the qty received per line. Defaults to the open balance. Set to 0 to skip a line on this receipt.
          </p>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-10">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Balance</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Receive</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Location</th>
                </tr>
              </thead>
              <tbody>
                {receiveLines.map((rl: any, idx: number) => (
                  <tr key={rl.po_line_id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-gray-500">{rl.line_number}</td>
                    <td className="px-3 py-2">{rl.item_label}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{rl.balance.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" max={rl.balance}
                        value={rl.qty_received}
                        onChange={(e) => updateLine(idx, 'qty_received', parseFloat(e.target.value) || 0)}
                        disabled={rl.balance === 0}
                        className="w-24 px-2 py-1 border rounded text-sm text-right disabled:bg-gray-50 disabled:text-gray-400" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={rl.location_id}
                        onChange={(e) => updateLine(idx, 'location_id', e.target.value)}
                        disabled={rl.balance === 0}
                        className="px-2 py-1 border rounded text-sm bg-white disabled:bg-gray-50">
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Packing slip #, condition notes, etc." />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border rounded-lg hover:bg-white text-sm font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
            <Save size={14} /> {saving ? 'Receiving...' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
