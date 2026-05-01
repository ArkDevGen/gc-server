import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Pencil, Save, X, Hammer, Copy, Trash2 } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
};

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLines, setEditLines] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showConvert, setShowConvert] = useState(false);

  const fetchQuote = async () => {
    try {
      const res = await api.get(`/quotes/${id}`);
      setQuote(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuote(); }, [id]);

  // Load locations on mount so the Convert to Build modal has them ready
  // even if the user never opens the Edit form (which also loads them).
  useEffect(() => {
    api.get('/items/locations/list').then((res) => setLocations(res.data)).catch(() => {});
  }, []);

  const startEdit = () => {
    setEditForm({
      customer_id: quote.customer_id,
      valid_until: quote.valid_until ? quote.valid_until.split('T')[0] : '',
      notes: quote.notes || '',
      status: quote.status,
    });
    setEditLines(quote.lines.map((l: any) => ({
      item_id: l.item_id || '',
      description: l.description || l.item_name || '',
      qty: parseFloat(l.qty),
      unit_cost: parseFloat(l.unit_cost),
      unit_price: parseFloat(l.unit_price),
      is_surplus: l.is_surplus || false,
    })));
    // Load items and customers for dropdowns
    Promise.all([
      api.get('/items', { params: { limit: 200 } }),
      api.get('/customers'),
      api.get('/items/locations/list'),
    ]).then(([i, c, l]) => {
      setItems(i.data.data);
      setCustomers(c.data);
      setLocations(l.data);
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await api.patch(`/quotes/${id}`, {
        ...editForm,
        valid_until: editForm.valid_until || undefined,
        lines: editLines.map((l: any) => ({ ...l, item_id: l.item_id || undefined })),
      });
      setEditing(false);
      fetchQuote();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleConvertToBuild = async (name: string, locationId: string) => {
    setActionLoading('convert');
    try {
      const res = await api.post(`/quotes/${id}/convert-to-build`, { name, location_id: locationId });
      setShowConvert(false);
      toast.success('Quote converted to build.');
      navigate(`/builds/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to convert quote');
    } finally {
      setActionLoading('');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete quote ${quote.quote_number}?`,
      message: (
        <>
          This will remove the quote and all its line items for <strong>{quote.customer_name}</strong>. This cannot be undone.
          <br /><br />
          If this quote was already converted to a build, the system will block the delete and ask you to remove the build first or change the quote's status to Rejected.
        </>
      ),
      confirmText: 'Delete Quote',
      danger: true,
    });
    if (!ok) return;
    setActionLoading('delete');
    try {
      await api.delete(`/quotes/${id}`);
      toast.success(`Quote ${quote.quote_number} deleted.`);
      navigate('/quotes');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete quote');
    } finally {
      setActionLoading('');
    }
  };

  const addLine = () => setEditLines([...editLines, { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0, is_surplus: false }]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...editLines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'item_id' && value) {
      const item = items.find((i: any) => i.id === value);
      if (item) {
        updated[idx].description = item.name;
        updated[idx].unit_cost = parseFloat(item.cost_price);
        updated[idx].unit_price = parseFloat(item.sell_price);
      }
    }
    setEditLines(updated);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!quote) return <div className="text-center py-12 text-gray-500">Quote not found</div>;

  const total = editing
    ? editLines.reduce((s: number, l: any) => s + l.qty * l.unit_price, 0)
    : parseFloat(quote.total);

  return (
    <div>
      <Link to="/quotes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Quotes
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{quote.quote_number}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span>{quote.customer_name}</span>
              <span>{new Date(quote.quote_date).toLocaleDateString()}</span>
              {quote.valid_until && <span>Expires: {new Date(quote.valid_until).toLocaleDateString()}</span>}
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[quote.status] || ''}`}>
                {quote.status}
              </span>
            </div>
            {quote.notes && <p className="text-sm text-gray-600 mt-2">{quote.notes}</p>}
          </div>
          <div className="flex gap-2">
            {!editing && quote.status !== 'converted' && (
              <>
                <button onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
                  <Pencil size={14} /> Edit
                </button>
                {(quote.status === 'draft' || quote.status === 'accepted') && (
                  <button onClick={() => setShowConvert(true)} disabled={!!actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
                    <Hammer size={14} /> {actionLoading === 'convert' ? 'Converting...' : 'Convert to Build'}
                  </button>
                )}
                <button onClick={handleDelete} disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                  title="Delete this quote">
                  <Trash2 size={14} /> {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
            {editing && (
              <>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">${total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Margin</p>
            {quote.margin_pct == null || quote.margin_pct === '' ? (
              <p className="text-2xl font-bold text-gray-400">--</p>
            ) : (() => {
              const m = parseFloat(quote.margin_pct);
              const cls = m > 0 ? 'text-green-600' : m < 0 ? 'text-red-600' : 'text-gray-500';
              return <p className={`text-2xl font-bold ${cls}`}>{m.toFixed(1)}%</p>;
            })()}
          </div>
          <div>
            <p className="text-sm text-gray-500">Line Items</p>
            <p className="text-2xl font-bold">{quote.lines?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created By</p>
            <p className="text-lg font-medium">{quote.created_by_name}</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Edit header fields */}
      {editing && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select value={editForm.customer_id} onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input type="date" value={editForm.valid_until} onChange={(e) => setEditForm({ ...editForm, valid_until: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {['draft', 'sent', 'accepted', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
        {editing && (
          <button onClick={addLine} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Line</button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Price</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Line Total</th>
              {editing && <th className="text-center px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {editing ? (
              editLines.map((line: any, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <select value={line.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm bg-white">
                      <option value="">Custom item</option>
                      {items.map((i: any) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ''}{i.name}</option>)}
                    </select>
                    {!line.item_id && (
                      <input value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        placeholder="Description" className="w-full px-2 py-1 border rounded text-sm mt-1" />
                    )}
                  </td>
                  <td className="px-4 py-2"><input type="number" step="0.01" min="0.01" value={line.qty}
                    onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border rounded text-sm text-right" /></td>
                  <td className="px-4 py-2"><input type="number" step="0.01" min="0" value={line.unit_cost}
                    onChange={(e) => updateLine(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 border rounded text-sm text-right" /></td>
                  <td className="px-4 py-2"><input type="number" step="0.01" min="0" value={line.unit_price}
                    onChange={(e) => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 border rounded text-sm text-right" /></td>
                  <td className="px-4 py-2 text-right font-mono">${(line.qty * line.unit_price).toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">
                    {editLines.length > 1 && (
                      <button onClick={() => setEditLines(editLines.filter((_: any, i: number) => i !== idx))}
                        className="text-red-400 hover:text-red-600">&times;</button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              quote.lines?.map((line: any, idx: number) => (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{line.item_name || line.description}</span>
                    {line.item_sku && <span className="text-xs text-gray-400 ml-2">{line.item_sku}</span>}
                    {line.is_surplus && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Surplus</span>}
                    {line.surplus_available?.length > 0 && !line.is_surplus && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        Surplus available: {line.surplus_available.reduce((s: number, sp: any) => s + parseFloat(sp.qty_available), 0)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{parseFloat(line.qty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">${parseFloat(line.unit_cost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">${parseFloat(line.unit_price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">${parseFloat(line.line_total).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
          {!editing && (
            <tfoot>
              <tr className="bg-gray-50 border-t">
                <td colSpan={5} className="px-4 py-3 text-right font-medium">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-lg">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showConvert && (
        <ConvertToBuildModal
          quote={quote}
          locations={locations}
          saving={actionLoading === 'convert'}
          onClose={() => setShowConvert(false)}
          onConfirm={(name, locationId) => handleConvertToBuild(name, locationId)}
        />
      )}
    </div>
  );
}

function ConvertToBuildModal({ quote, locations, saving, onClose, onConfirm }: {
  quote: any;
  locations: any[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (name: string, locationId: string) => void;
}) {
  const [name, setName] = useState(`${quote.customer_name} - ${quote.quote_number}`);
  const [locationId, setLocationId] = useState(locations[0]?.id || '');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Hammer size={18} className="text-green-600" /> Convert to Build
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !locationId) return;
            onConfirm(name.trim(), locationId);
          }}
          className="p-4 space-y-4"
        >
          <p className="text-sm text-gray-600">
            This creates a new build with all line items from quote{' '}
            <span className="font-mono font-medium">{quote.quote_number}</span> as allocated materials.
            The quote will be marked as Converted.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Build Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">How this build will be identified in lists and reports.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Location *</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Select a location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Where stock will be drawn from when material usage is recorded.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !locationId}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Hammer size={14} /> {saving ? 'Converting...' : 'Create Build'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
