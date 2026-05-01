import { useEffect, useState } from 'react';
import api from '../api/client';
import { Copy, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/ConfirmDialog';

interface Line {
  item_id: string;
  description: string;
  qty: number;
  unit_cost: number;
  unit_price: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  line_count: number;
  created_by_name: string;
}

/**
 * Reusable Quote Templates management UI used in Settings → Quote Templates
 * and the Quotes page "Templates" button.
 */
export default function TemplatesManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/templates'),
      api.get('/items', { params: { limit: 200 } }),
    ]).then(([t, i]) => {
      setTemplates(t.data);
      setItems(i.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Deactivate "${name}"?`,
      message: 'This template will be hidden from quote creation. Historical quotes that used this template still reference it for cost tracking.',
      confirmText: 'Deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/templates/${id}`);
      toast.success(`Template "${name}" deactivated.`);
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between p-4 border-b">
        <p className="text-sm text-gray-600">Reusable line-item bundles for creating quotes quickly</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Copy size={14} /> New Quote Template
        </button>
      </div>
      {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No quote templates yet. Create one to speed up quote creation.
              </td></tr>
            ) : templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.description || '--'}</td>
                <td className="px-4 py-3 text-right">{t.line_count}</td>
                <td className="px-4 py-3 text-gray-600">{t.created_by_name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(t)} className="text-primary-600 hover:text-primary-700">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(t.id, t.name)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <TemplateModal template={null} items={items}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchAll(); }} />
      )}
      {editing && (
        <TemplateModal template={editing} items={items}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchAll(); }} />
      )}
    </div>
  );
}

function TemplateModal({ template, items, onClose, onSaved }: {
  template: Template | null;
  items: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [lines, setLines] = useState<Line[]>([
    { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingLines, setLoadingLines] = useState(isEdit);

  useEffect(() => {
    if (isEdit && template) {
      setLoadingLines(true);
      api.get(`/templates/${template.id}`).then((res) => {
        const fetched = res.data.lines.map((l: any) => ({
          item_id: l.item_id || '',
          description: l.description || '',
          qty: parseFloat(l.qty),
          unit_cost: parseFloat(l.unit_cost),
          unit_price: parseFloat(l.unit_price),
        }));
        setLines(fetched.length > 0 ? fetched : [{ item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0 }]);
      }).catch(() => {}).finally(() => setLoadingLines(false));
    }
  }, [isEdit, template?.id]);

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0 }]);
  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const updateLine = (idx: number, field: keyof Line, value: any) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        name,
        description: description || undefined,
        lines: lines.map((l) => ({ ...l, item_id: l.item_id || undefined })),
      };
      if (isEdit) {
        await api.put(`/templates/${template!.id}`, payload);
      } else {
        await api.post('/templates', payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Quote Template' : 'New Quote Template'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Standard Fence Job — 440 LF"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <button type="button" onClick={addLine} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Line</button>
            </div>

            {loadingLines ? (
              <div className="text-center text-sm text-gray-500 py-4">Loading lines...</div>
            ) : (
              <>
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
                          <option value="">Custom item (no inventory link)</option>
                          {items.map((i) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} — ` : ''}{i.name}</option>)}
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
                          className="col-span-1 text-red-400 hover:text-red-600" disabled={lines.length <= 1}>
                          <X size={16} className="mx-auto" />
                        </button>
                      </div>
                      <input value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        placeholder={line.item_id ? 'Description (auto-filled — edit to override)' : 'Description (required for custom items)'}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                        required={!line.item_id} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Wrapper that renders TemplatesManager inside a centered modal.
 * Used by the Quotes page "Templates" button.
 */
export function TemplatesManagerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Quote Templates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <TemplatesManager />
      </div>
    </div>
  );
}
