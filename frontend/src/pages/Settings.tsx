import { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Users, MapPin, FolderTree, FileUp, Copy, Upload, CheckCircle, AlertTriangle } from 'lucide-react';

type TabKey = 'users' | 'locations' | 'categories' | 'templates' | 'import';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<TabKey>(isAdmin ? 'users' : 'locations');
  const [users, setUsers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    const promises: Promise<any>[] = [
      api.get('/items/locations/list'),
      api.get('/items/categories/list'),
      api.get('/templates'),
    ];
    if (isAdmin) promises.push(api.get('/auth/users'));

    Promise.all(promises)
      .then(([locRes, catRes, tplRes, usersRes]) => {
        setLocations(locRes.data);
        setCategories(catRes.data);
        setTemplates(tplRes.data);
        if (usersRes) setUsers(usersRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [isAdmin]);

  const tabs: { key: TabKey; label: string; icon: any; adminOnly?: boolean }[] = [
    ...(isAdmin ? [{ key: 'users' as TabKey, label: 'Users', icon: Users, adminOnly: true }] : []),
    { key: 'locations', label: 'Locations', icon: MapPin },
    { key: 'categories', label: 'Categories', icon: FolderTree },
    { key: 'templates', label: 'Templates', icon: Copy },
    ...(isAdmin ? [{ key: 'import' as TabKey, label: 'Import Data', icon: FileUp, adminOnly: true }] : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

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

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : tab === 'users' && isAdmin ? (
          <UsersTable users={users} />
        ) : tab === 'locations' ? (
          <LocationsTable locations={locations} />
        ) : tab === 'categories' ? (
          <CategoriesTable categories={categories} />
        ) : tab === 'templates' ? (
          <TemplatesPanel templates={templates} onRefresh={fetchData} />
        ) : tab === 'import' ? (
          <ImportPanel />
        ) : null}
      </div>
    </div>
  );
}

function UsersTable({ users }: { users: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b">
          <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
          <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-medium">{u.display_name}</td>
            <td className="px-4 py-3 text-gray-600">{u.username}</td>
            <td className="px-4 py-3">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 capitalize">{u.role}</span>
            </td>
            <td className="px-4 py-3 text-center">
              <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {u.is_active ? 'Active' : 'Disabled'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LocationsTable({ locations }: { locations: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b">
          <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
        </tr>
      </thead>
      <tbody>
        {locations.map((l) => (
          <tr key={l.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-medium">{l.name}</td>
            <td className="px-4 py-3">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 capitalize">
                {l.location_type.replace('_', ' ')}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-600">{l.address || '--'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoriesTable({ categories }: { categories: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b">
          <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Sort Order</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((c) => (
          <tr key={c.id} className="border-b last:border-0">
            <td className="px-4 py-3 font-medium">{c.name}</td>
            <td className="px-4 py-3 text-gray-600">{c.sort_order}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TemplatesPanel({ templates, onRefresh }: { templates: any[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.get('/items', { params: { limit: 200 } }).then((res) => setItems(res.data.data));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between p-4 border-b">
        <p className="text-sm text-gray-600">Reusable line item sets for creating quotes quickly</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Copy size={14} /> New Template
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
          </tr>
        </thead>
        <tbody>
          {templates.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">
              No templates yet. Create one to speed up quote creation.
            </td></tr>
          ) : templates.map((t) => (
            <tr key={t.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3 text-gray-600">{t.description || '--'}</td>
              <td className="px-4 py-3 text-right">{t.line_count}</td>
              <td className="px-4 py-3 text-gray-600">{t.created_by_name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreate && (
        <CreateTemplateModal items={items}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onRefresh(); }} />
      )}
    </div>
  );
}

function CreateTemplateModal({ items, onClose, onCreated }: { items: any[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<any[]>([{ item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLine = () => setLines([...lines, { item_id: '', description: '', qty: 1, unit_cost: 0, unit_price: 0 }]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'item_id' && value) {
      const item = items.find((i: any) => i.id === value);
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
      await api.post('/templates', { name, description, lines: lines.map((l) => ({ ...l, item_id: l.item_id || undefined })) });
      onCreated();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Quote Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Standard Fence Job - 440 LF"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description"
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <button type="button" onClick={addLine} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Line</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <select value={line.item_id} onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                      className="px-2 py-1.5 border rounded text-sm bg-white col-span-2">
                      <option value="">Custom item</option>
                      {items.map((i: any) => <option key={i.id} value={i.id}>{i.sku ? `${i.sku} - ` : ''}{i.name}</option>)}
                    </select>
                    <input placeholder="Qty" type="number" step="0.01" min="0.01" value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)} className="px-2 py-1.5 border rounded text-sm" />
                    <input placeholder="Price" type="number" step="0.01" min="0" value={line.unit_price}
                      onChange={(e) => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="px-2 py-1.5 border rounded text-sm" />
                    {!line.item_id && (
                      <input placeholder="Description" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        className="px-2 py-1.5 border rounded text-sm col-span-4" required={!line.item_id} />
                    )}
                  </div>
                  <button type="button" onClick={() => lines.length > 1 && setLines(lines.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 mt-1">&times;</button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportPanel() {
  const [importType, setImportType] = useState<'items' | 'customers' | 'vendors'>('items');
  const [result, setResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/import/history').then((res) => setHistory(res.data)).catch(() => {});
  }, [result]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true); setResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/import/${importType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err: any) {
      setResult({ error: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">One-Time Data Import</h3>
        <p className="text-xs text-gray-500 mb-4">Import data from your current systems via CSV. Duplicates will be skipped automatically.</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <select value={importType} onChange={(e) => setImportType(e.target.value as any)}
            className="px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="items">Inventory Items</option>
            <option value="customers">Customers</option>
            <option value="vendors">Vendors</option>
          </select>
          <input ref={fileRef} type="file" accept=".csv" className="text-sm file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-lg file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200" />
          <button onClick={handleUpload} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            <Upload size={14} /> {uploading ? 'Importing...' : 'Import'}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          <p className="font-medium mb-1">Expected CSV columns:</p>
          {importType === 'items' && <p>name (or item_name), sku, description, category, cost_price (or cost), sell_price (or price), reorder_point</p>}
          {importType === 'customers' && <p>name (or customer_name), email, phone, address</p>}
          {importType === 'vendors' && <p>name (or vendor_name), email, phone, address</p>}
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-lg ${result.error ? 'bg-red-50' : 'bg-green-50'}`}>
          {result.error ? (
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={16} /> <span className="text-sm">{result.error}</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle size={16} /> <span className="text-sm font-medium">Import complete</span>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Total:</span> {result.total}</div>
                <div><span className="text-green-600 font-medium">Imported:</span> {result.imported}</div>
                <div><span className="text-amber-600">Skipped:</span> {result.skipped}</div>
                <div><span className="text-red-600">Errors:</span> {result.errored}</div>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {result.errors.map((e: any, i: number) => (
                    <p key={i}>Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Import History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">File</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Imported</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Skipped</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Errors</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="px-3 py-2 capitalize">{h.import_type}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{h.filename || '--'}</td>
                  <td className="px-3 py-2 text-right text-green-600">{h.rows_imported}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{h.rows_skipped}</td>
                  <td className="px-3 py-2 text-right text-red-600">{h.rows_errored}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
